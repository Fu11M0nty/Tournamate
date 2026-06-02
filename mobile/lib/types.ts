export interface Tournament {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue_name: string | null;
  venue_city: string | null;
  description: string | null;
  is_public: boolean;
  display_order: number | null;
}

export function venueLabel(t: Pick<Tournament, 'venue_name' | 'venue_city'>): string | null {
  const parts = [t.venue_name, t.venue_city].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export type Day = 'saturday' | 'sunday';

export interface Division {
  id: string;
  tournament_id: string;
  name: string;
  slug: string;
  day: Day;
  display_order: number;
  gender: string | null;
  skill_level: string | null;
}

export interface Team {
  id: string;
  age_group_id: string;
  name: string;
  short_name: string | null;
  color: string | null;
  logo_url: string | null;
}

export type MatchStatus = 'scheduled' | 'completed' | string;

export interface Match {
  id: string;
  age_group_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  court: string | null;
  kickoff_time: string;
  status: MatchStatus;
  home_no_show: boolean;
  away_no_show: boolean;
  home_late_minutes: number;
  away_late_minutes: number;
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
