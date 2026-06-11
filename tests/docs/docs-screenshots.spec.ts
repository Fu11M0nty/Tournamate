import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  QA_ADMIN_EMAIL,
  createQaServiceClient,
  divisionRow,
  openAdminPanel,
  openQaTournament,
  signInAsQaAdmin,
} from '../e2e/helpers/qa-admin'

/**
 * Documentation screenshot generation (npm run docs:screenshots).
 *
 * Walks the admin console as the seeded QA admin and captures curated,
 * semantically-named screenshots into public/help/screenshots/ for the admin
 * Help guides. Requires the QA seed (npm run qa:seed) and a running app.
 *
 * Multi-week league screens are captured from a self-contained docs league
 * tournament (slug qa-docs-league) created at the start of the run and
 * deleted at the end, so the QA smoke tournament is never modified.
 */

const SCREENSHOT_DIR = resolve(process.cwd(), 'public', 'help', 'screenshots')
const DOCS_SLUG = 'qa-docs-league'
const DOCS_TOURNAMENT_NAME = 'QA Docs League'

test.describe.configure({ mode: 'serial' })

let page: Page
let service: SupabaseClient

async function capture(target: Page | Locator, file: string) {
  const path = join(SCREENSHOT_DIR, file)
  if ('screenshot' in target && 'goto' in target) {
    await (target as Page).screenshot({ path, animations: 'disabled' })
  } else {
    await (target as Locator).screenshot({ path, animations: 'disabled' })
  }
}

/** Scroll a landmark towards the viewport centre, settle, then capture the viewport. */
async function captureAt(locator: Locator, file: string) {
  await expect(locator).toBeVisible()
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }))
  await page.waitForTimeout(400)
  await capture(page, file)
}

async function deleteDocsTournament(client: SupabaseClient) {
  const { error } = await client.from('tournaments').delete().eq('slug', DOCS_SLUG)
  if (error) throw new Error(`Delete docs league tournament: ${error.message}`)
}

