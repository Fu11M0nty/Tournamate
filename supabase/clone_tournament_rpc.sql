-- =============================================================================
-- clone_tournament() RPC
--
-- Server-side function that copies an entire tournament's age_groups, teams
-- and matches into a brand-new tournament. Scores, penalties and scoresheet
-- URLs are cleared on the cloned matches (every match becomes 'scheduled' /
-- null). Kickoff times are shifted by the difference between the source and
-- new start_date so the calendar lines up.
--
-- Returns the new tournament's UUID.
--
-- Run add_tournaments.sql first so the `tournaments` table + age_groups
-- tournament_id column exist.
--
-- Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

create or replace function clone_tournament(
  source_slug text,
  new_slug text,
  new_name text,
  new_start_date date,
  new_end_date date,
  new_status text default 'upcoming'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_id uuid;
  source_start date;
  new_tournament_id uuid;
  date_offset interval := interval '0';
begin
  if new_status not in ('upcoming', 'live', 'complete') then
    raise exception 'Invalid status: %', new_status;
  end if;

  select id, start_date into source_id, source_start
    from tournaments where slug = source_slug;
  if source_id is null then
    raise exception 'Source tournament % not found', source_slug;
  end if;

  if exists (select 1 from tournaments where slug = new_slug) then
    raise exception 'Tournament slug % already exists', new_slug;
  end if;

  insert into tournaments (
    slug, name, start_date, end_date, status, display_order, created_by,
    logo_url, brand_primary_color, sponsor_name, sponsor_logo_url, sponsor_url
  )
    select
      new_slug, new_name, new_start_date, new_end_date, new_status,
      (select coalesce(max(display_order), 0) + 1 from tournaments),
      auth.uid(),
      t.logo_url, t.brand_primary_color, t.sponsor_name, t.sponsor_logo_url, t.sponsor_url
    from tournaments t
    where t.id = source_id
    returning id into new_tournament_id;

  if new_start_date is not null and source_start is not null then
    date_offset := new_start_date - source_start;
  end if;

  -- Map old age_group ids → new ids (use distinct column names to avoid
  -- ambiguity with the new_tournament_id local variable in later inserts).
  create temp table _ag_map (old_id uuid, mapped_id uuid) on commit drop;
  insert into _ag_map(old_id, mapped_id)
    select id, gen_random_uuid()
    from age_groups
    where tournament_id = source_id;

  insert into age_groups (id, tournament_id, name, slug, day, display_order)
    select m.mapped_id, new_tournament_id, ag.name, ag.slug, ag.day, ag.display_order
    from age_groups ag
    join _ag_map m on m.old_id = ag.id
    where ag.tournament_id = source_id;

  -- Map old team ids → new ids
  create temp table _team_map (old_id uuid, mapped_id uuid) on commit drop;
  insert into _team_map(old_id, mapped_id)
    select t.id, gen_random_uuid()
    from teams t
    join _ag_map m on m.old_id = t.age_group_id;

  insert into teams (id, name, short_name, color, logo_url, age_group_id)
    select tm.mapped_id, t.name, t.short_name, t.color, t.logo_url, agm.mapped_id
    from teams t
    join _team_map tm on tm.old_id = t.id
    join _ag_map agm on agm.old_id = t.age_group_id;

  -- Clone matches: clear scores / penalties / scoresheets, shift kickoff_time
  insert into matches (
    age_group_id, home_team_id, away_team_id,
    home_score, away_score, court, kickoff_time, status,
    home_umpire_no_show, away_umpire_no_show,
    home_late_minutes, away_late_minutes,
    home_no_show, away_no_show, scoresheet_url, round_number
  )
  select
    agm.mapped_id, htm.mapped_id, atm.mapped_id,
    null, null, ma.court, ma.kickoff_time + date_offset, 'scheduled',
    false, false, 0, 0, false, false, null, ma.round_number
  from matches ma
  join _ag_map agm on agm.old_id = ma.age_group_id
  join _team_map htm on htm.old_id = ma.home_team_id
  join _team_map atm on atm.old_id = ma.away_team_id;

  return new_tournament_id;
end;
$$;

revoke all on function clone_tournament(text, text, text, date, date, text) from public;
grant execute on function clone_tournament(text, text, text, date, date, text) to authenticated;
