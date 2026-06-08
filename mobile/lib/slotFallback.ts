// Mirrors slot label resolution from src/components/PublicBracketView.tsx.
// Given an ElementSlot that isn't yet resolved to a concrete team, return the
// best human-readable placeholder ("Winner of QF1", "2nd place qualifier",
// "Bye", etc.).

import type { ElementSlot } from './types';

export function slotFallbackLabel(slot: ElementSlot | undefined): string {
  if (!slot) return 'TBD';
  if (slot.slot_type === 'bye') return 'Bye';
  if (slot.label) return slot.label;
  if (slot.source_outcome === 'winner') return 'Winner of previous fixture';
  if (slot.source_outcome === 'loser') return 'Loser of previous fixture';
  if (slot.source_outcome === 'rank' && slot.source_rank) {
    return `${ordinal(slot.source_rank)} place qualifier`;
  }
  return 'TBD';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
