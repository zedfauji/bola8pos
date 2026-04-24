---
phase: 03-ingredient-foundation
plan: "04"
subsystem: features
tags: [fsd, feature, tanstack-query, zod, ingredient, csv, stock-movement, typescript]
dependency_graph:
  requires:
    - "03-03: entities/ingredient/index.ts — IngredientCreateSchema, ingredientKeys, Ingredient, ManualAdjustReason"
    - "03-01: record_stock_movement RPC, ingredients table"
  provides:
    - "features/adjust-stock-movement — AdjustStockMovementDialog (manual waste/delivery/correction/count)"
    - "features/import-ingredients-csv — CsvImportSheet (bulk CSV import, 3-state UX)"
    - "csv-parse.ts — parseCsvText pure helper, exported for unit testing"
  affects:
    - "widgets/manage-ingredients-tab (Plan 03-05 — imports both features)"
tech_stack:
  added: []
  patterns:
    - "Pre-regen cast: supabase as any with eslint-disable comment (features layer)"
    - "Native <select> element (no @shared/ui/select — not yet added via shadcn)"
    - "React.SyntheticEvent<HTMLFormElement> for form submit handler (not deprecated FormEvent)"
    - "mutation.mutate() direct call (not void wrapper — mutate() returns void)"
    - "parseCsvText extracted to csv-parse.ts + re-exported from CsvImportSheet.tsx for testing"
    - "Zod v4 uses .issues[] not .errors[] on safeParse failure"
    - "eslint-disable-next-line react-refresh/only-export-components for re-export in component file"
key_files:
  created:
    - bar-pos/src/features/adjust-stock-movement/index.ts
    - bar-pos/src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx
    - bar-pos/src/features/import-ingredients-csv/index.ts
    - bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx
    - bar-pos/src/features/import-ingredients-csv/ui/csv-parse.ts
    - bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx
  modified: []
decisions:
  - "Used native <select> element instead of @shared/ui/select — no Select component exists in shared/ui yet; native select with Tailwind classes matches the visual system"
  - "Extracted parseCsvText to csv-parse.ts (separate file from CsvImportSheet.tsx) to avoid react-refresh/only-export-components lint warning, then re-exported from CsvImportSheet for test compatibility"
  - "record_stock_movement RPC accepts p_notes (text DEFAULT NULL) — included notes field in dialog and RPC call; plan note said to check migration first"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 0
requirements:
  - S3a-07
  - S3a-08
---

# Phase 03 Plan 04: Feature Slices — AdjustStockMovement + CsvImport Summary

**One-liner:** Two FSD feature slices created — `AdjustStockMovementDialog` (manual stock correction via `record_stock_movement` RPC with INVENTORY_NEGATIVE guard) and `CsvImportSheet` (3-state CSV import with FileReader + Zod per-row validation + bulk insert), both typecheck/lint clean with 8 unit tests passing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | features/adjust-stock-movement — AdjustStockMovementDialog | 65806b3, 476edda | AdjustStockMovementDialog.tsx, index.ts |
| 2 | features/import-ingredients-csv — CsvImportSheet | 2c66d49 | CsvImportSheet.tsx, csv-parse.ts, index.ts |
| 3 | CsvImportSheet.test.tsx — CSV parse + Zod validation unit tests | 4eecf15 | CsvImportSheet.test.tsx |

## Verification Results

