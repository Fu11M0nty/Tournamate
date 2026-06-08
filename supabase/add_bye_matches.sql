-- Migration: allow bye matches (null away_team_id)
-- A bye match has home_team_id set, away_team_id NULL, and status = 'completed'.
-- The seeded team automatically advances; no opponent is needed.

alter table matches
  drop constraint if exists matches_team_or_slot_check;

alter table matches
  add constraint matches_team_or_slot_check check (
    (
      home_team_id is not null
      and away_team_id is not null
      and home_team_id <> away_team_id
    )
    or (
      home_slot_id is not null
      and away_slot_id is not null
      and home_slot_id <> away_slot_id
    )
    or (
      -- Bye match (resolved team): home team known, no opponent
      home_team_id is not null
      and away_team_id is null
      and home_slot_id is null
      and away_slot_id is null
    )
    or (
      -- Bye match (unresolved slot): home slot known, no opponent slot
      home_slot_id is not null
      and away_slot_id is null
      and home_team_id is null
      and away_team_id is null
    )
  );
