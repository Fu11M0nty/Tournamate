# Tournamate

A multi-sport, multi-tournament management platform for grassroots and club competitions. Organisers build a competition structure (divisions, pools, phases, knockout brackets), generate fixtures, enter scores live, and publish a public results page — for any sport.

The repo contains two apps:

- **Web app** (`src/`) — Next.js 16, React 19, Tailwind CSS 4, Supabase. Marketing site, public tournament views, and the admin console.
- **Mobile app** (`mobile/`) — Expo + expo-router, a read-only spectator app. See [`mobile/AGENTS.md`](./mobile/AGENTS.md).

See [AGENTS.md](./AGENTS.md) for the full architecture, data model, structure engine, and conventions. (`CLAUDE.md` imports it.)

---

## Run locally (web)

**Prerequisites:** Node.js 20+, a Supabase project (see below).

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

Open http://localhost:3000 — the root is the marketing landing; browse live tournaments at `/explore`, or sign in at `/admin/login`.

Required environment variables in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only: QA scripts / privileged RPCs
```

The `NEXT_PUBLIC_*` keys are safe to ship to the browser — Row Level Security enforces access control on the database side. The service-role key must stay server-side only (never expose it to the browser).

---

## Run locally (mobile)

```bash
cd mobile
npm install
cp .env.example .env   # fill in the Supabase values
npx expo start
```

Typecheck the mobile app with `npx tsc --noEmit -p mobile/tsconfig.json`. Read the exact versioned Expo docs before changing mobile code (see [`mobile/AGENTS.md`](./mobile/AGENTS.md)).

---

## QA commands

```bash
npm run typecheck       # TypeScript only
npm run lint            # ESLint
npm run test:unit       # Vitest unit tests
npm run test:unit:watch # Vitest watch mode
npm run test:db         # DB integration tests against an already seeded QA database
npm run test:e2e        # Playwright against an already running app or external base URL
npm run test:e2e:local  # Playwright starts the Next dev server
npm run qa:seed         # Create deterministic QA data in the configured Supabase project
npm run qa:cleanup      # Delete the QA tournament and cascaded data
npm run qa:reset        # Cleanup then seed
npm run qa:db           # Cleanup, seed, run DB tests, cleanup again
npm run qa:e2e          # Cleanup, seed, run Playwright browser smoke tests with screenshots/videos, cleanup again
npm run qa:public       # Public-page browser smoke only
npm run qa:admin        # Admin/security browser smoke only
npm run qa:report       # Generate a markdown report from the latest Playwright JSON results
npm run qa:evidence     # Generate a test-by-test screenshot/video evidence index
npm run qa:check        # Typecheck, lint, unit, and E2E
npm run qa:release      # Typecheck, unit, DB QA, and full browser QA
npm run qa              # Alias for qa:release
```

For E2E against a deployed/staging site, set `PLAYWRIGHT_BASE_URL`.

QA seed/cleanup, DB integration tests, and seeded browser smoke tests require `SUPABASE_SERVICE_ROLE_KEY`. Remote Supabase projects are blocked unless `QA_ALLOW_REMOTE=1` is set, and the tournament slug must start with `qa-`.

For QA analysts, use the dedicated [QA runbook](./docs/qa-runbook.md). It explains the seeded data, expected pass/skip counts, what each suite covers, how to investigate common failures, and how to use the generated QA evidence report. Release sign-off can use the [QA release sign-off template](./docs/qa-release-signoff-template.md).

---

## Supabase setup

Use [`supabase/README.md`](./supabase/README.md) as the source of truth for database setup. It has two paths:

1. A fresh-build path for new development, staging, or pre-production projects.
2. An existing-database upgrade path for production-safe migrations.

The schema is defined in [`supabase/schema.sql`](./supabase/schema.sql) (the destructive fresh-build baseline) plus additive `supabase/*.sql` migrations, RPCs, and policies. **Do not run `schema.sql` against production** — it drops and recreates core tables.

All tables use Row Level Security: public `SELECT`, authenticated `INSERT/UPDATE/DELETE`.

### Create an admin user

There is no public signup. Admins are created through the Supabase dashboard and promoted via SQL:

1. In the Supabase dashboard, go to **Authentication → Users → Add user → Create new user**.
2. Enter the organiser's email and a password, and tick **Auto Confirm User** so they can sign in immediately.
3. Promote the user to `superadmin` (and approve them) using the SQL in [`supabase/README.md`](./supabase/README.md).

Access control: Supabase Auth plus a `user_profiles` table with `role` (`superadmin | tournament_admin`) and `is_approved`. `middleware.ts` gates every `/admin` route.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository. Vercel auto-detects Next.js — no build config changes needed.
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` if server features need it).
4. Click **Deploy**. Every push to `main` re-deploys automatically.

For a custom domain, go to **Project → Settings → Domains** and follow the DNS instructions.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                          # marketing landing
│   ├── explore/                          # browse live/upcoming tournaments
│   ├── [tournamentSlug]/                 # tournament hub + public division views
│   ├── admin/                            # console, login, QR capture, scorecards
│   └── layout.tsx                        # SiteHeader / SiteFooter / Toaster
├── components/                           # Admin*, Public*, structure editors, cards, wizard/
├── lib/                                  # supabase, types, standings, scoring, progression, …
middleware.ts                             # gates /admin behind Supabase Auth + RBAC
supabase/                                 # schema.sql + additive migrations + RPCs + seeds
mobile/                                   # Expo spectator app (own AGENTS.md)
scripts/                                  # qa-seed / qa-cleanup / playwright runner
tests/                                    # unit (Vitest) + e2e (Playwright)
```

See [AGENTS.md](./AGENTS.md) for the full structure and the domain model.

---

## Scoring & standings

Points are **configurable per tournament** via `scoring_systems` (win/draw/loss points, bonus-point rules, forfeit handling, and a configurable tie-breaker hierarchy), attached at phase or division level.

The default netball scheme (used as a fallback) is Win = **5**, Draw = **3**, Loss = **0**, plus a **1**-point losing bonus when the loser scores strictly more than 50% of the winner's total.

Standings are always calculated dynamically from match results in [`src/lib/standings.ts`](./src/lib/standings.ts) — there is no stored standings table.
