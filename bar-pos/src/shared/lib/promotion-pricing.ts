import type { PromotionDiscountType } from './domain';

/**
 * applyPromotionStack — CLIENT-SIDE COSMETIC/PREVIEW + PROPERTY-TEST MIRROR ONLY.
 *
 * This pure function mirrors the sequential-compounding math implemented in
 * `evaluate_promotions_for_item()` (supabase/migrations/20260710000004_evaluate_promotions_rpc.sql)
 * EXACTLY: same CASE semantics per discount_type, same per-step
 * `Math.round(x * 100) / 100` rounding, same `Math.max(0, ...)` clamp, and
 * the same `fixed_price` reset behavior (does not compound against the
 * running price).
 *
 * `evaluate_promotions_for_item` (SQL, SECURITY DEFINER) is the SOLE BILLING
 * AUTHORITY — the server overwrites `order_items.unit_price` for any
 * promotion-eligible item, ignoring whatever value the client sends. This
 * function must NEVER be used to compute a value that is submitted to
 * `create_order_with_items`; it exists only for:
 *   (a) an optional cosmetic client-side price preview, and
 *   (b) the P11 property test guarding the two implementations against
 *       silent drift (see 20-RESEARCH.md Pitfall 1, 20-09-PLAN.md parity gate).
 */
export function applyPromotionStack(
  basePrice: number,
  promos: { discountType: PromotionDiscountType; discountValue: number }[]
): number {
  let runningPrice = basePrice;

  for (const promo of promos) {
    switch (promo.discountType) {
      case 'percentage':
        runningPrice = Math.max(0, Math.round(runningPrice * (1 - promo.discountValue / 100) * 100) / 100);
        break;
      case 'fixed_amount':
        runningPrice = Math.max(0, Math.round((runningPrice - promo.discountValue) * 100) / 100);
        break;
      case 'fixed_price':
        runningPrice = promo.discountValue;
        break;
    }
  }

  return runningPrice;
}
