-- =============================================================================
-- Pools
--
-- Introduces pools/groups within a phase. Existing tournaments keep working:
-- every phase receives one default pool, every current team is assigned to it,
-- and every current match is linked to the default pool for its phase.
--
-- Safe to re-run.
-- =============================================================================

create table if not exists public.pools (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references public.phases(id) on delete cascade,
  slug          text not null default 'default',
  name          text not null default 'Default Pool',
  display_order int not null default 1,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (phase_id, slug),
  check (slug ~ '^[a-z0-9-]+$')
);

create index if not exists pools_phase_id_idx
  on public.pools(phase_id);

create unique index if not exists pools_one_default_per_phase_idx
  on public.pools(phase_id)
  where is_default;

create table if not exists public.pool_teams (
  pool_id       uuid not null references public.pools(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  primary key (pool_id, team_id)
);

create index if not exists pool_teams_team_id_idx
  on public.pool_teams(team_id);

alter table public.matches
  add column if not exists pool_id uuid
  references public.pools(id) on delete set null;

create index if not exists matches_pool_id_idx
  on public.matches(pool_id);

-- ---------------------------------------------------------------------------
-- Defaults and sync triggers
-- ---------------------------------------------------------------------------

create or replace function public.ensure_default_pool_for_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pools (
    phase_id,
    slug,
    name,
    display_order,
    is_default
  )
  values (
    new.id,
    'default',
    'Default Pool',
    1,
    true
  )
  on conflict (phase_id, slug) do update
  set is_default = true;

  return new;
end;
$$;

drop trigger if exists phases_ensure_default_pool on public.phases;
create trigger phases_ensure_default_pool
  after insert on public.phases
  for each row
  execute function public.ensure_default_pool_for_phase();

create or replace function public.assign_team_to_default_pools()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pool_teams (pool_id, team_id, display_order)
  select p.id, new.id, 0
  from public.pools p
  join public.phases ph on ph.id = p.phase_id
  where ph.age_group_id = new.age_group_id
    and p.is_default = true
  on conflict (pool_id, team_id) do nothing;

  return new;
end;
$$;

drop trigger if exists teams_assign_default_pools on public.teams;
create trigger teams_assign_default_pools
  after insert or update of age_group_id on public.teams
  for each row
  execute function public.assign_team_to_default_pools();

create or replace function public.ensure_default_pool_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pool_id is null and new.phase_id is not null then
    select id into new.pool_id
    from public.pools
    where phase_id = new.phase_id
      and is_default = true
    order by display_order
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_ensure_default_pool on public.matches;
create trigger matches_ensure_default_pool
  before insert or update of phase_id, pool_id on public.matches
  for each row
  execute function public.ensure_default_pool_for_match();

-- ---------------------------------------------------------------------------
-- Backfill existing data
-- ---------------------------------------------------------------------------

insert into public.pools (
  phase_id,
  slug,
  name,
  display_order,
  is_default
)
select
  ph.id,
  'default',
  'Default Pool',
  1,
  true
from public.phases ph
on conflict (phase_id, slug) do update
set is_default = true;

insert into public.pool_teams (pool_id, team_id, display_order)
select
  p.id,
  t.id,
  0
from public.pools p
join public.phases ph on ph.id = p.phase_id
join public.teams t on t.age_group_id = ph.age_group_id
where p.is_default = true
on conflict (pool_id, team_id) do nothing;

update public.matches m
set pool_id = p.id
from public.pools p
where p.phase_id = m.phase_id
  and p.is_default = true
  and m.pool_id is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.pools enable row level security;
alter table public.pool_teams enable row level security;

drop policy if exists "pools_anon_select" on public.pools;
drop policy if exists "pools_auth_select" on public.pools;
drop policy if exists "pools_auth_insert" on public.pools;
drop policy if exists "pools_auth_update" on public.pools;
drop policy if exists "pools_auth_delete" on public.pools;

drop policy if exists "pool_teams_anon_select" on public.pool_teams;
drop policy if exists "pool_teams_auth_select" on public.pool_teams;
drop policy if exists "pool_teams_auth_insert" on public.pool_teams;
drop policy if exists "pool_teams_auth_update" on public.pool_teams;
drop policy if exists "pool_teams_auth_delete" on public.pool_teams;

create policy "pools_anon_select"
  on public.pools for select to anon using (true);

create policy "pool_teams_anon_select"
  on public.pool_teams for select to anon using (true);

create policy "pools_auth_select"
  on public.pools for select to authenticated
  using (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pools_auth_insert"
  on public.pools for insert to authenticated
  with check (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pools_auth_update"
  on public.pools for update to authenticated
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

create policy "pools_auth_delete"
  on public.pools for delete to authenticated
  using (phase_id in (
    select ph.id
    from public.phases ph
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pool_teams_auth_select"
  on public.pool_teams for select to authenticated
  using (pool_id in (
    select p.id
    from public.pools p
    join public.phases ph on ph.id = p.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pool_teams_auth_insert"
  on public.pool_teams for insert to authenticated
  with check (pool_id in (
    select p.id
    from public.pools p
    join public.phases ph on ph.id = p.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pool_teams_auth_update"
  on public.pool_teams for update to authenticated
  using (pool_id in (
    select p.id
    from public.pools p
    join public.phases ph on ph.id = p.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (pool_id in (
    select p.id
    from public.pools p
    join public.phases ph on ph.id = p.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "pool_teams_auth_delete"
  on public.pool_teams for delete to authenticated
  using (pool_id in (
    select p.id
    from public.pools p
    join public.phases ph on ph.id = p.phase_id
    join public.age_groups ag on ag.id = ph.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));
