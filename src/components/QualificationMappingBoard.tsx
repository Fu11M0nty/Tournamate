'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import {
  buildQualificationMappings,
  saveQualificationMapping,
  type QualificationMapping,
} from '@/lib/qualificationMappings'
import { createClient } from '@/lib/supabase'
import type {
  ElementSlot,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
} from '@/lib/types'

type PoolWithTeams = Pool & {
  pool_teams?: PoolTeam[]
}

type PhaseElementWithSlots = PhaseElement & {
  slots?: ElementSlot[]
}

type PhaseWithStructure = Phase & {
  pools?: PoolWithTeams[]
  phase_elements?: PhaseElementWithSlots[]
}

interface SourceQualifier {
  id: string
  label: string
  detail: string
  sourcePhaseId: string
  sourceElementId: string | null
  sourcePoolId: string
  sourceRank: number
}

interface QualificationMappingBoardProps {
  targetPhase: PhaseWithStructure
  sourcePhases: PhaseWithStructure[]
  progressionRules: ProgressionRule[]
  onSaved: () => void
  onEditMapping: (mapping: QualificationMapping) => void
}

function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th'

  return `${value}${suffix}`
}

function sourceLabel(rank: number) {
  if (rank === 1) return 'Winner'
  if (rank === 2) return 'Runner-up'
  return `${ordinal(rank)} place`
}

function DraggableQualifier({ qualifier }: { qualifier: SourceQualifier }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: qualifier.id,
      data: qualifier,
    })

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            }
          : undefined
      }
      className={`w-full rounded-md border px-3 py-2 text-left text-xs shadow-sm transition-colors ${
        isDragging
          ? 'z-10 border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100'
          : 'border-zinc-300 bg-white text-zinc-800 hover:border-sky-300 hover:bg-sky-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-sky-800 dark:hover:bg-sky-950'
      }`}
      {...listeners}
      {...attributes}
    >
      <span className="block font-semibold">{qualifier.label}</span>
      <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
        {qualifier.detail}
      </span>
    </button>
  )
}

