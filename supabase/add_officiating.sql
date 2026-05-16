-- =============================================================================
-- Phase 1: Advanced Officiating Ecosystem - Foundation
--
-- Adds:
--   • clubs table (global registry for umpire affiliations)
--   • umpires table (global registry with qualifications, club, and bio)
--   • tournament_umpires table (association with tournaments)
--   • umpire_assignments table (supports multiple roles per match)
--   • umpire_payouts table (tracks match fees and payment status)
--   • RLS policies
-- =============================================================================

-- 1. Clubs Registry (For Umpire Affiliations) -------------------------------

create table if not exists clubs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now()
);

-- 2. Umpires Registry -------------------------------------------------------

create table if not exists umpires (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text,
  phone               text,
  qualification_level text,
  primary_club_id     uuid references clubs(id) on delete set null,
  bio                 text,
  created_at          timestamptz not null default now()
);

create index if not exists umpires_primary_club_id_idx on umpires(primary_club_id);

-- 3. Tournament-Umpire Association ------------------------------------------

create table if not exists tournament_umpires (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  umpire_id     uuid not null references umpires(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, umpire_id)
);

create index if not exists tournament_umpires_tournament_id_idx on tournament_umpires(tournament_id);
create index if not exists tournament_umpires_umpire_id_idx on tournament_umpires(umpire_id);

-- 4. Umpire Assignments -----------------------------------------------------

create table if not exists umpire_assignments (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  umpire_id     uuid not null references umpires(id) on delete cascade,
  role          text not null check (role in ('head', 'assistant', 'scorer', 'assessor')),
  created_at    timestamptz not null default now(),
  unique (match_id, umpire_id, role)
);

create index if not exists umpire_assignments_match_id_idx on umpire_assignments(match_id);
create index if not exists umpire_assignments_umpire_id_idx on umpire_assignments(umpire_id);

-- 5. Umpire Payouts ---------------------------------------------------------

create table if not exists umpire_payouts (
  id            uuid primary key default gen_random_uuid(),
  umpire_id     uuid not null references umpires(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id      uuid references matches(id) on delete set null,
  amount        numeric(10,2) not null default 0.00,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at    timestamptz not null default now()
);

create index if not exists umpire_payouts_umpire_id_idx on umpire_payouts(umpire_id);
create index if not exists umpire_payouts_tournament_id_idx on umpire_payouts(tournament_id);

-- 6. Row Level Security (RLS) -----------------------------------------------

alter table clubs              enable row level security;
alter table umpires            enable row level security;
alter table tournament_umpires enable row level security;
alter table umpire_assignments enable row level security;
alter table umpire_payouts     enable row level security;

-- Clubs RLS
create policy "clubs_public_select" on clubs for select to public using (true);
create policy "clubs_auth_insert"   on clubs for insert to authenticated with check (true);
create policy "clubs_auth_update"   on clubs for update to authenticated using (true) with check (true);
create policy "clubs_auth_delete"   on clubs for delete to authenticated using (true);

-- Umpires RLS
create policy "umpires_public_select" on umpires for select to public using (true);
create policy "umpires_auth_insert"   on umpires for insert to authenticated with check (true);
create policy "umpires_auth_update"   on umpires for update to authenticated using (true) with check (true);
create policy "umpires_auth_delete"   on umpires for delete to authenticated using (true);

-- Tournament Umpires RLS
create policy "tournament_umpires_public_select" on tournament_umpires for select to public using (true);
create policy "tournament_umpires_auth_insert"   on tournament_umpires for insert to authenticated with check (true);
create policy "tournament_umpires_auth_update"   on tournament_umpires for update to authenticated using (true) with check (true);
create policy "tournament_umpires_auth_delete"   on tournament_umpires for delete to authenticated using (true);

-- Umpire Assignments RLS
create policy "umpire_assignments_public_select" on umpire_assignments for select to public using (true);
create policy "umpire_assignments_auth_insert"   on umpire_assignments for insert to authenticated with check (true);
create policy "umpire_assignments_auth_update"   on umpire_assignments for update to authenticated using (true) with check (true);
create policy "umpire_assignments_auth_delete"   on umpire_assignments for delete to authenticated using (true);

-- Umpire Payouts RLS
create policy "umpire_payouts_auth_select" on umpire_payouts for select to authenticated using (true);
create policy "umpire_payouts_auth_insert" on umpire_payouts for insert to authenticated with check (true);
create policy "umpire_payouts_auth_update" on umpire_payouts for update to authenticated using (true) with check (true);
create policy "umpire_payouts_auth_delete" on umpire_payouts for delete to authenticated using (true);
