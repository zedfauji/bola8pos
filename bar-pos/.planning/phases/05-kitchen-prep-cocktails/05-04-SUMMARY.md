---
phase: 05-kitchen-prep-cocktails
plan: 04
subsystem: ui-kitchen-prep
tags: [kitchen-prep, chef-hat-badge, storybook, prep-production-form, prep-batch-preview, kitchen-prep-dashboard, rbac-route, home-tile, ingredients-table]
dependency_graph:
  requires:
    - 05-03 (ChefHatBadge + entities/prep FSD slice + useProducePrepBatch)
  provides:
    - ChefHatBadge.stories.tsx (Default + InlineWithText)
    - PrepProductionForm Dialog (useReducer + useRecipeByPrepIngredient + PrepBatchPreview)
    - PrepBatchPreview (computePrepConsumption + insufficient-stock highlight)
    - KitchenPrepDashboard widget (prep-on-hand grid + recent batches DataTable)
    - KitchenPrepPage + KitchenPrepRoute (RBAC guard produce_prep_batch)
    - /kitchen-prep route registered in router
    - HomeDashboard Kitchen Prep tile (ChefHat icon + produce_prep_batch requiredAction)
    - IngredientsTable filterPrep prop (external filter control)
  affects:
    - bar-pos/src/shared/ui/ChefHatBadge.stories.tsx
    - bar-pos/src/features/produce-prep-batch/ui/PrepProductionForm.tsx
    - bar-pos/src/features/produce-prep-batch/ui/PrepBatchPreview.tsx
    - bar-pos/src/features/produce-prep-batch/index.ts
    - bar-pos/src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx
    - bar-pos/src/widgets/KitchenPrepDashboard/index.ts
    - bar-pos/src/pages/kitchen-prep/index.tsx
    - bar-pos/src/app/kitchen-prep-route.tsx
    - bar-pos/src/app/router.tsx
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx
    - bar-pos/src/widgets/IngredientsTable/index.tsx
tech_stack:
  added: []
  patterns:
    - useReducer for multi-field form state (PrepProductionForm)
    - FSD entity layer import (useRecipeByPrepIngredient from @entities/prep — no direct DB in features)
    - Storybook stories from @storybook/react-vite
    - RBAC route guard mirroring KdsRoute pattern (can() check → Navigate)
    - External filterPrep prop with internal useState fallback
key_files:
  created:
    - bar-pos/src/shared/ui/ChefHatBadge.stories.tsx
    - bar-pos/src/features/produce-prep-batch/ui/PrepProductionForm.tsx
    - bar-pos/src/features/produce-prep-batch/ui/PrepBatchPreview.tsx
    - bar-pos/src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx
    - bar-pos/src/widgets/KitchenPrepDashboard/index.ts
    - bar-pos/src/pages/kitchen-prep/index.tsx
    - bar-pos/src/app/kitchen-prep-route.tsx
  modified:
    - bar-pos/src/features/produce-prep-batch/index.ts (added PrepProductionForm + PrepBatchPreview exports)
    - bar-pos/src/app/router.tsx (added KitchenPrepRoute import + /kitchen-prep route)
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx (added ChefHat import + Kitchen Prep tile)
    - bar-pos/src/widgets/IngredientsTable/index.tsx (added filterPrep prop + activePrepFilter logic)
decisions:
  - filterPrep prop in IngredientsTable coexists with internal prepFilter state; activePrepFilter = filterPrep ?? prepFilter so the toolbar hides only when external prop is provided
  - Many files were pre-written in a prior session; verified typecheck + lint + unit tests, then committed atomically
  - LoadingSpinner uses numeric size prop (not "sm" string) — confirmed from LoadingSpinner.tsx source
metrics:
  duration: ~15min
  completed_date: "2026-04-25T20:00:00Z"
  tasks_completed: 2
  files_modified: 11
---

# Phase 05 Plan 04: Kitchen Prep UI — Dashboard, Page, Route, Stories Summary

**One-liner:** Full Kitchen Prep UI layer: ChefHatBadge Storybook stories, PrepProductionForm Dialog (useReducer + FSD entity calls), PrepBatchPreview with stock insufficiency highlight, KitchenPrepDashboard widget, /kitchen-prep route with RBAC guard, HomeDashboard tile, and IngredientsTable external filterPrep prop.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ChefHatBadge stories + PrepProductionForm + PrepBatchPreview | 11ffc9b | ChefHatBadge.stories.tsx, PrepProductionForm.tsx, PrepBatchPreview.tsx, produce-prep-batch/index.ts |
| 2 | KitchenPrepDashboard + page + route + router + home tile + IngredientsTable filterPrep | 384cce8 | KitchenPrepDashboard.tsx, KitchenPrepDashboard/index.ts, kitchen-prep/index.tsx, kitchen-prep-route.tsx, router.tsx, HomeDashboard.tsx, IngredientsTable/index.tsx |

