# QA Test Catalogue

This catalogue explains the current automated QA tests in Tournamate in plain language. It is intended for QA analysts, product testers, and release reviewers who need to understand what each automated check proves.

For run commands, environment setup, and evidence locations, use `docs/qa-runbook.md`.

## Current Suites

| Layer | Command | Test count | Main purpose |
| --- | --- | ---: | --- |
| Unit logic | `npm run test:unit` | 23 | Checks pure calculation and mapping logic without Supabase or a browser. |
| Database integration | `npm run qa:db` | 11 | Seeds real QA data, checks Supabase/RLS behaviour, then cleans up. |
| Browser E2E | `npm run qa:e2e` | 44 | Seeds QA data, runs public/admin browser workflows, captures screenshots/videos, then cleans up. |
| Public browser E2E | `npm run qa:public` | 18 | Runs spectator-facing public page checks only. |
| Admin browser E2E | `npm run qa:admin` | 26 | Runs admin/security browser checks only. |
| Browser evidence index | `npm run qa:evidence` | Report only | Regenerates the test-by-test screenshot/video/trace index from the latest Playwright JSON results. |
| Release QA gate | `npm run qa:release` | Composite | Runs typecheck, unit tests, database integration, and the full browser E2E suite. |

Expected browser result:

```text
33 passed
11 skipped
```

The 11 skipped tests are desktop-only admin workflow checks skipped on the mobile browser project. They are expected skips, not failures.

Suite-specific browser commands:

```text
npm run qa:public  -> 18 passed, 0 skipped
npm run qa:admin   -> 15 passed, 11 skipped
npm run qa:e2e     -> 33 passed, 11 skipped
```

## QA Seed Data

The automated suites use a disposable tournament:

| Item | Value |
| --- | --- |
| Tournament slug | `qa-smoke-tournament` |
| Tournament name | `QA Smoke Tournament` |
| Admin user | `qa-admin@tournamate.test` unless overridden by env vars |
| Venue | `QA Arena` |
| Dates | Saturday 6 June, Sunday 7 June |
| Courts | Court 1, Court 2 |

Seeded divisions:

| Division | Purpose |
| --- | --- |
| `QA Under 10` | Public smoke division with completed and upcoming fixtures. |
| `QA Under 12` | Group-stage/finals structure with Pool A and Pool B. |
| `QA Workflow Division` | Admin workflow mutation sandbox; tests can edit scores/times here without changing public smoke fixtures. |
| `QA Format - Simple Round Robin` | Disposable format fixture for simple round-robin coverage. |
| `QA Format - Two Pools` | Disposable format fixture for two-pool group-stage coverage. |
| `QA Format - Group Stage + Finals` | Disposable format fixture for pool-to-knockout progression. |
| `QA Format - Knockout Only` | Disposable format fixture for direct knockout brackets. |
| `QA Format - Knockout + Play-ins` | Disposable format fixture for awkward team counts and play-in paths. |
| `QA Format - Grading Championship Plate` | Disposable format fixture for grading into championship and plate. |
| `QA Format - League Single Round` | Disposable format fixture for single round league scheduling. |
| `QA Format - League Home Away` | Disposable format fixture for home/away league scheduling. |
| `QA Format - Festival Fixtures` | Disposable format fixture for fixture-only events. |
| `QA Format - Placement Finals` | Disposable format fixture for placement games after round robin. |
| `QA Format - Double Elimination` | Disposable format fixture for top-four/double-elimination style follow-on. |

## Unit Logic Tests

These tests live in `tests/unit/`. They do not connect to Supabase and are the fastest checks to run.

