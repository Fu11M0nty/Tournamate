import Link from 'next/link'
import TeamLogo from './TeamLogo'
import type { ScoringSystem, StandingRow } from '@/lib/types'

interface StandingsTableProps {
  standings: StandingRow[]
  allComplete: boolean
  scoringSystem: ScoringSystem
  showRules?: boolean
  currentTeamId?: string | null
  hrefForTeam?: (teamId: string | null) => string
}

const TIE_BREAKER_LABELS: Record<string, string> = {
  goal_difference: 'Overall Goal Difference',
  goals_for: 'Overall Goals Scored',
  goals_against: 'Overall Goals Against (Lower is better)',
  wins: 'Total Wins',
  head_to_head: 'Head-to-Head Points',
  head_to_head_goal_difference: 'Head-to-Head Goal Difference',
  head_to_head_goals_for: 'Head-to-Head Goals Scored'
}

export default function StandingsTable({
  standings,
  allComplete,
  scoringSystem,
  showRules = true,
  currentTeamId = null,
  hrefForTeam,
}: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No teams in this group yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
              <th className="py-2.5 pl-4 pr-2 w-10">#</th>
              <th className="py-2.5 pr-2">Team</th>
              <th className="py-2.5 px-2 text-right">P</th>
              <th className="hidden py-2.5 px-2 text-right sm:table-cell">W</th>
              <th className="hidden py-2.5 px-2 text-right sm:table-cell">D</th>
              <th className="hidden py-2.5 px-2 text-right sm:table-cell">L</th>
              <th className="hidden py-2.5 px-2 text-right sm:table-cell">GF</th>
              <th className="hidden py-2.5 px-2 text-right sm:table-cell">GA</th>
              <th className="py-2.5 px-2 text-right">GD</th>
              <th className="py-2.5 pl-2 pr-4 text-right font-extrabold text-zinc-600 dark:text-zinc-300">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => {
              const isLeader = row.position === 1
              const isSelected = row.team.id === currentTeamId
              const stripe =
                idx % 2 === 0
                  ? 'bg-white dark:bg-zinc-950'
                  : 'bg-zinc-50/60 dark:bg-zinc-900/30'
              const rowBg = isSelected
                ? 'bg-tm-sky/15 dark:bg-tm-sky/10'
                : isLeader
                  ? 'bg-tm-orange/8 dark:bg-tm-orange/10'
                  : stripe
              const positionColor = isLeader ? 'text-tm-orange font-black' : 'text-zinc-400 font-semibold'
              const teamName = (
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {row.team.name}
                </span>
              )
              return (
                <tr
                  key={row.team.id}
                  className={`${rowBg} border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60 ${isSelected ? 'border-l-2 border-l-tm-sky' : isLeader ? 'border-l-2 border-l-tm-orange' : ''}`}
                >
                  <td className="py-3 pl-4 pr-2">
                    <span className={`text-sm tabular-nums ${positionColor}`}>
                      {row.position}
                    </span>
                  </td>
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2.5">
                      <TeamLogo team={row.team} size="sm" />
                      {hrefForTeam ? (
                        <Link
                          href={isSelected ? hrefForTeam(null) : hrefForTeam(row.team.id)}
                          scroll={false}
                          className="rounded-sm underline-offset-2 hover:text-tm-orange hover:underline focus:outline-none focus:ring-2 focus:ring-tm-orange/40"
                          aria-current={isSelected ? 'true' : undefined}
                        >
                          {teamName}
                        </Link>
                      ) : (
                        teamName
                      )}
                      {isLeader && allComplete && (
                        <span aria-label="Group winner" title="Group winner">🏆</span>
                      )}
                      {row.position === 2 && allComplete && (
                        <span aria-label="Runner-up" title="Runner-up">🥈</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {row.played}
                  </td>
                  <td className="hidden py-3 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-500 sm:table-cell">
                    {row.won}
                  </td>
                  <td className="hidden py-3 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-500 sm:table-cell">
                    {row.drawn}
                  </td>
                  <td className="hidden py-3 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-500 sm:table-cell">
                    {row.lost}
                  </td>
                  <td className="hidden py-3 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-500 sm:table-cell">
                    {row.goals_for}
                  </td>
                  <td className="hidden py-3 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-500 sm:table-cell">
                    {row.goals_against}
                  </td>
                  <td className={`py-3 px-2 text-right tabular-nums text-sm ${row.goal_difference > 0 ? 'text-emerald-600' : row.goal_difference < 0 ? 'text-rose-500' : 'text-zinc-500'}`}>
                    {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right">
                    <span className={`text-sm font-extrabold tabular-nums ${isLeader ? 'text-tm-orange' : 'text-tm-navy dark:text-zinc-100'}`}>
                      {row.points}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showRules && (
        <details className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <summary className="cursor-pointer select-none px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            Rules: {scoringSystem.name}
          </summary>
          <div className="grid gap-6 px-4 pb-4 pt-1 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 font-semibold text-zinc-700 dark:text-zinc-300">Match Points</p>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>Win: {scoringSystem.win_pts} pts</li>
                <li>Draw: {scoringSystem.draw_pts} pts</li>
                <li>Loss: {scoringSystem.loss_pts} pts</li>
                {scoringSystem.bonus_loss_pts > 0 && scoringSystem.bonus_loss_threshold_type === 'percentage' && (
                  <li>Losing Bonus: {scoringSystem.bonus_loss_pts} pt{scoringSystem.bonus_loss_pts !== 1 ? 's' : ''} (if score &gt; {scoringSystem.bonus_loss_threshold_value}%)</li>
                )}
                {scoringSystem.bonus_loss_pts > 0 && scoringSystem.bonus_loss_threshold_type === 'goals' && (
                  <li>Losing Bonus: {scoringSystem.bonus_loss_pts} pt{scoringSystem.bonus_loss_pts !== 1 ? 's' : ''} (if margin &le; {scoringSystem.bonus_loss_threshold_value} goals)</li>
                )}
                <li>Forfeit: {scoringSystem.forfeit_loss_pts} pts ({scoringSystem.forfeit_win_score_for}-{scoringSystem.forfeit_win_score_against} loss)</li>
              </ul>
            </div>
            {scoringSystem.tie_breaker_config && scoringSystem.tie_breaker_config.length > 0 && (
              <div>
                <p className="mb-1.5 font-semibold text-zinc-700 dark:text-zinc-300">Tie-Breakers</p>
                <ol className="list-inside list-decimal space-y-1 pl-1 text-xs">
                  {scoringSystem.tie_breaker_config.map((rule, idx) => (
                    <li key={idx}>{TIE_BREAKER_LABELS[rule] || rule}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
