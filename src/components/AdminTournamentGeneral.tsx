'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import HelpPrompt from '@/components/help/HelpPrompt'
import TournamentBrandingImageField from '@/components/TournamentBrandingImageField'
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  normalizeBrandPrimaryColor,
  normalizePublicUrl,
} from '@/lib/branding'
import {
  type CompetitionDateInput,
  syncTournamentCompetitionDates,
} from '@/lib/competitionDates'
import { createClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import {
  SPORTS,
  type CompetitionDate,
  type ScoringSystem,
  type Sport,
  type Tournament,
  type TournamentScheduleMode,
  type TournamentVenue,
} from '@/lib/types'

interface AdminTournamentGeneralProps {
  tournament: Tournament
  onTournamentChanged: () => void
}

interface DateRow {
  key: string
  slug?: string
  label: string
  date: string
}

interface VenueRow {
  key: string
  id?: string
  name: string
  address_line1: string
  address_line2: string
  city: string
  county: string
  postcode: string
  country: string
  notes: string
}

interface BrandingState {
  logo_url: string
  brand_primary_color: string
  sponsor_name: string
  sponsor_logo_url: string
  sponsor_url: string
}

function formatDateLabel(date: string): string {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function initialDateRows(tournament: Tournament): DateRow[] {
  if (!tournament.start_date) {
    return [{ key: crypto.randomUUID(), label: '', date: '' }]
  }

  if (!tournament.end_date || tournament.end_date === tournament.start_date) {
    return [
      {
        key: crypto.randomUUID(),
        slug: 'saturday',
        label: formatDateLabel(tournament.start_date),
        date: tournament.start_date,
      },
    ]
  }

  return [
    {
      key: crypto.randomUUID(),
      slug: 'saturday',
      label: formatDateLabel(tournament.start_date),
      date: tournament.start_date,
    },
    {
      key: crypto.randomUUID(),
      slug: 'sunday',
      label: formatDateLabel(tournament.end_date),
      date: tournament.end_date,
    },
  ]
}

function emptyVenueRow(): VenueRow {
  return {
    key: crypto.randomUUID(),
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    notes: '',
  }
}

function summaryDates(rows: DateRow[]) {
  const sortedDates = rows
    .map((row) => row.date)
    .filter(Boolean)
    .sort()

  return {
    start_date: sortedDates[0] ?? null,
    end_date: sortedDates[sortedDates.length - 1] ?? null,
  }
}

function cleanText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export default function AdminTournamentGeneral({
  tournament,
  onTournamentChanged,
}: AdminTournamentGeneralProps) {
  const supabase = useMemo(() => createClient(), [])

  const [name, setName] = useState(tournament.name)
  const [slug, setSlug] = useState(tournament.slug)
  const [slugTouched, setSlugTouched] = useState(true)
  const [sport, setSport] = useState<Sport>(
    SPORTS.includes(tournament.sport as Sport)
      ? (tournament.sport as Sport)
      : 'Netball'
  )
  const [sportOther, setSportOther] = useState(tournament.sport_other ?? '')
  const [defaultScoringSystemId, setDefaultScoringSystemId] = useState(
    tournament.default_scoring_system_id ?? ''
  )
  const [scheduleMode, setScheduleMode] = useState<TournamentScheduleMode>(
    tournament.schedule_mode ?? 'event_day'
  )
  const [publicInfo, setPublicInfo] = useState({
    organiser_contact_name: tournament.organiser_contact_name ?? '',
    organiser_contact_email: tournament.organiser_contact_email ?? '',
    organiser_contact_phone: tournament.organiser_contact_phone ?? '',
    arrival_instructions: tournament.arrival_instructions ?? '',
    parking_notes: tournament.parking_notes ?? '',
    venue_notes: tournament.venue_notes ?? '',
    facilities_notes: tournament.facilities_notes ?? '',
    emergency_contact: tournament.emergency_contact ?? '',
    public_notice: tournament.public_notice ?? '',
  })
  const [branding, setBranding] = useState<BrandingState>({
    logo_url: tournament.logo_url ?? '',
    brand_primary_color: tournament.brand_primary_color ?? '',
    sponsor_name: tournament.sponsor_name ?? '',
    sponsor_logo_url: tournament.sponsor_logo_url ?? '',
    sponsor_url: tournament.sponsor_url ?? '',
  })
  const [scoringSystems, setScoringSystems] = useState<ScoringSystem[]>([])
  const [dateRows, setDateRows] = useState<DateRow[]>(() =>
    initialDateRows(tournament)
  )
  const [windowStart, setWindowStart] = useState(tournament.start_date ?? '')
  const [windowEnd, setWindowEnd] = useState(
    tournament.end_date ?? tournament.start_date ?? ''
  )
  const [venueRows, setVenueRows] = useState<VenueRow[]>(() => {
    if (tournament.venue_name) {
      return [
        {
          ...emptyVenueRow(),
          name: tournament.venue_name,
          city: tournament.venue_city ?? '',
          county: tournament.venue_county ?? '',
          postcode: tournament.venue_postcode ?? '',
        },
      ]
    }
    return [emptyVenueRow()]
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadGeneralData() {
      setLoading(true)
      const [datesRes, venuesRes, scoringRes] = await Promise.all([
        supabase
          .from('competition_dates')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('display_order', { ascending: true })
          .order('date', { ascending: true }),
        supabase
          .from('tournament_venues')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('display_order', { ascending: true }),
        supabase.from('scoring_systems').select('*').order('name'),
      ])

      if (cancelled) return

      if (!datesRes.error) {
        const dates = (datesRes.data ?? []) as CompetitionDate[]
        if (dates.length > 0) {
          setDateRows(
            dates.map((row) => ({
              key: row.id,
              slug: row.slug,
              label: row.label,
              date: row.date ?? '',
            }))
          )
        }
      } else {
        toast.error(`Could not load dates: ${datesRes.error.message}`)
      }

      if (!venuesRes.error) {
        const venues = (venuesRes.data ?? []) as TournamentVenue[]
        if (venues.length > 0) {
          setVenueRows(
            venues.map((venue) => ({
              key: venue.id,
              id: venue.id,
              name: venue.name,
              address_line1: venue.address_line1 ?? '',
              address_line2: venue.address_line2 ?? '',
              city: venue.city ?? '',
              county: venue.county ?? '',
              postcode: venue.postcode ?? '',
              country: venue.country ?? 'United Kingdom',
              notes: venue.notes ?? '',
            }))
          )
        }
      } else {
        toast.error(`Could not load venues: ${venuesRes.error.message}`)
      }

      if (!scoringRes.error) {
        setScoringSystems((scoringRes.data ?? []) as ScoringSystem[])
      } else {
        toast.error(`Could not load scoring systems: ${scoringRes.error.message}`)
      }

      setLoading(false)
    }

    loadGeneralData()

    return () => {
      cancelled = true
    }
  }, [supabase, tournament])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function updateDateRow(key: string, patch: Partial<DateRow>) {
    setDateRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row
        const next = { ...row, ...patch }
        if (patch.date && !row.label.trim()) {
          next.label = formatDateLabel(patch.date)
        }
        return next
      })
    )
  }

  function updateVenueRow(key: string, patch: Partial<VenueRow>) {
    setVenueRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  function updatePublicInfo(field: keyof typeof publicInfo, value: string) {
    setPublicInfo((info) => ({ ...info, [field]: value }))
  }

  function updateBranding(field: keyof BrandingState, value: string) {
    setBranding((current) => ({ ...current, [field]: value }))
  }

  function addDateRow() {
    setDateRows((rows) => [
      ...rows,
      { key: crypto.randomUUID(), label: '', date: '' },
    ])
  }

  function addVenueRow() {
    setVenueRows((rows) => [...rows, emptyVenueRow()])
  }

  function removeDateRow(key: string) {
    setDateRows((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.key !== key)
    )
  }

  function removeVenueRow(key: string) {
    setVenueRows((rows) =>
      rows.length === 1 ? [emptyVenueRow()] : rows.filter((row) => row.key !== key)
    )
  }

  async function syncVenues(rows: VenueRow[]) {
    const existingIds = rows.map((row) => row.id).filter(Boolean) as string[]
    const { data: existing, error: existingError } = await supabase
      .from('tournament_venues')
      .select('id')
      .eq('tournament_id', tournament.id)

    if (existingError) return existingError.message

    const deleteIds = ((existing ?? []) as { id: string }[])
      .map((row) => row.id)
      .filter((id) => !existingIds.includes(id))

    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from('tournament_venues')
        .delete()
        .in('id', deleteIds)
      if (error) return error.message
    }

    const baseFields = (row: VenueRow, index: number) => ({
      tournament_id: tournament.id,
      name: row.name.trim(),
      address_line1: cleanText(row.address_line1),
      address_line2: cleanText(row.address_line2),
      city: cleanText(row.city),
      county: cleanText(row.county),
      postcode: cleanText(row.postcode),
      country: cleanText(row.country),
      notes: cleanText(row.notes),
      display_order: index + 1,
    })

    // Updates (rows with an id) and inserts (new rows) must run separately:
    // a mixed upsert makes PostgREST send an explicit null id for new rows,
    // which violates the not-null primary key instead of using its default.
    const updates = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => Boolean(row.id))
      .map(({ row, index }) => ({ id: row.id as string, ...baseFields(row, index) }))

    const inserts = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.id)
      .map(({ row, index }) => baseFields(row, index))

    if (updates.length > 0) {
      const { error } = await supabase.from('tournament_venues').upsert(updates)
      if (error) return error.message
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from('tournament_venues').insert(inserts)
      if (error) return error.message
    }

    return undefined
  }

  async function applyDefaultScoring(scoringSystemId: string) {
    if (!scoringSystemId) return undefined

    const { data: divisions, error: divisionsError } = await supabase
      .from('age_groups')
      .select('id')
      .eq('tournament_id', tournament.id)

    if (divisionsError) return divisionsError.message

    const divisionIds = ((divisions ?? []) as { id: string }[]).map((d) => d.id)
    if (divisionIds.length === 0) return undefined

    const { error: divisionUpdateError } = await supabase
      .from('age_groups')
      .update({ scoring_system_id: scoringSystemId })
      .eq('tournament_id', tournament.id)
      .is('scoring_system_id', null)

    if (divisionUpdateError) return divisionUpdateError.message

    const { error: phaseUpdateError } = await supabase
      .from('phases')
      .update({ scoring_system_id: scoringSystemId })
      .in('age_group_id', divisionIds)
      .is('scoring_system_id', null)

    return phaseUpdateError?.message
  }

  async function scheduleModeSwitchBlocker(nextMode: TournamentScheduleMode) {
    if (nextMode === (tournament.schedule_mode ?? 'event_day')) return null

    const { data: divisions, error: divisionsError } = await supabase
      .from('age_groups')
      .select('id')
      .eq('tournament_id', tournament.id)

    if (divisionsError) return divisionsError.message

    const divisionIds = ((divisions ?? []) as { id: string }[]).map((division) => division.id)
    if (divisionIds.length === 0) return null

    const { data: scheduledMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id, status, is_planned')
      .in('age_group_id', divisionIds)
      .is('deleted_at', null)
      .or('is_planned.eq.true,status.eq.completed')
      .limit(1)

    if (matchesError) return matchesError.message
    if ((scheduledMatches ?? []).length > 0) {
      return 'This tournament already has planned or completed fixtures. Unplan fixtures and resolve completed results before switching scheduler mode.'
    }

    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id')
      .in('age_group_id', divisionIds)

    if (phasesError) return phasesError.message

    const phaseIds = ((phases ?? []) as { id: string }[]).map((phase) => phase.id)
    if (phaseIds.length === 0) return null

    const { data: settings, error: settingsError } = await supabase
      .from('league_schedule_settings')
      .select('phase_id')
      .in('phase_id', phaseIds)
      .limit(1)

    if (settingsError) return settingsError.message
    if ((settings ?? []).length > 0) {
      return 'This tournament already has multi-week schedule settings. Remove those settings before switching scheduler mode.'
    }

    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      toast.error('Tournament name and slug are required.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error('Slug can only contain lowercase letters, numbers and hyphens.')
      return
    }
    if (sport === 'Other' && !sportOther.trim()) {
      toast.error('Enter the sport name when selecting Other.')
      return
    }
    const brandColorInput = branding.brand_primary_color.trim()
    const normalizedBrandPrimaryColor = brandColorInput
      ? normalizeBrandPrimaryColor(brandColorInput)
      : null
    if (brandColorInput && !normalizedBrandPrimaryColor) {
      toast.error('Brand colour must be a six-digit hex value, for example #f47c20.')
      return
    }

    const normalizedLogoUrl = normalizePublicUrl(branding.logo_url)
    if (branding.logo_url.trim() && !normalizedLogoUrl) {
      toast.error('Tournament logo URL must start with http:// or https://.')
      return
    }

    const normalizedSponsorLogoUrl = normalizePublicUrl(branding.sponsor_logo_url)
    if (branding.sponsor_logo_url.trim() && !normalizedSponsorLogoUrl) {
      toast.error('Sponsor logo URL must start with http:// or https://.')
      return
    }

    const normalizedSponsorUrl = normalizePublicUrl(branding.sponsor_url)
    if (branding.sponsor_url.trim() && !normalizedSponsorUrl) {
      toast.error('Sponsor website URL must start with http:// or https://.')
      return
    }

    // In multi-week mode the organiser sets a single start/end window; the
    // scheduler derives actual play dates from each phase's playable weekdays,
    // so we store only the window and skip per-day competition_dates.
    let summary: { start_date: string | null; end_date: string | null }
    let dateInputs: CompetitionDateInput[]

    if (scheduleMode === 'multi_week') {
      const start = windowStart.trim()
      const end = windowEnd.trim()
      if (!start || !end) {
        toast.error('Set both a start and end date for the competition window.')
        return
      }
      if (end < start) {
        toast.error('The end date must be on or after the start date.')
        return
      }
      summary = { start_date: start, end_date: end }
      dateInputs = []
    } else {
      const validDateRows = dateRows
        .map((row, index) => ({
          ...row,
          label: row.label.trim() || `Date ${index + 1}`,
          date: row.date.trim(),
        }))
        .filter((row) => row.date !== '')

      if (validDateRows.length === 0) {
        toast.error('Add at least one tournament date.')
        return
      }

      const seenDates = new Set<string>()
      for (const row of validDateRows) {
        if (seenDates.has(row.date)) {
          toast.error('Each tournament date must be unique.')
          return
        }
        seenDates.add(row.date)
      }

      const sortedDateRows = [...validDateRows].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      summary = summaryDates(sortedDateRows)
      dateInputs = sortedDateRows.map((row, index) => ({
        slug: row.slug || slugify(row.label) || `date-${index + 1}`,
        label: row.label,
        date: row.date,
      }))
    }

    const validVenueRows = venueRows.filter((row) =>
      [
        row.name,
        row.address_line1,
        row.address_line2,
        row.city,
        row.county,
        row.postcode,
        row.notes,
      ].some((value) => value.trim() !== '')
    )

    if (validVenueRows.some((row) => row.name.trim() === '')) {
      toast.error('Each venue needs a name.')
      return
    }

    setSaving(true)

    const modeBlocker = await scheduleModeSwitchBlocker(scheduleMode)
    if (modeBlocker) {
      setSaving(false)
      toast.error(modeBlocker)
      return
    }

    const { data, error } = await supabase
      .from('tournaments')
      .update({
        name: trimmedName,
        slug: trimmedSlug,
        sport,
        sport_other: sport === 'Other' ? sportOther.trim() : null,
        default_scoring_system_id: defaultScoringSystemId || null,
        schedule_mode: scheduleMode,
        start_date: summary.start_date,
        end_date: summary.end_date,
        organiser_contact_name: cleanText(publicInfo.organiser_contact_name),
        organiser_contact_email: cleanText(publicInfo.organiser_contact_email),
        organiser_contact_phone: cleanText(publicInfo.organiser_contact_phone),
        arrival_instructions: cleanText(publicInfo.arrival_instructions),
        parking_notes: cleanText(publicInfo.parking_notes),
        venue_notes: cleanText(publicInfo.venue_notes),
        facilities_notes: cleanText(publicInfo.facilities_notes),
        emergency_contact: cleanText(publicInfo.emergency_contact),
        public_notice: cleanText(publicInfo.public_notice),
        logo_url: normalizedLogoUrl,
        brand_primary_color: normalizedBrandPrimaryColor,
        sponsor_name: cleanText(branding.sponsor_name),
        sponsor_logo_url: normalizedSponsorLogoUrl,
        sponsor_url: normalizedSponsorUrl,
      })
      .eq('id', tournament.id)
      .select()

    if (error) {
      setSaving(false)
      toast.error(`Could not save general details: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      setSaving(false)
      toast.error('Update blocked by Supabase row-level security.')
      return
    }

    const dateResult = await syncTournamentCompetitionDates(
      supabase,
      tournament.id,
      dateInputs
    )
    if (dateResult.error) {
      setSaving(false)
      toast.error(`General details saved, but dates were not synced: ${dateResult.error}`)
      onTournamentChanged()
      return
    }

    const venueError = await syncVenues(validVenueRows)
    if (venueError) {
      setSaving(false)
      toast.error(`General details saved, but venues were not synced: ${venueError}`)
      onTournamentChanged()
      return
    }

    const scoringError = await applyDefaultScoring(defaultScoringSystemId)
    setSaving(false)

    if (scoringError) {
      toast.error(`Saved, but default scoring was not applied: ${scoringError}`)
      onTournamentChanged()
      return
    }

    toast.success('General details saved')
    onTournamentChanged()
  }

  const brandColorPreview =
    normalizeBrandPrimaryColor(branding.brand_primary_color) ??
    DEFAULT_BRAND_PRIMARY_COLOR

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            General
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Core tournament setup, dates, venues, organisers and default rules.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving || loading}
          className="inline-flex items-center justify-center rounded-md bg-tm-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-tm-navy-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save general'}
        </button>
      </header>

      {/* Setup checklist */}
      {!loading && (
        <section>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Setup checklist
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                {
                  title: 'Tournament details',
                  done: name.trim() !== '' && slug.trim() !== '',
                  pending: false,
                  desc: name.trim() !== '' ? name : 'Name and URL slug needed',
                },
                {
                  title: 'Dates configured',
                  done: dateRows.some((r) => r.date !== ''),
                  pending: false,
                  desc: dateRows.some((r) => r.date !== '')
                    ? `${dateRows.filter((r) => r.date !== '').length} date${dateRows.filter((r) => r.date !== '').length > 1 ? 's' : ''} set`
                    : 'No dates added yet',
                },
                {
                  title: 'Venues configured',
                  done: venueRows.some((r) => r.name.trim() !== ''),
                  pending: false,
                  desc: venueRows.some((r) => r.name.trim() !== '')
                    ? venueRows
                        .filter((r) => r.name.trim() !== '')
                        .map((v) => v.name)
                        .join(', ')
                    : 'No venue added yet',
                },
                {
                  title: 'Public page ready',
                  done:
                    name.trim() !== '' &&
                    slug.trim() !== '' &&
                    dateRows.some((r) => r.date !== ''),
                  pending: false,
                  desc:
                    slug.trim() !== ''
                      ? `/${slug}`
                      : 'Set details and dates first',
                },
                {
                  title: 'Scheduler selected',
                  done: true,
                  pending: false,
                  desc:
                    scheduleMode === 'multi_week'
                      ? 'Multi-week calendar'
                      : 'Event-day court grid',
                },
                {
                  title: 'Organisers invited',
                  done: false,
                  pending: true,
                  desc: 'Organiser invites — coming soon',
                },
              ] as { title: string; done: boolean; pending: boolean; desc: string }[]
            ).map(({ title, done, pending, desc }) => (
              <div
                key={title}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  done
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : pending
                      ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30'
                      : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : pending
                        ? 'border-2 border-zinc-300 text-zinc-300 dark:border-zinc-600 dark:text-zinc-600'
                        : 'bg-amber-400 text-white'
                  }`}
                >
                  {done ? '✓' : pending ? '' : '!'}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      done
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : pending
                          ? 'text-zinc-400 dark:text-zinc-500'
                          : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
          Tournament details
          <HelpPrompt guideSlug="create-tournament" label="tournament details" tip="How the name, slug, status, and branding work" />
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title / name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            URL slug
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sport
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {SPORTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {sport === 'Other' ? (
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Other sport
              <input
                type="text"
                value={sportOther}
                onChange={(e) => setSportOther(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          ) : (
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Default scoring
              <select
                value={defaultScoringSystemId}
                onChange={(e) => setDefaultScoringSystemId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">No default selected</option>
                {scoringSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sport === 'Other' && (
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Default scoring
              <select
                value={defaultScoringSystemId}
                onChange={(e) => setDefaultScoringSystemId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">No default selected</option>
                {scoringSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Branding
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Optional club or tournament branding for public pages and printable scorecards.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TournamentBrandingImageField
            tournamentId={tournament.id}
            kind="logo"
            label="Tournament logo"
            description="Shown in the public page hero and scorecard headers. Use a transparent PNG or SVG-style image where possible."
            value={branding.logo_url}
            onChange={(value) => updateBranding('logo_url', value)}
          />
          <TournamentBrandingImageField
            tournamentId={tournament.id}
            kind="sponsor"
            label="Sponsor logo"
            description="Optional partner mark shown with the sponsor name. Keep it compact so match information stays clear."
            value={branding.sponsor_logo_url}
            onChange={(value) => updateBranding('sponsor_logo_url', value)}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Primary brand colour
              <div className="mt-1 grid grid-cols-[3rem_1fr_auto] gap-2">
                <input
                  type="color"
                  value={brandColorPreview}
                  onChange={(e) => updateBranding('brand_primary_color', e.target.value)}
                  aria-label="Pick primary brand colour"
                  className="h-10 w-12 rounded-md border border-zinc-300 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <input
                  type="text"
                  value={branding.brand_primary_color}
                  onChange={(e) => updateBranding('brand_primary_color', e.target.value)}
                  placeholder="#f47c20"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {branding.brand_primary_color && (
                  <button
                    type="button"
                    onClick={() => updateBranding('brand_primary_color', '')}
                    className="rounded-md px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Used as a restrained accent. Leave blank to use the default TournaMate orange.
            </p>
          </div>

          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Sponsor name
            <input
              type="text"
              value={branding.sponsor_name}
              onChange={(e) => updateBranding('sponsor_name', e.target.value)}
              placeholder="Optional partner name"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 md:col-span-2">
            Sponsor website
            <input
              type="url"
              value={branding.sponsor_url}
              onChange={(e) => updateBranding('sponsor_url', e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
          Scheduling mode
          <HelpPrompt guideSlug="scheduling-modes" label="scheduling modes" tip="Event days vs multi-week league — which to pick" />
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Choose one scheduling model for this tournament. Mixing modes is not available in V1.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              {
                value: 'event_day',
                title: 'Event-day scheduler',
                desc: 'Court grid, day tabs, scorecard printing, and short tournament auto-plan.',
              },
              {
                value: 'multi_week',
                title: 'Multi-week scheduler',
                desc: 'Calendar planning across weeks or months with playable weekdays and venue strategy.',
              },
            ] as { value: TournamentScheduleMode; title: string; desc: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className={[
                'cursor-pointer rounded-lg border p-4 transition-colors',
                scheduleMode === option.value
                  ? 'border-tm-orange bg-orange-50 dark:border-tm-orange dark:bg-orange-950/20'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
              ].join(' ')}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="schedule-mode"
                  value={option.value}
                  checked={scheduleMode === option.value}
                  onChange={() => setScheduleMode(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {option.desc}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
        {scheduleMode !== (tournament.schedule_mode ?? 'event_day') && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            Scheduler mode changes are saved with General details. If fixtures or multi-week settings already exist, Tournamate will block the switch to avoid clashing schedule models.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {scheduleMode === 'multi_week'
                ? 'Competition window'
                : 'Tournament dates'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {scheduleMode === 'multi_week'
                ? 'Set the start and end of the season. The scheduler plans fixtures across this window using each phase’s playable weekdays.'
                : 'Add every date the tournament, festival or league will run on.'}
            </p>
          </div>
          {scheduleMode !== 'multi_week' && (
            <button
              type="button"
              onClick={addDateRow}
              className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Add date
            </button>
          )}
        </div>

        {scheduleMode === 'multi_week' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Start date
              <input
                type="date"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              End date
              <input
                type="date"
                value={windowEnd}
                min={windowStart || undefined}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {dateRows.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-[1fr_1fr_auto]"
              >
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Label
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) =>
                      updateDateRow(row.key, { label: e.target.value })
                    }
                    placeholder={`Date ${index + 1}`}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Date
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      updateDateRow(row.key, { date: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeDateRow(row.key)}
                  disabled={dateRows.length === 1}
                  className="self-end rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
              Venues{' '}
              {scheduleMode === 'multi_week' && (
                <span className="font-normal text-zinc-400">(optional)</span>
              )}
              <HelpPrompt guideSlug="dates-and-venues" label="venues" tip="Adding venues with address lookup" />
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {scheduleMode === 'multi_week'
                ? 'Only needed for fixtures at neutral or shared venues. Home-and-away leagues use each team’s home venue, set on the team.'
                : 'Add one or more locations where this tournament will be hosted.'}
            </p>
          </div>
          <button
            type="button"
            onClick={addVenueRow}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Add venue
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {venueRows.map((venue, index) => (
            <div
              key={venue.key}
              className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Venue {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeVenueRow(venue.key)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              </div>
              <AddressAutocomplete
                id={`venue-address-search-${venue.key}`}
                label="Search address (optional)"
                onSelect={(address) =>
                  updateVenueRow(venue.key, {
                    name:
                      venue.name.trim() === '' && address.name ? address.name : venue.name,
                    address_line1: address.line1 || venue.address_line1,
                    city: address.city || venue.city,
                    county: address.county || venue.county,
                    postcode: address.postcode || venue.postcode,
                    country: address.country || venue.country,
                  })
                }
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Venue name
                  <input
                    type="text"
                    value={venue.name}
                    onChange={(e) =>
                      updateVenueRow(venue.key, { name: e.target.value })
                    }
                    placeholder="Main Sports Centre"
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Address line 1
                  <input
                    type="text"
                    value={venue.address_line1}
                    onChange={(e) =>
                      updateVenueRow(venue.key, { address_line1: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Address line 2
                  <input
                    type="text"
                    value={venue.address_line2}
                    onChange={(e) =>
                      updateVenueRow(venue.key, { address_line2: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Town / city
                    <input
                      type="text"
                      value={venue.city}
                      onChange={(e) =>
                        updateVenueRow(venue.key, { city: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Postcode
                    <input
                      type="text"
                      value={venue.postcode}
                      onChange={(e) =>
                        updateVenueRow(venue.key, { postcode: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    County
                    <input
                      type="text"
                      value={venue.county}
                      onChange={(e) =>
                        updateVenueRow(venue.key, { county: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Country
                    <input
                      type="text"
                      value={venue.country}
                      onChange={(e) =>
                        updateVenueRow(venue.key, { country: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                </div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 md:col-span-2">
                  Notes
                  <textarea
                    value={venue.notes}
                    onChange={(e) =>
                      updateVenueRow(venue.key, { notes: e.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
          Public event information
          <HelpPrompt guideSlug="public-pages" label="public event information" tip="What spectators see on the public Info tab" />
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Everything here is shown publicly on the tournament page. Empty fields are hidden, so fill in only what you need.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Organiser contact name
            <input
              type="text"
              value={publicInfo.organiser_contact_name}
              onChange={(e) => updatePublicInfo('organiser_contact_name', e.target.value)}
              placeholder="Who should spectators and teams ask for?"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Emergency / first-aid contact
            <input
              type="text"
              value={publicInfo.emergency_contact}
              onChange={(e) => updatePublicInfo('emergency_contact', e.target.value)}
              placeholder="e.g. First aid at the main desk — 07xxx xxxxxx"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Organiser contact email
            <input
              type="email"
              value={publicInfo.organiser_contact_email}
              onChange={(e) => updatePublicInfo('organiser_contact_email', e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Organiser contact phone
            <input
              type="tel"
              value={publicInfo.organiser_contact_phone}
              onChange={(e) => updatePublicInfo('organiser_contact_phone', e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Getting there &amp; arrival instructions
            <textarea
              value={publicInfo.arrival_instructions}
              onChange={(e) => updatePublicInfo('arrival_instructions', e.target.value)}
              rows={3}
              placeholder="When to arrive, where to check in, which entrance to use…"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Parking notes
            <textarea
              value={publicInfo.parking_notes}
              onChange={(e) => updatePublicInfo('parking_notes', e.target.value)}
              rows={3}
              placeholder="Where to park, costs, overflow parking, drop-off points…"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Venue notes
            <textarea
              value={publicInfo.venue_notes}
              onChange={(e) => updatePublicInfo('venue_notes', e.target.value)}
              rows={3}
              placeholder="Anything visitors should know about the venue itself…"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Facilities
            <textarea
              value={publicInfo.facilities_notes}
              onChange={(e) => updatePublicInfo('facilities_notes', e.target.value)}
              rows={3}
              placeholder="Food and drink, toilets, changing rooms, spectator seating…"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 md:col-span-2">
            Public notice
            <textarea
              value={publicInfo.public_notice}
              onChange={(e) => updatePublicInfo('public_notice', e.target.value)}
              rows={2}
              placeholder="Shown as a banner across the whole public tournament page — use it for last-minute announcements."
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Tournament organisers
        </h2>
        <div className="mt-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Organiser invitations and roles will be managed here.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This section is reserved for the next organiser workflow: roles, invite links and profile setup.
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || loading}
          className="inline-flex items-center justify-center rounded-md bg-tm-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-tm-navy-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save general'}
        </button>
      </div>
    </form>
  )
}
