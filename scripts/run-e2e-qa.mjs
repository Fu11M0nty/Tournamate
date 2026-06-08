import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const npxCommand = isWindows ? 'npx.cmd' : 'npx'

function run(command, args, extraEnv = {}) {
  const spawnCommand = isWindows ? 'cmd.exe' : command
  const spawnArgs = isWindows ? ['/d', '/s', '/c', command, ...args] : args

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(result.error.message)
    return 1
  }
  return result.status ?? 1
}

function startServer(port) {
  const command = isWindows ? 'cmd.exe' : 'npx'
  const args = isWindows
    ? ['/d', '/s', '/c', 'npx.cmd', 'next', 'dev', '-p', port]
    : ['next', 'dev', '-p', port]

  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })
}

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (response.ok || response.status < 500) return
    } catch {
      // Keep polling until Next has bound the port and compiled the first route.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function stopServer(child) {
  if (!child || child.killed) return
  if (isWindows && child.pid) {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    })
    return
  }
  child.kill('SIGTERM')
}

let exitCode = 0
let seeded = false
let server = null
const qaReportDir = 'qa-reports'
const playwrightJsonReport = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? `${qaReportDir}/playwright-results.json`

function parseArgs(argv) {
  const playwrightArgs = []
  const reportEnv = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--expected-passed') {
      const value = argv[index + 1]
      if (!value) throw new Error('--expected-passed requires a value')
      reportEnv.QA_EXPECTED_E2E_PASSED = value
      index += 1
      continue
    }
    if (arg === '--expected-skipped') {
      const value = argv[index + 1]
      if (!value) throw new Error('--expected-skipped requires a value')
      reportEnv.QA_EXPECTED_E2E_SKIPPED = value
      index += 1
      continue
    }
    playwrightArgs.push(arg)
  }

  return { playwrightArgs, reportEnv }
}

const { playwrightArgs, reportEnv } = parseArgs(process.argv.slice(2))

mkdirSync(qaReportDir, { recursive: true })

exitCode = run(npmCommand, ['run', 'qa:cleanup'])
if (exitCode === 0) {
  exitCode = run(npmCommand, ['run', 'qa:seed'])
  seeded = exitCode === 0
}
if (exitCode === 0) {
  const port = process.env.PLAYWRIGHT_PORT ?? '3100'
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    server = startServer(port)
    try {
      await waitForServer(baseURL)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      exitCode = 1
    }
  }
  if (exitCode === 0) {
    exitCode = run(npxCommand, ['playwright', 'test', ...playwrightArgs], {
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_JSON_OUTPUT_NAME: playwrightJsonReport,
      PLAYWRIGHT_START_SERVER: undefined,
      PLAYWRIGHT_PORT: port,
      PLAYWRIGHT_WORKERS: process.env.PLAYWRIGHT_WORKERS ?? '1',
      PLAYWRIGHT_RECORD_ALL_ARTIFACTS: process.env.PLAYWRIGHT_RECORD_ALL_ARTIFACTS ?? '1',
    })
    const reportCode = run('node', ['scripts/generate-qa-report.mjs', '--input', playwrightJsonReport], {
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_RECORD_ALL_ARTIFACTS: process.env.PLAYWRIGHT_RECORD_ALL_ARTIFACTS ?? '1',
      ...reportEnv,
    })
    const evidenceCode = run('node', ['scripts/generate-qa-evidence-index.mjs', '--input', playwrightJsonReport])
    if (exitCode === 0 && reportCode !== 0) exitCode = reportCode
    if (exitCode === 0 && evidenceCode !== 0) exitCode = evidenceCode
  }
  stopServer(server)
}

if (seeded) {
  const cleanupCode = run(npmCommand, ['run', 'qa:cleanup'])
  if (exitCode === 0 && cleanupCode !== 0) exitCode = cleanupCode
}

process.exit(exitCode)
