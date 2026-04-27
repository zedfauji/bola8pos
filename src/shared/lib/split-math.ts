/**
 * split-math.ts
 *
 * Pure utility functions for split-bill calculations.
 * No Supabase, no React — fully testable in isolation.
 * All monetary values use integer cents to avoid float drift.
 *
 * Used by:
 *   - features/split-tab/ui/SplitTabSheet (Evenly mode preview)
 *   - features/split-tab/model/useSplitTab (Evenly mode payment loop)
 *
 * Tests: src/shared/lib/split-math.test.ts (P8, P9 property tests)
 */

/**
 * Convert a decimal amount (e.g. 33.33) to integer cents (3333).
 * Uses Math.round to avoid float drift on .005 values.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert integer cents (3333) back to decimal (33.33).
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Calculate N-way even split amounts in integer cents.
 *
 * Invariant (P9): baseAmount * (n - 1) + lastAmount === totalCents (exact).
 * The last payment absorbs any rounding remainder.
 *
 * @param totalCents  Total amount in integer cents (e.g. 10000 for $100.00)
 * @param n           Number of ways to split (must be >= 2)
 * @returns { baseAmount, lastAmount } — both in integer cents
 */
export function computeEvenSplit(
  totalCents: number,
  n: number
): {
  baseAmount: number;
  lastAmount: number;
} {
  if (n < 2) throw new Error('computeEvenSplit: n must be >= 2');
  const base = Math.floor(totalCents / n);
  const last = totalCents - base * (n - 1);
  return { baseAmount: base, lastAmount: last };
}

/**
 * Build the array of N payment amounts for an even split.
 * First (n-1) payments get baseAmount; last gets lastAmount.
 * Sum always equals totalCents exactly (P9).
 */
export function buildEvenPayments(totalCents: number, n: number): number[] {
  const { baseAmount, lastAmount } = computeEvenSplit(totalCents, n);
  return Array.from({ length: n - 1 }, () => baseAmount).concat(lastAmount);
}
