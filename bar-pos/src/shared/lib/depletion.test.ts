import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RecipeWithItems, ModifierInventoryRule } from '@shared/lib/domain';
import { computeDepletion, computeModifierDepletion } from '@shared/lib/domain-helpers';

function makeRecipe(
  items: { ingredientId: string; qty: number }[],
  yieldQty = 1,
): RecipeWithItems {
  const now = new Date();
  return {
    id: 'r1',
    productId: 'p1',
    prepIngredientId: null,
    yieldQty,
    notes: null,
    createdAt: now,
    updatedAt: now,
    items: items.map((item, i) => ({ id: `ri${String(i)}`, recipeId: 'r1', ...item })),
  };
}

describe('computeDepletion', () => {
  it('returns negative deltas for sale (direction=+1)', () => {
    const recipe = makeRecipe([
      { ingredientId: 'beer', qty: 0.355 },
      { ingredientId: 'lime', qty: 0.5 },
    ]);
    const deltas = computeDepletion(recipe, 1, 1);
    expect(deltas.get('beer')).toBeCloseTo(-0.355);
    expect(deltas.get('lime')).toBeCloseTo(-0.5);
  });

  it('returns exact additive inverse for void (direction=-1)', () => {
    const recipe = makeRecipe([{ ingredientId: 'beer', qty: 0.355 }]);
    const sale = computeDepletion(recipe, 1, 1);
    const void_ = computeDepletion(recipe, 1, -1);
    expect((void_.get('beer') ?? 0) + (sale.get('beer') ?? 0)).toBeCloseTo(0);
  });

  it('returns empty Map for recipe with no items', () => {
    const recipe = makeRecipe([]);
    expect(computeDepletion(recipe, 1, 1).size).toBe(0);
  });

  it('scales linearly with orderQty', () => {
    const recipe = makeRecipe([{ ingredientId: 'wing', qty: 6 }]);
    const single = computeDepletion(recipe, 1, 1).get('wing') ?? 0;
    const triple = computeDepletion(recipe, 3, 1).get('wing') ?? 0;
    expect(triple).toBeCloseTo(single * 3);
  });

  it('yieldQty=2 halves the delta for each ingredient', () => {
    const single = makeRecipe([{ ingredientId: 'sauce', qty: 4 }], 1);
    const double = makeRecipe([{ ingredientId: 'sauce', qty: 4 }], 2);
    const singleDelta = computeDepletion(single, 1, 1).get('sauce') ?? 0;
    const doubleDelta = computeDepletion(double, 1, 1).get('sauce') ?? 0;
    expect(doubleDelta).toBeCloseTo(singleDelta / 2);
  });

  it('P6: sum of |deltas| equals orderQty × (Σitem.qty / yieldQty)', () => {
    const itemArb = fc.record({
      ingredientId: fc.uuid(),
      qty: fc.float({ min: Math.fround(0.001), max: Math.fround(100), noNaN: true }),
    });
    const recipeArb = fc.record({
      items: fc.array(itemArb, { minLength: 1, maxLength: 10 }),
      yieldQty: fc.float({ min: Math.fround(0.001), max: Math.fround(100), noNaN: true }),
    });
    const orderQtyArb = fc.float({ min: Math.fround(0.001), max: Math.fround(50), noNaN: true });

    fc.assert(
      fc.property(recipeArb, orderQtyArb, ({ items, yieldQty }, orderQty) => {
        const recipe = makeRecipe(items, yieldQty);
        const deltas = computeDepletion(recipe, orderQty, 1);
        const expectedSum = items.reduce(
          (acc, item) => acc + (orderQty * item.qty) / yieldQty,
          0,
        );
        const actualSum = Array.from(deltas.values()).reduce(
          (acc, d) => acc + Math.abs(d),
          0,
        );
        return Math.abs(actualSum - expectedSum) < 1e-6;
      }),
      { numRuns: 500 },
    );
  });
});

function makeRules(items: { ingredientId: string; delta: number }[]): ModifierInventoryRule[] {
  return items.map((item, i) => ({
    id: `mir${String(i)}`,
    modifierId: 'm1',
    ...item,
  }));
}

describe('computeModifierDepletion', () => {
  it('returns negative deltas for sale (direction=+1), scaled by orderQty (D-01)', () => {
    const rules = makeRules([{ ingredientId: 'lime', delta: 2 }]);
    const deltas = computeModifierDepletion(rules, 1, 1);
    expect(deltas.get('lime')).toBeCloseTo(-2);
  });

  it('returns exact additive inverse between sale and refund', () => {
    const rules = makeRules([{ ingredientId: 'lime', delta: 2 }]);
    const sale = computeModifierDepletion(rules, 3, 1);
    const refund = computeModifierDepletion(rules, 3, -1);
    expect((sale.get('lime') ?? 0) + (refund.get('lime') ?? 0)).toBeCloseTo(0);
  });

  it('scales linearly with orderQty', () => {
    const rules = makeRules([{ ingredientId: 'wing', delta: 6 }]);
    const single = computeModifierDepletion(rules, 1, 1).get('wing') ?? 0;
    const triple = computeModifierDepletion(rules, 3, 1).get('wing') ?? 0;
    expect(triple).toBeCloseTo(single * 3);
  });

  it('returns empty Map for an empty rules array', () => {
    expect(computeModifierDepletion([], 1, 1).size).toBe(0);
  });

  it('P6: sum of |deltas| equals orderQty × Σ|rule.delta| (no yield divisor)', () => {
    const ruleArb = fc.record({
      ingredientId: fc.uuid(),
      delta: fc
        .float({ min: Math.fround(0.001), max: Math.fround(100), noNaN: true })
        .map(v => (Math.random() < 0.5 ? -v : v))
        .filter(v => v !== 0),
    });
    const rulesArb = fc.array(ruleArb, { minLength: 1, maxLength: 10 });
    const orderQtyArb = fc.float({ min: Math.fround(0.001), max: Math.fround(50), noNaN: true });

    fc.assert(
      fc.property(rulesArb, orderQtyArb, (items, orderQty) => {
        const rules = makeRules(items);
        const deltas = computeModifierDepletion(rules, orderQty, 1);
        const expectedSum = items.reduce((acc, item) => acc + orderQty * Math.abs(item.delta), 0);
        const actualSum = Array.from(deltas.values()).reduce((acc, d) => acc + Math.abs(d), 0);
        return Math.abs(actualSum - expectedSum) < 1e-6;
      }),
      { numRuns: 500 },
    );
  });
});
