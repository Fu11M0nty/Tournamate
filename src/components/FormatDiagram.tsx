'use client'

import { useMemo } from 'react'
import { resolveFormatBuilder } from '@/lib/formatBuilders'
import type { FormatBuilderOptions, FormatBuilderTemplate } from '@/lib/formatBuilders'

// ─── Layout constants ────────────────────────────────────────────────────────
const NW = 160   // node width
const GH = 58    // group/pool node height
const MH = 78    // knockout match node height (title bar + 2 slots)
const CG = 84    // horizontal gap between columns
const NG = 10    // vertical gap between group nodes
const MG = 14    // vertical gap between match nodes
const HDR = 30   // column header area height
const TP = 10    // top padding above headers
const SP = 16    // left/right side padding
const BP = 24    // bottom padding

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

// ─── Internal types (mirror the lib shapes we need) ─────────────────────────
interface PoolT { slug: string; name: string; isDefault?: boolean }
interface PhaseT { slug: string; name: string; phaseType: string; pools: PoolT[] }
interface ProgT {
  fromPhase: string; fromPool: string; ranks: number[]; sourceType?: string
  toPhase: string; toPool: string; startSlot: number
  isBestRank?: boolean
}

interface DiagramNode {
  id: string
  phaseSlug: string
  phaseName: string
  poolSlug: string
  displayName: string
  isKnockout: boolean
  slots: [string, string] | null
  colIndex: number
  x: number
  y: number
  h: number
}

interface DiagramEdge {
  key: string
  fromX: number; fromY: number
  toX: number;   toY: number
  fromCol: number; toCol: number
}

// ─── Layout engine ───────────────────────────────────────────────────────────
function buildDiagram(phases: PhaseT[], progressions: ProgT[]) {
  const isKO = (p: PhaseT) => p.phaseType === 'knockout'

  // Build slot-label lookup: (toPhase:toPool:slot) → human label
  const slotLabels = new Map<string, string>()
  for (const prog of progressions) {
    // BNT progressions have no source pool — resolve label before the pool lookup
    if (prog.sourceType === 'best_rank' || prog.isBestRank) {
      const key = `${prog.toPhase}:${prog.toPool}:${prog.startSlot}`
      if (!slotLabels.has(key)) slotLabels.set(key, `Best ${ordinal(prog.ranks[0])}`)
      continue
    }
    const fromPhase = phases.find(p => p.slug === prog.fromPhase)
    const fromPool = fromPhase?.pools.find(p => p.slug === prog.fromPool)
    if (!fromPhase || !fromPool) continue
    const fromName = fromPool.isDefault ? fromPhase.name : fromPool.name
    let label: string
    if (prog.sourceType === 'match_winner') label = `Win ${fromName}`
    else if (prog.sourceType === 'match_loser') label = `Lose ${fromName}`
    else label = `${ordinal(prog.ranks[0])} ${fromName}`
    const key = `${prog.toPhase}:${prog.toPool}:${prog.startSlot}`
    if (!slotLabels.has(key)) slotLabels.set(key, label)
  }

  // Build nodes — one per pool in each phase
  const nodes: DiagramNode[] = []
  const nodeMap = new Map<string, DiagramNode>()
  phases.forEach((phase, colIndex) => {
    const ko = isKO(phase)
    phase.pools.forEach(pool => {
      const id = `${phase.slug}:${pool.slug}`
      const displayName = pool.isDefault ? phase.name : pool.name
      let slots: [string, string] | null = null
      if (ko) {
        slots = [
          slotLabels.get(`${phase.slug}:${pool.slug}:1`) ?? '…',
          slotLabels.get(`${phase.slug}:${pool.slug}:2`) ?? '…',
        ]
      }
      const node: DiagramNode = {
        id, phaseSlug: phase.slug, phaseName: phase.name,
        poolSlug: pool.slug, displayName, isKnockout: ko, slots,
        colIndex,
        x: SP + colIndex * (NW + CG),
        y: 0, // computed below
        h: ko ? MH : GH,
      }
      nodes.push(node)
      nodeMap.set(id, node)
    })
  })

  // ── Y layout ──────────────────────────────────────────────────────────────
  const byCol = phases.map((_, i) => nodes.filter(n => n.colIndex === i))

  // Column 0: pack from top
  if (byCol[0]) {
    let cursor = TP + HDR
    for (const n of byCol[0]) {
      n.y = cursor
      cursor += n.h + NG
    }
  }

  // Subsequent columns: centre each node on its source nodes, then enforce spacing
  for (let col = 1; col < byCol.length; col++) {
    const colNodes = byCol[col]
    if (!colNodes?.length) continue
    const gap = colNodes[0]?.isKnockout ? MG : NG

    for (const node of colNodes) {
      const srcIds = [
        ...new Set(
          progressions
            .filter(p => p.toPhase === node.phaseSlug && p.toPool === node.poolSlug)
            .map(p => `${p.fromPhase}:${p.fromPool}`)
        ),
      ]
      const srcNodes = srcIds.map(id => nodeMap.get(id)).filter((n): n is DiagramNode => n != null)
      if (srcNodes.length) {
        const avgCenter = srcNodes.reduce((s, n) => s + n.y + n.h / 2, 0) / srcNodes.length
        node.y = avgCenter - node.h / 2
      } else {
        node.y = TP + HDR
      }
    }

    // Sort by ideal Y, then push overlaps down
    colNodes.sort((a, b) => a.y - b.y)
    for (let i = 1; i < colNodes.length; i++) {
      const prev = colNodes[i - 1]
      const curr = colNodes[i]
      const minY = prev.y + prev.h + gap
      if (curr.y < minY) curr.y = minY
    }
    // Clamp top
    for (const n of colNodes) {
      if (n.y < TP + HDR) n.y = TP + HDR
    }
  }

  // ── Canvas size ───────────────────────────────────────────────────────────
  const totalW = SP * 2 + phases.length * NW + Math.max(0, phases.length - 1) * CG
  const maxBottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), TP + HDR + 40)
  const totalH = maxBottom + BP

  // ── Edges — one per unique (fromPhase:fromPool → toPhase:toPool) ──────────
  const seen = new Set<string>()
  const edges: DiagramEdge[] = []
  for (const prog of progressions) {
    const key = `${prog.fromPhase}:${prog.fromPool}→${prog.toPhase}:${prog.toPool}`
    if (seen.has(key)) continue
    seen.add(key)
    const from = nodeMap.get(`${prog.fromPhase}:${prog.fromPool}`)
    const to   = nodeMap.get(`${prog.toPhase}:${prog.toPool}`)
    if (!from || !to) continue
    edges.push({
      key,
      fromX: from.x + NW,
      fromY: from.y + from.h / 2,
      toX: to.x,
      toY: to.y + to.h / 2,
      fromCol: from.colIndex,
      toCol: to.colIndex,
    })
  }

  return { nodes, edges, totalW, totalH, phases }
}