async function seedDocsLeagueTournament(client: SupabaseClient) {
  await deleteDocsTournament(client)

  const { data: scoring, error: scoringError } = await client
    .from('scoring_systems')
    .select('id')
    .eq('name', 'QA Standard Netball')
    .maybeSingle()
  if (scoringError) throw new Error(`Load QA scoring system: ${scoringError.message}`)
  if (!scoring) throw new Error('QA scoring system not found — run npm run qa:seed first.')

  const { data: users, error: usersError } = await client.auth.admin.listUsers()
  if (usersError) throw new Error(`List users: ${usersError.message}`)
  const admin = users.users.find((u) => u.email === QA_ADMIN_EMAIL)
  if (!admin) throw new Error(`QA admin ${QA_ADMIN_EMAIL} not found — run npm run qa:seed first.`)

  const { data: tournament, error: tournamentError } = await client
    .from('tournaments')
    .insert({
      slug: DOCS_SLUG,
      name: DOCS_TOURNAMENT_NAME,
      start_date: '2026-09-01',
      end_date: '2026-12-15',
      status: 'upcoming',
      display_order: 9998,
      courts: ['Court 1', 'Court 2'],
      schedule_locked: false,
      schedule_mode: 'multi_week',
      sport: 'Netball',
      default_scoring_system_id: scoring.id,
      venue_name: 'Riverside Sports Hall',
      description: 'Automated docs screenshot data. Safe to delete.',
      is_public: false,
      created_by: admin.id,
    })
    .select('id')
    .single()
  if (tournamentError) throw new Error(`Create docs tournament: ${tournamentError.message}`)

  const { error: venueError } = await client.from('tournament_venues').insert({
    tournament_id: tournament.id,
    name: 'Riverside Sports Hall',
    address_line1: '12 Riverside Way',
    city: 'Milton Keynes',
    postcode: 'MK9 1AA',
    country: 'United Kingdom',
    display_order: 1,
    available_from: '18:00',
    available_to: '22:00',
    court_count: 2,
    playable_weekdays: [2],
  })
  if (venueError) throw new Error(`Create docs venue: ${venueError.message}`)

  const { data: divisions, error: divisionError } = await client
    .from('age_groups')
    .insert([
      {
        tournament_id: tournament.id,
        name: 'Division 1',
        slug: 'docs-division-1',
        day: 'saturday',
        display_order: 1,
        match_format: 'continuous',
        period_minutes: 12,
        scoring_system_id: scoring.id,
        metadata: { qa_seed: true, scenario: 'docs-league' },
      },
      {
        tournament_id: tournament.id,
        name: 'Division 2',
        slug: 'docs-division-2',
        day: 'saturday',
        display_order: 2,
        match_format: 'continuous',
        period_minutes: 12,
        scoring_system_id: scoring.id,
        metadata: { qa_seed: true, scenario: 'docs-league-empty' },
      },
    ])
    .select('id, slug')
  if (divisionError) throw new Error(`Create docs divisions: ${divisionError.message}`)
  const division = divisions.find((d) => d.slug === 'docs-division-1')
  if (!division) throw new Error('Docs division not created')

  const { data: phase, error: phaseError } = await client
    .from('phases')
    .insert({
      age_group_id: division.id,
      slug: 'league',
      name: 'League',
      phase_type: 'league',
      display_order: 1,
      standings_mode: 'visible',
      scoring_system_id: scoring.id,
      match_format: 'continuous',
      period_minutes: 12,
      metadata: { qa_seed: true },
    })
    .select('id')
    .single()
  if (phaseError) throw new Error(`Create docs phase: ${phaseError.message}`)

  const { data: pool, error: poolError } = await client
    .from('pools')
    .upsert(
      { phase_id: phase.id, slug: 'default', name: 'Default Pool', display_order: 1, is_default: true },
      { onConflict: 'phase_id,slug' }
    )
    .select('id')
    .single()
  if (poolError) throw new Error(`Create docs pool: ${poolError.message}`)

  const teamNames = [
    'Riverside Rockets',
    'Brookfield Bears',
    'Northgate Netters',
    'Southside Swifts',
    'Eastfield Eagles',
    'Westway Wanderers',
  ]
  const { data: teams, error: teamError } = await client
    .from('teams')
    .insert(
      teamNames.map((name, index) => ({
        age_group_id: division.id,
        name,
        short_name: name.split(' ')[1],
        color: ['#0ea5e9', '#92400e', '#7c3aed', '#16a34a', '#eab308', '#dc2626'][index],
      }))
    )
    .select('id, name')
  if (teamError) throw new Error(`Create docs teams: ${teamError.message}`)

  // A DB trigger may already assign new teams to the default pool — ignore duplicates.
  const { error: poolTeamError } = await client
    .from('pool_teams')
    .upsert(
      teams.map((team, index) => ({ pool_id: pool.id, team_id: team.id, display_order: index + 1 })),
      { onConflict: 'pool_id,team_id', ignoreDuplicates: true }
    )
  if (poolTeamError) throw new Error(`Assign docs pool teams: ${poolTeamError.message}`)

  // Single round robin for 6 teams (circle method): 5 rounds of 3 matches.
  // Rounds 1–2 are planned on the first two league Tuesdays; the rest stay
  // in the unplanned tray so the calendar and tray both show content.
  const byName = new Map(teams.map((t) => [t.name, t.id]))
  const id = (name: string) => {
    const teamId = byName.get(name)
    if (!teamId) throw new Error(`Docs team missing: ${name}`)
    return teamId
  }
  const rounds: [string, string][][] = []
  const rotation = [...teamNames]
  for (let round = 0; round < teamNames.length - 1; round++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < teamNames.length / 2; i++) {
      pairs.push([rotation[i], rotation[teamNames.length - 1 - i]])
    }
    rounds.push(pairs)
    rotation.splice(1, 0, rotation.pop() as string)
  }

  const plannedTuesdays = ['2026-09-01', '2026-09-08']
  const matchRows = rounds.flatMap((pairs, roundIndex) =>
    pairs.map(([home, away], matchIndex) => {
      const planned = roundIndex < plannedTuesdays.length
      // Two courts: the first two matches run in parallel at 18:00, the third at 19:00.
      const time = matchIndex < 2 ? '18:00' : '19:00'
      const court = matchIndex === 1 ? 'Court 2' : 'Court 1'
      return {
        age_group_id: division.id,
        phase_id: phase.id,
        pool_id: pool.id,
        home_team_id: id(home),
        away_team_id: id(away),
        round_number: roundIndex + 1,
        status: 'scheduled',
        is_planned: planned,
        // kickoff_time is NOT NULL; unplanned fixtures carry a placeholder
        // time and is_planned=false, mirroring fixture generation.
        kickoff_time: planned
          ? `${plannedTuesdays[roundIndex]}T${time}:00+01:00`
          : '2026-09-01T00:00:00+01:00',
        court: planned ? court : null,
      }
    })
  )
  const { error: matchError } = await client.from('matches').insert(matchRows)
  if (matchError) throw new Error(`Create docs matches: ${matchError.message}`)

  const { error: settingsError } = await client.from('league_schedule_settings').insert({
    phase_id: phase.id,
    start_date: '2026-09-01',
    end_date: '2026-12-15',
    playable_weekdays: [2],
    venue_mode: 'neutral_venues',
    prefer_round_order: true,
    prefer_home_away_balance: true,
  })
  if (settingsError) throw new Error(`Create docs league settings: ${settingsError.message}`)
}

