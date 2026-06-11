'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import { totalMatchMinutes } from '@/lib/matchRules'
import { applyMatchRulesToGroup } from '@/lib/matches'
import { labelForLegacyDay, legacyDaysForTournament } from '@/lib/competitionDates'
import type { Division, Day, MatchFormat, Tournament } from '@/lib/types'

interface DivisionEditFormProps {
  mode: 'create' | 'edit'
  tournamentId: string
  tournament: Tournament
  division?: Division
  defaultDisplayOrder?: number
  onSaved: () => void
  onCancel: () => void
}

export default function DivisionEditForm({
  mode,
  tournamentId,
  tournament,
  division,
  defaultDisplayOrder,
  onSaved,
  onCancel,
}: DivisionEditFormProps) {
  const [name, setName] = useState(division?.name ?? '')
  const [slug, setSlug] = useState(division?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [day, setDay] = useState<Day>(division?.day ?? 'saturday')
  const [displayOrder, setDisplayOrder] = useState<string>(
    String(division?.display_order ?? defaultDisplayOrder ?? 1)
  )
  const [gender, setGender] = useState(division?.gender ?? '')
  const [skillLevel, setSkillLevel] = useState(division?.skill_level ?? '')
  const [matchFormat, setMatchFormat] = useState<MatchFormat>(
    division?.match_format ?? 'continuous'
  )
  const [periodMinutes, setPeriodMinutes] = useState<string>(
    String(division?.period_minutes ?? 12)
  )
  const [breakQ1Q2, setBreakQ1Q2] = useState<string>(
    String(division?.break_q1_q2_minutes ?? 0)
  )
  const [breakHalfTime, setBreakHalfTime] = useState<string>(
    String(division?.break_half_time_minutes ?? 0)
  )
  const [breakQ3Q4, setBreakQ3Q4] = useState<string>(
    String(division?.break_q3_q4_minutes ?? 0)
  )
  const [scoringSystemId, setScoringSystemId] = useState<string>(division?.scoring_system_id ?? '')
  const [scoringSystems, setScoringSystems] = useState<{ id: string; name: string }[]>([])
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

  const supabase = useMemo(() => createClient(), [])
  const isMultiWeek = tournament.schedule_mode === 'multi_week'
  const dayOptions = Array.from(
    new Set([...legacyDaysForTournament(tournament), division?.day].filter(Boolean))
  ) as Day[]

  useEffect(() => {
    async function loadScoringSystems() {
      const { data } = await supabase.from('scoring_systems').select('id, name').order('name')
      if (data) {
        setScoringSystems(data)
        setScoringSystemId((current) => {
          if (mode === 'create' && !current) {
            return tournament.default_scoring_system_id ?? data[0]?.id ?? ''
          }
          return current
        })
      }
    }
    loadScoringSystems()
  }, [mode, supabase, tournament.default_scoring_system_id])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      toast.error('Name and slug are required.')
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error('Slug can only contain lowercase letters, numbers and hyphens.')
      return
    }
    const order = Number(displayOrder)
    if (!Number.isInteger(order)) {
      toast.error('Display order must be a whole number.')
      return
    }

    const payload = {
      tournament_id: tournamentId,
      name: trimmedName,
      slug: trimmedSlug,
      day,
      display_order: order,
      gender: gender.trim() === '' ? null : gender.trim(),
      skill_level: skillLevel.trim() === '' ? null : skillLevel.trim(),
      match_format: matchFormat,
      period_minutes: parsedPeriod,
      break_q1_q2_minutes:
        matchFormat === 'quarters' ? parsedBreakQ1Q2 : 0,
      break_half_time_minutes:
        matchFormat === 'continuous' ? 0 : parsedBreakHalf,
      break_q3_q4_minutes:
        matchFormat === 'quarters' ? parsedBreakQ3Q4 : 0,
      scoring_system_id: scoringSystemId || null,
    }

    setSaving(true)
    const { data, error } =
      mode === 'create'
        ? await supabase.from('age_groups').insert(payload).select()
        : await supabase
            .from('age_groups')
            .update(payload)
            .eq('id', division!.id)
            .select()
    setSaving(false)

    if (error) {
      toast.error(`Could not save: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        mode === 'create'
          ? 'Insert blocked by RLS — check age_groups_auth_insert policy.'
          : 'Update blocked by RLS — check age_groups_auth_update policy.'
      )
      return
    }

    // Push the new total duration to every existing match in this group so the
    // scheduler block sizes stay aligned with the age-group rules.
    const savedId = (data[0] as Division).id
    const result = await applyMatchRulesToGroup(supabase, savedId, totalMinutes)
    if (result.error) {
      toast.error(`Saved, but rules not pushed to matches: ${result.error}`)
    } else if (result.updated > 0) {
      toast.success(
        `Division saved · ${result.updated} match${
          result.updated === 1 ? '' : 'es'
        } updated to ${totalMinutes} min`
      )
    } else {
      toast.success(mode === 'create' ? 'Division created' : 'Division saved')
    }
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-group-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2
            id="age-group-edit-title"
            className="text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {mode === 'create' ? 'New division' : 'Edit division'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ag-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="ag-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Under 13's"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="ag-slug"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              URL slug
            </label>
            <input
              id="ag-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              placeholder="under-13s"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className={isMultiWeek ? '' : 'grid grid-cols-2 gap-3'}>
            {!isMultiWeek && (
              <div>
                <label
                  htmlFor="ag-day"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Day
                </label>
                <select
                  id="ag-day"
                  value={day}
                  onChange={(e) => setDay(e.target.value as Day)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>
                      {labelForLegacyDay(tournament, d)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="ag-order"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Display order
              </label>
              <input
                id="ag-order"
                type="number"
                step="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ag-gender"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Gender{' '}
                <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="ag-gender"
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="Mixed / Girls / Boys"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="ag-skill"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Skill level{' '}
                <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="ag-skill"
                type="text"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                placeholder="Club / Performance"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
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
              {(['continuous', 'halves', 'quarters'] as MatchFormat[]).map(
                (f) => {
                  const label =
                    f === 'continuous'
                      ? 'Continuous'
                      : f === 'halves'
                        ? '2 halves'
                        : '4 quarters'
                  const active = matchFormat === f
                  return (
                    <label
                      key={f}
                      className={
                        active
                          ? 'cursor-pointer rounded bg-mk-red px-2 py-1.5 text-center font-semibold text-white'
                          : 'cursor-pointer rounded px-2 py-1.5 text-center font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                      }
                    >
                      <input
                        type="radio"
                        name="match-format"
                        value={f}
                        checked={active}
                        onChange={() => setMatchFormat(f)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  )
                }
              )}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
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
                  onChange={(e) => setPeriodMinutes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              {matchFormat === 'halves' && (
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Half-time break (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakHalfTime}
                    onChange={(e) => setBreakHalfTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              )}
            </div>

            {matchFormat === 'quarters' && (
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Q1 → Q2 (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakQ1Q2}
                    onChange={(e) => setBreakQ1Q2(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Half-time (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakHalfTime}
                    onChange={(e) => setBreakHalfTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Q3 → Q4 (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakQ3Q4}
                    onChange={(e) => setBreakQ3Q4(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </label>
              </div>
            )}

            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {matchFormat === 'continuous'
                ? `One straight period of ${parsedPeriod} min — no breaks.`
                : matchFormat === 'halves'
                  ? `2 × ${parsedPeriod} min play + ${parsedBreakHalf} min half-time = ${totalMinutes} min total.`
                  : `4 × ${parsedPeriod} min play + breaks (${parsedBreakQ1Q2} / ${parsedBreakHalf} / ${parsedBreakQ3Q4}) = ${totalMinutes} min total.`}
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Scoring system
              </p>
            </div>
            <select
              value={scoringSystemId}
              onChange={(e) => setScoringSystemId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">— Select a scoring system —</option>
              {scoringSystems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


