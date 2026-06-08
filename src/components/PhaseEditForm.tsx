'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { totalMatchMinutes } from '@/lib/matchRules'
import { slugify } from '@/lib/slugify'
import { createClient } from '@/lib/supabase'
import type {
  Division,
  MatchFormat,
  Phase,
  PhaseType,
  ScoringSystem,
  StandingsMode,
} from '@/lib/types'

interface PhaseEditFormProps {
  mode: 'create' | 'edit'
  division: Division
  phase?: Phase
  defaultDisplayOrder?: number
  onSaved: () => void
  onCancel: () => void
}

const PHASE_TYPES: { value: PhaseType; label: string }[] = [
  { value: 'round_robin', label: 'Round robin' },
  { value: 'group_stage', label: 'Group stage' },
  { value: 'knockout', label: 'Knockout' },
  { value: 'league', label: 'League' },
  { value: 'friendly', label: 'Friendly / festival' },
]

const STANDINGS_MODES: { value: StandingsMode; label: string }[] = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden from public' },
  { value: 'none', label: 'No standings' },
]

const MATCH_FORMATS: { value: MatchFormat; label: string }[] = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'halves', label: '2 halves' },
  { value: 'quarters', label: '4 quarters' },
]

export default function PhaseEditForm({
  mode,
  division,
  phase,
  defaultDisplayOrder,
  onSaved,
  onCancel,
}: PhaseEditFormProps) {
  const supabase = useMemo(() => createClient(), [])

  const [name, setName] = useState(phase?.name ?? '')
  const [slug, setSlug] = useState(phase?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [phaseType, setPhaseType] = useState<PhaseType>(
    phase?.phase_type ?? 'round_robin'
  )
  const [standingsMode, setStandingsMode] = useState<StandingsMode>(
    phase?.standings_mode ?? 'visible'
  )
  const [displayOrder, setDisplayOrder] = useState(
    String(phase?.display_order ?? defaultDisplayOrder ?? 1)
  )
  const [matchFormat, setMatchFormat] = useState<MatchFormat>(
    phase?.match_format ?? division.match_format
  )
  const [periodMinutes, setPeriodMinutes] = useState(
    String(phase?.period_minutes ?? division.period_minutes)
  )
  const [breakQ1Q2, setBreakQ1Q2] = useState(
    String(phase?.break_q1_q2_minutes ?? division.break_q1_q2_minutes)
  )
  const [breakHalfTime, setBreakHalfTime] = useState(
    String(phase?.break_half_time_minutes ?? division.break_half_time_minutes)
  )
  const [breakQ3Q4, setBreakQ3Q4] = useState(
    String(phase?.break_q3_q4_minutes ?? division.break_q3_q4_minutes)
  )
  const [scoringSystemId, setScoringSystemId] = useState(
    phase?.scoring_system_id ?? division.scoring_system_id ?? ''
  )
  const [scoringSystems, setScoringSystems] = useState<ScoringSystem[]>([])
  const [saving, setSaving] = useState(false)

  const parsedPeriod = Math.max(1, Math.floor(Number(periodMinutes) || 0))
  const parsedBreakQ1Q2 = Math.max(0, Math.floor(Number(breakQ1Q2) || 0))
  const parsedBreakHalf = Math.max(0, Math.floor(Number(breakHalfTime) || 0))
  const parsedBreakQ3Q4 = Math.max(0, Math.floor(Number(breakQ3Q4) || 0))

  const totalMinutes = totalMatchMinutes({
    match_format: matchFormat,
    period_minutes: parsedPeriod,
    break_q1_q2_minutes: parsedBreakQ1Q2,
    break_half_time_minutes: parsedBreakHalf,
    break_q3_q4_minutes: parsedBreakQ3Q4,
  })

  useEffect(() => {
    let cancelled = false

    async function loadScoringSystems() {
      const { data, error } = await supabase
        .from('scoring_systems')
        .select('*')
        .order('name')

      if (cancelled) return

      if (error) {
        toast.error(`Could not load scoring systems: ${error.message}`)
        return
      }

      setScoringSystems((data ?? []) as ScoringSystem[])
      setScoringSystemId((current) => {
        if (current) return current
        return division.scoring_system_id ?? (data?.[0] as ScoringSystem | undefined)?.id ?? ''
      })
    }

    loadScoringSystems()

    return () => {
      cancelled = true
    }
  }, [division.scoring_system_id, supabase])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      toast.error('Phase name and slug are required.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error('Slug can only contain lowercase letters, numbers and hyphens.')
      return
    }

    const order = Number(displayOrder)
    if (!Number.isInteger(order) || order < 1) {
      toast.error('Display order must be a whole number greater than zero.')
      return
    }

    const payload = {
      age_group_id: division.id,
      name: trimmedName,
      slug: trimmedSlug,
      phase_type: phaseType,
      standings_mode: standingsMode,
      display_order: order,
      scoring_system_id: scoringSystemId || null,
      match_format: matchFormat,
      period_minutes: parsedPeriod,
      break_q1_q2_minutes: matchFormat === 'quarters' ? parsedBreakQ1Q2 : 0,
      break_half_time_minutes: matchFormat === 'continuous' ? 0 : parsedBreakHalf,
      break_q3_q4_minutes: matchFormat === 'quarters' ? parsedBreakQ3Q4 : 0,
    }

    setSaving(true)
    const { data, error } =
      mode === 'create'
        ? await supabase.from('phases').insert(payload).select()
        : await supabase
            .from('phases')
            .update(payload)
            .eq('id', phase!.id)
            .select()
    setSaving(false)

    if (error) {
      toast.error(`Could not save phase: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        mode === 'create'
          ? 'Insert blocked by Supabase row-level security. Check the phases_auth_insert policy.'
          : 'Update blocked by Supabase row-level security. Check the phases_auth_update policy.'
      )
      return
    }

    toast.success(mode === 'create' ? 'Phase created' : 'Phase saved')
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="phase-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New phase' : 'Edit phase'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {division.name}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phase name
              <input
                type="text"
                required
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Group Stage"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Slug
              <input
                type="text"
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value)
                }}
                placeholder="group-stage"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type
              <select
                value={phaseType}
                onChange={(event) => setPhaseType(event.target.value as PhaseType)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {PHASE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Standings
              <select
                value={standingsMode}
                onChange={(event) =>
                  setStandingsMode(event.target.value as StandingsMode)
                }
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {STANDINGS_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Order
              <input
                type="number"
                min="1"
                step="1"
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Scoring system
            <select
              value={scoringSystemId}
              onChange={(event) => setScoringSystemId(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">No scoring system</option>
              {scoringSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>

          <section className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Match rules
              </p>
              <p className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                Total{' '}
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  {totalMinutes}
                </span>{' '}
                min
              </p>
            </div>

            <fieldset className="grid grid-cols-3 gap-1 rounded-md border border-zinc-300 bg-white p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
              {MATCH_FORMATS.map((format) => {
                const active = matchFormat === format.value
                return (
                  <label
                    key={format.value}
                    className={
                      active
                        ? 'cursor-pointer rounded bg-mk-red px-2 py-1.5 text-center font-semibold text-white'
                        : 'cursor-pointer rounded px-2 py-1.5 text-center font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }
                  >
                    <input
                      type="radio"
                      name="phase-match-format"
                      value={format.value}
                      checked={active}
                      onChange={() => setMatchFormat(format.value)}
                      className="sr-only"
                    />
                    {format.label}
                  </label>
                )
              })}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {matchFormat === 'continuous'
                  ? 'Total minutes'
                  : matchFormat === 'halves'
                    ? 'Minutes per half'
                    : 'Minutes per quarter'}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={periodMinutes}
                  onChange={(event) => setPeriodMinutes(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              {matchFormat === 'halves' && (
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Half-time break
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakHalfTime}
                    onChange={(event) => setBreakHalfTime(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              )}
            </div>

            {matchFormat === 'quarters' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Q1 to Q2
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakQ1Q2}
                    onChange={(event) => setBreakQ1Q2(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Half-time
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakHalfTime}
                    onChange={(event) => setBreakHalfTime(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Q3 to Q4
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakQ3Q4}
                    onChange={(event) => setBreakQ3Q4(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              </div>
            )}
          </section>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save phase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
