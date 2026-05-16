# Supabase Database Setup

This folder contains both the current database setup scripts and older historical migrations. Use this document as the source of truth for creating or upgrading development, staging, and production-like Supabase environments.

## Safety Rules

- `schema.sql` is destructive. It drops and recreates core public tables. Only run it on a new/empty database or a database you are prepared to wipe.
- Do not run seed scripts against production.
- Run scripts one at a time in the Supabase SQL Editor and stop if any script errors.
- Create storage buckets manually before running their storage policies.

## Fresh Database Build

Use this order for a brand-new development or staging Supabase project.

### 1. Core Schema

Run:

```text
schema.sql
```

Creates the core event model:

- `tournaments`
- `tournament_venues`
- `competition_dates`
- `age_groups`
- `phases`
- `pools`
- `phase_elements`
- `courts`
- `teams`
- `pool_teams`
- `matches`
- `element_slots`
- `progression_rules`
- `players`
- `schedule_events`

It also installs default triggers for phases/pools and basic public/authenticated RLS policies.

### 2. Scoring Systems

Run:

```text
add_scoring_systems.sql
backfill_netball_scoring.sql
move_scoring_to_phases.sql
```

This creates reusable scoring systems, creates the default `Standard Netball` scoring system, assigns scoring to existing age groups, and copies the scoring assignment onto each age group's default phase.

`age_groups.scoring_system_id` is retained temporarily as a fallback. The long-term owner is `phases.scoring_system_id`.

### 3. RBAC and Platform Fields

Run:

```text
add_rbac.sql
add_tournamate_fields.sql
add_tournament_general.sql
```

This creates:

- `user_profiles`
- auth profile trigger
- tournament ownership via `tournaments.created_by`
- role-aware RLS policies
- user management RPCs
- `clone_tournament()` and `commit_schedule()` RPCs
- TournaMate platform fields such as `sport`, `venue_*`, `is_public`, `is_approved`, and `organisation_name`
- tournament general settings such as multiple venues, `sport_other`, and `default_scoring_system_id`

Important: `add_tournamate_fields.sql` requires `user_profiles`, so it must run after `add_rbac.sql`.

### 4. Backup Tables and RPCs

Run:

```text
backup_matches.sql
backup_matches_rpc.sql
backup_age_group_rpc.sql
```

This creates `matches_backup`, the global backup RPC, the age-group backup RPC, and read access for backup snapshots.

### 5. Storage

Create these buckets manually in Supabase Studio:

```text
scoresheets  public
team-logos   public
```

Then run:

```text
scoresheets_storage_policies.sql
```

There is currently no SQL policy file for `team-logos`; keep its bucket public if using logo uploads.

### 6. Optional Seed Data

Only for local development or staging:

```text
seed.sql
```

After running seed data, re-run:

```text
backfill_netball_scoring.sql
add_competition_dates.sql
add_phases.sql
move_scoring_to_phases.sql
add_pools.sql
add_phase_elements.sql
add_placeholder_matches.sql
```

Those scripts are safe to re-run and will backfill any seed rows inserted after the core setup.

## Existing Database Upgrade Path

For an existing database that already has the older two-day tournament schema, do not run `schema.sql`. Run these upgrade scripts in order:

```text
add_scoring_systems.sql
backfill_netball_scoring.sql
add_rbac.sql
add_competition_dates.sql
add_phases.sql
move_scoring_to_phases.sql
add_pools.sql
add_phase_elements.sql
add_placeholder_matches.sql
add_tournamate_fields.sql
add_tournament_general.sql
backup_matches.sql
backup_matches_rpc.sql
backup_age_group_rpc.sql
```

Then create the storage buckets and run:

```text
scoresheets_storage_policies.sql
```

## Create the First Superadmin

If signup is disabled, create the user from Supabase Studio:

```text
Authentication -> Users -> Add user
```

Then run:

```sql
update public.user_profiles
set role = 'superadmin', is_approved = true
where id = (
  select id
  from auth.users
  order by created_at
  limit 1
);
```

If you need to target a specific account:

```sql
update public.user_profiles
set role = 'superadmin', is_approved = true
where id = (
  select id
  from auth.users
  where email = 'you@example.com'
);
```

## Verification Queries

Run these after setup:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected important tables:

```text
age_groups
competition_dates
courts
matches
matches_backup
phases
players
pool_teams
pools
phase_elements
element_slots
progression_rules
schedule_events
scoring_systems
teams
tournaments
user_profiles
```

Check structure backfills:

```sql
select count(*) as age_groups from public.age_groups;
select count(*) as phases from public.phases;
select count(*) as pools from public.pools;
select count(*) as phase_elements from public.phase_elements;

select count(*) as matches_without_phase
from public.matches
where phase_id is null
  and deleted_at is null;

select count(*) as matches_without_pool
from public.matches
where pool_id is null
  and deleted_at is null;

select count(*) as matches_without_phase_element
from public.matches
where phase_id is not null
  and deleted_at is null
  and phase_element_id is null;
```

For current simple tournaments, `phases` should equal `age_groups`, `pools` should equal `phases`, `phase_elements` should equal `pools`, and all missing-link match counts should be `0`.

Check triggers:

```sql
select tgname
from pg_trigger
where tgname in (
  'on_auth_user_created',
  'age_groups_ensure_default_phase',
  'age_groups_sync_default_phase_scoring',
  'matches_ensure_default_phase',
  'phases_ensure_default_pool',
  'pools_ensure_group_element',
  'teams_assign_default_pools',
  'matches_ensure_default_pool',
  'matches_ensure_phase_element'
)
order by tgname;
```

Check RPCs:

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'get_my_role',
    'handle_new_user',
    'list_users_with_roles',
    'set_user_role',
    'clone_tournament',
    'commit_schedule',
    'backup_matches',
    'backup_age_group_matches'
  )
order by proname;
```

## Historical Scripts

These scripts are historical and should not be part of the normal fresh-build path because their changes are now included in `schema.sql`, `add_rbac.sql`, or the newer multi-format migrations:

```text
add_tournaments.sql
add_courts_table.sql
add_courts_per_day.sql
add_player_management.sql
add_unplanned_matches.sql
add_match_rules.sql
add_soft_delete.sql
add_umpire_no_show.sql
add_late_minutes.sql
add_no_show.sql
add_scoresheet.sql
allow_negative_scores.sql
add_user_profiles.sql
add_tournament_ownership.sql
add_user_management_rpcs.sql
clone_tournament_rpc.sql
commit_schedule_rpc.sql
remove_ap_saints_sat_u13.sql
seed_real.sql
seed_scores.sql
seed_scores_reset.sql
```

Keep them for audit/history until the migration folder is fully cleaned up.