| ID | Area | What it checks | Why it matters |
| --- | --- | --- | --- |
| UNIT-001 | Slugs | Names are normalised into URL-safe slugs. | Public/admin routes must remain predictable. |
| UNIT-002 | Match labels | Pool, element, and phase labels resolve in the right priority order. | Fixture labels must describe the correct stage/pool. |
| UNIT-003 | Scoring | Win/draw/loss and strict losing bonus points are awarded correctly. | Standings must follow configured scoring rules. |
| UNIT-004 | Standings | Only completed matches count towards standings. | Scheduled or placeholder matches must not affect tables. |
| UNIT-005 | Forfeits | No-shows, lateness, and umpire penalties are applied. | Match-day discipline rules affect standings correctly. |
| UNIT-006 | Phase scoring | Phases are sorted and the round-robin phase is preferred as default. | Public/admin views should pick the right phase scoring context. |
| UNIT-007 | Scoring fallback | Phase scoring is preferred before division fallback. | Per-phase scoring overrides must work. |
| UNIT-008 | Format builders | Group-stage finals create cross-pool semi-finals. | Pool A 1st should not incorrectly play Pool A 2nd by default. |
| UNIT-009 | Double elimination | Top-four double-elimination follow-on creates loser progression. | Netball-style finals paths need correct winner/loser routes. |
| UNIT-010 | Placements | Round-robin placement rules choose the right placement matches. | Placement formats must generate meaningful finals. |
| UNIT-011 | Structure validation | Duplicate pool assignments and unresolved placeholders are detected. | Organisers need clear readiness checks. |
| UNIT-012 | Readiness status | Future unresolved fixtures are treated as informational ready checks. | Placeholder fixtures should not always be treated as a hard failure. |
| UNIT-013 | Scheduling | Independent matches are placed on free courts at the same round start. | Auto-planning should use available courts efficiently. |
| UNIT-014 | Scheduling guardrails | Team rest time and not-before constraints are respected. | Later-stage fixtures should not be scheduled too early. |
| UNIT-015 | Court windows | Matches that cannot fit inside court windows are reported. | Organisers need to know when scheduling is impossible. |
| UNIT-016 | Qualification mappings | Source types map to slot outcomes and back. | The UI abstraction must stay aligned with stored progression data. |
| UNIT-017 | Progression rules | Slots link to progression rules by target slot ID. | Bracket/phase population needs the right destinations. |
| UNIT-018 | Mapping validation | Missing rules and mismatched source details are flagged. | Prevents slot/rule drift in advanced structures. |
| UNIT-019 | Competition dates | Legacy days are derived from tournament date ranges. | Backward-compatible public routes still work. |
| UNIT-020 | Date labels | Legacy day labels use tournament dates. | Public day tabs should show real configured dates. |
| UNIT-021 | Date mapping | Legacy days map to configured date slugs. | Old URLs and new date model stay compatible. |
| UNIT-022 | Match duration | Total match minutes are calculated for supported formats. | Scheduling needs correct match lengths. |
| UNIT-023 | Match rule text | Continuous match rules are described in organiser language. | Admin UI explanations should match stored match settings. |

## Database Integration Tests

These tests live in `tests/db/qa-seed.integration.test.ts` and run through `npm run qa:db`.

