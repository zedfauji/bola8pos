---
phase: "04"
plan: "04-02"
subsystem: "Zod schemas + supabase.types.ts + Wave 0 test stubs"
tags: [zod, types, domain, test-stubs, supabase-types, recipes, depletion]
dependency_graph:
  requires: [04-01]
  provides: [RecipeSchema, RecipeItemSchema, RecipeWithItemsSchema, computeDepletion, supabase.types recipes/recipe_items/audit_log, Wave 0 test stubs]
  affects: [04-03-manage-recipes-ui, 04-04-sale-depletion-hook, 04-05-manage-recipes-feature, 04-06-integration-tests]
tech_stack:
  added: []
  patterns: [Zod schema inference, pure function domain helpers, supabase.types manual extension]
key_files:
  created:
    - bar-pos/src/shared/lib/depletion.test.ts
    - bar-pos/src/entities/tab/model/depletion.integration.test.ts
    - bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/domain-helpers.ts
    - bar-pos/src/shared/lib/supabase.types.ts
key-decisions:
  - "audit_log canonical columns confirmed: entity_type, entity_id, details (NOT target_type/target_id/payload) — matches add_combo_to_tab INSERT from migration"
  - "RecipeWithItems type import removed from depletion.test.ts stub — will be added back in Plan 04-06 when tests are filled in"
  - "deplete_for_order_item includes p_allow_negative? param now (pre-added for migration 004) to avoid second types edit"
  - "fast-check import must precede vitest import per import/order ESLint rule"
requirements-completed: [S3b-05]
metrics:
  duration: "~5 minutes"
  completed: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 04 Plan 02: Zod Schemas + supabase.types.ts Extension + Wave 0 Test Stubs Summary

**RecipeSchema family + computeDepletion pure function added to domain.ts/domain-helpers.ts; supabase.types.ts extended with recipes, recipe_items, audit_log (entity_type/entity_id/details), deplete_for_order_item; 3 Wave 0 test stub files created with 18 todo tests**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-04-24T21:56:32Z
- **Completed:** 2026-04-24T22:01:20Z
- **Tasks:** 3/3
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

- Recipe Zod schema family added to domain.ts: RecipeItemSchema, RecipeSchema, RecipeWithItemsSchema, RecipeCreateSchema, RecipeUpdateSchema, RecipeItemCreateSchema + 6 inferred types
- T-04-02 STRIDE mitigation: `z.number().positive()` on RecipeItemSchema.qty (mirrors DB CHECK qty > 0)
- computeDepletion(recipe, orderQty, direction) pure function added to domain-helpers.ts — returns Map<ingredientId, delta>
- supabase.types.ts manually extended: recipes, recipe_items, audit_log tables + deplete_for_order_item function
- audit_log columns confirmed as entity_type/entity_id/details (NOT target_type/target_id/payload)
- 3 Wave 0 test stub files created — all 18 todo tests appear as pending, 0 failures

## Task Commits

1. **Task 1: RecipeSchema family + computeDepletion** — `5f511d7` (feat)
2. **Task 2: supabase.types.ts extension** — `bda8d3e` (feat)
3. **Task 3: Wave 0 test stub files** — `0994a48` (test)
4. **Fix: import order + unused type alias in depletion.test.ts** — `abfb7b8` (fix, Rule 1)

## Zod Schemas Added

From `bar-pos/src/shared/lib/domain.ts` (appended after RefundSchema block):

| Schema | Description |
|--------|-------------|
| `RecipeItemSchema` | id, recipeId, ingredientId, qty (positive) |
| `RecipeSchema` | id, productId, yieldQty (positive), notes (nullable/optional), createdAt, updatedAt |
| `RecipeWithItemsSchema` | RecipeSchema extended with items: RecipeItemSchema[] |
| `RecipeCreateSchema` | RecipeSchema omit id/createdAt/updatedAt |
| `RecipeUpdateSchema` | RecipeSchema partial required(id) |
| `RecipeItemCreateSchema` | RecipeItemSchema omit id |

Types inferred: `Recipe`, `RecipeCreate`, `RecipeUpdate`, `RecipeItem`, `RecipeItemCreate`, `RecipeWithItems`

