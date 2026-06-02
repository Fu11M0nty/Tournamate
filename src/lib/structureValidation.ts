import type {
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  ScoringSystem,
  Team,
} from '@/lib/types'

type PoolWithTeams = Pool & { pool_teams?: PoolTeam[] }
type PhaseElementWithSlots = PhaseElement & { slots?: ElementSlot[] }
type PhaseWithPools = Phase & {
  scoring_system?: ScoringSystem | null
  pools?: PoolWithTeams[]
  phase_elements?: PhaseElementWithSlots[]
}

export interface StatusCheck {
  id: string
  label: string
  ok: boolean
  message: string
  detail?: string
}

export function buildStatusChecks(
  phases: PhaseWithPools[],
  teams: Team[],
  matches: Match[],
  progressionRules: ProgressionRule[]
): StatusCheck[] {
  const pools = phases.flatMap((phase) => phase.pools ?? [])
  const elements = phases.flatMap((phase) => phase.phase_elements ?? [])
  const slots = elements.flatMap((element) => element.slots ?? [])
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]))
  const poolById = new Map(pools.map((pool) => [pool.id, pool]))
  const elementById = new Map(elements.map((element) => [element.id, element]))
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const phaseIds = new Set(phases.map((phase) => phase.id))
  const incomingSlotPhaseIds = new Set(
    elements
      .filter((element) =>
        (element.slots ?? []).some(
          (slot) =>
            !slot.team_id &&
            (slot.slot_type === 'source' ||
              slot.slot_type === 'placeholder' ||
              slot.slot_type === 'manual')
        )
      )
      .map((element) => element.phase_id)
  )

  const unassignedSummaries: string[] = []
  const duplicateSummaries: string[] = []

  for (const phase of phases) {
    const assignmentsByTeam = new Map<string, string[]>()
    for (const pool of phase.pools ?? []) {
      for (const assignment of pool.pool_teams ?? []) {
        const list = assignmentsByTeam.get(assignment.team_id) ?? []
        list.push(pool.name)
        assignmentsByTeam.set(assignment.team_id, list)
      }
    }

    const hasDirectAssignments = assignmentsByTeam.size > 0
    const shouldExpectDirectAssignments =
      hasDirectAssignments || !incomingSlotPhaseIds.has(phase.id)

    if (shouldExpectDirectAssignments) {
      const missingTeams = teams.filter((team) => !assignmentsByTeam.has(team.id))
      if (missingTeams.length > 0) {
        unassignedSummaries.push(
          `${phase.name}: ${missingTeams
            .slice(0, 3)
            .map((team) => team.name)
            .join(', ')}${missingTeams.length > 3 ? ` + ${missingTeams.length - 3} more` : ''}`
        )
      }
    }

    for (const [teamId, poolNames] of assignmentsByTeam.entries()) {
      if (poolNames.length > 1) {
        duplicateSummaries.push(
          `${teamById.get(teamId)?.name ?? 'Unknown team'} in ${phase.name}: ${poolNames.join(', ')}`
        )
      }
    }
  }

  const relevantRules = progressionRules.filter((rule) => {
    const targetElement = elementById.get(rule.to_element_id)
    return (
      phaseIds.has(rule.from_phase_id ?? '') ||
      phaseIds.has(rule.to_phase_id ?? '') ||
      phaseIds.has(targetElement?.phase_id ?? '')
    )
  })

  const missingTargetSlotSummaries: string[] = []
  for (const rule of relevantRules) {
    const targetElement = elementById.get(rule.to_element_id)
    const targetPhase =
      phaseById.get(rule.to_phase_id ?? '') ??
      phaseById.get(targetElement?.phase_id ?? '')
    const sourcePool = poolById.get(rule.from_pool_id ?? '')
    const label = `${sourcePool?.name ?? 'Progression'} rank ${rule.source_rank ?? '?'} -> ${targetPhase?.name ?? 'target phase'}`

    if (!targetElement) {
      missingTargetSlotSummaries.push(`${label}: target element missing`)
      continue
    }

    if (rule.to_slot_id) {
      if (!slotById.has(rule.to_slot_id)) {
        missingTargetSlotSummaries.push(`${label}: target slot missing`)
      }
      continue
    }

    if (!rule.to_slot_order) {
      missingTargetSlotSummaries.push(`${label}: target slot order missing`)
      continue
    }

    const hasSlotAtOrder = (targetElement.slots ?? []).some(
      (slot) => slot.display_order === rule.to_slot_order
    )
    if (!hasSlotAtOrder) {
      missingTargetSlotSummaries.push(`${label}: slot ${rule.to_slot_order} missing`)
    }
  }

  const unresolvedPlaceholderSummaries: string[] = []
  for (const match of matches) {
    const unresolvedSides: string[] = []
    const homeSlot = match.home_slot_id ? slotById.get(match.home_slot_id) : null
    const awaySlot = match.away_slot_id ? slotById.get(match.away_slot_id) : null
    if (!match.home_team_id && match.home_slot_id && !homeSlot?.team_id) {
      unresolvedSides.push(homeSlot?.label ?? 'home slot')
    }
    if (!match.away_team_id && match.away_slot_id && !awaySlot?.team_id) {
      unresolvedSides.push(awaySlot?.label ?? 'away slot')
    }
    if (unresolvedSides.length > 0) {
      const phaseName = phaseById.get(match.phase_id ?? '')?.name ?? 'Unknown phase'
      const poolName = poolById.get(match.pool_id ?? '')?.name
      unresolvedPlaceholderSummaries.push(
        `${phaseName}${poolName ? ` / ${poolName}` : ''}: ${unresolvedSides.join(' and ')}`
      )
    }
  }

  return [
    {
      id: 'unassigned-teams',
      label: 'Teams not assigned to any pool',
      ok: unassignedSummaries.length === 0,
      message:
        unassignedSummaries.length === 0
          ? 'Every team is assigned where direct pool assignment is expected.'
          : `${unassignedSummaries.length} stage${unassignedSummaries.length === 1 ? '' : 's'} need team assignments.`,
      detail: unassignedSummaries.slice(0, 4).join(' | '),
    },
    {
      id: 'duplicate-teams',
      label: 'Teams assigned to multiple pools',
      ok: duplicateSummaries.length === 0,
      message:
        duplicateSummaries.length === 0
          ? 'No team is assigned to more than one pool in the same stage.'
          : `${duplicateSummaries.length} duplicate pool assignment${duplicateSummaries.length === 1 ? '' : 's'} found.`,
      detail: duplicateSummaries.slice(0, 4).join(' | '),
    },
    {
      id: 'missing-target-slots',
      label: 'Progression target slots missing',
      ok: missingTargetSlotSummaries.length === 0,
      message:
        missingTargetSlotSummaries.length === 0
          ? 'Every progression rule has a matching target slot.'
          : `${missingTargetSlotSummaries.length} progression rule${missingTargetSlotSummaries.length === 1 ? '' : 's'} point to missing slots.`,
      detail: missingTargetSlotSummaries.slice(0, 4).join(' | '),
    },
    {
      id: 'unresolved-placeholders',
      label: 'Placeholder fixtures waiting on unresolved slots',
      ok: unresolvedPlaceholderSummaries.length === 0,
      message:
        unresolvedPlaceholderSummaries.length === 0
          ? 'No placeholder fixtures are currently waiting on unresolved slots.'
          : `${unresolvedPlaceholderSummaries.length} placeholder fixture${unresolvedPlaceholderSummaries.length === 1 ? '' : 's'} still waiting for teams.`,
      detail: unresolvedPlaceholderSummaries.slice(0, 4).join(' | '),
    },
  ]
}

