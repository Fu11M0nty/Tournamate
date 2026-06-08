'use client'

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import ConfirmDialog from './ConfirmDialog'
import ElementSlotEditForm from './ElementSlotEditForm'
import PhaseEditForm from './PhaseEditForm'
import PhaseElementEditForm from './PhaseElementEditForm'
import PoolEditForm from './PoolEditForm'
import PoolTeamAssignmentDialog from './PoolTeamAssignmentDialog'
import ProgressionRuleEditForm from './ProgressionRuleEditForm'
import QualificationMappingBoard from './QualificationMappingBoard'
import QualificationMappingEditForm from './QualificationMappingEditForm'
import StartNextPhaseDialog from './StartNextPhaseDialog'
import StructurePreview from './StructurePreview'
import { formatPhaseType } from './FormatOverview'
import { ordinal } from '@/lib/structureValidation'
import {
  generateStructureFixtures,
  regenerateUnplannedStructureFixtures,
} from '@/lib/matches'
import {
  buildQualificationMappings,
  type QualificationMapping,
} from '@/lib/qualificationMappings'
import type {
  Division,
  ElementSlot,
  Match,
  Phase,
  PhaseElement,
  Pool,
  PoolTeam,
  ProgressionRule,
  ScoringSystem,
  Team,
} from '@/lib/types'

type PhaseWithPools = Phase & {
  scoring_system?: ScoringSystem | null
  pools?: PoolWithTeams[]
  phase_elements?: PhaseElementWithSlots[]
}

type PoolWithTeams = Pool & {
  pool_teams?: PoolTeam[]
}

type PhaseElementWithSlots = PhaseElement & {
  slots?: ElementSlot[]
}

function formatMatchFormat(format: Phase['match_format']) {
  if (format === 'halves') return '2 halves'
  if (format === 'quarters') return '4 quarters'
  return 'Continuous'
}

function formatElementType(type: PhaseElement['element_type']) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSourceType(type: ProgressionRule['source_type']) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export interface AdvancedStructureEditorHandle {
  editPhase: (phase: PhaseWithPools) => void
}

interface AdvancedStructureEditorProps {
  division: Division
  phases: PhaseWithPools[]
  matches: Match[]
  teams: Team[]
  progressionRules: ProgressionRule[]
  allPhases: PhaseWithPools[]
  allTeams: Team[]
  onChanged: () => void
}

