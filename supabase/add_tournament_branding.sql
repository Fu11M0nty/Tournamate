-- =============================================================================
-- Tournament branding fields
--
-- Adds organiser-editable branding for public tournament pages and printable
-- scorecards: tournament logo URL, primary accent colour, and optional sponsor
-- name/logo/link.
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS and an idempotent constraint block.
-- No table RLS changes are needed: existing tournament policies cover these
-- columns, and public SELECT continues to expose public tournament metadata.
-- =============================================================================

alter table public.tournaments
  add column if not exists logo_url            text,
  add column if not exists brand_primary_color text,
  add column if not exists sponsor_name        text,
  add column if not exists sponsor_logo_url    text,
  add column if not exists sponsor_url         text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_brand_primary_color_hex'
  ) then
    alter table public.tournaments
      add constraint tournaments_brand_primary_color_hex
      check (brand_primary_color is null or brand_primary_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- =============================================================================
-- VERIFICATION
--
--   select column_name from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'tournaments'
--     and column_name in (
--       'logo_url','brand_primary_color','sponsor_name',
--       'sponsor_logo_url','sponsor_url'
--     );
--   -> must return 5 rows
-- =============================================================================
