-- =============================================================================
-- Placeholder matches for unresolved phase slots
--
-- Allows future-phase fixtures to be created and scheduled before teams are
-- known. Once progression resolves slots, matches are updated with real teams.
-- =============================================================================

alter table public.matches
  add column if not exists home_slot_id uuid references public.element_slots(id) on delete set null,
  add column if not exists away_slot_id uuid references public.element_slots(id) on delete set null;

alter table public.matches
  alter column home_team_id drop not null,
  alter column away_team_id drop not null;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.matches'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%home_team_id%'
    and pg_get_constraintdef(oid) ilike '%away_team_id%'
    and pg_get_constraintdef(oid) ilike '%<>%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.matches drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.matches
  drop constraint if exists matches_team_or_slot_check,
  add constraint matches_team_or_slot_check
  check (
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
  );

create index if not exists matches_home_slot_id_idx
  on public.matches(home_slot_id)
  where home_slot_id is not null;

create index if not exists matches_away_slot_id_idx
  on public.matches(away_slot_id)
  where away_slot_id is not null;
