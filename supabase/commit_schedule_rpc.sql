-- =============================================================================
-- commit_schedule() RPC
--
-- Atomically applies a list of (match_id, court, kickoff_time) placements
-- produced by the auto-plan algorithm. Each row sets the match's court and
-- kickoff_time and marks it as planned. The whole batch runs inside a single
-- function invocation, so any error rolls back every update.
--
-- Argument shape:
--   plan = [
--     { "id": "uuid", "court": "Court 1", "kickoff_time": "2026-04-25T09:00:00.000Z" },
--     ...
--   ]
--
-- Returns the number of rows updated. Re-runnable (CREATE OR REPLACE).
--
-- Access control:
--   • Superadmins may commit schedules for any tournament.
--   • Tournament admins may only commit schedules for tournaments they own.
--     If any match in the plan belongs to another organiser's tournament the
--     entire batch is rejected (all-or-nothing).
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
      join matches m    on m.id  = (item->>'id')::uuid
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
