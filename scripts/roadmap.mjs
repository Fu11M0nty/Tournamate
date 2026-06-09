#!/usr/bin/env node
// Tournamate roadmap CLI — a thin wrapper over the GitHub Projects v2 GraphQL API.
//
// Lets humans and coding assistants (Claude Code / Codex / Gemini) post items to,
// and pull items from, the "Tournamate Roadmap" project using friendly field names
// instead of raw node/option IDs. Auth is delegated to the `gh` CLI, so the caller
// only needs `gh auth login` with the `project` scope — no tokens handled here.
//
// Usage:
//   node scripts/roadmap.mjs add  --title "..." [--area ..] [--priority ..] [--effort ..]
//                                  [--value ..] [--estimate N --unit Days] [--timeframe ..]
//                                  [--status ..] [--source ..] [--start YYYY-MM-DD]
//                                  [--target YYYY-MM-DD] [--acceptance "..."] [--deps "..."]
//                                  [--body "..."]
//   node scripts/roadmap.mjs list [--status ..] [--area ..] [--timeframe ..] [--priority ..]
//                                  [--source ..] [--limit N] [--json]
//   node scripts/roadmap.mjs pull [--area ..] [--limit N] [--json]   # actionable items, ranked
//   node scripts/roadmap.mjs show <itemId|title-substring>
//   node scripts/roadmap.mjs set  <itemId|title-substring> [--status ..] [--timeframe ..] ...
//   node scripts/roadmap.mjs fields                                  # list fields + options
//
// Env overrides: ROADMAP_OWNER (default Fu11M0nty), ROADMAP_PROJECT (default 1).

import { execFileSync } from 'node:child_process'

const OWNER = process.env.ROADMAP_OWNER || 'Fu11M0nty'
const NUMBER = Number(process.env.ROADMAP_PROJECT || '1')

// Map CLI flags to project field names + their kind.
const FIELD_MAP = {
  area: { field: 'Area', kind: 'select' },
  priority: { field: 'Priority', kind: 'select' },
  effort: { field: 'Effort', kind: 'select' },
  value: { field: 'Value', kind: 'select' },
  timeframe: { field: 'Timeframe', kind: 'select' },
  status: { field: 'Status', kind: 'select' },
  source: { field: 'Source', kind: 'select' },
  unit: { field: 'Estimate unit', kind: 'select' },
  estimate: { field: 'Estimate', kind: 'number' },
  start: { field: 'Start date', kind: 'date' },
  target: { field: 'Target date', kind: 'date' },
  acceptance: { field: 'Acceptance criteria', kind: 'text' },
  deps: { field: 'Dependencies', kind: 'text' },
}

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const VALUE_RANK = { 'Very high': 0, High: 1, Medium: 2, Low: 3 }

function gql(query) {
  let out
  try {
    out = execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (err) {
    const detail = err.stderr?.toString() || err.message
    throw new Error(`gh api graphql failed:\n${detail}`)
  }
  const parsed = JSON.parse(out)
  if (parsed.errors) {
    throw new Error(`GraphQL errors:\n${JSON.stringify(parsed.errors, null, 2)}`)
  }
  return parsed.data
}

function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      positional.push(token)
    }
  }
  return { flags, positional }
}

let _project = null
function getProject() {
  if (_project) return _project
  const data = gql(`query {
    user(login: ${JSON.stringify(OWNER)}) {
      projectV2(number: ${NUMBER}) {
        id title url
        fields(first: 50) {
          nodes {
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField { id name options { id name } }
          }
        }
      }
    }
  }`)
  const project = data.user?.projectV2
  if (!project) throw new Error(`Project #${NUMBER} not found for owner ${OWNER}.`)
  const byName = new Map()
  for (const f of project.fields.nodes) {
    if (f && f.name) byName.set(f.name, f)
  }
  _project = { id: project.id, title: project.title, url: project.url, fields: byName }
  return _project
}

function resolveOptionId(field, value) {
  const match = field.options?.find((o) => o.name.toLowerCase() === String(value).toLowerCase())
  if (!match) {
    const names = (field.options || []).map((o) => o.name).join(', ')
    throw new Error(`"${value}" is not a valid ${field.name}. Options: ${names}`)
  }
  return match.id
}

