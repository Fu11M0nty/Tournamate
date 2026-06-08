import Link from 'next/link'
import { createPublicSupabaseClient } from '@/lib/supabase'
import TournamentCard from '@/components/TournamentCard'
import type { Tournament } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ── Scrolling collage helpers ────────────────────────────────
const B = (f: string) => `/landing_background/${f}`

const ALL_IMAGES = [
  B('AW3_3576-3-1200x800-1.jpg'),
  B('badminton-1428046_1280.jpg'),
  B('ball-488717_640.jpg'),
  B('basketball-1511298_640.jpg'),
  B('basketball-1544370_640.jpg'),
  B('basketball-6687953_640.jpg'),
  B('beach-volleyball-6483796_640.jpg'),
  B('bike-5075071_640.webp'),
  B('boxing-62867_640.jpg'),
  B('champions-1490380_640.jpg'),
  B('competition-3304444_640.jpg'),
  B('cricket-5365720_640.jpg'),
  B('cricket-724615_640.jpg'),
  B('cricket-724617_640.jpg'),
  B('england_nz_fd_161125-109-min.webp'),
  B('fencing-1683514_640.jpg'),
  B('field-hockey-1537470_640.jpg'),
  B('football-7393809_640.jpg'),
  B('garbarnia-krakow-6716100_640.jpg'),
  B('golf-1284011_640.jpg'),
  B('golf-787826_640.png'),
  B('golf-83869_640.jpg'),
  B('gridiron-victoria-4584022_1280.jpg'),
  B('hockey-2744880_640.jpg'),
  B('hockey-2744907_640.jpg'),
  B('hockey-935951_640.jpg'),
  B('horse-1235911_640.jpg'),
  B('IMG-20260129-WA0016~2.jpg'),
  B('istockphoto-1354175053-2048x2048.jpg'),
  B('istockphoto-541848148-2048x2048.webp'),
  B('motocross-2450956_640.jpg'),
  B('muay-thai-2142472_640.jpg'),
  B('muay-thai-7028712_640.jpg'),
  B('original.webp'),
  B('people-1355500_640.jpg'),
  B('planet_fox-goalkeeper-7893178_640.jpg'),
  B('racket-9060826_640.jpg'),
  B('rugby-1430265_640.jpg'),
  B('rugby-4790435_640.jpg'),
  B('rugby-6905791_640.jpg'),
  B('rugby-ball-5722662_640.jpg'),
  B('shoes-1908428_640.webp'),
  B('speed-2224756_640.jpg'),
  B('sport-908267_640.jpg'),
  B('sports-5500917_640.jpg'),
  B('swimmer-3196296_640.jpg'),
  B('taekwondo-78119_640.jpg'),
  B('volleyball-team-1583668_640.jpg'),
  B('woman-6143052_1280.jpg'),
  B('women-655353_640.jpg'),
  B('womens-football-7541990_640.jpg'),
]

// Column configs: dir, duration (s), start offset (s, negative = already in progress)
const COLS = [
  { dir: 'up',   dur: 60,  delay:    0 },
  { dir: 'down', dur: 75,  delay:  -15 },
  { dir: 'up',   dur: 55,  delay:  -30 },
  { dir: 'down', dur: 80,  delay:   -5 },
  { dir: 'up',   dur: 65,  delay:  -20 },
  { dir: 'down', dur: 70,  delay:  -10 },
  { dir: 'up',   dur: 50,  delay:  -25 },
] as const

// Deterministic per-column shuffle so each column shows images in a different order
function colImages(colIdx: number): string[] {
  const imgs = [...ALL_IMAGES]
  for (let i = imgs.length - 1; i > 0; i--) {
    const j = (i * 2654435761 + colIdx * 1013904223) % (i + 1)
    ;[imgs[i], imgs[j]] = [imgs[j], imgs[i]]
  }
  return imgs
}

