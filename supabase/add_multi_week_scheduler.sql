-- Multi-week / league scheduler support.
-- Additive migration: safe to run against existing projects.

alter table tournaments
  add column if not exists schedule_mode text not null default 'event_day';

alter table tournaments
  drop constraint if exists tournaments_schedule_mode_check;

alter table tournaments
  add constraint tournaments_schedule_mode_check
  check (schedule_mode in ('event_day', 'multi_week'));

alter table teams
  add column if not exists home_venue_name text,
  add column if not exists home_venue_address text,
  add column if not exists home_venue_postcode text,
  add column if not exists home_venue_notes text;

create table if not exists league_schedule_settings (
  phase_id uuid primary key references phases(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  playable_weekdays int[] not null default '{}',
  venue_mode text not null default 'neutral_venues',
  max_games_per_team_per_week int,
  prefer_round_order boolean not null default true,
  prefer_home_away_balance boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (venue_mode in ('neutral_venues', 'home_team_venues', 'mixed')),
  check (
    max_games_per_team_per_week is null
    or max_games_per_team_per_week > 0
  ),
  check (
    playable_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]
  )
);

create index if not exists league_schedule_settings_start_end_idx
  on league_schedule_settings(start_date, end_date);

alter table league_schedule_settings enable row level security;

drop policy if exists "league_schedule_settings_anon_select" on league_schedule_settings;
drop policy if exists "league_schedule_settings_auth_select" on league_schedule_settings;
drop policy if exists "league_schedule_settings_auth_insert" on league_schedule_settings;
drop policy if exists "league_schedule_settings_auth_update" on league_schedule_settings;
drop policy if exists "league_schedule_settings_auth_delete" on league_schedule_settings;

create policy "league_schedule_settings_anon_select"
  on league_schedule_settings for select to anon using (true);

create policy "league_schedule_settings_auth_select"
  on league_schedule_settings for select to authenticated using (true);

create policy "league_schedule_settings_auth_insert"
  on league_schedule_settings for insert to authenticated with check (true);

create policy "league_schedule_settings_auth_update"
  on league_schedule_settings for update to authenticated using (true) with check (true);

create policy "league_schedule_settings_auth_delete"
  on league_schedule_settings for delete to authenticated using (true);
