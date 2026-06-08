/**
 * Builds a human-readable stage label for a match, e.g. "Pool A", "Championship".
 * Priority: pool name → phase element name → phase name → null.
 */
export function matchStageLabel(
  match: { pool_id: string | null; phase_element_id: string | null; phase_id: string | null },
  poolById: Map<string, { name: string }>,
  elementById?: Map<string, { name: string }>,
  phaseById?: Map<string, { name: string }>
): string | null {
  if (match.pool_id) {
    const pool = poolById.get(match.pool_id)
    if (pool) return pool.name
  }
  if (match.phase_element_id && elementById) {
    const el = elementById.get(match.phase_element_id)
    if (el) return el.name
  }
  if (match.phase_id && phaseById) {
    const phase = phaseById.get(match.phase_id)
    if (phase) return phase.name
  }
  return null
}

/**
 * Combines stage label with round number into a single display string,
 * e.g. "Pool A · Round 2", "Championship · Round 1", "Pool B", "Round 3".
 * Returns null when neither stage nor round is available.
 */
export function matchStageRoundLabel(
  match: {
    pool_id: string | null
    phase_element_id: string | null
    phase_id: string | null
    round_number: number | null
  },
  poolById: Map<string, { name: string }>,
  elementById?: Map<string, { name: string }>,
  phaseById?: Map<string, { name: string }>
): string | null {
  const stage = matchStageLabel(match, poolById, elementById, phaseById)
  const round = match.round_number ? `Round ${match.round_number}` : null
  if (stage && round) return `${stage} · ${round}`
  return stage ?? round
}
