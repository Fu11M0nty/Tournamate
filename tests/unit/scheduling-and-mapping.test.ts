import { describe, expect, it } from 'vitest'
import { autoPlan } from '@/lib/autoPlan'
import {
  buildQualificationMappings,
  slotOutcomeToSourceType,
  sourceTypeToSlotOutcome,
} from '@/lib/qualificationMappings'
import {
  dateSlugForLegacyDay,
  labelForLegacyDay,
  legacyDayForDateSlug,
  legacyDaysForTournament,
} from '@/lib/competitionDates'
import { describeMatchRules, totalMatchMinutes } from '@/lib/matchRules'
import type {
  CompetitionDate,
  Division,
  ElementSlot,
  PhaseElement,
  ProgressionRule,
  Tournament,
} from '@/lib/types'

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tournament-1',
    slug: 'qa-tournament',
    name: 'QA Tournament',
    start_date: '2026-06-06',
    end_date: '2026-06-07',
    status: 'upcoming',
    display_order: 1,
    courts: [],
    schedule_locked: false,
    created_by: 'user-1',
    sport: 'Netball',
    sport_other: null,
    default_scoring_system_id: null,
    venue_name: null,
    venue_city: null,
    venue_county: null,
    venue_postcode: null,
    description: null,
    is_public: true,
    ...overrides,
  }
}

function division(overrides: Partial<Division> = {}): Division {
  return {
    id: 'division-1',
    tournament_id: 'tournament-1',
    name: 'QA Division',
    slug: 'qa-division',
    day: 'saturday',
    display_order: 1,
    gender: null,
    skill_level: null,
    match_format: 'continuous',
    period_minutes: 10,
    break_q1_q2_minutes: 0,
    break_half_time_minutes: 0,
    break_q3_q4_minutes: 0,
    scoring_system_id: null,
    scoring_system: undefined,
    phases: [],
    ...overrides,
  }
}

