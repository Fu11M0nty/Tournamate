'use client'

import { useState } from 'react'
import { resolveFormatBuilder, type FormatBuilderOptions, type FormatBuilderTemplate } from '@/lib/formatBuilders'
import FormatDiagram from '@/components/FormatDiagram'

type FinalsStyle = 'none' | 'final_only' | 'final_and_third' | 'semi_final_final' | 'top4_double_elimination'
type PlacementStyle = 'final_only' | 'final_and_third' | 'all_placements'

const TEAM_COUNT_PRESETS = [4, 8, 16, 32, 64]

const FINALS_STYLE_OPTIONS: { value: FinalsStyle; label: string }[] = [
  { value: 'none', label: 'No finals' },
  { value: 'final_only', label: 'Final only' },
  { value: 'final_and_third', label: 'Final + 3rd Place' },
  { value: 'semi_final_final', label: 'Semi-finals + Final' },
  { value: 'top4_double_elimination', label: 'Top 4 (double elimination)' },
]

const PLACEMENT_STYLE_OPTIONS: { value: PlacementStyle; label: string }[] = [
  { value: 'final_only', label: 'Final only (1st vs 2nd)' },
  { value: 'final_and_third', label: 'Final + 3rd place' },
  { value: 'all_placements', label: 'All placement matches' },
]

const BNT_CRITERIA_OPTIONS: { key: string; label: string }[] = [
  { key: 'points', label: 'Points' },
  { key: 'goal_difference', label: 'Goal Difference' },
  { key: 'goals_for', label: 'Goals Scored' },
  { key: 'wins', label: 'Most Wins' },
  { key: 'losses', label: 'Fewest Losses' },
]

const DEFAULT_BNT_CRITERIA = ['points', 'goal_difference', 'goals_for']


