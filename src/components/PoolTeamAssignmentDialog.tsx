'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Pool, PoolTeam, Team } from '@/lib/types'

interface PoolTeamAssignmentDialogProps {
  pool: Pool
  phasePools: Pool[]
  teams: Team[]
  assignedPoolTeams: PoolTeam[]
  onSaved: () => void
  onCancel: () => void
}

export default function PoolTeamAssignmentDialog({
  pool,
  phasePools,
  teams,
  assignedPoolTeams,
  onSaved,
  onCancel,
}: PoolTeamAssignmentDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(assignedPoolTeams.map((row) => row.team_id))
  )
  const [saving, setSaving] = useState(false)

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  const currentIds = useMemo(
    () => new Set(assignedPoolTeams.map((row) => row.team_id)),
    [assignedPoolTeams]
  )

  const assignedPoolByTeamId = useMemo(() => {
    const map = new Map<string, Pool>()
    for (const phasePool of phasePools) {
      for (const poolTeam of phasePool.pool_teams ?? []) {
        map.set(poolTeam.team_id, phasePool)
      }
    }
    return map
  }, [phasePools])

  const availableTeamIds = useMemo(
    () =>
      new Set(
        sortedTeams
          .filter((team) => {
            const assignedPool = assignedPoolByTeamId.get(team.id)
            return !assignedPool || assignedPool.id === pool.id
          })
          .map((team) => team.id)
      ),
    [assignedPoolByTeamId, pool.id, sortedTeams]
  )

  const selectableSelectedCount = useMemo(
    () => [...selectedIds].filter((id) => availableTeamIds.has(id)).length,
    [availableTeamIds, selectedIds]
  )

  function toggleTeam(teamId: string) {
    const assignedPool = assignedPoolByTeamId.get(teamId)
    if (assignedPool && assignedPool.id !== pool.id) return

    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)

    const removeIds = [...currentIds].filter((id) => !selectedIds.has(id))
    if (removeIds.length > 0) {
      const { error } = await supabase
        .from('pool_teams')
        .delete()
        .eq('pool_id', pool.id)
        .in('team_id', removeIds)

      if (error) {
        setSaving(false)
        toast.error(`Could not remove teams: ${error.message}`)
        return
      }
    }

    const selectedTeams = sortedTeams.filter(
      (team) => selectedIds.has(team.id) && availableTeamIds.has(team.id)
    )
    if (selectedTeams.length > 0) {
      const { error } = await supabase
        .from('pool_teams')
        .upsert(
          selectedTeams.map((team, index) => ({
            pool_id: pool.id,
            team_id: team.id,
            display_order: index + 1,
          })),
          { onConflict: 'pool_id,team_id' }
        )

      if (error) {
        setSaving(false)
        toast.error(`Could not assign teams: ${error.message}`)
        return
      }
    }

    setSaving(false)
    toast.success('Pool teams saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pool-teams-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="pool-teams-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            Assign teams
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {pool.name}
          </p>
        </header>

        {sortedTeams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            No teams exist in this division yet.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {selectableSelectedCount} selected
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set(availableTeamIds))}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Clear
                </button>
              </div>
            </div>

            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {sortedTeams.map((team) => {
                const assignedPool = assignedPoolByTeamId.get(team.id)
                const locked = Boolean(assignedPool && assignedPool.id !== pool.id)

                return (
                  <li key={team.id}>
                    <label
                      className={
                        locked
                          ? 'flex cursor-not-allowed items-center gap-3 bg-zinc-50 px-3 py-2 text-sm opacity-60 dark:bg-zinc-900/60'
                          : 'flex cursor-pointer items-center gap-3 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(team.id)}
                        disabled={locked}
                        onChange={() => toggleTeam(team.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-mk-red focus:ring-mk-red disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900 dark:text-zinc-50">
                        {team.name}
                      </span>
                      {locked && assignedPool && (
                        <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {assignedPool.name}
                        </span>
                      )}
                      {team.short_name && (
                        <span className="font-mono text-xs uppercase text-zinc-500 dark:text-zinc-400">
                          {team.short_name}
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          This updates pool membership only. Existing matches are not moved between pools.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save teams'}
          </button>
        </div>
      </div>
    </div>
  )
}
