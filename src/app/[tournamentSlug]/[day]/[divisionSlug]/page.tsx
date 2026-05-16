import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentView from '@/components/TournamentView'
import NotFoundMessage from '@/components/NotFoundMessage'
import type { Day, Division, ElementSlot, Match, Team, Tournament } from '@/lib/types'

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
  const saturdayGroups = divisions.filter((g) => g.day === 'saturday')
  const sundayGroups = divisions.filter((g) => g.day === 'sunday')
  const divisionsForDay = day === 'saturday' ? saturdayGroups : sundayGroups

  const currentGroup = divisionsForDay.find((g) => g.slug === divisionSlug)

  if (!currentGroup) {
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
  const slotIds = Array.from(
    new Set(matches.flatMap((match) => [match.home_slot_id, match.away_slot_id]).filter(Boolean))
  ) as string[]
  const slotsRes = slotIds.length > 0
    ? await supabase.from('element_slots').select('*').in('id', slotIds)
    : { data: [] }
  const slots: ElementSlot[] = slotsRes.data ?? []

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

