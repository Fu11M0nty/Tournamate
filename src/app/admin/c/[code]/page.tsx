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
    // Short code is the first 8 hex chars of the UUID without dashes.
    // PostgreSQL's UUID type does not support LIKE, but does support >= / <=.
    // All UUIDs sharing the same 8-char prefix fall in the range
    //   [prefix-0000-0000-0000-000000000000, prefix-ffff-ffff-ffff-ffffffffffff]
    // so a range query gives us a single-pass, index-friendly prefix scan.
    const cleanCode = code.toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 8)
    if (cleanCode.length === 8) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .gte('id', `${cleanCode}-0000-0000-0000-000000000000`)
        .lte('id', `${cleanCode}-ffff-ffff-ffff-ffffffffffff`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
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
