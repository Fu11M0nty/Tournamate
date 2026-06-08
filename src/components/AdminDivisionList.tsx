'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import DivisionEditForm from './DivisionEditForm'
import AdminStructureView from './AdminStructureView'
import { createClient } from '@/lib/supabase'
import { describeMatchRules } from '@/lib/matchRules'
import { labelForLegacyDay } from '@/lib/competitionDates'
import type { Division, Tournament } from '@/lib/types'

interface AdminDivisionListProps {
  tournament: Tournament
  divisions: Division[]
  onChanged: () => void
  onClose: () => void
  onEditTeams?: (g: Division) => void
}

export default function AdminDivisionList({
  tournament,
  divisions,
  onChanged,
  onClose,
  onEditTeams,
}: AdminDivisionListProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Division | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Division | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<{ teamCount: number; scheduled: number; completed: number } | null>(null)
  const [loadingDeleteInfo, setLoadingDeleteInfo] = useState(false)
  const [typeConfirm, setTypeConfirm] = useState('')
  const [formatDivision, setFormatDivision] = useState<Division | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  const supabase = createClient()

  const sorted = [...divisions].sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      a.display_order - b.display_order ||
      a.name.localeCompare(b.name)
  )

  const nextDisplayOrder =
    divisions.reduce((max, g) => Math.max(max, g.display_order), 0) + 1

  if (formatDivision) {
    const currentFormatDivision =
      divisions.find((division) => division.id === formatDivision.id) ??
      formatDivision

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setFormatDivision(null)}
              className="mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Divisions
            </button>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {currentFormatDivision.name} format
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Choose how teams compete, qualify, and create fixtures for this division.
            </p>
          </div>
          {onEditTeams && (
            <button
              type="button"
              onClick={() => onEditTeams(currentFormatDivision)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Add/Edit Teams
            </button>
          )}
        </div>

        <AdminStructureView
          tournament={tournament}
          divisions={[currentFormatDivision]}
          embedded
          onChanged={onChanged}
        />
      </div>
    )
  }

  async function handleDeleteClick(g: Division) {
    setPendingDelete(g)
    setDeleteInfo(null)
    setTypeConfirm('')
    setLoadingDeleteInfo(true)
    const [teamRes, matchRes] = await Promise.all([
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('age_group_id', g.id).is('deleted_at', null),
      supabase.from('matches').select('id, status').eq('age_group_id', g.id).is('deleted_at', null),
    ])
    const rows = (matchRes.data ?? []) as { status: string }[]
    setDeleteInfo({
      teamCount: teamRes.count ?? 0,
      scheduled: rows.filter((m) => m.status === 'scheduled').length,
      completed: rows.filter((m) => m.status === 'completed').length,
    })
    setLoadingDeleteInfo(false)
  }

  function closeDeleteModal() {
    setPendingDelete(null)
    setDeleteInfo(null)
    setTypeConfirm('')
  }

  async function confirmDelete(g: Division) {
    closeDeleteModal()
    setDeletingId(g.id)
    const { data, error } = await supabase
      .from('age_groups')
      .delete()
      .eq('id', g.id)
      .select()
    setDeletingId(null)
    if (error) {
      toast.error(`Could not delete: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error('Delete blocked by RLS — check age_groups_auth_delete policy.')
      return
    }
    toast.success('Division deleted')
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Divisions — {tournament.name}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark"
          >
            New division
          </button>
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setShowActionsMenu((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="More actions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
          {showActionsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 z-50 flex flex-col rounded-md border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => { onClose(); setShowActionsMenu(false); }}
                  className="px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No divisions yet. Click&nbsp;
          <span className="font-semibold">New division</span> to get started.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {sorted.map((g) => (
            <li
              key={g.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {g.name}
                  </h3>
                  <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {labelForLegacyDay(tournament, g.day)}
                  </span>
                  {g.gender && (
                    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      {g.gender}
                    </span>
                  )}
                  {g.skill_level && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {g.skill_level}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  /{g.slug} · order {g.display_order}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold">
                    {g.match_format === 'continuous'
                      ? 'Continuous'
                      : g.match_format === 'halves'
                        ? '2 halves'
                        : '4 quarters'}
                  </span>{' '}
                  — {describeMatchRules(g)}
                </p>
              </div>
              <div className="mt-1 flex w-full shrink-0 flex-wrap gap-2 sm:mt-0 sm:w-auto">
                {onEditTeams && (
                  <button
                    type="button"
                    onClick={() => onEditTeams(g)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                  >
                    👥 <span className="hidden sm:inline">Add/Edit Teams</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFormatDivision(g)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-sky-900 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950 sm:flex-none"
                >
                  Format
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(g)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                >
                  ✏️ <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(g)}
                  disabled={deletingId === g.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950 sm:flex-none"
                >
                  {deletingId === g.id ? '…' : <>🗑️ <span className="hidden sm:inline">Delete</span></>}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <DivisionEditForm
          mode="create"
          tournamentId={tournament.id}
          tournament={tournament}
          defaultDisplayOrder={nextDisplayOrder}
          onSaved={() => {
            setCreating(false)
            onChanged()
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <DivisionEditForm
          mode="edit"
          tournamentId={tournament.id}
          tournament={tournament}
          division={editing}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            {(deleteInfo?.completed ?? 0) > 0 && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/50">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                  Completed match results will be permanently lost
                </p>
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                  This cannot be undone. There is no recovery option for division deletions.
                </p>
              </div>
            )}

            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                <svg className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Permanently delete &ldquo;{pendingDelete.name}&rdquo;?
                </h2>
                {loadingDeleteInfo ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Checking division data…</p>
                ) : deleteInfo ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">This will permanently delete:</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {deleteInfo.teamCount > 0 && (
                        <li className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <span className="text-red-500">×</span>
                          {deleteInfo.teamCount} team{deleteInfo.teamCount !== 1 ? 's' : ''}
                        </li>
                      )}
                      {deleteInfo.completed > 0 && (
                        <li className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400">
                          <span>×</span>
                          {deleteInfo.completed} completed result{deleteInfo.completed !== 1 ? 's' : ''} — permanently lost
                        </li>
                      )}
                      {deleteInfo.scheduled > 0 && (
                        <li className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <span className="text-red-500">×</span>
                          {deleteInfo.scheduled} scheduled fixture{deleteInfo.scheduled !== 1 ? 's' : ''}
                        </li>
                      )}
                      {deleteInfo.teamCount === 0 && deleteInfo.scheduled === 0 && deleteInfo.completed === 0 && (
                        <li className="text-zinc-500 dark:text-zinc-400">Division settings and configuration</li>
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            {!loadingDeleteInfo && deleteInfo && (deleteInfo.scheduled + deleteInfo.completed) > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Type <span className="font-mono">{pendingDelete.name}</span> to confirm permanent deletion
                </label>
                <input
                  type="text"
                  value={typeConfirm}
                  onChange={(e) => setTypeConfirm(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder={pendingDelete.name}
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  loadingDeleteInfo ||
                  (deleteInfo !== null &&
                    (deleteInfo.scheduled + deleteInfo.completed) > 0 &&
                    typeConfirm !== pendingDelete.name)
                }
                onClick={() => confirmDelete(pendingDelete)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Delete division
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


