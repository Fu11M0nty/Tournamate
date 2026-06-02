'use client'

import { useReducer, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  FORMAT_BUILDERS,
  defaultFormatBuilderOptions,
  applyFormatBuilder,
  type FormatBuilderOptions,
} from '@/lib/formatBuilders'
import { generateStructureFixtures } from '@/lib/matches'
import Step1TemplatePicker from './wizard/Step1TemplatePicker'
import Step2Configure from './wizard/Step2Configure'
import Step3Teams from './wizard/Step3Teams'
import Step4Review from './wizard/Step4Review'
import type { Division, Team } from '@/lib/types'

interface StructureWizardProps {
  division: Division
  existingTeams: Team[]
  mode: 'create' | 'change'
  onApplied: () => void
  onCancel?: () => void
}

type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  step: WizardStep
  builderId: string | null
  options: FormatBuilderOptions
  teamNames: string
  usePlaceholders: boolean
  byeSelections: string[]
}

type WizardAction =
  | { type: 'SET_BUILDER'; builderId: string; defaultOptions: FormatBuilderOptions }
  | { type: 'SET_OPTIONS'; patch: Partial<FormatBuilderOptions> }
  | { type: 'SET_TEAM_NAMES'; names: string }
  | { type: 'SET_USE_PLACEHOLDERS'; value: boolean }
  | { type: 'SET_TEAM_COUNT'; count: number }
  | { type: 'SET_BYE_SELECTIONS'; selections: string[] }
  | { type: 'GO_TO_STEP'; step: WizardStep }

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_BUILDER':
      return { ...state, builderId: action.builderId, options: action.defaultOptions, byeSelections: [] }
    case 'SET_OPTIONS':
      return { ...state, options: { ...state.options, ...action.patch } }
    case 'SET_TEAM_NAMES':
      return { ...state, teamNames: action.names }
    case 'SET_USE_PLACEHOLDERS':
      return { ...state, usePlaceholders: action.value }
    case 'SET_TEAM_COUNT':
      // Keep teamCount (bracket structure) and expectedTeamCount (placeholder count) in sync.
      // Clear bye selections whenever team count changes (selection may be stale).
      return { ...state, options: { ...state.options, teamCount: action.count, expectedTeamCount: action.count }, byeSelections: [] }
    case 'SET_BYE_SELECTIONS':
      return { ...state, byeSelections: action.selections }
    case 'GO_TO_STEP':
      return { ...state, step: action.step }
    default:
      return state
  }
}

