'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { saveQualificationMapping } from '@/lib/qualificationMappings'
import type {
  ElementSlot,
  ElementSlotType,
  Phase,
  PhaseElement,
  Pool,
  SlotSourceOutcome,
  Team,
} from '@/lib/types'

interface ElementSlotEditFormProps {
  mode: 'create' | 'edit'
  element: PhaseElement
  slot?: ElementSlot
  phases: Phase[]
  elements: PhaseElement[]
  pools: Pool[]
  teams: Team[]
  defaultDisplayOrder?: number
  onSaved: () => void
  onCancel: () => void
}

const SLOT_TYPES: { value: ElementSlotType; label: string }[] = [
  { value: 'placeholder', label: 'Placeholder' },
  { value: 'team', label: 'Fixed team' },
  { value: 'source', label: 'Source' },
  { value: 'bye', label: 'Bye' },
  { value: 'manual', label: 'Manual' },
]

const SOURCE_OUTCOMES: { value: SlotSourceOutcome; label: string }[] = [
  { value: 'rank', label: 'Rank from pool/element' },
  { value: 'best_rank', label: 'Best ranked team' },
  { value: 'winner', label: 'Match winner' },
  { value: 'loser', label: 'Match loser' },
  { value: 'manual', label: 'Manual source' },
]

export default function ElementSlotEditForm({
  mode,
  element,
  slot,
  phases,
  elements,
  pools,
  teams,
  defaultDisplayOrder,
  onSaved,
  onCancel,
}: ElementSlotEditFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [displayOrder, setDisplayOrder] = useState(
    String(slot?.display_order ?? defaultDisplayOrder ?? 1)
  )
  const [label, setLabel] = useState(slot?.label ?? '')
  const [slotType, setSlotType] = useState<ElementSlotType>(
    slot?.slot_type ?? 'placeholder'
  )
  const [teamId, setTeamId] = useState(slot?.team_id ?? '')
  const [sourcePhaseId, setSourcePhaseId] = useState(slot?.source_phase_id ?? '')
  const [sourceElementId, setSourceElementId] = useState(slot?.source_element_id ?? '')
  const [sourcePoolId, setSourcePoolId] = useState(slot?.source_pool_id ?? '')
  const [sourceOutcome, setSourceOutcome] = useState<SlotSourceOutcome>(
    slot?.source_outcome ?? 'rank'
  )
  const [sourceRank, setSourceRank] = useState(
    slot?.source_rank ? String(slot.source_rank) : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const order = Number(displayOrder)
    if (!Number.isInteger(order) || order < 1) {
      toast.error('Display order must be a whole number greater than zero.')
      return
    }

    const parsedRank = sourceRank ? Number(sourceRank) : null
    if (parsedRank !== null && (!Number.isInteger(parsedRank) || parsedRank < 1)) {
      toast.error('Source rank must be a whole number greater than zero.')
      return
    }

    if (slotType === 'team' && !teamId) {
      toast.error('Choose a team for a fixed team slot.')
      return
    }
    if (slotType === 'source' && !sourcePhaseId && !sourceElementId && !sourcePoolId) {
      toast.error('Choose at least one source for a source slot.')
      return
    }

    setSaving(true)
    const result = await saveQualificationMapping(supabase, {
      targetElement: element,
      targetSlotId: mode === 'edit' ? slot!.id : null,
      targetSlotOrder: order,
      label,
      slotType,
      teamId,
      sourcePhaseId: sourcePhaseId || null,
      sourceElementId: sourceElementId || null,
      sourcePoolId: sourcePoolId || null,
      sourceRank: parsedRank,
      sourceOutcome,
    })
    setSaving(false)

    if (result.error) {
      toast.error(`Could not save slot: ${result.error}`)
      return
    }

    toast.success(
      slotType === 'source'
        ? mode === 'create'
          ? 'Qualification mapping created'
          : 'Qualification mapping saved'
        : mode === 'create'
          ? 'Slot created'
          : 'Slot saved'
    )
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="slot-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New slot' : 'Edit slot'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {element.name}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Order
              <input
                type="number"
                min="1"
                step="1"
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Label
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Semi-final 1 home"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Slot type
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
              Team
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
                Source outcome
                <select
                  value={sourceOutcome}
                  onChange={(event) => setSourceOutcome(event.target.value as SlotSourceOutcome)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {SOURCE_OUTCOMES.map((outcome) => (
                    <option key={outcome.value} value={outcome.value}>
                      {outcome.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Rank
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={sourceRank}
                  onChange={(event) => setSourceRank(event.target.value)}
                  placeholder="1"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
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
                  {elements.map((sourceElement) => (
                    <option key={sourceElement.id} value={sourceElement.id}>
                      {sourceElement.name}
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
              {saving ? 'Saving...' : 'Save slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
