---
phase: 03-ingredient-foundation
plan: "07"
subsystem: ingredient-testing
status: checkpoint — awaiting human E2E verification
tags:
  - e2e
  - property-test
  - seed-data
  - fast-check
  - playwright
dependency_graph:
  requires:
    - "03-01" # ingredients table + migrations
    - "03-02" # Zod schemas + uom.ts
    - "03-03" # entities/ingredient FSD slice
    - "03-04" # features: adjust-stock-movement, import-ingredients-csv
    - "03-05" # widgets: IngredientsTable, StockMovementsList, ManageIngredientsTab
    - "03-06" # SettingsTabsPanel wired with Ingredients tab
  provides:
    - "E2E spec: 33-ingredients.spec.ts (T1-T7)"
    - "P4 ledger invariant property test (500 runs)"
    - "seed-ingredients.ts (6 core ingredients)"
  affects: []
tech_stack:
  added: []
  patterns:
    - "Playwright E2E spec with service-client DB seeding (pre-regen cast as any)"
    - "fast-check property test (sync fc.property + fc.assert)"
    - "Idempotent seed script (select-then-insert by name)"
    - "Graceful test skip via test.info().annotations.push"
key_files:
  created:
    - bar-pos/e2e/33-ingredients.spec.ts
    - bar-pos/src/shared/lib/ledger.test.ts
    - bar-pos/scripts/seed-ingredients.ts
  modified: []
decisions:
  - "P4 test uses sync fc.property (not asyncProperty) — matches uom.test.ts pattern in codebase"
  - "getServiceClient() returns any — pre-regen cast avoids TypeScript errors on ingredients table not in supabase.types.ts"
  - "/* eslint-disable */ at file level on spec — consistent with seed-combos.ts pattern (CLAUDE.md workaround)"
  - "seed-ingredients.ts uses __dirname path resolution — matches seed-combos.ts pattern"
  - "fc.float uses Math.fround() boundaries — matches uom.test.ts pattern for fast-check v4"
metrics:
  duration: "14min"
  completed_date: "2026-04-24T16:42:45Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 03 Plan 07: E2E Spec + Ledger Test + Seed Data Summary

## One-liner

E2E spec (T1-T7) + P4 ledger invariant property test (500 runs) + idempotent seed script for 6 core ingredients (Corona, Modelo, Wings, Lime, Clamato, Salsa Mexicana).

## What Was Built

### Task 1: ledger.test.ts + seed-ingredients.ts (COMPLETE — committed 2985e9d)

**`bar-pos/src/shared/lib/ledger.test.ts`**
- `simulateLedger()` pure function simulating the append-only ledger in memory
- 4 unit tests: empty list, single positive, positive+negative, correction bypass
- P4 property test: `fc.assert(fc.property(...))` with 500 runs, asserts `sum(accepted deltas) = finalQty` for any N random movements with any combination of reasons
- INVENTORY_NEGATIVE guard simulated: non-correction/physical_count movements that drive qty below 0 are skipped (mirrors RPC behavior)
- Verified passing: 5/5 tests green in main project (fast-check + vitest)

**`bar-pos/scripts/seed-ingredients.ts`**
- 6 core ingredients: Corona 355ml (beer-regular), Modelo Especial 355ml (beer-premium), Wings raw (food-protein), Lime (produce), Clamato 1L (mixer), Salsa Mexicana (prep)
- Idempotent by name: select-then-insert, prints `[SKIP]` / `[OK]` / `[ERROR]` per ingredient
- Uses service role key from .env.local; ESLint disabled at file level (CLAUDE.md workaround pattern)
- Run: `cd bar-pos && npx tsx scripts/seed-ingredients.ts`

### Task 2: 33-ingredients.spec.ts (COMPLETE — committed 8c079bf)

7 E2E tests covering the full ingredient management lifecycle:

| Test | Flow | Key assertion |
|------|------|---------------|
| T1 | Admin creates ingredient | `"Ingredient added"` toast + row in table |
| T2 | Admin edits ingredient reorder_point | `"Ingredient saved"` toast |
| T3 | Low stock badge | `"Low stock"` badge visible when qty <= reorder_point |
| T4 | Manual waste adjustment | `"Adjustment recorded"` toast + DB movement row reason = 'waste' |
| T5 | INVENTORY_NEGATIVE guard | `"insufficient stock"` error toast + dialog stays open |
| T6 | CSV import (2 rows) | `"2 ingredients imported"` toast after file chooser upload |
| T7 | Delete ingredient | ConfirmDialog `Delete "E2E Delete Me Ingredient"?` + row removed |

All copy strings taken from UI-SPEC copywriting contract. Service client typed as `any` (pre-regen cast). Graceful skip annotations on T2-T7 (DB-seeded tests).

### Task 3: Run full test suite + E2E gate (PENDING — checkpoint)

This task requires human action: running unit tests and the E2E spec against the live dev server.

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `2985e9d` | `test(03-07): add P4 ledger invariant property test + seed-ingredients.ts` | ledger.test.ts, seed-ingredients.ts |
| `8c079bf` | `test(03-07): add E2E spec 33-ingredients.spec.ts covering T1-T7` | 33-ingredients.spec.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Simplified service client cast pattern**
- **Found during:** Task 2 typecheck
- **Issue:** Plan draft used complex `admin as ReturnType<typeof createClient> & {...}` cast which still caused TypeScript errors because `ingredients` table is not in `supabase.types.ts`
- **Fix:** `getServiceClient()` returns `any` directly at the function level + `/* eslint-disable */` at file level — consistent with CLAUDE.md pre-regen cast pattern and seed-combos.ts precedent
- **Files modified:** bar-pos/e2e/33-ingredients.spec.ts

**2. [Rule 1 - Bug] Changed fc.asyncProperty → fc.property (sync)**
- **Found during:** Task 1 — reviewing uom.test.ts pattern
- **Issue:** Plan draft used `fc.asyncProperty` with `async` arrow function, but the codebase's uom.test.ts uses sync `fc.property` for the same use case (P5 test)
- **Fix:** Used `fc.property` (sync) matching uom.test.ts pattern; the simulateLedger function is pure and synchronous so async is unnecessary
- **Files modified:** bar-pos/src/shared/lib/ledger.test.ts

**3. [Rule 1 - Bug] Used Math.fround() for fc.float boundaries**
- **Found during:** Task 1 — reviewing uom.test.ts pattern
- **Issue:** Plan draft used raw numeric literals in fc.float(); uom.test.ts wraps with Math.fround() which is required for fast-check v4 float() to avoid precision issues
- **Fix:** Applied Math.fround() to fc.float boundaries matching uom.test.ts pattern
- **Files modified:** bar-pos/src/shared/lib/ledger.test.ts

## Known Stubs

None — this plan only creates test files and a seed script; no UI stubs introduced.

## Threat Flags

None — test files and seed scripts only. Service role key is read from .env.local (gitignored) and never compiled into the renderer. This matches the T-03-16 threat disposition (mitigate, already documented in plan threat model).

## Self-Check

### Files exist
- [x] bar-pos/e2e/33-ingredients.spec.ts — committed
- [x] bar-pos/src/shared/lib/ledger.test.ts — committed
- [x] bar-pos/scripts/seed-ingredients.ts — committed

### Commits exist
- [x] 2985e9d — test(03-07): add P4 ledger invariant property test + seed-ingredients.ts
- [x] 8c079bf — test(03-07): add E2E spec 33-ingredients.spec.ts covering T1-T7

## Self-Check: PASSED

## Status: Awaiting checkpoint verification

Tasks 1 and 2 complete and committed. Task 3 (E2E gate) requires human action — see checkpoint report.