export default function StructureWizard({
  division,
  existingTeams,
  mode,
  onApplied,
  onCancel,
}: StructureWizardProps) {
  const supabase = useMemo(() => createClient(), [])
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    builderId: null,
    options: {},
    teamNames: existingTeams.map((t) => t.name).join('\n'),
    usePlaceholders: existingTeams.length === 0,
    byeSelections: [],
  })

  const selectedBuilder = FORMAT_BUILDERS.find((b) => b.id === state.builderId) ?? null

  // When the builder's only configurable field is teamCount (e.g. Knockout), there's nothing
  // to show on a dedicated Configure step — skip it and fold the count into the Teams step.
  const shouldSkipConfigure = Boolean(
    selectedBuilder?.configurable &&
    Object.keys(selectedBuilder.configurable).length === 1 &&
    'teamCount' in selectedBuilder.configurable
  )
  const effectiveSteps: WizardStep[] = shouldSkipConfigure ? [1, 3, 4] : [1, 2, 3, 4]
  const stepLabels = shouldSkipConfigure
    ? ['Template', 'Teams', 'Review']
    : ['Template', 'Configure', 'Teams', 'Review']

  function goNext() {
    const idx = effectiveSteps.indexOf(state.step)
    if (idx < effectiveSteps.length - 1) {
      dispatch({ type: 'GO_TO_STEP', step: effectiveSteps[idx + 1] })
    }
  }
  function goPrev() {
    const idx = effectiveSteps.indexOf(state.step)
    if (idx > 0) {
      dispatch({ type: 'GO_TO_STEP', step: effectiveSteps[idx - 1] })
    }
  }

  const resolvedTeamNames: string[] = useMemo(() => {
    if (existingTeams.length > 0) return existingTeams.map((t) => t.name)
    if (state.usePlaceholders) {
      const count = state.options.expectedTeamCount ?? state.options.teamCount ?? 8
      return Array.from({ length: count }, (_, i) => `Team ${i + 1}`)
    }
    return state.teamNames
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }, [existingTeams, state.usePlaceholders, state.options.expectedTeamCount, state.options.teamCount, state.teamNames])

  async function handleConfirm() {
    if (!state.builderId) return
    setApplying(true)
    setApplyError(null)

    try {
      let resolvedByeTeamIds: string[] = []

      // Create named teams first if user entered them and none exist yet
      if (!state.usePlaceholders && existingTeams.length === 0) {
        const validNames = state.teamNames
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (validNames.length > 0) {
          const { data: createdTeams, error: teamError } = await supabase.from('teams').insert(
            validNames.map((name, index) => ({
              age_group_id: division.id,
              name,
              short_name: null,
              color: null,
              logo_url: null,
              display_order: index + 1,
            }))
          ).select('id, name')
          if (teamError) {
            setApplyError(`Failed to create teams: ${teamError.message}`)
            setApplying(false)
            return
          }
          // Resolve bye selections (team names) → team IDs from just-created rows.
          if (state.byeSelections.length > 0 && createdTeams) {
            resolvedByeTeamIds = state.byeSelections
              .map((name) => (createdTeams as { id: string; name: string }[]).find((t) => t.name === name)?.id)
              .filter((id): id is string => Boolean(id))
          }
        }
      } else if (existingTeams.length > 0 && state.byeSelections.length > 0) {
        // Existing teams: bye selections are already team IDs.
        resolvedByeTeamIds = state.byeSelections
      }

      const result = await applyFormatBuilder(
        supabase as Parameters<typeof applyFormatBuilder>[0],
        division,
        state.builderId,
        { ...state.options, byeTeamIds: resolvedByeTeamIds }
      )

      if (result.error) {
        setApplyError(result.error)
        setApplying(false)
        return
      }

      const fixtureResult = await generateStructureFixtures(
        supabase as Parameters<typeof generateStructureFixtures>[0],
        division.id
      )

      if (fixtureResult.error) {
        setApplyError(fixtureResult.error)
        setApplying(false)
        return
      }

      onApplied()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setApplying(false)
    }
  }

  const teamCountForStep2 = useMemo(() => {
    if (existingTeams.length > 0) return existingTeams.length
    if (state.usePlaceholders) return state.options.expectedTeamCount ?? 8
    return state.teamNames.split('\n').map((s) => s.trim()).filter(Boolean).length || 8
  }, [existingTeams.length, state.usePlaceholders, state.options.expectedTeamCount, state.teamNames])

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <nav aria-label="Setup steps" className="flex flex-wrap items-center gap-1.5">
        {effectiveSteps.map((internalStep, index) => {
          const label = stepLabels[index]
          const isActive = internalStep === state.step
          const isDone = internalStep < state.step
          return (
            <div key={label} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>›</span>
              )}
              <div className="flex items-center gap-1.5">
                <span
                  aria-current={isActive ? 'step' : undefined}
                  className={
                    isActive
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-mk-red text-[10px] font-bold text-white'
                      : isDone
                        ? 'flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white'
                        : 'flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span
                  className={
                    isActive
                      ? 'text-xs font-semibold text-zinc-900 dark:text-zinc-50'
                      : 'text-xs text-zinc-500 dark:text-zinc-400'
                  }
                >
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Step content */}
      {state.step === 1 && (
        <Step1TemplatePicker
          selectedBuilderId={state.builderId}
          existingTeamCount={existingTeams.length}
          options={state.options}
          onSelect={(builderId) => {
            const builder = FORMAT_BUILDERS.find((b) => b.id === builderId)
            if (builder) {
              dispatch({
                type: 'SET_BUILDER',
                builderId,
                defaultOptions: defaultFormatBuilderOptions(builder),
              })
            }
          }}
          onNext={goNext}
        />
      )}

      {state.step === 2 && selectedBuilder && (
        <Step2Configure
          builder={selectedBuilder}
          options={state.options}
          teamCount={teamCountForStep2}
          onChange={(patch) => dispatch({ type: 'SET_OPTIONS', patch })}
          onBack={goPrev}
          onNext={goNext}
        />
      )}

      {state.step === 3 && (
        <Step3Teams
          builder={selectedBuilder}
          options={state.options}
          existingTeams={existingTeams}
          teamNames={state.teamNames}
          usePlaceholders={state.usePlaceholders}
          byeSelections={state.byeSelections}
          onChangeNames={(names) => dispatch({ type: 'SET_TEAM_NAMES', names })}
          onChangeUsePlaceholders={(value) => dispatch({ type: 'SET_USE_PLACEHOLDERS', value })}
          onChangeTeamCount={(count) => dispatch({ type: 'SET_TEAM_COUNT', count })}
          onChangeByeSelections={(selections) => dispatch({ type: 'SET_BYE_SELECTIONS', selections })}
          onBack={goPrev}
          onNext={goNext}
        />
      )}

      {state.step === 4 && selectedBuilder && (
        <Step4Review
          builder={selectedBuilder}
          options={state.options}
          teamNames={resolvedTeamNames}
          usePlaceholders={state.usePlaceholders && existingTeams.length === 0}
          mode={mode}
          applying={applying}
          applyError={applyError}
          onBack={goPrev}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
