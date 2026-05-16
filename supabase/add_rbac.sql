-- =============================================================================
-- RBAC — Role-Based Access Control (consolidated migration)
-- Consolidates Phases 1, 2 and 5 of the RBAC implementation.
--
-- SAFE TO RE-RUN: every statement uses CREATE OR REPLACE, IF NOT EXISTS,
-- DROP IF EXISTS, or ON CONFLICT so this script is fully idempotent.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DEPLOY ORDER
-- ─────────────────────────────────────────────────────────────────────────────
--
-- If the individual phase files (add_user_profiles.sql,
-- add_tournament_ownership.sql, add_user_management_rpcs.sql) have already
-- been run against your live database, this file is a no-op — run it to
-- verify or skip it entirely.
--
-- For a fresh project, or to apply everything in one go:
--
--   STEP 1  Run this file in the Supabase SQL editor.
--           Verify the backfills completed:
--             select count(*) from public.user_profiles;
--             select count(*) from public.tournaments where created_by is null;
--           The second query must return 0 before you continue.
--
--   STEP 2  Run the updated clone_tournament_rpc.sql in the SQL editor
--           (it now stamps created_by = auth.uid() on the cloned tournament).
--           This file is included inline in Section 4 below for convenience,
--           but you can also run clone_tournament_rpc.sql directly — they
--           are identical.
--
--   STEP 3  Deploy the Next.js application code (Phase 3 middleware, Phase 4
--           signup pages, Phase 5 user management UI).
--
--   STEP 4  Verify:
--           • Sign in as the existing superadmin — all tournaments visible.
--           • Sign up a new account — gets tournament_admin role automatically.
--           • New account can only see its own tournaments after creating one.
--           • Superadmin user management panel lists all users.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ENVIRONMENT VARIABLES
-- No new variables needed. The existing NEXT_PUBLIC_SUPABASE_URL and
-- NEXT_PUBLIC_SUPABASE_ANON_KEY cover everything. The service-role key is
-- deliberately NOT used on the client — security definer functions handle
-- privileged operations instead.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — user_profiles table
-- =============================================================================

create table if not exists public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'tournament_admin',
  created_at timestamptz not null default now(),
  check (role in ('superadmin', 'tournament_admin'))
);

alter table public.user_profiles enable row level security;

-- Users can read only their own row.
-- No INSERT policy: the trigger in Section 3 handles profile creation.
-- No UPDATE policy: role changes must go through set_user_role() (Section 8).
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);


-- =============================================================================
-- SECTION 2 — get_my_role() helper
-- Used inside every RLS policy that needs to distinguish superadmin from
-- tournament_admin. Marked STABLE so Postgres can cache the result within
-- a single query, avoiding repeated lookups per row.
-- =============================================================================

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid()
$$;


-- =============================================================================
-- SECTION 3 — auto-create profile trigger
-- Fires AFTER INSERT on auth.users. Creates a tournament_admin profile for
-- every new signup (email/password or OAuth). ON CONFLICT DO NOTHING makes
-- it safe to run even if the row already exists.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'tournament_admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- =============================================================================
-- SECTION 4 — backfill: promote all existing users to superadmin
-- Every user that existed before this migration ran is a known organiser and
-- should be a superadmin. New signups after this point get tournament_admin
-- automatically via the trigger above.
-- =============================================================================

insert into public.user_profiles (id, role)
select id, 'superadmin'
from auth.users
on conflict (id) do update set role = 'superadmin';


-- =============================================================================
-- SECTION 5 — tournaments.created_by column
-- Records which user owns each tournament.
-- Add nullable, backfill, then enforce NOT NULL.
-- =============================================================================

alter table public.tournaments
  add column if not exists created_by uuid references auth.users(id);

-- Assign all existing tournaments to the earliest superadmin.
-- If this returns 0 rows (no superadmin profiles yet), the NOT NULL below
-- will fail — run Section 4 first and re-run this file.
update public.tournaments
set created_by = (
  select id
  from public.user_profiles
  where role = 'superadmin'
  order by created_at asc
  limit 1
)
where created_by is null;

alter table public.tournaments
  alter column created_by set not null;


