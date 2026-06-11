'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import {
  countAvailableSlots,
  generatePlayableDates,
  placeMatchOnDate,
  planMultiWeekSchedule,
  type MultiWeekScheduleMatch,
} from '@/lib/multiWeekSchedule'
import { createClient } from '@/lib/supabase'
import HelpPrompt from '@/components/help/HelpPrompt'
import { buildIsoFromLondonTime, formatKickoffTime, getLondonTimeHHmm } from '@/lib/time'
import type {
  AgeGroup,
  LeagueScheduleSettings,
  LeagueVenueMode,
  Match,
  Phase,
  Team,
  Tournament,
  TournamentVenue,
} from '@/lib/types'

interface AdminMultiWeekScheduleViewProps {
  tournament: Tournament
  ageGroups: AgeGroup[]
  onClose: () => void
}

interface DraftSettings {
  start_date: string
  end_date: string
  playable_weekdays: number[]
  venue_mode: LeagueVenueMode
  max_games_per_team_per_week: string
  min_gap_minutes: string
  prefer_round_order: boolean
  prefer_home_away_balance: boolean
}

// A staged, not-yet-committed change to a fixture's placement. `place` assigns
// a kickoff/court; `unplan` returns the fixture to the unplanned tray.
type PendingChange =
  | { kind: 'place'; kickoffTime: string; court: string | null }
  | { kind: 'unplan' }

