'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import type { Tournament, TournamentStatus } from '@/lib/types'

interface TournamentEditFormProps {
  mode: 'create' | 'edit'
  tournament?: Tournament
  onSaved: () => void
  onCancel: () => void
}

const STATUSES: TournamentStatus[] = ['upcoming', 'live', 'complete']

export default function TournamentEditForm({
  mode,
  tournament,
  onSaved,
  onCancel,
}: TournamentEditFormProps) {
  const [name, setName] = useState(tournament?.name ?? '')
  const [slug, setSlug] = useState(tournament?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [startDate, setStartDate] = useState(tournament?.start_date ?? '')
  const [endDate, setEndDate] = useState(tournament?.end_date ?? '')
  const [status, setStatus] = useState<TournamentStatus>(
    tournament?.status ?? 'upcoming'
  )
  const [displayOrder, setDisplayOrder] = useState<string>(
    String(tournament?.display_order ?? 0)
  )
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedSlug = slug.trim()
    if (!name.trim() || !trimmedSlug) {
      toast.error('Name and slug are required.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error('Slug can only contain lowercase letters, numbers and hyphens.')
      return
    }
    const order = Number(displayOrder)
    if (!Number.isInteger(order)) {
      toast.error('Display order must be a whole number.')
      return
    }

    const basePayload = {
      name: name.trim(),
      slug: trimmedSlug,
      start_date: startDate || null,
      end_date: endDate || null,
      status,
      display_order: order,
    }

    setSaving(true)

    let data, error
    if (mode === 'create') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Not authenticated')
        setSaving(false)
        return
      }
      ;({ data, error } = await supabase
        .from('tournaments')
        .insert({ ...basePayload, created_by: user.id })
        .select())
    } else {
      ;({ data, error } = await supabase
        .from('tournaments')
        .update(basePayload)
        .eq('id', tournament!.id)
        .select())
    }
    setSaving(false)

    if (error) {
      toast.error(`Could not save: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        mode === 'create'
          ? 'Insert blocked by Supabase row-level security. Check the tournaments_auth_insert policy.'
          : 'Update blocked by Supabase row-level security. Check the tournaments_auth_update policy.'
      )
      return
    }
    toast.success(mode === 'create' ? 'Tournament created' : 'Tournament saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="tournament-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New tournament' : 'Edit tournament'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="t-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="t-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="2027 Club Day"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="t-slug"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              URL slug
            </label>
            <input
              id="t-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              placeholder="2027-club-day"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              Public URL: <code>/{slug || '…'}</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="t-start"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Start date
              </label>
              <input
                id="t-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="t-end"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                End date
              </label>
              <input
                id="t-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="t-status"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Status
              </label>
              <select
                id="t-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentStatus)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="t-order"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Display order
              </label>
              <input
                id="t-order"
                type="number"
                step="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
