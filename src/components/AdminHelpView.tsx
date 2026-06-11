'use client'

import { useMemo, useState } from 'react'
import { HELP_GUIDES } from '@/lib/helpContent'
import {
  HELP_CATEGORIES,
  findGuideBySlug,
  guidesByCategory,
  searchGuides,
  type HelpGuide,
} from '@/lib/helpGuides'
import HelpGuideContent from './help/HelpGuideContent'
import HelpVideoBlock from './help/HelpVideoBlock'

const PANEL_LABELS: Record<string, string> = {
  general: 'General',
  'match-entry': 'Match Entry',
  schedule: 'Schedule',
  'age-groups': 'Divisions',
  scoring: 'Scoring',
  import: 'Bulk Import',
  snapshots: 'Snapshots',
  officiating: 'Officiating',
  help: 'Help',
}

interface AdminHelpViewProps {
  /** Open at this guide (set when a contextual help prompt navigated here). */
  initialGuideSlug?: string | null
}

export default function AdminHelpView({ initialGuideSlug }: AdminHelpViewProps) {
  const [activeSlug, setActiveSlug] = useState<string>(initialGuideSlug ?? HELP_GUIDES[0].slug)
  const [query, setQuery] = useState('')

  // A contextual prompt can re-target the open guide while Help is already
  // showing — derive from the prop during render instead of via an effect.
  const [lastInitialSlug, setLastInitialSlug] = useState(initialGuideSlug)
  if (initialGuideSlug !== lastInitialSlug) {
    setLastInitialSlug(initialGuideSlug)
    if (initialGuideSlug && findGuideBySlug(HELP_GUIDES, initialGuideSlug)) {
      setActiveSlug(initialGuideSlug)
    }
  }

  const filteredGuides = useMemo(() => searchGuides(HELP_GUIDES, query), [query])
  const grouped = useMemo(() => guidesByCategory(filteredGuides), [filteredGuides])
  const activeGuide = findGuideBySlug(HELP_GUIDES, activeSlug) ?? HELP_GUIDES[0]

  function openGuide(guide: HelpGuide) {
    setActiveSlug(guide.slug)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Print: show only the open guide. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .help-print-area, .help-print-area * { visibility: visible; }
          .help-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-3xl font-black italic tracking-tight text-tm-navy dark:text-zinc-50">
          HELP <span className="text-tm-orange">CENTER</span>
        </h2>
        <p className="mt-1 font-medium text-zinc-500 dark:text-zinc-400">
          Organiser guides for building, scheduling, and running your competition.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
        {/* Navigation */}
        <nav aria-label="Help guides" className="space-y-5 md:sticky md:top-4 md:col-span-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides…"
            aria-label="Search help guides"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-tm-orange focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />

          {filteredGuides.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              No guides match “{query}”.
            </p>
          ) : (
            HELP_CATEGORIES.map((category) => {
              const guides = grouped.get(category.id) ?? []
              if (guides.length === 0) return null
              return (
                <div key={category.id}>
                  <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    {category.title}
                  </p>
                  <ul className="space-y-1">
                    {guides.map((guide) => {
                      const active = guide.slug === activeGuide.slug
                      return (
                        <li key={guide.slug}>
                          <button
                            type="button"
                            onClick={() => openGuide(guide)}
                            aria-current={active ? 'page' : undefined}
                            className={[
                              'w-full rounded-lg border px-3 py-2.5 text-left transition-all',
                              active
                                ? 'border-tm-orange bg-white shadow-sm ring-1 ring-tm-orange/20 dark:bg-zinc-900'
                                : 'border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'block text-sm font-semibold leading-tight',
                                active ? 'text-tm-navy dark:text-white' : 'text-zinc-700 dark:text-zinc-300',
                              ].join(' ')}
                            >
                              {guide.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-tight text-zinc-400 dark:text-zinc-500">
                              {guide.summary}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </nav>

        {/* Guide detail */}
        <article className="help-print-area overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:col-span-8 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-5 sm:px-8 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-2xl font-black tracking-tight text-tm-navy dark:text-zinc-50">
                  {activeGuide.title}
                </h3>
                <p className="mt-1 font-medium italic text-zinc-500 dark:text-zinc-400">{activeGuide.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:bg-zinc-100 print:hidden dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print this guide
              </button>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <HelpGuideContent sections={activeGuide.sections} />

            <HelpVideoBlock youtubeUrl={activeGuide.youtubeUrl} />

            {activeGuide.relatedSlugs.length > 0 && (
              <div className="border-t border-zinc-100 pt-6 print:hidden dark:border-zinc-800">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  Related guides
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeGuide.relatedSlugs.map((slug) => {
                    const related = findGuideBySlug(HELP_GUIDES, slug)
                    if (!related) return null
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => openGuide(related)}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-tm-orange hover:text-tm-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        {related.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-zinc-100 pt-6 print:hidden dark:border-zinc-800">
              <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Located in: {PANEL_LABELS[activeGuide.panel] ?? activeGuide.panel} panel
              </span>
            </div>
          </div>
        </article>
      </div>

      {/* Support footer */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <h4 className="text-xl font-black uppercase italic tracking-tight text-tm-navy dark:text-zinc-50">
          Need a hand?
        </h4>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Stuck on a progression rule, a scoring quirk, or a scheduling puzzle these guides don&apos;t cover?
          During supported pilots, reach out to your Tournamate support contact — we&apos;re happy to walk
          through it with you, including live on match days.
        </p>
      </div>
    </div>
  )
}
