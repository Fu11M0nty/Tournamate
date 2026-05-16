# AGENTS.md — Netball Tournament Results Website

This file provides workflow guidance, architecture decisions, and coding standards for this project. Read it fully before starting any task.

---

## Project Overview

A two-panel web application for a two-day local netball tournament:

- **Public view** — filterable by day and age group. Displays standings, match results, and upcoming fixtures for the selected age group.
- **Admin console** (`/admin`) — password-protected interface for the tournament organiser to select a day/age group and enter or edit match scores as games finish.

---

## Tournament Structure

This is a **weekend tournament**, not an ongoing league. The entire tournament runs across two days with completely independent age groups on each day.

| Day | Age Groups | Teams per group |
|---|---|---|
| Saturday | 6 age groups | 6–10 teams each |
| Sunday | 4 age groups | 7–10 teams each |

**Key rules:**
- Age groups are entirely independent — a team exists within one age group on one day only
- There is no crossover of teams, results, or standings between age groups
- Each age group runs its own full round-robin (every team plays every other team in their group once)
- Age groups are named by the organiser at setup time (e.g. "Under 9", "Under 10", "Under 11s", "Year 3", etc.)

---

## Design Reference

The UI should closely follow the layout and conventions of **netballresults.uk** (see `https://netballresults.uk/avon/378/`), which is the standard for UK local netball competitions. Key patterns to replicate:

- Two-level filter at the top: Day selector (Saturday / Sunday) → Age Group tabs
- Standings table below the filter with columns: `# | Team | Pld | W | D | L | GF | GA | GD | Pts`
- Recent results block below the table — each result shown as: `Team A  47 v 48  Team B`
- Upcoming fixtures block below results — same layout with scores replaced by `-`
- Clean, minimal design — prioritise readability on mobile (parents and players check scores on their phones)

For a more polished visual style, reference:
- **Netball Super League** (`netballsl.com/standings/`) for standings table styling with team colour accents
- **Flashscore** (`flashscore.info/netball/`) for the match card layout in the results feed

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Tailwind CSS | Fast to build, mobile-responsive |
| Backend/DB | Supabase | Postgres with Row Level Security, free tier |
| Auth | Supabase Auth | Protects admin console, simple email/password |
| Hosting | Vercel | Free, deploys from GitHub, zero config |

**Do not deviate from this stack without asking first.**

---

## Data Model

### `age_groups` table
```sql
id              uuid primary key default gen_random_uuid()
name            text not null        -- e.g. "Under 9", "Under 11", "Year 3"
slug            text not null        -- e.g. "under-9", "under-11", "year-3"
day             text not null        -- values: 'saturday' | 'sunday'
display_order   int not null         -- controls tab ordering within a day
created_at      timestamptz default now()

-- Constraints
unique (slug, day)
unique (name, day)
check (day in ('saturday', 'sunday'))
```

### `teams` table
```sql
id              uuid primary key default gen_random_uuid()
name            text not null
short_name      text             -- e.g. "STORM" for badge/mobile display
color           text             -- hex colour for team accent e.g. "#e63946"
age_group_id    uuid not null references age_groups(id) on delete cascade
created_at      timestamptz default now()
```

Teams are scoped to a single age group. The same club may have teams in multiple age groups — these are separate rows in the `teams` table.

### `matches` table
```sql
id              uuid primary key default gen_random_uuid()
age_group_id    uuid not null references age_groups(id) on delete cascade
home_team_id    uuid not null references teams(id)
away_team_id    uuid not null references teams(id)
home_score      int              -- null until result entered
away_score      int              -- null until result entered
court           text             -- e.g. "Court 1"
kickoff_time    timestamptz not null
status          text not null default 'scheduled'
                -- values: 'scheduled' | 'completed'
created_at      timestamptz default now()

-- Constraints
check (home_team_id != away_team_id)
check (home_score is null or home_score >= 0)
check (away_score is null or away_score >= 0)
check (status in ('scheduled', 'completed'))
```

Standings **must be calculated dynamically** from match results — never stored as a separate table. Points:
- Win = 5
- Draw = 3
- Losing bonus = 1 (awarded only if the losing team's score is strictly more than 50% of the winning team's score — e.g. 10–6 earns the bonus, 10–5 does not)
- Otherwise loss = 0

