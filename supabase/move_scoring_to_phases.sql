-- =============================================================================
-- Move scoring assignment to phases
--
-- Phases become the primary owner of scoring_system_id. The legacy
-- age_groups.scoring_system_id column is retained as a fallback while the UI
-- transition completes.
--
-- Safe to re-run.
-- =============================================================================

-- Ensure phases can reference scoring_systems when the scoring feature exists.
do $$
begin
  if to_regclass('public.scoring_systems') is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'phases_scoring_system_id_fkey'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_scoring_system_id_fkey
      foreign key (scoring_system_id)
      references public.scoring_systems(id)
      on delete restrict;
  end if;
end $$;

-- Copy each age group's current scoring assignment to its default phase.
-- This intentionally overwrites the default phase because age_groups is still
-- the only scoring assignment UI at this point in the migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'age_groups'
      and column_name = 'scoring_system_id'
  ) then
    execute 'update public.phases p
      set scoring_system_id = ag.scoring_system_id
      from public.age_groups ag
      where ag.id = p.age_group_id
        and p.slug = ''round-robin''';
  end if;
end $$;

-- During the transition, age-group scoring edits should keep the default
-- phase in sync. Once a dedicated phase editor exists, this trigger can be
-- narrowed or removed so each phase can diverge independently.
create or replace function public.sync_default_phase_scoring_from_age_group()
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

  update public.phases
  set scoring_system_id = scoring_id
  where age_group_id = new.id
    and slug = 'round-robin';

  return new;
end;
$$;

drop trigger if exists age_groups_sync_default_phase_scoring on public.age_groups;
create trigger age_groups_sync_default_phase_scoring
  after insert or update on public.age_groups
  for each row
  execute function public.sync_default_phase_scoring_from_age_group();
