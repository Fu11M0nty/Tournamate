import {
  assertQaSlug,
  createQaClient,
  ensureQaAdmin,
  maybe,
  must,
  qaSlug,
} from './qa-utils.mjs'

const slug = qaSlug()
assertQaSlug(slug)

const supabase = createQaClient()
const admin = await ensureQaAdmin(supabase)

await maybe(
  supabase
    .from('tournaments')
    .delete()
    .eq('slug', slug),
  'Pre-clean existing QA tournament'
)

const existingScoringRows = await must(
  supabase
    .from('scoring_systems')
    .select('id')
    .eq('name', 'QA Standard Netball')
    .limit(1),
  'Find QA scoring system'
)
const scoringRows = existingScoringRows[0] ?? (
  await must(
    supabase
      .from('scoring_systems')
      .insert({
        name: 'QA Standard Netball',
        sport_type: 'Netball',
        win_pts: 5,
        draw_pts: 3,
        loss_pts: 0,
        bonus_loss_pts: 1,
        bonus_loss_threshold_type: 'percentage',
        bonus_loss_threshold_value: 50,
        bonus_offense_pts: 0,
        bonus_offense_threshold: null,
        forfeit_win_pts: 5,
        forfeit_loss_pts: 0,
        forfeit_win_score_for: 20,
        forfeit_win_score_against: 0,
        tie_breaker_config: ['points', 'goal_difference', 'goals_for', 'head_to_head'],
      })
      .select('id')
      .single(),
    'Create QA scoring system'
  )
)

const tournament = await must(
  supabase
    .from('tournaments')
    .insert({
      slug,
      name: 'QA Smoke Tournament',
      start_date: '2026-06-06',
      end_date: '2026-06-07',
      status: 'upcoming',
      display_order: 9999,
      courts: ['Court 1', 'Court 2'],
      schedule_locked: false,
      sport: 'Netball',
      default_scoring_system_id: scoringRows.id,
      venue_name: 'QA Arena',
      venue_city: 'Milton Keynes',
      venue_county: 'Buckinghamshire',
      venue_postcode: 'MK1 1QA',
      description: 'Automated QA seed data. Safe to delete.',
      is_public: true,
      created_by: admin.id,
    })
    .select('id, slug')
    .single(),
  'Create QA tournament'
)

await must(
  supabase
    .from('tournament_venues')
    .insert([
      {
        tournament_id: tournament.id,
        name: 'QA Arena',
        address_line1: '1 Test Way',
        city: 'Milton Keynes',
        county: 'Buckinghamshire',
        postcode: 'MK1 1QA',
        country: 'United Kingdom',
        notes: 'Primary QA venue',
        display_order: 1,
      },
    ]),
  'Create QA venue'
)

const dates = await must(
  supabase
    .from('competition_dates')
    .insert([
      {
        tournament_id: tournament.id,
        slug: 'day-1',
        label: 'Saturday 6 June',
        date: '2026-06-06',
        display_order: 1,
        legacy_day: 'saturday',
      },
      {
        tournament_id: tournament.id,
        slug: 'day-2',
        label: 'Sunday 7 June',
        date: '2026-06-07',
        display_order: 2,
        legacy_day: 'sunday',
      },
    ])
    .select('id, slug'),
  'Create QA dates'
)

await must(
  supabase
    .from('courts')
    .insert([
      {
        tournament_id: tournament.id,
        name: 'Court 1',
        day: 'saturday',
        display_order: 1,
        start_time: '09:00',
        end_time: '17:00',
      },
      {
        tournament_id: tournament.id,
        name: 'Court 2',
        day: 'saturday',
        display_order: 2,
        start_time: '09:00',
        end_time: '17:00',
      },
    ]),
  'Create QA courts'
)

const divisions = await must(
  supabase
    .from('age_groups')
    .insert([
      {
        tournament_id: tournament.id,
        name: 'QA Under 10',
        slug: 'qa-under-10',
        day: 'saturday',
        display_order: 1,
        match_format: 'continuous',
        period_minutes: 10,
        scoring_system_id: scoringRows.id,
        metadata: { qa_seed: true, scenario: 'simple-round-robin' },
      },
      {
        tournament_id: tournament.id,
        name: 'QA Under 12',
        slug: 'qa-under-12',
        day: 'saturday',
        display_order: 2,
        match_format: 'halves',
        period_minutes: 8,
        scoring_system_id: scoringRows.id,
        metadata: { qa_seed: true, scenario: 'group-stage-finals' },
      },
    ])
    .select('id, slug'),
  'Create QA divisions'
)

