import Link from 'next/link'
import { labelForLegacyDay } from '@/lib/competitionDates'
import type { AgeGroup, Day, Tournament } from '@/lib/types'

interface DayTabsProps {
  tournamentSlug: string
  tournament: Tournament
  days: AgeGroup[][]
  currentDay: Day
}

const TABS: { day: Day; label: string }[] = [
  { day: 'saturday', label: 'Saturday' },
  { day: 'sunday', label: 'Sunday' },
]

export default function DayTabs({ tournamentSlug, tournament, days, currentDay }: DayTabsProps) {
  const hasGroups = (day: Day) => {
    const idx = day === 'saturday' ? 0 : 1
    return (days[idx]?.length ?? 0) > 0
  }

  return (
    <nav
      aria-label="Tournament day"
      className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="inline-flex gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map(({ day }) => {
          const label = labelForLegacyDay(tournament, day)
          const active = day === currentDay
          const enabled = hasGroups(day)

          if (!enabled) {
            return (
              <span
                key={day}
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center rounded-full px-5 py-1.5 text-sm font-semibold text-zinc-300 dark:text-zinc-700"
              >
                {label}
              </span>
            )
          }

          if (active) {
            return (
              <span
                key={day}
                aria-current="page"
                className="inline-flex items-center rounded-full bg-white px-5 py-1.5 text-sm font-bold text-tm-navy shadow-sm dark:bg-zinc-950 dark:text-white"
              >
                {label}
              </span>
            )
          }

          return (
            <Link
              key={day}
              href={`/${tournamentSlug}/${day}`}
              className="inline-flex items-center rounded-full px-5 py-1.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
