'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

type Phase = 'checking' | 'ready' | 'invalid' | 'saving'

/**
 * Landing page for organiser invite / password-reset links.
 *
 * Lives OUTSIDE /admin on purpose: the invite link arrives with the session in
 * the URL hash (client-only), and the /admin middleware would redirect to login
 * before the browser could read it. Here the browser Supabase client establishes
 * the session from the hash, the organiser sets a password, and we send them on
 * to the admin console.
 */
export default function SetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      // The @supabase/ssr browser client may already have consumed the URL hash.
      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) {
        if (!cancelled) setPhase('ready')
        return
      }

      // Otherwise establish it from the hash tokens the invite link carries.
      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
        if (!cancelled) setPhase(sessionError ? 'invalid' : 'ready')
        return
      }

      if (!cancelled) setPhase('invalid')
    }

    ensureSession()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setPhase('saving')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setPhase('ready')
      return
    }
    toast.success('Password set — welcome to TournaMate.')
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Set your password
        </h1>
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a password to finish setting up your organiser account.
        </p>

        {phase === 'checking' && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifying your invite link…</p>
        )}

        {phase === 'invalid' && (
          <div className="space-y-3">
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              This invite link is invalid or has expired. Ask your organiser contact to send a new one.
            </p>
            <Link
              href="/admin/login"
              className="inline-block text-sm font-medium text-mk-red hover:underline"
            >
              Go to sign in
            </Link>
          </div>
        )}

        {(phase === 'ready' || phase === 'saving') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              disabled={phase === 'saving'}
              className="w-full rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === 'saving' ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
