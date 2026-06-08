import { defineConfig, devices, type ReporterDescription } from '@playwright/test'

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '3000'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`
const shouldStartServer = process.env.PLAYWRIGHT_START_SERVER === '1' && !process.env.PLAYWRIGHT_BASE_URL
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : undefined
const recordAllArtifacts = process.env.PLAYWRIGHT_RECORD_ALL_ARTIFACTS === '1'
const baseReporters: ReporterDescription[] = process.env.CI
  ? [['github'], ['html', { open: 'never' }]]
  : [['list'], ['html', { open: 'never' }]]
const jsonReporter: ReporterDescription[] = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME
  ? [['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME }]]
  : []

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: configuredWorkers ?? (process.env.CI ? 1 : undefined),
  reporter: [...baseReporters, ...jsonReporter],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: recordAllArtifacts ? 'on' : 'only-on-failure',
    video: recordAllArtifacts ? 'on' : 'retain-on-failure',
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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
