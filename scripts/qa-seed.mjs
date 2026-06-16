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
      organiser_contact_name: 'QA Organiser',
      organiser_contact_email: 'qa-organiser@example.com',
      organiser_contact_phone: '07700 900123',
      arrival_instructions: 'Arrive 30 minutes before your first match and check in at the QA desk.',
      parking_notes: 'Free parking in the QA Arena overflow car park.',
      venue_notes: 'Courts are indoors; non-marking shoes required.',
      facilities_notes: 'Cafe open from 9am. Toilets beside the main entrance.',
      emergency_contact: 'First aid at the main desk — 07700 900456',
      public_notice: 'QA notice: schedule may change — check back on the day.',
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
      {
        tournament_id: tournament.id,
        name: 'QA Workflow Division',
        slug: 'qa-workflow',
        day: 'saturday',
        display_order: 3,
        match_format: 'continuous',
        period_minutes: 10,
        scoring_system_id: scoringRows.id,
        metadata: { qa_seed: true, scenario: 'admin-workflow' },
      },
      ...formatScenarioDivisions().map((scenario, index) => ({
        tournament_id: tournament.id,
        name: scenario.name,
        slug: scenario.slug,
        day: 'saturday',
        display_order: 10 + index,
        match_format: scenario.matchFormat,
        period_minutes: scenario.periodMinutes,
        scoring_system_id: scoringRows.id,
        metadata: { qa_seed: true, scenario: scenario.scenario },
      })),
    ])
    .select('id, slug'),
  'Create QA divisions'
)

const bySlug = new Map(divisions.map((division) => [division.slug, division]))
const under10 = bySlug.get('qa-under-10')
const under12 = bySlug.get('qa-under-12')
const workflowDivision = bySlug.get('qa-workflow')
if (!under10 || !under12 || !workflowDivision) throw new Error('Could not resolve QA divisions.')

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

const workflowTeams = await must(
  supabase
    .from('teams')
    .insert(['Workflow Alpha', 'Workflow Bravo', 'Workflow Charlie', 'Workflow Delta'].map((name, index) => ({
      age_group_id: workflowDivision.id,
      name,
      short_name: `QAW-${index + 1}`,
      color: ['#0284c7', '#7c3aed', '#16a34a', '#ea580c'][index],
    })))
    .select('id, name'),
  'Create QA Workflow teams'
)

const day1 = dates.find((date) => date.slug === 'day-1')
if (!day1) throw new Error('Could not resolve QA day 1.')

await seedSimpleRoundRobin({ supabase, division: under10, teams: under10Teams, scoringSystemId: scoringRows.id, competitionDateId: day1.id })
await seedGroupFinals({ supabase, division: under12, teams: under12Teams, scoringSystemId: scoringRows.id, competitionDateId: day1.id })
await seedWorkflowDivision({ supabase, division: workflowDivision, teams: workflowTeams, scoringSystemId: scoringRows.id, competitionDateId: day1.id })
await seedFormatScenarioDivisions({ supabase, divisionsBySlug: bySlug, scoringSystemId: scoringRows.id, competitionDateId: day1.id })

console.log(`Seeded ${slug}.`)
console.log(`QA admin: ${admin.email}`)
console.log(`Public URL: /${slug}/saturday/qa-under-10`)

function formatScenarioDivisions() {
  return [
    { slug: 'qa-round-robin', name: 'QA Format - Simple Round Robin', scenario: 'format-simple-round-robin', matchFormat: 'continuous', periodMinutes: 10, teamCount: 4 },
    { slug: 'qa-two-pools', name: 'QA Format - Two Pools', scenario: 'format-two-pools', matchFormat: 'continuous', periodMinutes: 10, teamCount: 4 },
    { slug: 'qa-group-finals', name: 'QA Format - Group Stage + Finals', scenario: 'format-group-stage-finals', matchFormat: 'halves', periodMinutes: 8, teamCount: 4 },
    { slug: 'qa-knockout', name: 'QA Format - Knockout Only', scenario: 'format-knockout-only', matchFormat: 'halves', periodMinutes: 8, teamCount: 4 },
    { slug: 'qa-knockout-playins', name: 'QA Format - Knockout + Play-ins', scenario: 'format-knockout-playins', matchFormat: 'halves', periodMinutes: 8, teamCount: 6 },
    { slug: 'qa-grading-champ-plate', name: 'QA Format - Grading Championship Plate', scenario: 'format-grading-championship-plate', matchFormat: 'halves', periodMinutes: 8, teamCount: 8 },
    { slug: 'qa-league-single', name: 'QA Format - League Single Round', scenario: 'format-league-single', matchFormat: 'continuous', periodMinutes: 10, teamCount: 4 },
    { slug: 'qa-league-home-away', name: 'QA Format - League Home Away', scenario: 'format-league-home-away', matchFormat: 'continuous', periodMinutes: 10, teamCount: 4 },
    { slug: 'qa-festival', name: 'QA Format - Festival Fixtures', scenario: 'format-festival-fixtures', matchFormat: 'continuous', periodMinutes: 10, teamCount: 4 },
    { slug: 'qa-placement-finals', name: 'QA Format - Placement Finals', scenario: 'format-placement-finals', matchFormat: 'halves', periodMinutes: 8, teamCount: 4 },
    { slug: 'qa-double-elimination', name: 'QA Format - Double Elimination', scenario: 'format-double-elimination', matchFormat: 'halves', periodMinutes: 8, teamCount: 4 },
  ]
}

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

  await must(
    supabase
      .from('pools')
      .delete()
      .in('phase_id', phases.map((phase) => phase.id))
      .eq('slug', 'default'),
    'Remove QA Under 12 auto-created default pools'
  )

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

