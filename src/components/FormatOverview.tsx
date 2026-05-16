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
import { buildReadyChecks, ordinal } from '@/lib/structureValidation'

type PoolWithTeams = Pool & { pool_teams?: PoolTeam[] }
type PhaseElementWithSlots = PhaseElement & { slots?: ElementSlot[] }
type PhaseWithPools = Phase & {
  scoring_system?: ScoringSystem | null
  pools?: PoolWithTeams[]
  phase_elements?: PhaseElementWithSlots[]
}

type QualificationSentence = {
  id: string
  text: string
  detail: string
  warning?: boolean
  phaseOrder: number
  elementOrder: number
}

export function formatPhaseType(type: Phase['phase_type']): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatSummaryLabel(phases: PhaseWithPools[]): string {
  if (phases.length === 0) return 'No format selected'

  const typeLabels = Array.from(
    new Set(phases.map((phase) => formatPhaseType(phase.phase_type)))
  )
  if (typeLabels.length === 1) return typeLabels[0]
  if (typeLabels.length === 2) return `${typeLabels[0]} + ${typeLabels[1]}`
  return `${typeLabels.slice(0, -1).join(' + ')} + ${typeLabels[typeLabels.length - 1]}`
}

function formatStagePath(phases: PhaseWithPools[]): string {
  if (phases.length === 0) return 'Choose a format to create stages.'
  if (phases.length <= 4) return phases.map((phase) => phase.name).join(' -> ')
  return `${phases.slice(0, 3).map((phase) => phase.name).join(' -> ')} -> ${phases[phases.length - 1].name}`
}

function ReadinessChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={
        ok
          ? 'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300'
      }
    >
      <span
        aria-hidden="true"
        className={ok ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-amber-500'}
      />
      {label}
    </span>
  )
}

