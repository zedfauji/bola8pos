/**
 * Pool session billing — matches `useMutationStopSession` arithmetic exactly.
 */

export interface ComputePoolSessionBillingInput {
  startedAt: Date;
  endTime: Date;
  ratePerHour: number;
}

export interface ComputePoolSessionBillingResult {
  elapsedMs: number;
  /** Whole minutes, rounded up from wall time (matches DB mutation). */
  elapsedMinutes: number;
  /** Rounded up to 15-minute blocks. */
  billedMinutes: number;
  /** Unrounded product; persist as Supabase does today. */
  totalCharge: number;
}

/**
 * Billable pool time: elapsed minutes are ceiling'd first, then blocks are 15 minutes.
 */
export function computePoolSessionBilling(
  input: ComputePoolSessionBillingInput
): ComputePoolSessionBillingResult {
  const elapsedMs = Math.max(0, input.endTime.getTime() - input.startedAt.getTime());
  const elapsedMinutes = Math.ceil(elapsedMs / (1000 * 60));
  const billedMinutes = Math.ceil(elapsedMinutes / 15) * 15;
  const totalCharge = (billedMinutes / 60) * input.ratePerHour;
  return { elapsedMs, elapsedMinutes, billedMinutes, totalCharge };
}