- `npm run typecheck`: PASS (0 errors)
- `npm run lint`: PASS (0 errors, 0 warnings)
- `npx vitest run src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx`: PASS (8/8 tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import order lint errors in AdjustStockMovementDialog.tsx**
- **Found during:** Task 1 lint verification
- **Issue:** `import/order` rule requires `@tanstack/react-query` before `react` (alphabetical); `@shared/ui/button` before `@shared/ui/dialog`
- **Fix:** Reordered imports via `eslint --fix` then synced back
- **Files modified:** `AdjustStockMovementDialog.tsx`
- **Commit:** 476edda

**2. [Rule 1 - Bug] Deprecated `React.FormEvent` in AdjustStockMovementDialog.tsx**
- **Found during:** Task 1 lint verification
- **Issue:** `@typescript-eslint/no-deprecated` flags `React.FormEvent` as deprecated; `@typescript-eslint/no-confusing-void-expression` flags `void mutation.mutate()`
- **Fix:** Changed to `React.SyntheticEvent<HTMLFormElement>` and called `mutation.mutate()` directly (returns void, so no `void` wrapper needed)
- **Files modified:** `AdjustStockMovementDialog.tsx`
- **Commit:** 476edda

**3. [Rule 1 - Bug] Import order errors in CsvImportSheet.tsx**
- **Found during:** Task 2 lint verification
- **Issue:** `react` must come after `lucide-react` alphabetically in external imports group
- **Fix:** Auto-fixed import order via `eslint --fix`
- **Files modified:** `CsvImportSheet.tsx`
- **Commit:** 2c66d49 (applied before commit)

**4. [Rule 2 - Missing functionality] parseCsvText in component file triggers react-refresh warning**
- **Found during:** Task 2 lint verification
- **Issue:** `react-refresh/only-export-components` warns when a non-component is exported from a component file; `max-warnings: 0` makes this a blocking error
- **Fix:** Extracted `parseCsvText` to `csv-parse.ts` (canonical home), re-exported from `CsvImportSheet.tsx` with `eslint-disable-next-line react-refresh/only-export-components`
- **Files modified:** `CsvImportSheet.tsx`, added `csv-parse.ts`
- **Commit:** 2c66d49

**5. [Rule 1 - Bug] Zod v4 uses `.issues[]` not `.errors[]`**
- **Found during:** Task 2 typecheck
- **Issue:** `result.error.errors` does not exist in Zod v4 — the property is `result.error.issues`
- **Fix:** Changed `result.error.errors[0]` to `result.error.issues[0]`
- **Files modified:** `CsvImportSheet.tsx`
- **Commit:** 2c66d49 (fixed before commit)

**6. [Rule 2 - Missing functionality] `@shared/ui/select` does not exist**
- **Found during:** Task 1 read-first phase
- **Issue:** The plan references `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@shared/ui/select`, but this shadcn component has not been added to the project yet
- **Fix:** Used native `<select>` element with Tailwind input-class styling — same visual result, no new dependency
- **Files modified:** `AdjustStockMovementDialog.tsx`
- **Commit:** 65806b3

## Known Stubs

None — both features are fully wired:
- `AdjustStockMovementDialog` calls the real `record_stock_movement` RPC
- `CsvImportSheet` performs real Supabase bulk insert and query invalidation

## Threat Flags

None — no new network endpoints beyond the RPC and table insert already modeled in the plan's `<threat_model>`. T-03-10 (CSV injection) is mitigated by `IngredientCreateSchema.safeParse()` per-row validation before insert. T-03-11 (negative delta bypass) is mitigated by `INVENTORY_NEGATIVE` server-side guard + UI toast. T-03-12 (unauthorized insert) is mitigated by RLS policy enforced at DB layer.

## Self-Check: PASSED

- `bar-pos/src/features/adjust-stock-movement/index.ts`: FOUND
- `bar-pos/src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx`: FOUND
- `bar-pos/src/features/import-ingredients-csv/index.ts`: FOUND
- `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx`: FOUND
- `bar-pos/src/features/import-ingredients-csv/ui/csv-parse.ts`: FOUND
- `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx`: FOUND
- Commit 65806b3 (AdjustStockMovementDialog): FOUND
- Commit 476edda (lint fixes): FOUND
- Commit 2c66d49 (CsvImportSheet): FOUND
- Commit 4eecf15 (tests): FOUND
- 8/8 tests pass, typecheck clean, lint clean: VERIFIED
