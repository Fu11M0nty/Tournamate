import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP_GUIDES } from '@/lib/helpContent'
import {
  HELP_CATEGORIES,
  collectScreenshots,
  findGuideBySlug,
  guidesByCategory,
  isValidYouTubeUrl,
  parseInlineMarkup,
  searchGuides,
  validateGuides,
} from '@/lib/helpGuides'

const SCREENSHOT_DIR = resolve(process.cwd(), 'public', 'help', 'screenshots')

describe('help guide content integrity', () => {
  it('passes structural validation (unique kebab slugs, categories, related links, video URLs)', () => {
    expect(validateGuides(HELP_GUIDES)).toEqual([])
  })

  it('covers every category with at least one guide', () => {
    const grouped = guidesByCategory(HELP_GUIDES)
    for (const category of HELP_CATEGORIES) {
      expect(grouped.get(category.id)?.length ?? 0, `category ${category.id}`).toBeGreaterThan(0)
    }
  })

  it('includes the core organiser guides required for V1', () => {
    const required = [
      'create-tournament',
      'scheduling-modes',
      'dates-and-venues',
      'divisions',
      'teams',
      'choose-format',
      'scoring',
      'fixtures',
      'schedule-event-day',
      'multi-week-league',
      'enter-scores',
      'qr-capture',
      'scorecards',
      'officiating',
      'public-pages',
      'import-export',
      'snapshots',
      'match-day-troubleshooting',
    ]
    for (const slug of required) {
      expect(findGuideBySlug(HELP_GUIDES, slug), `guide ${slug}`).not.toBeNull()
    }
  })

  it('documents the multi-week league planner features', () => {
    const guide = findGuideBySlug(HELP_GUIDES, 'multi-week-league')
    expect(guide).not.toBeNull()
    const text = JSON.stringify(guide)
    for (const phrase of ['Auto-plan', 'Unplan all', 'minimum gap', 'Playable days', 'Competition window']) {
      expect(text, `multi-week guide mentions "${phrase}"`).toContain(phrase)
    }
  })

  it('references only screenshot assets that exist on disk (unless marked placeholder)', () => {
    for (const shot of collectScreenshots(HELP_GUIDES)) {
      if (shot.placeholder) continue
      const path = join(SCREENSHOT_DIR, shot.file)
      expect(existsSync(path), `missing screenshot asset ${shot.file}`).toBe(true)
    }
  })
})

describe('contextual help prompt targets', () => {
  function collectTsxFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) collectTsxFiles(path, out)
      else if (path.endsWith('.tsx')) out.push(path)
    }
    return out
  }

  it('every HelpPrompt guideSlug in the app resolves to a real guide', () => {
    const files = collectTsxFiles(resolve(process.cwd(), 'src'))
    const targets = new Set<string>()
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/guideSlug="([a-z0-9-]+)"/g)) {
        targets.add(match[1])
      }
    }
    expect(targets.size).toBeGreaterThanOrEqual(10)
    for (const slug of targets) {
      expect(findGuideBySlug(HELP_GUIDES, slug), `prompt target ${slug}`).not.toBeNull()
    }
  })
})

describe('searchGuides', () => {
  it('returns all guides for an empty query', () => {
    expect(searchGuides(HELP_GUIDES, '   ')).toHaveLength(HELP_GUIDES.length)
  })

  it('matches guide titles case-insensitively', () => {
    const results = searchGuides(HELP_GUIDES, 'MULTI-WEEK')
    expect(results.some((g) => g.slug === 'multi-week-league')).toBe(true)
  })

  it('matches body text inside sections', () => {
    const results = searchGuides(HELP_GUIDES, 'losing bonus point')
    expect(results.some((g) => g.slug === 'scoring')).toBe(true)
  })

  it('returns nothing for gibberish', () => {
    expect(searchGuides(HELP_GUIDES, 'zzzzqqqq-not-a-real-topic')).toHaveLength(0)
  })
})

describe('isValidYouTubeUrl', () => {
  it('accepts watch, share, and embed URLs', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isValidYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
  })

  it('rejects non-YouTube and non-https URLs', () => {
    expect(isValidYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isValidYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isValidYouTubeUrl('https://www.youtube.com/watch')).toBe(false)
    expect(isValidYouTubeUrl('not a url')).toBe(false)
  })
})

describe('parseInlineMarkup', () => {
  it('splits bold and code spans out of plain text', () => {
    expect(parseInlineMarkup('Set the **Scheduling mode** via `schedule_mode`.')).toEqual([
      { kind: 'text', text: 'Set the ' },
      { kind: 'bold', text: 'Scheduling mode' },
      { kind: 'text', text: ' via ' },
      { kind: 'code', text: 'schedule_mode' },
      { kind: 'text', text: '.' },
    ])
  })

  it('returns a single text segment when there is no markup', () => {
    expect(parseInlineMarkup('plain words')).toEqual([{ kind: 'text', text: 'plain words' }])
  })
})
