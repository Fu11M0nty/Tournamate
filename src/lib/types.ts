export type Day = 'saturday' | 'sunday'

export type UserRole = 'superadmin' | 'tournament_admin'

export interface UserProfile {
  id: string
  role: UserRole
  is_approved: boolean
  created_at: string
}

export type TournamentStatus = 'upcoming' | 'live' | 'complete'

export const SPORTS = [
  'Netball',
  'Football',
  'Basketball',
  'Hockey (Field)',
  'Rugby Union',
  'Rugby League',
  'Cricket',
  'Volleyball',
  'Tennis',
  'Badminton',
  'Swimming',
  'Athletics',
  'Tag Rugby',
  'Futsal',
  'Other',
] as const

export type Sport = typeof SPORTS[number]

export interface Tournament {
  id: string
  slug: string
  name: string
  start_date: string | null
  end_date: string | null
  status: TournamentStatus
  display_order: number
  courts: string[]
  schedule_locked: boolean
  created_by: string
  // TournaMate fields — added by add_tournamate_fields.sql migration
  sport?: string | null
  sport_other?: string | null
  default_scoring_system_id?: string | null
  venue_name?: string | null
  venue_city?: string | null
  venue_county?: string | null
  venue_postcode?: string | null
  description?: string | null
  is_public?: boolean
}

export interface TournamentVenue {
  id: string
  tournament_id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  country: string | null
  notes: string | null
  display_order: number
  created_at: string
}

export interface CompetitionDate {
  id: string
  tournament_id: string
  slug: string
  label: string
  date: string | null
  display_order: number
  legacy_day: Day | null
  created_at: string
}

export type MatchFormat = 'continuous' | 'halves' | 'quarters'
export type PhaseType = 'round_robin' | 'group_stage' | 'knockout' | 'league' | 'friendly'
export type StandingsMode = 'visible' | 'hidden' | 'none'
export type PhaseElementType = 'group' | 'bracket' | 'single_match' | 'heat' | 'league_table' | 'ladder' | 'swiss_round'
export type ElementSlotType = 'team' | 'source' | 'bye' | 'placeholder' | 'manual'
export type SlotSourceOutcome = 'winner' | 'loser' | 'rank' | 'best_rank' | 'manual'
export type ProgressionSourceType = 'standings_rank' | 'match_winner' | 'match_loser' | 'best_rank' | 'manual'

export interface ScoringSystem {
  id: string
  name: string
  sport_type: string

  // Standard Match Points
  win_pts: number
  draw_pts: number
  loss_pts: number
  ot_win_pts: number | null
  so_win_pts: number | null

  // Bonus Point Logic
  bonus_loss_pts: number
  bonus_loss_threshold_type: 'percentage' | 'goals' | null
  bonus_loss_threshold_value: number | null
  bonus_offense_pts: number
  bonus_offense_threshold: number | null

  // Forfeit Logic
  forfeit_win_pts: number
  forfeit_loss_pts: number
  forfeit_win_score_for: number
  forfeit_win_score_against: number

  // Tie-Breaker Hierarchy
  tie_breaker_config: string[]

  created_at: string
}

export interface Division {
  id: string
  tournament_id: string
  name: string
  slug: string
  day: Day
  display_order: number
  gender: string | null
  skill_level: string | null
  match_format: MatchFormat
  period_minutes: number
  break_q1_q2_minutes: number
  break_half_time_minutes: number
  break_q3_q4_minutes: number
  scoring_system_id: string | null
  scoring_system?: ScoringSystem
  phases?: Phase[]
}

// Compatibility alias while the database still uses age_groups/age_group_id.
export type AgeGroup = Division

export interface Phase {
  id: string
  age_group_id: string
  slug: string
  name: string
  phase_type: PhaseType
  display_order: number
  standings_mode: StandingsMode
  scoring_system_id: string | null
  scoring_system?: ScoringSystem
  match_format: MatchFormat
  period_minutes: number
  break_q1_q2_minutes: number
  break_half_time_minutes: number
  break_q3_q4_minutes: number
  metadata: Record<string, unknown>
  created_at: string
  pools?: Pool[]
  phase_elements?: PhaseElement[]
}

export interface Pool {
  id: string
  phase_id: string
  slug: string
  name: string
  display_order: number
  is_default: boolean
  created_at: string
  pool_teams?: PoolTeam[]
  phase_element?: PhaseElement
}

export interface PhaseElement {
  id: string
  phase_id: string
  pool_id: string | null
  slug: string
  name: string
  element_type: PhaseElementType
  display_order: number
  metadata: Record<string, unknown>
  created_at: string
  slots?: ElementSlot[]
}

export interface ElementSlot {
  id: string
  phase_element_id: string
  display_order: number
  label: string | null
  slot_type: ElementSlotType
  team_id: string | null
  source_phase_id: string | null
  source_element_id: string | null
  source_pool_id: string | null
  source_match_id: string | null
  source_rank: number | null
  source_outcome: SlotSourceOutcome | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProgressionRule {
  id: string
  from_phase_id: string | null
  from_element_id: string | null
  from_pool_id: string | null
  from_match_id: string | null
  source_type: ProgressionSourceType
  source_rank: number | null
  to_phase_id: string | null
  to_element_id: string
  to_slot_id: string | null
  to_slot_order: number | null
  display_order: number
  rule_config: Record<string, unknown>
  created_at: string
}

export interface PoolTeam {
  pool_id: string
  team_id: string
  display_order: number
  created_at: string
}

export interface Court {
  id: string
  tournament_id: string
  name: string
  day: Day
  display_order: number
  start_time: string
  end_time: string
}

export interface Player {
  id: string
  team_id: string
  name: string
  dob: string | null
  registration_no: string | null
  notes: string | null
  display_order: number
}

export interface ScheduleEvent {
  id: string
  tournament_id: string
  name: string
  start_time: string
  end_time: string
  court: string | null
  color: string | null
  notes: string | null
}

export interface Team {
  id: string
  name: string
  short_name: string | null
  color: string | null
  logo_url: string | null
  age_group_id: string
  deleted_at: string | null
}

export type MatchStatus = 'scheduled' | 'completed'

export type UmpireRole = 'head' | 'assistant' | 'scorer' | 'assessor'
export type PayoutStatus = 'pending' | 'paid' | 'cancelled'

export interface Club {
  id: string
  name: string
  created_at: string
}

export interface Umpire {
  id: string
  name: string
  email: string | null
  phone: string | null
  qualification_level: string | null
  primary_club_id: string | null
  primary_club?: Club
  bio: string | null
  created_at: string
}

export interface UmpireAssignment {
  id: string
  match_id: string
  umpire_id: string
  role: UmpireRole
  umpire?: Umpire
  created_at: string
}

export interface UmpirePayout {
  id: string
  umpire_id: string
  tournament_id: string
  match_id: string | null
  amount: number
  status: PayoutStatus
  created_at: string
}

export interface Match {
  id: string
  age_group_id: string
  phase_id: string | null
  pool_id: string | null
  phase_element_id: string | null
  competition_date_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_slot_id: string | null
  away_slot_id: string | null
  home_score: number | null
  away_score: number | null
  court: string | null
  kickoff_time: string
  status: MatchStatus
  home_umpire_no_show: boolean
  away_umpire_no_show: boolean
  home_late_minutes: number
  away_late_minutes: number
  home_no_show: boolean
  away_no_show: boolean
  scoresheet_url: string | null
  duration_minutes: number
  is_planned: boolean
  deleted_at: string | null
  round_number: number | null
  umpire_assignments?: UmpireAssignment[]
}

export interface StandingRow {
  position: number
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}
