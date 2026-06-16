'use client'

import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import AdvancedStructureEditor, { type AdvancedStructureEditorHandle } from './AdvancedStructureEditor'
import StructureWizard from './StructureWizard'
import PhaseEditForm from './PhaseEditForm'
import {
  FormatOverviewCard,
  FormatTimeline,
  QualificationSummary,
  ReadyChecksPanel,
  formatSummaryLabel,
} from './FormatOverview'
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

interface DivisionFormatPageProps {
  tournament: Tournament
  division: Division
  phases: PhaseWithPools[]
  matches: Match[]
  teams: Team[]
  progressionRules: ProgressionRule[]
  allPhases: PhaseWithPools[]
  allTeams: Team[]
  onChanged: () => void
}

const PLACEHOLDER_NAME_RE = /^Team \d+$/

function FullResetModal({
  division,
  phaseCount,
  plannedCount,
  completedCount,
  generatedCount,
  placeholderTeams,
  resetting,
  onConfirm,
  onCancel,
}: {
  division: Division
  phaseCount: number
  plannedCount: number
  completedCount: number
  generatedCount: number
  placeholderTeams: Team[]
  resetting: boolean
  onConfirm: (includeTeams: boolean) => void
  onCancel: () => void
}) {
  const [input, setInput] = useState('')
  const [includeTeams, setIncludeTeams] = useState(false)
  const confirmed = input === 'FULL-RESET'
  const totalMatches = plannedCount + completedCount + generatedCount

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div className="w-full max-w-md rounded-xl border border-red-300 bg-white shadow-2xl dark:border-red-900 dark:bg-zinc-900">
        {/* Header */}
        <div className="rounded-t-xl bg-red-600 px-5 py-4 dark:bg-red-800">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <h2 className="font-bold text-white">Full reset — {division.name}</h2>
              <p className="text-xs text-red-100">This cannot be undone.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* What will be deleted */}
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Everything below will be permanently deleted:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                All {phaseCount} stage{phaseCount === 1 ? '' : 's'}, pools, and qualification paths
              </li>
              {generatedCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {generatedCount} auto-generated fixture{generatedCount === 1 ? '' : 's'}
                </li>
              )}
              {plannedCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <span>
                    <strong>{plannedCount} scheduled fixture{plannedCount === 1 ? '' : 's'}</strong> (assigned to the schedule)
                  </span>
                </li>
              )}
              {completedCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <span>
                    <strong>{completedCount} completed match result{completedCount === 1 ? '' : 's'}</strong> — scores will be lost forever
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Placeholder team option */}
          {placeholderTeams.length > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <input
                type="checkbox"
                checked={includeTeams}
                onChange={(e) => setIncludeTeams(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-red-600 focus:ring-red-500"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Also delete {placeholderTeams.length} placeholder team{placeholderTeams.length === 1 ? '' : 's'}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {placeholderTeams.slice(0, 4).map((t) => t.name).join(', ')}
                  {placeholderTeams.length > 4 ? ` and ${placeholderTeams.length - 4} more` : ''}
                </p>
              </div>
            </label>
          )}

          {/* Second warning */}
          {(plannedCount > 0 || completedCount > 0) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/50">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                ⚠ {totalMatches} fixture{totalMatches === 1 ? '' : 's'} will be deleted, including real match data.
                If you need to preserve results, export or note them before continuing.
              </p>
            </div>
          )}

          {/* Confirmation input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Type <span className="font-mono font-bold text-red-600 dark:text-red-400">FULL-RESET</span> to confirm
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="FULL-RESET"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={resetting}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(includeTeams)}
              disabled={!confirmed || resetting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {resetting ? 'Resetting…' : 'Force full reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DivisionFormatPage({
  tournament,
  division,
  phases,
  matches,
  teams,
  progressionRules,
  allPhases,
  allTeams,
  onChanged,
}: DivisionFormatPageProps) {
  const supabase = useMemo(() => createClient(), [])
  const advancedEditorRef = useRef<AdvancedStructureEditorHandle>(null)
  const [isChangingFormat, setIsChangingFormat] = useState(false)
  const [creatingPhase, setCreatingPhase] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showFullResetModal, setShowFullResetModal] = useState(false)
  const [includeTeamsInReset, setIncludeTeamsInReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const divisionElementIds = useMemo(
    () => new Set(phases.flatMap((p) => (p.phase_elements ?? []).map((e) => e.id))),
    [phases]
  )
  const relevantRuleCount = useMemo(
    () => progressionRules.filter((rule) => divisionElementIds.has(rule.to_element_id)).length,
    [progressionRules, divisionElementIds]
  )

  const placeholderTeams = useMemo(
    () => teams.filter((t) => PLACEHOLDER_NAME_RE.test(t.name)),
    [teams]
  )

  // Matches that block a safe reset: explicitly planned or completed.
  const plannedMatches = useMemo(() => matches.filter((m) => m.is_planned), [matches])
  const completedMatches = useMemo(() => matches.filter((m) => m.status === 'completed'), [matches])
  const generatedMatches = useMemo(() => matches.filter((m) => !m.is_planned), [matches])
  const protectedMatchCount = plannedMatches.length + completedMatches.length
  const canSafeReset = phases.length > 0 && protectedMatchCount === 0
  const canFullReset = phases.length > 0 && protectedMatchCount > 0

  function handleSaved() {
    setIsChangingFormat(false)
    setCreatingPhase(false)
    onChanged()
  }

  function openAdvanced() {
    const el = document.getElementById(`advanced-setup-${division.id}`)
    if (el) {
      el.setAttribute('open', '')
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function editStageFromTimeline(phase: PhaseWithPools) {
    advancedEditorRef.current?.editPhase(
      phase as Parameters<AdvancedStructureEditorHandle['editPhase']>[0]
    )
  }

  async function deletePhases() {
    const phaseIds = phases.map((p) => p.id)
    if (phaseIds.length === 0) return null
    const { error } = await supabase.from('phases').delete().in('id', phaseIds)
    return error
  }

  async function deletePlaceholderTeams() {
    if (placeholderTeams.length === 0) return null
    const { error } = await supabase
      .from('teams')
      .delete()
      .in('id', placeholderTeams.map((t) => t.id))
    return error
  }

  async function handleSafeReset() {
    setResetting(true)

    // Remove unplanned generated fixtures.
    const { error: matchError } = await supabase
      .from('matches')
      .delete()
      .eq('age_group_id', division.id)
      .eq('is_planned', false)

    if (matchError) {
      toast.error(`Could not remove fixtures: ${matchError.message}`)
      setResetting(false)
      return
    }

    const phaseError = await deletePhases()
    if (phaseError) {
      toast.error(`Could not delete format: ${phaseError.message}`)
      setResetting(false)
      return
    }

    if (includeTeamsInReset) {
      const teamError = await deletePlaceholderTeams()
      if (teamError) toast.error(`Format cleared, but could not delete placeholder teams: ${teamError.message}`)
    }

    toast.success(
      includeTeamsInReset && placeholderTeams.length > 0
        ? 'Format and placeholder teams cleared.'
        : 'Format cleared — ready to set up again.'
    )
    setShowResetConfirm(false)
    setIncludeTeamsInReset(false)
    setResetting(false)
    onChanged()
  }

  async function handleFullReset(includeTeams: boolean) {
    setResetting(true)

    // Delete ALL matches (planned, completed, generated).
    const { error: matchError } = await supabase
      .from('matches')
      .delete()
      .eq('age_group_id', division.id)

    if (matchError) {
      toast.error(`Could not remove matches: ${matchError.message}`)
      setResetting(false)
      return
    }

    const phaseError = await deletePhases()
    if (phaseError) {
      toast.error(`Could not delete format: ${phaseError.message}`)
      setResetting(false)
      return
    }

    if (includeTeams) {
      const teamError = await deletePlaceholderTeams()
      if (teamError) toast.error(`Format cleared, but could not delete placeholder teams: ${teamError.message}`)
    }

    const total = plannedMatches.length + completedMatches.length + generatedMatches.length
    toast.success(
      `Full reset complete. ${total} fixture${total === 1 ? '' : 's'} deleted.`
    )
    setShowFullResetModal(false)
    setResetting(false)
    onChanged()
  }

  const showWizard = phases.length === 0 || isChangingFormat

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{division.name}</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {labelForLegacyDay(tournament, division.day)} /{division.slug}
            </p>
          </div>
          {phases.length > 0 && !isChangingFormat && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {phases.length} stage{phases.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setCreatingPhase(true)}
                className="rounded-md bg-mk-red px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark"
              >
                Add stage
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Format overview (display-only, shown when phases exist and not changing) */}
      {phases.length > 0 && !isChangingFormat && (
        <>
          <FormatOverviewCard
            division={division}
            phases={phases}
            teams={teams}
            matches={matches}
            relevantRuleCount={relevantRuleCount}
          />
          <FormatTimeline
            phases={phases}
            matches={matches}
            teams={teams}
            progressionRules={progressionRules}
            onEditStage={editStageFromTimeline}
          />
          <QualificationSummary
            phases={phases}
            matches={matches}
            progressionRules={progressionRules}
          />
          <ReadyChecksPanel
            phases={phases}
            teams={teams}
            matches={matches}
            progressionRules={progressionRules}
            onOpenAdvanced={openAdvanced}
          />
        </>
      )}

      {/* Wizard or format summary + reset controls */}
      {showWizard ? (
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          {isChangingFormat && phases.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Change format</h3>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Existing scheduled and completed fixtures are preserved, but unscheduled generated
                fixtures, pools, qualification paths, and placeholders may be replaced by the new template.
              </p>
            </div>
          )}
          <StructureWizard
            division={division}
            existingTeams={teams}
            mode={phases.length === 0 ? 'create' : 'change'}
            onApplied={handleSaved}
            onCancel={isChangingFormat ? () => setIsChangingFormat(false) : undefined}
          />
        </div>
      ) : (
        <section className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          {/* Format template card */}
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/70">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Format template
              </p>
              <h3 className="mt-1 font-bold text-zinc-900 dark:text-zinc-50">
                {formatSummaryLabel(phases)}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Use the wizard to apply a different template. The Advanced section below gives
                direct control over individual stages, pools, and rules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingFormat(true)}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-50 dark:border-amber-900 dark:bg-zinc-950 dark:text-amber-300 dark:hover:bg-amber-950"
            >
              Change format
            </button>
          </div>

          {/* ── Safe reset (no protected matches) ── */}
          {canSafeReset && !showResetConfirm && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                No fixtures scheduled or played — safe to clear.
              </p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs font-medium text-red-500 underline-offset-2 hover:underline dark:text-red-400"
              >
                Reset format
              </button>
            </div>
          )}

          {canSafeReset && showResetConfirm && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <p className="text-sm font-bold text-red-900 dark:text-red-200">
                Delete all format data for {division.name}?
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                Removes all stages, pools, qualification paths, and any generated fixtures.
              </p>

              {placeholderTeams.length > 0 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={includeTeamsInReset}
                    onChange={(e) => setIncludeTeamsInReset(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-red-800 dark:text-red-300">
                    Also delete {placeholderTeams.length} placeholder team{placeholderTeams.length === 1 ? '' : 's'} (
                    {placeholderTeams.slice(0, 3).map((t) => t.name).join(', ')}
                    {placeholderTeams.length > 3 ? `…` : ''})
                  </span>
                </label>
              )}

              {!includeTeamsInReset && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Teams are not deleted and can be reused when you set up a new format.
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSafeReset}
                  disabled={resetting}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {resetting ? 'Deleting…' : 'Yes, delete format'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResetConfirm(false); setIncludeTeamsInReset(false) }}
                  disabled={resetting}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Force full reset (protected matches exist) ── */}
          {canFullReset && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {protectedMatchCount === 1
                  ? '1 fixture is planned or completed.'
                  : `${protectedMatchCount} fixtures are planned or completed.`}
              </p>
              <button
                type="button"
                onClick={() => setShowFullResetModal(true)}
                className="text-xs font-medium text-red-500 underline-offset-2 hover:underline dark:text-red-400"
              >
                Force full reset…
              </button>
            </div>
          )}
        </section>
      )}

      {/* Advanced setup — collapsed by default */}
      {phases.length > 0 && (
        <AdvancedStructureEditor
          ref={advancedEditorRef}
          division={division}
          phases={phases}
          matches={matches}
          teams={teams}
          progressionRules={progressionRules}
          allPhases={allPhases}
          allTeams={allTeams}
          onChanged={handleSaved}
        />
      )}

      {/* Add stage modal */}
      {creatingPhase && (
        <PhaseEditForm
          mode="create"
          division={division}
          defaultDisplayOrder={phases.length + 1}
          onSaved={handleSaved}
          onCancel={() => setCreatingPhase(false)}
        />
      )}

      {/* Full reset modal */}
      {showFullResetModal && (
        <FullResetModal
          division={division}
          phaseCount={phases.length}
          plannedCount={plannedMatches.length}
          completedCount={completedMatches.length}
          generatedCount={generatedMatches.length}
          placeholderTeams={placeholderTeams}
          resetting={resetting}
          onConfirm={handleFullReset}
          onCancel={() => setShowFullResetModal(false)}
        />
      )}
    </section>
  )
}
