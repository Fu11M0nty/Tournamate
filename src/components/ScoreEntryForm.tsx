'use client'

import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import {
  buildIsoFromLondonTime,
  formatKickoffDate,
  getLondonTimeHHmm,
} from '@/lib/time'
import type { Match, MatchStatus, Team } from '@/lib/types'

const SCORESHEET_BUCKET = 'scoresheets'
const MAX_SCORESHEET_SOURCE_BYTES = 20 * 1024 * 1024 // 20 MB raw camera input

interface ScoreEntryFormProps {
  match: Match
  homeTeam: Team
  awayTeam: Team
  teams: Team[]
  ageGroupName: string
  onSave: () => void
  onCancel: () => void
}

function formatLocalDate(iso: string): string {
  return formatKickoffDate(iso, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ScoreEntryForm({
  match,
  homeTeam,
  awayTeam,
  teams,
  ageGroupName,
  onSave,
  onCancel,
}: ScoreEntryFormProps) {
  const originalTime = useMemo(() => getLondonTimeHHmm(match.kickoff_time), [match.kickoff_time])
  const originalCourt = match.court ?? ''
  const originalHomeId = match.home_team_id
  const originalAwayId = match.away_team_id

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )
  const teamById = useMemo(() => {
    const map = new Map<string, Team>()
    for (const t of teams) map.set(t.id, t)
    return map
  }, [teams])

  const [homeScore, setHomeScore] = useState<string>(
    match.home_score !== null ? String(match.home_score) : ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    match.away_score !== null ? String(match.away_score) : ''
  )
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [kickoffTime, setKickoffTime] = useState<string>(originalTime)
  const [court, setCourt] = useState<string>(originalCourt)
  const [homeTeamId, setHomeTeamId] = useState<string>(originalHomeId ?? '')
  const [awayTeamId, setAwayTeamId] = useState<string>(originalAwayId ?? '')
  const [homeMinsLate, setHomeMinsLate] = useState<string>(
    match.home_late_minutes > 0 ? String(match.home_late_minutes) : ''
  )
  const [awayMinsLate, setAwayMinsLate] = useState<string>(
    match.away_late_minutes > 0 ? String(match.away_late_minutes) : ''
  )
  const [homeUmpireNoShow, setHomeUmpireNoShow] = useState<boolean>(
    match.home_umpire_no_show
  )
  const [awayUmpireNoShow, setAwayUmpireNoShow] = useState<boolean>(
    match.away_umpire_no_show
  )
  const [homeNoShow, setHomeNoShow] = useState<boolean>(match.home_no_show)
  const [awayNoShow, setAwayNoShow] = useState<boolean>(match.away_no_show)
  const [scoresheetUrl, setScoresheetUrl] = useState<string | null>(
    match.scoresheet_url
  )
  const [uploadingSheet, setUploadingSheet] = useState(false)
  const [confirmChange, setConfirmChange] = useState(false)
  const [saving, setSaving] = useState(false)
  const sheetInputRef = useRef<HTMLInputElement>(null)

  const parsedHomeLate = Math.max(0, Math.floor(Number(homeMinsLate) || 0))
  const parsedAwayLate = Math.max(0, Math.floor(Number(awayMinsLate) || 0))
  const homeForfeit = parsedHomeLate >= 4
  const awayForfeit = parsedAwayLate >= 4

  function applyForfeit(side: 'home' | 'away') {
    if (side === 'home') {
      setHomeScore('0')
      setAwayScore('10')
      setAwayMinsLate('')
    } else {
      setHomeScore('10')
      setAwayScore('0')
      setHomeMinsLate('')
    }
    setStatus('completed')
    toast.success(
      `Forfeit recorded — 10-0 to ${side === 'home' ? selectedAway.name : selectedHome.name}`
    )
  }

  async function handleScoresheetFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_SCORESHEET_SOURCE_BYTES) {
      toast.error('Source image too large (max 20 MB).')
      return
    }

    setUploadingSheet(true)
    try {
      const compressed = await compressImage(file, 960, 0.5)
      const supabase = createClient()
      const path = `${match.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(SCORESHEET_BUCKET)
        .upload(path, compressed, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        })
      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`)
        return
      }
      const { data: publicUrl } = supabase.storage
        .from(SCORESHEET_BUCKET)
        .getPublicUrl(path)
      setScoresheetUrl(publicUrl.publicUrl)
      toast.success(`Scoresheet uploaded (${Math.round(compressed.size / 1024)} KB)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingSheet(false)
    }
  }

  function handleScoresheetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void handleScoresheetFile(file)
  }

  function handleNoShowToggle(side: 'home' | 'away', checked: boolean) {
    if (side === 'home') {
      setHomeNoShow(checked)
      if (checked) {
        setHomeScore('0')
        setAwayScore('10')
        setHomeMinsLate('')
        setStatus('completed')
      }
    } else {
      setAwayNoShow(checked)
      if (checked) {
        setHomeScore('10')
        setAwayScore('0')
        setAwayMinsLate('')
        setStatus('completed')
      }
    }
  }

  const scheduleChanged =
    kickoffTime !== originalTime || court.trim() !== originalCourt.trim()
  const teamsChanged =
    homeTeamId !== originalHomeId || awayTeamId !== originalAwayId
  const anyChange = scheduleChanged || teamsChanged
  const sameTeamSelected = homeTeamId === awayTeamId

  const selectedHome = teamById.get(homeTeamId) ?? homeTeam
  const selectedAway = teamById.get(awayTeamId) ?? awayTeam

  const submitDisabled =
    saving ||
    uploadingSheet ||
    kickoffTime.trim() === '' ||
    sameTeamSelected ||
    (anyChange && !confirmChange)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const homeTrim = homeScore.trim()
    const awayTrim = awayScore.trim()
    const homeProvided = homeTrim !== ''
    const awayProvided = awayTrim !== ''

    if (homeProvided !== awayProvided) {
      toast.error('Enter both scores or leave both blank.')
      return
    }

    let homeValue: number | null = null
    let awayValue: number | null = null
    if (homeProvided && awayProvided) {
      const home = Number(homeTrim)
      const away = Number(awayTrim)
      if (!Number.isInteger(home) || !Number.isInteger(away)) {
        toast.error('Scores must be whole numbers.')
        return
      }
      homeValue = home
      awayValue = away
    }

    if (!/^\d{2}:\d{2}$/.test(kickoffTime)) {
      toast.error('Kickoff time must be in HH:MM format.')
      return
    }

    if (homeTeamId === awayTeamId) {
      toast.error('Home and away teams must be different.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('matches')
      .update({
        home_score: homeValue,
        away_score: awayValue,
        status,
        kickoff_time: buildIsoFromLondonTime(match.kickoff_time, kickoffTime),
        court: court.trim() === '' ? null : court.trim(),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_umpire_no_show: homeUmpireNoShow,
        away_umpire_no_show: awayUmpireNoShow,
        home_late_minutes: homeNoShow ? 0 : parsedHomeLate,
        away_late_minutes: awayNoShow ? 0 : parsedAwayLate,
        home_no_show: homeNoShow,
        away_no_show: awayNoShow,
        scoresheet_url: scoresheetUrl,
      })
      .eq('id', match.id)

    setSaving(false)

    if (error) {
      toast.error(`Could not save: ${error.message}`)
      return
    }

    toast.success(anyChange ? 'Match updated (fixture changed)' : 'Score saved')
    onSave()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-entry-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-mk-red dark:text-mk-red">
            {ageGroupName}
          </p>
          <h2
            id="score-entry-title"
            className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {selectedHome.name} vs {selectedAway.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {formatLocalDate(match.kickoff_time)}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Teams
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="home-team"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Home
                </label>
                <select
                  id="home-team"
                  value={homeTeamId}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {sortedTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="away-team"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Away
                </label>
                <select
                  id="away-team"
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {sortedTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {sameTeamSelected && (
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                Home and away teams must be different.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter the on-court score. Any late-arrival deduction below is
              applied automatically to the final recorded score.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="home-score"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {selectedHome.name}{' '}
                  <span className="font-normal text-zinc-400">(on-court)</span>
                </label>
                <input
                  id="home-score"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {parsedHomeLate > 0 && homeScore.trim() !== '' && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Final:{' '}
                    <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {Number(homeScore) - parsedHomeLate * 2}
                    </span>{' '}
                    (−{parsedHomeLate * 2})
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="away-score"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {selectedAway.name}{' '}
                  <span className="font-normal text-zinc-400">(on-court)</span>
                </label>
                <input
                  id="away-score"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {parsedAwayLate > 0 && awayScore.trim() !== '' && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Final:{' '}
                    <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {Number(awayScore) - parsedAwayLate * 2}
                    </span>{' '}
                    (−{parsedAwayLate * 2})
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as MatchStatus)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Late arrivals & forfeits
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                2 goals/min · 4+ min or no-show = 10-0 forfeit
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 flex items-start gap-2 text-xs text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={homeNoShow}
                    onChange={(e) => handleNoShowToggle('home', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-400 text-mk-red focus:ring-mk-red"
                  />
                  <span>
                    <span className="font-medium">{selectedHome.name}</span>{' '}
                    did not turn up (no show)
                  </span>
                </label>
                <label
                  htmlFor="home-late"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {selectedHome.name} — mins late
                </label>
                <input
                  id="home-late"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={homeNoShow ? '' : homeMinsLate}
                  disabled={homeNoShow}
                  onChange={(e) => setHomeMinsLate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {homeNoShow && (
                  <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">
                    Forfeit (no show) — 10-0 to {selectedAway.name}
                  </p>
                )}
                {!homeNoShow && parsedHomeLate > 0 && !homeForfeit && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    concedes {parsedHomeLate * 2} goals
                  </p>
                )}
                {!homeNoShow && homeForfeit && (
                  <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">
                    Forfeit (late) — 10-0 to {selectedAway.name}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-2 flex items-start gap-2 text-xs text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={awayNoShow}
                    onChange={(e) => handleNoShowToggle('away', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-400 text-mk-red focus:ring-mk-red"
                  />
                  <span>
                    <span className="font-medium">{selectedAway.name}</span>{' '}
                    did not turn up (no show)
                  </span>
                </label>
                <label
                  htmlFor="away-late"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {selectedAway.name} — mins late
                </label>
                <input
                  id="away-late"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={awayNoShow ? '' : awayMinsLate}
                  disabled={awayNoShow}
                  onChange={(e) => setAwayMinsLate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {awayNoShow && (
                  <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">
                    Forfeit (no show) — 10-0 to {selectedHome.name}
                  </p>
                )}
                {!awayNoShow && parsedAwayLate > 0 && !awayForfeit && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    concedes {parsedAwayLate * 2} goals
                  </p>
                )}
                {!awayNoShow && awayForfeit && (
                  <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">
                    Forfeit (late) — 10-0 to {selectedHome.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {homeForfeit && (
                <button
                  type="button"
                  onClick={() => applyForfeit('home')}
                  className="rounded-md border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 shadow-sm transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/60"
                >
                  Record forfeit vs {selectedHome.name}
                </button>
              )}
              {awayForfeit && (
                <button
                  type="button"
                  onClick={() => applyForfeit('away')}
                  className="rounded-md border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 shadow-sm transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/60"
                >
                  Record forfeit vs {selectedAway.name}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Umpires
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                No umpire provided = −1 pt deduction
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={homeUmpireNoShow}
                  onChange={(e) => setHomeUmpireNoShow(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-400 text-mk-red focus:ring-mk-red"
                />
                <span>
                  <span className="font-medium">{selectedHome.name}</span>{' '}
                  did not provide an umpire
                  {homeUmpireNoShow && (
                    <span className="ml-2 rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      −1 pt
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={awayUmpireNoShow}
                  onChange={(e) => setAwayUmpireNoShow(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-400 text-mk-red focus:ring-mk-red"
                />
                <span>
                  <span className="font-medium">{selectedAway.name}</span>{' '}
                  did not provide an umpire
                  {awayUmpireNoShow && (
                    <span className="ml-2 rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      −1 pt
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Scoresheet
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Photo of the umpire&apos;s paper scoresheet
              </p>
            </div>
            <div className="flex items-start gap-3">
              {scoresheetUrl ? (
                <a
                  href={scoresheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open scoresheet in new tab"
                  className="block shrink-0 overflow-hidden rounded-md border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scoresheetUrl}
                    alt="Scoresheet"
                    className="h-20 w-20 object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                  No sheet
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => sheetInputRef.current?.click()}
                  disabled={uploadingSheet}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {uploadingSheet
                    ? 'Uploading…'
                    : scoresheetUrl
                      ? 'Replace'
                      : 'Capture / upload'}
                </button>
                {scoresheetUrl && (
                  <button
                    type="button"
                    onClick={() => setScoresheetUrl(null)}
                    disabled={uploadingSheet}
                    className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={sheetInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleScoresheetChange}
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Images are resized to 960&nbsp;px &amp; re-encoded as JPEG 50% on
              upload — typical size 60-120&nbsp;KB.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Schedule
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="kickoff-time"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Kickoff time
                </label>
                <input
                  id="kickoff-time"
                  type="time"
                  value={kickoffTime}
                  onChange={(e) => setKickoffTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label
                  htmlFor="court"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Court
                </label>
                <select
                  id="court"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">— None —</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={`Court ${n}`}>
                      Court {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {anyChange && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <p className="font-semibold">Fixture change detected</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {teamsChanged && (
                  <li>
                    Teams: {homeTeam.name} vs {awayTeam.name} →{' '}
                    <span className="font-semibold">
                      {selectedHome.name} vs {selectedAway.name}
                    </span>
                  </li>
                )}
                {kickoffTime !== originalTime && (
                  <li>
                    Kickoff: {originalTime} →{' '}
                    <span className="font-semibold">{kickoffTime}</span>
                  </li>
                )}
                {court.trim() !== originalCourt.trim() && (
                  <li>
                    Court: {originalCourt || '—'} →{' '}
                    <span className="font-semibold">{court || '—'}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2">
                Changes may create duplicate or missing fixtures, court clashes,
                or back-to-back games. Confirm this is intentional before saving.
              </p>
              <label className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmChange}
                  onChange={(e) => setConfirmChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-mk-red focus:ring-mk-red"
                />
                <span>I have checked for conflicts and want to apply this change.</span>
              </label>
            </div>
          )}

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
              disabled={submitDisabled}
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
