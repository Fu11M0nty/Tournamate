import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentLandingHub from '@/components/TournamentLandingHub'
import NotFoundMessage from '@/components/NotFoundMessage'
import type { AgeGroup, Match, Team, Tournament } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ tournamentSlug: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}

const LANDING_TABS = new Set(['info', 'teams', 'standings', 'schedule'])

export default async function TournamentLandingPage({ params, searchParams }: Props) {
  const { tournamentSlug } = await params
  const { tab } = await searchParams
  const activeTab = typeof tab === 'string' && LANDING_TABS.has(tab) ? tab : 'info'
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

  const [groupsRes, teamsRes, matchesRes] = await Promise.all([
    supabase
      .from('age_groups')
      .select('*, scoring_system:scoring_systems(*), phases(*, scoring_system:scoring_systems(*), pools(*))')
      .eq('tournament_id', tournament.id)
      .order('display_order', { ascending: true }),
    supabase.from('teams').select('*').is('deleted_at', null),
    supabase.from('matches').select('*').is('deleted_at', null),
  ])

  const groups: AgeGroup[] = groupsRes.data ?? []
  const groupIds = new Set(groups.map((group) => group.id))
  const teams: Team[] = (teamsRes.data ?? []).filter((team: Team) =>
    groupIds.has(team.age_group_id)
  )
  const matches: Match[] = (matchesRes.data ?? []).filter((match: Match) =>
    groupIds.has(match.age_group_id)
  )

  return (
    <TournamentLandingHub
      tournament={tournament}
      groups={groups}
      teams={teams}
      matches={matches}
      activeTab={activeTab as 'info' | 'teams' | 'standings' | 'schedule'}
    />
  )
}
