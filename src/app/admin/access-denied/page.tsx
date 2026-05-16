'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminAccessDeniedPage() {
  const [signingOut, setSigningOut] = useState(false)
  const supabase = createClient()

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-red-900/60 bg-zinc-900 p-6 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
          Access denied
        </p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-50">
          Approved organiser access required
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          You are signed in, but this account is not approved for the admin console.
          Ask a superadmin to approve your profile or assign an organiser role.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
          <Link
            href="/"
            className="flex-1 rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Back to public site
          </Link>
        </div>
      </div>
    </main>
  )
}
