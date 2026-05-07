import { calculateStandings } from '@/lib/standings'
import DayTabs from './DayTabs'
import AgeGroupTabs from './AgeGroupTabs'
import StandingsTable from './StandingsTable'
import ResultCard from './ResultCard'
import FixtureCard from './FixtureCard'
import TeamFilter from './TeamFilter'
import PrintButton from './PrintButton'
import type { AgeGroup, Day, Match, Team, Tournament } from '@/lib/types'

interface TournamentViewProps {
  tournament: Tournament
  day: Day
  currentGroup: AgeGroup
  saturdayGroups: AgeGroup[]
  sundayGroups: AgeGroup[]
  teams: Team[]
  matches: Match[]
  teamFilterId: string | null
}

export default function TournamentView({
  tournament,
  day,
  currentGroup,
  saturdayGroups,
  sundayGroups,
  teams,
  matches,
  teamFilterId,
}: TournamentViewProps) {
  const standings = calculateStandings(teams, matches)

  const allComplete =
    matches.length > 0 && matches.every((m) => m.status === 'completed')

  const teamById = new Map<string, Team>()
  for (const t of teams) teamById.set(t.id, t)

  const activeTeamId =
    teamFilterId && teamById.has(teamFilterId) ? teamFilterId : null

  const matchesForLists = activeTeamId
    ? matches.filter(
        (m) =>
          m.home_team_id === activeTeamId || m.away_team_id === activeTeamId
      )
    : matches

  const results = matchesForLists
    .filter((m) => m.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.kickoff_time).getTime() -
        new Date(a.kickoff_time).getTime()
    )

  const fixtures = matchesForLists
    .filter((m) => m.status === 'scheduled' && m.is_planned)
    .sort(
      (a, b) =>
        new Date(a.kickoff_time).getTime() -
        new Date(b.kickoff_time).getTime()
    )

  const ageGroupsForDay = day === 'saturday' ? saturdayGroups : sundayGroups
  const completedCount = matches.filter((m) => m.status === 'completed').length

  return (
    <main data-pdf-root className="mx-auto w-full max-w-5xl pb-16">
      {/* Hero */}
      <section data-pdf-block className="relative overflow-hidden bg-gradient-to-br from-tm-navy via-tm-navy-soft to-tm-navy text-white">
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
            {tournament.sport ?? 'Netball'} Tournament
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {currentGroup.name}
            <span className="ml-2 inline-block rounded-md bg-tm-orange px-2 py-0.5 align-middle text-sm font-bold uppercase tracking-wider text-white sm:text-base">
              {day === 'saturday' ? 'Sat' : 'Sun'}
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
            {tournament.name}. Live standings, results and fixtures — refresh any time
            for the latest from courtside.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{teams.length}</span> teams
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{completedCount}</span> /{' '}
              {matches.length} played
            </span>
            {allComplete && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tm-orange/20 px-3 py-1.5 text-tm-orange ring-1 ring-tm-orange/30">
                🏆 Group complete
              </span>
            )}
            {allComplete && (
              <span data-print-hide className="ml-auto">
                <PrintButton
                  tournamentSlug={tournament.slug}
                  ageGroupName={currentGroup.name}
                  day={day}
                />
              </span>
            )}
          </div>
        </div>
      </section>

      <div data-print-hide className="bg-white shadow-sm dark:bg-zinc-950">
        <DayTabs
          tournamentSlug={tournament.slug}
          days={[saturdayGroups, sundayGroups]}
          currentDay={day}
        />
        <AgeGroupTabs
          tournamentSlug={tournament.slug}
          ageGroups={ageGroupsForDay}
          currentSlug={currentGroup.slug}
          day={day}
        />
      </div>

      <header className="px-4 pt-6 pb-3 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-tm-navy dark:text-zinc-50">
          {currentGroup.name}
        </h2>
      </header>

      <section data-pdf-block aria-labelledby="standings-heading" className="px-4 pb-8 sm:px-6">
        <h3
          id="standings-heading"
          className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-tm-orange"
        >
          <span className="h-px flex-1 bg-tm-orange/30" />
          Standings
          <span className="h-px flex-1 bg-tm-orange/30" />
        </h3>
        <StandingsTable standings={standings} allComplete={allComplete} />
      </section>

      <section
        aria-labelledby="filter-heading"
        data-print-hide
        className="px-4 pb-6 sm:px-6"
      >
        <h3
          id="filter-heading"
          className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-tm-orange"
        >
          <span className="h-px flex-1 bg-tm-orange/30" />
          Filter by team
          <span className="h-px flex-1 bg-tm-orange/30" />
        </h3>
        <TeamFilter
          pathname={`/${tournament.slug}/${day}/${currentGroup.slug}`}
          teams={teams}
          currentTeamId={activeTeamId}
        />
      </section>

      <section aria-labelledby="results-heading" className="px-4 pb-8 sm:px-6">
        <h3
          id="results-heading"
          data-pdf-block
          className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-tm-orange"
        >
          <span className="h-px flex-1 bg-tm-orange/30" />
          Results
          <span className="h-px flex-1 bg-tm-orange/30" />
        </h3>
        {results.length === 0 ? (
          <p data-pdf-block className="rounded-2xl border border-dashed border-tm-navy/15 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            {activeTeamId ? 'No results for this team yet' : 'No results yet'}
          </p>
        ) : (
          <ul className="space-y-3">
            {results.map((match) => {
              const home = teamById.get(match.home_team_id)
              const away = teamById.get(match.away_team_id)
              if (!home || !away) return null
              return (
                <li key={match.id} data-pdf-block>
                  <ResultCard match={match} homeTeam={home} awayTeam={away} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="fixtures-heading" className="px-4 pb-10 sm:px-6">
        <h3
          id="fixtures-heading"
          data-pdf-block
          className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-tm-orange"
        >
          <span className="h-px flex-1 bg-tm-orange/30" />
          Upcoming Fixtures
          <span className="h-px flex-1 bg-tm-orange/30" />
        </h3>
        {fixtures.length === 0 ? (
          <p data-pdf-block className="rounded-2xl border border-dashed border-tm-navy/15 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            {activeTeamId
              ? 'No upcoming fixtures for this team'
              : 'All matches complete'}
          </p>
        ) : (
          <ul className="space-y-3">
            {fixtures.map((match) => {
              const home = teamById.get(match.home_team_id)
              const away = teamById.get(match.away_team_id)
              if (!home || !away) return null
              return (
                <li key={match.id} data-pdf-block>
                  <FixtureCard match={match} homeTeam={home} awayTeam={away} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
