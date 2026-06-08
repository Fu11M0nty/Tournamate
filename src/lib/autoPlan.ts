// =============================================================================
// Auto-plan scheduling algorithm
//
// Pure function — no React, no Supabase, no time-zone parsing. Inputs are
// minute-of-day integers; outputs are the same. The component layer is
// responsible for converting between Date / ISO strings / minutes.
//
// Algorithm — round-based with synchronized starts and tiered group affinity:
//   1. Pre-fill court occupancy + team trackers from already-locked matches.
//   2. Order the unplanned pool: fewest acceptable courts first, then longest
//      duration first (constraint-first ordering reduces stranding).
//   3. Run rounds. Each round picks a single roundStart shared across courts:
//      a. Identify courts that are free at roundStart (within their window
//         and not overlapping a lock). If none, advance to the next event.
//      b. For every free court, build the eligible candidate list (court
//         window OK, court free for the duration, both teams rested past
//         backToBackMin) and assign a **tier** to each:
//         - Tier 0: candidate's age group already has games on this court
//                   → keep the group where it lives.
//         - Tier 1: candidate's age group has no court yet → fresh group,
//                   gets a new court.
//         - Tier 2: candidate's age group is established on a *different*
//                   court → forced spillover, only used when 0 and 1 are
//                   empty.
//         Pick the smallest tier; within Tier 2 prefer the group with the
//         most remaining matches (busiest group absorbs spillover). Within a
//         tier, fairness picks the next match (least-played teams first).
//      c. Place the chosen candidate on each free court.
//      d. Advance roundStart to the latest end among placements made this
//         round — every court starts the *next* match at the same time, even
//         if a shorter match leaves a 5–10 min idle gap.
//   4. Anything left unplaced is reported in `unplacedIds`.
// =============================================================================

export const BLOCK_MINUTES = 5

export interface AutoPlanCourt {
  name: string
  startMin: number
  endMin: number
}

export interface AutoPlanMatch {
  id: string
  ageGroupId: string
  homeTeamId: string
  awayTeamId: string
  durationMinutes: number
  notBeforeMin?: number | null
}

export interface AutoPlanLock {
  matchId: string
  ageGroupId: string
  homeTeamId: string
  awayTeamId: string
  court: string
  startMin: number
  durationMinutes: number
}

export interface AutoPlanInput {
  courts: AutoPlanCourt[]
  matches: AutoPlanMatch[]
  locks: AutoPlanLock[]
  backToBackMin: number
}

export interface AutoPlanPlacement {
  matchId: string
  court: string
  startMin: number
}

export interface AutoPlanResult {
  placements: AutoPlanPlacement[]
  unplacedIds: string[]
  stats: {
    totalUnplanned: number
    placed: number
    earliestStart: number | null
    latestEnd: number | null
  }
}

interface Range {
  start: number
  end: number
}

function blocksFor(durationMin: number): number {
  return Math.max(1, Math.ceil(durationMin / BLOCK_MINUTES))
}

function durationCeil(durationMin: number): number {
  return blocksFor(durationMin) * BLOCK_MINUTES
}

function isFree(occupancy: Range[], start: number, end: number): boolean {
  for (const r of occupancy) {
    if (start < r.end && end > r.start) return false
  }
  return true
}

