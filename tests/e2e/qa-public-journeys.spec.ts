import { expect, test } from '@playwright/test'

const QA_SLUG = process.env.QA_TOURNAMENT_SLUG?.match(/^qa-[a-z0-9-]+/)?.[0] ?? 'qa-smoke-tournament'

test.describe('QA public participant journeys', () => {
  test('shows tournament information and venue details on the public hub', async ({ page }) => {
    await page.goto(`/${QA_SLUG}`)

    await expect(page.getByRole('heading', { name: 'QA Smoke Tournament' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tournament info' })).toBeVisible()
    await expect(page.getByText('Automated QA seed data. Safe to delete.')).toBeVisible()
    await expect(page.getByText('Sport', { exact: true })).toBeVisible()
    await expect(page.getByText('Netball', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Venue', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('QA Arena, Milton Keynes, Buckinghamshire, MK1 1QA', { exact: true })).toBeVisible()
  })

  test('filters the public team list without leaving the tournament hub', async ({ page }) => {
    await page.goto(`/${QA_SLUG}?tab=teams`)

    await expect(page.getByText('Amber Aces')).toBeVisible()
    await expect(page.getByText('QA Icons')).toBeVisible()

    await page.getByPlaceholder('Team name').fill('Amber')

    await expect(page.getByText('Amber Aces')).toBeVisible()
    await expect(page.getByText('QA Icons')).toHaveCount(0)
  })

  test('filters the public schedule between upcoming fixtures and played results', async ({ page }) => {
    await page.goto(`/${QA_SLUG}?tab=schedule`)

    await expect(page.getByText('Blue Bolts', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Workflow Alpha', { exact: true }).first()).toBeVisible()

    await page.getByLabel('Show').selectOption('played')

    await expect(page.getByText('Amber Aces', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Blue Bolts', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Workflow Alpha', { exact: true })).toHaveCount(0)
  })

  test('uses friendly public not-found pages for invalid tournament and division slugs', async ({ page }) => {
    await page.goto('/qa-missing-tournament')

    await expect(page.getByRole('heading', { name: 'Tournament not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')

    await page.goto(`/${QA_SLUG}/saturday/not-a-real-division`)

    await expect(page.getByRole('heading', { name: 'Division not found' })).toBeVisible()
    await expect(page.getByText('There is no "not-a-real-division" division on Saturday.')).toBeVisible()
  })
})
