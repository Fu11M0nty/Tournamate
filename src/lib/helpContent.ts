// Organiser-facing help guide content for the admin Help panel.
// Structure/lookup helpers live in helpGuides.ts. Copy here must describe the
// product as it actually behaves today — when an admin workflow changes,
// update the matching guide (and refresh screenshots via `npm run docs:screenshots`).
//
// Inline markup supported in text: **bold** and `code`.

import type { HelpGuide } from './helpGuides'

export const HELP_GUIDES: HelpGuide[] = [
  // ── Getting started ────────────────────────────────────────────────────────
  {
    slug: 'create-tournament',
    title: 'Creating and editing a tournament',
    summary: 'Set up your tournament identity: name, web address, status, and branding.',
    category: 'getting-started',
    panel: 'general',
    youtubeUrl: null,
    relatedSlugs: ['scheduling-modes', 'dates-and-venues', 'divisions'],
    sections: [
      {
        heading: 'Your tournament identity',
        blocks: [
          {
            type: 'paragraph',
            text: 'From the admin console landing page you can create a new tournament or open an existing one. Once inside, the **General** panel holds the tournament details that shape everything else.',
          },
          {
            type: 'list',
            items: [
              '**Name** — appears at the top of every public page and in browser tabs.',
              '**Slug (web address)** — your tournament\'s unique URL, e.g. `tournamate.uk/spring-league-2026`. Keep it short and lowercase; avoid spaces and special characters.',
              '**Status** — **Upcoming** shows the tournament as coming soon, **Live** features it prominently with live results, **Complete** keeps it available as an archive of final standings.',
              '**Logo** — upload a PNG with a transparent background so it looks sharp on light and dark themes.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-general-tournament-details.png',
              alt: 'The General panel showing the Tournament details form',
              caption: 'Tournament details in the General panel.',
            },
          },
        ],
      },
      {
        heading: 'Cloning a past tournament',
        blocks: [
          {
            type: 'paragraph',
            text: 'Running the same event again? From the tournament list you can **clone** an existing tournament to copy its divisions and setup into a fresh tournament with a new name and dates — much faster than starting from scratch.',
          },
          {
            type: 'tip',
            title: 'Keep it Upcoming while you build',
            text: 'Leave the status as Upcoming while you set up divisions, teams, and fixtures. Switch to Live when you are ready for spectators to follow results.',
          },
        ],
      },
    ],
  },
  {
    slug: 'scheduling-modes',
    title: 'Choosing a scheduling mode',
    summary: 'Event days for weekend tournaments, or a multi-week window for leagues that run over a season.',
    category: 'getting-started',
    panel: 'general',
    youtubeUrl: null,
    relatedSlugs: ['dates-and-venues', 'multi-week-league', 'schedule-event-day'],
    sections: [
      {
        heading: 'Two ways to run a competition',
        blocks: [
          {
            type: 'paragraph',
            text: 'In the **General** panel, the **Scheduling mode** setting decides how your competition is planned:',
          },
          {
            type: 'list',
            items: [
              '**Event days** — the classic tournament format: one or more specific competition dates (for example a Saturday and a Sunday), with courts and timed slots on each day.',
              '**Multi-week league** — a competition window with a start and end date, where fixtures are spread across weeks at one or more venues. Ideal for club leagues that play one or more rounds per week.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-general-scheduling-mode.png',
              alt: 'The Scheduling mode selector in the General panel',
              caption: 'Pick the mode that matches how your competition runs.',
            },
          },
        ],
      },
      {
        heading: 'What changes between the modes',
        blocks: [
          {
            type: 'list',
            items: [
              'In **event days** mode you manage **Competition dates** in General, and the Schedule panel plans courts and time slots within each day.',
              'In **multi-week league** mode you set a **Competition window** (start and end date) instead, and the Schedule panel becomes a calendar-based league planner.',
              'Divisions in multi-week mode are not tied to a particular day — fixtures land on any playable date inside the window.',
            ],
          },
          {
            type: 'warning',
            title: 'Choose before you schedule',
            text: 'Switching mode after you have planned fixtures changes how the Schedule panel works, so settle the mode early — ideally before generating fixtures.',
          },
        ],
      },
    ],
  },
  {
    slug: 'dates-and-venues',
    title: 'Competition dates, venues and courts',
    summary: 'Tell Tournamate when and where you play, with address lookup for venues.',
    category: 'getting-started',
    panel: 'general',
    youtubeUrl: null,
    relatedSlugs: ['scheduling-modes', 'schedule-event-day', 'multi-week-league'],
    sections: [
      {
        heading: 'Competition dates (event days mode)',
        blocks: [
          {
            type: 'paragraph',
            text: 'In event days mode, the **General** panel lists your **Competition dates** — the actual days your tournament runs. Each date gets its own courts and schedule, and divisions are assigned to a date.',
          },
          {
            type: 'paragraph',
            text: 'In multi-week league mode you set a **Competition window** instead: the first and last date of the season. Which days inside that window are playable is configured per venue on the Schedule panel.',
          },
        ],
      },
      {
        heading: 'Venues',
        blocks: [
          {
            type: 'paragraph',
            text: 'Add the locations you play at in the **Venues** section of the General panel. Start typing an address and pick from the suggestions — the lookup is powered by OpenStreetMap and works worldwide.',
          },
          {
            type: 'list',
            items: [
              'Each venue has a name (e.g. "Main Sports Centre") and an address.',
              'In **multi-week league** mode, each venue also carries its scheduling setup — opening hours, number of courts or pitches, and playable weekdays — which you manage on the **Schedule** panel where you plan fixtures.',
              'In **event days** mode, courts and their operating hours are set per competition date on the Schedule panel.',
            ],
          },
          {
            type: 'tip',
            text: 'Team home grounds can also be recorded on each team (with the same address lookup) — useful reference information for league play.',
          },
        ],
      },
    ],
  },
  {
    slug: 'divisions',
    title: 'Creating divisions',
    summary: 'Divisions are independent competitions inside your tournament — each with its own teams, format, and standings.',
    category: 'getting-started',
    panel: 'age-groups',
    youtubeUrl: null,
    relatedSlugs: ['teams', 'choose-format', 'scheduling-modes'],
    sections: [
      {
        heading: 'What a division is',
        blocks: [
          {
            type: 'paragraph',
            text: 'A **division** is a competition stream within your tournament — for example "Under 11", "Mixed Open", or "Division 2". Teams in one division never play teams in another, and every division has its own format and standings.',
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-divisions-list.png',
              alt: 'The Divisions panel listing divisions with team and format actions',
              caption: 'The Divisions panel — each card is an independent competition.',
            },
          },
        ],
      },
      {
        heading: 'Adding a division',
        blocks: [
          {
            type: 'steps',
            items: [
              'Open the **Divisions** panel and choose **Add division**.',
              'Give it a name and (in event days mode) pick which competition date it plays on. In multi-week league mode there is no day to pick — fixtures are placed across the season instead.',
              'Use **Add/Edit Teams** on the division card to enter its teams.',
              'Open the division\'s **Format** to choose how it plays — see the format guide for details.',
            ],
          },
          {
            type: 'warning',
            title: 'New divisions start empty',
            text: 'A new division has no format until you apply one. Teams will not appear in public standings until they are part of a format (assigned to a pool or league table).',
          },
        ],
      },
    ],
  },
  {
    slug: 'teams',
    title: 'Adding teams and players',
    summary: 'Enter teams manually, give them colours and logos, and optionally record squads.',
    category: 'getting-started',
    panel: 'age-groups',
    youtubeUrl: null,
    relatedSlugs: ['divisions', 'import-export', 'choose-format'],
    sections: [
      {
        heading: 'Adding teams to a division',
        blocks: [
          {
            type: 'paragraph',
            text: 'Teams belong to a division. From the **Divisions** panel, choose **Add/Edit Teams** on a division to manage its team list.',
          },
          {
            type: 'list',
            items: [
              'Each team has a **name**, an optional **short name** (used where space is tight), a **colour**, and an optional **logo**.',
              'Teams can record a **home venue** name and address — handy for leagues. Address lookup helps you fill it accurately.',
              'You can also record **players** per team to keep squad lists with the tournament.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-teams-list.png',
              alt: 'The team list for a division with add and edit controls',
              caption: 'Managing teams inside a division.',
            },
          },
          {
            type: 'tip',
            title: 'Lots of teams?',
            text: 'Use the Bulk Import panel to paste divisions, teams, and players from a spreadsheet as CSV — see the imports guide.',
          },
        ],
      },
      {
        heading: 'Placeholder teams',
        blocks: [
          {
            type: 'paragraph',
            text: 'If you set up a format before entries are confirmed, the format wizard can create **placeholder teams** ("Team 1", "Team 2", …) so fixtures exist early. Rename them to the real club names as entries arrive — results and fixtures stay attached.',
          },
        ],
      },
    ],
  },

  // ── Structure & fixtures ──────────────────────────────────────────────────
  {
    slug: 'choose-format',
    title: 'Choosing a format (Structure Wizard)',
    summary: 'Apply a competition format to a division: round robin, pools, knockouts, leagues, and combinations.',
    category: 'structure-fixtures',
    panel: 'age-groups',
    youtubeUrl: null,
    relatedSlugs: ['advanced-structure', 'fixtures', 'scoring'],
    sections: [
      {
        heading: 'The Structure Wizard',
        blocks: [
          {
            type: 'paragraph',
            text: 'Open a division\'s **Format** page and the Structure Wizard walks you through applying a format template in up to four steps: **Template → Configure → Teams → Review**.',
          },
          {
            type: 'steps',
            items: [
              '**Template** — pick the shape of the competition: a simple round robin, pools feeding a knockout, a straight knockout bracket, a league (including home-and-away), and more.',
              '**Configure** — set the template\'s options, such as number of pools or teams per pool. (This step is skipped when the only option is team count.)',
              '**Teams** — confirm how many teams will play, or type real team names (one per line). If the division already has teams, they are used automatically.',
              '**Review** — check the preview, then confirm. Tournamate builds the phases, pools, and bracket slots, and generates the fixtures.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-structure-template-picker.png',
              alt: 'The Structure Wizard template picker showing format options',
              caption: 'Step 1 — choose a format template.',
            },
          },
        ],
      },
      {
        heading: 'Multi-stage formats and progression',
        blocks: [
          {
            type: 'paragraph',
            text: 'Formats can chain stages — for example a group stage followed by semi-finals and a final. **Progression rules** carry teams forward automatically: "1st in Pool A" or "Winner of Semi-final 1" resolve to real teams as soon as the qualifying results are entered. You never have to move winners by hand.',
          },
          {
            type: 'tip',
            title: 'Byes',
            text: 'With an odd number of teams in a knockout, use a bye slot — the opposing team advances automatically.',
          },
          {
            type: 'warning',
            title: 'Changing format later',
            text: 'Re-applying a format replaces the division\'s structure and fixtures. Take a snapshot first if results have already been entered.',
          },
        ],
      },
    ],
  },
  {
    slug: 'advanced-structure',
    title: 'Advanced structure editing',
    summary: 'Fine-tune phases, pools, bracket slots, and progression rules beyond the wizard templates.',
    category: 'structure-fixtures',
    panel: 'age-groups',
    youtubeUrl: null,
    relatedSlugs: ['choose-format', 'fixtures', 'scoring'],
    sections: [
      {
        heading: 'When the wizard isn\'t enough',
        blocks: [
          {
            type: 'paragraph',
            text: 'The advanced structure editor on the division Format page lets you edit the structure directly: add or reorder **phases** (stages of the competition), manage **pools**, and edit the **slots** that feed brackets.',
          },
          {
            type: 'list',
            items: [
              'A **phase** is one stage — a round robin, group stage, knockout round, league, or friendlies. A division can chain several phases in order.',
              'Each **knockout round is its own phase** (quarter-finals, semi-finals, final), shown as one column of the public bracket.',
              '**Slots** define who plays in a bracket or later stage: a fixed team, a source like "1st in Pool A" or "Winner of match 12", a bye, or a placeholder to fill in later.',
              '**Progression rules** connect stages, so finishing positions and match winners flow into the next phase automatically.',
            ],
          },
          {
            type: 'tip',
            title: 'Drag and drop',
            text: 'Pool team assignment and bracket editing support drag-and-drop — drag a team into a pool, or rearrange entrants between slots.',
          },
        ],
      },
    ],
  },
  {
    slug: 'scoring',
    title: 'Configuring scoring systems',
    summary: 'Points for wins and draws, bonus points, forfeit handling, and tie-breakers — fully configurable.',
    category: 'structure-fixtures',
    panel: 'scoring',
    youtubeUrl: null,
    relatedSlugs: ['choose-format', 'enter-scores', 'fixtures'],
    sections: [
      {
        heading: 'How standings points work',
        blocks: [
          {
            type: 'paragraph',
            text: 'Points are never hard-coded. A **scoring system** defines what a win, draw, and loss are worth, optional bonus points, how forfeits are scored, and the **tie-breaker order** used to rank level teams. Create and edit systems in the **Scoring** panel, then attach one to a phase (preferred) or a whole division.',
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-scoring-systems.png',
              alt: 'The Scoring Systems panel listing configurable scoring systems',
              caption: 'The Scoring panel — each system is reusable across phases.',
            },
          },
        ],
      },
      {
        heading: 'The built-in default',
        blocks: [
          {
            type: 'paragraph',
            text: 'If no scoring system is attached, Tournamate falls back to its netball default: **win 5, draw 3, loss 0**, plus **1 losing bonus point** when the loser scores more than half the winner\'s score. Default tie-breakers: head-to-head, then goal difference, then goals for.',
          },
          {
            type: 'list',
            items: [
              'Tie-breakers are an ordered list you can rearrange per system.',
              'Forfeits award the win (and a notional score) according to the system\'s forfeit settings.',
              'Standings are always recalculated live from completed results — there is nothing to refresh manually.',
            ],
          },
          {
            type: 'tip',
            title: 'Different rules per stage',
            text: 'Attach different systems to different phases — e.g. bonus points during the league stage but not in finals.',
          },
        ],
      },
    ],
  },
  {
    slug: 'fixtures',
    title: 'Generating fixtures',
    summary: 'Fixtures come from your format — generate them, then schedule and fine-tune.',
    category: 'structure-fixtures',
    panel: 'age-groups',
    youtubeUrl: null,
    relatedSlugs: ['choose-format', 'schedule-event-day', 'multi-week-league'],
    sections: [
      {
        heading: 'Where fixtures come from',
        blocks: [
          {
            type: 'paragraph',
            text: 'Fixtures are generated from the division\'s structure: every pool produces its round-robin matches (home-and-away leagues produce both legs), and every bracket produces its ties. The Structure Wizard generates fixtures automatically when you confirm a format.',
          },
          {
            type: 'list',
            items: [
              'Fixtures start **unscheduled** — they exist, but have no date, time, or court until you plan them on the Schedule panel.',
              'Knockout fixtures whose entrants aren\'t known yet show labels like **"Winner of Semi-final 1"** until results decide them.',
              'In the **Match Entry** panel, the **Matrix** view shows a team-by-team grid of fixtures — a quick way to verify everyone plays the right opponents.',
            ],
          },
          {
            type: 'tip',
            title: 'Round order',
            text: 'League and round-robin fixtures carry a round number, and the scheduler lists unplanned fixtures in round order so early rounds get scheduled first.',
          },
        ],
      },
    ],
  },

  // ── Scheduling ────────────────────────────────────────────────────────────
  {
    slug: 'schedule-event-day',
    title: 'Scheduling an event day',
    summary: 'Courts, time slots, auto-plan, and non-match events for tournaments played on set dates.',
    category: 'scheduling',
    panel: 'schedule',
    youtubeUrl: null,
    relatedSlugs: ['dates-and-venues', 'multi-week-league', 'fixtures'],
    sections: [
      {
        heading: 'Courts and the day plan',
        blocks: [
          {
            type: 'paragraph',
            text: 'In event days mode, the **Schedule** panel plans each competition date. Set up your **courts** for the day — names and operating hours — then place fixtures into time slots.',
          },
          {
            type: 'list',
            items: [
              '**Unplanned fixtures** are listed ready to be placed.',
              '**Auto-plan** packs unplanned fixtures into available court time for you, respecting match length and breaks — usually the fastest way to build a first draft.',
              'Non-match blocks like **lunch breaks or presentations** can be added as schedule events so no fixtures land in them.',
              'The schedule can be exported to Excel for printing or sharing.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-schedule-event-day.png',
              alt: 'The event-day Schedule panel with courts and planned fixtures',
              caption: 'Planning courts and time slots for a competition date.',
            },
          },
        ],
      },
      {
        heading: 'Good scheduling habits',
        blocks: [
          {
            type: 'list',
            items: [
              'Schedule pool matches before knockout matches — knockout entrants depend on pool results.',
              'Leave changeover time between matches on the same court.',
              'Check the Match Entry panel\'s status strip: it shows how many fixtures are still unscheduled or missing a court.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'multi-week-league',
    title: 'Running a multi-week league',
    summary: 'The calendar-based league planner: venue hours and courts, drag-and-drop scheduling, auto-plan, and fine-tuning.',
    category: 'scheduling',
    panel: 'schedule',
    youtubeUrl: null,
    relatedSlugs: ['scheduling-modes', 'dates-and-venues', 'fixtures', 'schedule-event-day'],
    sections: [
      {
        heading: 'Before you start',
        blocks: [
          {
            type: 'steps',
            items: [
              'In the **General** panel, set **Scheduling mode** to multi-week league and set the **Competition window** — the first and last dates of your season.',
              'Create your divisions and apply a league format (e.g. round robin or home-and-away) so fixtures exist.',
              'Open the **Schedule** panel — in this mode it is a calendar-based league planner.',
            ],
          },
        ],
      },
      {
        heading: 'Venue availability, courts, and playable days',
        blocks: [
          {
            type: 'paragraph',
            text: 'The planner\'s venue settings control where fixtures can go. For each venue, set:',
          },
          {
            type: 'list',
            items: [
              '**Available from / to** — the hours the venue is open for matches (e.g. 18:00–22:00 for a midweek league night).',
              '**Courts / pitches** — how many matches can run at the same time at that venue.',
              '**Playable days** — which weekdays this venue hosts matches. Days no venue plays on are greyed out on the calendar.',
            ],
          },
          {
            type: 'paragraph',
            text: 'You can also set a **minimum gap between games**, so back-to-back matches on the same court get changeover time. The **planning summary** shows your total fixtures, how many are planned, and the number of potential slots your venues offer — if slots are short, add courts, extend hours, or add playable days.',
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-schedule-multi-week-venues.png',
              alt: 'Venue scheduling settings with hours, court count, and playable weekdays',
              caption: 'Each venue\'s hours, courts, and playable days drive the calendar.',
            },
          },
        ],
      },
      {
        heading: 'Planning fixtures on the calendar',
        blocks: [
          {
            type: 'paragraph',
            text: 'The calendar shows your competition window month by month. Unplanned fixtures sit in a tray, listed in round order.',
          },
          {
            type: 'list',
            items: [
              '**Drag a fixture onto a day** — it is given the earliest free slot at an open venue that day, respecting courts, hours, and the minimum gap.',
              '**Auto-plan** places every unplanned fixture into the earliest available slots across the season, keeping rounds in order.',
              'Changes are **staged first** — nothing is saved until you press **Confirm**. You can discard staged changes and start again.',
              '**Click a planned fixture** to fine-tune it: change its date, time, venue, or court.',
              '**Unplan all** clears every scheduled fixture back to the tray after a confirmation — matches that have already been played are never unscheduled.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-schedule-multi-week-calendar.png',
              alt: 'The multi-week league calendar with planned fixtures and the unplanned tray',
              caption: 'Drag fixtures from the tray onto playable days, then Confirm.',
            },
          },
        ],
      },
      {
        heading: 'Leagues with finals',
        blocks: [
          {
            type: 'paragraph',
            text: 'If your league ends with knockout finals, plan each phase separately using the phase selector. Knockout fixtures can only be placed on dates **after the league fixtures finish**, and the league\'s planned matches stay visible (greyed out) while you plan the knockout so you can see the whole season.',
          },
          {
            type: 'tip',
            title: 'Sanity-check with the summary',
            text: 'Before auto-planning, compare "fixtures to plan" with "potential slots" in the planning summary. If fixtures outnumber slots, planning cannot fit everything — widen the window or add capacity first.',
          },
        ],
      },
    ],
  },

  // ── Match day ─────────────────────────────────────────────────────────────
  {
    slug: 'enter-scores',
    title: 'Entering scores',
    summary: 'The Match Entry panel is your live command centre — scores update standings instantly.',
    category: 'match-day',
    panel: 'match-entry',
    youtubeUrl: null,
    relatedSlugs: ['qr-capture', 'scorecards', 'scoring', 'match-day-troubleshooting'],
    sections: [
      {
        heading: 'The Match Entry panel',
        blocks: [
          {
            type: 'paragraph',
            text: 'Pick the day and division using the tabs, then work through the match list. The status strip at the top shows live counts: **Unscheduled**, **No court**, **Results in**, and **No officials** — your at-a-glance health check during the event.',
          },
          {
            type: 'steps',
            items: [
              'Click a match to open the score form.',
              'Enter the final score for each side and save. Standings recalculate **instantly** using the attached scoring system.',
              'Use the form\'s extra options to record a **late start**, **no-show, or forfeit** where needed — forfeits feed the standings according to your scoring system\'s forfeit rules.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-match-entry-list.png',
              alt: 'The Match Entry panel showing the day\'s match list and status strip',
              caption: 'Match Entry — the live operations view.',
            },
          },
        ],
      },
      {
        heading: 'When results decide later rounds',
        blocks: [
          {
            type: 'paragraph',
            text: 'As pool and league results complete, progression rules resolve bracket placeholders automatically — "Winner of Semi-final 1" becomes the real team the moment the semi-final is saved. If you correct a score later, downstream placeholders update with it.',
          },
          {
            type: 'tip',
            title: 'Snapshot at key moments',
            text: 'Take a snapshot before starting a new phase (e.g. "End of pools"). If a result is disputed, you can restore the division to that exact point.',
          },
        ],
      },
    ],
  },
  {
    slug: 'qr-capture',
    title: 'QR score capture',
    summary: 'Capture scores court-side from a phone using per-match QR codes and short links.',
    category: 'match-day',
    panel: 'match-entry',
    youtubeUrl: null,
    relatedSlugs: ['enter-scores', 'scorecards'],
    sections: [
      {
        heading: 'How it works',
        blocks: [
          {
            type: 'paragraph',
            text: 'Every match has its own QR code and short link that open a dedicated score capture page. Print them on the scorecards, or display them court-side — scorers scan the code on a phone and submit the score from where they stand.',
          },
          {
            type: 'list',
            items: [
              'The admin sidebar\'s **Scan QR** opens a camera scanner, so you can jump straight to a match\'s capture page from a printed code.',
              'Capture pages live under the admin console, so the device must be signed in to an approved organiser account — hand scorers a signed-in tournament device, or keep capture to your admin team.',
              'Scores submitted via capture update standings exactly like scores entered in Match Entry.',
            ],
          },
          {
            type: 'tip',
            title: 'Pair with printed scorecards',
            text: 'The printable scorecards include each match\'s QR code, so the paper record and the digital entry point travel together.',
          },
        ],
      },
    ],
  },
  {
    slug: 'scorecards',
    title: 'Printing scorecards',
    summary: 'Print per-match scorecards with QR codes for court-side score keeping.',
    category: 'match-day',
    panel: 'match-entry',
    youtubeUrl: null,
    relatedSlugs: ['qr-capture', 'enter-scores'],
    sections: [
      {
        heading: 'Printable scorecards',
        blocks: [
          {
            type: 'paragraph',
            text: 'Tournamate generates printable scorecards for a day\'s fixtures — one card per match, including the teams, scheduled time and court, space for the score, and the match\'s **QR code** for digital capture.',
          },
          {
            type: 'steps',
            items: [
              'Plan your schedule first, so each card carries the right time and court.',
              'Open the scorecards page for the day and use the print bar to print the set (or save as PDF from your browser\'s print dialog).',
              'Hand cards to scorers or pin them court-side; completed cards become your paper audit trail.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'public-pages',
    title: 'Publishing and checking public pages',
    summary: 'What spectators see: the tournament hub, standings, fixtures, results, and brackets.',
    category: 'match-day',
    panel: 'general',
    youtubeUrl: null,
    relatedSlugs: ['create-tournament', 'enter-scores', 'match-day-troubleshooting'],
    sections: [
      {
        heading: 'Your public site',
        blocks: [
          {
            type: 'paragraph',
            text: 'Every tournament has a public page at your slug (e.g. `tournamate.uk/spring-league-2026`) — no login needed. Spectators get an info hub with **teams, standings, schedule, and results**, plus per-division pages with fixtures, completed results, and knockout brackets.',
          },
          {
            type: 'list',
            items: [
              'Tournaments set to **Live** are featured on the public Explore page; **Upcoming** tournaments show as coming soon.',
              'Standings, results, and bracket progress update in real time as you save scores — nothing to publish manually.',
              'Public pages are designed mobile-first, so links shared in team group chats work well on phones.',
            ],
          },
          {
            type: 'tip',
            title: 'Before going live',
            text: 'Open your public page on a phone and check each division\'s standings and fixtures look right. Share the link or a QR code of it with clubs once you\'re happy.',
          },
        ],
      },
    ],
  },
  {
    slug: 'match-day-troubleshooting',
    title: 'Match-day troubleshooting',
    summary: 'Quick fixes for the most common "why isn\'t this working?" moments.',
    category: 'match-day',
    panel: 'help',
    youtubeUrl: null,
    relatedSlugs: ['enter-scores', 'snapshots', 'choose-format'],
    sections: [
      {
        heading: 'Common questions',
        blocks: [
          {
            type: 'list',
            items: [
              '**Standings look wrong or empty** — standings only count **completed** matches. Check the scores were saved, and that the right scoring system is attached to the phase.',
              '**A team is missing from the table** — the team must be assigned to a pool or league table in the division\'s format. Check the Format page\'s pool assignments.',
              '**A bracket still shows "Winner of…"** — the feeding match isn\'t completed yet, or its result was saved in a different phase. Complete the source match and the slot resolves automatically.',
              '**A fixture has no time or court** — it is generated but unscheduled. Place it on the Schedule panel; the Match Entry status strip counts these for you.',
              '**I was signed out** — admin sessions sign out automatically after **10 minutes of inactivity** for security. Sign back in and continue; nothing is lost.',
              '**I made a mistake in lots of scores** — restore from a snapshot if you took one at the right moment, or correct the individual results; standings always recalculate.',
            ],
          },
          {
            type: 'tip',
            title: 'Concierge support',
            text: 'During supported pilots, your Tournamate contact can help live on match days — don\'t hesitate to get in touch.',
          },
        ],
      },
    ],
  },

  // ── People & officiating ──────────────────────────────────────────────────
  {
    slug: 'officiating',
    title: 'Officials: registries, rosters and assignments',
    summary: 'Register umpires and clubs once, build a tournament roster, and assign officials to matches.',
    category: 'people-officiating',
    panel: 'officiating',
    youtubeUrl: null,
    relatedSlugs: ['enter-scores', 'import-export'],
    sections: [
      {
        heading: 'Three layers',
        blocks: [
          {
            type: 'steps',
            items: [
              '**Clubs Registry & Global Umpires Registry** — register clubs and umpires once; they are saved to your account and reusable across all your tournaments.',
              '**Tournament Officials** — pick from the registry to build this tournament\'s roster of available officials.',
              '**Match assignments** — in Match Entry, open a fixture\'s officials dialog (the whistle icon) and assign roles for that match.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-officiating.png',
              alt: 'The Officiating panel with registries and tournament roster',
              caption: 'The Officiating panel — registries on top, tournament roster below.',
            },
          },
        ],
      },
      {
        heading: 'Match-day rules and payouts',
        blocks: [
          {
            type: 'list',
            items: [
              'The Match Entry status strip shows how many scheduled matches still have **no officials** assigned.',
              'If your competition penalises a team for failing to provide an umpire, use the **umpire no-show** option in the score form — the penalty flows into standings via your scoring system.',
              'Umpire **payouts** can be tracked per tournament, so you can settle up accurately after the event.',
            ],
          },
        ],
      },
    ],
  },

  // ── Data & admin ──────────────────────────────────────────────────────────
  {
    slug: 'import-export',
    title: 'Imports and exports',
    summary: 'Bulk-load divisions, teams, and players from CSV; export schedules to Excel.',
    category: 'data-admin',
    panel: 'import',
    youtubeUrl: null,
    relatedSlugs: ['teams', 'divisions', 'schedule-event-day'],
    sections: [
      {
        heading: 'Bulk import from CSV',
        blocks: [
          {
            type: 'paragraph',
            text: 'The **Bulk Import** panel loads divisions, teams, or players in one go. Pick what you are importing, load the matching **template** to see the expected columns, paste your CSV (the first row must be the header), review the preview, and confirm.',
          },
          {
            type: 'steps',
            items: [
              'Choose the import type: divisions, teams, or players.',
              'Click the template button to load example CSV showing the exact columns.',
              'Prepare your data in a spreadsheet, copy it as CSV, and paste it in.',
              'Fix anything flagged in the preview (e.g. a team pointing at a division that doesn\'t exist), then confirm the import.',
            ],
          },
          {
            type: 'screenshot',
            screenshot: {
              file: 'admin-import.png',
              alt: 'The Bulk Import panel with CSV paste area and templates',
              caption: 'Paste CSV, preview, confirm.',
            },
          },
        ],
      },
      {
        heading: 'Exports',
        blocks: [
          {
            type: 'list',
            items: [
              'The Schedule panel can export the day\'s schedule to **Excel** — useful for noticeboards and team packs.',
              'Printable **scorecards** carry the schedule onto paper for court-side use.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'snapshots',
    title: 'Snapshots and backups',
    summary: 'Point-in-time backups of a division\'s matches — your undo button for match day.',
    category: 'data-admin',
    panel: 'snapshots',
    youtubeUrl: null,
    relatedSlugs: ['enter-scores', 'match-day-troubleshooting'],
    sections: [
      {
        heading: 'Taking and restoring snapshots',
        blocks: [
          {
            type: 'paragraph',
            text: 'A **snapshot** captures a division\'s matches at a moment in time, labelled with a reason you choose (e.g. "End of pools"). The **Snapshots** panel lists what you\'ve taken and lets you restore one if something goes wrong.',
          },
          {
            type: 'steps',
            items: [
              'In Match Entry, use the **Snapshot** button below the match list to capture the current division, and give it a clear reason.',
              'Review your snapshots in the **Snapshots** panel.',
              'To roll back, restore the snapshot you want — the division\'s matches return to exactly that state.',
            ],
          },
          {
            type: 'warning',
            title: 'Restores replace current results',
            text: 'Restoring overwrites the division\'s current match data with the snapshot. Anything entered after the snapshot was taken is lost — consider taking a fresh snapshot first.',
          },
          {
            type: 'tip',
            title: 'When to snapshot',
            text: 'Before each new phase, before bulk edits, and before re-applying a format. Snapshots take seconds and have saved many match days.',
          },
        ],
      },
    ],
  },
]
