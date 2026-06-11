import { defineConfig, devices } from '@playwright/test'

// Documentation screenshot runs (npm run docs:screenshots).
// Kept separate from the QA smoke config so screenshot generation never runs
// as part of qa:e2e, and so the viewport stays fixed for consistent assets.

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '3000'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`
const shouldStartServer = process.env.PLAYWRIGHT_START_SERVER === '1' && !process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests/docs',
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  webServer: !shouldStartServer
    ? undefined
    : {
        command: `npx next dev -p ${playwrightPort}`,
        url: baseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1',
        timeout: 120_000,
      },
  projects: [
    {
      name: 'docs-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
})
