import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page, type TestInfo } from '@playwright/test'

export const QA_SLUG = process.env.QA_TOURNAMENT_SLUG?.match(/^qa-[a-z0-9-]+/)?.[0] ?? 'qa-smoke-tournament'
export const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL?.trim() || process.env.E2E_ADMIN_EMAIL?.trim() || 'qa-admin@tournamate.test'
export const QA_ADMIN_PASSWORD =
  process.env.QA_ADMIN_PASSWORD?.trim() || process.env.E2E_ADMIN_PASSWORD?.trim() || 'Tournamate-QA-Admin-123!'

const WORKFLOW_DIVISION_SLUG = 'qa-workflow'
const QA_STANDARD_SCORING_NAME = 'QA Standard Netball'

type WorkflowMatchSeed = {
  home: string
  away: string
  court: string
  kickoffTime: string
}

const WORKFLOW_MATCH_SEEDS: WorkflowMatchSeed[] = [
  {
    home: 'Workflow Alpha',
    away: 'Workflow Bravo',
    court: 'Court 1',
    kickoffTime: '2026-06-06T11:00:00+01:00',
  },
  {
    home: 'Workflow Charlie',
    away: 'Workflow Delta',
    court: 'Court 2',
    kickoffTime: '2026-06-06T11:00:00+01:00',
  },
]

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

function requireEnv(name: string) {
  loadLocalEnv()
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Configure QA Supabase environment variables before running E2E tests.`)
  return value
}

export function createQaServiceClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function getQaTournamentId(service: SupabaseClient) {
  const { data, error } = await service
    .from('tournaments')
    .select('id')
    .eq('slug', QA_SLUG)
    .single()

  if (error) throw new Error(`Load QA tournament: ${error.message}`)
  return data.id as string
}

async function getScoringSystemIdByName(service: SupabaseClient, name: string) {
  const { data, error } = await service
    .from('scoring_systems')
    .select('id')
    .eq('name', name)
    .single()

  if (error) throw new Error(`Load scoring system ${name}: ${error.message}`)
  return data.id as string
}

async function getQaDivisionId(service: SupabaseClient, slug: string) {
  const tournamentId = await getQaTournamentId(service)
  const { data, error } = await service
    .from('age_groups')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('slug', slug)
    .single()

  if (error) throw new Error(`Load QA division ${slug}: ${error.message}`)
  return data.id as string
}

export async function resetQaTournamentGeneral() {
  const service = createQaServiceClient()
  const scoringSystemId = await getScoringSystemIdByName(service, QA_STANDARD_SCORING_NAME)
  const tournamentId = await getQaTournamentId(service)
  const { error } = await service
    .from('tournaments')
    .update({
      name: 'QA Smoke Tournament',
      slug: QA_SLUG,
      sport: 'Netball',
      sport_other: null,
      default_scoring_system_id: scoringSystemId,
      // Keep public event info aligned with the QA seed so public smoke
      // assertions stay valid after admin workflow tests run.
      parking_notes: 'Free parking in the QA Arena overflow car park.',
    })
    .eq('id', tournamentId)

  if (error) throw new Error(`Reset QA tournament general details: ${error.message}`)
}

export async function deleteQaScoringSystemsByName(names: string[]) {
  if (names.length === 0) return
  const service = createQaServiceClient()
  const { error } = await service
    .from('scoring_systems')
    .delete()
    .in('name', names)

  if (error) throw new Error(`Delete QA scoring systems: ${error.message}`)
}

export async function deleteQaDivisionsBySlug(slugs: string[]) {
  if (slugs.length === 0) return
  const service = createQaServiceClient()
  const tournamentId = await getQaTournamentId(service)
  const { error } = await service
    .from('age_groups')
    .delete()
    .eq('tournament_id', tournamentId)
    .in('slug', slugs)

  if (error) throw new Error(`Delete QA divisions: ${error.message}`)
}

export async function deleteWorkflowTeamsByName(names: string[]) {
  if (names.length === 0) return
  const service = createQaServiceClient()
  const divisionId = await getQaDivisionId(service, WORKFLOW_DIVISION_SLUG)
  const { error } = await service
    .from('teams')
    .delete()
    .eq('age_group_id', divisionId)
    .in('name', names)

  if (error) throw new Error(`Delete workflow teams: ${error.message}`)
}

export async function resetWorkflowFixtures() {
  const service = createQaServiceClient()
  const divisionId = await getQaDivisionId(service, WORKFLOW_DIVISION_SLUG)
  const { data: teams, error: teamError } = await service
    .from('teams')
    .select('id, name')
    .eq('age_group_id', divisionId)
    .is('deleted_at', null)

  if (teamError) throw new Error(`Load workflow teams: ${teamError.message}`)

  const teamIdByName = new Map((teams ?? []).map((team) => [team.name as string, team.id as string]))

  for (const seed of WORKFLOW_MATCH_SEEDS) {
    const homeId = teamIdByName.get(seed.home)
    const awayId = teamIdByName.get(seed.away)
    if (!homeId || !awayId) throw new Error(`Missing workflow seeded teams for ${seed.home} vs ${seed.away}`)

    const { error } = await service
      .from('matches')
      .update({
        home_score: null,
        away_score: null,
        status: 'scheduled',
        court: seed.court,
        kickoff_time: seed.kickoffTime,
        is_planned: true,
        home_umpire_no_show: false,
        away_umpire_no_show: false,
        home_late_minutes: 0,
        away_late_minutes: 0,
        home_no_show: false,
        away_no_show: false,
        scoresheet_url: null,
      })
      .eq('age_group_id', divisionId)
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)

    if (error) throw new Error(`Reset workflow fixture ${seed.home} vs ${seed.away}: ${error.message}`)
  }
}

export function skipUnlessDesktop(testInfo: TestInfo) {
  testInfo.skip(testInfo.project.name !== 'chromium', 'Admin workflow tests are desktop-only for now')
}

export async function signInAsQaAdmin(page: Page) {
  await page.goto('/admin/login')

  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
  await page.getByLabel('Email').fill(QA_ADMIN_EMAIL)
  await page.getByLabel('Password').fill(QA_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Your Tournaments' })).toBeVisible({ timeout: 30_000 })
}

export async function openQaTournament(page: Page) {
  const qaTournamentCard = page.getByRole('button', { name: /QA Smoke Tournament/i }).first()
  await expect(qaTournamentCard).toBeVisible()
  await qaTournamentCard.click()
  await expect(page.getByText('QA Smoke Tournament').first()).toBeVisible()
}

export async function signInAndOpenQaTournament(page: Page) {
  await signInAsQaAdmin(page)
  await openQaTournament(page)
}

export async function openAdminPanel(page: Page, panelName: string) {
  await page.getByRole('button', { name: panelName, exact: true }).click()
}

export function divisionRow(page: Page, divisionName: string) {
  return page.locator('li').filter({ hasText: divisionName }).first()
}
