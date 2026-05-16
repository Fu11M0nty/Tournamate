'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { signInWithDevAdmin } from '@/lib/auth-actions'

function OAuthButton({
  onClick,
  disabled,
  loading,
  label,
  icon,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {icon}
      {loading ? 'Opening…' : label}
    </button>
  )
}

const GoogleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const FacebookIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.03 4.388 11.026 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.099 24 18.103 24 12.073z" />
  </svg>
)

const AppleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
)

function getSafeNextPath() {
  if (typeof window === 'undefined') return '/admin'
  const nextPath = new URLSearchParams(window.location.search).get('next')
  if (!nextPath || !nextPath.startsWith('/admin')) return '/admin'
  if (nextPath.startsWith('/admin/login') || nextPath.startsWith('/admin/signup')) return '/admin'
  if (nextPath.startsWith('//') || nextPath.includes('://')) return '/admin'
  return nextPath
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [devLoginPending, startDevLoginTransition] = useTransition()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setSubmitting(false)
      return
    }

    router.push(getSafeNextPath())
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'facebook') {
    setOauthLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${getSafeNextPath()}` },
    })
    // browser redirects — loading state intentionally not cleared
  }

  function handleDevLogin() {
    setError(null)
    startDevLoginTransition(async () => {
      const result = await signInWithDevAdmin()
      if (!result.success) {
        setError(result.error ?? 'Could not sign in as dev admin.')
        return
      }
      router.push(getSafeNextPath())
      router.refresh()
    })
  }

  const showDevLogin = process.env.NODE_ENV === 'development'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-5 flex justify-center">
          <svg viewBox="420 0 560 500" className="h-16 w-auto" aria-label="TournaMate" role="img">
            <image href="/Tournamate-removebg-preview2.svg" x="0" y="0" width="1436" height="696"/>
          </svg>
        </div>
        <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Admin sign in
        </h1>
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          Tournament organiser access only.
        </p>

        {/* OAuth buttons */}
        <div className="space-y-2">
          <OAuthButton
            onClick={() => handleOAuth('google')}
            loading={oauthLoading === 'google'}
            disabled={!!oauthLoading || submitting}
            label="Continue with Google"
            icon={<GoogleIcon />}
          />
          <OAuthButton
            onClick={() => handleOAuth('facebook')}
            loading={oauthLoading === 'facebook'}
            disabled={!!oauthLoading || submitting}
            label="Continue with Facebook"
            icon={<FacebookIcon />}
          />
          <OAuthButton
            onClick={() => {}}
            disabled
            label="Continue with Apple (coming soon)"
            icon={<AppleIcon />}
          />
        </div>

        {/* Divider */}
        <div className="relative my-5 flex items-center">
          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          <span className="mx-3 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            or
          </span>
          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !!oauthLoading || devLoginPending}
            className="w-full rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {showDevLogin && (
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={submitting || !!oauthLoading || devLoginPending}
              className="w-full rounded-md border border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/60"
            >
              {devLoginPending ? 'Signing in as dev admin...' : 'Sign in as dev admin'}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Local development only. Uses the server-only E2E admin credentials and still requires an approved admin profile.
            </p>
          </div>
        )}

        <p className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Want to use TournaMate?{' '}
          <Link
            href="/register-interest"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-mk-red hover:underline"
          >
            Register your interest
          </Link>
        </p>
      </div>
    </main>
  )
}
