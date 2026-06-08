import type { createClient } from './supabase'
import type {
  ElementSlot,
  ElementSlotType,
  PhaseElement,
  ProgressionRule,
  ProgressionSourceType,
  SlotSourceOutcome,
} from './types'

type Supabase = ReturnType<typeof createClient>

export interface QualificationMappingInput {
  targetElement: PhaseElement
  targetSlotId?: string | null
  targetSlotOrder: number
  label?: string | null
  slotType: ElementSlotType
  teamId?: string | null
  sourceType?: ProgressionSourceType | null
  sourcePhaseId?: string | null
  sourceElementId?: string | null
  sourcePoolId?: string | null
  sourceMatchId?: string | null
  sourceRank?: number | null
  sourceOutcome?: SlotSourceOutcome | null
  ruleId?: string | null
  ruleDisplayOrder?: number | null
}

export interface QualificationMapping {
  id: string
  targetElement: PhaseElement
  targetSlot: ElementSlot
  progressionRule: ProgressionRule | null
  targetSlotOrder: number
  label: string | null
  slotType: ElementSlotType
  teamId: string | null
  sourceType: ProgressionSourceType | null
  sourcePhaseId: string | null
  sourceElementId: string | null
  sourcePoolId: string | null
  sourceMatchId: string | null
  sourceRank: number | null
  sourceOutcome: SlotSourceOutcome | null
  isLinked: boolean
  mismatchReasons: string[]
}

export interface QualificationMappingResult {
  slot: ElementSlot | null
  rule: ProgressionRule | null
  error?: string
}

export function buildQualificationMappings(params: {
  targetElements: PhaseElement[]
  slots: ElementSlot[]
  rules: ProgressionRule[]
}): QualificationMapping[] {
  const elementById = new Map(
    params.targetElements.map((element) => [element.id, element])
  )
  const rulesBySlotId = new Map<string, ProgressionRule>()
  const rulesByElementOrder = new Map<string, ProgressionRule>()

  for (const rule of params.rules) {
    if (rule.to_slot_id) rulesBySlotId.set(rule.to_slot_id, rule)
    if (rule.to_slot_order) {
      rulesByElementOrder.set(`${rule.to_element_id}:${rule.to_slot_order}`, rule)
    }
  }

  return params.slots
    .filter((slot) => elementById.has(slot.phase_element_id))
    .sort((a, b) => a.display_order - b.display_order)
    .map((slot) => {
      const targetElement = elementById.get(slot.phase_element_id)!
      const rule =
        rulesBySlotId.get(slot.id) ??
        rulesByElementOrder.get(`${slot.phase_element_id}:${slot.display_order}`) ??
        null
      const sourceType = rule?.source_type ?? (
        slot.slot_type === 'source' ? slotOutcomeToSourceType(slot.source_outcome) : null
      )
      const mismatchReasons: string[] = []

      if (slot.slot_type === 'source' && !rule) {
        mismatchReasons.push('Source slot has no matching progression rule.')
      }
      if (rule && slot.slot_type !== 'source') {
        mismatchReasons.push('Progression rule targets a slot that is not marked as a source.')
      }
      if (rule && slot.source_pool_id && rule.from_pool_id && slot.source_pool_id !== rule.from_pool_id) {
        mismatchReasons.push('Slot source pool and progression rule pool do not match.')
      }
      if (rule && slot.source_rank && rule.source_rank && slot.source_rank !== rule.source_rank) {
        mismatchReasons.push('Slot source rank and progression rule rank do not match.')
      }

      return {
        id: slot.id,
        targetElement,
        targetSlot: slot,
        progressionRule: rule,
        targetSlotOrder: slot.display_order,
        label: slot.label,
        slotType: slot.slot_type,
        teamId: slot.team_id,
        sourceType,
        sourcePhaseId: rule?.from_phase_id ?? slot.source_phase_id,
        sourceElementId: rule?.from_element_id ?? slot.source_element_id,
        sourcePoolId: rule?.from_pool_id ?? slot.source_pool_id,
        sourceMatchId: rule?.from_match_id ?? slot.source_match_id,
        sourceRank: rule?.source_rank ?? slot.source_rank,
        sourceOutcome: slot.source_outcome ?? (sourceType ? sourceTypeToSlotOutcome(sourceType) : null),
        isLinked: slot.slot_type !== 'source' || Boolean(rule),
        mismatchReasons,
      }
    })
}

export function sourceTypeToSlotOutcome(
  sourceType: ProgressionSourceType
): SlotSourceOutcome {
  if (sourceType === 'match_winner') return 'winner'
  if (sourceType === 'match_loser') return 'loser'
  if (sourceType === 'best_rank') return 'best_rank'
  if (sourceType === 'manual') return 'manual'
  return 'rank'
}

export function slotOutcomeToSourceType(
  outcome: SlotSourceOutcome | null | undefined
): ProgressionSourceType {
  if (outcome === 'winner') return 'match_winner'
  if (outcome === 'loser') return 'match_loser'
  if (outcome === 'best_rank') return 'best_rank'
  if (outcome === 'manual') return 'manual'
  return 'standings_rank'
}

