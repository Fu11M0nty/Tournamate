-- Universal Scoring Systems Database Schema
--
-- Safe to re-run.

create table if not exists public.scoring_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport_type text not null,
  
  -- Standard Match Points
  win_pts int not null default 3,
  draw_pts int not null default 1,
  loss_pts int not null default 0,
  ot_win_pts int,
  so_win_pts int,
  
  -- Bonus Point Logic
  bonus_loss_pts int default 0,
  bonus_loss_threshold_type text, -- e.g., 'percentage', 'goals'
  bonus_loss_threshold_value numeric,
  bonus_offense_pts int default 0,
  bonus_offense_threshold numeric,
  
  -- Forfeit Logic
  forfeit_win_pts int not null default 3,
  forfeit_loss_pts int not null default 0,
  forfeit_win_score_for int not null default 3,
  forfeit_win_score_against int not null default 0,
  
  -- Tie-Breaker Hierarchy (Stored as JSON array)
  tie_breaker_config jsonb not null default '["head_to_head", "goal_difference", "goals_for"]'::jsonb,
  
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.scoring_systems enable row level security;

drop policy if exists "Scoring systems are viewable by everyone" on public.scoring_systems;
drop policy if exists "Scoring systems can be managed by authenticated users" on public.scoring_systems;

create policy "Scoring systems are viewable by everyone" on public.scoring_systems for select using (true);
create policy "Scoring systems can be managed by authenticated users" on public.scoring_systems for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Link the new scoring_systems table to the existing age_groups table
alter table public.age_groups
  add column if not exists scoring_system_id uuid references public.scoring_systems(id) on delete restrict;
