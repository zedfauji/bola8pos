/**
 * Quoted-wait heuristic: estimates minutes remaining for a party.
 * Pure function — no imports from entities or features.
 * Source: S5-waitlist.md "Quoted-wait heuristic" section
 */

export interface WaitlistMathInput {
  entries: Array<{
    id: string;
    partySize: number;
    status: 'waiting' | 'notified' | 'seated' | 'no_show' | 'cancelled';
    createdAt: Date;
    seatedAt: Date | null;
  }>;
  targetEntryId: string;
  availableTableCount: number;
  /** 7-day rolling average turn time in minutes, keyed by party_size */
  averageTurnMinutesByPartySize: Map<number, number>;
}

/**
 * Computes quoted wait time in minutes for a specific party.
 *
 * Algorithm:
 *   partiesAhead = entries with (status='waiting'|'notified') AND partySize >= targetPartySize AND createdAt < target.createdAt
 *   avgTurn = averageTurnMinutesByPartySize.get(target.partySize) ?? 30
 *   result = max(5, avgTurn * ceil(partiesAhead / max(1, availableTableCount)))
 *
 * Minimum floor is 5 minutes — never returns 0.
 */
export function computeQuotedWait(input: WaitlistMathInput): number {
  const target = input.entries.find(e => e.id === input.targetEntryId);
  if (!target) return 0;

  const avgTurn = input.averageTurnMinutesByPartySize.get(target.partySize) ?? 30; // 30min default

  const partiesAhead = input.entries.filter(
    e =>
      (e.status === 'waiting' || e.status === 'notified') &&
      e.partySize >= target.partySize &&
      e.createdAt < target.createdAt
  ).length;

  const tables = Math.max(1, input.availableTableCount);
  return Math.max(5, avgTurn * Math.ceil(partiesAhead / tables));
}
