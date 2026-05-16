-- =============================================================================
-- Phase elements, slots, and progression rules
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / ON CONFLICT / DO NOTHING throughout.
--
-- Adds the missing format-engine layer:
--   - phase_elements: group / bracket / single-match / heat / ladder elements
--   - element_slots: entrants or placeholders within an element
--   - progression_rules: links from earlier results/standings into later slots
--
-- Existing pools are backfilled as "group" phase elements and existing matches
-- are linked to the element for their pool.
--
-- Run after add_rbac.sql because the RLS policies use public.get_my_role().
-- =============================================================================

create table if not exists public.phase_elements (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  pool_id uuid references public.pools(id) on delete cascade,
  slug text not null,
  name text not null,
  element_type text not null default 'group',
  display_order int not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (phase_id, slug),
  unique (pool_id),
  check (slug ~ '^[a-z0-9-]+$'),
  check (display_order > 0),
  check (element_type in (
    'group',
    'bracket',
    'single_match',
    'heat',
    'league_table',
    'ladder',
    'swiss_round'
  ))
);

create index if not exists phase_elements_phase_id_idx
  on public.phase_elements(phase_id);

create index if not exists phase_elements_pool_id_idx
  on public.phase_elements(pool_id)
  where pool_id is not null;

alter table public.matches
  add column if not exists phase_element_id uuid
  references public.phase_elements(id) on delete set null;

create index if not exists matches_phase_element_id_idx
  on public.matches(phase_element_id);

create table if not exists public.element_slots (
  id uuid primary key default gen_random_uuid(),
  phase_element_id uuid not null references public.phase_elements(id) on delete cascade,
  display_order int not null,
  label text,
  slot_type text not null default 'placeholder',
  team_id uuid references public.teams(id) on delete set null,
  source_phase_id uuid references public.phases(id) on delete set null,
  source_element_id uuid references public.phase_elements(id) on delete set null,
  source_pool_id uuid references public.pools(id) on delete set null,
  source_match_id uuid references public.matches(id) on delete set null,
  source_rank int,
  source_outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (phase_element_id, display_order),
  check (display_order > 0),
  check (source_rank is null or source_rank > 0),
  check (slot_type in (
    'team',
    'source',
    'bye',
    'placeholder',
    'manual'
  )),
  check (source_outcome is null or source_outcome in (
    'winner',
    'loser',
    'rank',
    'best_rank',
    'manual'
  ))
);

create index if not exists element_slots_phase_element_id_idx
  on public.element_slots(phase_element_id);

create index if not exists element_slots_team_id_idx
  on public.element_slots(team_id)
  where team_id is not null;

create table if not exists public.progression_rules (
  id uuid primary key default gen_random_uuid(),
  from_phase_id uuid references public.phases(id) on delete cascade,
  from_element_id uuid references public.phase_elements(id) on delete cascade,
  from_pool_id uuid references public.pools(id) on delete cascade,
  from_match_id uuid references public.matches(id) on delete cascade,
  source_type text not null,
  source_rank int,
  to_phase_id uuid references public.phases(id) on delete cascade,
  to_element_id uuid not null references public.phase_elements(id) on delete cascade,
  to_slot_id uuid references public.element_slots(id) on delete cascade,
  to_slot_order int,
  display_order int not null default 1,
  rule_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (source_rank is null or source_rank > 0),
  check (to_slot_order is null or to_slot_order > 0),
  check (display_order > 0),
  check (source_type in (
    'standings_rank',
    'match_winner',
    'match_loser',
    'best_rank',
    'manual'
  )),
  check (to_slot_id is not null or to_slot_order is not null)
);

create index if not exists progression_rules_from_phase_id_idx
  on public.progression_rules(from_phase_id);

create index if not exists progression_rules_from_element_id_idx
  on public.progression_rules(from_element_id);

create index if not exists progression_rules_to_element_id_idx
  on public.progression_rules(to_element_id);

create index if not exists progression_rules_to_slot_id_idx
  on public.progression_rules(to_slot_id)
  where to_slot_id is not null;

-- ---------------------------------------------------------------------------
-- Defaults and sync triggers
-- ---------------------------------------------------------------------------

create or replace function public.ensure_group_element_for_pool()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.phase_elements (
    phase_id,
    pool_id,
    slug,
    name,
    element_type,
    display_order,
    metadata
  )
  values (
    new.phase_id,
    new.id,
    new.slug,
    new.name,
    'group',
    new.display_order,
    jsonb_build_object('legacy_pool_id', new.id)
  )
  on conflict (pool_id) do update
  set
    phase_id = excluded.phase_id,
    slug = excluded.slug,
    name = excluded.name,
    element_type = 'group',
    display_order = excluded.display_order,
    metadata = coalesce(public.phase_elements.metadata, '{}'::jsonb)
      || jsonb_build_object('legacy_pool_id', excluded.pool_id);

  return new;