async function seedWorkflowDivision({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phase = await must(
    supabase
      .from('phases')
      .insert({
        age_group_id: division.id,
        slug: 'workflow-round-robin',
        name: 'Workflow Round Robin',
        phase_type: 'round_robin',
        display_order: 1,
        standings_mode: 'visible',
        scoring_system_id: scoringSystemId,
        match_format: 'continuous',
        period_minutes: 10,
        metadata: { qa_seed: true, scenario: 'admin-workflow' },
      })
      .select('id')
      .single(),
    'Create QA Workflow phase'
  )

  await must(
    supabase
      .from('pools')
      .delete()
      .eq('phase_id', phase.id)
      .eq('slug', 'default'),
    'Remove QA Workflow auto-created default pool'
  )

  const pool = await must(
    supabase
      .from('pools')
      .upsert({
        phase_id: phase.id,
        slug: 'workflow-pool',
        name: 'Workflow Pool',
        display_order: 1,
        is_default: true,
      }, { onConflict: 'phase_id,slug' })
      .select('id')
      .single(),
    'Create QA Workflow pool'
  )

  await must(
    supabase
      .from('pool_teams')
      .insert(teams.map((team, index) => ({
        pool_id: pool.id,
        team_id: team.id,
        display_order: index + 1,
      }))),
    'Assign QA Workflow teams'
  )

  await must(
    supabase
      .from('matches')
      .insert([
        matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T11:00:00+01:00', court: 'Court 1' }),
        matchRow({ division, phase, pool, competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T11:00:00+01:00', court: 'Court 2' }),
      ]),
    'Create QA Workflow matches'
  )
}

async function seedFormatScenarioDivisions({ supabase, divisionsBySlug, scoringSystemId, competitionDateId }) {
  for (const scenario of formatScenarioDivisions()) {
    const division = divisionsBySlug.get(scenario.slug)
    if (!division) throw new Error(`Could not resolve ${scenario.slug}.`)
    const teams = await createScenarioTeams({ supabase, division, scenario })

    switch (scenario.slug) {
      case 'qa-round-robin':
        await seedScenarioRoundRobin({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-two-pools':
        await seedScenarioTwoPools({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-group-finals':
        await seedScenarioGroupFinals({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-knockout':
        await seedScenarioKnockout({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-knockout-playins':
        await seedScenarioKnockoutPlayIns({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-grading-champ-plate':
        await seedScenarioGradingChampPlate({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-league-single':
        await seedScenarioLeague({ supabase, division, teams, scoringSystemId, competitionDateId, repeatCount: 1 })
        break
      case 'qa-league-home-away':
        await seedScenarioLeague({ supabase, division, teams, scoringSystemId, competitionDateId, repeatCount: 2 })
        break
      case 'qa-festival':
        await seedScenarioFestival({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-placement-finals':
        await seedScenarioPlacementFinals({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      case 'qa-double-elimination':
        await seedScenarioDoubleElimination({ supabase, division, teams, scoringSystemId, competitionDateId })
        break
      default:
        throw new Error(`Unhandled QA format scenario ${scenario.slug}.`)
    }
  }
}

async function createScenarioTeams({ supabase, division, scenario }) {
  const names = Array.from({ length: scenario.teamCount }, (_, index) =>
    `${scenario.name.replace('QA Format - ', 'QA ')} Team ${index + 1}`
  )
  return must(
    supabase
      .from('teams')
      .insert(names.map((name, index) => ({
        age_group_id: division.id,
        name,
        short_name: `QAF${scenario.slug.replace('qa-', '').slice(0, 3).toUpperCase()}${index + 1}`,
        color: ['#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#6366f1', '#64748b'][index % 8],
      })))
      .select('id, name'),
    `Create teams for ${scenario.slug}`
  )
}

async function seedScenarioRoundRobin({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const { phase, pool } = await createSinglePoolPhase({
    supabase,
    division,
    scoringSystemId,
    slug: 'round-robin',
    name: 'Round Robin',
    phaseType: 'round_robin',
  })
  await assignTeamsToPool({ supabase, pool, teams })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T12:00:00+01:00', court: 'Court 1', homeScore: 10, awayScore: 8 }),
      matchRow({ division, phase, pool, competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T12:00:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format round-robin matches'
  )
}

async function seedScenarioTwoPools({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const { phase, pools } = await createPhaseWithPools({
    supabase,
    division,
    scoringSystemId,
    slug: 'pool-play',
    name: 'Pool Play',
    phaseType: 'group_stage',
    pools: [
      { slug: 'pool-a', name: 'Pool A' },
      { slug: 'pool-b', name: 'Pool B' },
    ],
  })
  await assignTeamsToPool({ supabase, pool: pools[0], teams: teams.slice(0, 2) })
  await assignTeamsToPool({ supabase, pool: pools[1], teams: teams.slice(2, 4) })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase, pool: pools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T12:30:00+01:00', court: 'Court 1' }),
      matchRow({ division, phase, pool: pools[1], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T12:30:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format two-pool matches'
  )
}

async function seedScenarioGroupFinals({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'group-stage', name: 'Group Stage', phaseType: 'group_stage', displayOrder: 1 },
      { slug: 'semi-finals', name: 'Semi-finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 2 },
      { slug: 'finals', name: 'Finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 3 },
    ],
  })
  const groupPools = await replacePools({ supabase, phase: phases.get('group-stage'), pools: [{ slug: 'pool-a', name: 'Pool A' }, { slug: 'pool-b', name: 'Pool B' }] })
  const semiPools = await replacePools({ supabase, phase: phases.get('semi-finals'), pools: [{ slug: 'semi-final-1', name: 'Semi-final 1' }, { slug: 'semi-final-2', name: 'Semi-final 2' }] })
  const finalPools = await replacePools({ supabase, phase: phases.get('finals'), pools: [{ slug: 'final', name: 'Final' }] })
  await assignTeamsToPool({ supabase, pool: groupPools[0], teams: teams.slice(0, 2) })
  await assignTeamsToPool({ supabase, pool: groupPools[1], teams: teams.slice(2, 4) })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('group-stage'), pool: groupPools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T13:00:00+01:00', court: 'Court 1', homeScore: 9, awayScore: 6 }),
      matchRow({ division, phase: phases.get('group-stage'), pool: groupPools[1], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T13:00:00+01:00', court: 'Court 2', homeScore: 7, awayScore: 8 }),
    ]),
    'Create QA format group-final group matches'
  )
  const semiElements = await elementsForPools({ supabase, pools: semiPools })
  const finalElements = await elementsForPools({ supabase, pools: finalPools })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('semi-finals'),
    targetPool: semiPools[0],
    targetElement: semiElements.get(semiPools[0].id),
    sourcePhase: phases.get('group-stage'),
    sources: [
      { pool: groupPools[0], rank: 1, label: 'Pool A winner' },
      { pool: groupPools[1], rank: 2, label: 'Pool B runner-up' },
    ],
    time: '2026-06-06T15:00:00+01:00',
    court: 'Court 1',
  })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('semi-finals'),
    targetPool: semiPools[1],
    targetElement: semiElements.get(semiPools[1].id),
    sourcePhase: phases.get('group-stage'),
    sources: [
      { pool: groupPools[1], rank: 1, label: 'Pool B winner' },
      { pool: groupPools[0], rank: 2, label: 'Pool A runner-up' },
    ],
    time: '2026-06-06T15:00:00+01:00',
    court: 'Court 2',
  })
  await createWinnerSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('finals'),
    targetPool: finalPools[0],
    targetElement: finalElements.get(finalPools[0].id),
    sourcePhase: phases.get('semi-finals'),
    sourcePools: semiPools,
    labels: ['Winner of Semi-final 1', 'Winner of Semi-final 2'],
    time: '2026-06-06T16:30:00+01:00',
    court: 'Court 1',
  })
}

async function seedScenarioKnockout({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'semi-finals', name: 'Semi-finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 1 },
      { slug: 'finals', name: 'Finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 2 },
    ],
  })
  const semiPools = await replacePools({ supabase, phase: phases.get('semi-finals'), pools: [{ slug: 'semi-final-1', name: 'Semi-final 1' }, { slug: 'semi-final-2', name: 'Semi-final 2' }] })
  const finalPools = await replacePools({ supabase, phase: phases.get('finals'), pools: [{ slug: 'final', name: 'Final' }] })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('semi-finals'), pool: semiPools[0], competitionDateId, home: teams[0], away: teams[3], time: '2026-06-06T13:30:00+01:00', court: 'Court 1' }),
      matchRow({ division, phase: phases.get('semi-finals'), pool: semiPools[1], competitionDateId, home: teams[1], away: teams[2], time: '2026-06-06T13:30:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format knockout semi-finals'
  )
  const finalElements = await elementsForPools({ supabase, pools: finalPools })
  await createWinnerSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('finals'),
    targetPool: finalPools[0],
    targetElement: finalElements.get(finalPools[0].id),
    sourcePhase: phases.get('semi-finals'),
    sourcePools: semiPools,
    labels: ['Winner of Semi-final 1', 'Winner of Semi-final 2'],
    time: '2026-06-06T16:00:00+01:00',
    court: 'Court 2',
  })
}

async function seedScenarioKnockoutPlayIns({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'preliminary', name: 'Preliminary', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 1 },
      { slug: 'semi-finals', name: 'Semi-finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 2 },
      { slug: 'finals', name: 'Finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 3 },
    ],
  })
  const prelimPools = await replacePools({ supabase, phase: phases.get('preliminary'), pools: [{ slug: 'play-in-1', name: 'Play-in 1' }, { slug: 'play-in-2', name: 'Play-in 2' }] })
  const semiPools = await replacePools({ supabase, phase: phases.get('semi-finals'), pools: [{ slug: 'semi-final-1', name: 'Semi-final 1' }, { slug: 'semi-final-2', name: 'Semi-final 2' }] })
  const finalPools = await replacePools({ supabase, phase: phases.get('finals'), pools: [{ slug: 'final', name: 'Final' }] })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('preliminary'), pool: prelimPools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T14:00:00+01:00', court: 'Court 1' }),
      matchRow({ division, phase: phases.get('preliminary'), pool: prelimPools[1], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T14:00:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format knockout play-ins'
  )
  const semiElements = await elementsForPools({ supabase, pools: semiPools })
  const finalElements = await elementsForPools({ supabase, pools: finalPools })
  await createWinnerAndTeamFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('semi-finals'),
    targetPool: semiPools[0],
    targetElement: semiElements.get(semiPools[0].id),
    sourcePhase: phases.get('preliminary'),
    sourcePool: prelimPools[0],
    sourceLabel: 'Winner of Play-in 1',
    fixedTeam: teams[4],
    fixedLabel: teams[4].name,
    time: '2026-06-06T15:30:00+01:00',
    court: 'Court 1',
  })
  await createWinnerAndTeamFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('semi-finals'),
    targetPool: semiPools[1],
    targetElement: semiElements.get(semiPools[1].id),
    sourcePhase: phases.get('preliminary'),
    sourcePool: prelimPools[1],
    sourceLabel: 'Winner of Play-in 2',
    fixedTeam: teams[5],
    fixedLabel: teams[5].name,
    time: '2026-06-06T15:30:00+01:00',
    court: 'Court 2',
  })
  await createWinnerSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('finals'),
    targetPool: finalPools[0],
    targetElement: finalElements.get(finalPools[0].id),
    sourcePhase: phases.get('semi-finals'),
    sourcePools: semiPools,
    labels: ['Winner of Semi-final 1', 'Winner of Semi-final 2'],
    time: '2026-06-06T16:45:00+01:00',
    court: 'Court 2',
  })
}

async function seedScenarioGradingChampPlate({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'grading', name: 'Grading', phaseType: 'group_stage', displayOrder: 1 },
      { slug: 'championship', name: 'Championship', phaseType: 'group_stage', displayOrder: 2 },
      { slug: 'plate', name: 'Plate', phaseType: 'group_stage', displayOrder: 3 },
    ],
  })
  const gradingPools = await replacePools({ supabase, phase: phases.get('grading'), pools: [{ slug: 'pool-a', name: 'Pool A' }, { slug: 'pool-b', name: 'Pool B' }] })
  const champPools = await replacePools({ supabase, phase: phases.get('championship'), pools: [{ slug: 'championship', name: 'Championship' }] })
  const platePools = await replacePools({ supabase, phase: phases.get('plate'), pools: [{ slug: 'plate', name: 'Plate' }] })
  await assignTeamsToPool({ supabase, pool: gradingPools[0], teams: teams.slice(0, 4) })
  await assignTeamsToPool({ supabase, pool: gradingPools[1], teams: teams.slice(4, 8) })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('grading'), pool: gradingPools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T14:30:00+01:00', court: 'Court 1', homeScore: 12, awayScore: 9 }),
      matchRow({ division, phase: phases.get('grading'), pool: gradingPools[0], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T14:30:00+01:00', court: 'Court 2' }),
      matchRow({ division, phase: phases.get('grading'), pool: gradingPools[1], competitionDateId, home: teams[4], away: teams[5], time: '2026-06-06T15:00:00+01:00', court: 'Court 1', homeScore: 8, awayScore: 10 }),
      matchRow({ division, phase: phases.get('grading'), pool: gradingPools[1], competitionDateId, home: teams[6], away: teams[7], time: '2026-06-06T15:00:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format grading matches'
  )
  const champElements = await elementsForPools({ supabase, pools: champPools })
  const plateElements = await elementsForPools({ supabase, pools: platePools })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('championship'),
    targetPool: champPools[0],
    targetElement: champElements.get(champPools[0].id),
    sourcePhase: phases.get('grading'),
    sources: [
      { pool: gradingPools[0], rank: 1, label: 'Pool A 1st' },
      { pool: gradingPools[1], rank: 1, label: 'Pool B 1st' },
    ],
    time: '2026-06-06T16:00:00+01:00',
    court: 'Court 1',
  })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('plate'),
    targetPool: platePools[0],
    targetElement: plateElements.get(platePools[0].id),
    sourcePhase: phases.get('grading'),
    sources: [
      { pool: gradingPools[0], rank: 3, label: 'Pool A 3rd' },
      { pool: gradingPools[1], rank: 3, label: 'Pool B 3rd' },
    ],
    time: '2026-06-06T16:00:00+01:00',
    court: 'Court 2',
  })
}

async function seedScenarioLeague({ supabase, division, teams, scoringSystemId, competitionDateId, repeatCount }) {
  const { phase, pool } = await createSinglePoolPhase({
    supabase,
    division,
    scoringSystemId,
    slug: 'league-season',
    name: repeatCount === 1 ? 'League Season' : 'Home/Away League Season',
    phaseType: 'league',
    metadata: { qa_seed: true, league_repeat_count: repeatCount },
  })
  await assignTeamsToPool({ supabase, pool, teams })
  const pairRows = []
  let fixtureIndex = 0
  for (let homeIndex = 0; homeIndex < teams.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < teams.length; awayIndex += 1) {
      fixtureIndex += 1
      pairRows.push(matchRow({
        division,
        phase,
        pool,
        competitionDateId,
        home: teams[homeIndex],
        away: teams[awayIndex],
        time: `2026-06-06T${String(12 + Math.floor(fixtureIndex / 2)).padStart(2, '0')}:${fixtureIndex % 2 === 0 ? '00' : '30'}:00+01:00`,
        court: fixtureIndex % 2 === 0 ? 'Court 2' : 'Court 1',
      }))
      if (repeatCount === 2) {
        pairRows.push(matchRow({
          division,
          phase,
          pool,
          competitionDateId,
          home: teams[awayIndex],
          away: teams[homeIndex],
          time: `2026-06-06T${String(15 + Math.floor(fixtureIndex / 2)).padStart(2, '0')}:${fixtureIndex % 2 === 0 ? '00' : '30'}:00+01:00`,
          court: fixtureIndex % 2 === 0 ? 'Court 1' : 'Court 2',
        }))
      }
    }
  }
  await must(supabase.from('matches').insert(pairRows), `Create QA format league matches ${division.slug}`)
}

