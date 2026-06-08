import type { createClient } from './supabase'
import { totalMatchMinutes } from './matchRules'
import type { AgeGroup, Day, ElementSlot, Match, Phase, PhaseElement, Pool, PoolTeam, Team } from './types'

type Supabase = ReturnType<typeof createClient>

interface TournamentDates {
  start_date: string | null
  end_date: string | null
}

function placeholderIso(day: Day, t: TournamentDates): string {
  const dateStr =
    day === 'saturday'
      ? t.start_date ?? t.end_date
      : t.end_date ?? t.start_date
  if (dateStr) return `${dateStr}T08:00:00.000Z`
  // Fall back to today if the tournament has no dates yet — value is irrelevant
  // because the match starts unplanned and the user drags it onto a real slot.
  return new Date().toISOString()
}

/**
 * Ensure a round-robin set of matches exists for the division: every pair of
 * teams that doesn't yet have a match between them gets one created. New
 * matches start in the unplanned pool (`is_planned = false`) so the organiser
 * can drag them onto the schedule.
 */
export async function ensureRoundRobinMatches(
  supabase: Supabase,
  ageGroupId: string
): Promise<{ created: number; error?: string }> {
  const { data: ag, error: agErr } = await supabase
    .from('age_groups')
    .select('*')
    .eq('id', ageGroupId)
    .single()
  if (agErr || !ag) {
    return { created: 0, error: agErr?.message ?? 'Division not found' }
  }
  const ageGroup = ag as AgeGroup

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('start_date, end_date')
    .eq('id', ageGroup.tournament_id)
    .single()
  if (tErr || !tournament) {
    return { created: 0, error: tErr?.message ?? 'Tournament not found' }
  }

  const { data: competitionDate } = await supabase
    .from('competition_dates')
    .select('id')
    .eq('tournament_id', ageGroup.tournament_id)
    .eq('legacy_day', ageGroup.day)
    .maybeSingle()
  const competitionDateId =
    (competitionDate as { id?: string } | null)?.id ?? null

  const { data: defaultPhase } = await supabase
    .from('phases')
    .select('id')
    .eq('age_group_id', ageGroupId)
    .eq('slug', 'round-robin')
    .maybeSingle()
  const phaseId = (defaultPhase as { id?: string } | null)?.id ?? null

  const { data: defaultPool } = phaseId
    ? await supabase
        .from('pools')
        .select('id')
        .eq('phase_id', phaseId)
        .eq('is_default', true)
        .maybeSingle()
    : { data: null }
  const poolId = (defaultPool as { id?: string } | null)?.id ?? null

  const { data: teamsData } = await supabase
    .from('teams')
    .select('id, name')
    .eq('age_group_id', ageGroupId)
    .is('deleted_at', null)
  const teams = (teamsData ?? []) as { id: string; name: string }[]
  if (teams.length < 2) return { created: 0 }

  const { data: existingMatches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('age_group_id', ageGroupId)
    .is('deleted_at', null)
  const existingPairs = new Set<string>(
    ((existingMatches ?? []) as {
      home_team_id: string
      away_team_id: string
    }[]).map((m) => [m.home_team_id, m.away_team_id].sort().join('|'))
  )

  const placeholder = placeholderIso(ageGroup.day, tournament as TournamentDates)
  const totalMin = totalMatchMinutes(ageGroup)

  const toInsert: Record<string, unknown>[] = []

  // Use the "Circle Method" for round-robin scheduling to ensure unique teams per round
  type TeamOrBye = typeof teams[0] | null
  const schedulingTeams: TeamOrBye[] = [...teams]
  if (schedulingTeams.length % 2 !== 0) {
    schedulingTeams.push(null) // Add a dummy team for the "bye"
  }

  const numTeams = schedulingTeams.length
  const rounds = numTeams - 1
  const matchesPerRound = numTeams / 2

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = schedulingTeams[i]
      const away = schedulingTeams[numTeams - 1 - i]

      // If neither team is the dummy "bye" team, schedule the match
      if (home !== null && away !== null) {
        const key = [home.id, away.id].sort().join('|')
        if (!existingPairs.has(key)) {
          toInsert.push({
            age_group_id: ageGroupId,
            phase_id: phaseId,
            pool_id: poolId,
            competition_date_id: competitionDateId,
            home_team_id: home.id,
            away_team_id: away.id,
            court: null,
            kickoff_time: placeholder,
            status: 'scheduled',
            duration_minutes: totalMin,
            is_planned: false,
            round_number: round + 1, // Store the assigned round
          })
        }
      }
    }

    // Rotate the array for the next round: keep index 0 fixed, shift the rest
    const last = schedulingTeams.pop()!
    schedulingTeams.splice(1, 0, last)
  }

  if (toInsert.length === 0) return { created: 0 }

  const { data, error } = await supabase
    .from('matches')
    .insert(toInsert)
    .select('id')
  if (error) return { created: 0, error: error.message }
  return { created: data?.length ?? 0 }
}

