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
 */
export function computePoolSessionBilling(
  input: ComputePoolSessionBillingInput
): ComputePoolSessionBillingResult {
  const { firstHourMode = 'prorated' } = input;
  const elapsedMs = Math.max(0, input.endTime.getTime() - input.startedAt.getTime());
  const elapsedMinutes = Math.ceil(elapsedMs / (1000 * 60));

  let billedMinutes: number;
  if (firstHourMode === 'full' && elapsedMinutes < 60) {
    billedMinutes = 60;
  } else {
    billedMinutes = Math.ceil(elapsedMinutes / 15) * 15;
  }

  const totalCharge = (billedMinutes / 60) * input.ratePerHour;
  return { elapsedMs, elapsedMinutes, billedMinutes, totalCharge };
}
