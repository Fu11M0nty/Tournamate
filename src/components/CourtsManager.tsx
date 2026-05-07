'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import CourtEditForm from './CourtEditForm'
import ConfirmDialog from './ConfirmDialog'
import { createClient } from '@/lib/supabase'
import type { Court, Day } from '@/lib/types'

interface CourtsManagerProps {
  tournamentId: string
  day: Day
  courts: Court[]
  onChanged: () => void
}

export default function CourtsManager({
  tournamentId,
  day,
  courts,
  onChanged,
}: CourtsManagerProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Court | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Court | null>(null)

  const supabase = createClient()

  const sorted = [...courts]
    .filter((c) => c.day === day)
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name)
    )
  const nextOrder =
    sorted.reduce((max, c) => Math.max(max, c.display_order), 0) + 1

  async function confirmDelete(c: Court) {
    setPendingDelete(null)
    setBusyId(c.id)
    const { data, error } = await supabase
      .from('courts')
      .delete()
      .eq('id', c.id)
      .select()
    setBusyId(null)
    if (error) {
      toast.error(`Could not delete: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error('Delete blocked by RLS.')
      return
    }
    toast.success(`Removed ${c.name}`)
    onChanged()
  }

  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {day === 'saturday' ? 'Saturday' : 'Sunday'} courts ({sorted.length})
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-mk-red px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-mk-red-dark"
        >
          New court
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No courts configured. Click&nbsp;
          <span className="font-semibold">New court</span> to add one.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {sorted.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {c.display_order}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900 dark:text-zinc-100">
                {c.name}
              </span>
              <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {c.start_time} – {c.end_time}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(c)}
                  disabled={busyId === c.id}
                  className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {busyId === c.id ? '…' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CourtEditForm
          mode="create"
          tournamentId={tournamentId}
          day={day}
          defaultDisplayOrder={nextOrder}
          onSaved={() => {
            setCreating(false)
            onChanged()
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <CourtEditForm
          mode="edit"
          tournamentId={tournamentId}
          day={editing.day}
          court={editing}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Remove "${pendingDelete.name}"?`}
          message={`Matches already scheduled on this court will keep their court label but the court won't appear as a column.`}
          confirmLabel="Remove court"
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
