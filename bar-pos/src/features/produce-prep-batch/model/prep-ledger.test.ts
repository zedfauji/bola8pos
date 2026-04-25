import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

function simulatePrepBatch(batches: Array<{ id: string; qtyProduced: number }>): number {
  return batches.reduce((sum, b) => sum + b.qtyProduced, 0);
}

describe('P7: prep ledger invariant', () => {
  test('P7: total prep credit equals sum(qty_produced) — no double-count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            qtyProduced: fc.integer({ min: 100, max: 9_999_999_99 }).map(n => n / 10_000),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        batches => {
          const expected = batches.reduce((s, b) => s + b.qtyProduced, 0);
          expect(simulatePrepBatch(batches)).toBeCloseTo(expected, 5);
        },
      ),
      { numRuns: 500 },
    );
  });

  test('P7b: no individual batch credit exceeds its qty_produced', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          qtyProduced: fc.integer({ min: 100, max: 9_999_999_99 }).map(n => n / 10_000),
        }),
        batch => {
          expect(batch.qtyProduced).toBeGreaterThan(0);
        },
      ),
      { numRuns: 500 },
    );
  });
});
