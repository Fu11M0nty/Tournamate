'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { SPORTS } from '@/lib/types'

export default function ExploreFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== 'all') {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    startTransition(() => router.replace(`/explore?${next.toString()}`))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = (fd.get('q') as string) ?? ''
    updateParam('q', q.trim())
  }

  const activeCount = ['q', 'sport', 'status'].filter((k) => params.has(k)).length

  return (
    <div className={`transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
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
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={params.get('q') ?? ''}
            placeholder="Search by name or location…"
            className="w-full rounded-xl border border-tm-navy/15 bg-white py-2.5 pl-9 pr-4 text-sm text-tm-navy placeholder-zinc-400 shadow-sm outline-none ring-0 transition-all focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
          />
        </div>

        {/* Sport */}
        <select
          value={params.get('sport') ?? 'all'}
          onChange={(e) => updateParam('sport', e.target.value)}
          className="rounded-xl border border-tm-navy/15 bg-white px-3 py-2.5 text-sm text-tm-navy shadow-sm outline-none focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
        >
          <option value="all">All sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={params.get('status') ?? 'all'}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-xl border border-tm-navy/15 bg-white px-3 py-2.5 text-sm text-tm-navy shadow-sm outline-none focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
        >
          <option value="all">All statuses</option>
          <option value="live">Live now</option>
          <option value="upcoming">Upcoming</option>
          <option value="complete">Completed</option>
        </select>

        {/* Search button */}
        <button
          type="submit"
          className="rounded-xl bg-tm-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-tm-orange-dark"
        >
          Search
        </button>

        {/* Clear */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace('/explore'))}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-500 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-700"
          >
            Clear ({activeCount})
          </button>
        )}
      </form>
    </div>
  )
}
