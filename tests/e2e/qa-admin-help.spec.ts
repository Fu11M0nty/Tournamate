import { expect, test } from '@playwright/test'
import {
  openAdminPanel,
  signInAndOpenQaTournament,
  skipUnlessDesktop,
} from './helpers/qa-admin'

test.describe('QA admin help centre', () => {
  test('opens the Help panel, browses a guide, and shows print and video blocks', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await signInAndOpenQaTournament(page)
    await openAdminPanel(page, 'Help')

    await expect(page.getByRole('heading', { name: /HELP/ }).first()).toBeVisible()

    // Category navigation renders with guides grouped beneath it.
    await expect(page.getByText('Getting started', { exact: true })).toBeVisible()
    await expect(page.getByText('Scheduling', { exact: true })).toBeVisible()

    // Open the multi-week schedule guide and check its content renders.
    await page.getByRole('button', { name: /Running a multi-week schedule/ }).click()
    await expect(page.getByRole('heading', { name: 'Running a multi-week schedule' })).toBeVisible()
    await expect(page.getByText('Venue availability, courts, and playable days')).toBeVisible()

    // Print control and video placeholder are present.
    await expect(page.getByRole('button', { name: 'Print this guide' })).toBeVisible()
    await expect(page.getByTestId('help-video-placeholder')).toBeVisible()
  })

  test('search filters the guide list', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await signInAndOpenQaTournament(page)
    await openAdminPanel(page, 'Help')

    const search = page.getByRole('searchbox', { name: 'Search help guides' })
    await search.fill('snapshot')
    await expect(page.getByRole('button', { name: /Snapshots and backups/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Running a multi-week schedule/ })).toHaveCount(0)

    await search.fill('')
    await expect(page.getByRole('button', { name: /Running a multi-week schedule/ })).toBeVisible()
  })

  test('contextual help prompts deep-link to the relevant guide', async ({ page }, testInfo) => {
    skipUnlessDesktop(testInfo)
    await signInAndOpenQaTournament(page)

    // Scoring panel carries an "i" prompt that should open the scoring guide.
    await openAdminPanel(page, 'Scoring')
    await page.getByRole('button', { name: 'Help: scoring systems' }).click()
    await expect(page.getByRole('heading', { name: 'Configuring scoring systems' })).toBeVisible()

    // General panel prompt opens the scheduling-modes guide.
    await openAdminPanel(page, 'General')
    await page.getByRole('button', { name: 'Help: scheduling modes' }).click()
    await expect(page.getByRole('heading', { name: 'Choosing a scheduling mode' })).toBeVisible()
  })

  test('help panel renders on a mobile viewport', async ({ page }, testInfo) => {
    await signInAndOpenQaTournament(page)

    const isMobile = testInfo.project.name !== 'chromium'
    if (isMobile) {
      await page.getByRole('button', { name: 'Open navigation menu' }).click()
    }
    await openAdminPanel(page, 'Help')

    await expect(page.getByRole('heading', { name: /HELP/ }).first()).toBeVisible()
    await page.getByRole('button', { name: /Creating and editing a tournament/ }).click()
    await expect(page.getByRole('heading', { name: 'Creating and editing a tournament' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print this guide' })).toBeVisible()
  })
})
