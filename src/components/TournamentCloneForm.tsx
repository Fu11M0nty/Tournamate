'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import type { Tournament, TournamentStatus } from '@/lib/types'

interface TournamentCloneFormProps {
  source: Tournament
  onSaved: () => void
  onCancel: () => void
}

const STATUSES: TournamentStatus[] = ['upcoming', 'live', 'complete']

export default function TournamentCloneForm({
  source,
  onSaved,
  onCancel,
}: TournamentCloneFormProps) {
  const [name, setName] = useState(`Copy of ${source.name}`)
  const [slug, setSlug] = useState(`${source.slug}-copy`)
  const [slugTouched, setSlugTouched] = useState(false)
  const [startDate, setStartDate] = useState(source.start_date ?? '')
  const [endDate, setEndDate] = useState(source.end_date ?? '')
  const [status, setStatus] = useState<TournamentStatus>('upcoming')
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

    setSaving(true)
    const { error } = await supabase.rpc('clone_tournament', {
      source_slug: source.slug,
      new_slug: trimmedSlug,
      new_name: name.trim(),
      new_start_date: startDate || null,
      new_end_date: endDate || null,
      new_status: status,
    })
    setSaving(false)

    if (error) {
      toast.error(`Clone failed: ${error.message}`)
      return
    }
    toast.success(`Cloned from ${source.name}`)
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-clone-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-mk-red">
            Clone fixtures
          </p>
          <h2
            id="tournament-clone-title"
            className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            From {source.name}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Copies divisions, teams and the fixture schedule. Scores, penalties
            and scoresheets are not copied.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="c-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              New name
            </label>
            <input
              id="c-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="c-slug"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              New URL slug
            </label>
            <input
              id="c-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="c-start"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Start date
              </label>
              <input
                id="c-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                Match kickoffs shift to align with this date.
              </p>
            </div>
            <div>
              <label
                htmlFor="c-end"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                End date
              </label>
              <input
                id="c-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="c-status"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Status
            </label>
            <select
              id="c-status"
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
              {saving ? 'Cloning…' : 'Clone tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

