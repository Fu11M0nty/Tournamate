-- Per-venue playable weekdays for multi-week scheduling.
-- Additive migration: safe to run against existing projects.
--
-- An empty array means "available on all of the phase's playable weekdays"
-- (backward compatible). A non-empty array restricts the venue to those days,
-- e.g. one venue on Wednesdays and another on Thursdays. 0 = Sunday … 6 = Saturday.

alter table tournament_venues
  add column if not exists playable_weekdays int[] not null default '{}';

alter table tournament_venues
  drop constraint if exists tournament_venues_playable_weekdays_check;
alter table tournament_venues
  add constraint tournament_venues_playable_weekdays_check
  check (playable_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]);
