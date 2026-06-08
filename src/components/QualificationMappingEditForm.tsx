'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  saveQualificationMapping,
  sourceTypeToSlotOutcome,
  slotOutcomeToSourceType,
  type QualificationMapping,
} from '@/lib/qualificationMappings'
import { createClient } from '@/lib/supabase'
import type {
  ElementSlotType,
  Phase,
  PhaseElement,
  Pool,
  ProgressionSourceType,
  Team,
} from '@/lib/types'

interface QualificationMappingEditFormProps {
  mapping: QualificationMapping
  phases: Phase[]
  elements: PhaseElement[]
  pools: Pool[]
  teams: Team[]
  onSaved: () => void
  onCancel: () => void
}

const SLOT_TYPES: { value: ElementSlotType; label: string }[] = [
  { value: 'source', label: 'Qualifier from another phase/pool' },
  { value: 'team', label: 'Fixed team' },
  { value: 'bye', label: 'Bye' },
  { value: 'manual', label: 'Manual entry' },
  { value: 'placeholder', label: 'Placeholder' },
]

const SOURCE_TYPES: { value: ProgressionSourceType; label: string }[] = [
  { value: 'standings_rank', label: 'Pool/table rank' },
  { value: 'best_rank', label: 'Best ranked across pools' },
  { value: 'match_winner', label: 'Match winner' },
  { value: 'match_loser', label: 'Match loser' },
  { value: 'manual', label: 'Manual source' },
]

function sourceNeedsRank(sourceType: ProgressionSourceType) {
  return sourceType === 'standings_rank' || sourceType === 'best_rank'
}

export default function QualificationMappingEditForm({
  mapping,
  phases,
  elements,
  pools,
  teams,
  onSaved,
  onCancel,
}: QualificationMappingEditFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [label, setLabel] = useState(mapping.label ?? '')
  const [slotType, setSlotType] = useState<ElementSlotType>(
    mapping.slotType === 'source' || mapping.progressionRule
      ? 'source'
      : mapping.slotType
  )
  const [teamId, setTeamId] = useState(mapping.teamId ?? '')
  const [sourceType, setSourceType] = useState<ProgressionSourceType>(
    mapping.sourceType ?? slotOutcomeToSourceType(mapping.sourceOutcome)
  )
  const [sourcePhaseId, setSourcePhaseId] = useState(mapping.sourcePhaseId ?? '')
  const [sourceElementId, setSourceElementId] = useState(mapping.sourceElementId ?? '')
  const [sourcePoolId, setSourcePoolId] = useState(mapping.sourcePoolId ?? '')
  const [sourceRank, setSourceRank] = useState(
    mapping.sourceRank ? String(mapping.sourceRank) : '1'
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsedRank = sourceRank ? Number(sourceRank) : null
    if (
      sourceNeedsRank(sourceType) &&
      (!parsedRank || !Number.isInteger(parsedRank) || parsedRank < 1)
    ) {
      toast.error('Choose a valid source rank.')
      return
    }

    if (slotType === 'team' && !teamId) {
      toast.error('Choose a fixed team for this slot.')
      return
    }

    if (
      slotType === 'source' &&
      sourceType !== 'manual' &&
      !sourcePhaseId &&
      !sourceElementId &&
      !sourcePoolId
    ) {
      toast.error('Choose the phase, pool or element this qualifier should come from.')
      return
    }

    setSaving(true)
    const result = await saveQualificationMapping(supabase, {
      targetElement: mapping.targetElement,
      targetSlotId: mapping.targetSlot.id,
      targetSlotOrder: mapping.targetSlotOrder,
      label,
      slotType,
      teamId: teamId || null,
      sourceType,
      sourcePhaseId: sourcePhaseId || null,
      sourceElementId: sourceElementId || null,
      sourcePoolId: sourcePoolId || null,
      sourceRank: sourceNeedsRank(sourceType) ? parsedRank : null,
      sourceOutcome: slotType === 'source' ? sourceTypeToSlotOutcome(sourceType) : null,
      ruleId: mapping.progressionRule?.id ?? null,
      ruleDisplayOrder: mapping.progressionRule?.display_order ?? mapping.targetSlotOrder,
    })
    setSaving(false)

    if (result.error) {
      toast.error(`Could not save qualification mapping: ${result.error}`)
      return
    }

    toast.success('Qualification mapping saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qualification-mapping-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="qualification-mapping-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            Set qualification source
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {mapping.targetElement.name} slot {mapping.targetSlotOrder}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Slot
              <input
                type="text"
                value={String(mapping.targetSlotOrder)}
                disabled
                className="mt-1 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm tabular-nums text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Display label
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Pool A winner"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Slot content
            <select
              value={slotType}
              onChange={(event) => setSlotType(event.target.value as ElementSlotType)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {SLOT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {slotType === 'team' && (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fixed team
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {slotType === 'source' && (
            <section className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Source rule
                <select
                  value={sourceType}
                  onChange={(event) => setSourceType(event.target.value as ProgressionSourceType)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {SOURCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {sourceNeedsRank(sourceType) && (
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Rank
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={sourceRank}
                    onChange={(event) => setSourceRank(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              )}

              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Source phase
                <select
                  value={sourcePhaseId}
                  onChange={(event) => setSourcePhaseId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Any phase</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Source element
                <select
                  value={sourceElementId}
                  onChange={(event) => setSourceElementId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Any element</option>
                  {elements.map((element) => (
                    <option key={element.id} value={element.id}>
                      {element.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
                Source pool
                <select
                  value={sourcePoolId}
                  onChange={(event) => setSourcePoolId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Any pool</option>
                  {pools.map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {mapping.mismatchReasons.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {mapping.mismatchReasons.join(' ')}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
