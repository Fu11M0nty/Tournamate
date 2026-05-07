-- Phase 1: User Profiles & Role Foundation
-- Run this in the Supabase SQL editor BEFORE deploying any application code changes.
-- Safe to re-run — all statements use CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT.

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'tournament_admin',
  created_at timestamptz not null default now(),
  check (role in ('superadmin', 'tournament_admin'))
);

alter table public.user_profiles enable row level security;

-- Users can only read their own profile row (role changes go through the RPC in Phase 5)
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- No INSERT policy — the trigger below handles profile creation on signup
-- No UPDATE policy — direct role edits are blocked; use set_user_role() RPC (Phase 5)

-- ---------------------------------------------------------------------------
-- get_my_role() — used inside RLS policies on other tables (Phases 2+)
-- Returns the role of the currently authenticated user, or NULL if no profile row.
-- security definer so it can read user_profiles even when called from within an RLS policy.
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
-- Auto-create profile trigger
-- Inserts a tournament_admin profile row for every new auth.users entry.
-- Runs as SECURITY DEFINER so it can insert into public.user_profiles
-- regardless of the RLS policies on that table.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Backfill: promote all existing auth.users to superadmin
-- Any new signup after this migration runs will get tournament_admin via the trigger.
-- ---------------------------------------------------------------------------
insert into public.user_profiles (id, role)
select id, 'superadmin'
from auth.users
on conflict (id) do update set role = 'superadmin';
