import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: false,
  })
  return result.status === 0 ? result.stdout.trim() : 'unknown'
}

function envValue(name) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : 'not set'
}

function supabaseProjectRef() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return 'not set'
  try {
    return new URL(raw).hostname.split('.')[0] || 'unknown'
  } catch {
    return 'invalid URL'
  }
}

function normaliseStatus(test) {
  const results = Array.isArray(test.results) ? test.results : []
  const last = results.at(-1)
  if (last?.status) return last.status
  if (test.status === 'expected') return 'passed'
  if (test.status === 'unexpected') return 'failed'
  return test.status ?? 'unknown'
}

function durationMs(test) {
  const results = Array.isArray(test.results) ? test.results : []
  return results.reduce((total, result) => total + (Number(result.duration) || 0), 0)
}

function errorMessages(test) {
  const results = Array.isArray(test.results) ? test.results : []
  return results.flatMap((result) => {
    const errors = Array.isArray(result.errors) ? result.errors : []
    if (errors.length > 0) return errors
    return result.error ? [result.error] : []
  }).map((error) => error.message || error.value || error.stack || String(error))
}

function collectTests(suites, ancestors = []) {
  const rows = []
  for (const suite of suites ?? []) {
    const nextAncestors = suite.title ? [...ancestors, suite.title] : ancestors
    for (const spec of suite.specs ?? []) {
      const title = [...nextAncestors, spec.title].filter(Boolean).join(' > ')
      for (const test of spec.tests ?? []) {
        rows.push({
          title,
          project: test.projectName || 'default',
          status: normaliseStatus(test),
          durationMs: durationMs(test),
          expectedStatus: test.expectedStatus || 'passed',
          errors: errorMessages(test),
        })
      }
    }
    rows.push(...collectTests(suite.suites ?? [], nextAncestors))
  }
  return rows
}

