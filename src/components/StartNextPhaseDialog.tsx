'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { generateStructureFixtures } from '@/lib/matches'
import { resolvePhaseProgression } from '@/lib/phaseProgression'
import { createClient } from '@/lib/supabase'
import type {
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  ScoringSystem,
  Team,
} from '@/lib/types'

type PhaseWithScoring = Phase & {
  scoring_system?: ScoringSystem | null
}

type PoolWithTeams = Pool & {
  pool_teams?: PoolTeam[]
}

interface StartNextPhaseDialogProps {
  phase: PhaseWithScoring
  phases: PhaseWithScoring[]
  pools: PoolWithTeams[]
  elements: PhaseElement[]
  slots: ElementSlot[]
  rules: ProgressionRule[]
  teams: Team[]
  matches: Match[]
  onSaved: () => void
  onCancel: () => void
}

export default function StartNextPhaseDialog({
  phase,
  phases,
  pools,
  elements,
  slots,
  rules,
  teams,
  matches,
  onSaved,
  onCancel,
}: StartNextPhaseDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const resolutions = useMemo(
    () =>
      resolvePhaseProgression({
        targetPhase: phase,
        phases,
        pools,
        elements,
        slots,
        rules,
        teams,
        matches,
      }),
    [elements, matches, phase, phases, pools, rules, slots, teams]
  )

  const ready = resolutions.filter((resolution) => resolution.status === 'ready')
  const warnings = resolutions.filter((resolution) => resolution.status === 'warning')
  const blocked = resolutions.filter((resolution) => resolution.status === 'blocked')
  const canApply = ready.length > 0 && blocked.length === 0

  async function handleApply() {
    if (!canApply) {
      toast.error('Resolve blocked progression rows before starting this phase.')
      return
    }

    setSaving(true)
    for (const resolution of [...ready, ...warnings]) {
      if (!resolution.slot || !resolution.team) continue

      const { data, error } = await supabase
        .from('element_slots')
        .update({
          slot_type: 'team',
          team_id: resolution.team.id,
          source_phase_id: null,
          source_element_id: null,
          source_pool_id: null,
          source_match_id: null,
          source_rank: null,
          source_outcome: null,
          metadata: {
            resolved_from_rule_id: resolution.rule.id,
            resolved_at: new Date().toISOString(),
          },
        })
        .eq('id', resolution.slot.id)
        .select('id')

      if (error) {
        setSaving(false)
        toast.error(`Could not resolve slot: ${error.message}`)
        return
      }
      if (!data || data.length === 0) {
        setSaving(false)
        toast.error('Update blocked by Supabase row-level security. Check the element_slots_auth_update policy.')
        return
      }

      const [{ error: homeMatchError }, { error: awayMatchError }] = await Promise.all([
        supabase
          .from('matches')
          .update({ home_team_id: resolution.team.id })
          .eq('home_slot_id', resolution.slot.id)
          .is('home_team_id', null)
          .select('id'),
        supabase
          .from('matches')
          .update({ away_team_id: resolution.team.id })
          .eq('away_slot_id', resolution.slot.id)
          .is('away_team_id', null)
          .select('id'),
      ])

      if (homeMatchError || awayMatchError) {
        setSaving(false)
        toast.error(
          `Slot resolved, but placeholder matches could not be updated: ${
            homeMatchError?.message ?? awayMatchError?.message
          }`
        )
        return
      }
    }
    const fixtureResult = await generateStructureFixtures(
      supabase,
      phase.age_group_id,
      phase.id
    )
    setSaving(false)
    if (fixtureResult.error) {
      toast.error(`Slots resolved, but fixtures could not be generated: ${fixtureResult.error}`)
    } else {
      toast.success(
        `Started ${phase.name}${
          fixtureResult.created > 0
            ? ` · ${fixtureResult.created} fixture${fixtureResult.created === 1 ? '' : 's'} created`
            : ''
        }`
      )
    }
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-next-phase-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="start-next-phase-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            Start {phase.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Preview resolved teams from progression rules before writing them into phase slots.
          </p>
        </header>

        {resolutions.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            This phase has no progression rules yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{ready.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Ready</p>
              </div>
              <div className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{warnings.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Warnings</p>
              </div>
              <div className="rounded-md bg-red-50 px-3 py-2 dark:bg-red-950/40">
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{blocked.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">Blocked</p>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {resolutions.map((resolution) => (
                <div
                  key={resolution.rule.id}
                  className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {resolution.targetLabel}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {resolution.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {resolution.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span
                      className={
                        resolution.status === 'ready'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : resolution.status === 'warning'
                            ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300'
                      }
                    >
                      {resolution.status}
                    </span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {resolution.team?.name ?? 'Unresolved'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {warnings.length > 0 && blocked.length === 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Warning rows can be applied, but they are based on sources that still have incomplete matches.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply || saving}
            className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Starting...' : 'Apply resolved slots'}
          </button>
        </div>
      </div>
    </div>
  )
}
