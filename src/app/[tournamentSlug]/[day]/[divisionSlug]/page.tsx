import { redirect } from 'next/navigation'
import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentView from '@/components/TournamentView'
import NotFoundMessage from '@/components/NotFoundMessage'
import type { Day, Division, ElementSlot, Match, PhaseElement, Team, Tournament } from '@/lib/types'

interface Props {
  params: Promise<{
    tournamentSlug: string
    day: string
    divisionSlug: string
  }>
  searchParams: Promise<{ team?: string | string[]; phase?: string | string[] }>
}

export default async function DivisionPage({ params, searchParams }: Props) {
  const { tournamentSlug, day, divisionSlug } = await params
  const { team: teamParam, phase: phaseParam } = await searchParams
  const teamFilterId = typeof teamParam === 'string' ? teamParam : null
  const phaseSlug = typeof phaseParam === 'string' ? phaseParam : null

  if (day !== 'saturday' && day !== 'sunday') {
    return <NotFoundMessage title="Division not found" />
  }

  const supabase = await createPublicSupabaseClient()

  const { data: tournamentData } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', tournamentSlug)
    .maybeSingle()

  const tournament = tournamentData as Tournament | null
  if (!tournament) {
    return (
      <NotFoundMessage
        title="Tournament not found"
        description={`There is no tournament with slug "${tournamentSlug}".`}
      />
    )
  }

  const { data: allGroupsData } = await supabase
    .from('age_groups')
    .select('*, scoring_system:scoring_systems(*), phases(*, scoring_system:scoring_systems(*), pools(*, pool_teams(*)))')
    .eq('tournament_id', tournament.id)
    .order('display_order', { ascending: true })

  const divisions: Division[] = allGroupsData ?? []
  const phaseIds = divisions.flatMap((division) => (division.phases ?? []).map((phase) => phase.id))
  const phaseElementsRes = phaseIds.length > 0
    ? await supabase
        .from('phase_elements')
        .select('*')
        .in('phase_id', phaseIds)
        .order('display_order', { ascending: true })
    : { data: [] }
  const phaseElements = (phaseElementsRes.data ?? []) as PhaseElement[]
  const phaseElementIds = phaseElements.map((element) => element.id)
  const elementSlotsRes = phaseElementIds.length > 0
    ? await supabase
        .from('element_slots')
        .select('*')
        .in('phase_element_id', phaseElementIds)
        .order('display_order', { ascending: true })
    : { data: [] }
  const elementSlots = (elementSlotsRes.data ?? []) as ElementSlot[]
  const slotsByElementId = new Map<string, ElementSlot[]>()
  for (const slot of elementSlots) {
    const rows = slotsByElementId.get(slot.phase_element_id) ?? []
    rows.push(slot)
    slotsByElementId.set(slot.phase_element_id, rows)
  }
  const elementsByPhaseId = new Map<string, Array<PhaseElement & { slots?: ElementSlot[] }>>()
  for (const element of phaseElements) {
    const rows = elementsByPhaseId.get(element.phase_id) ?? []
    rows.push({ ...element, slots: slotsByElementId.get(element.id) ?? [] })
    elementsByPhaseId.set(element.phase_id, rows)
  }
  for (const division of divisions) {
    division.phases = (division.phases ?? []).map((phase) => ({
      ...phase,
      phase_elements: elementsByPhaseId.get(phase.id) ?? [],
    }))
  }

  const saturdayGroups = divisions.filter((g) => g.day === 'saturday')
  const sundayGroups = divisions.filter((g) => g.day === 'sunday')
  const divisionsForDay = day === 'saturday' ? saturdayGroups : sundayGroups

  const currentGroup = divisionsForDay.find((g) => g.slug === divisionSlug)
  const fallbackGroup = currentGroup ? null : divisions.find((g) => g.slug === divisionSlug)

  if (!currentGroup) {
    if (fallbackGroup) {
      redirect(`/${tournamentSlug}/${fallbackGroup.day}/${fallbackGroup.slug}`)
    }

    return (
      <NotFoundMessage
        title="Division not found"
        description={`There is no "${divisionSlug}" division on ${day === 'saturday' ? 'Saturday' : 'Sunday'}.`}
      />
    )
  }

  const [teamsRes, matchesRes] = await Promise.all([
    supabase
      .from('teams')
      .select('*')
      .eq('age_group_id', currentGroup.id)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('matches')
      .select('*')
      .eq('age_group_id', currentGroup.id)
      .is('deleted_at', null)
      .order('kickoff_time', { ascending: true }),
  ])

  const teams: Team[] = teamsRes.data ?? []
  const matches: Match[] = matchesRes.data ?? []
  const structuralSlots = (currentGroup.phases ?? []).flatMap((phase) =>
    ((phase.phase_elements ?? []) as Array<{ slots?: ElementSlot[] }>).flatMap((element) => element.slots ?? [])
  )
  const structuralSlotIds = new Set(structuralSlots.map((slot) => slot.id))
  const slotIds = Array.from(
    new Set(matches.flatMap((match) => [match.home_slot_id, match.away_slot_id]).filter(Boolean))
  ).filter((slotId) => !structuralSlotIds.has(slotId as string)) as string[]
  const slotsRes = slotIds.length > 0
    ? await supabase.from('element_slots').select('*').in('id', slotIds)
    : { data: [] }
  const slots: ElementSlot[] = [...structuralSlots, ...(slotsRes.data ?? [])]

  return (
    <TournamentView
      tournament={tournament}
      day={day as Day}
      currentGroup={currentGroup}
      saturdayGroups={saturdayGroups}
      sundayGroups={sundayGroups}
      teams={teams}
      matches={matches}
      slots={slots}
      teamFilterId={teamFilterId}
      phaseSlug={phaseSlug}
    />
  )
}

