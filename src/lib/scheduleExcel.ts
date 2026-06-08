import type { AgeGroup, Court, Match, Team, Tournament } from './types'
import { getLondonTimeHHmm, buildIsoFromLondonTime } from './time'

export interface ScheduleImportRow {
  id: string
  court: string | null
  kickoff_time: string | null
  duration_minutes: number
  status: 'scheduled' | 'completed'
  is_planned: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function dayBaseDate(tournament: Tournament, day: string): string | null {
  if (day === 'saturday') return tournament.start_date
  return tournament.end_date ?? tournament.start_date
}

function hhmmToMin(hhmm: string): number {
  const parts = hhmm.slice(0, 5).split(':')
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)
}

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function matchShortId(matchId: string): string {
  return matchId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function extractShortId(cell: string): string | null {
  const m = cell.match(/\[([0-9A-F]{8})\]/i)
  return m ? m[1].toUpperCase() : null
}

// ── Grid sheet builder ────────────────────────────────────────────────────────

function buildGridSheet(
  dayCourts: Court[],
  dayMatches: Match[],
  agById: Map<string, AgeGroup>,
  teamById: Map<string, Team>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  XLSX: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  if (dayCourts.length === 0) return null

  const sorted = [...dayCourts].sort((a, b) => a.display_order - b.display_order)

  const gridStart = Math.min(...sorted.map((c) => hhmmToMin(c.start_time)))
  const gridEnd = Math.max(...sorted.map((c) => hhmmToMin(c.end_time)))
  const SLOT = 5

  const slots: string[] = []
  for (let min = gridStart; min <= gridEnd; min += SLOT) {
    slots.push(minToHHMM(min))
  }

  const courtNames = sorted.map((c) => c.name)

  // "HH:MM|CourtName" → cell label
  const cells = new Map<string, string>()
  for (const m of dayMatches) {
    if (!m.is_planned || !m.court || !m.kickoff_time) continue
    const timeHHMM = getLondonTimeHHmm(m.kickoff_time)
    const ag = agById.get(m.age_group_id)
    const home = m.home_team_id ? teamById.get(m.home_team_id) : null
    const away = m.away_team_id ? teamById.get(m.away_team_id) : null
    if (!ag) continue
    const shortId = matchShortId(m.id)
    const roundLabel = m.round_number != null ? ` R${m.round_number}` : ''
    cells.set(
      `${timeHHMM}|${m.court}`,
      `${ag.name}${roundLabel}: ${home?.name ?? 'TBD'} v ${away?.name ?? 'TBD'} [${shortId}]`,
    )
  }

  const header: unknown[] = ['Time', ...courtNames]
  const rows: unknown[][] = [header]
  for (const slot of slots) {
    const row: unknown[] = [slot]
    for (const court of courtNames) {
      row.push(cells.get(`${slot}|${court}`) ?? '')
    }
    rows.push(row)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 8 }, ...courtNames.map(() => ({ wch: 52 }))]
  // Freeze header row and time column so they stay visible while scrolling
  ws['!views'] = [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }]
  return ws
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Export the full tournament schedule to .xlsx with one flat list sheet and
 * one grid sheet per day. Edit the flat list columns (Court, Time, Duration,
 * Status) or move cells in the grid view, then re-import via the Import button.
 */