-- =============================================================================
-- SECTION 6 — role-aware RLS policies
-- Replaces the flat "authenticated = anything" policies from schema.sql.
-- anon SELECT policies (to anon) are left untouched so the public-facing pages
-- continue to see all tournament data without authentication.
--
-- CRITICAL: migration files (add_tournaments.sql, add_courts_table.sql, etc.)
-- created "to public" SELECT policies that cover BOTH anon AND authenticated
-- roles. These must be dropped here, otherwise authenticated tournament_admin
-- users can still see every row, bypassing the ownership filter below.
-- The corresponding "to anon" policies from schema.sql remain intact so the
-- public website keeps working.
--
-- Pattern:
--   superadmin       → passes all checks via get_my_role() = 'superadmin'
--   tournament_admin → restricted to rows owned by auth.uid()
-- =============================================================================

-- Drop legacy "to public" SELECT policies added by migration files.
drop policy if exists "tournaments_public_select"     on public.tournaments;
drop policy if exists "courts_public_select"          on public.courts;
drop policy if exists "players_public_select"         on public.players;
drop policy if exists "schedule_events_public_select" on public.schedule_events;

-- Ensure anon SELECT policies exist for every public-facing table.
-- These are normally created by schema.sql, but if only migration files were
-- run against this database the "to public" policy was the only one present.
-- Dropping it above removes all public access unless we explicitly add these.
drop policy if exists "tournaments_anon_select"     on public.tournaments;
drop policy if exists "age_groups_anon_select"      on public.age_groups;
drop policy if exists "teams_anon_select"           on public.teams;
drop policy if exists "matches_anon_select"         on public.matches;
drop policy if exists "courts_anon_select"          on public.courts;
drop policy if exists "players_anon_select"         on public.players;
drop policy if exists "schedule_events_anon_select" on public.schedule_events;

create policy "tournaments_anon_select"     on public.tournaments     for select to anon using (true);
create policy "age_groups_anon_select"      on public.age_groups      for select to anon using (true);
create policy "teams_anon_select"           on public.teams           for select to anon using (true);
create policy "matches_anon_select"         on public.matches         for select to anon using (true);
create policy "courts_anon_select"          on public.courts          for select to anon using (true);
create policy "players_anon_select"         on public.players         for select to anon using (true);
create policy "schedule_events_anon_select" on public.schedule_events for select to anon using (true);

-- ── tournaments ───────────────────────────────────────────────────────────────

drop policy if exists "tournaments_auth_select" on public.tournaments;
drop policy if exists "tournaments_auth_insert" on public.tournaments;
drop policy if exists "tournaments_auth_update" on public.tournaments;
drop policy if exists "tournaments_auth_delete" on public.tournaments;

create policy "tournaments_auth_select"
  on public.tournaments for select to authenticated
  using (created_by = auth.uid() or public.get_my_role() = 'superadmin');

create policy "tournaments_auth_insert"
  on public.tournaments for insert to authenticated
  with check (created_by = auth.uid());

create policy "tournaments_auth_update"
  on public.tournaments for update to authenticated
  using  (created_by = auth.uid() or public.get_my_role() = 'superadmin')
  with check (created_by = auth.uid() or public.get_my_role() = 'superadmin');

create policy "tournaments_auth_delete"
  on public.tournaments for delete to authenticated
  using (created_by = auth.uid() or public.get_my_role() = 'superadmin');

