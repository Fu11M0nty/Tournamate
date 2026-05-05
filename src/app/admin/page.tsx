'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import AdminMatchList from '@/components/AdminMatchList'
import AdminTeamList from '@/components/AdminTeamList'
import AdminFixtureMatrix from '@/components/AdminFixtureMatrix'
import AdminTournamentList from '@/components/AdminTournamentList'
import AdminImport from '@/components/AdminImport'
import AdminScheduleView from '@/components/AdminScheduleView'
import AdminAgeGroupList from '@/components/AdminAgeGroupList'
import QRScannerModal from '@/components/QRScannerModal'
import { createClient } from '@/lib/supabase'
import type { AgeGroup, Day, Match, Team, Tournament } from '@/lib/types'

const ACTIVE_TOURNAMENT_KEY = 'mk-admin-active-tournament'

type AdminView = 'matches' | 'matrix' | 'teams'

const VIEW_LABELS: Record<AdminView, string> = {
  matches: 'Matches',
  matrix: 'Matrix',
  teams: 'Teams',
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [day, setDay] = useState<Day>('saturday')
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [dayMatches, setDayMatches] = useState<Match[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [view, setView] = useState<AdminView>('matches')
  const [showTournamentManager, setShowTournamentManager] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showAgeGroups, setShowAgeGroups] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('display_order', { ascending: true })
      .order('start_date', { ascending: false })

    if (error) {
      toast.error(`Could not load tournaments: ${error.message}`)
      setLoadingTournaments(false)
      return [] as Tournament[]
    }
    const list = (data ?? []) as Tournament[]
    setTournaments(list)
    setLoadingTournaments(false)

    setTournamentId((current) => {
      if (current && list.some((t) => t.id === current)) return current
      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(ACTIVE_TOURNAMENT_KEY)
          : null
      const valid =
        stored && list.some((t) => t.id === stored) ? stored : null
      return valid ?? list[0]?.id ?? null
    })

    return list
  }, [supabase])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (tournamentId) {
      window.localStorage.setItem(ACTIVE_TOURNAMENT_KEY, tournamentId)
    }
  }, [tournamentId])

  const loadAgeGroups = useCallback(async () => {
    if (!tournamentId) {
      setAgeGroups([])
      setLoadingGroups(false)
      return
    }
    setLoadingGroups(true)
    const { data, error } = await supabase
      .from('age_groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('display_order', { ascending: true })

    if (error) {
      toast.error(`Could not load age groups: ${error.message}`)
      setLoadingGroups(false)
      return
    }
    setAgeGroups(data ?? [])
    setLoadingGroups(false)
  }, [supabase, tournamentId])

  useEffect(() => {
    loadAgeGroups()
  }, [loadAgeGroups])

  const groupsForDay = useMemo(
    () => ageGroups.filter((g) => g.day === day),
    [ageGroups, day]
  )

  useEffect(() => {
    if (groupsForDay.length === 0) {
      setCurrentGroupId(null)
      return
    }
    const stillValid = groupsForDay.some((g) => g.id === currentGroupId)
    if (!stillValid) {
      setCurrentGroupId(groupsForDay[0].id)
    }
  }, [groupsForDay, currentGroupId])

  const currentGroup = useMemo(
    () => ageGroups.find((g) => g.id === currentGroupId) ?? null,
    [ageGroups, currentGroupId]
  )

  const groupIdsForDay = useMemo(
    () => groupsForDay.map((g) => g.id),
    [groupsForDay]
  )

  const loadDayMatches = useCallback(async () => {
    if (groupIdsForDay.length === 0) {
      setDayMatches([])
      return
    }
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .in('age_group_id', groupIdsForDay)
      .is('deleted_at', null)
    if (error) {
      toast.error(`Could not load day schedule: ${error.message}`)
      return
    }
    setDayMatches(data ?? [])
  }, [groupIdsForDay, supabase])

  useEffect(() => {
    loadDayMatches()
  }, [loadDayMatches])

  const loadMatches = useCallback(async () => {
    if (!currentGroupId) {
      setTeams([])
      setMatches([])
      return
    }
    setLoadingMatches(true)
    const [teamsRes, matchesRes] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('age_group_id', currentGroupId)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('matches')
        .select('*')
        .eq('age_group_id', currentGroupId)
        .is('deleted_at', null)
        .order('kickoff_time', { ascending: true }),
    ])

    if (teamsRes.error) {
      toast.error(`Could not load teams: ${teamsRes.error.message}`)
    }
    if (matchesRes.error) {
      toast.error(`Could not load matches: ${matchesRes.error.message}`)
    }

    setTeams(teamsRes.data ?? [])
    setMatches(matchesRes.data ?? [])
    setLoadingMatches(false)
  }, [currentGroupId, supabase])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  const handleSaved = useCallback(async () => {
    await Promise.all([loadMatches(), loadDayMatches()])
  }, [loadMatches, loadDayMatches])

  async function handleBackup() {
    setBackingUp(true)
    const { data, error } = await supabase.rpc('backup_matches')
    setBackingUp(false)
    if (error) {
      toast.error(`Backup failed: ${error.message}`)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const count = row?.rows_backed_up ?? 0
    toast.success(`Snapshot saved — ${count} matches`)
  }

  async function handleSignOut() {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(`Sign out failed: ${error.message}`)
      setSigningOut(false)
      return
    }
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl bg-zinc-50 pb-16 dark:bg-zinc-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Admin console
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter and edit match scores
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <span>Tournament</span>
          <select
            value={tournamentId ?? ''}
            onChange={(e) => setTournamentId(e.target.value || null)}
            disabled={loadingTournaments || tournaments.length === 0}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {tournaments.length === 0 && (
              <option value="">
                {loadingTournaments ? 'Loading…' : 'No tournaments'}
              </option>
            )}
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowTournamentManager((s) => !s)
              setShowImport(false)
              setShowSchedule(false)
              setShowAgeGroups(false)
            }}
            className={
              showTournamentManager
                ? 'rounded-md border border-mk-red bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {showTournamentManager ? 'Back to scoring' : 'Manage tournaments'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAgeGroups((s) => !s)
              setShowTournamentManager(false)
              setShowImport(false)
              setShowSchedule(false)
            }}
            className={
              showAgeGroups
                ? 'rounded-md border border-mk-red bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {showAgeGroups ? 'Back to scoring' : 'Manage age groups'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImport((s) => !s)
              setShowTournamentManager(false)
              setShowSchedule(false)
              setShowAgeGroups(false)
            }}
            className={
              showImport
                ? 'rounded-md border border-mk-red bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {showImport ? 'Back to scoring' : 'Bulk import'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSchedule((s) => !s)
              setShowTournamentManager(false)
              setShowImport(false)
              setShowAgeGroups(false)
            }}
            className={
              showSchedule
                ? 'rounded-md border border-mk-red bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {showSchedule ? 'Back to scoring' : 'Schedule'}
          </button>
          <button
            type="button"
            onClick={() => setShowQRScanner(true)}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
          >
            Scan QR
          </button>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backingUp}
            title="Take a one-click snapshot of all matches into matches_backup"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {backingUp ? 'Backing up…' : 'Backup matches'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      {showTournamentManager ? (
        <section className="px-4 pt-5">
          <AdminTournamentList
            tournaments={tournaments}
            onChanged={loadTournaments}
          />
        </section>
      ) : showAgeGroups ? (
        <section className="px-4 pt-5">
          {tournamentId &&
          tournaments.find((t) => t.id === tournamentId) ? (
            <AdminAgeGroupList
              tournament={tournaments.find((t) => t.id === tournamentId)!}
              ageGroups={ageGroups}
              onChanged={() => {
                loadAgeGroups()
                loadMatches()
                loadDayMatches()
              }}
              onClose={() => setShowAgeGroups(false)}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              Select a tournament before managing age groups.
            </p>
          )}
        </section>
      ) : showImport ? (
        <section className="px-4 pt-5">
          {tournamentId &&
          tournaments.find((t) => t.id === tournamentId) ? (
            <AdminImport
              tournament={tournaments.find((t) => t.id === tournamentId)!}
              ageGroups={ageGroups}
              onClose={() => setShowImport(false)}
              onImported={() => {
                loadMatches()
                loadDayMatches()
              }}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              Select a tournament before importing.
            </p>
          )}
        </section>
      ) : showSchedule ? (
        <section className="px-4 pt-5">
          {tournamentId &&
          tournaments.find((t) => t.id === tournamentId) ? (
            <AdminScheduleView
              tournament={tournaments.find((t) => t.id === tournamentId)!}
              ageGroups={ageGroups}
              onClose={() => setShowSchedule(false)}
              onTournamentChanged={loadTournaments}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              Select a tournament to view its schedule.
            </p>
          )}
        </section>
      ) : (
      <>
      <nav
        aria-label="Tournament day"
        className="flex gap-2 border-b border-zinc-200 bg-white px-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {(['saturday', 'sunday'] as Day[]).map((d) => {
          const active = d === day
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'inline-flex items-center justify-center rounded-t-lg bg-mk-red px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-sm'
                  : 'inline-flex items-center justify-center rounded-t-lg px-5 py-3 text-sm font-semibold tracking-wide text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
              }
            >
              {d === 'saturday' ? 'Saturday' : 'Sunday'}
            </button>
          )
        })}
      </nav>

      <nav
        aria-label="Age group"
        className="overflow-x-auto whitespace-nowrap border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        {groupsForDay.length === 0 ? (
          <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
            {loadingGroups
              ? 'Loading age groups…'
              : 'No age groups scheduled for this day.'}
          </div>
        ) : (
          <ul className="flex w-max gap-1 px-4 py-2">
            {groupsForDay.map((group) => {
              const active = group.id === currentGroupId
              return (
                <li key={group.id} className="inline-block shrink-0">
                  <button
                    type="button"
                    onClick={() => setCurrentGroupId(group.id)}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'inline-block rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900'
                        : 'inline-block rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                    }
                  >
                    {group.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <section className="px-4 pt-5">
        {currentGroup ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {currentGroup.name}
              </h2>
              <div
                role="tablist"
                aria-label="Admin view"
                className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {(['matches', 'matrix', 'teams'] as AdminView[]).map((v) => {
                  const active = view === v
                  return (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setView(v)}
                      className={
                        active
                          ? 'rounded bg-mk-red px-3 py-1 text-xs font-semibold text-white'
                          : 'rounded px-3 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                      }
                    >
                      {VIEW_LABELS[v]}
                    </button>
                  )
                })}
              </div>
            </div>
            {loadingMatches ? (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Loading…
              </p>
            ) : view === 'matches' ? (
              <AdminMatchList
                matches={matches}
                teams={teams}
                ageGroupName={currentGroup.name}
                onSaved={handleSaved}
              />
            ) : view === 'matrix' ? (
              <AdminFixtureMatrix
                teams={teams}
                matches={matches}
                dayMatches={dayMatches}
              />
            ) : (
              <AdminTeamList
                teams={teams}
                ageGroupId={currentGroup.id}
                ageGroupName={currentGroup.name}
                onSaved={handleSaved}
              />
            )}
          </>
        ) : (
          !loadingGroups && (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              Select a day with scheduled age groups.
            </p>
          )
        )}
      </section>
      </>
      )}
      {showQRScanner && (
        <QRScannerModal onClose={() => setShowQRScanner(false)} />
      )}
    </main>
  )
}
