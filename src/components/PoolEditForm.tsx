'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { slugify } from '@/lib/slugify'
import { createClient } from '@/lib/supabase'
import type { Phase, Pool } from '@/lib/types'

interface PoolEditFormProps {
  mode: 'create' | 'edit'
  phase: Phase
  pool?: Pool
  defaultDisplayOrder?: number
  defaultIsDefault?: boolean
  hasOtherDefault?: boolean
  onSaved: () => void
  onCancel: () => void
}

export default function PoolEditForm({
  mode,
  phase,
  pool,
  defaultDisplayOrder,
  defaultIsDefault = false,
  hasOtherDefault = false,
  onSaved,
  onCancel,
}: PoolEditFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState(pool?.name ?? '')
  const [slug, setSlug] = useState(pool?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [displayOrder, setDisplayOrder] = useState(
    String(pool?.display_order ?? defaultDisplayOrder ?? 1)
  )
  const [isDefault, setIsDefault] = useState(
    pool?.is_default ?? defaultIsDefault
  )
  const [saving, setSaving] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      toast.error('Pool name and slug are required.')
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

    if (mode === 'edit' && pool?.is_default && !isDefault && !hasOtherDefault) {
      toast.error('Set another pool as default before unsetting this one.')
      return
    }

    setSaving(true)

    if (isDefault) {
      const { error: defaultError } = await supabase
        .from('pools')
        .update({ is_default: false })
        .eq('phase_id', phase.id)

      if (defaultError) {
        setSaving(false)
        toast.error(`Could not update default pool: ${defaultError.message}`)
        return
      }
    }

    const payload = {
      phase_id: phase.id,
      name: trimmedName,
      slug: trimmedSlug,
      display_order: order,
      is_default: isDefault,
    }

    const { data, error } =
      mode === 'create'
        ? await supabase.from('pools').insert(payload).select()
        : await supabase
            .from('pools')
            .update(payload)
            .eq('id', pool!.id)
            .select()

    setSaving(false)

    if (error) {
      toast.error(`Could not save pool: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        mode === 'create'
          ? 'Insert blocked by Supabase row-level security. Check the pools_auth_insert policy.'
          : 'Update blocked by Supabase row-level security. Check the pools_auth_update policy.'
      )
      return
    }

    toast.success(mode === 'create' ? 'Pool created' : 'Pool saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pool-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="pool-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New pool' : 'Edit pool'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {phase.name}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Pool name
            <input
              type="text"
              required
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Pool A"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Slug
            <input
              type="text"
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
              placeholder="pool-a"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-mk-red focus:ring-mk-red"
              />
              Default pool
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
              disabled={saving}
              className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save pool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
