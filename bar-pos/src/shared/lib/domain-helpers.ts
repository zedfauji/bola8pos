/**
 * DOMAIN HELPERS
 *
 * Pure functions that compute derived values from domain entities.
 * No side effects. No async. No Supabase calls. Fully testable.
 */

import type {
  CartItem,
  Order,
  PoolSessionSummary,
  DiscountScope,
  DiscountType,
  RecipeWithItems,
  ModifierInventoryRule,
  Promotion,
  PromotionAvailability,
} from './domain';
import { computePoolSessionBilling } from './pool-billing';

/**
 * Calculates pool table charge with ceiling to 15-minute blocks.
 *
 * Uses {@link computePoolSessionBilling} so UI and `useMutationStopSession` stay aligned.
 *
 * @param startedAt - Session start time
 * @param stoppedAt - Session stop time
 * @param ratePerHour - Hourly rate for the table
 * @returns Charge amount rounded to 2 decimal places
 */
export function calculatePoolCharge(startedAt: Date, stoppedAt: Date, ratePerHour: number): number {
  const { totalCharge } = computePoolSessionBilling({ startedAt, endTime: stoppedAt, ratePerHour });
  return Math.round(totalCharge * 100) / 100;
}

/**
 * Calculates the line total for a cart item.
 *
 * Formula: (unitPrice + modifierPriceDelta) * quantity
 *
 * @param item - The cart item
 * @returns Line total rounded to 2 decimal places
 *
 * @example
 * calculateOrderItemLineTotal({
 *   unitPrice: 5.00,
 *   selectedModifiers: [{ priceDelta: 2.00 }],
 *   quantity: 2
 * })
 * // Returns: 14.00 (7.00 * 2)
 */
export function calculateOrderItemLineTotal(item: CartItem): number {
  const modifierPriceDelta = item.selectedModifiers.reduce(
    (sum, modifier) => sum + modifier.priceDelta,
    0
  );

  const lineTotal = (item.unitPrice + modifierPriceDelta) * item.quantity;

  // Round to 2 decimal places
  return Math.round(lineTotal * 100) / 100;
}

/**
 * Calculates the subtotal for a tab.
 *
 * Sum of all order item line totals + sum of all pool charges.
 *
 * @param orders - Array of orders on the tab
 * @param poolCharges - Array of pool session charges
 * @returns Subtotal rounded to 2 decimal places
 *
 * @example
 * calculateTabSubtotal(
 *   [{ items: [{ lineTotal: 10.00 }, { lineTotal: 5.50 }] }],
 *   [{ totalCharge: 7.50 }]
 * )
 * // Returns: 23.00
 */
export function calculateTabSubtotal(orders: Order[], poolCharges: PoolSessionSummary[]): number {
  // Sum all order item line totals
  const ordersTotal = orders.reduce((sum, order) => {
    const orderTotal = order.items.reduce((itemSum, item) => {
      return itemSum + (item.lineTotal ?? 0);
    }, 0);
    return sum + orderTotal;
  }, 0);

  // Sum all pool charges
  const poolTotal = poolCharges.reduce((sum, charge) => {
    return sum + charge.totalCharge;
  }, 0);

  const subtotal = ordersTotal + poolTotal;

  // Round to 2 decimal places
  return Math.round(subtotal * 100) / 100;
}

/**
 * Calculates tip amount from percentage or flat amount.
 *
 * @param subtotal - The subtotal to calculate tip on
 * @param tipPercent - Tip percentage (e.g., 20 for 20%)
 * @param tipFlat - Flat tip amount
 * @returns Tip amount rounded to 2 decimal places
 *
 * @example
 * // 20% tip on $50.00
 * calculateTipAmount(50.00, 20, null)
 * // Returns: 10.00
 *
 * @example
 * // Flat $5.00 tip
 * calculateTipAmount(50.00, null, 5.00)
 * // Returns: 5.00
 *
 * @example
 * // No tip
 * calculateTipAmount(50.00, null, null)
 * // Returns: 0.00
 */