function competitionDate(overrides: Partial<CompetitionDate> = {}): CompetitionDate {
  return {
    id: 'date-1',
    tournament_id: 'tournament-1',
    slug: 'day-1',
    label: 'Day 1',
    date: '2026-06-06',
    display_order: 1,
    legacy_day: 'saturday',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function element(overrides: Partial<PhaseElement> = {}): PhaseElement {
  return {
    id: 'element-1',
    phase_id: 'phase-2',
    pool_id: 'pool-2',
    slug: 'match-1',
    name: 'Semi-final 1',
    element_type: 'single_match',
    display_order: 1,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function slot(overrides: Partial<ElementSlot> = {}): ElementSlot {
  return {
    id: 'slot-1',
    phase_element_id: 'element-1',
    display_order: 1,
    label: 'Pool A winner',
    slot_type: 'source',
    team_id: null,
    source_phase_id: 'phase-1',
    source_element_id: 'element-source',
    source_pool_id: 'pool-a',
    source_match_id: null,
    source_rank: 1,
    source_outcome: 'rank',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function rule(overrides: Partial<ProgressionRule> = {}): ProgressionRule {
  return {
    id: 'rule-1',
    from_phase_id: 'phase-1',
    from_element_id: 'element-source',
    from_pool_id: 'pool-a',
    from_match_id: null,
    source_type: 'standings_rank',
    source_rank: 1,
    to_phase_id: 'phase-2',
    to_element_id: 'element-1',
    to_slot_id: 'slot-1',
    to_slot_order: null,
    display_order: 1,
    rule_config: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('autoPlan', () => {
  it('places independent matches on free courts at the same round start', () => {
    const result = autoPlan({
      courts: [
        { name: 'Court 1', startMin: 540, endMin: 600 },
        { name: 'Court 2', startMin: 540, endMin: 600 },
      ],
      matches: [
        {
          id: 'match-1',
          ageGroupId: 'division-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          durationMinutes: 10,
        },
        {
          id: 'match-2',
          ageGroupId: 'division-2',
          homeTeamId: 'team-c',
          awayTeamId: 'team-d',
          durationMinutes: 10,
        },
      ],
      locks: [],
      backToBackMin: 0,
    })

    expect(result.placements).toHaveLength(2)
    expect(result.placements.map((placement) => placement.startMin)).toEqual([540, 540])
    expect(result.unplacedIds).toEqual([])
    expect(result.stats).toMatchObject({ totalUnplanned: 2, placed: 2, earliestStart: 540, latestEnd: 550 })
  })

  it('respects team rest time and match not-before constraints', () => {
    const result = autoPlan({
      courts: [{ name: 'Court 1', startMin: 540, endMin: 620 }],
      matches: [
        {
          id: 'match-1',
          ageGroupId: 'division-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          durationMinutes: 10,
        },
        {
          id: 'match-2',
          ageGroupId: 'division-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-c',
          durationMinutes: 10,
          notBeforeMin: 555,
        },
      ],
      locks: [],
      backToBackMin: 15,
    })

    expect(result.placements).toEqual([
      { matchId: 'match-1', court: 'Court 1', startMin: 540 },
      { matchId: 'match-2', court: 'Court 1', startMin: 565 },
    ])
  })

  it('reports matches that cannot fit inside court windows', () => {
    const result = autoPlan({
      courts: [{ name: 'Court 1', startMin: 540, endMin: 550 }],
      matches: [
        {
          id: 'too-long',
          ageGroupId: 'division-1',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          durationMinutes: 20,
        },
      ],
      locks: [],
      backToBackMin: 0,
    })

    expect(result.placements).toEqual([])
    expect(result.unplacedIds).toEqual(['too-long'])
  })
})

describe('qualification mappings', () => {
  it('maps source types to slot outcomes and back', () => {
    expect(sourceTypeToSlotOutcome('match_winner')).toBe('winner')
    expect(sourceTypeToSlotOutcome('match_loser')).toBe('loser')
    expect(sourceTypeToSlotOutcome('best_rank')).toBe('best_rank')
    expect(sourceTypeToSlotOutcome('standings_rank')).toBe('rank')

    expect(slotOutcomeToSourceType('winner')).toBe('match_winner')
    expect(slotOutcomeToSourceType('loser')).toBe('match_loser')
    expect(slotOutcomeToSourceType('rank')).toBe('standings_rank')
  })

  it('links slots to progression rules by target slot id', () => {
    const mappings = buildQualificationMappings({
      targetElements: [element()],
      slots: [slot()],
      rules: [rule()],
    })

    expect(mappings).toHaveLength(1)
    expect(mappings[0]).toMatchObject({
      id: 'slot-1',
      sourceType: 'standings_rank',
      sourcePoolId: 'pool-a',
      sourceRank: 1,
      isLinked: true,
      mismatchReasons: [],
    })
  })

  it('flags source slots without matching rules and mismatched source details', () => {
    const mappings = buildQualificationMappings({
      targetElements: [element()],
      slots: [slot({ source_pool_id: 'pool-b', source_rank: 2 })],
      rules: [rule({ from_pool_id: 'pool-a', source_rank: 1, to_slot_id: 'slot-1' })],
    })

    expect(mappings[0].mismatchReasons).toContain('Slot source pool and progression rule pool do not match.')
    expect(mappings[0].mismatchReasons).toContain('Slot source rank and progression rule rank do not match.')

    const unlinked = buildQualificationMappings({
      targetElements: [element()],
      slots: [slot({ id: 'slot-2' })],
      rules: [],
    })
    expect(unlinked[0]).toMatchObject({
      isLinked: false,
      mismatchReasons: ['Source slot has no matching progression rule.'],
    })
  })
})

describe('competition dates', () => {
  it('derives legacy days from tournament date range', () => {
    expect(legacyDaysForTournament(tournament({ end_date: null }))).toEqual(['saturday'])
    expect(legacyDaysForTournament(tournament())).toEqual(['saturday', 'sunday'])
  })

  it('labels legacy days from tournament dates', () => {
    expect(labelForLegacyDay(tournament(), 'saturday')).toBe('Sat 6 Jun')
    expect(labelForLegacyDay(tournament(), 'sunday')).toBe('Sun 7 Jun')
  })

  it('maps between legacy days and configured date slugs', () => {
    const dates = [
      { ...competitionDate({ slug: 'opening-day', legacy_day: 'saturday' }), is_derived: false },
      { ...competitionDate({ id: 'date-2', slug: 'finals-day', legacy_day: 'sunday' }), is_derived: false },
    ]

    expect(dateSlugForLegacyDay(dates, 'saturday')).toBe('opening-day')
    expect(dateSlugForLegacyDay(dates, 'sunday')).toBe('finals-day')
    expect(legacyDayForDateSlug(dates, 'finals-day')).toBe('sunday')
    expect(legacyDayForDateSlug(dates, 'missing')).toBeNull()
  })
})

describe('match rules', () => {
  it('calculates total match minutes for every supported format', () => {
    expect(totalMatchMinutes({ match_format: 'continuous', period_minutes: 10, break_q1_q2_minutes: 0, break_half_time_minutes: 0, break_q3_q4_minutes: 0 })).toBe(10)
    expect(totalMatchMinutes({ match_format: 'halves', period_minutes: 8, break_q1_q2_minutes: 0, break_half_time_minutes: 2, break_q3_q4_minutes: 0 })).toBe(18)
    expect(totalMatchMinutes({ match_format: 'quarters', period_minutes: 6, break_q1_q2_minutes: 1, break_half_time_minutes: 3, break_q3_q4_minutes: 1 })).toBe(29)
  })

  it('describes continuous match rules in organiser language', () => {
    expect(describeMatchRules(division({ match_format: 'continuous', period_minutes: 12 }))).toBe('12 min straight')
  })
})
