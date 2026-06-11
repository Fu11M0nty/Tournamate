'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamLogo from './TeamLogo'
import { labelForLegacyDay } from '@/lib/competitionDates'
import { formatKickoffDate, formatKickoffTime } from '@/lib/time'
import type { AgeGroup, Day, Match, Team, Tournament } from '@/lib/types'
import type { ReactNode } from 'react'

type LandingTab = 'info' | 'teams' | 'standings' | 'schedule'
type ScheduleMode = 'upcoming' | 'played' | 'all'

interface TournamentLandingHubProps {
  tournament: Tournament
  groups: AgeGroup[]
  teams: Team[]
  matches: Match[]
  activeTab: LandingTab
}

const TABS: Array<{ id: LandingTab; label: string }> = [
  { id: 'info', label: 'Info' },
  { id: 'teams', label: 'Teams' },
  { id: 'standings', label: 'Standings' },
  { id: 'schedule', label: 'Schedule' },
]

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Date TBC'
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso))
  if (!end || end === start) return fmt(start)
  return `${fmt(start)} - ${fmt(end)}`
}

function formatLocation(tournament: Tournament) {
  return [tournament.venue_name, tournament.venue_city, tournament.venue_county, tournament.venue_postcode]
    .filter(Boolean)
    .join(', ')
}

function formatLabelForGroup(group: AgeGroup) {
  const phases = group.phases ?? []
  if (phases.length === 0) return 'Schedule'
  const types = new Set(phases.map((phase) => phase.phase_type))
  const hasKnockout = types.has('knockout')
  const hasGroup = types.has('group_stage') || types.has('round_robin')
  const hasLeague = types.has('league')
  const hasFriendly = types.has('friendly')

  if (hasGroup && hasKnockout) return 'Groups + Finals'
  if (hasLeague) return 'League'
  if (hasKnockout) return 'Knockout'
  if (hasGroup) return phases.some((phase) => (phase.pools?.length ?? 0) > 1) ? 'Pools' : 'Standings'
  if (hasFriendly) return phases.some((phase) => phase.standings_mode === 'visible') ? 'Swiss / Rounds' : 'Fixtures'
  return 'Format view'
}

function matchTimeValue(match: Match) {
  return new Date(match.kickoff_time).getTime()
}

function scheduleDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm outline-none transition focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
      >
        {children}
      </select>
    </label>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
      {children}
    </div>
  )
}

