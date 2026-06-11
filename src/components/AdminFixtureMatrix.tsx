'use client'

import { useMemo } from 'react'
import TeamLogo from '@/components/TeamLogo'
import { findDuplicateMatchIds } from '@/lib/matches'
import { forfeitSide, pointsForMatch } from '@/lib/standings'
import { formatKickoffTime } from '@/lib/time'
import type { Match, ScoringSystem, Team } from '@/lib/types'

interface AdminFixtureMatrixProps {
  teams: Team[]
  matches: Match[]
  dayMatches?: Match[]
}

const BACK_TO_BACK_THRESHOLD_MS = 20 * 60 * 1000

const DEFAULT_MATRIX_SCORING: ScoringSystem = {
  id: 'default',
  name: 'Fallback System',
  sport_type: 'Netball',
  win_pts: 5,
  draw_pts: 3,
  loss_pts: 0,
  ot_win_pts: null,
  so_win_pts: null,
  bonus_loss_pts: 1,
  bonus_loss_threshold_type: 'percentage',
  bonus_loss_threshold_value: 50,
  bonus_offense_pts: 0,
  bonus_offense_threshold: null,
  forfeit_win_pts: 5,
  forfeit_loss_pts: 0,
  forfeit_win_score_for: 5,
  forfeit_win_score_against: 0,
  tie_breaker_config: ['head_to_head', 'goal_difference', 'goals_for'],
  created_at: '',
}

function formatKickoff(iso: string): string {
  return formatKickoffTime(iso)
}

