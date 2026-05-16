-- Netball tournament results — database schema
-- Run once in the Supabase SQL editor for a fresh project.
-- WARNING: the drop statements at the top are destructive. Remove them
-- before running against any database that contains real data.

drop table if exists schedule_events cascade;
drop table if exists players cascade;
drop table if exists progression_rules cascade;
drop table if exists element_slots cascade;
drop table if exists matches cascade;
drop table if exists pool_teams cascade;
drop table if exists teams cascade;
drop table if exists courts cascade;
drop table if exists phase_elements cascade;
drop table if exists pools cascade;
drop table if exists phases cascade;
drop table if exists age_groups cascade;
drop table if exists competition_dates cascade;
drop table if exists tournament_venues cascade;
drop table if exists tournaments cascade;

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table tournaments (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  start_date    date,
  end_date      date,
  status        text not null default 'live',
  display_order int not null default 0,
  courts        text[] not null default '{}',
  schedule_locked boolean not null default false,
  sport         text,
  sport_other   text,
  default_scoring_system_id uuid,
  venue_name    text,
  venue_city    text,
  venue_county  text,
  venue_postcode text,
  description   text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  check (status in ('upcoming', 'live', 'complete'))
);

-- ---------------------------------------------------------------------------
-- tournament_venues (one or more host locations)
-- ---------------------------------------------------------------------------
create table tournament_venues (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  address_line1 text,
  address_line2 text,
  city          text,
  county        text,
  postcode      text,
  country       text,
  notes         text,
  display_order int not null default 1,
  created_at    timestamptz not null default now(),
  check (display_order > 0)
);

create index tournament_venues_tournament_id_idx on tournament_venues(tournament_id);

-- ---------------------------------------------------------------------------
-- competition_dates (event days / sessions)
-- ---------------------------------------------------------------------------
create table competition_dates (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  slug          text not null,
  label         text not null,
  date          date,
  display_order int not null default 0,
  legacy_day    text,
  created_at    timestamptz not null default now(),
  unique (tournament_id, slug),
  check (slug ~ '^[a-z0-9-]+$'),
  check (legacy_day is null or legacy_day in ('saturday', 'sunday'))
);

create index competition_dates_tournament_id_idx on competition_dates(tournament_id);
create index competition_dates_legacy_day_idx
  on competition_dates(tournament_id, legacy_day)
  where legacy_day is not null;

-- ---------------------------------------------------------------------------
-- age_groups
-- ---------------------------------------------------------------------------
create table age_groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  slug          text not null,
  day           text not null,
  display_order int  not null,
  gender        text,
  skill_level   text,
  match_format  text not null default 'continuous',
  period_minutes int not null default 12,
  break_q1_q2_minutes int not null default 0,
  break_half_time_minutes int not null default 0,
  break_q3_q4_minutes int not null default 0,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (tournament_id, slug, day),
  unique (tournament_id, name, day),
  check (day in ('saturday', 'sunday')),
  check (match_format in ('continuous', 'halves', 'quarters')),
  check (period_minutes > 0),
  check (break_q1_q2_minutes >= 0),
  check (break_half_time_minutes >= 0),
  check (break_q3_q4_minutes >= 0)
);

create index age_groups_tournament_id_idx on age_groups(tournament_id);

-- ---------------------------------------------------------------------------
-- phases (competition structure within an age group)
-- ---------------------------------------------------------------------------
create table phases (
  id            uuid primary key default gen_random_uuid(),
  age_group_id  uuid not null references age_groups(id) on delete cascade,
  slug          text not null default 'round-robin',
  name          text not null default 'Round Robin',
  phase_type    text not null default 'round_robin',
  display_order int not null default 1,
  standings_mode text not null default 'visible',
  scoring_system_id uuid,
  match_format  text not null default 'continuous',
  period_minutes int not null default 12,
  break_q1_q2_minutes int not null default 0,
  break_half_time_minutes int not null default 0,
  break_q3_q4_minutes int not null default 0,
  created_at    timestamptz not null default now(),
  unique (age_group_id, slug),
  check (slug ~ '^[a-z0-9-]+$'),
  check (phase_type in ('round_robin', 'group_stage', 'knockout', 'league', 'friendly')),
  check (standings_mode in ('visible', 'hidden', 'none')),
  check (match_format in ('continuous', 'halves', 'quarters')),
  check (period_minutes > 0),
  check (break_q1_q2_minutes >= 0),
  check (break_half_time_minutes >= 0),
  check (break_q3_q4_minutes >= 0)
);

