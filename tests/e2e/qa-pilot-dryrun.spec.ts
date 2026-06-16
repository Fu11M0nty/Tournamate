/**
 * Pilot runbook dry-run (docs/pilot/pilot-runbook.md §9).
 *
 * Walks the runbook's dry-run validation checklist against the seeded QA
 * tournament. NOT part of the regular QA suite — it mutates seeded format
 * divisions (knockout progression) and leaves snapshots behind, so it expects
 * `npm run qa:reset` before and `npm run qa:cleanup` after.
 *
 * Run explicitly with:
 *   PILOT_DRYRUN=1 npx playwright test qa-pilot-dryrun --project=chromium
 */
import { expect, test } from '@playwright/test'
import {
  createQaServiceClient,
  deleteQaDivisionsBySlug,
  divisionRow,
  openAdminPanel,
  openQaTournament,
  resetWorkflowFixtures,
  signInAndOpenQaTournament,
  skipUnlessDesktop,
  QA_SLUG,
} from './helpers/qa-admin'

const DRYRUN_KO_NAME = 'QA Dryrun KO'
const DRYRUN_KO_SLUG = 'qa-dryrun-ko'

async function setScheduleLocked(locked: boolean) {
  const service = createQaServiceClient()
  const { error } = await service
    .from('tournaments')
    .update({ schedule_locked: locked })
    .eq('slug', QA_SLUG)
  if (error) throw new Error(`Set schedule lock: ${error.message}`)
}

const SCORE_DASH = '\\s*(?:-|\\u2013)\\s*'

async function getQaTournamentId() {
  const service = createQaServiceClient()
  const { data, error } = await service.from('tournaments').select('id').eq('slug', QA_SLUG).single()
  if (error) throw new Error(`Load QA tournament: ${error.message}`)
  return data.id as string
}

async function getWorkflowMatch(home: string, away: string) {
  const service = createQaServiceClient()
  const tournamentId = await getQaTournamentId()
  const { data: division, error: divisionError } = await service
    .from('age_groups')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('slug', 'qa-workflow')
    .single()
  if (divisionError) throw new Error(`Load workflow division: ${divisionError.message}`)

  const { data: teams, error: teamError } = await service
    .from('teams')
    .select('id, name')
    .eq('age_group_id', division.id)
    .is('deleted_at', null)
  if (teamError) throw new Error(`Load workflow teams: ${teamError.message}`)
  const idByName = new Map((teams ?? []).map((t) => [t.name as string, t.id as string]))

  const { data: match, error: matchError } = await service
    .from('matches')
    .select('id')
    .eq('age_group_id', division.id)
    .eq('home_team_id', idByName.get(home))
    .eq('away_team_id', idByName.get(away))
    .is('deleted_at', null)
    .single()
  if (matchError) throw new Error(`Load workflow match: ${matchError.message}`)
  return match.id as string
}

