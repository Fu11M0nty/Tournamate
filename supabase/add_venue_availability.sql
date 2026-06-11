-- Venue availability + court capacity for multi-week scheduling.
-- Additive migration: safe to run against existing projects.
--
-- Each venue gets a single daily availability window and a court count, so the
-- multi-week planner can pack several fixtures onto one playable date across
-- parallel courts. Defaults mirror the event-day `courts` table (09:00-17:00).

alter table tournament_venues
  add column if not exists available_from text not null default '09:00',
  add column if not exists available_to   text not null default '17:00',
  add column if not exists court_count    int  not null default 1;

alter table tournament_venues
  drop constraint if exists tournament_venues_available_from_check;
alter table tournament_venues
  add constraint tournament_venues_available_from_check
  check (available_from ~ '^[0-2][0-9]:[0-5][0-9]$');

alter table tournament_venues
  drop constraint if exists tournament_venues_available_to_check;
alter table tournament_venues
  add constraint tournament_venues_available_to_check
  check (available_to ~ '^[0-2][0-9]:[0-5][0-9]$');

alter table tournament_venues
  drop constraint if exists tournament_venues_available_window_check;
alter table tournament_venues
  add constraint tournament_venues_available_window_check
  check (available_to > available_from);

alter table tournament_venues
  drop constraint if exists tournament_venues_court_count_check;
alter table tournament_venues
  add constraint tournament_venues_court_count_check
  check (court_count > 0);
