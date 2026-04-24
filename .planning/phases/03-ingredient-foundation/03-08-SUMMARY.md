---
phase: 03-ingredient-foundation
plan: "08"
subsystem: database
tags: [supabase, postgres, migrations, zod, typescript, csv-import]

# Dependency graph
requires:
  - phase: 03-ingredient-foundation
    provides: stock_movements table, record_stock_movement RPC, StockMovementSchema, CsvImportSheet, ManageIngredientsTab

provides:
  - stock_movements.product_id is nullable (ALTER TABLE migration 20260426000010)
  - record_stock_movement RPC INSERT includes product_id = NULL explicitly
  - StockMovementSchema.productId: string | null (UuidSchema.nullable())
  - mapMovementRow returns null (not empty string) for ingredient-only movements
  - CsvImportSheet preserves failedRows on bulk insert failure (CR-WR-01)
  - CsvImportSheet enforces MAX_IMPORT_ROWS=500 before forEach loop (CR-WR-02)
  - Delete dialog accurately describes soft-delete behavior (CR-WR-04)

affects:
  - 03-ingredient-foundation tasks 4-6 (supabase db push + typecheck + E2E)
  - E2E spec 33-ingredients.spec.ts T4 (waste adjustment) and T5 (INVENTORY_NEGATIVE guard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-closure migration pattern: new migration file for schema fix + update original RPC migration for audit trail"
    - "NULL over empty-string fallback for optional FK fields in mapRow functions"

key-files:
  created:
    - bar-pos/supabase/migrations/20260426000010_stock_movements_product_id_nullable.sql
  modified:
    - bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/entities/ingredient/model/queries.ts
    - bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx
    - bar-pos/src/widgets/ManageIngredientsTab/index.tsx

key-decisions:
  - "New migration 20260426000010 added for ALTER TABLE rather than editing original table migration — preserves migration history integrity"
  - "RPC migration 20260426000003 updated with explicit product_id = NULL in INSERT for clarity and future-proofing"
  - "UuidSchema.nullable() (not .optional()) chosen for productId — null is a valid explicit value, not an absent field"
  - "importState.failedRows preserved on bulk insert error — user should see which rows failed validation even when DB insert fails"

patterns-established:
  - "Null over empty string: mapRow FK fallbacks use ?? null not ?? '' to avoid phantom string values flowing through Zod parse"
  - "500-row CSV guard fires immediately after rows.slice(1) — before any per-row processing — to fail fast on oversized files"

requirements-completed:
  - S3a-03
  - S3a-07
  - S3a-08

# Metrics
duration: 12min
completed: 2026-04-24
---

# Phase 03 Plan 08: Gap-Closure Summary

**product_id NOT NULL constraint dropped on stock_movements, RPC INSERT patched, StockMovementSchema made nullable, plus three CSV/dialog warning fixes — codebase ready for supabase db push**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-24T02:15:00Z
- **Completed:** 2026-04-24T02:27:00Z
- **Tasks:** 3 of 6 completed (Tasks 4-6 require human action / E2E verification)
- **Files modified:** 6

## Accomplishments

- Created migration `20260426000010_stock_movements_product_id_nullable.sql` — ALTER TABLE drops NOT NULL on product_id, unblocking all ingredient-only stock movements (CR-01 BLOCKER resolved in code)
- Updated RPC migration `20260426000003` INSERT to include explicit `product_id = NULL` — record_stock_movement now compiles correctly against nullable column
- `StockMovementSchema.productId` changed from `UuidSchema` to `UuidSchema.nullable()` — type is now `string | null` throughout the codebase; `npm run typecheck` passes with 0 errors
- `mapMovementRow` now returns `null` instead of empty string for missing `product_id` — eliminates phantom UUID strings
- CSV import now preserves `failedRows` on bulk insert failure (CR-WR-01) and enforces `MAX_IMPORT_ROWS=500` before parsing (CR-WR-02)
- Delete dialog copy corrected to describe soft-delete accurately: "history is preserved" (CR-WR-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: ALTER TABLE migration + RPC INSERT update** - `77d3a2a` (feat)
2. **Task 2: StockMovementSchema nullable + mapMovementRow fix** - `5f5761f` (feat)
3. **Task 3: CSV import warnings + delete dialog copy** - `692e24c` (fix)

## Files Created/Modified

- `bar-pos/supabase/migrations/20260426000010_stock_movements_product_id_nullable.sql` - New migration: ALTER COLUMN product_id DROP NOT NULL
- `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql` - Updated: INSERT now includes product_id = NULL explicitly
- `bar-pos/src/shared/lib/domain.ts` - StockMovementSchema.productId: UuidSchema -> UuidSchema.nullable()
- `bar-pos/src/entities/ingredient/model/queries.ts` - mapMovementRow: productId fallback '' -> null
- `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` - failedRows preserved on error; MAX_IMPORT_ROWS=500 guard added
- `bar-pos/src/widgets/ManageIngredientsTab/index.tsx` - Delete dialog description corrected to soft-delete language

## Decisions Made

- New migration file (`000010`) for the ALTER TABLE rather than editing the original table migration (`000001`) — keeps migration chain auditable
- RPC migration (`000003`) updated (not a new migration) because the INSERT body is part of the function definition, not a schema migration
- `UuidSchema.nullable()` (not `.optional()`) for productId — null is an explicit valid state, not an absent field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — typecheck passed clean after Task 2 changes. No downstream consumers had hardcoded `productId: string` assumptions that needed null guards.

## User Setup Required

**Task 4 requires manual action:** Run `supabase db push` from `bar-pos/` to apply migrations to the remote database. Until this is done, the RPC will still fail with the NOT NULL constraint violation at runtime.

Steps:
1. `cd bar-pos`
2. `npx supabase db push`
3. Confirm migration `20260426000010` applies without errors
4. Resume with Tasks 5-6 (typecheck + E2E verification)

## Next Phase Readiness

- Code changes complete and typecheck-clean — ready for `supabase db push`
- After db push: Tasks 5 (typecheck + unit tests) and 6 (E2E 33-ingredients.spec.ts T4+T5) can proceed
- T4 (waste adjustment) and T5 (INVENTORY_NEGATIVE guard) were previously blocked by CR-01; they should pass after migration is applied

---
*Phase: 03-ingredient-foundation*
*Completed: 2026-04-24 (partial — awaiting Task 4 human action)*