type FixtureEntrant = {
  id: string
  teamId: string | null
  slotId: string | null
}

function roundRobinPairs(entrants: FixtureEntrant[]) {
  const pairs: { home: FixtureEntrant; away: FixtureEntrant; round: number }[] = []
  type EntrantOrBye = FixtureEntrant | null
  const schedulingTeams: EntrantOrBye[] = [...entrants]
  if (schedulingTeams.length % 2 !== 0) schedulingTeams.push(null)

  const numTeams = schedulingTeams.length
  const rounds = numTeams - 1
  const matchesPerRound = numTeams / 2

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = schedulingTeams[i]
      const away = schedulingTeams[numTeams - 1 - i]
      if (home && away) {
        const flipHomeAway = (round + i) % 2 === 1
        pairs.push({
          home: flipHomeAway ? away : home,
          away: flipHomeAway ? home : away,
          round: round + 1,
        })
      }
    }

    const last = schedulingTeams.pop()!
    schedulingTeams.splice(1, 0, last)
  }

  return pairs
}

function leaguePairs(entrants: FixtureEntrant[], repeatCount: number) {
  const firstRound = roundRobinPairs(entrants)
  if (repeatCount < 2) return firstRound

  return [
    ...firstRound,
    ...firstRound.map((pair) => ({
      home: pair.away,
      away: pair.home,
      round: pair.round + firstRound.reduce((max, current) => Math.max(max, current.round), 0),
    })),
  ]
}

function knockoutPairs(entrants: FixtureEntrant[]) {
  const pairs: { home: FixtureEntrant; away: FixtureEntrant; round: number }[] = []
  for (let index = 0; index + 1 < entrants.length; index += 2) {
    pairs.push({
      home: entrants[index],
      away: entrants[index + 1],
      round: 1,
    })
  }
  return pairs
}

