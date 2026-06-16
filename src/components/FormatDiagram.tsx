'use client'

import { useMemo } from 'react'
import { resolveFormatBuilder } from '@/lib/formatBuilders'
import type { FormatBuilderOptions, FormatBuilderTemplate } from '@/lib/formatBuilders'
import type {
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  Team,
} from '@/lib/types'

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
const BRACKET_VGAP = 44 // vertical gap between Championship and Plate zones

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

// ─── Internal types (mirror the lib shapes we need) ─────────────────────────
interface PoolT { slug: string; name: string; isDefault?: boolean; slotLabels?: string[] }
interface PhaseT { slug: string; name: string; phaseType: string; displayColumn?: number; yAlignNode?: string; pools: PoolT[] }
interface ProgT {
  fromPhase: string; fromPool: string; ranks: number[]; sourceType?: string
  toPhase: string; toPool: string; startSlot: number
  isBestRank?: boolean
  showEdgeLabel?: boolean
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
  skipSafeY: number  // y-level for skip-column arc routing (just above source node top)
  label?: string     // e.g. 'Winner' or 'Loser' for knockout match edges
}

// Pool → next-phase "bus": vertical rail with stubs coming in from each source
// pool (no arrowhead) and arrows fanning out to each destination node (with
// arrowhead). Decouples the visual from specific progression mappings — it just
// illustrates that all pools collectively feed into the next phase.
interface DiagramBus {
  key: string
  x: number
  y1: number
  y2: number
  stubs: Array<{ fromX: number; y: number }>
  fanouts: Array<{ toX: number; y: number }>
}

