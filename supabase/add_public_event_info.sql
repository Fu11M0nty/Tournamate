-- =============================================================================
-- Public event info fields — tournaments
--
-- Adds organiser-editable, publicly visible event-day information so the
-- public tournament hub can act as the event's single source of truth:
-- parking, arrival instructions, venue/facilities notes, organiser contact,
-- an emergency contact, and a public notice banner.
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS throughout. No RLS changes needed —
-- the existing public SELECT policy on tournaments covers the new columns.
--
-- Run this in the Supabase SQL Editor (or via migration tooling) before
-- deploying the public event info feature.
-- =============================================================================

alter table public.tournaments
  add column if not exists organiser_contact_name  text,
  add column if not exists organiser_contact_email text,
  add column if not exists organiser_contact_phone text,
  add column if not exists venue_notes             text,
  add column if not exists parking_notes           text,
  add column if not exists arrival_instructions    text,
  add column if not exists facilities_notes        text,
  add column if not exists emergency_contact       text,
  add column if not exists public_notice           text;

-- =============================================================================
-- VERIFICATION
--
--   select column_name from information_schema.columns
--   where table_name = 'tournaments'
--   and column_name in (
--     'organiser_contact_name','organiser_contact_email','organiser_contact_phone',
--     'venue_notes','parking_notes','arrival_instructions',
--     'facilities_notes','emergency_contact','public_notice'
--   );
--   → must return 9 rows
-- =============================================================================
