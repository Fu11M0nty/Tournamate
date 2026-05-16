'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import TeamEditForm from './TeamEditForm'
import TeamLogoDropzone from './TeamLogoDropzone'
import TeamPlayersDialog from './TeamPlayersDialog'
import { createClient } from '@/lib/supabase'
import { restoreTeam, softDeleteTeam } from '@/lib/matches'
import type { Team } from '@/lib/types'

interface AdminTeamListProps {
  teams: Team[]
  ageGroupId: string
  ageGroupName: string
  onSaved: () => void
}

export default function AdminTeamList({
  teams,
  ageGroupId,
  ageGroupName,
  onSaved,
}: AdminTeamListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [playersTeamId, setPlayersTeamId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedTeams, setDeletedTeams] = useState<Team[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null)
  const [deleteMatchCounts, setDeleteMatchCounts] = useState<{ scheduled: number; completed: number } | null>(null)
  const [loadingDeleteCounts, setLoadingDeleteCounts] = useState(false)
  const [typeConfirm, setTypeConfirm] = useState('')
  const supabase = createClient()

  const loadDeleted = useCallback(async () => {
    setLoadingDeleted(true)
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('age_group_id', ageGroupId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setLoadingDeleted(false)
    if (error) {
      toast.error(`Could not load deleted teams: ${error.message}`)
      return
    }
    setDeletedTeams((data ?? []) as Team[])
  }, [supabase, ageGroupId])

  useEffect(() => {
    if (showDeleted) loadDeleted()
  }, [showDeleted, loadDeleted])

  async function handleDeleteClick(team: Team) {
    setPendingDelete(team)
    setDeleteMatchCounts(null)
    setTypeConfirm('')
    setLoadingDeleteCounts(true)
    const { data } = await supabase
      .from('matches')
      .select('id, status')
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .is('deleted_at', null)
    const rows = (data ?? []) as { status: string }[]
    setDeleteMatchCounts({
      scheduled: rows.filter((m) => m.status === 'scheduled').length,
      completed: rows.filter((m) => m.status === 'completed').length,
    })
    setLoadingDeleteCounts(false)
  }

  function closeDeleteModal() {
    setPendingDelete(null)
    setDeleteMatchCounts(null)
    setTypeConfirm('')
  }

  async function confirmDelete(team: Team) {
    closeDeleteModal()
    setBusyId(team.id)
    const r = await softDeleteTeam(supabase, team.id)
    setBusyId(null)
    if (r.error) {
      toast.error(`Could not delete: ${r.error}`)
      return
    }
    toast.success(
      `Deleted ${team.name}` +
        (r.matches > 0
          ? ` · ${r.matches} fixture${r.matches === 1 ? '' : 's'} hidden`
          : '')
    )
    onSaved()
    if (showDeleted) loadDeleted()
  }

  async function handleRestore(team: Team) {
    setBusyId(team.id)
    const r = await restoreTeam(supabase, team.id)
    setBusyId(null)
    if (r.error) {
      toast.error(`Could not restore: ${r.error}`)
      return
    }
    toast.success(
      `Restored ${team.name}` +
        (r.matches > 0
          ? ` · ${r.matches} fixture${r.matches === 1 ? '' : 's'} reactivated`
          : '')
    )
    onSaved()
    loadDeleted()
  }

  const sorted = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  const editingTeam = editingId
    ? sorted.find((t) => t.id === editingId) ?? null
    : null
  const playersTeam = playersTeamId
    ? sorted.find((t) => t.id === playersTeamId) ?? null
    : null

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={() => setShowDeleted((s) => !s)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {showDeleted ? 'Hide deleted' : 'Show deleted'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red-dark"
        >
          Add team
        </button>
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
                  onClick={() => { setShowDeleted((s) => !s); setShowActionsMenu(false); }}
                  className="px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {showDeleted ? 'Hide deleted' : 'Show deleted'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No teams in this division yet. Click&nbsp;
          <span className="font-semibold">Add team</span> to start building the
          roster.
        </p>
      ) : (
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {sorted.map((team) => (
          <li
            key={team.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <TeamLogoDropzone team={team} size="md" onSaved={onSaved} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {team.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {team.short_name && (
                    <span className="font-mono uppercase">{team.short_name}</span>
                  )}
                  {team.color && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-700"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="tabular-nums">{team.color}</span>
                    </span>
                  )}
                  {!team.logo_url && <span>No logo</span>}
                </div>
              </div>
            </div>
            <div className="mt-1 flex w-full shrink-0 gap-2 sm:mt-0 sm:w-auto">
              <button
                type="button"
                onClick={() => setPlayersTeamId(team.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
              >
                👥 <span className="hidden sm:inline">Players</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingId(team.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
              >
                ✏️ <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClick(team)}
                disabled={busyId === team.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950 sm:flex-none"
              >
                {busyId === team.id ? '…' : <>🗑️ <span className="hidden sm:inline">Delete</span></>}
              </button>
            </div>
          </li>
        ))}
      </ul>
      )}

      {showDeleted && (
        <section className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <header className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Deleted teams ({deletedTeams.length})
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Audit trail · soft-deleted, recoverable
            </p>
          </header>
          {loadingDeleted ? (
            <p className="text-center text-xs text-zinc-400">Loading…</p>
          ) : deletedTeams.length === 0 ? (
            <p className="text-center text-xs text-zinc-400">
              No deleted teams in this group.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {deletedTeams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center gap-3 px-3 py-2 opacity-70"
                >
                  <span className="rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Deleted
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-700 line-through dark:text-zinc-300">
                      {team.name}
                    </p>
                    <p className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      Deleted{' '}
                      {team.deleted_at
                        ? new Date(team.deleted_at).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/London',
                          })
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(team)}
                    disabled={busyId === team.id}
                    className="rounded-md border border-emerald-400 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  >
                    {busyId === team.id ? '…' : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && (
        <TeamEditForm
          ageGroupId={ageGroupId}
          ageGroupName={ageGroupName}
          onSave={() => {
            setCreating(false)
            onSaved()
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {editingTeam && (
        <TeamEditForm
          team={editingTeam}
          ageGroupId={ageGroupId}
          ageGroupName={ageGroupName}
          onSave={() => {
            setEditingId(null)
            onSaved()
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
      {playersTeam && (
        <TeamPlayersDialog
          team={playersTeam}
          onClose={() => setPlayersTeamId(null)}
        />
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
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
                  Delete &ldquo;{pendingDelete.name}&rdquo;?
                </h2>
                {loadingDeleteCounts ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Checking fixtures…</p>
                ) : deleteMatchCounts ? (
                  <div className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {deleteMatchCounts.completed > 0 ? (
                      <>
                        <p>
                          This team has{' '}
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {deleteMatchCounts.completed} completed result{deleteMatchCounts.completed !== 1 ? 's' : ''}
                          </span>
                          {deleteMatchCounts.scheduled > 0 && (
                            <> and {deleteMatchCounts.scheduled} upcoming fixture{deleteMatchCounts.scheduled !== 1 ? 's' : ''}</>
                          )}.
                          Their results will be hidden from standings and the schedule.
                        </p>
                        <p className="text-xs">This is a soft delete — the team and all their results can be restored from the deleted teams panel.</p>
                      </>
                    ) : deleteMatchCounts.scheduled > 0 ? (
                      <>
                        <p>
                          This team has{' '}
                          <span className="font-semibold">{deleteMatchCounts.scheduled} upcoming fixture{deleteMatchCounts.scheduled !== 1 ? 's' : ''}</span>{' '}
                          that will be hidden from the schedule.
                        </p>
                        <p className="text-xs">This is a soft delete — the team and their fixtures can be restored later.</p>
                      </>
                    ) : (
                      <p>This is a soft delete — the team can be restored from the deleted teams panel.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {!loadingDeleteCounts && (deleteMatchCounts?.completed ?? 0) > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Type <span className="font-mono">{pendingDelete.name}</span> to confirm
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
                  loadingDeleteCounts ||
                  ((deleteMatchCounts?.completed ?? 0) > 0 && typeConfirm !== pendingDelete.name)
                }
                onClick={() => confirmDelete(pendingDelete)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Delete team
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

