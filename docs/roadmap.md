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

# UPDATE status as work progresses (by item id or unique title substring)
node scripts/roadmap.mjs set "Bulk CSV import" --status "In progress"
node scripts/roadmap.mjs set PVTI_xxx --status Completed --target 2026-07-01
```

Suggested loop for an assistant asked to "work from the roadmap":
1. `node scripts/roadmap.mjs pull --json` → pick the top item.
2. `set <item> --status "In progress" --source <assistant>`.
3. Do the work to satisfy the **Acceptance criteria**.
4. `set <item> --status Completed` (or `Blocked` with a `--deps` note if stuck).

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