function setFieldValue(projectId, itemId, flagKey, rawValue) {
  const spec = FIELD_MAP[flagKey]
  const project = getProject()
  const field = project.fields.get(spec.field)
  if (!field) throw new Error(`Field "${spec.field}" missing from project.`)
  let valueLiteral
  if (spec.kind === 'select') {
    valueLiteral = `{ singleSelectOptionId: ${JSON.stringify(resolveOptionId(field, rawValue))} }`
  } else if (spec.kind === 'number') {
    const n = Number(rawValue)
    if (Number.isNaN(n)) throw new Error(`--${flagKey} must be a number, got "${rawValue}"`)
    valueLiteral = `{ number: ${n} }`
  } else if (spec.kind === 'date') {
    valueLiteral = `{ date: ${JSON.stringify(rawValue)} }`
  } else {
    valueLiteral = `{ text: ${JSON.stringify(String(rawValue))} }`
  }
  gql(`mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: ${JSON.stringify(projectId)},
      itemId: ${JSON.stringify(itemId)},
      fieldId: ${JSON.stringify(field.id)},
      value: ${valueLiteral}
    }) { projectV2Item { id } }
  }`)
}

function applyFieldFlags(projectId, itemId, flags) {
  for (const key of Object.keys(FIELD_MAP)) {
    if (flags[key] !== undefined && flags[key] !== true) {
      setFieldValue(projectId, itemId, key, flags[key])
    }
  }
}

