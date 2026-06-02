import { calculateStandings } from '@/lib/standings'
import {
  effectiveScoringSystemForPhase,
  matchesForPhase,
  phaseForDivision,
  sortedPhasesForDivision,
} from '@/lib/scoring'
import { labelForLegacyDay } from '@/lib/competitionDates'
import { formatKickoffTime } from '@/lib/time'
import Link from 'next/link'
import PhaseTabs from './PhaseTabs'
import StandingsTable from './StandingsTable'
import ResultCard from './ResultCard'
import FixtureCard from './FixtureCard'
import TeamFilter from './TeamFilter'
import PrintButton from './PrintButton'
import PublicBracketView from './PublicBracketView'
import type { Division, Day, ElementSlot, Match, Pool, ScoringSystem, StandingRow, Team, Tournament } from '@/lib/types'
import { matchStageRoundLabel } from '@/lib/matchLabel'

const FALLBACK_SCORING: ScoringSystem = {
  id: 'default', name: 'Fallback System', sport_type: 'Netball',
  win_pts: 3, draw_pts: 1, loss_pts: 0, ot_win_pts: null, so_win_pts: null,
  bonus_loss_pts: 0, bonus_loss_threshold_type: 'percentage', bonus_loss_threshold_value: 50, bonus_offense_pts: 0, bonus_offense_threshold: null,
  forfeit_win_pts: 3, forfeit_loss_pts: 0, forfeit_win_score_for: 10, forfeit_win_score_against: 0,
  tie_breaker_config: ['head_to_head', 'goal_difference', 'goals_for'], created_at: new Date().toISOString()
}

interface TournamentViewProps {
  tournament: Tournament
  day: Day
  currentGroup: Division
  saturdayGroups: Division[]
  sundayGroups: Division[]
  teams: Team[]
  matches: Match[]
  slots?: ElementSlot[]
  teamFilterId: string | null
  phaseSlug: string | null
}

type PoolWithStandings = {
  pool: Pool
  teams: Team[]
  matches: Match[]
  standings: StandingRow[]
  allComplete: boolean
}

const PUBLIC_TABS = [
  { id: 'info', label: 'Info' },
  { id: 'teams', label: 'Teams' },
  { id: 'standings', label: 'Standings' },
  { id: 'schedule', label: 'Schedule' },
] as const