export async function generateStructureFixtures(
  supabase: Supabase,
  ageGroupId: string,
  phaseId?: string
): Promise<{ created: number; error?: string }> {
  const { data: ag, error: agErr } = await supabase
    .from('age_groups')
    .select('*')
    .eq('id', ageGroupId)
    .single()
  if (agErr || !ag) {
    return { created: 0, error: agErr?.message ?? 'Division not found' }
  }
  const ageGroup = ag as AgeGroup

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('start_date, end_date')
    .eq('id', ageGroup.tournament_id)
    .single()
  if (tErr || !tournament) {
    return { created: 0, error: tErr?.message ?? 'Tournament not found' }
  }

  const { data: competitionDate } = await supabase
    .from('competition_dates')
    .select('id')
    .eq('tournament_id', ageGroup.tournament_id)
    .eq('legacy_day', ageGroup.day)
    .maybeSingle()
  const competitionDateId =
    (competitionDate as { id?: string } | null)?.id ?? null

  let phaseQuery = supabase
    .from('phases')
    .select('*')
    .eq('age_group_id', ageGroupId)
  if (phaseId) phaseQuery = phaseQuery.eq('id', phaseId)

  const { data: phasesData, error: phasesError } = await phaseQuery
  if (phasesError) return { created: 0, error: phasesError.message }
  const phases = (phasesData ?? []) as Phase[]
  if (phases.length === 0) return { created: 0 }

  const phaseIds = phases.map((phase) => phase.id)
  const { data: poolsData, error: poolsError } = await supabase
    .from('pools')
    .select('*')
    .in('phase_id', phaseIds)
  if (poolsError) return { created: 0, error: poolsError.message }
  const pools = (poolsData ?? []) as Pool[]
  if (pools.length === 0) return { created: 0 }

  const poolIds = pools.map((pool) => pool.id)
  const [elementsRes, poolTeamsRes, slotsRes, teamsRes, matchesRes] = await Promise.all([
    supabase.from('phase_elements').select('*').in('pool_id', poolIds),
    supabase.from('pool_teams').select('*').in('pool_id', poolIds),
    supabase.from('element_slots').select('*'),
    supabase.from('teams').select('*').eq('age_group_id', ageGroupId).is('deleted_at', null),
    supabase.from('matches').select('*').eq('age_group_id', ageGroupId).is('deleted_at', null),
  ])

  if (elementsRes.error) return { created: 0, error: elementsRes.error.message }
  if (poolTeamsRes.error) return { created: 0, error: poolTeamsRes.error.message }
  if (slotsRes.error) return { created: 0, error: slotsRes.error.message }
  if (teamsRes.error) return { created: 0, error: teamsRes.error.message }
  if (matchesRes.error) return { created: 0, error: matchesRes.error.message }

  const elements = (elementsRes.data ?? []) as PhaseElement[]
  const poolTeams = (poolTeamsRes.data ?? []) as PoolTeam[]
  const slots = (slotsRes.data ?? []) as ElementSlot[]
  const teams = (teamsRes.data ?? []) as Team[]
  const existingMatches = (matchesRes.data ?? []) as Match[]
  const activeTeamIds = new Set(teams.map((team) => team.id))
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]))
  const elementByPoolId = new Map<string, PhaseElement>()
  for (const element of elements) {
    if (element.pool_id) elementByPoolId.set(element.pool_id, element)
  }

  const slotsByElementId = new Map<string, ElementSlot[]>()
  for (const slot of slots) {
    const list = slotsByElementId.get(slot.phase_element_id) ?? []
    list.push(slot)
    slotsByElementId.set(slot.phase_element_id, list)
  }

  const poolTeamsByPoolId = new Map<string, PoolTeam[]>()
  for (const poolTeam of poolTeams) {
    const list = poolTeamsByPoolId.get(poolTeam.pool_id) ?? []
    list.push(poolTeam)
    poolTeamsByPoolId.set(poolTeam.pool_id, list)
  }

  function matchAwayKey(match: Match): string {
    if (match.away_team_id) return match.away_team_id
    if (match.away_slot_id) return `slot:${match.away_slot_id}`
    return 'bye'
  }

  const existingPairs = new Set(
    existingMatches.map((match) =>
      [
        match.phase_element_id ?? 'none',
        match.home_team_id ?? `slot:${match.home_slot_id}`,
        matchAwayKey(match),
      ].join('|')
    )
  )
  const reverseExistingPairs = new Set(
    existingMatches.map((match) =>
      [
        match.phase_element_id ?? 'none',
        matchAwayKey(match),
        match.home_team_id ?? `slot:${match.home_slot_id}`,
      ].join('|')
    )
  )

  const placeholder = placeholderIso(ageGroup.day, tournament as TournamentDates)
  const totalMin = totalMatchMinutes(ageGroup)
  const toInsert: Record<string, unknown>[] = []

  for (const pool of pools) {
    const element = elementByPoolId.get(pool.id)
    if (!element) continue

    const resolvedSlotTeamIds = (slotsByElementId.get(element.id) ?? [])
      .filter((slot) => slot.team_id && activeTeamIds.has(slot.team_id))
      .sort((a, b) => a.display_order - b.display_order)
      .map((slot) => slot.team_id!)

    const fallbackPoolTeamIds = (poolTeamsByPoolId.get(pool.id) ?? [])
      .filter((poolTeam) => activeTeamIds.has(poolTeam.team_id))
      .sort((a, b) => a.display_order - b.display_order)
      .map((poolTeam) => poolTeam.team_id)

    const teamIds = Array.from(
      new Set(resolvedSlotTeamIds.length > 0 ? resolvedSlotTeamIds : fallbackPoolTeamIds)
    ).map((id) => ({ id, teamId: id, slotId: null }))

    const slotEntrants = (slotsByElementId.get(element.id) ?? [])
      .filter((slot) => slot.slot_type !== 'bye')
      .sort((a, b) => a.display_order - b.display_order)
      .map((slot) => ({
        id: slot.team_id ?? slot.id,
        teamId: slot.team_id && activeTeamIds.has(slot.team_id) ? slot.team_id : null,
        slotId: slot.id,
      }))

    const entrants = slotEntrants.length > 0 ? slotEntrants : teamIds

    if (entrants.length < 2) {
      // Bye match: single seeded team auto-advances; create a completed match with no opponent.
      const allPoolSlots = slotsByElementId.get(element.id) ?? []
      const hasByeSlot = allPoolSlots.some((slot) => slot.slot_type === 'bye')
      const poolPhase = phaseById.get(pool.phase_id)
      const isKnockout =
        poolPhase?.phase_type === 'knockout' ||
        element.element_type === 'single_match' ||
        element.element_type === 'bracket'

      if (hasByeSlot && entrants.length === 1 && isKnockout) {
        const home = entrants[0]
        const homeIdentity = home.teamId ?? `slot:${home.slotId}`
        const byeKey = [element.id, homeIdentity, 'bye'].join('|')
        if (!existingPairs.has(byeKey)) {
          toInsert.push({
            age_group_id: ageGroupId,
            phase_id: pool.phase_id,
            pool_id: pool.id,
            phase_element_id: element.id,
            competition_date_id: competitionDateId,
            // Use team-mode when resolved, slot-mode when not — never both, to satisfy the constraint.
            home_team_id: home.teamId ?? null,
            away_team_id: null,
            home_slot_id: home.teamId ? null : home.slotId,
            away_slot_id: null,
            court: null,
            kickoff_time: placeholder,
            status: 'completed',
            duration_minutes: totalMin,
            is_planned: false,
            round_number: 1,
          })
        }
      }
      continue
    }

    const phase = phaseById.get(pool.phase_id)
    const leagueRepeatCount =
      phase?.phase_type === 'league'
        ? Number((phase.metadata as Record<string, unknown> | undefined)?.league_repeat_count ?? 1)
        : 1
    const pairs =
      phase?.phase_type === 'knockout' ||
      phase?.phase_type === 'friendly' ||
      element.element_type === 'bracket' ||
      element.element_type === 'single_match'
        ? knockoutPairs(entrants)
        : phase?.phase_type === 'league'
          ? leaguePairs(entrants, leagueRepeatCount === 2 ? 2 : 1)
        : roundRobinPairs(entrants)

    for (const pair of pairs) {
      const homeIdentity = pair.home.teamId ?? `slot:${pair.home.slotId}`
      const awayIdentity = pair.away.teamId ?? `slot:${pair.away.slotId}`
      const key = [element.id, homeIdentity, awayIdentity].join('|')
      if (
        existingPairs.has(key) ||
        (phase?.phase_type !== 'league' || leagueRepeatCount < 2
          ? reverseExistingPairs.has(key)
          : false)
      ) continue

      toInsert.push({
        age_group_id: ageGroupId,
        phase_id: pool.phase_id,
        pool_id: pool.id,
        phase_element_id: element.id,
        competition_date_id: competitionDateId,
        home_team_id: pair.home.teamId,
        away_team_id: pair.away.teamId,
        home_slot_id: pair.home.slotId,
        away_slot_id: pair.away.slotId,
        court: null,
        kickoff_time: placeholder,
        status: 'scheduled',
        duration_minutes: totalMin,
        is_planned: false,
        round_number: pair.round,
      })
    }
  }

  if (toInsert.length === 0) return { created: 0 }

  const { data, error } = await supabase
    .from('matches')
    .insert(toInsert)
    .select('id')
  if (error) return { created: 0, error: error.message }

  return { created: data?.length ?? 0 }
}

