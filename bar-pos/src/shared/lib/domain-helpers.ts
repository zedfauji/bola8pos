/**
 * DOMAIN HELPERS
 *
 * Pure functions that compute derived values from domain entities.
 * No side effects. No async. No Supabase calls. Fully testable.
 */

import type {
  Category,
  CartItem,
  Order,
  PoolSessionSummary,
  Product,
  DiscountScope,
  DiscountType,
  RecipeWithItems,
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
 * Resolves the effective price for a product, considering happy hour.
 *
 * Returns happy hour price if:
 * - Current time is within category.happyHourStartâ€“happyHourEnd
 * - product.happyHourPrice is not null
 *
 * Falls back to product.basePrice otherwise.
 *
 * @param product - The product to price
 * @param category - The product's category (contains happy hour times)
 * @param currentTime - Optional time to check (defaults to now)
 * @returns The effective price
 *
 * @example
 * // 5pm price with happy hour 4pm-6pm â†’ returns happyHourPrice
 * resolveProductPrice(product, category, new Date('2024-01-01T17:00:00'))
 *
 * @example
 * // 8pm price â†’ returns basePrice
 * resolveProductPrice(product, category, new Date('2024-01-01T20:00:00'))
 */
export function resolveProductPrice(
  product: Product,
  category: Category,
  currentTime: Date = new Date()
): number {
  // If no happy hour configured or no happy hour price, return base price
  if (!category.happyHourStart || !category.happyHourEnd || product.happyHourPrice === null) {
    return product.basePrice;
  }

  // Check if currently in happy hour
  if (isHappyHourActive(category, currentTime)) {
    return product.happyHourPrice;
  }

  return product.basePrice;
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
 * Checks if happy hour is currently active for a category.
 *
 * Handles midnight crossing (e.g., 10pm - 2am).
 *
 * @param category - The category with happy hour times
 * @param currentTime - Optional time to check (defaults to now)
 * @returns True if happy hour is active
 *
 * @example
 * // Check if 5pm is within 4pm-6pm happy hour
 * isHappyHourActive(category, new Date('2024-01-01T17:00:00'))
 * // Returns: true
 *
 * @example
 * // Check if 8pm is within 4pm-6pm happy hour
 * isHappyHourActive(category, new Date('2024-01-01T20:00:00'))
 * // Returns: false
 *
 * @example
 * // Midnight crossing: 11pm is within 10pm-2am happy hour
 * isHappyHourActive(category, new Date('2024-01-01T23:00:00'))
 * // Returns: true
 */
export function isHappyHourActive(category: Category, currentTime: Date = new Date()): boolean {
  if (!category.happyHourStart || !category.happyHourEnd) {
    return false;
  }

  // Parse time strings (HH:MM format)
  const startParts = category.happyHourStart.split(':').map(Number);
  const endParts = category.happyHourEnd.split(':').map(Number);

  const startHour = startParts[0] ?? 0;
  const startMin = startParts[1] ?? 0;
  const endHour = endParts[0] ?? 0;
  const endMin = endParts[1] ?? 0;

  // Convert current time to minutes since midnight
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle midnight crossing (e.g., 22:00 - 02:00)
  if (endMinutes < startMinutes) {
    // Happy hour crosses midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Normal case (e.g., 16:00 - 18:00)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
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