export default function AdminFixtureMatrix({
  teams,
  matches,
  dayMatches,
}: AdminFixtureMatrixProps) {
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  const matchesByPair = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of matches) {
      if (!m.home_team_id || !m.away_team_id) continue
      const key = [m.home_team_id, m.away_team_id].sort().join('|')
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        // Completed fixtures float to the top so the cell picks one of those.
        const aCompleted = a.status === 'completed' ? 0 : 1
        const bCompleted = b.status === 'completed' ? 0 : 1
        if (aCompleted !== bCompleted) return aCompleted - bCompleted
        return (
          new Date(a.kickoff_time).getTime() -
          new Date(b.kickoff_time).getTime()
        )
      })
    }
    return map
  }, [matches])

  const duplicateIds = useMemo(() => findDuplicateMatchIds(matches), [matches])

  const courtConflictIds = useMemo(() => {
    const scope = dayMatches && dayMatches.length > 0 ? dayMatches : matches
    const byCourtTime = new Map<string, string[]>()
    for (const m of scope) {
      if (!m.court) continue
      const key = `${m.court}|${m.kickoff_time}`
      const arr = byCourtTime.get(key) ?? []
      arr.push(m.id)
      byCourtTime.set(key, arr)
    }
    const conflicts = new Set<string>()
    for (const arr of byCourtTime.values()) {
      if (arr.length > 1) arr.forEach((id) => conflicts.add(id))
    }
    return conflicts
  }, [dayMatches, matches])

  const backToBackIds = useMemo(() => {
    const byTeam = new Map<string, Match[]>()
    for (const m of matches) {
      for (const tid of [m.home_team_id, m.away_team_id]) {
        if (!tid) continue
        const arr = byTeam.get(tid) ?? []
        arr.push(m)
        byTeam.set(tid, arr)
      }
    }
    const flagged = new Set<string>()
    for (const list of byTeam.values()) {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.kickoff_time).getTime() -
          new Date(b.kickoff_time).getTime()
      )
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const gap =
          new Date(curr.kickoff_time).getTime() -
          new Date(prev.kickoff_time).getTime()
        if (gap >= 0 && gap < BACK_TO_BACK_THRESHOLD_MS) {
          flagged.add(prev.id)
          flagged.add(curr.id)
        }
      }
    }
    return flagged
  }, [matches])

  if (sortedTeams.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No teams in this division.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 animate-pulse rounded-sm bg-orange-300 ring-1 ring-orange-500 dark:bg-orange-900 dark:ring-orange-600" />
          Missing fixture — pair not scheduled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 animate-pulse rounded-sm bg-fuchsia-300 ring-1 ring-fuchsia-500 dark:bg-fuchsia-900 dark:ring-fuchsia-600" />
          Duplicate fixture — same pair scheduled more than once
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-200 ring-1 ring-red-400 dark:bg-red-900 dark:ring-red-700" />
          Court/time conflict with another fixture
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-200 ring-1 ring-amber-400 dark:bg-amber-900 dark:ring-amber-700" />
          Team scheduled back-to-back (within 20 min)
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[12rem] border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Team
            </th>
            {sortedTeams.map((t) => (
              <th
                key={t.id}
                scope="col"
                title={t.name}
                className="border-b border-zinc-200 px-2 py-2 align-bottom font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
              >
                <div className="flex justify-center">
                  <TeamLogo team={t} size="sm" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTeams.map((row) => (
            <tr key={row.id} className="odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900/30">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-zinc-200 bg-inherit px-3 py-2 text-left font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              >
                <div className="flex items-center gap-2">
                  <TeamLogo team={row} size="sm" />
                  <span>{row.name}</span>
                </div>
              </th>
              {sortedTeams.map((col) => {
                if (row.id === col.id) {
                  return (
                    <td
                      key={col.id}
                      aria-hidden="true"
                      className="border-b border-zinc-200 bg-zinc-100 px-2 py-2 text-center text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-700"
                    >
                      —
                    </td>
                  )
                }
                const key = [row.id, col.id].sort().join('|')
                const pairMatches = matchesByPair.get(key) ?? []
                if (pairMatches.length === 0) {
                  return (
                    <td
                      key={col.id}
                      title={`Missing fixture: ${row.name} vs ${col.name} not scheduled`}
                      className="animate-pulse border-b border-orange-300 bg-orange-100 px-2 py-2 text-center text-orange-900 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-200"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide">Missing</div>
                    </td>
                  )
                }
                const match = pairMatches[0]
                const duplicate = pairMatches.some((m) => duplicateIds.has(m.id))
                const completed = match.status === 'completed'
                const anyCourtClash = pairMatches.some((m) => courtConflictIds.has(m.id))
                const anyBackToBack = pairMatches.some((m) => backToBackIds.has(m.id))
                const baseCell =
                  'relative border-b border-zinc-200 px-2 py-2 text-center align-middle dark:border-zinc-800'
                const colorClass = duplicate
                  ? 'animate-pulse bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-900/70 dark:text-fuchsia-100'
                  : anyCourtClash
                    ? 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200'
                    : anyBackToBack
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'text-zinc-700 dark:text-zinc-300'
                const titleParts = [`${row.name} vs ${col.name}`]

                if (completed) {
                  const rowIsHome = match.home_team_id === row.id
                  const rawRow = (rowIsHome ? match.home_score : match.away_score) ?? 0
                  const rawCol = (rowIsHome ? match.away_score : match.home_score) ?? 0
                  const rowLate = rowIsHome
                    ? match.home_late_minutes
                    : match.away_late_minutes
                  const colLate = rowIsHome
                    ? match.away_late_minutes
                    : match.home_late_minutes
                  const rowUmpireNoShow = rowIsHome
                    ? match.home_umpire_no_show
                    : match.away_umpire_no_show
                  const forfeit = forfeitSide(match)
                  const isForfeit = forfeit.side !== null
                  const adjRow = isForfeit ? rawRow : rawRow - 2 * rowLate
                  const adjCol = isForfeit ? rawCol : rawCol - 2 * colLate
                  // pointsForMatch(home, away) — passing row first means .home === row
                  const base = pointsForMatch(adjRow, adjCol, DEFAULT_MATRIX_SCORING)
                  const rowNetPoints =
                    base.home - (rowUmpireNoShow ? 1 : 0)
                  const pointsTone =
                    rowNetPoints >= 5
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : rowNetPoints > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  const prefix =
                    rowNetPoints > 0 ? '+' : rowNetPoints < 0 ? '−' : ''
                  const rowForfeit =
                    isForfeit && forfeit.side === (rowIsHome ? 'home' : 'away')
                  const colForfeit =
                    isForfeit && forfeit.side === (rowIsHome ? 'away' : 'home')

                  titleParts.push(
                    `${row.name} ${adjRow} – ${adjCol} ${col.name}`,
                    `Played at ${formatKickoff(match.kickoff_time)}` +
                      (match.court ? ` on ${match.court}` : ''),
                    `${prefix || (rowNetPoints === 0 ? '' : '')}${Math.abs(rowNetPoints)} pt${Math.abs(rowNetPoints) === 1 ? '' : 's'} to ${row.name}`
                  )
                  if (rowLate > 0 && !isForfeit) {
                    titleParts.push(
                      `${row.name} conceded ${rowLate * 2} goals: ${rowLate} min late`
                    )
                  }
                  if (colLate > 0 && !isForfeit) {
                    titleParts.push(
                      `${col.name} conceded ${colLate * 2} goals: ${colLate} min late`
                    )
                  }
                  if (rowUmpireNoShow) {
                    titleParts.push(`${row.name} did not provide an umpire (−1 pt)`)
                  }
                  if (rowForfeit) {
                    titleParts.push(
                      `${row.name} forfeited (${forfeit.reason === 'no_show' ? 'no show' : '4+ min late'})`
                    )
                  }
                  if (colForfeit) {
                    titleParts.push(
                      `${col.name} forfeited (${forfeit.reason === 'no_show' ? 'no show' : '4+ min late'})`
                    )
                  }
                  if (duplicate) {
                    titleParts.push(
                      `Duplicate: ${pairMatches.length} fixtures scheduled`
                    )
                  }
                  if (anyCourtClash) titleParts.push('Court/time conflict')
                  if (anyBackToBack) titleParts.push('Back-to-back match')

                  return (
                    <td
                      key={col.id}
                      title={titleParts.join(' — ')}
                      className={`${baseCell} ${colorClass} h-16 min-w-[5rem]`}
                    >
                      <span
                        className={`absolute left-1 top-0.5 tabular-nums leading-none ${
                          rowForfeit
                            ? 'text-base font-bold text-red-600 dark:text-red-400'
                            : 'text-base font-semibold'
                        }`}
                      >
                        {adjRow}
                      </span>
                      <span
                        className={`absolute bottom-0.5 right-1 tabular-nums leading-none ${
                          colForfeit
                            ? 'text-base font-bold text-red-600 dark:text-red-400'
                            : 'text-base font-semibold'
                        }`}
                      >
                        {adjCol}
                      </span>
                      <div className="flex h-full items-center justify-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-2xl font-extrabold tabular-nums leading-none ${pointsTone}`}
                        >
                          {prefix}
                          {Math.abs(rowNetPoints)}
                        </span>
                      </div>
                      {duplicate && (
                        <span className="absolute right-1 top-1 rounded-sm bg-fuchsia-600 px-1 text-[10px] font-bold text-white">
                          ×{pairMatches.length}
                        </span>
                      )}
                    </td>
                  )
                }

                if (duplicate) {
                  titleParts.push(
                    `Duplicate: ${pairMatches.length} fixtures scheduled (${pairMatches
                      .map((m) => formatKickoff(m.kickoff_time) + (m.court ? ` ${m.court}` : ''))
                      .join(', ')})`
                  )
                }
                if (anyCourtClash) titleParts.push('Court/time conflict with another fixture')
                if (anyBackToBack) titleParts.push('Back-to-back match for one of the teams')
                return (
                  <td
                    key={col.id}
                    title={titleParts.join(' — ')}
                    className={`${baseCell} ${colorClass}`}
                  >
                    <div className="flex items-center justify-center gap-1 font-semibold tabular-nums">
                      <span>{formatKickoff(match.kickoff_time)}</span>
                      {duplicate && (
                        <span className="rounded-sm bg-fuchsia-600 px-1 text-[10px] font-bold text-white">
                          ×{pairMatches.length}
                        </span>
                      )}
                    </div>
                    {match.court && (
                      <div className="text-[10px] opacity-80">
                        {match.court}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