// The scrolling image wall — each column is an independent CSS-animated strip.
// Animation uses inline `style` (not Tailwind classes) to ensure the keyframe
// defined in globals.css is always applied, regardless of CSS purging.
function HeroCollage() {
  return (
    <div aria-hidden className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {COLS.map((col, ci) => {
        const doubled = [...colImages(ci), ...colImages(ci)]
        // Column visibility: 4 on mobile, 6 on md, 7 on lg
        const hiddenClass =
          ci === 6 ? 'hidden lg:flex' :
          ci >= 4  ? 'hidden md:flex' : 'flex'
        return (
          <div key={ci} className={`${hiddenClass} flex-1 min-w-0 overflow-hidden`}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                animation: `collage-scroll ${col.dur}s linear ${col.delay}s infinite ${col.dir === 'down' ? 'reverse' : 'normal'}`,
              }}
            >
              {doubled.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-full object-cover"
                  style={{ aspectRatio: '4/3' }}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const FEATURES = [
  { icon: '📊', label: 'Live standings' },
  { icon: '📅', label: 'Fixtures & schedules' },
  { icon: '✏️', label: 'Score entry' },
  { icon: '🏷️', label: 'Divisions, pools & phases' },
  { icon: '📱', label: 'QR score capture' },
  { icon: '⚖️', label: 'Scoring rules & tie-breakers' },
  { icon: '🔗', label: 'Public tournament links' },
]

const JOURNEY = [
  {
    step: '01', label: 'Plan', title: 'Build your structure',
    desc: 'Add divisions, pools and teams. Import from a spreadsheet or set up from scratch in minutes.',
  },
  {
    step: '02', label: 'Schedule', title: 'Generate your fixtures',
    desc: 'Auto-generate a round-robin or custom schedule. Set courts, kick-off times and phases.',
  },
  {
    step: '03', label: 'Run', title: 'Enter scores live',
    desc: 'Update results from the sideline. Standings refresh instantly. QR codes let scorers enter direct.',
  },
  {
    step: '04', label: 'Share', title: 'Go public instantly',
    desc: 'One link. Parents and players follow live standings, results and fixtures from any device.',
  },
  {
    step: '05', label: 'Review', title: 'Final results & history',
    desc: 'Full standings, results history and printable scorecards — preserved after the tournament ends.',
  },
]

const SPORTS = [
  'Football', 'Netball', 'Basketball', 'Hockey',
  'Rugby', 'Karate', 'Swimming', 'Athletics',
  'Tennis', 'Cricket', 'Volleyball', 'Badminton',
]

const USE_CASES = [
  { icon: '🏟️', label: 'Weekend tournaments' },
  { icon: '🏫', label: 'School leagues' },
  { icon: '🎉', label: 'Club festivals' },
  { icon: '🏆', label: 'Charity cups' },
  { icon: '🥋', label: 'Martial arts brackets' },
  { icon: '🔀', label: 'Multi-division events' },
]

const DEMO_STANDINGS = [
  { pos: 1, name: 'Riverside Rockets', pld: 3, pts: 15, gd: +18 },
  { pos: 2, name: 'North Vipers',      pld: 3, pts: 10, gd: +7  },
  { pos: 3, name: 'City Storm',        pld: 3, pts: 5,  gd: -4  },
  { pos: 4, name: 'West United',       pld: 3, pts: 0,  gd: -21 },
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
    <div className="text-[#1a2d4f] overflow-x-hidden">

      {/* ── Hero — has its own self-contained background ───────── */}
      <section className="relative overflow-hidden bg-[#0d1b2e]">

        {/* Scrolling sports image collage */}
        <HeroCollage />
        {/* Dark overlay — keeps hero readable while letting images show through */}
        <div className="absolute inset-0 bg-[#0d1b2e]/72 pointer-events-none" />
        {/* Subtle animated scan line accent */}
        <div className="tm-scan-line" />

        {/* Hero content — sits above all background layers */}
        <div className="relative z-10 py-24 px-4 md:px-10 max-w-[1440px] mx-auto flex flex-col items-center text-center">
          {liveCount > 0 && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {liveCount} live now
            </span>
          )}

          {/* Frosted glass backing keeps text readable over the image collage */}
          <div className="mb-10 rounded-2xl bg-white/70 backdrop-blur-md px-8 py-8 max-w-3xl shadow-sm">
            <h1 className="text-[clamp(32px,5.5vw,60px)] font-black leading-[1.1] tracking-[-0.04em] mb-5">
              Tournament Management,{' '}
              <span className="text-[#f47c20]">Mastered.</span>
            </h1>
            <p className="text-[20px] leading-[1.6] text-[#3a5270] max-w-2xl">
              From grassroots festivals to county championships — the all-in-one platform for tournament organisers.
              Live standings, automatic fixtures, and a public results page in minutes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/register-interest"
              className="bg-[#f47c20] text-white px-8 py-4 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-[#d4680f] transition-colors animate-cta-glow"
            >
              Start a Tournament
            </Link>
            <Link
              href="/explore"
              className="bg-[#4a9fd4] text-white px-8 py-4 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-[#3a8fc4] transition-colors"
            >
              Explore Live Tournaments
            </Link>
          </div>

          {/* Floating dashboard mockup — dark navy theme */}
          <div className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0f1e38] overflow-hidden shadow-[0_20px_60px_-12px_rgba(15,30,56,0.5)] animate-hero-float">
            <div className="absolute inset-0 bg-gradient-to-b from-[#4a9fd4]/10 to-transparent opacity-40" />

            {/* Chrome bar — no URL, just decorative dots */}
            <div className="relative z-10 px-4 py-3 border-b border-white/10 flex items-center bg-[#071524]/80 backdrop-blur-sm">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-white/20" />
                <div className="w-3 h-3 rounded-full bg-white/20" />
                <div className="w-3 h-3 rounded-full bg-white/20" />
              </div>
            </div>

            {/* Dashboard layout */}
            <div className="relative z-10 p-5 md:p-8 grid grid-cols-12 gap-4">
              {/* Sidebar */}
              <div className="col-span-3 space-y-2.5">
                <div className="h-7 bg-white/10 rounded w-3/4" />
                {['Dashboard', 'Fixtures', 'Standings', 'Teams', 'Score Entry'].map((item, i) => (
                  <div
                    key={item}
                    className={`h-8 rounded w-full flex items-center px-3 text-[11px] font-medium ${
                      i === 2
                        ? 'bg-[#f47c20]/20 border-l-2 border-[#f47c20] text-[#f47c20]'
                        : 'bg-white/5 text-white/40'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>

              {/* Main panel — live standings */}
              <div className="col-span-9 bg-[#071524] rounded-xl border border-white/10 p-5 min-h-[280px]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#4a9fd4]">
                    Under 11s · Saturday
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/40">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>

                <div className="mb-2 grid grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem] gap-x-3 pb-2 border-b border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/25">
                  <span>#</span><span>Team</span>
                  <span className="text-right">Pld</span>
                  <span className="text-right">GD</span>
                  <span className="text-right">Pts</span>
                </div>

                {DEMO_STANDINGS.map((row, i) => (
                  <div
                    key={row.pos}
                    className={`grid grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem] items-center gap-x-3 py-2.5 border-b border-white/5 last:border-0 ${
                      i === 0 ? 'border-l-2 border-[#f47c20] pl-2 -ml-2' : ''
                    }`}
                  >
                    <span className={`text-xs font-black tabular-nums ${i === 0 ? 'text-[#f47c20]' : 'text-white/25'}`}>
                      {row.pos}
                    </span>
                    <span className={`truncate text-xs font-semibold ${i === 0 ? 'text-white' : 'text-white/55'}`}>
                      {row.name}
                    </span>
                    <span className="text-right text-xs tabular-nums text-white/25">{row.pld}</span>
                    <span className={`text-right text-xs tabular-nums ${row.gd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </span>
                    <span className={`text-right text-xs font-black tabular-nums ${i === 0 ? 'text-[#f47c20]' : 'text-white/70'}`}>
                      {row.pts}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature strip ─────────────────────────────────────── */}
      <section className="py-12 border-y border-[#1a2d4f]/10 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 md:px-10 text-center">
          <p className="mb-8 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#1a2d4f]/40">
            Built for any sport · Ready in minutes
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {FEATURES.map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-[#1a2d4f]/5 px-4 py-2 text-sm font-semibold text-[#1a2d4f]/70 ring-1 ring-[#1a2d4f]/10"
              >
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured tournaments ───────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-16 px-4 md:px-10 max-w-[1440px] mx-auto bg-[#f4f6f9]">
          <header className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#4a9fd4]">
                Live &amp; Upcoming
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1a2d4f] sm:text-3xl">
                Tournaments to follow
              </h2>
            </div>
            <Link href="/explore" className="shrink-0 text-sm font-semibold text-[#4a9fd4] hover:opacity-80 transition-opacity">
              Browse all →
            </Link>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── Organiser journey ─────────────────────────────────── */}
      <section className="py-20 px-4 md:px-10 max-w-[1440px] mx-auto border-t border-[#1a2d4f]/10 bg-[#f4f6f9]">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#4a9fd4]">For Organisers</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1a2d4f] sm:text-3xl">
            How TournaMate works
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#5a7a96]">
            From blank canvas to live public results page — everything an organiser needs, in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY.map(({ step, label, title, desc }) => (
            <div key={step} className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#4a9fd4]/10 border border-[#4a9fd4]/30 shadow-[0_0_20px_-5px_rgba(74,159,212,0.3)]">
                <span className="text-xs font-black text-[#4a9fd4]">{step}</span>
              </div>
              <p className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-[#4a9fd4]">{label}</p>
              <h3 className="mt-1 text-base font-extrabold text-[#1a2d4f]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5a7a96]">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/register-interest"
            className="inline-flex items-center gap-2 rounded-lg bg-[#f47c20] text-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider animate-cta-glow hover:bg-[#d4680f] transition-colors"
          >
            Start your tournament free →
          </Link>
        </div>
      </section>

      {/* ── Multi-sport section ───────────────────────────────── */}
      <section className="py-20 px-4 md:px-10 max-w-[1440px] mx-auto border-t border-[#1a2d4f]/10 bg-white">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#4a9fd4]">
              Any Sport. Any Format.
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1a2d4f] sm:text-3xl">
              Built for every grassroots sport.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5a7a96]">
              Whether you run a football festival, a karate championship or a school swimming gala — TournaMate handles
              your structure, scoring rules, and results page without any code.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SPORTS.map((sport) => (
                <span
                  key={sport}
                  className="rounded-full bg-[#1a2d4f]/5 border border-[#1a2d4f]/10 px-3.5 py-1.5 text-xs font-semibold text-[#1a2d4f]/70"
                >
                  {sport}
                </span>
              ))}
              <span className="rounded-full bg-[#f47c20]/10 border border-[#f47c20]/30 px-3.5 py-1.5 text-xs font-semibold text-[#f47c20]">
                + more
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {USE_CASES.map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl bg-[#f4f6f9] border border-[#1a2d4f]/10 px-4 py-4"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-semibold text-[#1a2d4f]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-10 border-t border-[#1a2d4f]/10 bg-[#f4f6f9]">
        <div className="max-w-[1440px] mx-auto">
          <div className="relative rounded-2xl border border-[#1a2d4f]/10 bg-white overflow-hidden p-10 md:p-16 text-center shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-b from-[#4a9fd4]/5 to-transparent opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#4a9fd4]">
                Free for all organisers
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[#1a2d4f] sm:text-4xl">
                Ready to take your tournament online?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#5a7a96]">
                Join organisers using TournaMate to run smoother, more professional tournaments — at no cost.
              </p>

              {(allTournaments.length > 0 || totalTeams > 0 || totalMatches > 0) && (
                <div className="mt-8 mb-8 grid grid-cols-3 gap-6 max-w-sm mx-auto">
                  {[
                    { value: allTournaments.length || '—', label: 'Tournaments' },
                    { value: totalTeams || '—', label: 'Teams' },
                    { value: totalMatches || '—', label: 'Results' },
                  ].map(({ value, label }) => (
                    <div key={label}>
                      <p className="text-2xl font-black tabular-nums text-[#f47c20]">{value}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a2d4f]/40">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/register-interest"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#f47c20] text-white px-8 py-3.5 text-sm font-bold uppercase tracking-wider animate-cta-glow hover:bg-[#d4680f] transition-colors"
                >
                  Register your interest
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#1a2d4f]/25 text-[#1a2d4f] px-8 py-3.5 text-sm font-bold uppercase tracking-wider hover:bg-[#1a2d4f]/5 transition-colors"
                >
                  Explore tournaments
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
