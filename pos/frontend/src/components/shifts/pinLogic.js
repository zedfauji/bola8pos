// Simple helper to decide whether a payout requires PIN
// Params: { amount: number, threshold: number, globallyRequired: boolean }
export function needsPinForPayout({ amount, threshold, globallyRequired }) {
  if (globallyRequired) return true;
  const amt = Number(amount) || 0;
  const thr = Number(threshold) || 0;
  return amt >= thr;
}
