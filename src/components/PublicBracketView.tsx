'use client'

import { useEffect, useState } from 'react'
import TeamLogo from './TeamLogo'
import { formatKickoffTime } from '@/lib/time'
import type { ElementSlot, Match, Phase, Pool, Team } from '@/lib/types'

type BracketPhase = Phase & { pools?: Pool[] }

interface PublicBracketViewProps {
  phases: BracketPhase[]
  currentPhaseId: string | null
  matches: Match[]
  teams: Team[]
  slots: ElementSlot[]
  desktopLayout?: DesktopBracketLayout
}

type Entrant = {
  team: Team | null
  label: string
  score: number | null
  winner: boolean
  isBye: boolean
  isPlaceholder: boolean
}

type RoundGroup = {
  phase: BracketPhase
  matches: Match[]
}

type BoardColumn = {
  key: string
  side: 'left' | 'center' | 'right'
  phase: BracketPhase
  matches: Match[]
  originalMatchCount: number
  baseMatchCount: number
}

type DesktopBracketLayout = 'progression' | 'wall-chart'

const DESKTOP_CARD_WIDTH_REM = 12
const DESKTOP_FINAL_CARD_WIDTH_REM = 15
const DESKTOP_COLUMN_WIDTH_REM = 13
const DESKTOP_FINAL_COLUMN_WIDTH_REM = 16
const DESKTOP_COLUMN_GAP_REM = 1.75
const DESKTOP_ROW_HEIGHT_REM = 4.75
const DESKTOP_HEADER_OFFSET_REM = 3

function slotFallback(slot: ElementSlot | undefined) {
  if (!slot) return 'TBD'
  if (slot.slot_type === 'bye') return 'Bye'
  if (slot.label) return slot.label
  if (slot.source_outcome === 'winner') return 'Winner of previous fixture'
  if (slot.source_outcome === 'loser') return 'Loser of previous fixture'
  if ((slot.source_outcome === 'rank' || slot.source_outcome === 'best_rank') && slot.source_rank) {
    return `${slot.source_rank} place qualifier`
  }
  return 'TBD'
}

function winnerSide(match: Match) {
  if (match.status !== 'completed') return null
  if (match.home_score === null || match.away_score === null) return null
  if (match.home_score === match.away_score) return null
  return match.home_score > match.away_score ? 'home' : 'away'
}

function isMatchResolved(match: Match) {
  const isBye = match.away_team_id === null && !match.away_slot_id
  return isBye || match.status === 'completed'
}

function matchStatusLabel(match: Match, isBye: boolean) {
  if (isBye) return 'Bye'
  if (match.status === 'completed') return 'FT'
  if (!match.home_team_id || (!match.away_team_id && match.away_slot_id)) return 'TBD'
  return 'Scheduled'
}

function splitMatches(matches: Match[]) {
  const midpoint = Math.ceil(matches.length / 2)
  return {
    left: matches.slice(0, midpoint),
    right: matches.slice(midpoint),
  }
}

function buildWallChartColumns(rounds: RoundGroup[]): BoardColumn[] {
  const finalRound = rounds[rounds.length - 1]
  const feederRounds = rounds.slice(0, -1)
  const leftColumns: BoardColumn[] = []
  const rightColumns: BoardColumn[] = []

  for (const round of feederRounds) {
    const split = splitMatches(round.matches)
    leftColumns.push({
      key: `${round.phase.id}-left`,
      side: 'left',
      phase: round.phase,
      matches: split.left,
      originalMatchCount: round.matches.length,
      baseMatchCount: 1,
    })
    rightColumns.unshift({
      key: `${round.phase.id}-right`,
      side: 'right',
      phase: round.phase,
      matches: split.right,
      originalMatchCount: round.matches.length,
      baseMatchCount: 1,
    })
  }

  const leftBaseMatchCount = Math.max(1, leftColumns[0]?.matches.length ?? 1)
  const rightBaseMatchCount = Math.max(1, rightColumns[rightColumns.length - 1]?.matches.length ?? 1)
  const centerBaseMatchCount = Math.max(leftBaseMatchCount, rightBaseMatchCount)
  const normalizedLeftColumns = leftColumns.map((column) => ({
    ...column,
    baseMatchCount: leftBaseMatchCount,
  }))
  const normalizedRightColumns = rightColumns.map((column) => ({
    ...column,
    baseMatchCount: rightBaseMatchCount,
  }))

  return [
    ...normalizedLeftColumns,
    {
      key: `${finalRound.phase.id}-center`,
      side: 'center',
      phase: finalRound.phase,
      matches: finalRound.matches.slice(0, 1),
      originalMatchCount: finalRound.matches.length,
      baseMatchCount: centerBaseMatchCount,
    },
    ...normalizedRightColumns,
  ]
}

