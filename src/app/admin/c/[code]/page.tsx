import { createServerSupabaseClient } from '@/lib/supabase'
import CaptureForm from '@/components/CaptureForm'
import type { Match, Team, AgeGroup } from '@/lib/types'

interface Props {
  params: Promise<{ code: string }>
}

export default async function CaptureByCodePage({ params }: Props) {
  const { code } = await params
  const supabase = await createServerSupabaseClient()

  let match = null

  const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)

  if (isFullUuid) {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('id', code)
      .is('deleted_at', null)
      .single()
    match = data
  } else {
    // Short code search for manual entry
    const cleanCode = code.toLowerCase().replace(/[^a-z0-9]/g, '')
    const { data: allMatches } = await supabase
      .from('matches')
      .select('id')
      .is('deleted_at', null)

    const found = allMatches?.find((m) => m.id.replace(/-/g, '').startsWith(cleanCode))
    if (found) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', found.id)
        .single()
      match = data
    }
  }

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="mb-1 font-mono text-sm text-zinc-400">
            {code.toUpperCase()}
          </p>
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
