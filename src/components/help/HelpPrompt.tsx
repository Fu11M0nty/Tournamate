'use client'

import { useHelpNavigation } from '@/lib/help-context'

interface HelpPromptProps {
  /** Slug of the help guide this prompt opens (must exist in HELP_GUIDES). */
  guideSlug: string
  /** What the prompt is about, used in the accessible label, e.g. "scoring systems". */
  label: string
  /** Optional one-line hint shown as a native tooltip on hover. */
  tip?: string
}

/**
 * A subtle "i" icon that deep-links into the admin Help panel at a specific
 * guide. Renders nothing when no help navigation is available (i.e. outside
 * the admin console), so it is always safe to include.
 */
export default function HelpPrompt({ guideSlug, label, tip }: HelpPromptProps) {
  const helpNav = useHelpNavigation()
  if (!helpNav) return null

  return (
    <button
      type="button"
      data-help-prompt={guideSlug}
      onClick={() => helpNav.openHelpGuide(guideSlug)}
      aria-label={`Help: ${label}`}
      title={tip ?? `Learn more about ${label}`}
      className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-zinc-300 align-middle text-[10px] font-bold text-zinc-400 transition-colors hover:border-tm-orange hover:text-tm-orange dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-tm-orange dark:hover:text-tm-orange"
    >
      i
    </button>
  )
}