| ID | Test | What it checks | Expected result |
| --- | --- | --- | --- |
| DB-001 | Seeds expected tournament, dates, venue, courts, and divisions | The QA seed creates the core tournament records. | One public QA tournament exists with two dates, one venue, two courts, and three divisions. |
| DB-002 | Anonymous reads but no anonymous writes | Public RLS allows read access but blocks writes. | Anonymous user can read `qa-smoke-tournament` and cannot insert a tournament. |
| DB-003 | QA admin can sign in | Seeded Supabase Auth user and `user_profiles` RBAC are valid. | QA admin signs in and has approved `superadmin` profile. |
| DB-004 | Under 10 standings from real data | Real seeded matches produce expected standings. | Amber Aces rank first with 5 points; Blue Bolts receive losing bonus. |
| DB-005 | Under 12 group-stage/finals structure | The multi-pool structure is seeded correctly. | Phases are group-stage, semi-finals, finals; Pool A and Pool B exist; four matches exist. |
| DB-006 | Workflow division for safe mutation tests | A dedicated admin sandbox exists. | Four workflow teams, one workflow phase/pool, and two scheduled matches exist. |
| DB-007 | Format-specific QA divisions | One disposable division exists for every major structure type. | Each format division has teams, phases, pools, fixtures, and at least one seeded slot/progression path across the format set. |
| DB-008 | Approved admin writes disposable data | Authenticated admin RLS permits safe writes. | QA admin can insert, update, and delete a disposable team in the workflow division. |
| DB-009 | Soft-deleted team filtering | Active-data queries exclude soft-deleted teams. | A seeded soft-deleted team is visible to privileged cleanup but absent from active team queries. |
| DB-010 | Fixture division scoping | Seeded fixtures do not reference teams from another division. | Every home/away team attached to a QA match belongs to the same division as that match. |
| DB-011 | Progression rule integrity | Qualification rules, slots, elements, phases, pools, and source matches still line up. | Every QA progression rule targets an existing slot in the expected element/phase and references valid source structures. |

## Browser E2E Tests

These tests live in `tests/e2e/` and run through `npm run qa:e2e`. The suite runs in desktop Chrome and mobile Chrome. Admin workflow mutation tests are desktop-only for now.

### Public Tournament Smoke

| ID | Test | Browser projects | What it checks | Expected result |
| --- | --- | --- | --- | --- |
| E2E-PUB-001 | Tournament hub and seeded summary data | Desktop + mobile | Opens the QA tournament hub, teams tab, and schedule tab. | Hub shows QA Smoke Tournament, 14 divisions, 66 teams, seeded public teams, workflow teams, and format-specific fixtures. |
| E2E-PUB-002 | Public division standings, results, fixtures | Desktop + mobile | Opens the Under 10 public division page. | Standings, Results, and Upcoming fixtures sections render with seeded teams/scores. |
| E2E-PUB-003 | Multi-pool public standings | Desktop + mobile | Opens the Under 12 public division page. | Pool A and Pool B standings render with seeded teams. |
| E2E-PUB-004 | Table and fixture-only format divisions | Desktop + mobile | Opens seeded round-robin, two-pool, home/away league, and festival divisions. | Public pages render standings, pool headings, upcoming fixtures, and seeded format teams. |
| E2E-PUB-005 | Progression and bracket format divisions | Desktop + mobile | Opens seeded group-finals, knockout, play-ins, grading championship, and double-elimination divisions. | Public pages render bracket views or downstream qualifier fixtures with expected placeholder labels. |
| E2E-PUB-006 | Public hub info and venue details | Desktop + mobile | Opens the QA tournament hub info tab. | Tournament description, sport, and venue details render for spectators. |
| E2E-PUB-007 | Public team list filtering | Desktop + mobile | Opens the teams tab and searches for `Amber`. | Matching teams remain visible and unrelated teams are filtered out. |
| E2E-PUB-008 | Public schedule filtering | Desktop + mobile | Opens the schedule tab and switches from upcoming fixtures to played results. | Upcoming fixtures appear first; played results then show completed seeded teams and hide unrelated upcoming workflow fixtures. |
| E2E-PUB-009 | Friendly public not-found pages | Desktop + mobile | Opens invalid tournament and division URLs. | Friendly not-found messages render with a Back to home link, not a hard error page. |

### Admin Access Smoke

| ID | Test | Browser projects | What it checks | Expected result |
| --- | --- | --- | --- | --- |
| E2E-AUTH-001 | Anonymous admin protection | Desktop + mobile | Navigates to `/admin` without signing in. | User sees the admin access required page and sign-in link. |
| E2E-AUTH-002 | Disabled signup protection | Desktop + mobile | Navigates to `/admin/signup`. | User is redirected to `/admin/login` because public signup is disabled. |

### Admin Workflow Smoke