export default function TournamentView({
  tournament,
  day,
  currentGroup,
  teams,
  matches,
  slots = [],
  teamFilterId,
  phaseSlug,
}: TournamentViewProps) {
  const phases = sortedPhasesForDivision(currentGroup)
  const currentPhase = phaseForDivision(currentGroup, phaseSlug)
  const currentPhaseSlug = currentPhase?.slug ?? null
  const isKnockoutPhase = currentPhase?.phase_type === 'knockout'
  const phasesWithMatches = phases.filter((phase) => matches.some((match) => match.phase_id === phase.id))
  const navigablePhases = phasesWithMatches.length > 0 ? phasesWithMatches : phases
  const isAllKnockoutFormat =
    navigablePhases.length > 0 &&
    navigablePhases.every((phase) => phase.phase_type === 'knockout')
  const phaseHasStandings = currentPhase ? currentPhase.standings_mode === 'visible' && !isKnockoutPhase : true
  const supportsInlineTeamFilter = phaseHasStandings
  const supportsStandaloneTeamFilter = currentPhase?.standings_mode === 'none' && !isKnockoutPhase
  const sys = effectiveScoringSystemForPhase(currentGroup, currentPhase) || FALLBACK_SCORING
  const phaseMatches = matchesForPhase(currentPhase, matches)
  const standingsMatches =
    currentPhase?.standings_mode === 'none' ? [] : phaseMatches
  const standings = calculateStandings(teams, standingsMatches, sys)

  const allComplete =
    phaseMatches.length > 0 &&
    phaseMatches.every((m) => m.status === 'completed')

  const teamById = new Map<string, Team>()
  for (const t of teams) teamById.set(t.id, t)
  const slotById = new Map<string, ElementSlot>()
  for (const slot of slots) slotById.set(slot.id, slot)

  const poolById = new Map<string, Pool>()
  const phaseById = new Map<string, { name: string }>()
  for (const phase of phases) {
    phaseById.set(phase.id, phase)
    for (const pool of phase.pools ?? []) poolById.set(pool.id, pool)
  }

  function entrantLabel(team: Team | null, slotId: string | null) {
    if (team) return team.name
    const slot = slotId ? slotById.get(slotId) : null
    if (slot?.label) return slot.label
    if (slot?.source_outcome === 'winner') return 'Winner of previous fixture'
    if (slot?.source_outcome === 'loser') return 'Loser of previous fixture'
    if (slot?.source_outcome === 'rank' && slot.source_rank) {
      return `${slot.source_rank} place qualifier`
    }
    return 'TBD'
  }

  const activeTeamId =
    teamFilterId && teamById.has(teamFilterId) && (supportsInlineTeamFilter || supportsStandaloneTeamFilter)
      ? teamFilterId
      : null

  const matchesForLists = activeTeamId
    ? phaseMatches.filter(
        (m) =>
          m.home_team_id === activeTeamId || m.away_team_id === activeTeamId
      )
    : phaseMatches

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

  // Hero quick-glance data (unfiltered by team)
  const latestResult = [...phaseMatches]
    .filter((m) => m.status === 'completed' && m.home_score !== null && m.away_score !== null)
    .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime())[0] ?? null

  const nextFixture = [...phaseMatches]
    .filter((m) => m.status === 'scheduled' && m.is_planned)
    .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())[0] ?? null

  const completedCount = phaseMatches.filter((m) => m.status === 'completed').length
  const progressPct = phaseMatches.length > 0
    ? Math.round((completedCount / phaseMatches.length) * 100)
    : 0

  const updatedAt = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })

  const dayLabel = labelForLegacyDay(tournament, day)
  const baseDivisionPath = `/${tournament.slug}/${day}/${currentGroup.slug}`

  function hrefForTeam(teamId: string | null) {
    const params = new URLSearchParams()
    if (currentPhaseSlug) params.set('phase', currentPhaseSlug)
    if (teamId) params.set('team', teamId)
    const query = params.toString()
    return query ? `${baseDivisionPath}?${query}` : baseDivisionPath
  }

  const currentPools =
    currentPhase?.pools
      ?.filter((pool) => !pool.is_default || (currentPhase.pools?.length ?? 0) === 1)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)) ?? []
  const showPoolStandings = currentPools.length > 1
  const poolStandings: PoolWithStandings[] = showPoolStandings
    ? currentPools.map((pool) => {
        const poolMatches = phaseMatches.filter((match) => match.pool_id === pool.id)
        const poolTeamIds = new Set((pool.pool_teams ?? []).map((row) => row.team_id))
        if (poolTeamIds.size === 0) {
          for (const match of poolMatches) {
            if (match.home_team_id) poolTeamIds.add(match.home_team_id)
            if (match.away_team_id) poolTeamIds.add(match.away_team_id)
          }
        }
        const poolTeams = teams
          .filter((team) => poolTeamIds.has(team.id))
          .sort((a, b) => a.name.localeCompare(b.name))
        const poolRows = calculateStandings(poolTeams, poolMatches, sys)
        const poolComplete =
          poolMatches.length > 0 &&
          poolMatches.every((match) => match.status === 'completed')

        return {
          pool,
          teams: poolTeams,
          matches: poolMatches,
          standings: poolRows,
          allComplete: poolComplete,
        }
      })
    : []

  return (
    <main
      data-pdf-root
      className={`mx-auto w-full pb-16 ${isKnockoutPhase ? 'max-w-[1800px]' : 'max-w-5xl'}`}
    >
      {/* Hero */}
      <section
        data-pdf-block
        className="relative overflow-hidden bg-gradient-to-br from-tm-navy via-tm-navy-soft to-tm-navy text-white"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-tm-orange/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-[-80px] h-64 w-64 rounded-full bg-tm-sky/15 blur-3xl" />

        <div className="relative px-4 pt-8 pb-10 sm:px-8 sm:pt-12 sm:pb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-tm-orange ring-1 ring-tm-orange/40 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-tm-orange" />
            {tournament.sport ?? 'Netball'} Tournament
          </span>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {currentGroup.name}
            <span className="ml-2 inline-block rounded-md bg-tm-orange px-2 py-0.5 align-middle text-sm font-bold uppercase tracking-wider text-white sm:text-base">
              {dayLabel}
            </span>
          </h1>

          <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
            {tournament.name}. Live standings, results and fixtures — refresh any time for the latest from courtside.
          </p>

          {/* Stats chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{teams.length}</span> teams
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{completedCount}</span> / {phaseMatches.length} played
            </span>
            {currentPhase && phases.length > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
                {currentPhase.name}
              </span>
            )}
            {allComplete && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tm-orange/20 px-3 py-1.5 text-tm-orange ring-1 ring-tm-orange/30">
                🏆 Group complete
              </span>
            )}
            {allComplete && (
              <span data-print-hide className="ml-auto">
                <PrintButton
                  tournamentSlug={tournament.slug}
                  divisionName={currentGroup.name}
                  day={day}
                />
              </span>
            )}
          </div>

          {/* Progress bar */}
          {phaseMatches.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/45">
                <span>{progressPct}% complete</span>
                <span>Updated {updatedAt}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-tm-orange transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Quick-glance: next fixture + latest result */}
          {(nextFixture || latestResult) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextFixture && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10">
                  <span className="text-tm-orange">▶</span>
                  Next: {formatKickoffTime(nextFixture.kickoff_time)}
                  {nextFixture.court && ` · ${nextFixture.court}`}
                </span>
              )}
              {latestResult && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10">
                  <span className="text-emerald-400">●</span>
                  {teamById.get(latestResult.home_team_id ?? '')?.name?.split(' ').slice(-1)[0] ?? '?'}
                  {' '}{latestResult.home_score}–{latestResult.away_score}{' '}
                  {teamById.get(latestResult.away_team_id ?? '')?.name?.split(' ').slice(-1)[0] ?? '?'}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Tournament sections */}
      <div data-print-hide className="bg-white shadow-sm dark:bg-zinc-950">
        <nav
          aria-label="Tournament sections"
          className="border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6"
        >
          <ul className="-mx-1 flex overflow-x-auto py-2">
            {PUBLIC_TABS.map((tab) => {
              const active = tab.id === 'standings'
              return (
                <li key={tab.id} className="shrink-0 px-1">
                  <Link
                    href={`/${tournament.slug}?tab=${tab.id}`}
                    scroll={false}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'inline-flex h-10 items-center rounded-full bg-tm-orange px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm'
                        : 'inline-flex h-10 items-center rounded-full px-4 text-xs font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                    }
                  >
                    {tab.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        {!isAllKnockoutFormat && (
          <PhaseTabs
            tournamentSlug={tournament.slug}
            day={day}
            divisionSlug={currentGroup.slug}
            phases={navigablePhases}
            currentSlug={currentPhaseSlug}
            teamFilterId={activeTeamId}
          />
        )}
      </div>

      {/* Standings */}
      {phaseHasStandings && (
        <section data-pdf-block aria-labelledby="standings-heading" className="px-4 pt-6 pb-8 sm:px-6">
          <h3
            id="standings-heading"
            className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
          >
            Standings
          </h3>
          {showPoolStandings ? (
            <div className="space-y-6">
              {poolStandings.map(({ pool, teams: poolTeams, matches: poolMatches, standings: poolRows, allComplete: poolComplete }, index) => {
                const completedPoolMatches = poolMatches.filter((match) => match.status === 'completed').length
                const unassignedPoolTeams = poolTeams.length === 0

                return (
                  <div key={pool.id} className="space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h4 className="text-base font-extrabold text-tm-navy dark:text-zinc-50">
                          {pool.name}
                        </h4>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {poolTeams.length} team{poolTeams.length === 1 ? '' : 's'} · {completedPoolMatches}/{poolMatches.length} played
                        </p>
                      </div>
                      {poolComplete && (
                        <span className="rounded-full bg-tm-orange/10 px-3 py-1 text-xs font-bold text-tm-orange">
                          Complete
                        </span>
                      )}
                    </div>
                    {unassignedPoolTeams ? (
                      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                        No teams assigned to this pool yet.
                      </p>
                    ) : (
                      <StandingsTable
                        standings={poolRows}
                        allComplete={poolComplete}
                        scoringSystem={sys}
                        showRules={index === poolStandings.length - 1}
                        currentTeamId={activeTeamId}
                        hrefForTeam={supportsInlineTeamFilter ? hrefForTeam : undefined}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <StandingsTable
              standings={standings}
              allComplete={allComplete}
              scoringSystem={sys}
              currentTeamId={activeTeamId}
              hrefForTeam={supportsInlineTeamFilter ? hrefForTeam : undefined}
            />
          )}
        </section>
      )}

      {isKnockoutPhase && (
        <section data-pdf-block aria-labelledby="bracket-heading" className="px-4 pt-6 pb-8 sm:px-6">
          <h3 id="bracket-heading" className="sr-only">
            Bracket
          </h3>
          <PublicBracketView
            phases={phases}
            currentPhaseId={currentPhase?.id ?? null}
            matches={matches.filter((match) => {
              if (!match.phase_id) return phaseMatches.includes(match)
              return phases.some((phase) => phase.phase_type === 'knockout' && phase.id === match.phase_id)
            })}
            teams={teams}
            slots={slots}
          />
        </section>
      )}

      {/* Team filter */}
      {supportsStandaloneTeamFilter && (
        <section
          aria-labelledby="filter-heading"
          data-print-hide
          className="px-4 pb-6 sm:px-6"
        >
          <h3
            id="filter-heading"
            className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
          >
            Filter by team
          </h3>
          <TeamFilter
            pathname={baseDivisionPath}
            teams={teams}
            currentTeamId={activeTeamId}
            currentPhaseSlug={currentPhaseSlug}
          />
        </section>
      )}

      {/* Results */}
      <section aria-labelledby="results-heading" className="px-4 pb-8 sm:px-6">
        <h3
          id="results-heading"
          data-pdf-block
          className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
        >
          Results
        </h3>
        {results.length === 0 ? (
          <p data-pdf-block className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            {activeTeamId ? 'No results for this team yet' : 'No results yet'}
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((match) => {
              const home = match.home_team_id ? teamById.get(match.home_team_id) ?? null : null
              const away = match.away_team_id ? teamById.get(match.away_team_id) ?? null : null
              if (!home) return null
              return (
                <li key={match.id} data-pdf-block>
                  <ResultCard
                    match={match}
                    homeTeam={home}
                    awayTeam={away}
                    scoringSystem={sys}
                    stageLabel={matchStageRoundLabel(match, poolById, undefined, phaseById) ?? undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Fixtures */}
      <section aria-labelledby="fixtures-heading" className="px-4 pb-10 sm:px-6">
        <h3
          id="fixtures-heading"
          data-pdf-block
          className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
        >
          Upcoming fixtures
        </h3>
        {fixtures.length === 0 ? (
          <p data-pdf-block className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            {activeTeamId ? 'No upcoming fixtures for this team' : 'All matches complete'}
          </p>
        ) : (
          <ul className="space-y-2">
            {fixtures.map((match) => {
              const home = match.home_team_id ? teamById.get(match.home_team_id) ?? null : null
              const away = match.away_team_id ? teamById.get(match.away_team_id) ?? null : null
              return (
                <li key={match.id} data-pdf-block>
                  <FixtureCard
                    match={match}
                    homeTeam={home}
                    awayTeam={away}
                    homeLabel={entrantLabel(home, match.home_slot_id)}
                    awayLabel={entrantLabel(away, match.away_slot_id)}
                    stageLabel={matchStageRoundLabel(match, poolById, undefined, phaseById) ?? undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