async function seedScenarioFestival({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const { phase, pool } = await createSinglePoolPhase({
    supabase,
    division,
    scoringSystemId,
    slug: 'festival-fixtures',
    name: 'Festival Fixtures',
    phaseType: 'friendly',
    standingsMode: 'none',
  })
  await assignTeamsToPool({ supabase, pool, teams })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T13:00:00+01:00', court: 'Court 1' }),
      matchRow({ division, phase, pool, competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T13:00:00+01:00', court: 'Court 2' }),
      matchRow({ division, phase, pool, competitionDateId, home: teams[0], away: teams[2], time: '2026-06-06T13:30:00+01:00', court: 'Court 1' }),
      matchRow({ division, phase, pool, competitionDateId, home: teams[1], away: teams[3], time: '2026-06-06T13:30:00+01:00', court: 'Court 2' }),
    ]),
    'Create QA format festival matches'
  )
}

async function seedScenarioPlacementFinals({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'round-robin', name: 'Round Robin', phaseType: 'round_robin', displayOrder: 1 },
      { slug: 'placement-finals', name: 'Placement Finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 2 },
    ],
  })
  const rrPools = await replacePools({ supabase, phase: phases.get('round-robin'), pools: [{ slug: 'default', name: 'Default Pool', isDefault: true }] })
  const placementPools = await replacePools({ supabase, phase: phases.get('placement-finals'), pools: [{ slug: 'first-place', name: '1st Place Match' }, { slug: 'third-place', name: '3rd Place Match' }] })
  await assignTeamsToPool({ supabase, pool: rrPools[0], teams })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('round-robin'), pool: rrPools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T14:00:00+01:00', court: 'Court 1', homeScore: 13, awayScore: 11 }),
      matchRow({ division, phase: phases.get('round-robin'), pool: rrPools[0], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T14:00:00+01:00', court: 'Court 2', homeScore: 7, awayScore: 10 }),
    ]),
    'Create QA format placement round-robin matches'
  )
  const placementElements = await elementsForPools({ supabase, pools: placementPools })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('placement-finals'),
    targetPool: placementPools[0],
    targetElement: placementElements.get(placementPools[0].id),
    sourcePhase: phases.get('round-robin'),
    sources: [
      { pool: rrPools[0], rank: 1, label: '1st in Round Robin' },
      { pool: rrPools[0], rank: 2, label: '2nd in Round Robin' },
    ],
    time: '2026-06-06T16:30:00+01:00',
    court: 'Court 1',
  })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('placement-finals'),
    targetPool: placementPools[1],
    targetElement: placementElements.get(placementPools[1].id),
    sourcePhase: phases.get('round-robin'),
    sources: [
      { pool: rrPools[0], rank: 3, label: '3rd in Round Robin' },
      { pool: rrPools[0], rank: 4, label: '4th in Round Robin' },
    ],
    time: '2026-06-06T16:30:00+01:00',
    court: 'Court 2',
  })
}

