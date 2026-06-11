'use client'

import { isValidYouTubeUrl } from '@/lib/helpGuides'

/**
 * Renders a guide's video: a YouTube link card when a valid URL is set, or a
 * clearly-labelled placeholder while videos are still being produced.
 * Links open in a new tab — no arbitrary HTML is ever embedded.
 */
export default function HelpVideoBlock({ youtubeUrl }: { youtubeUrl: string | null }) {
  if (youtubeUrl && isValidYouTubeUrl(youtubeUrl)) {
    return (
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="help-video-link"
        className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-tm-orange dark:border-zinc-700 dark:bg-zinc-900"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tm-navy text-white transition-transform group-hover:scale-105">
          <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span>
          <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">Watch the video walkthrough</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">Opens on YouTube in a new tab.</span>
        </span>
      </a>
    )
  }

  return (
    <div
      data-testid="help-video-placeholder"
      className="flex items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-bold text-zinc-500 dark:text-zinc-400">Video walkthrough coming soon</span>
        <span className="block text-xs text-zinc-400 dark:text-zinc-500">A step-by-step video for this guide is on its way.</span>
      </span>
    </div>
  )
}
