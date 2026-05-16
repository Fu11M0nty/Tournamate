'use client'

import type { Team } from '@/lib/types'
import type { FormatBuilderOptions, FormatBuilderTemplate } from '@/lib/formatBuilders'

interface Step3TeamsProps {
  builder: FormatBuilderTemplate | null
  options: FormatBuilderOptions
  existingTeams: Team[]
  teamNames: string
  usePlaceholders: boolean
  onChangeNames: (names: string) => void
  onChangeUsePlaceholders: (value: boolean) => void
  onChangeTeamCount: (count: number) => void
  onBack: () => void
  onNext: () => void
}

export default function Step3Teams({
  builder,
  options,
  existingTeams,
  teamNames,
  usePlaceholders,
  onChangeNames,
  onChangeUsePlaceholders,
  onChangeTeamCount,
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

  const teamCount = options.expectedTeamCount ?? structureTeamCount ?? (enteredNames.length || 8)
  const hasExisting = existingTeams.length > 0

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

      {hasExisting ? (
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
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Preview: placeholder names
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(teamCount, 12) }, (_, i) => (
                    <span
                      key={i}
                      className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      Team {i + 1}
                    </span>
                  ))}
                  {teamCount > 12 && (
                    <span className="text-xs text-zinc-400">
                      + {teamCount - 12} more
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Placeholder teams (Team 1, Team 2, …) are created immediately and can be renamed from the Teams tab at any time.
              </p>
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
