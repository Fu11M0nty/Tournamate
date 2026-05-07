'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import AdminMatchList from '@/components/AdminMatchList'
import AdminTeamList from '@/components/AdminTeamList'
import AdminFixtureMatrix from '@/components/AdminFixtureMatrix'
import AdminImport from '@/components/AdminImport'
import AdminScheduleView from '@/components/AdminScheduleView'
import AdminAgeGroupList from '@/components/AdminAgeGroupList'
import AdminTournamentLanding from '@/components/AdminTournamentLanding'
import QRScannerModal from '@/components/QRScannerModal'
import AdminSidebar, { type AdminPanel } from '@/components/AdminSidebar'
import AdminUserList from '@/components/AdminUserList'
import SnapshotView from '@/components/SnapshotView'
import SnapshotDialog from '@/components/SnapshotDialog'
import { createClient } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/auth-context'
import type { AgeGroup, Day, Match, Team, Tournament } from '@/lib/types'

type AdminView = 'matches' | 'matrix'

const VIEW_LABELS: Record<AdminView, string> = {
  matches: 'Matches',
  matrix: 'Matrix',
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { role } = useAdminAuth()
  const isSuperAdmin = role === 'superadmin'

  // null = landing; set = inside that tournament
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)

  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [day, setDay] = useState<Day>('saturday')
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [dayMatches, setDayMatches] = useState<Match[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [view, setView] = useState<AdminView>('matches')
  const [activePanel, setActivePanel] = useState<AdminPanel>('match-entry')
  const [ageGroupsTeamsId, setAgeGroupsTeamsId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [takingSnapshot, setTakingSnapshot] = useState(false)
  const [inactivityLoggedOut, setInactivityLoggedOut] = useState(false)

  // Auto-logout after 10 minutes of inactivity
  useEffect(() => {
    const TIMEOUT_MS = 10 * 60 * 1000
    let timer: ReturnType<typeof setTimeout>

    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        setInactivityLoggedOut(true)
      }, TIMEOUT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach(ev => window.removeEventListener(ev, resetTimer))
    }
  }, [supabase])

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
    return list
  }, [supabase])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  const loadAgeGroups = useCallback(async () => {
    if (!tournamentId || tournamentId === '__users__') {
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
    if (!stillValid) setCurrentGroupId(groupsForDay[0].id)
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

    if (teamsRes.error) toast.error(`Could not load teams: ${teamsRes.error.message}`)
    if (matchesRes.error) toast.error(`Could not load matches: ${matchesRes.error.message}`)

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

  async function handleSnapshot(reason: string) {
    if (!currentGroupId || !currentGroup) return
    setTakingSnapshot(true)
    const { data, error } = await supabase.rpc('backup_age_group_matches', {
      p_age_group_id: currentGroupId,
      p_reason: reason,
    })
    setTakingSnapshot(false)
    setShowSnapshotDialog(false)
    if (error) {
      toast.error(`Snapshot failed: ${error.message}`)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const count = row?.rows_backed_up ?? 0
    toast.success(`Snapshot saved — ${count} match${count !== 1 ? 'es' : ''} captured`)
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

  function handleEnterTournament(t: Tournament) {
    setTournamentId(t.id)
    setActivePanel('match-entry')
    setView('matches')
    setDay('saturday')
    setCurrentGroupId(null)
    setAgeGroupsTeamsId(null)
  }

  function handleExitTournament() {
    setTournamentId(null)
    setAgeGroups([])
    setTeams([])
    setMatches([])
    setDayMatches([])
    setCurrentGroupId(null)
    setSidebarOpen(false)
  }

  const activeTournament = tournaments.find((t) => t.id === tournamentId) ?? null

  // ── Inactivity timeout ────────────────────────────────────────────────────
  if (inactivityLoggedOut) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/75 backdrop-blur-sm">
        <div className="mx-4 max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl dark:bg-zinc-900">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl dark:bg-amber-900">
            ⏱
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Signed out due to inactivity
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            You were automatically signed out after 10 minutes of inactivity to keep your account secure.
          </p>
          <a
            href="/admin/login"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-tm-orange px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark"
          >
            Sign in again
          </a>
        </div>
      </div>
    )
  }

  // ── Landing view ──────────────────────────────────────────────────────────
  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Landing header */}
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="text-md font-bold text-zinc-900 dark:text-zinc-50">
              Admin Console
            </p>
            <div className="flex items-center gap-3">
              {role && (
                <span
                  className={[
                    'hidden rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-block',
                    isSuperAdmin
                      ? 'bg-mk-red-soft text-mk-red'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                  ].join(' ')}
                >
                  {isSuperAdmin ? 'Superadmin' : 'Tournament Admin'}
                </span>
              )}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setTournamentId('__users__')}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Manage Users
                </button>
              )}
            </div>
          </div>
        </header>

        <AdminTournamentLanding
          tournaments={tournaments}
          loading={loadingTournaments}
          onEnter={handleEnterTournament}
          onChanged={loadTournaments}
        />
      </div>
    )
  }

  // ── User management overlay (superadmin only) ─────────────────────────────
  if (tournamentId === '__users__') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTournamentId(null)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
              </button>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                User Management
              </span>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Users</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Promote or demote registered tournament organisers.
            </p>
          </div>
          <AdminUserList />
        </div>
      </div>
    )
  }

  // ── Tournament console view ───────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePanel={activePanel}
        onNavigate={(panel) => {
          setActivePanel(panel)
          if (panel !== 'age-groups') setAgeGroupsTeamsId(null)
          setSidebarOpen(false)
        }}
        onScanQR={() => {
          setShowQRScanner(true)
          setSidebarOpen(false)
        }}
        onBackup={handleBackup}
        backingUp={backingUp}
        role={role}
      />

      <div className="flex min-w-0 flex-1 flex-col pb-16">
        {/* Top bar */}
        <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Exit tournament */}
          <button
            type="button"
            onClick={handleExitTournament}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Back to all tournaments"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="hidden sm:inline">All Tournaments</span>
          </button>

          <span className="text-zinc-300 dark:text-zinc-600">/</span>

          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {activeTournament?.name ?? 'Tournament'}
          </span>
        </header>

        {/* Panel content */}
        {activePanel === 'age-groups' ? (
          <section className="px-4 pt-5">
            {activeTournament ? (
              ageGroupsTeamsId ? (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAgeGroupsTeamsId(null)}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      Back to Age Groups
                    </button>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {ageGroups.find((g) => g.id === ageGroupsTeamsId)?.name ?? ''} — Add/Edit Teams
                    </span>
                  </div>
                  <AdminTeamList
                    teams={teams}
                    ageGroupId={ageGroupsTeamsId}
                    ageGroupName={ageGroups.find((g) => g.id === ageGroupsTeamsId)?.name ?? ''}
                    onSaved={handleSaved}
                  />
                </>
              ) : (
                <AdminAgeGroupList
                  tournament={activeTournament}
                  ageGroups={ageGroups}
                  onChanged={() => {
                    loadAgeGroups()
                    loadMatches()
                    loadDayMatches()
                  }}
                  onClose={() => setActivePanel('match-entry')}
                  onEditTeams={(g) => {
                    setCurrentGroupId(g.id)
                    setAgeGroupsTeamsId(g.id)
                  }}
                />
              )
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Tournament not found.
              </p>
            )}
          </section>
        ) : activePanel === 'snapshots' ? (
          <section className="px-4 pt-5">
            <SnapshotView />
          </section>
        ) : activePanel === 'import' ? (
          <section className="px-4 pt-5">
            {activeTournament ? (
              <AdminImport
                tournament={activeTournament}
                ageGroups={ageGroups}
                onClose={() => setActivePanel('match-entry')}
                onImported={() => {
                  loadMatches()
                  loadDayMatches()
                }}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Tournament not found.
              </p>
            )}
          </section>
        ) : activePanel === 'schedule' ? (
          <section className="px-4 pt-5">
            {activeTournament ? (
              <AdminScheduleView
                tournament={activeTournament}
                ageGroups={ageGroups}
                onClose={() => setActivePanel('match-entry')}
                onTournamentChanged={loadTournaments}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Tournament not found.
              </p>
            )}
          </section>
        ) : activePanel === 'users' ? (
          <section className="px-4 pt-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                User Management
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Promote or demote registered tournament organisers.
              </p>
            </div>
            <AdminUserList />
          </section>
        ) : (
          <>
            {/* Day tabs */}
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

            {/* Age group tabs */}
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
                      {(['matches', 'matrix'] as AdminView[]).map((v) => {
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
                    <>
                      <AdminMatchList
                        matches={matches}
                        teams={teams}
                        ageGroupName={currentGroup.name}
                        onSaved={handleSaved}
                      />
                      <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setShowSnapshotDialog(true)}
                          className="inline-flex items-center gap-2 rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:bg-zinc-900 dark:text-indigo-400 dark:hover:bg-indigo-950"
                        >
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
                          Snapshot
                        </button>
                      </div>
                    </>
                  ) : (
                    <AdminFixtureMatrix
                      teams={teams}
                      matches={matches}
                      dayMatches={dayMatches}
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
      </div>

      {showQRScanner && (
        <QRScannerModal onClose={() => setShowQRScanner(false)} />
      )}
      {showSnapshotDialog && currentGroup && (
        <SnapshotDialog
          ageGroupName={currentGroup.name}
          day={day}
          matchCount={matches.length}
          loading={takingSnapshot}
          onConfirm={handleSnapshot}
          onCancel={() => setShowSnapshotDialog(false)}
        />
      )}
    </div>
  )
}