create index phases_age_group_id_idx on phases(age_group_id);

create or replace function ensure_default_phase_for_age_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoring_id uuid := null;
begin
  if to_jsonb(new) ? 'scoring_system_id' and to_jsonb(new)->>'scoring_system_id' is not null then
    scoring_id := (to_jsonb(new)->>'scoring_system_id')::uuid;
  end if;

  insert into phases (
    age_group_id,
    slug,
    name,
    phase_type,
    display_order,
    standings_mode,
    scoring_system_id,
    match_format,
    period_minutes,
    break_q1_q2_minutes,
    break_half_time_minutes,
    break_q3_q4_minutes
  )
  values (
    new.id,
    'round-robin',
    'Round Robin',
    'round_robin',
    1,
    'visible',
    scoring_id,
    new.match_format,
    new.period_minutes,
    new.break_q1_q2_minutes,
    new.break_half_time_minutes,
    new.break_q3_q4_minutes
  )
  on conflict (age_group_id, slug) do update
  set
    scoring_system_id = coalesce(excluded.scoring_system_id, phases.scoring_system_id),
    match_format = excluded.match_format,
    period_minutes = excluded.period_minutes,
    break_q1_q2_minutes = excluded.break_q1_q2_minutes,
    break_half_time_minutes = excluded.break_half_time_minutes,
    break_q3_q4_minutes = excluded.break_q3_q4_minutes;

  return new;
end;
$$;

-- Divisions now start with zero phases. Organisers explicitly apply a
-- structure template from the admin Structure page.
drop trigger if exists age_groups_ensure_default_phase on age_groups;

create or replace function sync_default_phase_scoring_from_age_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoring_id uuid := null;
begin
  if to_jsonb(new) ? 'scoring_system_id' and to_jsonb(new)->>'scoring_system_id' is not null then
    scoring_id := (to_jsonb(new)->>'scoring_system_id')::uuid;
  end if;

  update phases
  set scoring_system_id = scoring_id
  where age_group_id = new.id
    and slug = 'round-robin';

  return new;
end;
$$;

create trigger age_groups_sync_default_phase_scoring
  after insert or update on age_groups
  for each row
  execute function sync_default_phase_scoring_from_age_group();

-- ---------------------------------------------------------------------------
-- pools (groups within a phase)
-- ---------------------------------------------------------------------------
create table pools (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references phases(id) on delete cascade,
  slug          text not null default 'default',
  name          text not null default 'Default Pool',
  display_order int not null default 1,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (phase_id, slug),
  check (slug ~ '^[a-z0-9-]+$')
);

