# Roadmap

The Tournamate roadmap lives in a **GitHub Projects v2** board, not in this repo. It is the single place to capture, prioritise, schedule, and track feature ideas — and it is wired so coding assistants (Claude Code, Codex, Gemini) can post items to it and pull items from it.

- **Board:** https://github.com/users/Fu11M0nty/projects/1 (private)
- **CLI wrapper:** [`scripts/roadmap.mjs`](../scripts/roadmap.mjs)
- **Owner / project number:** `Fu11M0nty` / `1` (override with `ROADMAP_OWNER` / `ROADMAP_PROJECT`)

## Fields

| Field | Type | Values |
|---|---|---|
| **Status** | select | Unplanned · Scheduled · In progress · Blocked · Completed · Abandoned · Rejected · Closed |
| **Priority** | select | Critical · High · Medium · Low |
| **Area** | select | Admin · Scoring engine · Structure · Public · Mobile · Officiating · Infra/QA · Marketing · Other |
| **Effort** | select | Very high · High · Medium · Low |
| **Value** | select | Very high · High · Medium · Low (impact, pairs with Effort for prioritisation) |
| **Timeframe** | select | Backlog · Now (0-4 wks) · Next (1-3 mo) · Later (3-12 mo) · Future (12 mo+) |
| **Estimate** + **Estimate unit** | number + select | e.g. `3` × `Days` (units: Hours · Days · Weeks) |
| **Start date** / **Target date** | date | drive the drag-drop Roadmap timeline |
| **Acceptance criteria** | text | definition of done — what an assistant should satisfy |
| **Dependencies** | text | "blocked by …" notes / links |
| **Source** | select | Human · Claude Code · Codex · Gemini (audit trail of who created it) |

**Backlog** = `Timeframe: Backlog` (and/or `Status: Unplanned`). **Scheduling** = move an item into a Now/Next/Later/Future timeframe (and/or set Start/Target dates).

## Views to add (one-time, in the web UI)

The GitHub API can't create or configure views, so set these up once by hand on the board (each is ~3 clicks via **+ New view**):

1. **Backlog** — Table view, filter `timeframe:Backlog`, sort by Priority.
2. **Roadmap** — *Roadmap* layout, set the date fields to **Start date → Target date**. This is the drag-drop timeline; drag bars to reschedule.
3. **Board** — *Board* layout grouped by **Status** (the Kanban lifecycle).

Optional: GitHub's true rolling **Iteration** field (auto-generated sprints/weeks) also can't be created via API. If you want real iterations on top of the Timeframe buckets, add an Iteration field in the UI (**+ field → Iteration**); the CLI will keep working alongside it.

## Assistant playbook — post & pull

Any assistant with `gh` authenticated (`gh auth login` + `project` scope) can use the wrapper. **Prefer PowerShell on Windows** (see gotcha below).

```powershell
# See valid field/option values
node scripts/roadmap.mjs fields

# POST a new idea (Status defaults to Unplanned, Timeframe to Backlog, Source to "Claude Code")
node scripts/roadmap.mjs add `
  --title "Bulk CSV import for players" `
  --area Admin --priority High --effort Medium --value High `
  --estimate 2 --unit Days `
  --acceptance "Organiser uploads a CSV and players appear under the right team" `
  --body "Longer description / context here." `
  --source "Codex"

# PULL the next things to work on (Unplanned/Scheduled, ranked Priority then Value)
node scripts/roadmap.mjs pull            # top 5
node scripts/roadmap.mjs pull --area "Scoring engine" --limit 3
node scripts/roadmap.mjs pull --json     # machine-readable for an assistant to parse

# Inspect / browse
node scripts/roadmap.mjs show "Bulk CSV import"
node scripts/roadmap.mjs list --status "In progress"
node scripts/roadmap.mjs list --area Admin --json

# UPDATE status as work progresses (by item id, issue number, or unique title substring)
node scripts/roadmap.mjs set "Bulk CSV import" --status "In progress" --note "Picked up. Plan: ..."
node scripts/roadmap.mjs set 17 --status Completed --note "What was done: ..."   # by issue number

# LOG progress as a GitHub comment on the item's issue (drafts: appended to the body)
node scripts/roadmap.mjs log "Bulk CSV import" --body "Added importer + unit tests; handling duplicate players next."
node scripts/roadmap.mjs log 17 --body "Created docs/pilot/*, generated Word+PDF, added AGENTS.md pointer."
```

Suggested loop for an assistant asked to "work from the roadmap":
1. `node scripts/roadmap.mjs pull --json` → pick the top item.
2. `set <item> --status "In progress" --source <assistant> --note "<plan + confirmed scope>"`.
3. Do the work to satisfy the **Acceptance criteria**, posting `log` comments at each meaningful milestone.
4. `set <item> --status Completed --note "<completion summary>"` (or `Blocked` with `--deps` + `--note` if stuck).