// Editable scheduling parameters for a venue, tweakable on the schedule page.
interface VenueDraft {
  id: string
  name: string
  available_from: string
  available_to: string
  court_count: string
  playable_weekdays: number[]
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

function defaultDraft(tournament: Tournament): DraftSettings {
  return {
    start_date: tournament.start_date ?? '',
    end_date: tournament.end_date ?? tournament.start_date ?? '',
    playable_weekdays: [6],
    venue_mode: 'neutral_venues',
    max_games_per_team_per_week: '1',
    min_gap_minutes: '0',
    prefer_round_order: true,
    prefer_home_away_balance: true,
  }
}

function draftFromSettings(
  settings: LeagueScheduleSettings | null,
  tournament: Tournament
): DraftSettings {
  if (!settings) return defaultDraft(tournament)
  return {
    start_date: settings.start_date,
    end_date: settings.end_date,
    playable_weekdays: settings.playable_weekdays,
    venue_mode: settings.venue_mode,
    max_games_per_team_per_week:
      settings.max_games_per_team_per_week === null
        ? ''
        : String(settings.max_games_per_team_per_week),
    min_gap_minutes: String(settings.min_gap_minutes ?? 0),
    prefer_round_order: settings.prefer_round_order,
    prefer_home_away_balance: settings.prefer_home_away_balance,
  }
}

function monthKeyFromDate(value: string): string {
  return value ? value.slice(0, 7) : new Date().toISOString().slice(0, 7)
}

function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

function londonDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`
}

function participantIds(match: Match): string[] {
  return [
    match.home_team_id ? `team:${match.home_team_id}` : match.home_slot_id ? `slot:${match.home_slot_id}` : null,
    match.away_team_id ? `team:${match.away_team_id}` : match.away_slot_id ? `slot:${match.away_slot_id}` : null,
  ].filter((value): value is string => Boolean(value))
}

function cleanNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
}

export default function AdminMultiWeekScheduleView({
  tournament,
  ageGroups,
  onClose,
}: AdminMultiWeekScheduleViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const [phases, setPhases] = useState<Phase[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [venues, setVenues] = useState<TournamentVenue[]>([])
  const [venueDrafts, setVenueDrafts] = useState<VenueDraft[]>([])
  const [savingVenues, setSavingVenues] = useState(false)
  const [settings, setSettings] = useState<LeagueScheduleSettings[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = useState('')
  const [draft, setDraft] = useState<DraftSettings>(() => defaultDraft(tournament))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [month, setMonth] = useState(monthKeyFromDate(tournament.start_date ?? ''))
  const [pending, setPending] = useState<Map<string, PendingChange>>(new Map())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [unplanAllOpen, setUnplanAllOpen] = useState(false)
  const [unplanningAll, setUnplanningAll] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const ageGroupById = useMemo(
    () => new Map(ageGroups.map((ageGroup) => [ageGroup.id, ageGroup])),
    [ageGroups]
  )

  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  )

  const settingsByPhaseId = useMemo(
    () => new Map(settings.map((row) => [row.phase_id, row])),
    [settings]
  )

  const selectedPhase = useMemo(
    () => phases.find((phase) => phase.id === selectedPhaseId) ?? null,
    [phases, selectedPhaseId]
  )

  const phaseMatches = useMemo(
    () => matches.filter((match) => match.phase_id === selectedPhaseId),
    [matches, selectedPhaseId]
  )

  // Phase matches with the staged (pending) drag-and-drop / auto-plan changes
  // applied on top, so the calendar and tray preview unconfirmed edits.
  const effectivePhaseMatches = useMemo(() => {
    if (pending.size === 0) return phaseMatches
    return phaseMatches.map((match) => {
      const change = pending.get(match.id)
      if (!change) return match
      if (change.kind === 'unplan') return { ...match, is_planned: false }
      return { ...match, is_planned: true, kickoff_time: change.kickoffTime, court: change.court }
    })
  }, [phaseMatches, pending])

  const scheduleTeams = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        homeVenueName: team.home_venue_name,
        homeVenueAddress: team.home_venue_address,
        homeVenuePostcode: team.home_venue_postcode,
      })),
    [teams]
  )

  // Built from the live "Venues & courts" editor (venueDrafts) so the slot
  // summary and the planner reflect edits immediately, before they're saved.
  const scheduleVenues = useMemo(
    () =>
      venueDrafts.map((venue) => ({
        name: venue.name,
        availableFrom: venue.available_from,
        availableTo: venue.available_to,
        courtCount: Math.max(1, Math.floor(Number(venue.court_count) || 1)),
        playableWeekdays: venue.playable_weekdays,
      })),
    [venueDrafts]
  )

  // Every selectable court label, expanding each venue by its court count.
  const courtOptions = useMemo(() => {
    const options: string[] = []
    for (const venue of scheduleVenues) {
      const count = Math.max(1, venue.courtCount ?? 1)
      if (count > 1) {
        for (let i = 1; i <= count; i += 1) options.push(`${venue.name} - Court ${i}`)
      } else {
        options.push(venue.name)
      }
    }
    return options
  }, [scheduleVenues])

  // DB-committed fixtures that are scheduled but not yet played — the ones an
  // "unplan all" can clear. Completed games are deliberately excluded.
  const scheduledUnplayedCount = useMemo(
    () =>
      phaseMatches.filter((m) => m.is_planned && m.status !== 'completed').length,
    [phaseMatches]
  )

  const minGap = useMemo(
    () => Math.max(0, Math.floor(Number(draft.min_gap_minutes) || 0)),
    [draft.min_gap_minutes]
  )

  // Representative match length for this phase, used to estimate slot capacity.
  const matchDurationEstimate = useMemo(() => {
    const durations = phaseMatches.map((m) => m.duration_minutes).filter((d) => d > 0)
    return durations.length > 0 ? Math.max(...durations) : 0
  }, [phaseMatches])

  const playableDates = useMemo(
    () => generatePlayableDates(draft.start_date, draft.end_date, draft.playable_weekdays),
    [draft.end_date, draft.playable_weekdays, draft.start_date]
  )

  const playableDateSet = useMemo(() => new Set(playableDates), [playableDates])

  const totalSlots = useMemo(
    () => countAvailableSlots(playableDates, scheduleVenues, matchDurationEstimate, minGap),
    [playableDates, scheduleVenues, matchDurationEstimate, minGap]
  )

  // Weekdays on which at least one venue is open (a venue with no specific days
  // counts as open on every phase weekday). Used to grey out days with no venue.
  const openWeekdays = useMemo(() => {
    const set = new Set<number>()
    if (scheduleVenues.length === 0) {
      draft.playable_weekdays.forEach((day) => set.add(day))
      return set
    }
    for (const venue of scheduleVenues) {
      const days =
        venue.playableWeekdays && venue.playableWeekdays.length > 0
          ? venue.playableWeekdays
          : draft.playable_weekdays
      days.forEach((day) => set.add(day))
    }
    return set
  }, [scheduleVenues, draft.playable_weekdays])

  // For a knockout phase: the earliest date a fixture may be placed (the day
  // after the last scheduled league fixture). 'blocked' means a league phase
  // exists but has no scheduled fixtures yet; null means no league constraint.
  const knockoutEarliest = useMemo<string | 'blocked' | null>(() => {
    if (!selectedPhase || selectedPhase.phase_type !== 'knockout') return null
    const leaguePhaseIds = phases
      .filter(
        (phase) =>
          phase.age_group_id === selectedPhase.age_group_id &&
          phase.phase_type === 'league'
      )
      .map((phase) => phase.id)
    if (leaguePhaseIds.length === 0) return null

    const leagueDates = matches
      .filter(
        (m) =>
          m.phase_id !== null &&
          leaguePhaseIds.includes(m.phase_id) &&
          (m.is_planned || m.status === 'completed') &&
          m.kickoff_time
      )
      .map((m) => londonDateKey(m.kickoff_time))
      .sort()
    if (leagueDates.length === 0) return 'blocked'

    const next = new Date(`${leagueDates[leagueDates.length - 1]}T00:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
  }, [matches, phases, selectedPhase])

  const isDroppableDate = useCallback(
    (date: string): boolean => {
      if (!playableDateSet.has(date)) return false
      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
      if (!openWeekdays.has(weekday)) return false
      if (knockoutEarliest === 'blocked') return false
      if (typeof knockoutEarliest === 'string' && date < knockoutEarliest) return false
      return true
    },
    [knockoutEarliest, openWeekdays, playableDateSet]
  )

  const unplannedMatches = useMemo(
    () =>
      effectivePhaseMatches
        .filter((match) => !match.is_planned && match.status !== 'completed')
        .sort((a, b) => {
          const roundA = a.round_number ?? Number.POSITIVE_INFINITY
          const roundB = b.round_number ?? Number.POSITIVE_INFINITY
          if (roundA !== roundB) return roundA - roundB
          return a.id.localeCompare(b.id)
        }),
    [effectivePhaseMatches]
  )

  // Group the round-ordered unplanned fixtures so each round reads as a block.
  const unplannedByRound = useMemo(() => {
    const groups: { round: number | null; matches: Match[] }[] = []
    for (const match of unplannedMatches) {
      const round = match.round_number ?? null
      const last = groups[groups.length - 1]
      if (last && last.round === round) last.matches.push(match)
      else groups.push({ round, matches: [match] })
    }
    return groups
  }, [unplannedMatches])

  const plannedMatches = useMemo(
    () =>
      effectivePhaseMatches
        .filter((match) => match.is_planned && match.kickoff_time)
        .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time)),
    [effectivePhaseMatches]
  )

  const matchesByDateMap = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const match of plannedMatches) {
      const key = londonDateKey(match.kickoff_time)
      const list = map.get(key) ?? []
      list.push(match)
      map.set(key, list)
    }
    return map
  }, [plannedMatches])

  // Planned fixtures from the division's *other* phases (e.g. the league when
  // planning a knockout). Shown on the calendar as read-only, greyed context so
  // the organiser can see where those games already sit. Not editable here.
  const contextMatchesByDate = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; time: string; court: string | null; badge: string }[]
    >()
    if (!selectedPhase) return map
    const phaseNameById = new Map(phases.map((phase) => [phase.id, phase.name]))
    const nameOf = (id: string | null) => (id ? teamById.get(id)?.name ?? 'TBD' : 'TBD')
    for (const m of matches) {
      if (m.deleted_at || !m.is_planned || !m.kickoff_time) continue
      if (m.age_group_id !== selectedPhase.age_group_id) continue
      if (!m.phase_id || m.phase_id === selectedPhaseId) continue
      const badge = phaseNameById.get(m.phase_id)
      if (!badge) continue
      const date = londonDateKey(m.kickoff_time)
      const list = map.get(date) ?? []
      list.push({
        id: m.id,
        label: `${nameOf(m.home_team_id)} v ${nameOf(m.away_team_id)}`,
        time: formatKickoffTime(m.kickoff_time),
        court: m.court,
        badge,
      })
      map.set(date, list)
    }
    return map
  }, [matches, phases, selectedPhase, selectedPhaseId, teamById])

  // 7-column month grid: full weeks (Mon–Sun) spanning the displayed month.
  const calendarWeeks = useMemo(() => {
    const [year, monthNo] = month.split('-').map(Number)
    const firstOfMonth = new Date(Date.UTC(year, monthNo - 1, 1))
    const lastOfMonth = new Date(Date.UTC(year, monthNo, 0))
    const gridStart = new Date(firstOfMonth)
    gridStart.setUTCDate(firstOfMonth.getUTCDate() - ((firstOfMonth.getUTCDay() + 6) % 7))
    const gridEnd = new Date(lastOfMonth)
    gridEnd.setUTCDate(lastOfMonth.getUTCDate() + (6 - ((lastOfMonth.getUTCDay() + 6) % 7)))

    const weeks: { date: string; inMonth: boolean }[][] = []
    const cursor = new Date(gridStart)
    while (cursor <= gridEnd) {
      const week: { date: string; inMonth: boolean }[] = []
      for (let i = 0; i < 7; i += 1) {
        week.push({
          date: cursor.toISOString().slice(0, 10),
          inMonth: cursor.getUTCMonth() === monthNo - 1,
        })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      weeks.push(week)
    }
    return weeks
  }, [month])

  const sameDayConflictIds = useMemo(() => {
    const seen = new Map<string, Map<string, string[]>>()
    for (const match of plannedMatches) {
      const date = londonDateKey(match.kickoff_time)
      const byParticipant = seen.get(date) ?? new Map<string, string[]>()
      for (const participant of participantIds(match)) {
        const ids = byParticipant.get(participant) ?? []
        ids.push(match.id)
        byParticipant.set(participant, ids)
      }
      seen.set(date, byParticipant)
    }

    const conflicts = new Set<string>()
    for (const byParticipant of seen.values()) {
      for (const ids of byParticipant.values()) {
        if (ids.length > 1) ids.forEach((id) => conflicts.add(id))
      }
    }
    return conflicts
  }, [plannedMatches])

  const toScheduleMatch = useCallback(
    (m: Match): MultiWeekScheduleMatch => ({
      id: m.id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeSlotId: m.home_slot_id,
      awaySlotId: m.away_slot_id,
      roundNumber: m.round_number,
      status: m.status,
      isPlanned: m.is_planned,
      kickoffTime: m.kickoff_time,
      court: m.court,
      durationMinutes: m.duration_minutes,
    }),
    []
  )

  const load = useCallback(async () => {
    setLoading(true)
    const ageGroupIds = ageGroups.map((ageGroup) => ageGroup.id)
    if (ageGroupIds.length === 0) {
      setPhases([])
      setTeams([])
      setMatches([])
      setVenues([])
      setSettings([])
      setLoading(false)
      return
    }

    const [phasesRes, teamsRes, matchesRes, venuesRes] = await Promise.all([
      supabase
        .from('phases')
        .select('*')
        .in('age_group_id', ageGroupIds)
        .in('phase_type', ['league', 'knockout'])
        .order('display_order', { ascending: true }),
      supabase
        .from('teams')
        .select('*')
        .in('age_group_id', ageGroupIds)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('matches')
        .select('*')
        .in('age_group_id', ageGroupIds)
        .is('deleted_at', null)
        .order('kickoff_time', { ascending: true }),
      supabase
        .from('tournament_venues')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('display_order', { ascending: true }),
    ])

    if (phasesRes.error) toast.error(`Could not load phases: ${phasesRes.error.message}`)
    if (teamsRes.error) toast.error(`Could not load teams: ${teamsRes.error.message}`)
    if (matchesRes.error) toast.error(`Could not load matches: ${matchesRes.error.message}`)
    if (venuesRes.error) toast.error(`Could not load venues: ${venuesRes.error.message}`)

    const nextPhases = (phasesRes.data ?? []) as Phase[]
    setPhases(nextPhases)
    setTeams((teamsRes.data ?? []) as Team[])
    setMatches((matchesRes.data ?? []) as Match[])
    setVenues((venuesRes.data ?? []) as TournamentVenue[])

    if (nextPhases.length > 0) {
      const phaseIds = nextPhases.map((phase) => phase.id)
      const settingsRes = await supabase
        .from('league_schedule_settings')
        .select('*')
        .in('phase_id', phaseIds)
      if (settingsRes.error) {
        toast.error(`Could not load multi-week settings: ${settingsRes.error.message}`)
        setSettings([])
      } else {
        setSettings((settingsRes.data ?? []) as LeagueScheduleSettings[])
      }
      setSelectedPhaseId((current) =>
        current && phaseIds.includes(current) ? current : phaseIds[0]
      )
    } else {
      setSettings([])
      setSelectedPhaseId('')
    }

    setLoading(false)
  }, [ageGroups, supabase, tournament.id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    setVenueDrafts(
      venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        available_from: venue.available_from ?? '09:00',
        available_to: venue.available_to ?? '17:00',
        court_count: String(venue.court_count ?? 1),
        playable_weekdays: venue.playable_weekdays ?? [],
      }))
    )
  }, [venues])

  useEffect(() => {
    if (!selectedPhaseId) return
    const timer = window.setTimeout(() => {
      const selectedSettings = settingsByPhaseId.get(selectedPhaseId) ?? null
      const nextDraft = draftFromSettings(selectedSettings, tournament)
      setDraft(nextDraft)
      setMonth(monthKeyFromDate(nextDraft.start_date))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedPhaseId, settingsByPhaseId, tournament])

  // Discard staged changes only when the phase actually changes — not when its
  // settings are re-saved (which would otherwise wipe a freshly auto-planned batch).
  useEffect(() => {
    setPending(new Map())
    setEditingMatchId(null)
  }, [selectedPhaseId])

  function updateVenueDraft(id: string, patch: Partial<VenueDraft>) {
    setVenueDrafts((current) =>
      current.map((venue) => (venue.id === id ? { ...venue, ...patch } : venue))
    )
  }

  function toggleVenueWeekday(id: string, value: number) {
    setVenueDrafts((current) =>
      current.map((venue) => {
        if (venue.id !== id) return venue
        const set = new Set(venue.playable_weekdays)
        if (set.has(value)) set.delete(value)
        else set.add(value)
        return { ...venue, playable_weekdays: Array.from(set).sort((a, b) => a - b) }
      })
    )
  }

  async function saveVenues() {
    for (const venue of venueDrafts) {
      if (venue.available_to <= venue.available_from) {
        toast.error(`${venue.name}: closing time must be after opening time.`)
        return
      }
    }

    setSavingVenues(true)
    const normalised = venueDrafts.map((venue) => ({
      id: venue.id,
      available_from: venue.available_from,
      available_to: venue.available_to,
      court_count: Math.max(1, Math.floor(Number(venue.court_count) || 1)),
      playable_weekdays: venue.playable_weekdays,
    }))
    const results = await Promise.all(
      normalised.map((venue) =>
        supabase
          .from('tournament_venues')
          .update({
            available_from: venue.available_from,
            available_to: venue.available_to,
            court_count: venue.court_count,
            playable_weekdays: venue.playable_weekdays,
          })
          .eq('id', venue.id)
      )
    )
    setSavingVenues(false)

    const failed = results.find((result) => result.error)
    if (failed?.error) {
      toast.error(`Could not save venues: ${failed.error.message}`)
      return
    }

    const byId = new Map(normalised.map((venue) => [venue.id, venue]))
    setVenues((current) =>
      current.map((venue) => {
        const update = byId.get(venue.id)
        return update
          ? {
              ...venue,
              available_from: update.available_from,
              available_to: update.available_to,
              court_count: update.court_count,
              playable_weekdays: update.playable_weekdays,
            }
          : venue
      })
    )
    toast.success('Venue availability saved')
  }

  function toggleWeekday(value: number) {
    setDraft((current) => {
      const set = new Set(current.playable_weekdays)
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...current, playable_weekdays: Array.from(set).sort((a, b) => a - b) }
    })
  }

  async function saveSettings(): Promise<boolean> {
    if (!selectedPhaseId) {
      toast.error('Select a league or bracket phase first.')
      return false
    }
    if (!draft.start_date || !draft.end_date) {
      toast.error('Choose a start and end date.')
      return false
    }
    if (draft.end_date < draft.start_date) {
      toast.error('End date must be after the start date.')
      return false
    }
    if (draft.playable_weekdays.length === 0) {
      toast.error('Choose at least one playable weekday.')
      return false
    }

    setSaving(true)
    const payload = {
      phase_id: selectedPhaseId,
      start_date: draft.start_date,
      end_date: draft.end_date,
      playable_weekdays: draft.playable_weekdays,
      venue_mode: draft.venue_mode,
      max_games_per_team_per_week: cleanNumber(draft.max_games_per_team_per_week),
      min_gap_minutes: minGap,
      prefer_round_order: draft.prefer_round_order,
      prefer_home_away_balance: draft.prefer_home_away_balance,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('league_schedule_settings')
      .upsert(payload)
      .select()
    setSaving(false)

    if (error) {
      toast.error(`Could not save settings: ${error.message}`)
      return false
    }

    const saved = (data ?? []) as LeagueScheduleSettings[]
    setSettings((current) => [
      ...current.filter((row) => row.phase_id !== selectedPhaseId),
      ...saved,
    ])
    toast.success('Multi-week settings saved')
    return true
  }

  async function runPlanner() {
    const saved = await saveSettings()
    if (!saved || !selectedPhase) return

    // A knockout phase must follow the league phase that feeds it.
    if (knockoutEarliest === 'blocked') {
      toast.error('Schedule the league phase before planning the knockout.')
      return
    }
    const earliestDate = typeof knockoutEarliest === 'string' ? knockoutEarliest : undefined

    setPlanning(true)
    const result = planMultiWeekSchedule({
      matches: effectivePhaseMatches.map(toScheduleMatch),
      teams: scheduleTeams,
      venues: scheduleVenues,
      options: {
        startDate: draft.start_date,
        endDate: draft.end_date,
        playableWeekdays: draft.playable_weekdays,
        venueMode: draft.venue_mode,
        maxGamesPerTeamPerWeek: cleanNumber(draft.max_games_per_team_per_week),
        minGapMinutes: minGap,
        preferRoundOrder: draft.prefer_round_order,
        preferHomeAwayBalance: draft.prefer_home_away_balance,
        earliestDate,
      },
    })
    setPlanning(false)

    if (result.placements.length === 0) {
      toast.error(result.unplaced[0]?.reason ?? 'No fixtures could be planned.')
      return
    }

    // Stage placements rather than committing — the organiser reviews them on
    // the calendar and confirms.
    setPending((current) => {
      const next = new Map(current)
      for (const placement of result.placements) {
        next.set(placement.matchId, {
          kind: 'place',
          kickoffTime: placement.kickoffTime,
          court: placement.court,
        })
      }
      return next
    })

    const skipped = result.unplaced.length
    toast.success(
      `Staged ${result.placements.length} fixture${result.placements.length === 1 ? '' : 's'} — review and confirm${skipped > 0 ? `; ${skipped} left unplanned` : ''}`
    )
  }

  function stagePlacementOnDate(match: Match, date: string) {
    if (!isDroppableDate(date)) return
    const locks = effectivePhaseMatches
      .filter((m) => m.id !== match.id && m.is_planned && m.kickoff_time)
      .map(toScheduleMatch)
    const placement = placeMatchOnDate({
      match: toScheduleMatch(match),
      date,
      locks,
      teams: scheduleTeams,
      venues: scheduleVenues,
      venueMode: draft.venue_mode,
      minGapMinutes: minGap,
    })
    if (!placement) {
      toast.error('No free slot on that day — adjust the venue hours or court count.')
      return
    }
    setPending((current) => {
      const next = new Map(current)
      next.set(match.id, {
        kind: 'place',
        kickoffTime: placement.kickoffTime,
        court: placement.court,
      })
      return next
    })
  }

  function stageUnplan(match: Match) {
    setPending((current) => {
      const next = new Map(current)
      next.set(match.id, { kind: 'unplan' })
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const overId = event.over?.id
    if (!overId) return
    const matchId = String(event.active.id).replace('match:', '')
    const match = phaseMatches.find((m) => m.id === matchId)
    if (!match) return

    if (overId === 'tray') {
      const effective = effectivePhaseMatches.find((m) => m.id === matchId)
      if (effective?.is_planned) stageUnplan(match)
      return
    }

    const target = String(overId)
    if (target.startsWith('day:')) {
      stagePlacementOnDate(match, target.slice(4))
    }
  }

  function discardPending() {
    setPending(new Map())
  }

  async function confirmPending() {
    if (pending.size === 0) return
    const changeCount = pending.size
    const places: { id: string; court: string | null; kickoff_time: string }[] = []
    const unplanIds: string[] = []
    for (const [id, change] of pending) {
      if (change.kind === 'place') {
        places.push({ id, court: change.court, kickoff_time: change.kickoffTime })
      } else {
        unplanIds.push(id)
      }
    }

    setCommitting(true)
    if (places.length > 0) {
      const { error } = await supabase.rpc('commit_schedule', { plan: places })
      if (error) {
        setCommitting(false)
        toast.error(`Could not save schedule: ${error.message}`)
        return
      }
    }
    if (unplanIds.length > 0) {
      const { error } = await supabase
        .from('matches')
        .update({ is_planned: false })
        .in('id', unplanIds)
      if (error) {
        setCommitting(false)
        toast.error(`Could not unplan fixtures: ${error.message}`)
        return
      }
    }
    setCommitting(false)
    setPending(new Map())
    toast.success(`Saved ${changeCount} change${changeCount === 1 ? '' : 's'}`)
    await load()
  }

  function saveFixtureEdit(matchId: string, date: string, time: string, court: string) {
    if (!date || !time) {
      toast.error('Enter a date and time.')
      return
    }
    const kickoffTime = buildIsoFromLondonTime(`${date}T12:00:00.000Z`, time)
    setPending((current) => {
      const next = new Map(current)
      next.set(matchId, { kind: 'place', kickoffTime, court: court.trim() || null })
      return next
    })
    setEditingMatchId(null)
  }

  // Immediately unschedule every committed, unplayed fixture in the phase.
  // Played (completed) games are left untouched.
  async function unplanAll() {
    const ids = phaseMatches
      .filter((m) => m.is_planned && m.status !== 'completed')
      .map((m) => m.id)
    if (ids.length === 0) {
      setUnplanAllOpen(false)
      return
    }
    setUnplanningAll(true)
    const { error } = await supabase
      .from('matches')
      .update({ is_planned: false })
      .in('id', ids)
    setUnplanningAll(false)
    setUnplanAllOpen(false)
    if (error) {
      toast.error(`Could not unplan fixtures: ${error.message}`)
      return
    }
    setPending(new Map())
    toast.success(`Unscheduled ${ids.length} fixture${ids.length === 1 ? '' : 's'}`)
    await load()
  }

  function teamName(id: string | null): string {
    if (!id) return 'TBD'
    return teamById.get(id)?.name ?? 'TBD'
  }

  const editingMatch = editingMatchId
    ? effectivePhaseMatches.find((m) => m.id === editingMatchId) ?? null
    : null

  const activeMatch = activeId
    ? phaseMatches.find((m) => m.id === activeId.replace('match:', '')) ?? null
    : null

  const selectedDivision = selectedPhase
    ? ageGroupById.get(selectedPhase.age_group_id)
    : null

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Multi-week schedule
            <HelpPrompt guideSlug="multi-week-league" label="the multi-week league planner" tip="Venue hours, the calendar, auto-plan, and fine-tuning" />
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Plan league and bracket fixtures across dates, weekdays, and venue strategies.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phase
              <select
                value={selectedPhaseId}
                onChange={(e) => setSelectedPhaseId(e.target.value)}
                disabled={loading || phases.length === 0}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {phases.length === 0 ? (
                  <option value="">No league or bracket phases</option>
                ) : (
                  phases.map((phase) => {
                    const division = ageGroupById.get(phase.age_group_id)
                    return (
                      <option key={phase.id} value={phase.id}>
                        {division?.name ?? 'Division'} - {phase.name}
                      </option>
                    )
                  })
                )}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Start date
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => setDraft((current) => ({ ...current, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                End date
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => setDraft((current) => ({ ...current, end_date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Playable weekdays
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day.value}
                    className={[
                      'inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold',
                      draft.playable_weekdays.includes(day.value)
                        ? 'border-tm-orange bg-orange-50 text-orange-900 dark:border-tm-orange dark:bg-orange-950/20 dark:text-orange-200'
                        : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={draft.playable_weekdays.includes(day.value)}
                      onChange={() => toggleWeekday(day.value)}
                      className="sr-only"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Venue mode
                <select
                  value={draft.venue_mode}
                  onChange={(e) => setDraft((current) => ({ ...current, venue_mode: e.target.value as LeagueVenueMode }))}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="neutral_venues">Neutral tournament venues</option>
                  <option value="home_team_venues">Home-team venues</option>
                  <option value="mixed">Home venue, then neutral fallback</option>
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max games per team per week
                <input
                  type="number"
                  min={1}
                  value={draft.max_games_per_team_per_week}
                  onChange={(e) => setDraft((current) => ({ ...current, max_games_per_team_per_week: e.target.value }))}
                  placeholder="No preference"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Minimum gap between games (min)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.min_gap_minutes}
                  onChange={(e) => setDraft((current) => ({ ...current, min_gap_minutes: e.target.value }))}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Changeover time for teams and umpires to leave and set up.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.prefer_round_order}
                  onChange={(e) => setDraft((current) => ({ ...current, prefer_round_order: e.target.checked }))}
                />
                Prefer round order
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.prefer_home_away_balance}
                  onChange={(e) => setDraft((current) => ({ ...current, prefer_home_away_balance: e.target.checked }))}
                />
                Prefer home/away balance
              </label>
            </div>
          </div>

          <aside className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 lg:w-72">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Planning summary
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Division</dt>
                <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-50">{selectedDivision?.name ?? 'None'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Playable dates</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">{playableDates.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Slots available
                  {matchDurationEstimate > 0 && (
                    <span className="block text-[10px] font-normal text-zinc-400">
                      {matchDurationEstimate}-min games · {minGap}-min gap
                    </span>
                  )}
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">{totalSlots}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Unplanned</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">{unplannedMatches.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Planned</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-50">{plannedMatches.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Pending</dt>
                <dd className={pending.size > 0 ? 'font-semibold text-tm-orange' : 'font-semibold text-zinc-900 dark:text-zinc-50'}>
                  {pending.size}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Conflicts</dt>
                <dd className={sameDayConflictIds.size > 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                  {sameDayConflictIds.size}
                </dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving || loading || !selectedPhaseId}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
              <button
                type="button"
                onClick={runPlanner}
                disabled={planning || saving || loading || !selectedPhaseId || unplannedMatches.length === 0}
                className="w-full rounded-md bg-tm-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tm-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {planning ? 'Planning...' : `Auto-plan ${unplannedMatches.length} fixture${unplannedMatches.length === 1 ? '' : 's'}`}
              </button>
              <p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                Auto-plan and drag-and-drop stage changes. Review them on the calendar, then confirm to save.
              </p>
              <button
                type="button"
                onClick={() => setUnplanAllOpen(true)}
                disabled={committing || loading || scheduledUnplayedCount === 0}
                className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
              >
                Unplan all ({scheduledUnplayedCount})
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Venues &amp; courts
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Tweak each venue&apos;s available hours and number of courts/pitches the scheduler can use.
            </p>
          </div>
          <button
            type="button"
            onClick={saveVenues}
            disabled={savingVenues || loading || venueDrafts.length === 0}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {savingVenues ? 'Saving...' : 'Save venues'}
          </button>
        </div>

        {venueDrafts.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No venues yet. Add venues on the tournament&apos;s General page first.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {venueDrafts.map((venue) => (
              <div
                key={venue.id}
                className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_8rem_7rem]">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {venue.name}
                  </div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Available from
                    <input
                      type="time"
                      value={venue.available_from}
                      onChange={(e) => updateVenueDraft(venue.id, { available_from: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Available to
                    <input
                      type="time"
                      value={venue.available_to}
                      onChange={(e) => updateVenueDraft(venue.id, { available_to: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Courts
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={venue.court_count}
                      onChange={(e) => updateVenueDraft(venue.id, { court_count: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Open on{' '}
                    {venue.playable_weekdays.length === 0 && (
                      <span className="font-normal">(all playable days)</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {WEEKDAYS.map((day) => {
                      const active = venue.playable_weekdays.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleVenueWeekday(venue.id, day.value)}
                          className={[
                            'rounded-md border px-2 py-1 text-[11px] font-semibold',
                            active
                              ? 'border-tm-orange bg-orange-50 text-orange-900 dark:border-tm-orange dark:bg-orange-950/20 dark:text-orange-200'
                              : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
                          ].join(' ')}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pending.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-lg border border-tm-orange bg-orange-50 p-3 shadow-sm dark:border-tm-orange dark:bg-orange-950/30 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
            {pending.size} unsaved change{pending.size === 1 ? '' : 's'} staged
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discardPending}
              disabled={committing}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={confirmPending}
              disabled={committing}
              className="rounded-md bg-tm-orange px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-tm-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {committing ? 'Saving...' : `Confirm ${pending.size} change${pending.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Calendar
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Drag fixtures onto a playable day to schedule them. Greyed days are not playable
                {knockoutEarliest === 'blocked'
                  ? ' — schedule the league phase before placing knockout fixtures.'
                  : typeof knockoutEarliest === 'string'
                    ? ' or fall before the league phase finishes.'
                    : '.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, -1))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              <span className="min-w-28 text-center text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {new Date(`${month}-01T12:00:00.000Z`).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'Europe/London',
                })}
              </span>
              <button
                type="button"
                onClick={() => setMonth((current) => addMonths(current, 1))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 gap-1 pb-1">
                {WEEKDAY_HEADERS.map((label) => (
                  <div key={label} className="text-center text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {label}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {calendarWeeks.map((week) => (
                  <div key={week[0].date} className="grid grid-cols-7 gap-1">
                    {week.map((cell) => (
                      <CalendarDayCell
                        key={cell.date}
                        date={cell.date}
                        inMonth={cell.inMonth}
                        droppable={isDroppableDate(cell.date)}
                      >
                        {(matchesByDateMap.get(cell.date) ?? []).map((match) => (
                          <FixtureChip
                            key={match.id}
                            matchId={match.id}
                            label={`${teamName(match.home_team_id)} v ${teamName(match.away_team_id)}`}
                            time={formatKickoffTime(match.kickoff_time)}
                            court={match.court}
                            locked={match.status === 'completed'}
                            badge={match.status === 'completed' ? 'FT' : undefined}
                            onEdit={
                              match.status === 'completed'
                                ? undefined
                                : () => setEditingMatchId(match.id)
                            }
                            tone={
                              sameDayConflictIds.has(match.id)
                                ? 'conflict'
                                : pending.get(match.id)?.kind === 'place'
                                  ? 'pending'
                                  : 'planned'
                            }
                          />
                        ))}
                        {(contextMatchesByDate.get(cell.date) ?? []).map((ctx) => (
                          <FixtureChip
                            key={`ctx-${ctx.id}`}
                            matchId={ctx.id}
                            label={ctx.label}
                            time={ctx.time}
                            court={ctx.court}
                            tone="planned"
                            locked
                            badge={ctx.badge}
                          />
                        ))}
                      </CalendarDayCell>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <UnplannedTray empty={unplannedMatches.length === 0}>
          {unplannedByRound.map((group) => (
            <div
              key={group.round ?? 'tbc'}
              className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
            >
              <header className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {group.round ? `Round ${group.round}` : 'Round TBC'}
                </p>
              </header>
              <ul className="space-y-1 p-2">
                {group.matches.map((match) => (
                  <li key={match.id}>
                    <FixtureChip
                      matchId={match.id}
                      label={`${teamName(match.home_team_id)} v ${teamName(match.away_team_id)}`}
                      tone="tray"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </UnplannedTray>

        <DragOverlay>
          {activeMatch ? (
            <div className="rounded-md border border-tm-orange bg-white px-2 py-1 text-xs font-semibold text-zinc-900 shadow-lg dark:bg-zinc-900 dark:text-zinc-50">
              {teamName(activeMatch.home_team_id)} v {teamName(activeMatch.away_team_id)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingMatch && (
        <FixtureEditDialog
          key={editingMatch.id}
          label={`${teamName(editingMatch.home_team_id)} v ${teamName(editingMatch.away_team_id)}`}
          match={editingMatch}
          courtOptions={courtOptions}
          onSave={(date, time, court) => saveFixtureEdit(editingMatch.id, date, time, court)}
          onUnplan={() => {
            stageUnplan(editingMatch)
            setEditingMatchId(null)
          }}
          onCancel={() => setEditingMatchId(null)}
        />
      )}

      {unplanAllOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !unplanningAll) setUnplanAllOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Unschedule all fixtures?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              This returns <span className="font-semibold">{scheduledUnplayedCount}</span> unplayed
              fixture{scheduledUnplayedCount === 1 ? '' : 's'} to the unplanned list. Played (completed)
              games keep their result and stay scheduled. This happens immediately and can&apos;t be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setUnplanAllOpen(false)}
                disabled={unplanningAll}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={unplanAll}
                disabled={unplanningAll}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {unplanningAll ? 'Unscheduling...' : 'Unplan all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface FixtureChipProps {
  matchId: string
  label: string
  time?: string
  court?: string | null
  tone: 'planned' | 'pending' | 'conflict' | 'tray'
  locked?: boolean
  badge?: string
  onEdit?: () => void
}

function FixtureChip({ matchId, label, time, court, tone, locked = false, badge, onEdit }: FixtureChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `match:${matchId}`,
    disabled: locked,
  })
  const toneClass = locked
    ? 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400'
    : tone === 'conflict'
      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
      : tone === 'pending'
        ? 'border-tm-orange bg-orange-50 text-orange-900 dark:border-tm-orange dark:bg-orange-950/30 dark:text-orange-100'
        : 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const editable = !locked && Boolean(onEdit)

  return (
    <div
      ref={setNodeRef}
      {...(locked ? {} : listeners)}
      {...attributes}
      onClick={editable ? onEdit : undefined}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={[
        'rounded-md border px-1.5 py-1 text-[11px] leading-tight shadow-sm',
        locked ? 'cursor-default' : 'cursor-grab touch-none active:cursor-grabbing',
        editable ? 'hover:ring-1 hover:ring-tm-orange' : '',
        toneClass,
      ].join(' ')}
    >
      {time && <span className="mr-1 font-bold tabular-nums">{time}</span>}
      <span className="font-semibold">{label}</span>
      {badge && (
        <span className="ml-1 inline-block max-w-[6rem] truncate rounded bg-zinc-300 px-1 align-middle text-[9px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          {badge}
        </span>
      )}
      {court && <span className="mt-0.5 block truncate text-[10px] opacity-70">{court}</span>}
    </div>
  )
}

interface CalendarDayCellProps {
  date: string
  inMonth: boolean
  droppable: boolean
  children: ReactNode
}

function CalendarDayCell({ date, inMonth, droppable, children }: CalendarDayCellProps) {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${date}`, disabled: !droppable })
  const dayNumber = Number(date.slice(8, 10))
  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-[5.5rem] rounded-md border p-1 align-top',
        droppable
          ? 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
          : 'border-zinc-100 bg-zinc-100/70 dark:border-zinc-900 dark:bg-zinc-900/40',
        !inMonth ? 'opacity-50' : '',
        isOver && droppable ? 'ring-2 ring-tm-orange' : '',
      ].join(' ')}
    >
      <div
        className={`text-right text-[11px] font-semibold ${
          droppable ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600'
        }`}
      >
        {dayNumber}
      </div>
      <div className="mt-0.5 space-y-1">{children}</div>
    </div>
  )
}

function UnplannedTray({ empty, children }: { empty: boolean; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'tray' })
  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border bg-white p-4 shadow-sm dark:bg-zinc-950 ${
        isOver
          ? 'border-tm-orange ring-2 ring-tm-orange'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
        Unplanned fixtures
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Drag a fixture onto the calendar to schedule it, or drop one here to unschedule it.
      </p>
      {empty ? (
        <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No unplanned fixtures for this phase.
        </p>
      ) : (
        <div className="mt-3 space-y-3">{children}</div>
      )}
    </section>
  )
}

interface FixtureEditDialogProps {
  match: Match
  label: string
  courtOptions: string[]
  onSave: (date: string, time: string, court: string) => void
  onUnplan: () => void
  onCancel: () => void
}

function FixtureEditDialog({ match, label, courtOptions, onSave, onUnplan, onCancel }: FixtureEditDialogProps) {
  const [date, setDate] = useState(() => londonDateKey(match.kickoff_time))
  const [time, setTime] = useState(() => getLondonTimeHHmm(match.kickoff_time))
  const [court, setCourt] = useState(() => match.court ?? '')

  const options = useMemo(() => {
    const list = [...courtOptions]
    if (match.court && !list.includes(match.court)) list.unshift(match.court)
    return list
  }, [courtOptions, match.court])

  const inputClass =
    'mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-tm-orange focus:outline-none focus:ring-1 focus:ring-tm-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-tm-orange">
            Fine-tune fixture
          </p>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{label}</h2>
        </header>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Venue / court
            <select value={court} onChange={(e) => setCourt(e.target.value)} className={inputClass}>
              <option value="">— Venue TBC —</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Changes are staged. Review them on the calendar, then confirm to save.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onUnplan}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Unschedule
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(date, time, court)}
              className="rounded-md bg-tm-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tm-orange-dark"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