create index pools_phase_id_idx on pools(phase_id);
create unique index pools_one_default_per_phase_idx
  on pools(phase_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- phase_elements (groups, brackets, single matches, heats, ladders)
-- ---------------------------------------------------------------------------
create table phase_elements (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references phases(id) on delete cascade,
  pool_id       uuid references pools(id) on delete cascade,
  slug          text not null,
  name          text not null,
  element_type  text not null default 'group',
  display_order int not null default 1,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (phase_id, slug),
  unique (pool_id),
  check (slug ~ '^[a-z0-9-]+$'),
  check (display_order > 0),
  check (element_type in (
    'group',
    'bracket',
    'single_match',
    'heat',
    'league_table',
    'ladder',
    'swiss_round'
  ))
);

create index phase_elements_phase_id_idx on phase_elements(phase_id);
create index phase_elements_pool_id_idx
  on phase_elements(pool_id)
  where pool_id is not null;

create or replace function ensure_group_element_for_pool()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into phase_elements (
    phase_id,
    pool_id,
    slug,
    name,
    element_type,
    display_order,
    metadata
  )
  values (
    new.phase_id,
    new.id,
    new.slug,
    new.name,
    'group',
    new.display_order,
    jsonb_build_object('legacy_pool_id', new.id)
  )
  on conflict (pool_id) do update
  set
    phase_id = excluded.phase_id,
    slug = excluded.slug,
    name = excluded.name,
    element_type = 'group',
    display_order = excluded.display_order,
    metadata = coalesce(phase_elements.metadata, '{}'::jsonb)
      || jsonb_build_object('legacy_pool_id', excluded.pool_id);

  return new;
end;
$$;

create trigger pools_ensure_group_element
  after insert or update of phase_id, slug, name, display_order on pools
  for each row
  execute function ensure_group_element_for_pool();

create or replace function ensure_default_pool_for_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pools (phase_id, slug, name, display_order, is_default)
  values (new.id, 'default', 'Default Pool', 1, true)
  on conflict (phase_id, slug) do update
  set is_default = true;

  return new;
end;
$$;

create trigger phases_ensure_default_pool
  after insert on phases
  for each row
  execute function ensure_default_pool_for_phase();

-- ---------------------------------------------------------------------------
-- courts (per-tournament court configuration with start/end times)
-- ---------------------------------------------------------------------------
create table courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  day           text not null default 'saturday',
  display_order int  not null default 0,
  start_time    text not null default '08:00',
  end_time      text not null default '17:00',
  created_at    timestamptz not null default now(),
  unique (tournament_id, day, name),
  check (day in ('saturday', 'sunday')),
  check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  check (end_time   ~ '^[0-2][0-9]:[0-5][0-9]$'),
  check (end_time > start_time)
);

create index courts_tournament_id_idx on courts(tournament_id);
create index courts_tournament_day_idx on courts(tournament_id, day);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text,
  color        text,
  logo_url     text,
  age_group_id uuid not null references age_groups(id) on delete cascade,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index teams_age_group_id_idx on teams(age_group_id);
