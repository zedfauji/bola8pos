import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { computeDepletion } from '@shared/lib/domain-helpers';

// RecipeWithItems will be used in Plan 04-06 when todo tests are filled in
// fc and computeDepletion suppressed until Plan 04-06 fills in the tests
void fc; void computeDepletion;

describe('computeDepletion', () => {
  it.todo('sale direction returns negative deltas (stock decreases)');
  it.todo('refund direction returns positive deltas (stock increases)');
  it.todo('empty recipe items returns empty map');
  it.todo('orderQty=2 doubles the delta for each ingredient');
  it.todo('yieldQty=2 halves the delta for each ingredient');

  describe('P6 property test: random recipe × random order qty → correct delta sum', () => {
    it.todo('sum of abs(deltas) equals orderQty × sum(item.qty) / yieldQty');
  });
});
