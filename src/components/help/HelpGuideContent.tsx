'use client'

import Image from 'next/image'
import {
  HELP_SCREENSHOT_BASE,
  parseInlineMarkup,
  type HelpBlock,
  type HelpScreenshot,
  type HelpSection,
} from '@/lib/helpGuides'

function InlineText({ text }: { text: string }) {
  const segments = parseInlineMarkup(text)
  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === 'bold' ? (
          <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">{segment.text}</strong>
        ) : segment.kind === 'code' ? (
          <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{segment.text}</code>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  )
}

function ScreenshotFigure({ screenshot }: { screenshot: HelpScreenshot }) {
  if (screenshot.placeholder) {
    return (
      <figure className="my-4">
        <div
          data-testid="help-screenshot-placeholder"
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="text-sm italic text-zinc-400 dark:text-zinc-500">
            Screenshot coming soon: {screenshot.alt}
          </span>
        </div>
        {screenshot.caption && (
          <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">{screenshot.caption}</figcaption>
        )}
      </figure>
    )
  }
  return (
    <figure className="my-4">
      <Image
        src={`${HELP_SCREENSHOT_BASE}/${screenshot.file}`}
        alt={screenshot.alt}
        width={1280}
        height={720}
        unoptimized
        className="w-full rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-700"
      />
      {screenshot.caption && (
        <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">{screenshot.caption}</figcaption>
      )}
    </figure>
  )
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          <InlineText text={block.text} />
        </p>
      )
    case 'steps':
      return (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {block.items.map((item, i) => (
            <li key={i}><InlineText text={item} /></li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {block.items.map((item, i) => (
            <li key={i}><InlineText text={item} /></li>
          ))}
        </ul>
      )
    case 'tip':
      return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            💡 {block.title ?? 'Tip'}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"><InlineText text={block.text} /></p>
        </div>
      )
    case 'warning':
      return (
        <div className="rounded-lg border border-tm-orange/30 bg-tm-orange/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-tm-orange">
            ⚠️ {block.title ?? 'Watch out'}
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300"><InlineText text={block.text} /></p>
        </div>
      )
    case 'screenshot':
      return <ScreenshotFigure screenshot={block.screenshot} />
  }
}

export default function HelpGuideContent({ sections }: { sections: HelpSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{section.heading}</h4>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  )
}