export default function TournamentLandingHub({
  tournament,
  groups,
  teams,
  matches,
  activeTab,
}: TournamentLandingHubProps) {
  const [teamSearch, setTeamSearch] = useState('')
  const [teamGroupId, setTeamGroupId] = useState('all')
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('upcoming')
  const [scheduleGroupId, setScheduleGroupId] = useState('all')
  const [scheduleTeamId, setScheduleTeamId] = useState('all')
  const [followedTeamIds, setFollowedTeamIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(`tournamate-following-${tournament.id}`)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    window.localStorage.setItem(
      `tournamate-following-${tournament.id}`,
      JSON.stringify(followedTeamIds)
    )
  }, [followedTeamIds, tournament.id])

  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups])
  const filteredTournamentMatches = useMemo(
    () => matches.filter((match) => groupIds.has(match.age_group_id)),
    [groupIds, matches]
  )

  const totalMatches = filteredTournamentMatches.length
  const playedMatches = filteredTournamentMatches.filter((match) => match.status === 'completed').length
  const upcomingMatches = filteredTournamentMatches.filter((match) => match.status === 'scheduled' && match.is_planned).length
  const location = formatLocation(tournament)
  const presentDays: Day[] = ['saturday', 'sunday'].filter((day) => groups.some((group) => group.day === day)) as Day[]

  const followedTeams = followedTeamIds
    .map((id) => teamsById.get(id))
    .filter((team): team is Team => Boolean(team))

  const visibleTeams = teams
    .filter((team) => teamGroupId === 'all' || team.age_group_id === teamGroupId)
    .filter((team) => team.name.toLowerCase().includes(teamSearch.trim().toLowerCase()))
    .sort((a, b) => {
      const aPinned = followedTeamIds.includes(a.id) ? 0 : 1
      const bPinned = followedTeamIds.includes(b.id) ? 0 : 1
      return aPinned - bPinned || a.name.localeCompare(b.name)
    })

  const visibleSchedule = filteredTournamentMatches
    .filter((match) => {
      if (scheduleMode === 'upcoming' && !(match.status === 'scheduled' && match.is_planned)) return false
      if (scheduleMode === 'played' && match.status !== 'completed') return false
      if (scheduleGroupId !== 'all' && match.age_group_id !== scheduleGroupId) return false
      if (
        scheduleTeamId !== 'all' &&
        match.home_team_id !== scheduleTeamId &&
        match.away_team_id !== scheduleTeamId
      ) return false
      return true
    })
    .sort((a, b) => {
      if (scheduleMode === 'played') return matchTimeValue(b) - matchTimeValue(a)
      if (scheduleMode === 'all' && a.status !== b.status) {
        if (a.status === 'scheduled') return -1
        if (b.status === 'scheduled') return 1
      }
      return matchTimeValue(a) - matchTimeValue(b)
    })

  const visibleScheduleByDate = useMemo(() => {
    const byDate = new Map<string, Match[]>()
    for (const match of visibleSchedule) {
      const key = scheduleDateKey(match.kickoff_time)
      const list = byDate.get(key) ?? []
      list.push(match)
      byDate.set(key, list)
    }
    return Array.from(byDate.entries()).sort(([a], [b]) =>
      scheduleMode === 'played' ? b.localeCompare(a) : a.localeCompare(b)
    )
  }, [scheduleMode, visibleSchedule])

  function toggleFollow(teamId: string) {
    setFollowedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl pb-16">
      <section className="relative overflow-hidden bg-tm-navy text-white">
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
          <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
            {formatDateRange(tournament.start_date, tournament.end_date)}
            {location ? ` - ${location}` : ''}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{groups.length}</span> divisions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{teams.length}</span> teams
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{playedMatches}</span> / {totalMatches} played
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/90 ring-1 ring-white/15">
              <span className="text-tm-orange">{upcomingMatches}</span> upcoming
            </span>
          </div>
        </div>
      </section>

      <nav aria-label="Tournament sections" className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6">
        <ul className="-mx-1 flex overflow-x-auto py-2">
          {TABS.map((tab) => (
            <li key={tab.id} className="shrink-0 px-1">
              <Link
                href={`/${tournament.slug}?tab=${tab.id}`}
                scroll={false}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={
                  activeTab === tab.id
                    ? 'inline-flex h-10 items-center rounded-full bg-tm-orange px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm'
                    : 'inline-flex h-10 items-center rounded-full px-4 text-xs font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                }
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {activeTab === 'info' && (
        <section className="grid gap-4 px-4 pt-8 sm:px-6 lg:grid-cols-[1.4fr_0.8fr]">
          <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-extrabold text-tm-navy dark:text-zinc-50">Tournament info</h2>
            {tournament.description ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {tournament.description}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Key organiser information will appear here when it has been added for this tournament.
              </p>
            )}
          </article>

          <aside className="space-y-4">
            <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-sm font-extrabold text-tm-navy dark:text-zinc-50">Details</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sport</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-200">{tournament.sport ?? 'Sport TBC'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">Date</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-200">
                    {formatDateRange(tournament.start_date, tournament.end_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">Venue</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-200">
                    {location || 'Venue TBC'}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-sm font-extrabold text-tm-navy dark:text-zinc-50">Venue information</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Directions, maps, organiser contacts, parking notes and venue documents can be shown here once those fields are added in the organiser console.
              </p>
            </article>
          </aside>
        </section>
      )}

      {activeTab === 'teams' && (
        <section className="space-y-5 px-4 pt-8 sm:px-6">
          {followedTeams.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                Following
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {followedTeams.map((team) => {
                  const group = groupsById.get(team.age_group_id)
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleFollow(team.id)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-tm-orange px-3 py-2 text-xs font-bold text-white shadow-sm"
                    >
                      <TeamLogo team={team} size="sm" />
                      {team.name}
                      {group ? ` - ${group.name}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[1fr_16rem]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Search teams
              </span>
              <input
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Team name"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 shadow-sm outline-none transition focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </label>
            <Select label="Division" value={teamGroupId} onChange={setTeamGroupId}>
              <option value="all">All divisions</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {labelForLegacyDay(tournament, group.day)} - {group.name}
                </option>
              ))}
            </Select>
          </div>

          {visibleTeams.length === 0 ? (
            <EmptyState>No teams match the current filters.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTeams.map((team) => {
                const group = groupsById.get(team.age_group_id)
                const followed = followedTeamIds.includes(team.id)
                return (
                  <article key={team.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start gap-3">
                      <TeamLogo team={team} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-extrabold text-tm-navy dark:text-zinc-50">{team.name}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {group ? `${labelForLegacyDay(tournament, group.day)} - ${group.name}` : 'Division TBC'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFollow(team.id)}
                        className={
                          followed
                            ? 'rounded-full bg-tm-orange px-3 py-1.5 text-xs font-bold text-white'
                            : 'rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:border-tm-orange hover:text-tm-orange dark:border-zinc-700 dark:text-zinc-300'
                        }
                      >
                        {followed ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'standings' && (
        <section className="space-y-6 px-4 pt-8 sm:px-6">
          {presentDays.map((day) => {
            const groupsForDay = groups.filter((group) => group.day === day)
            if (groupsForDay.length === 0) return null
            return (
              <div key={day}>
                <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.25em] text-tm-orange">
                  {labelForLegacyDay(tournament, day)}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupsForDay.map((group) => {
                    const groupMatches = filteredTournamentMatches.filter((match) => match.age_group_id === group.id)
                    const completed = groupMatches.filter((match) => match.status === 'completed').length
                    return (
                      <Link
                        key={group.id}
                        href={`/${tournament.slug}/${group.day}/${group.slug}`}
                        className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-tm-orange hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-extrabold text-tm-navy dark:text-zinc-50">{group.name}</h3>
                            <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              {formatLabelForGroup(group)}
                            </p>
                          </div>
                          <span className="rounded-full bg-tm-orange/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-tm-orange">
                            Open
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                          {completed}/{groupMatches.length} fixture{groupMatches.length === 1 ? '' : 's'} played
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {activeTab === 'schedule' && (
        <section className="space-y-5 px-4 pt-8 sm:px-6">
          <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-3">
            <Select label="Show" value={scheduleMode} onChange={(value) => setScheduleMode(value as ScheduleMode)}>
              <option value="upcoming">Upcoming first</option>
              <option value="played">Played results</option>
              <option value="all">All fixtures</option>
            </Select>
            <Select label="Division" value={scheduleGroupId} onChange={setScheduleGroupId}>
              <option value="all">All divisions</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {labelForLegacyDay(tournament, group.day)} - {group.name}
                </option>
              ))}
            </Select>
            <Select label="Team" value={scheduleTeamId} onChange={setScheduleTeamId}>
              <option value="all">All teams</option>
              {teams.map((team) => {
                const group = groupsById.get(team.age_group_id)
                return (
                  <option key={team.id} value={team.id}>
                    {team.name}{group ? ` - ${group.name}` : ''}
                  </option>
                )
              })}
            </Select>
          </div>

          {visibleSchedule.length === 0 ? (
            <EmptyState>No fixtures match the current filters.</EmptyState>
          ) : (
            <div className="space-y-5">
              {visibleScheduleByDate.map(([dateKey, dateMatches]) => (
                <section key={dateKey} className="space-y-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-[0.25em] text-tm-orange">
                    {formatKickoffDate(`${dateKey}T12:00:00.000Z`, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                  {dateMatches.map((match) => {
                    const group = groupsById.get(match.age_group_id)
                    const home = match.home_team_id ? teamsById.get(match.home_team_id) : null
                    const away = match.away_team_id ? teamsById.get(match.away_team_id) : null
                    const score =
                      match.status === 'completed' && match.home_score !== null && match.away_score !== null
                        ? `${match.home_score} - ${match.away_score}`
                        : 'vs'
                    return (
                      <article key={match.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          <span>{formatKickoffTime(match.kickoff_time)}</span>
                          <span>
                            {group ? `${group.name}` : 'Division TBC'}{match.court ? ` - ${match.court}` : ''}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {home ? <TeamLogo team={home} size="sm" /> : null}
                            <span className="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">
                              {home?.name ?? 'TBD'}
                            </span>
                          </div>
                          <span className={match.status === 'completed' ? 'rounded-md bg-tm-navy px-2 py-1 text-sm font-black tabular-nums text-white' : 'text-xs font-black uppercase tracking-wider text-zinc-400'}>
                            {score}
                          </span>
                          <div className="flex min-w-0 items-center justify-end gap-2">
                            <span className="truncate text-right text-sm font-bold text-zinc-800 dark:text-zinc-100">
                              {away?.name ?? 'TBD'}
                            </span>
                            {away ? <TeamLogo team={away} size="sm" /> : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
