import TeamLogo from './TeamLogo'
import type { StandingRow } from '@/lib/types'

interface StandingsTableProps {
  standings: StandingRow[]
  allComplete: boolean
}

export default function StandingsTable({
  standings,
  allComplete,
}: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No teams in this group yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="bg-zinc-900 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-300 dark:bg-zinc-900">
            <th className="py-3 pl-4 pr-2 w-10">#</th>
            <th className="py-3 pr-2">Team</th>
            <th className="py-3 px-2 text-right">P</th>
            <th className="py-3 px-2 text-right">W</th>
            <th className="py-3 px-2 text-right">D</th>
            <th className="py-3 px-2 text-right">L</th>
            <th className="py-3 px-2 text-right">GF</th>
            <th className="py-3 px-2 text-right">GA</th>
            <th className="py-3 px-2 text-right">GD</th>
            <th className="py-3 pl-2 pr-4 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => {
            const isLeader = row.position === 1
            const stripe =
              idx % 2 === 0
                ? 'bg-white dark:bg-zinc-950'
                : 'bg-zinc-50 dark:bg-zinc-900/40'
            const leaderBg = isLeader
              ? 'bg-tm-orange/10 dark:bg-tm-orange/10'
              : stripe
            const positionBadge = isLeader
              ? 'bg-tm-orange text-white'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            return (
              <tr
                key={row.team.id}
                className={`${leaderBg} border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60`}
              >
                <td className="py-3 pl-4 pr-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${positionBadge}`}
                  >
                    {row.position}
                  </span>
                </td>
                <td className="py-3 pr-2">
                  <div className="flex items-center gap-2.5">
                    <TeamLogo team={row.team} size="sm" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.team.name}
                    </span>
                    {isLeader && allComplete && (
                      <span aria-label="Group winner" title="Group winner">
                        🏆
                      </span>
                    )}
                    {row.position === 2 && allComplete && (
                      <span aria-label="Runner-up" title="Runner-up">
                        🥈
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.played}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.won}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.drawn}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.lost}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.goals_for}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.goals_against}
                </td>
                <td className="py-3 px-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.goal_difference > 0
                    ? `+${row.goal_difference}`
                    : row.goal_difference}
                </td>
                <td className="py-3 pl-2 pr-4 text-right">
                  <span className="inline-block rounded-md bg-zinc-900 px-2 py-0.5 text-sm font-extrabold tabular-nums text-white dark:bg-white dark:text-zinc-900">
                    {row.points}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
