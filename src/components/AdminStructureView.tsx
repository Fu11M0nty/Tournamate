'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import DivisionFormatPage from './DivisionFormatPage'
import { labelForLegacyDay } from '@/lib/competitionDates'
import type {
  Division,
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  ScoringSystem,
  Team,
  Tournament,
} from '@/lib/types'

type PoolWithTeams = Pool & { pool_teams?: PoolTeam[] }
type PhaseElementWithSlots = PhaseElement & { slots?: ElementSlot[] }
type PhaseWithPools = Phase & {
  scoring_system?: ScoringSystem | null
  pools?: PoolWithTeams[]
  phase_elements?: PhaseElementWithSlots[]
}

interface AdminStructureViewProps {
  tournament: Tournament
  divisions: Division[]
  embedded?: boolean
  onChanged?: () => void
}

export default function AdminStructureView({
  tournament,
  divisions,
  embedded = false,
  onChanged,
}: AdminStructureViewProps) {
  const supabase = useMemo(() => createClient(), [])

  const [phases, setPhases] = useState<PhaseWithPools[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [progressionRules, setProgressionRules] = useState<ProgressionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectedDivisionId, setSelectedDivisionId] = useState(divisions[0]?.id ?? '')

  const divisionIds = useMemo(() => divisions.map((d) => d.id), [divisions])

  useEffect(() => {
    let cancelled = false

    async function loadStructure() {
      if (divisionIds.length === 0) {
        setPhases([])
        setMatches([])
        setTeams([])
        setProgressionRules([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [phaseRes, matchRes, teamRes] = await Promise.all([
        supabase
          .from('phases')
          .select('*, scoring_system:scoring_systems(*), pools(*, pool_teams(*)), phase_elements(*)')
          .in('age_group_id', divisionIds)
          .order('display_order', { ascending: true }),
        supabase
          .from('matches')
          .select('*')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null),
        supabase
          .from('teams')
          .select('*')
          .in('age_group_id', divisionIds)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
      ])

      if (cancelled) return

      if (phaseRes.error) {
        setError(`Could not load phases: ${phaseRes.error.message}`)
        setPhases([])
        setProgressionRules([])
      } else {
        const loadedPhases = (phaseRes.data ?? []) as PhaseWithPools[]
        const elementIds = loadedPhases.flatMap((phase) =>
          (phase.phase_elements ?? []).map((el) => el.id)
        )

        if (elementIds.length > 0) {
          const [slotRes, ruleRes] = await Promise.all([
            supabase
              .from('element_slots')
              .select('*')
              .in('phase_element_id', elementIds)
              .order('display_order', { ascending: true }),
            supabase
              .from('progression_rules')
              .select('*')
              .in('to_element_id', elementIds)
              .order('display_order', { ascending: true }),
          ])

          if (cancelled) return

          if (slotRes.error) {
            setError(`Could not load element slots: ${slotRes.error.message}`)
            setPhases(loadedPhases)
          } else {
            const slotsByElement = new Map<string, ElementSlot[]>()
            for (const slot of (slotRes.data ?? []) as ElementSlot[]) {
              const list = slotsByElement.get(slot.phase_element_id) ?? []
              list.push(slot)
              slotsByElement.set(slot.phase_element_id, list)
            }
            setPhases(
              loadedPhases.map((phase) => ({
                ...phase,
                phase_elements: (phase.phase_elements ?? []).map((el) => ({
                  ...el,
                  slots: slotsByElement.get(el.id) ?? [],
                })),
              }))
            )
          }

          if (ruleRes.error) {
            setError(`Could not load progression rules: ${ruleRes.error.message}`)
            setProgressionRules([])
          } else {
            setProgressionRules((ruleRes.data ?? []) as ProgressionRule[])
          }
        } else {
          setPhases(loadedPhases)
          setProgressionRules([])
        }
      }

      if (matchRes.error) {
        setError(`Could not load matches: ${matchRes.error.message}`)
        setMatches([])
      } else {
        setMatches((matchRes.data ?? []) as Match[])
      }

      if (teamRes.error) {
        setError(`Could not load teams: ${teamRes.error.message}`)
        setTeams([])
      } else {
        setTeams((teamRes.data ?? []) as Team[])
      }

      setLoading(false)
    }

    loadStructure()
    return () => { cancelled = true }
  }, [divisionIds, refreshToken, supabase])

  const phasesByDivision = useMemo(() => {
    const map = new Map<string, PhaseWithPools[]>()
    for (const phase of phases) {
      const list = map.get(phase.age_group_id) ?? []
      list.push(phase)
      map.set(phase.age_group_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
      for (const phase of list) {
        phase.pools?.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
        phase.phase_elements?.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
        for (const el of phase.phase_elements ?? []) {
          el.slots?.sort((a, b) => a.display_order - b.display_order)
        }
      }
    }
    return map
  }, [phases])

  const teamsByDivision = useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const team of teams) {
      const list = map.get(team.age_group_id) ?? []
      list.push(team)
      map.set(team.age_group_id, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [teams])

  const sortedDivisions = useMemo(
    () =>
      [...divisions].sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          a.display_order - b.display_order ||
          a.name.localeCompare(b.name)
      ),
    [divisions]
  )

  const selectedDivision =
    sortedDivisions.find((d) => d.id === selectedDivisionId) ?? sortedDivisions[0] ?? null

  function handleChanged() {
    setRefreshToken((t) => t + 1)
    onChanged?.()
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {!embedded && (
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Tournament format</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Choose how teams compete, qualify, and create fixtures for {tournament.name}.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Loading format...
        </p>
      ) : sortedDivisions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No divisions exist for this tournament yet.
        </p>
      ) : (
        <div className="space-y-3">
          {!embedded && (
            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Division overview</h3>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Pick one division to edit. Other formats stay collapsed as status summaries.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 lg:w-80">
                    Working on
                    <select
                      value={selectedDivision?.id ?? ''}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {sortedDivisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {labelForLegacyDay(tournament, d.day)} - {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedDivisions.map((division) => {
                  const groupPhases = phasesByDivision.get(division.id) ?? []
                  const divisionMatches = matches.filter((m) => m.age_group_id === division.id)
                  const divisionTeams = teamsByDivision.get(division.id) ?? []
                  const placeholderCount = divisionMatches.filter((m) => !m.home_team_id || !m.away_team_id).length
                  const completedCount = divisionMatches.filter((m) => m.status === 'completed').length
                  const poolCount = groupPhases.reduce((t, p) => t + (p.pools?.length ?? 0), 0)
                  const status =
                    groupPhases.length === 0
                      ? 'Setup needed'
                      : placeholderCount > 0
                        ? 'Waiting on qualifiers'
                        : divisionMatches.length === 0
                          ? 'No fixtures yet'
                          : completedCount === divisionMatches.length
                            ? 'Complete'
                            : 'Ready'
                  const isSelected = division.id === selectedDivision?.id

                  return (
                    <button
                      key={division.id}
                      type="button"
                      onClick={() => setSelectedDivisionId(division.id)}
                      className={
                        isSelected
                          ? 'rounded-lg border border-mk-red bg-red-50 p-3 text-left shadow-sm dark:border-mk-red dark:bg-red-950/30'
                          : 'rounded-lg border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            {division.name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {labelForLegacyDay(tournament, division.day)} /{division.slug}
                          </p>
                        </div>
                        <span
                          className={
                            groupPhases.length === 0
                              ? 'shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : isSelected
                                ? 'shrink-0 rounded-full bg-mk-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white'
                                : 'shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        {[
                          { value: divisionTeams.length, label: 'Teams' },
                          { value: groupPhases.length, label: 'Stages' },
                          { value: poolCount, label: 'Pools' },
                          { value: divisionMatches.length, label: 'Fixtures' },
                        ].map(({ value, label }) => (
                          <div key={label} className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {selectedDivision && (
            <DivisionFormatPage
              key={selectedDivision.id}
              tournament={tournament}
              division={selectedDivision}
              phases={phasesByDivision.get(selectedDivision.id) ?? []}
              matches={matches.filter((m) => m.age_group_id === selectedDivision.id)}
              teams={teamsByDivision.get(selectedDivision.id) ?? []}
              progressionRules={progressionRules}
              allPhases={phases}
              allTeams={teams}
              onChanged={handleChanged}
            />
          )}
        </div>
      )}
    </div>
  )
}
