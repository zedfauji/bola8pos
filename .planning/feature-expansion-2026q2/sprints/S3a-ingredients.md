---
sprint: S3a
title: Ingredient Foundation + Unified Ledger
duration: 2 weeks
tokens: 95k ± 15k
depends_on: [S1]
unlocks: [S3b]
status: blocked_on_S1
---

# S3a — Ingredient Foundation

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Build the ingredient entity and the canonical stock movement RPC. **No depletion logic yet** — sales don't touch ingredients until S3b. This is the foundation that every downstream recipe/prep feature builds on. Get the ledger right before anything writes to it.

## Scope

### In
1. `ingredients` table (with `is_prep` flag reserved for S3c)
2. `record_stock_movement(...)` RPC (atomic insert + quantity update)
3. Idempotency index on `stock_movements (ref_type, ref_id, ingredient_id)` for reasons in `('sale','refund','void','prep_production','prep_consumption')`
4. UOM conversion utility (`src/shared/lib/uom.ts`)
5. Ingredient admin UI (list, create, edit, CSV import)
6. Per-ingredient stock movements list (read-only ledger view)
7. Manual adjustment flow (waste, correction, physical count)
8. Property tests P4 (ledger invariant) + P5 (UOM round-trip)

### Out
- Auto-depletion on sale (S3b)
- Prep productions (S3c)
- Recipes (S3b)
- Ingredient-level RLS changes beyond venue scoping

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S3a-01 | Migration: ingredients table + CHECK constraints + indexes | migration | M |
| S3a-02 | Migration: idempotency unique index on stock_movements | migration | S |
| S3a-03 | RPC `record_stock_movement` (pl/pgsql, SECURITY DEFINER) | migration | M |
| S3a-04 | Zod: `IngredientSchema`, `StockMovementSchema`, `UomSchema`, `ReasonSchema` in domain.ts | `src/shared/lib/domain.ts` | S |
| S3a-05 | UOM library `src/shared/lib/uom.ts` — base/purchase/factor conversions | shared/lib + tests | M |
| S3a-06 | Entity: `src/entities/ingredient/` | model/types, model/queries, ui | M |
| S3a-07 | Feature: `src/features/manage-ingredients/` CRUD | new FSD slice | L |
| S3a-08 | Feature: `src/features/import-ingredients-csv/` | new FSD slice | M |
| S3a-09 | Feature: `src/features/adjust-stock-movement/` (manual waste/correction/count) | new FSD slice | M |
| S3a-10 | Widget: `StockMovementsList` (per-ingredient ledger) | `src/widgets/StockMovementsList/` | M |
| S3a-11 | Settings → Ingredients tab wiring | Settings page | S |
| S3a-12 | Property tests P4 + P5 | `ledger.test.ts`, `uom.test.ts` | M |
| S3a-13 | Unit tests for RPC idempotency behavior | integration tests | M |
| S3a-14 | Seed data: core ingredients (beer-premium, beer-regular, wings, salsa-ingredients, lime, clamato, etc.) | `scripts/seed-ingredients.ts` | S |

## RPC contract — `record_stock_movement`

```
record_stock_movement(
  p_ingredient_id uuid,
  p_delta numeric,           -- signed: +production/correction-up/refund-restock, -sale/waste
  p_reason text,             -- one of reason enum
  p_ref_type text,           -- 'order_item' | 'refund' | 'prep_production' | 'manual' | 'physical_count'
  p_ref_id uuid
) returns stock_movements

Behavior:
  1. Lock the ingredient row (SELECT ... FOR UPDATE)
  2. Compute new quantity_on_hand = current + p_delta
  3. If new < 0 AND p_reason NOT IN ('correction','physical_count'): raise INVENTORY_NEGATIVE
  4. Insert stock_movements row
  5. Update ingredients.quantity_on_hand = new
  6. Return the stock_movements row

Idempotency:
  UNIQUE (ref_type, ref_id, ingredient_id) WHERE reason IN ('sale','refund','void','prep_production','prep_consumption')
  → duplicate insert becomes a no-op (ON CONFLICT DO NOTHING wrapper in caller)
```

## CSV import format

```csv
name,base_uom,purchase_uom,purchase_to_base_factor,cost_per_base_unit,reorder_point,category,is_prep
Tomato,g,kg,1000,0.012,2000,produce,false
Salsa Mexicana,portion,,1,0.50,20,prep,true
Corona 355ml,unit,case_24,24,12.50,48,beer-regular,false
```

Validate each row with Zod; return a summary (N imported, M failed with reasons). Stage-and-confirm UX.

## Testing

### Unit
- UOM conversions: g↔kg, ml↔L, unit↔case with arbitrary factors
- `uom.ts`: `convertBase(qty, from, to)` symmetric within 1e-9
- Idempotent RPC: calling twice with same `(ref_type, ref_id, ingredient_id)` yields one row

### Property
- **P4** (ledger invariant): for N random movements on an ingredient, `sum(stock_movements.delta) = ingredients.quantity_on_hand` always
- **P5** (UOM round-trip): `from_base(to_base(x, uom), uom) ≈ x` for random x, uom

### Integration
- CSV import: valid rows inserted; invalid rows reported; partial-failure leaves DB consistent
- Manual adjustment: creates movement + updates qty; reason shows in ledger view

## Definition of Done

- [ ] Migrations applied; types regenerated
- [ ] `record_stock_movement` RPC tested in isolation
- [ ] UOM library documented with examples in a comment block at top of file
- [ ] Ingredient CRUD working in Tauri dev build
- [ ] CSV import successful with 20+ row sample file
- [ ] P4 + P5 property tests green
- [ ] Typecheck + lint clean
- [ ] No existing test regressions
- [ ] Seed data present; core ingredients exist in dev DB
- [ ] RLS verified: bartender can read, manager can create/adjust, admin can delete

## Risks

| Risk | Mitigation |
|---|---|
| Idempotency index conflict with backfilled rows | Backfill old inventory_log → stock_movements with `ref_type='legacy'`; legacy reason values excluded from unique index |
| Row-lock contention on hot ingredients | Lock is brief; RPC is fast; acceptable for single-venue |
| UOM conversion edge cases (0.5 kg → 500.00000001 g) | Use numeric, not float; assert within epsilon 1e-6 in tests |
| CSV import charcter encoding | Require UTF-8; document in help text |

## Notes

- Do not attempt auto-depletion in this sprint even if tempting. Keep the contract tight: this sprint only adds the ability to record movements; S3b wires them to sales.
- `is_prep` flag is added here but unused until S3c.
