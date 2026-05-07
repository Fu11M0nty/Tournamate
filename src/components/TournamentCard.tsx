import Link from 'next/link'
import type { Tournament } from '@/lib/types'

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  upcoming: 'bg-amber-100 text-amber-700 ring-amber-200',
  complete: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500 animate-pulse',
  upcoming: 'bg-amber-500',
  complete: 'bg-zinc-400',
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Date TBC'
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso))
  if (!end || end === start) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

interface Props {
  tournament: Tournament
  showCity?: boolean
}

export default function TournamentCard({ tournament: t, showCity = true }: Props) {
  const sport = t.sport ?? 'Netball'
  const city = t.venue_city ?? null
  const statusStyle = STATUS_STYLE[t.status] ?? STATUS_STYLE.upcoming
  const statusDot = STATUS_DOT[t.status] ?? STATUS_DOT.upcoming

  return (
    <Link
      href={`/${t.slug}`}
      className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-tm-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-tm-orange hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-tm-navy/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-tm-navy/70">
            {sport}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${statusStyle}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            {t.status}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-extrabold leading-tight tracking-tight text-tm-navy dark:text-zinc-50">
          {t.name}
        </h3>

        {showCity && city && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {city}
          </p>
        )}

        <p className="mt-1 text-xs text-zinc-400">
          {formatDateRange(t.start_date, t.end_date)}
        </p>

        {t.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {t.description}
          </p>
        )}
      </div>

      <span className="inline-flex items-center text-xs font-semibold text-tm-orange">
        View tournament
        <span
          aria-hidden="true"
          className="ml-1 transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
    </Link>
  )
}
