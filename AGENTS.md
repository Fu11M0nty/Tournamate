# AGENTS.md — Tournamate

Workflow guidance, architecture, and coding standards for **Tournamate**. Read it fully before starting any task.

> This is the single source of truth. `CLAUDE.md` just imports this file (`@AGENTS.md`). Edit **this** file, not `CLAUDE.md`.

---

## What Tournamate is

Tournamate is a **multi-sport, multi-tournament management platform** for grassroots and club competitions. It started life as a single two-day netball results site; it is now a general-purpose tool any organiser can use to plan a tournament structure, generate fixtures, enter scores live, and publish a public results page — for any sport.

It is made of two applications in one repo:

| App | Where | Stack | Audience |
|---|---|---|---|
| **Web app** | `src/` (Next.js) | Next.js 16 (App Router), React 19, Tailwind 4, Supabase | Organisers (admin) + public spectators |
| **Mobile app** | `mobile/` | Expo + expo-router (React Native) | Spectators (read-only) |

The web app has three faces:

1. **Marketing site** — `/` (hero, feature tour, "register interest"), `/explore` (browse live/upcoming tournaments).
2. **Public tournament view** — per-tournament hub with standings, results, fixtures, brackets, schedule, teams. No login.
3. **Admin console** — `/admin`, password-protected (Supabase Auth + RBAC). Where organisers build and run their tournaments.

**Do not assume "netball" or "two days" anywhere.** Sport, number of competition dates, divisions, formats, and scoring rules are all data the organiser configures.

---

## ⚠️ Critical naming gotcha: Divisions vs `age_groups`

The product concept is a **Division** (a competition stream within a tournament — e.g. "Under 11", "Mixed Open", "Men's Plate"). The **database table is still named `age_groups`** and foreign keys are still `age_group_id`, for historical reasons.

- In the UI, copy, and product language: say **Division**.
- In the database / SQL / column names: it is `age_groups` / `age_group_id`.
- In TypeScript: the interface is `Division`, with `export type AgeGroup = Division` kept as a compatibility alias (`src/lib/types.ts`).

When you write a query, filter by `age_group_id`. When you write UI or talk to the user, say "division". Do not rename the table without a planned migration.

---

## Tech stack

| Layer | Choice |
|---|---|
| Web framework | Next.js 16 (App Router, Server Components + Client Components) |
| UI | React 19 + Tailwind CSS 4 |
| Backend / DB | Supabase (Postgres + Row Level Security) |
| Auth | Supabase Auth (email/password + OAuth) with a `user_profiles` RBAC layer |
| SSR auth | `@supabase/ssr` (browser, server, and middleware clients in `src/lib/supabase.ts`) |
| Drag & drop | `@dnd-kit/*` (structure / pool / bracket editors) |
| Spreadsheets | `xlsx` (team & schedule import/export) |
| PDF / print | `jspdf` + `html2canvas-pro` (printable scorecards & schedules) |
| QR | `qrcode.react` (generate), `jsqr` (scan) — score-capture workflow |
| Toasts | `react-hot-toast` |
| Mobile | Expo (see `mobile/AGENTS.md`) |
| Hosting | Vercel (web), deploys from `main` |
| Testing | Vitest (unit), Playwright (e2e) |

**Do not add new infrastructure (a different DB, ORM, state library, component kit) without asking first.**

---

## Domain model (the structure engine)

Tournamate's power is a flexible competition structure. The hierarchy:

```
Tournament
├── competition_dates        (event days/sessions — replaces the old hard-coded Sat/Sun)
├── tournament_venues        (host locations)
├── courts                   (per-day courts with start/end times)
├── schedule_events          (lunch / ceremony / non-match blocks)
└── Division  (table: age_groups)
    ├── teams                (scoped to one division; pool membership via pool_teams)
    └── Phase                (an ordered stage: round_robin | group_stage | knockout | league | friendly)
        ├── pools            (groups within a phase; every phase gets a default pool)
        └── phase_elements   (group | bracket | single_match | heat | league_table | ladder | swiss_round)
            └── element_slots (team | source | bye | placeholder | manual — the entrants of an element)

matches                      (belong to a division + phase + pool + phase_element; teams OR slots OR a bye)
progression_rules            (how results in one phase/element feed slots in the next)
scoring_systems              (configurable points + tie-breakers, attached at phase/division level)

Officiating:  clubs, umpires, umpire_assignments, umpire_payouts
People:       players (per team), user_profiles (admin RBAC)
```

`supabase/schema.sql` is the authoritative schema. `src/lib/types.ts` mirrors it in TypeScript. Read both before changing data shape.

### Phases

A **Phase** is one stage of a division's competition, ordered by `display_order`. A division can chain phases (e.g. Group Stage → Knockout). Types: `round_robin`, `group_stage`, `knockout`, `league`, `friendly`. Each phase has its own `match_format`, period/break timings, `standings_mode` (`visible | hidden | none`), and may have its own scoring system.