export function autoPlan(input: AutoPlanInput): AutoPlanResult {
  const { courts, matches, locks, backToBackMin } = input

  const occupancy = new Map<string, Range[]>()
  for (const c of courts) occupancy.set(c.name, [])

  const teamLastEnd = new Map<string, number>()
  const teamGames = new Map<string, number>()

  // Per-(ageGroup, court) game count — drives the sticky / spread scoring.
  const groupCourtAffinity = new Map<string, Map<string, number>>()

  function recordPlacement(
    courtName: string,
    start: number,
    end: number,
    homeTeamId: string,
    awayTeamId: string,
    ageGroupId: string
  ) {
    if (!occupancy.has(courtName)) occupancy.set(courtName, [])
    const arr = occupancy.get(courtName)!
    arr.push({ start, end })
    arr.sort((a, b) => a.start - b.start)

    const prevHomeEnd = teamLastEnd.get(homeTeamId) ?? -Infinity
    const prevAwayEnd = teamLastEnd.get(awayTeamId) ?? -Infinity
    teamLastEnd.set(homeTeamId, Math.max(prevHomeEnd, end))
    teamLastEnd.set(awayTeamId, Math.max(prevAwayEnd, end))
    teamGames.set(homeTeamId, (teamGames.get(homeTeamId) ?? 0) + 1)
    teamGames.set(awayTeamId, (teamGames.get(awayTeamId) ?? 0) + 1)

    const affMap = groupCourtAffinity.get(ageGroupId) ?? new Map<string, number>()
    affMap.set(courtName, (affMap.get(courtName) ?? 0) + 1)
    groupCourtAffinity.set(ageGroupId, affMap)
  }

  for (const lock of locks) {
    const end = lock.startMin + durationCeil(lock.durationMinutes)
    recordPlacement(
      lock.court,
      lock.startMin,
      end,
      lock.homeTeamId,
      lock.awayTeamId,
      lock.ageGroupId
    )
  }

  if (courts.length === 0 || matches.length === 0) {
    return {
      placements: [],
      unplacedIds: matches.map((m) => m.id),
      stats: {
        totalUnplanned: matches.length,
        placed: 0,
        earliestStart: null,
        latestEnd: null,
      },
    }
  }

  function constraintCountFor(m: AutoPlanMatch): number {
    const dur = durationCeil(m.durationMinutes)
    let count = 0
    for (const c of courts) {
      const startMin = Math.max(c.startMin, m.notBeforeMin ?? -Infinity)
      if (c.endMin - startMin >= dur) count++
    }
    return count
  }

  const remaining: AutoPlanMatch[] = [...matches].sort((a, b) => {
    const ca = constraintCountFor(a)
    const cb = constraintCountFor(b)
    if (ca !== cb) return ca - cb
    return b.durationMinutes - a.durationMinutes
  })

  const placements: AutoPlanPlacement[] = []
  const tickStart = Math.min(...courts.map((c) => c.startMin))
  const tickEnd = Math.max(...courts.map((c) => c.endMin))

  // Returns the earliest tick > t at which any court's free/busy state changes
  // (lock end, court window start, court window end). Used to skip dead air
  // when no courts are placeable at the current roundStart.
  function nextEventAfter(t: number): number | null {
    let best: number | null = null
    function consider(x: number) {
      if (x > t && (best === null || x < best)) best = x
    }
    for (const c of courts) {
      consider(c.startMin)
      consider(c.endMin)
      const arr = occupancy.get(c.name) ?? []
      for (const r of arr) {
        consider(r.start)
        consider(r.end)
      }
    }
    return best
  }

  // Earliest tick > t at which a remaining match's back-to-back constraint
  // releases (i.e. the later-finishing team has rested for backToBackMin).
  // Used to advance the round when every candidate is blocked by team rest.
  function earliestBackToBackReleaseAfter(t: number): number | null {
    let best: number | null = null
    for (const m of remaining) {
      const homeLast = teamLastEnd.get(m.homeTeamId)
      const awayLast = teamLastEnd.get(m.awayTeamId)
      const ready = Math.max(homeLast ?? -Infinity, awayLast ?? -Infinity)
      if (!Number.isFinite(ready)) continue
      const x = ready + backToBackMin
      if (x > t && (best === null || x < best)) best = x
    }
    return best
  }

  function earliestMatchReleaseAfter(t: number): number | null {
    let best: number | null = null
    for (const m of remaining) {
      const x = m.notBeforeMin
      if (x === null || x === undefined) continue
      if (x > t && (best === null || x < best)) best = x
    }
    return best
  }

  let roundStart = tickStart
  let safetyTicks = 10_000 // hard upper bound to prevent runaway loops

  while (remaining.length > 0 && roundStart < tickEnd && safetyTicks-- > 0) {
    // Free courts at this roundStart (within window, no lock at this instant).
    const freeCourts: AutoPlanCourt[] = []
    for (const c of courts) {
      if (roundStart < c.startMin) continue
      if (roundStart >= c.endMin) continue
      const arr = occupancy.get(c.name) ?? []
      const blocked = arr.some(
        (r) => roundStart >= r.start && roundStart < r.end
      )
      if (!blocked) freeCourts.push(c)
    }
    if (freeCourts.length === 0) {
      const evt = nextEventAfter(roundStart)
      const rel = earliestBackToBackReleaseAfter(roundStart)
      const dep = earliestMatchReleaseAfter(roundStart)
      const next =
        [evt, rel, dep]
          .filter((value): value is number => value !== null)
          .sort((a, b) => a - b)[0] ?? null
      if (next === null || next <= roundStart) break
      roundStart = next
      continue
    }

    const placedThisRound: { end: number }[] = []

    // Cached per round: how many matches each age group still has to schedule.
    const groupRemaining = new Map<string, number>()
    for (const m of remaining) {
      groupRemaining.set(
        m.ageGroupId,
        (groupRemaining.get(m.ageGroupId) ?? 0) + 1
      )
    }

    for (const court of freeCourts) {
      // Lex-key: [tier, spillBias, fairness]. Smaller wins.
      let bestIdx = -1
      let bestTier = Infinity
      let bestSpill = Infinity
      let bestFairness = Infinity

      for (let i = 0; i < remaining.length; i++) {
        const m = remaining[i]
        const dur = durationCeil(m.durationMinutes)
        const end = roundStart + dur

        if (m.notBeforeMin !== null && m.notBeforeMin !== undefined && roundStart < m.notBeforeMin)
          continue
        if (end > court.endMin) continue
        const arr = occupancy.get(court.name) ?? []
        if (!isFree(arr, roundStart, end)) continue

        const homeLast = teamLastEnd.get(m.homeTeamId)
        const awayLast = teamLastEnd.get(m.awayTeamId)
        if (homeLast !== undefined && roundStart - homeLast < backToBackMin)
          continue
        if (awayLast !== undefined && roundStart - awayLast < backToBackMin)
          continue

        const groupAff = groupCourtAffinity.get(m.ageGroupId)
        const onThisCourt = groupAff?.get(court.name) ?? 0
        let onAnyCourt = 0
        if (groupAff) {
          for (const n of groupAff.values()) onAnyCourt += n
        }

        const tier =
          onThisCourt > 0
            ? 0 // group already lives on this court
            : onAnyCourt === 0
              ? 1 // fresh group
              : 2 // forced spillover

        // Tier 2 only: prefer the busiest unscheduled group (most remaining)
        // so the freed court absorbs the largest backlog. Negate so smaller =
        // better in the lex-key.
        const spillBias =
          tier === 2 ? -(groupRemaining.get(m.ageGroupId) ?? 0) : 0

        const homeGames = teamGames.get(m.homeTeamId) ?? 0
        const awayGames = teamGames.get(m.awayTeamId) ?? 0
        const fairness =
          Math.min(homeGames, awayGames) + 0.25 * (homeGames + awayGames)

        if (
          tier < bestTier ||
          (tier === bestTier && spillBias < bestSpill) ||
          (tier === bestTier &&
            spillBias === bestSpill &&
            fairness < bestFairness)
        ) {
          bestTier = tier
          bestSpill = spillBias
          bestFairness = fairness
          bestIdx = i
        }
      }

      if (bestIdx >= 0) {
        const m = remaining[bestIdx]
        const dur = durationCeil(m.durationMinutes)
        const start = roundStart
        const end = start + dur
        placements.push({ matchId: m.id, court: court.name, startMin: start })
        recordPlacement(
          court.name,
          start,
          end,
          m.homeTeamId,
          m.awayTeamId,
          m.ageGroupId
        )
        placedThisRound.push({ end })
        remaining.splice(bestIdx, 1)
        groupRemaining.set(
          m.ageGroupId,
          (groupRemaining.get(m.ageGroupId) ?? 1) - 1
        )
      }
    }

    if (placedThisRound.length === 0) {
      const evt = nextEventAfter(roundStart)
      const rel = earliestBackToBackReleaseAfter(roundStart)
      const dep = earliestMatchReleaseAfter(roundStart)
      const next =
        [evt, rel, dep]
          .filter((value): value is number => value !== null)
          .sort((a, b) => a - b)[0] ?? null
      if (next === null || next <= roundStart) break
      roundStart = next
      continue
    }

    // Sync next round to the slowest finisher this round.
    const longestEnd = Math.max(...placedThisRound.map((p) => p.end))
    roundStart = longestEnd
  }

  let earliest: number | null = null
  let latest: number | null = null
  if (placements.length > 0) {
    earliest = Math.min(...placements.map((p) => p.startMin))
    const matchById = new Map(matches.map((m) => [m.id, m]))
    latest = Math.max(
      ...placements.map((p) => {
        const m = matchById.get(p.matchId)
        const dur = m ? durationCeil(m.durationMinutes) : BLOCK_MINUTES
        return p.startMin + dur
      })
    )
  }

  return {
    placements,
    unplacedIds: remaining.map((m) => m.id),
    stats: {
      totalUnplanned: matches.length,
      placed: placements.length,
      earliestStart: earliest,
      latestEnd: latest,
    },
  }
}
