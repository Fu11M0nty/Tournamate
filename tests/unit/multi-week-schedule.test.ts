import { describe, expect, it } from 'vitest'
import {
  countAvailableSlots,
  generatePlayableDates,
  placeMatchOnDate,
  planMultiWeekSchedule,
  type MultiWeekScheduleMatch,
} from '@/lib/multiWeekSchedule'

function match(overrides: Partial<MultiWeekScheduleMatch>): MultiWeekScheduleMatch {
  return {
    id: 'match',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeSlotId: null,
    awaySlotId: null,
    roundNumber: 1,
    status: 'scheduled',
    isPlanned: false,
    kickoffTime: null,
    court: null,
    durationMinutes: 60,
    ...overrides,
  }
}

const baseOptions = {
  startDate: '2026-06-02',
  endDate: '2026-06-13',
  playableWeekdays: [2, 6],
  venueMode: 'neutral_venues' as const,
  maxGamesPerTeamPerWeek: null,
  preferRoundOrder: true,
  preferHomeAwayBalance: true,
  defaultKickoffTime: '19:00',
}

describe('generatePlayableDates', () => {
  it('includes only configured weekdays inside the date window', () => {
    expect(generatePlayableDates('2026-06-01', '2026-06-10', [2, 6])).toEqual([
      '2026-06-02',
      '2026-06-06',
      '2026-06-09',
    ])
  })

  it('returns no dates for an empty weekday set', () => {
    expect(generatePlayableDates('2026-06-01', '2026-06-10', [])).toEqual([])
  })
})