async function seedScenarioDoubleElimination({ supabase, division, teams, scoringSystemId, competitionDateId }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [
      { slug: 'league-season', name: 'League Season', phaseType: 'league', displayOrder: 1 },
      { slug: 'major-minor', name: 'Major/Minor Semi-finals', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 2 },
      { slug: 'prelim-final', name: 'Preliminary Final', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 3 },
      { slug: 'grand-final', name: 'Grand Final', phaseType: 'knockout', standingsMode: 'hidden', displayOrder: 4 },
    ],
  })
  const leaguePools = await replacePools({ supabase, phase: phases.get('league-season'), pools: [{ slug: 'default', name: 'League', isDefault: true }] })
  const majorPools = await replacePools({ supabase, phase: phases.get('major-minor'), pools: [{ slug: 'major-semi', name: 'Major Semi-final' }, { slug: 'minor-semi', name: 'Minor Semi-final' }] })
  const prelimPools = await replacePools({ supabase, phase: phases.get('prelim-final'), pools: [{ slug: 'prelim-final', name: 'Preliminary Final' }] })
  const grandPools = await replacePools({ supabase, phase: phases.get('grand-final'), pools: [{ slug: 'grand-final', name: 'Grand Final' }] })
  await assignTeamsToPool({ supabase, pool: leaguePools[0], teams })
  await must(
    supabase.from('matches').insert([
      matchRow({ division, phase: phases.get('league-season'), pool: leaguePools[0], competitionDateId, home: teams[0], away: teams[1], time: '2026-06-06T12:30:00+01:00', court: 'Court 1', homeScore: 15, awayScore: 12 }),
      matchRow({ division, phase: phases.get('league-season'), pool: leaguePools[0], competitionDateId, home: teams[2], away: teams[3], time: '2026-06-06T12:30:00+01:00', court: 'Court 2', homeScore: 8, awayScore: 9 }),
    ]),
    'Create QA format double-elimination league matches'
  )
  const majorElements = await elementsForPools({ supabase, pools: majorPools })
  const prelimElements = await elementsForPools({ supabase, pools: prelimPools })
  const grandElements = await elementsForPools({ supabase, pools: grandPools })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('major-minor'),
    targetPool: majorPools[0],
    targetElement: majorElements.get(majorPools[0].id),
    sourcePhase: phases.get('league-season'),
    sources: [
      { pool: leaguePools[0], rank: 1, label: 'League 1st' },
      { pool: leaguePools[0], rank: 2, label: 'League 2nd' },
    ],
    time: '2026-06-06T15:30:00+01:00',
    court: 'Court 1',
  })
  await createRankSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('major-minor'),
    targetPool: majorPools[1],
    targetElement: majorElements.get(majorPools[1].id),
    sourcePhase: phases.get('league-season'),
    sources: [
      { pool: leaguePools[0], rank: 3, label: 'League 3rd' },
      { pool: leaguePools[0], rank: 4, label: 'League 4th' },
    ],
    time: '2026-06-06T15:30:00+01:00',
    court: 'Court 2',
  })
  await createWinnerSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('prelim-final'),
    targetPool: prelimPools[0],
    targetElement: prelimElements.get(prelimPools[0].id),
    sourcePhase: phases.get('major-minor'),
    sourcePools: [majorPools[1], majorPools[0]],
    labels: ['Winner of Minor Semi-final', 'Loser of Major Semi-final'],
    outcomes: ['winner', 'loser'],
    time: '2026-06-06T16:15:00+01:00',
    court: 'Court 2',
  })
  await createWinnerSlotFixture({
    supabase,
    division,
    competitionDateId,
    targetPhase: phases.get('grand-final'),
    targetPool: grandPools[0],
    targetElement: grandElements.get(grandPools[0].id),
    sourcePhase: phases.get('major-minor'),
    sourcePools: [majorPools[0], prelimPools[0]],
    labels: ['Winner of Major Semi-final', 'Winner of Preliminary Final'],
    sourcePhases: [phases.get('major-minor'), phases.get('prelim-final')],
    time: '2026-06-06T16:50:00+01:00',
    court: 'Court 1',
  })
}

