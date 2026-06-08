import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgeGroup, CompetitionDate, Day, Tournament } from './types'

type CompetitionDateNavItem = CompetitionDate & {
  is_derived: boolean
}

export interface CompetitionDateInput {
  slug?: string
  label: string
  date: string
}

const LEGACY_DAYS: Day[] = ['saturday', 'sunday']

function legacyDate(tournament: Tournament, day: Day): string | null {
  if (day === 'saturday') return tournament.start_date
  return tournament.end_date ?? tournament.start_date
}

function legacyLabel(day: Day): string {
  return day === 'saturday' ? 'Saturday' : 'Sunday'
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function labelForLegacyDay(tournament: Tournament, day: Day): string {
  const date = legacyDate(tournament, day)
  return date ? formatDateLabel(date) : legacyLabel(day)
}

export function legacyDaysForTournament(tournament: Tournament): Day[] {
  if (!tournament.end_date || tournament.end_date === tournament.start_date) {
    return ['saturday']
  }
  return ['saturday', 'sunday']
}

export async function syncLegacyCompetitionDates(
  supabase: SupabaseClient,
  tournament: Tournament
): Promise<{ error?: string }> {
  const days = legacyDaysForTournament(tournament)
  const rows = days.map((day, index) => ({
    tournament_id: tournament.id,
    slug: day,
    label: labelForLegacyDay(tournament, day),
    date: legacyDate(tournament, day),
    display_order: index + 1,
    legacy_day: day,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('competition_dates')
      .upsert(rows, { onConflict: 'tournament_id,slug' })
    if (error) return { error: error.message }
  }

  const unusedDays = LEGACY_DAYS.filter((day) => !days.includes(day))
  if (unusedDays.length > 0) {
    const { error } = await supabase
      .from('competition_dates')
      .delete()
      .eq('tournament_id', tournament.id)
      .in('legacy_day', unusedDays)
    if (error) return { error: error.message }
  }

  return {}
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base
  let index = 2
  while (used.has(slug)) {
    slug = `${base}-${index}`
    index += 1
  }
  used.add(slug)
  return slug
}

export async function syncTournamentCompetitionDates(
  supabase: SupabaseClient,
  tournamentId: string,
  dates: CompetitionDateInput[]
): Promise<{ error?: string }> {
  const used = new Set<string>()
  const rows = dates.map((date, index) => {
    const baseSlug =
      date.slug && date.slug.trim() !== ''
        ? date.slug.trim()
        : `date-${index + 1}`

    return {
      tournament_id: tournamentId,
      slug: uniqueSlug(baseSlug, used),
      label: date.label.trim() || `Date ${index + 1}`,
      date: date.date,
      display_order: index + 1,
      legacy_day: index === 0 ? 'saturday' : index === 1 ? 'sunday' : null,
    }
  })

  if (rows.length === 0) {
    const { error } = await supabase
      .from('competition_dates')
      .delete()
      .eq('tournament_id', tournamentId)
    return { error: error?.message }
  }

  const { error: upsertError } = await supabase
    .from('competition_dates')
    .upsert(rows, { onConflict: 'tournament_id,slug' })
  if (upsertError) return { error: upsertError.message }

  const { data: existingRows, error: existingError } = await supabase
    .from('competition_dates')
    .select('id, slug')
    .eq('tournament_id', tournamentId)
  if (existingError) return { error: existingError.message }

  const validSlugs = new Set(rows.map((row) => row.slug))
  const deleteIds = ((existingRows ?? []) as { id: string; slug: string }[])
    .filter((row) => !validSlugs.has(row.slug))
    .map((row) => row.id)

  if (deleteIds.length === 0) return {}

  const { error: deleteError } = await supabase
    .from('competition_dates')
    .delete()
    .in('id', deleteIds)

  return { error: deleteError?.message }
}

function deriveLegacyCompetitionDates(
  tournament: Tournament,
  ageGroups: AgeGroup[]
): CompetitionDateNavItem[] {
  const groupDays = new Set(ageGroups.map((g) => g.day))

  return LEGACY_DAYS.filter((day) => groupDays.has(day)).map((day, index) => ({
    id: `legacy-${tournament.id}-${day}`,
    tournament_id: tournament.id,
    slug: day,
    label: legacyLabel(day),
    date: legacyDate(tournament, day),
    display_order: index + 1,
    legacy_day: day,
    created_at: '',
    is_derived: true,
  }))
}

export async function getCompetitionDatesForTournament(
  supabase: SupabaseClient,
  tournament: Tournament,
  ageGroups: AgeGroup[]
): Promise<CompetitionDateNavItem[]> {
  const { data, error } = await supabase
    .from('competition_dates')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('display_order', { ascending: true })
    .order('date', { ascending: true })

  if (error || !data || data.length === 0) {
    return deriveLegacyCompetitionDates(tournament, ageGroups)
  }

  return (data as CompetitionDate[]).map((row) => ({
    ...row,
    is_derived: false,
  }))
}

export function dateSlugForLegacyDay(
  dates: CompetitionDateNavItem[],
  day: Day
): string {
  return dates.find((d) => d.legacy_day === day)?.slug ?? day
}

export function legacyDayForDateSlug(
  dates: CompetitionDateNavItem[],
  slug: string
): Day | null {
  return dates.find((d) => d.slug === slug)?.legacy_day ?? null
}
