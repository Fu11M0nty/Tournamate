# QA Runbook

This runbook explains how to run and understand the automated QA checks for Tournamate. It is written for QA analysts and product testers, not only developers.

For a plain-English list of every automated check and what each one proves, see `docs/qa-test-catalogue.md`.

## Current Expected Result

The seeded browser QA suite currently runs 44 Playwright tests:

- 33 should pass.
- 11 should be skipped: the authenticated admin workflow tests are desktop-only for now and are intentionally skipped on the mobile browser project.

The skipped test is not a failure.

## What The QA Suite Covers

The automated checks are split into three layers.

### Unit Tests

Command:

```powershell
npm run test:unit
```

Purpose:

- Checks pure business logic without needing the browser.
- Covers standings calculations, scoring behaviour, structure mapping, scheduling rules, and fixture helpers.

Use this when:

- A code change touches calculation logic.
- You want quick feedback before running database or browser checks.

### Database Integration Tests

Command:

```powershell
npm run qa:db
```

Current expected result:

```text
11 passed
```

Purpose:

- Cleans any previous QA tournament.
- Seeds a deterministic QA tournament.
- Runs database-backed tests against real Supabase data and RLS policies.
- Cleans the QA tournament afterward.

Main checks:

- The QA tournament, dates, venue, courts, and divisions are created.
- Public anonymous reads work.
- Anonymous writes are blocked.
- The QA admin user can sign in.
- The approved QA admin can write disposable data through authenticated RLS.
- Standings are calculated from real seeded results.
- The group-stage plus finals structure is seeded correctly.
- Disposable divisions exist for the major format structures: round robin, pools, knockout, play-ins, grading, leagues, festival, placements, and double elimination.
- Soft-deleted teams are excluded from active queries.
- Seeded fixtures are scoped to teams from the same division.
- Progression rules remain aligned with target slots and source structures.

### Browser E2E Tests

Command:

```powershell
npm run qa:e2e
```

Purpose:

- Cleans any previous QA tournament.
- Seeds deterministic QA data.
- Starts the local Next.js app on port `3100`.
- Runs Playwright checks in desktop Chrome and mobile Chrome.
- Writes a QA evidence report.
- Cleans the QA tournament afterward.

Main checks:

- Public tournament hub loads and shows correct summary data.
- Public tournament hub shows information, sport and venue details.
- Public teams tab shows seeded teams.
- Public team search filters spectator-visible team lists.
- Public schedule tab shows seeded fixtures.
- Public schedule filters between upcoming fixtures and played results.
- Public division pages show standings, results, fixtures, and pool standings.
- Public format divisions render seeded table, pool, fixture-only, knockout, play-in, grading, placement, league, and double-elimination structures.
- Invalid public tournament and division URLs render friendly not-found pages.
- `/admin` is protected when anonymous.
- `/admin/signup` redirects to login because public signup is disabled.
- Desktop admin login works with the seeded QA admin.
- The seeded tournament can be opened in the admin console.
- Admin panels load seeded data: General, Divisions, Match Entry, Schedule, and Scoring.
- Safe desktop admin workflows can edit/restore General settings, create/edit a disposable division, add a disposable team, view format setup, open the guided format picker, inspect fixture-generation controls, confirm pool assignment locking, create/edit a disposable scoring template, record a workflow score, and move a workflow fixture time without changing the public smoke fixtures.

Expected browser result:

```text
33 passed
11 skipped
```

Generated evidence:

```text
qa-reports/latest-qa-e2e-report.md
qa-reports/latest-qa-evidence-index.md
qa-reports/playwright-results.json
playwright-report/index.html
test-results/
```

`npm run qa:e2e` records screenshots and videos for every browser QA test by default. These artifacts are available from the Playwright HTML report, the `test-results/` folder, and the evidence index.

`qa-reports/` is ignored by git. Attach the markdown report, Playwright HTML report, and relevant screenshots/videos to a release ticket when formal evidence is needed.

## QA Seed Data

The seed creates a tournament with slug:

```text
qa-smoke-tournament
```

Public URLs:

```text
/qa-smoke-tournament
/qa-smoke-tournament/saturday/qa-under-10
/qa-smoke-tournament/saturday/qa-under-12
```

