---
phase: 03-ingredient-foundation
plan: "03"
subsystem: entities
tags: [fsd, entity, tanstack-query, zod, ingredient, typescript]
dependency_graph:
  requires:
    - "03-02: IngredientSchema, UomSchema, ManualAdjustReasonSchema in domain.ts"
    - "03-01: ingredients + stock_movements DB tables"
  provides:
    - "entities/ingredient/index.ts — FSD public API barrel"
    - "entities/ingredient/model/types.ts — type re-exports from domain.ts"
    - "entities/ingredient/model/queries.ts — TanStack Query hooks + key factory"
    - "useIngredients, useIngredientsActive, useIngredient, useStockMovements exported"
    - "ingredientKeys query key factory with all/lists/detail/movements keys"
  affects:
    - "features/manage-ingredients (Wave 3 — imports from @entities/ingredient)"
    - "features/adjust-stock-movement (Wave 3 — imports useStockMovements)"
    - "widgets/ingredient-list (Wave 4 — imports useIngredients)"
tech_stack:
  added: []
  patterns:
    - "Pre-regen cast: const db = supabase as any with eslint-disable comment"
    - "FSD barrel: index.ts re-exports all public API from model/"
    - "IngredientSchema.parse() in mapIngredientRow for Zod validation at DB boundary"
    - "enabled guard pattern: enabled: id != null && id.length > 0"
    - "vi.mocked(supabase).from pattern for TanStack Query hook tests"
key_files:
  created:
    - bar-pos/src/entities/ingredient/index.ts
    - bar-pos/src/entities/ingredient/model/types.ts
    - bar-pos/src/entities/ingredient/model/queries.ts
    - bar-pos/src/entities/ingredient/model/queries.test.ts
  modified: []
decisions:
  - "mapMovementRow uses direct type cast (not StockMovementSchema.parse()) — existing StockMovementSchema has productId as required UUID; ingredient-only movements may have null product_id. Post-regen: update StockMovementSchema to make productId nullable and switch to schema.parse()."
  - "useIngredientsActive is an alias for useIngredients — returns only active ingredients for Phase 4 recipe autocomplete"
metrics:
  duration: "~18 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
requirements:
  - S3a-06
---

# Phase 03 Plan 03: Ingredient Entity FSD Slice Summary

**One-liner:** FSD `entities/ingredient/` slice created with TanStack Query hooks (`useIngredients`, `useIngredient`, `useIngredientsActive`, `useStockMovements`), `ingredientKeys` factory, and a Zod-validated row mapper — all exported via FSD-compliant barrel `index.ts`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | entities/ingredient/model/types.ts — type re-exports | 487d079 | bar-pos/src/entities/ingredient/model/types.ts |
| 2 | entities/ingredient/model/queries.ts + index.ts | 20f3b97 | bar-pos/src/entities/ingredient/model/queries.ts, bar-pos/src/entities/ingredient/index.ts |
| 3 | entities/ingredient/model/queries.test.ts — unit tests | 38227ba | bar-pos/src/entities/ingredient/model/queries.test.ts |

## Verification Results

- `npm run typecheck`: PASS (0 errors)
- `npm run lint`: PASS (0 errors, 0 warnings)
- `npx vitest run src/entities/ingredient/model/queries.test.ts`: PASS (4/4 tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import order lint errors in queries.ts and queries.test.ts**
- **Found during:** Task 2 and Task 3 ESLint verification
- **Issue:** `import/order` rule requires value imports before type imports from same module; `./queries` import must precede `./types` in test file
- **Fix:** Reordered imports to place value imports before type-only imports from the same path
- **Files modified:** `queries.ts`, `queries.test.ts`
- **Commit:** part of 20f3b97, 38227ba

**2. [Rule 1 - Bug] void expression arrow functions in waitFor() calls**
- **Found during:** Task 3 ESLint verification
- **Issue:** `@typescript-eslint/no-confusing-void-expression` flags `() => expect(...).toBe(true)` as returning void from shorthand arrow
- **Fix:** Added braces: `() => { expect(...).toBe(true); }` — consistent with project pattern
- **Files modified:** `queries.test.ts`
- **Commit:** 38227ba

**3. [Rule 1 - Bug] mapMovementRow cannot use StockMovementSchema.parse()**
- **Found during:** Task 2 implementation analysis
- **Issue:** Existing `StockMovementSchema` has `productId: UuidSchema` (required, non-nullable). Ingredient-only stock movements have `product_id = null` in DB. Using `StockMovementSchema.parse()` with `productId: null` would throw a Zod error at runtime.
- **Fix:** `mapMovementRow` uses direct type cast (`as string`) instead of `StockMovementSchema.parse()`. Left a comment: "Post-regen: update StockMovementSchema to make productId nullable and switch to schema.parse()."
- **Files modified:** `queries.ts`
- **Commit:** 20f3b97

## Known Stubs

None — all hooks are fully wired to supabase queries. `useIngredientsActive` is an intentional thin alias for `useIngredients` (not a stub — correct behavior per plan: returns active-only ingredients for Phase 4 autocomplete).

## Threat Flags

None — this plan only adds read-only TanStack Query hooks. No new network endpoints, write paths, or auth patterns introduced. Reads go through the existing authenticated Supabase client with RLS enforced (established in 03-01).

## Self-Check: PASSED

- `bar-pos/src/entities/ingredient/index.ts`: FOUND in worktree
- `bar-pos/src/entities/ingredient/model/types.ts`: FOUND in worktree
- `bar-pos/src/entities/ingredient/model/queries.ts`: FOUND in worktree
- `bar-pos/src/entities/ingredient/model/queries.test.ts`: FOUND in worktree
- Commit 487d079 (types.ts): FOUND in git log
- Commit 20f3b97 (queries.ts + index.ts): FOUND in git log
- Commit 38227ba (queries.test.ts): FOUND in git log
- 4/4 tests pass, typecheck clean, lint clean: VERIFIED
