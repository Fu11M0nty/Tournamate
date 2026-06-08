'use client'

import { resolveFormatBuilder, type FormatBuilderOptions, type FormatBuilderTemplate } from '@/lib/formatBuilders'
import FormatDiagram from '@/components/FormatDiagram'

interface Step4ReviewProps {
  builder: FormatBuilderTemplate
  options: FormatBuilderOptions
  teamNames: string[]
  usePlaceholders: boolean
  mode: 'create' | 'change'
  applying: boolean
  applyError: string | null
  onBack: () => void
  onConfirm: () => void
  onCancel?: () => void
}

export default function Step4Review({
  builder,
  options,
  teamNames,
  usePlaceholders,
  mode,
  applying,
  applyError,
  onBack,
  onConfirm,
  onCancel,
}: Step4ReviewProps) {
  const teamCount = teamNames.length
  const previewOptions: FormatBuilderOptions = { ...options, teamCount }
  const preview = resolveFormatBuilder(builder, previewOptions)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Review & generate</h3>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Confirm the setup below, then generate fixtures.
        </p>
      </div>

      {mode === 'change' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Changing format</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Scheduled and completed fixtures are preserved. Unscheduled generated fixtures, pools, qualification paths, and placeholders may be replaced.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Summary */}
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Format
            </p>
            <p className="mt-1 font-bold text-zinc-900 dark:text-zinc-50">{builder.name}</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{preview.description}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Teams ({teamCount})
            </p>
            {teamCount === 0 ? (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">No teams configured.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {teamNames.slice(0, 12).map((name, i) => (
                  <span
                    key={i}
                    className={
                      usePlaceholders
                        ? 'rounded bg-zinc-200 px-2 py-0.5 text-xs italic text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        : 'rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }
                  >
                    {name}
                  </span>
                ))}
                {teamCount > 12 && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    + {teamCount - 12} more
                  </span>
                )}
              </div>
            )}
            {usePlaceholders && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Placeholder names can be renamed from the Teams tab.
              </p>
            )}
          </div>
        </div>

        {/* Phase timeline */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {preview.phases.length} stage{preview.phases.length === 1 ? '' : 's'}
          </p>
          <div className="mt-3 space-y-2">
            {preview.phases.map((phase, index) => (
              <div key={phase.slug} className="flex items-start gap-2">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {phase.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {phase.pools.length} pool{phase.pools.length === 1 ? '' : 's'}
                    {phase.pools.length > 0 && phase.pools.length <= 4
                      ? ': ' + phase.pools.map((p) => p.name).join(', ')
                      : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {preview.progressions && preview.progressions.length > 0 && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {preview.progressions.length} qualification path{preview.progressions.length === 1 ? '' : 's'} defined
            </p>
          )}
        </div>
      </div>

      {/* Format diagram */}
      <FormatDiagram builder={builder} options={options} teamCount={teamCount} />

      {applyError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {applyError}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={applying}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={applying}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={applying}
          className="rounded-md bg-mk-red px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying
            ? mode === 'change'
              ? 'Changing format…'
              : 'Generating fixtures…'
            : mode === 'change'
              ? 'Apply new format'
              : 'Generate fixtures'}
        </button>
      </div>
    </div>
  )
}