Divisions now start with **zero phases** — the organiser applies a structure template from the admin Structure page (the default-phase trigger is disabled in `schema.sql`).

### Knockout brackets — each round is a separate phase

A knockout bracket is modelled as a **sequence of `knockout`-type phases**, one phase per round (Quarter-finals → Semi-finals → Final), ordered by `phases.display_order`. **Do not** model rounds as `round_number` within a single phase — `round_number` is only for ordering rounds *within* a round-robin.

`src/components/PublicBracketView.tsx` is the canonical renderer: it takes all of a division's phases, filters to `phase_type === 'knockout'`, and treats each phase as one round/column. The mobile equivalent is `mobile/components/BracketView.tsx`. Slot labels for not-yet-decided matches ("Winner of…", "Nth place qualifier", "Bye") come from element slots / progression rules.

### Element slots & progression rules

Brackets and downstream phases are populated by **element_slots** (the entrant positions) which can be a fixed `team`, a `source` (e.g. "winner of match X", "1st in pool A"), a `bye`, or a `placeholder`. **progression_rules** describe how a result (`standings_rank`, `match_winner`, `match_loser`, `best_rank`, `manual`) flows from a source phase/element/pool/match into a target slot. This is what lets group winners advance into a knockout automatically. See `src/lib/phaseProgression.ts` and `src/lib/qualificationMappings.ts`.

---

## Scoring systems (configurable — not hard-coded)

Points are **not** hard-coded. A `scoring_systems` row defines win/draw/loss points, optional OT/SO win points, bonus-point logic, forfeit handling, and a configurable tie-breaker hierarchy (`tie_breaker_config: string[]`). Scoring systems attach at phase level (preferred) or division level.

The **netball default** (used as the fallback when no system is set) is:
- Win = 5, Draw = 3, Loss = 0
- Losing bonus = 1, awarded when the loser's score is strictly more than 50% of the winner's (`bonus_loss_threshold_type: 'percentage'`, value 50)
- Tie-breakers: head-to-head → goal difference → goals for

Forfeits: a side that no-shows, or is **≥ 4 minutes late**, forfeits the match (`forfeitSide` in `src/lib/standings.ts`).

Treat the default only as a fallback. New scoring logic must read from the `ScoringSystem` passed in, never assume 5/3/1.

---

## Standings calculation

`src/lib/standings.ts` exports a **pure** function:

```ts
calculateStandings(teams: Team[], matches: Match[], scoringSystem?: ScoringSystem): StandingRow[]
```

- Receives teams + matches already scoped to a single phase/pool.
- Counts only `status === 'completed'` matches; respects forfeits and the scoring system.
- Falls back to the netball default if `scoringSystem` is omitted.
- Sort order follows the scoring system's tie-breaker config (default: Pts → GD → GF → name).
- Mirror logic lives in `mobile/lib/standings.ts` for the mobile app — keep the two in sync when changing scoring behaviour.

Standings are **always derived** — there is no stored standings table.

---

## Routing

### Public (web)
```
/                                         Marketing landing
/explore                                  Browse live/upcoming tournaments
/register-interest                        Organiser interest form
/[tournamentSlug]                         Tournament hub — tabs: info | teams | standings | schedule
/[tournamentSlug]/[day]                   Day view — redirects to first division
/[tournamentSlug]/[day]/[divisionSlug]    Public division view: standings + results + fixtures + bracket
```
Invalid slugs render a friendly `NotFoundMessage` ("Tournament not found" / "Group not found"), never a 404 page.

### Admin (web, auth-gated by `middleware.ts`)
```
/admin                       Console (panel-driven SPA — see panels below)
/admin/login                 Supabase sign-in
/admin/confirm-pending       Email not yet confirmed
/admin/access-denied         Authenticated but not an approved admin
/admin/signup                Disabled — redirects to login
/admin/capture/[matchId]     Score-capture page (used by QR links)
/admin/c/[code]              Short-code capture entry
/admin/scorecards/[day]      Printable scorecards
```

---

## Admin console

`src/app/admin/page.tsx` is a panel-driven client app. Panels (`AdminPanel` in `AdminSidebar.tsx`):
`general` · `match-entry` · `schedule` · `age-groups` (Divisions) · `scoring` · `import` · `snapshots` · `users` · `officiating` · `help`.

Capabilities span: tournament setup & cloning, division/phase/pool/bracket structure building (`StructureWizard`, `AdvancedStructureEditor`, drag-and-drop), team & player management, fixture generation (`autoPlan.ts`) and the fixture matrix, schedule/court planning, score entry, QR-based score capture, officiating (umpire assignment & payouts), spreadsheet import/export, printable scorecards, snapshots, and user administration.