export function calculateTipAmount(
  subtotal: number,
  tipPercent: number | null,
  tipFlat: number | null
): number {
  if (tipPercent !== null) {
    const tip = subtotal * (tipPercent / 100);
    return Math.round(tip * 100) / 100;
  }

  if (tipFlat !== null) {
    return Math.round(tipFlat * 100) / 100;
  }

  return 0;
}

/**
 * Formats a money amount as a string.
 *
 * @param amount - The amount to format
 * @returns Formatted string like "$12.50" or "-$3.00"
 *
 * @example
 * formatMoney(12.5)
 * // Returns: "$12.50"
 *
 * @example
 * formatMoney(-3)
 * // Returns: "-$3.00"
 *
 * @example
 * formatMoney(0)
 * // Returns: "$0.00"
 */
export function formatMoney(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2);

  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Formats elapsed time in seconds to a readable string.
 *
 * @param totalSeconds - Total elapsed seconds
 * @returns Formatted string "mm:ss" or "h:mm:ss"
 *
 * @example
 * formatElapsed(90)
 * // Returns: "01:30"
 *
 * @example
 * formatElapsed(3661)
 * // Returns: "1:01:01"
 *
 * @example
 * formatElapsed(45)
 * // Returns: "00:45"
 */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    // Format as h:mm:ss
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${String(hours)}:${mm}:${ss}`;
  }

  // Format as mm:ss
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Generates an idempotency key for Square payment calls.
 *
 * Format: `${prefix}_${timestamp}_${randomId}`
 *
 * Used to prevent double-charging if a payment request is retried.
 *
 * @param prefix - Prefix for the key (e.g., "payment", "refund")
 * @returns Idempotency key
 *
 * @example
 * generateIdempotencyKey('payment')
 * // Returns: "payment_1704110400000_a1b2c3d4"
 */
export function generateIdempotencyKey(prefix: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${String(timestamp)}_${randomId}`;
}

/** Minutes a tab has been open (floored), for duration rules and tests. */
export function getTabOpenMinutes(openedAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - openedAt.getTime()) / 60000);
}

/** Green under 2h, yellow from 2h, red from 4h (per POS tab UX spec). */
export type TabDurationTier = 'ok' | 'warn' | 'critical';

export function getTabDurationTier(openedAt: Date, now: Date = new Date()): TabDurationTier {
  const m = getTabOpenMinutes(openedAt, now);
  if (m >= 240) return 'critical';
  if (m >= 120) return 'warn';
  return 'ok';
}