const AdvancedStructureEditor = forwardRef<AdvancedStructureEditorHandle, AdvancedStructureEditorProps>(
  function AdvancedStructureEditor(
    { division, phases, matches, teams, progressionRules, allPhases, allTeams, onChanged },
    ref
  ) {
    const supabase = useMemo(() => createClient(), [])

    const [editingPhase, setEditingPhase] = useState<PhaseWithPools | null>(null)
    const [deletingPhase, setDeletingPhase] = useState<PhaseWithPools | null>(null)
    const [creatingPoolForPhase, setCreatingPoolForPhase] = useState<PhaseWithPools | null>(null)
    const [editingPool, setEditingPool] = useState<{ phase: PhaseWithPools; pool: PoolWithTeams } | null>(null)
    const [assigningPool, setAssigningPool] = useState<{ phase: PhaseWithPools; pool: PoolWithTeams } | null>(null)
    const [deletingPool, setDeletingPool] = useState<{ phase: PhaseWithPools; pool: PoolWithTeams } | null>(null)
    const [creatingElementForPhase, setCreatingElementForPhase] = useState<PhaseWithPools | null>(null)
    const [editingElement, setEditingElement] = useState<{ phase: PhaseWithPools; element: PhaseElementWithSlots } | null>(null)
    const [deletingElement, setDeletingElement] = useState<PhaseElementWithSlots | null>(null)
    const [creatingSlotForElement, setCreatingSlotForElement] = useState<PhaseElementWithSlots | null>(null)
    const [editingSlot, setEditingSlot] = useState<{ element: PhaseElementWithSlots; slot: ElementSlot } | null>(null)
    const [deletingSlot, setDeletingSlot] = useState<ElementSlot | null>(null)
    const [creatingRuleForElement, setCreatingRuleForElement] = useState<PhaseElementWithSlots | null>(null)
    const [editingRule, setEditingRule] = useState<{ element: PhaseElementWithSlots; rule: ProgressionRule } | null>(null)
    const [deletingRule, setDeletingRule] = useState<ProgressionRule | null>(null)
    const [editingMapping, setEditingMapping] = useState<QualificationMapping | null>(null)
    const [startingPhase, setStartingPhase] = useState<PhaseWithPools | null>(null)
    const [generatingPhaseId, setGeneratingPhaseId] = useState<string | null>(null)
    const [regeneratingPhaseId, setRegeneratingPhaseId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    useImperativeHandle(ref, () => ({
      editPhase: (phase) => setEditingPhase(phase),
    }))

    const matchCountByPhase = useMemo(() => {
      const counts = new Map<string, number>()
      for (const match of matches) {
        if (!match.phase_id) continue
        counts.set(match.phase_id, (counts.get(match.phase_id) ?? 0) + 1)
      }
      return counts
    }, [matches])

    const protectedMatchCountByPhase = useMemo(() => {
      const counts = new Map<string, number>()
      for (const match of matches) {
        if (!match.phase_id) continue
        if (match.is_planned || match.status === 'completed') {
          counts.set(match.phase_id, (counts.get(match.phase_id) ?? 0) + 1)
        }
      }
      return counts
    }, [matches])

    const matchCountByPool = useMemo(() => {
      const counts = new Map<string, number>()
      for (const match of matches) {
        if (!match.pool_id) continue
        counts.set(match.pool_id, (counts.get(match.pool_id) ?? 0) + 1)
      }
      return counts
    }, [matches])

    const matchCountByElement = useMemo(() => {
      const counts = new Map<string, number>()
      for (const match of matches) {
        if (!match.phase_element_id) continue
        counts.set(match.phase_element_id, (counts.get(match.phase_element_id) ?? 0) + 1)
      }
      return counts
    }, [matches])

    const allPhaseElements = useMemo(
      () => phases.flatMap((phase) => phase.phase_elements ?? []),
      [phases]
    )

    const allPools = useMemo(
      () => phases.flatMap((phase) => phase.pools ?? []),
      [phases]
    )

    const allSlots = useMemo(
      () => allPhaseElements.flatMap((element) => element.slots ?? []),
      [allPhaseElements]
    )

    const teamById = useMemo(() => {
      const map = new Map<string, Team>()
      for (const team of teams) map.set(team.id, team)
      return map
    }, [teams])

    const phaseById = useMemo(() => {
      const map = new Map<string, PhaseWithPools>()
      for (const phase of phases) map.set(phase.id, phase)
      return map
    }, [phases])

    const poolById = useMemo(() => {
      const map = new Map<string, PoolWithTeams>()
      for (const pool of allPools) map.set(pool.id, pool)
      return map
    }, [allPools])

    const elementById = useMemo(() => {
      const map = new Map<string, PhaseElementWithSlots>()
      for (const element of allPhaseElements) map.set(element.id, element)
      return map
    }, [allPhaseElements])

    const slotById = useMemo(() => {
      const map = new Map<string, ElementSlot>()
      for (const slot of allSlots) map.set(slot.id, slot)
      return map
    }, [allSlots])

    const rulesByElement = useMemo(() => {
      const map = new Map<string, ProgressionRule[]>()
      for (const rule of progressionRules) {
        const list = map.get(rule.to_element_id) ?? []
        list.push(rule)
        map.set(rule.to_element_id, list)
      }
      for (const list of map.values()) {
        list.sort((a, b) => a.display_order - b.display_order)
      }
      return map
    }, [progressionRules])

    const ruleCountByTargetPhase = useMemo(() => {
      const map = new Map<string, number>()
      for (const rule of progressionRules) {
        const targetElement = elementById.get(rule.to_element_id)
        if (!targetElement) continue
        map.set(targetElement.phase_id, (map.get(targetElement.phase_id) ?? 0) + 1)
      }
      return map
    }, [elementById, progressionRules])

    const allFormsPhaseElements = useMemo(
      () => allPhases.flatMap((phase) => phase.phase_elements ?? []),
      [allPhases]
    )

    const allFormsPools = useMemo(
      () => allPhases.flatMap((phase) => phase.pools ?? []),
      [allPhases]
    )

    const allFormsSlots = useMemo(
      () => allFormsPhaseElements.flatMap((element) => element.slots ?? []),
      [allFormsPhaseElements]
    )

    function handleSaved() {
      setEditingPhase(null)
      setDeletingPhase(null)
      setCreatingPoolForPhase(null)
      setEditingPool(null)
      setAssigningPool(null)
      setDeletingPool(null)
      setCreatingElementForPhase(null)
      setEditingElement(null)
      setDeletingElement(null)
      setCreatingSlotForElement(null)
      setEditingSlot(null)
      setDeletingSlot(null)
      setCreatingRuleForElement(null)
      setEditingRule(null)
      setDeletingRule(null)
      setEditingMapping(null)
      setStartingPhase(null)
      onChanged()
    }

    function formatSlotPreview(slot: ElementSlot) {
      if (slot.slot_type === 'team') {
        return teamById.get(slot.team_id ?? '')?.name ?? 'Fixed team'
      }
      if (slot.slot_type === 'bye') return 'Bye'
      if (slot.slot_type === 'manual') return 'Manual entrant'
      if (slot.slot_type === 'placeholder') return slot.label || 'Placeholder'

      const sourceParts: string[] = []
      if (slot.source_outcome === 'winner') sourceParts.push('Winner')
      else if (slot.source_outcome === 'loser') sourceParts.push('Loser')
      else if (slot.source_outcome === 'best_rank') sourceParts.push(`Best ${ordinal(slot.source_rank)}`)
      else if (slot.source_outcome === 'rank') sourceParts.push(ordinal(slot.source_rank))
      else sourceParts.push('Manual source')

      const source =
        poolById.get(slot.source_pool_id ?? '')?.name ??
        elementById.get(slot.source_element_id ?? '')?.name ??
        phaseById.get(slot.source_phase_id ?? '')?.name

      return source ? `${sourceParts.join(' ')} from ${source}` : sourceParts.join(' ')
    }

    function formatRulePreview(rule: ProgressionRule) {
      const source =
        poolById.get(rule.from_pool_id ?? '')?.name ??
        elementById.get(rule.from_element_id ?? '')?.name ??
        phaseById.get(rule.from_phase_id ?? '')?.name ??
        'manual source'
      const targetSlot = rule.to_slot_id ? slotById.get(rule.to_slot_id) : null
      const target = targetSlot
        ? targetSlot.label || `slot ${targetSlot.display_order}`
        : `slot ${rule.to_slot_order ?? '?'}`
      return `${formatSourceType(rule.source_type)} ${ordinal(rule.source_rank)} from ${source} -> ${target}`
    }

    function formatMappingSource(mapping: QualificationMapping) {
      if (mapping.slotType === 'team') {
        return teamById.get(mapping.teamId ?? '')?.name ?? 'Fixed team'
      }
      if (mapping.slotType === 'bye') return 'Bye'
      if (mapping.slotType === 'manual') return 'Manual entry'
      if (mapping.slotType === 'placeholder') return 'Placeholder'

      const source =
        poolById.get(mapping.sourcePoolId ?? '')?.name ??
        elementById.get(mapping.sourceElementId ?? '')?.name ??
        phaseById.get(mapping.sourcePhaseId ?? '')?.name ??
        'Source'
      const sourceType = mapping.sourceType ? formatSourceType(mapping.sourceType) : 'Source'
      return `${sourceType} ${ordinal(mapping.sourceRank)} from ${source}`
    }

    function phaseUsesPlaceholderSlots(phase: PhaseWithPools) {
      return (phase.phase_elements ?? []).some((element) =>
        (element.slots ?? []).some(
          (slot) =>
            !slot.team_id &&
            (slot.slot_type === 'source' ||
              slot.slot_type === 'placeholder' ||
              slot.slot_type === 'manual')
        )
      )
    }

    async function handleGeneratePhaseFixtures(phase: PhaseWithPools) {
      setGeneratingPhaseId(phase.id)
      const result = await generateStructureFixtures(supabase, phase.age_group_id, phase.id)
      setGeneratingPhaseId(null)
      if (result.error) {
        toast.error(`Could not generate fixtures: ${result.error}`)
        return
      }
      toast.success(
        result.created === 0
          ? `No new fixtures needed for ${phase.name}`
          : `Generated ${result.created} fixture${result.created === 1 ? '' : 's'} for ${phase.name}`
      )
      handleSaved()
    }

    async function handleRegenerateUnplannedPhaseFixtures(phase: PhaseWithPools) {
      setRegeneratingPhaseId(phase.id)
      const result = await regenerateUnplannedStructureFixtures(
        supabase,
        phase.age_group_id,
        phase.id
      )
      setRegeneratingPhaseId(null)
      if (result.error) {
        toast.error(`Could not regenerate fixtures: ${result.error}`)
        return
      }
      toast.success(
        `Regenerated ${result.created} fixture${result.created === 1 ? '' : 's'} for ${phase.name}; ${result.deleted} unscheduled fixture${result.deleted === 1 ? '' : 's'} replaced`
      )
      handleSaved()
    }

    async function deleteUnplannedGeneratedMatchesForPhase(phase: PhaseWithPools) {
      const slotIds = (phase.phase_elements ?? [])
        .flatMap((element) => element.slots ?? [])
        .map((slot) => slot.id)
      const matchIds = new Set<string>()

      const { data: phaseRows, error: phaseRowsError } = await supabase
        .from('matches')
        .select('id')
        .eq('phase_id', phase.id)
        .eq('is_planned', false)
        .eq('status', 'scheduled')

      if (phaseRowsError) return { deleted: 0, error: phaseRowsError.message }
      for (const row of (phaseRows ?? []) as { id: string }[]) matchIds.add(row.id)

      if (slotIds.length > 0) {
        const [homeSlotRows, awaySlotRows] = await Promise.all([
          supabase
            .from('matches')
            .select('id')
            .in('home_slot_id', slotIds)
            .eq('is_planned', false)
            .eq('status', 'scheduled'),
          supabase
            .from('matches')
            .select('id')
            .in('away_slot_id', slotIds)
            .eq('is_planned', false)
            .eq('status', 'scheduled'),
        ])

        if (homeSlotRows.error) return { deleted: 0, error: homeSlotRows.error.message }
        if (awaySlotRows.error) return { deleted: 0, error: awaySlotRows.error.message }
        for (const row of (homeSlotRows.data ?? []) as { id: string }[]) matchIds.add(row.id)
        for (const row of (awaySlotRows.data ?? []) as { id: string }[]) matchIds.add(row.id)
      }

      const ids = Array.from(matchIds)
      if (ids.length === 0) return { deleted: 0 }

      const { data, error } = await supabase
        .from('matches')
        .delete()
        .in('id', ids)
        .select('id')

      if (error) return { deleted: 0, error: error.message }
      return { deleted: data?.length ?? 0 }
    }

    async function deleteUnplannedGeneratedMatchesForSlot(slot: ElementSlot) {
      const { data: rows, error: rowsError } = await supabase
        .from('matches')
        .select('id')
        .or(`home_slot_id.eq.${slot.id},away_slot_id.eq.${slot.id}`)
        .eq('is_planned', false)
        .eq('status', 'scheduled')

      if (rowsError) return { deleted: 0, error: rowsError.message }
      const ids = ((rows ?? []) as { id: string }[]).map((row) => row.id)
      if (ids.length === 0) return { deleted: 0 }

      const { data, error } = await supabase
        .from('matches')
        .delete()
        .in('id', ids)
        .select('id')

      if (error) return { deleted: 0, error: error.message }
      return { deleted: data?.length ?? 0 }
    }

    async function handleDeletePhase() {
      if (!deletingPhase) return

      const protectedMatchCount = protectedMatchCountByPhase.get(deletingPhase.id) ?? 0
      if (protectedMatchCount > 0) {
        toast.error(
          'This stage has scheduled or completed fixtures. Unplan scheduled fixtures first; completed fixtures must be handled manually before deleting the stage.'
        )
        setDeletingPhase(null)
        return
      }

      setDeleting(true)
      const matchDeleteResult = await deleteUnplannedGeneratedMatchesForPhase(deletingPhase)

      if (matchDeleteResult.error) {
        setDeleting(false)
        toast.error(`Could not delete stage fixtures: ${matchDeleteResult.error}`)
        return
      }

      const { data, error: deleteError } = await supabase
        .from('phases')
        .delete()
        .eq('id', deletingPhase.id)
        .select('id')
      setDeleting(false)

      if (deleteError) {
        toast.error(`Could not delete stage: ${deleteError.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Delete blocked by Supabase row-level security. Check the phases_auth_delete policy.')
        return
      }

      toast.success(
        matchDeleteResult.deleted > 0
          ? `Phase deleted and ${matchDeleteResult.deleted} unscheduled fixture${matchDeleteResult.deleted === 1 ? '' : 's'} removed`
          : 'Phase deleted'
      )
      handleSaved()
    }

    async function handleDeletePool() {
      if (!deletingPool) return

      const matchCount = matchCountByPool.get(deletingPool.pool.id) ?? 0
      if (matchCount > 0) {
        toast.error('Pools with matches cannot be deleted yet. Move or delete the matches first.')
        setDeletingPool(null)
        return
      }

      setDeleting(true)
      const { data, error: deleteError } = await supabase
        .from('pools')
        .delete()
        .eq('id', deletingPool.pool.id)
        .select('id')
      setDeleting(false)

      if (deleteError) {
        toast.error(`Could not delete pool: ${deleteError.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Delete blocked by Supabase row-level security. Check the pools_auth_delete policy.')
        return
      }

      toast.success('Pool deleted')
      handleSaved()
    }

    async function handleDeleteElement() {
      if (!deletingElement) return

      const matchCount = matchCountByElement.get(deletingElement.id) ?? 0
      if (deletingElement.pool_id || matchCount > 0) {
        toast.error(
          deletingElement.pool_id
            ? 'Pool-backed elements are deleted by deleting the pool.'
            : 'Elements with matches cannot be deleted yet. Move or delete the matches first.'
        )
        setDeletingElement(null)
        return
      }

      setDeleting(true)
      const { data, error: deleteError } = await supabase
        .from('phase_elements')
        .delete()
        .eq('id', deletingElement.id)
        .select('id')
      setDeleting(false)

      if (deleteError) {
        toast.error(`Could not delete element: ${deleteError.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Delete blocked by Supabase row-level security. Check the phase_elements_auth_delete policy.')
        return
      }

      toast.success('Element deleted')
      handleSaved()
    }

    async function handleDeleteSlot() {
      if (!deletingSlot) return

      setDeleting(true)
      const protectedSlotMatches = matches.filter(
        (match) =>
          (match.home_slot_id === deletingSlot.id || match.away_slot_id === deletingSlot.id) &&
          (match.is_planned || match.status === 'completed')
      )
      if (protectedSlotMatches.length > 0) {
        setDeleting(false)
        toast.error(
          'This slot is used by scheduled or completed fixtures. Unplan those fixtures before deleting the slot.'
        )
        setDeletingSlot(null)
        return
      }

      const matchDeleteResult = await deleteUnplannedGeneratedMatchesForSlot(deletingSlot)
      if (matchDeleteResult.error) {
        setDeleting(false)
        toast.error(`Could not delete slot fixtures: ${matchDeleteResult.error}`)
        return
      }

      const { data, error: deleteError } = await supabase
        .from('element_slots')
        .delete()
        .eq('id', deletingSlot.id)
        .select('id')
      setDeleting(false)

      if (deleteError) {
        toast.error(`Could not delete slot: ${deleteError.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Delete blocked by Supabase row-level security. Check the element_slots_auth_delete policy.')
        return
      }

      toast.success('Slot deleted')
      handleSaved()
    }

    async function handleDeleteRule() {
      if (!deletingRule) return

      setDeleting(true)
      const { data, error: deleteError } = await supabase
        .from('progression_rules')
        .delete()
        .eq('id', deletingRule.id)
        .select('id')
      setDeleting(false)

      if (deleteError) {
        toast.error(`Could not delete progression rule: ${deleteError.message}`)
        return
      }
      if (!data || data.length === 0) {
        toast.error('Delete blocked by Supabase row-level security. Check the progression_rules_auth_delete policy.')
        return
      }

      toast.success('Progression rule deleted')
      handleSaved()
    }

    return (
      <>
        <details id={`advanced-setup-${division.id}`} className="group border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-900">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                Advanced setup
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Detailed controls for stages, pools, fixture generation, mappings, slots, and progression rules.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {phases.length} stage{phases.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm group-open:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Show advanced
              </span>
              <span className="hidden rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm group-open:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Hide advanced
              </span>
            </div>
          </summary>

          <div className="divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            <StructurePreview
              division={division}
              phases={phases}
              matches={matches}
              teams={teams}
              progressionRules={progressionRules}
            />
            {phases.map((phase) => {
              const pools = phase.pools ?? []
              const phaseMatchCount = matchCountByPhase.get(phase.id) ?? 0
              const protectedPhaseMatchCount = protectedMatchCountByPhase.get(phase.id) ?? 0
              const incomingRuleCount = ruleCountByTargetPhase.get(phase.id) ?? 0
              const generateLabel = phaseUsesPlaceholderSlots(phase)
                ? `Generate placeholder fixtures for ${phase.name}`
                : `Generate fixtures for ${phase.name}`
              const sourcePhases = phases.filter(
                (sourcePhase) => sourcePhase.display_order < phase.display_order
              )

              return (
                <div key={phase.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {phase.name}
                        </h4>
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {formatPhaseType(phase.phase_type)}
                        </span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                          {phase.standings_mode} standings
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        /{phase.slug} - order {phase.display_order} - {formatMatchFormat(phase.match_format)} - {phase.period_minutes} min periods
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Scoring: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{phase.scoring_system?.name ?? 'Not assigned'}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center sm:flex sm:shrink-0">
                      <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{phaseMatchCount}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Matches</p>
                      </div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{pools.length}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pools</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStartingPhase(phase)}
                        disabled={incomingRuleCount === 0}
                        title={
                          incomingRuleCount === 0
                            ? 'This stage has direct team assignments, so there are no qualifiers to resolve.'
                            : undefined
                        }
                        className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:opacity-70 dark:border-emerald-900 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
                      >
                        {incomingRuleCount === 0 ? 'Ready' : 'Resolve qualifiers'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatingPoolForPhase(phase)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Add pool
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPhase(phase)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (protectedPhaseMatchCount > 0) {
                            toast.error(
                              'This stage has scheduled or completed fixtures. Unplan scheduled fixtures first; completed fixtures must be handled manually before deleting the stage.'
                            )
                            return
                          }
                          setDeletingPhase(phase)
                        }}
                        disabled={protectedPhaseMatchCount > 0}
                        title={
                          protectedPhaseMatchCount > 0
                            ? 'Unplan scheduled fixtures and handle completed fixtures before deleting this stage'
                            : phaseMatchCount > 0
                              ? 'Deletes this stage and removes its unscheduled fixtures'
                              : undefined
                        }
                        className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          Fixture generation
                        </h5>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Create fixtures from this stage&apos;s groups and qualifiers. Scheduled fixtures are preserved.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleGeneratePhaseFixtures(phase)}
                          disabled={generatingPhaseId === phase.id || regeneratingPhaseId === phase.id}
                          className="rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-900 dark:bg-zinc-950 dark:text-sky-300 dark:hover:bg-sky-950"
                        >
                          {generatingPhaseId === phase.id ? 'Generating...' : generateLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateUnplannedPhaseFixtures(phase)}
                          disabled={generatingPhaseId === phase.id || regeneratingPhaseId === phase.id}
                          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900 dark:bg-zinc-950 dark:text-amber-300 dark:hover:bg-amber-950"
                        >
                          {regeneratingPhaseId === phase.id
                            ? 'Regenerating...'
                            : 'Regenerate only unscheduled fixtures'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <QualificationMappingBoard
                    targetPhase={phase}
                    sourcePhases={sourcePhases}
                    progressionRules={progressionRules}
                    onSaved={handleSaved}
                    onEditMapping={setEditingMapping}
                  />

                  {pools.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                            <th className="pb-2 pr-3">Pool</th>
                            <th className="pb-2 pr-3">Slug</th>
                            <th className="pb-2 pr-3">Order</th>
                            <th className="pb-2 pr-3">Teams</th>
                            <th className="pb-2 pr-3">Matches</th>
                            <th className="pb-2 pr-3">Default</th>
                            <th className="pb-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {pools.map((pool) => {
                            const poolMatchCount = matchCountByPool.get(pool.id) ?? 0
                            return (
                              <tr key={pool.id}>
                                <td className="py-2 pr-3 font-semibold text-zinc-900 dark:text-zinc-50">
                                  {pool.name}
                                </td>
                                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                                  /{pool.slug}
                                </td>
                                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                                  {pool.display_order}
                                </td>
                                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                                  {pool.pool_teams?.length ?? 0}
                                </td>
                                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                                  {poolMatchCount}
                                </td>
                                <td className="py-2 pr-3">
                                  {pool.is_default ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400">No</span>
                                  )}
                                </td>
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setAssigningPool({ phase, pool })}
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Teams
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPool({ phase, pool })}
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (poolMatchCount > 0) {
                                          toast.error('Pools with matches cannot be deleted yet. Move or delete the matches first.')
                                          return
                                        }
                                        setDeletingPool({ phase, pool })
                                      }}
                                      disabled={poolMatchCount > 0}
                                      title={poolMatchCount > 0 ? 'Move or delete matches before deleting this pool' : undefined}
                                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <details className="group mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900">
                      <div>
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          Advanced
                        </h5>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Advanced setup for this stage.
                        </p>
                      </div>
                      <span className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm group-open:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        Show advanced
                      </span>
                      <span className="hidden rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm group-open:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        Hide advanced
                      </span>
                    </summary>

                    <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            Elements, slots and progression
                          </h5>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            Configure the internal blocks that make up this stage.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreatingElementForPhase(phase)}
                          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Add element
                        </button>
                      </div>

                      {(phase.phase_elements ?? []).length === 0 ? (
                        <p className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                          No advanced blocks have been configured for this stage yet.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {(phase.phase_elements ?? []).map((element) => {
                            const slots = element.slots ?? []
                            const rules = rulesByElement.get(element.id) ?? []
                            const mappings = buildQualificationMappings({
                              targetElements: [element],
                              slots,
                              rules,
                            })
                            const elementMatchCount = matchCountByElement.get(element.id) ?? 0
                            const isPoolBacked = Boolean(element.pool_id)
                            const canDeleteElement = !isPoolBacked && elementMatchCount === 0

                            return (
                              <article
                                key={element.id}
                                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h6 className="font-semibold text-zinc-900 dark:text-zinc-50">
                                        {element.name}
                                      </h6>
                                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                                        {formatElementType(element.element_type)}
                                      </span>
                                      {isPoolBacked && (
                                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                          Pool linked
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                      /{element.slug} - order {element.display_order} - {slots.length} slot{slots.length === 1 ? '' : 's'} - {rules.length} rule{rules.length === 1 ? '' : 's'} - {elementMatchCount} match{elementMatchCount === 1 ? '' : 'es'}
                                    </p>
                                    {element.element_type === 'bracket' && slots.length < 2 && (
                                      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                        Bracket elements normally need at least two slots.
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setCreatingSlotForElement(element)}
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Add slot
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCreatingRuleForElement(element)}
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Add rule
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingElement({ phase, element })}
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!canDeleteElement) {
                                          toast.error(
                                            isPoolBacked
                                              ? 'Pool-backed elements are deleted by deleting the pool.'
                                              : 'Elements with matches cannot be deleted yet. Move or delete the matches first.'
                                          )
                                          return
                                        }
                                        setDeletingElement(element)
                                      }}
                                      disabled={!canDeleteElement}
                                      className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                                  <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                                    <h6 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                      Qualification mappings
                                    </h6>
                                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                      Set where each slot should be populated from. This keeps the slot and progression rule aligned.
                                    </p>
                                  </div>
                                  {mappings.length === 0 ? (
                                    <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                                      No slots exist yet. Add slots before setting qualification sources.
                                    </p>
                                  ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                      {mappings.map((mapping) => (
                                        <div
                                          key={mapping.id}
                                          className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                                Slot {mapping.targetSlotOrder}: {mapping.label || mapping.targetSlot.label || 'Unlabelled slot'}
                                              </p>
                                              {mapping.mismatchReasons.length > 0 && (
                                                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                  Check
                                                </span>
                                              )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                              {formatMappingSource(mapping)}
                                            </p>
                                            {mapping.mismatchReasons.length > 0 && (
                                              <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                                                {mapping.mismatchReasons.join(' ')}
                                              </p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setEditingMapping(mapping)}
                                            className="shrink-0 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-sky-900 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950"
                                          >
                                            Set source
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
                                    <div className="border-b border-zinc-200 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                      Slots
                                    </div>
                                    {slots.length === 0 ? (
                                      <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                                        No slots configured.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {slots.map((slot) => (
                                          <div
                                            key={slot.id}
                                            className="flex items-center justify-between gap-3 px-3 py-2"
                                          >
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                                {slot.display_order}. {slot.label || formatSlotPreview(slot)}
                                              </p>
                                              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                                {slot.slot_type} - {formatSlotPreview(slot)}
                                              </p>
                                            </div>
                                            <div className="flex shrink-0 gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => setEditingSlot({ element, slot })}
                                                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setDeletingSlot(slot)}
                                                className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
                                    <div className="border-b border-zinc-200 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                      Progression rules
                                    </div>
                                    {rules.length === 0 ? (
                                      <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                                        No progression rules configured.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {rules.map((rule) => (
                                          <div
                                            key={rule.id}
                                            className="flex items-center justify-between gap-3 px-3 py-2"
                                          >
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                                {rule.display_order}. {formatRulePreview(rule)}
                                              </p>
                                              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                                {formatSourceType(rule.source_type)}
                                              </p>
                                            </div>
                                            <div className="flex shrink-0 gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => setEditingRule({ element, rule })}
                                                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setDeletingRule(rule)}
                                                className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        </details>

        {editingPhase && (
          <PhaseEditForm
            mode="edit"
            division={division}
            phase={editingPhase}
            onSaved={handleSaved}
            onCancel={() => setEditingPhase(null)}
          />
        )}

        {creatingPoolForPhase && (
          <PoolEditForm
            mode="create"
            phase={creatingPoolForPhase}
            defaultDisplayOrder={(creatingPoolForPhase.pools?.length ?? 0) + 1}
            defaultIsDefault={(creatingPoolForPhase.pools?.length ?? 0) === 0}
            onSaved={handleSaved}
            onCancel={() => setCreatingPoolForPhase(null)}
          />
        )}

        {editingPool && (
          <PoolEditForm
            mode="edit"
            phase={editingPool.phase}
            pool={editingPool.pool}
            hasOtherDefault={
              editingPool.phase.pools?.some(
                (pool) => pool.id !== editingPool.pool.id && pool.is_default
              ) ?? false
            }
            onSaved={handleSaved}
            onCancel={() => setEditingPool(null)}
          />
        )}

        {assigningPool && (
          <PoolTeamAssignmentDialog
            pool={assigningPool.pool}
            phasePools={assigningPool.phase.pools ?? []}
            teams={teams}
            assignedPoolTeams={assigningPool.pool.pool_teams ?? []}
            onSaved={handleSaved}
            onCancel={() => setAssigningPool(null)}
          />
        )}

        {creatingElementForPhase && (
          <PhaseElementEditForm
            mode="create"
            phase={creatingElementForPhase}
            defaultDisplayOrder={(creatingElementForPhase.phase_elements?.length ?? 0) + 1}
            onSaved={handleSaved}
            onCancel={() => setCreatingElementForPhase(null)}
          />
        )}

        {editingElement && (
          <PhaseElementEditForm
            mode="edit"
            phase={editingElement.phase}
            element={editingElement.element}
            onSaved={handleSaved}
            onCancel={() => setEditingElement(null)}
          />
        )}

        {creatingSlotForElement && (
          <ElementSlotEditForm
            mode="create"
            element={creatingSlotForElement}
            phases={allPhases}
            elements={allFormsPhaseElements}
            pools={allFormsPools}
            teams={allTeams}
            defaultDisplayOrder={(creatingSlotForElement.slots?.length ?? 0) + 1}
            onSaved={handleSaved}
            onCancel={() => setCreatingSlotForElement(null)}
          />
        )}

        {editingSlot && (
          <ElementSlotEditForm
            mode="edit"
            element={editingSlot.element}
            slot={editingSlot.slot}
            phases={allPhases}
            elements={allFormsPhaseElements}
            pools={allFormsPools}
            teams={allTeams}
            onSaved={handleSaved}
            onCancel={() => setEditingSlot(null)}
          />
        )}

        {creatingRuleForElement && (
          <ProgressionRuleEditForm
            mode="create"
            targetElement={creatingRuleForElement}
            phases={allPhases}
            elements={allFormsPhaseElements}
            pools={allFormsPools}
            slots={allFormsSlots}
            defaultDisplayOrder={(rulesByElement.get(creatingRuleForElement.id)?.length ?? 0) + 1}
            onSaved={handleSaved}
            onCancel={() => setCreatingRuleForElement(null)}
          />
        )}

        {editingRule && (
          <ProgressionRuleEditForm
            mode="edit"
            targetElement={editingRule.element}
            rule={editingRule.rule}
            phases={allPhases}
            elements={allFormsPhaseElements}
            pools={allFormsPools}
            slots={allFormsSlots}
            onSaved={handleSaved}
            onCancel={() => setEditingRule(null)}
          />
        )}

        {editingMapping && (
          <QualificationMappingEditForm
            mapping={editingMapping}
            phases={allPhases}
            elements={allFormsPhaseElements}
            pools={allFormsPools}
            teams={allTeams}
            onSaved={handleSaved}
            onCancel={() => setEditingMapping(null)}
          />
        )}

        {startingPhase && (
          <StartNextPhaseDialog
            phase={startingPhase}
            phases={allPhases}
            pools={allFormsPools}
            elements={allFormsPhaseElements}
            slots={allFormsSlots}
            rules={progressionRules.filter((rule) =>
              (startingPhase.phase_elements ?? []).some(
                (element) => element.id === rule.to_element_id
              )
            )}
            teams={allTeams}
            matches={matches}
            onSaved={handleSaved}
            onCancel={() => setStartingPhase(null)}
          />
        )}

        {deletingPhase && (
          <ConfirmDialog
            title={`Delete "${deletingPhase.name}"?`}
            message={
              (matchCountByPhase.get(deletingPhase.id) ?? 0) > 0
                ? `This will delete the stage, its pools, advanced blocks, qualifiers and progression rules. It will also remove ${matchCountByPhase.get(deletingPhase.id) ?? 0} unscheduled fixture${(matchCountByPhase.get(deletingPhase.id) ?? 0) === 1 ? '' : 's'} from this stage. Scheduled and completed fixtures are not deleted by this action.`
                : 'This will delete the stage, its pools, advanced blocks, qualifiers and progression rules.'
            }
            confirmLabel={deleting ? 'Deleting...' : 'Delete stage'}
            onConfirm={handleDeletePhase}
            onCancel={() => setDeletingPhase(null)}
          />
        )}

        {deletingPool && (
          <ConfirmDialog
            title={`Delete "${deletingPool.pool.name}"?`}
            message="This will delete the pool and its team assignments. It is only allowed while no matches belong to the pool."
            confirmLabel={deleting ? 'Deleting...' : 'Delete pool'}
            onConfirm={handleDeletePool}
            onCancel={() => setDeletingPool(null)}
          />
        )}

        {deletingElement && (
          <ConfirmDialog
            title={`Delete "${deletingElement.name}"?`}
            message="This will delete the element, its slots, and progression rules. It is only allowed while no matches belong to the element."
            confirmLabel={deleting ? 'Deleting...' : 'Delete element'}
            onConfirm={handleDeleteElement}
            onCancel={() => setDeletingElement(null)}
          />
        )}

        {deletingSlot && (
          <ConfirmDialog
            title={`Delete slot ${deletingSlot.display_order}?`}
            message="This will remove this slot from the element. Any rule targeting it may also be removed by the database."
            confirmLabel={deleting ? 'Deleting...' : 'Delete slot'}
            onConfirm={handleDeleteSlot}
            onCancel={() => setDeletingSlot(null)}
          />
        )}

        {deletingRule && (
          <ConfirmDialog
            title="Delete progression rule?"
            message="This will remove this progression mapping from the target element."
            confirmLabel={deleting ? 'Deleting...' : 'Delete rule'}
            onConfirm={handleDeleteRule}
            onCancel={() => setDeletingRule(null)}
          />
        )}
      </>
    )
  }
)

export default AdvancedStructureEditor