function DroppableSlot({
  mapping,
  sourceText,
  saving,
  onEdit,
}: {
  mapping: QualificationMapping
  sourceText: string
  saving: boolean
  onEdit: (mapping: QualificationMapping) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: mapping.id,
    data: { mapping },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border p-3 transition-colors ${
        isOver
          ? 'border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/60'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Slot {mapping.targetSlotOrder}: {mapping.label || mapping.targetSlot.label || 'Unlabelled slot'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {sourceText}
          </p>
          {mapping.mismatchReasons.length > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
              {mapping.mismatchReasons.join(' ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEdit(mapping)}
          disabled={saving}
          className="shrink-0 rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-900 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950"
        >
          Select
        </button>
      </div>
    </div>
  )
}

export default function QualificationMappingBoard({
  targetPhase,
  sourcePhases,
  progressionRules,
  onSaved,
  onEditMapping,
}: QualificationMappingBoardProps) {
  const supabase = useMemo(() => createClient(), [])
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null)

  const sourceQualifiers = useMemo(() => {
    return sourcePhases
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .flatMap((phase) => {
        const elements = phase.phase_elements ?? []

        return (phase.pools ?? [])
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .flatMap((pool) => {
            const sourceElement =
              elements.find((element) => element.pool_id === pool.id) ?? null
            const teamCount = Math.max(pool.pool_teams?.length ?? 0, 2)

            return Array.from({ length: teamCount }, (_, index) => {
              const rank = index + 1
              return {
                id: `source:${phase.id}:${pool.id}:${rank}`,
                label: `${pool.name} ${sourceLabel(rank)}`,
                detail: `${phase.name} - ${ordinal(rank)} in ${pool.name}`,
                sourcePhaseId: phase.id,
                sourceElementId: sourceElement?.id ?? null,
                sourcePoolId: pool.id,
                sourceRank: rank,
              }
            })
          })
      })
  }, [sourcePhases])

  const mappingsByElement = useMemo(() => {
    const map = new Map<string, QualificationMapping[]>()

    for (const element of targetPhase.phase_elements ?? []) {
      const mappings = buildQualificationMappings({
        targetElements: [element],
        slots: element.slots ?? [],
        rules: progressionRules,
      })
      map.set(element.id, mappings)
    }

    return map
  }, [progressionRules, targetPhase.phase_elements])

  const sourceTextByMapping = useMemo(() => {
    const sourceByPoolId = new Map(
      sourceQualifiers.map((source) => [
        `${source.sourcePoolId}:${source.sourceRank}`,
        source,
      ])
    )

    const map = new Map<string, string>()
    for (const mappings of mappingsByElement.values()) {
      for (const mapping of mappings) {
        if (mapping.slotType === 'team') {
          map.set(mapping.id, 'Fixed team')
          continue
        }
        if (mapping.slotType === 'bye') {
          map.set(mapping.id, 'Bye')
          continue
        }
        if (mapping.slotType === 'manual') {
          map.set(mapping.id, 'Manual entry')
          continue
        }
        if (mapping.slotType === 'placeholder') {
          map.set(mapping.id, 'Placeholder')
          continue
        }

        const source =
          mapping.sourcePoolId && mapping.sourceRank
            ? sourceByPoolId.get(`${mapping.sourcePoolId}:${mapping.sourceRank}`)
            : null
        map.set(
          mapping.id,
          source
            ? source.detail
            : mapping.sourceRank
              ? `${ordinal(mapping.sourceRank)} ranked source`
              : 'Drop a source here or use Select'
        )
      }
    }

    return map
  }, [mappingsByElement, sourceQualifiers])

  const totalMappings = Array.from(mappingsByElement.values()).reduce(
    (count, mappings) => count + mappings.length,
    0
  )

  async function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current as SourceQualifier | undefined
    const mapping = event.over?.data.current?.mapping as QualificationMapping | undefined

    if (!source || !mapping) return

    setSavingSlotId(mapping.id)
    const result = await saveQualificationMapping(supabase, {
      targetElement: mapping.targetElement,
      targetSlotId: mapping.targetSlot.id,
      targetSlotOrder: mapping.targetSlotOrder,
      label: source.label,
      slotType: 'source',
      sourceType: 'standings_rank',
      sourcePhaseId: source.sourcePhaseId,
      sourceElementId: source.sourceElementId,
      sourcePoolId: source.sourcePoolId,
      sourceRank: source.sourceRank,
      sourceOutcome: 'rank',
      ruleId: mapping.progressionRule?.id ?? null,
      ruleDisplayOrder:
        mapping.progressionRule?.display_order ?? mapping.targetSlotOrder,
    })
    setSavingSlotId(null)

    if (result.error) {
      toast.error(`Could not save qualification mapping: ${result.error}`)
      return
    }

    toast.success('Qualification mapping saved')
    onSaved()
  }

  if (totalMappings === 0) return null

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-1">
        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Qualification board
        </h5>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Drag a rank from a previous pool onto the slot it should populate. Use Select for byes, fixed teams, match winners or more advanced rules.
        </p>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(220px,280px)_1fr]">
          <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <h6 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Previous pool ranks
              </h6>
            </div>
            {sourceQualifiers.length === 0 ? (
              <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                No previous pools are available for drag/drop. Use Select for manual or fixed slots.
              </p>
            ) : (
              <div className="max-h-[460px] space-y-2 overflow-y-auto p-3">
                {sourceQualifiers.map((qualifier) => (
                  <DraggableQualifier key={qualifier.id} qualifier={qualifier} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {(targetPhase.phase_elements ?? [])
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((element) => {
                const mappings = mappingsByElement.get(element.id) ?? []
                if (mappings.length === 0) return null

                return (
                  <div
                    key={element.id}
                    className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <h6 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {element.name}
                      </h6>
                    </div>
                    <div className="grid gap-2 p-3 lg:grid-cols-2">
                      {mappings.map((mapping) => (
                        <DroppableSlot
                          key={mapping.id}
                          mapping={mapping}
                          sourceText={
                            sourceTextByMapping.get(mapping.id) ??
                            'Drop a source here or use Select'
                          }
                          saving={savingSlotId === mapping.id}
                          onEdit={onEditMapping}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </DndContext>
    </section>
  )
}
