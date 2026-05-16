-- =============================================================================
-- Tournament general settings
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / ON CONFLICT / DO NOTHING throughout.
--
-- Adds:
--   - tournaments.sport_other
--   - tournaments.default_scoring_system_id
--   - tournament_venues for one or more host locations
-- =============================================================================

alter table public.tournaments
  add column if not exists sport_other text,
  add column if not exists default_scoring_system_id uuid;

do $$
begin
  if to_regclass('public.scoring_systems') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'tournaments_default_scoring_system_id_fkey'
        and conrelid = 'public.tournaments'::regclass
    )
  then
    alter table public.tournaments
      add constraint tournaments_default_scoring_system_id_fkey
      foreign key (default_scoring_system_id)
      references public.scoring_systems(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.tournament_venues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  country text,
  notes text,
  display_order int not null default 1,
  created_at timestamptz not null default now(),
  check (display_order > 0)
);

create index if not exists tournament_venues_tournament_id_idx
  on public.tournament_venues(tournament_id);

-- Backfill one normalized venue from the legacy tournament venue columns.
insert into public.tournament_venues (
  tournament_id,
  name,
  city,
  county,
  postcode,
  country,
  display_order
)
select
  t.id,
  t.venue_name,
  t.venue_city,
  t.venue_county,
  t.venue_postcode,
  'United Kingdom',
  1
from public.tournaments t
where t.venue_name is not null
  and not exists (
    select 1
    from public.tournament_venues tv
    where tv.tournament_id = t.id
  );

alter table public.tournament_venues enable row level security;

drop policy if exists "tournament_venues_anon_select" on public.tournament_venues;
drop policy if exists "tournament_venues_auth_select" on public.tournament_venues;
drop policy if exists "tournament_venues_auth_insert" on public.tournament_venues;
drop policy if exists "tournament_venues_auth_update" on public.tournament_venues;
drop policy if exists "tournament_venues_auth_delete" on public.tournament_venues;

create policy "tournament_venues_anon_select"
  on public.tournament_venues for select to anon
  using (true);

create policy "tournament_venues_auth_select"
  on public.tournament_venues for select to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_venues.tournament_id
        and (
          t.created_by = auth.uid()
          or public.get_my_role() = 'superadmin'
        )
    )
  );

create policy "tournament_venues_auth_insert"
  on public.tournament_venues for insert to authenticated
  with check (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_venues.tournament_id
        and (
          t.created_by = auth.uid()
          or public.get_my_role() = 'superadmin'
        )
    )
  );

create policy "tournament_venues_auth_update"
  on public.tournament_venues for update to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_venues.tournament_id
        and (
          t.created_by = auth.uid()
          or public.get_my_role() = 'superadmin'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_venues.tournament_id
        and (
          t.created_by = auth.uid()
          or public.get_my_role() = 'superadmin'
        )
    )
  );

create policy "tournament_venues_auth_delete"
  on public.tournament_venues for delete to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      where t.id = tournament_venues.tournament_id
        and (
          t.created_by = auth.uid()
          or public.get_my_role() = 'superadmin'
        )
    )
  );

-- Verification:
-- select column_name from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'tournaments'
--   and column_name in ('sport_other', 'default_scoring_system_id');
--
-- select to_regclass('public.tournament_venues');
