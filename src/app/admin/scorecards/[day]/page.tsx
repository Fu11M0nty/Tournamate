import { Fragment } from 'react'
import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'
import ScorecardCard from '@/components/ScorecardCard'
import ScorecardPrintBar from '@/components/ScorecardPrintBar'
import type { AgeGroup, Match, Team } from '@/lib/types'

interface Props {
  params: Promise<{ day: string }>
  searchParams: Promise<{ t?: string }>
}

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default async function ScorecardsPage({ params, searchParams }: Props) {
  const { day } = await params
  const { t: tournamentId } = await searchParams

  if (!tournamentId || !['saturday', 'sunday'].includes(day)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 font-sans">
        <div className="text-center">
          <p className="mb-4 text-zinc-600">Invalid day or missing tournament ID.</p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  const supabase = await createServerSupabaseClient()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto =
    host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, schedule_locked')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 font-sans">
        <div className="text-center">
          <p className="mb-4 text-zinc-600">Tournament not found.</p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  if (!tournament.schedule_locked) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 font-sans">
        <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">🔒</div>
          <h1 className="mb-2 text-lg font-bold text-zinc-900">
            Schedule not locked
          </h1>
          <p className="mb-6 text-sm text-zinc-500">
            Scorecards are not available until the schedule is locked. Lock the
            schedule from the Schedule view.
          </p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  const { data: ageGroups } = await supabase
    .from('age_groups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('day', day)
    .order('display_order')

  if (!ageGroups || ageGroups.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 font-sans">
        <div className="text-center">
          <p className="mb-4 text-zinc-600">No divisions found for {day}.</p>
          <a href="/admin" className="font-semibold text-mk-red hover:underline">
            ← Back to admin
          </a>
        </div>
      </main>
    )
  }

  const ageGroupIds = ageGroups.map((g) => g.id)

  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase
      .from('matches')
      .select('*')
      .in('age_group_id', ageGroupIds)
      .eq('is_planned', true)
      .is('deleted_at', null)
      .order('kickoff_time'),
    supabase
      .from('teams')
      .select('*')
      .in('age_group_id', ageGroupIds)
      .is('deleted_at', null),
  ])

  const matchList: Match[] = matches ?? []
  const teamMap = Object.fromEntries((teams ?? []).map((t: Team) => [t.id, t]))
  const ageGroupMap = Object.fromEntries(
    ageGroups.map((g: AgeGroup) => [g.id, g]),
  )

  // Build per-age-group summary for the title page
  const summary = ageGroups.map((ag: AgeGroup) => {
    const agMatches = matchList.filter((m) => m.age_group_id === ag.id)
    const courts = [
      ...new Set(agMatches.map((m) => m.court).filter((c): c is string => c !== null)),
    ]
      .sort()
      .join(', ')
    const kickoffMs = agMatches.map((m) => new Date(m.kickoff_time).getTime())
    const earliest = kickoffMs.length > 0 ? new Date(Math.min(...kickoffMs)) : null
    const latestMs = kickoffMs.length > 0 ? Math.max(...kickoffMs) : null
    const latestMatch =
      latestMs !== null
        ? agMatches.find((m) => new Date(m.kickoff_time).getTime() === latestMs)
        : null
    const latestEnd =
      latestMatch && latestMs !== null
        ? new Date(latestMs + (latestMatch.duration_minutes || 20) * 60000)
        : null
    return {
      ag,
      count: agMatches.length,
      courts: courts || '—',
      start: earliest ? fmt(earliest) : null,
      end: latestEnd ? fmt(latestEnd) : null,
    }
  })

  // Group matches into pages of 2 (= 4 cards per A4 sheet)
  const pages: Match[][] = []
  for (let i = 0; i < matchList.length; i += 2) {
    pages.push(matchList.slice(i, i + 2))
  }

  const dayLabel = day === 'saturday' ? 'Saturday' : 'Sunday'
  const printedAt = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Arial, Helvetica, sans-serif',
  }

  return (
    <>
      <div className="print:hidden">
        <ScorecardPrintBar
          label={`Scorecards — ${tournament.name} · ${dayLabel} · ${matchList.length} match${matchList.length === 1 ? '' : 'es'}`}
        />
      </div>

      <div className="scorecard-screen-bg">
        {/* ── Page 1: Title & summary ─────────────────────────────── */}
        <div className="scorecard-a4-page" style={titleStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* Tournament heading */}
            <div
              style={{
                borderBottom: '2pt solid #000',
                paddingBottom: '8mm',
                marginBottom: '8mm',
              }}
            >
              <h1
                style={{
                  fontSize: '22pt',
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {tournament.name}
              </h1>
              <p
                style={{
                  fontSize: '14pt',
                  margin: '4pt 0 0',
                  color: '#333',
                  fontWeight: 600,
                }}
              >
                {dayLabel} — Scorecards
              </p>
              <p style={{ fontSize: '9pt', margin: '4pt 0 0', color: '#777' }}>
                Printed: {printedAt}
              </p>
            </div>

            {/* Summary table */}
            <div style={{ marginBottom: '8mm' }}>
              <h2
                style={{
                  fontSize: '11pt',
                  fontWeight: 700,
                  marginBottom: '4mm',
                }}
              >
                Match summary
              </h2>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '9pt',
                }}
              >
                <thead>
                  <tr>
                    {['Division', 'Matches', 'Courts', 'Start', 'Est. Finish'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: '4pt 6pt',
                            textAlign: h === 'Division' ? 'left' : 'center',
                            borderBottom: '1pt solid #000',
                            backgroundColor: '#f3f4f6',
                            fontWeight: 700,
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {summary.map(({ ag, count, courts, start, end }) => (
                    <tr
                      key={ag.id}
                      style={{ borderBottom: '0.5pt solid #ddd' }}
                    >
                      <td
                        style={{
                          padding: '4pt 6pt',
                          fontWeight: 700,
                        }}
                      >
                        {ag.name}
                      </td>
                      <td
                        style={{ padding: '4pt 6pt', textAlign: 'center' }}
                      >
                        {count}
                      </td>
                      <td style={{ padding: '4pt 6pt' }}>{courts}</td>
                      <td
                        style={{
                          padding: '4pt 6pt',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                        }}
                      >
                        {start ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '4pt 6pt',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                        }}
                      >
                        {end ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr
                    style={{
                      borderTop: '1pt solid #000',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <td style={{ padding: '4pt 6pt', fontWeight: 700 }}>
                      Total
                    </td>
                    <td
                      style={{
                        padding: '4pt 6pt',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {matchList.length}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Scorer instructions */}
            <div
              style={{
                padding: '5mm',
                border: '1pt solid #d1d5db',
                borderRadius: '3pt',
                backgroundColor: '#f9fafb',
                fontSize: '8.5pt',
                marginBottom: '8mm',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '3pt' }}>
                Instructions for scorers
              </strong>
              <ol style={{ margin: 0, paddingLeft: '16pt', lineHeight: 1.7 }}>
                <li>
                  Cross off each number as a goal is scored for that team (left
                  column = home, right column = away).
                </li>
                <li>
                  Tick the <strong>CP □</strong> box to record which team
                  receives centre pass at the start of each period.
                </li>
                <li>
                  Write each team&apos;s final score in the{' '}
                  <strong>FINAL SCORE</strong> box at the bottom.
                </li>
                <li>
                  Return completed scorecards to the control desk immediately
                  after the match.
                </li>
              </ol>
            </div>

            {/* Footer note */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: '6mm',
                borderTop: '0.5pt solid #e5e7eb',
                fontSize: '7.5pt',
                color: '#6b7280',
              }}
            >
              The QR code on each scorecard links to the score-entry form for
              that match. Scan using the &ldquo;Scan QR&rdquo; button in the admin
              console, or enter the 8-character code printed beneath the QR code.
            </div>
          </div>
        </div>

        {/* ── Scorecard pages ──────────────────────────────────────── */}
        {matchList.length === 0 ? (
          <div className="scorecard-a4-page" style={titleStyle}>
            <div className="flex h-full items-center justify-center">
              <p style={{ color: '#6b7280' }}>
                No planned matches found for {dayLabel}.
              </p>
            </div>
          </div>
        ) : (
          pages.map((pageMatches, pi) => (
            <div key={pi} className="scorecard-a4-page">
              <div className="scorecard-page">
                {pageMatches.map((match) => {
                  const ag = ageGroupMap[match.age_group_id]
                  const home = match.home_team_id ? teamMap[match.home_team_id] : null
                  const away = match.away_team_id ? teamMap[match.away_team_id] : null
                  if (!ag || !home || !away) return null
                  const shortId = match.id.replace(/-/g, '').slice(0, 8).toUpperCase()
                  const captureUrl = `${baseUrl}/admin/c/${shortId}`
                  return (
                    <Fragment key={match.id}>
                      <ScorecardCard
                        match={match}
                        homeTeam={home}
                        awayTeam={away}
                        ageGroup={ag}
                        copy="home"
                        captureUrl={captureUrl}
                      />
                      <ScorecardCard
                        match={match}
                        homeTeam={home}
                        awayTeam={away}
                        ageGroup={ag}
                        copy="away"
                        captureUrl={captureUrl}
                      />
                    </Fragment>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
