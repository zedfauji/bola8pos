/**
 * P11: Sequential-Compounding Promotion Pricing Property Tests
 *
 * Covers the unit cases from 20-03-PLAN.md's <behavior> block plus the P11
 * fast-check property:
 *   - applyPromotionStack(basePrice, []) === basePrice
 *   - single 'percentage'/'fixed_amount'/'fixed_price' cases
 *   - order-independence within a priority group of commutative ops:
 *     * fixed_amount-only chains (any length) are always order-independent —
 *       subtraction is commutative/associative and the GREATEST(0, ...) clamp
 *       is idempotent once reached, regardless of how many operations remain.
 *     * percentage-only PAIRS (length 2) with integer base/discount values are
 *       order-independent — with integer inputs the first application in
 *       either order is always exact to 2 decimals (no rounding drift), so
 *       the single rounding step at the end operates on the same underlying
 *       real number regardless of order. (Chains longer than 2 percentage
 *       ops round at every intermediate step per the SQL's money-drift guard,
 *       so order-independence is NOT guaranteed beyond a pair — this mirrors
 *       the SQL's actual, intentional per-step rounding behavior.)
 *   - applyPromotionStack never returns a negative number
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { PromotionDiscountType } from './domain';
import { applyPromotionStack } from './promotion-pricing';

describe('applyPromotionStack: unit cases', () => {
  it('returns basePrice unchanged when promos is empty', () => {
    expect(applyPromotionStack(100, [])).toBe(100);
  });

  it('applies a single percentage discount (20% off 100 -> 80)', () => {
    expect(applyPromotionStack(100, [{ discountType: 'percentage', discountValue: 20 }])).toBe(80);
  });

  it('compounds a fixed_amount discount against the running (already-discounted) price', () => {
    // 100 -> 20% off -> 80 -> 10 fixed_amount off -> 70
    const result = applyPromotionStack(100, [
      { discountType: 'percentage', discountValue: 20 },
      { discountType: 'fixed_amount', discountValue: 10 },
    ]);
    expect(result).toBe(70);
  });

  it('fixed_price resets the running price outright, regardless of prior discounts', () => {
    const result = applyPromotionStack(100, [
      { discountType: 'percentage', discountValue: 20 },
      { discountType: 'fixed_price', discountValue: 5 },
    ]);
    expect(result).toBe(5);
  });

  it('never returns a negative number (GREATEST(0, ...) parity with SQL)', () => {
    const result = applyPromotionStack(10, [{ discountType: 'fixed_amount', discountValue: 50 }]);
    expect(result).toBe(0);
  });
});

describe('P11: sequential-compounding order-independence property', () => {
  it('P11a: fixed_amount-only chains of any length are order-independent, non-negative, and 2-decimal rounded', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 0, maxLength: 8 }),
        (base, amounts) => {
          const basePrice = Math.round(base * 100) / 100;
          const promos = amounts.map(discountValue => ({
            discountType: 'fixed_amount' as PromotionDiscountType,
            discountValue,
          }));
          const shuffled = [...promos].reverse();

          const forward = applyPromotionStack(basePrice, promos);
          const reversed = applyPromotionStack(basePrice, shuffled);

          expect(forward).toBe(reversed);
          expect(forward).toBeGreaterThanOrEqual(0);
          expect(forward).toBe(Math.round(forward * 100) / 100);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('P11b: percentage-only pairs (integer base + integer discount values) are order-independent within 1 cent, non-negative, and 2-decimal rounded', () => {
    // Order-independence holds up to a single cent here rather than exactly:
    // multiplying by two percentage factors in different orders is the same
    // *real number* algebraically, but IEEE754 double rounding (JS numbers,
    // unlike Postgres NUMERIC's exact decimal arithmetic) can occasionally
    // land the very last `Math.round(x * 100) / 100` on either side of a
    // half-cent boundary depending on evaluation order. This is a known,
    // acceptable JS-float artifact of this pure client-side mirror — never a
    // billing concern, since evaluate_promotions_for_item (SQL NUMERIC) is
    // the sole billing authority and does not share this floating-point path.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (basePrice, d1, d2) => {
          const promos = [
            { discountType: 'percentage' as PromotionDiscountType, discountValue: d1 },
            { discountType: 'percentage' as PromotionDiscountType, discountValue: d2 },
          ];
          const reversed = [promos[1]!, promos[0]!];

          const forward = applyPromotionStack(basePrice, promos);
          const backward = applyPromotionStack(basePrice, reversed);

          // 0.011 (not 0.01) tolerates float epsilon on top of the 1-cent bound.
          expect(Math.abs(forward - backward)).toBeLessThanOrEqual(0.011);
          expect(forward).toBeGreaterThanOrEqual(0);
          expect(forward).toBe(Math.round(forward * 100) / 100);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('P11c: applyPromotionStack never returns a negative number for arbitrary mixed stacks', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
        fc.array(
          fc.record({
            discountType: fc.constantFrom<PromotionDiscountType>('percentage', 'fixed_amount', 'fixed_price'),
            discountValue: fc.float({ min: Math.fround(0), max: Math.fround(200), noNaN: true }),
          }),
          { minLength: 0, maxLength: 6 }
        ),
        (base, promos) => {
          const basePrice = Math.round(base * 100) / 100;
          const result = applyPromotionStack(basePrice, promos);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 300 }
    );
  });
});
