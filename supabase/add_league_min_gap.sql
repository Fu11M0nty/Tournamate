-- Minimum changeover gap between consecutive multi-week fixtures on a court.
-- Additive migration: safe to run against existing projects.
--
-- Gives teams/umpires time to clear the court before the next game. 0 keeps the
-- previous back-to-back behaviour.

alter table league_schedule_settings
  add column if not exists min_gap_minutes int not null default 0;

alter table league_schedule_settings
  drop constraint if exists league_schedule_settings_min_gap_check;
alter table league_schedule_settings
  add constraint league_schedule_settings_min_gap_check
  check (min_gap_minutes >= 0);