end;
$$;

drop trigger if exists pools_ensure_group_element on public.pools;
create trigger pools_ensure_group_element
  after insert or update of phase_id, slug, name, display_order on public.pools
  for each row
  execute function public.ensure_group_element_for_pool();

create or replace function public.ensure_phase_element_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase_element_id is null and new.pool_id is not null then
    select id into new.phase_element_id
    from public.phase_elements
    where pool_id = new.pool_id
    limit 1;
  end if;

  if new.phase_element_id is null and new.phase_id is not null then
    select id into new.phase_element_id
    from public.phase_elements
    where phase_id = new.phase_id
    order by display_order
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_ensure_phase_element on public.matches;
create trigger matches_ensure_phase_element
  before insert or update of phase_id, pool_id, phase_element_id on public.matches
  for each row
  execute function public.ensure_phase_element_for_match();

-- ---------------------------------------------------------------------------
-- Backfill existing pools and matches
-- ---------------------------------------------------------------------------

insert into public.phase_elements (
  phase_id,
  pool_id,
  slug,
  name,
  element_type,
  display_order,
  metadata
)
select
  p.phase_id,
  p.id,
  p.slug,
  p.name,
  'group',
  p.display_order,
  jsonb_build_object('legacy_pool_id', p.id)
from public.pools p
on conflict (pool_id) do update
set
  phase_id = excluded.phase_id,
  slug = excluded.slug,
  name = excluded.name,
  element_type = 'group',
  display_order = excluded.display_order,
  metadata = coalesce(public.phase_elements.metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_pool_id', excluded.pool_id);

update public.matches m
set phase_element_id = pe.id
from public.phase_elements pe
where pe.pool_id = m.pool_id
  and m.phase_element_id is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.phase_elements enable row level security;
alter table public.element_slots enable row level security;
alter table public.progression_rules enable row level security;

drop policy if exists "phase_elements_anon_select" on public.phase_elements;
drop policy if exists "phase_elements_auth_select" on public.phase_elements;
drop policy if exists "phase_elements_auth_insert" on public.phase_elements;
drop policy if exists "phase_elements_auth_update" on public.phase_elements;
drop policy if exists "phase_elements_auth_delete" on public.phase_elements;

drop policy if exists "element_slots_anon_select" on public.element_slots;
drop policy if exists "element_slots_auth_select" on public.element_slots;
drop policy if exists "element_slots_auth_insert" on public.element_slots;
drop policy if exists "element_slots_auth_update" on public.element_slots;
drop policy if exists "element_slots_auth_delete" on public.element_slots;

drop policy if exists "progression_rules_anon_select" on public.progression_rules;
drop policy if exists "progression_rules_auth_select" on public.progression_rules;
drop policy if exists "progression_rules_auth_insert" on public.progression_rules;
drop policy if exists "progression_rules_auth_update" on public.progression_rules;
drop policy if exists "progression_rules_auth_delete" on public.progression_rules;

create policy "phase_elements_anon_select"
  on public.phase_elements for select to anon using (true);

create policy "element_slots_anon_select"
  on public.element_slots for select to anon using (true);

create policy "progression_rules_anon_select"
  on public.progression_rules for select to anon using (true);

create policy "phase_elements_auth_select"
  on public.phase_elements for select to authenticated
  using (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phase_elements_auth_insert"
  on public.phase_elements for insert to authenticated
  with check (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phase_elements_auth_update"
  on public.phase_elements for update to authenticated
  using (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "phase_elements_auth_delete"
  on public.phase_elements for delete to authenticated
  using (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "element_slots_auth_select"
  on public.element_slots for select to authenticated
  using (phase_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "element_slots_auth_insert"
  on public.element_slots for insert to authenticated
  with check (phase_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "element_slots_auth_update"
  on public.element_slots for update to authenticated
  using (phase_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (phase_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "element_slots_auth_delete"
  on public.element_slots for delete to authenticated
  using (phase_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "progression_rules_auth_select"
  on public.progression_rules for select to authenticated
  using (to_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "progression_rules_auth_insert"
  on public.progression_rules for insert to authenticated
  with check (to_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "progression_rules_auth_update"
  on public.progression_rules for update to authenticated
  using (to_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (to_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "progression_rules_auth_delete"
  on public.progression_rules for delete to authenticated
  using (to_element_id in (
    select pe.id
    from public.phase_elements pe
    join public.phases ph on ph.id = pe.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- Verification:
-- select to_regclass('public.phase_elements');
-- select to_regclass('public.element_slots');
-- select to_regclass('public.progression_rules');
--
-- select count(*) as matches_without_phase_element
-- from public.matches
-- where phase_id is not null
--   and deleted_at is null
--   and phase_element_id is null;
