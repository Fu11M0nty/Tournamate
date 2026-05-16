import TeamLogo from './TeamLogo'
import { formatKickoffTime, formatKickoffDate } from '@/lib/time'
import type { Match, Team } from '@/lib/types'

interface FixtureCardProps {
  match: Match
  homeTeam: Team | null
  awayTeam: Team | null
  homeLabel?: string
  awayLabel?: string
  stageLabel?: string
}

export default function FixtureCard({
  match,
  homeTeam,
  awayTeam,
  homeLabel,
  awayLabel,
  stageLabel,
}: FixtureCardProps) {
  const time = formatKickoffTime(match.kickoff_time)
  const date = formatKickoffDate(match.kickoff_time)
  const homeName = homeTeam?.name ?? homeLabel ?? 'TBD'
  const awayName = awayTeam?.name ?? awayLabel ?? 'TBD'
  const isTbd = !homeTeam || !awayTeam

  return (
    <article className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-950 ${isTbd ? 'border-amber-200 dark:border-amber-900/50' : 'border-zinc-100 dark:border-zinc-800'}`}>
      {/* Time + round bar */}
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{time}</span>
        <span aria-hidden="true">·</span>
        <span>{date}</span>
        {match.court && (
          <>
            <span aria-hidden="true">·</span>
            <span>{match.court}</span>
          </>
        )}
        {stageLabel && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">{stageLabel}</span>
          </>
        )}
        {!stageLabel && match.round_number && (
          <>
            <span aria-hidden="true">·</span>
            <span>Round {match.round_number}</span>
          </>
        )}
      </div>

      {/* Team rows */}
      <div className="divide-y divide-zinc-50 px-4 dark:divide-zinc-900">
        {/* Home row */}
        <div className="flex items-center gap-3 py-2.5">
          {homeTeam ? (
            <TeamLogo team={homeTeam} size="sm" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              ?
            </span>
          )}
          <span
            className={`flex-1 truncate text-sm ${homeTeam ? 'font-medium text-zinc-700 dark:text-zinc-300' : 'font-semibold text-amber-700 dark:text-amber-400'}`}
            title={homeName}
          >
            {homeName}
          </span>
        </div>

        {/* Away row */}
        <div className="flex items-center gap-3 py-2.5">
          {awayTeam ? (
            <TeamLogo team={awayTeam} size="sm" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              ?
            </span>
          )}
          <span
            className={`flex-1 truncate text-sm ${awayTeam ? 'font-medium text-zinc-700 dark:text-zinc-300' : 'font-semibold text-amber-700 dark:text-amber-400'}`}
            title={awayName}
          >
            {awayName}
          </span>
        </div>
      </div>
    </article>
  )
}
