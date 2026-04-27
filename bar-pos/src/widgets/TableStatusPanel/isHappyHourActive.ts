import type { Order } from '@shared/lib/domain';

/**
 * Returns true if the current time falls within the happy-hour window for any
 * ordered item's category. Supports windows that cross midnight (e.g. 22:00–02:00).
 *
 * Extracted from TableStatusPanel/index.tsx for isolated unit testing.
 */
export function isHappyHourActive(orders: Order[]): boolean {
  const now = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  for (const order of orders) {
    for (const item of order.items) {
      const cat = item.product?.category;
      // category may not be embedded on the OrderItem product; guard defensively
      if (!cat) continue;
      const { happyHourStart, happyHourEnd } = cat as {
        happyHourStart?: string | null;
        happyHourEnd?: string | null;
      };
      if (!happyHourStart || !happyHourEnd) continue;
      const [sh, sm] = happyHourStart.split(':').map(Number);
      const [eh, em] = happyHourEnd.split(':').map(Number);
      const start = (sh ?? 0) * 60 + (sm ?? 0);
      const end = (eh ?? 0) * 60 + (em ?? 0);
      const active = start <= end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
      if (active) return true;
    }
  }
  return false;
}
