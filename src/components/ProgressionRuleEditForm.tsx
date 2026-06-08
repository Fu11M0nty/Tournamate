'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import {
  saveQualificationMapping,
  sourceTypeToSlotOutcome,
} from '@/lib/qualificationMappings'
import type {
  ElementSlot,
  Phase,
  PhaseElement,
  Pool,
  ProgressionRule,
  ProgressionSourceType,
} from '@/lib/types'

interface ProgressionRuleEditFormProps {
  mode: 'create' | 'edit'
  targetElement: PhaseElement
  rule?: ProgressionRule
  phases: Phase[]
  elements: PhaseElement[]
  pools: Pool[]
  slots: ElementSlot[]
  defaultDisplayOrder?: number
  onSaved: () => void
  onCancel: () => void
}

const SOURCE_TYPES: { value: ProgressionSourceType; label: string }[] = [
  { value: 'standings_rank', label: 'Standings rank' },
  { value: 'best_rank', label: 'Best ranked team' },
  { value: 'match_winner', label: 'Match winner' },
  { value: 'match_loser', label: 'Match loser' },
  { value: 'manual', label: 'Manual' },
]

export default function ProgressionRuleEditForm({
  mode,
  targetElement,
  rule,
  phases,
  elements,
  pools,
  slots,
  defaultDisplayOrder,
  onSaved,
  onCancel,
}: ProgressionRuleEditFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const targetSlots = slots
    .filter((slot) => slot.phase_element_id === targetElement.id)
    .sort((a, b) => a.display_order - b.display_order)

  const [sourceType, setSourceType] = useState<ProgressionSourceType>(
    rule?.source_type ?? 'standings_rank'
  )
  const [fromPhaseId, setFromPhaseId] = useState(rule?.from_phase_id ?? '')
  const [fromElementId, setFromElementId] = useState(rule?.from_element_id ?? '')
  const [fromPoolId, setFromPoolId] = useState(rule?.from_pool_id ?? '')
  const [sourceRank, setSourceRank] = useState(
    rule?.source_rank ? String(rule.source_rank) : ''
  )
  const [toSlotId, setToSlotId] = useState(rule?.to_slot_id ?? '')
  const [toSlotOrder, setToSlotOrder] = useState(
    rule?.to_slot_order ? String(rule.to_slot_order) : ''
  )
  const [displayOrder, setDisplayOrder] = useState(
    String(rule?.display_order ?? defaultDisplayOrder ?? 1)
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

    const parsedSlotOrder = toSlotOrder ? Number(toSlotOrder) : null
    if (
      parsedSlotOrder !== null &&
      (!Number.isInteger(parsedSlotOrder) || parsedSlotOrder < 1)
    ) {
      toast.error('Target slot order must be a whole number greater than zero.')
      return
    }

    if (!toSlotId && parsedSlotOrder === null) {
      toast.error('Choose a target slot or enter a target slot order.')
      return
    }

    if (
      sourceType !== 'manual' &&
      !fromPhaseId &&
      !fromElementId &&
      !fromPoolId
    ) {
      toast.error('Choose where this progression rule should read from.')
      return
    }

    const selectedSlot = toSlotId
      ? targetSlots.find((slot) => slot.id === toSlotId) ?? null
      : null
    const targetSlotOrder = selectedSlot?.display_order ?? parsedSlotOrder
    if (!targetSlotOrder) {
      toast.error('Choose a target slot or enter a target slot order.')
      return
    }

    setSaving(true)
    const result = await saveQualificationMapping(supabase, {
      targetElement,
      targetSlotId: selectedSlot?.id ?? null,
      targetSlotOrder,
      label: selectedSlot?.label ?? null,
      slotType: 'source',
      sourceType,
      sourcePhaseId: fromPhaseId || null,
      sourceElementId: fromElementId || null,
      sourcePoolId: fromPoolId || null,
      sourceRank: parsedRank,
      sourceOutcome: sourceTypeToSlotOutcome(sourceType),
      ruleId: mode === 'edit' ? rule!.id : null,
      ruleDisplayOrder: order,
    })
    setSaving(false)

    if (result.error) {
      toast.error(`Could not save qualification mapping: ${result.error}`)
      return
    }

    toast.success(mode === 'create' ? 'Qualification mapping created' : 'Qualification mapping saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="progression-rule-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="progression-rule-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New progression rule' : 'Edit progression rule'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Target: {targetElement.name}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Source type
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
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Source rank
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
          </div>

          <section className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              From phase
              <select
                value={fromPhaseId}
                onChange={(event) => setFromPhaseId(event.target.value)}
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
              From element
              <select
                value={fromElementId}
                onChange={(event) => setFromElementId(event.target.value)}
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
              From pool
              <select
                value={fromPoolId}
                onChange={(event) => setFromPoolId(event.target.value)}
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

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Target slot
              <select
                value={toSlotId}
                onChange={(event) => setToSlotId(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Use target slot order</option>
                {targetSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.display_order}. {slot.label ?? slot.slot_type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Target order
              <input
                type="number"
                min="1"
                step="1"
                disabled={Boolean(toSlotId)}
                value={toSlotOrder}
                onChange={(event) => setToSlotOrder(event.target.value)}
                placeholder="1"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Rule order
            <input
              type="number"
              min="1"
              step="1"
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

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
              {saving ? 'Saving...' : 'Save rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
