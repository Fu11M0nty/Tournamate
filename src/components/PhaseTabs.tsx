import Link from 'next/link'
import type { Day, Phase } from '@/lib/types'

interface PhaseTabsProps {
  tournamentSlug: string
  day: Day
  divisionSlug: string
  phases: Phase[]
  currentSlug: string | null
  teamFilterId: string | null
}

export default function PhaseTabs({
  tournamentSlug,
  day,
  divisionSlug,
  phases,
  currentSlug,
  teamFilterId,
}: PhaseTabsProps) {
  if (phases.length <= 1) return null

  const basePath = `/${tournamentSlug}/${day}/${divisionSlug}`

  function hrefFor(phase: Phase) {
    const params = new URLSearchParams()
    params.set('phase', phase.slug)
    const phaseSupportsTeamFilter =
      phase.phase_type !== 'knockout' &&
      (phase.standings_mode === 'visible' || phase.standings_mode === 'none')
    if (teamFilterId && phaseSupportsTeamFilter) params.set('team', teamFilterId)
    return `${basePath}?${params.toString()}`
  }

  return (
    <nav
      aria-label="Competition phase"
      className="border-t border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950"
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-6">
        <ul className="flex w-max items-center gap-1.5 py-2.5">
          {phases.map((phase) => {
            const active = phase.slug === currentSlug
            return (
              <li key={phase.id} className="shrink-0">
                <Link
                  href={hrefFor(phase)}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'inline-flex items-center rounded-full bg-tm-navy/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-tm-navy dark:bg-white/10 dark:text-white'
                      : 'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }
                >
                  {phase.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
