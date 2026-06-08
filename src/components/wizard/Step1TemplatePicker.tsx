'use client'

import {
  FORMAT_BUILDERS,
  resolveFormatBuilder,
  type FormatBuilderOptions,
} from '@/lib/formatBuilders'

function teamSplitLabel(teamSplit: string) {
  if (teamSplit === 'all') return 'All teams together'
  if (teamSplit === 'two-pools') return '2 pools'
  if (teamSplit === 'four-pools') return '4 pools'
  if (teamSplit === 'seeded-pools') return 'Seeded knockout'
  if (teamSplit === 'none') return 'No pools'
  return teamSplit
}

interface Step1TemplatePickerProps {
  selectedBuilderId: string | null
  existingTeamCount: number
  options: FormatBuilderOptions
  onSelect: (builderId: string) => void
  onNext: () => void
}

export default function Step1TemplatePicker({
  selectedBuilderId,
  existingTeamCount,
  options,
  onSelect,
  onNext,
}: Step1TemplatePickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
          Pick a format
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Choose the competition structure for this division.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {FORMAT_BUILDERS.map((builder) => {
          const selected = builder.id === selectedBuilderId
          const previewOptions: FormatBuilderOptions = {
            ...options,
            teamCount: existingTeamCount > 0 ? existingTeamCount : (options.expectedTeamCount ?? options.teamCount ?? 8),
          }
          const preview = resolveFormatBuilder(builder, previewOptions)

          return (
            <button
              key={builder.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(builder.id)}
              className={
                selected
                  ? 'rounded-lg border-2 border-mk-red bg-red-50 p-3 text-left shadow-sm dark:border-mk-red dark:bg-red-950/30'
                  : 'rounded-lg border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {builder.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {builder.description}
                  </p>
                </div>
                {selected && (
                  <span className="shrink-0 rounded-full bg-mk-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Selected
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {preview.phases.length} stage{preview.phases.length === 1 ? '' : 's'}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {teamSplitLabel(builder.teamSplit)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selectedBuilderId}
          onClick={onNext}
          className="rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next: Configure →
        </button>
      </div>
    </div>
  )
}
