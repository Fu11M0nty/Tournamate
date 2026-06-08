import { expect, test } from '@playwright/test'
import { openAdminPanel, signInAndOpenQaTournament, skipUnlessDesktop } from './helpers/qa-admin'

test.describe('QA admin workflow smoke', () => {
  test('signs in and reaches the seeded tournament management panels', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)

    await signInAndOpenQaTournament(page)
    await expect(page.getByText('QA Smoke Tournament').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
    await expect(page.getByLabel('Title / name')).toHaveValue('QA Smoke Tournament')
    await expect(page.getByText('QA Arena').first()).toBeVisible()

    await openAdminPanel(page, 'Divisions')
    await expect(page.getByRole('heading', { name: /Divisions/i })).toBeVisible()
    await expect(page.getByText('QA Under 10')).toBeVisible()
    await expect(page.getByText('QA Under 12')).toBeVisible()
    await expect(page.getByText('QA Workflow Division')).toBeVisible()

    await openAdminPanel(page, 'Match Entry')
    await expect(page.getByLabel('Tournament day')).toBeVisible()
    await expect(page.getByLabel('Division')).toBeVisible()
    await expect(page.getByText('Amber Aces').first()).toBeVisible()
    await expect(page.getByText('Blue Bolts').first()).toBeVisible()
    await expect(page.getByText('Completed').first()).toBeVisible()

    await openAdminPanel(page, 'Schedule')
    await expect(page.getByText(/Schedule.*QA Smoke Tournament/)).toBeVisible()
    await expect(page.locator('header').filter({ hasText: /Court 1/ }).first()).toBeVisible()
    await expect(page.locator('header').filter({ hasText: /Court 2/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Amber Aces vs Blue Bolts/ })).toBeVisible()

    await openAdminPanel(page, 'Scoring')
    await expect(page.getByRole('heading', { name: 'Scoring Systems' })).toBeVisible()
    await expect(page.getByText('QA Standard Netball')).toBeVisible()
  })
})
