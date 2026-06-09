# UK Netball Pilot — Scope & Package

> **Status:** Pilot definition · **Last updated:** 2026-06-09
> **Audience:** Internal product/delivery team (planning + scope control).
> **Companion doc:** [`pilot-onepager.md`](./pilot-onepager.md) — the plain-language version to share with a prospective organiser.

This document defines the **first Tournamate pilot**: a single UK netball club or league competition run end-to-end on Tournamate, with hands-on (concierge) setup support. It exists to set expectations, prevent scope creep, and give a volunteer organiser confidence before match day.

Placeholders like `<Club / league name>`, `<Tournament date>`, and `<support contact>` are filled in per pilot.

---

## 1. What the pilot is trying to prove

That a grassroots UK netball organiser can, with concierge setup help, run a real competition on Tournamate — fixtures, live scoring, scheduling, and public results — and that spectators get a clear, reliable public results experience on web and mobile.

**Positioning:** Tournamate is a **concierge-supported, online tournament management platform**. The organiser is helped through setup, then uses the web admin console on the day for fixtures, scoring, scheduling, QR-based score capture, and public results. We compete on **structure, QR scoring, public results, netball workflows, and scheduling** — not (yet) on offline use, payments, or a native admin app.

---

## 2. Target pilot customer

- A single UK **netball** club or local league running a tournament or a league competition.
- One organiser (or a small organising group) acting as the admin, typically non-technical and volunteer.
- Runs on a laptop/tablet with **reliable internet** at the venue (or a phone hotspot as backup).
- Wants a professional public results page for players, parents, and spectators.

Out of target for this pilot: multi-club federations, paid/ticketed events, and organisers who need to work offline.

---

## 3. Included capabilities (in scope)

All delivered through the existing **web admin console** and **public web/mobile spectator** views:

- **Tournament setup & cloning** — create the tournament, competition dates, venues, and courts.
- **Divisions** — competition streams (e.g. Under 11, Mixed Open). *(Stored as `age_groups` in the DB; always called "Division" in the product.)*
- **Structure building** — phases (round robin / group stage / knockout / league), pools, and knockout brackets, including drag-and-drop structure editors and templates.
- **Teams & players** — team management and per-team player lists, with spreadsheet import/export.
- **Fixture generation** — auto-planned fixtures plus a manual fixture matrix.
- **Scheduling** — court/time planning across competition dates, plus non-match schedule blocks (lunch, ceremonies).
- **Score entry & live results** — admin score entry; standings/results update live.
- **QR score capture** — printable QR links and short codes so a court steward can submit a score from their phone.
- **Scoresheet photo upload** — attach a photo of the paper scoresheet to a match for the record.
- **Configurable scoring** — win/draw/loss points, bonus points, forfeit handling, and a tie-breaker hierarchy (netball default available, but configurable — never hard-coded).
- **Officiating basics** — umpire/club management, umpire assignment, and payout tracking.
- **Printable scorecards & schedules** — PDF output for courts.
- **Public spectator views** — per-tournament hub (info, teams, standings, schedule), public division view (standings, results, fixtures, bracket), and the read-only mobile spectator app (incl. QR scan to open a tournament).
- **Snapshots** — capture/restore tournament state.

---

## 4. Excluded capabilities (explicitly out of scope)

These are **not** part of the pilot. Each is framed positively in the organiser one-pager.

| Excluded | Why it's fine for the pilot |
|---|---|
| **Offline admin** | The pilot assumes venue internet; concierge support covers connectivity planning. Live online results are the benefit. |
| **Native admin app** | The web admin console works on a laptop/tablet browser; no install needed. |
| **Paid registration / ticketing** | Teams are added by the organiser (or imported); money is handled however the club already does it. |
| **Self-serve billing** | The pilot is concierge-onboarded; there's nothing for the organiser to subscribe to or pay for in-app. |
| **Custom domains / full white-labeling** | The public page lives on the standard Tournamate URL for the pilot. |
| **Push notifications / email alerts** | Spectators refresh the live public page; no notification system is promised. |

