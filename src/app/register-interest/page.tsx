'use client'

import { useState } from 'react'
import Link from 'next/link'

const SPORTS = [
  'Netball', 'Football', 'Basketball', 'Rugby Union', 'Rugby League',
  'Cricket', 'Tennis', 'Volleyball', 'Hockey (Field)', 'Ice Hockey',
  'Badminton', 'Table Tennis', 'Squash', 'Swimming', 'Athletics',
  'Cycling', 'Gymnastics', 'Martial Arts', 'Other',
]

const TOURNAMENT_TYPES = [
  'Community / Grassroots Tournament',
  'Club Day',
  'County / Regional Championship',
  'National Championship',
  'School Tournament',
  'University / College Tournament',
  'Corporate Event',
  'Charity Event',
  'League Season',
  'Cup Competition',
  'Other',
]

const FORMATS = [
  'Round Robin (everyone plays everyone)',
  'Knockout / Cup',
  'League + Playoffs',
  'Round Robin + Knockout Finals',
  'Swiss System',
  'Mixed / Not sure yet',
]

const TEAM_COUNTS = [
  '2 – 4 teams',
  '5 – 8 teams',
  '9 – 12 teams',
  '13 – 20 teams',
  '21 – 32 teams',
  '33 or more teams',
]

type FormState = {
  name: string
  organisation: string
  email: string
  phone: string
  sport: string
  tournamentType: string
  format: string
  teamCount: string
  location: string
  expectedDate: string
  notes: string
}

const EMPTY: FormState = {
  name: '', organisation: '', email: '', phone: '',
  sport: '', tournamentType: '', format: '', teamCount: '',
  location: '', expectedDate: '', notes: '',
}

export default function RegisterInterestPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/register-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-6 py-16">
        <div className="rounded-xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-black text-tm-navy">We&apos;ve received your interest!</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Thanks for reaching out. We&apos;ll review your details and get back to you shortly to get you set up on TournaMate.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-tm-orange px-7 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark"
          >
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6">
      {/* Page header */}
      <div className="mb-8 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-tm-orange">
          Early Access
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-tm-navy sm:text-3xl">
          Register Your Interest
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
          Tell us about your tournament and we&apos;ll get in touch to get you set up — completely free.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* Contact details */}
          <fieldset className="space-y-5">
            <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-400">
              Contact Details
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Full Name" required>
                <TextInput
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </Field>
              <Field label="Organisation / Club" required>
                <TextInput
                  value={form.organisation}
                  onChange={e => set('organisation', e.target.value)}
                  placeholder="Riverside Netball Club"
                  required
                />
              </Field>
              <Field label="Email Address" required>
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </Field>
              <Field label="Phone Number">
                <TextInput
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+44 7700 000000"
                />
              </Field>
            </div>
          </fieldset>

          <hr className="border-zinc-100" />

          {/* Tournament details */}
          <fieldset className="space-y-5">
            <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-400">
              Tournament Details
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Sport" required>
                <SelectInput
                  value={form.sport}
                  onChange={e => set('sport', e.target.value)}
                  required
                >
                  <option value="">Select a sport…</option>
                  {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectInput>
              </Field>
              <Field label="Type of Tournament" required>
                <SelectInput
                  value={form.tournamentType}
                  onChange={e => set('tournamentType', e.target.value)}
                  required
                >
                  <option value="">Select a type…</option>
                  {TOURNAMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </SelectInput>
              </Field>
              <Field label="Expected Format" required>
                <SelectInput
                  value={form.format}
                  onChange={e => set('format', e.target.value)}
                  required
                >
                  <option value="">Select a format…</option>
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </SelectInput>
              </Field>
              <Field label="Number of Teams" required>
                <SelectInput
                  value={form.teamCount}
                  onChange={e => set('teamCount', e.target.value)}
                  required
                >
                  <option value="">Select a range…</option>
                  {TEAM_COUNTS.map(t => <option key={t} value={t}>{t}</option>)}
                </SelectInput>
              </Field>
              <Field label="Location / Region">
                <TextInput
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. West Midlands"
                />
              </Field>
              <Field label="Expected Tournament Date">
                <TextInput
                  value={form.expectedDate}
                  onChange={e => set('expectedDate', e.target.value)}
                  placeholder="e.g. June 2025, Summer TBC"
                />
              </Field>
            </div>
          </fieldset>

          <hr className="border-zinc-100" />

          {/* Notes */}
          <Field label="Anything else we should know?">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={4}
              placeholder="Tell us more — number of divisions, specific features you need, questions…"
              className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus:border-tm-orange focus:outline-none focus:ring-1 focus:ring-tm-orange"
            />
          </Field>

          {status === 'error' && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-full bg-tm-orange py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Sending…' : 'Register My Interest'}
          </button>

          <p className="text-center text-xs text-zinc-400">
            Already have an account?{' '}
            <Link href="/admin/login" target="_blank" rel="noopener noreferrer" className="text-tm-orange hover:underline">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-tm-orange">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      {...props}
      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-tm-orange focus:outline-none focus:ring-1 focus:ring-tm-orange disabled:opacity-50"
    />
  )
}

function SelectInput({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus:border-tm-orange focus:outline-none focus:ring-1 focus:ring-tm-orange"
    >
      {children}
    </select>
  )
}

