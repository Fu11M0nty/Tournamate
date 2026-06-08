-- Stop new divisions from automatically receiving a Round Robin phase.
-- Existing divisions and their phases are left untouched; the admin format
-- builder now removes obsolete empty phases when a new structure is applied.

drop trigger if exists age_groups_ensure_default_phase on public.age_groups;

comment on function public.ensure_default_phase_for_age_group() is
  'Legacy helper retained for existing databases. The age_groups trigger is disabled so new divisions start with zero phases.';
