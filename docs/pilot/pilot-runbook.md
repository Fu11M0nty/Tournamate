# UK Netball Pilot — Operations Runbook

> **Status:** Pilot operations guide · **Last updated:** 2026-06-11
> **Audience:** Tournamate support (concierge) and the pilot organiser.
> **Companion docs:** [`uk-netball-pilot-scope.md`](./uk-netball-pilot-scope.md) (what's in/out of scope) · [`pilot-onepager.md`](./pilot-onepager.md) (organiser-facing summary) · [`matchday-checklist.md`](./matchday-checklist.md) (printable match-day checklist).

This is the practical, step-by-step guide for setting up and running a real UK netball competition on Tournamate. A support person should be able to run a pilot using only this document, and an organiser should be able to follow the match-day sections without knowing anything about the codebase.

It covers both competition styles Tournamate supports:

- **Event tournament** — one or more set competition dates (e.g. a weekend tournament). The main flow of this runbook.
- **Multi-week league** — fixtures spread across a season window. Covered in [§7](#7-multi-week-league-operations).

Throughout, **Division** means a competition stream within the tournament (e.g. "Under 11", "Mixed Open") — each division has its own teams, format, fixtures, and standings.

---

## 1. Who owns what

The pilot is **concierge-supported**: Tournamate support does the technical setup; the organiser owns the people and the day. Agree this split at kickoff and fill in the support contact details in the one-pager.

| Responsibility | Owner |
|---|---|
| Provide divisions, team names/players (or spreadsheet), competition dates, venue & court count, scoring rules | **Organiser** |
| Confirm venue internet / hotspot plan; nominate who enters scores | **Organiser** |
| Create the tournament; build divisions, structure & fixtures; configure scoring; plan the schedule | **Tournamate support** |
| Print scorecards & schedules; test QR capture | **Tournamate support** (organiser can reprint) |
| Pre-event walkthrough and test score | **Both** |
| Entering scores on the day | **Organiser** (and court stewards) |
| Fixing incidents on the day (wrong scores, schedule moves) | **Organiser first**, support on call |
| Snapshots before risky changes; restores | **Tournamate support** (organiser can be shown) |
| Post-event verification, feedback, archiving | **Both** |

> **Support channel:** agree per pilot — named contact, channel (phone/WhatsApp/email), and match-day response expectation. Write these on the printed match-day checklist.

---

## 2. Phase 1 — Two to four weeks before the event

Goal by the end of this phase: the tournament exists in Tournamate with every division, team, format, scoring rule, and fixture in place.

### 2.1 Collect the inputs from the organiser

- [ ] Division list (names, and which competition date each plays on if there are several).
- [ ] Team names per division — a spreadsheet is fine; player lists optional.
- [ ] Competition date(s), venue name & address, and number of courts.
- [ ] Scoring rules — or confirm the netball default (win 5, draw 3, loss 0, losing bonus point when the loser scores more than half the winner's score; tie-breakers: head-to-head → goal difference → goals for).
- [ ] Who will enter scores on the day (organiser, stewards, or both).

### 2.2 Create the tournament

1. Sign in at `/admin` and choose **Create tournament** — or **clone** a past tournament to copy its divisions and setup, then rename and re-date it.
2. In the **General** panel set:
   - **Name** — shown on every public page.
   - **Slug** — the public web address (e.g. `tournamate.uk/spring-netball-2026`). Short, lowercase, no spaces.
   - **Status** — keep it **Upcoming** while building. Switch to **Live** when ready for spectators.
   - **Logo** — PNG with transparent background if the club has one.
3. Set the **Scheduling mode**: **Event days** for a tournament on set dates; **Multi-week league** for a season (see [§7](#7-multi-week-league-operations)). Settle this **before** generating fixtures — switching later changes how the Schedule panel works.

### 2.3 Dates, venues, and courts

1. In **General**, add each **Competition date** the tournament runs on.
2. Add the **Venue(s)** — start typing the address and pick from the lookup suggestions.
3. Courts and their operating hours are set per competition date on the **Schedule** panel (court names like "Court 1", "Court 2", plus start/end times for the day).

### 2.4 Divisions and teams

1. In the **Divisions** panel, **Add division** for each competition stream. In event-days mode, pick which competition date each division plays on.
2. Add teams either:
   - **Manually** — **Add/Edit Teams** on the division card (name, optional short name, colour, logo, optional players); or
   - **In bulk** — the **Import** panel loads divisions, teams, or players from pasted CSV. Load the template to see the expected columns, paste, review the preview, confirm.
3. If entries aren't final yet, let the format wizard create **placeholder teams** ("Team 1", "Team 2"…) and rename them as entries confirm — fixtures and results stay attached.

### 2.5 Apply a format (structure) to each division

New divisions start with **no format** — teams won't appear in public standings until a format is applied.

1. Open the division's **Format** page. The **Structure Wizard** runs in up to four steps: **Template → Configure → Teams → Review**.
2. Pick the template that matches how the division plays. Common netball pilot choices:
   - **Round robin** — everyone plays everyone; simplest for small divisions.
   - **Pools + knockout** — group stage feeding semi-finals/finals; the classic tournament shape.
   - **League** — single or home-and-away round robin (for multi-week mode).
3. Confirm at **Review** — Tournamate builds the phases, pools, and brackets, and **generates the fixtures automatically**.
4. Multi-stage formats carry **progression rules** ("1st in Pool A", "Winner of Semi-final 1"). They are applied with one click between stages — see §5.3 for the match-day workflow. Never wire winners forward by hand-editing fixtures.

> ⚠️ Re-applying a format **replaces** the division's structure and fixtures. If any results exist, take a snapshot first (see §2.8).

### 2.6 Configure scoring

1. In the **Scoring** panel, create a scoring system (or confirm the built-in netball default is what the organiser wants — if no system is attached, the default applies).
2. Set win/draw/loss points, bonus points, **forfeit handling**, and the **tie-breaker order**.
3. Attach the system at **phase** level (preferred) or division level. Different phases can use different systems (e.g. bonus points in pools but not finals).

### 2.7 Verify fixtures

- In **Match Entry**, use the **Matrix** view to check every team plays the right opponents.
- Knockout fixtures show labels like **"Winner of Semi-final 1"** until results decide them — that's correct, not a bug.

### 2.8 Take a baseline snapshot

In **Match Entry**, use the **Snapshot** button (below the match list) per division with a clear reason like `Setup complete`. Snapshots are the undo button for everything that follows.

---

## 3. Phase 2 — Week of the event

Goal: a published schedule, officials assigned, public page verified, and the organiser walked through score entry.

### 3.1 Build the schedule

1. Open the **Schedule** panel for each competition date and set up the **courts** (names + operating hours).
2. Use **Auto-plan** to pack the unplanned fixtures into available court time — it respects match length and breaks and is the fastest first draft.
3. Add non-match blocks (**lunch, presentations**) as schedule events so fixtures don't land in them.
4. Review the warnings the scheduler raises:
   - **Court clash** — two matches on the same court at the same time.
   - **Back-to-back** — the same team playing twice within the configured gap.
   Move fixtures until both are clear. Schedule pool matches **before** knockout matches.
5. Export the schedule to **Excel** if the organiser wants printed copies or noticeboard sheets.
6. When the schedule is final, **lock it** — the **🔓 Unlocked / 🔒 Locked** toggle at the top of the Schedule panel. Locking prevents accidental drag-and-drop changes, and **scorecards can only be printed once the schedule is locked**.

### 3.2 Officiating (if the competition uses assigned umpires)

1. In the **Officiating** panel, register clubs and umpires in the registries (reusable across tournaments), then build this tournament's roster.
2. Assign officials per match from **Match Entry** — open a fixture's officials dialog (the whistle icon).
3. The Match Entry status strip shows how many scheduled matches still have **no officials**.

### 3.3 Review the public page

- Open the public page at the tournament slug on a **phone (375px)** and a **laptop (1280px)**.
- Check every division's standings, fixtures, and schedule tabs read correctly and no team is missing (a missing team usually means it isn't assigned to a pool — fix on the Format page).
- When happy, set the tournament **Status** to **Live** and share the link with the organiser.

### 3.4 Pre-event walkthrough (both parties)

- 30 minutes, screen-share or in person. Cover: signing in, Match Entry, entering one score, correcting a score, QR capture, and where the public page is.
- **Enter one test score and verify it appears on the public page**, then correct it back (or delete the result) — this proves the whole pipeline end to end.
- Confirm the venue internet / hotspot plan and who is entering scores.

---

## 4. Phase 3 — Day before the event

- [ ] Apply any late team renames or withdrawals (renames keep fixtures and results attached).
- [ ] Re-check the Schedule panel for clash/back-to-back warnings after any late changes.
- [ ] Confirm the schedule is **locked** (🔒 on the Schedule panel) — scorecards are only available for a locked schedule.
- [ ] From the Schedule panel, use **🖨️ Print scorecards** — one card per match with teams, time, court, a space for the score, and the match's **QR code**. Print the set (or save as PDF).
- [ ] Test QR capture: scan one scorecard's code with a phone signed in to an approved organiser account, and check the capture page opens.
- [ ] Take a snapshot per division: `Pre-event baseline`.
- [ ] Print the [match-day checklist](./matchday-checklist.md) and write the support contact details on it.
- [ ] Charge devices; confirm the hotspot phone has data.

> 🔐 **Sign-in note:** admin sessions sign out after **10 minutes of inactivity**. This is normal — sign back in; nothing is lost. Make sure the organiser knows their login works the day before, not the morning of.

---

## 5. Phase 4 — Match day

The printable version of this section is [`matchday-checklist.md`](./matchday-checklist.md).

### 5.1 Morning setup (before first centre pass)

- [ ] Confirm venue wifi works at the control desk; have the hotspot phone ready as fallback.
- [ ] Sign in to the admin console on the main device; open **Match Entry** for the day.
- [ ] Distribute scorecards to courts / stewards; pin the schedule up.
- [ ] Open the public page on a spare phone — leave it up as a live sanity check.

### 5.2 Entering scores during play

Three ways to get a score in — all update standings instantly:

1. **Match Entry (primary)** — pick the day and division tabs, click a match, enter both scores, save.
2. **QR capture** — a steward scans the match's QR code on the scorecard and submits the score from the court. The device must be signed in to an approved organiser account, so hand stewards a signed-in tournament device or keep capture to the admin team. The sidebar's **Scan QR** also opens a camera scanner to jump to a match.
3. **Paper first, digital second** — scoresheets stay the on-court record. Photograph the completed sheet and attach it to the match for the audit trail.

Watch the **status strip** at the top of Match Entry between rounds: **Unscheduled / No court / Results in / No officials** — it's the at-a-glance health check.

### 5.3 Phase transitions (resolving qualifiers)

Moving from one stage to the next (pools → semi-finals, semis → final) is a **deliberate one-click step**, not automatic:

1. Check every qualifying result for the stage is entered and correct — **fix wrong scores now**: once qualifiers are applied, the next stage's entrants are fixed and a later score correction does not re-run them.
2. **Take a snapshot** (e.g. `End of pools`).
3. Open the division's **Format** page, show the advanced view, and on the next stage's card click **Resolve qualifiers**. The dialog previews each entrant as **Ready**, **Warning** (source stage has incomplete matches), or **Blocked**.
4. Click **Apply resolved slots** — the qualifying teams are written into the bracket and the stage's fixtures are generated. "Winner of Semi-final 1" becomes the real team everywhere, including the public bracket.

### 5.4 Late arrivals, no-shows, and forfeits

Open the match's score form and use the **Late arrivals & forfeits** section — never type a fake score. With the netball default rules:

- A team **1–3 minutes late** plays with a deduction of **2 goals per minute late** — enter the on-court score and the minutes late; the form shows the adjusted score.
- A team **4+ minutes late, or that doesn't turn up** (tick *did not turn up (no show)*), forfeits — recorded as a **10-0 forfeit** to the other side, feeding standings via the scoring system's forfeit rules.
- If a team failing to provide an umpire is penalised in your competition, use the **umpire no-show** option in the same form.

### 5.5 End of day

- [ ] Every played match shows **Results in** on the status strip; no match left half-entered.
- [ ] Final standings on the public page match the paper records.
- [ ] Take a snapshot per division: `End of day <date>`.
- [ ] Collect completed paper scorecards (photograph any that weren't).

---

## 6. Phase 5 — Post-event

- [ ] Verify final standings per division against the paper audit trail; spot-check 2–3 results.
- [ ] Confirm knockout brackets show the right winners all the way to the final.
- [ ] Set the tournament **Status** to **Complete** — the public page stays available as an archive of final standings.
- [ ] Take a final snapshot per division: `Final results`.
- [ ] Settle umpire **payouts** in the Officiating panel if used.
- [ ] Collect organiser feedback (what was slow, confusing, or missing) and feed it to the roadmap.
- [ ] File the scoresheet photos / printed cards however the club archives records.

---

## 7. Multi-week league operations

For a club league played across a season instead of an event weekend. Setup follows §2 with these differences, then runs on a weekly rhythm.

### 7.1 Setup differences

1. In **General**, set **Scheduling mode** to **multi-week league** and set the **Competition window** — the first and last dates of the season. Do this **before** generating fixtures.
2. Divisions are not tied to a date — fixtures land on any playable date inside the window.
3. Apply a **league** format (single round robin or home-and-away) via the Structure Wizard.
4. The **Schedule** panel becomes a calendar-based planner. For each venue set:
   - **Available from / to** — opening hours (e.g. 18:00–22:00 for a league night).
   - **Courts** — how many matches can run simultaneously.
   - **Playable days** — which weekdays the venue hosts matches (other days grey out on the calendar).
   - **Minimum gap between games** — changeover time for back-to-back matches on a court.
5. Check the **planning summary**: if "fixtures to plan" outnumbers "potential slots", add courts, extend hours, add playable days, or widen the window before planning.
6. Plan fixtures: **drag onto a day** (earliest free slot is picked) or **Auto-plan** the whole season in round order. Changes are **staged** — nothing saves until you press **Confirm**. The summary's **Conflicts** count must be zero.
7. If the league ends in finals, plan each phase separately with the phase selector — knockout fixtures can only be placed after the league fixtures finish.

### 7.2 Weekly rhythm (during the season)

Each match night / week:

- [ ] Enter the night's scores in **Match Entry** (or QR capture at the venue).
- [ ] Record any forfeits with the score form's forfeit options — never fake scores.
- [ ] Glance at the public standings page — the league table updates live.
- [ ] If a fixture needs to move (venue closure, postponement): open it on the Schedule calendar, change its date/time/venue/court, **Confirm**. Played matches are never unscheduled.
- [ ] Snapshot each division after any bulk rearrangement, and at natural milestones (e.g. `End of first half of season`).

---

## 8. Incident playbook

Who acts: **organiser first** for anything marked 🟢; call Tournamate support for 🟠.

| Incident | What to do |
|---|---|
| 🟢 **Wrong score entered** | Open the match in Match Entry, correct the score, save. Standings and any downstream bracket slots recalculate automatically. No restart needed. |
| 🟢 **Team late arrival** | Record the minutes late in the score form's **Late arrivals & forfeits** section (default: 2 goals deducted per minute; 4+ minutes = 10-0 forfeit). Don't enter a made-up score. |
| 🟢 **Team no-show** | Tick **did not turn up (no show)** in the score form on each of their fixtures as they come up — a 10-0 forfeit to the opposing side per the scoring system. If the team has withdrawn for the whole event, ask support to remove them cleanly. |
| 🟢 **Court or time change** | If the schedule is locked, unlock it first (the 🔒 toggle on the Schedule panel). Move the fixture (Schedule panel on an event day; calendar for a league), check the clash/back-to-back warnings, and re-lock. Reprint the affected scorecards if time allows; otherwise hand-correct the printed card — the QR code still opens the right match. |
| 🟢 **Bracket still shows "Winner of…" after the stage finished** | Qualifiers haven't been applied yet. Check the stage's results are all completed, then on the division's **Format** page click **Resolve qualifiers** on the next stage and **Apply resolved slots**. |
| 🟢 **Missing official** | Assign a replacement from the fixture's officials dialog in Match Entry (whistle icon). If your rules penalise the club that failed to supply the umpire, use the **umpire no-show** option in the score form. |
| 🟢 **Weak or dropped internet** | Fall back to paper scoresheets — play never stops for connectivity. Switch the admin device to the hotspot phone. Enter the backlog of scores when connection returns; standings catch up instantly. Photograph scoresheets as you go. |
| 🟢 **Signed out unexpectedly** | Admin sessions time out after 10 minutes of inactivity. Sign back in — nothing is lost. |
| 🟠 **Public page not updating** | First check the score was actually **saved** (the match shows as completed in Match Entry) and the spectator has **refreshed** — there are no push updates. Check the page on your own phone over mobile data. If a saved score genuinely isn't appearing, call support. |
| 🟠 **Disputed result** | Don't argue at the desk: the paper scoresheet (and its photo) is the audit trail. If the standings were affected by an incorrect entry, correct the score; if multiple results are tangled, support can restore the division to the last snapshot and re-enter from paper. |
| 🟠 **Accidental schedule change / bulk mistake** | Stop, don't "fix" over the top. Support restores the division from the most recent snapshot — restoring is a support-side operation, not a button in the app. It replaces current match data with the snapshot, so anything entered after it must be re-entered from paper — another reason to snapshot at every phase boundary. |
| 🟠 **Standings look wrong** | Standings only count **completed** matches and follow the attached scoring system. Check: scores saved? right scoring system on the phase? team assigned to a pool? If it still looks wrong, call support — don't manually adjust results to force a table. |

---

## 9. Dry-run validation checklist

Run this end-to-end before sign-off — on a staging/QA tournament, never on the live pilot data. Every line must pass.

| # | Check | Pass condition |
|---|---|---|
| 1 | **Score entry** | Enter a score in Match Entry; the match shows completed and standings update. |
| 2 | **Score correction** | Change that score; standings recalculate to match. |
| 3 | **QR score capture** | Scan a printed (or on-screen) match QR with a signed-in phone; submit a score; it appears in Match Entry and standings. |
| 4 | **Scorecard print** | With the schedule locked, the day's scorecards render with correct teams, times, courts, and QR codes (the page refuses to render while unlocked). |
| 5 | **Schedule move** | Move a fixture to a new time/court; no clash warning remains; the public schedule shows the new slot. |
| 6 | **No-show / forfeit** | Record a forfeit via the score form; standings apply the scoring system's forfeit points. |
| 7 | **Late arrival** | Record a late-start forfeit the same way; verify the outcome matches the competition rule. |
| 8 | **Progression** | Complete a stage's matches, then **Resolve qualifiers → Apply resolved slots** on the next stage's Format card; "Winner of…" becomes the real team in admin and public views. |
| 9 | **Snapshot & restore** | Snapshot a division from Match Entry (reason required); it appears in the Snapshots panel with the captured matches. Support: rehearse a restore on QA data using the procedure in `supabase/backup_matches.sql` — restore is not self-serve in the app. |
| 10 | **Public standings** | Public division page shows the right table at 375px and 1280px. |
| 11 | **Public schedule** | Public schedule tab matches the admin schedule. |
| 12 | **Sign-in basics** | The organiser's account signs in; `/admin` is blocked when signed out. |

---

*Found something this runbook gets wrong, or a step the product has outgrown? Update this file and the printable checklist together, and note the change on roadmap issue #18.*
