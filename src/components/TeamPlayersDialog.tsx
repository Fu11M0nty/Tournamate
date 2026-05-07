'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import ConfirmDialog from './ConfirmDialog'
import type { Player, Team } from '@/lib/types'

interface TeamPlayersDialogProps {
  team: Team
  onClose: () => void
}

interface DraftPlayer {
  id?: string
  name: string
  dob: string
  registration_no: string
  notes: string
}

const EMPTY_DRAFT: DraftPlayer = {
  name: '',
  dob: '',
  registration_no: '',
  notes: '',
}

export default function TeamPlayersDialog({
  team,
  onClose,
}: TeamPlayersDialogProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<DraftPlayer>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) {
      toast.error(`Could not load players: ${error.message}`)
      setLoading(false)
      return
    }
    setPlayers((data ?? []) as Player[])
    setLoading(false)
  }, [supabase, team.id])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(p: Player) {
    setEditingId(p.id)
    setDraft({
      id: p.id,
      name: p.name,
      dob: p.dob ?? '',
      registration_no: p.registration_no ?? '',
      notes: p.notes ?? '',
    })
  }

  function cancelDraft() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function saveDraft() {
    if (draft.name.trim() === '') {
      toast.error('Player name is required.')
      return
    }
    setSavingDraft(true)
    const payload = {
      team_id: team.id,
      name: draft.name.trim(),
      dob: draft.dob || null,
      registration_no: draft.registration_no.trim() || null,
      notes: draft.notes.trim() || null,
    }
    const { data, error } = editingId
      ? await supabase
          .from('players')
          .update(payload)
          .eq('id', editingId)
          .select()
      : await supabase.from('players').insert(payload).select()
    setSavingDraft(false)
    if (error) {
      toast.error(`Could not save: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        editingId
          ? 'Update blocked by RLS. Check players_auth_update policy.'
          : 'Insert blocked by RLS. Check players_auth_insert policy.'
      )
      return
    }
    toast.success(editingId ? 'Player updated' : 'Player added')
    cancelDraft()
    await load()
  }

  async function confirmDelete(p: Player) {
    setPendingDelete(null)
    setBusyId(p.id)
    const { data, error } = await supabase
      .from('players')
      .delete()
      .eq('id', p.id)
      .select()
    setBusyId(null)
    if (error) {
      toast.error(`Could not delete: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error('Delete blocked by RLS. Check players_auth_delete policy.')
      return
    }
    toast.success('Player removed')
    await load()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="players-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mk-red">
              Players
            </p>
            <h2
              id="players-title"
              className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50"
            >
              {team.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </header>

        {loading ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            Loading…
          </p>
        ) : players.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No players on this roster yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.name}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {p.dob && <span>DOB {p.dob}</span>}
                    {p.registration_no && (
                      <span className="font-mono">{p.registration_no}</span>
                    )}
                    {p.notes && (
                      <span className="truncate italic">{p.notes}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p)}
                    disabled={busyId === p.id}
                    className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {busyId === p.id ? '…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {editingId ? 'Edit player' : 'Add player'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Name
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Date of birth
              <input
                type="date"
                value={draft.dob}
                onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Registration number
              <input
                type="text"
                value={draft.registration_no}
                onChange={(e) =>
                  setDraft({ ...draft, registration_no: e.target.value })
                }
                placeholder="e.g. EN-12345"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Notes
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={cancelDraft}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft}
              className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingDraft
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Add player'}
            </button>
          </div>
        </section>
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={`Remove "${pendingDelete.name}"?`}
          message={`This will remove ${pendingDelete.name} from the ${team.name} roster.`}
          confirmLabel="Remove player"
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
