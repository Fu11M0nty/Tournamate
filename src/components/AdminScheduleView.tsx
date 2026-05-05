'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { regenerateUnplannedFixtures } from '@/lib/actions'
import {
  buildIsoFromLondonTime,
  formatKickoffTime,
  getLondonTimeHHmm,
} from '@/lib/time'
import CourtsManager from './CourtsManager'
import {
  autoPlan,
  type AutoPlanCourt,
  type AutoPlanLock,
  type AutoPlanMatch,
} from '@/lib/autoPlan'
import type { AgeGroup, Court, Day, Match, Team, Tournament } from '@/lib/types'

const DEFAULT_DAY_START_MIN = 8 * 60 // 08:00
const DEFAULT_DAY_END_MIN = 17 * 60 // 17:00
const SLOT_MINUTES = 5
const SLOT_PX = 20
const COLUMN_WIDTH_PX = 200
const DEFAULT_BACK_TO_BACK_MIN = 20
const BACK_TO_BACK_KEY = 'mk-admin-b2b-minutes'

interface ColorTheme {
  bg: string
  bgDark: string
  border: string
  text: string
  textDark: string
  dot: string
}

const AGE_GROUP_PALETTE: ColorTheme[] = [
  {
    bg: 'bg-sky-100',
    bgDark: 'dark:bg-sky-950/60',
    border: 'border-sky-400 dark:border-sky-700',
    text: 'text-sky-900',
    textDark: 'dark:text-sky-200',
    dot: 'bg-sky-500',
  },
  {
    bg: 'bg-amber-100',
    bgDark: 'dark:bg-amber-950/60',
    border: 'border-amber-400 dark:border-amber-700',
    text: 'text-amber-900',
    textDark: 'dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  {
    bg: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/60',
    border: 'border-emerald-400 dark:border-emerald-700',
    text: 'text-emerald-900',
    textDark: 'dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-violet-100',
    bgDark: 'dark:bg-violet-950/60',
    border: 'border-violet-400 dark:border-violet-700',
    text: 'text-violet-900',
    textDark: 'dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  {
    bg: 'bg-rose-100',
    bgDark: 'dark:bg-rose-950/60',
    border: 'border-rose-400 dark:border-rose-700',
    text: 'text-rose-900',
    textDark: 'dark:text-rose-200',
    dot: 'bg-rose-500',
  },
  {
    bg: 'bg-cyan-100',
    bgDark: 'dark:bg-cyan-950/60',
    border: 'border-cyan-400 dark:border-cyan-700',
    text: 'text-cyan-900',
    textDark: 'dark:text-cyan-200',
    dot: 'bg-cyan-500',
  },
  {
    bg: 'bg-fuchsia-100',
    bgDark: 'dark:bg-fuchsia-950/60',
    border: 'border-fuchsia-400 dark:border-fuchsia-700',
    text: 'text-fuchsia-900',
    textDark: 'dark:text-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
  {
    bg: 'bg-lime-100',
    bgDark: 'dark:bg-lime-950/60',
    border: 'border-lime-400 dark:border-lime-700',
    text: 'text-lime-900',
    textDark: 'dark:text-lime-200',
    dot: 'bg-lime-500',
  },
]

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function slotIndexFromIso(iso: string, gridStartMin: number, totalSlots: number): number {
  const hhmm = getLondonTimeHHmm(iso)
  const minutes = hhmmToMinutes(hhmm)
  const idx = Math.floor((minutes - gridStartMin) / SLOT_MINUTES)
  return Math.max(0, Math.min(totalSlots - 1, idx))
}

function minutesFromIso(iso: string): number {
  return hhmmToMinutes(getLondonTimeHHmm(iso))
}

function hhmmFromSlotIndex(idx: number, gridStartMin: number): string {
  return minutesToHHMM(gridStartMin + idx * SLOT_MINUTES)
}

function dateForDay(t: Tournament, day: Day): string | null {
  if (day === 'saturday') return t.start_date
  return t.end_date ?? t.start_date
}

interface AdminScheduleViewProps {
  tournament: Tournament
  ageGroups: AgeGroup[]
  onClose: () => void
  onTournamentChanged: () => void
}

interface MatchWithMeta extends Match {
  homeName: string
  awayName: string
  groupName: string
  groupDay: Day
  groupColor: ColorTheme
}

interface LaneAssignment {
  lane: number
  totalLanes: number
}

function assignLanes(
  matches: MatchWithMeta[]
): Map<string, LaneAssignment> {
  // For each court, sweep by start time; find first lane that's free.
  const result = new Map<string, LaneAssignment>()
  const sorted = [...matches].sort((a, b) => {
    const aStart = a.kickoff_time ? minutesFromIso(a.kickoff_time) : 0
    const bStart = b.kickoff_time ? minutesFromIso(b.kickoff_time) : 0
    return aStart - bStart
  })

  let cluster: { match: MatchWithMeta; start: number; end: number }[] = []
  let clusterMaxEnd = -1

  function flushCluster() {
    if (cluster.length === 0) return
    const laneEnds: number[] = []
    const laneAssignments: number[] = []
    for (const c of cluster) {
      let lane = laneEnds.findIndex((end) => end <= c.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(c.end)
      } else {
        laneEnds[lane] = c.end
      }
      laneAssignments.push(lane)
    }
    const totalLanes = laneEnds.length
    cluster.forEach((c, i) => {
      result.set(c.match.id, { lane: laneAssignments[i], totalLanes })
    })
    cluster = []
    clusterMaxEnd = -1
  }

  for (const m of sorted) {
    if (!m.kickoff_time) continue
    const start = minutesFromIso(m.kickoff_time)
    const end = start + Math.max(m.duration_minutes, 1)
    if (cluster.length === 0) {
      cluster = [{ match: m, start, end }]
      clusterMaxEnd = end
      continue
    }
    if (start >= clusterMaxEnd) {
      flushCluster()
      cluster = [{ match: m, start, end }]
      clusterMaxEnd = end
      continue
    }
    cluster.push({ match: m, start, end })
    clusterMaxEnd = Math.max(clusterMaxEnd, end)
  }
  flushCluster()
  return result
}

export default function AdminScheduleView({
  tournament,
  ageGroups,
  onClose,
  onTournamentChanged,
}: AdminScheduleViewProps) {
  const supabase = createClient()
  const [day, setDay] = useState<Day>('saturday')
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCourtsEditor, setShowCourtsEditor] = useState(false)
  const [savingLock, setSavingLock] = useState(false)
  const [unplannedFilter, setUnplannedFilter] = useState<string>('all')
  const [backToBackMin, setBackToBackMin] = useState<number>(
    DEFAULT_BACK_TO_BACK_MIN
  )
  const [b2bLoaded, setB2bLoaded] = useState(false)
  const [previewPlacements, setPreviewPlacements] = useState<
    Map<string, { court: string; kickoff_time: string }>
  >(new Map())
  const [previewStats, setPreviewStats] = useState<{
    placed: number
    totalUnplanned: number
    earliestStart: number | null
    latestEnd: number | null
  } | null>(null)
  const [planning, setPlanning] = useState(false)
  const [savingPreview, setSavingPreview] = useState(false)
  const [unplanningAll, setUnplanningAll] = useState(false)
  const [showAutoPlanDialog, setShowAutoPlanDialog] = useState(false)
  const [autoPlanGroupId, setAutoPlanGroupId] = useState<string>('all')
  const [autoPlanCourtNames, setAutoPlanCourtNames] = useState<Set<string>>(
    () => new Set()
  )
  const [showUnplanDialog, setShowUnplanDialog] = useState(false)
  const [unplanGroupIds, setUnplanGroupIds] = useState<Set<string>>(() => new Set())
  const [regeneratingGroupId, setRegeneratingGroupId] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const isPreviewMode = previewPlacements.size > 0

  const toggleSelected = useCallback((id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (additive) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else {
        if (next.size === 1 && next.has(id)) {
          next.clear()
        } else {
          next.clear()
          next.add(id)
        }
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      setB2bLoaded(true)
      return
    }
    try {
      const stored = window.localStorage.getItem(BACK_TO_BACK_KEY)
      if (stored !== null) {
        const n = Number(stored)
        if (Number.isFinite(n) && n >= 0) setBackToBackMin(n)
      }
    } catch {
      // ignore quota / unavailable storage errors
    }
    setB2bLoaded(true)
  }, [])

  useEffect(() => {
    if (!b2bLoaded) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(BACK_TO_BACK_KEY, String(backToBackMin))
    } catch {
      // ignore
    }
  }, [backToBackMin, b2bLoaded])

  const ageGroupIds = useMemo(() => ageGroups.map((g) => g.id), [ageGroups])

  // Stable color map keyed by age group id.
  const groupColorMap = useMemo(() => {
    const map = new Map<string, ColorTheme>()
    const sorted = [...ageGroups].sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.display_order - b.display_order ||
        a.name.localeCompare(b.name)
    )
    sorted.forEach((g, i) => {
      map.set(g.id, AGE_GROUP_PALETTE[i % AGE_GROUP_PALETTE.length])
    })
    return map
  }, [ageGroups])

  const groupById = useMemo(() => {
    const m = new Map<string, AgeGroup>()
    for (const g of ageGroups) m.set(g.id, g)
    return m
  }, [ageGroups])

  const teamById = useMemo(() => {
    const m = new Map<string, Team>()
    for (const t of teams) m.set(t.id, t)
    return m
  }, [teams])

  const load = useCallback(async () => {
    if (ageGroupIds.length === 0) {
      setMatches([])
      setTeams([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [m, t] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .in('age_group_id', ageGroupIds)
        .is('deleted_at', null),
      supabase
        .from('teams')
        .select('*')
        .in('age_group_id', ageGroupIds)
        .is('deleted_at', null),
    ])
    if (m.error) toast.error(`Could not load matches: ${m.error.message}`)
    if (t.error) toast.error(`Could not load teams: ${t.error.message}`)
    setMatches((m.data ?? []) as Match[])
    setTeams((t.data ?? []) as Team[])
    setLoading(false)
  }, [supabase, ageGroupIds])

  useEffect(() => {
    load()
  }, [load])

  const loadCourts = useCallback(async () => {
    const { data, error } = await supabase
      .from('courts')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('display_order', { ascending: true })
    if (error) {
      toast.error(`Could not load courts: ${error.message}`)
      return
    }
    setCourts((data ?? []) as Court[])
  }, [supabase, tournament.id])

  useEffect(() => {
    loadCourts()
  }, [loadCourts])

  // Sorted courts in display order, scoped to the currently-selected day.
  // Falls back to legacy tournament.courts text[] (08:00–17:00) when the
  // courts table has nothing configured for this day yet.
  const sortedCourts: Court[] = useMemo(() => {
    const dayCourts = courts.filter((c) => c.day === day)
    if (dayCourts.length > 0) {
      return [...dayCourts].sort(
        (a, b) =>
          a.display_order - b.display_order || a.name.localeCompare(b.name)
      )
    }
    const fallback =
      tournament.courts.length > 0
        ? tournament.courts
        : ['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5']
    return fallback.map((name, i) => ({
      id: `legacy-${name}`,
      tournament_id: tournament.id,
      name,
      day,
      display_order: i + 1,
      start_time: '08:00',
      end_time: '17:00',
    }))
  }, [courts, day, tournament.courts, tournament.id])

  // Dynamic grid bounds — fit the configured courts. Round to 30-min ticks
  // so the time-axis labels line up. A 5-min buffer is added at each end so
  // the first and last hour labels aren't clipped by the column header /
  // bottom edge. Defaults only kick in when no courts.
  const gridStartMin = useMemo(() => {
    if (sortedCourts.length === 0) return DEFAULT_DAY_START_MIN - SLOT_MINUTES
    const earliest = Math.min(
      ...sortedCourts.map((c) => hhmmToMinutes(c.start_time))
    )
    return Math.floor(earliest / 30) * 30 - SLOT_MINUTES
  }, [sortedCourts])

  const gridEndMin = useMemo(() => {
    if (sortedCourts.length === 0) return DEFAULT_DAY_END_MIN + SLOT_MINUTES
    const latest = Math.max(
      ...sortedCourts.map((c) => hhmmToMinutes(c.end_time))
    )
    return Math.ceil(latest / 30) * 30 + SLOT_MINUTES
  }, [sortedCourts])

  const totalSlots = Math.max(
    1,
    Math.ceil((gridEndMin - gridStartMin) / SLOT_MINUTES)
  )

  const enriched: MatchWithMeta[] = useMemo(() => {
    return matches
      .map((m) => {
        const g = groupById.get(m.age_group_id)
        const home = teamById.get(m.home_team_id)
        const away = teamById.get(m.away_team_id)
        if (!g || !home || !away) return null
        return {
          ...m,
          homeName: home.name,
          awayName: away.name,
          groupName: g.name,
          groupDay: g.day,
          groupColor:
            groupColorMap.get(g.id) ?? AGE_GROUP_PALETTE[0],
        }
      })
      .filter((m): m is MatchWithMeta => m !== null)
      .filter((m) => m.groupDay === day)
  }, [matches, groupById, teamById, groupColorMap, day])

  const planned = useMemo(
    () => enriched.filter((m) => m.is_planned && m.kickoff_time),
    [enriched]
  )
  const unplanned = useMemo(
    () => enriched.filter((m) => !m.is_planned),
    [enriched]
  )

  // When previewing an auto-plan, overlay the preview placements on top of the
  // DB state. Unplanned matches that the algorithm placed appear at their
  // proposed (court, kickoff_time); locked matches stay where they are.
  const effectivePlanned: MatchWithMeta[] = useMemo(() => {
    if (!isPreviewMode) return planned
    const promoted: MatchWithMeta[] = []
    for (const m of unplanned) {
      const p = previewPlacements.get(m.id)
      if (!p) continue
      promoted.push({
        ...m,
        is_planned: true,
        court: p.court,
        kickoff_time: p.kickoff_time,
      })
    }
    return [...planned, ...promoted]
  }, [isPreviewMode, planned, unplanned, previewPlacements])

  const effectiveUnplanned: MatchWithMeta[] = useMemo(() => {
    if (!isPreviewMode) return unplanned
    return unplanned.filter((m) => !previewPlacements.has(m.id))
  }, [isPreviewMode, unplanned, previewPlacements])

  // Court clash: same (court, kickoff_time) on this day appears in 2+ matches.
  const courtClashIds = useMemo(() => {
    const byKey = new Map<string, string[]>()
    for (const m of effectivePlanned) {
      if (!m.court || !m.kickoff_time) continue
      const key = `${m.court}|${m.kickoff_time}`
      const arr = byKey.get(key) ?? []
      arr.push(m.id)
      byKey.set(key, arr)
    }
    const out = new Set<string>()
    for (const arr of byKey.values()) {
      if (arr.length > 1) arr.forEach((id) => out.add(id))
    }
    return out
  }, [effectivePlanned])

  // Back-to-back: same team in two matches with start-to-start gap < threshold.
  const backToBackIds = useMemo(() => {
    if (backToBackMin <= 0) return new Set<string>()
    const byTeam = new Map<string, MatchWithMeta[]>()
    for (const m of effectivePlanned) {
      for (const tid of [m.home_team_id, m.away_team_id]) {
        const arr = byTeam.get(tid) ?? []
        arr.push(m)
        byTeam.set(tid, arr)
      }
    }
    const flagged = new Set<string>()
    for (const list of byTeam.values()) {
      const sorted = [...list].sort((a, b) => {
        const aT = a.kickoff_time ? minutesFromIso(a.kickoff_time) : 0
        const bT = b.kickoff_time ? minutesFromIso(b.kickoff_time) : 0
        return aT - bT
      })
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        if (!prev.kickoff_time || !curr.kickoff_time) continue
        const gap =
          minutesFromIso(curr.kickoff_time) - minutesFromIso(prev.kickoff_time)
        if (gap >= 0 && gap < backToBackMin) {
          flagged.add(prev.id)
          flagged.add(curr.id)
        }
      }
    }
    return flagged
  }, [effectivePlanned, backToBackMin])

  // Filter unplanned matches by chosen age group.
  const filteredUnplanned = useMemo(() => {
    if (unplannedFilter === 'all') return effectiveUnplanned
    return effectiveUnplanned.filter((m) => m.age_group_id === unplannedFilter)
  }, [effectiveUnplanned, unplannedFilter])

  // Reset filter to "all" if the selected group disappears from the day.
  useEffect(() => {
    if (unplannedFilter === 'all') return
    const stillVisible = effectiveUnplanned.some(
      (m) => m.age_group_id === unplannedFilter
    )
    if (!stillVisible) setUnplannedFilter('all')
  }, [effectiveUnplanned, unplannedFilter])

  // Age groups that have at least one unplanned match for this day.
  const unplannedGroupOptions = useMemo(() => {
    const ids = new Set(effectiveUnplanned.map((m) => m.age_group_id))
    return ageGroups
      .filter((g) => ids.has(g.id))
      .filter((g) => g.day === day)
      .sort((a, b) => a.display_order - b.display_order)
  }, [effectiveUnplanned, ageGroups, day])

  // Age groups that have at least one planned match for this day.
  const plannedGroupOptions = useMemo(() => {
    const ids = new Set(planned.map((m) => m.age_group_id))
    return ageGroups
      .filter((g) => ids.has(g.id))
      .filter((g) => g.day === day)
      .sort((a, b) => a.display_order - b.display_order)
  }, [planned, ageGroups, day])

  // Lane assignments per court.
  const lanesByCourt = useMemo(() => {
    const map = new Map<string, Map<string, LaneAssignment>>()
    for (const court of sortedCourts) {
      const courtMatches = effectivePlanned.filter(
        (m) => m.court === court.name
      )
      map.set(court.name, assignLanes(courtMatches))
    }
    return map
  }, [effectivePlanned, sortedCourts])

  // Map court name → its window in minutes (for grey-out + drop validation).
  const courtWindowByName = useMemo(() => {
    const m = new Map<string, { startMin: number; endMin: number }>()
    for (const c of sortedCourts) {
      m.set(c.name, {
        startMin: hhmmToMinutes(c.start_time),
        endMin: hhmmToMinutes(c.end_time),
      })
    }
    return m
  }, [sortedCourts])

  // Legend: only show age groups that have at least one match this day.
  const legend = useMemo(() => {
    const ids = new Set(enriched.map((m) => m.age_group_id))
    return ageGroups
      .filter((g) => ids.has(g.id))
      .filter((g) => g.day === day)
      .sort((a, b) => a.display_order - b.display_order)
  }, [ageGroups, enriched, day])

  const activeMatch = activeId
    ? enriched.find((m) => m.id === activeId) ?? null
    : null

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (tournament.schedule_locked) {
      toast.error('Schedule is locked')
      return
    }
    const { active, over } = event
    if (!over) return
    const matchId = active.id as string
    const match = enriched.find((m) => m.id === matchId)
    if (!match) return

    const overId = over.id as string

    // Determine the moving group: if the dragged match is part of an active
    // selection (>1), move all selected planned-or-unplanned matches together.
    // Otherwise just move the dragged match.
    const isGroupMove = selectedIds.size > 1 && selectedIds.has(matchId)
    const groupIds = isGroupMove ? Array.from(selectedIds) : [matchId]
    const groupMatches = groupIds
      .map((id) => enriched.find((m) => m.id === id))
      .filter((m): m is MatchWithMeta => Boolean(m))

    // Preview mode: manipulate preview map only, no DB writes.
    if (isPreviewMode) {
      const anyDbLocked = groupMatches.some(
        (m) => m.is_planned && !previewPlacements.has(m.id)
      )
      if (anyDbLocked) {
        toast.error(
          'Locked match — cancel the preview to manually move it.'
        )
        return
      }
      if (overId === 'unplanned') {
        const next = new Map(previewPlacements)
        for (const m of groupMatches) next.delete(m.id)
        setPreviewPlacements(next)
        return
      }
      if (overId.startsWith('slot:')) {
        const [, courtName, slotIdxStr] = overId.split(':')
        const slotIdx = Number(slotIdxStr)
        if (!courtName || Number.isNaN(slotIdx)) return
        const targetMin = gridStartMin + slotIdx * SLOT_MINUTES

        const placements = computeGroupPlacements(
          match,
          groupMatches,
          isGroupMove,
          courtName,
          targetMin
        )
        if (!placements) return
        const next = new Map(previewPlacements)
        for (const p of placements) {
          next.set(p.id, { court: p.court, kickoff_time: p.kickoff_time })
        }
        setPreviewPlacements(next)
      }
      return
    }

    if (overId === 'unplanned') {
      const ids = groupMatches.filter((m) => m.is_planned).map((m) => m.id)
      if (ids.length === 0) return
      const { error, data } = await supabase
        .from('matches')
        .update({ is_planned: false })
        .in('id', ids)
        .select('id')
      if (error) {
        toast.error(`Could not unplan: ${error.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Update blocked by RLS')
        return
      }
      await load()
      return
    }

    if (overId.startsWith('slot:')) {
      const [, courtName, slotIdxStr] = overId.split(':')
      const slotIdx = Number(slotIdxStr)
      if (!courtName || Number.isNaN(slotIdx)) return
      const targetMin = gridStartMin + slotIdx * SLOT_MINUTES

      const placements = computeGroupPlacements(
        match,
        groupMatches,
        isGroupMove,
        courtName,
        targetMin
      )
      if (!placements) return

      const updates = await Promise.all(
        placements.map((p) =>
          supabase
            .from('matches')
            .update({
              is_planned: true,
              court: p.court,
              kickoff_time: p.kickoff_time,
            })
            .eq('id', p.id)
            .select('id')
        )
      )
      const firstErr = updates.find((r) => r.error)
      if (firstErr?.error) {
        toast.error(`Could not move: ${firstErr.error.message}`)
        return
      }
      const blocked = updates.find((r) => !r.data || r.data.length === 0)
      if (blocked) {
        toast.error('Update blocked by RLS')
        return
      }
      await load()
    }
  }

  // Build (id, court, kickoff_time) for either a single match or the whole
  // selection. For group moves, the dragged "anchor" is placed at the target
  // slot; every other selected match shifts by the same time delta and keeps
  // its own court (or, if previously unplanned, lands on the target court).
  // Returns null and toasts if any placement falls outside its court window.
  function computeGroupPlacements(
    anchor: MatchWithMeta,
    members: MatchWithMeta[],
    isGroupMove: boolean,
    targetCourt: string,
    targetStartMin: number
  ): Array<{ id: string; court: string; kickoff_time: string }> | null {
    const baseDate = dateForDay(tournament, day)
    const baseIso = baseDate
      ? `${baseDate}T08:00:00.000Z`
      : new Date().toISOString()

    function placementFor(
      m: MatchWithMeta,
      court: string,
      startMin: number
    ): { id: string; court: string; kickoff_time: string } | null {
      const window = courtWindowByName.get(court)
      const endMin = startMin + Math.max(m.duration_minutes, SLOT_MINUTES)
      if (window) {
        if (startMin < window.startMin || endMin > window.endMin) {
          toast.error(
            `${court} is only available ${minutesToHHMM(window.startMin)}–${minutesToHHMM(window.endMin)} — selection doesn't fit`
          )
          return null
        }
      }
      const hhmm = minutesToHHMM(startMin)
      return {
        id: m.id,
        court,
        kickoff_time: buildIsoFromLondonTime(baseIso, hhmm),
      }
    }

    if (!isGroupMove) {
      const p = placementFor(anchor, targetCourt, targetStartMin)
      return p ? [p] : null
    }

    const anchorPrevMin =
      anchor.is_planned && anchor.kickoff_time
        ? minutesFromIso(anchor.kickoff_time)
        : null
    const delta =
      anchorPrevMin !== null ? targetStartMin - anchorPrevMin : null

    const result: Array<{ id: string; court: string; kickoff_time: string }> = []
    for (const m of members) {
      let court: string
      let startMin: number
      if (m.id === anchor.id) {
        court = targetCourt
        startMin = targetStartMin
      } else if (m.is_planned && m.kickoff_time && m.court && delta !== null) {
        court = m.court
        startMin = minutesFromIso(m.kickoff_time) + delta
      } else {
        // Unplanned member or no anchor delta — drop it on the target slot.
        court = targetCourt
        startMin = targetStartMin
      }
      const p = placementFor(m, court, startMin)
      if (!p) return null
      result.push(p)
    }
    return result
  }

  async function handleToggleLock() {
    setSavingLock(true)
    const { error, data } = await supabase
      .from('tournaments')
      .update({ schedule_locked: !tournament.schedule_locked })
      .eq('id', tournament.id)
      .select()
    setSavingLock(false)
    if (error) {
      toast.error(`Could not change lock: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error('Update blocked by RLS')
      return
    }
    toast.success(
      tournament.schedule_locked ? 'Schedule unlocked' : 'Schedule locked'
    )
    onTournamentChanged()
  }

  function clearPreview() {
    setPreviewPlacements(new Map())
    setPreviewStats(null)
  }

  function openAutoPlanDialog() {
    if (tournament.schedule_locked) {
      toast.error('Schedule is locked')
      return
    }
    if (sortedCourts.length === 0) {
      toast.error('No courts configured for this day')
      return
    }
    if (unplanned.length === 0) {
      toast.error('No unplanned matches to place')
      return
    }
    setAutoPlanGroupId('all')
    setAutoPlanCourtNames(new Set(sortedCourts.map((c) => c.name)))
    setShowAutoPlanDialog(true)
  }

  function runAutoPlan(groupFilter: string, courtFilter: Set<string>) {
    const baseDate = dateForDay(tournament, day)
    if (!baseDate) {
      toast.error('Tournament has no start date set')
      return false
    }
    const filteredCourts = sortedCourts.filter((c) => courtFilter.has(c.name))
    if (filteredCourts.length === 0) {
      toast.error('Select at least one court')
      return false
    }
    const filteredUnplanned =
      groupFilter === 'all'
        ? unplanned
        : unplanned.filter((m) => m.age_group_id === groupFilter)
    if (filteredUnplanned.length === 0) {
      toast.error('No unplanned matches in that group')
      return false
    }

    setPlanning(true)
    try {
      const courtsInput: AutoPlanCourt[] = filteredCourts.map((c) => ({
        name: c.name,
        startMin: hhmmToMinutes(c.start_time),
        endMin: hhmmToMinutes(c.end_time),
      }))
      const matchesInput: AutoPlanMatch[] = filteredUnplanned.map((m) => ({
        id: m.id,
        ageGroupId: m.age_group_id,
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        durationMinutes: m.duration_minutes,
      }))
      // All currently-planned matches across the day act as locks. Locks on
      // non-selected courts won't be iterated by the planner but their team
      // trackers (back-to-back / fairness) and group-court affinity still feed
      // the scoring. This is what we want when a group already has games on a
      // court the user didn't include in this run.
      const locks: AutoPlanLock[] = planned
        .filter((m) => m.court && m.kickoff_time)
        .map((m) => ({
          matchId: m.id,
          ageGroupId: m.age_group_id,
          homeTeamId: m.home_team_id,
          awayTeamId: m.away_team_id,
          court: m.court ?? '',
          startMin: m.kickoff_time ? minutesFromIso(m.kickoff_time) : 0,
          durationMinutes: m.duration_minutes,
        }))

      const result = autoPlan({
        courts: courtsInput,
        matches: matchesInput,
        locks,
        backToBackMin: Math.max(0, backToBackMin),
      })

      const next = new Map<string, { court: string; kickoff_time: string }>()
      const baseIso = `${baseDate}T08:00:00.000Z`
      for (const p of result.placements) {
        const hhmm = minutesToHHMM(p.startMin)
        next.set(p.matchId, {
          court: p.court,
          kickoff_time: buildIsoFromLondonTime(baseIso, hhmm),
        })
      }
      setPreviewPlacements(next)
      setPreviewStats(result.stats)
      if (result.placements.length === 0) {
        toast.error('No placements possible — check court windows / durations')
        return false
      }
      toast.success(
        `Preview ready — ${result.placements.length} of ${result.stats.totalUnplanned} placed`
      )
      return true
    } finally {
      setPlanning(false)
    }
  }

  async function handleSavePreview() {
    if (previewPlacements.size === 0) {
      toast.error('Nothing to save')
      return
    }
    setSavingPreview(true)
    const plan = Array.from(previewPlacements.entries()).map(([id, p]) => ({
      id,
      court: p.court,
      kickoff_time: p.kickoff_time,
    }))
    const { data, error } = await supabase.rpc('commit_schedule', { plan })
    setSavingPreview(false)
    if (error) {
      toast.error(`Save failed: ${error.message}`)
      return
    }
    toast.success(
      `Saved ${data ?? plan.length} match${(data ?? plan.length) === 1 ? '' : 'es'}`
    )
    clearPreview()
    await load()
  }

  function handleCancelPreview() {
    clearPreview()
    toast.success('Preview discarded')
  }

  function openUnplanDialog() {
    if (tournament.schedule_locked) {
      toast.error('Schedule is locked')
      return
    }
    if (planned.length === 0) {
      toast.error('Nothing planned for this day')
      return
    }
    setUnplanGroupIds(new Set(plannedGroupOptions.map((g) => g.id)))
    setShowUnplanDialog(true)
  }

  async function runUnplan(groupIds: Set<string>) {
    if (tournament.schedule_locked) {
      toast.error('Schedule is locked')
      return false
    }
    const matchesToUnplan = planned.filter((m) => groupIds.has(m.age_group_id))
    if (matchesToUnplan.length === 0) {
      toast.error('No planned matches selected')
      return false
    }

    setUnplanningAll(true)
    const ids = matchesToUnplan.map((m) => m.id)
    const { data, error } = await supabase
      .from('matches')
      .update({ is_planned: false })
      .in('id', ids)
      .select('id')
    setUnplanningAll(false)
    if (error) {
      toast.error(`Could not unplan: ${error.message}`)
      return false
    }
    toast.success(
      `${data?.length ?? 0} match${(data?.length ?? 0) === 1 ? '' : 'es'} moved to Unplanned`
    )
    clearPreview()
    await load()
    return true
  }

  // Cancel preview / close dialog if the day switches mid-flow.
  useEffect(() => {
    if (isPreviewMode) clearPreview()
    setShowAutoPlanDialog(false)
    setShowUnplanDialog(false)
    setSelectedIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  // Esc clears the multi-select.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  // Drop selection from anything no longer visible (filtered out / unplanned-only group changed).
  useEffect(() => {
    if (selectedIds.size === 0) return
    const visible = new Set(enriched.map((m) => m.id))
    let changed = false
    const next = new Set<string>()
    for (const id of selectedIds) {
      if (visible.has(id)) next.add(id)
      else changed = true
    }
    if (changed) setSelectedIds(next)
  }, [enriched, selectedIds])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Schedule — {tournament.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-mk-red/40 bg-mk-red/5 px-2 py-1 text-xs font-semibold text-mk-red dark:bg-mk-red/10">
              {selectedIds.size} selected
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-sm px-1 text-mk-red hover:bg-mk-red/20"
                title="Clear selection (Esc)"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </span>
          )}
          <label className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Back-to-back &lt;
            <input
              type="number"
              min={0}
              max={120}
              step={1}
              value={backToBackMin}
              onChange={(e) => {
                const n = Number(e.target.value)
                setBackToBackMin(Number.isFinite(n) && n >= 0 ? n : 0)
              }}
              className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            min
          </label>
          <button
            type="button"
            onClick={() => setShowCourtsEditor((s) => !s)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {showCourtsEditor ? 'Hide courts' : 'Manage courts'}
          </button>
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={savingLock}
            className={
              tournament.schedule_locked
                ? 'rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {tournament.schedule_locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
          {tournament.schedule_locked && (
            <a
              href={`/admin/scorecards/${day}?t=${tournament.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900"
            >
              🖨️ Print scorecards
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>

      {showCourtsEditor && (
        <CourtsManager
          tournamentId={tournament.id}
          day={day}
          courts={courts}
          onChanged={loadCourts}
        />
      )}

      {isPreviewMode && previewStats && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mk-red/40 bg-mk-red/5 px-3 py-2 text-sm dark:border-mk-red/50 dark:bg-mk-red/10">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="rounded-sm bg-mk-red px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Preview
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {previewStats.placed} of {previewStats.totalUnplanned} placed
            </span>
            {previewStats.totalUnplanned - previewStats.placed > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {previewStats.totalUnplanned - previewStats.placed} unplaced — adjust courts/durations and re-run, or drag manually
              </span>
            )}
            {previewStats.earliestStart !== null &&
              previewStats.latestEnd !== null && (
                <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {minutesToHHMM(previewStats.earliestStart)}–{minutesToHHMM(previewStats.latestEnd)}
                </span>
              )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Drag preview cards to tweak before saving.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelPreview}
              disabled={savingPreview}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSavePreview}
              disabled={savingPreview || previewPlacements.size === 0}
              className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPreview
                ? 'Saving…'
                : `Save ${previewPlacements.size} match${previewPlacements.size === 1 ? '' : 'es'}`}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['saturday', 'sunday'] as Day[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={
              d === day
                ? 'rounded-md bg-mk-red px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
                : 'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            }
          >
            {d === 'saturday' ? 'Saturday' : 'Sunday'}
          </button>
        ))}
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Age groups
          </span>
          {legend.map((g) => {
            const c = groupColorMap.get(g.id) ?? AGE_GROUP_PALETTE[0]
            return (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"
              >
                <span className={`inline-block h-3 w-3 rounded-sm ${c.dot}`} />
                {g.name}
              </span>
            )
          })}
          <span className="ml-auto inline-flex flex-wrap items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-200 ring-1 ring-red-500" />
              Court clash
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-200 ring-1 ring-amber-500" />
              Back-to-back &lt; {backToBackMin} min
            </span>
          </span>
        </div>
      )}

      {loading ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Loading…
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-3">
            <UnplannedColumn
              matches={filteredUnplanned}
              totalUnplanned={unplanned.length}
              plannedCount={planned.length}
              filterValue={unplannedFilter}
              filterOptions={unplannedGroupOptions}
              onFilterChange={setUnplannedFilter}
              locked={tournament.schedule_locked}
              hasCourts={sortedCourts.length > 0}
              isPreviewMode={isPreviewMode}
              planning={planning}
              unplanningAll={unplanningAll}
              onAutoPlan={openAutoPlanDialog}
              onUnplanAll={openUnplanDialog}
              onRegenerate={() => setRegeneratingGroupId(unplannedFilter)}
              isRegenerating={isRegenerating}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
            />
            <ScheduleGrid
              courts={sortedCourts}
              matches={effectivePlanned}
              lanesByCourt={lanesByCourt}
              courtClashIds={courtClashIds}
              backToBackIds={backToBackIds}
              locked={tournament.schedule_locked}
              gridStartMin={gridStartMin}
              totalSlots={totalSlots}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onClearSelection={clearSelection}
            />
          </div>
          <DragOverlay>
            {activeMatch ? (
              <div style={{ width: COLUMN_WIDTH_PX - 16 }}>
                <MatchCard
                  match={activeMatch}
                  dragging
                  groupCount={
                    selectedIds.size > 1 && selectedIds.has(activeMatch.id)
                      ? selectedIds.size
                      : 0
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {showAutoPlanDialog && (
        <AutoPlanDialog
          ageGroups={unplannedGroupOptions}
          courts={sortedCourts}
          unplannedByGroup={unplanned}
          groupId={autoPlanGroupId}
          courtNames={autoPlanCourtNames}
          planning={planning}
          onChangeGroup={setAutoPlanGroupId}
          onChangeCourts={setAutoPlanCourtNames}
          onCancel={() => setShowAutoPlanDialog(false)}
          onConfirm={() => {
            const ok = runAutoPlan(autoPlanGroupId, autoPlanCourtNames)
            if (ok) setShowAutoPlanDialog(false)
          }}
        />
      )}

      {showUnplanDialog && (
        <UnplanDialog
          ageGroups={plannedGroupOptions}
          plannedByGroup={planned}
          groupIds={unplanGroupIds}
          unplanning={unplanningAll}
          onChangeGroups={setUnplanGroupIds}
          onCancel={() => setShowUnplanDialog(false)}
          onConfirm={async () => {
            const ok = await runUnplan(unplanGroupIds)
            if (ok) setShowUnplanDialog(false)
          }}
        />
      )}

      {regeneratingGroupId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isRegenerating) setRegeneratingGroupId(null)
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Regenerate Fixtures
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will delete all currently unplanned fixtures for <strong className="text-zinc-900 dark:text-zinc-100">{groupById.get(regeneratingGroupId)?.name}</strong> and generate a fresh set using the latest round-robin algorithm.
            </p>
            <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-500">
              Matches that have already been played or scheduled on courts will not be affected.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegeneratingGroupId(null)}
                disabled={isRegenerating}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRegenerating(true)
                  const res = await regenerateUnplannedFixtures(regeneratingGroupId)
                  setIsRegenerating(false)
                  if (!res.success) {
                    toast.error(`Failed to regenerate: ${res.error}`)
                  } else {
                    toast.success(`Successfully regenerated ${res.created} fixtures!`)
                    setRegeneratingGroupId(null)
                    clearPreview()
                    await load()
                  }
                }}
                disabled={isRegenerating}
                className="rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:opacity-50"
              >
                {isRegenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AutoPlanDialog({
  ageGroups,
  courts,
  unplannedByGroup,
  groupId,
  courtNames,
  planning,
  onChangeGroup,
  onChangeCourts,
  onCancel,
  onConfirm,
}: {
  ageGroups: AgeGroup[]
  courts: Court[]
  unplannedByGroup: MatchWithMeta[]
  groupId: string
  courtNames: Set<string>
  planning: boolean
  onChangeGroup: (id: string) => void
  onChangeCourts: (names: Set<string>) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const totalForSelection =
    groupId === 'all'
      ? unplannedByGroup.length
      : unplannedByGroup.filter((m) => m.age_group_id === groupId).length

  function toggleCourt(name: string) {
    const next = new Set(courtNames)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    onChangeCourts(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Auto-plan matches
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Choose which matches to schedule and which courts to use.
          </p>
        </header>
        <div className="space-y-4 px-4 py-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Age group
            </label>
            <select
              value={groupId}
              onChange={(e) => onChangeGroup(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="all">
                All age groups ({unplannedByGroup.length})
              </option>
              {ageGroups.map((g) => {
                const n = unplannedByGroup.filter(
                  (m) => m.age_group_id === g.id
                ).length
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} ({n})
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Courts to use
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onChangeCourts(new Set(courts.map((c) => c.name)))}
                  className="text-mk-red hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onChangeCourts(new Set())}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {courts.map((c) => {
                const checked = courtNames.has(c.name)
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      checked
                        ? 'border-mk-red bg-mk-red/5 text-zinc-900 dark:text-zinc-50'
                        : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCourt(c.name)}
                      className="h-3.5 w-3.5 accent-mk-red"
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {c.start_time}–{c.end_time}
                    </span>
                  </label>
                )
              })}
            </div>
            {courts.length === 0 && (
              <p className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No courts configured for this day.
              </p>
            )}
          </div>
          <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Will plan{' '}
            <strong className="text-zinc-900 dark:text-zinc-50">
              {totalForSelection} match{totalForSelection === 1 ? '' : 'es'}
            </strong>{' '}
            on{' '}
            <strong className="text-zinc-900 dark:text-zinc-50">
              {courtNames.size} court{courtNames.size === 1 ? '' : 's'}
            </strong>
            . Existing scheduled matches stay locked and the planner will avoid
            clashing with them.
          </p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={planning}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={
              planning || courtNames.size === 0 || totalForSelection === 0
            }
            className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {planning ? 'Planning…' : 'Plan'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function UnplanDialog({
  ageGroups,
  plannedByGroup,
  groupIds,
  unplanning,
  onChangeGroups,
  onCancel,
  onConfirm,
}: {
  ageGroups: AgeGroup[]
  plannedByGroup: MatchWithMeta[]
  groupIds: Set<string>
  unplanning: boolean
  onChangeGroups: (ids: Set<string>) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const totalForSelection = plannedByGroup.filter((m) => groupIds.has(m.age_group_id)).length

  function toggleGroup(id: string) {
    const next = new Set(groupIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChangeGroups(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Unplan matches
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Select which age groups to remove from the schedule.
          </p>
        </header>
        <div className="space-y-4 px-4 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Age groups
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onChangeGroups(new Set(ageGroups.map((g) => g.id)))}
                  className="text-mk-red hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onChangeGroups(new Set())}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {ageGroups.map((g) => {
                const checked = groupIds.has(g.id)
                const n = plannedByGroup.filter((m) => m.age_group_id === g.id).length
                return (
                  <label
                    key={g.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      checked
                        ? 'border-mk-red bg-mk-red/5 text-zinc-900 dark:text-zinc-50'
                        : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(g.id)}
                      className="h-3.5 w-3.5 accent-mk-red shrink-0"
                    />
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="text-[10px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                      {n}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:border-amber-800/50 dark:text-amber-300">
            Will unplan{' '}
            <strong className="text-amber-900 dark:text-amber-200">
              {totalForSelection} match{totalForSelection === 1 ? '' : 'es'}
            </strong>
            . They will be moved back to the Unplanned column.
          </p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={unplanning}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={unplanning || totalForSelection === 0}
            className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unplanning ? 'Unplanning…' : 'Unplan'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function UnplannedColumn({
  matches,
  totalUnplanned,
  plannedCount,
  filterValue,
  filterOptions,
  onFilterChange,
  locked,
  hasCourts,
  isPreviewMode,
  planning,
  unplanningAll,
  onAutoPlan,
  onUnplanAll,
  onRegenerate,
  isRegenerating,
  selectedIds,
  onToggleSelected,
}: {
  matches: MatchWithMeta[]
  totalUnplanned: number
  plannedCount: number
  filterValue: string
  filterOptions: AgeGroup[]
  onFilterChange: (v: string) => void
  locked: boolean
  hasCourts: boolean
  isPreviewMode: boolean
  planning: boolean
  unplanningAll: boolean
  onAutoPlan: () => void
  onUnplanAll: () => void
  onRegenerate: () => void
  isRegenerating: boolean
  selectedIds: Set<string>
  onToggleSelected: (id: string, additive: boolean) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'unplanned' })
  const filtered = filterValue !== 'all'
  const autoPlanDisabled =
    planning || isPreviewMode || locked || totalUnplanned === 0 || !hasCourts
  const unplanAllDisabled =
    unplanningAll || isPreviewMode || locked || plannedCount === 0
  const regenerateDisabled =
    filterValue === 'all' || isPreviewMode || locked || isRegenerating || planning || unplanningAll
  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border ${
        isOver
          ? 'border-mk-red bg-mk-red/5'
          : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950'
      }`}
    >
      <header className="space-y-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Unplanned · {matches.length}
          {filtered && totalUnplanned > matches.length && (
            <span className="ml-1 font-normal text-zinc-400">
              of {totalUnplanned}
            </span>
          )}
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onAutoPlan}
            disabled={autoPlanDisabled}
            className="w-full rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              locked
                ? 'Schedule is locked'
                : !hasCourts
                  ? 'No courts configured for this day'
                  : totalUnplanned === 0
                    ? 'No unplanned matches for this day'
                    : isPreviewMode
                      ? 'Cancel the current preview first'
                      : `Auto-plan ${totalUnplanned} unplanned match${totalUnplanned === 1 ? '' : 'es'}`
            }
          >
            {planning
              ? 'Planning…'
              : `✨ Auto-plan${totalUnplanned > 0 ? ` (${totalUnplanned})` : ''}`}
          </button>
          <button
            type="button"
            onClick={onUnplanAll}
            disabled={unplanAllDisabled}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={
              locked
                ? 'Schedule is locked'
                : plannedCount === 0
                  ? 'Nothing planned for this day'
                  : isPreviewMode
                    ? 'Cancel the current preview first'
                    : `Unplan selected match${plannedCount === 1 ? '' : 'es'}...`
            }
          >
            {unplanningAll ? 'Unplanning…' : `Unplan matches${plannedCount > 0 ? ` (${plannedCount})` : ''}`}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={
              filterValue === 'all'
                ? 'Select a specific age group below to regenerate its fixtures'
                : locked
                  ? 'Schedule is locked'
                  : isPreviewMode
                    ? 'Cancel the current preview first'
                    : 'Clear and recreate unplanned fixtures for this group'
            }
          >
            {isRegenerating ? 'Regenerating…' : '↻ Regenerate unplanned'}
          </button>
        </div>
        <select
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          disabled={filterOptions.length === 0 && filterValue === 'all'}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="all">All age groups</option>
          {filterOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {matches.length === 0 ? (
          <p className="rounded border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-400 dark:border-zinc-700">
            {filtered
              ? 'No unplanned matches in this group.'
              : 'Drag matches here to take them out of the schedule.'}
          </p>
        ) : (
          matches.map((m) => (
            <DraggableMatch
              key={m.id}
              match={m}
              locked={locked}
              selected={selectedIds.has(m.id)}
              onToggleSelected={onToggleSelected}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ScheduleGrid({
  courts,
  matches,
  lanesByCourt,
  courtClashIds,
  backToBackIds,
  locked,
  gridStartMin,
  totalSlots,
  selectedIds,
  onToggleSelected,
  onClearSelection,
}: {
  courts: Court[]
  matches: MatchWithMeta[]
  lanesByCourt: Map<string, Map<string, LaneAssignment>>
  courtClashIds: Set<string>
  backToBackIds: Set<string>
  locked: boolean
  gridStartMin: number
  totalSlots: number
  selectedIds: Set<string>
  onToggleSelected: (id: string, additive: boolean) => void
  onClearSelection: () => void
}) {
  const gridDurationMin = totalSlots * SLOT_MINUTES
  // Anchor labels to the next 30-min tick at or after gridStartMin so the
  // 5-min top buffer doesn't shift HH:MM labels off their natural ticks.
  const firstLabelMin = Math.ceil(gridStartMin / 30) * 30
  const labelCount =
    Math.floor((gridStartMin + gridDurationMin - firstLabelMin) / 30) + 1
  return (
    <div
      className="flex-1 overflow-x-auto rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      onMouseDown={(e) => {
        // Click on empty grid background (not a card or droppable slot)
        // clears the multi-select.
        const target = e.target as HTMLElement
        if (!target.closest('[data-match-card="true"]')) {
          if (!e.shiftKey && !e.metaKey && !e.ctrlKey) onClearSelection()
        }
      }}
    >
      <div
        className="relative flex"
        style={{ minHeight: totalSlots * SLOT_PX + 32 }}
      >
        {/* Time axis */}
        <div className="sticky left-0 z-10 w-12 shrink-0 border-r border-zinc-200 bg-zinc-50 text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="h-8 border-b border-zinc-200 dark:border-zinc-800" />
          <div className="relative" style={{ height: totalSlots * SLOT_PX }}>
            {Array.from({ length: labelCount }).map((_, i) => {
              const minutes = firstLabelMin + i * 30
              const top =
                ((minutes - gridStartMin) * SLOT_PX) / SLOT_MINUTES
              return (
                <div
                  key={i}
                  className="absolute right-1 -translate-y-1/2 tabular-nums"
                  style={{ top }}
                >
                  {minutesToHHMM(minutes)}
                </div>
              )
            })}
          </div>
        </div>

        {/* Court columns */}
        {courts.map((court) => {
          const courtMatches = matches.filter((m) => m.court === court.name)
          const lanes = lanesByCourt.get(court.name) ?? new Map()
          const startMin = hhmmToMinutes(court.start_time)
          const endMin = hhmmToMinutes(court.end_time)
          return (
            <div
              key={court.id}
              className="border-r border-zinc-200 dark:border-zinc-800"
              style={{ width: COLUMN_WIDTH_PX }}
            >
              <header className="sticky top-0 z-10 h-8 border-b border-zinc-200 bg-zinc-50 px-2 text-center text-xs font-semibold leading-8 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <span>{court.name}</span>
                <span className="ml-1 text-[10px] font-normal text-zinc-500 tabular-nums dark:text-zinc-400">
                  {court.start_time}–{court.end_time}
                </span>
              </header>
              <CourtColumnDroppable
                court={court}
                matches={courtMatches}
                lanes={lanes}
                courtClashIds={courtClashIds}
                backToBackIds={backToBackIds}
                locked={locked}
                gridStartMin={gridStartMin}
                totalSlots={totalSlots}
                courtStartMin={startMin}
                courtEndMin={endMin}
                selectedIds={selectedIds}
                onToggleSelected={onToggleSelected}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CourtColumnDroppable({
  court,
  matches,
  lanes,
  courtClashIds,
  backToBackIds,
  locked,
  gridStartMin,
  totalSlots,
  courtStartMin,
  courtEndMin,
  selectedIds,
  onToggleSelected,
}: {
  court: Court
  matches: MatchWithMeta[]
  lanes: Map<string, LaneAssignment>
  courtClashIds: Set<string>
  backToBackIds: Set<string>
  locked: boolean
  gridStartMin: number
  totalSlots: number
  courtStartMin: number
  courtEndMin: number
  selectedIds: Set<string>
  onToggleSelected: (id: string, additive: boolean) => void
}) {
  return (
    <div className="relative" style={{ height: totalSlots * SLOT_PX }}>
      {Array.from({ length: totalSlots }).map((_, idx) => {
        const slotMin = gridStartMin + idx * SLOT_MINUTES
        const isHalfHour = slotMin % 30 === 0
        const available = slotMin >= courtStartMin && slotMin < courtEndMin
        return (
          <SlotCell
            key={idx}
            court={court.name}
            slotIndex={idx}
            isHalfHour={isHalfHour}
            available={available}
          />
        )
      })}
      {matches.map((m) => {
        if (!m.kickoff_time) return null
        const slot = slotIndexFromIso(m.kickoff_time, gridStartMin, totalSlots)
        const top = slot * SLOT_PX
        const height = Math.max(
          (m.duration_minutes / SLOT_MINUTES) * SLOT_PX,
          SLOT_PX * 2
        )
        const lane = lanes.get(m.id) ?? { lane: 0, totalLanes: 1 }
        const widthPct = 100 / lane.totalLanes
        const leftPct = lane.lane * widthPct
        return (
          <DraggableMatch
            key={m.id}
            match={m}
            locked={locked}
            courtClash={courtClashIds.has(m.id)}
            backToBack={backToBackIds.has(m.id)}
            selected={selectedIds.has(m.id)}
            onToggleSelected={onToggleSelected}
            style={{
              position: 'absolute',
              top,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              height,
            }}
          />
        )
      })}
    </div>
  )
}

function SlotCell({
  court,
  slotIndex,
  isHalfHour,
  available,
}: {
  court: string
  slotIndex: number
  isHalfHour: boolean
  available: boolean
}) {
  const id = `slot:${court}:${slotIndex}`
  const { isOver, setNodeRef } = useDroppable({ id, disabled: !available })
  const baseLine = isHalfHour
    ? 'border-t border-zinc-200 dark:border-zinc-800'
    : ''
  const tone = !available
    ? 'bg-zinc-200/70 bg-[repeating-linear-gradient(45deg,_rgba(0,0,0,0.06)_0,_rgba(0,0,0,0.06)_4px,_transparent_4px,_transparent_8px)] dark:bg-zinc-800/60'
    : isOver
      ? 'bg-mk-red/20'
      : ''
  return (
    <div
      ref={available ? setNodeRef : undefined}
      className={`absolute w-full ${baseLine} ${tone}`}
      style={{
        top: slotIndex * SLOT_PX,
        height: SLOT_PX,
      }}
      title={available ? undefined : `${court} not available at this time`}
    />
  )
}

function DraggableMatch({
  match,
  locked,
  courtClash = false,
  backToBack = false,
  selected = false,
  onToggleSelected,
  style,
}: {
  match: MatchWithMeta
  locked: boolean
  courtClash?: boolean
  backToBack?: boolean
  selected?: boolean
  onToggleSelected?: (id: string, additive: boolean) => void
  style?: React.CSSProperties
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: match.id,
    disabled: locked,
  })
  return (
    <div
      ref={setNodeRef}
      data-match-card="true"
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!onToggleSelected) return
        // PointerSensor's 5px activation threshold means a true drag won't
        // fire onClick — so this only runs for taps/clicks.
        const additive = e.shiftKey || e.metaKey || e.ctrlKey
        onToggleSelected(match.id, additive)
        e.stopPropagation()
      }}
      style={{
        ...style,
        opacity: isDragging ? 0.4 : 1,
        cursor: locked ? 'not-allowed' : 'grab',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      <MatchCard
        match={match}
        courtClash={courtClash}
        backToBack={backToBack}
        selected={selected}
      />
    </div>
  )
}

function MatchCard({
  match,
  dragging = false,
  courtClash = false,
  backToBack = false,
  selected = false,
  groupCount = 0,
}: {
  match: MatchWithMeta
  dragging?: boolean
  courtClash?: boolean
  backToBack?: boolean
  selected?: boolean
  groupCount?: number
}) {
  const c = match.groupColor
  const completed = match.status === 'completed'
  const borderClass = courtClash
    ? 'border-2 border-red-500 dark:border-red-500'
    : backToBack
      ? 'border-2 border-amber-500 dark:border-amber-500'
      : `border ${c.border}`
  const selectedRing = selected
    ? 'ring-2 ring-offset-1 ring-mk-red dark:ring-offset-zinc-950'
    : ''
  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] shadow-sm ${c.bg} ${c.bgDark} ${borderClass} ${c.text} ${c.textDark} ${selectedRing} ${
        dragging ? 'rotate-1 ring-2 ring-mk-red/50' : ''
      }`}
      title={[
        `${match.groupName}: ${match.homeName} vs ${match.awayName}`,
        match.is_planned && match.kickoff_time
          ? `Kickoff ${formatKickoffTime(match.kickoff_time)} · ${match.duration_minutes} min`
          : 'Unplanned',
        match.round_number ? `Round ${match.round_number}` : '',
        match.court ? `Court: ${match.court}` : '',
        completed ? 'Completed' : '',
        courtClash ? 'Court clash with another fixture' : '',
        backToBack ? 'Back-to-back match for one of these teams' : '',
      ]
        .filter(Boolean)
        .join(' — ')}
    >
      {(courtClash || backToBack) && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-1 ${courtClash ? 'bg-red-500' : 'bg-amber-500'}`}
        />
      )}
      {(courtClash || backToBack) && (
        <span
          className={`absolute right-0.5 top-0.5 z-10 inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide leading-none text-white ${courtClash ? 'bg-red-600' : 'bg-amber-600'}`}
        >
          ⚠ {courtClash ? 'Clash' : 'B2B'}
        </span>
      )}
      {groupCount > 1 && (
        <span className="absolute -right-1 -top-1 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-mk-red px-1.5 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white dark:ring-zinc-950">
          {groupCount}
        </span>
      )}
      <p className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wide opacity-80">
        <span className="truncate">
          {match.groupName}{match.round_number ? ` · R${match.round_number}` : ''}
        </span>
        {match.is_planned && match.kickoff_time && (
          <span className="ml-1 shrink-0 tabular-nums">
            {formatKickoffTime(match.kickoff_time)}
          </span>
        )}
      </p>
      <p className="truncate font-semibold leading-tight">
        {match.homeName} <span className="opacity-60">vs</span> {match.awayName}
      </p>
    </div>
  )
}
