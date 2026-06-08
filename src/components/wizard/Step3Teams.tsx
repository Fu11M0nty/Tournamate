'use client'

import { useState } from 'react'
import type { Team } from '@/lib/types'
import type { FormatBuilderOptions, FormatBuilderTemplate } from '@/lib/formatBuilders'

const TEAM_COUNT_PRESETS = [4, 8, 16, 32, 64]

interface Step3TeamsProps {
  builder: FormatBuilderTemplate | null
  options: FormatBuilderOptions
  existingTeams: Team[]
  teamNames: string
  usePlaceholders: boolean
  byeSelections: string[]
  onChangeNames: (names: string) => void
  onChangeUsePlaceholders: (value: boolean) => void
  onChangeTeamCount: (count: number) => void
  onChangeByeSelections: (identifiers: string[]) => void
  onBack: () => void
  onNext: () => void
}

export default function Step3Teams({
  builder,
  options,
  existingTeams,
  teamNames,
  usePlaceholders,
  byeSelections,
  onChangeNames,
  onChangeUsePlaceholders,
  onChangeTeamCount,
  onChangeByeSelections,
  onBack,
  onNext,
}: Step3TeamsProps) {
  const enteredNames = teamNames
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const cfg = builder?.configurable
  const derivedPoolCount = options.poolCount ?? cfg?.pools?.defaultValue ?? cfg?.pools?.min ?? 1
  const derivedTeamsPerPool = options.teamsPerPool ?? cfg?.teamsPerPool?.defaultValue ?? cfg?.teamsPerPool?.min ?? 8
  const structureTeamCount = cfg?.teamsPerPool ? derivedPoolCount * derivedTeamsPerPool : null

  // For templates where teamCount is the primary configurable (e.g. Knockout), use it as the
  // placeholder count source; otherwise fall back to the pool-derived count or manual entry.
  const teamCount = options.expectedTeamCount ?? options.teamCount ?? structureTeamCount ?? (enteredNames.length || 8)
  const hasExisting = existingTeams.length > 0

  // Bye / seeded team state for knockout brackets.
  const isKnockout = builder?.id === 'knockout-play-ins'
  const byeCount = isKnockout
    ? (() => {
        let p = 1
        const tc = Math.max(2, teamCount)
        while (p < tc) p *= 2
        return p - tc
      })()
    : 0

  function toggleSelection(identifier: string) {
    if (byeSelections.includes(identifier)) {
      onChangeByeSelections(byeSelections.filter((s) => s !== identifier))
    } else {
      if (byeSelections.length >= byeCount) return
      onChangeByeSelections([...byeSelections, identifier])
    }
  }

  const currentKnockoutCount = options.teamCount ?? cfg?.teamCount?.defaultValue ?? 16
  const [isOtherCount, setIsOtherCount] = useState(
    () => cfg?.teamCount != null && !TEAM_COUNT_PRESETS.includes(currentKnockoutCount)
  )

  function fillPlaceholders() {
    const count = teamCount
    onChangeNames(
      Array.from({ length: count }, (_, i) => `Team ${i + 1}`).join('\n')
    )
    onChangeUsePlaceholders(false)
  }

  const canProceed =
    hasExisting ||
    (usePlaceholders && teamCount >= 2) ||
    (!usePlaceholders && enteredNames.length >= 2)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Teams</h3>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {hasExisting
            ? 'Existing teams will be carried over into the new format structure.'
            : 'Enter team names or create placeholder names that can be updated later.'}
        </p>
      </div>

      {/* Team count — shown at the top level when it's the primary configurable (e.g. Knockout).
          Keeps the count in sync between the bracket structure and the placeholder generator. */}
      {cfg?.teamCount && !hasExisting && (
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
                    onChangeTeamCount(preset)
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
                onChangeTeamCount(
                  Math.max(cfg!.teamCount!.min, Math.min(cfg!.teamCount!.max, Number(e.target.value)))
                )
              }
              placeholder={`${cfg.teamCount.min}–${cfg.teamCount.max}`}
              className="mt-2 block w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          )}
        </div>
      )}

      {hasExisting ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {existingTeams.length} registered team{existingTeams.length === 1 ? '' : 's'}
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {existingTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  {team.color && (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                  )}
                  {team.name}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Team names and colours can be edited from the Teams tab.
            </p>
          </div>

          {/* Seeded team selector for existing teams */}
          {isKnockout && byeCount > 0 && (
            <SeededTeamSelector
              label="Select seeded teams"
              description={`Choose ${byeCount} team${byeCount === 1 ? '' : 's'} to receive a first-round bye. Seeded teams are placed to avoid meeting each other in the next round.`}
              identifiers={existingTeams.map((t) => ({ id: t.id, label: t.name, color: t.color }))}
              selected={byeSelections}
              maxSelections={byeCount}
              onToggle={toggleSelection}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeUsePlaceholders(false)}
              className={
                !usePlaceholders
                  ? 'rounded-full bg-mk-red px-3 py-1 text-xs font-semibold text-white'
                  : 'rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }
            >
              Enter names
            </button>
            <button
              type="button"
              onClick={() => onChangeUsePlaceholders(true)}
              className={
                usePlaceholders
                  ? 'rounded-full bg-mk-red px-3 py-1 text-xs font-semibold text-white'
                  : 'rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }
            >
              Use placeholders
            </button>
          </div>

          {usePlaceholders ? (
            <div className="space-y-3">
              {/* Only show the team count input here when it hasn't already been shown at the top
                  (i.e. when the template uses pool × teamsPerPool to determine the count). */}
              {!cfg?.teamCount && (
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Number of teams
                    {structureTeamCount !== null && options.expectedTeamCount == null && (
                      <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">
                        ({derivedPoolCount} pool{derivedPoolCount === 1 ? '' : 's'} × {derivedTeamsPerPool})
                      </span>
                    )}
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={64}
                    value={teamCount}
                    onChange={(e) => onChangeTeamCount(Number(e.target.value))}
                    className="mt-1 block w-40 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              )}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Preview: placeholder names
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(teamCount, 12) }, (_, i) => (
                    <span
                      key={i}
                      className={[
                        'rounded px-2 py-0.5 text-xs',
                        isKnockout && byeCount > 0 && i < byeCount
                          ? 'bg-mk-red/10 font-semibold text-mk-red dark:bg-mk-red/20'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
                      ].join(' ')}
                    >
                      Team {i + 1}
                      {isKnockout && byeCount > 0 && i < byeCount && ' (seeded)'}
                    </span>
                  ))}
                  {teamCount > 12 && (
                    <span className="text-xs text-zinc-400">
                      + {teamCount - 12} more
                    </span>
                  )}
                </div>
              </div>
              {isKnockout && byeCount > 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Team 1–{byeCount} will be seeded (first-round bye). Rename all teams from the Teams tab at any time.
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Placeholder teams (Team 1, Team 2, …) are created immediately and can be renamed from the Teams tab at any time.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Team names — one per line
                </span>
                <textarea
                  rows={8}
                  value={teamNames}
                  onChange={(e) => onChangeNames(e.target.value)}
                  placeholder={'Storm Netball\nLightning A\nLightning B\nThunder'}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {enteredNames.length} team{enteredNames.length === 1 ? '' : 's'} entered
                  {enteredNames.length < 2 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">(minimum 2)</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={fillPlaceholders}
                  className="text-xs font-medium text-mk-red underline-offset-2 hover:underline"
                >
                  Fill placeholders instead
                </button>
              </div>

              {/* Seeded team selector for entered names */}
              {isKnockout && byeCount > 0 && enteredNames.length >= 2 && (
                <SeededTeamSelector
                  label="Select seeded teams"
                  description={`Choose ${byeCount} team${byeCount === 1 ? '' : 's'} to receive a first-round bye. Seeded teams are placed to avoid meeting each other in the next round.`}
                  identifiers={enteredNames.map((name) => ({ id: name, label: name }))}
                  selected={byeSelections}
                  maxSelections={byeCount}
                  onToggle={toggleSelection}
                />
              )}
            </div>
          )}
        </div>
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
          disabled={!canProceed}
          onClick={onNext}
          className="rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next: Review →
        </button>
      </div>
    </div>
  )
}

interface SeededTeamSelectorProps {
  label: string
  description: string
  identifiers: { id: string; label: string; color?: string | null }[]
  selected: string[]
  maxSelections: number
  onToggle: (id: string) => void
}

function SeededTeamSelector({
  label,
  description,
  identifiers,
  selected,
  maxSelections,
  onToggle,
}: SeededTeamSelectorProps) {
  const atMax = selected.length >= maxSelections
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {identifiers.map(({ id, label: teamLabel, color }) => {
          const isSelected = selected.includes(id)
          const isDisabled = !isSelected && atMax
          return (
            <label
              key={id}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors select-none',
                isSelected
                  ? 'border-mk-red bg-mk-red/5 text-zinc-900 dark:border-mk-red/60 dark:bg-mk-red/10 dark:text-zinc-50'
                  : isDisabled
                    ? 'cursor-not-allowed border-zinc-200 bg-white opacity-40 dark:border-zinc-800 dark:bg-zinc-950'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onToggle(id)}
                className="h-3.5 w-3.5 accent-mk-red"
              />
              {color && (
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              )}
              <span className="flex-1 truncate">{teamLabel}</span>
              {isSelected && (
                <span className="shrink-0 text-[10px] font-semibold text-mk-red">Seeded</span>
              )}
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        {selected.length} of {maxSelections} seeded team{maxSelections === 1 ? '' : 's'} selected
      </p>
    </div>
  )
}