If a pilot conversation surfaces a need for any of the above, treat it as **post-pilot roadmap input**, not pilot scope.

---

## 5. Support model (concierge)

> Placeholders below are confirmed per pilot.

- **Who delivers support:** `<support contact / team>`.
- **Setup:** we build (or pair-build) the initial tournament structure, divisions, teams, and fixtures with the organiser before match day.
- **Channel:** `<email / WhatsApp / phone>` for the organiser's questions.
- **Response expectation:** `<e.g. same-day during the week; priority/on-call on match day>`.
- **Match-day cover:** `<e.g. a named contact reachable by phone during event hours>`.
- **Handover:** a short walkthrough of score entry, QR capture, and the public page before the event.

---

## 6. Pre-event setup responsibilities

| Owner | Responsibility |
|---|---|
| Organiser | Provide division list, team names/players (or a spreadsheet), competition dates, venue & court count, and the scoring rules to use. |
| Organiser | Confirm venue internet / hotspot plan; nominate who will enter scores. |
| Tournamate (concierge) | Create the tournament, build structure & fixtures, configure scoring, set up courts/schedule, and prepare QR capture links/scorecards. |
| Both | Pre-event walkthrough and a dry run of entering one score. |

---

## 7. Match-day operating assumptions

- The venue has **working internet** (wifi or mobile data); a phone hotspot is the fallback.
- Scores are entered by the organiser or court stewards via the admin console or **QR capture** links on a phone.
- The **public results page** is the live source of truth for spectators; they refresh to see updates.
- Paper scoresheets remain the on-court backup and can be **photographed and attached** to each match.
- A `<support contact>` is reachable during event hours for issues.

---

## 8. Known risks & mitigations

| Risk | Mitigation |
|---|---|
| Venue internet is weak/unreliable | Confirm connectivity in advance; plan a phone hotspot; keep paper scoresheets as backup and upload photos. |
| Organiser unfamiliar with the console | Concierge setup + pre-event walkthrough + a one-page quick guide; we build the structure for them. |
| Last-minute fixture/team changes | Show the organiser how to edit teams/fixtures, or handle changes via the support channel. |
| Expectation gap on excluded features | This scope doc + the organiser one-pager set expectations up front; exclusions are explicit. |
| Score-entry mistakes during a busy session | QR capture reduces relay errors; scores are editable; scoresheet photos provide an audit trail. |

---

## 9. Pilot readiness checklist

**Before the event**
- [ ] Tournament, competition dates, venue, and courts created.
- [ ] Divisions, teams, and players entered (or imported) and verified with the organiser.
- [ ] Structure (phases/pools/brackets) built and fixtures generated.
- [ ] Scoring system configured and confirmed with the organiser.
- [ ] Schedule/courts laid out; printable scorecards ready.
- [ ] QR capture links/short codes generated and tested on a phone.
- [ ] Public tournament page reviewed at 375px (mobile) and 1280px (desktop).
- [ ] Venue internet / hotspot plan confirmed; score-entry owner nominated.
- [ ] Pre-event walkthrough done; one test score entered and visible publicly.
- [ ] `<support contact>` and match-day response plan shared with the organiser.

**During the event**
- [ ] Scores entered live (console or QR capture); public page updating.
- [ ] Paper scoresheets photographed/attached where used.
- [ ] Support contact reachable.

**After the event**
- [ ] Final results confirmed and public page tidied.
- [ ] Snapshot captured.
- [ ] Feedback collected from organiser and (optionally) spectators.

---

## 10. Definition of done (for this scope work)

- This scope doc and the organiser-facing [`pilot-onepager.md`](./pilot-onepager.md) exist under `docs/pilot/`.
- Both list included **and** excluded capabilities, the support model, setup responsibilities, match-day assumptions, and a readiness checklist.
- Every excluded capability has a plain-language explanation.
- Neither doc promises offline use, payments, push notifications, native admin, self-serve billing, or custom domains.
- The one-pager is shareable with a non-technical organiser without further explanation.
- The pilot docs are discoverable from `AGENTS.md`.