function ordinalSuffix(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

interface Step2ConfigureProps {
  builder: FormatBuilderTemplate
  options: FormatBuilderOptions
  teamCount: number
  onChange: (patch: Partial<FormatBuilderOptions>) => void
  onBack: () => void
  onNext: () => void
}

export default function Step2Configure({
  builder,
  options,
  teamCount,
  onChange,
  onBack,
  onNext,
}: Step2ConfigureProps) {
  const cfg = builder.configurable
  const hasConfig = Boolean(cfg)
  const [showDoubleEliminationWarning, setShowDoubleEliminationWarning] = useState(false)

  const currentKnockoutCount = options.teamCount ?? cfg?.teamCount?.defaultValue ?? 16
  const [isOtherCount, setIsOtherCount] = useState(
    () => cfg?.teamCount != null && !TEAM_COUNT_PRESETS.includes(currentKnockoutCount)
  )

  const isGrading = builder.id === 'grading-championship'

  // BNT criteria local state — drives the reorderer UI and syncs to parent options.
  const [bntCriteria, setBntCriteria] = useState<string[]>(
    () => options.bestRankCriteria ?? DEFAULT_BNT_CRITERIA
  )

  // Current effective pool count — used to gate the double-elimination option.
  const effectivePoolCount = cfg?.pools
    ? (options.poolCount ?? cfg.pools.defaultValue ?? cfg.pools.min)
    : 1
  const doubleEliminationBlocked = effectivePoolCount > 2
  const currentFinalsStyle = (options.finalsStyle as FinalsStyle | undefined) ?? cfg?.finalsStyle?.defaultValue ?? 'none'

  // Dynamic pool count maximum — depends on finals style (not applicable to grading format).
  const poolCountMax = (() => {
    if (!cfg?.pools || !cfg?.finalsStyle || isGrading) return cfg?.pools?.max ?? 12
    switch (currentFinalsStyle) {
      case 'final_only':
      case 'final_and_third':
      case 'top4_double_elimination':
        return 2
      case 'semi_final_final':
        return 8
      default:
        return cfg.pools.max ?? 12
    }
  })()

  // Qualifier count when the builder uses pools + championship ranks.
  const currentChampionshipRanks = options.championshipRanks ?? cfg?.championshipRanks?.defaultValue ?? [1, 2]
  const qualifierCount = cfg?.pools && cfg?.championshipRanks
    ? effectivePoolCount * currentChampionshipRanks.length
    : null

  // BNT detection: cross-pool "best nth placed" selection is needed in two scenarios:
  // 1. QF+BNT: qualifiers overflow QF capacity (> 8) with semi_final_final
  // 2. SF+BNT: qualifiers (5–7) can't fill QF without empty slots and pools < 4 → use SF+BNT instead
  const sfCapacity = 4
  const qfCapacity = 8

  const bntQfZone = qualifierCount !== null && qualifierCount > qfCapacity && currentFinalsStyle === 'semi_final_final'
  const bntQfFullRanks = bntQfZone ? Math.floor(qfCapacity / effectivePoolCount) : null
  const bntQfRemainder = bntQfZone ? qfCapacity % effectivePoolCount : null
  // BNT only applies when there are leftover QF slots that can't be filled by whole-pool rounds.
  const bntQfRank = (bntQfFullRanks !== null && bntQfRemainder !== null && bntQfRemainder > 0
    && currentChampionshipRanks.length > bntQfFullRanks)
    ? currentChampionshipRanks[bntQfFullRanks]
    : null
  const bntQfApplies = bntQfZone && bntQfRank !== null

  const bntSfApplies = qualifierCount !== null
    && qualifierCount > sfCapacity
    && qualifierCount < qfCapacity
    && effectivePoolCount < sfCapacity
    && currentChampionshipRanks.length >= 2
    && currentFinalsStyle === 'semi_final_final'
  const bntSfCount = bntSfApplies ? sfCapacity - effectivePoolCount : null
  const bntSfRank = bntSfApplies ? (currentChampionshipRanks[1] ?? null) : null

  const bntApplies = bntQfApplies || bntSfApplies

  // Grading-specific state
  const currentPlateRanks = options.plateRanks ?? cfg?.plateRanks?.defaultValue ?? [3, 4]
  const currentGradingFinalsStyle = (options.finalsStyle as FinalsStyle | undefined) ?? 'none'
  const directToFinals = options.directToFinals === true
  const champTeams = isGrading ? currentChampionshipRanks.length * effectivePoolCount : 0
  const plateTeams = isGrading ? currentPlateRanks.length * effectivePoolCount : 0
  const directToFinalsAvailable = isGrading && effectivePoolCount <= 4

  // Championship & Plate group size cap (not relevant for direct-to-finals)
  const currentChampGroupSize = isGrading && !directToFinals
    ? (options.champGroupSize ?? cfg?.champGroupSize?.defaultValue ?? 8)
    : null
  const effectiveChampInGroup = currentChampGroupSize !== null ? Math.min(champTeams, currentChampGroupSize) : champTeams
  const effectivePlateInGroup = currentChampGroupSize !== null ? Math.min(plateTeams, currentChampGroupSize) : plateTeams
  const champGroupSizeTooSmall = currentChampGroupSize !== null && currentChampGroupSize < effectivePoolCount

  const gradingFinalsUnlocked = effectiveChampInGroup >= 4 && effectivePlateInGroup >= 4
  const gradingFinalsLowTeamWarning = isGrading && currentGradingFinalsStyle !== 'none' && !gradingFinalsUnlocked

  // Grading BNT — fires when qualifiers exceed the group size cap (standard path only)
  const gradingChampBntNeeded = !directToFinals && currentChampGroupSize !== null && champTeams > currentChampGroupSize
  const gradingChampFullRanks = gradingChampBntNeeded ? Math.floor(currentChampGroupSize! / effectivePoolCount) : null
  const gradingChampRemainder = gradingChampBntNeeded && gradingChampFullRanks !== null
    ? currentChampGroupSize! - gradingChampFullRanks * effectivePoolCount : null
  const gradingChampBntRank = (gradingChampFullRanks !== null && gradingChampRemainder !== null
    && gradingChampRemainder > 0 && currentChampionshipRanks.length > gradingChampFullRanks)
    ? currentChampionshipRanks[gradingChampFullRanks] : null
  const gradingChampBntApplies = gradingChampBntRank !== null && gradingChampRemainder !== null && gradingChampRemainder > 0

  const gradingPlateBntNeeded = !directToFinals && currentChampGroupSize !== null && plateTeams > currentChampGroupSize
  const gradingPlateFullRanks = gradingPlateBntNeeded ? Math.floor(currentChampGroupSize! / effectivePoolCount) : null
  const gradingPlateRemainder = gradingPlateBntNeeded && gradingPlateFullRanks !== null
    ? currentChampGroupSize! - gradingPlateFullRanks * effectivePoolCount : null
  const gradingPlateBntRank = (gradingPlateFullRanks !== null && gradingPlateRemainder !== null
    && gradingPlateRemainder > 0 && currentPlateRanks.length > gradingPlateFullRanks)
    ? currentPlateRanks[gradingPlateFullRanks] : null
  const gradingPlateBntApplies = gradingPlateBntRank !== null && gradingPlateRemainder !== null && gradingPlateRemainder > 0

  const gradingBntApplies = isGrading && (gradingChampBntApplies || gradingPlateBntApplies)

  // BNT criteria helpers
  function moveBntCriterion(index: number, direction: -1 | 1) {
    const next = [...bntCriteria]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setBntCriteria(next)
    onChange({ bestRankCriteria: next })
  }
  function removeBntCriterion(index: number) {
    const next = bntCriteria.filter((_, i) => i !== index)
    setBntCriteria(next)
    onChange({ bestRankCriteria: next })
  }
  function addBntCriterion(key: string) {
    const next = [...bntCriteria, key]
    setBntCriteria(next)
    onChange({ bestRankCriteria: next })
  }

  // Dynamic teams-per-pool minimum — 1 pool + semi-final requires at least 4 teams.
  const teamsPerPoolMin = cfg?.teamsPerPool
    ? (effectivePoolCount === 1 && currentFinalsStyle === 'semi_final_final' ? 4 : cfg.teamsPerPool.min)
    : undefined

  // Whether this is the 1-pool semi-final scenario that warrants auto-seeding ranks.
  const isSinglePoolSemiFinal = effectivePoolCount === 1 && currentFinalsStyle === 'semi_final_final'

  // Collect configuration errors that must be resolved before proceeding.
  const validationErrors: string[] = []
  if (!isGrading && showDoubleEliminationWarning) {
    validationErrors.push(
      `Top 4 double elimination is not available with ${effectivePoolCount} pools. Choose a different finals format or reduce to 2 pools.`
    )
  }
  if (!isGrading && cfg?.pools && effectivePoolCount > poolCountMax) {
    validationErrors.push(
      `${FINALS_STYLE_OPTIONS.find(o => o.value === currentFinalsStyle)?.label ?? 'This finals format'} supports at most ${poolCountMax} group-stage pool${poolCountMax === 1 ? '' : 's'}. Reduce the pool count or change the finals format.`
    )
  }
  if (!isGrading && qualifierCount !== null && currentFinalsStyle === 'final_only' && qualifierCount < 2) {
    validationErrors.push('Final only requires at least 2 qualifying teams. Add more pools or increase the qualifying ranks.')
  }
  if (!isGrading && qualifierCount !== null && currentFinalsStyle === 'final_and_third' && qualifierCount < 4) {
    validationErrors.push(`Final + 3rd Place requires at least 4 qualifying teams (currently ${qualifierCount}). Add more pools or increase the qualifying ranks.`)
  }
  if (!isGrading && qualifierCount !== null && currentFinalsStyle === 'semi_final_final' && qualifierCount < 4) {
    validationErrors.push(`Semi-finals + Final requires at least 4 qualifying teams (currently ${qualifierCount}). Add more pools or qualifying ranks.`)
  }
  // SF+BNT zone: ranks beyond index 1 aren't used (only rank[0] deterministic + rank[1] BNT).
  // Example: 2 pools × [1,2,3] = 6 qualifiers — can't fill QF (needs 8), so 3rd place is wasted.
  if (!isGrading && bntSfApplies && currentChampionshipRanks.length > 2 && qualifierCount !== null) {
    const wastedOrdinals = currentChampionshipRanks.slice(2).map(ordinalSuffix).join(' and ')
    validationErrors.push(
      `${wastedOrdinals} place won't qualify: ${effectivePoolCount} pool${effectivePoolCount > 1 ? 's' : ''} with ${currentChampionshipRanks.length} ranks gives ${qualifierCount} teams — not enough for a Quarter-Final (needs 8). Add 4th rank to use QF, or remove ${wastedOrdinals} for Semi-Finals.`
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
          Configure: {builder.name}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {builder.description}
        </p>
      </div>

      <div className="space-y-3">
        {!hasConfig && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No extra configuration needed for this format.
          </p>
        )}

        {cfg?.pools && (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.pools.label ?? 'Number of pools'}
            </span>
            <input
              type="number"
              min={cfg.pools.min}
              max={poolCountMax}
              value={effectivePoolCount}
              onChange={(e) => {
                const newCount = Number(e.target.value)
                const patch: Partial<FormatBuilderOptions> = { poolCount: newCount }
                if (newCount > 2 && currentFinalsStyle === 'top4_double_elimination') {
                  patch.finalsStyle = 'semi_final_final'
                }
                // 1 pool + semi_final_final: default to 4 qualifying ranks (1st–4th).
                if (newCount === 1 && currentFinalsStyle === 'semi_final_final') {
                  patch.championshipRanks = [1, 2, 3, 4]
                }
                // Direct-to-finals only valid when poolCount <= 4.
                if (newCount > 4 && directToFinals) {
                  patch.directToFinals = false
                }
                setShowDoubleEliminationWarning(false)
                onChange(patch)
              }}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        )}

        {cfg?.teamsPerPool && (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Teams per pool
            </span>
            <input
              type="number"
              min={teamsPerPoolMin ?? cfg.teamsPerPool.min}
              max={cfg.teamsPerPool.max}
              value={options.teamsPerPool ?? cfg.teamsPerPool.defaultValue ?? (teamsPerPoolMin ?? cfg.teamsPerPool.min)}
              onChange={(e) => onChange({ teamsPerPool: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        )}

        {cfg?.finalsStyle && !isGrading && (
          <div className="block">
            <label htmlFor="finals-style-select" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.finalsStyle.label ?? 'Finals format'}
            </label>
            <select
              id="finals-style-select"
              value={currentFinalsStyle}
              onChange={(e) => {
                const value = e.target.value as FinalsStyle
                if (value === 'top4_double_elimination' && doubleEliminationBlocked) {
                  setShowDoubleEliminationWarning(true)
                  return
                }
                setShowDoubleEliminationWarning(false)
                const newMax = (value === 'final_only' || value === 'final_and_third' || value === 'top4_double_elimination') ? 2
                  : value === 'semi_final_final' ? 8
                  : cfg?.pools?.max ?? 12
                const patch: Partial<FormatBuilderOptions> = { finalsStyle: value }
                if (cfg?.pools && effectivePoolCount > newMax) patch.poolCount = newMax
                // Switching to semi_final_final with 1 pool: default to 4 qualifying ranks.
                if (value === 'semi_final_final' && effectivePoolCount === 1) {
                  patch.championshipRanks = [1, 2, 3, 4]
                }
                onChange(patch)
              }}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {FINALS_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {showDoubleEliminationWarning && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                Top 4 double elimination is unavailable with {effectivePoolCount} pools — seeding into the major/minor bracket would be based on pool letter, not performance, giving earlier pools an unfair path to the final. Reduce to 2 pools to enable it.
              </p>
            )}
          </div>
        )}

        {cfg?.placementStyle && (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.placementStyle.label ?? 'Placement format'}
            </span>
            <select
              value={(options.placementStyle as string) ?? cfg.placementStyle.defaultValue ?? 'all_placements'}
              onChange={(e) => onChange({ placementStyle: e.target.value as PlacementStyle })}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {PLACEMENT_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}

        {cfg?.teamCount && (
          <div>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.teamCount.label}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEAM_COUNT_PRESETS.map((preset) => {
                const isSelected = !isOtherCount && currentKnockoutCount === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setIsOtherCount(false)
                      onChange({ teamCount: preset })
                    }}
                    className={[
                      'rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-mk-red bg-mk-red text-white shadow-sm'
                        : 'border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {preset}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsOtherCount(true)}
                className={[
                  'rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
                  isOtherCount
                    ? 'border-mk-red bg-mk-red text-white shadow-sm'
                    : 'border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
                ].join(' ')}
              >
                Other
              </button>
            </div>
            {isOtherCount && (
              <input
                type="number"
                min={cfg.teamCount.min}
                max={cfg.teamCount.max}
                value={currentKnockoutCount}
                onChange={(e) =>
                  onChange({ teamCount: Math.max(cfg!.teamCount!.min, Math.min(cfg!.teamCount!.max, Number(e.target.value))) })
                }
                placeholder={`${cfg.teamCount.min}–${cfg.teamCount.max}`}
                className="mt-2 block w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            )}
          </div>
        )}

        {cfg?.leagueRepeatCount && (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.leagueRepeatCount.label ?? 'How many times each team plays each other'}
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={options.leagueRepeatCount ?? cfg.leagueRepeatCount.defaultValue ?? 1}
              onChange={(e) => onChange({ leagueRepeatCount: Number(e.target.value) as 1 | 2 })}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        )}

        {cfg?.championshipRanks && (
          <div className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.championshipRanks.label ?? 'Ranks that qualify to finals'}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((rank) => {
                const isSelected = currentChampionshipRanks.includes(rank)
                const maxExisting = currentChampionshipRanks.length > 0 ? Math.max(...currentChampionshipRanks) : 0
                // Auto-fill count: clicking rank R from [1..k] fills ranks k+1..R as well.
                const autoFilledCount = currentChampionshipRanks.length + Math.max(0, rank - maxExisting)
                const autoFilledQualifiers = effectivePoolCount * autoFilledCount
                let isDisabled = false
                if (!isSelected && cfg?.finalsStyle) {
                  switch (currentFinalsStyle) {
                    case 'final_only':
                      isDisabled = autoFilledQualifiers > 2; break
                    case 'final_and_third':
                    case 'top4_double_elimination':
                      isDisabled = autoFilledQualifiers > 4; break
                    case 'semi_final_final': {
                      // Disable if auto-filling to this rank creates a state where those ranks are wasted.
                      const N = effectivePoolCount
                      if (autoFilledQualifiers > sfCapacity && autoFilledQualifiers < qfCapacity && N < sfCapacity) {
                        // SF+BNT zone: only first 2 ranks are used; extra ranks are wasted.
                        if (autoFilledCount > 2) isDisabled = true
                      } else if (autoFilledQualifiers > qfCapacity) {
                        const qfFull = Math.floor(qfCapacity / N)
                        const qfRem = qfCapacity % N
                        const maxUseful = qfFull + (qfRem > 0 ? 1 : 0)
                        if (autoFilledCount > maxUseful) isDisabled = true
                      }
                      break
                    }
                  }
                }
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      let next: number[]
                      if (isSelected) {
                        next = currentChampionshipRanks.filter(r => r !== rank)
                        if (next.length === 0) return
                      } else {
                        // Auto-fill all ranks between the current max and this rank.
                        next = [...currentChampionshipRanks]
                        for (let r = maxExisting + 1; r <= rank; r++) {
                          if (!next.includes(r)) next.push(r)
                        }
                        next.sort((a, b) => a - b)
                      }
                      onChange({ championshipRanks: next })
                    }}
                    className={[
                      'rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-mk-red bg-mk-red text-white shadow-sm'
                        : isDisabled
                          ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-600'
                          : 'border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {ordinalSuffix(rank)}
                  </button>
                )
              })}
            </div>
            {isSinglePoolSemiFinal && (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                With all 4 ranks: 1st plays 4th and 2nd plays 3rd in the semi-finals.
              </p>
            )}
          </div>
        )}

        {cfg?.plateRanks && (
          <div className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.plateRanks.label ?? 'Ranks to Plate'}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((rank) => {
                const takenByChampionship = currentChampionshipRanks.includes(rank)
                const isSelected = currentPlateRanks.includes(rank)
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={takenByChampionship}
                    title={takenByChampionship ? `${ordinalSuffix(rank)} place is already assigned to Championship` : undefined}
                    onClick={() => {
                      let next: number[]
                      if (isSelected) {
                        next = currentPlateRanks.filter(r => r !== rank)
                        if (next.length === 0) return
                      } else {
                        next = [...currentPlateRanks, rank].sort((a, b) => a - b)
                      }
                      onChange({ plateRanks: next })
                    }}
                    className={[
                      'rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
                      takenByChampionship
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-600'
                        : isSelected
                          ? 'border-mk-red bg-mk-red text-white shadow-sm'
                          : 'border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {ordinalSuffix(rank)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {cfg?.champGroupSize && !directToFinals && (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {cfg.champGroupSize.label}
            </span>
            <input
              type="number"
              min={cfg.champGroupSize.min}
              max={cfg.champGroupSize.max}
              value={currentChampGroupSize ?? cfg.champGroupSize.defaultValue}
              onChange={(e) => onChange({ champGroupSize: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            {champGroupSizeTooSmall && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Group size ({currentChampGroupSize}) is less than the pool count ({effectivePoolCount}) — some pool winners may not qualify to Championship or Plate.
              </p>
            )}
          </label>
        )}

        {/* Grading-specific: optional finals for Championship and Plate */}
        {isGrading && (
          <div className="block">
            <label htmlFor="grading-finals-style" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Finals format (Championship &amp; Plate)
            </label>
            {!gradingFinalsUnlocked && currentGradingFinalsStyle === 'none' && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Requires at least 4 teams in each bracket (currently {effectiveChampInGroup} to Championship, {effectivePlateInGroup} to Plate). Increase pools, qualifying ranks, or the group size to unlock.
              </p>
            )}
            <select
              id="grading-finals-style"
              value={currentGradingFinalsStyle}
              disabled={!gradingFinalsUnlocked && currentGradingFinalsStyle === 'none'}
              onChange={(e) => onChange({ finalsStyle: e.target.value as FinalsStyle })}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="none">No finals</option>
              <option value="final_only">Final only</option>
              <option value="semi_final_final">Semi-finals + Final</option>
              <option value="top4_double_elimination">Double Elimination (Top 4)</option>
            </select>
            {gradingFinalsLowTeamWarning && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                Currently only {Math.min(effectiveChampInGroup, effectivePlateInGroup)} teams in the smaller bracket — finals work best with at least 4. Adjust pools, qualifying ranks, or the group size, or change to "No finals".
              </p>
            )}
          </div>
        )}

        {/* Grading-specific: direct-to-finals toggle */}
        {isGrading && (
          <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <input
              id="direct-to-finals"
              type="checkbox"
              checked={directToFinals}
              disabled={!directToFinalsAvailable && !directToFinals}
              onChange={(e) => {
                const next = e.target.checked
                const patch: Partial<FormatBuilderOptions> = { directToFinals: next }
                if (next && currentGradingFinalsStyle === 'none') {
                  patch.finalsStyle = 'semi_final_final'
                }
                onChange(patch)
              }}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-mk-red disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div>
              <label htmlFor="direct-to-finals" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                Skip group phases — qualify directly to finals
              </label>
              {directToFinalsAvailable ? (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Grading pool results feed directly into Championship and Plate finals brackets, skipping the group stage.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Not available with more than 4 grading pools.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grading: unified Championship & Plate BNT panel */}
      {gradingBntApplies && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
          <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
            Best rank selection — Championship &amp; Plate
          </p>
          <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
            More teams qualify than the group size ({currentChampGroupSize}) allows. The tiebreaker criteria below determine which teams fill the remaining spots — the same rules apply to both brackets.
          </p>
          {gradingChampBntApplies && gradingChampRemainder !== null && gradingChampBntRank !== null && gradingChampFullRanks !== null && (
            <div className="mt-2 rounded bg-sky-100/60 px-3 py-2 dark:bg-sky-900/40">
              <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">Championship</p>
              <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-300">
                {gradingChampFullRanks > 0
                  ? <>All {effectivePoolCount} pools&apos; {currentChampionshipRanks.slice(0, gradingChampFullRanks).map(ordinalSuffix).join(' &amp; ')}-placed teams qualify ({gradingChampFullRanks * effectivePoolCount} of {currentChampGroupSize} spots). The remaining {gradingChampRemainder} spot{gradingChampRemainder !== 1 ? 's are' : ' is'} filled by the {gradingChampRemainder} best {ordinalSuffix(gradingChampBntRank)}-placed team{gradingChampRemainder !== 1 ? 's' : ''} across all pools.</>
                  : <>The {gradingChampRemainder} best {ordinalSuffix(gradingChampBntRank)}-placed team{gradingChampRemainder !== 1 ? 's' : ''} across all {effectivePoolCount} pools fill all {gradingChampRemainder} spot{gradingChampRemainder !== 1 ? 's' : ''}.</>
                }
              </p>
            </div>
          )}
          {gradingPlateBntApplies && gradingPlateRemainder !== null && gradingPlateBntRank !== null && gradingPlateFullRanks !== null && (
            <div className="mt-1 rounded bg-sky-100/60 px-3 py-2 dark:bg-sky-900/40">
              <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">Plate</p>
              <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-300">
                {gradingPlateFullRanks > 0
                  ? <>All {effectivePoolCount} pools&apos; {currentPlateRanks.slice(0, gradingPlateFullRanks).map(ordinalSuffix).join(' &amp; ')}-placed teams qualify ({gradingPlateFullRanks * effectivePoolCount} of {currentChampGroupSize} spots). The remaining {gradingPlateRemainder} spot{gradingPlateRemainder !== 1 ? 's are' : ' is'} filled by the {gradingPlateRemainder} best {ordinalSuffix(gradingPlateBntRank)}-placed team{gradingPlateRemainder !== 1 ? 's' : ''} across all pools.</>
                  : <>The {gradingPlateRemainder} best {ordinalSuffix(gradingPlateBntRank)}-placed team{gradingPlateRemainder !== 1 ? 's' : ''} across all {effectivePoolCount} pools fill all {gradingPlateRemainder} spot{gradingPlateRemainder !== 1 ? 's' : ''}.</>
                }
              </p>
            </div>
          )}
          <ol className="mt-3 space-y-1.5">
            {bntCriteria.map((key, i) => {
              const option = BNT_CRITERIA_OPTIONS.find((o) => o.key === key)
              if (!option) return null
              return (
                <li key={key} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-xs font-bold text-sky-600 dark:text-sky-400">{i + 1}.</span>
                  <span className="flex-1 text-sm text-sky-900 dark:text-sky-100">{option.label}</span>
                  <button type="button" disabled={i === 0} onClick={() => moveBntCriterion(i, -1)} title="Move up" className="text-sky-500 disabled:opacity-25 hover:text-sky-700 dark:hover:text-sky-300">▲</button>
                  <button type="button" disabled={i === bntCriteria.length - 1} onClick={() => moveBntCriterion(i, 1)} title="Move down" className="text-sky-500 disabled:opacity-25 hover:text-sky-700 dark:hover:text-sky-300">▼</button>
                  {bntCriteria.length > 1 && (
                    <button type="button" onClick={() => removeBntCriterion(i)} title="Remove" className="text-sky-400 hover:text-red-500 dark:hover:text-red-400">×</button>
                  )}
                </li>
              )
            })}
          </ol>
          {bntCriteria.length < BNT_CRITERIA_OPTIONS.length && (
            <select value="" onChange={(e) => { if (e.target.value) addBntCriterion(e.target.value) }} className="mt-3 rounded border border-sky-300 bg-white px-2 py-1 text-xs text-sky-700 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-300">
              <option value="">+ Add tie-breaker…</option>
              {BNT_CRITERIA_OPTIONS.filter((o) => !bntCriteria.includes(o.key)).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Best nth-placed team selection panel — shown when BNT selection is needed */}
      {bntApplies && !isGrading && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
          {bntSfApplies && bntSfRank !== null && bntSfCount !== null ? (
            <>
              <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
                Best {ordinalSuffix(bntSfRank)} place selection
              </p>
              <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
                All {effectivePoolCount} {ordinalSuffix(currentChampionshipRanks[0])}-placed teams qualify directly,
                filling {effectivePoolCount} of the 4 semi-final spots. The remaining {bntSfCount} spot
                {bntSfCount !== 1 ? 's' : ''} will be filled by the {bntSfCount} best{' '}
                {ordinalSuffix(bntSfRank)}-placed team{bntSfCount !== 1 ? 's' : ''} across all pools,
                compared in this order:
              </p>
            </>
          ) : bntQfApplies && bntQfRank !== null && bntQfRemainder !== null && bntQfFullRanks !== null ? (
            <>
              <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
                Best {ordinalSuffix(bntQfRank)} place selection
              </p>
              <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
                {effectivePoolCount} pools each have a {ordinalSuffix(bntQfRank)}-placed team, but only{' '}
                {bntQfRemainder} quarter-final spot{bntQfRemainder !== 1 ? 's remain' : ' remains'} after
                filling places{' '}
                {currentChampionshipRanks.slice(0, bntQfFullRanks).map(ordinalSuffix).join(', ')} from
                every pool. The {bntQfRemainder} best {ordinalSuffix(bntQfRank)}-placed team
                {bntQfRemainder !== 1 ? 's' : ''} will be selected by comparing across all pools in this
                order:
              </p>
            </>
          ) : null}
          <ol className="mt-3 space-y-1.5">
            {bntCriteria.map((key, i) => {
              const option = BNT_CRITERIA_OPTIONS.find((o) => o.key === key)
              if (!option) return null
              return (
                <li key={key} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-xs font-bold text-sky-600 dark:text-sky-400">
                    {i + 1}.
                  </span>
                  <span className="flex-1 text-sm text-sky-900 dark:text-sky-100">{option.label}</span>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveBntCriterion(i, -1)}
                    title="Move up"
                    className="text-sky-500 disabled:opacity-25 hover:text-sky-700 dark:hover:text-sky-300"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === bntCriteria.length - 1}
                    onClick={() => moveBntCriterion(i, 1)}
                    title="Move down"
                    className="text-sky-500 disabled:opacity-25 hover:text-sky-700 dark:hover:text-sky-300"
                  >
                    ▼
                  </button>
                  {bntCriteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBntCriterion(i)}
                      title="Remove"
                      className="text-sky-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
          {bntCriteria.length < BNT_CRITERIA_OPTIONS.length && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) addBntCriterion(e.target.value) }}
              className="mt-3 rounded border border-sky-300 bg-white px-2 py-1 text-xs text-sky-700 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-300"
            >
              <option value="">+ Add tie-breaker…</option>
              {BNT_CRITERIA_OPTIONS.filter((o) => !bntCriteria.includes(o.key)).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Live format diagram */}
      <FormatDiagram builder={builder} options={{ ...options, bestRankCriteria: bntCriteria }} teamCount={options.teamCount ?? teamCount} />

      {validationErrors.length > 0 && (
        <ul className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          {validationErrors.map((err) => (
            <li key={err} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <span className="mt-0.5 shrink-0 font-bold">!</span>
              {err}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={validationErrors.length > 0}
          className="rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next: Teams →
        </button>
      </div>
    </div>
  )
}
