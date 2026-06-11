import { describe, expect, it } from 'vitest'
import {
  defaultFormatBuilderOptions,
  formatBuilderById,
  resolvePlaceholderTeamCount,
  resolveFormatBuilder,
} from '@/lib/formatBuilders'
import { matchStageLabel, matchStageRoundLabel } from '@/lib/matchLabel'
import {
  defaultPhaseForAgeGroup,
  effectiveScoringSystemForPhase,
  matchesForPhase,
  sortedPhasesForAgeGroup,
} from '@/lib/scoring'
import { slugify } from '@/lib/slugify'
import { calculateStandings, pointsForMatch } from '@/lib/standings'
import { buildReadyChecks, buildStatusChecks } from '@/lib/structureValidation'
import type {
  Division,
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  ScoringSystem,
  Team,
} from '@/lib/types'

const scoringSystem: ScoringSystem = {
  id: 'scoring-1',
  name: 'QA Netball',
  sport_type: 'Netball',
  win_pts: 5,
  draw_pts: 3,
  loss_pts: 0,
  ot_win_pts: null,
  so_win_pts: null,
  bonus_loss_pts: 1,
  bonus_loss_threshold_type: 'percentage',
  bonus_loss_threshold_value: 50,
  bonus_offense_pts: 0,
  bonus_offense_threshold: null,
  forfeit_win_pts: 5,
  forfeit_loss_pts: 0,
  forfeit_win_score_for: 20,
  forfeit_win_score_against: 0,
  tie_breaker_config: ['points', 'goal_difference', 'goals_for'],
  created_at: '2026-01-01T00:00:00.000Z',
}

function team(id: string, name: string): Team {
  return {
    id,
    name,
    short_name: null,
    color: null,
    logo_url: null,
    home_venue_name: null,
    home_venue_address: null,
    home_venue_postcode: null,
    home_venue_notes: null,
    age_group_id: 'division-1',
    deleted_at: null,
  }
}

function match(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    age_group_id: 'division-1',
    phase_id: null,
    pool_id: null,
    phase_element_id: null,
    competition_date_id: null,
    home_team_id: null,
    away_team_id: null,
    home_slot_id: null,
    away_slot_id: null,
    home_score: null,
    away_score: null,
    court: null,
    kickoff_time: '2026-06-06T09:00:00.000Z',
    status: 'scheduled',
    home_umpire_no_show: false,
    away_umpire_no_show: false,
    home_late_minutes: 0,
    away_late_minutes: 0,
    home_no_show: false,
    away_no_show: false,
    scoresheet_url: null,
    duration_minutes: 20,
    is_planned: false,
    deleted_at: null,
    round_number: null,
    ...overrides,
  }
}

