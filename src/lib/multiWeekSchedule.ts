import { buildIsoFromLondonTime } from './time'
import type { LeagueVenueMode, MatchStatus } from './types'

const LONDON = 'Europe/London'
const DEFAULT_WINDOW_START = '09:00'
const DEFAULT_WINDOW_END = '17:00'

export interface MultiWeekScheduleMatch {
  id: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeSlotId?: string | null
  awaySlotId?: string | null
  roundNumber: number | null
  status: MatchStatus
  isPlanned: boolean
  kickoffTime: string | null
  court: string | null
  durationMinutes: number
}

export interface MultiWeekScheduleTeam {
  id: string
  homeVenueName?: string | null
  homeVenueAddress?: string | null
  homeVenuePostcode?: string | null
}

export interface MultiWeekScheduleVenue {
  name: string
  /** Daily availability window start, HH:MM. Defaults to 09:00 when omitted. */
  availableFrom?: string | null
  /** Daily availability window end, HH:MM. Defaults to 17:00 when omitted. */
  availableTo?: string | null
  /** Number of parallel courts/pitches at this venue. Defaults to 1. */
  courtCount?: number | null
  /** Weekdays (0=Sun…6=Sat) the venue is open. Empty/undefined = all playable days. */
  playableWeekdays?: number[] | null
}

export interface MultiWeekScheduleOptions {
  startDate: string
  endDate: string
  playableWeekdays: number[]
  venueMode: LeagueVenueMode
  maxGamesPerTeamPerWeek: number | null
  /** Minimum changeover gap (minutes) between consecutive games on a court. */
  minGapMinutes?: number
  preferRoundOrder: boolean
  preferHomeAwayBalance: boolean
  defaultKickoffTime?: string
  /**
   * Earliest date (YYYY-MM-DD) a fixture may be placed on. Used to keep a
   * knockout phase after the last fixture of the preceding league/group phase.
   */
  earliestDate?: string
}

export interface MultiWeekSchedulePlacement {
  matchId: string
  kickoffTime: string
  court: string | null
  date: string
  warnings: string[]
}

export interface MultiWeekUnplacedMatch {
  matchId: string
  reason: string
}

export interface MultiWeekScheduleResult {
  placements: MultiWeekSchedulePlacement[]
  unplaced: MultiWeekUnplacedMatch[]
  playableDates: string[]
  warnings: string[]
  stats: {
    totalUnplanned: number
    placed: number
  }
}

interface CourtResource {
  label: string
  startMin: number
  endMin: number
  /** Weekdays the court is open (0=Sun…6=Sat). Empty = open on every playable day. */
  weekdays: number[]
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function uniqueWeekdays(values: number[]): number[] {
  return Array.from(
    new Set(values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))
  ).sort((a, b) => a - b)
}

export function generatePlayableDates(
  startDate: string,
  endDate: string,
  playableWeekdays: number[]
): string[] {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const weekdays = uniqueWeekdays(playableWeekdays)
  if (!start || !end || end < start || weekdays.length === 0) return []

  const allowed = new Set(weekdays)
  const dates: string[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (allowed.has(cursor.getUTCDay())) dates.push(formatDate(cursor))
  }
  return dates
}

function weekKey(dateKey: string): string {
  const date = parseDate(dateKey)
  if (!date) return dateKey
  const day = date.getUTCDay()
  const diffToMonday = (day + 6) % 7
  return formatDate(addDays(date, -diffToMonday))
}

function londonDateKey(iso: string): string | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))

  const byType = new Map(parts.map((part) => [part.type, part.value]))
  const year = byType.get('year')
  const month = byType.get('month')
  const day = byType.get('day')
  return year && month && day ? `${year}-${month}-${day}` : null
}

function londonMinutesOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  const hour = Number(byType.get('hour'))
  const minute = Number(byType.get('minute'))
  const safeHour = Number.isFinite(hour) ? hour % 24 : 0
  return safeHour * 60 + (Number.isFinite(minute) ? minute : 0)
}

function hmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function minutesToHm(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function participantIds(match: MultiWeekScheduleMatch): string[] {
  return [
    match.homeTeamId ? `team:${match.homeTeamId}` : match.homeSlotId ? `slot:${match.homeSlotId}` : null,
    match.awayTeamId ? `team:${match.awayTeamId}` : match.awaySlotId ? `slot:${match.awaySlotId}` : null,
  ].filter((value): value is string => Boolean(value))
}

function recordParticipantUsage(
  match: MultiWeekScheduleMatch,
  date: string,
  participantsByDate: Map<string, Set<string>>,
  gamesByParticipantWeek: Map<string, number>
) {
  const participants = participantIds(match)
  const dateSet = participantsByDate.get(date) ?? new Set<string>()
  for (const participant of participants) {
    dateSet.add(participant)
    const key = `${participant}|${weekKey(date)}`
    gamesByParticipantWeek.set(key, (gamesByParticipantWeek.get(key) ?? 0) + 1)
  }
  participantsByDate.set(date, dateSet)
}

function canPlaceOnDate(
  match: MultiWeekScheduleMatch,
  date: string,
  participantsByDate: Map<string, Set<string>>
): boolean {
  const existing = participantsByDate.get(date)
  if (!existing) return true
  return participantIds(match).every((participant) => !existing.has(participant))
}

function homeVenueLabel(team: MultiWeekScheduleTeam | undefined): string | null {
  if (!team?.homeVenueName) return null
  const bits = [team.homeVenueName, team.homeVenuePostcode].filter(Boolean)
  return bits.join(' - ')
}

function defaultWindow(): { startMin: number; endMin: number } {
  return {
    startMin: hmToMinutes(DEFAULT_WINDOW_START) ?? 540,
    endMin: hmToMinutes(DEFAULT_WINDOW_END) ?? 1020,
  }
}

function neutralCourtResources(venues: MultiWeekScheduleVenue[]): CourtResource[] {
  const courts: CourtResource[] = []
  for (const venue of venues) {
    const startMin = hmToMinutes(venue.availableFrom ?? DEFAULT_WINDOW_START) ?? defaultWindow().startMin
    const endMin = hmToMinutes(venue.availableTo ?? DEFAULT_WINDOW_END) ?? defaultWindow().endMin
    const count = Math.max(1, Math.floor(venue.courtCount ?? 1))
    const weekdays = uniqueWeekdays(venue.playableWeekdays ?? [])
    for (let index = 1; index <= count; index += 1) {
      courts.push({
        label: count > 1 ? `${venue.name} - Court ${index}` : venue.name,
        startMin,
        endMin,
        weekdays,
      })
    }
  }
  return courts
}

function fallbackCourt(label: string): CourtResource {
  const { startMin, endMin } = defaultWindow()
  return { label, startMin, endMin, weekdays: [] }
}

function weekdayOfDate(date: string): number {
  return parseDate(date)?.getUTCDay() ?? 0
}

// A court with no specific weekdays is open on every playable day; otherwise it
// is only open on its configured weekdays.
function courtOpenOnDate(court: CourtResource, date: string): boolean {
  if (court.weekdays.length === 0) return true
  return court.weekdays.includes(weekdayOfDate(date))
}

function homeCourtResource(team: MultiWeekScheduleTeam | undefined): CourtResource {
  return fallbackCourt(homeVenueLabel(team) ?? 'Home venue TBC')
}

// The ordered set of courts a given match may be scheduled on, honouring the
// venue mode. Home/mixed modes resolve to the home team's venue (a single court
// with a default window); neutral mode uses the configured tournament venues.
function courtsForMatch(
  match: MultiWeekScheduleMatch,
  venueMode: LeagueVenueMode,
  teamsById: Map<string, MultiWeekScheduleTeam>,
  neutralCourts: CourtResource[]
): CourtResource[] {
  const homeTeam = match.homeTeamId ? teamsById.get(match.homeTeamId) : undefined

  if (venueMode === 'home_team_venues') {
    return [homeCourtResource(homeTeam)]
  }

  if (venueMode === 'mixed') {
    if (homeTeam && homeVenueLabel(homeTeam)) return [homeCourtResource(homeTeam)]
    return neutralCourts.length > 0 ? neutralCourts : [fallbackCourt('Venue TBC')]
  }

  return neutralCourts.length > 0 ? neutralCourts : [fallbackCourt('Venue TBC')]
}

// Earliest start (minutes from midnight) at which a match of `duration` fits on
// a court without overlapping an already-occupied interval, or null if the day
// is full. Intervals outside the window (e.g. a lock past closing time) simply
// don't block in-window placement.
function earliestFreeStart(
  intervals: Array<[number, number]>,
  windowStart: number,
  windowEnd: number,
  duration: number,
  gap: number
): number | null {
  let cursor = windowStart
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  for (const [start, end] of sorted) {
    // A new game fits before this interval only if it ends, plus the gap,
    // before the interval starts.
    if (start - gap >= cursor + duration) break
    // Otherwise the earliest we can start is after this interval plus the gap.
    if (end + gap > cursor) cursor = end + gap
  }
  return cursor + duration <= windowEnd ? cursor : null
}

function findSlot(
  date: string,
  courts: CourtResource[],
  occupancy: Map<string, Map<string, Array<[number, number]>>>,
  duration: number,
  gap: number
): { court: CourtResource; start: number } | null {
  let best: { court: CourtResource; start: number } | null = null
  for (const court of courts) {
    if (!courtOpenOnDate(court, date)) continue
    const intervals = occupancy.get(date)?.get(court.label) ?? []
    const start = earliestFreeStart(intervals, court.startMin, court.endMin, duration, gap)
    if (start === null) continue
    if (!best || start < best.start) best = { court, start }
  }
  return best
}

function slotsOnCourt(court: CourtResource, matchDuration: number, gap: number): number {
  const window = court.endMin - court.startMin
  if (window < matchDuration) return 0
  return Math.floor((window + gap) / (matchDuration + gap))
}

/**
 * Total fixture slots available across `playableDates`, honouring each venue's
 * window, court count and (per-venue) open weekdays. Used by the planning summary.
 */
export function countAvailableSlots(
  playableDates: string[],
  venues: MultiWeekScheduleVenue[],
  matchDurationMinutes: number,
  minGapMinutes: number
): number {
  if (matchDurationMinutes <= 0) return 0
  const gap = Math.max(0, minGapMinutes)
  const courts = neutralCourtResources(venues)
  const effective = courts.length > 0 ? courts : [fallbackCourt('Venue TBC')]
  let total = 0
  for (const date of playableDates) {
    for (const court of effective) {
      if (!courtOpenOnDate(court, date)) continue
      total += slotsOnCourt(court, matchDurationMinutes, gap)
    }
  }
  return total
}

function reserveSlot(
  occupancy: Map<string, Map<string, Array<[number, number]>>>,
  date: string,
  label: string,
  start: number,
  end: number
) {
  let byCourt = occupancy.get(date)
  if (!byCourt) {
    byCourt = new Map()
    occupancy.set(date, byCourt)
  }
  const intervals = byCourt.get(label) ?? []
  intervals.push([start, end])
  byCourt.set(label, intervals)
}

function candidateScore(
  match: MultiWeekScheduleMatch,
  date: string,
  options: MultiWeekScheduleOptions,
  gamesByParticipantWeek: Map<string, number>,
  matchesByDate: Map<string, number>,
  homeCountByTeam: Map<string, number>,
  awayCountByTeam: Map<string, number>
): { score: number; warnings: string[] } {
  let score = matchesByDate.get(date) ?? 0
  const warnings: string[] = []
  const week = weekKey(date)

  if (options.maxGamesPerTeamPerWeek) {
    for (const participant of participantIds(match)) {
      const nextCount = (gamesByParticipantWeek.get(`${participant}|${week}`) ?? 0) + 1
      if (nextCount > options.maxGamesPerTeamPerWeek) {
        score += 100
        warnings.push(`Exceeds ${options.maxGamesPerTeamPerWeek} game(s) per team this week`)
      } else {
        score += nextCount * 5
      }
    }
  }

  if (options.preferHomeAwayBalance && match.homeTeamId && match.awayTeamId) {
    const homeImbalance =
      (homeCountByTeam.get(match.homeTeamId) ?? 0) -
      (awayCountByTeam.get(match.homeTeamId) ?? 0)
    const awayImbalance =
      (awayCountByTeam.get(match.awayTeamId) ?? 0) -
      (homeCountByTeam.get(match.awayTeamId) ?? 0)
    score += Math.max(0, homeImbalance) + Math.max(0, awayImbalance)
  }

  return { score, warnings: Array.from(new Set(warnings)) }
}

function sortMatches(
  matches: MultiWeekScheduleMatch[],
  preferRoundOrder: boolean
): MultiWeekScheduleMatch[] {
  return [...matches].sort((a, b) => {
    if (preferRoundOrder) {
      const ar = a.roundNumber ?? Number.MAX_SAFE_INTEGER
      const br = b.roundNumber ?? Number.MAX_SAFE_INTEGER
      if (ar !== br) return ar - br
    }
    return a.id.localeCompare(b.id)
  })
}

export function planMultiWeekSchedule(input: {
  matches: MultiWeekScheduleMatch[]
  teams: MultiWeekScheduleTeam[]
  venues: MultiWeekScheduleVenue[]
  options: MultiWeekScheduleOptions
}): MultiWeekScheduleResult {
  const { matches, teams, venues, options } = input
  const playableDates = generatePlayableDates(
    options.startDate,
    options.endDate,
    options.playableWeekdays
  )
  const unplannedMatches = matches.filter(
    (match) => !match.isPlanned && match.status !== 'completed'
  )

  if (playableDates.length === 0) {
    return {
      placements: [],
      unplaced: unplannedMatches.map((match) => ({
        matchId: match.id,
        reason: 'No playable dates in the configured date range.',
      })),
      playableDates,
      warnings: ['No playable dates in the configured date range.'],
      stats: { totalUnplanned: unplannedMatches.length, placed: 0 },
    }
  }

  const allowedDates = options.earliestDate
    ? playableDates.filter((date) => date >= options.earliestDate!)
    : playableDates

  const noDateReason =
    allowedDates.length === 0
      ? 'No playable date falls after the preceding phase has finished.'
      : 'No playable date could satisfy same-day team and venue constraints.'

  const minGap = Math.max(0, options.minGapMinutes ?? 0)
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const neutralCourts = neutralCourtResources(venues)
  const participantsByDate = new Map<string, Set<string>>()
  const gamesByParticipantWeek = new Map<string, number>()
  const matchesByDate = new Map<string, number>()
  const homeCountByTeam = new Map<string, number>()
  const awayCountByTeam = new Map<string, number>()
  const occupancy = new Map<string, Map<string, Array<[number, number]>>>()

  const locks = matches.filter((match) => match.isPlanned || match.status === 'completed')
  for (const lock of locks) {
    if (!lock.kickoffTime) continue
    const date = londonDateKey(lock.kickoffTime)
    if (!date) continue
    recordParticipantUsage(lock, date, participantsByDate, gamesByParticipantWeek)
    matchesByDate.set(date, (matchesByDate.get(date) ?? 0) + 1)
    if (lock.homeTeamId) homeCountByTeam.set(lock.homeTeamId, (homeCountByTeam.get(lock.homeTeamId) ?? 0) + 1)
    if (lock.awayTeamId) awayCountByTeam.set(lock.awayTeamId, (awayCountByTeam.get(lock.awayTeamId) ?? 0) + 1)
    if (lock.court) {
      const start = londonMinutesOfDay(lock.kickoffTime)
      reserveSlot(occupancy, date, lock.court, start, start + lock.durationMinutes)
    }
  }

  const placements: MultiWeekSchedulePlacement[] = []
  const unplaced: MultiWeekUnplacedMatch[] = []
  const warnings: string[] = []

  for (const match of sortMatches(unplannedMatches, options.preferRoundOrder)) {
    const courts = courtsForMatch(match, options.venueMode, teamsById, neutralCourts)
    let best:
      | { date: string; score: number; warnings: string[]; court: CourtResource; start: number }
      | null = null

    for (const date of allowedDates) {
      if (!canPlaceOnDate(match, date, participantsByDate)) continue
      const slot = findSlot(date, courts, occupancy, match.durationMinutes, minGap)
      if (!slot) continue
      const candidate = candidateScore(
        match,
        date,
        options,
        gamesByParticipantWeek,
        matchesByDate,
        homeCountByTeam,
        awayCountByTeam
      )
      if (!best || candidate.score < best.score) {
        best = {
          date,
          score: candidate.score,
          warnings: candidate.warnings,
          court: slot.court,
          start: slot.start,
        }
      }
    }

    if (!best) {
      unplaced.push({ matchId: match.id, reason: noDateReason })
      continue
    }

    const kickoffTime = buildIsoFromLondonTime(
      `${best.date}T08:00:00.000Z`,
      minutesToHm(best.start)
    )
    placements.push({
      matchId: match.id,
      kickoffTime,
      court: best.court.label,
      date: best.date,
      warnings: best.warnings,
    })

    for (const warning of best.warnings) warnings.push(`${match.id}: ${warning}`)
    recordParticipantUsage(match, best.date, participantsByDate, gamesByParticipantWeek)
    matchesByDate.set(best.date, (matchesByDate.get(best.date) ?? 0) + 1)
    reserveSlot(occupancy, best.date, best.court.label, best.start, best.start + match.durationMinutes)
    if (match.homeTeamId) homeCountByTeam.set(match.homeTeamId, (homeCountByTeam.get(match.homeTeamId) ?? 0) + 1)
    if (match.awayTeamId) awayCountByTeam.set(match.awayTeamId, (awayCountByTeam.get(match.awayTeamId) ?? 0) + 1)
  }

  return {
    placements,
    unplaced,
    playableDates,
    warnings,
    stats: {
      totalUnplanned: unplannedMatches.length,
      placed: placements.length,
    },
  }
}

/**
 * Find the next free court + kickoff time for a single fixture dropped onto a
 * specific date (drag-and-drop). `locks` are the fixtures already scheduled on
 * that date whose court/time must be avoided. Returns null when the day is full.
 */
export function placeMatchOnDate(input: {
  match: MultiWeekScheduleMatch
  date: string
  locks: MultiWeekScheduleMatch[]
  teams: MultiWeekScheduleTeam[]
  venues: MultiWeekScheduleVenue[]
  venueMode: LeagueVenueMode
  minGapMinutes?: number
}): { kickoffTime: string; court: string | null } | null {
  const { match, date, locks, teams, venues, venueMode } = input
  const minGap = Math.max(0, input.minGapMinutes ?? 0)
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const neutralCourts = neutralCourtResources(venues)
  const occupancy = new Map<string, Map<string, Array<[number, number]>>>()

  for (const lock of locks) {
    if (lock.id === match.id || !lock.kickoffTime || !lock.court) continue
    if (londonDateKey(lock.kickoffTime) !== date) continue
    const start = londonMinutesOfDay(lock.kickoffTime)
    reserveSlot(occupancy, date, lock.court, start, start + lock.durationMinutes)
  }

  const courts = courtsForMatch(match, venueMode, teamsById, neutralCourts)
  const slot = findSlot(date, courts, occupancy, match.durationMinutes, minGap)
  if (!slot) return null

  return {
    kickoffTime: buildIsoFromLondonTime(`${date}T08:00:00.000Z`, minutesToHm(slot.start)),
    court: slot.court.label,
  }
}