async function createPhases({ supabase, division, scoringSystemId, specs }) {
  const rows = await must(
    supabase
      .from('phases')
      .insert(specs.map((spec) => ({
        age_group_id: division.id,
        slug: spec.slug,
        name: spec.name,
        phase_type: spec.phaseType,
        display_order: spec.displayOrder,
        standings_mode: spec.standingsMode ?? 'visible',
        scoring_system_id: scoringSystemId,
        match_format: division.match_format ?? 'continuous',
        period_minutes: division.period_minutes ?? 10,
        metadata: spec.metadata ?? { qa_seed: true },
      })))
      .select('id, slug, name'),
    `Create phases for ${division.slug}`
  )
  return new Map(rows.map((phase) => [phase.slug, phase]))
}

async function createSinglePoolPhase({ supabase, division, scoringSystemId, slug, name, phaseType, standingsMode = 'visible', metadata = { qa_seed: true } }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [{ slug, name, phaseType, standingsMode, displayOrder: 1, metadata }],
  })
  const phase = phases.get(slug)
  const [pool] = await replacePools({ supabase, phase, pools: [{ slug: 'default', name: phaseType === 'league' ? 'League' : 'Default Pool', isDefault: true }] })
  return { phase, pool }
}

async function createPhaseWithPools({ supabase, division, scoringSystemId, slug, name, phaseType, pools }) {
  const phases = await createPhases({
    supabase,
    division,
    scoringSystemId,
    specs: [{ slug, name, phaseType, displayOrder: 1 }],
  })
  const phase = phases.get(slug)
  const poolRows = await replacePools({ supabase, phase, pools })
  return { phase, pools: poolRows }
}

