import { expect, test } from '@playwright/test'
import {
  deleteQaScoringSystemsByName,
  deleteQaDivisionsBySlug,
  deleteWorkflowTeamsByName,
  divisionRow,
  openAdminPanel,
  openQaTournament,
  resetQaTournamentGeneral,
  resetWorkflowFixtures,
  signInAndOpenQaTournament,
  skipUnlessDesktop,
} from './helpers/qa-admin'

const TEMP_DIVISION_NAME = 'QA E2E Temp Division'
const TEMP_DIVISION_EDITED_NAME = 'QA E2E Temp Division Edited'
const TEMP_DIVISION_SLUG = 'qa-e2e-temp-division'
const TEMP_DIVISION_EDITED_SLUG = 'qa-e2e-temp-division-edited'
const TEMP_WORKFLOW_TEAM = 'Workflow E2E Team'
const TEMP_TOURNAMENT_TITLE = 'QA Smoke Tournament E2E Edited'
const TEMP_PARKING_NOTE = 'QA E2E parking note: use overflow car park B.'
const TEMP_SCORING_NAME = 'QA E2E Scoring Template'
const TEMP_SCORING_EDITED_NAME = 'QA E2E Scoring Template Edited'

async function openDivisionFormat(page: Parameters<typeof divisionRow>[0], divisionName: string) {
  await openAdminPanel(page, 'Divisions')
  await divisionRow(page, divisionName).getByRole('button', { name: 'Format' }).click()
  await expect(page.getByRole('heading', { name: `${divisionName} format` })).toBeVisible()
}

