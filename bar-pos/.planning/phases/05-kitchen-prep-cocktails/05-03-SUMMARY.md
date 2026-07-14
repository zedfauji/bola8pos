---
phase: 05-kitchen-prep-cocktails
plan: 03
subsystem: entities-prep-feature
tags: [chef-hat-badge, entities-prep, prep-queries, prep-on-hand-card, produce-prep-batch, integration-tests]
dependency_graph:
  requires:
    - 05-02 (PrepProductionSchema + PREP_INGREDIENT_REQUIRED + Wave 0 stubs)
  provides:
    - ChefHatBadge shared/ui component
    - entities/prep/ FSD slice (queries, types, PrepOnHandCard, barrel)
    - usePrepProductions, useMutationCreatePrepProduction, useRecipeByPrepIngredient hooks
    - features/produce-prep-batch/model/useProducePrepBatch hook
    - Integration tests I1-I6 for prep_productions trigger
  affects:
    - bar-pos/src/shared/ui/ChefHatBadge.tsx
    - bar-pos/src/shared/ui/index.ts
    - bar-pos/src/entities/prep/
    - bar-pos/src/features/produce-prep-batch/model/
tech_stack:
  added: []
  patterns:
    - supabase as any pre-regen cast (prep_productions not in supabase.types.ts)
    - TanStack Query hooks with query key factory (prepKeys)
    - Result<T> return type on mutations
    - Storybook stories imported from @storybook/react-vite
    - Integration tests with describe.skipIf(!hasIntegrationEnv) pattern
key_files:
  created:
    - bar-pos/src/shared/ui/ChefHatBadge.tsx
    - bar-pos/src/entities/prep/index.ts
    - bar-pos/src/entities/prep/model/queries.ts
    - bar-pos/src/entities/prep/model/types.ts
    - bar-pos/src/entities/prep/ui/PrepOnHandCard.tsx
    - bar-pos/src/entities/prep/ui/PrepOnHandCard.stories.tsx
    - bar-pos/src/features/produce-prep-batch/index.ts
    - bar-pos/src/features/produce-prep-batch/model/useProducePrepBatch.ts
  modified:
    - bar-pos/src/shared/ui/index.ts (ChefHatBadge export already present from prior session)
decisions:
  - queries.test.ts was already filled in (pre-written in prior session); committed as-is after verification
  - integration test uses ephemeral admin-created test user pattern (createUser + profile upsert) rather than env-var credentials
  - useRecipeByPrepIngredient fetches from recipes table with prep_ingredient_id filter (FSD-compliant: no feature-layer DB calls)
  - useProducePrepBatch is a thin orchestration wrapper with toast side-effects only; all DB logic stays in entity layer
  - No export * in entities/prep/index.ts (banned by ESLint no-restricted-syntax)
metrics:
  duration: ~10min (files pre-written; verified and committed)
  completed_date: "2026-04-25T19:00:00Z"
  tasks_completed: 2
  files_modified: 8
---

# Phase 05 Plan 03: ChefHatBadge + entities/prep/ FSD Slice + produce-prep-batch Hook Summary

**One-liner:** ChefHatBadge shared/ui badge + full entities/prep FSD slice (TanStack Query hooks, PrepOnHandCard with stock bar, 4 Storybook stories) + useProducePrepBatch mutation hook with toast error handling + I1-I6 integration tests for prep_productions trigger.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ChefHatBadge + entities/prep FSD slice | 0b3d665 | ChefHatBadge.tsx, entities/prep/index.ts, queries.ts, types.ts, PrepOnHandCard.tsx, PrepOnHandCard.stories.tsx |
| 2 | useProducePrepBatch + integration tests I1-I6 | 8065774 | useProducePrepBatch.ts, produce-prep-batch/index.ts, produce-prep-batch.integration.test.ts |

## What Was Built

**ChefHatBadge (shared/ui):**
- Badge with ChefHat icon (aria-hidden), secondary variant
- Barrel-exported from shared/ui/index.ts

**entities/prep/model/queries.ts:**
- `prepKeys` query key factory (.all, .lists(), .byIngredient(id))
- `usePrepProductions(prepIngredientId?)` — fetches from prep_productions, sorted newest first
- `useMutationCreatePrepProduction()` — inserts prep_productions row; maps PREP_INGREDIENT_REQUIRED / INGREDIENT_NOT_FOUND / INVENTORY_NEGATIVE error codes; invalidates prep + ingredients queries on success
- `useRecipeByPrepIngredient(prepIngredientId)` — fetches recipe with items for a prep ingredient

**entities/prep/ui/PrepOnHandCard.tsx:**
- Props: name, uom, qtyOnHand, reorderPoint (nullable)
- Stock level color coding: green (healthy), red-orange (low/empty), border-pos-danger bg-pos-danger/5 (empty)
- Progress bar (role=progressbar, aria-valuenow) shown when reorderPoint != null
- qtyOnHand displayed with toFixed(2) and font-mono

**PrepOnHandCard.stories.tsx:** 4 stories: Healthy, Low, OutOfStock, NoReorderPoint (imports from @storybook/react-vite)

**useProducePrepBatch.ts:**
- Wraps useMutationCreatePrepProduction
- Success toast: "Batch recorded. {name} +{qty} {uom}."
- Error toasts: PREP_INGREDIENT_REQUIRED, INVENTORY_NEGATIVE, NOT_FOUND, generic fallback

**Integration tests I1-I6:**
- I1: prep with no recipe — 1 stock_movement credited
- I2: prep with recipe (2 items) — 3 stock_movements (1 credit + 2 debits)
- I3: non-prep ingredient → PREP_INGREDIENT_REQUIRED error
- I4: insufficient raw stock → INVENTORY_NEGATIVE, transaction rolled back (0 movements)
- I5: deplete_for_order_item works with product_id-owned recipe (Phase 4 regression)
- I6: explicit regression guard for Phase 5 nullable migration

## Deviations from Plan

None — all files were pre-written in a prior session. Verified all tests pass (5 unit tests, typecheck, lint), then committed atomically per task.

## Known Stubs

None — all stubs filled. queries.test.ts has 5 real tests. Integration tests I1-I6 are fully implemented.

## Threat Flags

No new network endpoints or auth paths introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] ChefHatBadge.tsx exists in shared/ui
- [x] export { ChefHatBadge } in shared/ui/index.ts (line 10)
- [x] entities/prep/index.ts exists with explicit named exports (no export *)
- [x] useRecipeByPrepIngredient exported from entities/prep barrel
- [x] PrepOnHandCard.stories.tsx has 4 stories (Healthy, Low, OutOfStock, NoReorderPoint)
- [x] queries.test.ts: 5 tests pass (vitest run exits 0)
- [x] useProducePrepBatch.ts: 3 error cases handled (PREP_INGREDIENT_REQUIRED, INVENTORY_NEGATIVE, NOT_FOUND)
- [x] produce-prep-batch.integration.test.ts: I1-I6 implemented, no expect(true).toBe(true) placeholders
- [x] npm run typecheck exits 0
- [x] npm run lint exits 0
- [x] Commit 0b3d665 exists (Task 1)
- [x] Commit 8065774 exists (Task 2)
