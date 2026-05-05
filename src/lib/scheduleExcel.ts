import type { AgeGroup, Match, Team, Tournament } from './types'
import { getLondonTimeHHmm, buildIsoFromLondonTime } from './time'

export interface ScheduleImportRow {
  id: string
  court: string | null
  kickoff_time: string | null
  duration_minutes: number
  status: 'scheduled' | 'completed'
  is_planned: boolean
}

function dayBaseDate(tournament: Tournament, day: string): string | null {
  if (day === 'saturday') return tournament.start_date
  return tournament.end_date ?? tournament.start_date
}

/**
 * Export the full tournament schedule to an .xlsx file with one sheet per day.
 * Only editable columns (Court, Time, Duration, Status) should be changed
 * before re-importing; all other columns are read-only reference data.
 */
export async function exportSchedule(
  tournament: Tournament,
  ageGroups: AgeGroup[],
  matches: Match[],
  teams: Team[],
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
    ['─────────────────────────────────────────────────────────────────────'],
    ['1. Edit ONLY these four columns: Court, Time, Duration (min), Status'],
    ['2. Do NOT change: Match ID, Age Group, Round, Home Team, Away Team'],
    ['3. Time format: HH:MM  (e.g. 09:30, 14:15)  — leave blank = unplanned'],
    ['4. Court: any text matching a configured court name — leave blank = unplanned'],
    ['5. Status: "scheduled"  or  "completed"'],
    ['6. A match is placed on the schedule when BOTH Court AND Time are filled in.'],
    ['7. Save as .xlsx and upload via the Import Excel button in the admin console.'],
    [],
    ['TIP: You only need to edit the relevant day sheet — the other can be ignored.'],
  ]
  const instrWs = XLSX.utils.aoa_to_sheet(instrData)
  instrWs['!cols'] = [{ wch: 72 }]
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

    const rows = dayMatches.map((m) => ({
      'Match ID': m.id,
      'Age Group': agById.get(m.age_group_id)?.name ?? '',
      'Round': m.round_number ?? '',
      'Home Team': teamById.get(m.home_team_id)?.name ?? '',
      'Away Team': teamById.get(m.away_team_id)?.name ?? '',
      'Court': m.court ?? '',
      'Time': m.is_planned && m.kickoff_time ? getLondonTimeHHmm(m.kickoff_time) : '',
      'Duration (min)': m.duration_minutes,
      'Status': m.status,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 38 }, // Match ID
      { wch: 16 }, // Age Group
      { wch: 7  }, // Round
      { wch: 22 }, // Home Team
      { wch: 22 }, // Away Team
      { wch: 14 }, // Court
      { wch: 8  }, // Time
      { wch: 14 }, // Duration
      { wch: 12 }, // Status
    ]

    XLSX.utils.book_append_sheet(wb, ws, day === 'saturday' ? 'Saturday' : 'Sunday')
  }

  XLSX.writeFile(wb, `${tournament.name} - Schedule.xlsx`)
}

/**
 * Parse an .xlsx schedule file previously exported by exportSchedule.
 * Returns the list of updates to apply; throws on validation errors.
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

  const updates: ScheduleImportRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Instructions') continue
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
        Number.isFinite(durationRaw) && durationRaw > 0
          ? durationRaw
          : match.duration_minutes

      const statusRaw = String(row['Status'] ?? '').trim().toLowerCase()
      const status: 'scheduled' | 'completed' =
        statusRaw === 'completed' ? 'completed' : 'scheduled'

      updates.push({
        id: matchId,
        court,
        kickoff_time: kickoffIso,
        duration_minutes: duration,
        status,
        is_planned: court !== null && kickoffIso !== null,
      })
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return updates
}
