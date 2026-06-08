import { expect, test } from '@playwright/test'

const QA_SLUG = process.env.QA_TOURNAMENT_SLUG?.match(/^qa-[a-z0-9-]+/)?.[0] ?? 'qa-smoke-tournament'

test.describe('QA public format structure smoke', () => {
  test('renders seeded table and fixture-only format divisions', async ({ page }) => {
    await page.goto(`/${QA_SLUG}/saturday/qa-round-robin`)
    await expect(page.getByRole('heading', { name: /QA Format - Simple Round Robin/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upcoming fixtures' })).toBeVisible()
    await expect(page.getByText('QA Simple Round Robin Team 1').first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-two-pools`)
    await expect(page.getByRole('heading', { name: /QA Format - Two Pools/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pool A' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pool B' })).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-league-home-away`)
    await expect(page.getByRole('heading', { name: /QA Format - League Home Away/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
    await expect(page.getByText('QA League Home Away Team 1').first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-festival`)
    await expect(page.getByRole('heading', { name: /QA Format - Festival Fixtures/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upcoming fixtures' })).toBeVisible()
    await expect(page.getByText('QA Festival Fixtures Team 1').first()).toBeVisible()
  })

  test('renders seeded progression and bracket format divisions', async ({ page }) => {
    await page.goto(`/${QA_SLUG}/saturday/qa-group-finals?phase=semi-finals`)
    await expect(page.getByRole('heading', { name: /QA Format - Group Stage \+ Finals/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Road to the Final' })).toBeVisible()
    await expect(page.getByText('Pool A winner').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('Pool B runner-up').filter({ visible: true }).first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-knockout?phase=finals`)
    await expect(page.getByRole('heading', { name: /QA Format - Knockout Only/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Road to the Final' })).toBeVisible()
    await expect(page.getByText('Winner of Semi-final 1').filter({ visible: true }).first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-knockout-playins?phase=semi-finals`)
    await expect(page.getByRole('heading', { name: /QA Format - Knockout \+ Play-ins/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Road to the Final' })).toBeVisible()
    await expect(page.getByText('Play-in 1').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('Winner of Play-in 1').filter({ visible: true }).first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-grading-champ-plate?phase=championship`)
    await expect(page.getByRole('heading', { name: /QA Format - Grading Championship Plate/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upcoming fixtures' })).toBeVisible()
    await expect(page.getByText('Pool A 1st').filter({ visible: true }).first()).toBeVisible()

    await page.goto(`/${QA_SLUG}/saturday/qa-double-elimination?phase=prelim-final`)
    await expect(page.getByRole('heading', { name: /QA Format - Double Elimination/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Road to the Final' })).toBeVisible()
    await expect(page.getByText('Winner of Minor Semi-final').filter({ visible: true }).first()).toBeVisible()
  })
})