| ID | Test | Browser projects | What it checks | Expected result |
| --- | --- | --- | --- | --- |
| E2E-ADM-001 | Sign in and reach seeded management panels | Desktop only; skipped on mobile | Signs in as QA admin and visits General, Divisions, Match Entry, Schedule, and Scoring. | Seeded tournament data is visible in each admin panel. |

### Safe Admin Mutation Workflows

These tests use the `QA Workflow Division` or temporary records and clean up after themselves. They are designed not to disturb the public smoke fixtures.

| ID | Test | Browser projects | What it changes | Cleanup approach | Expected result |
| --- | --- | --- | --- | --- | --- |
| E2E-SAFE-001 | Create and edit temporary division | Desktop only; skipped on mobile | Creates `QA E2E Temp Division`, then renames it. | Deletes temporary division slugs before and after the test. | Edited division appears; original temporary name no longer appears. |
| E2E-SAFE-002 | Add disposable workflow team | Desktop only; skipped on mobile | Adds `Workflow E2E Team` to QA Workflow Division. | Deletes the disposable team before and after the test. | Team and short name `WE2E` appear in the team list. |
| E2E-SAFE-003 | Open workflow format view | Desktop only; skipped on mobile | No data mutation. | None required. | The QA Workflow Division format page opens and shows `Workflow Round Robin`. |
| E2E-SAFE-004 | Record workflow fixture score | Desktop only; skipped on mobile | Marks Workflow Alpha vs Workflow Bravo completed at 12-7. | Resets workflow fixtures before and after the test. | Match row shows completed status and the entered score. |
| E2E-SAFE-005 | Update workflow fixture time | Desktop only; skipped on mobile | Moves Workflow Charlie vs Workflow Delta to 11:30. | Resets workflow fixtures before and after the test. | Schedule shows the workflow fixture at 11:30. |
| E2E-SAFE-006 | Edit tournament general details | Desktop only; skipped on mobile | Temporarily changes the QA tournament title, sport, and default scoring. | Resets the QA tournament general fields before and after the test. | General details save and the admin header/form reflect the edited values. |
| E2E-SAFE-007 | Create and edit scoring template | Desktop only; skipped on mobile | Creates `QA E2E Scoring Template`, then renames it and changes win points. | Deletes the temporary scoring templates before and after the test. | The scoring table shows the created and edited points template. |
| E2E-SAFE-008 | Open guided change-format picker | Desktop only; skipped on mobile | Opens the format picker for `QA Format - Two Pools` without applying a new format. | No data mutation. | The picker shows major format choices such as round robin, group-stage finals, knockout, and league season. |
| E2E-SAFE-009 | View fixture-generation controls | Desktop only; skipped on mobile | Opens Advanced setup for `QA Format - Two Pools`. | No data mutation. | Fixture generation controls for Pool Play and unscheduled-only regeneration are visible. |
| E2E-SAFE-010 | Pool assignment locking | Desktop only; skipped on mobile | Opens Pool B team assignment in `QA Format - Two Pools`. | No data mutation. | Teams already assigned to Pool A are disabled and labelled with Pool A; Pool B teams remain selectable. |

## Evidence Review Guide

After `npm run qa:e2e`, review:

| Evidence | Location | Use |
| --- | --- | --- |
| Markdown summary | `qa-reports/latest-qa-e2e-report.md` | First place to check pass/fail/skip counts and failed test names. |
| Evidence index | `qa-reports/latest-qa-evidence-index.md` | Test-by-test links to screenshots, videos, and traces. |
| JSON results | `qa-reports/playwright-results.json` | Machine-readable results for CI or deeper analysis. |
| HTML report | `playwright-report/index.html` | Best place for QA analysts to view screenshots, videos, traces, and timings. |
| Per-test artifacts | `test-results/` | Raw screenshots/videos for each test. |

For the current suite, QA should confirm:

- Total browser tests: 44.
- Passed: 33.
- Skipped: 11.
- Failed: 0.
- Skips are the expected desktop-only admin workflow tests on the mobile project.

