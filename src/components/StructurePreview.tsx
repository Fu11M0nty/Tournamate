'use client'

import type {
  Division,
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
import { StatusCheck, buildStatusChecks } from '@/lib/structureValidation'

type PreviewPool = Pool & {
  pool_teams?: PoolTeam[]
}

type PreviewElement = PhaseElement & {
  slots?: ElementSlot[]
}

type PreviewPhase = Phase & {
  scoring_system?: ScoringSystem | null
  pools?: PreviewPool[]
  phase_elements?: PreviewElement[]
}

interface StructurePreviewProps {
  division: Division
  phases: PreviewPhase[]
  matches: Match[]
  teams: Team[]
  progressionRules: ProgressionRule[]
}

interface ProgressionPath {
  id: string
  sourcePhaseId: string | null
  sourcePhaseName: string
  targetPhaseName: string
  sourceLabel: string
  targetLabel: string
  ranks: number[]
  ruleCount: number
}

interface BracketMatch {
  id: string
  matchId: string | null
  phaseId: string
  elementId: string | null
  poolId: string | null
  title: string
  order: number
  homeTeamId: string | null
  awayTeamId: string | null
  homeLabel: string
  awayLabel: string
  homeResolved: boolean
  awayResolved: boolean
  homeScore: number | null
  awayScore: number | null
  homeProgressed: boolean
  awayProgressed: boolean
  status: Match['status'] | 'pending'
}

interface BracketConnector {
  id: string
  sourceId: string
  targetId: string
  targetSlotOrder: number | null
}

interface BracketRound {
  phase: PreviewPhase
  matches: BracketMatch[]
}

function formatPhaseType(type: Phase['phase_type']) {
  const labels: Record<Phase['phase_type'], string> = {
    round_robin: 'Round robin',
    group_stage: 'Group stage',
    knockout: 'Knockout',
    league: 'League table',
    friendly: 'Festival fixtures',
  }
  return labels[type] ?? type
}

function ordinal(value: number) {
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

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function phaseStatusLabel(phaseMatches: Match[]) {
  if (phaseMatches.length === 0) {
    return {
      label: 'No fixtures yet',
      className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
    }
  }

  const completedCount = phaseMatches.filter((match) => match.status === 'completed').length
  const placeholderCount = phaseMatches.filter(
    (match) => !match.home_team_id || !match.away_team_id
  ).length

  if (completedCount === phaseMatches.length) {
    return {
      label: 'Complete',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    }
  }

  if (completedCount > 0) {
    return {
      label: 'In progress',
      className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    }
  }

  if (placeholderCount > 0) {
    return {
      label: 'Placeholders ready',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    }
  }

  return {
    label: 'Scheduled',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  }
}

function matchSummary(phaseMatches: Match[]) {
  const placeholderCount = phaseMatches.filter(
    (match) => !match.home_team_id || !match.away_team_id
  ).length
  const completedCount = phaseMatches.filter((match) => match.status === 'completed').length
  const scheduledCount = phaseMatches.length - completedCount

  return {
    total: phaseMatches.length,
    completedCount,
    scheduledCount,
    placeholderCount,
  }
}

function buildProgressionPaths(
  phases: PreviewPhase[],
  progressionRules: ProgressionRule[]
) {
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]))
  const pools = phases.flatMap((phase) => phase.pools ?? [])
  const elements = phases.flatMap((phase) => phase.phase_elements ?? [])
  const poolById = new Map(pools.map((pool) => [pool.id, pool]))
  const elementById = new Map(elements.map((element) => [element.id, element]))
  const phaseIds = new Set(phases.map((phase) => phase.id))
  const elementIds = new Set(elements.map((element) => element.id))
  const poolIds = new Set(pools.map((pool) => pool.id))
  const grouped = new Map<string, ProgressionPath>()

  for (const rule of progressionRules) {
    const targetElement = elementById.get(rule.to_element_id)
    const sourcePool = poolById.get(rule.from_pool_id ?? '')
    const sourceElement = elementById.get(rule.from_element_id ?? '')
    const sourcePhase =
      phaseById.get(rule.from_phase_id ?? '') ??
      phaseById.get(sourcePool?.phase_id ?? '') ??
      phaseById.get(sourceElement?.phase_id ?? '')
    const targetPhase =
      phaseById.get(rule.to_phase_id ?? '') ??
      phaseById.get(targetElement?.phase_id ?? '')

    const belongsToDivision =
      phaseIds.has(rule.from_phase_id ?? '') ||
      phaseIds.has(rule.to_phase_id ?? '') ||
      elementIds.has(rule.from_element_id ?? '') ||
      elementIds.has(rule.to_element_id) ||
      poolIds.has(rule.from_pool_id ?? '')

    if (!belongsToDivision) continue

    const sourceLabel =
      sourcePool?.name ??
      sourceElement?.name ??
      sourcePhase?.name ??
      'Manual source'
    const targetLabel = targetElement?.name ?? targetPhase?.name ?? 'Target slot'
    const sourcePhaseName = sourcePhase?.name ?? sourceLabel
    const targetPhaseName = targetPhase?.name ?? targetLabel
    const key = [
      sourcePhase?.id ?? 'manual',
      sourceLabel,
      targetPhase?.id ?? 'target',
      targetLabel,
    ].join('|')

    const existing =
      grouped.get(key) ??
      {
        id: key,
        sourcePhaseId: sourcePhase?.id ?? null,
        sourcePhaseName,
        targetPhaseName,
        sourceLabel,
        targetLabel,
        ranks: [],
        ruleCount: 0,
      }

    if (rule.source_rank && !existing.ranks.includes(rule.source_rank)) {
      existing.ranks.push(rule.source_rank)
    }
    existing.ruleCount += 1
    grouped.set(key, existing)
  }

  return Array.from(grouped.values()).map((path) => ({
    ...path,
    ranks: path.ranks.sort((a, b) => a - b),
  }))
}