function buildProgressionColumns(rounds: RoundGroup[]): BoardColumn[] {
  const baseMatchCount = Math.max(1, rounds[0]?.matches.length ?? 1)

  return rounds.map((round, index) => {
    const isFinalRound = index === rounds.length - 1

    return {
      key: `${round.phase.id}-progression`,
      side: isFinalRound ? 'center' : 'left',
      phase: round.phase,
      matches: round.matches,
      originalMatchCount: round.matches.length,
      baseMatchCount,
    }
  })
}

function roundShortName(name: string) {
  if (name.toLowerCase().includes('quarter')) return 'QF'
  if (name.toLowerCase().includes('semi')) return 'SF'
  if (name.toLowerCase().includes('final')) return 'Final'
  return name
}

function defaultMobileRoundIndex(rounds: RoundGroup[]) {
  if (rounds.length === 0) return 0

  for (let index = 0; index < rounds.length; index += 1) {
    const round = rounds[index]
    const isFinalRound = index === rounds.length - 1

    if (isFinalRound) return index
    if (!round.matches.every(isMatchResolved)) return index
  }

  return rounds.length - 1
}

function columnWidthRem(column: BoardColumn) {
  return column.side === 'center' ? DESKTOP_FINAL_COLUMN_WIDTH_REM : DESKTOP_COLUMN_WIDTH_REM
}

function cardWidthRem(column: BoardColumn) {
  return column.side === 'center' ? DESKTOP_FINAL_CARD_WIDTH_REM : DESKTOP_CARD_WIDTH_REM
}

function totalRowsForColumn(column: BoardColumn) {
  return Math.max(2, column.baseMatchCount * 2)
}

function boardHeightRemForColumn(column: BoardColumn) {
  return Math.max(34, totalRowsForColumn(column) * DESKTOP_ROW_HEIGHT_REM)
}

function matchGridStart(column: BoardColumn, matchIndex: number) {
  const totalRows = totalRowsForColumn(column)
  const matchCount = Math.max(1, column.matches.length)
  const rowBlock = Math.max(1, totalRows / matchCount)
  return Math.max(1, Math.round(matchIndex * rowBlock + rowBlock / 2))
}

function matchCenterYRem(column: BoardColumn, matchIndex: number) {
  return DESKTOP_HEADER_OFFSET_REM + matchGridStart(column, matchIndex) * DESKTOP_ROW_HEIGHT_REM
}