## Known Gaps

The current automated suite is a strong smoke/regression baseline, but it does not yet fully cover every product capability.

## Future QA Roadmap

Use this roadmap when planning future QA enhancements. Items are grouped by product area so they can be picked up alongside related feature work.

### Admin Coverage

| Area | Future coverage |
| --- | --- |
| General settings | Edit tournament dates, venues, organiser/contact fields, maps links, and default scoring. Verify changes are restored after safe workflow tests. |
| Divisions | Create divisions with custom dates, scoring overrides, placeholder teams, archive/delete behaviour, and structure isolation between divisions. |
| Format builder | Apply each supported format to disposable divisions and verify created phases, pools, fixtures, slots, qualification paths, and readiness checks. |
| Pools | Assign teams, prevent duplicate assignment, move teams between pools, clear pools, and verify pool assignment state persists after reload. |
| Fixture generation | Generate fixtures, generate placeholders, regenerate unscheduled-only fixtures, preserve scheduled fixtures, and clean up deleted phase/pool fixtures safely. |
| Match entry | Enter completed scores, scheduled/postponed statuses, forfeits, no-show/late rules, score reset, and progression after completed knockout fixtures. |
| Schedule | Move fixtures between courts and times, detect court clashes, detect team clashes, enforce phase chronology, unplan fixtures, and schedule placeholder fixtures. |
| Scoring systems | Create/edit/delete custom scoring, apply scoring at tournament/division/phase level, and verify standings recalculate with the selected system. |
| Import/export | Team import validation, schedule export, schedule import round trip, invalid spreadsheet handling, and duplicate team handling. |
| Snapshots | Create snapshots, verify captured tournament state, compare snapshot contents, and check snapshot list/detail views. |
| Officiating | Assign umpires, check clash warnings, record officiating status, calculate payout basics, and verify public/admin visibility rules. |
| User/RBAC admin | Add organiser users, approve/deactivate users, role-based access checks, and tournament-scoped permissions when roles expand. |

### Current Priority Gaps

| Area | Missing coverage |
| --- | --- |
| General settings | Editing tournament dates, venues, and organiser invite fields. Title, sport, and default scoring now have safe E2E coverage. |
| Format builder | Applying each tournament format to disposable divisions and validating created phases/pools/fixtures. The guided picker now has safe E2E coverage. |
| Pool management | Moving teams between pools and validating save behaviour. Duplicate assignment prevention now has safe E2E coverage. |
| Fixture generation | Mutating generate/regenerate flows, placeholder fixture creation, and cleanup behaviour. Fixture-generation controls now have safe E2E visibility coverage. |
| Knockout/progression | Resolved brackets, play-ins, placement routes, double-elimination routes, and public bracket rendering. |
| Schedule guardrails | Court clashes, back-to-back warnings, dependency order between phases, and unplanning. |
| Scoring systems | Confirming standings use a newly selected custom scoring system. Create/edit now has safe E2E coverage. |
| Imports/exports | Team import, schedule export/import round trip, and validation errors. |
| Snapshots | Creating and reviewing snapshots. |
| Officiating | Umpire assignment and payout workflows. |
| Public mobile polish | Additional 375px visual layout assertions for bracket-heavy formats. Public hub/team/schedule/error journeys now run on mobile. |

### Public Page Coverage

| Area | Future coverage |
| --- | --- |
| Tournament hub | Info, venues, dates, teams, schedule, public status, and empty-state behaviour across desktop and mobile. |
| Division page | Standings, fixtures, results, brackets, pool views, phase tabs, and scoring labels for every seeded format. |
| Pool standings | Group-stage and grading formats with multiple pools, odd pool counts, best-ranked qualifiers, and hidden standings modes. |
| Knockout brackets | Resolved teams, unresolved placeholders, scores, winner highlighting, play-ins, double-elimination paths, and mobile scrolling. |
| Placeholder labels | Labels such as `Winner of Semi-final 1`, pool-rank qualifiers, byes, and manual slots render clearly in fixtures and brackets. |
| Schedule | Chronological fixture ordering, court/day filters, placeholder fixtures, completed results, postponed matches, and public mobile layout. |
| Invalid routes | Friendly handling for invalid tournament, date/day, division, and phase slugs. |
| Accessibility | Keyboard navigation, landmark headings, form labels, contrast, focus order, and screen-reader-friendly table/bracket summaries. |

