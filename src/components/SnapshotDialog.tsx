'use client'

import { useState } from 'react'
import type { Day } from '@/lib/types'

interface SnapshotDialogProps {
  ageGroupName: string
  day: Day
  matchCount: number
  loading: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export default function SnapshotDialog({
  ageGroupName,
  day,
  matchCount,
  loading,
  onConfirm,
  onCancel,
}: SnapshotDialogProps) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
            <svg
              className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Take a snapshot
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              You are about to snapshot{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>{' '}
              for{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {ageGroupName}
              </span>{' '}
              ({day}). This captures scores exactly as they stand right now.
            </p>
          </div>
        </div>

        {/* Reason input */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Reason for snapshot{' '}
            <span className="font-bold text-red-500">*</span>
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. End of morning session, half-time break, disputed result, final scores…"
            disabled={loading}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            A reason is required. This is stored with the snapshot for audit purposes.
          </p>
        </label>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed || loading}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-700 dark:hover:bg-indigo-600"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                Take snapshot
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
