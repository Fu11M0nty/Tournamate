import { Suspense } from 'react'
import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentCard from '@/components/TournamentCard'
import ExploreFilters from '@/components/ExploreFilters'
import type { Tournament } from '@/lib/types'

interface Props {
  searchParams: Promise<{
    q?: string
    sport?: string
    status?: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function ExplorePage({ searchParams }: Props) {
  const { q, sport, status } = await searchParams

  const supabase = createPublicSupabaseClient()
  let query = supabase.from('tournaments').select('*').order('start_date', { ascending: false })

  // Status can be filtered at DB level (column always exists)
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data } = await query
  let tournaments = (data ?? []) as Tournament[]

  // Text + sport filters done in JS so they're safe before migration runs
  if (q) {
    const term = q.toLowerCase()
    tournaments = tournaments.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        (t.venue_city ?? '').toLowerCase().includes(term) ||
        (t.venue_county ?? '').toLowerCase().includes(term)
    )
  }
  if (sport && sport !== 'all') {
    tournaments = tournaments.filter(
      (t) => (t.sport ?? 'Netball') === sport
    )
  }

  const liveCount = tournaments.filter((t) => t.status === 'live').length
  const hasFilters = !!(q || (sport && sport !== 'all') || (status && status !== 'all'))

  return (
    <main className="mx-auto w-full max-w-6xl pb-20">
      {/* Header */}
      <section className="bg-gradient-to-br from-tm-navy via-tm-navy-soft to-tm-navy px-4 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-tm-orange ring-1 ring-tm-orange/40">
            <span className="h-1.5 w-1.5 rounded-full bg-tm-orange" />
            {liveCount > 0 ? `${liveCount} live now` : 'Tournament finder'}
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Explore Tournaments
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60 sm:text-base">
            Search and filter across all tournaments. Find live results, upcoming fixtures and final standings.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-[65px] z-20 border-b border-tm-navy/10 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <Suspense>
          <ExploreFilters />
        </Suspense>
      </div>

      {/* Results */}
      <div className="px-4 pt-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            {tournaments.length === 0
              ? 'No tournaments found'
              : `${tournaments.length} tournament${tournaments.length === 1 ? '' : 's'}`}
            {hasFilters && <span className="text-zinc-400"> · filtered</span>}
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-tm-navy/15 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-zinc-600">No tournaments match your search.</p>
            <p className="mt-1 text-xs text-zinc-400">Try adjusting your filters or clearing them entirely.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
