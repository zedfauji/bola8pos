import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeDepletion } from '@shared/lib/domain-helpers';
import type { RecipeWithItems } from '@shared/lib/domain';

// Suppress unused import warnings — these will be used in Plan 04-06
void fc; void computeDepletion;
type _R = RecipeWithItems;

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