test.beforeAll(async ({ browser }) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  service = createQaServiceClient()
  await seedDocsLeagueTournament(service)
  page = await browser.newPage()
  await signInAsQaAdmin(page)
})

test.afterAll(async () => {
  await page?.close()
  if (service) await deleteDocsTournament(service)
})

test('Docs screenshots: General panel sections', async () => {
  await openQaTournament(page)
  await captureAt(page.getByRole('heading', { name: 'Tournament details' }), 'admin-general-tournament-details.png')
  await captureAt(page.getByRole('heading', { name: 'Scheduling mode' }), 'admin-general-scheduling-mode.png')
})

test('Docs screenshots: Divisions and teams', async () => {
  await openAdminPanel(page, 'Divisions')
  await captureAt(page.getByRole('heading', { name: /Divisions —/ }), 'admin-divisions-list.png')

  await divisionRow(page, 'QA Under 10').getByRole('button', { name: /Add\/Edit Teams/ }).click()
  await captureAt(page.getByText(/— Add\/Edit Teams/).first(), 'admin-teams-list.png')
})

test('Docs screenshots: Scoring systems', async () => {
  await openAdminPanel(page, 'Scoring')
  await captureAt(page.getByRole('heading', { name: 'Scoring Systems' }), 'admin-scoring-systems.png')
})

test('Docs screenshots: Bulk import', async () => {
  await openAdminPanel(page, 'Import')
  await captureAt(page.getByRole('heading', { name: /Bulk import/ }), 'admin-import.png')
})

test('Docs screenshots: Event-day schedule', async () => {
  await openAdminPanel(page, 'Schedule')
  await captureAt(page.getByRole('heading', { name: /Schedule —/ }), 'admin-schedule-event-day.png')
})

test('Docs screenshots: Match entry', async () => {
  await openAdminPanel(page, 'Match Entry')
  await captureAt(page.getByRole('heading', { name: 'QA Under 10' }), 'admin-match-entry-list.png')
})

test('Docs screenshots: Officiating', async () => {
  await openAdminPanel(page, 'Officiating')
  await captureAt(page.getByRole('heading', { name: 'Officiating' }), 'admin-officiating.png')
})

test('Docs screenshots: Snapshots', async () => {
  await openAdminPanel(page, 'Snapshots')
  await captureAt(page.getByRole('heading', { name: 'Snapshots' }), 'admin-snapshots.png')
})

test('Docs screenshots: Multi-week league planner', async () => {
  // Back to the tournament list, then into the docs league tournament.
  await page.getByRole('button', { name: 'All Tournaments' }).click()
  const docsCard = page.getByRole('button', { name: new RegExp(DOCS_TOURNAMENT_NAME, 'i') }).first()
  await expect(docsCard).toBeVisible()
  await docsCard.click()

  await openAdminPanel(page, 'Schedule')
  await expect(page.getByRole('heading', { name: 'Multi-week schedule' })).toBeVisible()

  await captureAt(page.getByRole('heading', { name: 'Venues & courts' }), 'admin-schedule-multi-week-venues.png')
  await captureAt(page.getByRole('heading', { name: 'Calendar' }), 'admin-schedule-multi-week-calendar.png')
})

test('Docs screenshots: Structure wizard template picker', async () => {
  await openAdminPanel(page, 'Divisions')
  await divisionRow(page, 'Division 2').getByRole('button', { name: 'Format', exact: true }).click()
  await captureAt(page.getByRole('navigation', { name: 'Setup steps' }), 'admin-structure-template-picker.png')
})
