import type { Match, StandingRow, Team } from './types';

// Default netball scoring: win=5, draw=3, loss=0, bonus_loss=1 if losing
// score is strictly greater than 50% of the winning score. Mirrors the
// fallback in the web app's src/lib/standings.ts.
export function calculateStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const stats = new Map<
    string,
    {
      team: Team;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goals_for: number;
      goals_against: number;
      points: number;
    }
  >();

  for (const team of teams) {
    stats.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== 'completed') continue;
    if (!match.home_team_id || !match.away_team_id) continue;
    if (match.home_score === null || match.away_score === null) continue;
    const home = stats.get(match.home_team_id);
    const away = stats.get(match.away_team_id);
    if (!home || !away) continue;

    const hs = match.home_score;
    const as = match.away_score;
    home.played += 1;
    away.played += 1;
    home.goals_for += hs;
    home.goals_against += as;
    away.goals_for += as;
    away.goals_against += hs;

    if (hs === as) {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 3;
      away.points += 3;
    } else if (hs > as) {
      home.won += 1;
      away.lost += 1;
      home.points += 5;
      if (hs > 0 && (as / hs) * 100 > 50) away.points += 1;
    } else {
      away.won += 1;
      home.lost += 1;
      away.points += 5;
      if (as > 0 && (hs / as) * 100 > 50) home.points += 1;
    }
  }

  const rows = Array.from(stats.values())
    .map((s) => ({
      ...s,
      goal_difference: s.goals_for - s.goals_against,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team.name.localeCompare(b.team.name);
    });

  return rows.map((row, i) => ({
    position: i + 1,
    team: row.team,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goals_for: row.goals_for,
    goals_against: row.goals_against,
    goal_difference: row.goal_difference,
    points: row.points,
  }));
}
