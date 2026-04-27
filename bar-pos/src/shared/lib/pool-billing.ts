/**
 * Pool session billing — matches `useMutationStopSession` arithmetic exactly.
 */

export interface ComputePoolSessionBillingInput {
  startedAt: Date;
  endTime: Date;
  ratePerHour: number;
  /**
   * 'prorated' (default): bill in 15-minute blocks.
   * 'full': sessions under 60 minutes are charged a full hour.
   */
  firstHourMode?: 'full' | 'prorated';
  /**
   * Minutes already paid via a combo. Subtracted from elapsed before billing.
   * Default 0 — backward compatible with existing callers.
   * T-2-02-01: Math.max(0,...) ensures no negative charges.
   */
  prepaidMinutes?: number;
}

export interface ComputePoolSessionBillingResult {
  elapsedMs: number;
  /** Whole minutes, rounded up from wall time (matches DB mutation). */
  elapsedMinutes: number;
  /** Rounded up to 15-minute blocks (or 60 in full-hour mode for short sessions). */
  billedMinutes: number;
  /** Unrounded product; persist as Supabase does today. */
  totalCharge: number;
}

/**
 * Billable pool time.
 * - prorated (default): elapsed minutes are ceiling'd first, then blocks are 15 minutes.
 * - full: sessions under 60 minutes are billed as a full hour.
 * - prepaidMinutes: deducted from the billing calculation (e.g. combo includes pool time).
 */
export function computePoolSessionBilling(
  input: ComputePoolSessionBillingInput
): ComputePoolSessionBillingResult {
  const { firstHourMode = 'prorated', prepaidMinutes = 0 } = input;
  const elapsedMs = Math.max(0, input.endTime.getTime() - input.startedAt.getTime());
  const elapsedMinutes = Math.ceil(elapsedMs / (1000 * 60));

  // Apply firstHourMode to determine base billed minutes before prepaid deduction
  let baseBilledMinutes: number;
  if (firstHourMode === 'full' && elapsedMinutes < 60) {
    baseBilledMinutes = 60;
  } else {
    baseBilledMinutes = Math.ceil(elapsedMinutes / 15) * 15;
  }

  // Subtract prepaid minutes, flooring at 0 (T-2-02-01: no negative charges)
  const chargeableMinutes = Math.max(0, baseBilledMinutes - prepaidMinutes);
  // Round chargeable up to 15-minute blocks (unless already 0)
  const billedMinutes = chargeableMinutes === 0 ? 0 : Math.ceil(chargeableMinutes / 15) * 15;

  const totalCharge = (billedMinutes / 60) * input.ratePerHour;
  return { elapsedMs, elapsedMinutes, billedMinutes, totalCharge };
}