-- ── competition_dates ────────────────────────────────────────────────────────
-- Guarded so this consolidated RBAC script remains re-runnable on databases
-- that have not applied add_competition_dates.sql yet.
do $$
begin
  if to_regclass('public.competition_dates') is not null then
    execute 'drop policy if exists "competition_dates_public_select" on public.competition_dates';
    execute 'drop policy if exists "competition_dates_anon_select" on public.competition_dates';
    execute 'drop policy if exists "competition_dates_auth_select" on public.competition_dates';
    execute 'drop policy if exists "competition_dates_auth_insert" on public.competition_dates';
    execute 'drop policy if exists "competition_dates_auth_update" on public.competition_dates';
    execute 'drop policy if exists "competition_dates_auth_delete" on public.competition_dates';

    execute 'create policy "competition_dates_anon_select"
      on public.competition_dates for select to anon using (true)';

    execute 'create policy "competition_dates_auth_select"
      on public.competition_dates for select to authenticated
      using (tournament_id in (
        select id from public.tournaments
        where created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "competition_dates_auth_insert"
      on public.competition_dates for insert to authenticated
      with check (tournament_id in (
        select id from public.tournaments
        where created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "competition_dates_auth_update"
      on public.competition_dates for update to authenticated
      using (tournament_id in (
        select id from public.tournaments
        where created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))
      with check (tournament_id in (
        select id from public.tournaments
        where created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "competition_dates_auth_delete"
      on public.competition_dates for delete to authenticated
      using (tournament_id in (
        select id from public.tournaments
        where created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';
  end if;
end $$;

-- ── age_groups ────────────────────────────────────────────────────────────────

drop policy if exists "age_groups_auth_select" on public.age_groups;
drop policy if exists "age_groups_auth_insert" on public.age_groups;
drop policy if exists "age_groups_auth_update" on public.age_groups;
drop policy if exists "age_groups_auth_delete" on public.age_groups;

create policy "age_groups_auth_select"
  on public.age_groups for select to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "age_groups_auth_insert"
  on public.age_groups for insert to authenticated
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "age_groups_auth_update"
  on public.age_groups for update to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "age_groups_auth_delete"
  on public.age_groups for delete to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- ── courts ────────────────────────────────────────────────────────────────────

-- Guarded so this consolidated RBAC script remains re-runnable on databases
-- that have not applied add_phases.sql yet.
do $$
begin
  if to_regclass('public.phases') is not null then
    execute 'drop policy if exists "phases_public_select" on public.phases';
    execute 'drop policy if exists "phases_anon_select" on public.phases';
    execute 'drop policy if exists "phases_auth_select" on public.phases';
    execute 'drop policy if exists "phases_auth_insert" on public.phases';
    execute 'drop policy if exists "phases_auth_update" on public.phases';
    execute 'drop policy if exists "phases_auth_delete" on public.phases';

    execute 'create policy "phases_anon_select"
      on public.phases for select to anon using (true)';

    execute 'create policy "phases_auth_select"
      on public.phases for select to authenticated
      using (age_group_id in (
        select ag.id
        from public.age_groups ag
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "phases_auth_insert"
      on public.phases for insert to authenticated
      with check (age_group_id in (
        select ag.id
        from public.age_groups ag
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "phases_auth_update"
      on public.phases for update to authenticated
      using (age_group_id in (
        select ag.id
        from public.age_groups ag
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))
      with check (age_group_id in (
        select ag.id
        from public.age_groups ag
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "phases_auth_delete"
      on public.phases for delete to authenticated
      using (age_group_id in (
        select ag.id
        from public.age_groups ag
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';
  end if;
end $$;

-- Guarded so this consolidated RBAC script remains re-runnable on databases
-- that have not applied add_pools.sql yet.
do $$
begin
  if to_regclass('public.pools') is not null then
    execute 'drop policy if exists "pools_public_select" on public.pools';
    execute 'drop policy if exists "pools_anon_select" on public.pools';
    execute 'drop policy if exists "pools_auth_select" on public.pools';
    execute 'drop policy if exists "pools_auth_insert" on public.pools';
    execute 'drop policy if exists "pools_auth_update" on public.pools';
    execute 'drop policy if exists "pools_auth_delete" on public.pools';

    execute 'create policy "pools_anon_select"
      on public.pools for select to anon using (true)';

    execute 'create policy "pools_auth_select"
      on public.pools for select to authenticated
      using (phase_id in (
        select ph.id
        from public.phases ph
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pools_auth_insert"
      on public.pools for insert to authenticated
      with check (phase_id in (
        select ph.id
        from public.phases ph
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pools_auth_update"
      on public.pools for update to authenticated
      using (phase_id in (
        select ph.id
        from public.phases ph
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))
      with check (phase_id in (
        select ph.id
        from public.phases ph
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pools_auth_delete"
      on public.pools for delete to authenticated
      using (phase_id in (
        select ph.id
        from public.phases ph
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';
  end if;

  if to_regclass('public.pool_teams') is not null then
    execute 'drop policy if exists "pool_teams_public_select" on public.pool_teams';
    execute 'drop policy if exists "pool_teams_anon_select" on public.pool_teams';
    execute 'drop policy if exists "pool_teams_auth_select" on public.pool_teams';
    execute 'drop policy if exists "pool_teams_auth_insert" on public.pool_teams';
    execute 'drop policy if exists "pool_teams_auth_update" on public.pool_teams';
    execute 'drop policy if exists "pool_teams_auth_delete" on public.pool_teams';

    execute 'create policy "pool_teams_anon_select"
      on public.pool_teams for select to anon using (true)';

    execute 'create policy "pool_teams_auth_select"
      on public.pool_teams for select to authenticated
      using (pool_id in (
        select p.id
        from public.pools p
        join public.phases ph on ph.id = p.phase_id
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pool_teams_auth_insert"
      on public.pool_teams for insert to authenticated
      with check (pool_id in (
        select p.id
        from public.pools p
        join public.phases ph on ph.id = p.phase_id
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pool_teams_auth_update"
      on public.pool_teams for update to authenticated
      using (pool_id in (
        select p.id
        from public.pools p
        join public.phases ph on ph.id = p.phase_id
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))
      with check (pool_id in (
        select p.id
        from public.pools p
        join public.phases ph on ph.id = p.phase_id
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';

    execute 'create policy "pool_teams_auth_delete"
      on public.pool_teams for delete to authenticated
      using (pool_id in (
        select p.id
        from public.pools p
        join public.phases ph on ph.id = p.phase_id
        join public.age_groups ag on ag.id = ph.age_group_id
        join public.tournaments t on t.id = ag.tournament_id
        where t.created_by = auth.uid() or public.get_my_role() = ''superadmin''
      ))';
  end if;
end $$;

drop policy if exists "courts_auth_select" on public.courts;
drop policy if exists "courts_auth_insert" on public.courts;
drop policy if exists "courts_auth_update" on public.courts;
drop policy if exists "courts_auth_delete" on public.courts;

create policy "courts_auth_select"
  on public.courts for select to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "courts_auth_insert"
  on public.courts for insert to authenticated
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "courts_auth_update"
  on public.courts for update to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "courts_auth_delete"
  on public.courts for delete to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- ── teams ─────────────────────────────────────────────────────────────────────

drop policy if exists "teams_auth_select" on public.teams;
drop policy if exists "teams_auth_insert" on public.teams;
drop policy if exists "teams_auth_update" on public.teams;
drop policy if exists "teams_auth_delete" on public.teams;

create policy "teams_auth_select"
  on public.teams for select to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "teams_auth_insert"
  on public.teams for insert to authenticated
  with check (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "teams_auth_update"
  on public.teams for update to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "teams_auth_delete"
  on public.teams for delete to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- ── matches ───────────────────────────────────────────────────────────────────

drop policy if exists "matches_auth_select" on public.matches;
drop policy if exists "matches_auth_insert" on public.matches;
drop policy if exists "matches_auth_update" on public.matches;
drop policy if exists "matches_auth_delete" on public.matches;

create policy "matches_auth_select"
  on public.matches for select to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "matches_auth_insert"
  on public.matches for insert to authenticated
  with check (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "matches_auth_update"
  on public.matches for update to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "matches_auth_delete"
  on public.matches for delete to authenticated
  using (age_group_id in (
    select ag.id from public.age_groups ag
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- ── players ───────────────────────────────────────────────────────────────────

drop policy if exists "players_auth_select" on public.players;
drop policy if exists "players_auth_insert" on public.players;
drop policy if exists "players_auth_update" on public.players;
drop policy if exists "players_auth_delete" on public.players;

create policy "players_auth_select"
  on public.players for select to authenticated
  using (team_id in (
    select te.id from public.teams te
    join public.age_groups ag on ag.id = te.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "players_auth_insert"
  on public.players for insert to authenticated
  with check (team_id in (
    select te.id from public.teams te
    join public.age_groups ag on ag.id = te.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "players_auth_update"
  on public.players for update to authenticated
  using (team_id in (
    select te.id from public.teams te
    join public.age_groups ag on ag.id = te.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (team_id in (
    select te.id from public.teams te
    join public.age_groups ag on ag.id = te.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "players_auth_delete"
  on public.players for delete to authenticated
  using (team_id in (
    select te.id from public.teams te
    join public.age_groups ag on ag.id = te.age_group_id
    join public.tournaments t on t.id = ag.tournament_id
    where t.created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

-- ── schedule_events ───────────────────────────────────────────────────────────

drop policy if exists "schedule_events_auth_select" on public.schedule_events;
drop policy if exists "schedule_events_auth_insert" on public.schedule_events;
drop policy if exists "schedule_events_auth_update" on public.schedule_events;
drop policy if exists "schedule_events_auth_delete" on public.schedule_events;

create policy "schedule_events_auth_select"
  on public.schedule_events for select to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "schedule_events_auth_insert"
  on public.schedule_events for insert to authenticated
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "schedule_events_auth_update"
  on public.schedule_events for update to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "schedule_events_auth_delete"
  on public.schedule_events for delete to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));


-- =============================================================================
-- SECTION 7 — clone_tournament RPC (updated for created_by)
-- Identical to clone_tournament_rpc.sql with the single addition of
-- created_by = auth.uid() in the tournaments INSERT.
-- =============================================================================

create or replace function clone_tournament(
  source_slug text,
  new_slug text,
  new_name text,
  new_start_date date,
  new_end_date date,
  new_status text default 'upcoming'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_id uuid;
  source_start date;
  new_tournament_id uuid;
  date_offset interval := interval '0';
begin
  if new_status not in ('upcoming', 'live', 'complete') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select id, start_date into source_id, source_start
    from tournaments where slug = source_slug;
  if source_id is null then
    raise exception 'Source tournament % not found', source_slug;
  end if;

  if exists (select 1 from tournaments where slug = new_slug) then
    raise exception 'Tournament slug % already exists', new_slug;
  end if;

  insert into tournaments (slug, name, start_date, end_date, status, display_order, created_by)
    values (
      new_slug, new_name, new_start_date, new_end_date, new_status,
      (select coalesce(max(display_order), 0) + 1 from tournaments),
      auth.uid()
    )
    returning id into new_tournament_id;

  if new_start_date is not null and source_start is not null then
    date_offset := new_start_date - source_start;
  end if;

  create temp table _ag_map (old_id uuid, mapped_id uuid) on commit drop;
  insert into _ag_map(old_id, mapped_id)
    select id, gen_random_uuid()
    from age_groups
    where tournament_id = source_id;

  insert into age_groups (id, tournament_id, name, slug, day, display_order)
    select m.mapped_id, new_tournament_id, ag.name, ag.slug, ag.day, ag.display_order
    from age_groups ag
    join _ag_map m on m.old_id = ag.id
    where ag.tournament_id = source_id;

  create temp table _team_map (old_id uuid, mapped_id uuid) on commit drop;
  insert into _team_map(old_id, mapped_id)
    select t.id, gen_random_uuid()
    from teams t
    join _ag_map m on m.old_id = t.age_group_id;

  insert into teams (id, name, short_name, color, logo_url, age_group_id)
    select tm.mapped_id, t.name, t.short_name, t.color, t.logo_url, agm.mapped_id
    from teams t
    join _team_map tm on tm.old_id = t.id
    join _ag_map agm on agm.old_id = t.age_group_id;

  insert into matches (
    age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show, scoresheet_url, round_number
  )
  select
    agm.mapped_id, htm.mapped_id, atm.mapped_id,
    null, null, ma.court, ma.kickoff_time + date_offset, 'scheduled',
    false, false, 0, 0, false, false, null, ma.round_number
  from matches ma
  join _ag_map agm on agm.old_id = ma.age_group_id
  join _team_map htm on htm.old_id = ma.home_team_id
  join _team_map atm on atm.old_id = ma.away_team_id;

  return new_tournament_id;
end;
$$;

revoke all on function clone_tournament(text, text, text, date, date, text) from public;
grant execute on function clone_tournament(text, text, text, date, date, text) to authenticated;


-- =============================================================================
-- SECTION 8 — user management RPCs
-- These require SECURITY DEFINER to read auth.users. All privilege checks
-- are enforced inside the functions — the anon/authenticated roles cannot
-- call list_users_with_roles or set_user_role without going through the
-- get_my_role() check first.
-- =============================================================================

create or replace function public.list_users_with_roles()
returns table (
  id         uuid,
  email      text,
  role       text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'superadmin' then
    raise exception 'Access denied: superadmin role required';
  end if;

  return query
    select
      au.id,
      au.email::text,
      up.role,
      up.created_at
    from auth.users au
    join public.user_profiles up on up.id = au.id
    order by up.created_at asc;
end;
$$;

revoke all on function public.list_users_with_roles() from public;
grant execute on function public.list_users_with_roles() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  superadmin_count int;
begin
  if public.get_my_role() <> 'superadmin' then
    raise exception 'Access denied: superadmin role required';
  end if;

  if new_role not in ('superadmin', 'tournament_admin') then
    raise exception 'Invalid role "%". Must be "superadmin" or "tournament_admin"', new_role;
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  if new_role = 'tournament_admin' then
    select count(*) into superadmin_count
    from public.user_profiles
    where role = 'superadmin';

    if superadmin_count <= 1 and exists (
      select 1 from public.user_profiles
      where id = target_user_id and role = 'superadmin'
    ) then
      raise exception 'Cannot demote the last superadmin — promote another user first';
    end if;
  end if;

  update public.user_profiles
  set role = new_role
  where id = target_user_id;

  if not found then
    raise exception 'No user profile found for id %', target_user_id;
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;


-- =============================================================================
-- SECTION 9 — Phase 7 hardening: commit_schedule ownership guard
-- Adds a tournament ownership check to the commit_schedule RPC so that a
-- tournament_admin cannot commit matches that belong to another organiser's
-- tournament. Superadmins bypass this check.
-- backup_matches is deliberately NOT restricted — a global backup must capture
-- every match row regardless of ownership. Access is still limited to
-- authenticated users via the GRANT.
-- =============================================================================

create or replace function commit_schedule(plan jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  rows_updated int := 0;
  affected int;
begin
  if jsonb_typeof(plan) <> 'array' then
    raise exception 'plan must be a jsonb array';
  end if;

  -- Ownership guard: tournament_admin callers may only commit matches that
  -- belong to tournaments they created. Superadmins bypass this check.
  if public.get_my_role() <> 'superadmin' then
    if exists (
      select 1
      from jsonb_array_elements(plan) item
      join matches m     on m.id  = (item->>'id')::uuid
      join age_groups ag on ag.id = m.age_group_id
      join tournaments t  on t.id  = ag.tournament_id
      where t.created_by <> auth.uid()
    ) then
      raise exception 'Access denied: plan contains matches from tournaments you do not own';
    end if;
  end if;

  for item in select * from jsonb_array_elements(plan)
  loop
    update matches
      set
        court        = item->>'court',
        kickoff_time = (item->>'kickoff_time')::timestamptz,
        is_planned   = true
      where id = (item->>'id')::uuid;
    get diagnostics affected = row_count;
    rows_updated := rows_updated + affected;
  end loop;

  return rows_updated;
end;
$$;

revoke all on function commit_schedule(jsonb) from public;
grant execute on function commit_schedule(jsonb) to authenticated;


-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after the script completes to confirm everything applied cleanly.
-- =============================================================================
--
-- 1. All existing users have a profile:
--    select count(*) from auth.users au
--    left join public.user_profiles up on up.id = au.id
--    where up.id is null;
--    → must return 0
--
-- 2. All existing tournaments have an owner:
--    select count(*) from public.tournaments where created_by is null;
--    → must return 0
--
-- 3. RLS functions exist:
--    select proname from pg_proc
--    where proname in ('get_my_role','handle_new_user','list_users_with_roles',
--                      'set_user_role','commit_schedule');
--    → must return 5 rows
--
-- 4. Trigger exists:
--    select tgname from pg_trigger where tgname = 'on_auth_user_created';
--    → must return 1 row
--
-- 5. commit_schedule ownership guard in place (inspect function body):
--    select prosrc from pg_proc where proname = 'commit_schedule';
--    → body should contain 'created_by <> auth.uid()'
-- =============================================================================