// ─── Layout engine ───────────────────────────────────────────────────────────
function buildDiagram(phases: PhaseT[], progressions: ProgT[]) {
  const isKO = (p: PhaseT) => p.phaseType === 'knockout'

  // Determine logical column for each phase: use displayColumn if set, else array index.
  const phaseLogicalCol = (phase: PhaseT, fallback: number) =>
    phase.displayColumn ?? fallback

  // Map logical column numbers → sorted visual column indices (0-based for X positioning).
  const logicalCols = Array.from(
    new Set(phases.map((p, i) => phaseLogicalCol(p, i)))
  ).sort((a, b) => a - b)
  const colToVisual = new Map(logicalCols.map((col, vi) => [col, vi]))
  const numVisualCols = logicalCols.length

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

  // Build nodes — one per pool in each phase, X position driven by visual column.
  const nodes: DiagramNode[] = []
  const nodeMap = new Map<string, DiagramNode>()
  phases.forEach((phase, fallbackIndex) => {
    const ko = isKO(phase)
    const logicalCol = phaseLogicalCol(phase, fallbackIndex)
    const visualCol = colToVisual.get(logicalCol) ?? fallbackIndex
    phase.pools.forEach(pool => {
      const id = `${phase.slug}:${pool.slug}`
      const displayName = pool.isDefault ? phase.name : pool.name
      let slots: [string, string] | null = null
      if (ko) {
        const savedSlotLabels = pool.slotLabels ?? []
        slots = [
          savedSlotLabels[0] ?? slotLabels.get(`${phase.slug}:${pool.slug}:1`) ?? '...',
          savedSlotLabels[1] ?? slotLabels.get(`${phase.slug}:${pool.slug}:2`) ?? '...',
        ]
      }
      const node: DiagramNode = {
        id, phaseSlug: phase.slug, phaseName: phase.name,
        poolSlug: pool.slug, displayName, isKnockout: ko, slots,
        colIndex: visualCol,
        x: SP + visualCol * (NW + CG),
        y: 0, // computed below
        h: ko ? MH : GH,
      }
      nodes.push(node)
      nodeMap.set(id, node)
    })
  })

  // ── Y layout ──────────────────────────────────────────────────────────────
  // Group nodes by visual column index.
  const byCol: DiagramNode[][] = Array.from({ length: numVisualCols }, (_, i) =>
    nodes.filter(n => n.colIndex === i)
  )

  // Helper: centre each node in a column on its source nodes, then sort and enforce spacing.
  function layoutColBySource(colNodes: DiagramNode[], gap: number) {
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
    colNodes.sort((a, b) => a.y - b.y)
    for (let i = 1; i < colNodes.length; i++) {
      const prev = colNodes[i - 1]
      const curr = colNodes[i]
      const minY = prev.y + prev.h + gap
      if (curr.y < minY) curr.y = minY
    }
    for (const n of colNodes) {
      if (n.y < TP + HDR) n.y = TP + HDR
    }
  }

  // Detect the "play-in + main bracket" case: col 1 has both play-in-sourced nodes
  // and direct-seed orphans. If we let orphans default to y=0 they cluster at the top
  // and push play-in-connected nodes to the bottom, scrambling the whole diagram.
  // Fix: pack col 1 evenly from the top (independent of col 0), then position col 0
  // by centring each play-in node on its col 1 destination (reversed dependency).
  const col0PhaseSlug = phases[0]?.slug
  const col1Nodes = byCol[1] ?? []
  const col1SourcedIds = new Set(
    progressions
      .filter(p => p.fromPhase === col0PhaseSlug)
      .map(p => `${p.toPhase}:${p.toPool}`)
  )
  const useReverseLayout =
    byCol.length >= 2 &&
    col1Nodes.some(n => col1SourcedIds.has(n.id)) &&
    col1Nodes.some(n => !col1SourcedIds.has(n.id))

  if (useReverseLayout) {
    // Col 1: pack from top, ignoring preliminary sources.
    let cursor = TP + HDR
    for (const n of col1Nodes) {
      n.y = cursor
      cursor += n.h + MG
    }

    // Col 2+ (QF, SF, Final): standard source-centring (col 1 now correctly positioned).
    for (let col = 2; col < byCol.length; col++) {
      const colNodes = byCol[col]
      if (!colNodes?.length) continue
      layoutColBySource(colNodes, colNodes[0]?.isKnockout ? MG : NG)
    }

    // Col 0 (preliminary): centre each play-in on its col 1 destination.
    const col0Nodes = byCol[0] ?? []
    for (const node of col0Nodes) {
      const outgoing = progressions.filter(
        p => p.fromPhase === node.phaseSlug && p.fromPool === node.poolSlug
      )
      if (outgoing.length > 0) {
        const dest = nodeMap.get(`${outgoing[0].toPhase}:${outgoing[0].toPool}`)
        node.y = dest ? dest.y + (dest.h - node.h) / 2 : TP + HDR
      } else {
        node.y = TP + HDR
      }
    }
    // Sort then enforce minimum spacing.
    col0Nodes.sort((a, b) => a.y - b.y)
    for (let i = 1; i < col0Nodes.length; i++) {
      const prev = col0Nodes[i - 1]
      const curr = col0Nodes[i]
      const minY = prev.y + prev.h + MG
      if (curr.y < minY) curr.y = minY
    }
    for (const n of col0Nodes) {
      if (n.y < TP + HDR) n.y = TP + HDR
    }
  } else {
    // Standard layout: column 0 packs from top, subsequent columns centre on sources.
    if (byCol[0]) {
      let cursor = TP + HDR
      for (const n of byCol[0]) {
        n.y = cursor
        cursor += n.h + NG
      }
    }
    for (let col = 1; col < byCol.length; col++) {
      const colNodes = byCol[col]
      if (!colNodes?.length) continue
      layoutColBySource(colNodes, colNodes[0]?.isKnockout ? MG : NG)
    }
  }

  // ── Bracket layout pass (Championship / Plate grading diagrams) ─────────
  // Detects Championship and Plate node groups and applies a consistent two-zone
  // layout so Championship nodes are always above the separator and Plate below.
  function nodeBracket(phaseSlug: string): 'championship' | 'plate' | null {
    if (phaseSlug === 'championship' || phaseSlug.startsWith('championship-')) return 'championship'
    if (phaseSlug === 'plate' || phaseSlug.startsWith('plate-')) return 'plate'
    return null
  }

  function packedHeight(nodeList: DiagramNode[]): number {
    if (nodeList.length === 0) return 0
    const gap = nodeList[0].isKnockout ? MG : NG
    return nodeList.reduce((h, n) => h + n.h, 0) + (nodeList.length - 1) * gap
  }

  const hasChampBracket = nodes.some(n => nodeBracket(n.phaseSlug) === 'championship')
  const hasPlateBracket = nodes.some(n => nodeBracket(n.phaseSlug) === 'plate')
  const hasBothBrackets = hasChampBracket && hasPlateBracket

  let separatorY: number | null = null

  if (hasBothBrackets) {
    // 1. Compute the tallest championship/plate section across non-zero columns.
    let maxPhaseChampH = 0
    let maxPhasePlateH = 0
    for (let col = 1; col < byCol.length; col++) {
      maxPhaseChampH = Math.max(maxPhaseChampH, packedHeight(byCol[col].filter(n => nodeBracket(n.phaseSlug) === 'championship')))
      maxPhasePlateH = Math.max(maxPhasePlateH, packedHeight(byCol[col].filter(n => nodeBracket(n.phaseSlug) === 'plate')))
    }

    // 2. Zone height is the larger of:
    //    - the tallest phase content (e.g. 2 knockout nodes for semis)
    //    - half of the pool column natural height (so pools distribute uniformly)
    const poolNodes = byCol[0] ?? []
    const poolNaturalH = poolNodes.length > 0
      ? poolNodes.length * GH + Math.max(0, poolNodes.length - 1) * NG
      : 0
    const poolDerivedZoneH = poolNaturalH > 0 ? Math.max(0, (poolNaturalH - BRACKET_VGAP) / 2) : 0
    const zoneH = Math.max(maxPhaseChampH, maxPhasePlateH, poolDerivedZoneH)

    const champZoneTop = TP + HDR
    const plateZoneTop = champZoneTop + zoneH + BRACKET_VGAP
    separatorY = champZoneTop + zoneH + BRACKET_VGAP / 2

    // 3. Position championship nodes: centred within their zone.
    for (let col = 1; col < byCol.length; col++) {
      const champCol = byCol[col].filter(n => nodeBracket(n.phaseSlug) === 'championship')
      if (champCol.length === 0) continue
      const gap = champCol[0].isKnockout ? MG : NG
      const h = packedHeight(champCol)
      let cursor = champZoneTop + Math.max(0, (zoneH - h) / 2)
      for (const n of champCol) { n.y = cursor; cursor += n.h + gap }
    }

    // 4. Position plate nodes: centred within their zone.
    for (let col = 1; col < byCol.length; col++) {
      const plateCol = byCol[col].filter(n => nodeBracket(n.phaseSlug) === 'plate')
      if (plateCol.length === 0) continue
      const gap = plateCol[0].isKnockout ? MG : NG
      const h = packedHeight(plateCol)
      let cursor = plateZoneTop + Math.max(0, (zoneH - h) / 2)
      for (const n of plateCol) { n.y = cursor; cursor += n.h + gap }
    }

    // 5. Distribute pool nodes so they span the full championship+plate stack height.
    //    Spacing is stretched when pools are fewer than the stack demands.
    const totalStackH = zoneH * 2 + BRACKET_VGAP
    if (poolNodes.length > 0) {
      const poolSpacing = poolNodes.length > 1
        ? Math.max(NG, (totalStackH - poolNodes.length * GH) / (poolNodes.length - 1))
        : 0
      let cursor = champZoneTop
      for (const n of poolNodes) { n.y = cursor; cursor += n.h + poolSpacing }
    }
  }

  // ── Column height balancing ───────────────────────────────────────────────
  // Only runs on standard (non-bracket, non-reverse) formats.
  if (!hasBothBrackets && !useReverseLayout) {
    const col0A = byCol[0] ?? []
    const col1KO = (byCol[1] ?? []).filter(n => n.isKnockout)

    // Case A — single source node (e.g. round-robin) → multiple terminal knockout matches
    // (placement finals). Centre the source on the midpoint of its destinations.
    if (
      col0A.length === 1 &&
      col1KO.length >= 2 &&
      col1KO.every(n =>
        progressions.some(p =>
          p.fromPhase === col0A[0].phaseSlug && p.fromPool === col0A[0].poolSlug &&
          p.toPhase === n.phaseSlug && p.toPool === n.poolSlug
        )
      ) &&
      !col1KO.some(n =>
        progressions.some(p => p.fromPhase === n.phaseSlug && p.fromPool === n.poolSlug)
      )
    ) {
      const sorted1 = [...col1KO].sort((a, b) => a.y - b.y)
      const col1Mid = (sorted1[0].y + sorted1[sorted1.length - 1].y + sorted1[sorted1.length - 1].h) / 2
      col0A[0].y = Math.max(TP + HDR, col1Mid - col0A[0].h / 2)
    }

    // Case B — multi-pool group stage (col 0) → knockout bracket (col 1).
    // Zone-distribute: both pool nodes and col-1 KO nodes span max(poolPackedH, koPackedH),
    // matching the grading format's evenly-stretched pool column visual.
    const col0Pools = col0A.filter(n => !n.isKnockout)
    if (col0Pools.length >= 2 && col1KO.length >= 2) {
      const poolH = col0Pools.reduce((h, n) => h + n.h, 0)
      const poolPackedH = poolH + (col0Pools.length - 1) * NG
      const koH = col1KO.reduce((h, n) => h + n.h, 0)
      const koPackedH = koH + (col1KO.length - 1) * MG
      const zoneH = Math.max(poolPackedH, koPackedH)
      const zoneTop = TP + HDR
      // Distribute pool nodes evenly across zone height
      const poolGap = col0Pools.length > 1 ? Math.max(NG, (zoneH - poolH) / (col0Pools.length - 1)) : 0
      const sortedPools = [...col0Pools].sort((a, b) => a.y - b.y)
      let cursor = zoneTop
      for (const n of sortedPools) { n.y = cursor; cursor += n.h + poolGap }
      // Distribute col-1 knockout nodes evenly across same zone height
      const koGap = col1KO.length > 1 ? Math.max(MG, (zoneH - koH) / (col1KO.length - 1)) : 0
      const sorted1ko = [...col1KO].sort((a, b) => a.y - b.y)
      cursor = zoneTop
      for (const n of sorted1ko) { n.y = cursor; cursor += n.h + koGap }
      // Re-centre subsequent knockout columns on their repositioned sources.
      for (let col = 2; col < byCol.length; col++) {
        const cn = byCol[col]
        if (!cn?.length) continue
        layoutColBySource(cn, cn[0]?.isKnockout ? MG : NG)
      }
    }
  }

  // ── Y-alignment overrides (double elimination: pin prelim/grand-final to specific nodes) ─
  for (const phase of phases) {
    if (!phase.yAlignNode) continue
    const targetNode = nodeMap.get(phase.yAlignNode)
    if (!targetNode) continue
    nodes.filter(n => n.phaseSlug === phase.slug).forEach(n => { n.y = targetNode.y })
  }

  // ── Canvas size ───────────────────────────────────────────────────────────
  const totalW = SP * 2 + numVisualCols * NW + Math.max(0, numVisualCols - 1) * CG
  const maxBottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), TP + HDR + 40)
  const totalH = maxBottom + BP

  // ── Edges & buses ────────────────────────────────────────────────────────
  const seen = new Set<string>()
  const edges: DiagramEdge[] = []
  const buses: DiagramBus[] = []

  // Pool → next-phase: group by (sourceCol → destCol) so all pools in a column
  // share one bus per destination column. The grading split (Championship +
  // Plate sharing a destination column) collapses into a single shared bus;
  // skip-column destinations get their own bus to avoid arrows crossing
  // intermediate columns.
  const poolProgsByColPair = new Map<string, ProgT[]>()
  for (const prog of progressions) {
    const from = nodeMap.get(`${prog.fromPhase}:${prog.fromPool}`)
    const to = nodeMap.get(`${prog.toPhase}:${prog.toPool}`)
    if (!from || !to || from.isKnockout) continue
    const key = `${from.colIndex}->${to.colIndex}`
    const arr = poolProgsByColPair.get(key) ?? []
    arr.push(prog)
    poolProgsByColPair.set(key, arr)
  }

  for (const [pairKey, progs] of poolProgsByColPair) {
    const sourceMap = new Map<string, DiagramNode>()
    const destMap = new Map<string, DiagramNode>()
    for (const prog of progs) {
      const src = nodeMap.get(`${prog.fromPhase}:${prog.fromPool}`)
      const dst = nodeMap.get(`${prog.toPhase}:${prog.toPool}`)
      if (!src || !dst) continue
      sourceMap.set(src.id, src)
      destMap.set(dst.id, dst)
    }
    const sources = [...sourceMap.values()]
    const dests = [...destMap.values()]
    if (sources.length === 0 || dests.length === 0) continue

    const sourceRightX = sources[0].x + NW
    const leftmostDestX = Math.min(...dests.map(n => n.x))
    const busX = (sourceRightX + leftmostDestX) / 2

    const stubs = sources.map(n => ({ fromX: n.x + NW, y: n.y + n.h / 2 }))
    const fanouts = dests.map(n => ({ toX: n.x, y: n.y + n.h / 2 }))
    const allYs = [...stubs.map(s => s.y), ...fanouts.map(f => f.y)]
    const y1 = Math.min(...allYs)
    const y2 = Math.max(...allYs)

    buses.push({ key: `bus-${pairKey}`, x: busX, y1, y2, stubs, fanouts })
  }

  // Knockout → knockout: keep exact progression routing with optional labels.
  for (const prog of progressions) {
    const from = nodeMap.get(`${prog.fromPhase}:${prog.fromPool}`)
    const to   = nodeMap.get(`${prog.toPhase}:${prog.toPool}`)
    if (!from || !to) continue
    if (!from.isKnockout) continue
    const key = `${prog.fromPhase}:${prog.fromPool}→${prog.toPhase}:${prog.toPool}`
    if (seen.has(key)) continue
    seen.add(key)
    const label = prog.showEdgeLabel
      ? (prog.sourceType === 'match_winner' ? 'Winner' : prog.sourceType === 'match_loser' ? 'Loser' : undefined)
      : undefined
    edges.push({
      key,
      fromX: from.x + NW,
      fromY: from.y + from.h / 2,
      toX: to.x,
      toY: to.y + to.h / 2,
      fromCol: from.colIndex,
      toCol: to.colIndex,
      skipSafeY: from.y - 8,
      label,
    })
  }

  // X position where the separator line should start — left edge of the first bracket column.
  const separatorStartX = separatorY !== null
    ? nodes
        .filter(n => nodeBracket(n.phaseSlug) !== null)
        .reduce((min, n) => Math.min(min, n.x), totalW)
    : SP

  return { nodes, edges, buses, totalW, totalH, separatorY, separatorStartX, phases }
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

  const { nodes, edges, buses, totalW, totalH, separatorY, separatorStartX } = useMemo(
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
        {separatorY !== null
          ? /* Grading: zone labels starting from the bracket column (not the pool column) */
            [
              { label: 'Championship', y: TP },
              { label: 'Plate', y: separatorY + 6 },
            ].map(({ label, y }) => (
              <div
                key={label}
                className="absolute text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ left: separatorStartX + SP, right: SP, top: y, textAlign: 'left' }}
              >
                {label}
              </div>
            ))
          : /* Standard: one label per visual column */
            nodes
              .reduce<{ colIndex: number; label: string }[]>((acc, node) => {
                if (acc.some(h => h.colIndex === node.colIndex)) return acc
                const colPhaseNames = [...new Set(
                  nodes.filter(n => n.colIndex === node.colIndex).map(n => n.phaseName)
                )]
                acc.push({ colIndex: node.colIndex, label: colPhaseNames.join(' / ') })
                return acc
              }, [])
              .map(({ colIndex, label }) => (
                <div
                  key={colIndex}
                  className="absolute text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  style={{ left: SP + colIndex * (NW + CG), width: NW, top: TP }}
                >
                  {label}
                </div>
              ))
        }

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
          {/* Championship / Plate separator — starts at the bracket column, not the pool column */}
          {separatorY !== null && (
            <line
              x1={separatorStartX}
              y1={separatorY}
              x2={totalW + SP}
              y2={separatorY}
              strokeWidth="1"
              strokeDasharray="5 4"
              className="stroke-zinc-300 dark:stroke-zinc-600"
            />
          )}
          {buses.map(bus => (
            <g key={bus.key}>
              {bus.stubs.map((s, i) => (
                <line
                  key={`stub-${i}`}
                  x1={s.fromX + SP}
                  y1={s.y}
                  x2={bus.x + SP}
                  y2={s.y}
                  strokeWidth="1.5"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
              ))}
              <line
                x1={bus.x + SP}
                y1={bus.y1}
                x2={bus.x + SP}
                y2={bus.y2}
                strokeWidth="1.5"
                className="stroke-zinc-300 dark:stroke-zinc-600"
              />
              {bus.fanouts.map((f, i) => (
                <line
                  key={`fan-${i}`}
                  x1={bus.x + SP}
                  y1={f.y}
                  x2={f.toX + SP - 2}
                  y2={f.y}
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
              ))}
            </g>
          ))}
          {edges.map(edge => {
            const isSkip = edge.toCol > edge.fromCol + 1
            const isStraightSkip = isSkip && Math.abs(edge.fromY - edge.toY) <= 1
            const fx = edge.fromX + SP
            const tx = edge.toX + SP - 2
            const d = isStraightSkip
              ? `M ${fx} ${edge.fromY} H ${tx}`
              : isSkip
                ? `M ${fx} ${edge.fromY} V ${edge.skipSafeY} H ${tx} V ${edge.toY}`
                : `M ${fx} ${edge.fromY} H ${(edge.fromX + edge.toX) / 2 + SP} V ${edge.toY} H ${tx}`
            const labelX = (fx + tx) / 2
            const labelY = (edge.fromY + edge.toY) / 2 - 7
            return (
              <g key={edge.key}>
                <path
                  d={d}
                  fill="none"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
                {edge.label && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    fontSize="8"
                    className="fill-zinc-400 dark:fill-zinc-500"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
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

type SavedPool = Pool & { pool_teams?: PoolTeam[] }
type SavedPhaseElement = PhaseElement & { slots?: ElementSlot[] }
export type SavedFormatDiagramPhase = Phase & {
  pools?: SavedPool[]
  phase_elements?: SavedPhaseElement[]
}

interface NodeRef {
  phaseSlug: string
  poolSlug: string
}

interface SavedDiagramModel {
  phases: PhaseT[]
  progressions: ProgT[]
  phaseBySlug: Map<string, SavedFormatDiagramPhase>
}

function phaseMetadata(phase: SavedFormatDiagramPhase): Record<string, unknown> {
  return phase.metadata && typeof phase.metadata === 'object' ? phase.metadata : {}
}

function savedDisplayColumn(phase: SavedFormatDiagramPhase): number | undefined {
  const metadata = phaseMetadata(phase)
  const value =
    metadata.diagram_display_column ??
    metadata.format_diagram_display_column ??
    metadata.displayColumn ??
    metadata.display_column
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function savedYAlignNode(
  phase: SavedFormatDiagramPhase,
  phaseBySlug: Map<string, SavedFormatDiagramPhase>
): string | undefined {
  const metadata = phaseMetadata(phase)
  const value =
    metadata.diagram_y_align_node ??
    metadata.format_diagram_y_align_node ??
    metadata.yAlignNode

  if (typeof value === 'string' && value.trim()) return value

  if (phase.slug === 'preliminary-final' && phaseBySlug.has('major-minor-finals')) {
    return 'major-minor-finals:minor-semi-final'
  }
  if (phase.slug === 'grand-final' && phaseBySlug.has('major-minor-finals')) {
    return 'major-minor-finals:major-semi-final'
  }
  if (phase.slug.endsWith('-prelim-final')) {
    const prefix = phase.slug.slice(0, -'-prelim-final'.length)
    const majorMinorSlug = `${prefix}-major-minor`
    if (phaseBySlug.has(majorMinorSlug)) return `${majorMinorSlug}:minor-semi-final`
  }
  if (phase.slug.endsWith('-grand-final')) {
    const prefix = phase.slug.slice(0, -'-grand-final'.length)
    const majorMinorSlug = `${prefix}-major-minor`
    if (phaseBySlug.has(majorMinorSlug)) return `${majorMinorSlug}:major-semi-final`
  }

  return undefined
}

function formatSavedSlotLabel(slot: ElementSlot, teamById: Map<string, Team>): string {
  if (slot.label?.trim()) return slot.label
  if (slot.team_id) return teamById.get(slot.team_id)?.name ?? 'Team'
  if (slot.slot_type === 'bye') return 'Bye'
  if (slot.slot_type === 'placeholder') return 'TBC'
  if (slot.slot_type === 'manual') return 'Manual entry'
  if (slot.source_outcome === 'winner') return 'Winner'
  if (slot.source_outcome === 'loser') return 'Loser'
  if (slot.source_outcome === 'best_rank') {
    return slot.source_rank ? `Best ${ordinal(slot.source_rank)}` : 'Best qualifier'
  }
  if (slot.source_rank) return `${ordinal(slot.source_rank)} qualifier`
  return 'Qualifier'
}

function buildSavedDiagramModel(
  phases: SavedFormatDiagramPhase[],
  progressionRules: ProgressionRule[],
  matches: Match[],
  teams: Team[]
): SavedDiagramModel {
  const sortedPhases = [...phases].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  )
  const phaseIds = new Set(sortedPhases.map((phase) => phase.id))
  const phaseById = new Map(sortedPhases.map((phase) => [phase.id, phase]))
  const phaseBySlug = new Map(sortedPhases.map((phase) => [phase.slug, phase]))
  const phaseIndexById = new Map(sortedPhases.map((phase, index) => [phase.id, index]))
  const poolById = new Map<string, SavedPool>()
  const elementById = new Map<string, SavedPhaseElement>()
  const elementByPoolId = new Map<string, SavedPhaseElement>()
  const slotById = new Map<string, ElementSlot>()
  const matchById = new Map(matches.map((match) => [match.id, match]))
  const teamById = new Map(teams.map((team) => [team.id, team]))

  for (const phase of sortedPhases) {
    for (const pool of phase.pools ?? []) {
      poolById.set(pool.id, pool)
    }
    for (const element of phase.phase_elements ?? []) {
      elementById.set(element.id, element)
      if (element.pool_id) elementByPoolId.set(element.pool_id, element)
      for (const slot of element.slots ?? []) {
        slotById.set(slot.id, slot)
      }
    }
  }

  const nodeByPoolId = new Map<string, NodeRef>()
  const nodeByElementId = new Map<string, NodeRef>()
  const nodeByPhaseId = new Map<string, NodeRef>()

  for (const phase of sortedPhases) {
    const pools = [...(phase.pools ?? [])].sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
    )
    for (const pool of pools) {
      const ref = { phaseSlug: phase.slug, poolSlug: pool.slug }
      nodeByPoolId.set(pool.id, ref)
      if (!nodeByPhaseId.has(phase.id)) nodeByPhaseId.set(phase.id, ref)
    }

    const elements = [...(phase.phase_elements ?? [])].sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
    )
    for (const element of elements) {
      const poolRef = element.pool_id ? nodeByPoolId.get(element.pool_id) : undefined
      const ref = poolRef ?? { phaseSlug: phase.slug, poolSlug: element.slug }
      nodeByElementId.set(element.id, ref)
      if (!nodeByPhaseId.has(phase.id)) nodeByPhaseId.set(phase.id, ref)
    }
  }

  const targetPhaseIdForRule = (rule: ProgressionRule) =>
    rule.to_phase_id ?? elementById.get(rule.to_element_id)?.phase_id ?? null

  const sourcePhaseIdForRule = (rule: ProgressionRule) => {
    if (rule.from_phase_id) return rule.from_phase_id
    if (rule.from_element_id) return elementById.get(rule.from_element_id)?.phase_id ?? null
    if (rule.from_pool_id) return poolById.get(rule.from_pool_id)?.phase_id ?? null
    if (rule.from_match_id) {
      const match = matchById.get(rule.from_match_id)
      return (
        match?.phase_id ??
        (match?.phase_element_id ? elementById.get(match.phase_element_id)?.phase_id : null) ??
        (match?.pool_id ? poolById.get(match.pool_id)?.phase_id : null) ??
        null
      )
    }
    return null
  }

  const sourceNodeForRule = (rule: ProgressionRule): NodeRef | null => {
    if (rule.from_match_id) {
      const match = matchById.get(rule.from_match_id)
      const matchElementNode = match?.phase_element_id ? nodeByElementId.get(match.phase_element_id) : undefined
      const matchPoolNode = match?.pool_id ? nodeByPoolId.get(match.pool_id) : undefined
      const matchPhaseNode = match?.phase_id ? nodeByPhaseId.get(match.phase_id) : undefined
      if (matchElementNode || matchPoolNode || matchPhaseNode) {
        return matchElementNode ?? matchPoolNode ?? matchPhaseNode ?? null
      }
    }
    if (rule.from_element_id) return nodeByElementId.get(rule.from_element_id) ?? null
    if (rule.from_pool_id) return nodeByPoolId.get(rule.from_pool_id) ?? null
    if (rule.from_phase_id) return nodeByPhaseId.get(rule.from_phase_id) ?? null
    return null
  }

  const relevantRules = progressionRules.filter((rule) => {
    const targetPhaseId = targetPhaseIdForRule(rule)
    return targetPhaseId ? phaseIds.has(targetPhaseId) : false
  })

  const incomingSourceIdsByPhase = new Map<string, Set<string>>()
  for (const rule of relevantRules) {
    const targetPhaseId = targetPhaseIdForRule(rule)
    const sourcePhaseId = sourcePhaseIdForRule(rule)
    if (!targetPhaseId || !sourcePhaseId || targetPhaseId === sourcePhaseId) continue
    const sourceIds = incomingSourceIdsByPhase.get(targetPhaseId) ?? new Set<string>()
    sourceIds.add(sourcePhaseId)
    incomingSourceIdsByPhase.set(targetPhaseId, sourceIds)
  }

  const displayColumnByPhaseId = new Map<string, number>()
  for (const [index, phase] of sortedPhases.entries()) {
    const metadataColumn = savedDisplayColumn(phase)
    if (metadataColumn !== undefined) {
      displayColumnByPhaseId.set(phase.id, metadataColumn)
      continue
    }

    const sourceIds = incomingSourceIdsByPhase.get(phase.id)
    if (sourceIds?.size) {
      const sourceColumns = [...sourceIds].map((sourceId) =>
        displayColumnByPhaseId.get(sourceId) ?? phaseIndexById.get(sourceId) ?? 0
      )
      displayColumnByPhaseId.set(phase.id, Math.max(...sourceColumns) + 1)
      continue
    }

    const previousPhase = sortedPhases[index - 1]
    displayColumnByPhaseId.set(
      phase.id,
      previousPhase ? (displayColumnByPhaseId.get(previousPhase.id) ?? index - 1) + 1 : 0
    )
  }

  const diagramPhases: PhaseT[] = sortedPhases.map((phase) => {
    const pools = [...(phase.pools ?? [])].sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
    )
    const elements = [...(phase.phase_elements ?? [])].sort(
      (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
    )
    const diagramPools: PoolT[] = pools.map((pool) => {
      const element = elementByPoolId.get(pool.id)
      const slotLabels = (element?.slots ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((slot) => formatSavedSlotLabel(slot, teamById))
      return {
        slug: pool.slug,
        name: pool.name,
        isDefault: pool.is_default,
        slotLabels,
      }
    })

    for (const element of elements) {
      if (element.pool_id) continue
      diagramPools.push({
        slug: element.slug,
        name: element.name,
        slotLabels: (element.slots ?? [])
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((slot) => formatSavedSlotLabel(slot, teamById)),
      })
    }

    return {
      slug: phase.slug,
      name: phase.name,
      phaseType: phase.phase_type,
      displayColumn: displayColumnByPhaseId.get(phase.id),
      yAlignNode: savedYAlignNode(phase, phaseBySlug),
      pools: diagramPools,
    }
  })

  const sourceTypesByNode = new Map<string, Set<ProgressionRule['source_type']>>()
  for (const rule of relevantRules) {
    const sourceNode = sourceNodeForRule(rule)
    if (!sourceNode) continue
    const key = `${sourceNode.phaseSlug}:${sourceNode.poolSlug}`
    const types = sourceTypesByNode.get(key) ?? new Set<ProgressionRule['source_type']>()
    types.add(rule.source_type)
    sourceTypesByNode.set(key, types)
  }

  const diagramProgressions: ProgT[] = []
  for (const rule of relevantRules) {
    if (rule.source_type === 'manual') continue
    const targetNode = nodeByElementId.get(rule.to_element_id)
    if (!targetNode) continue

    const sourcePhaseId = sourcePhaseIdForRule(rule)
    const sourcePhase = sourcePhaseId ? phaseById.get(sourcePhaseId) : undefined
    const isBestRank = rule.source_type === 'best_rank'
    const sourceNode = isBestRank ? null : sourceNodeForRule(rule)
    if (!isBestRank && !sourceNode) continue
    if (isBestRank && !sourcePhase) continue

    const startSlot =
      rule.to_slot_order ??
      (rule.to_slot_id ? slotById.get(rule.to_slot_id)?.display_order : undefined) ??
      rule.display_order

    const sourceKey = sourceNode ? `${sourceNode.phaseSlug}:${sourceNode.poolSlug}` : null
    const sourceTypes = sourceKey ? sourceTypesByNode.get(sourceKey) : undefined
    const showEdgeLabel =
      (rule.source_type === 'match_winner' || rule.source_type === 'match_loser') &&
      Boolean(sourceTypes?.has('match_loser'))

    diagramProgressions.push({
      fromPhase: sourceNode?.phaseSlug ?? sourcePhase!.slug,
      fromPool: sourceNode?.poolSlug ?? '__best_rank__',
      ranks: [rule.source_rank ?? 1],
      sourceType: rule.source_type,
      toPhase: targetNode.phaseSlug,
      toPool: targetNode.poolSlug,
      startSlot,
      isBestRank,
      showEdgeLabel,
    })
  }

  return { phases: diagramPhases, progressions: diagramProgressions, phaseBySlug }
}

function SavedFormatDiagramCanvas({
  phases,
  progressions,
  onNodeClick,
}: {
  phases: PhaseT[]
  progressions: ProgT[]
  onNodeClick?: (node: DiagramNode) => void
}) {
  const { nodes, edges, buses, totalW, totalH, separatorY, separatorStartX } = useMemo(
    () => buildDiagram(phases, progressions),
    [phases, progressions]
  )

  if (nodes.length === 0) return null

  function renderNodeContent(node: DiagramNode) {
    if (node.isKnockout && node.slots) {
      return (
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
      )
    }

    return (
      <div className="flex h-full flex-col justify-center px-3">
        <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {node.displayName}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          {node.phaseName !== node.displayName ? node.phaseName : 'Group stage'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="px-4 pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Format diagram
        </p>
      </div>
      <div className="relative min-w-full p-4" style={{ width: totalW + SP * 2, height: totalH }}>
        {separatorY !== null
          ? [
              { label: 'Championship', y: TP },
              { label: 'Plate', y: separatorY + 6 },
            ].map(({ label, y }) => (
              <div
                key={label}
                className="absolute text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ left: separatorStartX + SP, right: SP, top: y, textAlign: 'left' }}
              >
                {label}
              </div>
            ))
          : nodes
              .reduce<{ colIndex: number; label: string }[]>((acc, node) => {
                if (acc.some(h => h.colIndex === node.colIndex)) return acc
                const colPhaseNames = [...new Set(
                  nodes.filter(n => n.colIndex === node.colIndex).map(n => n.phaseName)
                )]
                acc.push({ colIndex: node.colIndex, label: colPhaseNames.join(' / ') })
                return acc
              }, [])
              .map(({ colIndex, label }) => (
                <div
                  key={colIndex}
                  className="absolute text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  style={{ left: SP + colIndex * (NW + CG), width: NW, top: TP }}
                >
                  {label}
                </div>
              ))
        }

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
          {separatorY !== null && (
            <line
              x1={separatorStartX}
              y1={separatorY}
              x2={totalW + SP}
              y2={separatorY}
              strokeWidth="1"
              strokeDasharray="5 4"
              className="stroke-zinc-300 dark:stroke-zinc-600"
            />
          )}
          {buses.map(bus => (
            <g key={bus.key}>
              {bus.stubs.map((s, i) => (
                <line
                  key={`stub-${i}`}
                  x1={s.fromX + SP}
                  y1={s.y}
                  x2={bus.x + SP}
                  y2={s.y}
                  strokeWidth="1.5"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
              ))}
              <line
                x1={bus.x + SP}
                y1={bus.y1}
                x2={bus.x + SP}
                y2={bus.y2}
                strokeWidth="1.5"
                className="stroke-zinc-300 dark:stroke-zinc-600"
              />
              {bus.fanouts.map((f, i) => (
                <line
                  key={`fan-${i}`}
                  x1={bus.x + SP}
                  y1={f.y}
                  x2={f.toX + SP - 2}
                  y2={f.y}
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
              ))}
            </g>
          ))}
          {edges.map(edge => {
            const isSkip = edge.toCol > edge.fromCol + 1
            const isStraightSkip = isSkip && Math.abs(edge.fromY - edge.toY) <= 1
            const fx = edge.fromX + SP
            const tx = edge.toX + SP - 2
            const d = isStraightSkip
              ? `M ${fx} ${edge.fromY} H ${tx}`
              : isSkip
                ? `M ${fx} ${edge.fromY} V ${edge.skipSafeY} H ${tx} V ${edge.toY}`
                : `M ${fx} ${edge.fromY} H ${(edge.fromX + edge.toX) / 2 + SP} V ${edge.toY} H ${tx}`
            const labelX = (fx + tx) / 2
            const labelY = (edge.fromY + edge.toY) / 2 - 7
            return (
              <g key={edge.key}>
                <path
                  d={d}
                  fill="none"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                  className="stroke-zinc-300 dark:stroke-zinc-600"
                />
                {edge.label && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    fontSize="8"
                    className="fill-zinc-400 dark:fill-zinc-500"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {nodes.map(node => {
          const className = [
            'absolute overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm dark:border-zinc-700 dark:bg-zinc-950',
            onNodeClick
              ? 'cursor-pointer transition hover:border-mk-red hover:shadow-md focus:outline-none focus:ring-2 focus:ring-mk-red focus:ring-offset-2 dark:focus:ring-offset-zinc-950'
              : '',
          ].join(' ')
          const style = { left: node.x + SP, top: node.y, width: NW, height: node.h }

          return onNodeClick ? (
            <button
              key={node.id}
              type="button"
              onClick={() => onNodeClick(node)}
              className={className}
              style={style}
              title={`Edit ${node.phaseName}`}
              aria-label={`Edit ${node.phaseName}`}
            >
              {renderNodeContent(node)}
            </button>
          ) : (
            <div key={node.id} className={className} style={style}>
              {renderNodeContent(node)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SavedFormatDiagram({
  phases,
  progressionRules,
  matches,
  teams,
  onEditStage,
}: {
  phases: SavedFormatDiagramPhase[]
  progressionRules: ProgressionRule[]
  matches?: Match[]
  teams?: Team[]
  onEditStage?: (phase: SavedFormatDiagramPhase) => void
}) {
  const model = useMemo(
    () => buildSavedDiagramModel(phases, progressionRules, matches ?? [], teams ?? []),
    [matches, phases, progressionRules, teams]
  )

  return (
    <SavedFormatDiagramCanvas
      phases={model.phases}
      progressions={model.progressions}
      onNodeClick={
        onEditStage
          ? (node) => {
              const phase = model.phaseBySlug.get(node.phaseSlug)
              if (phase) onEditStage(phase)
            }
          : undefined
      }
    />
  )
}