function BracketEntrantRow({ entrant }: { entrant: Entrant }) {
  const rowTone = entrant.winner
    ? 'bg-white text-tm-navy'
    : entrant.isBye
      ? 'bg-white/5 text-white/35'
      : entrant.isPlaceholder
        ? 'bg-white/5 text-white/55'
        : 'bg-white/[0.08] text-white/85'

  return (
    <div className={`flex min-h-10 items-center gap-2 px-2.5 py-1.5 ${rowTone}`}>
      {entrant.team ? (
        <TeamLogo team={entrant.team} size="sm" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] font-black text-white/60">
          {entrant.isBye ? '-' : '?'}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${entrant.winner ? 'font-black' : 'font-semibold'}`}
        title={entrant.label}
      >
        {entrant.label}
      </span>
      <span
        className={
          entrant.winner
            ? 'flex h-7 min-w-8 items-center justify-center rounded bg-tm-orange px-2 text-sm font-black tabular-nums text-white'
            : 'flex h-7 min-w-8 items-center justify-center rounded bg-black/25 px-2 text-sm font-bold tabular-nums text-white/70'
        }
      >
        {entrant.score ?? '-'}
      </span>
    </div>
  )
}

function BracketMatchNode({
  match,
  phase,
  pool,
  teamsById,
  slotsById,
  featured = false,
  active = false,
  fullWidth = false,
}: {
  match: Match
  phase: BracketPhase
  pool: Pool | null
  teamsById: Map<string, Team>
  slotsById: Map<string, ElementSlot>
  featured?: boolean
  active?: boolean
  fullWidth?: boolean
}) {
  const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) ?? null : null
  const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) ?? null : null
  const homeSlot = match.home_slot_id ? slotsById.get(match.home_slot_id) : undefined
  const awaySlot = match.away_slot_id ? slotsById.get(match.away_slot_id) : undefined
  const winner = winnerSide(match)
  const isBye = match.away_team_id === null && !match.away_slot_id
  const status = matchStatusLabel(match, isBye)
  const statusTone =
    status === 'FT'
      ? 'bg-emerald-400 text-emerald-950'
      : status === 'Scheduled'
        ? 'bg-tm-orange text-white'
        : 'bg-white/15 text-white/70'

  const entrants: Entrant[] = [
    {
      team: homeTeam,
      label: homeTeam?.name ?? slotFallback(homeSlot),
      score: match.home_score,
      winner: winner === 'home' || isBye,
      isBye: false,
      isPlaceholder: !homeTeam,
    },
    {
      team: awayTeam,
      label: isBye ? 'Bye' : awayTeam?.name ?? slotFallback(awaySlot),
      score: isBye ? null : match.away_score,
      winner: winner === 'away',
      isBye,
      isPlaceholder: !awayTeam && !isBye,
    },
  ]

  const widthClass = fullWidth ? 'w-full' : featured ? 'w-[15rem]' : 'w-[12rem]'
  const toneClass = featured
    ? 'border-tm-orange/70 bg-tm-navy shadow-2xl shadow-tm-orange/20 ring-1 ring-tm-orange/50'
    : active
      ? 'border-tm-orange/70 bg-tm-navy/95 shadow-lg shadow-tm-orange/10 ring-1 ring-tm-orange/40'
      : 'border-white/10 bg-tm-navy/80 shadow-md shadow-black/20'

  return (
    <article
      className={`relative ${widthClass} overflow-hidden rounded-lg border ${toneClass}`}
    >
      <div className={featured ? 'bg-tm-orange px-3 py-2 text-white' : 'border-b border-white/10 bg-white/[0.08] px-3 py-1.5 text-white/80'}>
        <div className="flex items-center justify-between gap-2">
          <span className={featured ? 'text-xs font-black uppercase tracking-[0.22em]' : 'truncate text-[11px] font-black uppercase tracking-wider'}>
            {pool?.name ?? phase.name}
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${featured ? 'bg-white text-tm-orange' : statusTone}`}>
            {status}
          </span>
        </div>
      </div>

      {featured && (
        <div className="border-b border-white/10 bg-black/20 px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tm-orange">Road to the final</p>
          <p className="mt-0.5 text-xl font-black uppercase tracking-wide text-white">Final</p>
        </div>
      )}

      <div className="divide-y divide-white/10">
        {entrants.map((entrant, index) => (
          <BracketEntrantRow key={index} entrant={entrant} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/55">
        <span>{formatKickoffTime(match.kickoff_time)}</span>
        <span className="truncate">{match.court ?? 'Court TBC'}</span>
      </div>
    </article>
  )
}

function MobileRoundCarousel({
  rounds,
  defaultIndex,
  poolsById,
  teamsById,
  slotsById,
}: {
  rounds: RoundGroup[]
  defaultIndex: number
  poolsById: Map<string, Pool>
  teamsById: Map<string, Team>
  slotsById: Map<string, ElementSlot>
}) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    setActiveIndex(defaultIndex)
  }, [defaultIndex])

  const activeRound = rounds[activeIndex] ?? rounds[0]
  const canGoBack = activeIndex > 0
  const canGoForward = activeIndex < rounds.length - 1

  function goToRound(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), rounds.length - 1))
  }

  function handleSwipeEnd(clientX: number) {
    if (touchStartX === null) return
    const distance = touchStartX - clientX

    if (Math.abs(distance) > 45) {
      goToRound(activeIndex + (distance > 0 ? 1 : -1))
    }

    setTouchStartX(null)
  }

  return (
    <div className="space-y-3 lg:hidden">
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToRound(activeIndex - 1)}
              disabled={!canGoBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg font-black text-tm-navy disabled:opacity-30 dark:bg-zinc-900 dark:text-white"
              aria-label="Previous round"
            >
              {'<'}
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tm-orange">
                Round {activeIndex + 1} of {rounds.length}
              </p>
              <h3 className="truncate text-lg font-black text-tm-navy dark:text-white">
                {activeRound.phase.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => goToRound(activeIndex + 1)}
              disabled={!canGoForward}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg font-black text-tm-navy disabled:opacity-30 dark:bg-zinc-900 dark:text-white"
              aria-label="Next round"
            >
              {'>'}
            </button>
          </div>

          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            {rounds.map((round, index) => (
              <span
                key={round.phase.id}
                className={
                  index === activeIndex
                    ? 'h-1.5 w-6 rounded-full bg-tm-orange'
                    : round.matches.every(isMatchResolved)
                      ? 'h-1.5 w-3 rounded-full bg-emerald-400'
                      : 'h-1.5 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700'
                }
              />
            ))}
          </div>
        </div>

        <div
          className="overflow-hidden"
          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => handleSwipeEnd(event.changedTouches[0]?.clientX ?? touchStartX ?? 0)}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {rounds.map(({ phase, matches: phaseMatches }) => (
              <section key={phase.id} className="min-w-full space-y-3 p-3">
                {phaseMatches.map((match) => (
                  <BracketMatchNode
                    key={match.id}
                    match={match}
                    phase={phase}
                    pool={match.pool_id ? poolsById.get(match.pool_id) ?? null : null}
                    teamsById={teamsById}
                    slotsById={slotsById}
                    active
                    fullWidth
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BoardColumnView({
  column,
  currentPhaseId,
  poolsById,
  teamsById,
  slotsById,
}: {
  column: BoardColumn
  currentPhaseId: string | null
  poolsById: Map<string, Pool>
  teamsById: Map<string, Team>
  slotsById: Map<string, ElementSlot>
}) {
  const isActive = column.phase.id === currentPhaseId
  const isCenter = column.side === 'center'
  const totalRows = totalRowsForColumn(column)
  const boardHeightRem = boardHeightRemForColumn(column)

  return (
    <section
      className="relative flex flex-col items-stretch"
      style={{ width: `${columnWidthRem(column)}rem` }}
    >
      <h4
        className={
          isCenter
            ? 'mb-4 rounded-full bg-tm-orange px-4 py-1.5 text-center text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-tm-orange/20'
            : isActive
              ? 'mb-4 rounded-full bg-white px-3 py-1 text-center text-[11px] font-black uppercase tracking-wider text-tm-navy'
              : 'mb-4 text-center text-[11px] font-black uppercase tracking-wider text-white/45'
        }
      >
        {roundShortName(column.phase.name)}
      </h4>

      <div
        className={isCenter ? 'flex items-center justify-center' : 'grid'}
        style={{
          minHeight: `${boardHeightRem}rem`,
          gridTemplateRows: isCenter ? undefined : `repeat(${totalRows}, minmax(0, 1fr))`,
        }}
      >
        {column.matches.map((match, index) => {
          const gridStart = matchGridStart(column, index)

          return (
            <div
              key={match.id}
              className="relative flex items-center justify-center"
              style={isCenter ? undefined : { gridRow: `${gridStart} / span 2` }}
            >
            <BracketMatchNode
              match={match}
              phase={column.phase}
              pool={match.pool_id ? poolsById.get(match.pool_id) ?? null : null}
              teamsById={teamsById}
              slotsById={slotsById}
              active={isActive}
              featured={isCenter}
            />
          </div>
          )
        })}
      </div>
    </section>
  )
}

function DesktopConnectorOverlay({
  columns,
  layout,
}: {
  columns: BoardColumn[]
  layout: DesktopBracketLayout
}) {
  const columnStarts = columns.reduce<number[]>((starts, column, index) => {
    const previousStart = starts[index - 1] ?? 0
    const previousWidth = index === 0 ? 0 : columnWidthRem(columns[index - 1])
    starts.push(index === 0 ? 0 : previousStart + previousWidth + DESKTOP_COLUMN_GAP_REM)
    return starts
  }, [])
  const boardWidthRem =
    columns.reduce((total, column) => total + columnWidthRem(column), 0) +
    Math.max(0, columns.length - 1) * DESKTOP_COLUMN_GAP_REM
  const boardHeightRem =
    DESKTOP_HEADER_OFFSET_REM +
    Math.max(...columns.map(boardHeightRemForColumn), 34)
  const centerIndex = columns.findIndex((column) => column.side === 'center')

  function cardEdges(columnIndex: number) {
    const column = columns[columnIndex]
    const columnStart = columnStarts[columnIndex]
    const cardWidth = cardWidthRem(column)
    const cardLeft = columnStart + (columnWidthRem(column) - cardWidth) / 2
    return {
      left: cardLeft,
      right: cardLeft + cardWidth,
    }
  }

  function connectorPath(
    sourceIndex: number,
    sourceMatchIndex: number,
    targetIndex: number,
    targetMatchIndex: number,
    targetSlotOffset: number
  ) {
    const source = columns[sourceIndex]
    const target = columns[targetIndex]
    const sourceEdges = cardEdges(sourceIndex)
    const targetEdges = cardEdges(targetIndex)
    const sourceY = matchCenterYRem(source, sourceMatchIndex)
    const targetY =
      matchCenterYRem(target, targetMatchIndex) +
      (target.side === 'center' ? 0 : targetSlotOffset * 1.45)

    if (target.side === 'center' && targetSlotOffset === 0) {
      const leftToRight = sourceIndex < targetIndex
      const startX = leftToRight ? sourceEdges.right : sourceEdges.left
      const endX = leftToRight ? targetEdges.left : targetEdges.right
      return `M ${startX} ${sourceY} H ${endX}`
    }

    const leftToRight = sourceIndex < targetIndex
    const startX = leftToRight ? sourceEdges.right : sourceEdges.left
    const endX = leftToRight ? targetEdges.left : targetEdges.right
    const midX = leftToRight
      ? startX + (endX - startX) * 0.55
      : startX - (startX - endX) * 0.55

    return `M ${startX} ${sourceY} H ${midX} V ${targetY} H ${endX}`
  }

  const paths: string[] = []

  function targetOffset(offset: number, sourcePerTarget: number) {
    if (sourcePerTarget <= 1) return 0
    return (offset - (sourcePerTarget - 1) / 2) * 2
  }

  function connectAdjacent(sourceIndex: number, targetIndex: number, forceSingleSource = false) {
    const target = columns[targetIndex]
    const source = columns[sourceIndex]
    const sourcePerTarget = forceSingleSource
      ? 1
      : Math.max(1, Math.ceil(source.matches.length / Math.max(1, target.matches.length)))

    target.matches.forEach((_, targetMatchIndex) => {
      for (let offset = 0; offset < sourcePerTarget; offset += 1) {
        const sourceMatchIndex = targetMatchIndex * sourcePerTarget + offset
        if (source.matches[sourceMatchIndex]) {
          paths.push(
            connectorPath(
              sourceIndex,
              sourceMatchIndex,
              targetIndex,
              targetMatchIndex,
              targetOffset(offset, sourcePerTarget)
            )
          )
        }
      }
    })
  }

  if (layout === 'progression') {
    for (let targetIndex = 1; targetIndex < columns.length; targetIndex += 1) {
      connectAdjacent(targetIndex - 1, targetIndex)
    }
  } else {
    for (let targetIndex = 1; targetIndex <= centerIndex; targetIndex += 1) {
      connectAdjacent(targetIndex - 1, targetIndex, columns[targetIndex].side === 'center')
    }

    for (let targetIndex = columns.length - 2; targetIndex >= centerIndex; targetIndex -= 1) {
      connectAdjacent(targetIndex + 1, targetIndex, columns[targetIndex].side === 'center')
    }
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20"
      viewBox={`0 0 ${boardWidthRem} ${boardHeightRem}`}
      preserveAspectRatio="none"
      style={{ width: `${boardWidthRem}rem`, height: `${boardHeightRem}rem` }}
    >
      <defs>
        <marker
          id="bracket-arrow"
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="#f47c20" />
        </marker>
      </defs>
      {paths.map((path, index) => (
        <path
          key={`${path}-${index}`}
          d={path}
          fill="none"
          stroke="#f47c20"
          strokeWidth="0.12"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd="url(#bracket-arrow)"
        />
      ))}
    </svg>
  )
}

export default function PublicBracketView({
  phases,
  currentPhaseId,
  matches,
  teams,
  slots,
  desktopLayout = 'progression',
}: PublicBracketViewProps) {
  const bracketPhases = phases
    .filter((phase) => phase.phase_type === 'knockout')
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))

  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))
  const poolsById = new Map(
    bracketPhases.flatMap((phase) => (phase.pools ?? []).map((pool) => [pool.id, pool] as const))
  )

  const rounds: RoundGroup[] = bracketPhases.map((phase) => ({
    phase,
    matches: matches
      .filter((match) => match.phase_id === phase.id)
      .sort((a, b) => {
        const poolA = a.pool_id ? poolsById.get(a.pool_id) : null
        const poolB = b.pool_id ? poolsById.get(b.pool_id) : null
        return (
          (poolA?.display_order ?? 999) - (poolB?.display_order ?? 999) ||
          new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
        )
      }),
  })).filter(({ matches }) => matches.length > 0)

  if (rounds.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No bracket fixtures have been published yet.
      </p>
    )
  }

  const completed = rounds.reduce(
    (total, group) => total + group.matches.filter((match) => match.status === 'completed').length,
    0
  )
  const total = rounds.reduce((sum, group) => sum + group.matches.length, 0)
  const columns =
    desktopLayout === 'wall-chart'
      ? buildWallChartColumns(rounds)
      : buildProgressionColumns(rounds)
  const activeRound = rounds.find((round) => round.phase.id === currentPhaseId) ?? rounds[rounds.length - 1]
  const mobileDefaultIndex = defaultMobileRoundIndex(rounds)
  const desktopBoardWidthRem =
    columns.reduce((sum, column) => sum + columnWidthRem(column), 0) +
    Math.max(0, columns.length - 1) * DESKTOP_COLUMN_GAP_REM
  const desktopBoardHeightRem =
    DESKTOP_HEADER_OFFSET_REM +
    Math.max(...columns.map(boardHeightRemForColumn), 34)

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-tm-navy/15 bg-tm-navy text-white shadow-xl shadow-tm-navy/20">
        <div className="border-b border-white/10 bg-black/20 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-tm-orange">
                Bracket view
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Road to the Final
              </h3>
              <p className="mt-1 text-sm font-medium text-white/60">
                {completed}/{total} knockout fixture{total === 1 ? '' : 's'} complete. Current focus: {activeRound.phase.name}.
              </p>
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden lg:block">
          <div className="overflow-x-auto px-4 py-5 sm:px-5">
            <div
              className="relative min-w-max"
              style={{
                width: `${desktopBoardWidthRem}rem`,
                minHeight: `${desktopBoardHeightRem}rem`,
              }}
            >
              <DesktopConnectorOverlay columns={columns} layout={desktopLayout} />
              <div
                className="relative z-10 grid items-stretch"
                style={{
                  columnGap: `${DESKTOP_COLUMN_GAP_REM}rem`,
                  gridTemplateColumns: columns.map((column) => `${columnWidthRem(column)}rem`).join(' '),
                }}
              >
                {columns.map((column) => (
                  <BoardColumnView
                    key={column.key}
                    column={column}
                    currentPhaseId={currentPhaseId}
                    poolsById={poolsById}
                    teamsById={teamsById}
                    slotsById={slotsById}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MobileRoundCarousel
        rounds={rounds}
        defaultIndex={mobileDefaultIndex}
        poolsById={poolsById}
        teamsById={teamsById}
        slotsById={slotsById}
      />
    </div>
  )
}
