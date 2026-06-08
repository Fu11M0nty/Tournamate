-- =============================================================================
-- Phases
--
-- Introduces a competition-structure layer between age_groups and matches.
-- Existing tournaments keep working because age_groups.day and all current
-- queries remain in place. Every age group is backfilled with one default
-- "Round Robin" phase, and existing matches are linked to that phase.
--
-- Safe to re-run: all schema changes are guarded and data backfills use
-- ON CONFLICT / WHERE conditions.
-- =============================================================================

create table if not exists public.phases (
  id            uuid primary key default gen_random_uuid(),
  age_group_id  uuid not null references public.age_groups(id) on delete cascade,
  slug          text not null default 'round-robin',
  name          text not null default 'Round Robin',
  phase_type    text not null default 'round_robin',
  display_order int not null default 1,
  standings_mode text not null default 'visible',
  scoring_system_id uuid,
  match_format  text not null default 'continuous',
  period_minutes int not null default 12,
  break_q1_q2_minutes int not null default 0,
  break_half_time_minutes int not null default 0,
  break_q3_q4_minutes int not null default 0,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (age_group_id, slug),
  check (slug ~ '^[a-z0-9-]+$'),
  check (phase_type in ('round_robin', 'group_stage', 'knockout', 'league', 'friendly')),
  check (standings_mode in ('visible', 'hidden', 'none')),
  check (match_format in ('continuous', 'halves', 'quarters')),
  check (period_minutes > 0),
  check (break_q1_q2_minutes >= 0),
  check (break_half_time_minutes >= 0),
  check (break_q3_q4_minutes >= 0)
);

create index if not exists phases_age_group_id_idx
  on public.phases(age_group_id);

-- Add the FK to scoring_systems only when that feature has already been
-- installed. This keeps the migration usable in databases that have not run
-- add_scoring_systems.sql yet.
do $$
begin
  if to_regclass('public.scoring_systems') is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'phases_scoring_system_id_fkey'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_scoring_system_id_fkey
      foreign key (scoring_system_id)
      references public.scoring_systems(id)
      on delete restrict;
  end if;
end $$;

alter table public.matches
  add column if not exists phase_id uuid
  references public.phases(id) on delete set null;

create index if not exists matches_phase_id_idx
  on public.matches(phase_id);

-- Keep the default phase present for age groups created after this migration
-- too. JSON access avoids a hard dependency on age_groups.scoring_system_id
-- in databases where the scoring-system migration has not been applied yet.
create or replace function public.ensure_default_phase_for_age_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoring_id uuid := null;
begin
  if to_jsonb(new) ? 'scoring_system_id' and to_jsonb(new)->>'scoring_system_id' is not null then
    scoring_id := (to_jsonb(new)->>'scoring_system_id')::uuid;
  end if;

  insert into public.phases (
    age_group_id,
    slug,
    name,
    phase_type,
    display_order,
    standings_mode,
    scoring_system_id,
    match_format,
    period_minutes,
    break_q1_q2_minutes,
    break_half_time_minutes,
    break_q3_q4_minutes
  )
  values (
    new.id,
    'round-robin',
    'Round Robin',
    'round_robin',
    1,
    'visible',
    scoring_id,
    new.match_format,
    new.period_minutes,
    new.break_q1_q2_minutes,
    new.break_half_time_minutes,
    new.break_q3_q4_minutes
  )
  on conflict (age_group_id, slug) do update
  set
    scoring_system_id = coalesce(excluded.scoring_system_id, public.phases.scoring_system_id),
    match_format = excluded.match_format,
    period_minutes = excluded.period_minutes,
    break_q1_q2_minutes = excluded.break_q1_q2_minutes,
    break_half_time_minutes = excluded.break_half_time_minutes,
    break_q3_q4_minutes = excluded.break_q3_q4_minutes;

  return new;
end;
$$;

drop trigger if exists age_groups_ensure_default_phase on public.age_groups;
create trigger age_groups_ensure_default_phase
  after insert or update on public.age_groups
  for each row
  execute function public.ensure_default_phase_for_age_group();

create or replace function public.ensure_default_phase_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase_id is null then
    select id into new.phase_id
    from public.phases
    where age_group_id = new.age_group_id
      and slug = 'round-robin'
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_ensure_default_phase on public.matches;
create trigger matches_ensure_default_phase
  before insert or update of age_group_id, phase_id on public.matches
  for each row
  execute function public.ensure_default_phase_for_match();

-- Backfill one default phase per age group. Copy scoring and match rules down
-- from age_groups so the next architecture step can make phases the owner.
insert into public.phases (
  age_group_id,
  slug,
  name,
  phase_type,
  display_order,
  standings_mode,
  match_format,
  period_minutes,
  break_q1_q2_minutes,
  break_half_time_minutes,
  break_q3_q4_minutes
)
select
  ag.id,
  'round-robin',
  'Round Robin',
  'round_robin',
  1,
  'visible',
  ag.match_format,
  ag.period_minutes,
  ag.break_q1_q2_minutes,
  ag.break_half_time_minutes,
  ag.break_q3_q4_minutes
from public.age_groups ag
on conflict (age_group_id, slug) do update
set
  name = excluded.name,
  phase_type = excluded.phase_type,
  display_order = excluded.display_order,
  standings_mode = excluded.standings_mode,
  match_format = public.phases.match_format,
  period_minutes = public.phases.period_minutes,
  break_q1_q2_minutes = public.phases.break_q1_q2_minutes,
  break_half_time_minutes = public.phases.break_half_time_minutes,
  break_q3_q4_minutes = public.phases.break_q3_q4_minutes;

-- Copy scoring-system assignments from age_groups when that feature exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'age_groups'
      and column_name = 'scoring_system_id'
  ) then
    execute 'update public.phases p
      set scoring_system_id = coalesce(p.scoring_system_id, ag.scoring_system_id)
      from public.age_groups ag
      where ag.id = p.age_group_id';
  end if;
end $$;

-- Link existing matches to their age group's default phase.
update public.matches m
set phase_id = p.id
from public.phases p
where p.age_group_id = m.age_group_id
  and p.slug = 'round-robin'
  and m.phase_id is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.phases enable row level security;

drop policy if exists "phases_anon_select" on public.phases;
drop policy if exists "phases_auth_select" on public.phases;
drop policy if exists "phases_auth_insert" on public.phases;
drop policy if exists "phases_auth_update" on public.phases;
drop policy if exists "phases_auth_delete" on public.phases;

create policy "phases_anon_select"
  on public.phases for select to anon using (true);

create policy "phases_auth_select"
  on public.phases for select to authenticated
  using (age_group_id in (
    select ag.id
    from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phases_auth_insert"
  on public.phases for insert to authenticated
  with check (age_group_id in (
    select ag.id
    from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phases_auth_update"
  on public.phases for update to authenticated
  using (age_group_id in (
    select ag.id
    from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (age_group_id in (
    select ag.id
    from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phases_auth_delete"
  on public.phases for delete to authenticated
  using (age_group_id in (
    select ag.id
    from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));
