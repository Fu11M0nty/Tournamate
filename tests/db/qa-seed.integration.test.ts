import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { calculateStandings } from '@/lib/standings'
import type { Match, ScoringSystem, Team } from '@/lib/types'

const DEFAULT_QA_SLUG = 'qa-smoke-tournament'
const EXPECTED_DIVISION_SLUGS = [
  'qa-double-elimination',
  'qa-festival',
  'qa-grading-champ-plate',
  'qa-group-finals',
  'qa-knockout',
  'qa-knockout-playins',
  'qa-league-home-away',
  'qa-league-single',
  'qa-placement-finals',
  'qa-round-robin',
  'qa-two-pools',
  'qa-under-10',
  'qa-under-12',
  'qa-workflow',
]

const FORMAT_DIVISION_SLUGS = EXPECTED_DIVISION_SLUGS.filter((slug) => slug.startsWith('qa-') && !['qa-under-10', 'qa-under-12', 'qa-workflow'].includes(slug))

type TournamentRow = {
  id: string
  slug: string
  name: string
  is_public: boolean | null
}

type DivisionRow = {
  id: string
  slug: string
  name: string
}

type PhaseRow = {
  id: string
  age_group_id: string
  slug: string
  phase_type?: string
}

function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
      if (key && process.env[key] === undefined) process.env[key] = value
    }
  }
}

function qaSlug() {
  return normalizeQaSlug(process.env.QA_TOURNAMENT_SLUG)
}