export async function regenerateUnplannedStructureFixtures(
  supabase: Supabase,
  ageGroupId: string,
  phaseId?: string
): Promise<{ deleted: number; created: number; error?: string }> {
  let deleteQuery = supabase
    .from('matches')
    .delete()
    .eq('age_group_id', ageGroupId)
    .eq('is_planned', false)
    .eq('status', 'scheduled')
    .is('deleted_at', null)

  if (phaseId) deleteQuery = deleteQuery.eq('phase_id', phaseId)

  const { data: deletedRows, error: deleteError } = await deleteQuery.select('id')
  if (deleteError) {
    return { deleted: 0, created: 0, error: deleteError.message }
  }

  const generated = await generateStructureFixtures(supabase, ageGroupId, phaseId)
  if (generated.error) {
    return {
      deleted: deletedRows?.length ?? 0,
      created: generated.created,
      error: generated.error,
    }
  }

  return {
    deleted: deletedRows?.length ?? 0,
    created: generated.created,
  }
}

/**
 * Push the division's match rules onto every existing match in that division by
 * setting `matches.duration_minutes` to the total computed from the rules.
 */
export async function applyMatchRulesToGroup(
  supabase: Supabase,
  ageGroupId: string,
  totalMin: number
): Promise<{ updated: number; error?: string }> {
  const { data, error } = await supabase
    .from('matches')
    .update({ duration_minutes: totalMin })
    .eq('age_group_id', ageGroupId)
    .is('deleted_at', null)
    .select('id')
  if (error) return { updated: 0, error: error.message }
  return { updated: data?.length ?? 0 }
}

