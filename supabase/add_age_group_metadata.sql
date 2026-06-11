-- Store division (age_groups) metadata such as QA seed markers and
-- format-scenario tags. Present in schema.sql but previously missing from the
-- additive migration set, so databases built from migrations lacked it.
-- Safe to run repeatedly.

alter table public.age_groups
  add column if not exists metadata jsonb not null default '{}'::jsonb;