test.describe('QA admin safe workflow mutations', () => {
  test.describe.configure({ mode: 'serial' })

  test('edits general tournament details and restores them afterwards', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetQaTournamentGeneral()

    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'General')

      await page.getByLabel('Title / name').fill(TEMP_TOURNAMENT_TITLE)
      await page.getByLabel('Sport').selectOption('Football')
      await page.getByLabel('Default scoring').selectOption({ label: 'QA Standard Netball' })
      await page.getByLabel('Parking notes').fill(TEMP_PARKING_NOTE)
      await page.getByRole('button', { name: 'Save general' }).first().click()

      await expect(page.getByText(TEMP_TOURNAMENT_TITLE).first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByLabel('Sport')).toHaveValue('Football')
      await expect(page.getByLabel('Default scoring').locator('option:checked')).toHaveText('QA Standard Netball')

      // Reload to prove the public event info field persisted to the database.
      await page.reload()
      await openQaTournament(page)
      await openAdminPanel(page, 'General')
      await expect(page.getByLabel('Parking notes')).toHaveValue(TEMP_PARKING_NOTE, { timeout: 10_000 })
    } finally {
      await resetQaTournamentGeneral()
    }
  })

  test('creates and edits a temporary division without touching public smoke divisions', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await deleteQaDivisionsBySlug([TEMP_DIVISION_SLUG, TEMP_DIVISION_EDITED_SLUG])

    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Divisions')

      await page.getByRole('button', { name: 'New division' }).click()
      let dialog = page.getByRole('dialog', { name: 'New division' })
      await expect(dialog).toBeVisible()
      await dialog.getByLabel('Name').fill(TEMP_DIVISION_NAME)
      await dialog.getByLabel('URL slug').fill(TEMP_DIVISION_SLUG)
      await dialog.getByLabel('Display order').fill('99')
      await dialog.getByLabel(/Skill level/).fill('QA workflow')
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(divisionRow(page, TEMP_DIVISION_NAME)).toBeVisible()

      await divisionRow(page, TEMP_DIVISION_NAME)
        .getByRole('button')
        .filter({ hasText: 'Edit', hasNotText: 'Add/Edit Teams' })
        .click()
      dialog = page.getByRole('dialog', { name: 'Edit division' })
      await expect(dialog).toBeVisible()
      await dialog.getByLabel('Name').fill(TEMP_DIVISION_EDITED_NAME)
      await dialog.getByLabel('URL slug').fill(TEMP_DIVISION_EDITED_SLUG)
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(divisionRow(page, TEMP_DIVISION_EDITED_NAME)).toBeVisible()
      await expect(page.getByText(TEMP_DIVISION_NAME, { exact: true })).toHaveCount(0)
    } finally {
      await deleteQaDivisionsBySlug([TEMP_DIVISION_SLUG, TEMP_DIVISION_EDITED_SLUG])
    }
  })

  test('adds a disposable team to the workflow division team list', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await deleteWorkflowTeamsByName([TEMP_WORKFLOW_TEAM])

    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Divisions')

      await divisionRow(page, 'QA Workflow Division').getByRole('button', { name: /Add\/Edit Teams/ }).click()
      await expect(page.getByText('QA Workflow Division').first()).toBeVisible()
      await expect(page.getByText('Add/Edit Teams')).toBeVisible()

      await page.getByRole('button', { name: 'Add team' }).click()
      const dialog = page.getByRole('dialog', { name: 'Add team' })
      await expect(dialog).toBeVisible()
      await dialog.getByLabel('Name', { exact: true }).fill(TEMP_WORKFLOW_TEAM)
      await dialog.getByLabel(/Short name/).fill('WE2E')
      await dialog.getByRole('button', { name: 'Save' }).click()

      await expect(page.getByText(TEMP_WORKFLOW_TEAM, { exact: true })).toBeVisible()
      await expect(page.getByText('WE2E')).toBeVisible()
    } finally {
      await deleteWorkflowTeamsByName([TEMP_WORKFLOW_TEAM])
    }
  })

  test('opens the workflow division format view without changing fixtures', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    await signInAndOpenQaTournament(page)
    await openDivisionFormat(page, 'QA Workflow Division')

    await expect(page.getByRole('heading', { name: 'Workflow Round Robin' })).toBeVisible()
  })

  test('opens the guided change-format picker without applying a new format', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    await signInAndOpenQaTournament(page)
    await openDivisionFormat(page, 'QA Format - Two Pools')

    await page.getByRole('button', { name: 'Change format' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a format' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Simple Round Robin/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Group Stage \+ Finals/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Knockout/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /League Season/i })).toBeVisible()
  })

  test('shows fixture-generation controls for a seeded format stage', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    await signInAndOpenQaTournament(page)
    await openDivisionFormat(page, 'QA Format - Two Pools')

    await page.getByText('Show advanced', { exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Advanced setup' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fixture generation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate fixtures for Pool Play' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate only unscheduled fixtures' })).toBeVisible()
  })

  test('shows teams already assigned to another pool as locked in pool assignment', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    await signInAndOpenQaTournament(page)
    await openDivisionFormat(page, 'QA Format - Two Pools')

    await page.getByText('Show advanced', { exact: true }).first().click()
    const poolBRow = page.locator('tr').filter({ hasText: 'Pool B' }).first()
    await expect(poolBRow).toBeVisible()
    await poolBRow.getByRole('button', { name: 'Teams' }).click()

    const dialog = page.getByRole('dialog', { name: 'Assign teams' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Pool B', { exact: true })).toBeVisible()

    const poolATeam = dialog.locator('li').filter({ hasText: 'QA Two Pools Team 1' }).first()
    await expect(poolATeam.getByRole('checkbox')).toBeDisabled()
    await expect(poolATeam.getByText('Pool A', { exact: true })).toBeVisible()

    const poolBTeam = dialog.locator('li').filter({ hasText: 'QA Two Pools Team 3' }).first()
    await expect(poolBTeam.getByRole('checkbox')).toBeEnabled()
    await expect(poolBTeam.getByRole('checkbox')).toBeChecked()
  })

  test('creates and edits a disposable scoring system template', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await deleteQaScoringSystemsByName([TEMP_SCORING_NAME, TEMP_SCORING_EDITED_NAME])

    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Scoring')

      await page.getByRole('button', { name: 'New Template' }).click()
      await expect(page.getByRole('heading', { name: 'Create Scoring System' })).toBeVisible()
      await page.getByLabel('System Name').fill(TEMP_SCORING_NAME)
      await page.getByLabel('Sport Type').selectOption('Football')
      await page.getByLabel('Win Points').fill('4')
      await page.getByLabel('Draw Points').fill('2')
      await page.getByLabel('Loss Points').fill('1')
      await page.getByRole('button', { name: 'Save Scoring System' }).click()

      const createdRow = page.locator('tbody tr').filter({ hasText: TEMP_SCORING_NAME }).first()
      await expect(createdRow).toBeVisible()
      await expect(createdRow).toContainText('Football')
      await expect(createdRow).toContainText('4 - 2 - 1')

      await createdRow.click()
      await expect(page.getByRole('heading', { name: 'Edit Scoring System' })).toBeVisible()
      await page.getByLabel('System Name').fill(TEMP_SCORING_EDITED_NAME)
      await page.getByLabel('Win Points').fill('6')
      await page.getByRole('button', { name: 'Save Scoring System' }).click()

      const editedRow = page.locator('tbody tr').filter({ hasText: TEMP_SCORING_EDITED_NAME }).first()
      await expect(editedRow).toBeVisible()
      await expect(editedRow).toContainText('Football')
      await expect(editedRow).toContainText('6 - 2 - 1')
      await expect(page.getByText(TEMP_SCORING_NAME, { exact: true })).toHaveCount(0)
    } finally {
      await deleteQaScoringSystemsByName([TEMP_SCORING_NAME, TEMP_SCORING_EDITED_NAME])
    }
  })

  test('records a score against a workflow fixture and resets it afterwards', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await resetWorkflowFixtures()

    try {
      await signInAndOpenQaTournament(page)
      await openAdminPanel(page, 'Match Entry')
      await page.getByRole('button', { name: 'QA Workflow Division' }).click()

      const matchRow = page.locator('li').filter({ hasText: 'Workflow Alpha' }).filter({ hasText: 'Workflow Bravo' }).first()
      await expect(matchRow).toBeVisible()
      await matchRow.getByRole('button', { name: /Edit/ }).click()

      const dialog = page.getByRole('dialog', { name: /Workflow Alpha vs Workflow Bravo/ })
      await expect(dialog).toBeVisible()
      await dialog.locator('#home-score').fill('12')
      await dialog.locator('#away-score').fill('7')
      await dialog.locator('#status').selectOption('completed')
      await dialog.getByRole('button', { name: 'Save' }).click()

      const updatedRow = page.locator('li').filter({ hasText: 'Workflow Alpha' }).filter({ hasText: 'Workflow Bravo' }).first()
      await expect(updatedRow.getByText('Completed')).toBeVisible()
      await expect(updatedRow.getByText(new RegExp('12\\s*(?:-|\\u2013)\\s*7'))).toBeVisible()
    } finally {
      await resetWorkflowFixtures()
    }
  })

  test('updates a workflow fixture time from the schedule view and resets it afterwards', async ({ page }, testInfo) => {
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
})