create index teams_active_idx on teams(age_group_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- pool_teams
-- ---------------------------------------------------------------------------
create table pool_teams (
  pool_id       uuid not null references pools(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  primary key (pool_id, team_id)
);

create index pool_teams_team_id_idx on pool_teams(team_id);

create or replace function assign_team_to_default_pools()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pool_teams (pool_id, team_id, display_order)
  select p.id, new.id, 0
  from pools p
  join phases ph on ph.id = p.phase_id
  where ph.age_group_id = new.age_group_id
    and p.is_default = true
  on conflict (pool_id, team_id) do nothing;

  return new;
end;
$$;

create trigger teams_assign_default_pools
  after insert or update of age_group_id on teams
  for each row
  execute function assign_team_to_default_pools();

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table matches (
  id            uuid primary key default gen_random_uuid(),
  age_group_id  uuid not null references age_groups(id) on delete cascade,
  phase_id      uuid references phases(id) on delete set null,
  pool_id       uuid references pools(id) on delete set null,
  phase_element_id uuid references phase_elements(id) on delete set null,
  competition_date_id uuid references competition_dates(id) on delete set null,
  home_team_id  uuid references teams(id),
  away_team_id  uuid references teams(id),
  home_slot_id  uuid references element_slots(id) on delete set null,
  away_slot_id  uuid references element_slots(id) on delete set null,
  home_score    int,
  away_score    int,
  court         text,
  kickoff_time  timestamptz not null,
  status        text not null default 'scheduled',
  home_umpire_no_show boolean not null default false,
  away_umpire_no_show boolean not null default false,
  home_late_minutes int not null default 0,
  away_late_minutes int not null default 0,
  home_no_show boolean not null default false,
  away_no_show boolean not null default false,
  scoresheet_url text,
  duration_minutes int not null default 12,
  is_planned    boolean not null default true,
  round_number  int,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint matches_team_or_slot_check check (
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
  ),
  check (status in ('scheduled', 'completed')),
  check (home_late_minutes >= 0),
  check (away_late_minutes >= 0),
  check (duration_minutes > 0)
);

create index matches_age_group_id_idx on matches(age_group_id);
create index matches_phase_id_idx on matches(phase_id);
create index matches_pool_id_idx on matches(pool_id);
create index matches_phase_element_id_idx on matches(phase_element_id);
create index matches_competition_date_id_idx on matches(competition_date_id);
create index matches_home_slot_id_idx on matches(home_slot_id) where home_slot_id is not null;
create index matches_away_slot_id_idx on matches(away_slot_id) where away_slot_id is not null;
create index matches_kickoff_time_idx on matches(kickoff_time);
create index matches_active_idx on matches(age_group_id) where deleted_at is null;

create or replace function ensure_default_phase_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase_id is null then
    select id into new.phase_id
    from phases
    where age_group_id = new.age_group_id
      and slug = 'round-robin'
    limit 1;
  end if;

  return new;
end;
$$;

create trigger matches_ensure_default_phase
  before insert or update of age_group_id, phase_id on matches
  for each row
  execute function ensure_default_phase_for_match();

create or replace function ensure_default_pool_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pool_id is null and new.phase_id is not null then
    select id into new.pool_id
    from pools
    where phase_id = new.phase_id
      and is_default = true
    order by display_order
    limit 1;
  end if;

  return new;
end;
$$;

create trigger matches_ensure_default_pool
  before insert or update of phase_id, pool_id on matches
  for each row
  execute function ensure_default_pool_for_match();

create or replace function ensure_phase_element_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase_element_id is null and new.pool_id is not null then
    select id into new.phase_element_id
    from phase_elements
    where pool_id = new.pool_id
    limit 1;
  end if;

  if new.phase_element_id is null and new.phase_id is not null then
    select id into new.phase_element_id
    from phase_elements
    where phase_id = new.phase_id
    order by display_order
    limit 1;
  end if;

  return new;
end;
$$;

create trigger matches_ensure_phase_element
  before insert or update of phase_id, pool_id, phase_element_id on matches
  for each row
  execute function ensure_phase_element_for_match();

-- ---------------------------------------------------------------------------
-- element_slots and progression_rules
-- ---------------------------------------------------------------------------
create table element_slots (
  id            uuid primary key default gen_random_uuid(),
  phase_element_id uuid not null references phase_elements(id) on delete cascade,
  display_order int not null,
  label         text,
  slot_type     text not null default 'placeholder',
  team_id       uuid references teams(id) on delete set null,
  source_phase_id uuid references phases(id) on delete set null,
  source_element_id uuid references phase_elements(id) on delete set null,
  source_pool_id uuid references pools(id) on delete set null,
  source_match_id uuid references matches(id) on delete set null,
  source_rank   int,
  source_outcome text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (phase_element_id, display_order),
  check (display_order > 0),
  check (source_rank is null or source_rank > 0),
  check (slot_type in ('team', 'source', 'bye', 'placeholder', 'manual')),
  check (source_outcome is null or source_outcome in ('winner', 'loser', 'rank', 'best_rank', 'manual'))
);

create index element_slots_phase_element_id_idx on element_slots(phase_element_id);
create index element_slots_team_id_idx
  on element_slots(team_id)
  where team_id is not null;

create table progression_rules (
  id            uuid primary key default gen_random_uuid(),
  from_phase_id uuid references phases(id) on delete cascade,
  from_element_id uuid references phase_elements(id) on delete cascade,
  from_pool_id uuid references pools(id) on delete cascade,
  from_match_id uuid references matches(id) on delete cascade,
  source_type   text not null,
  source_rank   int,
  to_phase_id   uuid references phases(id) on delete cascade,
  to_element_id uuid not null references phase_elements(id) on delete cascade,
  to_slot_id    uuid references element_slots(id) on delete cascade,
  to_slot_order int,
  display_order int not null default 1,
  rule_config   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  check (source_rank is null or source_rank > 0),
  check (to_slot_order is null or to_slot_order > 0),
  check (display_order > 0),
  check (source_type in ('standings_rank', 'match_winner', 'match_loser', 'best_rank', 'manual')),
  check (to_slot_id is not null or to_slot_order is not null)
);

create index progression_rules_from_phase_id_idx on progression_rules(from_phase_id);
create index progression_rules_from_element_id_idx on progression_rules(from_element_id);
create index progression_rules_to_element_id_idx on progression_rules(to_element_id);
create index progression_rules_to_slot_id_idx
  on progression_rules(to_slot_id)
  where to_slot_id is not null;

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table players (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  name            text not null,
  dob             date,
  registration_no text,
  notes           text,
  display_order   int not null default 0,
  created_at      timestamptz not null default now()
);

create index players_team_id_idx on players(team_id);

-- ---------------------------------------------------------------------------
-- schedule_events  (lunch / ceremony / award blocks)
-- ---------------------------------------------------------------------------
create table schedule_events (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  court         text,
  color         text,
  notes         text,
  created_at    timestamptz not null default now(),
  check (end_time > start_time)
);

create index schedule_events_tournament_id_idx on schedule_events(tournament_id);
create index schedule_events_start_time_idx    on schedule_events(start_time);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table tournaments     enable row level security;
alter table tournament_venues enable row level security;
alter table competition_dates enable row level security;
alter table age_groups      enable row level security;
alter table phases         enable row level security;
alter table pools          enable row level security;
alter table phase_elements enable row level security;
alter table courts          enable row level security;
alter table teams           enable row level security;
alter table pool_teams     enable row level security;
alter table matches         enable row level security;
alter table element_slots  enable row level security;
alter table progression_rules enable row level security;
alter table players         enable row level security;
alter table schedule_events enable row level security;

-- Public (anon) read access
create policy "tournaments_anon_select"     on tournaments     for select to anon          using (true);
create policy "tournament_venues_anon_select" on tournament_venues for select to anon      using (true);
create policy "competition_dates_anon_select" on competition_dates for select to anon      using (true);
create policy "age_groups_anon_select"      on age_groups      for select to anon          using (true);
create policy "phases_anon_select"          on phases          for select to anon          using (true);
create policy "pools_anon_select"           on pools           for select to anon          using (true);
create policy "phase_elements_anon_select"  on phase_elements  for select to anon          using (true);
create policy "teams_anon_select"           on teams           for select to anon          using (true);
create policy "pool_teams_anon_select"      on pool_teams      for select to anon          using (true);
create policy "matches_anon_select"         on matches         for select to anon          using (true);
create policy "element_slots_anon_select"   on element_slots   for select to anon          using (true);
create policy "progression_rules_anon_select" on progression_rules for select to anon      using (true);
create policy "players_anon_select"         on players         for select to anon          using (true);
create policy "schedule_events_anon_select" on schedule_events for select to anon          using (true);
create policy "courts_anon_select"          on courts          for select to anon          using (true);

-- Authenticated read (so the admin console also gets rows back)
create policy "tournaments_auth_select"     on tournaments     for select to authenticated using (true);
create policy "tournament_venues_auth_select" on tournament_venues for select to authenticated using (true);
create policy "competition_dates_auth_select" on competition_dates for select to authenticated using (true);
create policy "age_groups_auth_select"      on age_groups      for select to authenticated using (true);
create policy "phases_auth_select"          on phases          for select to authenticated using (true);
create policy "pools_auth_select"           on pools           for select to authenticated using (true);
create policy "phase_elements_auth_select"  on phase_elements  for select to authenticated using (true);
create policy "teams_auth_select"           on teams           for select to authenticated using (true);
create policy "pool_teams_auth_select"      on pool_teams      for select to authenticated using (true);
create policy "matches_auth_select"         on matches         for select to authenticated using (true);
create policy "element_slots_auth_select"   on element_slots   for select to authenticated using (true);
create policy "progression_rules_auth_select" on progression_rules for select to authenticated using (true);
create policy "players_auth_select"         on players         for select to authenticated using (true);
create policy "schedule_events_auth_select" on schedule_events for select to authenticated using (true);
create policy "courts_auth_select"          on courts          for select to authenticated using (true);
create policy "courts_auth_insert"          on courts          for insert to authenticated with check (true);
create policy "courts_auth_update"          on courts          for update to authenticated using (true) with check (true);
create policy "courts_auth_delete"          on courts          for delete to authenticated using (true);

-- Authenticated write (insert / update / delete) — used by the admin console
create policy "tournaments_auth_insert"     on tournaments     for insert to authenticated with check (true);
create policy "tournaments_auth_update"     on tournaments     for update to authenticated using (true) with check (true);
create policy "tournaments_auth_delete"     on tournaments     for delete to authenticated using (true);

create policy "tournament_venues_auth_insert" on tournament_venues for insert to authenticated with check (true);
create policy "tournament_venues_auth_update" on tournament_venues for update to authenticated using (true) with check (true);
create policy "tournament_venues_auth_delete" on tournament_venues for delete to authenticated using (true);

create policy "competition_dates_auth_insert" on competition_dates for insert to authenticated with check (true);
create policy "competition_dates_auth_update" on competition_dates for update to authenticated using (true) with check (true);
create policy "competition_dates_auth_delete" on competition_dates for delete to authenticated using (true);

create policy "age_groups_auth_insert"      on age_groups      for insert to authenticated with check (true);
create policy "age_groups_auth_update"      on age_groups      for update to authenticated using (true) with check (true);
create policy "age_groups_auth_delete"      on age_groups      for delete to authenticated using (true);

create policy "phases_auth_insert"          on phases          for insert to authenticated with check (true);
create policy "phases_auth_update"          on phases          for update to authenticated using (true) with check (true);
create policy "phases_auth_delete"          on phases          for delete to authenticated using (true);

create policy "pools_auth_insert"           on pools           for insert to authenticated with check (true);
create policy "pools_auth_update"           on pools           for update to authenticated using (true) with check (true);
create policy "pools_auth_delete"           on pools           for delete to authenticated using (true);

create policy "phase_elements_auth_insert"  on phase_elements  for insert to authenticated with check (true);
create policy "phase_elements_auth_update"  on phase_elements  for update to authenticated using (true) with check (true);
create policy "phase_elements_auth_delete"  on phase_elements  for delete to authenticated using (true);

create policy "teams_auth_insert"           on teams           for insert to authenticated with check (true);
create policy "teams_auth_update"           on teams           for update to authenticated using (true) with check (true);
create policy "teams_auth_delete"           on teams           for delete to authenticated using (true);

create policy "pool_teams_auth_insert"      on pool_teams      for insert to authenticated with check (true);
create policy "pool_teams_auth_update"      on pool_teams      for update to authenticated using (true) with check (true);
create policy "pool_teams_auth_delete"      on pool_teams      for delete to authenticated using (true);

create policy "matches_auth_insert"         on matches         for insert to authenticated with check (true);
create policy "matches_auth_update"         on matches         for update to authenticated using (true) with check (true);
create policy "matches_auth_delete"         on matches         for delete to authenticated using (true);

create policy "element_slots_auth_insert"   on element_slots   for insert to authenticated with check (true);
create policy "element_slots_auth_update"   on element_slots   for update to authenticated using (true) with check (true);
create policy "element_slots_auth_delete"   on element_slots   for delete to authenticated using (true);

create policy "progression_rules_auth_insert" on progression_rules for insert to authenticated with check (true);
create policy "progression_rules_auth_update" on progression_rules for update to authenticated using (true) with check (true);
create policy "progression_rules_auth_delete" on progression_rules for delete to authenticated using (true);

create policy "players_auth_insert"         on players         for insert to authenticated with check (true);
create policy "players_auth_update"         on players         for update to authenticated using (true) with check (true);
create policy "players_auth_delete"         on players         for delete to authenticated using (true);

create policy "schedule_events_auth_insert" on schedule_events for insert to authenticated with check (true);
create policy "schedule_events_auth_update" on schedule_events for update to authenticated using (true) with check (true);
create policy "schedule_events_auth_delete" on schedule_events for delete to authenticated using (true);
