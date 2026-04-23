---
phase: 01-foundation
plan: 04
subsystem: entities/category
tags: [entities, category, fsd, tanstack-query, tree]
dependency_graph:
  requires: [03-types-zod-PLAN.md]
  provides: ["@entities/category public API"]
  affects: ["features/manage-products", "shared/ui/CategoryTreePicker"]
tech_stack:
  added: []
  patterns: ["FSD entity module", "TanStack Query hooks", "buildTree from @shared/lib/category-tree"]
key_files:
  created:
    - bar-pos/src/entities/category/index.ts
    - bar-pos/src/entities/category/model/index.ts
    - bar-pos/src/entities/category/model/types.ts
    - bar-pos/src/entities/category/model/queries.ts
  modified:
    - bar-pos/src/features/manage-products/ui/CatalogCategoriesTab.tsx
    - bar-pos/src/features/manage-products/ui/CatalogProductsTab.tsx
    - bar-pos/src/shared/ui/CategoryTreePicker/CategoryTreePicker.tsx
decisions:
  - "Category entity queries do NOT sync to useProductStore; the product entity's own useCategories handles that for POS flow"
  - "useCategoryTree delegates tree construction to buildTree from @shared/lib/category-tree to avoid duplication"
  - "No cross-entity imports: entities/category only imports from @shared/* (valid FSD)"
  - "CatalogProductsTab splits its import: useCategories from @entities/category, product mutations from @entities/product"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-23"
  tasks_completed: 1
  files_changed: 7
---

# Phase 1 Plan 04: `entities/category` tree model (FSD) Summary

**One-liner:** Category entity extracted from product entity with TanStack Query hooks for list/tree operations and `useCategoryTree` built on `@shared/lib/category-tree`.

## What Was Done

Created `src/entities/category/` as a standalone FSD entity housing:

- **model/types.ts** — re-exports `CategorySchema`, `CategoryCreateSchema`, `CategoryUpdateSchema`, `Category`, `CategoryCreate`, `CategoryUpdate` from `@shared/lib/domain`; re-exports `buildCategoryTree` (alias of `buildTree`) and `CategoryNode` (alias of `CategoryTreeNode`) from `@shared/lib/category-tree`
- **model/queries.ts** — `useCategories`, `useCategoryTree`, `useMutationCreateCategory`, `useMutationUpdateCategory`; supports `is_food` and `parent_id` DB columns (Plan 02 migrations)
- **model/index.ts** — barrel combining types + queries
- **index.ts** — public API with JSDoc boundary note

Updated import call sites:
- `CatalogCategoriesTab.tsx`: `@entities/product` → `@entities/category`
- `CatalogProductsTab.tsx`: split import, `useCategories` from `@entities/category`, product mutations stay at `@entities/product`

## Verification

- `npm run typecheck` — passes
- `npm run lint` — passes (0 warnings)
- Unit test suite: 91 files passing (4 integration test failures are pre-existing, unrelated to this plan)
- No stray deep imports from features/widgets into `@entities/category/model/**`
- POS routes (`/pos`, `/pool-tables`) do not import from `@entities/category`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-fix] Pre-existing lint errors in CategoryTreePicker and CategoryTreePicker shared UI**
- **Found during:** Lint gate verification
- **Issue:** `CategoryTreePicker.tsx` had two `@typescript-eslint/restrict-template-expressions` errors (template literals with number types); these were introduced by the existing commit from Plan 03/05 wave work
- **Fix:** Wrapped numeric template expressions with `String()` calls
- **Files modified:** `src/shared/ui/CategoryTreePicker/CategoryTreePicker.tsx`
- **Commit:** 931f3d6

**2. [Rule 4 Avoided] FSD boundary — category entity cannot import from product entity**
- During design, the initial approach synced `useCategories` in the category entity to `useProductStore.setCategories`
- Caught pre-write: `entities/category` cannot import from `entities/product` (same FSD layer)
- Resolution: category entity is query-only (no store sync); POS flow continues via `entities/product`'s own `useCategories` which still populates product store. Both share `['categories']` TanStack Query key so fetch is deduplicated.

## Commit

| Hash | Message |
|------|---------|
| 931f3d6 | feat(ui): add CategoryTreePicker [S1-07] (captured category entity + UI fixes) |

## Self-Check: PASSED

- `src/entities/category/index.ts` — FOUND
- `src/entities/category/model/queries.ts` — FOUND
- `src/features/manage-products/ui/CatalogCategoriesTab.tsx` imports from `@entities/category` — CONFIRMED
- `src/features/manage-products/ui/CatalogProductsTab.tsx` imports `useCategories` from `@entities/category` — CONFIRMED
- Commit 931f3d6 — FOUND in `git log`