function describeProgression(path: ProgressionPath) {
  const ranks =
    path.ranks.length > 0
      ? path.ranks.map(ordinal).join(', ')
      : `${path.ruleCount} qualifier${path.ruleCount === 1 ? '' : 's'}`

  return `${path.sourceLabel} ${ranks} -> ${path.targetPhaseName}`
}

function formatSourceRuleLabel(
  rule: ProgressionRule | undefined,
  poolById: Map<string, Pool>,
  elementById: Map<string, PhaseElement>
) {
  if (!rule) return 'TBD'
  const source =
    poolById.get(rule.from_pool_id ?? '')?.name ??
    elementById.get(rule.from_element_id ?? '')?.name ??
    'previous fixture'

  if (rule.source_type === 'match_winner') return `Winner of ${source}`
  if (rule.source_type === 'match_loser') return `Loser of ${source}`
  if (rule.source_type === 'best_rank') return `Best ${ordinal(rule.source_rank ?? 1)}`
  if (rule.source_type === 'standings_rank') {
    return `${ordinal(rule.source_rank ?? 1)} from ${source}`
  }
  return source
}

function buildKnockoutBracket(
  phases: PreviewPhase[],
  matches: Match[],
  teams: Team[],
  progressionRules: ProgressionRule[]
): { rounds: BracketRound[]; connectors: BracketConnector[] } {
  const knockoutPhases = phases
    .filter((phase) => phase.phase_type === 'knockout')
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))

  if (knockoutPhases.length === 0) {
    return { rounds: [], connectors: [] }
  }

  const pools = phases.flatMap((phase) => phase.pools ?? [])
  const elements = phases.flatMap((phase) => phase.phase_elements ?? [])
  const slots = elements.flatMap((element) => element.slots ?? [])
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const poolById = new Map(pools.map((pool) => [pool.id, pool]))
  const elementById = new Map(elements.map((element) => [element.id, element]))
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const rulesBySlot = new Map<string, ProgressionRule>()
  const rulesByElementOrder = new Map<string, ProgressionRule>()

  for (const rule of progressionRules) {
    if (rule.to_slot_id) rulesBySlot.set(rule.to_slot_id, rule)
    if (rule.to_slot_order) {
      rulesByElementOrder.set(`${rule.to_element_id}:${rule.to_slot_order}`, rule)
    }
  }

  function slotLabel(slot: ElementSlot | null, fallback: string) {
    if (!slot) return fallback
    if (slot.team_id) return teamById.get(slot.team_id)?.name ?? slot.label ?? fallback
    const rule =
      rulesBySlot.get(slot.id) ??
      rulesByElementOrder.get(`${slot.phase_element_id}:${slot.display_order}`)
    return slot.label ?? formatSourceRuleLabel(rule, poolById, elementById)
  }

  function side(match: Match | undefined, teamId: string | null | undefined, slotId: string | null | undefined, fallback: string) {
    if (teamId) return { label: teamById.get(teamId)?.name ?? fallback, resolved: true }
    const slot = slotId ? slotById.get(slotId) ?? null : null
    if (slot?.team_id) {
      return {
        label: teamById.get(slot.team_id)?.name ?? slot.label ?? fallback,
        resolved: true,
      }
    }
    if (slot) return { label: slotLabel(slot, fallback), resolved: false }
    if (match) return { label: fallback, resolved: false }
    return { label: fallback, resolved: false }
  }

  const rounds = knockoutPhases.map((phase) => {
    const phaseElements = (phase.phase_elements ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    const phasePools = (phase.pools ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    const phaseMatches = matches.filter((match) => match.phase_id === phase.id)

    const blocks: BracketMatch[] = []
    const blockSources =
      phaseElements.length > 0
        ? phaseElements.map((element) => ({
            id: element.id,
            element,
            pool: element.pool_id ? poolById.get(element.pool_id) ?? null : null,
            order: element.display_order,
            title: element.name,
          }))
        : phasePools.map((pool) => ({
            id: pool.id,
            element: null,
            pool,
            order: pool.display_order,
            title: pool.name,
          }))

    for (const source of blockSources) {
      const match = phaseMatches.find((candidate) =>
        source.element
          ? candidate.phase_element_id === source.element.id
          : candidate.pool_id === source.pool?.id
      )
      const sourceSlots = source.element?.slots?.slice().sort(
        (a, b) => a.display_order - b.display_order
      ) ?? []
      const homeSlot = match?.home_slot_id
        ? slotById.get(match.home_slot_id) ?? null
        : sourceSlots[0] ?? null
      const awaySlot = match?.away_slot_id
        ? slotById.get(match.away_slot_id) ?? null
        : sourceSlots[1] ?? null
      const home = side(match, match?.home_team_id, homeSlot?.id, 'TBD')
      const away = side(match, match?.away_team_id, awaySlot?.id, 'TBD')
      const isCompletedWithScore =
        match?.status === 'completed' &&
        match.home_score !== null &&
        match.away_score !== null
      const homeProgressed = Boolean(isCompletedWithScore && match.home_score! > match.away_score!)
      const awayProgressed = Boolean(isCompletedWithScore && match.away_score! > match.home_score!)

      blocks.push({
        id: source.id,
        matchId: match?.id ?? null,
        phaseId: phase.id,
        elementId: source.element?.id ?? null,
        poolId: source.pool?.id ?? null,
        title: source.title,
        order: source.order,
        homeTeamId: match?.home_team_id ?? homeSlot?.team_id ?? null,
        awayTeamId: match?.away_team_id ?? awaySlot?.team_id ?? null,
        homeLabel: home.label,
        awayLabel: away.label,
        homeResolved: home.resolved,
        awayResolved: away.resolved,
        homeScore: match?.home_score ?? null,
        awayScore: match?.away_score ?? null,
        homeProgressed,
        awayProgressed,
        status: match?.status ?? 'pending',
      })
    }

    return {
      phase,
      matches: blocks.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }
  }).filter((round) => round.matches.length > 0)

  const matchByElementId = new Map<string, BracketMatch>()
  const matchByPoolId = new Map<string, BracketMatch>()
  const matchByFixtureId = new Map<string, BracketMatch>()
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.elementId) matchByElementId.set(match.elementId, match)
      if (match.poolId) matchByPoolId.set(match.poolId, match)
      if (match.matchId) matchByFixtureId.set(match.matchId, match)
    }
  }

  const connectorKeys = new Set<string>()
  const connectors: BracketConnector[] = []

  function addConnector(
    source: BracketMatch | undefined,
    target: BracketMatch | undefined,
    targetSlotOrder: number | null
  ) {
    if (!source || !target || source.id === target.id) return
    const key = `${source.id}->${target.id}:${targetSlotOrder ?? 'slot'}`
    if (connectorKeys.has(key)) return
    connectorKeys.add(key)
    connectors.push({
      id: key,
      sourceId: source.id,
      targetId: target.id,
      targetSlotOrder,
    })
  }

  for (const rule of progressionRules) {
    if (rule.source_type !== 'match_winner' && rule.source_type !== 'match_loser') {
      continue
    }

    const source =
      matchByElementId.get(rule.from_element_id ?? '') ??
      matchByPoolId.get(rule.from_pool_id ?? '') ??
      matchByFixtureId.get(rule.from_match_id ?? '')
    const target = matchByElementId.get(rule.to_element_id)
    addConnector(source, target, rule.to_slot_order ?? null)
  }

  for (const round of rounds) {
    for (const target of round.matches) {
      const targetElement = target.elementId ? elementById.get(target.elementId) : null
      const targetSlots = (targetElement?.slots ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)

      for (const slot of targetSlots) {
        const source =
          matchByElementId.get(slot.source_element_id ?? '') ??
          matchByPoolId.get(slot.source_pool_id ?? '') ??
          matchByFixtureId.get(slot.source_match_id ?? '')
        addConnector(source, target, slot.display_order)
      }
    }
  }

  return { rounds, connectors }
}

