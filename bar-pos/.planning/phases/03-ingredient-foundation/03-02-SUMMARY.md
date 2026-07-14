---
phase: 03-ingredient-foundation
plan: "02"
subsystem: shared-lib
tags: [zod, domain-types, uom, ingredient, property-testing]
dependency_graph:
  requires: []
  provides:
    - "IngredientSchema + IngredientCreateSchema + IngredientUpdateSchema in domain.ts"
    - "UomSchema + BaseUomSchema + ManualAdjustReasonSchema in domain.ts"
    - "uom.ts pure utility: toBase, fromBase, roundTrip, BASE_UOMS, ALL_UOMS"
    - "P5 UOM round-trip identity property test (1000 runs)"
  affects:
    - "entities/ingredient/model/types.ts (imports IngredientSchema)"
    - "features/adjust-stock-movement (imports toBase from uom.ts)"
tech_stack:
  added: []
  patterns:
    - "as-const tuple arrays for UOM enum values"
    - "Math.fround() for fast-check v4 fc.float constraints"
    - "S3a section marker pattern for domain.ts phase extensions"
key_files:
  created:
    - bar-pos/src/shared/lib/uom.ts
    - bar-pos/src/shared/lib/uom.test.ts
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/domain.test.ts
decisions:
  - "StockMovementSchema.quantityDelta changed from z.number().int() to z.number() — InventoryLogSchema keeps .int() (product inventory = integer units)"
  - "uom.ts uses Math.fround() for fc.float min/max per fast-check v4 API requirement (fc.float requires 32-bit floats)"
  - "P5 uses synchronous fc.property (not fc.asyncProperty) consistent with pool-billing.test.ts project pattern"
  - "domain.test.ts updated: 'rejects non-integer quantityDelta' → 'accepts decimal quantityDelta' per S3a design intent"
metrics:
  duration: "9min"
  completed: "2026-04-24"
  tasks: 2
  files: 4
requirements:
  - S3a-04
  - S3a-05
---

# Phase 03 Plan 02: Ingredient + UOM Zod Schemas Summary

**One-liner:** Ingredient Zod schemas (IngredientSchema, UomSchema, ManualAdjustReasonSchema) added to domain.ts under S3a section marker, plus a pure uom.ts conversion utility with P5 round-trip property test.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend domain.ts — Ingredient + UOM Zod schemas | 5fe6b85 | domain.ts, domain.test.ts |
| 2 | Create uom.ts utility + uom.test.ts with P5 property test | df3dea4 | uom.ts, uom.test.ts |

## Verification Results

- `npm run typecheck`: PASS (0 errors)
- `npx vitest run src/shared/lib/domain.test.ts`: PASS (50/50 tests)
- `npx vitest run src/shared/lib/uom.test.ts`: PASS (11/11 tests including P5 1000 runs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated domain.test.ts to match new StockMovementSchema behavior**
- **Found during:** Task 1 verification
- **Issue:** Existing test `'rejects non-integer quantityDelta'` asserted `StockMovementSchema.safeParse({ quantityDelta: 1.5 })` would fail. After changing `.int()` → `.number()`, this test failed as expected.
- **Fix:** Updated the test to assert that `1.5` IS accepted, renaming it `'accepts decimal quantityDelta (S3a: ingredient deltas may be fractional)'`. This matches the explicit plan intent.
- **Files modified:** `bar-pos/src/shared/lib/domain.test.ts`
- **Commit:** 5fe6b85

**2. [Rule 3 - Blocking] Fixed fc.float() min/max constraint in P5 property test**
- **Found during:** Task 2 test execution
- **Issue:** fast-check v4 requires `fc.float()` min/max to be 32-bit floats. Passing `0.001` (a 64-bit double) threw: `"fc.float constraints.min must be a 32-bit float"`.
- **Fix:** Wrapped all `fc.float` bounds with `Math.fround()` consistent with existing `pool-billing.test.ts` pattern in the project.
- **Files modified:** `bar-pos/src/shared/lib/uom.test.ts`
- **Commit:** df3dea4

## Known Stubs

None — all schemas are fully defined. uom.ts is a pure arithmetic utility with no stubs.

## Threat Flags

None — this plan only adds Zod schemas and a pure math utility. No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- `bar-pos/src/shared/lib/domain.ts` exists in worktree: FOUND
- `bar-pos/src/shared/lib/uom.ts` exists in worktree: FOUND
- `bar-pos/src/shared/lib/uom.test.ts` exists in worktree: FOUND
- `bar-pos/src/shared/lib/domain.test.ts` exists in worktree: FOUND
- Commit 5fe6b85 (domain.ts + domain.test.ts): FOUND
- Commit df3dea4 (uom.ts + uom.test.ts): FOUND
- 61 tests pass, typecheck clean: VERIFIED
