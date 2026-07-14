---
sprint: S3c
title: Kitchen Prep + Cocktails Coverage
duration: 2 weeks
tokens: 95k ± 15k
depends_on: [S3b]
unlocks: []
status: blocked_on_S3b
---

# S3c — Kitchen Prep + Cocktails

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Enable chef-side batch production: chef produces N portions of a prep (e.g. Salsa Mexicana) which writes +N prep-ingredient and consumes raw ingredients. Prep ingredients are then consumed by menu item recipes like any other ingredient. Also ship the chef-facing UI at `/kitchen-prep`.

Cocktails (Michelada etc.) already work in S3b as products-with-recipes. This sprint extends them only if their recipe includes a prep item (e.g. pre-batched mixer).

## Scope

### In
1. `prep_productions` table + trigger that writes movements on insert
2. Enforce `ingredients.is_prep = true` requirement for prep batches (via CHECK trigger)
3. `/kitchen-prep` page (new route)
4. Chef prep production form with raw-ingredient impact preview
5. Prep ingredient filter throughout ingredient UI (chef-hat badge)
6. Reports: "Prep on hand" and "Raw impact of latest prep" surfaces
7. Property test P7 (prep double-count guard)
8. E2E spec `21-prep.spec.ts`
9. Michelada extension: Michelada mix prep + cocktail uses it

### Out
- Per-batch COGS variance (C3 deferred)
- Prep expiry tracking (future)

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S3c-01 | Migration: prep_productions table | migration | S |
| S3c-02 | Trigger: on prep_productions insert → ledger movements (self + raw consumption if prep has recipe) | migration | M |
| S3c-03 | Trigger: prep_productions.prep_ingredient_id must reference is_prep=true ingredient | migration | S |
| S3c-04 | Zod: PrepProductionSchema in domain.ts | domain.ts | S |
| S3c-05 | Entity: `src/entities/prep/` | new FSD slice | M |
| S3c-06 | Feature: `src/features/produce-prep-batch/` | new FSD slice | L |
| S3c-07 | Page: `src/pages/KitchenPrepPage.tsx` | new page | M |
| S3c-08 | Route registration + nav tile on Home | router + HomePage | S |
| S3c-09 | ChefHatBadge shared/ui | story | XS |
| S3c-10 | Prep batch preview panel (raw consumption preview) | feature UI | M |
| S3c-11 | Ingredient list filter/badge: prep vs raw | `src/widgets/IngredientsTable/` | S |
| S3c-12 | Property test P7 | `prep.test.ts` | M |
| S3c-13 | Integration test: sell menu item that consumes prep → prep qty drops | test | M |
| S3c-14 | E2E `21-prep.spec.ts` | e2e | M |
| S3c-15 | Seed: Michelada mix prep + recipe; Salsa Mexicana prep + Alitas-salsa uses Salsa portion | `scripts/seed-prep.ts` | S |
| S3c-16 | RBAC: chef role alias (treat as manager) — add to rbac.ts if needed | `src/shared/lib/rbac.ts` | XS |

## Trigger behavior — `prep_productions` insert

```
on insert into prep_productions:
  1. Verify ingredients.is_prep = true for prep_ingredient_id (raise if not)
  2. Call record_stock_movement(
       prep_ingredient_id,
       +NEW.qty_produced,
       'prep_production',
       'prep_production',
       NEW.id
     )
  3. If recipes row exists for product_id corresponding to prep (note: preps don't have product_id — extend model):
     For each recipe_item of the prep's recipe:
       record_stock_movement(
         ingredient_id,
         -(NEW.qty_produced × recipe_item.qty / yield_qty),
         'prep_consumption',
         'prep_production',
         NEW.id
       )
```

**Modeling note:** Preps don't fit the `recipes(product_id)` shape cleanly (they're ingredients, not products). Two options:
1. **Extend `recipes`** to allow either `product_id` XOR `prep_ingredient_id` as owner (recommended)
2. **Separate `prep_recipes` table** (duplicates the schema — rejected)

Go with option 1. Migration adds `recipes.prep_ingredient_id` nullable, adds CHECK `exactly one of (product_id, prep_ingredient_id) is set`, drops PK, adds unique on each.

## UI flow

```
/kitchen-prep
  Header: "Prep on hand"
  Grid of prep ingredients (chef-hat badge) showing current quantity_on_hand + reorder point
  CTA: "New batch" button
    → PrepProductionForm (Dialog or Sheet)
      - Select prep ingredient (autocomplete filtered to is_prep=true)
      - Qty produced + uom display
      - Notes textarea
      - Preview panel: "This batch will consume from inventory:"
        Live list of raw ingredients (red if negative after)
      - Confirm → insert prep_productions row (trigger does the rest)
  Below: recent productions list with filters
```

## Testing

### Unit
- Trigger fires exactly once per insert
- Consumption amounts match recipe × qty / yield

### Property P7
- For random prep batches, total positive ledger movements for the prep ingredient = sum of qty_produced
- No double-counting: only one positive row per prep_productions.id

### Integration
- Prep with no recipe: only +prep row
- Prep with recipe: +prep row + N consumption rows
- Sell menu item that uses Salsa portion → prep quantity_on_hand drops
- Produce 20 Salsa portions with only 1kg tomato in stock (recipe needs 2kg) → blocked

### E2E `21-prep.spec.ts`
1. Seed: Salsa Mexicana (is_prep=true), recipe = 100g tomato + 10g onion per portion; tomato 2000g, onion 300g
2. Chef produces 10 Salsa portions → tomato −1000, onion −100, salsa +10
3. Bartender sells 3 Alitas (Alitas recipe = 750g wings + 1 salsa) → salsa goes from 10 to 7
4. Attempt to produce 10 more salsa with only 1000g tomato (need 1000g) → succeeds at edge; attempt 11 → blocked
5. Manager-PIN override to produce 11 → audit_log row + negative tomato visible

## Definition of Done

- [ ] Migrations applied including recipes table extension
- [ ] Triggers tested in isolation
- [ ] `/kitchen-prep` route live, RBAC enforced
- [ ] Home page tile added for kitchen prep (manager+)
- [ ] Michelada mix prep + Michelada cocktail seeded; manually ordered and verified
- [ ] Salsa prep + Alitas integration verified
- [ ] Property test P7 green
- [ ] `21-prep.spec.ts` green
- [ ] Existing E2E regressions checked (`10-inventory`)
- [ ] typecheck + lint clean
- [ ] Chef role handled (alias to manager)

## Risks

| Risk | Mitigation |
|---|---|
| Recipe table extension breaks S3b recipe editor | Test both paths (product-owned + prep-owned) before commit; keep editor UI separate for each owner type |
| Trigger recursion (prep of prep of prep) | Depth-limit at 2 levels via guard in trigger; reject beyond |
| Chef accidentally produces wrong prep | Confirm dialog with raw consumption preview; no destructive consequence (reverse via negative correction movement) |

## Notes

- Do **not** build a separate "manufacturing module" or "BOM explosion" library. It's all one ledger with one RPC.
- Michelada: it's a product (order_item) with a recipe pulling {beer bottle × 1, Michelada_mix × 200ml}. The Michelada_mix is a prep. That's it. No special case.
