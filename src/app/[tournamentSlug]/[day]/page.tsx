import { redirect } from 'next/navigation'
import { createPublicSupabaseClient } from '@/lib/supabase'
import NotFoundMessage from '@/components/NotFoundMessage'

interface Props {
  params: Promise<{ tournamentSlug: string; day: string }>
}

export default async function DayPage({ params }: Props) {
  const { tournamentSlug, day } = await params

  if (day !== 'saturday' && day !== 'sunday') {
    return <NotFoundMessage title="Day not found" />
  }

  const supabase = await createPublicSupabaseClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', tournamentSlug)
    .maybeSingle()

  if (!tournament) {
    return (
      <NotFoundMessage
        title="Tournament not found"
        description={`There is no tournament with slug "${tournamentSlug}".`}
      />
    )
  }

  const { data: ageGroups } = await supabase
    .from('age_groups')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('day', day)
    .order('display_order', { ascending: true })

  if (!ageGroups || ageGroups.length === 0) {
    return <NotFoundMessage title="No groups available" />
  }

  redirect(`/${tournamentSlug}/${day}/${ageGroups[0].slug}`)
}