/**
 * Soft-delete a team by stamping `deleted_at`. All matches that reference the
 * team (home or away) are stamped with the same timestamp so they vanish from
 * match, schedule and matrix views. Returns counts for the audit toast.
 */
export async function softDeleteTeam(
  supabase: Supabase,
  teamId: string
): Promise<{
  team: number
  matches: number
  error?: string
}> {
  const stamp = new Date().toISOString()
  const { data: t, error: tErr } = await supabase
    .from('teams')
    .update({ deleted_at: stamp })
    .eq('id', teamId)
    .is('deleted_at', null)
    .select('id')
  if (tErr) return { team: 0, matches: 0, error: tErr.message }
  if (!t || t.length === 0) {
    return {
      team: 0,
      matches: 0,
      error: 'Team not found, already deleted, or RLS blocked',
    }
  }

  const { data: m, error: mErr } = await supabase
    .from('matches')
    .update({ deleted_at: stamp })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .is('deleted_at', null)
    .select('id')
  if (mErr) return { team: 1, matches: 0, error: mErr.message }
  return { team: 1, matches: m?.length ?? 0 }
}

/**
 * Restore a soft-deleted team. Matches involving this team are restored only
 * when the OPPOSING team is also active — that prevents resurrecting a fixture
 * whose other half is still gone.
 */
export async function restoreTeam(
  supabase: Supabase,
  teamId: string
): Promise<{
  team: number
  matches: number
  error?: string
}> {
  const { data: t, error: tErr } = await supabase
    .from('teams')
    .update({ deleted_at: null })
    .eq('id', teamId)
    .not('deleted_at', 'is', null)
    .select('id')
  if (tErr) return { team: 0, matches: 0, error: tErr.message }
  if (!t || t.length === 0) {
    return {
      team: 0,
      matches: 0,
      error: 'Team not found, already active, or RLS blocked',
    }
  }

  const { data: candidates, error: cErr } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .not('deleted_at', 'is', null)
  if (cErr) return { team: 1, matches: 0, error: cErr.message }
  const cands = (candidates ?? []) as {
    id: string
    home_team_id: string
    away_team_id: string | null
  }[]
  if (cands.length === 0) return { team: 1, matches: 0 }

  const otherIds = Array.from(
    new Set(
      cands.flatMap((m) => {
        const otherId = m.home_team_id === teamId ? m.away_team_id : m.home_team_id
        return otherId ? [otherId] : []
      })
    )
  )
  const { data: activeOthers } = otherIds.length > 0
    ? await supabase.from('teams').select('id').in('id', otherIds).is('deleted_at', null)
    : { data: [] }
  const activeSet = new Set(
    ((activeOthers ?? []) as { id: string }[]).map((r) => r.id)
  )

  const restoreIds = cands
    .filter((m) => {
      const otherId = m.home_team_id === teamId ? m.away_team_id : m.home_team_id
      // Bye matches (null away_team_id) are always restored with the home team.
      return otherId === null || activeSet.has(otherId)
    })
    .map((m) => m.id)

  if (restoreIds.length === 0) return { team: 1, matches: 0 }

  const { data: m, error: mErr } = await supabase
    .from('matches')
    .update({ deleted_at: null })
    .in('id', restoreIds)
    .select('id')
  if (mErr) return { team: 1, matches: 0, error: mErr.message }
  return { team: 1, matches: m?.length ?? 0 }
}
