-- Phase 2: Tournament Ownership & Scoped RLS
-- Run this in the Supabase SQL editor AFTER add_user_profiles.sql has been applied.
-- Safe to re-run (DROP IF EXISTS + CREATE OR REPLACE / IF NOT EXISTS throughout).
--
-- DEPLOY ORDER:
--   1. Run this SQL (backfill completes before any app code is deployed).
--   2. Deploy updated application code (TournamentEditForm, clone_tournament RPC).
--   3. Verify superadmin can still see all tournaments; new tournament_admin users
--      see only tournaments where created_by = their UID.

-- ---------------------------------------------------------------------------
-- Step 1: Add created_by to tournaments
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists created_by uuid references auth.users(id);

-- Step 2: Backfill all existing tournaments to the oldest superadmin.
-- Every existing user was promoted to superadmin in add_user_profiles.sql,
-- so this selects from that known set.
update public.tournaments
set created_by = (
  select id
  from public.user_profiles
  where role = 'superadmin'
  order by created_at asc
  limit 1
)
where created_by is null;

-- Step 3: Enforce NOT NULL now the backfill is complete.
-- This will error if any tournaments still have created_by = null, which
-- would mean the backfill above found zero superadmin profiles. Fix that first.
alter table public.tournaments
  alter column created_by set not null;

-- ---------------------------------------------------------------------------
-- Step 4: get_my_role() helper (idempotent — already created in Phase 1,
-- repeated here for completeness if running out of order).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Step 5: Rewrite RLS policies
-- Drop all existing authenticated-write policies and replace with
-- role-aware equivalents. anon SELECT policies are left untouched so the
-- public-facing pages continue to see all tournaments and results.
-- ---------------------------------------------------------------------------

-- ── tournaments ─────────────────────────────────────────────────────────────

drop policy if exists "tournaments_auth_select" on public.tournaments;
drop policy if exists "tournaments_auth_insert" on public.tournaments;
drop policy if exists "tournaments_auth_update" on public.tournaments;
drop policy if exists "tournaments_auth_delete" on public.tournaments;

-- Authenticated read: superadmin sees all; tournament_admin sees only theirs
create policy "tournaments_auth_select"
  on public.tournaments
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.get_my_role() = 'superadmin'
  );

-- Authenticated insert: created_by must equal the caller's uid
create policy "tournaments_auth_insert"
  on public.tournaments
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
  );

-- Authenticated update/delete: own tournament or superadmin
create policy "tournaments_auth_update"
  on public.tournaments
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.get_my_role() = 'superadmin'
  )
  with check (
    created_by = auth.uid()
    or public.get_my_role() = 'superadmin'
  );

create policy "tournaments_auth_delete"
  on public.tournaments
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.get_my_role() = 'superadmin'
  );

-- ── age_groups ───────────────────────────────────────────────────────────────

drop policy if exists "age_groups_auth_select" on public.age_groups;
drop policy if exists "age_groups_auth_insert" on public.age_groups;
drop policy if exists "age_groups_auth_update" on public.age_groups;
drop policy if exists "age_groups_auth_delete" on public.age_groups;

create policy "age_groups_auth_select"
  on public.age_groups
  for select
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "age_groups_auth_insert"
  on public.age_groups
  for insert
  to authenticated
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "age_groups_auth_update"
  on public.age_groups
  for update
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "age_groups_auth_delete"
  on public.age_groups
  for delete
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

-- ── courts ───────────────────────────────────────────────────────────────────

drop policy if exists "courts_auth_select" on public.courts;
drop policy if exists "courts_auth_insert" on public.courts;
drop policy if exists "courts_auth_update" on public.courts;
drop policy if exists "courts_auth_delete" on public.courts;

create policy "courts_auth_select"
  on public.courts
  for select
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "courts_auth_insert"
  on public.courts
  for insert
  to authenticated
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "courts_auth_update"
  on public.courts
  for update
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "courts_auth_delete"
  on public.courts
  for delete
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

-- ── teams ────────────────────────────────────────────────────────────────────

drop policy if exists "teams_auth_select" on public.teams;
drop policy if exists "teams_auth_insert" on public.teams;
drop policy if exists "teams_auth_update" on public.teams;
drop policy if exists "teams_auth_delete" on public.teams;

create policy "teams_auth_select"
  on public.teams
  for select
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "teams_auth_insert"
  on public.teams
  for insert
  to authenticated
  with check (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "teams_auth_update"
  on public.teams
  for update
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "teams_auth_delete"
  on public.teams
  for delete
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

-- ── matches ──────────────────────────────────────────────────────────────────

drop policy if exists "matches_auth_select" on public.matches;
drop policy if exists "matches_auth_insert" on public.matches;
drop policy if exists "matches_auth_update" on public.matches;
drop policy if exists "matches_auth_delete" on public.matches;

create policy "matches_auth_select"
  on public.matches
  for select
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "matches_auth_insert"
  on public.matches
  for insert
  to authenticated
  with check (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "matches_auth_update"
  on public.matches
  for update
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "matches_auth_delete"
  on public.matches
  for delete
  to authenticated
  using (
    age_group_id in (
      select ag.id from public.age_groups ag
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

-- ── players ──────────────────────────────────────────────────────────────────

drop policy if exists "players_auth_select" on public.players;
drop policy if exists "players_auth_insert" on public.players;
drop policy if exists "players_auth_update" on public.players;
drop policy if exists "players_auth_delete" on public.players;

create policy "players_auth_select"
  on public.players
  for select
  to authenticated
  using (
    team_id in (
      select te.id from public.teams te
      join public.age_groups ag on ag.id = te.age_group_id
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "players_auth_insert"
  on public.players
  for insert
  to authenticated
  with check (
    team_id in (
      select te.id from public.teams te
      join public.age_groups ag on ag.id = te.age_group_id
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "players_auth_update"
  on public.players
  for update
  to authenticated
  using (
    team_id in (
      select te.id from public.teams te
      join public.age_groups ag on ag.id = te.age_group_id
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    team_id in (
      select te.id from public.teams te
      join public.age_groups ag on ag.id = te.age_group_id
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "players_auth_delete"
  on public.players
  for delete
  to authenticated
  using (
    team_id in (
      select te.id from public.teams te
      join public.age_groups ag on ag.id = te.age_group_id
      join public.tournaments t on t.id = ag.tournament_id
      where t.created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

-- ── schedule_events ───────────────────────────────────────────────────────────

drop policy if exists "schedule_events_auth_select" on public.schedule_events;
drop policy if exists "schedule_events_auth_insert" on public.schedule_events;
drop policy if exists "schedule_events_auth_update" on public.schedule_events;
drop policy if exists "schedule_events_auth_delete" on public.schedule_events;

create policy "schedule_events_auth_select"
  on public.schedule_events
  for select
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "schedule_events_auth_insert"
  on public.schedule_events
  for insert
  to authenticated
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "schedule_events_auth_update"
  on public.schedule_events
  for update
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  )
  with check (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );

create policy "schedule_events_auth_delete"
  on public.schedule_events
  for delete
  to authenticated
  using (
    tournament_id in (
      select id from public.tournaments
      where created_by = auth.uid()
        or public.get_my_role() = 'superadmin'
    )
  );
