import type { Match, ScoringSystem, StandingRow, Team } from './types'

export type ForfeitReason = 'no_show' | 'late'

export function forfeitSide(match: Match): {
  side: 'home' | 'away' | null
  reason: ForfeitReason | null
} {
  if (match.home_no_show) return { side: 'home', reason: 'no_show' }
  if (match.away_no_show) return { side: 'away', reason: 'no_show' }
  if (match.home_late_minutes >= 4) return { side: 'home', reason: 'late' }
  if (match.away_late_minutes >= 4) return { side: 'away', reason: 'late' }
  return { side: null, reason: null }
}

export function pointsForMatch(
  homeScore: number,
  awayScore: number,
  scoringSystem: ScoringSystem
): { home: number; away: number } {
  if (homeScore === awayScore) {
    return { home: scoringSystem.draw_pts, away: scoringSystem.draw_pts }
  }

  const homeWon = homeScore > awayScore
  const winnerScore = homeWon ? homeScore : awayScore
  const loserScore = homeWon ? awayScore : homeScore

  let loserBonus = 0
  if (scoringSystem.bonus_loss_threshold_type === 'percentage') {
    const threshold = scoringSystem.bonus_loss_threshold_value || 50
    if (winnerScore > 0 && (loserScore / winnerScore) * 100 > threshold) {
      loserBonus = scoringSystem.bonus_loss_pts
    }
  } else if (scoringSystem.bonus_loss_threshold_type === 'goals') {
    const threshold = scoringSystem.bonus_loss_threshold_value || 0
    if (winnerScore - loserScore <= threshold) {
      loserBonus = scoringSystem.bonus_loss_pts
    }
  }

  return homeWon
    ? { home: scoringSystem.win_pts, away: scoringSystem.loss_pts + loserBonus }
    : { home: scoringSystem.loss_pts + loserBonus, away: scoringSystem.win_pts }
}

export function calculateStandings(
  teams: Team[],
  matches: Match[],
  scoringSystem?: ScoringSystem
): StandingRow[] {
  // Fallback to standard Netball logic if no system is provided
  const sys: ScoringSystem = scoringSystem || {
    id: 'default', name: 'Fallback System', sport_type: 'Netball',
    win_pts: 5, draw_pts: 3, loss_pts: 0, ot_win_pts: null, so_win_pts: null,
    bonus_loss_pts: 1, bonus_loss_threshold_type: 'percentage', bonus_loss_threshold_value: 50, bonus_offense_pts: 0, bonus_offense_threshold: null,
    forfeit_win_pts: 5, forfeit_loss_pts: 0, forfeit_win_score_for: 5, forfeit_win_score_against: 0,
    tie_breaker_config: ['head_to_head', 'goal_difference', 'goals_for'], created_at: new Date().toISOString()
  }

  const stats = new Map<
    string,
    {
      team: Team
      played: number
      won: number
      drawn: number
      lost: number
      goals_for: number
      goals_against: number
      points: number
    }
  >()

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
    })
  }

  for (const match of matches) {
    if (match.status !== 'completed') continue
    if (!match.home_team_id || !match.away_team_id) continue
    if (match.home_score === null || match.away_score === null) continue

    const home = stats.get(match.home_team_id)
    const away = stats.get(match.away_team_id)
    if (!home || !away) continue

    const { side: forfeitedSide } = forfeitSide(match)
    let adjustedHome = match.home_score
    let adjustedAway = match.away_score
    let pts = { home: 0, away: 0 }

    if (forfeitedSide === 'home') {
      adjustedHome = sys.forfeit_win_score_against
      adjustedAway = sys.forfeit_win_score_for
      pts = { home: sys.forfeit_loss_pts, away: sys.forfeit_win_pts }
    } else if (forfeitedSide === 'away') {
      adjustedHome = sys.forfeit_win_score_for
      adjustedAway = sys.forfeit_win_score_against
      pts = { home: sys.forfeit_win_pts, away: sys.forfeit_loss_pts }
    } else {
      if (sys.sport_type === 'Netball') {
        adjustedHome -= 2 * match.home_late_minutes
        adjustedAway -= 2 * match.away_late_minutes
      }
      pts = pointsForMatch(adjustedHome, adjustedAway, sys)
    }

    home.played += 1
    away.played += 1
    home.goals_for += adjustedHome
    home.goals_against += adjustedAway
    away.goals_for += adjustedAway
    away.goals_against += adjustedHome

    home.points += pts.home
    away.points += pts.away

    if (adjustedHome === adjustedAway) {
      home.drawn += 1
      away.drawn += 1
    } else if (adjustedHome > adjustedAway) {
      home.won += 1
      away.lost += 1
    } else {
      away.won += 1
      home.lost += 1
    }
  }

  for (const match of matches) {
    if (!match.home_team_id || !match.away_team_id) continue
    const home = stats.get(match.home_team_id)
    const away = stats.get(match.away_team_id)
    if (home && match.home_umpire_no_show) home.points -= 1
    if (away && match.away_umpire_no_show) away.points -= 1
  }

  const rows = Array.from(stats.values()).map((s) => {
    const goal_difference = s.goals_for - s.goals_against
    return {
      team: s.team,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      goal_difference,
      points: s.points,
    }
  })

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points

    for (const rule of sys.tie_breaker_config) {
      if (rule === 'goal_difference' && b.goal_difference !== a.goal_difference) {
        return b.goal_difference - a.goal_difference
      }
      if (rule === 'goals_for' && b.goals_for !== a.goals_for) {
        return b.goals_for - a.goals_for
      }
      if (rule === 'goals_against' && a.goals_against !== b.goals_against) {
        return a.goals_against - b.goals_against // Lower is better
      }
      if (rule === 'wins' && b.won !== a.won) {
        return b.won - a.won
      }

      const isH2hRule = rule.startsWith('head_to_head')
      if (isH2hRule) {
        const h2hMatches = matches.filter(
          m => m.status === 'completed' &&
          m.home_team_id !== null &&
          m.away_team_id !== null &&
          ((m.home_team_id === a.team.id && m.away_team_id === b.team.id) ||
           (m.home_team_id === b.team.id && m.away_team_id === a.team.id))
        )
        if (h2hMatches.length > 0) {
          let aPts = 0
          let bPts = 0
          let aGd = 0
          let bGd = 0
          let aGf = 0
          let bGf = 0

          for (const m of h2hMatches) {
             let aScore = 0
             let bScore = 0

             if (m.home_team_id === a.team.id) {
                 aScore = m.home_score || 0
                 bScore = m.away_score || 0
             } else {
                 aScore = m.away_score || 0
                 bScore = m.home_score || 0
             }

             const matchPts = pointsForMatch(aScore, bScore, sys)
             aPts += matchPts.home
             bPts += matchPts.away
             aGd += (aScore - bScore)
             bGd += (bScore - aScore)
             aGf += aScore
             bGf += bScore
          }

          if (rule === 'head_to_head' && aPts !== bPts) return bPts - aPts
          if (rule === 'head_to_head_goal_difference' && aGd !== bGd) return bGd - aGd
          if (rule === 'head_to_head_goals_for' && aGf !== bGf) return bGf - aGf
        }
      }
    }

    return a.team.name.localeCompare(b.team.name)
  })

  return rows.map((row, i) => ({ position: i + 1, ...row }))
}