### RBAC
Auth = Supabase Auth **plus** a `user_profiles` table with `role` (`superadmin | tournament_admin`) and `is_approved`. `middleware.ts` gates every `/admin` route: unauthenticated → login; unconfirmed email → confirm-pending; authenticated-but-not-approved-admin → access-denied. There is **no public signup** — admins are created via the Supabase dashboard and promoted with SQL (see `supabase/README.md`).

---

## Mobile app

A read-only **spectator** app (Expo + expo-router) in `mobile/`, separate from the web app. Light theme (navy `#0f172a`, bg `#f8fafc`, orange accent `#f47c20`). Screens: tournament list (+ QR scan), tournament hub (Info/Teams/Standings/Schedule), division detail, match detail, and a swipeable knockout bracket carousel. Typecheck with `npx tsc --noEmit -p mobile/tsconfig.json`. See `mobile/AGENTS.md` — and note the warning there to read the exact versioned Expo docs before writing mobile code.

---

## Project structure (web)

```
src/
├── app/
│   ├── page.tsx                          Marketing landing
│   ├── explore/                          Explore tournaments
│   ├── register-interest/ , signup/      Lead capture
│   ├── [tournamentSlug]/
│   │   ├── page.tsx                       Tournament hub (info/teams/standings/schedule)
│   │   └── [day]/[divisionSlug]/page.tsx Public division view
│   ├── admin/                            Console + login/capture/scorecards
│   ├── api/register-interest/route.ts    Interest form handler
│   └── layout.tsx                        SiteHeader / SiteFooter / Toaster
├── components/                           ~80 components — Admin*, Public*, structure editors, cards
│   └── wizard/                           Structure setup wizard steps
├── lib/
│   ├── supabase.ts                       browser / server / middleware clients
│   ├── types.ts                          shared types (source of truth for app data shape)
│   ├── standings.ts                      pure standings + scoring + forfeit logic
│   ├── scoring.ts                        phase/scoring-system resolution helpers
│   ├── phaseProgression.ts               advance results between phases
│   ├── qualificationMappings.ts          map source ranks/outcomes to slots
│   ├── formatBuilders.ts / autoPlan.ts   structure templates + fixture generation
│   ├── structureValidation.ts            validate a division's structure
│   ├── matches.ts / matchLabel.ts / matchRules.ts
│   ├── csv.ts / scheduleExcel.ts / image.ts
│   ├── competitionDates.ts / time.ts / slugify.ts
│   ├── actions.ts / auth-actions.ts      server actions
│   └── auth-context.tsx                  admin auth context
middleware.ts                             gates /admin behind Supabase Auth + RBAC
supabase/                                 schema.sql + additive *.sql migrations + RPCs + seeds
mobile/                                   Expo spectator app (own AGENTS.md)
scripts/                                  qa-seed / qa-cleanup / generate-seed / playwright runner
tests/                                    unit (Vitest) + e2e (Playwright)
```

---

## Key implementation rules

### Data scoping
- Scope every query by the right key: `tournament_id`, then `age_group_id` (division), then `phase_id` / `pool_id`. Never fetch everything and filter client-side.
- The selected tournament / day / division live in the **URL** (dynamic routes), not query params, so links are shareable. Admin panel/tab state may use local state.

### Multi-sport / multi-tournament
- Nothing may hard-code a sport, a points scheme, "Saturday/Sunday", or a fixed number of divisions. Read it from `tournaments`, `competition_dates`, `scoring_systems`, etc.
- `competition_dates` is the real model of event days; `legacy_day` (`saturday|sunday`) exists only for backward compatibility — prefer competition dates in new code.

### Structure & progression
- Build/maintain bracket UIs by treating each `knockout` phase as a round, sorted by `display_order`.
- When results change, advancing teams flows through `progression_rules` / `phaseProgression.ts` — don't manually wire winners into later matches in ad-hoc code.

### Mobile-first public views
- Design the public pages for 375px first. Tab bars (day, division, phase) scroll horizontally (`overflow-x-auto whitespace-nowrap`), never wrap. Standings tables wrap in `overflow-x-auto`. Match info renders as stacked cards on mobile.
- The admin console may be desktop-first (organisers use a laptop/tablet).

### Soft deletes
- `teams` and `matches` use `deleted_at`. Filter `deleted_at is null` for active data.

---

## Database & migrations

- `supabase/schema.sql` is the **destructive** fresh-build baseline (it drops tables). Never run it against production.
- Schema changes ship as **additive** `supabase/*.sql` files (migrations, RPCs, RLS policies, seeds). Add a new file; don't edit history.
- `supabase/README.md` is the runbook (fresh build vs production-safe upgrade). Keep `schema.sql` and `src/lib/types.ts` in agreement when you change shape.
- All tables have RLS: public `SELECT`, authenticated `INSERT/UPDATE/DELETE`. The anon key is safe in the browser because RLS enforces access.

