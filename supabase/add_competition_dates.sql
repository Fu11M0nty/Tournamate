-- =============================================================================
-- Competition dates / sessions
--
-- Introduces a schedule/session layer without removing the legacy
-- age_groups.day or courts.day columns. Existing Saturday/Sunday tournaments
-- continue to work while matches can start being linked to real event dates.
--
-- Safe to re-run: all schema changes are guarded and data backfills use
-- ON CONFLICT / WHERE conditions.
-- =============================================================================

create table if not exists public.competition_dates (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
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

create index if not exists competition_dates_tournament_id_idx
  on public.competition_dates(tournament_id);

create index if not exists competition_dates_legacy_day_idx
  on public.competition_dates(tournament_id, legacy_day)
  where legacy_day is not null;

alter table public.matches
  add column if not exists competition_date_id uuid
  references public.competition_dates(id) on delete set null;

create index if not exists matches_competition_date_id_idx
  on public.matches(competition_date_id);

-- Backfill legacy Saturday/Sunday sessions only for days that have groups.
insert into public.competition_dates (
  tournament_id,
  slug,
  label,
  date,
  display_order,
  legacy_day
)
select
  t.id,
  d.legacy_day,
  d.label,
  case
    when d.legacy_day = 'saturday' then t.start_date
    else coalesce(t.end_date, t.start_date)
  end,
  d.display_order,
  d.legacy_day
from public.tournaments t
join (
  values
    ('saturday'::text, 'Saturday'::text, 1),
    ('sunday'::text, 'Sunday'::text, 2)
) as d(legacy_day, label, display_order)
  on exists (
    select 1
    from public.age_groups ag
    where ag.tournament_id = t.id
      and ag.day = d.legacy_day
  )
on conflict (tournament_id, slug) do update
set
  label = excluded.label,
  date = coalesce(public.competition_dates.date, excluded.date),
  display_order = excluded.display_order,
  legacy_day = excluded.legacy_day;

-- Link existing matches using their age group's legacy day.
update public.matches m
set competition_date_id = cd.id
from public.age_groups ag
join public.competition_dates cd
  on cd.tournament_id = ag.tournament_id
 and cd.legacy_day = ag.day
where m.age_group_id = ag.id
  and m.competition_date_id is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.competition_dates enable row level security;

drop policy if exists "competition_dates_anon_select" on public.competition_dates;
drop policy if exists "competition_dates_auth_select" on public.competition_dates;
drop policy if exists "competition_dates_auth_insert" on public.competition_dates;
drop policy if exists "competition_dates_auth_update" on public.competition_dates;
drop policy if exists "competition_dates_auth_delete" on public.competition_dates;

create policy "competition_dates_anon_select"
  on public.competition_dates for select to anon using (true);

create policy "competition_dates_auth_select"
  on public.competition_dates for select to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "competition_dates_auth_insert"
  on public.competition_dates for insert to authenticated
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "competition_dates_auth_update"
  on public.competition_dates for update to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ))
  with check (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));

create policy "competition_dates_auth_delete"
  on public.competition_dates for delete to authenticated
  using (tournament_id in (
    select id from public.tournaments
    where created_by = auth.uid() or public.get_my_role() = 'superadmin'
  ));
