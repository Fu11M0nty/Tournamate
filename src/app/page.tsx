import Image from 'next/image'
import Link from 'next/link'
import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentCard from '@/components/TournamentCard'
import type { Tournament } from '@/lib/types'

export const dynamic = 'force-dynamic'

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: '🙋',
    title: 'Sign up',
    desc: "Create your free TournaMate account. We'll review your application and approve you quickly.",
  },
  {
    step: '02',
    icon: '⚙️',
    title: 'Set up',
    desc: 'Add your age groups, teams and schedule. Import from a spreadsheet or build from scratch.',
  },
  {
    step: '03',
    icon: '🚀',
    title: 'Go live',
    desc: 'Share your tournament link. Parents and players follow live standings and results in real time.',
  },
]

export default async function HomePage() {
  const supabase = createPublicSupabaseClient()

  const [tournamentsRes, teamsRes, matchesRes] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: true }),
    supabase.from('teams').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'completed').is('deleted_at', null),
  ])

  const allTournaments = (tournamentsRes.data ?? []) as Tournament[]
  const totalTeams = teamsRes.count ?? 0
  const totalMatches = matchesRes.count ?? 0
  const liveCount = allTournaments.filter((t) => t.status === 'live').length

  const featured = allTournaments
    .filter((t) => t.status === 'live' || t.status === 'upcoming')
    .slice(0, 6)

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88svh] flex-col justify-end overflow-hidden">
        <Image
          src="/AW3_3576-3-1200x800-1.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: '75% 35%' }}
          priority
        />
        {/* Gradient: shows image mid-screen, fades to navy at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-tm-navy via-tm-navy/55 to-tm-navy/25" />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 sm:px-8 sm:pb-24">
          {liveCount > 0 && (
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400 ring-1 ring-emerald-500/40 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {liveCount} live now
            </span>
          )}
          <h1 className="mt-2 max-w-2xl text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Every tournament,{' '}
            <span className="text-tm-orange">live</span>{' '}
            and online.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            Discover live standings, results and fixtures — or run your own grassroots tournament in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full bg-tm-orange px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/40 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark active:translate-y-0"
            >
              Find a tournament
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/register-interest"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0"
            >
              Run yours free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <section className="bg-tm-navy py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {[
            { value: allTournaments.length, label: 'Tournaments' },
            { value: '15+', label: 'Sports' },
            { value: totalTeams, label: 'Teams' },
            { value: totalMatches, label: 'Results recorded' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-black tabular-nums text-tm-orange sm:text-4xl">
                {value}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured tournaments ─────────────────────────────────────── */}
      <section className="bg-tm-slate py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <header className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-tm-orange">
                Live &amp; Upcoming
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-tm-navy sm:text-3xl">
                Tournaments to follow
              </h2>
            </div>
            <Link
              href="/explore"
              className="shrink-0 text-sm font-semibold text-tm-orange transition-colors hover:text-tm-orange-dark"
            >
              Browse all →
            </Link>
          </header>

          {featured.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-tm-navy/20 bg-white p-10 text-center">
              <p className="text-sm text-zinc-500">No upcoming tournaments yet.</p>
              <Link
                href="/register-interest"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-tm-orange hover:text-tm-orange-dark"
              >
                Create the first one →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">

          {/* Action photo */}
          <div className="relative min-h-[340px] lg:min-h-0">
            <Image
              src="/IMG-20260129-WA0016~2.jpg"
              alt="Grassroots netball players competing for the ball"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover"
              style={{ objectPosition: 'center 15%' }}
            />
          </div>

          {/* Content */}
          <div className="px-8 py-16 lg:px-12 lg:py-20">
            <div className="mx-auto max-w-xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-tm-orange">
                For organisers
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-tm-navy sm:text-3xl">
                Your tournament, live in minutes
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                No spreadsheets. No group chats. Just a clean, professional results page your players and families will love.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {HOW_IT_WORKS.map(({ step, icon, title, desc }) => (
                  <div key={step} className="relative rounded-2xl bg-tm-slate p-6">
                    <span className="absolute -top-3.5 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-tm-orange text-xs font-black text-white shadow-md shadow-tm-orange/30">
                      {step}
                    </span>
                    <div className="mt-3 text-4xl">{icon}</div>
                    <h3 className="mt-3 text-base font-extrabold text-tm-navy">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link
                  href="/register-interest"
                  className="inline-flex items-center gap-2 rounded-full bg-tm-orange px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark"
                >
                  Upcoming tournament
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Split image CTA ──────────────────────────────────────────── */}
      <section className="overflow-hidden bg-tm-navy">
        <div className="mx-auto grid max-w-none grid-cols-1 lg:grid-cols-2">
          {/* Image panel */}
          <div className="relative min-h-[420px] lg:min-h-[560px]">
            <Image
              src="/original.webp"
              alt="Netball action"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              style={{ objectPosition: 'center top' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-tm-navy/70 hidden lg:block" />
          </div>

          {/* Text panel */}
          <div className="flex flex-col justify-center px-8 py-14 lg:px-14 lg:py-20">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-tm-orange">
              Grassroots to competitive
            </p>
            <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
              Every tournament deserves a professional presence.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
              From local club days to county championships — TournaMate gives every organiser the tools that were once only available to the elite. Live results, automatic standings and shareable links, all for free.
            </p>
            <Link
              href="/register-interest"
              className="mt-9 inline-flex w-fit items-center gap-2 rounded-full bg-tm-orange px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark"
            >
              Get started free
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Full-bleed image CTA ─────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28 sm:py-36">
        <Image
          src="/england_nz_fd_161125-109-min.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: 'center 25%' }}
        />
        <div className="absolute inset-0 bg-tm-navy/70" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-tm-orange">
            Trusted by grassroots organisers across the UK
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Ready to take your tournament online?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60">
            Join organisers using TournaMate to run smoother, more professional tournaments — at no cost.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/register-interest"
              className="inline-flex items-center gap-2 rounded-full bg-tm-orange px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-tm-orange/30 transition-all hover:-translate-y-0.5 hover:bg-tm-orange-dark"
            >
              REGISTER Your Interest
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
            >
              Explore tournaments
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
