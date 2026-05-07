'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import TournamentEditForm from './TournamentEditForm'
import TournamentCloneForm from './TournamentCloneForm'
import ConfirmDialog from './ConfirmDialog'
import { createClient } from '@/lib/supabase'
import type { Tournament } from '@/lib/types'

interface AdminTournamentListProps {
  tournaments: Tournament[]
  onChanged: () => void
}

const STATUS_TONE: Record<Tournament['status'], string> = {
  live: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  upcoming:
    'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  complete:
    'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800',
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '—'
  if (!end || end === start) return start
  return `${start} → ${end}`
}

export default function AdminTournamentList({
  tournaments,
  onChanged,
}: AdminTournamentListProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [cloning, setCloning] = useState<Tournament | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tournament | null>(null)

  async function confirmDelete(t: Tournament) {
    setPendingDelete(null)
    setDeletingId(t.id)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', t.id)
      .select()
    setDeletingId(null)
    if (error) {
      toast.error(`Could not delete: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        'Delete blocked by Supabase row-level security. Check the tournaments_auth_delete policy.'
      )
      return
    }
    toast.success('Tournament deleted')
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Tournaments
        </h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark"
        >
          New tournament
        </button>
      </div>

      {tournaments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No tournaments yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {tournaments.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {t.name}
                  </h3>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${STATUS_TONE[t.status]}`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  /{t.slug} · {formatDateRange(t.start_date, t.end_date)} · order{' '}
                  {t.display_order}
                </p>
              </div>
              <div className="mt-1 flex w-full shrink-0 gap-2 sm:mt-0 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                >
                  ✏️ <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCloning(t)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                >
                  📋 <span className="hidden sm:inline">Clone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(t)}
                  disabled={deletingId === t.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950 sm:flex-none"
                >
                  {deletingId === t.id ? '…' : <>🗑️ <span className="hidden sm:inline">Delete</span></>}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <TournamentEditForm
          mode="create"
          onSaved={() => {
            setCreating(false)
            onChanged()
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <TournamentEditForm
          mode="edit"
          tournament={editing}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {cloning && (
        <TournamentCloneForm
          source={cloning}
          onSaved={() => {
            setCloning(null)
            onChanged()
          }}
          onCancel={() => setCloning(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message={`This will permanently delete the tournament and ALL its age groups, teams and matches.`}
          confirmLabel="Delete tournament"
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
