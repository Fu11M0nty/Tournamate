'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type { Match, Team } from '@/lib/types'

const SCORESHEET_BUCKET = 'scoresheets'
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

type Step = 'score' | 'late_home' | 'late_away' | 'photos' | 'success'
type Punctuality = 'ontime' | 'late' | 'noshow'

interface CapturedPhoto {
  previewUrl: string
  storedUrl: string
}

interface Props {
  match: Match
  homeTeam: Team
  awayTeam: Team
  ageGroupName: string
}

const STEPS: Step[] = ['score', 'late_home', 'late_away', 'photos', 'success']
const STEP_LABELS = ['Score', 'Home', 'Away', 'Photos', 'Done']

const PUNCTUALITY_OPTIONS: { value: Punctuality; label: string; desc: string }[] = [
  { value: 'ontime', label: '✅ On time', desc: 'Arrived ready to play' },
  { value: 'late', label: '⏱ Late', desc: 'Arrived after the scheduled start' },
  { value: 'noshow', label: '❌ Did not show', desc: 'Team failed to appear' },
]

export default function CaptureForm({
  match,
  homeTeam,
  awayTeam,
  ageGroupName,
}: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('score')

  // Step 1 — scores
  const [homeScore, setHomeScore] = useState(
    match.home_score !== null ? String(match.home_score) : '',
  )
  const [awayScore, setAwayScore] = useState(
    match.away_score !== null ? String(match.away_score) : '',
  )

  // Step 2 — home punctuality
  const [homePunctuality, setHomePunctuality] = useState<Punctuality | null>(null)
  const [homeLateMinutes, setHomeLateMinutes] = useState('')

  // Step 3 — away punctuality
  const [awayPunctuality, setAwayPunctuality] = useState<Punctuality | null>(null)
  const [awayLateMinutes, setAwayLateMinutes] = useState('')

  // Step 4 — photos
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  const kickoff = new Date(match.kickoff_time)
  const timeStr = kickoff.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const homeVal = homeScore === '' ? null : parseInt(homeScore, 10)
  const awayVal = awayScore === '' ? null : parseInt(awayScore, 10)
  const scoresValid =
    homeVal !== null &&
    awayVal !== null &&
    !isNaN(homeVal) &&
    !isNaN(awayVal) &&
    homeVal >= 0 &&
    awayVal >= 0

  // ── Photo helpers ───────────────────────────────────────────

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('Image too large (max 20 MB).')
      return
    }
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  async function confirmPhoto() {
    if (!pendingFile || !pendingPreview) return
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(pendingFile, 1280, 0.65)
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
      const { data: pub } = supabase.storage
        .from(SCORESHEET_BUCKET)
        .getPublicUrl(path)
      setPhotos((prev) => [
        ...prev,
        { previewUrl: pendingPreview, storedUrl: pub.publicUrl },
      ])
      setPendingFile(null)
      setPendingPreview(null)
      toast.success('Photo saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function retakePhoto() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(null)
    setPendingPreview(null)
  }

  // ── Final submission ────────────────────────────────────────

  async function handleSubmit() {
    if (!scoresValid) return
    setSubmitting(true)

    const homeLate =
      homePunctuality === 'late'
        ? Math.max(1, parseInt(homeLateMinutes, 10) || 1)
        : 0
    const awayLate =
      awayPunctuality === 'late'
        ? Math.max(1, parseInt(awayLateMinutes, 10) || 1)
        : 0
    const scoresheetUrl =
      photos.length > 0
        ? photos.map((p) => p.storedUrl).join('|')
        : undefined

    const { error } = await supabase
      .from('matches')
      .update({
        home_score: homeVal,
        away_score: awayVal,
        status: 'completed',
        home_no_show: homePunctuality === 'noshow',
        away_no_show: awayPunctuality === 'noshow',
        home_late_minutes: homeLate,
        away_late_minutes: awayLate,
        ...(scoresheetUrl !== undefined && { scoresheet_url: scoresheetUrl }),
      })
      .eq('id', match.id)

    setSubmitting(false)
    if (error) {
      toast.error(`Save failed: ${error.message}`)
      return
    }
    setStep('success')
  }

  // ── Shared UI pieces ────────────────────────────────────────

  const progressBar = step !== 'success' && (
    <div className="flex items-end gap-1 px-4 pt-4 pb-2">
      {STEPS.slice(0, -1).map((s, i) => {
        const done = stepIndex > i
        const active = stepIndex === i
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                done
                  ? 'bg-mk-red'
                  : active
                    ? 'bg-mk-red/40'
                    : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
            <span
              className={`text-[10px] font-semibold ${
                active
                  ? 'text-mk-red'
                  : done
                    ? 'text-mk-red/60'
                    : 'text-zinc-400'
              }`}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
        )
      })}
    </div>
  )

  const matchHeader = (
    <div className="mb-5 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {ageGroupName}
        {match.court && ` · ${match.court}`} · {timeStr}
      </p>
      <p className="mt-0.5 text-base font-bold text-zinc-900 dark:text-zinc-50">
        {homeTeam.name}{' '}
        <span className="font-normal text-zinc-400">vs</span>{' '}
        {awayTeam.name}
      </p>
    </div>
  )

  const backBtn = (target: Step) => (
    <button
      type="button"
      onClick={() => setStep(target)}
      className="flex-1 rounded-xl border border-zinc-300 py-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      ← Back
    </button>
  )

  const nextBtn = (onClick: () => void, disabled: boolean, label = 'Next →') => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex-[2] rounded-xl bg-mk-red py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  )

  const wrap = 'mx-auto min-h-screen max-w-sm bg-zinc-50 dark:bg-zinc-950'
  const body = 'px-4 pb-8'

  // ── Step 1: Score entry ─────────────────────────────────────

  if (step === 'score')
    return (
      <div className={wrap}>
        {progressBar}
        <div className={body}>
          {matchHeader}
          <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Enter final scores
          </h2>
          <div className="space-y-4">
            {(
              [
                {
                  label: homeTeam.name,
                  side: 'Home',
                  value: homeScore,
                  set: setHomeScore,
                },
                {
                  label: awayTeam.name,
                  side: 'Away',
                  value: awayScore,
                  set: setAwayScore,
                },
              ] as {
                label: string
                side: string
                value: string
                set: (v: string) => void
              }[]
            ).map(({ label, side, value, set }) => (
              <div key={side}>
                <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {label}{' '}
                  <span className="font-normal text-zinc-400">({side})</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-3xl font-black text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-2 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!scoresValid}
            onClick={() => setStep('late_home')}
            className="mt-6 w-full rounded-xl bg-mk-red py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    )

  // ── Step 2: Home punctuality ────────────────────────────────

  if (step === 'late_home')
    return (
      <div className={wrap}>
        {progressBar}
        <div className={body}>
          {matchHeader}
          <h2 className="mb-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {homeTeam.name}
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Did the home team arrive on time?
          </p>
          <div className="space-y-2">
            {PUNCTUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHomePunctuality(opt.value)}
                className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  homePunctuality === opt.value
                    ? 'border-mk-red bg-mk-red/5 dark:bg-mk-red/10'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {opt.label}
                </span>
                <span className="block text-xs text-zinc-500">{opt.desc}</span>
              </button>
            ))}
          </div>
          {homePunctuality === 'late' && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                How many minutes late?
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={homeLateMinutes}
                onChange={(e) => setHomeLateMinutes(e.target.value)}
                placeholder="e.g. 5"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-bold text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-2 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {backBtn('score')}
            {nextBtn(
              () => setStep('late_away'),
              !homePunctuality ||
                (homePunctuality === 'late' && !homeLateMinutes),
            )}
          </div>
        </div>
      </div>
    )

  // ── Step 3: Away punctuality ────────────────────────────────

  if (step === 'late_away')
    return (
      <div className={wrap}>
        {progressBar}
        <div className={body}>
          {matchHeader}
          <h2 className="mb-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {awayTeam.name}
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Did the away team arrive on time?
          </p>
          <div className="space-y-2">
            {PUNCTUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAwayPunctuality(opt.value)}
                className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  awayPunctuality === opt.value
                    ? 'border-mk-red bg-mk-red/5 dark:bg-mk-red/10'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {opt.label}
                </span>
                <span className="block text-xs text-zinc-500">{opt.desc}</span>
              </button>
            ))}
          </div>
          {awayPunctuality === 'late' && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                How many minutes late?
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={awayLateMinutes}
                onChange={(e) => setAwayLateMinutes(e.target.value)}
                placeholder="e.g. 5"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-bold text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-2 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {backBtn('late_home')}
            {nextBtn(
              () => setStep('photos'),
              !awayPunctuality ||
                (awayPunctuality === 'late' && !awayLateMinutes),
            )}
          </div>
        </div>
      </div>
    )

  // ── Step 4: Photo capture ───────────────────────────────────

  if (step === 'photos')
    return (
      <div className={wrap}>
        {progressBar}
        <div className={body}>
          {matchHeader}
          <h2 className="mb-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Capture scorecard
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Take a clear photo of the completed scorecard. You can add multiple
            photos (e.g. front and back).
          </p>

          {/* Pending photo — confirm or retake */}
          {pendingPreview ? (
            <div className="mb-4">
              <div className="relative mb-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingPreview}
                  alt="Preview"
                  className="w-full object-contain"
                  style={{ maxHeight: '50vh' }}
                />
              </div>
              <p className="mb-3 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Is this photo clear and readable?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={uploadingPhoto}
                  className="flex-1 rounded-xl border border-zinc-300 py-3.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  ✗ Retake
                </button>
                <button
                  type="button"
                  onClick={confirmPhoto}
                  disabled={uploadingPhoto}
                  className="flex-[2] rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading…' : '✓ Looks good'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Already-confirmed photos */}
              {photos.length > 0 && (
                <div className="mb-4 space-y-2">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.previewUrl}
                        alt={`Photo ${i + 1}`}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        ✓ Photo {i + 1} saved
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Camera trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-zinc-300 bg-white py-8 text-center transition-colors hover:border-mk-red hover:bg-mk-red/5 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-mk-red"
              >
                <div className="mb-1 text-4xl">📷</div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {photos.length === 0 ? 'Take a photo' : 'Add another photo'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">Tap to open camera</p>
              </button>

              {/* Submit / Back */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full rounded-xl bg-mk-red py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting
                    ? 'Saving…'
                    : photos.length === 0
                      ? 'Submit without photo'
                      : `Submit with ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('late_away')}
                  className="w-full rounded-xl border border-zinc-300 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )

  // ── Step 5: Success ─────────────────────────────────────────

  return (
    <div className={wrap}>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 text-6xl">✅</div>
        <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Score recorded!
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          {ageGroupName} · {homeTeam.name} vs {awayTeam.name}
        </p>

        {/* Score summary card */}
        <div className="mb-6 w-full rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="mb-1 text-xs font-semibold text-zinc-500">
                {homeTeam.name}
              </p>
              <p className="text-5xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">
                {homeScore}
              </p>
            </div>
            <div className="text-2xl font-light text-zinc-300">—</div>
            <div className="text-center">
              <p className="mb-1 text-xs font-semibold text-zinc-500">
                {awayTeam.name}
              </p>
              <p className="text-5xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">
                {awayScore}
              </p>
            </div>
          </div>

          {(homePunctuality !== 'ontime' || awayPunctuality !== 'ontime') && (
            <div className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-left dark:border-zinc-800">
              {homePunctuality === 'late' && (
                <p className="text-xs text-zinc-500">
                  {homeTeam.name} arrived {homeLateMinutes} min late
                </p>
              )}
              {homePunctuality === 'noshow' && (
                <p className="text-xs text-red-500">
                  {homeTeam.name} did not show
                </p>
              )}
              {awayPunctuality === 'late' && (
                <p className="text-xs text-zinc-500">
                  {awayTeam.name} arrived {awayLateMinutes} min late
                </p>
              )}
              {awayPunctuality === 'noshow' && (
                <p className="text-xs text-red-500">
                  {awayTeam.name} did not show
                </p>
              )}
            </div>
          )}

          {photos.length > 0 && (
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-emerald-600 dark:border-zinc-800 dark:text-emerald-400">
              📷 {photos.length} scorecard photo
              {photos.length > 1 ? 's' : ''} attached
            </p>
          )}
        </div>

        <a
          href="/admin"
          className="w-full rounded-xl border border-zinc-300 py-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Back to admin
        </a>
      </div>
    </div>
  )
}
