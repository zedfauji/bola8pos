---
sprint: S3b
title: Recipes + Sale Depletion
duration: 2 weeks
tokens: 130k ± 20k
depends_on: [S3a]
unlocks: [S3c, S4]
status: blocked_on_S3a
---

# S3b — Recipes & Sale Depletion

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Wire the stock ledger into the order flow. Selling an item with a recipe depletes all mapped ingredients atomically. Cocktails (Michelada) work for free because they're just products with recipes.

## Scope

### In
1. `recipes` + `recipe_items` tables
2. `deplete_for_order_item(order_item_id)` RPC — called from existing order-item insertion path
3. Recipe editor UI (tab on product detail page)
4. Ingredient autocomplete component
5. Negative-stock guard with admin override + audit log
6. Integration into existing `add-item-to-tab` mutation pipeline
7. Refund/void ledger reversal contract (used by S4)
8. Property tests P6 (depletion math)
9. E2E spec `20-recipes.spec.ts`

### Out
- Prep ingredients (S3c)
- Chef portioning UI (S3c)
- Refund UI (S4 — but contract must be ready here)

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S3b-01 | Migration: recipes + recipe_items | migration | S |
| S3b-02 | RPC `deplete_for_order_item(p_order_item_id, p_direction smallint)` | migration (pl/pgsql) | L |
| S3b-03 | Extend order-item insert edge function to call deplete_for_order_item after insert | edge function | M |
| S3b-04 | Extend void-order to reverse depletion | `src/features/void-order/` | M |
| S3b-05 | Zod schemas: RecipeSchema, RecipeItemSchema | domain.ts | S |
| S3b-06 | Entity: `src/entities/recipe/` | model + ui | M |
| S3b-07 | Feature: `src/features/manage-recipe/` (editor tab on product detail) | new FSD slice | L |
| S3b-08 | `IngredientAutocomplete` shared/ui (shadcn Command wrapper) | `src/shared/ui/IngredientAutocomplete/` + story | M |
| S3b-09 | Product detail page: Recipe tab + depletion preview panel | `src/pages/ProductDetail/` | M |
| S3b-10 | Negative-stock handling: error toast + manager-PIN override flow | `src/features/override-negative-stock/` | M |
| S3b-11 | Integration tests: add-item-to-tab → verify ledger deltas | tests | L |
| S3b-12 | Property test P6 | `depletion.test.ts` | M |
| S3b-13 | E2E `20-recipes.spec.ts` | `e2e/20-recipes.spec.ts` | M |
| S3b-14 | Seed recipes: Michelada, Alitas, Hotdog, 2-3 food items | `scripts/seed-recipes.ts` | S |

## RPC contract — `deplete_for_order_item`

```
deplete_for_order_item(
  p_order_item_id uuid,
  p_direction smallint  -- +1 for sale (subtract), -1 for refund/void (add back)
) returns void

Behavior (transactional, called within order insertion or void):
  1. Read order_item → product_id, qty
  2. Read recipe(product_id); if none → return early (no depletion)
  3. For each recipe_item:
     delta = -p_direction × (qty × recipe_item.qty / recipe.yield_qty)
     call record_stock_movement(
       ingredient_id,
       delta,
       CASE WHEN p_direction=+1 THEN 'sale' WHEN p_direction=-1 THEN 'refund' END,
       'order_item',
       p_order_item_id
     )
  4. If record_stock_movement raises INVENTORY_NEGATIVE:
     - if sale path: bubble error → transaction rolls back → UI shows stock failure
     - admin override path: caller retries with allow_negative flag (not part of this RPC; managed by feature layer)

Idempotency:
  Because record_stock_movement is keyed by (order_item, ingredient), calling twice = no-op.
```

## Negative stock override flow

1. Add-to-tab fails with `INVENTORY_NEGATIVE`
2. Toast: "Ingredient X out of stock. Manager PIN to override."
3. Manager PIN modal (existing)
4. On approval: caller invokes a separate `record_stock_movement_with_override` helper that temporarily allows negative + writes `audit_log` row
5. Negative inventory is visible as red in the ledger view

**Do not quietly skip depletion on out-of-stock.** Out-of-stock must block the sale unless manager approves.

## UI — Recipe editor

```
Product Detail Page (existing) → new "Recipe" tab
  Header: "1 serving consumes..."
  Table rows:
    [IngredientAutocomplete] [Qty input] [UOM display] [x remove]
  Footer: [+ Add ingredient]  yield_qty input (default 1)
  Side panel: "Selling 1 [product] will deplete:"
    - listed live as user edits
    - warns on any ingredient with current stock < implied qty
```

## Testing

### Unit
- `computeDepletion(recipe, order_qty)` returns exact map `{ingredient_id: delta}`
- Idempotency: double-insert order item → one ledger row per ingredient (not two)
- Reversal: void order → movements sum to zero

### Property P6
For random recipe (N ingredients, each with random qty and yield) and random order qty:
- sum of deltas for ingredient X = `-order_qty × recipe_qty_X / yield`
- reversal (direction=-1) produces the exact additive inverse

### Integration
- Add beer with no recipe → no ledger rows
- Add Alitas → 2 ledger rows (wings + salsa) with correct deltas
- Void Alitas order → 2 positive ledger rows (refund reason)
- Add Alitas when wings < needed → fails with toast; manager PIN → succeeds; audit_log row present

### E2E (`20-recipes.spec.ts`)
1. Admin creates recipe for Alitas: 750g wings + 1 salsa
2. Seed ingredients: wings=10kg, salsa=50 portions
3. Bartender sells 5 Alitas → ledger shows wings −3750g, salsa −5
4. Void 2 of them → ledger shows wings +1500g, salsa +2
5. Attempt to sell 20 Alitas (only ~6 worth of wings left) → blocked with toast
6. Manager PIN override → succeeds; audit_log recorded; wings goes negative (visible red)

## Definition of Done

- [ ] Migrations applied; types regenerated
- [ ] `deplete_for_order_item` RPC unit-tested in isolation
- [ ] Order insertion edge function calls depletion in the same transaction (verify rollback on failure)
- [ ] Void-order reversal tested
- [ ] Recipe editor usable; autocomplete works against seeded ingredients
- [ ] Property test P6 green
- [ ] `20-recipes.spec.ts` green
- [ ] Existing E2E regressions checked (especially `03-tab-order`, `10-inventory`)
- [ ] Michelada recipe seeded (beer + lime + clamato + salt) — manually test order
- [ ] Alitas recipe seeded — manually test order + void
- [ ] typecheck + lint clean

## Risks

| Risk | Mitigation |
|---|---|
| Depletion inside order-insertion transaction slows order creation | Benchmark; if >200ms, move to post-commit trigger with eventual consistency (fallback plan) |
| Recipe change after sale causes retro-active mismatch | Ledger stores literal deltas at time of sale; recipe updates don't affect historical rows |
| Fractional quantities cause rounding | Use numeric throughout; truncate display only, store full precision |
| Combo children also try to deplete | Combos don't have recipes themselves; children do. Parent deletion = no-op. Confirm with test |

## Notes

- The "combo consumes child recipes" question: parent combo has no recipe (is_combo=true, no recipes row). Each child has its own recipe and depletes normally on insert. **No special-casing needed.**
- Write the reversal contract carefully — S4 refund depends on it.
