-- Phase 5: User Management RPCs
-- Run this in the Supabase SQL editor after add_user_profiles.sql and
-- add_tournament_ownership.sql have been applied.
-- Safe to re-run (CREATE OR REPLACE throughout).
--
-- NOTE: These functions use SECURITY DEFINER so they can read auth.users,
-- which is not directly accessible to the anon or authenticated roles.
-- All access-control checks are performed inside the functions themselves.

-- ---------------------------------------------------------------------------
-- list_users_with_roles()
-- Returns all registered users with their role.
-- Raises an error if the caller is not a superadmin.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- set_user_role(target_user_id, new_role)
-- Promotes or demotes a user. Guards:
--   • caller must be superadmin
--   • caller cannot change their own role
--   • cannot demote the last remaining superadmin
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  superadmin_count int;
begin
  -- Only superadmins may change roles
  if public.get_my_role() <> 'superadmin' then
    raise exception 'Access denied: superadmin role required';
  end if;

  -- Validate the new role value
  if new_role not in ('superadmin', 'tournament_admin') then
    raise exception 'Invalid role "%". Must be "superadmin" or "tournament_admin"', new_role;
  end if;

  -- Prevent callers from changing their own role (accidental lockout guard)
  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  -- Prevent demoting the last superadmin
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
