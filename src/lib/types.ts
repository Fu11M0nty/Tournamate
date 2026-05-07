export type Day = 'saturday' | 'sunday'

export type UserRole = 'superadmin' | 'tournament_admin'

export interface UserProfile {
  id: string
  role: UserRole
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
  venue_name?: string | null
  venue_city?: string | null
  venue_county?: string | null
  venue_postcode?: string | null
  description?: string | null
  is_public?: boolean
}

export type MatchFormat = 'continuous' | 'halves' | 'quarters'

export interface AgeGroup {
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

export interface Match {
  id: string
  age_group_id: string
  home_team_id: string
  away_team_id: string
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