async function replacePools({ supabase, phase, pools }) {
  await must(
    supabase
      .from('pools')
      .delete()
      .eq('phase_id', phase.id)
      .eq('slug', 'default'),
    `Remove default pool for ${phase.slug}`
  )
  return must(
    supabase
      .from('pools')
      .upsert(pools.map((pool, index) => ({
        phase_id: phase.id,
        slug: pool.slug,
        name: pool.name,
        display_order: index + 1,
        is_default: pool.isDefault ?? false,
      })), { onConflict: 'phase_id,slug' })
      .select('id, slug, name, phase_id'),
    `Create pools for ${phase.slug}`
  )
}

async function assignTeamsToPool({ supabase, pool, teams }) {
  await must(
    supabase
      .from('pool_teams')
      .insert(teams.map((team, index) => ({
        pool_id: pool.id,
        team_id: team.id,
        display_order: index + 1,
      }))),
    `Assign teams to ${pool.slug}`
  )
}

async function elementsForPools({ supabase, pools }) {
  const elements = await must(
    supabase
      .from('phase_elements')
      .select('id, pool_id, phase_id, slug, name')
      .in('pool_id', pools.map((pool) => pool.id)),
    'Load phase elements for pools'
  )
  return new Map(elements.map((element) => [element.pool_id, element]))
}