const bySlug = new Map(divisions.map((division) => [division.slug, division]))
const under10 = bySlug.get('qa-under-10')
const under12 = bySlug.get('qa-under-12')
if (!under10 || !under12) throw new Error('Could not resolve QA divisions.')

const under10Teams = await must(
  supabase
    .from('teams')
    .insert(['Amber Aces', 'Blue Bolts', 'Crimson Comets', 'Emerald Eagles'].map((name, index) => ({
      age_group_id: under10.id,
      name,
      short_name: `QA10-${index + 1}`,
      color: ['#f59e0b', '#2563eb', '#dc2626', '#059669'][index],
    })))
    .select('id, name'),
  'Create QA Under 10 teams'
)

const under12Teams = await must(
  supabase
    .from('teams')
    .insert(['Falcons', 'Giants', 'Harriers', 'Icons', 'Jets', 'Kings', 'Lions', 'Meteors'].map((name, index) => ({
      age_group_id: under12.id,
      name: `QA ${name}`,
      short_name: `QA12-${index + 1}`,
      color: ['#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#6366f1', '#64748b'][index],
    })))
    .select('id, name'),
  'Create QA Under 12 teams'
)

const day1 = dates.find((date) => date.slug === 'day-1')
if (!day1) throw new Error('Could not resolve QA day 1.')

await seedSimpleRoundRobin({ supabase, division: under10, teams: under10Teams, scoringSystemId: scoringRows.id, competitionDateId: day1.id })
await seedGroupFinals({ supabase, division: under12, teams: under12Teams, scoringSystemId: scoringRows.id, competitionDateId: day1.id })

console.log(`Seeded ${slug}.`)
console.log(`QA admin: ${admin.email}`)
console.log(`Public URL: /${slug}/saturday/qa-under-10`)

