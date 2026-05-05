import { createServerSupabaseClient } from '@/lib/supabase'
import CaptureForm from '@/components/CaptureForm'
import type { Match, Team, AgeGroup } from '@/lib/types'

interface Props {
  params: Promise<{ matchId: string }>
}

export default async function CapturePage({ params }: Props) {
  const { matchId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .is('deleted_at', null)
    .single()

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="mb-4 text-zinc-600">Match not found.</p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  const [{ data: homeTeam }, { data: awayTeam }, { data: ageGroup }] =
    await Promise.all([
      supabase.from('teams').select('*').eq('id', match.home_team_id).single(),
      supabase.from('teams').select('*').eq('id', match.away_team_id).single(),
      supabase
        .from('age_groups')
        .select('*')
        .eq('id', match.age_group_id)
        .single(),
    ])

  if (!homeTeam || !awayTeam || !ageGroup) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="mb-4 text-zinc-600">Match data incomplete.</p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  return (
    <CaptureForm
      match={match as Match}
      homeTeam={homeTeam as Team}
      awayTeam={awayTeam as Team}
      ageGroupName={(ageGroup as AgeGroup).name}
    />
  )
}