test.describe('Pilot runbook dry-run', () => {
  test.skip(process.env.PILOT_DRYRUN !== '1', 'Pilot dry-run only — run with PILOT_DRYRUN=1 (see docs/pilot/pilot-runbook.md §9)')

  test('check 12 — /admin is blocked when signed out', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/admin/login')
  })

  test('checks 1+2 — score entry and correction update standings data', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()
    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: 'QA Workflow Division' }).click()

      const matchRow = page.locator('li').filter({ hasText: 'Workflow Alpha' }).filter({ hasText: 'Workflow Bravo' }).first()
      await matchRow.getByRole('button', { name: /Edit/ }).click()
      let dialog = page.getByRole('dialog', { name: /Workflow Alpha vs Workflow Bravo/ })
      await dialog.locator('#home-score').fill('12')
      await dialog.locator('#away-score').fill('7')
      await dialog.locator('#status').selectOption('completed')
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(matchRow.getByText('Completed')).toBeVisible()
      await expect(matchRow.getByText(new RegExp(`12${SCORE_DASH}7`))).toBeVisible()

      // Correction: reopen and change the score (runbook incident "wrong score entered").
      await matchRow.getByRole('button', { name: /Edit/ }).click()
      dialog = page.getByRole('dialog', { name: /Workflow Alpha vs Workflow Bravo/ })
      await dialog.locator('#home-score').fill('14')
      await dialog.locator('#away-score').fill('9')
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(matchRow.getByText(new RegExp(`14${SCORE_DASH}9`))).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('check 6 — no-show records a 10-0 forfeit', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()
    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: 'QA Workflow Division' }).click()

      const matchRow = page.locator('li').filter({ hasText: 'Workflow Charlie' }).filter({ hasText: 'Workflow Delta' }).first()
      await matchRow.getByRole('button', { name: /Edit/ }).click()
      const dialog = page.getByRole('dialog', { name: /Workflow Charlie vs Workflow Delta/ })

      await dialog.locator('label').filter({ hasText: 'Workflow Delta did not turn up' }).getByRole('checkbox').check()
      await expect(dialog.getByText(/Forfeit \(no show\).*10-0 to Workflow Charlie/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(matchRow.getByText(new RegExp(`10${SCORE_DASH}0`))).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('check 7 — late arrival concedes goals per the rules', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()
    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: 'QA Workflow Division' }).click()

      const matchRow = page.locator('li').filter({ hasText: 'Workflow Charlie' }).filter({ hasText: 'Workflow Delta' }).first()
      await matchRow.getByRole('button', { name: /Edit/ }).click()
      const dialog = page.getByRole('dialog', { name: /Workflow Charlie vs Workflow Delta/ })

      await dialog.locator('#home-late').fill('2')
      await expect(dialog.getByText('concedes 4 goals')).toBeVisible()

      // 4+ minutes escalates to a forfeit, per the runbook's competition rule.
      await dialog.locator('#home-late').fill('4')
      await expect(dialog.getByText(/Forfeit \(late\).*10-0 to Workflow Delta/)).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('check 3 — QR capture page records a score end-to-end', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()
    try {
      const matchId = await getWorkflowMatch('Workflow Alpha', 'Workflow Bravo')
      await signInAndOpenQaTournament(page)

      await page.goto(`/admin/capture/${matchId}`)
      await expect(page.getByText('Workflow Alpha').first()).toBeVisible()
      const scoreInputs = page.locator('input[type="number"]')
      await scoreInputs.nth(0).fill('11')
      await scoreInputs.nth(1).fill('8')
      await page.getByRole('button', { name: 'Next →' }).click()
      await page.getByRole('button', { name: /On time/ }).click()
      await page.getByRole('button', { name: /^Next/ }).click()
      await page.getByRole('button', { name: /On time/ }).click()
      await page.getByRole('button', { name: /^Next/ }).click()
      await page.getByRole('button', { name: 'Submit without photo' }).click()

      await expect(page.getByRole('heading', { name: 'Score recorded!' })).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('check 4 — printable scorecards render once the schedule is locked', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    const tournamentId = await getQaTournamentId()
    await setScheduleLocked(false)
    try {
      await signInAndOpenQaTournament(page)

      // Scorecards refuse to render while the schedule is unlocked (runbook §3.1 step 6).
      await page.goto(`/admin/scorecards/saturday?t=${tournamentId}`)
      await expect(page.getByRole('heading', { name: 'Schedule not locked' })).toBeVisible()

      // Lock from the Schedule panel, exactly as the runbook instructs.
      await page.goto('/admin')
      await openQaTournament(page)
      await openAdminPanel(page, 'Schedule')
      await page.getByRole('button', { name: /Unlocked/ }).click()
      await expect(page.getByRole('button', { name: /Locked/ })).toBeVisible()

      await page.goto(`/admin/scorecards/saturday?t=${tournamentId}`)
      await expect(page.getByText('Workflow Alpha').first()).toBeVisible()
      await expect(page.getByText('Return completed scorecards to the control desk immediately').first()).toBeVisible()
    } finally {
      await setScheduleLocked(false)
    }
  })

  test('check 5 — a fixture can move time on the schedule', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()
    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Schedule')

      const workflowFixture = page.getByRole('button', { name: /Workflow Pool 11:00 Workflow Charlie vs Workflow Delta/ })
      await expect(workflowFixture).toBeVisible()
      await workflowFixture.dblclick()
      await expect(page.getByRole('heading', { name: 'Workflow Charlie vs Workflow Delta' })).toBeVisible({ timeout: 10_000 })
      const editor = page.locator('div.fixed.inset-0').filter({ hasText: 'Workflow Charlie vs Workflow Delta' }).last()
      await editor.locator('select').nth(1).selectOption({ label: '11:30' })
      await editor.getByRole('button', { name: 'Update' }).click()

      await expect(page.getByRole('button', { name: /Workflow Pool 11:30 Workflow Charlie vs Workflow Delta/ })).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('check 9 — snapshot is captured and inspectable in the Snapshots panel', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await signInAndOpenQaTournament(page)
    await openAdminPanel(page, 'Match Entry')
    await page.getByRole('button', { name: 'QA Workflow Division' }).click()

    await page.getByRole('button', { name: 'Snapshot', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Take a snapshot' })).toBeVisible()
    await page.getByPlaceholder(/End of morning session/).fill('Pilot dry-run snapshot')
    await page.getByRole('button', { name: 'Take snapshot' }).click()

    await openAdminPanel(page, 'Snapshots')
    await expect(page.getByText('Pilot dry-run snapshot').first()).toBeVisible({ timeout: 10_000 })
  })

  test('check 8 — Resolve qualifiers carries semi-final winners into the final', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    test.setTimeout(180_000)
    await deleteQaDivisionsBySlug([DRYRUN_KO_SLUG])

    try {
      await signInAndOpenQaTournament(page)

      // Build a knockout division through the Structure Wizard (runbook §2.5),
      // since the seeded divisions carry no progression rules.
      await openAdminPanel(page, 'Divisions')
      await page.getByRole('button', { name: 'New division' }).click()
      const newDialog = page.getByRole('dialog', { name: 'New division' })
      await newDialog.getByLabel('Name').fill(DRYRUN_KO_NAME)
      await newDialog.getByLabel('URL slug').fill(DRYRUN_KO_SLUG)
      await newDialog.getByLabel('Display order').fill('98')
      await newDialog.getByRole('button', { name: 'Save' }).click()
      await expect(divisionRow(page, DRYRUN_KO_NAME)).toBeVisible()

      await divisionRow(page, DRYRUN_KO_NAME).getByRole('button', { name: 'Format' }).click()
      await expect(page.getByRole('heading', { name: 'Pick a format' })).toBeVisible()
      await page.getByRole('button', { name: /^Knockout/ }).first().click()
      await page.getByRole('button', { name: /^Next:/ }).click()

      // Teams step (configure folds into it for knockout): 4 placeholder teams.
      await page.getByRole('button', { name: 'Use placeholders' }).click()
      await page.getByRole('button', { name: '4', exact: true }).click()
      await expect(page.getByText('Team 5')).toHaveCount(0)
      await page.getByRole('button', { name: /^Next:/ }).click()

      await page.getByRole('button', { name: 'Generate fixtures' }).click()
      // The applied-format timeline shows the template name as a heading.
      await expect(page.getByRole('heading', { name: 'Knockout' })).toBeVisible({ timeout: 30_000 })

      // Complete both semi-finals in Match Entry.
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: DRYRUN_KO_NAME }).click()
      // Division content has loaded once its placeholder teams appear in the team filter.
      await expect(page.getByRole('button', { name: 'Team 1', exact: true })).toBeVisible({ timeout: 15_000 })
      for (let i = 0; i < 2; i++) {
        const scheduledRow = page
          .locator('li')
          .filter({ hasText: /Team \d+/ })
          .filter({ hasText: 'Scheduled' })
          .filter({ has: page.getByRole('button', { name: /Edit/ }) })
          .first()
        await scheduledRow.getByRole('button', { name: /Edit/ }).click()
        const dialog = page.getByRole('dialog', { name: /Team \d+ vs Team \d+/ })
        await dialog.locator('#home-score').fill('15')
        await dialog.locator('#away-score').fill('10')
        await dialog.locator('#status').selectOption('completed')
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect(dialog).toBeHidden()
      }

      // Resolve qualifiers on the final, per runbook §5.3.
      await openAdminPanel(page, 'Divisions')
      await divisionRow(page, DRYRUN_KO_NAME).getByRole('button', { name: 'Format' }).click()
      await page.getByText('Show advanced', { exact: true }).first().click()
      const resolveButton = page.getByRole('button', { name: 'Resolve qualifiers' }).first()
      const startDialog = page.getByRole('dialog', { name: /Start/ })
      await resolveButton.click()
      // One retry: the advanced editor can still be hydrating when the panel expands.
      if (!(await startDialog.isVisible().catch(() => false))) {
        await page.waitForTimeout(1_000)
        if (!(await startDialog.isVisible().catch(() => false))) await resolveButton.click()
      }
      await expect(startDialog).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Apply resolved slots' }).click()
      await expect(page.getByRole('dialog', { name: /Start/ })).toBeHidden({ timeout: 15_000 })

      // The final now holds real teams — no "Winner of…" placeholders remain
      // in admin or on the public division page.
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: DRYRUN_KO_NAME }).click()
      await expect(page.getByText(/Winner of/)).toHaveCount(0)

      await page.goto(`/${QA_SLUG}/saturday/${DRYRUN_KO_SLUG}`)
      await expect(page.getByText(DRYRUN_KO_NAME).first()).toBeVisible()
      await expect(page.getByText(/Winner of/)).toHaveCount(0)
    } finally {
      await deleteQaDivisionsBySlug([DRYRUN_KO_SLUG])
    }
  })

  test('checks 10+11 — public standings and schedule at phone and desktop widths', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport)

      await page.goto(`/${QA_SLUG}/saturday/qa-under-10`)
      await expect(page.getByText('QA Under 10').first()).toBeVisible()
      await expect(page.locator('table').first()).toBeVisible()

      await page.goto(`/${QA_SLUG}`)
      await page.getByRole('link', { name: 'Schedule' }).first().click()
      await expect(page.getByText('Court 1').first()).toBeVisible()
    }
  })
})
