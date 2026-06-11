import { describe, expect, it } from 'vitest'
import { findDuplicateMatchIds } from '@/lib/matches'
import type { Match } from '@/lib/types'

function match(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    age_group_id: 'division-1',
    phase_id: 'phase-1',
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

describe('findDuplicateMatchIds', () => {
  it('does not flag a home-and-away pair as duplicates', () => {
    const matches = [
      match({ id: 'leg-home', home_team_id: 'a', away_team_id: 'b', round_number: 1 }),
      match({ id: 'leg-away', home_team_id: 'b', away_team_id: 'a', round_number: 2 }),
    ]
    expect(findDuplicateMatchIds(matches).size).toBe(0)
  })

  it('flags the same orientation scheduled twice in the same round', () => {
    const matches = [
      match({ id: 'first', home_team_id: 'a', away_team_id: 'b', round_number: 1 }),
      match({ id: 'second', home_team_id: 'a', away_team_id: 'b', round_number: 1 }),
    ]
    expect(findDuplicateMatchIds(matches)).toEqual(new Set(['first', 'second']))
  })

  it('treats different rounds of the same orientation as legitimate', () => {
    const matches = [
      match({ id: 'r1', home_team_id: 'a', away_team_id: 'b', round_number: 1 }),
      match({ id: 'r5', home_team_id: 'a', away_team_id: 'b', round_number: 5 }),
    ]
    expect(findDuplicateMatchIds(matches).size).toBe(0)
  })

  it('does not flag the same pair appearing in different phases', () => {
    const matches = [
      match({ id: 'group', phase_id: 'group', home_team_id: 'a', away_team_id: 'b' }),
      match({ id: 'final', phase_id: 'final', home_team_id: 'a', away_team_id: 'b' }),
    ]
    expect(findDuplicateMatchIds(matches).size).toBe(0)
  })

  it('flags a true duplicate with no round set', () => {
    const matches = [
      match({ id: 'one', home_team_id: 'a', away_team_id: 'b', round_number: null }),
      match({ id: 'two', home_team_id: 'a', away_team_id: 'b', round_number: null }),
    ]
    expect(findDuplicateMatchIds(matches)).toEqual(new Set(['one', 'two']))
  })

  it('handles slot-based entrants without throwing', () => {
    const matches = [
      match({ id: 's1', home_team_id: null, home_slot_id: 'slot-1', away_slot_id: 'slot-2' }),
      match({ id: 's2', home_team_id: null, home_slot_id: 'slot-1', away_slot_id: 'slot-2' }),
    ]
    expect(findDuplicateMatchIds(matches)).toEqual(new Set(['s1', 's2']))
  })
})
