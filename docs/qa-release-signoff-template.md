# QA Release Sign-Off Template

Use this template for a pre-production or release-candidate QA sign-off.

## Release Details

| Field | Value |
| --- | --- |
| Release / build |  |
| Environment |  |
| Base URL |  |
| Supabase project |  |
| Git branch |  |
| Git commit |  |
| QA analyst |  |
| Date |  |

## Automated Checks

| Check | Command | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| TypeScript | `npm run typecheck` | Pass |  |  |
| Unit tests | `npm run test:unit` | Pass |  |  |
| DB integration | `npm run qa:db` | 11 pass |  |  |
| Public browser smoke | `npm run qa:public` | 18 pass, 0 skip |  |  |
| Admin browser smoke | `npm run qa:admin` | 20 pass, 14 skip |  |  |
| Browser smoke | `npm run qa:e2e` | 38 pass, 14 skip |  |  |
| Release gate | `npm run qa:release` | Pass |  |  |

Evidence report:

```text
qa-reports/latest-qa-e2e-report.md
```

Evidence index:

```text
qa-reports/latest-qa-evidence-index.md
```

Playwright report:

```text
playwright-report/index.html
```

## Manual Smoke Checks

| Area | Expected | Result | Notes |
| --- | --- | --- | --- |
| Public tournament hub | Summary, teams and schedule render correctly |  |  |
| Public info and venue details | Description, sport and venue information render correctly |  |  |
| Public team and schedule filters | Team search and schedule mode filters work for spectators |  |  |
| Public division page | Standings, results and fixtures render correctly |  |  |
| Public group-stage division | Separate pool standings render correctly |  |  |
| Public format structures | Table, pool, fixture-only, bracket, play-in, grading and double-elimination seeded structures render correctly |  |  |
| Public not-found pages | Invalid public tournament/division URLs show friendly recovery messages |  |  |
| Admin access control | Anonymous `/admin` is blocked |  |  |
| Admin login | QA admin can sign in |  |  |
| General panel | Tournament dates, venue, sport and scoring default show correctly |  |  |
| Divisions panel | Seeded divisions are listed |  |  |
| Match Entry panel | Seeded completed and scheduled matches show correctly |  |  |
| Schedule panel | Court 1, Court 2 and planned fixtures show correctly |  |  |
| Scoring panel | QA scoring system is visible |  |  |
| Safe admin workflows | General edits, disposable division/team changes, format picker, fixture controls, pool assignment locking, scoring template edits, score entry and schedule edits complete without changing public smoke fixtures |  |  |
| Admin Help panel | Help guides open, search works, a contextual "i" prompt deep-links to the right guide, and print control is present |  |  |

## Documentation Freshness

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Help guides match the product | Guides in `src/lib/helpContent.ts` describe the admin workflows shipped in this release (spot-check any area changed since last release) |  |  |
| Screenshots are current | If any admin screen covered by `public/help/screenshots/` changed in this release, `npm run docs:screenshots` has been re-run and the refreshed assets committed |  |  |
| Contextual prompts resolve | Every `HelpPrompt` target opens an existing guide (covered by unit tests — confirm `npm run test:unit` passed) |  |  |

## Defects And Risks

| Reference | Severity | Summary | Status | Release impact |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Decision

| Decision | Selected |
| --- | --- |
| Approved for release |  |
| Approved with known issues |  |
| Blocked |  |

Reason:

```text

```

Approver:

Date:
