-- =============================================================================
-- TournaMate platform fields — tournaments & user_profiles
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / ON CONFLICT / DO NOTHING throughout.
--
-- Run this in the Supabase SQL Editor after deploying the new public homepage.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — new columns on tournaments
-- =============================================================================

alter table public.tournaments
  add column if not exists sport         text,
  add column if not exists venue_name    text,
  add column if not exists venue_city    text,
  add column if not exists venue_county  text,
  add column if not exists venue_postcode text,
  add column if not exists description  text,
  add column if not exists is_public    boolean not null default true;

-- Backfill: all existing tournaments are netball and publicly visible
update public.tournaments
  set sport = 'Netball'
  where sport is null;

-- Optional: add a check constraint so sport values stay consistent
-- (only add if no rows already violate it)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_sport_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_sport_check
      check (sport in (
        'Netball','Football','Basketball','Hockey (Field)',
        'Rugby Union','Rugby League','Cricket','Volleyball',
        'Tennis','Badminton','Swimming','Athletics',
        'Tag Rugby','Futsal','Other'
      ));
  end if;
end
$$;


-- =============================================================================
-- SECTION 2 — new columns on user_profiles
-- =============================================================================

alter table public.user_profiles
  add column if not exists is_approved       boolean not null default false,
  add column if not exists organisation_name text;

-- Backfill: all existing users are already approved (they were set up manually)
update public.user_profiles
  set is_approved = true
  where is_approved = false;


-- =============================================================================
-- SECTION 3 — RLS: require is_approved for tournament write operations
-- Authenticated users who are not yet approved can log in and see the
-- pending-approval screen but cannot create or modify tournaments.
-- =============================================================================

-- tournaments INSERT — must be approved
drop policy if exists "tournaments_auth_insert" on public.tournaments;
create policy "tournaments_auth_insert"
  on public.tournaments for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- tournaments UPDATE — must be approved and own the row (or superadmin)
drop policy if exists "tournaments_auth_update" on public.tournaments;
create policy "tournaments_auth_update"
  on public.tournaments for update to authenticated
  using  (created_by = auth.uid() or public.get_my_role() = 'superadmin')
  with check (
    (created_by = auth.uid() or public.get_my_role() = 'superadmin')
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- tournaments DELETE — must be approved and own the row (or superadmin)
drop policy if exists "tournaments_auth_delete" on public.tournaments;
create policy "tournaments_auth_delete"
  on public.tournaments for delete to authenticated
  using (
    (created_by = auth.uid() or public.get_my_role() = 'superadmin')
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_approved = true
    )
  );


-- =============================================================================
-- SECTION 4 — handle_new_user trigger: default is_approved = false
-- New signups via the public /signup page start unapproved.
-- Existing trigger already inserts with the column default, but update it
-- explicitly for clarity.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role, is_approved)
  values (new.id, 'tournament_admin', false)
  on conflict (id) do nothing;
  return new;
end;
$$;


-- =============================================================================
-- VERIFICATION
-- Run these after the script to confirm success:
--
--   select column_name from information_schema.columns
--   where table_name = 'tournaments'
--   and column_name in ('sport','venue_city','venue_name','is_public');
--   → must return 4 rows
--
--   select column_name from information_schema.columns
--   where table_name = 'user_profiles'
--   and column_name in ('is_approved','organisation_name');
--   → must return 2 rows
--
--   select count(*) from public.tournaments where sport is null;
--   → must return 0
--
--   select count(*) from public.user_profiles where is_approved = false;
--   → must return 0 (all existing users were backfilled as approved)
-- =============================================================================
