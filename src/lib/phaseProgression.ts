import { calculateStandings } from './standings'
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
} from './types'

export interface PhaseProgressionResolution {
  rule: ProgressionRule
  slot: ElementSlot | null
  team: Team | null
  label: string
  sourceLabel: string
  targetLabel: string
  status: 'ready' | 'warning' | 'blocked'
  message: string
}

type PhaseWithScoring = Phase & {
  scoring_system?: ScoringSystem | null
}

type PoolWithTeams = Pool & {
  pool_teams?: PoolTeam[]
}

function ordinal(value: number | null) {
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

function sourceTypeLabel(type: ProgressionRule['source_type']) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function sourceMatches(rule: ProgressionRule, matches: Match[]) {
  return matches.filter((match) => {
    if (match.deleted_at) return false
    if (rule.from_match_id) return match.id === rule.from_match_id
    if (rule.from_pool_id) return match.pool_id === rule.from_pool_id
    if (rule.from_element_id) return match.phase_element_id === rule.from_element_id
    if (rule.from_phase_id) return match.phase_id === rule.from_phase_id
    return false
  })
}

function sourceTeams(
  rule: ProgressionRule,
  sourcePhase: PhaseWithScoring | undefined,
  sourceElement: PhaseElement | undefined,
  sourcePool: PoolWithTeams | undefined,
  teams: Team[],
  matches: Match[]
) {
  if (sourcePool?.pool_teams) {
    const ids = new Set(sourcePool.pool_teams.map((poolTeam) => poolTeam.team_id))
    return teams.filter((team) => ids.has(team.id))
  }

  if (sourcePhase) {
    return teams.filter((team) => team.age_group_id === sourcePhase.age_group_id)
  }

  const sourceTeamIds = new Set<string>()
  for (const match of matches) {
    if (match.home_team_id) sourceTeamIds.add(match.home_team_id)
    if (match.away_team_id) sourceTeamIds.add(match.away_team_id)
  }

  if (sourceElement) {
    return teams.filter((team) => sourceTeamIds.has(team.id))
  }

  return []
}

function completedMatchWinner(match: Match, winner: boolean) {
  if (match.status !== 'completed') return null
  if (match.home_score === null || match.away_score === null) return null
  if (match.home_score === match.away_score) return null
  const homeWon = match.home_score > match.away_score
  if (winner) return homeWon ? match.home_team_id : match.away_team_id
  return homeWon ? match.away_team_id : match.home_team_id
}

export function resolvePhaseProgression(params: {
  targetPhase: PhaseWithScoring
  phases: PhaseWithScoring[]
  pools: PoolWithTeams[]
  elements: PhaseElement[]
  slots: ElementSlot[]
  rules: ProgressionRule[]
  teams: Team[]
  matches: Match[]
}): PhaseProgressionResolution[] {
  const phaseById = new Map(params.phases.map((phase) => [phase.id, phase]))
  const poolById = new Map(params.pools.map((pool) => [pool.id, pool]))
  const elementById = new Map(params.elements.map((element) => [element.id, element]))
  const slotById = new Map(params.slots.map((slot) => [slot.id, slot]))
  const teamById = new Map(params.teams.map((team) => [team.id, team]))
  const slotsByElement = new Map<string, ElementSlot[]>()

  for (const slot of params.slots) {
    const list = slotsByElement.get(slot.phase_element_id) ?? []
    list.push(slot)
    slotsByElement.set(slot.phase_element_id, list)
  }
  for (const list of slotsByElement.values()) {
    list.sort((a, b) => a.display_order - b.display_order)
  }

  return params.rules.map((rule) => {
    const targetElement = elementById.get(rule.to_element_id)
    const slot =
      (rule.to_slot_id ? slotById.get(rule.to_slot_id) : null) ??
      (targetElement && rule.to_slot_order
        ? (slotsByElement.get(targetElement.id) ?? []).find(
            (candidate) => candidate.display_order === rule.to_slot_order
          ) ?? null
        : null)

    const sourcePhase = rule.from_phase_id ? phaseById.get(rule.from_phase_id) : undefined
    const sourceElement = rule.from_element_id
      ? elementById.get(rule.from_element_id)
      : undefined
    const sourcePool = rule.from_pool_id ? poolById.get(rule.from_pool_id) : undefined
    const matches = sourceMatches(rule, params.matches)
    const incomplete = matches.some((match) => match.status !== 'completed')
    const targetLabel = slot
      ? slot.label || `${targetElement?.name ?? 'Target'} slot ${slot.display_order}`
      : `${targetElement?.name ?? 'Target'} slot ${rule.to_slot_order ?? '?'}`
    const sourceLabel =
      sourcePool?.name ??
      sourceElement?.name ??
      sourcePhase?.name ??
      (rule.from_match_id ? 'Selected match' : 'Manual source')

    if (!targetElement || targetElement.phase_id !== params.targetPhase.id) {
      return {
        rule,
        slot,
        team: null,
        label: `${sourceTypeLabel(rule.source_type)} -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: 'blocked',
        message: 'Rule target is not in this phase.',
      }
    }

    if (!slot) {
      return {
        rule,
        slot,
        team: null,
        label: `${sourceTypeLabel(rule.source_type)} -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: 'blocked',
        message: 'Target slot does not exist.',
      }
    }

    if (rule.source_type === 'manual') {
      return {
        rule,
        slot,
        team: null,
        label: `Manual -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: 'blocked',
        message: 'Manual progression rules are not auto-resolved.',
      }
    }

    if (matches.length === 0) {
      return {
        rule,
        slot,
        team: null,
        label: `${sourceTypeLabel(rule.source_type)} from ${sourceLabel} -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: 'blocked',
        message: 'No source matches were found.',
      }
    }

    if (rule.source_type === 'match_winner' || rule.source_type === 'match_loser') {
      const completed = matches.filter((match) => match.status === 'completed')
      if (completed.length !== 1) {
        return {
          rule,
          slot,
          team: null,
          label: `${sourceTypeLabel(rule.source_type)} from ${sourceLabel} -> ${targetLabel}`,
          sourceLabel,
          targetLabel,
          status: 'blocked',
          message: completed.length === 0 ? 'Source match is not complete.' : 'Source resolves to more than one completed match.',
        }
      }

      const teamId = completedMatchWinner(
        completed[0],
        rule.source_type === 'match_winner'
      )
      const team = teamId ? teamById.get(teamId) ?? null : null

      return {
        rule,
        slot,
        team,
        label: `${sourceTypeLabel(rule.source_type)} from ${sourceLabel} -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: team ? 'ready' : 'blocked',
        message: team ? 'Ready' : 'Source match is drawn or missing scores.',
      }
    }

    const sourceTeamRows = sourceTeams(
      rule,
      sourcePhase,
      sourceElement,
      sourcePool,
      params.teams,
      matches
    )

    if (sourceTeamRows.length === 0) {
      return {
        rule,
        slot,
        team: null,
        label: `${sourceTypeLabel(rule.source_type)} ${ordinal(rule.source_rank)} from ${sourceLabel} -> ${targetLabel}`,
        sourceLabel,
        targetLabel,
        status: 'blocked',
        message: 'No source teams were found.',
      }
    }

    const standings = calculateStandings(
      sourceTeamRows,
      matches,
      sourcePhase?.scoring_system ?? params.targetPhase.scoring_system ?? undefined
    )
    const row = standings.find((standing) => standing.position === (rule.source_rank ?? 1))
    const team = row?.team ?? null

    return {
      rule,
      slot,
      team,
      label: `${sourceTypeLabel(rule.source_type)} ${ordinal(rule.source_rank)} from ${sourceLabel} -> ${targetLabel}`,
      sourceLabel,
      targetLabel,
      status: team ? (incomplete ? 'warning' : 'ready') : 'blocked',
      message: team
        ? incomplete
          ? 'Source has incomplete matches; result may change.'
          : 'Ready'
        : `Could not find ${ordinal(rule.source_rank)} place in the source standings.`,
    }
  })
}
