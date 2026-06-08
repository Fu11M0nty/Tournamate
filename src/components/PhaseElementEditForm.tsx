'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { slugify } from '@/lib/slugify'
import { createClient } from '@/lib/supabase'
import type { Phase, PhaseElement, PhaseElementType } from '@/lib/types'

interface PhaseElementEditFormProps {
  mode: 'create' | 'edit'
  phase: Phase
  element?: PhaseElement
  defaultDisplayOrder?: number
  onSaved: () => void
  onCancel: () => void
}

const ELEMENT_TYPES: { value: PhaseElementType; label: string }[] = [
  { value: 'group', label: 'Group' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'single_match', label: 'Single match' },
  { value: 'heat', label: 'Heat' },
  { value: 'league_table', label: 'League table' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'swiss_round', label: 'Swiss round' },
]

export default function PhaseElementEditForm({
  mode,
  phase,
  element,
  defaultDisplayOrder,
  onSaved,
  onCancel,
}: PhaseElementEditFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState(element?.name ?? '')
  const [slug, setSlug] = useState(element?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [elementType, setElementType] = useState<PhaseElementType>(
    element?.element_type ?? 'bracket'
  )
  const [displayOrder, setDisplayOrder] = useState(
    String(element?.display_order ?? defaultDisplayOrder ?? 1)
  )
  const [saving, setSaving] = useState(false)

  const isPoolBacked = Boolean(element?.pool_id)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (isPoolBacked) {
      toast.error('Pool-backed group elements are edited from the pool row.')
      return
    }

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      toast.error('Element name and slug are required.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error('Slug can only contain lowercase letters, numbers and hyphens.')
      return
    }

    const order = Number(displayOrder)
    if (!Number.isInteger(order) || order < 1) {
      toast.error('Display order must be a whole number greater than zero.')
      return
    }

    const payload = {
      phase_id: phase.id,
      slug: trimmedSlug,
      name: trimmedName,
      element_type: elementType,
      display_order: order,
      metadata: {},
    }

    setSaving(true)
    const { data, error } =
      mode === 'create'
        ? await supabase.from('phase_elements').insert(payload).select()
        : await supabase
            .from('phase_elements')
            .update(payload)
            .eq('id', element!.id)
            .select()
    setSaving(false)

    if (error) {
      toast.error(`Could not save element: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        mode === 'create'
          ? 'Insert blocked by Supabase row-level security. Check the phase_elements_auth_insert policy.'
          : 'Update blocked by Supabase row-level security. Check the phase_elements_auth_update policy.'
      )
      return
    }

    toast.success(mode === 'create' ? 'Element created' : 'Element saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-element-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="phase-element-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New element' : 'Edit element'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {phase.name}
          </p>
        </header>

        {isPoolBacked && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            This group element is linked to a pool. Edit the pool instead.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Element name
            <input
              type="text"
              required
              disabled={isPoolBacked}
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Semi-finals"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Slug
            <input
              type="text"
              required
              disabled={isPoolBacked}
              value={slug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
              placeholder="semi-finals"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type
              <select
                disabled={isPoolBacked}
                value={elementType}
                onChange={(event) => setElementType(event.target.value as PhaseElementType)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {ELEMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Order
              <input
                type="number"
                min="1"
                step="1"
                disabled={isPoolBacked}
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

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
              disabled={saving || isPoolBacked}
              className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save element'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
