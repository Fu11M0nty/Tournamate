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
}

type WizardAction =
  | { type: 'SET_BUILDER'; builderId: string; defaultOptions: FormatBuilderOptions }
  | { type: 'SET_OPTIONS'; patch: Partial<FormatBuilderOptions> }
  | { type: 'SET_TEAM_NAMES'; names: string }
  | { type: 'SET_USE_PLACEHOLDERS'; value: boolean }
  | { type: 'SET_TEAM_COUNT'; count: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_BUILDER':
      return { ...state, builderId: action.builderId, options: action.defaultOptions }
    case 'SET_OPTIONS':
      return { ...state, options: { ...state.options, ...action.patch } }
    case 'SET_TEAM_NAMES':
      return { ...state, teamNames: action.names }
    case 'SET_USE_PLACEHOLDERS':
      return { ...state, usePlaceholders: action.value }
    case 'SET_TEAM_COUNT':
      return { ...state, options: { ...state.options, expectedTeamCount: action.count } }
    case 'NEXT_STEP':
      return { ...state, step: Math.min(4, state.step + 1) as WizardStep }
    case 'PREV_STEP':
      return { ...state, step: Math.max(1, state.step - 1) as WizardStep }
    default:
      return state
  }
}

const STEP_LABELS = ['Template', 'Configure', 'Teams', 'Review']

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
  })

  const selectedBuilder = FORMAT_BUILDERS.find((b) => b.id === state.builderId) ?? null

  const resolvedTeamNames: string[] = useMemo(() => {
    if (existingTeams.length > 0) return existingTeams.map((t) => t.name)
    if (state.usePlaceholders) {
      const count = state.options.expectedTeamCount ?? 8
      return Array.from({ length: count }, (_, i) => `Team ${i + 1}`)
    }
    return state.teamNames
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }, [existingTeams, state.usePlaceholders, state.options.expectedTeamCount, state.teamNames])

  async function handleConfirm() {
    if (!state.builderId) return
    setApplying(true)
    setApplyError(null)

    try {
      // Create named teams first if user entered them and none exist yet
      if (!state.usePlaceholders && existingTeams.length === 0) {
        const validNames = state.teamNames
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (validNames.length > 0) {
          const { error: teamError } = await supabase.from('teams').insert(
            validNames.map((name, index) => ({
              age_group_id: division.id,
              name,
              short_name: null,
              color: null,
              logo_url: null,
              display_order: index + 1,
            }))
          )
          if (teamError) {
            setApplyError(`Failed to create teams: ${teamError.message}`)
            setApplying(false)
            return
          }
        }
      }

      const result = await applyFormatBuilder(
        supabase as Parameters<typeof applyFormatBuilder>[0],
        division,
        state.builderId,
        state.options
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
        {STEP_LABELS.map((label, index) => {
          const stepNum = (index + 1) as WizardStep
          const isActive = stepNum === state.step
          const isDone = stepNum < state.step
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
                  {isDone ? '✓' : stepNum}
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
          onNext={() => dispatch({ type: 'NEXT_STEP' })}
        />
      )}

      {state.step === 2 && selectedBuilder && (
        <Step2Configure
          builder={selectedBuilder}
          options={state.options}
          teamCount={teamCountForStep2}
          onChange={(patch) => dispatch({ type: 'SET_OPTIONS', patch })}
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={() => dispatch({ type: 'NEXT_STEP' })}
        />
      )}

      {state.step === 3 && (
        <Step3Teams
          builder={selectedBuilder}
          options={state.options}
          existingTeams={existingTeams}
          teamNames={state.teamNames}
          usePlaceholders={state.usePlaceholders}
          onChangeNames={(names) => dispatch({ type: 'SET_TEAM_NAMES', names })}
          onChangeUsePlaceholders={(value) => dispatch({ type: 'SET_USE_PLACEHOLDERS', value })}
          onChangeTeamCount={(count) => dispatch({ type: 'SET_TEAM_COUNT', count })}
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={() => dispatch({ type: 'NEXT_STEP' })}
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
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