Seeded tournament:

- Name: `QA Smoke Tournament`
- Sport: `Netball`
- Dates: `Saturday 6 June 2026`, `Sunday 7 June 2026`
- Venue: `QA Arena`
- Courts: `Court 1`, `Court 2`
- Scoring system: `QA Standard Netball`

Seeded divisions:

- `QA Under 10`: simple round robin with completed and scheduled matches.
- `QA Under 12`: two-pool group stage with semi-finals/finals structure.
- `QA Workflow Division`: disposable admin workflow division with four teams and two scheduled fixtures.

Seeded admin:

```text
qa-admin@tournamate.test
```

The password is created by the QA seed script. It defaults to the project QA password unless overridden by environment variables.

## Required Environment Variables

The QA scripts need Supabase credentials in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

For remote Supabase projects, set:

```text
QA_ALLOW_REMOTE=1
```

Optional overrides:

```text
QA_TOURNAMENT_SLUG=qa-smoke-tournament
QA_ADMIN_EMAIL=qa-admin@tournamate.test
QA_ADMIN_PASSWORD=
PLAYWRIGHT_BASE_URL=
PLAYWRIGHT_PORT=3100
PLAYWRIGHT_WORKERS=1
PLAYWRIGHT_RECORD_ALL_ARTIFACTS=1
```

Safety rule:

- The QA tournament slug must start with `qa-`.
- Do not run QA seed or cleanup scripts against production unless the target data is explicitly disposable.
- Set `PLAYWRIGHT_RECORD_ALL_ARTIFACTS=0` only when you deliberately want smaller local runs with screenshots/videos on failures only.

## Recommended QA Workflow

For a normal pre-release smoke check:

```powershell
npm run qa:release
```

`qa:release` runs typecheck, unit tests, database integration, and the full browser suite.

For browser-only verification after a UI change:

```powershell
npm run qa:e2e
```

For public-page-only browser verification:

```powershell
npm run qa:public
```

Expected result:

```text
18 passed
0 skipped
```

For admin-console and admin-security browser verification:

```powershell
npm run qa:admin
```

Expected result:

```text
15 passed
11 skipped
```

This automatically creates:

```text
qa-reports/latest-qa-e2e-report.md
qa-reports/latest-qa-evidence-index.md
```

If the Playwright JSON result already exists and only the markdown evidence needs regenerating:

```powershell
npm run qa:report
npm run qa:evidence
```

For database-only verification after a schema, migration, RLS, or seed change:

```powershell
npm run qa:db
```

For local exploratory testing with the seeded data:

```powershell
npm run qa:reset
npm run dev
```

Then open:

```text
http://localhost:3000/qa-smoke-tournament
http://localhost:3000/admin/login
```

When finished:

```powershell
npm run qa:cleanup
```

## Test Impact For Every Change

Every product change should include a quick QA impact review before it is considered complete. This applies to bug fixes, UI changes, schema changes, format-builder changes, and new features.

Use this checklist when planning or reviewing work:

| Question | Action |
| --- | --- |
| Does the change alter calculation logic? | Add or update unit tests in `tests/unit/`. Examples: standings, scoring, scheduling, fixture generation, qualification mappings. |
| Does the change alter database shape, RLS, seed data, or cleanup? | Add or update DB integration tests in `tests/db/` and verify `npm run qa:db`. |
| Does the change alter public pages or spectator journeys? | Add or update public E2E tests and verify `npm run qa:public` or `npm run qa:e2e`. |
| Does the change alter organiser/admin workflows? | Add or update safe admin E2E tests using disposable QA data and verify `npm run qa:admin` or `npm run qa:e2e`. |
| Does the change alter tournament formats, fixtures, pools, brackets, or progression? | Update format-specific QA seed data and add assertions for both admin and public views where relevant. |
| Does the change alter copy, labels, or error states used by tests? | Update selectors/assertions carefully and keep test names plain-English for QA analysts. |
| Does the change add a known gap rather than full automation? | Record the gap in `docs/qa-test-catalogue.md` under Future QA Roadmap or Known Gaps. |
| Does the change affect expected pass/skip counts? | Update `docs/qa-test-catalogue.md`, this runbook, `docs/qa-release-signoff-template.md`, and package scripts if command expectations change. |