async function createRankSlotFixture({ supabase, division, competitionDateId, targetPhase, targetPool, targetElement, sourcePhase, sources, time, court }) {
  const slots = await must(
    supabase
      .from('element_slots')
      .insert(sources.map((source, index) => ({
        phase_element_id: targetElement.id,
        display_order: index + 1,
        label: source.label,
        slot_type: 'source',
        source_phase_id: sourcePhase.id,
        source_pool_id: source.pool.id,
        source_rank: source.rank,
        source_outcome: 'rank',
      })))
      .select('id, display_order'),
    `Create rank slots for ${targetPool.slug}`
  )
  await must(
    supabase
      .from('progression_rules')
      .insert(slots.map((slot, index) => ({
        from_phase_id: sourcePhase.id,
        from_pool_id: sources[index].pool.id,
        source_type: 'standings_rank',
        source_rank: sources[index].rank,
        to_phase_id: targetPhase.id,
        to_element_id: targetElement.id,
        to_slot_id: slot.id,
        to_slot_order: slot.display_order,
        display_order: index + 1,
      }))),
    `Create rank progression rules for ${targetPool.slug}`
  )
  await must(
    supabase.from('matches').insert(slotMatchRow({ division, phase: targetPhase, pool: targetPool, competitionDateId, homeSlot: slots[0], awaySlot: slots[1], time, court })),
    `Create placeholder rank fixture ${targetPool.slug}`
  )
}