// ─── Component ───────────────────────────────────────────────────────────────
interface FormatDiagramProps {
  builder: FormatBuilderTemplate
  options: FormatBuilderOptions
  teamCount?: number
}

export default function FormatDiagram({ builder, options, teamCount = 0 }: FormatDiagramProps) {
  const resolved = useMemo(
    () => resolveFormatBuilder(builder, { ...options, teamCount }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builder.id, options, teamCount]
  )

  const { nodes, edges, totalW, totalH } = useMemo(
    () => buildDiagram(resolved.phases as PhaseT[], (resolved.progressions ?? []) as ProgT[]),
    [resolved]
  )

  if (nodes.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="px-4 pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Format diagram
        </p>
      </div>
      <div className="relative p-4" style={{ width: totalW + SP * 2, height: totalH }}>
        {/* Column header labels */}
        {resolved.phases.map((phase, i) => (
          <div
            key={phase.slug}
            className="absolute text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
            style={{ left: SP + i * (NW + CG), width: NW, top: TP }}
          >
            {phase.name}
          </div>
        ))}

        {/* SVG edges — rendered beneath cards */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={totalW + SP * 2}
          height={totalH}
          aria-hidden="true"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 0 1 L 5 3 L 0 5 z" className="fill-zinc-300 dark:fill-zinc-600" />
            </marker>
          </defs>
          {edges.map(edge => {
            const isSkip = edge.toCol > edge.fromCol + 1
            // Skip edges (skipping ≥1 column) arc above the header row to avoid passing through intermediate nodes.
            const safeY = 4  // above all column header text
            const fx = edge.fromX + SP
            const tx = edge.toX + SP - 2
            const d = isSkip
              ? `M ${fx} ${edge.fromY} V ${safeY} H ${tx} V ${edge.toY}`
              : `M ${fx} ${edge.fromY} H ${(edge.fromX + edge.toX) / 2 + SP} V ${edge.toY} H ${tx}`
            return (
              <path
                key={edge.key}
                d={d}
                fill="none"
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
                className="stroke-zinc-300 dark:stroke-zinc-600"
              />
            )
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node => (
          <div
            key={node.id}
            className="absolute overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            style={{ left: node.x + SP, top: node.y, width: NW, height: node.h }}
          >
            {node.isKnockout && node.slots ? (
              <>
                <div className="border-b border-zinc-100 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="truncate text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {node.displayName}
                  </p>
                </div>
                {node.slots.map((slot, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 border-b border-zinc-50 px-2.5 py-1.5 last:border-b-0 dark:border-zinc-900"
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[8px] font-black text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {i + 1}
                    </span>
                    <span className="truncate text-[11px] leading-tight text-zinc-600 dark:text-zinc-400">
                      {slot}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex h-full flex-col justify-center px-3">
                <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {node.displayName}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {node.phaseName !== node.displayName ? node.phaseName : 'Group stage'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
