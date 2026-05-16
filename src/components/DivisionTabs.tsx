import Link from 'next/link'
import type { Division, Day } from '@/lib/types'

interface DivisionTabsProps {
  tournamentSlug: string
  divisions: Division[]
  currentSlug: string
  day: Day
}

export default function DivisionTabs({
  tournamentSlug,
  divisions,
  currentSlug,
  day,
}: DivisionTabsProps) {
  if (divisions.length === 0) {
    return (
      <div className="border-b border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        No divisions scheduled for this day.
      </div>
    )
  }

  const sorted = [...divisions].sort(
    (a, b) => a.display_order - b.display_order
  )

  return (
    <nav
      aria-label="Division"
      className="overflow-x-auto whitespace-nowrap border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <ul className="flex w-max gap-1 px-4 py-2">
        {sorted.map((group) => {
          const active = group.slug === currentSlug
          return (
            <li key={group.id} className="inline-block shrink-0">
              <Link
                href={`/${tournamentSlug}/${day}/${group.slug}`}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'inline-block rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900'
                    : 'inline-block rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }
              >
                {group.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}