export async function exportSchedule(
  tournament: Tournament,
  ageGroups: AgeGroup[],
  matches: Match[],
  teams: Team[],
  courts: Court[],
): Promise<void> {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const agById = new Map(ageGroups.map((ag) => [ag.id, ag]))
  const teamById = new Map(teams.map((t) => [t.id, t]))

  // Instructions sheet
  const instrData = [
    [`${tournament.name} — Schedule Export`],
    [],
    ['HOW TO EDIT AND RE-IMPORT'],
    ['─────────────────────────────────────────────────────────────────────────'],
    ['FLAT LIST SHEETS (Saturday / Sunday)'],
    ['  • Edit ONLY these columns: Court, Time, Duration (min), Status'],
    ['  • Do NOT change: Match ID, Division, Round, Home Team, Away Team'],
    ['  • Time format: HH:MM  (e.g. 09:30, 14:15)  — leave blank = unplanned'],
    ['  • Status: "scheduled"  or  "completed"'],
    [],
    ['GRID SHEETS (Saturday Grid / Sunday Grid)'],
    ['  • Each cell shows one match. Move cells to reschedule:'],
    ['      – Drag: select cell → hover border until 4-way cursor → drag to new slot'],
    ['      – Cut & Paste: Ctrl+X on source cell, Ctrl+V on target cell'],
    ['  • Column = Court,  Row = Kick-off time (5-min slots)'],
    ['  • The [8-char code] at the end of each cell identifies the match — keep it!'],
    ['  • When a grid sheet is present it overrides flat-list Court & Time values.'],
    ['  • Status and Duration are always read from the flat list, not the grid.'],
    [],
    ['Save as .xlsx and upload via the Import Excel button in the admin console.'],
    [],
    ['TIP: You can edit just the flat list, just the grid, or both — the import'],
    ['     merges them correctly.'],
  ]
  const instrWs = XLSX.utils.aoa_to_sheet(instrData)
  instrWs['!cols'] = [{ wch: 78 }]
  XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions')

  for (const day of ['saturday', 'sunday'] as const) {
    const dayAgs = ageGroups.filter((ag) => ag.day === day)
    if (dayAgs.length === 0) continue

    const dayAgIds = new Set(dayAgs.map((ag) => ag.id))
    const dayMatches = matches
      .filter((m) => dayAgIds.has(m.age_group_id) && !m.deleted_at)
      .sort((a, b) => {
        const orderA = agById.get(a.age_group_id)?.display_order ?? 0
        const orderB = agById.get(b.age_group_id)?.display_order ?? 0
        if (orderA !== orderB) return orderA - orderB
        return (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? '')
      })

    if (dayMatches.length === 0) continue

    const dayLabel = day === 'saturday' ? 'Saturday' : 'Sunday'

    // ── Flat list sheet ──────────────────────────────────────────────────────
    const rows = dayMatches.map((m) => ({
      'Match ID': m.id,
      Division: agById.get(m.age_group_id)?.name ?? '',
      'Round': m.round_number ?? '',
      'Home Team': m.home_team_id ? teamById.get(m.home_team_id)?.name ?? '' : 'TBD',
      'Away Team': m.away_team_id ? teamById.get(m.away_team_id)?.name ?? '' : 'TBD',
      'Court': m.court ?? '',
      'Time': m.is_planned && m.kickoff_time ? getLondonTimeHHmm(m.kickoff_time) : '',
      'Duration (min)': m.duration_minutes,
      'Status': m.status,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 38 }, // Match ID
      { wch: 16 }, // Division
      { wch: 7 },  // Round
      { wch: 22 }, // Home Team
      { wch: 22 }, // Away Team
      { wch: 14 }, // Court
      { wch: 8 },  // Time
      { wch: 14 }, // Duration
      { wch: 12 }, // Status
    ]
    XLSX.utils.book_append_sheet(wb, ws, dayLabel)

    // ── Grid sheet ───────────────────────────────────────────────────────────
    const dayCourts = courts.filter((c) => c.day === day)
    const gridWs = buildGridSheet(dayCourts, dayMatches, agById, teamById, XLSX)
    if (gridWs) {
      XLSX.utils.book_append_sheet(wb, gridWs, `${dayLabel} Grid`)
    }
  }

  XLSX.writeFile(wb, `${tournament.name} - Schedule.xlsx`)
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parse an .xlsx schedule file previously exported by exportSchedule.
 *
 * Strategy:
 *  - Grid sheets (e.g. "Saturday Grid") are authoritative for court / time / is_planned.
 *  - Flat list sheets (e.g. "Saturday") are authoritative for status / duration.
 *  - If no grid sheets are present, the flat list drives scheduling too.
 */
export async function parseScheduleImport(
  file: File,
  existingMatches: Match[],
  tournament: Tournament,
  ageGroups: AgeGroup[],
): Promise<ScheduleImportRow[]> {
  const XLSX = await import('xlsx')

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const matchById = new Map(existingMatches.map((m) => [m.id, m]))
  const agById = new Map(ageGroups.map((ag) => [ag.id, ag]))
  const shortIdToMatch = new Map(existingMatches.map((m) => [matchShortId(m.id), m]))

  const errors: string[] = []

  // ── Pass 1: grid sheets → scheduling (court + kickoff_time) ─────────────
  // shortId → { court, kickoff_time }
  const gridScheduling = new Map<string, { court: string; kickoff_time: string }>()
  let hasGridSheets = false

  for (const sheetName of wb.SheetNames) {
    const day =
      sheetName === 'Saturday Grid'
        ? 'saturday'
        : sheetName === 'Sunday Grid'
          ? 'sunday'
          : null
    if (!day) continue
    hasGridSheets = true

    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
    if (!aoa || aoa.length < 2) continue

    const headers = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim())
    const baseDate = day === 'saturday' ? tournament.start_date : (tournament.end_date ?? tournament.start_date)

    for (let ri = 1; ri < aoa.length; ri++) {
      const row = (aoa[ri] ?? []) as unknown[]
      const timeStr = String(row[0] ?? '').trim()
      if (!/^\d{1,2}:\d{2}$/.test(timeStr)) continue

      for (let ci = 1; ci < headers.length; ci++) {
        const cellRaw = String(row[ci] ?? '').trim()
        if (!cellRaw) continue
        const shortId = extractShortId(cellRaw)
        if (!shortId) continue
        const courtName = headers[ci]
        if (!courtName) continue

        if (!baseDate) {
          errors.push(
            `Grid sheet "${sheetName}": cannot resolve date for "${timeStr}" — set tournament start/end date first`,
          )
          continue
        }

        const hhmm = timeStr.length === 4 ? `0${timeStr}` : timeStr
        const kickoffIso = buildIsoFromLondonTime(`${baseDate}T08:00:00.000Z`, hhmm)
        gridScheduling.set(shortId, { court: courtName, kickoff_time: kickoffIso })
      }
    }
  }

  // ── Pass 2: flat list sheets → status + duration (+ scheduling fallback) ─
  interface FlatEntry {
    status: 'scheduled' | 'completed'
    duration: number
    court: string | null
    kickoff_time: string | null
  }
  const flatData = new Map<string, FlatEntry>()
  const seen = new Set<string>()

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Instructions' || sheetName.endsWith(' Grid')) continue
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    for (const row of rows) {
      const matchId = String(row['Match ID'] ?? '').trim()
      if (!matchId) continue

      if (seen.has(matchId)) {
        errors.push(`Duplicate Match ID on sheet "${sheetName}": ${matchId}`)
        continue
      }
      seen.add(matchId)

      const match = matchById.get(matchId)
      if (!match) {
        errors.push(`Unknown Match ID on sheet "${sheetName}": ${matchId}`)
        continue
      }

      const ag = agById.get(match.age_group_id)
      const baseDate = ag ? dayBaseDate(tournament, ag.day) : null

      const courtRaw = String(row['Court'] ?? '').trim()
      const court = courtRaw || null

      const timeRaw = String(row['Time'] ?? '').trim()
      let kickoffIso: string | null = null

      if (timeRaw) {
        if (!/^\d{1,2}:\d{2}$/.test(timeRaw)) {
          errors.push(
            `Sheet "${sheetName}", match ${matchId}: invalid Time "${timeRaw}" — use HH:MM`,
          )
          continue
        }
        if (!baseDate) {
          errors.push(
            `Sheet "${sheetName}", match ${matchId}: cannot resolve date — set tournament start/end date first`,
          )
          continue
        }
        const hhmm = timeRaw.length === 4 ? `0${timeRaw}` : timeRaw
        kickoffIso = buildIsoFromLondonTime(`${baseDate}T08:00:00.000Z`, hhmm)
      }

      const durationRaw = Number(row['Duration (min)'])
      const duration =
        Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : match.duration_minutes

      const statusRaw = String(row['Status'] ?? '').trim().toLowerCase()
      const status: 'scheduled' | 'completed' = statusRaw === 'completed' ? 'completed' : 'scheduled'

      flatData.set(matchId, { status, duration, court, kickoff_time: kickoffIso })
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'))

  // ── Merge ─────────────────────────────────────────────────────────────────
  const updates: ScheduleImportRow[] = []

  // All matches present in the flat list
  for (const matchId of seen) {
    const match = matchById.get(matchId)
    if (!match) continue

    const flat = flatData.get(matchId)!
    const gridEntry = gridScheduling.get(matchShortId(matchId))

    const court = hasGridSheets ? (gridEntry?.court ?? null) : flat.court
    const kickoff_time = hasGridSheets ? (gridEntry?.kickoff_time ?? null) : flat.kickoff_time

    updates.push({
      id: matchId,
      court,
      kickoff_time,
      duration_minutes: flat.duration,
      status: flat.status,
      is_planned: court !== null && kickoff_time !== null,
    })
  }

  // Matches only in the grid (not in flat list) — update scheduling only
  for (const [shortId, { court, kickoff_time }] of gridScheduling) {
    const match = shortIdToMatch.get(shortId)
    if (!match || seen.has(match.id)) continue
    updates.push({
      id: match.id,
      court,
      kickoff_time,
      duration_minutes: match.duration_minutes,
      status: match.status,
      is_planned: true,
    })
  }

  return updates
}
