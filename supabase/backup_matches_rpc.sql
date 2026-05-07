-- =============================================================================
-- backup_matches() RPC
--
-- Server-side function the admin console calls (via supabase.rpc) to take a
-- one-click snapshot of the matches table. Inserts every current row into
-- matches_backup stamped with the function start time, and returns the count
-- of rows captured + the timestamp.
--
-- Run backup_matches.sql FIRST so the matches_backup table exists. Then run
-- this file to (re)create the function and grant authenticated access.
-- =============================================================================

-- INTENTIONAL RLS BYPASS: this function is security definer so it can read
-- all matches regardless of the caller's tournament ownership. A backup must
-- capture the full dataset. Access is still gated to authenticated users only
-- via the GRANT below — anonymous callers cannot invoke it.
create or replace function backup_matches()
returns table (rows_backed_up bigint, backed_up_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
  inserted bigint;
begin
  insert into matches_backup (
    id, age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show,
    scoresheet_url, round_number, created_at, backed_up_at
  )
  select
    id, age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show,
    scoresheet_url, round_number, created_at,
    ts
  from matches;

  get diagnostics inserted = row_count;
  return query select inserted, ts;
end;
$$;

revoke all on function backup_matches() from public;
grant execute on function backup_matches() to authenticated;
