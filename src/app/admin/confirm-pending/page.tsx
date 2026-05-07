'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const COOLDOWN_SECONDS = 60

export default function ConfirmPendingPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0) return
    setResending(true)
    setMessage(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      setMessage({ text: error.message, ok: false })
    } else {
      setMessage({ text: 'Confirmation email sent — check your inbox.', ok: true })
      setCooldown(COOLDOWN_SECONDS)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          <svg
            className="h-6 w-6 text-amber-600 dark:text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Verify your email
        </h1>
        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
          We sent a confirmation link to:
        </p>
        {email ? (
          <p className="mb-4 rounded-md bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {email}
          </p>
        ) : (
          <p className="mb-4 text-sm italic text-zinc-400">Loading…</p>
        )}
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          Click the link in the email to activate your account. Check your spam
          folder if it doesn&apos;t arrive within a few minutes.
        </p>

        {/* Resend feedback */}
        {message && (
          <p
            role="alert"
            className={[
              'mb-3 rounded-md border px-3 py-2 text-sm',
              message.ok
                ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
            ].join(' ')}
          >
            {message.text}
          </p>
        )}

        {/* Resend button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0 || !email}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {resending
            ? 'Sending…'
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : 'Resend confirmation email'}
        </button>

        <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-left text-sm text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Sign in with a different account →
          </button>
          <Link
            href="/admin/login"
            className="block text-sm font-medium text-mk-red hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