### Format-Specific QA Data

The QA seed should continue to maintain one disposable division per major structure. Future enhancements should add richer expected outcomes for:

| Format | Future seed/test enhancement |
| --- | --- |
| Simple round robin | Complete all fixtures and verify final standings/tie-breakers. |
| Two pools | Verify pool assignment changes and per-pool standings. |
| Group stage + finals | Complete pool fixtures, resolve semi-finals/final, and verify public bracket labels. |
| Knockout only | Complete each round and verify winners cascade into later phases. |
| Knockout + play-ins | Verify play-in winners populate the main bracket and non-play-in teams remain unique. |
| Grading + championship/plate | Verify teams split into championship/plate paths and optional knockout follow-ons. |
| League single round | Verify each team plays the same number of fixtures and balanced home allocation where possible. |
| League home/away | Verify every pairing has home and away fixtures. |
| Festival fixtures | Verify fixture-only events without standings. |
| Placement finals | Verify plain-English rules and generated placement matches. |
| Double elimination | Verify winner and loser progression paths through final/playoff stages. |

### Database And RLS Regression

| Area | Future coverage |
| --- | --- |
| Public reads | Anonymous read access remains limited to public-safe data. |
| Public writes | Anonymous writes remain blocked across all mutable tables. |
| Admin writes | Approved admins can write only expected tournament-scoped data. |
| Tournament scoping | No cross-tournament or cross-division leakage in queries, RPCs, or cleanup. |
| Soft deletes | Deleted teams/matches are excluded from active views and preserved where expected. |
| Structure integrity | Phases, pools, elements, slots, progression rules, and matches remain aligned after create/update/delete. |
| Fixture cleanup | Deleting phases/pools/slots cleans up dependent matches without FK/check constraint errors. |
| QA cleanup | QA cleanup always removes disposable data and never touches non-`qa-` tournaments. |

### Reporting And Analyst Support

| Area | Future coverage |
| --- | --- |
| Evidence index | Keep screenshot/video/trace links generated for every browser run. |
| Release checklist | Expand sign-off template as new product areas are automated. |
| Skipped tests | Track expected skips with rationale and revisit them when admin mobile support changes. |
| Manual charters | Add exploratory charters for high-risk flows such as tournament creation, format changes, and match-day operations. |
| Defect triage | Add a standard defect template linking failing test, evidence, environment, and expected result. |

### CI And On-Demand Runs

| Area | Future coverage |
| --- | --- |
| `qa:db` | Keep as the fast database/RLS confidence check. |
| `qa:public` | Keep as the fast public-page browser smoke. |
| `qa:admin` | Keep as the admin-console browser smoke and expand as safe workflows grow. |
| `qa:release` | Use as the full pre-release gate. |
| CI pipeline | Add scheduled or PR-triggered runs when the project is ready for hosted automation. |
| Environment gates | Separate local, staging, and pre-production QA targets with clear environment variable profiles. |

## Adding New Tests

When adding new automated QA tests:

1. Use `qa-smoke-tournament` seed data where possible.
2. Put destructive or mutation tests in a dedicated disposable division/team/fixture.
3. Clean up before and after mutation tests.
4. Keep public smoke fixtures stable so public tests remain deterministic.
5. Prefer plain-English test names that a QA analyst can map to product behaviour.
6. Update this catalogue and `docs/qa-runbook.md` whenever expected counts or coverage change.