describe('planMultiWeekSchedule', () => {
  it('prevents a team from being scheduled twice on the same day', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b' }),
        match({ id: 'm2', homeTeamId: 'a', awayTeamId: 'c' }),
      ],
      teams: [],
      venues: [{ name: 'Main Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
      },
    })

    expect(result.placements.map((placement) => placement.matchId)).toEqual(['m1'])
    expect(result.unplaced).toEqual([
      {
        matchId: 'm2',
        reason: 'No playable date could satisfy same-day team and venue constraints.',
      },
    ])
  })

  it('treats max games per team per week as a soft warning', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b' }),
        match({ id: 'm2', homeTeamId: 'a', awayTeamId: 'c' }),
      ],
      teams: [],
      venues: [{ name: 'Main Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-06',
        maxGamesPerTeamPerWeek: 1,
      },
    })

    expect(result.placements).toHaveLength(2)
    expect(result.warnings.some((warning) => warning.includes('Exceeds 1 game'))).toBe(true)
  })

  it('preserves locked matches and schedules around them', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({
          id: 'locked',
          homeTeamId: 'a',
          awayTeamId: 'b',
          isPlanned: true,
          kickoffTime: '2026-06-02T18:00:00.000Z',
        }),
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'c' }),
      ],
      teams: [],
      venues: [{ name: 'Main Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-06',
      },
    })

    expect(result.placements).toEqual([
      expect.objectContaining({ matchId: 'm1', date: '2026-06-06' }),
    ])
  })

  it('can flex round order when earlier rounds cannot be placed', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({
          id: 'locked',
          homeTeamId: 'a',
          awayTeamId: 'b',
          isPlanned: true,
          kickoffTime: '2026-06-02T18:00:00.000Z',
          roundNumber: 1,
        }),
        match({ id: 'round-1-blocked', homeTeamId: 'a', awayTeamId: 'c', roundNumber: 1 }),
        match({ id: 'round-2-open', homeTeamId: 'd', awayTeamId: 'e', roundNumber: 2 }),
      ],
      teams: [],
      venues: [{ name: 'Main Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
      },
    })

    expect(result.unplaced.map((item) => item.matchId)).toEqual(['round-1-blocked'])
    expect(result.placements.map((placement) => placement.matchId)).toEqual(['round-2-open'])
  })

  it('assigns neutral venues in neutral venue mode', () => {
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b' })],
      teams: [],
      venues: [{ name: 'Neutral Arena' }],
      options: baseOptions,
    })

    expect(result.placements[0]).toEqual(
      expect.objectContaining({ court: 'Neutral Arena' })
    )
  })

  it('assigns home team venues in home venue mode', () => {
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b' })],
      teams: [{ id: 'a', homeVenueName: 'A Ground', homeVenuePostcode: 'AB1 2CD' }],
      venues: [{ name: 'Neutral Arena' }],
      options: { ...baseOptions, venueMode: 'home_team_venues' },
    })

    expect(result.placements[0]).toEqual(
      expect.objectContaining({ court: 'A Ground - AB1 2CD' })
    )
  })

  it('packs several fixtures onto one court within the venue window', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b', durationMinutes: 60 }),
        match({ id: 'm2', homeTeamId: 'c', awayTeamId: 'd', durationMinutes: 60 }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '11:00', courtCount: 1 }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
      },
    })

    expect(result.placements).toHaveLength(2)
    const times = result.placements.map((p) => p.kickoffTime).sort()
    // Two 60-minute games back-to-back from 09:00 on the same single court.
    expect(times[0]).toContain('T08:00:00') // 09:00 BST == 08:00 UTC
    expect(times[1]).toContain('T09:00:00') // 10:00 BST == 09:00 UTC
    expect(new Set(result.placements.map((p) => p.court))).toEqual(new Set(['Sports Hall']))
  })

  it('runs fixtures in parallel across multiple courts at one venue', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b', durationMinutes: 60 }),
        match({ id: 'm2', homeTeamId: 'c', awayTeamId: 'd', durationMinutes: 60 }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '10:00', courtCount: 2 }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
      },
    })

    expect(result.placements).toHaveLength(2)
    // Both at 09:00 but on the two distinct courts.
    expect(result.placements.every((p) => p.kickoffTime.includes('T08:00:00'))).toBe(true)
    expect(new Set(result.placements.map((p) => p.court))).toEqual(
      new Set(['Sports Hall - Court 1', 'Sports Hall - Court 2'])
    )
  })

  it('honours the minimum gap between games on a court', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b', durationMinutes: 60 }),
        match({ id: 'm2', homeTeamId: 'c', awayTeamId: 'd', durationMinutes: 60 }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '11:00', courtCount: 1 }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
        minGapMinutes: 30,
      },
    })

    // 09:00–10:00 then a 30-min gap means the next game can't start until 10:30
    // and would run past the 11:00 close, so it can't be placed.
    expect(result.placements.map((p) => p.matchId)).toEqual(['m1'])
    expect(result.unplaced.map((item) => item.matchId)).toEqual(['m2'])
  })

  it('leaves a fixture unplanned when the day has no remaining capacity', () => {
    const result = planMultiWeekSchedule({
      matches: [
        match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b', durationMinutes: 60 }),
        match({ id: 'm2', homeTeamId: 'c', awayTeamId: 'd', durationMinutes: 60 }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '10:00', courtCount: 1 }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        playableWeekdays: [2],
      },
    })

    expect(result.placements.map((p) => p.matchId)).toEqual(['m1'])
    expect(result.unplaced.map((item) => item.matchId)).toEqual(['m2'])
  })

  it('keeps knockout fixtures on or after the earliest allowed date', () => {
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'ko', homeTeamId: 'a', awayTeamId: 'b' })],
      teams: [],
      venues: [{ name: 'Final Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-13',
        playableWeekdays: [2, 6],
        earliestDate: '2026-06-09',
      },
    })

    expect(result.placements).toHaveLength(1)
    expect(result.placements[0].date >= '2026-06-09').toBe(true)
  })

  it('reports knockout fixtures unplanned when no date follows the league phase', () => {
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'ko', homeTeamId: 'a', awayTeamId: 'b' })],
      teams: [],
      venues: [{ name: 'Final Venue' }],
      options: {
        ...baseOptions,
        startDate: '2026-06-02',
        endDate: '2026-06-06',
        playableWeekdays: [2, 6],
        earliestDate: '2026-07-01',
      },
    })

    expect(result.placements).toHaveLength(0)
    expect(result.unplaced).toEqual([
      {
        matchId: 'ko',
        reason: 'No playable date falls after the preceding phase has finished.',
      },
    ])
  })

  it('only schedules a venue on its own open weekdays', () => {
    // Phase allows Tue (2) and Wed (3); the venue is open Wednesdays only.
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'm1', homeTeamId: 'a', awayTeamId: 'b', durationMinutes: 60 })],
      teams: [],
      venues: [
        { name: 'Wednesday Hall', availableFrom: '09:00', availableTo: '17:00', courtCount: 1, playableWeekdays: [3] },
      ],
      options: {
        ...baseOptions,
        startDate: '2026-06-09', // Tuesday
        endDate: '2026-06-10', // Wednesday
        playableWeekdays: [2, 3],
      },
    })

    expect(result.placements).toHaveLength(1)
    expect(result.placements[0].date).toBe('2026-06-10') // forced onto the Wednesday
  })

  it('reports all unplanned fixtures when no playable dates exist', () => {
    const result = planMultiWeekSchedule({
      matches: [match({ id: 'm1' }), match({ id: 'm2' })],
      teams: [],
      venues: [],
      options: { ...baseOptions, playableWeekdays: [] },
    })

    expect(result.placements).toEqual([])
    expect(result.unplaced.map((item) => item.matchId)).toEqual(['m1', 'm2'])
  })
})

