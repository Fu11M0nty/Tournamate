-- =============================================================================
-- Storage RLS policies for the `tournament-branding` bucket
--
-- Run this in the Supabase SQL editor AFTER creating the bucket via
-- Studio -> Storage -> New bucket -> name "tournament-branding" -> public.
--
-- Grants:
--   - public read    - public pages and printable scorecards can render logos
--   - authenticated  - organisers can upload / replace / delete branding images
--
-- Safe to re-run (drop-if-exists before each create).
-- =============================================================================

drop policy if exists "tournament_branding_public_read"   on storage.objects;
drop policy if exists "tournament_branding_auth_insert"   on storage.objects;
drop policy if exists "tournament_branding_auth_update"   on storage.objects;
drop policy if exists "tournament_branding_auth_delete"   on storage.objects;

create policy "tournament_branding_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'tournament-branding');

create policy "tournament_branding_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'tournament-branding');

create policy "tournament_branding_auth_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'tournament-branding')
  with check (bucket_id = 'tournament-branding');

create policy "tournament_branding_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'tournament-branding');