export function formatTimeOpen(openedAt: Date, now: Date = new Date()): string {
  const minutes = getTabOpenMinutes(openedAt, now);
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remaining)}m`;
}

export function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function calculateTipSuggestions(subtotal: number): {
  tip10: number;
  tip15: number;
  tip18: number;
  tip20: number;
} {
  return {
    tip10: calculateTipAmount(subtotal, 10, null),
    tip15: calculateTipAmount(subtotal, 15, null),
    tip18: calculateTipAmount(subtotal, 18, null),
    tip20: calculateTipAmount(subtotal, 20, null),
  };
}

/**
 * Returns the portion of the bill that a discount applies to, based on scope.
 */
export function getDiscountBase(
  itemsSubtotal: number,
  poolTotal: number,
  scope: DiscountScope
): number {
  switch (scope) {
    case 'pool_only':
      return poolTotal;
    case 'consumptions_only':
      return itemsSubtotal;
    case 'all':
    default:
      return Math.round((itemsSubtotal + poolTotal) * 100) / 100;
  }
}

/**
 * Calculates the discount amount from a base, type, and value.
 * Caps the result at the base amount.
 */
export function calculateDiscountAmount(base: number, type: DiscountType, value: number): number {
  if (value <= 0 || base <= 0) return 0;
  const raw = type === 'percent' ? (value / 100) * base : Math.min(value, base);
  return Math.round(Math.min(raw, base) * 100) / 100;
}

/**
 * computeDepletion — pure function for property test P6.
 * Returns a Map of ingredientId → stock delta (negative = subtract, positive = add back).
 * direction: +1 = sale (subtract), -1 = refund (add back).
 * Formula: delta = -(direction × orderQty × item.qty / recipe.yieldQty)
 */
export function computeDepletion(
  recipe: RecipeWithItems,
  orderQty: number,
  direction: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const item of recipe.items) {
    const delta = -direction * orderQty * item.qty / recipe.yieldQty;
    deltas.set(item.ingredientId, delta);
  }
  return deltas;
}

/**
 * computeModifierDepletion — pure function mirroring computeDepletion for modifier-driven rules.
 * Returns a Map of ingredientId → stock delta (negative = subtract, positive = add back).
 * direction: +1 = sale (subtract), -1 = refund (add back).
 * Formula: delta = -(direction × orderQty × rule.delta) — NO yieldQty divisor (D-01: modifier
 * deltas are absolute-per-line, unlike recipe qty which is yield-scaled).
 */
export function computeModifierDepletion(
  rules: ModifierInventoryRule[],
  orderQty: number,
  direction: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const rule of rules) {
    const delta = -direction * orderQty * rule.delta;
    deltas.set(rule.ingredientId, (deltas.get(rule.ingredientId) ?? 0) + delta);
  }
  return deltas;
}

/**
 * Checks if a promotion is currently active — COSMETIC / DISPLAY-ONLY.
 *
 * Mirrors the server-side `is_promotion_available()` PL/pgSQL evaluator (see
 * 20-RESEARCH.md Pattern 1): `promotion.isActive === false` is always inactive;
 * zero availability windows means always-active; otherwise the current day
 * (ISO day-of-week, 1=Mon..7=Sun) and time (and optional date range) must fall
 * inside at least one window.
 *
 * THIS HELPER MUST NEVER BE USED TO COMPUTE A CHARGED PRICE. It exists only for
 * read-only UI affordances (e.g. the "Active Promotions" banner) — the value it
 * returns must never feed a mutation payload sent to `create_order_with_items`.
 * `evaluate_promotions_for_item` (server) is the sole authority for the charged
 * `unit_price` (see 20-RESEARCH.md Pitfall 1).
 *
 * @param promotion - The promotion to check
 * @param windows - The promotion's availability windows (empty = always available)
 * @param currentTime - Optional time to check (defaults to now)
 * @returns True if the promotion is active right now
 *
 * @example
 * // No windows configured — always active (while isActive is true)
 * isPromotionActive(promotion, [])
 * // Returns: true
 *
 * @example
 * // Outside every configured window — inactive
 * isPromotionActive(promotion, [{ daysOfWeek: [1], startTime: '16:00', endTime: '18:00', ... }], new Date('2024-01-08T20:00:00'))
 * // Returns: false (2024-01-08 is a Monday, but 20:00 is outside 16:00-18:00)
 */
export function isPromotionActive(
  promotion: Promotion,
  windows: PromotionAvailability[],
  currentTime: Date = new Date()
): boolean {
  if (!promotion.isActive) return false;
  if (windows.length === 0) return true;

  // Convert JS day (0=Sun) to ISO day (1=Mon..7=Sun), matching is_promotion_available's EXTRACT(ISODOW).
  const jsDay = currentTime.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const hh = String(currentTime.getHours()).padStart(2, '0');
  const mm = String(currentTime.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const day = String(currentTime.getDate()).padStart(2, '0');
  const dateStr = `${String(year)}-${month}-${day}`;

  for (const window of windows) {
    if (!window.daysOfWeek.includes(isoDay)) continue;
    if (window.startTime != null && timeStr < window.startTime.slice(0, 5)) continue;
    if (window.endTime != null && timeStr > window.endTime.slice(0, 5)) continue;
    if (window.startDate != null && dateStr < window.startDate) continue;
    if (window.endDate != null && dateStr > window.endDate) continue;
    return true;
  }

  return false;
}
