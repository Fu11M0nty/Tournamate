'use client'

import { useEffect, useMemo, useState } from 'react'
import ScoreEntryForm from './ScoreEntryForm'
import TeamLogo from './TeamLogo'
import MatchScoresheetCapture from './MatchScoresheetCapture'
import MatchOfficialAssignmentDialog from './MatchOfficialAssignmentDialog'
import { createClient } from '@/lib/supabase'
import { forfeitSide } from '@/lib/standings'
import { formatKickoffTime } from '@/lib/time'
import type { ElementSlot, Match, Team } from '@/lib/types'

interface AdminMatchListProps {
  matches: Match[]
  teams: Team[]
  ageGroupName: string
  tournamentId?: string
  onSaved: () => void
}

function formatKickoff(iso: string): string {
  return formatKickoffTime(iso)
}

export default function AdminMatchList({
  matches,
  teams,
  ageGroupName,
  tournamentId,
  onSaved,
}: AdminMatchListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [filterTeamId, setFilterTeamId] = useState<string | null>(null)
  const [slots, setSlots] = useState<ElementSlot[]>([])

  const slotIds = useMemo(
    () =>
      Array.from(
        new Set(
          matches.flatMap((match) => [match.home_slot_id, match.away_slot_id]).filter(Boolean)
        )
      ) as string[],
    [matches]
  )

  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (slotIds.length === 0) {
        setSlots([])
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('element_slots')
        .select('*')
        .in('id', slotIds)

      if (cancelled) return
      if (error) {
        setSlots([])
        return
      }
      setSlots((data ?? []) as ElementSlot[])
    }

    loadSlots()

    return () => {
      cancelled = true
    }
  }, [slotIds])

  const teamById = useMemo(() => {
    const map = new Map<string, Team>()
    for (const t of teams) map.set(t.id, t)
    return map
  }, [teams])

  const slotById = useMemo(() => {
    const map = new Map<string, ElementSlot>()
    for (const slot of slots) map.set(slot.id, slot)
    return map
  }, [slots])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  const sorted = useMemo(
    () =>
      [...matches].sort(
        (a, b) =>
          new Date(a.kickoff_time).getTime() -
          new Date(b.kickoff_time).getTime()
      ),
    [matches]
  )

  const visible = useMemo(
    () =>
      filterTeamId === null
        ? sorted
        : sorted.filter(
            (m) =>
              m.home_team_id === filterTeamId ||
              m.away_team_id === filterTeamId
          ),
    [sorted, filterTeamId]
  )

  const duplicateIds = useMemo(() => {
    const byPair = new Map<string, string[]>()
    for (const m of matches) {
      const key = [
        m.home_team_id ?? `slot:${m.home_slot_id ?? 'home'}`,
        m.away_team_id ?? `slot:${m.away_slot_id ?? 'away'}`,
      ].sort().join('|')
      const arr = byPair.get(key) ?? []
      arr.push(m.id)
      byPair.set(key, arr)
    }
    const dupes = new Set<string>()
    for (const arr of byPair.values()) {
      if (arr.length > 1) arr.forEach((id) => dupes.add(id))
    }
    return dupes
  }, [matches])

  const editingMatch = editingId
    ? sorted.find((m) => m.id === editingId) ?? null
    : null
  const editingHome = editingMatch?.home_team_id ? teamById.get(editingMatch.home_team_id) : null
  const editingAway = editingMatch?.away_team_id ? teamById.get(editingMatch.away_team_id) : null

  function entrantLabel(team: Team | null, slotId: string | null) {
    if (team) return { label: team.name, placeholder: false }
    const slot = slotId ? slotById.get(slotId) : null
    if (slot?.label) return { label: slot.label, placeholder: true }
    if (slot?.source_outcome === 'winner') return { label: 'Winner of previous fixture', placeholder: true }
    if (slot?.source_outcome === 'loser') return { label: 'Loser of previous fixture', placeholder: true }
    if (slot?.source_outcome === 'rank' && slot.source_rank) {
      return { label: `${slot.source_rank} place qualifier`, placeholder: true }
    }
    return { label: 'TBD', placeholder: true }
  }

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No matches in this division.
      </p>
    )
  }

  const activeFilterTeam = filterTeamId ? teamById.get(filterTeamId) : null

  return (
    <>
      <nav
        aria-label="Filter matches by team"
        className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex w-max items-center gap-2 py-1">
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setFilterTeamId(null)}
              aria-pressed={filterTeamId === null}
              className={
                filterTeamId === null
                  ? 'inline-flex h-12 items-center rounded-full bg-mk-red px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm'
                  : 'inline-flex h-12 items-center rounded-full border border-mk-ink/15 bg-white px-4 text-xs font-bold uppercase tracking-wider text-mk-ink hover:border-mk-red hover:text-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
              }
            >
              All teams
            </button>
          </li>
          {sortedTeams.map((team) => {
            const active = team.id === filterTeamId
            return (
              <li key={team.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterTeamId(active ? null : team.id)}
                  aria-pressed={active}
                  aria-label={team.name}
                  title={team.name}
                  className={
                    active
                      ? 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-mk-red p-0.5 shadow-sm ring-2 ring-mk-red ring-offset-2 ring-offset-mk-cream dark:ring-offset-zinc-950'
                      : 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-white p-0.5 ring-1 ring-mk-ink/15 transition-colors hover:ring-mk-red dark:bg-zinc-900 dark:ring-zinc-700'
                  }
                >
                  <TeamLogo team={team} size="md" />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No matches for {activeFilterTeam?.name ?? 'this filter'}.
        </p>
      ) : (
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {visible.map((match) => {
          const home = match.home_team_id ? teamById.get(match.home_team_id) ?? null : null
          const away = match.away_team_id ? teamById.get(match.away_team_id) ?? null : null
          const homeEntrant = entrantLabel(home, match.home_slot_id)
          const awayEntrant = entrantLabel(away, match.away_slot_id)
          const isPlaceholder = !home || !away

          const hasScore =
            match.home_score !== null && match.away_score !== null
          const isDuplicate = duplicateIds.has(match.id)
          const forfeit = forfeitSide(match)
          const homeRaw = match.home_score ?? 0
          const awayRaw = match.away_score ?? 0
          const lateAdjustmentApplies = forfeit.side === null
          const homeAdjusted = lateAdjustmentApplies
            ? homeRaw - 2 * match.home_late_minutes
            : homeRaw
          const awayAdjusted = lateAdjustmentApplies
            ? awayRaw - 2 * match.away_late_minutes
            : awayRaw
          const homeLateApplied =
            lateAdjustmentApplies && match.home_late_minutes > 0
          const awayLateApplied =
            lateAdjustmentApplies && match.away_late_minutes > 0
          return (
            <li
              key={match.id}
              title={isDuplicate ? 'Duplicate fixture — this pair is scheduled more than once' : undefined}
              className={
                isDuplicate
                  ? 'flex animate-pulse flex-col gap-2 bg-fuchsia-100 px-4 py-3 dark:bg-fuchsia-950/60 sm:flex-row sm:items-center sm:gap-4'
                  : 'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4'
              }
            >
              <div className="flex shrink-0 gap-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400 sm:w-32">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {formatKickoff(match.kickoff_time)}
                </span>
                {match.court && <span>{match.court}</span>}
              </div>

              <div className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
                {match.round_number && (
                  <span className="mr-2 rounded-sm bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Round {match.round_number}
                  </span>
                )}
                {isDuplicate && (
                  <span className="mr-2 rounded-sm bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Duplicate
                  </span>
                )}
                {forfeit.side !== null && (
                  <span
                    title={`Forfeit — ${forfeit.reason === 'no_show' ? 'no show' : '4+ min late'}`}
                    className="mr-2 rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  >
                    Forfeit {forfeit.reason === 'no_show' ? '· no show' : '· late'}
                  </span>
                )}
                <span
                  className={
                    homeEntrant.placeholder
                      ? 'font-medium text-amber-700 dark:text-amber-300'
                      : 'font-medium'
                  }
                >
                  {homeEntrant.label}
                </span>
                {home && match.home_umpire_no_show && (
                  <span
                    title={`${home.name} did not provide an umpire — −1 pt`}
                    className="ml-1 rounded-sm bg-red-600 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  >
                    −1
                  </span>
                )}
                <span className="mx-2 text-zinc-400">vs</span>
                <span
                  className={
                    awayEntrant.placeholder
                      ? 'font-medium text-amber-700 dark:text-amber-300'
                      : 'font-medium'
                  }
                >
                  {awayEntrant.label}
                </span>
                {away && match.away_umpire_no_show && (
                  <span
                    title={`${away.name} did not provide an umpire — −1 pt`}
                    className="ml-1 rounded-sm bg-red-600 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  >
                    −1
                  </span>
                )}
              </div>

              <div className="mt-1 flex w-full shrink-0 flex-wrap items-center justify-between gap-3 sm:mt-0 sm:w-auto sm:justify-end">
                <div className="flex flex-wrap items-center gap-3">
                  {hasScore ? (
                    <span
                      title={
                        homeLateApplied || awayLateApplied
                          ? `On-court ${homeRaw}–${awayRaw}, adjusted ${homeAdjusted}–${awayAdjusted} after late-arrival deduction`
                          : undefined
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {homeLateApplied && (
                        <span className="text-xs font-medium text-zinc-400 line-through dark:text-zinc-600">
                          {homeRaw}
                        </span>
                      )}
                      <span>{homeAdjusted}</span>
                      <span className="text-zinc-400">–</span>
                      <span>{awayAdjusted}</span>
                      {awayLateApplied && (
                        <span className="text-xs font-medium text-zinc-400 line-through dark:text-zinc-600">
                          {awayRaw}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="rounded-md bg-zinc-50 px-2.5 py-1 text-sm text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
                      –
                    </span>
                  )}
                  {(homeLateApplied || awayLateApplied) && (
                    <span
                      title={[
                        homeLateApplied && home
                          ? `${home.name}: −${match.home_late_minutes * 2} goals (${match.home_late_minutes} min late)`
                          : null,
                        awayLateApplied && away
                          ? `${away.name}: −${match.away_late_minutes * 2} goals (${match.away_late_minutes} min late)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    >
                      −
                      {(homeLateApplied ? match.home_late_minutes * 2 : 0) +
                        (awayLateApplied ? match.away_late_minutes * 2 : 0)}{' '}
                      goals late
                    </span>
                  )}
                  <span
                    className={
                      match.status === 'completed'
                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                    }
                  >
                    {match.status === 'completed' ? 'Completed' : 'Scheduled'}
                  </span>
                </div>
                
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                  <div className="hidden sm:block">
                    <MatchScoresheetCapture match={match} onUploaded={onSaved} />
                  </div>
                  {tournamentId && (
                    <button
                      type="button"
                      onClick={() => setAssigningId(match.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                    >
                      whistle <span className="hidden sm:inline">Assign</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(match.id)}
                    disabled={isPlaceholder}
                    title={isPlaceholder ? 'Start the phase to resolve teams before entering scores' : undefined}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-none"
                  >
                    ✏️ <span className="hidden sm:inline">Edit</span>
                  </button>
                  <div className="ml-1 block sm:hidden">
                    <MatchScoresheetCapture match={match} onUploaded={onSaved} />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      )}

      {editingMatch && editingHome && editingAway && (
        <ScoreEntryForm
          match={editingMatch}
          homeTeam={editingHome}
          awayTeam={editingAway}
          teams={teams}
          ageGroupName={ageGroupName}
          onSave={() => {
            setEditingId(null)
            onSaved()
          }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {assigningId && tournamentId && (
        <MatchOfficialAssignmentDialog
          matchId={assigningId}
          tournamentId={tournamentId}
          onSaved={() => {
            setAssigningId(null)
            onSaved()
          }}
          onCancel={() => setAssigningId(null)}
        />
      )}
    </>
  )
}