function sourceTypeFor(input: QualificationMappingInput) {
  return input.sourceType ?? slotOutcomeToSourceType(input.sourceOutcome)
}

async function findExistingRuleForSlot(
  supabase: Supabase,
  slot: ElementSlot,
  targetElement: PhaseElement
) {
  const bySlot = await supabase
    .from('progression_rules')
    .select('*')
    .eq('to_slot_id', slot.id)
    .maybeSingle()

  if (bySlot.error) return { rule: null, error: bySlot.error.message }
  if (bySlot.data) return { rule: bySlot.data as ProgressionRule }

  const byOrder = await supabase
    .from('progression_rules')
    .select('*')
    .eq('to_element_id', targetElement.id)
    .eq('to_slot_order', slot.display_order)
    .maybeSingle()

  if (byOrder.error) return { rule: null, error: byOrder.error.message }
  return { rule: (byOrder.data as ProgressionRule | null) ?? null }
}

export async function clearQualificationMappingForSlot(
  supabase: Supabase,
  slot: ElementSlot
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('progression_rules')
    .delete()
    .or(`to_slot_id.eq.${slot.id},and(to_element_id.eq.${slot.phase_element_id},to_slot_order.eq.${slot.display_order})`)

  return error ? { error: error.message } : {}
}

export async function saveQualificationMapping(
  supabase: Supabase,
  input: QualificationMappingInput
): Promise<QualificationMappingResult> {
  const sourceType = sourceTypeFor(input)
  const sourceOutcome = input.sourceOutcome ?? sourceTypeToSlotOutcome(sourceType)
  const parsedRank = input.sourceRank ?? null

  const slotPayload = {
    phase_element_id: input.targetElement.id,
    display_order: input.targetSlotOrder,
    label: input.label?.trim() || null,
    slot_type: input.slotType,
    team_id: input.slotType === 'team' ? input.teamId ?? null : null,
    source_phase_id: input.slotType === 'source' ? input.sourcePhaseId ?? null : null,
    source_element_id: input.slotType === 'source' ? input.sourceElementId ?? null : null,
    source_pool_id: input.slotType === 'source' ? input.sourcePoolId ?? null : null,
    source_match_id: input.slotType === 'source' ? input.sourceMatchId ?? null : null,
    source_rank: input.slotType === 'source' ? parsedRank : null,
    source_outcome: input.slotType === 'source' ? sourceOutcome : null,
    metadata: {},
  }

  const slotResponse = input.targetSlotId
    ? await supabase
        .from('element_slots')
        .update(slotPayload)
        .eq('id', input.targetSlotId)
        .select()
        .single()
    : await supabase
        .from('element_slots')
        .upsert(slotPayload, { onConflict: 'phase_element_id,display_order' })
        .select()
        .single()

  if (slotResponse.error) {
    return { slot: null, rule: null, error: slotResponse.error.message }
  }

  const slot = slotResponse.data as ElementSlot

  if (input.slotType !== 'source') {
    const clearResult = await clearQualificationMappingForSlot(supabase, slot)
    return {
      slot,
      rule: null,
      error: clearResult.error,
    }
  }

  if (
    sourceType !== 'manual' &&
    !input.sourcePhaseId &&
    !input.sourceElementId &&
    !input.sourcePoolId &&
    !input.sourceMatchId
  ) {
    return { slot, rule: null, error: 'Choose where this qualification should read from.' }
  }

  const existingRuleResult = input.ruleId
    ? { rule: null as ProgressionRule | null }
    : await findExistingRuleForSlot(supabase, slot, input.targetElement)

  if (existingRuleResult.error) {
    return { slot, rule: null, error: existingRuleResult.error }
  }

  const rulePayload = {
    from_phase_id: input.sourcePhaseId ?? null,
    from_element_id: input.sourceElementId ?? null,
    from_pool_id: input.sourcePoolId ?? null,
    from_match_id: input.sourceMatchId ?? null,
    source_type: sourceType,
    source_rank: parsedRank,
    to_phase_id: input.targetElement.phase_id,
    to_element_id: input.targetElement.id,
    to_slot_id: slot.id,
    to_slot_order: null,
    display_order:
      input.ruleDisplayOrder ??
      existingRuleResult.rule?.display_order ??
      slot.display_order,
    rule_config: {},
  }

  const ruleId = input.ruleId ?? existingRuleResult.rule?.id
  const ruleResponse = ruleId
    ? await supabase
        .from('progression_rules')
        .update(rulePayload)
        .eq('id', ruleId)
        .select()
        .single()
    : await supabase
        .from('progression_rules')
        .insert(rulePayload)
        .select()
        .single()

  if (ruleResponse.error) {
    return { slot, rule: null, error: ruleResponse.error.message }
  }

  return {
    slot,
    rule: ruleResponse.data as ProgressionRule,
  }
}
