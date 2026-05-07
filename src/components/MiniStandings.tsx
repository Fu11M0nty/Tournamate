import Link from 'next/link'
import TeamLogo from './TeamLogo'
import type { AgeGroup, Match, StandingRow } from '@/lib/types'

interface MiniStandingsProps {
  tournamentSlug: string
  group: AgeGroup
  standings: StandingRow[]
  matches: Match[]
}

export default function MiniStandings({
  tournamentSlug,
  group,
  standings,
  matches,
}: MiniStandingsProps) {
  const totalMatches = matches.length
  const completedMatches = matches.filter((m) => m.status === 'completed').length
  const allComplete = totalMatches > 0 && completedMatches === totalMatches

  const top = standings.slice(0, 4)
  const placeholderRows = Math.max(0, 4 - top.length)

  return (
    <Link
      href={`/${tournamentSlug}/${group.day}/${group.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-tm-navy/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-tm-orange hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-tm-orange"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-tm-navy/10 bg-tm-slate/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-extrabold tracking-tight text-tm-navy dark:text-zinc-50">
          {group.name}
        </h3>
        <p className="text-[11px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">
          {completedMatches}/{totalMatches} played
        </p>
      </header>

      <ul className="divide-y divide-tm-navy/5 dark:divide-zinc-800/60">
        {top.map((row) => (
          <li
            key={row.team.id}
            className={
              row.position === 1
                ? 'flex items-center gap-2 bg-tm-orange/10 px-4 py-2 dark:bg-tm-orange/5'
                : 'flex items-center gap-2 px-4 py-2'
            }
          >
            <span
              className={
                row.position === 1
                  ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tm-orange text-[11px] font-bold tabular-nums text-white'
                  : 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }
            >
              {row.position}
            </span>
            <TeamLogo team={row.team} size="sm" />
            <span className="flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {row.team.name}
            </span>
            {allComplete && row.position === 1 && (
              <span aria-hidden="true" title="Group winner">🏆</span>
            )}
            {allComplete && row.position === 2 && (
              <span aria-hidden="true" title="Runner-up">🥈</span>
            )}
            <span className="ml-1 inline-block min-w-[1.75rem] rounded-md bg-zinc-900 px-1.5 py-0.5 text-center text-xs font-extrabold tabular-nums text-white dark:bg-white dark:text-zinc-900">
              {row.points}
            </span>
          </li>
        ))}
        {Array.from({ length: placeholderRows }).map((_, i) => (
          <li
            key={`ph-${i}`}
            className="flex items-center gap-2 px-4 py-2 text-zinc-300 dark:text-zinc-700"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold tabular-nums dark:bg-zinc-900">
              {top.length + i + 1}
            </span>
            <span className="inline-block h-5 w-5 shrink-0 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700" />
            <span className="flex-1 text-sm font-medium">–</span>
            <span className="ml-1 inline-block min-w-[1.75rem] rounded-md bg-zinc-100 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums dark:bg-zinc-900">
              –
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-end border-t border-tm-navy/10 bg-zinc-50/60 px-4 py-2 text-xs font-semibold text-tm-orange transition-colors group-hover:bg-tm-orange/5 dark:border-zinc-800 dark:bg-zinc-900/40">
        View all
        <span aria-hidden="true" className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
      </footer>
    </Link>
  )
}