export type ReadyCheck = {
  id: string
  label: string
  ok: boolean
  status?: 'ok' | 'warning' | 'info'
  message: string
  detail?: string
  fix: string
}

export function ordinal(value: number | null): string {
  if (!value) return 'rank'
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th'
  return `${value}${suffix}`
}

export function buildReadyChecks({
  phases,
  teams,
  matches,
  progressionRules,
}: {
  phases: PhaseWithPools[]
  teams: Team[]
  matches: Match[]
  progressionRules: ProgressionRule[]
}): ReadyCheck[] {
  const pools = phases.flatMap((phase) => phase.pools ?? [])
  const elements = phases.flatMap((phase) => phase.phase_elements ?? [])
  const slots = elements.flatMap((element) => element.slots ?? [])
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]))
  const poolById = new Map(pools.map((pool) => [pool.id, pool]))
  const elementById = new Map(elements.map((element) => [element.id, element]))
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const phaseIds = new Set(phases.map((phase) => phase.id))
  const incomingSlotPhaseIds = new Set(
    elements
      .filter((element) =>
        (element.slots ?? []).some(
          (slot) =>
            !slot.team_id &&
            (slot.slot_type === 'source' ||
              slot.slot_type === 'placeholder' ||
              slot.slot_type === 'manual')
        )
      )
      .map((element) => element.phase_id)
  )

  const unassignedSummaries: string[] = []
  const duplicateSummaries: string[] = []

  for (const phase of phases) {
    // Knockout phases have partial or no direct team assignments by design — only the first round
    // has direct assignments (and bye slots for seeded teams); later rounds are filled by progression
    // rules as matches are completed. Checking "all teams assigned" produces false positives.
    if (phase.phase_type === 'knockout') continue

    const assignmentsByTeam = new Map<string, string[]>()
    for (const pool of phase.pools ?? []) {
      for (const assignment of pool.pool_teams ?? []) {
        const list = assignmentsByTeam.get(assignment.team_id) ?? []
        list.push(pool.name)
        assignmentsByTeam.set(assignment.team_id, list)
      }
    }

    const hasDirectAssignments = assignmentsByTeam.size > 0
    const shouldExpectDirectAssignments =
      hasDirectAssignments || !incomingSlotPhaseIds.has(phase.id)

    if (shouldExpectDirectAssignments) {
      const missingTeams = teams.filter((team) => !assignmentsByTeam.has(team.id))
      if (missingTeams.length > 0) {
        unassignedSummaries.push(
          `${phase.name}: ${missingTeams
            .slice(0, 3)
            .map((team) => team.name)
            .join(', ')}${missingTeams.length > 3 ? ` + ${missingTeams.length - 3} more` : ''}`
        )
      }
    }

    for (const [teamId, poolNames] of assignmentsByTeam.entries()) {
      if (poolNames.length > 1) {
        duplicateSummaries.push(
          `${teamById.get(teamId)?.name ?? 'Unknown team'} appears in ${poolNames.join(', ')} for ${phase.name}`
        )
      }
    }
  }

  const relevantRules = progressionRules.filter((rule) => {
    const targetElement = elementById.get(rule.to_element_id)
    return (
      phaseIds.has(rule.from_phase_id ?? '') ||
      phaseIds.has(rule.to_phase_id ?? '') ||
      phaseIds.has(targetElement?.phase_id ?? '')
    )
  })

  const missingTargetSummaries: string[] = []
  for (const rule of relevantRules) {
    const targetElement = elementById.get(rule.to_element_id)
    const targetPhase =
      phaseById.get(rule.to_phase_id ?? '') ??
      phaseById.get(targetElement?.phase_id ?? '')
    const sourcePool = poolById.get(rule.from_pool_id ?? '')
    const label = `${sourcePool?.name ?? 'Qualifier'} ${ordinal(rule.source_rank)} -> ${targetPhase?.name ?? 'future stage'}`

    if (!targetElement) {
      missingTargetSummaries.push(`${label}: destination fixture missing`)
      continue
    }

    if (rule.to_slot_id) {
      if (!slotById.has(rule.to_slot_id)) {
        missingTargetSummaries.push(`${label}: destination team place missing`)
      }
      continue
    }

    if (!rule.to_slot_order) {
      missingTargetSummaries.push(`${label}: destination order missing`)
      continue
    }

    const hasSlotAtOrder = (targetElement.slots ?? []).some(
      (slot) => slot.display_order === rule.to_slot_order
    )
    if (!hasSlotAtOrder) {
      missingTargetSummaries.push(`${label}: destination place ${rule.to_slot_order} missing`)
    }
  }

  const unresolvedPlaceholderSummaries: string[] = []
  for (const match of matches) {
    const unresolvedSides: string[] = []
    const homeSlot = match.home_slot_id ? slotById.get(match.home_slot_id) : null
    const awaySlot = match.away_slot_id ? slotById.get(match.away_slot_id) : null
    if (!match.home_team_id && match.home_slot_id && !homeSlot?.team_id) {
      unresolvedSides.push(homeSlot?.label ?? 'home team')
    }
    if (!match.away_team_id && match.away_slot_id && !awaySlot?.team_id) {
      unresolvedSides.push(awaySlot?.label ?? 'away team')
    }
    if (unresolvedSides.length > 0) {
      const phaseName = phaseById.get(match.phase_id ?? '')?.name ?? 'Future stage'
      const poolName = poolById.get(match.pool_id ?? '')?.name
      unresolvedPlaceholderSummaries.push(
        `${phaseName}${poolName ? ` / ${poolName}` : ''}: ${unresolvedSides.join(' and ')}`
      )
    }
  }

  const scheduledCount = matches.filter((match) => match.is_planned).length
  // Exclude completed bye matches (away_team_id=null, status=completed) from the placeholder count.
  const placeholderCount = matches.filter(
    (match) => (!match.home_team_id || !match.away_team_id) && match.status !== 'completed'
  ).length
  const hasQualificationNeeds = placeholderCount > 0 || phases.some((phase) => phase.display_order > 1)

  return [
    {
      id: 'teams-added',
      label: 'Teams added',
      ok: teams.length > 0,
      message:
        teams.length > 0
          ? `${teams.length} team${teams.length === 1 ? '' : 's'} are available for this division.`
          : 'Add teams before creating a playable format.',
      fix: 'Add teams from the division team list.',
    },
    {
      id: 'teams-assigned',
      label: 'Teams assigned to pools',
      ok: unassignedSummaries.length === 0,
      message:
        unassignedSummaries.length === 0
          ? 'Every team is assigned where direct pool assignment is expected.'
          : `${unassignedSummaries.length} stage${unassignedSummaries.length === 1 ? '' : 's'} need team assignments.`,
      detail: unassignedSummaries.slice(0, 3).join(' | '),
      fix: 'Open Advanced setup, find the named stage, then use Teams on the pool that should contain those teams.',
    },
    {
      id: 'no-duplicates',
      label: 'No duplicate pool assignments',
      ok: duplicateSummaries.length === 0,
      message:
        duplicateSummaries.length === 0
          ? 'No team appears in more than one pool in the same stage.'
          : `${duplicateSummaries.length} duplicate assignment${duplicateSummaries.length === 1 ? '' : 's'} need checking.`,
      detail: duplicateSummaries.slice(0, 3).join(' | '),
      fix: 'Open Advanced setup, find the named stage, then remove the duplicate team from one of its pools.',
    },
    {
      id: 'fixtures-generated',
      label: 'Fixtures generated',
      ok: matches.length > 0,
      message:
        matches.length > 0
          ? `${matches.length} fixture${matches.length === 1 ? '' : 's'} exist for this format.`
          : 'No fixtures have been generated yet.',
      fix: 'Use the fixture generation controls in Advanced setup.',
    },
    {
      id: 'qualification-ready',
      label: 'Qualification paths set',
      ok: !hasQualificationNeeds || relevantRules.length > 0,
      message:
        !hasQualificationNeeds || relevantRules.length > 0
          ? `${relevantRules.length} qualification path${relevantRules.length === 1 ? '' : 's'} are configured.`
          : 'Future stages need to know where their teams come from.',
      fix: 'Apply a format template or set qualification routes in Advanced setup.',
    },
    {
      id: 'destinations-ready',
      label: 'Qualifier destinations ready',
      ok: missingTargetSummaries.length === 0,
      message:
        missingTargetSummaries.length === 0
          ? 'Every qualifier has a destination place.'
          : `${missingTargetSummaries.length} qualifier destination${missingTargetSummaries.length === 1 ? '' : 's'} need fixing.`,
      detail: missingTargetSummaries.slice(0, 3).join(' | '),
      fix: 'Use Advanced setup to repair the affected qualification mapping.',
    },
    {
      id: 'future-fixtures',
      label: 'Future fixtures waiting for results',
      ok: unresolvedPlaceholderSummaries.length === 0,
      status: unresolvedPlaceholderSummaries.length === 0 ? 'ok' : 'info',
      message:
        unresolvedPlaceholderSummaries.length === 0
          ? 'No future fixture is waiting for an unresolved team.'
          : `${unresolvedPlaceholderSummaries.length} future fixture${unresolvedPlaceholderSummaries.length === 1 ? '' : 's'} are scheduled and will populate when earlier results are known.`,
      detail: unresolvedPlaceholderSummaries.slice(0, 3).join(' | '),
      fix: 'No setup fix is needed unless these fixtures should already have teams. Complete earlier fixtures, then resolve qualifiers for the next stage.',
    },
    {
      id: 'schedule-started',
      label: 'Schedule started',
      ok: scheduledCount > 0,
      message:
        scheduledCount > 0
          ? `${scheduledCount} fixture${scheduledCount === 1 ? '' : 's'} are planned on the schedule.`
          : 'Fixtures exist but have not been planned on the schedule yet.',
      fix: 'Use the schedule page to place fixtures onto courts and times.',
    },
  ]
}