## What Was Built

**ChefHatBadge.stories.tsx:**
- Default story (renders badge standalone)
- InlineWithText story (renders inside a text span — "Salsa Mexicana <ChefHatBadge />")
- Imports from @storybook/react-vite per project convention

**PrepBatchPreview:**
- Props: recipe (RecipeWithItems), qtyProduced, prepIngredient ({name, uom}), currentStock (Map)
- Calls computePrepConsumption(qtyProduced, recipe.items, recipe.yieldQty) for deltas
- Insufficient stock rows get aria-label with "need X, have Y" for accessibility
- Credit row at bottom in text-pos-accent font-mono
- aria-label="Ingredient consumption preview" + role="status" on outer div

**PrepProductionForm:**
- useReducer with SET_INGREDIENT / SET_QTY / SET_NOTES / RESET actions
- IngredientAutocomplete filtered to isPrep === true before passing
- useRecipeByPrepIngredient(state.selectedIngredientId) from @entities/prep (FSD-compliant)
- PrepBatchPreview shown when recipe != null && parsedQty > 0
- Dialog max-w-sm, title "Record prep batch", both footer buttons disabled during pending

**KitchenPrepDashboard:**
- Section 1: "Prep on hand" header + "New batch" button → PrepProductionForm dialog
- PrepOnHandCard grid (2/3/4 cols responsive) for isPrep ingredients; EmptyState fallback
- Section 2: "Recent batches" DataTable with created_at, ingredient name, qty+uom, produced_by, notes columns
- Staff name lookup via useStaffList() Map

**KitchenPrepRoute:** Mirrors KdsRoute; checks can('produce_prep_batch') → Navigate to /home

**KitchenPrepPage:** Mirrors KdsPage; title="Kitchen Prep"; wraps KitchenPrepDashboard in PageContainer

**router.tsx:** /kitchen-prep route registered with ProtectedRoute + KitchenPrepRoute; KitchenPrepPage lazy-loaded

**HomeDashboard:** Kitchen Prep tile added with ChefHat icon, path '/kitchen-prep', requiredAction: 'produce_prep_batch'

**IngredientsTable:** filterPrep?: 'prep' | 'raw' | 'all' prop added to Props; activePrepFilter = filterPrep ?? prepFilter; filter toolbar hidden when external prop provided

## Deviations from Plan

### Files Pre-Written

Most files were already created in a prior session before this plan was executed. Verified all acceptance criteria, typecheck (0 errors), lint (0 warnings), and unit tests (1031 tests pass) before committing.

### filterPrep Prop Strategy

The IngredientsTable already had internal `prepFilter` useState and `filteredIngredients` useMemo. Rather than replacing the internal state (which would break the existing toolbar UI), added `filterPrep` prop as an external override with `activePrepFilter = filterPrep ?? prepFilter`. When `filterPrep` is provided, the toolbar filter buttons are hidden (not rendered). This preserves backward compatibility with existing callers.

## Known Stubs

None — all data is wired. PrepBatchPreview receives real computePrepConsumption output. KitchenPrepDashboard fetches real data via usePrepProductions() and useIngredientsActive().

## Threat Flags

No new network endpoints introduced. KitchenPrepRoute can() check (T-05-10) is present and redirects unauthorized users. PrepProductionForm qty validation (T-05-11) uses parsedQty > 0 isValid guard.

## Self-Check: PASSED

- [x] ChefHatBadge.stories.tsx exists with InlineWithText story
- [x] PrepProductionForm.tsx: useReducer + useRecipeByPrepIngredient (no direct db call)
- [x] PrepBatchPreview.tsx: computePrepConsumption + aria-label="Ingredient consumption preview"
- [x] produce-prep-batch/index.ts: exports PrepProductionForm + PrepBatchPreview
- [x] KitchenPrepDashboard.tsx: 138 lines, prep grid + DataTable + dialog state
- [x] KitchenPrepDashboard/index.ts: barrel export
- [x] pages/kitchen-prep/index.tsx: KitchenPrepDashboard + PageContainer title="Kitchen Prep"
- [x] kitchen-prep-route.tsx: can('produce_prep_batch') guard
- [x] router.tsx: /kitchen-prep route + KitchenPrepRoute + KitchenPrepPage lazy import
- [x] HomeDashboard.tsx: ChefHat import + produce_prep_batch tile
- [x] IngredientsTable/index.tsx: filterPrep in Props interface
- [x] npm run typecheck exits 0
- [x] npm run lint exits 0
- [x] npm run test: 1031 tests pass (103 test files)
- [x] Commit 11ffc9b exists (Task 1)
- [x] Commit 384cce8 exists (Task 2)