---

## URL Structure & Routing

Use clean URL routes so parents can bookmark or share a direct link to their child's age group.

```
/                              → redirect to /saturday
/saturday                      → Saturday view, first age group auto-selected
/saturday/[age-group-slug]     → e.g. /saturday/under-10
/sunday                        → Sunday view, first age group auto-selected
/sunday/[age-group-slug]       → e.g. /sunday/under-12
/admin                         → Admin dashboard (requires auth)
/admin/login                   → Admin login page
```

The `age-group-slug` is derived from the `age_groups.slug` column — lowercase, spaces replaced with hyphens (e.g. "Under 10" → `under-10`). The slug is stored on the `age_groups` table and generated at insert time via the `slugify.ts` utility.

If a URL is accessed with an invalid day or slug, show a friendly "Group not found" message — not a 404 error page.

---

## Supabase Setup Checklist

Complete these steps before writing any application code:

1. Create Supabase project at `supabase.com`
2. Create `age_groups`, `teams`, and `matches` tables using the SQL above
3. Enable Row Level Security (RLS) on all three tables
4. Apply RLS policies:
   - `age_groups`: public SELECT, authenticated INSERT/UPDATE/DELETE
   - `teams`: public SELECT, authenticated INSERT/UPDATE/DELETE
   - `matches`: public SELECT, authenticated INSERT/UPDATE/DELETE
5. Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `.env.local`
6. Run the seed script (see below) to populate test data

---

## Seed Data

Always generate a seed script early so the UI can be developed with realistic data.

**Saturday — 3 sample age groups** (representative subset of the real 6):

| Age Group | Teams | Completed results |
|---|---|---|
| Under 9 | 6 | 4 |
| Under 11 | 8 | 6 |
| Under 13 | 10 | 8 |

**Sunday — 2 sample age groups** (representative subset of the real 4):

| Age Group | Teams | Completed results |
|---|---|---|
| Under 10 | 7 | 3 |
| Under 12 | 9 | 5 |

Completed results must be varied enough to produce a non-trivial standings table (i.e. not all wins for one team). Use realistic netball scores (typically 10–40 goals per team per match). All remaining fixtures should have `status = 'scheduled'` and a realistic `kickoff_time` on the correct day.

---

## Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                               # Redirects to /saturday
│   │   ├── [day]/
│   │   │   ├── page.tsx                           # Day view — redirects to first age group slug
│   │   │   └── [ageGroupSlug]/
│   │   │       └── page.tsx                       # Main public view: standings + results + fixtures
│   │   ├── admin/
│   │   │   ├── page.tsx                           # Admin dashboard with day/age group filter
│   │   │   └── login/
│   │   │       └── page.tsx                       # Admin login
│   │   └── layout.tsx
│   ├── components/
│   │   ├── DayTabs.tsx                            # Saturday / Sunday top-level switcher
│   │   ├── AgeGroupTabs.tsx                       # Age group tab bar for the selected day
│   │   ├── StandingsTable.tsx                     # Standings table for one age group
│   │   ├── ResultCard.tsx                         # Single completed match display
│   │   ├── FixtureCard.tsx                        # Single upcoming fixture display
│   │   ├── ScoreEntryForm.tsx                     # Admin score entry modal/form
│   │   └── AdminMatchList.tsx                     # Admin list of all matches for selected group
│   ├── lib/
│   │   ├── supabase.ts                            # Supabase client initialisation
│   │   ├── standings.ts                           # Pure function: matches[] + teams[] → standings[]
│   │   ├── slugify.ts                             # name → slug utility
│   │   └── types.ts                               # Shared TypeScript types (see below)
├── AGENTS.md                                      # This file
├── .env.local                                     # Supabase credentials (never commit)
└── .env.example                                   # Committed template with blank values
```

---

## Key Implementation Rules

### Day and age group filtering
- Every Supabase query must be scoped by `age_group_id` — never fetch all matches and filter client-side
- When the day tab changes, reset the age group to the first group for that day (ordered by `display_order`)
- The selected day and age group are reflected in the URL — use Next.js dynamic routes, not query params

### Standings calculation
The `standings.ts` function must be a **pure function** with signature:
```ts
calculateStandings(teams: Team[], matches: Match[]): StandingRow[]
```
- Receives only the teams and matches for a single, already-filtered age group
- Filters to only `status === 'completed'` matches when computing statistics
- Sort order: Pts DESC → GD DESC → GF DESC → Team name ASC

### Admin console
- Require a Supabase Auth session to access any `/admin` route — redirect to `/admin/login` if unauthenticated
- Admin dashboard has the same Day → Age Group two-level filter as the public view
- All matches for the selected age group are listed in kick-off time order
- Score entry form fields: Home Score (number) + Away Score (number) + Status dropdown (`scheduled` / `completed`)
- After saving, optimistically update the UI and show a success toast
- Validate: no negative scores, scores must be whole numbers

### Mobile-first
- Design the public page for 375px width first
- Both the Day tabs and Age Group tabs must scroll horizontally on mobile — use `overflow-x-auto whitespace-nowrap` and ensure no line wrapping occurs (there can be up to 6 age group tabs)
- Standings table must be horizontally scrollable on mobile — wrap in `overflow-x-auto`
- Match cards should be full-width stacked cards on mobile, not a table
- Admin console can be desktop-first (organisers use a laptop or tablet on the day)

---

## TypeScript Types

```ts
// lib/types.ts

