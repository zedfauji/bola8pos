---
phase: 05-kitchen-prep-cocktails
plan: 02
subsystem: shared-lib
tags: [domain-types, rbac, pure-functions, test-stubs, prep-production]
dependency_graph:
  requires:
    - 05-01 (DB migrations + supabase.types.ts with prep_productions)
  provides:
    - PrepProductionSchema + PrepProductionCreateSchema (domain.ts)
    - PREP_INGREDIENT_REQUIRED AppErrorCode (result.ts)
    - produce_prep_batch RBAC action (rbac.ts)
    - computePrepConsumption pure function (prep-math.ts)
    - Wave 0 test stubs for Plans 05-03, 05-05
  affects:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/result.ts
    - bar-pos/src/shared/lib/rbac.ts
    - bar-pos/src/shared/lib/prep-math.ts
tech_stack:
  added: []
  patterns:
    - Pure math functions with no side-effects (prep-math.ts)
    - fast-check property tests for ledger invariants
    - Wave 0 stub pattern (describe.skipIf + it.todo)
key_files:
  created:
    - bar-pos/src/shared/lib/prep-math.ts
    - bar-pos/src/shared/lib/prep-math.test.ts
    - bar-pos/src/entities/prep/model/queries.test.ts
    - bar-pos/src/features/produce-prep-batch/model/prep-ledger.test.ts
    - bar-pos/src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts
    - bar-pos/e2e/21-prep.spec.ts
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/result.ts
    - bar-pos/src/shared/lib/rbac.ts
    - bar-pos/src/shared/lib/rbac.test.ts
decisions:
  - All three files (domain.ts, result.ts, rbac.ts) were already updated in a prior session; committed as-is
  - All Task 2 files (prep-math.ts et al.) were already written in a prior session; committed after test verification
  - rbac.test.ts ALLOWED matrix includes produce_prep_batch for manager + kitchen roles
metrics:
  duration: ~5min (files pre-written; committed after verification)
  completed_date: "2026-04-25T18:00:00Z"
  tasks_completed: 2
  files_modified: 10
---

# Phase 05 Plan 02: Domain Types + RBAC + prep-math Summary

**One-liner:** PrepProductionSchema family + PREP_INGREDIENT_REQUIRED error code + produce_prep_batch RBAC + computePrepConsumption pure function with 5 unit tests and 5 Wave 0 test stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend domain.ts + result.ts + rbac.ts | e89f107 | domain.ts, result.ts, rbac.ts, rbac.test.ts |
| 2 | prep-math.ts + unit tests + Wave 0 stubs | d5de8e8 | prep-math.ts, prep-math.test.ts, queries.test.ts, prep-ledger.test.ts, produce-prep-batch.integration.test.ts, 21-prep.spec.ts |

## What Was Built

**domain.ts:**
- `PrepProductionSchema` and `PrepProductionCreateSchema` added after the Recipe block
- `RecipeSchema` (via `RecipeRowSchema`): `productId` nullable, `prepIngredientId: UuidSchema.nullable()` added
- `recipeOwnerRefine` enforces exactly-one-owner constraint

**result.ts:**
- `PREP_INGREDIENT_REQUIRED` added to `AppErrorCode` union

**rbac.ts:**
- `produce_prep_batch` added to `STAFF_ACTIONS`, `MANAGER_EXTRA`, `KITCHEN_ACTIONS`
- Bartender role does NOT gain the action (T-05-06 mitigated)

**prep-math.ts:**
- `computePrepConsumption(qtyProduced, recipeItems, yieldQty)` pure function
- Computes raw ingredient consumption deltas for a prep batch
- 5 unit tests pass; 2 property tests (P7 + P7b) pass with 500 runs each

**Wave 0 stubs:**
- `entities/prep/model/queries.test.ts` — 5 todo tests (Plan 05-03 fills these)
- `produce-prep-batch/model/prep-ledger.test.ts` — P7 property test (passing)
- `produce-prep-batch/model/produce-prep-batch.integration.test.ts` — I1-I5 stubs
- `e2e/21-prep.spec.ts` — T1-T5 E2E stubs (Plan 05-05 fills these)

## Deviations from Plan

None — all files were pre-written in a prior session. Verified all tests pass, typecheck exits 0, lint exits 0, then committed atomically per task.

## Known Stubs

- `entities/prep/model/queries.test.ts` — 5 `it.todo()` entries; intentional Wave 0 placeholder for Plan 05-03
- `produce-prep-batch.integration.test.ts` — I1-I5 `it.todo()` entries; intentional for Plan 05-03
- `e2e/21-prep.spec.ts` — 5 `test.todo()` entries; intentional for Plan 05-05 (requires seed-prep.ts)

## Threat Flags

No new network endpoints or auth paths introduced. RBAC threat T-05-06 mitigated: `produce_prep_batch` is in `KITCHEN_ACTIONS` and `MANAGER_EXTRA` only — bartender role excluded.

## Self-Check: PASSED

- [x] PrepProductionSchema in domain.ts (grep returns 2+ matches)
- [x] PREP_INGREDIENT_REQUIRED in result.ts
- [x] produce_prep_batch in rbac.ts (3 matches: STAFF_ACTIONS, KITCHEN_ACTIONS, MANAGER_EXTRA)
- [x] computePrepConsumption exported from prep-math.ts
- [x] prep-math.test.ts: 5 tests pass
- [x] prep-ledger.test.ts: P7 + P7b pass (500 runs)
- [x] e2e/21-prep.spec.ts exists with 5 test.todo()
- [x] Commit e89f107 exists (Task 1)
- [x] Commit d5de8e8 exists (Task 2)
- [x] npm run typecheck exits 0
- [x] npm run lint exits 0
