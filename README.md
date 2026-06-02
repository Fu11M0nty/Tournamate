# MK Netters & MK Dons Tournament Results

A two-day netball tournament results site with a public view (standings, results, fixtures) and a password-protected admin console for entering scores. Built with Next.js 16, React 19, Tailwind CSS 4, and Supabase.

See [CLAUDE.md](./CLAUDE.md) for the full architecture, data model, and component spec.

---

## Run locally

**Prerequisites:** Node.js 20+, a Supabase project (see below).

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

Open http://localhost:3000. The root redirects to `/saturday`.

Required environment variables (both in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both are safe to ship to the browser — Row Level Security enforces access control on the database side.

---

## QA commands

Phase 1 adds the test runners and scripts. Test data and actual suites are added in later phases.

```bash
npm run typecheck       # TypeScript only
npm run lint            # ESLint
npm run test:unit       # Vitest unit tests
npm run test:unit:watch # Vitest watch mode
npm run test:e2e        # Playwright against an already running app or external base URL
npm run test:e2e:local  # Playwright starts the Next dev server
npm run qa:seed         # Create deterministic QA data in the configured Supabase project
npm run qa:cleanup      # Delete the QA tournament and cascaded data
npm run qa:reset        # Cleanup then seed
npm run qa:check        # Typecheck, lint, unit, and E2E
npm run qa              # Seed, run checks, cleanup
```

For E2E tests against a deployed/staging site, set `PLAYWRIGHT_BASE_URL`.

QA seed/cleanup requires `SUPABASE_SERVICE_ROLE_KEY`. Remote Supabase projects are blocked unless `QA_ALLOW_REMOTE=1` is set, and the tournament slug must start with `qa-`.

---

## Supabase setup

Use [`supabase/README.md`](./supabase/README.md) as the source of truth for database setup.

It contains two separate paths:

1. A fresh-build path for new development, staging, or pre-production Supabase projects.
2. An existing-database upgrade path for production-safe migrations.

Do not run [`supabase/schema.sql`](./supabase/schema.sql) against production. It drops and recreates core tables.

### Create the admin user

1. In the Supabase dashboard, go to **Authentication → Users → Add user → Create new user**.
2. Enter the organiser's email and a password, and tick **Auto Confirm User** so they can sign in immediately (no email verification step).
3. Promote the user to `superadmin` using the SQL in [`supabase/README.md`](./supabase/README.md). There is no self-signup route, so creating users through the dashboard is how admin access is granted.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository. Vercel auto-detects Next.js — no build config changes needed.
3. In the import step, add the two environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. First build takes ~1 minute.
5. Vercel gives you a `*.vercel.app` URL immediately. For a custom domain, go to **Project → Settings → Domains** and follow the DNS instructions.

After the first deploy, every push to `main` re-deploys automatically.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                              # redirects to /saturday
│   ├── [day]/
│   │   ├── page.tsx                          # picks first division for the day
│   │   └── [divisionSlug]/page.tsx           # public standings + results + fixtures
│   ├── admin/
│   │   ├── page.tsx                          # admin dashboard (Matches / Teams tabs)
│   │   └── login/page.tsx                    # Supabase email/password sign-in
│   └── layout.tsx                            # SiteHeader, SiteFooter, Toaster
├── components/                               # TournamentView, StandingsTable, ResultCard, etc.
├── lib/
│   ├── supabase.ts                           # browser + server + middleware clients
│   ├── standings.ts                          # pure standings calculator + points helper
│   ├── slugify.ts
│   └── types.ts
supabase/
├── README.md                                 # fresh-build and upgrade runbook
├── schema.sql                                # destructive fresh-build baseline
└── *.sql                                     # additive migrations, RPCs, policies, seed data
middleware.ts                                 # gates /admin routes behind Supabase Auth
```

---

## Points system

- Win = **5**
- Draw = **3**
- Losing bonus = **1** (only if the losing team's score is strictly more than 50% of the winning team's score — e.g. 10–6 earns the bonus, 10–5 does not)
- Loss with no bonus = **0**

Standings are calculated dynamically from match results in [`src/lib/standings.ts`](./src/lib/standings.ts) — there is no stored standings table.