describe('placeMatchOnDate', () => {
  it('drops a fixture into the next free slot after existing fixtures', () => {
    const placement = placeMatchOnDate({
      match: match({ id: 'drop', durationMinutes: 60 }),
      date: '2026-06-06',
      locks: [
        match({
          id: 'locked',
          isPlanned: true,
          kickoffTime: '2026-06-06T08:00:00.000Z', // 09:00 BST
          court: 'Sports Hall',
          durationMinutes: 60,
        }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '12:00', courtCount: 1 }],
      venueMode: 'neutral_venues',
    })

    expect(placement).not.toBeNull()
    expect(placement?.court).toBe('Sports Hall')
    expect(placement?.kickoffTime).toContain('T09:00:00') // 10:00 BST, after the lock
  })

  it('returns null when the chosen day has no free slot', () => {
    const placement = placeMatchOnDate({
      match: match({ id: 'drop', durationMinutes: 60 }),
      date: '2026-06-06',
      locks: [
        match({
          id: 'locked',
          isPlanned: true,
          kickoffTime: '2026-06-06T08:00:00.000Z',
          court: 'Sports Hall',
          durationMinutes: 60,
        }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '10:00', courtCount: 1 }],
      venueMode: 'neutral_venues',
    })

    expect(placement).toBeNull()
  })

  it('uses a second court in parallel when one is occupied', () => {
    const placement = placeMatchOnDate({
      match: match({ id: 'drop', durationMinutes: 60 }),
      date: '2026-06-06',
      locks: [
        match({
          id: 'locked',
          isPlanned: true,
          kickoffTime: '2026-06-06T08:00:00.000Z',
          court: 'Sports Hall - Court 1',
          durationMinutes: 60,
        }),
      ],
      teams: [],
      venues: [{ name: 'Sports Hall', availableFrom: '09:00', availableTo: '10:00', courtCount: 2 }],
      venueMode: 'neutral_venues',
    })

    expect(placement?.court).toBe('Sports Hall - Court 2')
    expect(placement?.kickoffTime).toContain('T08:00:00') // 09:00 BST, in parallel
  })

  it('refuses a drop on a day the venue is not open', () => {
    const placement = placeMatchOnDate({
      match: match({ id: 'drop', durationMinutes: 60 }),
      date: '2026-06-09', // Tuesday
      locks: [],
      teams: [],
      venues: [
        { name: 'Wednesday Hall', availableFrom: '09:00', availableTo: '17:00', courtCount: 1, playableWeekdays: [3] },
      ],
      venueMode: 'neutral_venues',
    })
    expect(placement).toBeNull()
  })
})

describe('countAvailableSlots', () => {
  const oneDay = ['2026-06-06']
  const hall = (courtCount: number) => [
    { name: 'Hall', availableFrom: '09:00', availableTo: '17:00', courtCount },
  ]

  it('counts back-to-back slots with no gap', () => {
    expect(countAvailableSlots(oneDay, hall(1), 60, 0)).toBe(8) // 8 hours / 60 min
  })

  it('reduces the slot count when a changeover gap is required', () => {
    expect(countAvailableSlots(oneDay, hall(1), 60, 15)).toBe(6) // floor(495 / 75)
  })

  it('multiplies by the court count', () => {
    expect(countAvailableSlots(oneDay, hall(2), 60, 0)).toBe(16)
  })

  it('multiplies across playable dates', () => {
    expect(countAvailableSlots(['2026-06-03', '2026-06-06'], hall(1), 60, 0)).toBe(16)
  })

  it('returns zero when the match is longer than the window', () => {
    expect(countAvailableSlots(oneDay, hall(1), 600, 0)).toBe(0)
  })

  it('only counts a venue on its open weekdays', () => {
    // 2026-06-10 is a Wednesday, 2026-06-11 a Thursday.
    const venues = [
      { name: 'Courtside', availableFrom: '19:00', availableTo: '22:00', courtCount: 1, playableWeekdays: [3] },
      { name: 'Hazeley', availableFrom: '20:00', availableTo: '21:00', courtCount: 1, playableWeekdays: [4] },
    ]
    // Wed: Courtside fits 3 (19/20/21); Hazeley closed. Thu: Hazeley fits 1; Courtside closed.
    expect(countAvailableSlots(['2026-06-10'], venues, 56, 4)).toBe(3)
    expect(countAvailableSlots(['2026-06-11'], venues, 56, 4)).toBe(1)
    expect(countAvailableSlots(['2026-06-10', '2026-06-11'], venues, 56, 4)).toBe(4)
  })
})