function statusCounts(tests) {
  const counts = {
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    timedOut: 0,
    interrupted: 0,
    unknown: 0,
  }
  for (const test of tests) {
    if (test.status === 'passed') counts.passed += 1
    else if (test.status === 'skipped') counts.skipped += 1
    else if (test.status === 'flaky') counts.flaky += 1
    else if (test.status === 'timedOut') counts.timedOut += 1
    else if (test.status === 'interrupted') counts.interrupted += 1
    else if (test.status === 'failed') counts.failed += 1
    else counts.unknown += 1
  }
  return counts
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function markdownList(items, emptyText) {
  if (items.length === 0) return `- ${emptyText}`
  return items.map((item) => `- ${item}`).join('\n')
}

const input = path.resolve(argValue('--input', 'qa-reports/playwright-results.json'))
const outputDir = path.resolve(argValue('--output-dir', 'qa-reports'))
const generatedAt = new Date()
const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-')
const output = path.join(outputDir, `qa-e2e-report-${timestamp}.md`)
const latestOutput = path.join(outputDir, 'latest-qa-e2e-report.md')

mkdirSync(outputDir, { recursive: true })

if (!existsSync(input)) {
  console.error(`Playwright JSON report not found: ${input}`)
  process.exit(1)
}

const raw = JSON.parse(readFileSync(input, 'utf8'))
const tests = collectTests(raw.suites ?? [])
const counts = statusCounts(tests)
const total = tests.length
const failed = tests.filter((test) => ['failed', 'timedOut', 'interrupted', 'unknown'].includes(test.status))
const skipped = tests.filter((test) => test.status === 'skipped')
const totalDuration = tests.reduce((totalMs, test) => totalMs + test.durationMs, 0)
const expectedPassed = Number(process.env.QA_EXPECTED_E2E_PASSED ?? 40)
const expectedSkipped = Number(process.env.QA_EXPECTED_E2E_SKIPPED ?? 34)
const qaAdminEmail = process.env.QA_ADMIN_EMAIL?.trim() || process.env.E2E_ADMIN_EMAIL?.trim() || 'qa-admin@tournamate.test'
const expectedResultMatches =
  counts.passed === expectedPassed &&
  counts.skipped === expectedSkipped &&
  counts.failed === 0 &&
  counts.timedOut === 0 &&
  counts.interrupted === 0 &&
  counts.unknown === 0

const report = `# QA E2E Evidence Report

Generated: ${generatedAt.toISOString()}

## Summary

${expectedResultMatches ? 'Status: PASS - matches the current expected browser QA result.' : 'Status: REVIEW REQUIRED - result does not match the current expected browser QA result.'}

| Metric | Count |
| --- | ---: |
| Total tests | ${total} |
| Passed | ${counts.passed} |
| Skipped | ${counts.skipped} |
| Failed | ${counts.failed} |
| Timed out | ${counts.timedOut} |
| Interrupted | ${counts.interrupted} |
| Flaky | ${counts.flaky} |
| Unknown | ${counts.unknown} |
| Duration | ${formatDuration(totalDuration)} |

Expected current smoke result: ${expectedPassed} passed, ${expectedSkipped} skipped.

## Environment

| Item | Value |
| --- | --- |
| Base URL | ${envValue('PLAYWRIGHT_BASE_URL') === 'not set' ? `http://localhost:${process.env.PLAYWRIGHT_PORT ?? '3100'}` : envValue('PLAYWRIGHT_BASE_URL')} |
| QA tournament slug | ${envValue('QA_TOURNAMENT_SLUG') === 'not set' ? 'qa-smoke-tournament' : envValue('QA_TOURNAMENT_SLUG')} |
| QA admin email | ${qaAdminEmail} |
| Supabase project ref | ${supabaseProjectRef()} |
| QA remote allowed | ${process.env.QA_ALLOW_REMOTE === '1' ? 'yes' : 'no'} |
| Screenshots and videos | ${process.env.PLAYWRIGHT_RECORD_ALL_ARTIFACTS === '1' ? 'all tests' : 'failures only'} |
| Git branch | ${runGit(['rev-parse', '--abbrev-ref', 'HEAD'])} |
| Git commit | ${runGit(['rev-parse', '--short', 'HEAD'])} |
| Working tree files changed | ${runGit(['status', '--short', '--untracked-files=no']).split('\n').filter(Boolean).length} |

## Failed Or Review Tests

${markdownList(
  failed.map((test) => {
    const errorText = test.errors[0] ? ` - ${test.errors[0].split('\n')[0]}` : ''
    return `${test.project}: ${test.title} (${test.status})${errorText}`
  }),
  'None'
)}

## Skipped Tests

${markdownList(
  skipped.map((test) => `${test.project}: ${test.title}`),
  'None'
)}

## Evidence Files

- Playwright HTML report: \`playwright-report/index.html\`
- Playwright JSON report: \`${path.relative(process.cwd(), input)}\`
- Test-by-test evidence index: \`${path.relative(process.cwd(), path.join(outputDir, 'latest-qa-evidence-index.md')).replaceAll(path.sep, '/')}\`
- Screenshots/videos/traces: \`test-results/\`
- This evidence report: \`${path.relative(process.cwd(), output)}\`

## QA Analyst Sign-Off

| Check | Result | Notes |
| --- | --- | --- |
| Automated browser QA reviewed | Pending |  |
| Failed tests triaged | Pending |  |
| Skipped test accepted | Pending | Desktop-only admin workflow skip on mobile is expected. |
| Manual smoke completed, if required | Pending |  |
| Release approved | Pending |  |

Approver:

Date:
`

writeFileSync(output, report, 'utf8')
writeFileSync(latestOutput, report, 'utf8')

console.log(`QA report written to ${path.relative(process.cwd(), output)}`)
console.log(`Latest QA report written to ${path.relative(process.cwd(), latestOutput)}`)
