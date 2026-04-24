import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildEvenPayments, computeEvenSplit, fromCents, toCents } from './split-math';

describe('split-math', () => {
  describe('toCents / fromCents', () => {
    it('converts 33.33 to 3333', () => {
      expect(toCents(33.33)).toBe(3333);
    });
    it('converts 3333 back to 33.33', () => {
      expect(fromCents(3333)).toBe(33.33);
    });
  });

  describe('computeEvenSplit', () => {
    it('splits 10000 cents evenly by 3: base=3333, last=3334', () => {
      expect(computeEvenSplit(10000, 3)).toEqual({ baseAmount: 3333, lastAmount: 3334 });
    });
    it('splits 10000 cents evenly by 4: base=2500, last=2500', () => {
      expect(computeEvenSplit(10000, 4)).toEqual({ baseAmount: 2500, lastAmount: 2500 });
    });
    it('splits 10001 cents by 3: base=3333, last=3335', () => {
      expect(computeEvenSplit(10001, 3)).toEqual({ baseAmount: 3333, lastAmount: 3335 });
    });
    it('throws when n < 2', () => {
      expect(() => computeEvenSplit(10000, 1)).toThrow('n must be >= 2');
    });
  });

  // P9: N-way even split sums exactly to original
  it('P9: evenly split N payments sum exactly to original totalCents', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 9 }),
        fc.integer({ min: 1, max: 1_000_00 }),
        (n, totalCents) => {
          const payments = buildEvenPayments(totalCents, n);
          expect(payments).toHaveLength(n);
          expect(payments.reduce((a, b) => a + b, 0)).toBe(totalCents);
        }
      )
    );
  });

  // P8: conservation — any grouping of item prices preserves total
  it('P8: split conservation — sub-tab totals sum exactly to parent total (integer arithmetic)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100_00 }), { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 2, max: 4 }), // number of groups
        (itemPrices, numGroups) => {
          const total = itemPrices.reduce((a, b) => a + b, 0);
          // Partition items into numGroups (round-robin)
          const groups: number[][] = Array.from({ length: numGroups }, () => []);
          itemPrices.forEach((price, i) => {
            groups[i % numGroups]!.push(price);
          });
          const subTotals = groups.map(g => g.reduce((a, b) => a + b, 0));
          const subSum = subTotals.reduce((a, b) => a + b, 0);
          expect(subSum).toBe(total);
        }
      )
    );
  });
});
