-- =============================================================================
-- backup_age_group_matches(p_age_group_id, p_reason) RPC
--
-- Takes a snapshot of matches for a single age group only, with a mandatory
-- reason string stored alongside the snapshot for audit purposes.
--
-- STEP 1: Run this ALTER first to add the reason column (safe if already done):
--   alter table matches_backup add column if not exists reason text;
--
-- STEP 2: Then create/replace the function below.
-- =============================================================================

-- Add reason column to matches_backup (no-op if already present)
alter table matches_backup add column if not exists reason text;

-- Create age-group-scoped snapshot function
create or replace function backup_age_group_matches(
  p_age_group_id uuid,
  p_reason       text
)
returns table (rows_backed_up bigint, backed_up_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  ts       timestamptz := now();
  inserted bigint;
begin
  insert into matches_backup (
    id, age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show,
    scoresheet_url, round_number, created_at,
    backed_up_at, reason
  )
  select
    id, age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show,
    scoresheet_url, round_number, created_at,
    ts, p_reason
  from matches
  where age_group_id = p_age_group_id;

  get diagnostics inserted = row_count;
  return query select inserted, ts;
end;
$$;

revoke all on function backup_age_group_matches(uuid, text) from public;
grant execute on function backup_age_group_matches(uuid, text) to authenticated;

-- =============================================================================
-- RLS for matches_backup
-- The write-side is handled by security-definer functions above.
-- The read-side needs an explicit SELECT policy so the Snapshot View works.
-- Run these once — they are idempotent (drop + recreate is safe).
-- =============================================================================

alter table matches_backup enable row level security;

drop policy if exists "Authenticated users can read backups" on matches_backup;
create policy "Authenticated users can read backups"
  on matches_backup for select
  to authenticated
  using (true);
