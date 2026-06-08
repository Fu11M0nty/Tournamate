import { forfeitSide, pointsForMatch } from '@/lib/standings'
import TeamLogo from './TeamLogo'
import { formatKickoffTime } from '@/lib/time'
import type { Match, ScoringSystem, Team } from '@/lib/types'

interface ResultCardProps {
  match: Match
  homeTeam: Team
  awayTeam: Team | null
  scoringSystem: ScoringSystem
  stageLabel?: string
}

function PointsChip({ points }: { points: number }) {
  const base = 'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums'
  const tone =
    points >= 5
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : points > 0
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
  const prefix = points > 0 ? '+' : points < 0 ? '−' : ''
  const magnitude = Math.abs(points)
  return (
    <span
      aria-label={`${points} ${Math.abs(points) === 1 ? 'point' : 'points'} awarded`}
      className={`${base} ${tone}`}
    >
      {prefix}{magnitude}pt{magnitude === 1 ? '' : 's'}
    </span>
  )
}

function PenaltyRow({
  lateMinutes,
  umpireNoShow,
  forfeitNoShow,
  forfeitLate,
}: {
  lateMinutes: number
  umpireNoShow: boolean
  forfeitNoShow: boolean
  forfeitLate: boolean
}) {
  if (lateMinutes <= 0 && !umpireNoShow && !forfeitNoShow && !forfeitLate) return null
  const base = 'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold'
  return (
    <div className="flex flex-wrap gap-1">
      {forfeitNoShow && (
        <span className={`${base} bg-red-600 text-white`}>Forfeit · no show</span>
      )}
      {forfeitLate && (
        <span className={`${base} bg-red-600 text-white`}>Forfeit · {lateMinutes}+ min late</span>
      )}
      {!forfeitLate && !forfeitNoShow && lateMinutes > 0 && (
        <span className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300`}>
          −{lateMinutes * 2} goals · {lateMinutes} min late
        </span>
      )}
      {umpireNoShow && (
        <span className={`${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`}>
          −1 pt · no umpire
        </span>
      )}
    </div>
  )
}

export default function ResultCard({
  match,
  homeTeam,
  awayTeam,
  scoringSystem,
  stageLabel,
}: ResultCardProps) {
  const isByeMatch = awayTeam === null && match.away_team_id === null
  const homeRaw = match.home_score ?? 0
  const awayRaw = match.away_score ?? 0
  const forfeit = isByeMatch ? { side: null, reason: null } : forfeitSide(match)
  const isForfeit = forfeit.side !== null
  const homeAdjusted = isForfeit ? homeRaw : homeRaw - 2 * match.home_late_minutes
  const awayAdjusted = isForfeit ? awayRaw : awayRaw - 2 * match.away_late_minutes
  const homeLateApplied = !isForfeit && match.home_late_minutes > 0
  const awayLateApplied = !isForfeit && match.away_late_minutes > 0
  const homeWon = homeAdjusted > awayAdjusted
  const awayWon = awayAdjusted > homeAdjusted
  const basePoints = pointsForMatch(homeAdjusted, awayAdjusted, scoringSystem)
  const points = {
    home: basePoints.home - (match.home_umpire_no_show ? 1 : 0),
    away: basePoints.away - (match.away_umpire_no_show ? 1 : 0),
  }
  const hasPenalties =
    isForfeit ||
    homeLateApplied ||
    awayLateApplied ||
    match.home_umpire_no_show ||
    match.away_umpire_no_show

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Status + meta bar */}
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        {isByeMatch ? (
          <span className="inline-flex items-center gap-1 font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            Bye
          </span>
        ) : isForfeit ? (
          <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Forfeit
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            FT
          </span>
        )}
        <span aria-hidden="true">·</span>
        <span>{formatKickoffTime(match.kickoff_time)}</span>
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
      </div>

      {/* Match rows */}
      <div className="divide-y divide-zinc-50 px-4 dark:divide-zinc-900">
        {/* Home row */}
        <div className="flex items-center gap-3 py-2.5">
          <TeamLogo team={homeTeam} size="sm" />
          <span
            className={`flex-1 truncate text-sm ${homeWon ? 'font-bold text-zinc-900 dark:text-zinc-50' : 'font-medium text-zinc-500 dark:text-zinc-400'}`}
            title={homeTeam.name}
          >
            {homeTeam.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <PointsChip points={points.home} />
            {homeLateApplied && (
              <span className="text-xs tabular-nums text-zinc-300 line-through dark:text-zinc-700">
                {homeRaw}
              </span>
            )}
            <span
              className={`w-7 text-right text-xl font-extrabold tabular-nums ${homeWon ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'}`}
            >
              {homeAdjusted}
            </span>
          </div>
        </div>

        {/* Away row */}
        {isByeMatch ? (
          <div className="flex items-center gap-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-black text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
              —
            </span>
            <span className="flex-1 italic text-sm text-zinc-400 dark:text-zinc-500">
              Bye — auto advanced
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2.5">
            <TeamLogo team={awayTeam!} size="sm" />
            <span
              className={`flex-1 truncate text-sm ${awayWon ? 'font-bold text-zinc-900 dark:text-zinc-50' : 'font-medium text-zinc-500 dark:text-zinc-400'}`}
              title={awayTeam!.name}
            >
              {awayTeam!.name}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <PointsChip points={points.away} />
              {awayLateApplied && (
                <span className="text-xs tabular-nums text-zinc-300 line-through dark:text-zinc-700">
                  {awayRaw}
                </span>
              )}
              <span
                className={`w-7 text-right text-xl font-extrabold tabular-nums ${awayWon ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'}`}
              >
                {awayAdjusted}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Penalty badges — only shown when relevant (never for bye matches) */}
      {!isByeMatch && hasPenalties && (
        <div className="space-y-1 border-t border-zinc-100 px-4 pb-3 pt-2 dark:border-zinc-800">
          <PenaltyRow
            lateMinutes={match.home_late_minutes}
            umpireNoShow={match.home_umpire_no_show}
            forfeitNoShow={match.home_no_show}
            forfeitLate={forfeit.side === 'home' && forfeit.reason === 'late'}
          />
          <PenaltyRow
            lateMinutes={match.away_late_minutes}
            umpireNoShow={match.away_umpire_no_show}
            forfeitNoShow={match.away_no_show}
            forfeitLate={forfeit.side === 'away' && forfeit.reason === 'late'}
          />
        </div>
      )}
    </article>
  )
}
