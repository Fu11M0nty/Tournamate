import type { AgeGroup, Match, Phase, ScoringSystem } from './types'

export function sortedPhasesForAgeGroup(ageGroup: AgeGroup): Phase[] {
  return [...(ageGroup.phases ?? [])].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  )
}

export function defaultPhaseForAgeGroup(ageGroup: AgeGroup): Phase | null {
  const phases = sortedPhasesForAgeGroup(ageGroup)
  if (phases.length === 0) return null

  return (
    phases.find((phase) => phase.slug === 'round-robin') ??
    phases[0] ??
    null
  )
}

export function phaseForAgeGroup(
  ageGroup: AgeGroup,
  phaseSlug: string | null
): Phase | null {
  const phases = sortedPhasesForAgeGroup(ageGroup)
  if (phases.length === 0) return null

  if (phaseSlug) {
    const selected = phases.find((phase) => phase.slug === phaseSlug)
    if (selected) return selected
  }

  return defaultPhaseForAgeGroup(ageGroup)
}

export const sortedPhasesForDivision = sortedPhasesForAgeGroup
export const defaultPhaseForDivision = defaultPhaseForAgeGroup
export const phaseForDivision = phaseForAgeGroup

export function effectiveScoringSystemForAgeGroup(
  ageGroup: AgeGroup
): ScoringSystem | undefined {
  return (
    defaultPhaseForAgeGroup(ageGroup)?.scoring_system ??
    ageGroup.scoring_system ??
    undefined
  )
}

export function effectiveScoringSystemForPhase(
  ageGroup: AgeGroup,
  phase: Phase | null
): ScoringSystem | undefined {
  return phase?.scoring_system ?? ageGroup.scoring_system ?? undefined
}

export function matchesForPhase(phase: Phase | null, matches: Match[]): Match[] {
  if (!phase) return matches

  const hasPhaseAssignments = matches.some((match) => match.phase_id !== null)
  if (!hasPhaseAssignments) return matches

  return matches.filter((match) => match.phase_id === phase.id)
}

export function matchesForPhaseScope(
  ageGroup: AgeGroup,
  matches: Match[]
): Match[] {
  const phase = defaultPhaseForAgeGroup(ageGroup)
  return matchesForPhase(phase, matches)
}
