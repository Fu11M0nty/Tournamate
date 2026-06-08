import { expect, test } from '@playwright/test'

const QA_SLUG = process.env.QA_TOURNAMENT_SLUG?.match(/^qa-[a-z0-9-]+/)?.[0] ?? 'qa-smoke-tournament'

test.describe('QA public tournament smoke', () => {
  test('renders the tournament hub and seeded summary data', async ({ page }) => {
    await page.goto(`/${QA_SLUG}`)

    await expect(page.getByRole('heading', { name: 'QA Smoke Tournament' })).toBeVisible()
    await expect(page.getByText('14 divisions')).toBeVisible()
    await expect(page.getByText('66 teams')).toBeVisible()

    await page.goto(`/${QA_SLUG}?tab=teams`)
    await expect(page.getByText('Amber Aces')).toBeVisible()
    await expect(page.getByText('QA Icons')).toBeVisible()
    await expect(page.getByText('Workflow Alpha')).toBeVisible()
    await expect(page.getByText('QA Knockout Only Team 1')).toBeVisible()

    await page.goto(`/${QA_SLUG}?tab=schedule`)
    await expect(page.getByText('Blue Bolts', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('QA Lions', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Workflow Alpha', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('QA Format - Group Stage + Finals - Court 1').first()).toBeVisible()
    await expect(page.getByText('TBD', { exact: true }).first()).toBeVisible()
  })

  test('renders public division standings, results and fixtures', async ({ page }) => {
    await page.goto(`/${QA_SLUG}/saturday/qa-under-10`)

    await expect(page.getByRole('heading', { name: /QA Under 10/i })).toBeVisible()
    await expect(page.getByText('QA Smoke Tournament')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upcoming fixtures' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Amber Aces' })).toBeVisible()
    await expect(page.getByLabel('Results').getByText('Blue Bolts')).toBeVisible()
    await expect(page.getByLabel('Results').getByText('14').first()).toBeVisible()
    await expect(page.getByLabel('Results').getByText('10').first()).toBeVisible()
  })

  test('renders group-stage pool standings for a multi-pool division', async ({ page }) => {
    await page.goto(`/${QA_SLUG}/saturday/qa-under-12`)

    await expect(page.getByRole('heading', { name: /QA Under 12/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pool A' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pool B' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'QA Falcons' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'QA Kings' })).toBeVisible()
  })
})

test.describe('QA admin access smoke', () => {
  test('protects the admin console for anonymous users', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/admin/login')
  })

  test('keeps disabled admin signup out of public use', async ({ page }) => {
    await page.goto('/admin/signup')

    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