function fetchItems() {
  const items = []
  let cursor = null
  do {
    const after = cursor ? `, after: ${JSON.stringify(cursor)}` : ''
    const data = gql(`query {
      user(login: ${JSON.stringify(OWNER)}) {
        projectV2(number: ${NUMBER}) {
          items(first: 100${after}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              content {
                ... on DraftIssue { title body }
                ... on Issue { title url number }
                ... on PullRequest { title url number }
              }
              fieldValues(first: 30) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
                  ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
                }
              }
            }
          }
        }
      }
    }`)
    const page = data.user.projectV2.items
    for (const node of page.nodes) {
      const fields = {}
      for (const fv of node.fieldValues.nodes) {
        if (!fv || !fv.field?.name) continue
        const name = fv.field.name
        fields[name] = fv.text ?? fv.number ?? fv.date ?? fv.name
      }
      items.push({
        id: node.id,
        title: node.content?.title || '(untitled)',
        body: node.content?.body || '',
        url: node.content?.url || null,
        fields,
      })
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
  } while (cursor)
  return items
}

function matchFilter(item, flags) {
  const checks = ['status', 'area', 'timeframe', 'priority', 'source']
  for (const key of checks) {
    if (flags[key] && flags[key] !== true) {
      const fieldName = FIELD_MAP[key].field
      if ((item.fields[fieldName] || '').toLowerCase() !== String(flags[key]).toLowerCase()) {
        return false
      }
    }
  }
  return true
}

function resolveItem(items, ref) {
  if (!ref) throw new Error('Provide an item id or a title substring.')
  if (ref.startsWith('PVTI_')) {
    const byId = items.find((i) => i.id === ref)
    if (!byId) throw new Error(`No item with id ${ref}`)
    return byId
  }
  const matches = items.filter((i) => i.title.toLowerCase().includes(ref.toLowerCase()))
  if (matches.length === 0) throw new Error(`No item title matches "${ref}"`)
  if (matches.length > 1) {
    throw new Error(
      `"${ref}" matches ${matches.length} items:\n` +
        matches.map((m) => `  - ${m.title} (${m.id})`).join('\n')
    )
  }
  return matches[0]
}

function fmtItem(item) {
  const f = item.fields
  const bits = [
    f.Status && `[${f.Status}]`,
    f.Priority && `P:${f.Priority}`,
    f.Area && `${f.Area}`,
    f.Timeframe && `→ ${f.Timeframe}`,
    f.Effort && `effort:${f.Effort}`,
    f.Estimate !== undefined && `est:${f.Estimate}${f['Estimate unit'] ? f['Estimate unit'][0].toLowerCase() : ''}`,
  ].filter(Boolean)
  return `• ${item.title}\n    ${bits.join('  ')}\n    ${item.id}`
}

function cmdAdd(flags) {
  if (!flags.title || flags.title === true) throw new Error('add requires --title')
  const project = getProject()
  const body = flags.body && flags.body !== true ? flags.body : ''
  const data = gql(`mutation {
    addProjectV2DraftIssue(input: {
      projectId: ${JSON.stringify(project.id)},
      title: ${JSON.stringify(flags.title)},
      body: ${JSON.stringify(body)}
    }) { projectItem { id } }
  }`)
  const itemId = data.addProjectV2DraftIssue.projectItem.id
  // Sensible defaults if the caller didn't specify them.
  if (flags.status === undefined) flags.status = 'Unplanned'
  if (flags.timeframe === undefined) flags.timeframe = 'Backlog'
  if (flags.source === undefined) flags.source = 'Claude Code'
  applyFieldFlags(project.id, itemId, flags)
  console.log(`Added: ${flags.title}`)
  console.log(`  id:  ${itemId}`)
  console.log(`  ${project.url}`)
}

function cmdList(flags) {
  const items = fetchItems().filter((i) => matchFilter(i, flags))
  const limit = flags.limit && flags.limit !== true ? Number(flags.limit) : items.length
  const sliced = items.slice(0, limit)
  if (flags.json) {
    console.log(JSON.stringify(sliced, null, 2))
    return
  }
  if (sliced.length === 0) {
    console.log('No matching roadmap items.')
    return
  }
  console.log(`${sliced.length} item(s):\n`)
  for (const item of sliced) console.log(fmtItem(item) + '\n')
}

function cmdPull(flags) {
  const actionable = new Set(['unplanned', 'scheduled'])
  let items = fetchItems().filter((i) => {
    const status = (i.fields.Status || 'Unplanned').toLowerCase()
    return actionable.has(status)
  })
  if (flags.area && flags.area !== true) {
    items = items.filter((i) => (i.fields.Area || '').toLowerCase() === String(flags.area).toLowerCase())
  }
  items.sort((a, b) => {
    const pa = PRIORITY_RANK[a.fields.Priority] ?? 9
    const pb = PRIORITY_RANK[b.fields.Priority] ?? 9
    if (pa !== pb) return pa - pb
    const va = VALUE_RANK[a.fields.Value] ?? 9
    const vb = VALUE_RANK[b.fields.Value] ?? 9
    return va - vb
  })
  const limit = flags.limit && flags.limit !== true ? Number(flags.limit) : 5
  const top = items.slice(0, limit)
  if (flags.json) {
    console.log(JSON.stringify(top, null, 2))
    return
  }
  if (top.length === 0) {
    console.log('Nothing actionable on the roadmap right now.')
    return
  }
  console.log(`Top ${top.length} actionable item(s):\n`)
  for (const item of top) {
    console.log(fmtItem(item))
    if (item.fields['Acceptance criteria']) {
      console.log(`    done when: ${item.fields['Acceptance criteria']}`)
    }
    if (item.fields.Dependencies) {
      console.log(`    depends on: ${item.fields.Dependencies}`)
    }
    console.log('')
  }
}

function cmdShow(positional) {
  const items = fetchItems()
  const item = resolveItem(items, positional[0])
  console.log(item.title)
  console.log('='.repeat(item.title.length))
  for (const [k, v] of Object.entries(item.fields)) console.log(`${k}: ${v}`)
  if (item.url) console.log(`URL: ${item.url}`)
  console.log(`id: ${item.id}`)
  if (item.body) console.log(`\n${item.body}`)
}

function cmdSet(positional, flags) {
  const items = fetchItems()
  const item = resolveItem(items, positional[0])
  const project = getProject()
  let changed = 0
  for (const key of Object.keys(FIELD_MAP)) {
    if (flags[key] !== undefined && flags[key] !== true) {
      setFieldValue(project.id, item.id, key, flags[key])
      changed++
    }
  }
  if (changed === 0) throw new Error('set needs at least one field flag (e.g. --status "In progress").')
  console.log(`Updated ${changed} field(s) on: ${item.title}`)
}

function cmdFields() {
  const project = getProject()
  console.log(`${project.title} — ${project.url}\n`)
  for (const field of project.fields.values()) {
    if (field.options) {
      console.log(`${field.name} (select): ${field.options.map((o) => o.name).join(', ')}`)
    } else {
      console.log(`${field.name} (${field.dataType?.toLowerCase() || 'field'})`)
    }
  }
}

const HELP = `Tournamate roadmap CLI

  add    Create a roadmap item (draft). Requires --title.
  list   List items, optionally filtered (--status/--area/--timeframe/--priority/--source, --json).
  pull   Show top actionable items (Unplanned/Scheduled) ranked by Priority then Value.
  show   Show one item in full (by id or title substring).
  set    Update fields on an existing item (by id or title substring).
  fields List all fields and their select options.

Field flags: --area --priority --effort --value --timeframe --status --source
             --estimate (number) --unit --start (YYYY-MM-DD) --target --acceptance --deps --body
Run "node scripts/roadmap.mjs fields" to see valid select values.`

const { flags, positional } = parseArgs(process.argv.slice(2))
const command = positional.shift()

try {
  switch (command) {
    case 'add': cmdAdd(flags); break
    case 'list': cmdList(flags); break
    case 'pull': cmdPull(flags); break
    case 'show': cmdShow(positional); break
    case 'set': cmdSet(positional, flags); break
    case 'fields': cmdFields(); break
    case undefined:
    case 'help':
    case '--help': console.log(HELP); break
    default:
      console.error(`Unknown command "${command}".\n\n${HELP}`)
      process.exit(1)
  }
} catch (err) {
  console.error(`Error: ${err.message}`)
  process.exit(1)
}