---

## Commands

```bash
npm run dev              # Next dev server
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run test:unit        # Vitest
npm run test:e2e         # Playwright (against running app / PLAYWRIGHT_BASE_URL)
npm run test:e2e:local   # Playwright starts the dev server
npm run qa:db            # cleanup, seed, DB/RLS tests, cleanup
npm run qa:public        # public browser smoke only
npm run qa:admin         # admin browser smoke only
npm run qa:e2e           # full browser smoke
npm run qa:evidence      # test-by-test screenshot/video evidence index
npm run qa:release       # typecheck + unit + qa:db + qa:e2e
npm run qa               # alias for qa:release
npm run qa:reset         # cleanup then seed
```

QA seed/cleanup needs `SUPABASE_SERVICE_ROLE_KEY`; remote projects are blocked unless `QA_ALLOW_REMOTE=1` and the tournament slug starts with `qa-`.

Mobile typecheck: `npx tsc --noEmit -p mobile/tsconfig.json`.

---

## Roadmap

Feature ideas and planning live in a **GitHub Projects v2** board (private), not in this repo. Assistants can post items to it and pull work from it via [`scripts/roadmap.mjs`](scripts/roadmap.mjs). Full guide: [`docs/roadmap.md`](docs/roadmap.md).

```bash
node scripts/roadmap.mjs pull            # next actionable items, ranked Priority→Value
node scripts/roadmap.mjs add --title "..." --area Admin --priority High --acceptance "..."
node scripts/roadmap.mjs set "<title>" --status "In progress"
node scripts/roadmap.mjs fields          # valid field/option values
```

**Adding an idea (propose → confirm → post).** Run `fields` for valid options. Extract a Title, description (`--body`), and testable Acceptance criteria from the prompt, and infer the structured fields (Area, Priority, Effort, Value, Estimate+unit, Timeframe). **Show the proposed item and let the user confirm/adjust the subjective fields before posting** — don't post blind. Then `add` with `--source` set to the assistant in use (defaults: Status `Unplanned`, Timeframe `Backlog`).

**Working from the roadmap (clarify → plan → stop).** If no item is named, `pull` (or `list`) and ask which to take; if one is named, `show` it (disambiguate if a title substring matches several). Read its Acceptance criteria, then **ask clarifying questions until you understand what "done" means** (scope, edge cases, affected code, data/scoring/RLS, 375px/1280px, test impact). Then set it `In progress` (and write back any sharpened `--acceptance`), produce an implementation plan, and **stop for the user's go-ahead before writing code**. On completion set `Completed`; if blocked set `Blocked` with a `--deps` note.

- On Windows, prefer PowerShell — Git-Bash mangles args that start with `/` (see the gotcha in `docs/roadmap.md`).
- Claude Code users get this as the `/roadmap` skill; the CLI is identical, so behaviour matches across assistants.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only: QA scripts, privileged RPCs. Never expose to the browser.
```

`NEXT_PUBLIC_*` are safe client-side (RLS enforces access). The service-role key must stay server-side only.

---

## Definition of Done

A task is complete when:
1. It works against real Supabase data (not mocked), respecting RLS.
2. Public pages are correct at 375px and 1280px.
3. Switching tournament / day / division / phase always shows correctly isolated data — no cross-contamination.
4. Scoring/standings respect the configured `scoring_system` (not a hard-coded scheme).
5. The test impact has been considered and stated: unit, DB, public E2E, admin E2E, QA seed, and docs are updated where relevant.
6. `npm run typecheck` and `npm run lint` pass; relevant tests pass. Mobile changes also pass the mobile typecheck.

### Test impact rule

For every code or schema change, decide whether tests need adding or amending:

- Pure business logic: update `tests/unit/`.
- Database shape, RLS, seed, or cleanup: update `tests/db/` and QA seed/cleanup scripts.
- Public spectator behaviour: update public Playwright checks and run `npm run qa:public` or `npm run qa:e2e`.
- Admin organiser behaviour: update safe admin Playwright checks and run `npm run qa:admin` or `npm run qa:e2e`.
- Format, fixture, schedule, bracket, scoring, or progression changes: consider unit, DB, public E2E, admin E2E, and QA seed data together.

If a change does not include test changes, note why in the final implementation summary. If automation is deferred, add it to `docs/qa-test-catalogue.md` as a future roadmap item.

---

## Scope notes

This project has grown well past the original "two-day netball results site". The following — once listed as out of scope — are now **in scope and built**: knockout brackets, multiple tournaments, multiple sports, configurable scoring, officiating/umpires, and players. Player *stats*, notifications/email alerts, social sharing, and payments/ticketing remain out of scope — confirm with the user before building any of those.
