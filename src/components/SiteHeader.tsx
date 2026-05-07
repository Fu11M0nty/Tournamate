'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function SiteHeader() {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setSigningOut(false)
    router.push('/')
    router.refresh()
  }

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    null

  const isLoggedIn = user != null && user !== undefined
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin') ?? false

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-tm-navy text-white shadow-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">

        {/* Logo */}
        <Link
          href="/"
          target={isAdmin ? '_blank' : undefined}
          rel={isAdmin ? 'noopener noreferrer' : undefined}
          className="flex shrink-0 items-center transition-transform hover:scale-[1.02]"
        >
          <svg viewBox="0 0 365 68" className="h-10 sm:h-12 w-auto" aria-label="TournaMate" role="img">
            <defs>
              <filter id="header-shadow">
                <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.3"/>
              </filter>
            </defs>
            <svg x="0" y="2" width="74" height="64" viewBox="420 0 560 500" overflow="hidden">
              <image href="/Tournamate-removebg-preview2.svg" x="0" y="0" width="1436" height="696"/>
            </svg>
            <text transform="translate(1.5,1.5)" y="50" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="44">
              <tspan x="82" fill="#1a4a6e">Tourna</tspan><tspan fill="#7a3a08">Mate</tspan>
            </text>
            <text transform="translate(0.75,0.75)" y="50" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="44">
              <tspan x="82" fill="#2d6a9e">Tourna</tspan><tspan fill="#b85510">Mate</tspan>
            </text>
            <text y="50" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="44" filter="url(#header-shadow)">
              <tspan x="82" fill="#4a9fd4">Tourna</tspan><tspan fill="#f47c20">Mate</tspan>
            </text>
          </svg>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Link
            href="/explore"
            className="text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            Explore
          </Link>
          {!isLoggedIn && (
            <Link
              href="/register-interest"
              className="text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              For Organisers
            </Link>
          )}
          {isLoggedIn && !isAdmin && (
            <Link
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              Admin Console
            </Link>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-3 sm:flex">
          {isLoggedIn && displayName && (
            <span className="text-xs font-medium text-white/60">{displayName}</span>
          )}
          {user !== undefined && (
            isLoggedIn ? (
              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <Link
                    href="/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-tm-orange px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-tm-orange-dark"
                  >
                    Admin Console ↗
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            ) : (
              <Link
                href="/admin/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-tm-orange px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-tm-orange-dark"
              >
                Sign In
              </Link>
            )
          )}
        </div>

        {/* Mobile: auth button + hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          {user !== undefined && (
            isLoggedIn ? (
              <div className="flex items-center gap-1.5">
                {!isAdmin && (
                  <Link
                    href="/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-tm-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-tm-orange-dark"
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 disabled:opacity-60"
                >
                  {signingOut ? '…' : 'Sign Out'}
                </button>
              </div>
            ) : (
              <Link
                href="/admin/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-tm-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-tm-orange-dark"
              >
                Sign In
              </Link>
            )
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-tm-navy px-4 pb-4 sm:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            <Link
              href="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Explore tournaments
            </Link>
            {!isLoggedIn && (
              <Link
                href="/register-interest"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                For Organisers
              </Link>
            )}
            {isLoggedIn && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