function KnockoutBracketPreview({
  phases,
  matches,
  teams,
  progressionRules,
}: {
  phases: PreviewPhase[]
  matches: Match[]
  teams: Team[]
  progressionRules: ProgressionRule[]
}) {
  const { rounds, connectors } = buildKnockoutBracket(
    phases,
    matches,
    teams,
    progressionRules
  )
  if (rounds.length === 0) return null

  const cardHeight = 104
  const cardWidth = 236
  const columnGap = 92
  const rowGap = 24
  const headerHeight = 34
  const cardTitleHeight = 24
  const entrantRowHeight = 34
  const sidePadding = 20
  const bottomPadding = 24
  const minStep = cardHeight + rowGap
  const positionById = new Map<string, { x: number; y: number }>()
  const bracketMatchById = new Map(
    rounds.flatMap((round) => round.matches.map((match) => [match.id, match] as const))
  )

  function entrantCenterY(cardY: number, slotOrder: number | null) {
    if (slotOrder === 1 || slotOrder === 2) {
      return cardY + cardTitleHeight + (slotOrder - 0.5) * entrantRowHeight
    }
    return cardY + cardHeight / 2
  }

  for (const [roundIndex, round] of rounds.entries()) {
    const x = sidePadding + roundIndex * (cardWidth + columnGap)
    const incomingByTarget = new Map<string, BracketConnector[]>()
    for (const connector of connectors) {
      if (!round.matches.some((match) => match.id === connector.targetId)) continue
      const list = incomingByTarget.get(connector.targetId) ?? []
      list.push(connector)
      incomingByTarget.set(connector.targetId, list)
    }

    const proposed = round.matches.map((match, matchIndex) => {
      const incoming = incomingByTarget.get(match.id) ?? []
      const targetOffsets = incoming
        .map((connector) =>
          connector.targetSlotOrder === 1 || connector.targetSlotOrder === 2
            ? cardTitleHeight + (connector.targetSlotOrder - 0.5) * entrantRowHeight
            : cardHeight / 2
        )
      const sourceCenters = incoming
        .map((connector) => positionById.get(connector.sourceId))
        .filter((position): position is { x: number; y: number } => Boolean(position))
        .map((position) => position.y + cardHeight / 2)
      const sourceCenter =
        sourceCenters.length > 0
          ? sourceCenters.reduce((total, value) => total + value, 0) / sourceCenters.length
          : null
      const targetOffset =
        targetOffsets.length > 0
          ? targetOffsets.reduce((total, value) => total + value, 0) / targetOffsets.length
          : cardHeight / 2

      return {
        match,
        y:
          sourceCenter !== null
            ? sourceCenter - targetOffset
            : headerHeight + matchIndex * minStep,
      }
    })

    proposed.sort((a, b) => a.y - b.y || a.match.order - b.match.order)
    let nextY = headerHeight
    for (const item of proposed) {
      const y = Math.max(item.y, nextY)
      positionById.set(item.match.id, { x, y })
      nextY = y + minStep
    }
  }

  const boardWidth =
    sidePadding * 2 + rounds.length * cardWidth + (rounds.length - 1) * columnGap
  const boardHeight =
    Math.max(
      ...Array.from(positionById.values()).map((position) => position.y + cardHeight),
      headerHeight + cardHeight
    ) + bottomPadding

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Knockout bracket
          </h5>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Visual progression through knockout rounds. Resolved slots show the team name; unresolved slots show their source.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {rounds.length} round{rounds.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className="relative min-w-max"
          style={{
            width: boardWidth,
            height: boardHeight,
            backgroundImage:
              'radial-gradient(circle, rgba(113,113,122,0.25) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            width={boardWidth}
            height={boardHeight}
          >
            {connectors.map((connector) => {
              const source = positionById.get(connector.sourceId)
              const target = positionById.get(connector.targetId)
              const sourceMatch = bracketMatchById.get(connector.sourceId)
              if (!source || !target) return null
              const startX = source.x + cardWidth
              const startY = entrantCenterY(
                source.y,
                sourceMatch?.homeProgressed ? 1 : sourceMatch?.awayProgressed ? 2 : null
              )
              const endX = target.x
              const endY = entrantCenterY(target.y, connector.targetSlotOrder)
              const midX = startX + Math.max(24, (endX - startX) / 2)

              return (
                <path
                  key={connector.id}
                  d={`M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-zinc-400 dark:text-zinc-600"
                />
              )
            })}
          </svg>

          {rounds.map((round, roundIndex) => {
            const x = sidePadding + roundIndex * (cardWidth + columnGap)
            return (
              <p
                key={round.phase.id}
                className="absolute top-0 z-10 rounded bg-zinc-100 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                style={{ left: x, width: cardWidth }}
              >
                {round.phase.name}
              </p>
            )
          })}

          {rounds.flatMap((round) =>
            round.matches.map((match) => {
              const position = positionById.get(match.id)
              if (!position) return null
              return (
                <div
                  key={match.id}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: cardWidth,
                    height: cardHeight,
                  }}
                >
                  <div className="flex h-full flex-col overflow-hidden rounded-md border border-emerald-600 bg-white shadow-sm dark:border-emerald-700 dark:bg-zinc-950">
                    <div className="shrink-0 bg-emerald-600 px-2 py-1 text-center text-[10px] font-bold text-white dark:bg-emerald-700">
                      {match.title}
                    </div>
                    <div className="min-h-0 flex-1 divide-y divide-zinc-100 px-2 dark:divide-zinc-800">
                      <p
                        className={[
                          'flex h-[34px] items-center justify-between gap-2 text-xs',
                          match.homeProgressed
                            ? 'font-bold text-emerald-800 dark:text-emerald-300'
                            : match.status === 'completed' && match.awayProgressed
                              ? 'text-zinc-400 dark:text-zinc-600'
                              : match.homeResolved
                                ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                                : 'text-zinc-500 dark:text-zinc-400',
                        ].join(' ')}
                      >
                        <span className="truncate">{match.homeLabel}</span>
                        {match.homeScore !== null && (
                          <span className="shrink-0 tabular-nums">{match.homeScore}</span>
                        )}
                      </p>
                      <p
                        className={[
                          'flex h-[34px] items-center justify-between gap-2 text-xs',
                          match.awayProgressed
                            ? 'font-bold text-emerald-800 dark:text-emerald-300'
                            : match.status === 'completed' && match.homeProgressed
                              ? 'text-zinc-400 dark:text-zinc-600'
                              : match.awayResolved
                                ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                                : 'text-zinc-500 dark:text-zinc-400',
                        ].join(' ')}
                      >
                        <span className="truncate">{match.awayLabel}</span>
                        {match.awayScore !== null && (
                          <span className="shrink-0 tabular-nums">{match.awayScore}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function StructurePreview({
  division,
  phases,
  matches,
  teams,
  progressionRules,
}: StructurePreviewProps) {
  const sortedPhases = [...phases].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  )
  const phaseIds = new Set(sortedPhases.map((phase) => phase.id))
  const divisionMatches = matches.filter((match) => phaseIds.has(match.phase_id ?? ''))
  const progressionPaths = buildProgressionPaths(sortedPhases, progressionRules)
  const placeholderCount = divisionMatches.filter(
    (match) => !match.home_team_id || !match.away_team_id
  ).length
  const statusChecks = buildStatusChecks(
    sortedPhases,
    teams,
    divisionMatches,
    progressionRules
  )
  const issueCount = statusChecks.filter((check) => !check.ok).length

  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Format preview
          </h4>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Plain-language view of how {division.name} is built and how teams move through it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {teams.length} team{teams.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {divisionMatches.length} fixture{divisionMatches.length === 1 ? '' : 's'}
          </span>
          {placeholderCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {placeholderCount} waiting for qualifiers
            </span>
          )}
          <span
            className={
              issueCount === 0
                ? 'rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }
          >
            {issueCount === 0 ? 'Checks passed' : `${issueCount} check${issueCount === 1 ? '' : 's'} need attention`}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-4">
          {sortedPhases.map((phase, index) => {
            const pools = phase.pools ?? []
            const elements = phase.phase_elements ?? []
            const phaseMatches = divisionMatches.filter((match) => match.phase_id === phase.id)
            const status = phaseStatusLabel(phaseMatches)
            const summary = matchSummary(phaseMatches)
            const outgoingPaths = progressionPaths.filter(
              (path) => path.sourcePhaseId === phase.id
            )
            const visiblePools = uniqueById([
              ...pools,
              ...elements
                .map((element) => pools.find((pool) => pool.id === element.pool_id))
                .filter((pool): pool is PreviewPool => Boolean(pool)),
            ])

            return (
              <article
                key={phase.id}
                className="flex w-80 flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {phase.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Step {index + 1} - {formatPhaseType(phase.phase_type)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                      {visiblePools.length}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Pools
                    </p>
                  </div>
                  <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                      {summary.total}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Fixtures
                    </p>
                  </div>
                  <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                      {elements.reduce((total, element) => total + (element.slots?.length ?? 0), 0)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Slots
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {visiblePools.length > 0 ? (
                    visiblePools.slice(0, 5).map((pool) => {
                      const poolMatches = phaseMatches.filter((match) => match.pool_id === pool.id)
                      const linkedElement = elements.find((element) => element.pool_id === pool.id)
                      const teamCount = pool.pool_teams?.length ?? 0
                      const slotCount = linkedElement?.slots?.length ?? 0

                      return (
                        <div
                          key={pool.id}
                          className="rounded-md border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-50">
                              {pool.name}
                            </p>
                            <span className="shrink-0 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                              {teamCount} team{teamCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {poolMatches.length} fixture{poolMatches.length === 1 ? '' : 's'}
                            {slotCount > 0 ? ` - ${slotCount} entry slot${slotCount === 1 ? '' : 's'}` : ''}
                          </p>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                      No pools or fixture blocks have been configured yet.
                    </div>
                  )}
                  {visiblePools.length > 5 && (
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      + {visiblePools.length - 5} more pool{visiblePools.length - 5 === 1 ? '' : 's'}
                    </p>
                  )}
                </div>

                <div className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <p>
                    {summary.completedCount} complete, {summary.scheduledCount} scheduled
                    {summary.placeholderCount > 0
                      ? `, ${summary.placeholderCount} placeholder${summary.placeholderCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                  {outgoingPaths.length > 0 ? (
                    <div className="mt-2 rounded-md bg-white px-2 py-1.5 dark:bg-zinc-950">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Feeds
                      </p>
                      <p className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">
                        {Array.from(new Set(outgoingPaths.map((path) => path.targetPhaseName))).join(', ')}
                      </p>
                    </div>
                  ) : index < sortedPhases.length - 1 ? (
                    <p className="mt-1">No automatic progression configured from this stage.</p>
                  ) : (
                    <p className="mt-1">Final stage in this division.</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <KnockoutBracketPreview
        phases={sortedPhases}
        matches={divisionMatches}
        teams={teams}
        progressionRules={progressionRules}
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Qualification paths
          </h5>
          {progressionPaths.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No automatic qualification paths have been configured yet.
            </p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {progressionPaths.slice(0, 8).map((path) => (
                <div
                  key={path.id}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {describeProgression(path)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    From {path.sourcePhaseName} to {path.targetLabel}
                  </p>
                </div>
              ))}
              {progressionPaths.length > 8 && (
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  + {progressionPaths.length - 8} more path{progressionPaths.length - 8 === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Validation status
          </h5>
          <div className="mt-2 space-y-2">
            {statusChecks.map((check) => (
              <div
                key={check.id}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={
                      check.ok
                        ? 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }
                  >
                    {check.ok ? 'OK' : '!'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {check.label}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {check.message}
                    </p>
                    {!check.ok && check.detail && (
                      <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                        {check.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
