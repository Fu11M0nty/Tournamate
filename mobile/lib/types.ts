// Tournamate mobile types — mirrors the public-read shapes used by the web app
// (see src/lib/types.ts on preview). Only the slice the mobile spectator app needs.

export type Day = 'saturday' | 'sunday';

export type TournamentStatus = 'upcoming' | 'live' | 'complete';

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
  display_order: number;
  courts: string[];
  schedule_locked: boolean;
  sport?: string | null;
  sport_other?: string | null;
  default_scoring_system_id?: string | null;
  venue_name?: string | null;
  venue_city?: string | null;
  venue_county?: string | null;
  venue_postcode?: string | null;
  description?: string | null;
  is_public?: boolean;
}

export function venueLabel(t: Pick<Tournament, 'venue_name' | 'venue_city'>): string | null {
  const parts = [t.venue_name, t.venue_city].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export type MatchFormat = 'continuous' | 'halves' | 'quarters';
export type PhaseType = 'round_robin' | 'group_stage' | 'knockout' | 'league' | 'friendly';
export type StandingsMode = 'visible' | 'hidden' | 'none';
export type PhaseElementType =
  | 'group'
  | 'bracket'
  | 'single_match'
  | 'heat'
  | 'league_table'
  | 'ladder'
  | 'swiss_round';
export type ElementSlotType = 'team' | 'source' | 'bye' | 'placeholder' | 'manual';
export type SlotSourceOutcome = 'winner' | 'loser' | 'rank' | 'best_rank' | 'manual';

export interface ScoringSystem {
  id: string;
  name: string;
  sport_type: string;
  win_pts: number;
  draw_pts: number;
  loss_pts: number;
  ot_win_pts: number | null;
  so_win_pts: number | null;
  bonus_loss_pts: number;
  bonus_loss_threshold_type: 'percentage' | 'goals' | null;
  bonus_loss_threshold_value: number | null;
  bonus_offense_pts: number;
  bonus_offense_threshold: number | null;
  forfeit_win_pts: number;
  forfeit_loss_pts: number;
  forfeit_win_score_for: number;
  forfeit_win_score_against: number;
  tie_breaker_config: string[];
  created_at: string;
}

export interface Division {
  id: string;
  tournament_id: string;
  name: string;
  slug: string;
  day: Day;
  display_order: number;
  gender: string | null;
  skill_level: string | null;
  match_format: MatchFormat;
  scoring_system_id: string | null;
  scoring_system?: ScoringSystem;
  phases?: Phase[];
}

export interface Phase {
  id: string;
  age_group_id: string;
  slug: string;
  name: string;
  phase_type: PhaseType;
  display_order: number;
  standings_mode: StandingsMode;
  scoring_system_id: string | null;
  scoring_system?: ScoringSystem;
  pools?: Pool[];
  phase_elements?: PhaseElement[];
}

export interface Pool {
  id: string;
  phase_id: string;
  slug: string;
  name: string;
  display_order: number;
  is_default: boolean;
  pool_teams?: PoolTeam[];
}

export interface PoolTeam {
  pool_id: string;
  team_id: string;
  display_order: number;
}

export interface PhaseElement {
  id: string;
  phase_id: string;
  pool_id: string | null;
  slug: string;
  name: string;
  element_type: PhaseElementType;
  display_order: number;
  slots?: ElementSlot[];
}

export interface ElementSlot {
  id: string;
  phase_element_id: string;
  display_order: number;
  label: string | null;
  slot_type: ElementSlotType;
  team_id: string | null;
  source_phase_id: string | null;
  source_element_id: string | null;
  source_pool_id: string | null;
  source_match_id: string | null;
  source_rank: number | null;
  source_outcome: SlotSourceOutcome | null;
}

export interface Team {
  id: string;
  name: string;
  short_name: string | null;
  color: string | null;
  logo_url: string | null;
  age_group_id: string;
  deleted_at: string | null;
}

export type MatchStatus = 'scheduled' | 'completed';

export interface Match {
  id: string;
  age_group_id: string;
  phase_id: string | null;
  pool_id: string | null;
  phase_element_id: string | null;
  competition_date_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_slot_id: string | null;
  away_slot_id: string | null;
  home_score: number | null;
  away_score: number | null;
  court: string | null;
  kickoff_time: string;
  status: MatchStatus;
  home_umpire_no_show: boolean;
  away_umpire_no_show: boolean;
  home_late_minutes: number;
  away_late_minutes: number;
  home_no_show: boolean;
  away_no_show: boolean;
  duration_minutes: number;
  is_planned: boolean;
  deleted_at: string | null;
  round_number: number | null;
}

export interface StandingRow {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export type UmpireRole = 'head' | 'assistant' | 'scorer' | 'assessor';

export interface Club {
  id: string;
  name: string;
}

export interface Umpire {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  qualification_level: string | null;
  primary_club_id: string | null;
  primary_club?: Club;
  bio: string | null;
}

export interface UmpireAssignment {
  id: string;
  match_id: string;
  umpire_id: string;
  role: UmpireRole;
  umpire?: Umpire;
}
