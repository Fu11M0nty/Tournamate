-- Organiser onboarding: approval RPC + richer user listing
-- Run this in the Supabase SQL editor AFTER add_user_management_rpcs.sql and
-- add_tournamate_fields.sql (which adds user_profiles.is_approved) are applied.
-- Safe to re-run.
--
-- These functions use SECURITY DEFINER so they can read auth.users, which is not
-- directly accessible to the anon/authenticated roles. All access-control checks
-- are performed inside the functions themselves (superadmin-gated).

-- ---------------------------------------------------------------------------
-- list_users_with_roles()
-- Now also returns is_approved + invite/sign-in status so the admin Users panel
-- can show onboarding state and offer an Approve/Revoke action.
-- Return type changed, so we DROP before recreating.
-- ---------------------------------------------------------------------------
drop function if exists public.list_users_with_roles();
create or replace function public.list_users_with_roles()
returns table (
  id                 uuid,
  email              text,
  role               text,
  is_approved        boolean,
  created_at         timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz
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
      up.is_approved,
      up.created_at,
      au.email_confirmed_at,
      au.last_sign_in_at
    from auth.users au
    join public.user_profiles up on up.id = au.id
    order by up.created_at asc;
end;
$$;

revoke all on function public.list_users_with_roles() from public;
grant execute on function public.list_users_with_roles() to authenticated;

-- ---------------------------------------------------------------------------
-- set_user_approval(target_user_id, approved)
-- Approve or revoke an organiser. Guards:
--   • caller must be superadmin
--   • caller cannot revoke their own approval (lockout guard)
-- ---------------------------------------------------------------------------
create or replace function public.set_user_approval(target_user_id uuid, approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'superadmin' then
    raise exception 'Access denied: superadmin role required';
  end if;

  if target_user_id = auth.uid() and approved = false then
    raise exception 'You cannot revoke your own approval';
  end if;

  update public.user_profiles
  set is_approved = approved
  where id = target_user_id;

  if not found then
    raise exception 'No user profile found for id %', target_user_id;
  end if;
end;
$$;

revoke all on function public.set_user_approval(uuid, boolean) from public;
grant execute on function public.set_user_approval(uuid, boolean) to authenticated;