export function FormatOverviewCard({
  division,
  phases,
  teams,
  matches,
  relevantRuleCount,
}: {
  division: Division
  phases: PhaseWithPools[]
  teams: Team[]
  matches: Match[]
  relevantRuleCount: number
}) {
  const poolCount = phases.reduce(
    (total, phase) => total + (phase.pools?.length ?? 0),
    0
  )
  const placeholderCount = matches.filter(
    (match) => !match.home_team_id || !match.away_team_id
  ).length
  const plannedCount = matches.filter((match) => match.is_planned).length
  const completedCount = matches.filter((match) => match.status === 'completed').length
  const hasQualification = placeholderCount === 0 || relevantRuleCount > 0
  const hasFixtures = matches.length > 0
  const hasPublicFixtures = matches.some((match) => match.is_planned)

  return (
    <section className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Format overview
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {division.name} format
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {teams.length} teams - {poolCount} pool{poolCount === 1 ? '' : 's'} - {formatSummaryLabel(phases)} - {matches.length} fixture{matches.length === 1 ? '' : 's'}
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {formatStagePath(phases)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:shrink-0">
            <div className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-950">
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{phases.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Stages</p>
            </div>
            <div className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-950">
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{poolCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pools</p>
            </div>
            <div className="rounded-md bg-white px-3 py-2 shadow-sm dark:bg-zinc-950">
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{matches.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Fixtures</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ReadinessChip label={teams.length > 0 ? 'Teams added' : 'Add teams'} ok={teams.length > 0} />
          <ReadinessChip label={hasFixtures ? 'Fixtures generated' : 'Generate fixtures'} ok={hasFixtures} />
          <ReadinessChip label={hasQualification ? 'Qualification ready' : 'Set qualification'} ok={hasQualification} />
          <ReadinessChip label={plannedCount > 0 ? 'Schedule started' : 'Not scheduled'} ok={plannedCount > 0} />
          <ReadinessChip label={hasPublicFixtures ? 'Public fixtures visible' : 'Public fixtures hidden'} ok={hasPublicFixtures} />
        </div>

        {(placeholderCount > 0 || completedCount > 0) && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {placeholderCount > 0
              ? `${placeholderCount} fixture${placeholderCount === 1 ? '' : 's'} will be filled by qualification results.`
              : 'All fixture teams are known.'}
            {completedCount > 0 ? ` ${completedCount} fixture${completedCount === 1 ? '' : 's'} already completed.` : ''}
          </p>
        )}
      </div>
    </section>
  )
}

export function FormatTimeline({
  phases,
  matches,
  progressionRules,
  onEditStage,
}: {
  phases: PhaseWithPools[]
  matches: Match[]
  progressionRules: ProgressionRule[]
  onEditStage: (phase: PhaseWithPools) => void
}) {
  const sortedPhases = [...phases].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  )
  const phaseById = new Map(sortedPhases.map((phase) => [phase.id, phase]))
  const poolById = new Map(
    sortedPhases.flatMap((phase) => (phase.pools ?? []).map((pool) => [pool.id, pool] as const))
  )
  const elementById = new Map(
    sortedPhases.flatMap((phase) =>
      (phase.phase_elements ?? []).map((element) => [element.id, element] as const)
    )
  )

  function sourcePhaseForRule(rule: ProgressionRule) {
    return (
      phaseById.get(rule.from_phase_id ?? '') ??
      phaseById.get(poolById.get(rule.from_pool_id ?? '')?.phase_id ?? '') ??
      phaseById.get(elementById.get(rule.from_element_id ?? '')?.phase_id ?? '') ??
      null
    )
  }

  function targetPhaseForRule(rule: ProgressionRule) {
    return (
      phaseById.get(rule.to_phase_id ?? '') ??
      phaseById.get(elementById.get(rule.to_element_id)?.phase_id ?? '') ??
      null
    )
  }

  if (sortedPhases.length === 0) {
    return (
      <section className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Choose a format to see the competition timeline.
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
            Format timeline
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            A plain-English view of how teams move through this division.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-3">
          {sortedPhases.map((phase, index) => {
            const phaseMatches = matches.filter((match) => match.phase_id === phase.id)
            const completedCount = phaseMatches.filter((match) => match.status === 'completed').length
            const placeholderCount = phaseMatches.filter(
              (match) => !match.home_team_id || !match.away_team_id
            ).length
            const outgoingTargets = Array.from(
              new Set(
                progressionRules
                  .filter((rule) => sourcePhaseForRule(rule)?.id === phase.id)
                  .map((rule) => targetPhaseForRule(rule)?.name)
                  .filter((name): name is string => Boolean(name))
              )
            )
            const incomingRuleCount = progressionRules.filter(
              (rule) => targetPhaseForRule(rule)?.id === phase.id
            ).length
            const qualificationText =
              outgoingTargets.length > 0
                ? `Qualifies into ${outgoingTargets.join(', ')}`
                : index === sortedPhases.length - 1
                  ? 'Decides the final outcome'
                  : 'No automatic qualification set'
            const sourceText =
              incomingRuleCount > 0
                ? `${incomingRuleCount} qualifier path${incomingRuleCount === 1 ? '' : 's'} feed this stage`
                : index === 0
                  ? 'Starts with assigned teams'
                  : 'Uses manually assigned teams'

            return (
              <div key={phase.id} className="flex items-center gap-3">
                <article className="w-72 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Step {index + 1}
                      </p>
                      <h4 className="mt-1 truncate font-bold text-zinc-900 dark:text-zinc-50">
                        {phase.name}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditStage(phase)}
                      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {formatPhaseType(phase.phase_type)}
                    </span>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {phase.standings_mode === 'none' ? 'No standings' : `${phase.standings_mode} standings`}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{phase.pools?.length ?? 0}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pools</p>
                    </div>
                    <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{phaseMatches.length}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Fixtures</p>
                    </div>
                    <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-950">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{completedCount}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Played</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <p>{sourceText}</p>
                    <p>{qualificationText}</p>
                    {placeholderCount > 0 && (
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        {placeholderCount} fixture{placeholderCount === 1 ? '' : 's'} waiting for qualifiers
                      </p>
                    )}
                  </div>
                </article>

                {index < sortedPhases.length - 1 && (
                  <div className="flex h-full items-center text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                    <svg className="h-6 w-8" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12h22" />
                      <path d="M20 6l6 6-6 6" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function QualificationSummary({
  phases,
  matches,
  progressionRules,
}: {
  phases: PhaseWithPools[]
  matches: Match[]
  progressionRules: ProgressionRule[]
}) {
  const sortedPhases = [...phases].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  )
  const phaseIds = new Set(sortedPhases.map((phase) => phase.id))
  const phaseById = new Map(sortedPhases.map((phase) => [phase.id, phase]))
  const poolById = new Map(
    sortedPhases.flatMap((phase) => (phase.pools ?? []).map((pool) => [pool.id, pool] as const))
  )
  const elementById = new Map(
    sortedPhases.flatMap((phase) =>
      (phase.phase_elements ?? []).map((element) => [element.id, element] as const)
    )
  )
  const matchById = new Map(matches.map((match) => [match.id, match]))

  function ruleTargetPhase(rule: ProgressionRule) {
    return (
      phaseById.get(rule.to_phase_id ?? '') ??
      phaseById.get(elementById.get(rule.to_element_id)?.phase_id ?? '') ??
      null
    )
  }

  function sourceFixtureName(match: Match | undefined) {
    if (!match) return 'previous fixture'
    return (
      elementById.get(match.phase_element_id ?? '')?.name ??
      poolById.get(match.pool_id ?? '')?.name ??
      phaseById.get(match.phase_id ?? '')?.name ??
      'previous fixture'
    )
  }

  function sourceNameForRule(rule: ProgressionRule) {
    const sourcePool = poolById.get(rule.from_pool_id ?? '')
    const sourceElement = elementById.get(rule.from_element_id ?? '')
    const sourcePhase = phaseById.get(rule.from_phase_id ?? '')
    const sourceMatch = matchById.get(rule.from_match_id ?? '')

    if (rule.source_type === 'match_winner') {
      const sourceName = sourceMatch
        ? sourceFixtureName(sourceMatch)
        : sourceElement?.name ?? sourcePool?.name ?? sourcePhase?.name ?? 'previous fixture'
      return `Winner of ${sourceName}`
    }

    if (rule.source_type === 'match_loser') {
      const sourceName = sourceMatch
        ? sourceFixtureName(sourceMatch)
        : sourceElement?.name ?? sourcePool?.name ?? sourcePhase?.name ?? 'previous fixture'
      return `Loser of ${sourceName}`
    }

    if (rule.source_type === 'best_rank') {
      const sourceName = sourcePhase?.name ?? sourceElement?.name ?? 'all qualifying pools'
      return `Best ${ordinal(rule.source_rank)} placed team from ${sourceName}`
    }

    if (rule.source_type === 'standings_rank') {
      const sourceName = sourcePool?.name ?? sourceElement?.name ?? sourcePhase?.name ?? 'standings'
      return `${ordinal(rule.source_rank)} from ${sourceName}`
    }

    return sourcePool?.name ?? sourceElement?.name ?? sourcePhase?.name ?? 'Manual qualifier'
  }

  const relevantRules = progressionRules.filter((rule) => {
    const targetPhase = ruleTargetPhase(rule)
    return targetPhase ? phaseIds.has(targetPhase.id) : false
  })

  const rulesByTarget = new Map<string, ProgressionRule[]>()
  for (const rule of relevantRules) {
    const key = rule.to_element_id || rule.to_phase_id || rule.id
    const list = rulesByTarget.get(key) ?? []
    list.push(rule)
    rulesByTarget.set(key, list)
  }

  const sentences: QualificationSentence[] = Array.from(rulesByTarget.entries())
    .map(([targetId, rules]) => {
      const targetElement = elementById.get(targetId)
      const targetPhase = targetElement ? phaseById.get(targetElement.phase_id) : ruleTargetPhase(rules[0])
      const targetName = targetElement?.name ?? targetPhase?.name ?? 'the next stage'
      const sortedRules = [...rules].sort(
        (a, b) =>
          (a.to_slot_order ?? 999) - (b.to_slot_order ?? 999) ||
          a.display_order - b.display_order
      )
      const sources = sortedRules.map(sourceNameForRule)
      const missingTarget = !targetElement && !targetPhase
      const text =
        sources.length === 1
          ? `${sources[0]} qualifies for ${targetName}.`
          : sources.length === 2
            ? `${sources[0]} plays ${sources[1]} in ${targetName}.`
            : `${sources.join(', ')} feed ${targetName}.`

      return {
        id: targetId,
        text: missingTarget ? 'Some qualifiers do not have a destination yet.' : text,
        detail: targetPhase
          ? `Destination: ${targetPhase.name}${targetElement ? ` / ${targetElement.name}` : ''}`
          : 'Choose where this qualifier should go.',
        warning: missingTarget,
        phaseOrder: targetPhase?.display_order ?? 999,
        elementOrder: targetElement?.display_order ?? 999,
      }
    })
    .sort((a, b) => a.phaseOrder - b.phaseOrder || a.elementOrder - b.elementOrder)

  if (sortedPhases.length === 0) {
    return (
      <section className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Choose a format to see qualification paths.
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
            Qualification
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Plain-English routes showing who moves into each future fixture.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {sentences.length} path{sentences.length === 1 ? '' : 's'}
        </span>
      </div>

      {sentences.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No automatic qualification paths have been configured yet. Teams can still be assigned manually.
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {sentences.map((sentence) => (
            <article
              key={sentence.id}
              className={
                sentence.warning
                  ? 'rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50'
                  : 'rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900'
              }
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {sentence.text}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {sentence.detail}
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Need to change these routes? Use the detailed setup below until the focused qualification editor is added.
      </p>
    </section>
  )
}

export function ReadyChecksPanel({
  phases,
  teams,
  matches,
  progressionRules,
  onOpenAdvanced,
}: {
  phases: PhaseWithPools[]
  teams: Team[]
  matches: Match[]
  progressionRules: ProgressionRule[]
  onOpenAdvanced?: () => void
}) {
  const checks = buildReadyChecks({ phases, teams, matches, progressionRules })
  const issueCount = checks.filter((check) => !check.ok && check.status !== 'info').length
  const infoCount = checks.filter((check) => check.status === 'info').length

  return (
    <section className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
            Ready checks
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            The practical checks an organiser needs before publishing or running this division.
          </p>
        </div>
        <span
          className={
            issueCount === 0
              ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }
        >
          {issueCount === 0
            ? infoCount > 0
              ? `${infoCount} waiting`
              : 'Ready'
            : `${issueCount} to check`}
        </span>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {checks.map((check) => (
          <article
            key={check.id}
            className={
              check.status === 'info'
                ? 'rounded-lg border border-sky-300 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40'
                : check.ok
                ? 'rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900'
                : 'rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40'
            }
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={
                  check.status === 'info'
                    ? 'mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500'
                    : check.ok
                    ? 'mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500'
                    : 'mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500'
                }
              />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {check.label}
                </h4>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                  {check.message}
                </p>
                {check.detail && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {check.detail}
                  </p>
                )}
                {!check.ok && (
                  onOpenAdvanced ? (
                    <button
                      type="button"
                      onClick={onOpenAdvanced}
                      className={
                        check.status === 'info'
                          ? 'mt-1 text-left text-xs font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300'
                          : 'mt-1 text-left text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300'
                      }
                    >
                      {check.status === 'info' ? 'Note' : 'Fix'}: {check.fix}
                    </button>
                  ) : (
                    <p
                      className={
                        check.status === 'info'
                          ? 'mt-1 text-xs font-medium text-sky-800 dark:text-sky-300'
                          : 'mt-1 text-xs font-medium text-amber-800 dark:text-amber-300'
                      }
                    >
                      {check.status === 'info' ? 'Note' : 'Fix'}: {check.fix}
                    </p>
                  )
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
