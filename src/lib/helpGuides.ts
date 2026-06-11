// Pure types + helpers for the admin Help documentation suite.
// Guide content itself lives in helpContent.ts; this module stays free of
// content so the lookup/search/validation logic is unit-testable in isolation.

export type HelpCategoryId =
  | 'getting-started'
  | 'structure-fixtures'
  | 'scheduling'
  | 'match-day'
  | 'people-officiating'
  | 'data-admin'

export interface HelpCategory {
  id: HelpCategoryId
  title: string
  description: string
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', title: 'Getting started', description: 'Create your tournament and set up the basics.' },
  { id: 'structure-fixtures', title: 'Structure & fixtures', description: 'Formats, scoring systems, and fixture generation.' },
  { id: 'scheduling', title: 'Scheduling', description: 'Courts, time slots, and the multi-week league planner.' },
  { id: 'match-day', title: 'Match day', description: 'Scores, QR capture, scorecards, and the public site.' },
  { id: 'people-officiating', title: 'People & officiating', description: 'Umpires, clubs, and match officials.' },
  { id: 'data-admin', title: 'Data & admin', description: 'Imports, snapshots, and safety nets.' },
]

/** Public URL base where Playwright-generated documentation screenshots live. */
export const HELP_SCREENSHOT_BASE = '/help/screenshots'

export interface HelpScreenshot {
  /** Filename under HELP_SCREENSHOT_BASE, e.g. "admin-general-tournament-details.png". */
  file: string
  alt: string
  caption?: string
  /** True while the asset has not been generated yet — renders a labelled placeholder. */
  placeholder?: boolean
}

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; title?: string; text: string }
  | { type: 'warning'; title?: string; text: string }
  | { type: 'screenshot'; screenshot: HelpScreenshot }

export interface HelpSection {
  heading: string
  blocks: HelpBlock[]
}

export interface HelpGuide {
  /** Stable slug used for deep links from contextual help prompts. Never rename. */
  slug: string
  title: string
  summary: string
  category: HelpCategoryId
  /** The admin panel this guide relates to (matches AdminPanel ids where possible). */
  panel: string
  sections: HelpSection[]
  /** A YouTube watch/embed URL, or null to show a labelled "video coming soon" placeholder. */
  youtubeUrl: string | null
  relatedSlugs: string[]
}

export function findGuideBySlug(guides: HelpGuide[], slug: string): HelpGuide | null {
  return guides.find((g) => g.slug === slug) ?? null
}

export function guidesByCategory(guides: HelpGuide[]): Map<HelpCategoryId, HelpGuide[]> {
  const map = new Map<HelpCategoryId, HelpGuide[]>()
  for (const category of HELP_CATEGORIES) map.set(category.id, [])
  for (const guide of guides) {
    const bucket = map.get(guide.category)
    if (bucket) bucket.push(guide)
  }
  return map
}

function blockText(block: HelpBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'steps':
    case 'list':
      return block.items.join(' ')
    case 'tip':
    case 'warning':
      return `${block.title ?? ''} ${block.text}`
    case 'screenshot':
      return ''
  }
}

/**
 * Case-insensitive search over guide titles, summaries, section headings, and
 * body text. An empty/whitespace query returns all guides unchanged.
 */
export function searchGuides(guides: HelpGuide[], query: string): HelpGuide[] {
  const q = query.trim().toLowerCase()
  if (!q) return guides
  return guides.filter((guide) => {
    if (guide.title.toLowerCase().includes(q)) return true
    if (guide.summary.toLowerCase().includes(q)) return true
    return guide.sections.some(
      (section) =>
        section.heading.toLowerCase().includes(q) ||
        section.blocks.some((block) => blockText(block).toLowerCase().includes(q))
    )
  })
}

/** Accepts standard YouTube watch, share, and embed URLs over https. */
export function isValidYouTubeUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.replace(/^www\./, '')
  if (host === 'youtube.com') {
    if (parsed.pathname === '/watch') return Boolean(parsed.searchParams.get('v'))
    return /^\/embed\/[\w-]{6,}$/.test(parsed.pathname)
  }
  if (host === 'youtu.be') {
    return /^\/[\w-]{6,}$/.test(parsed.pathname)
  }
  return false
}

/** Every screenshot referenced across the guides, deduplicated by filename. */
export function collectScreenshots(guides: HelpGuide[]): HelpScreenshot[] {
  const seen = new Map<string, HelpScreenshot>()
  for (const guide of guides) {
    for (const section of guide.sections) {
      for (const block of section.blocks) {
        if (block.type === 'screenshot' && !seen.has(block.screenshot.file)) {
          seen.set(block.screenshot.file, block.screenshot)
        }
      }
    }
  }
  return Array.from(seen.values())
}

export interface GuideValidationIssue {
  slug: string
  issue: string
}

/**
 * Structural integrity checks used by unit tests: unique slugs, known
 * categories, valid related-guide references, valid YouTube URLs, and
 * sensible screenshot filenames.
 */
export function validateGuides(guides: HelpGuide[]): GuideValidationIssue[] {
  const issues: GuideValidationIssue[] = []
  const slugs = new Set<string>()
  const categoryIds = new Set(HELP_CATEGORIES.map((c) => c.id))

  for (const guide of guides) {
    if (slugs.has(guide.slug)) issues.push({ slug: guide.slug, issue: 'duplicate slug' })
    slugs.add(guide.slug)
    if (!/^[a-z0-9-]+$/.test(guide.slug)) issues.push({ slug: guide.slug, issue: 'slug must be kebab-case' })
    if (!categoryIds.has(guide.category)) issues.push({ slug: guide.slug, issue: `unknown category ${guide.category}` })
    if (guide.youtubeUrl !== null && !isValidYouTubeUrl(guide.youtubeUrl)) {
      issues.push({ slug: guide.slug, issue: `invalid YouTube URL ${guide.youtubeUrl}` })
    }
    if (guide.sections.length === 0) issues.push({ slug: guide.slug, issue: 'guide has no sections' })
  }

  for (const guide of guides) {
    for (const related of guide.relatedSlugs) {
      if (!slugs.has(related)) issues.push({ slug: guide.slug, issue: `related guide not found: ${related}` })
      if (related === guide.slug) issues.push({ slug: guide.slug, issue: 'guide relates to itself' })
    }
  }

  for (const shot of collectScreenshots(guides)) {
    if (!/^[a-z0-9-]+\.png$/.test(shot.file)) {
      issues.push({ slug: '(screenshot)', issue: `screenshot filename not kebab-case .png: ${shot.file}` })
    }
    if (!shot.alt.trim()) {
      issues.push({ slug: '(screenshot)', issue: `screenshot missing alt text: ${shot.file}` })
    }
  }

  return issues
}

/**
 * Minimal inline markup for guide body text: **bold** and `code` spans.
 * Returns alternating segments so the renderer never injects raw HTML.
 */
export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }

export function parseInlineMarkup(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) segments.push({ kind: 'bold', text: match[1] })
    else segments.push({ kind: 'code', text: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) })
  }
  return segments
}
