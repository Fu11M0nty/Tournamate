'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Step = 'form' | 'pending'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { organisation_name: orgName },
      },
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setStep('pending')
    }
  }

  async function handleGoogle() {
    setOauthLoading('google')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    })
  }

  if (step === 'pending') {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-tm-orange/10 text-5xl">
            🎉
          </div>
          <h1 className="text-2xl font-black tracking-tight text-tm-navy">
            Application submitted!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Thanks for signing up to TournaMate. Your account is currently pending approval. We&apos;ll review your application and get you set up shortly.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            If you registered with email, check your inbox to confirm your address.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-tm-orange px-7 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/30 hover:bg-tm-orange-dark"
          >
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 inline-block">
          <div className="rounded-xl bg-white px-4 py-2 shadow-md">
            <div className="relative h-14 w-48">
              <Image src="/Tournamate.png" alt="TournaMate" fill sizes="192px" className="object-contain" />
            </div>
          </div>
        </Link>

        <h1 className="text-2xl font-black tracking-tight text-tm-navy">
          Create your organiser account
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Free to sign up. We&apos;ll approve your account before you can go live.
        </p>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading === 'google' || loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-zinc-400">or sign up with email</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="orgName" className="mb-1 block text-xs font-semibold text-zinc-600">
              Club / Organisation name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Milton Keynes Netball Club"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-tm-navy placeholder-zinc-400 outline-none transition-all focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold text-zinc-600">
              Email address <span className="text-tm-orange">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-tm-navy placeholder-zinc-400 outline-none transition-all focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-zinc-600">
              Password <span className="text-tm-orange">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-tm-navy placeholder-zinc-400 outline-none transition-all focus:border-tm-orange focus:ring-2 focus:ring-tm-orange/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || oauthLoading !== null || !email || !password}
            className="mt-2 w-full rounded-xl bg-tm-orange py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/30 transition-all hover:bg-tm-orange-dark disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/admin/login" className="font-semibold text-tm-orange hover:text-tm-orange-dark">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
