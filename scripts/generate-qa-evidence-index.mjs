import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
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

function testAttachments(test) {
  const results = Array.isArray(test.results) ? test.results : []
  return results.flatMap((result) => {
    const attachments = Array.isArray(result.attachments) ? result.attachments : []
    return attachments
      .filter((attachment) => attachment.path)
      .map((attachment) => ({
        name: attachment.name || 'attachment',
        contentType: attachment.contentType || '',
        path: attachment.path,
      }))
  })
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
          attachments: testAttachments(test),
        })
      }
    }
    rows.push(...collectTests(suite.suites ?? [], nextAncestors))
  }
  return rows
}

function attachmentKind(attachment) {
  const contentType = attachment.contentType.toLowerCase()
  const extension = path.extname(attachment.path).toLowerCase()
  if (contentType.includes('image') || extension === '.png') return 'screenshot'
  if (contentType.includes('video') || extension === '.webm') return 'video'
  if (extension === '.zip' || attachment.name.toLowerCase().includes('trace')) return 'trace'
  return attachment.name
}

function markdownLink(label, targetPath) {
  const relativePath = path.relative(process.cwd(), targetPath).replaceAll(path.sep, '/')
  return `[${label}](${relativePath})`
}

function evidenceLinks(attachments, kind) {
  const matching = attachments.filter((attachment) => attachmentKind(attachment) === kind)
  if (matching.length === 0) return '-'
  return matching
    .map((attachment, index) => markdownLink(index === 0 ? kind : `${kind} ${index + 1}`, attachment.path))
    .join(', ')
}

function statusCounts(tests) {
  return tests.reduce(
    (counts, test) => {
      counts[test.status] = (counts[test.status] ?? 0) + 1
      return counts
    },
    { passed: 0, skipped: 0, failed: 0 }
  )
}

const input = path.resolve(argValue('--input', 'qa-reports/playwright-results.json'))
const outputDir = path.resolve(argValue('--output-dir', 'qa-reports'))
const generatedAt = new Date()
const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-')
const output = path.join(outputDir, `qa-evidence-index-${timestamp}.md`)
const latestOutput = path.join(outputDir, 'latest-qa-evidence-index.md')

mkdirSync(outputDir, { recursive: true })

if (!existsSync(input)) {
  console.error(`Playwright JSON report not found: ${input}`)
  process.exit(1)
}

const raw = JSON.parse(readFileSync(input, 'utf8'))
const tests = collectTests(raw.suites ?? [])
const counts = statusCounts(tests)
const testsWithEvidence = tests.filter((test) => test.attachments.length > 0).length
const testsWithoutEvidence = tests.length - testsWithEvidence

const rows = tests
  .map((test, index) => {
    const title = test.title.replaceAll('|', '\\|')
    const cells = [
      index + 1,
      test.project,
      test.status,
      title,
      formatDuration(test.durationMs),
      evidenceLinks(test.attachments, 'screenshot'),
      evidenceLinks(test.attachments, 'video'),
      evidenceLinks(test.attachments, 'trace'),
    ]
    return `| ${cells.join(' | ')} |`
  })
  .join('\n')

const report = `# QA Evidence Index

Generated: ${generatedAt.toISOString()}

This index links each browser QA test to the screenshot, video, and trace files captured by Playwright. Use it with \`qa-reports/latest-qa-e2e-report.md\` for release review.

## Summary

| Metric | Count |
| --- | ---: |
| Total browser tests | ${tests.length} |
| Passed | ${counts.passed ?? 0} |
| Skipped | ${counts.skipped ?? 0} |
| Failed | ${counts.failed ?? 0} |
| Tests with evidence | ${testsWithEvidence} |
| Tests without evidence | ${testsWithoutEvidence} |

## Evidence Table

| # | Project | Status | Test | Duration | Screenshot | Video | Trace |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
${rows}

## Notes For QA Analysts

- Skipped tests usually do not have screenshots or videos because Playwright did not open a browser page for them.
- Desktop admin workflow tests are intentionally skipped on the mobile project until those workflows are made mobile-supported.
- Open \`playwright-report/index.html\` for the richest visual review, including timelines and attachments grouped by test.
`

writeFileSync(output, report, 'utf8')
writeFileSync(latestOutput, report, 'utf8')

console.log(`QA evidence index written to ${path.relative(process.cwd(), output)}`)
console.log(`Latest QA evidence index written to ${path.relative(process.cwd(), latestOutput)}`)
