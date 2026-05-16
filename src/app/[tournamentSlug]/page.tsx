import { createPublicSupabaseClient } from '@/lib/supabase'
import { calculateStandings } from '@/lib/standings'
import {
  effectiveScoringSystemForAgeGroup,
  matchesForPhaseScope,
} from '@/lib/scoring'
import { labelForLegacyDay } from '@/lib/competitionDates'
import MiniStandings from '@/components/MiniStandings'
import NotFoundMessage from '@/components/NotFoundMessage'
import type { AgeGroup, Day, Match, Team, Tournament } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ tournamentSlug: string }>
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso))
  if (!end || end === start) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

export default async function TournamentLandingPage({ params }: Props) {
  const { tournamentSlug } = await params
  const supabase = await createPublicSupabaseClient()

  const { data: tournamentData } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', tournamentSlug)
    .maybeSingle()

  const tournament = tournamentData as Tournament | null
  if (!tournament) {
    return (
      <NotFoundMessage
        title="Tournament not found"
        description={`There is no tournament with slug "${tournamentSlug}".`}
      />
    )
  }

  const [groupsRes, teamsRes, matchesRes] = await Promise.all([
    supabase
      .from('age_groups')
      .select('*, scoring_system:scoring_systems(*), phases(*, scoring_system:scoring_systems(*))')
      .eq('tournament_id', tournament.id)
      .order('display_order', { ascending: true }),
    supabase.from('teams').select('*').is('deleted_at', null),
    supabase.from('matches').select('*').is('deleted_at', null),
  ])

  const groups: AgeGroup[] = groupsRes.data ?? []
  const groupIds = new Set(groups.map((g) => g.id))
  const teams: Team[] = (teamsRes.data ?? []).filter((t: Team) =>
    groupIds.has(t.age_group_id)
  )
  const matches: Match[] = (matchesRes.data ?? []).filter((m: Match) =>
    groupIds.has(m.age_group_id)
  )

  const teamsByGroup = new Map<string, Team[]>()
  for (const t of teams) {
    const arr = teamsByGroup.get(t.age_group_id) ?? []
    arr.push(t)
    teamsByGroup.set(t.age_group_id, arr)
  }
  const matchesByGroup = new Map<string, Match[]>()
  for (const m of matches) {
    const arr = matchesByGroup.get(m.age_group_id) ?? []
    arr.push(m)
    matchesByGroup.set(m.age_group_id, arr)
  }

  const totalGroups = groups.length
  const totalTeams = teams.length
  const totalMatches = matches.length
  const playedMatches = matches.filter((m) => m.status === 'completed').length

  const days: Day[] = ['saturday', 'sunday']
  const presentDays = days.filter((d) =>
    groups.some((g) => g.day === d)
  )

  return (
    <main className="mx-auto w-full max-w-6xl pb-16">
      <section className="relative overflow-hidden bg-gradient-to-br from-tm-navy via-tm-navy-soft to-tm-navy text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-tm-orange/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-[-80px] h-64 w-64 rounded-full bg-tm-sky/15 blur-3xl"
        />
        <div className="relative px-4 pt-8 pb-10 sm:px-8 sm:pt-12 sm:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-tm-orange ring-1 ring-tm-orange/40 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-tm-orange" />
            {tournament.status === 'live'
              ? 'Live tournament'
              : tournament.status === 'upcoming'
                ? 'Upcoming'
                : 'Tournament'}
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {tournament.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
            {formatDateRange(tournament.start_date, tournament.end_date)}
            {formatDateRange(tournament.start_date, tournament.end_date) &&
              ' · '}
            Live standings across every division. Tap any group to open its
            full table, results and fixtures.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{totalGroups}</span> groups
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{totalTeams}</span> teams
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{playedMatches}</span> /{' '}
              {totalMatches} played
            </span>
          </div>
          {presentDays.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {presentDays.map((d) => (
                <a
                  key={d}
                  href={`#${d}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20"
                >
                  {d === 'saturday' ? 'Saturday' : 'Sunday'}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {presentDays.map((d) => {
        const groupsForDay = groups.filter((g) => g.day === d)
        if (groupsForDay.length === 0) return null
        return (
          <section
            key={d}
            id={d}
            aria-labelledby={`${d}-heading`}
            className="px-4 pt-8 sm:px-6"
          >
            <header className="mb-4 flex items-center gap-3">
              <h2
                id={`${d}-heading`}
                className="text-xs font-extrabold uppercase tracking-[0.25em] text-tm-orange"
              >
                {labelForLegacyDay(tournament, d)}
              </h2>
              <span className="h-px flex-1 bg-tm-orange/30" />
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupsForDay.map((g) => {
                const groupTeams = teamsByGroup.get(g.id) ?? []
                const groupMatches = matchesByGroup.get(g.id) ?? []
                const standingsMatches = matchesForPhaseScope(g, groupMatches)
                const sys = effectiveScoringSystemForAgeGroup(g)
                const standings = calculateStandings(groupTeams, standingsMatches, sys)
                return (
                  <MiniStandings
                    key={g.id}
                    tournamentSlug={tournament.slug}
                    group={g}
                    standings={standings}
                    matches={standingsMatches}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}

