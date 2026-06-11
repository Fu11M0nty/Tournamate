'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import HelpPrompt from '@/components/help/HelpPrompt'

interface SnapshotEntry {
  backed_up_at: string
  reason: string | null
}

interface BackupMatch {
  id: string
  age_group_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  court: string | null
  kickoff_time: string
  status: string
  backed_up_at: string
  reason: string | null
}

export default function SnapshotView() {
  const supabase = useMemo(() => createClient(), [])
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [matches, setMatches] = useState<BackupMatch[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, string>>({})
  const [groupMap, setGroupMap] = useState<Record<string, { name: string; day: string }>>({})
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    async function loadSnapshots() {
      const { data, error } = await supabase
        .from('matches_backup')
        .select('backed_up_at, reason')
        .order('backed_up_at', { ascending: false })

      setLoadingList(false)
      if (error) {
        toast.error(`Could not load snapshots: ${error.message}`)
        return
      }

      // Deduplicate by backed_up_at, keep first reason seen per timestamp
      const seen = new Set<string>()
      const unique: SnapshotEntry[] = []
      for (const r of (data ?? []) as { backed_up_at: string; reason: string | null }[]) {
        if (!seen.has(r.backed_up_at)) {
          seen.add(r.backed_up_at)
          unique.push({ backed_up_at: r.backed_up_at, reason: r.reason ?? null })
        }
      }
      setSnapshots(unique)
    }
    loadSnapshots()
  }, [supabase])

  const loadSnapshot = useCallback(
    async (ts: string) => {
      setLoadingDetail(true)
      setSelected(ts)

      const [backupRes, teamsRes, groupsRes] = await Promise.all([
        supabase
          .from('matches_backup')
          .select('*')
          .eq('backed_up_at', ts)
          .order('kickoff_time', { ascending: true }),
        supabase.from('teams').select('id, name'),
        supabase.from('age_groups').select('id, name, day'),
      ])

      setLoadingDetail(false)

      if (backupRes.error) {
        toast.error(`Could not load snapshot: ${backupRes.error.message}`)
        return
      }

      setMatches((backupRes.data ?? []) as BackupMatch[])

      const tm: Record<string, string> = {}
      for (const t of (teamsRes.data ?? [])) tm[t.id] = t.name
      setTeamMap(tm)

      const gm: Record<string, { name: string; day: string }> = {}
      for (const g of (groupsRes.data ?? [])) gm[g.id] = { name: g.name, day: g.day }
      setGroupMap(gm)
    },
    [supabase]
  )

  const grouped = useMemo(
    () =>
      matches.reduce<Record<string, BackupMatch[]>>((acc, m) => {
        if (!acc[m.age_group_id]) acc[m.age_group_id] = []
        acc[m.age_group_id].push(m)
        return acc
      }, {}),
    [matches]
  )

  const selectedEntry = snapshots.find((s) => s.backed_up_at === selected) ?? null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Snapshots
          <HelpPrompt guideSlug="snapshots" label="snapshots" tip="Point-in-time backups and how to restore them" />
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Read-only view of saved match backups. Select a snapshot to inspect it.
        </p>
      </div>

      {loadingList ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Loading snapshots…
        </p>
      ) : snapshots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No snapshots yet. Use the Snapshot button at the bottom of the match list in Match Entry.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Snapshot list */}
          <div className="w-full shrink-0 sm:w-64">
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {snapshots.map((s) => (
                <li key={s.backed_up_at}>
                  <button
                    type="button"
                    onClick={() => loadSnapshot(s.backed_up_at)}
                    className={[
                      'w-full px-4 py-3 text-left transition-colors',
                      selected === s.backed_up_at
                        ? 'bg-indigo-600 text-white'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                    ].join(' ')}
                  >
                    <p
                      className={[
                        'text-xs font-semibold',
                        selected === s.backed_up_at
                          ? 'text-white'
                          : 'text-zinc-900 dark:text-zinc-100',
                      ].join(' ')}
                    >
                      {new Date(s.backed_up_at).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {s.reason && (
                      <p
                        className={[
                          'mt-0.5 truncate text-[11px]',
                          selected === s.backed_up_at
                            ? 'text-indigo-200'
                            : 'text-zinc-500 dark:text-zinc-400',
                        ].join(' ')}
                      >
                        {s.reason}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Snapshot detail */}
          <div className="min-w-0 flex-1">
            {!selected && (
              <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Select a snapshot to view its contents.
              </p>
            )}
            {selected && loadingDetail && (
              <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            )}
            {selected && !loadingDetail && (
              <div className="space-y-3">
                {/* Reason banner */}
                {selectedEntry?.reason && (
                  <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        Reason for snapshot
                      </p>
                      <p className="mt-0.5 text-sm text-indigo-800 dark:text-indigo-200">
                        {selectedEntry.reason}
                      </p>
                    </div>
                  </div>
                )}

                {Object.entries(grouped).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    No matches in this snapshot.
                  </p>
                ) : (
                  Object.entries(grouped).map(([groupId, groupMatches]) => {
                    const grp = groupMap[groupId]
                    return (
                      <div
                        key={groupId}
                        className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            {grp ? `${grp.name} · ${grp.day}` : groupId}
                            <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
                              {groupMatches.length} match{groupMatches.length !== 1 ? 'es' : ''}
                            </span>
                          </p>
                        </div>
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {groupMatches.map((m) => (
                            <li key={m.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                              <span
                                className={[
                                  'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                  m.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                                ].join(' ')}
                              >
                                {m.status === 'completed' ? 'FT' : 'Sch'}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                                {teamMap[m.home_team_id] ?? '—'}
                              </span>
                              <span className="shrink-0 font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                                {m.home_score ?? '–'} : {m.away_score ?? '–'}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-right text-zinc-800 dark:text-zinc-200">
                                {teamMap[m.away_team_id] ?? '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