function normalizeQaSlug(value: string | undefined) {
  if (!value) return DEFAULT_QA_SLUG
  return value.match(/^qa-[a-z0-9-]+/)?.[0] || value
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Run npm run qa:db with QA database environment variables configured.`)
  return value
}

function createServiceClient() {
  loadLocalEnv()
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createAnonClient() {
  loadLocalEnv()
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function expectData<T>(result: { data: T | null; error: { message: string } | null }, label: string): Promise<T> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  if (result.data === null) throw new Error(`${label}: expected data`)
  return result.data
}

function expectPresent<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(label)
  return value
}

function expectExactlyOne<T extends object>(rows: T[], label: string): T {
  if (rows.length !== 1) {
    const slugs = rows
      .map((row) => ('slug' in row ? String((row as { slug?: unknown }).slug ?? '') : ''))
      .filter(Boolean)
      .join(', ') || 'none'
    throw new Error(`${label}: expected exactly one row, found ${rows.length}. Matching slugs: ${slugs}`)
  }
  return rows[0]
}

describe('QA seeded database', () => {
  let service: SupabaseClient
  let anon: SupabaseClient
  let tournament: TournamentRow
  const divisions = new Map<string, DivisionRow>()

  beforeAll(async () => {
    service = createServiceClient()
    anon = createAnonClient()

    const tournamentRows = await expectData<TournamentRow[]>(
      await service
        .from('tournaments')
        .select('id, slug, name, is_public')
        .eq('slug', qaSlug())
        .order('created_at', { ascending: false }),
      'Load QA tournament'
    )
    tournament = expectExactlyOne(tournamentRows, `Load QA tournament for slug ${qaSlug()}`)

    const divisionRows = await expectData(
      await service
        .from('age_groups')
        .select('id, slug, name')
        .eq('tournament_id', tournament.id),
      'Load QA divisions'
    ) as DivisionRow[]

    for (const division of divisionRows) divisions.set(division.slug, division)
  })

  it('seeds the expected tournament, dates, venue, courts and divisions', async () => {
    expect(tournament).toMatchObject({
      slug: qaSlug(),
      name: 'QA Smoke Tournament',
      is_public: true,
    })

    const [dates, venues, courts] = await Promise.all([
      expectData(
        await service
          .from('competition_dates')
          .select('slug, label, legacy_day')
          .eq('tournament_id', tournament.id)
          .order('display_order', { ascending: true }),
        'Load QA dates'
      ),
      expectData(
        await service
          .from('tournament_venues')
          .select('name, postcode')
          .eq('tournament_id', tournament.id),
        'Load QA venues'
      ),
      expectData(
        await service
          .from('courts')
          .select('name, day')
          .eq('tournament_id', tournament.id)
          .order('display_order', { ascending: true }),
        'Load QA courts'
      ),
    ])

    expect(dates).toEqual([
      { slug: 'day-1', label: 'Saturday 6 June', legacy_day: 'saturday' },
      { slug: 'day-2', label: 'Sunday 7 June', legacy_day: 'sunday' },
    ])
    expect(venues).toEqual([{ name: 'QA Arena', postcode: 'MK1 1QA' }])
    expect(courts).toEqual([
      { name: 'Court 1', day: 'saturday' },
      { name: 'Court 2', day: 'saturday' },
    ])
    expect([...divisions.keys()].sort()).toEqual(EXPECTED_DIVISION_SLUGS)
  })

  it('allows anonymous public reads but blocks anonymous writes', async () => {
    const publicTournament = await expectData<{ id: string; slug: string }>(
      await anon
        .from('tournaments')
        .select('id, slug')
        .eq('slug', qaSlug())
        .single(),
      'Anon reads QA tournament'
    )
    expect(publicTournament.slug).toBe(qaSlug())

    const insertResult = await anon
      .from('tournaments')
      .insert({
        slug: 'qa-anon-should-not-insert',
        name: 'Anon Should Not Insert',
        status: 'upcoming',
        display_order: 99999,
      })

    expect(insertResult.error).toBeTruthy()
  })

  it('can sign in as the QA admin user created by the seed', async () => {
    const email = process.env.QA_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || 'qa-admin@tournamate.test'
    const password = process.env.QA_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || 'Tournamate-QA-Admin-123!'

    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    expect(error).toBeNull()
    expect(data.user?.email).toBe(email)

    const userId = data.user?.id
    expect(userId).toBeTruthy()

    const profile = await expectData<{ id: string; role: string; is_approved: boolean }>(
      await anon
        .from('user_profiles')
        .select('id, role, is_approved')
        .eq('id', userId)
        .single(),
      'Load QA admin profile'
    )
    expect(profile).toMatchObject({ role: 'superadmin' })
    expect(profile.is_approved).toBe(true)

    await anon.auth.signOut()
  })

  it('calculates standings from real seeded Under 10 data', async () => {
    const division = expectPresent(divisions.get('qa-under-10'), 'Missing qa-under-10 division')

    const [teams, matches, scoringRows] = await Promise.all([
      expectData(
        await service
          .from('teams')
          .select('*')
          .eq('age_group_id', division.id)
          .is('deleted_at', null),
        'Load Under 10 teams'
      ) as Promise<Team[]>,
      expectData(
        await service
          .from('matches')
          .select('*')
          .eq('age_group_id', division.id)
          .is('deleted_at', null),
        'Load Under 10 matches'
      ) as Promise<Match[]>,
      expectData(
        await service
          .from('scoring_systems')
          .select('*')
          .eq('name', 'QA Standard Netball')
          .limit(1),
        'Load QA scoring system'
      ) as Promise<ScoringSystem[]>,
    ])

    const standings = calculateStandings(teams, matches, scoringRows[0])
    expect(standings.map((row) => [row.position, row.team.name, row.played, row.points])).toEqual([
      [1, 'Amber Aces', 1, 5],
      [2, 'Crimson Comets', 1, 3],
      [3, 'Emerald Eagles', 1, 3],
      [4, 'Blue Bolts', 1, 1],
    ])
  })

  it('seeds the Under 12 group-stage/finals structure', async () => {
    const division = expectPresent(divisions.get('qa-under-12'), 'Missing qa-under-12 division')

    const phases = await expectData(
      await service
        .from('phases')
        .select('id, slug, name, pools(id, slug, name)')
        .eq('age_group_id', division.id)
        .order('display_order', { ascending: true }),
      'Load Under 12 phases'
    ) as Array<{ slug: string; name: string; pools: Array<{ slug: string; name: string }> }>

    expect(phases.map((phase) => phase.slug)).toEqual(['group-stage', 'semi-finals', 'finals'])
    expect(phases.find((phase) => phase.slug === 'group-stage')?.pools.map((pool) => pool.slug).sort()).toEqual(['pool-a', 'pool-b'])
    expect(phases.find((phase) => phase.slug === 'semi-finals')?.pools.map((pool) => pool.name).sort()).toEqual(['Semi-final 1', 'Semi-final 2'])

    const matches = await expectData(
      await service
        .from('matches')
        .select('status')
        .eq('age_group_id', division.id)
        .is('deleted_at', null),
      'Load Under 12 matches'
    ) as Array<{ status: string }>

    expect(matches).toHaveLength(4)
    expect(matches.filter((match) => match.status === 'completed')).toHaveLength(2)
    expect(matches.filter((match) => match.status === 'scheduled')).toHaveLength(2)
  })

  it('seeds a dedicated admin workflow division for safe mutation tests', async () => {
    const division = expectPresent(divisions.get('qa-workflow'), 'Missing qa-workflow division')

    const [teams, phases, matches] = await Promise.all([
      expectData(
        await service
          .from('teams')
          .select('name')
          .eq('age_group_id', division.id)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        'Load workflow teams'
      ) as Promise<Array<{ name: string }>>,
      expectData(
        await service
          .from('phases')
          .select('slug, name, pools(slug, name)')
          .eq('age_group_id', division.id)
          .order('display_order', { ascending: true }),
        'Load workflow phases'
      ) as Promise<Array<{ slug: string; name: string; pools: Array<{ slug: string; name: string }> }>>,
      expectData(
        await service
          .from('matches')
          .select('status, court, kickoff_time')
          .eq('age_group_id', division.id)
          .is('deleted_at', null)
          .order('court', { ascending: true }),
        'Load workflow matches'
      ) as Promise<Array<{ status: string; court: string | null; kickoff_time: string | null }>>,
    ])

    expect(teams.map((team) => team.name)).toEqual([
      'Workflow Alpha',
      'Workflow Bravo',
      'Workflow Charlie',
      'Workflow Delta',
    ])
    expect(phases.map((phase) => phase.slug)).toEqual(['workflow-round-robin'])
    expect(phases[0].pools).toEqual([{ slug: 'workflow-pool', name: 'Workflow Pool' }])
    expect(matches).toHaveLength(2)
    expect(matches.map((match) => match.status)).toEqual(['scheduled', 'scheduled'])
    expect(matches.map((match) => match.court)).toEqual(['Court 1', 'Court 2'])
  })

  it('seeds one disposable division for each major tournament format', async () => {
    const formatDivisions = FORMAT_DIVISION_SLUGS.map((slug) => expectPresent(divisions.get(slug), `Missing ${slug} division`))
    const divisionIds = formatDivisions.map((division) => division.id)

    const [teams, phases, slots, rules, matches] = await Promise.all([
      expectData(
        await service
          .from('teams')
          .select('age_group_id')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        'Load QA format teams'
      ) as Promise<Array<{ age_group_id: string }>>,
      expectData(
        await service
          .from('phases')
          .select('id, age_group_id, slug, phase_type')
          .in('age_group_id', divisionIds),
        'Load QA format phases'
      ) as Promise<Array<{ id: string; age_group_id: string; slug: string; phase_type: string }>>,
      expectData(
        await service
          .from('element_slots')
          .select('id')
          .limit(1),
        'Load QA format slot placeholder'
      ) as Promise<Array<{ id: string }>>,
      expectData(
        await service
          .from('progression_rules')
          .select('id')
          .limit(1),
        'Load QA format rule placeholder'
      ) as Promise<Array<{ id: string }>>,
      expectData(
        await service
          .from('matches')
          .select('age_group_id, home_slot_id, away_slot_id')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        'Load QA format matches'
      ) as Promise<Array<{ age_group_id: string; home_slot_id: string | null; away_slot_id: string | null }>>,
    ])

    const phaseIds = phases.map((phase) => phase.id)
    const loadedPools = await expectData(
      await service
        .from('pools')
        .select('id, phase_id, slug')
        .in('phase_id', phaseIds),
      'Load QA format pools'
    ) as Array<{ id: string; phase_id: string; slug: string }>

    const teamCountByDivision = countBy(teams, (team) => team.age_group_id)
    const phaseCountByDivision = countBy(phases, (phase) => phase.age_group_id)
    const matchCountByDivision = countBy(matches, (match) => match.age_group_id)
    for (const division of formatDivisions) {
      expect(teamCountByDivision.get(division.id) ?? 0, `${division.slug} teams`).toBeGreaterThan(0)
      expect(phaseCountByDivision.get(division.id) ?? 0, `${division.slug} phases`).toBeGreaterThan(0)
      expect(matchCountByDivision.get(division.id) ?? 0, `${division.slug} matches`).toBeGreaterThan(0)
    }

    expect(loadedPools.length).toBeGreaterThanOrEqual(FORMAT_DIVISION_SLUGS.length)
    expect(slots.length).toBeGreaterThan(0)
    expect(rules.length).toBeGreaterThan(0)
    expect(matches.some((match) => match.home_slot_id && match.away_slot_id)).toBe(true)

    const phasesByDivisionSlug = new Map(
      formatDivisions.map((division) => [
        division.slug,
        phases.filter((phase) => phase.age_group_id === division.id).map((phase) => phase.slug).sort(),
      ])
    )
    expect(phasesByDivisionSlug.get('qa-knockout')).toEqual(['finals', 'semi-finals'])
    expect(phasesByDivisionSlug.get('qa-knockout-playins')).toEqual(['finals', 'preliminary', 'semi-finals'])
    expect(phasesByDivisionSlug.get('qa-grading-champ-plate')).toEqual(['championship', 'grading', 'plate'])
    expect(phasesByDivisionSlug.get('qa-double-elimination')).toEqual(['grand-final', 'league-season', 'major-minor', 'prelim-final'])
  })

  it('allows the approved QA admin to write disposable tournament data', async () => {
    const division = expectPresent(divisions.get('qa-workflow'), 'Missing qa-workflow division')
    const email = process.env.QA_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || 'qa-admin@tournamate.test'
    const password = process.env.QA_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || 'Tournamate-QA-Admin-123!'
    const teamName = 'QA DB Admin Writable Team'

    await service.from('teams').delete().eq('age_group_id', division.id).eq('name', teamName)

    const { error: signInError } = await anon.auth.signInWithPassword({ email, password })
    expect(signInError).toBeNull()

    try {
      const inserted = await expectData<{ id: string; name: string }[]>(
        await anon
          .from('teams')
          .insert({
            age_group_id: division.id,
            name: teamName,
            short_name: 'QADB',
            color: '#0ea5e9',
          })
          .select('id, name'),
        'Authenticated admin inserts disposable team'
      )
      const team = expectExactlyOne(inserted, 'Inserted admin-write team')
      expect(team.name).toBe(teamName)

      const updated = await expectData<{ id: string; short_name: string }[]>(
        await anon
          .from('teams')
          .update({ short_name: 'QADBX' })
          .eq('id', team.id)
          .select('id, short_name'),
        'Authenticated admin updates disposable team'
      )
      expect(expectExactlyOne(updated, 'Updated admin-write team').short_name).toBe('QADBX')

      const deleteResult = await anon.from('teams').delete().eq('id', team.id)
      expect(deleteResult.error).toBeNull()
    } finally {
      await anon.auth.signOut()
      await service.from('teams').delete().eq('age_group_id', division.id).eq('name', teamName)
    }
  })

  it('keeps soft-deleted teams out of active QA queries', async () => {
    const division = expectPresent(divisions.get('qa-workflow'), 'Missing qa-workflow division')
    const teamName = 'QA DB Soft Deleted Team'

    await service.from('teams').delete().eq('age_group_id', division.id).eq('name', teamName)

    try {
      const inserted = await expectData<{ id: string; deleted_at: string | null }[]>(
        await service
          .from('teams')
          .insert({
            age_group_id: division.id,
            name: teamName,
            short_name: 'QASD',
            color: '#64748b',
            deleted_at: new Date().toISOString(),
          })
          .select('id, deleted_at'),
        'Create soft-deleted QA team'
      )
      const softDeletedTeam = expectExactlyOne(inserted, 'Soft-deleted QA team')
      expect(softDeletedTeam.deleted_at).toBeTruthy()

      const activeTeams = await expectData<Array<{ id: string; name: string }>>(
        await service
          .from('teams')
          .select('id, name')
          .eq('age_group_id', division.id)
          .is('deleted_at', null),
        'Load active workflow teams'
      )
      expect(activeTeams.some((team) => team.id === softDeletedTeam.id || team.name === teamName)).toBe(false)
    } finally {
      await service.from('teams').delete().eq('age_group_id', division.id).eq('name', teamName)
    }
  })

  it('keeps seeded fixtures scoped to teams from the same division', async () => {
    const divisionIds = [...divisions.values()].map((division) => division.id)
    const [teams, matches] = await Promise.all([
      expectData<Array<{ id: string; age_group_id: string }>>(
        await service
          .from('teams')
          .select('id, age_group_id')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        'Load QA teams for fixture scoping'
      ),
      expectData<Array<{ id: string; age_group_id: string; home_team_id: string | null; away_team_id: string | null }>>(
        await service
          .from('matches')
          .select('id, age_group_id, home_team_id, away_team_id')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        'Load QA matches for fixture scoping'
      ),
    ])

    const teamDivisionById = new Map(teams.map((team) => [team.id, team.age_group_id]))
    expect(matches.length).toBeGreaterThan(0)

    for (const match of matches) {
      if (match.home_team_id) {
        expect(teamDivisionById.get(match.home_team_id), `home team scope for match ${match.id}`).toBe(match.age_group_id)
      }
      if (match.away_team_id) {
        expect(teamDivisionById.get(match.away_team_id), `away team scope for match ${match.id}`).toBe(match.age_group_id)
      }
    }
  })

  it('keeps progression rules aligned with their target slots and source structures', async () => {
    const divisionIds = [...divisions.values()].map((division) => division.id)
    const phases = await expectData<PhaseRow[]>(
      await service
        .from('phases')
        .select('id, age_group_id, slug, phase_type')
        .in('age_group_id', divisionIds),
      'Load QA phases for progression integrity'
    )
    const phaseIds = phases.map((phase) => phase.id)
    const [elements, pools, matches, slots, rules] = await Promise.all([
      expectData<Array<{ id: string; phase_id: string; pool_id: string | null }>>(
        await service
          .from('phase_elements')
          .select('id, phase_id, pool_id')
          .in('phase_id', phaseIds),
        'Load QA phase elements for progression integrity'
      ),
      expectData<Array<{ id: string; phase_id: string }>>(
        await service
          .from('pools')
          .select('id, phase_id')
          .in('phase_id', phaseIds),
        'Load QA pools for progression integrity'
      ),
      expectData<Array<{ id: string; age_group_id: string; phase_id: string | null; pool_id: string | null }>>(
        await service
          .from('matches')
          .select('id, age_group_id, phase_id, pool_id')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        'Load QA matches for progression integrity'
      ),
      expectData<Array<{ id: string; phase_element_id: string; display_order: number }>>(
        await service
          .from('element_slots')
          .select('id, phase_element_id, display_order'),
        'Load slots for progression integrity'
      ),
      expectData<Array<{
        id: string
        from_phase_id: string | null
        from_pool_id: string | null
        from_match_id: string | null
        to_phase_id: string | null
        to_element_id: string
        to_slot_id: string | null
        to_slot_order: number | null
      }>>(
        await service
          .from('progression_rules')
          .select('id, from_phase_id, from_pool_id, from_match_id, to_phase_id, to_element_id, to_slot_id, to_slot_order')
          .in('to_phase_id', phaseIds),
        'Load QA progression rules'
      ),
    ])

    const phaseIdsSet = new Set(phaseIds)
    const elementById = new Map(elements.map((element) => [element.id, element]))
    const poolById = new Map(pools.map((pool) => [pool.id, pool]))
    const matchById = new Map(matches.map((match) => [match.id, match]))
    const slotById = new Map(slots.map((slot) => [slot.id, slot]))

    expect(rules.length).toBeGreaterThan(0)

    for (const rule of rules) {
      expect(rule.to_phase_id && phaseIdsSet.has(rule.to_phase_id), `target phase for rule ${rule.id}`).toBe(true)

      const targetElement = elementById.get(rule.to_element_id)
      expect(targetElement, `target element for rule ${rule.id}`).toBeTruthy()
      expect(targetElement?.phase_id, `target element phase for rule ${rule.id}`).toBe(rule.to_phase_id)

      if (rule.to_slot_id) {
        const targetSlot = slotById.get(rule.to_slot_id)
        expect(targetSlot, `target slot for rule ${rule.id}`).toBeTruthy()
        expect(targetSlot?.phase_element_id, `target slot element for rule ${rule.id}`).toBe(rule.to_element_id)
        if (rule.to_slot_order !== null) {
          expect(targetSlot?.display_order, `target slot order for rule ${rule.id}`).toBe(rule.to_slot_order)
        }
      }

      if (rule.from_phase_id) {
        expect(phaseIdsSet.has(rule.from_phase_id), `source phase for rule ${rule.id}`).toBe(true)
      }
      if (rule.from_pool_id) {
        const sourcePool = poolById.get(rule.from_pool_id)
        expect(sourcePool, `source pool for rule ${rule.id}`).toBeTruthy()
        if (rule.from_phase_id) {
          expect(sourcePool?.phase_id, `source pool phase for rule ${rule.id}`).toBe(rule.from_phase_id)
        }
      }
      if (rule.from_match_id) {
        const sourceMatch = matchById.get(rule.from_match_id)
        expect(sourceMatch, `source match for rule ${rule.id}`).toBeTruthy()
        if (rule.from_phase_id) {
          expect(sourceMatch?.phase_id, `source match phase for rule ${rule.id}`).toBe(rule.from_phase_id)
        }
      }
    }
  })
})

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}
