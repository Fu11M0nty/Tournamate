import Link from 'next/link'
import TeamLogo from './TeamLogo'
import type { Team } from '@/lib/types'

interface TeamFilterProps {
  pathname: string
  teams: Team[]
  currentTeamId: string | null
}

export default function TeamFilter({
  pathname,
  teams,
  currentTeamId,
}: TeamFilterProps) {
  return (
    <nav
      aria-label="Filter by team"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max items-center gap-2 py-1">
        <li className="shrink-0">
          <Link
            href={pathname}
            scroll={false}
            aria-current={currentTeamId === null ? 'true' : undefined}
            className={
              currentTeamId === null
                ? 'inline-flex h-12 items-center rounded-full bg-tm-orange px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm'
                : 'inline-flex h-12 items-center rounded-full border border-tm-navy/15 bg-white px-4 text-xs font-bold uppercase tracking-wider text-tm-navy hover:border-tm-orange hover:text-tm-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
            }
          >
            All teams
          </Link>
        </li>
        {teams.map((team) => {
          const active = team.id === currentTeamId
          const href = `${pathname}?team=${encodeURIComponent(team.id)}`
          return (
            <li key={team.id} className="shrink-0">
              <Link
                href={href}
                scroll={false}
                aria-label={team.name}
                aria-current={active ? 'true' : undefined}
                title={team.name}
                className={
                  active
                    ? 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-tm-orange p-0.5 shadow-sm ring-2 ring-tm-orange ring-offset-2 ring-offset-white dark:ring-offset-zinc-950'
                    : 'inline-flex h-12 w-12 items-center justify-center rounded-full bg-white p-0.5 ring-1 ring-tm-navy/15 transition-colors hover:ring-tm-orange dark:bg-zinc-900 dark:ring-zinc-700'
                }
              >
                <TeamLogo team={team} size="md" />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