Recommended minimum test command by change type:

| Change type | Minimum command |
| --- | --- |
| Pure logic | `npm run test:unit` |
| Database, schema, RLS, seed, cleanup | `npm run qa:db` |
| Public UI | `npm run qa:public` |
| Admin UI | `npm run qa:admin` |
| Cross-cutting change or release candidate | `npm run qa:release` |

If no automated test is added or changed, the implementation notes should state why. Good reasons include: documentation-only change, visual-only tweak covered by existing E2E screenshots, or a known gap deliberately recorded for future automation.

## Release Sign-Off

Use the release sign-off template:

```text
docs/qa-release-signoff-template.md
```

Minimum recommended release evidence:

- `npm run typecheck` result.
- `npm run test:unit` result.
- `npm run qa:db` result.
- `npm run qa:e2e` result.
- `qa-reports/latest-qa-e2e-report.md`.
- Screenshots/videos from `test-results/` or the Playwright HTML report.
- Any relevant traces from `test-results/` if a defect is found.

The generated QA E2E report includes:

- pass/fail/skip summary
- expected result comparison
- base URL
- QA tournament slug
- QA admin email
- Supabase project reference, without exposing keys
- git branch and commit
- failed/review tests
- skipped tests
- evidence file locations
- analyst sign-off checklist

## How To Read Failures

### Selector Failure

Example:

```text
strict mode violation
```

Meaning:

- The app probably loaded.
- The test found more than one matching item.
- The Playwright selector needs to be made more specific.

QA action:

- Check the screenshot in `test-results`.
- Confirm whether the expected content is visible.
- Raise as a test maintenance issue unless the visible UI is wrong.

### Missing Public Data

Example:

```text
expected "QA Smoke Tournament" to be visible
```

Meaning:

- The public page did not render expected seeded data.

QA action:

- Check that `npm run qa:seed` succeeded.
- Confirm `.env.local` points to the intended QA Supabase project.
- Confirm the failing URL uses `qa-smoke-tournament`.

### Auth Failure

Example:

```text
Admin access required
```

after signing in.

Meaning:

- The user may exist in Supabase Auth but not be approved in `user_profiles`.

QA action:

- Run `npm run qa:db` to verify the QA admin setup.
- Check the QA seed output for `QA admin: qa-admin@tournamate.test`.

### Database Schema Cache Failure

Example:

```text
Could not find the column ... in the schema cache
```

Meaning:

- Supabase does not see the latest database schema yet, or migrations are missing.

QA action:

- Confirm the QA database has been migrated.
- Refresh Supabase schema cache if needed.
- Rerun `npm run qa:db`.

## Manual QA Checklist After Automation Passes

Use this when a release needs human verification beyond smoke tests.

Public pages:

- Open `/qa-smoke-tournament`.
- Confirm tournament summary, divisions, teams, schedule, and public navigation.
- Open `/qa-smoke-tournament/saturday/qa-under-10`.
- Confirm standings, results, upcoming fixtures, and mobile layout.
- Open `/qa-smoke-tournament/saturday/qa-under-12`.
- Confirm pool standings appear separately for Pool A and Pool B.

Admin:

- Sign in as the seeded QA admin.
- Open `QA Smoke Tournament`.
- Confirm General shows dates, venue, sport, and scoring default.
- Confirm Divisions shows `QA Under 10` and `QA Under 12`.
- Confirm Match Entry shows completed and scheduled matches.
- Confirm Schedule shows Court 1, Court 2, and planned fixtures.
- Confirm Scoring shows `QA Standard Netball`.

Security:

- Sign out.
- Visit `/admin`; it should require admin access.
- Visit `/admin/signup`; it should redirect to login.

## Test Ownership Notes

The QA tests are intentionally smoke-level. They prove that critical flows are wired together, not every edge case.

When adding new tests, prefer this order:

1. Unit test for pure logic.
2. DB integration test for Supabase/RLS/schema behaviour.
3. Browser E2E test only for user-visible workflows.

Browser tests should avoid editing or deleting long-lived data. The current QA suite uses disposable seeded data and cleans it afterward.