function phase(overrides: Partial<Phase>): Phase {
  return {
    id: 'phase-1',
    age_group_id: 'division-1',
    slug: 'round-robin',
    name: 'Round Robin',
    phase_type: 'round_robin',
    display_order: 1,
    standings_mode: 'visible',
    scoring_system_id: null,
    scoring_system: undefined,
    match_format: 'continuous',
    period_minutes: 10,
    break_q1_q2_minutes: 0,
    break_half_time_minutes: 0,
    break_q3_q4_minutes: 0,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function division(overrides: Partial<Division>): Division {
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
    scoring_system_id: scoringSystem.id,
    scoring_system: scoringSystem,
    phases: [],
    ...overrides,
  }
}

function pool(overrides: Partial<Pool>): Pool {
  return {
    id: 'pool-1',
    phase_id: 'phase-1',
    slug: 'default',
    name: 'Default Pool',
    display_order: 1,
    is_default: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function poolTeam(overrides: Partial<PoolTeam>): PoolTeam {
  return {
    pool_id: 'pool-1',
    team_id: 'team-1',
    display_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function element(overrides: Partial<PhaseElement>): PhaseElement {
  return {
    id: 'element-1',
    phase_id: 'phase-1',
    pool_id: 'pool-1',
    slug: 'default',
    name: 'Default Pool',
    element_type: 'group',
    display_order: 1,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function slot(overrides: Partial<ElementSlot>): ElementSlot {
  return {
    id: 'slot-1',
    phase_element_id: 'element-1',
    display_order: 1,
    label: null,
    slot_type: 'source',
    team_id: null,
    source_phase_id: null,
    source_element_id: null,
    source_pool_id: null,
    source_match_id: null,
    source_rank: null,
    source_outcome: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function progressionRule(overrides: Partial<ProgressionRule>): ProgressionRule {
  return {
    id: 'rule-1',
    from_phase_id: 'phase-1',
    from_element_id: 'element-1',
    from_pool_id: 'pool-1',
    from_match_id: null,
    source_type: 'standings_rank',
    source_rank: 1,
    to_phase_id: 'phase-2',
    to_element_id: 'element-2',
    to_slot_id: null,
    to_slot_order: 1,
    display_order: 1,
    rule_config: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('slugify', () => {
  it('normalises names into URL-safe slugs', () => {
    expect(slugify(" Under 11's  Premier / Pool A ")).toBe('under-11s-premier-pool-a')
  })
})

describe('match labels', () => {
  it('uses pool, element, then phase labels in priority order', () => {
    const pools = new Map([['pool-1', { name: 'Pool A' }]])
    const elements = new Map([['element-1', { name: 'Semi-final 1' }]])
    const phases = new Map([['phase-1', { name: 'Finals' }]])

    expect(
      matchStageLabel(
        { pool_id: 'pool-1', phase_element_id: 'element-1', phase_id: 'phase-1' },
        pools,
        elements,
        phases
      )
    ).toBe('Pool A')
    expect(
      matchStageRoundLabel(
        { pool_id: null, phase_element_id: 'element-1', phase_id: 'phase-1', round_number: 2 },
        pools,
        elements,
        phases
      )
    ).toBe('Semi-final 1 · Round 2')
  })
})

describe('standings and scoring', () => {
  it('awards win, draw and strict losing bonus points', () => {
    expect(pointsForMatch(10, 5, scoringSystem)).toEqual({ home: 5, away: 0 })
    expect(pointsForMatch(10, 6, scoringSystem)).toEqual({ home: 5, away: 1 })
    expect(pointsForMatch(8, 8, scoringSystem)).toEqual({ home: 3, away: 3 })
  })

  it('calculates standings from completed matches only', () => {
    const teams = [team('team-a', 'Alpha'), team('team-b', 'Beta'), team('team-c', 'Comet')]
    const rows = calculateStandings(
      teams,
      [
        match({
          id: 'match-1',
          home_team_id: 'team-a',
          away_team_id: 'team-b',
          home_score: 10,
          away_score: 6,
          status: 'completed',
        }),
        match({
          id: 'match-2',
          home_team_id: 'team-c',
          away_team_id: 'team-a',
          home_score: 8,
          away_score: 8,
          status: 'completed',
        }),
        match({
          id: 'match-3',
          home_team_id: 'team-b',
          away_team_id: 'team-c',
          home_score: 20,
          away_score: 0,
          status: 'scheduled',
        }),
      ],
      scoringSystem
    )

    expect(rows.map((row) => [row.position, row.team.name, row.played, row.points])).toEqual([
      [1, 'Alpha', 2, 8],
      [2, 'Comet', 1, 3],
      [3, 'Beta', 1, 1],
    ])
  })

  it('applies no-show forfeits and umpire penalties', () => {
    const rows = calculateStandings(
      [team('team-a', 'Alpha'), team('team-b', 'Beta')],
      [
        match({
          home_team_id: 'team-a',
          away_team_id: 'team-b',
          home_score: 0,
          away_score: 0,
          status: 'completed',
          home_no_show: true,
          away_umpire_no_show: true,
        }),
      ],
      scoringSystem
    )

    expect(rows.find((row) => row.team.id === 'team-a')).toMatchObject({
      played: 1,
      lost: 1,
      goals_for: 0,
      goals_against: 20,
      points: 0,
    })
    expect(rows.find((row) => row.team.id === 'team-b')).toMatchObject({
      played: 1,
      won: 1,
      goals_for: 20,
      goals_against: 0,
      points: 4,
    })
  })
})

describe('phase scoring helpers', () => {
  it('sorts phases and prefers the round-robin phase as the default', () => {
    const finals = phase({ id: 'phase-2', slug: 'finals', name: 'Finals', display_order: 1 })
    const roundRobin = phase({ id: 'phase-1', slug: 'round-robin', name: 'Round Robin', display_order: 2 })
    const ageGroup = division({ phases: [roundRobin, finals] })

    expect(sortedPhasesForAgeGroup(ageGroup).map((item) => item.slug)).toEqual([
      'finals',
      'round-robin',
    ])
    expect(defaultPhaseForAgeGroup(ageGroup)?.slug).toBe('round-robin')
  })

  it('uses phase scoring before division fallback and filters matches by phase', () => {
    const phaseScoring = { ...scoringSystem, id: 'phase-scoring', win_pts: 7 }
    const selectedPhase = phase({ id: 'phase-1', scoring_system: phaseScoring })
    const ageGroup = division({ scoring_system: scoringSystem })

    expect(effectiveScoringSystemForPhase(ageGroup, selectedPhase)?.win_pts).toBe(7)
    expect(
      matchesForPhase(selectedPhase, [
        match({ id: 'match-1', phase_id: 'phase-1' }),
        match({ id: 'match-2', phase_id: 'phase-2' }),
      ]).map((item) => item.id)
    ).toEqual(['match-1'])
  })
})

describe('format builders', () => {
  it('creates cross-pool semi-finals for the default group-stage finals format', () => {
    const builder = formatBuilderById('group-stage-finals')
    expect(builder).toBeDefined()
    const resolved = resolveFormatBuilder(builder!, defaultFormatBuilderOptions(builder!))

    expect(resolved.phases.map((item) => item.slug)).toEqual([
      'group-stage',
      'semi-finals',
      'finals',
    ])
    expect(resolved.phases.find((item) => item.slug === 'semi-finals')?.pools).toHaveLength(2)
    expect(resolved.progressions?.slice(0, 4).map((item) => ({
      fromPool: item.fromPool,
      ranks: item.ranks,
      toPool: item.toPool,
      startSlot: item.startSlot,
    }))).toEqual([
      { fromPool: 'pool-a', ranks: [1], toPool: 'match-1', startSlot: 1 },
      { fromPool: 'pool-b', ranks: [2], toPool: 'match-1', startSlot: 2 },
      { fromPool: 'pool-b', ranks: [1], toPool: 'match-2', startSlot: 1 },
      { fromPool: 'pool-a', ranks: [2], toPool: 'match-2', startSlot: 2 },
    ])
  })

  it('creates a top-four double-elimination follow-on with loser progression', () => {
    const builder = formatBuilderById('league-season')
    expect(builder).toBeDefined()
    const resolved = resolveFormatBuilder(builder!, {
      ...defaultFormatBuilderOptions(builder!),
      finalsStyle: 'top4_double_elimination',
    })

    expect(resolved.phases.map((item) => item.slug)).toEqual([
      'league-season',
      'major-minor-finals',
      'preliminary-final',
      'grand-final',
    ])
    expect(resolved.progressions).toContainEqual(
      expect.objectContaining({
        fromPhase: 'major-minor-finals',
        fromPool: 'major-semi-final',
        sourceType: 'match_loser',
        toPhase: 'preliminary-final',
      })
    )
  })

  it('lets round-robin final placings choose all placement matches', () => {
    const builder = formatBuilderById('round-robin-placement')
    expect(builder).toBeDefined()
    const resolved = resolveFormatBuilder(builder!, {
      ...defaultFormatBuilderOptions(builder!),
      teamCount: 6,
      placementStyle: 'all_placements',
    })

    expect(resolved.phases.find((item) => item.slug === 'placement-finals')?.pools.map((item) => item.name)).toEqual([
      'Final',
      '3rd Place',
      '5th Place',
    ])
    expect(resolved.progressions).toHaveLength(6)
  })
})

describe('structure validation', () => {
  it('detects duplicate pool assignments and unresolved placeholder fixtures', () => {
    const teams = [team('team-a', 'Alpha'), team('team-b', 'Beta')]
    const poolA = pool({ id: 'pool-a', name: 'Pool A', pool_teams: [
      poolTeam({ pool_id: 'pool-a', team_id: 'team-a' }),
    ] })
    const poolB = pool({ id: 'pool-b', name: 'Pool B', pool_teams: [
      poolTeam({ pool_id: 'pool-b', team_id: 'team-a' }),
    ] })
    const targetSlot = slot({ id: 'slot-1', phase_element_id: 'element-1', label: 'Pool A winner' })
    const firstPhase = phase({
      id: 'phase-1',
      pools: [poolA, poolB],
      phase_elements: [element({ id: 'element-1', slots: [targetSlot] })],
    })

    const checks = buildStatusChecks(
      [firstPhase],
      teams,
      [
        match({
          phase_id: 'phase-1',
          pool_id: 'pool-a',
          home_slot_id: 'slot-1',
          away_team_id: 'team-b',
          status: 'scheduled',
        }),
      ],
      []
    )

    expect(checks.find((check) => check.id === 'duplicate-teams')?.ok).toBe(false)
    expect(checks.find((check) => check.id === 'unresolved-placeholders')?.ok).toBe(false)
  })

  it('treats future unresolved fixtures as informational ready checks', () => {
    const targetSlot = slot({ id: 'slot-1', phase_element_id: 'element-2', label: 'Winner of Semi-final 1' })
    const futurePhase = phase({
      id: 'phase-2',
      slug: 'finals',
      name: 'Finals',
      display_order: 2,
      phase_type: 'knockout',
      pools: [pool({ id: 'pool-2', phase_id: 'phase-2', name: 'Final' })],
      phase_elements: [element({ id: 'element-2', phase_id: 'phase-2', pool_id: 'pool-2', slots: [targetSlot] })],
    })

    const checks = buildReadyChecks({
      phases: [futurePhase],
      teams: [team('team-a', 'Alpha')],
      matches: [
        match({
          phase_id: 'phase-2',
          pool_id: 'pool-2',
          home_slot_id: 'slot-1',
          away_team_id: 'team-a',
          status: 'scheduled',
        }),
      ],
      progressionRules: [
        progressionRule({
          to_phase_id: 'phase-2',
          to_element_id: 'element-2',
          to_slot_order: 1,
        }),
      ],
    })

    expect(checks.find((check) => check.id === 'future-fixtures')).toMatchObject({
      ok: false,
      status: 'info',
    })
  })
})

describe('resolvePlaceholderTeamCount', () => {
  const twoPools = formatBuilderById('two-pools')!
  const roundRobin = formatBuilderById('simple-round-robin')!

  it('prefers an explicit expectedTeamCount', () => {
    expect(resolvePlaceholderTeamCount(twoPools, { expectedTeamCount: 12 })).toBe(12)
  })

  it('falls back to teamCount when expectedTeamCount is null', () => {
    expect(
      resolvePlaceholderTeamCount(twoPools, { expectedTeamCount: null, teamCount: 16 })
    ).toBe(16)
  })

  it('uses the pool-derived count for pool templates', () => {
    expect(resolvePlaceholderTeamCount(twoPools, { poolCount: 2, teamsPerPool: 6 })).toBe(12)
  })

  it('falls back to 8 for a template with no count configuration', () => {
    expect(resolvePlaceholderTeamCount(roundRobin, {})).toBe(8)
  })

  it('clamps to the valid 2–512 range', () => {
    expect(resolvePlaceholderTeamCount(roundRobin, { expectedTeamCount: 1 })).toBe(2)
    expect(resolvePlaceholderTeamCount(roundRobin, { expectedTeamCount: 9999 })).toBe(512)
  })
})
