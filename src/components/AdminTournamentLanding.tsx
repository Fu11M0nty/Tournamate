'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import TournamentEditForm from './TournamentEditForm'
import TournamentCloneForm from './TournamentCloneForm'
import ConfirmDialog from './ConfirmDialog'
import type { Tournament } from '@/lib/types'

const STATUS_TONE: Record<
  Tournament['status'],
  { badge: string; dot: string }
> = {
  live: {
    badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
    dot: 'bg-emerald-500',
  },
  upcoming: {
    badge: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
    dot: 'bg-amber-500',
  },
  complete: {
    badge: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    dot: 'bg-zinc-400',
  },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'No dates set'
  if (!end || end === start) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

interface Props {
  tournaments: Tournament[]
  loading: boolean
  onEnter: (t: Tournament) => void
  onChanged: () => void
}

export default function AdminTournamentLanding({
  tournaments,
  loading,
  onEnter,
  onChanged,
}: Props) {
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [cloning, setCloning] = useState<Tournament | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tournament | null>(null)

  const filtered = tournaments.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFrom && t.start_date && t.start_date < dateFrom) return false
    if (dateTo && t.start_date && t.start_date > dateTo) return false
    return true
  })

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
        'Delete blocked by row-level security. Check the tournaments policy.'
      )
      return
    }
    toast.success('Tournament deleted')
    onChanged()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Your Tournaments
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Select a tournament to manage it, or create a new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Tournament
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search tournaments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="whitespace-nowrap text-xs font-medium text-zinc-500 dark:text-zinc-400">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <label className="whitespace-nowrap text-xs font-medium text-zinc-500 dark:text-zinc-400">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tournament grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          {tournaments.length === 0 ? (
            <>
              <p className="mb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                No tournaments yet.
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Click &quot;New Tournament&quot; to create one.
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                No tournaments match your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setDateFrom('')
                  setDateTo('')
                }}
                className="text-xs font-medium text-mk-red hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const tone = STATUS_TONE[t.status] ?? STATUS_TONE.upcoming
            const isDeleting = deletingId === t.id
            return (
              <li
                key={t.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Clickable card body → enter tournament */}
                <button
                  type="button"
                  onClick={() => onEnter(t)}
                  className="group flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold leading-snug text-zinc-900 group-hover:text-mk-red dark:text-zinc-50 dark:group-hover:text-mk-red">
                      {t.name}
                    </h2>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {t.status}
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <svg
                      className="h-3 w-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatDateRange(t.start_date, t.end_date)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-mk-red opacity-0 transition-opacity group-hover:opacity-100">
                    Enter tournament →
                  </p>
                </button>

                {/* Action strip */}
                <div className="flex gap-0.5 border-t border-zinc-100 px-2 py-2 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(t)
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCloning(t)
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Clone
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDelete(t)
                    }}
                    disabled={isDeleting}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {isDeleting ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    )}
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
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
