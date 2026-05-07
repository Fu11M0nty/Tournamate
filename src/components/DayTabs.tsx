import Link from 'next/link'
import type { AgeGroup, Day } from '@/lib/types'

interface DayTabsProps {
  tournamentSlug: string
  days: AgeGroup[][]
  currentDay: Day
}

const TABS: { day: Day; label: string }[] = [
  { day: 'saturday', label: 'Saturday' },
  { day: 'sunday', label: 'Sunday' },
]

export default function DayTabs({ tournamentSlug, days, currentDay }: DayTabsProps) {
  const hasGroups = (day: Day) => {
    const idx = day === 'saturday' ? 0 : 1
    return (days[idx]?.length ?? 0) > 0
  }

  return (
    <nav
      aria-label="Tournament day"
      className="flex gap-2 border-b border-zinc-200 bg-white px-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {TABS.map(({ day, label }) => {
        const active = day === currentDay
        const enabled = hasGroups(day)
        const base =
          'inline-flex items-center justify-center rounded-t-lg px-5 py-3 text-sm font-semibold tracking-wide transition-colors'
        const classes = active
          ? `${base} bg-tm-orange text-white shadow-sm`
          : enabled
            ? `${base} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900`
            : `${base} cursor-not-allowed text-zinc-300 dark:text-zinc-700`

        if (!enabled) {
          return (
            <span key={day} className={classes} aria-disabled="true">
              {label}
            </span>
          )
        }

        return (
          <Link
            key={day}
            href={`/${tournamentSlug}/${day}`}
            className={classes}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