### Progress logging — keep the item updated (start → milestones → done)

The roadmap item is the audit trail, so record the **specific actions performed** as you go. `log` posts a GitHub **comment** on the item's underlying issue; `set --note` does the same alongside a field change. Both accept an **issue number** (`17` / `#17`), a `PVTI_…` id, or a unique title substring. For draft items (created by `add`, no comment stream) the note is appended to the item body instead.

- **Start** — when you set In progress, post the agreed plan and confirmed scope.
- **Milestones** — at each meaningful step, post what changed: files/areas touched, decisions and why, data/RLS/scoring implications, tests added/run. Milestones, not every edit.
- **Blocked** — post why and what's needed, with `--status Blocked --deps`.
- **Completion (required)** — never mark an item Completed without a summary covering **what was done**, **decisions / what was deferred**, **tests & validation (or why none)**, and **follow-ups**. Use `set <item> --status Completed --note "<summary>"`.

On Windows/PowerShell, pass multi-line `--body`/`--note` via a single-quoted here-string.

### Always read the full issue (body + comments)

`show` and `pull` only return the **Projects v2 field values** (Status, Priority, the one-line **Acceptance criteria**, etc.) — **not** the GitHub issue body or its comments, where the full specification and any later refinements actually live. Whenever you inspect an item, also read the underlying issue, **including comments**:

```powershell
node scripts/roadmap.mjs show "Define and document pilot scope"   # Projects fields + the issue URL
gh issue view <N> --repo Fu11M0nty/Tournamate --comments          # full body + all comments
```

The `show`/`pull` output includes a `URL:` like `https://github.com/Fu11M0nty/Tournamate/issues/<N>`. Treat the **issue body + comments as the source of truth** — the one-line Acceptance criteria field is only a summary; reconcile it with the body/comments if they differ. Do this every time you open an item, not just when you start work.

### Writing a new item (full specification)

Don't post thin items. Every new item must carry a **full specification and implementation plan** in its `--body` so any AI coding agent can pick it up cold. If the prompt is sparse, infer sensible detail from `AGENTS.md` and the relevant code, then confirm with the human before posting. The body should follow this structure (it mirrors the level of detail on existing issues like #17):

```markdown
## <Title>

### Description
What the feature is and the outcome it's trying to achieve — the problem, who it's for, and why it matters.

### Dependencies
- Existing features, schema, services, or product decisions this relies on; anything that must be built first.

### Definition of Done
- Concrete, checkable conditions for "done" (incl. 375px/1280px UX if public-facing, and data scoping / RLS / scoring-system correctness where relevant — see AGENTS.md).

### Tests / Validation
- **Unit:** the pure-logic tests needed (which `tests/unit/` files, which cases).
- **DB / RLS / seed:** changes to `tests/db/` and QA seed/cleanup, if shape changes.
- **Public E2E / Admin E2E:** Playwright checks to add/amend.
- If no automated tests are warranted, say so and why.

### Complexity / Estimate
Low / Medium / High, with an approximate build time — keep aligned with the Effort / Estimate fields.

### AI Coding Agent Prompt
You are working in the Tournamate repo. Read AGENTS.md before making changes.

<Self-contained task description.> Respect the current product reality: <facts the agent must not break>.

Success looks like:
- <observable outcomes that prove the feature works>

Tests:
- <which tests to add/extend and the cases to cover>
- During the build, author the tests in <test file/dir> covering <specific scenarios> so behaviour is locked in as you implement.

Do not <explicit out-of-scope / non-goals>.
```

The one-line `--acceptance` field is a *summary* of the Definition of Done — still set it, but it is **not** a substitute for the full body. On Windows/PowerShell, pass the long markdown body via a single-quoted here-string.

### Windows / Git-Bash gotcha

If you run the CLI through **Git-Bash / MSYS** (e.g. the Bash tool), arguments that **start with `/`** (like an acceptance criterion mentioning `/roadmap`) get rewritten into a Windows path (`C:/Program Files/Git/roadmap`). Avoid this by either running in **PowerShell**, prefixing the command with `MSYS_NO_PATHCONV=1`, or not starting a value with `/`.

## Raw `gh` fallback

The wrapper is just sugar over the GitHub CLI. Equivalent low-level commands:

```bash
gh project item-create 1 --owner Fu11M0nty --title "..." --body "..."
gh project item-list 1 --owner Fu11M0nty --format json
gh project field-list 1 --owner Fu11M0nty --format json
# editing field values needs project-id + field-id + option-id — the wrapper resolves these for you
```
