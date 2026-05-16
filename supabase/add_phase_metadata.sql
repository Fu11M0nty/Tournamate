-- Store format-specific phase settings such as league repeat count.
-- Safe to run repeatedly.

alter table public.phases
  add column if not exists metadata jsonb not null default '{}'::jsonb;