**Primitive names confirmed:** `UuidSchema`, `TimestampSchema` (both already existed in domain.ts with those exact casings)

## audit_log Column Confirmation

Confirmed from 04-01-SUMMARY.md and add_combo_to_tab migration INSERT:

```
CANONICAL: entity_type, entity_id, details, created_at, action, actor_id (nullable)
NOT: target_type, target_id, payload
```

supabase.types.ts audit_log.Row uses `entity_type`, `entity_id`, `details` — correctly matches migration schema.

## supabase.types.ts Extensions

- `recipes` table: Row/Insert/Update with product_id FK (isOneToOne: true → one recipe per product)
- `recipe_items` table: Row/Insert/Update with recipe_id FK
- `audit_log` table: Row/Insert with canonical columns; `Update: never` (append-only)
- `deplete_for_order_item` function: p_order_item_id, p_direction, p_allow_negative? (pre-added for migration 004)

## Wave 0 Test Stubs

All 3 files run without error. 18 todo tests across 3 files:

| File | Tests | Plans |
|------|-------|-------|
| `src/shared/lib/depletion.test.ts` | 6 todo (computeDepletion unit + P6 property) | 04-06 |
| `src/entities/tab/model/depletion.integration.test.ts` | 6 todo (S3b-03/04/07/10) | 04-06 |
| `src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx` | 6 todo (S3b-08) | 04-04 |

## Verification Results

```
typecheck: PASS (tsc --noEmit exits 0)
lint (files in scope): PASS (0 errors on modified/created files)
vitest run (3 stub files): PASS — 3 skipped, 18 todo
grep RecipeWithItemsSchema domain.ts: 2 matches
grep computeDepletion domain-helpers.ts: 2 matches
grep entity_type supabase.types.ts: 2 matches (Row + Insert)
```

Note: Pre-existing lint errors in PaymentPane.tsx and RefundsList/index.tsx are out-of-scope (existed before this plan, logged to deferred items).

## Decisions Made

- audit_log canonical columns confirmed: entity_type, entity_id, details (NOT target_type/target_id/payload)
- RecipeWithItems type import removed from depletion.test.ts stub — will be added back in Plan 04-06
- deplete_for_order_item includes p_allow_negative? param pre-added for migration 004
- fast-check import must precede vitest per import/order ESLint rule (alphabetical ordering of package imports)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused type alias and import order in depletion.test.ts**
- **Found during:** Task 3 verification (typecheck + lint)
- **Issue:** `type _R = RecipeWithItems` flagged as unused (TS noUnusedLocals); `fast-check` import after `vitest` violated import/order
- **Fix:** Removed unused type alias + RecipeWithItems import; reordered fast-check before vitest
- **Files modified:** `bar-pos/src/shared/lib/depletion.test.ts`
- **Commit:** `abfb7b8`

## Deferred Items

Pre-existing lint errors (out-of-scope, not caused by this plan):
- `bar-pos/src/widgets/PaymentPane/ui/PaymentPane.tsx` — import/order errors (pre-existing)
- `bar-pos/src/widgets/RefundsList/index.tsx` — unused eslint-disable directive (pre-existing)

## Known Stubs

Three test files are intentional stubs (all todo) — plan goal achieved. These stubs are targets for Plans 04-04 and 04-06.

## Threat Surface Scan

No new network endpoints. supabase.types.ts is a type-only file (no runtime behavior). No new trust boundaries introduced.

## Self-Check

Files created:
- bar-pos/src/shared/lib/depletion.test.ts — FOUND
- bar-pos/src/entities/tab/model/depletion.integration.test.ts — FOUND
- bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx — FOUND

Files modified:
- bar-pos/src/shared/lib/domain.ts — FOUND (RecipeWithItemsSchema at line 1572+)
- bar-pos/src/shared/lib/domain-helpers.ts — FOUND (computeDepletion at end)
- bar-pos/src/shared/lib/supabase.types.ts — FOUND (recipes/recipe_items/audit_log tables)

Commits:
- 5f511d7 (feat(04-02)) — FOUND
- bda8d3e (feat(04-02)) — FOUND
- 0994a48 (test(04-02)) — FOUND
- abfb7b8 (fix(04-02)) — FOUND

## Self-Check: PASSED