async function seedSimpleRoundRobin({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phase = await must(
    supabase
      .from('phases')
      .insert({
        age_group_id: division.id,
        slug: 'round-robin',
        name: 'Round Robin',
        phase_type: 'round_robin',
        display_order: 1,
        standings_mode: 'visible',
        scoring_system_id: scoringSystemId,
        match_format: 'continuous',
        period_minutes: 10,
        metadata: { qa_seed: true },
      })
      .select('id')
      .single(),
    'Create QA Under 10 phase'
  )

  const pool = await must(
    supabase
      .from('pools')
      .upsert({
        phase_id: phase.id,
        slug: 'default',
        name: 'Default Pool',
        display_order: 1,
        is_default: true,
      }, { onConflict: 'phase_id,slug' })
      .select('id')
      .single(),
    'Create QA Under 10 pool'
  )

  await must(
    supabase
      .from('pool_teams')
      .insert(teams.map((team, index) => ({
        pool_id: pool.id,
        team_id: team.id,
        display_order: index + 1,
      }))),
    'Assign QA Under 10 teams'
  )

  await must(
    supabase
      .from('matches')
      .insert([
        matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T09:00:00+01:00', court: 'Court 1', homeScore: 14, awayScore: 10 }),
        matchRow({ division, phase, pool, competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T09:00:00+01:00', court: 'Court 2', homeScore: 9, awayScore: 9 }),
        matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[2], time: '2026-06-06T09:30:00+01:00', court: 'Court 1' }),
        matchRow({ division, phase, pool, competitionDateId, home: teams[1], away: teams[3], time: '2026-06-06T09:30:00+01:00', court: 'Court 2' }),
      ]),
    'Create QA Under 10 matches'
  )
}

async function seedGroupFinals({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await must(
    supabase
      .from('phases')
      .insert([
        {
          age_group_id: division.id,
          slug: 'group-stage',
          name: 'Group Stage',
          phase_type: 'group_stage',
          display_order: 1,
          standings_mode: 'visible',
          scoring_system_id: scoringSystemId,
          match_format: 'halves',
          period_minutes: 8,
          metadata: { qa_seed: true },
        },
        {
          age_group_id: division.id,
          slug: 'semi-finals',
          name: 'Semi-finals',
          phase_type: 'knockout',
          display_order: 2,
          standings_mode: 'hidden',
          scoring_system_id: scoringSystemId,
          match_format: 'halves',
          period_minutes: 8,
          metadata: { qa_seed: true },
        },
        {
          age_group_id: division.id,
          slug: 'finals',
          name: 'Finals',
          phase_type: 'knockout',
          display_order: 3,
          standings_mode: 'hidden',
          scoring_system_id: scoringSystemId,
          match_format: 'halves',
          period_minutes: 8,
          metadata: { qa_seed: true },
        },
      ])
      .select('id, slug'),
    'Create QA Under 12 phases'
  )
  const phaseBySlug = new Map(phases.map((phase) => [phase.slug, phase]))

  const pools = await must(
    supabase
      .from('pools')
      .upsert([
        { phase_id: phaseBySlug.get('group-stage').id, slug: 'pool-a', name: 'Pool A', display_order: 1, is_default: false },
        { phase_id: phaseBySlug.get('group-stage').id, slug: 'pool-b', name: 'Pool B', display_order: 2, is_default: false },
        { phase_id: phaseBySlug.get('semi-finals').id, slug: 'match-1', name: 'Semi-final 1', display_order: 1, is_default: false },
        { phase_id: phaseBySlug.get('semi-finals').id, slug: 'match-2', name: 'Semi-final 2', display_order: 2, is_default: false },
        { phase_id: phaseBySlug.get('finals').id, slug: 'match-1', name: 'Final', display_order: 1, is_default: false },
      ], { onConflict: 'phase_id,slug' })
      .select('id, slug, phase_id'),
    'Create QA Under 12 pools'
  )
  const poolKey = (phaseSlug, poolSlug) => `${phaseSlug}:${poolSlug}`
  const poolByKey = new Map(
    pools.map((pool) => [
      poolKey(phases.find((phase) => phase.id === pool.phase_id).slug, pool.slug),
      pool,
    ])
  )

  const poolA = poolByKey.get('group-stage:pool-a')
  const poolB = poolByKey.get('group-stage:pool-b')
  await must(
    supabase
      .from('pool_teams')
      .insert([
        ...teams.slice(0, 4).map((team, index) => ({ pool_id: poolA.id, team_id: team.id, display_order: index + 1 })),
        ...teams.slice(4, 8).map((team, index) => ({ pool_id: poolB.id, team_id: team.id, display_order: index + 1 })),
      ]),
    'Assign QA Under 12 teams'
  )

  await must(
    supabase
      .from('matches')
      .insert([
        matchRow({ division, phase: phaseBySlug.get('group-stage'), pool: poolA, competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T10:00:00+01:00', court: 'Court 1', homeScore: 18, awayScore: 12 }),
        matchRow({ division, phase: phaseBySlug.get('group-stage'), pool: poolA, competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T10:00:00+01:00', court: 'Court 2' }),
        matchRow({ division, phase: phaseBySlug.get('group-stage'), pool: poolB, competitionDateId, home: teams[4], away: teams[5], time: '2026-06-06T10:30:00+01:00', court: 'Court 1', homeScore: 11, awayScore: 15 }),
        matchRow({ division, phase: phaseBySlug.get('group-stage'), pool: poolB, competitionDateId, home: teams[6], away: teams[7], time: '2026-06-06T10:30:00+01:00', court: 'Court 2' }),
      ]),
    'Create QA Under 12 matches'
  )
}

function matchRow({ division, phase, pool, competitionDateId, home, away, time, court, homeScore = null, awayScore = null }) {
  const completed = homeScore !== null && awayScore !== null
  return {
    age_group_id: division.id,
    phase_id: phase.id,
    pool_id: pool.id,
    competition_date_id: competitionDateId,
    home_team_id: home.id,
    away_team_id: away.id,
    home_score: homeScore,
    away_score: awayScore,
    court,
    kickoff_time: time,
    status: completed ? 'completed' : 'scheduled',
    is_planned: true,
    is_placeholder: false,
  }
}