export type Day = 'saturday' | 'sunday'

export interface AgeGroup {
  id: string
  name: string           // e.g. "Under 11"
  slug: string           // e.g. "under-11"
  day: Day
  display_order: number
}

export interface Team {
  id: string
  name: string
  short_name: string | null
  color: string | null
  age_group_id: string
}

export type MatchStatus = 'scheduled' | 'completed'

export interface Match {
  id: string
  age_group_id: string
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  court: string | null
  kickoff_time: string    // ISO string
  status: MatchStatus
}

export interface StandingRow {
  position: number
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}
```

---

## Component Behaviour Specifications

### DayTabs
- Two tabs: "Saturday" and "Sunday"
- Active tab is visually distinct (filled/underlined vs inactive)
- Clicking navigates to `/{day}` which then redirects to the first age group for that day
- Both tabs always visible regardless of which day the user is on

### AgeGroupTabs
- One tab per age group for the selected day, ordered by `display_order`
- Scrollable horizontally on mobile — never wraps to a second row
- Active tab highlighted; clicking navigates to `/{day}/{slug}`
- If only one age group exists for a day, still render the tab bar (do not hide it)
- Saturday will show up to 6 tabs; Sunday up to 4 tabs

### StandingsTable
- First column: position number (`#`)
- Highlight position 1 row with a subtle left accent border
- Use alternating row shading for readability
- Bold the `Pts` column
- Show a 🏆 trophy icon next to position 1 if ALL matches in the group have `status = 'completed'`

### ResultCard
- Layout: `[Home Team]  [Home Score] – [Away Score]  [Away Team]`
- Winning team name bold; draw = both normal weight
- Kick-off time and court shown in smaller muted text below
- Sort order: by kick-off time descending (most recent first)

### FixtureCard
- Mirrors ResultCard layout but with `–` in place of scores
- Sorted by kick-off time ascending (soonest upcoming first)

### ScoreEntryForm (Admin)
- Header shows: age group name + fixture label (`Home Team vs Away Team — 10:30am | Court 1`)
- Pre-populated if scores already exist
- Submit disabled until both score fields have a value
- Scores must be non-negative integers — enforce with `min="0"` and `step="1"` on inputs

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Both are prefixed `NEXT_PUBLIC_` so they are available client-side. This is safe — Supabase RLS policies enforce access control; the anon key does not grant write or admin access.

---

## Definition of Done

A task is complete when:
1. The feature works correctly with real Supabase data (not mocked)
2. The page is visually correct at 375px (mobile) and 1280px (desktop)
3. Switching between days and age groups always shows the correct isolated data — no cross-contamination between groups
4. No TypeScript errors (`tsc --noEmit` passes)

---

## Out of Scope (Do Not Build)

- Player registration or player stats
- Match notifications or email alerts
- Cup / Plate knockout brackets (round-robin group stage only)
- Multiple tournaments or seasons
- Social sharing features
- Any payment or ticketing functionality

If asked to build any of the above, confirm with the user before proceeding.