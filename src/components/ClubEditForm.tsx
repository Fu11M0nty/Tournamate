'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Club } from '@/lib/types'

interface ClubEditFormProps {
  mode: 'create' | 'edit'
  club?: Club
  onSaved: () => void
  onCancel: () => void
}

export default function ClubEditForm({
  mode,
  club,
  onSaved,
  onCancel,
}: ClubEditFormProps) {
  const [name, setName] = useState(club?.name ?? '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Club name is required.')
      return
    }

    setSaving(true)
    const payload = { name: trimmedName }

    const { error } = mode === 'create'
      ? await supabase.from('clubs').insert(payload)
      : await supabase.from('clubs').update(payload).eq('id', club!.id)

    setSaving(false)

    if (error) {
      toast.error(`Could not save club: ${error.message}`)
      return
    }

    toast.success(mode === 'create' ? 'Club created' : 'Club updated')
    onSaved()
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            {mode === 'create' ? 'New Club' : 'Edit Club'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="club-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Club Name
            </label>
            <input
              id="club-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saints Netball Club"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-tm-orange focus:outline-none focus:ring-1 focus:ring-tm-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
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
              className="flex-1 rounded-md bg-tm-orange px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-tm-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
