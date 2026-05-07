'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import AgeGroupEditForm from './AgeGroupEditForm'
import ConfirmDialog from './ConfirmDialog'
import { createClient } from '@/lib/supabase'
import { describeMatchRules } from '@/lib/matchRules'
import type { AgeGroup, Tournament } from '@/lib/types'

interface AdminAgeGroupListProps {
  tournament: Tournament
  ageGroups: AgeGroup[]
  onChanged: () => void
  onClose: () => void
  onEditTeams?: (g: AgeGroup) => void
}

export default function AdminAgeGroupList({
  tournament,
  ageGroups,
  onChanged,
  onClose,
  onEditTeams,
}: AdminAgeGroupListProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AgeGroup | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AgeGroup | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  const supabase = createClient()

  const sorted = [...ageGroups].sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      a.display_order - b.display_order ||
      a.name.localeCompare(b.name)
  )

  const nextDisplayOrder =
    ageGroups.reduce((max, g) => Math.max(max, g.display_order), 0) + 1

  async function confirmDelete(g: AgeGroup) {
    setPendingDelete(null)
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
    toast.success('Age group deleted')
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Age groups — {tournament.name}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark"
          >
            New age group
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
          No age groups yet. Click&nbsp;
          <span className="font-semibold">New age group</span> to get started.
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
                    {g.day === 'saturday' ? 'Sat' : 'Sun'}
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
                  onClick={() => setEditing(g)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                >
                  ✏️ <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(g)}
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
        <AgeGroupEditForm
          mode="create"
          tournamentId={tournament.id}
          defaultDisplayOrder={nextDisplayOrder}
          onSaved={() => {
            setCreating(false)
            onChanged()
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <AgeGroupEditForm
          mode="edit"
          tournamentId={tournament.id}
          ageGroup={editing}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message={`This will permanently delete the age group "${pendingDelete.name}" (${pendingDelete.day}) and ALL its teams and matches.`}
          confirmLabel="Delete age group"
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