async function createWinnerSlotFixture({
  supabase,
  division,
  competitionDateId,
  targetPhase,
  targetPool,
  targetElement,
  sourcePhase,
  sourcePools,
  labels,
  time,
  court,
  outcomes = ['winner', 'winner'],
  sourcePhases,
}) {
  const effectiveSourcePhases = sourcePhases ?? sourcePools.map(() => sourcePhase)
  const slots = await must(
    supabase
      .from('element_slots')
      .insert(sourcePools.map((sourcePool, index) => ({
        phase_element_id: targetElement.id,
        display_order: index + 1,
        label: labels[index],
        slot_type: 'source',
        source_phase_id: effectiveSourcePhases[index].id,
        source_pool_id: sourcePool.id,
        source_outcome: outcomes[index],
      })))
      .select('id, display_order'),
    `Create winner slots for ${targetPool.slug}`
  )
  await must(
    supabase
      .from('progression_rules')
      .insert(slots.map((slot, index) => ({
        from_phase_id: effectiveSourcePhases[index].id,
        from_pool_id: sourcePools[index].id,
        source_type: outcomes[index] === 'loser' ? 'match_loser' : 'match_winner',
        to_phase_id: targetPhase.id,
        to_element_id: targetElement.id,
        to_slot_id: slot.id,
        to_slot_order: slot.display_order,
        display_order: index + 1,
      }))),
    `Create winner progression rules for ${targetPool.slug}`
  )
  await must(
    supabase.from('matches').insert(slotMatchRow({ division, phase: targetPhase, pool: targetPool, competitionDateId, homeSlot: slots[0], awaySlot: slots[1], time, court })),
    `Create placeholder winner fixture ${targetPool.slug}`
  )
}

async function createWinnerAndTeamFixture({
  supabase,
  division,
  competitionDateId,
  targetPhase,
  targetPool,
  targetElement,
  sourcePhase,
  sourcePool,
  sourceLabel,
  fixedTeam,
  fixedLabel,
  time,
  court,
}) {
  const slots = await must(
    supabase
      .from('element_slots')
      .insert([
        {
          phase_element_id: targetElement.id,
          display_order: 1,
          label: sourceLabel,
          slot_type: 'source',
          source_phase_id: sourcePhase.id,
          source_pool_id: sourcePool.id,
          source_outcome: 'winner',
        },
        {
          phase_element_id: targetElement.id,
          display_order: 2,
          label: fixedLabel,
          slot_type: 'team',
          team_id: fixedTeam.id,
        },
      ])
      .select('id, display_order'),
    `Create mixed source/team slots for ${targetPool.slug}`
  )
  await must(
    supabase
      .from('progression_rules')
      .insert({
        from_phase_id: sourcePhase.id,
        from_pool_id: sourcePool.id,
        source_type: 'match_winner',
        to_phase_id: targetPhase.id,
        to_element_id: targetElement.id,
        to_slot_id: slots[0].id,
        to_slot_order: 1,
        display_order: 1,
      }),
    `Create mixed source progression rule for ${targetPool.slug}`
  )
  await must(
    supabase.from('matches').insert(slotMatchRow({ division, phase: targetPhase, pool: targetPool, competitionDateId, homeSlot: slots[0], awaySlot: slots[1], time, court })),
    `Create mixed source/team fixture ${targetPool.slug}`
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
  }
}

function slotMatchRow({ division, phase, pool, competitionDateId, homeSlot, awaySlot, time, court }) {
  return {
    age_group_id: division.id,
    phase_id: phase.id,
    pool_id: pool.id,
    competition_date_id: competitionDateId,
    home_slot_id: homeSlot.id,
    away_slot_id: awaySlot.id,
    court,
    kickoff_time: time,
    status: 'scheduled',
    is_planned: true,
  }
}
