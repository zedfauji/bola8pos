---
phase: 08-polish-reports-e2e-hardening
plan: 02
subsystem: reporting
tags: [zod, tanstack-query, reports, domain-types, unit-tests, date-validation]

requires:
  - phase: 08-polish-reports-e2e-hardening
    plan: 01
    provides: combo_mix_daily + recipe_variance_daily + waitlist_metrics_daily DB views

provides:
  - ComboMixRowSchema, RecipeVarianceRowSchema, WaitlistMetricsRowSchema, RefundRegisterRowSchema, ComboOverrideRowSchema Zod schemas
  - supabase.types.ts public.Views with combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily shapes
  - useComboMixReport, useRecipeVarianceReport, useWaitlistAnalyticsReport, useRefundsRegister, useComboOverrides TanStack Query hooks
  - assertDateRangeValid exported helper (365-day DoS guard)
  - 4 unit tests for 365-day guard

affects:
  - 08-03 (report widgets will import hooks + row types from these files)

tech-stack:
  added: []
  patterns:
    - "Five new Zod schemas follow existing domain.ts pattern: z.object + z.infer<typeof Schema> type alias"
    - "supabase.types.ts Views section manually extended (pre-regen pattern per CLAUDE.md)"
    - "All 5 hooks follow existing useQuery pattern with db = supabase as any cast"
    - "assertDateRangeValid uses Math.abs for direction-independent range validation"
    - "Lint fix: void function in arrow shorthand → braces pattern for no-confusing-void-expression"
    - "Lint fix: as T cast removes undefined → cast to T | undefined to re-enable ?? guard"

key-files:
  created: []
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/supabase.types.ts
    - bar-pos/src/entities/tab/model/queries-reports.ts
    - bar-pos/src/entities/tab/model/queries-reports.test.ts

key-decisions:
  - "supabase.types.ts Views section replaced [_ in never]: never with 3 view Row shapes — pre-regen manual transcription pattern per CLAUDE.md"
  - "assertDateRangeValid exported at module level so unit tests can import it directly without mocking useQuery"
  - "WaitlistAnalyticsReport nullable fields (avgQuotedWait, avgActualWait, noShowRate) cast to T | null directly — no ?? null needed"
  - "RefundRegisterRow.items mapped to [] (empty array stub) — refund_items join returns ids/restock flags only; full RefundItemSchema requires additional data not in the join"
  - "Pre-existing typecheck errors (113) and lint errors (11) in unrelated files — confirmed present before this plan via git stash verification; not caused by these changes"

requirements-completed: [S6-01, S6-03, S6-04, S6-05, S6-06, S6-09]

duration: 20min
completed: 2026-04-25
---

# Phase 08 Plan 02: Wave 2 Domain Types + Wave 3 Report Query Hooks Summary

**Five Zod report row schemas, three supabase.types.ts view shapes, five TanStack Query hooks with 365-day DoS guard, and 4 unit tests — Wave 2/3 TypeScript contract establishing all report hook interfaces for Phase 8 widgets**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-25T17:20:00Z
- **Completed:** 2026-04-25T17:31:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

### Task 1: Zod Schemas + supabase.types.ts View Shapes
- Added 5 Zod schemas to `domain.ts` after the Phase 7 waitlist section:
  - `ComboMixRowSchema` / `ComboMixRow`
  - `RecipeVarianceRowSchema` / `RecipeVarianceRow`
  - `WaitlistMetricsRowSchema` / `WaitlistMetricsRow` (nullable fields for avg_quoted/actual_wait, no_show_rate)
  - `RefundRegisterRowSchema` / `RefundRegisterRow` (amount: z.number().positive())
  - `ComboOverrideRowSchema` / `ComboOverrideRow`
- Extended `supabase.types.ts` public.Views section (replaced `[_ in never]: never`) with 3 view Row shapes: `combo_mix_daily`, `recipe_variance_daily`, `waitlist_metrics_daily`

### Task 2: Query Hooks + 365-day Guard Tests
- Added 5 new type imports to `queries-reports.ts`
- Exported `assertDateRangeValid(from, to)` helper — throws when `Math.abs(daysDiff) > 365`
- Added 5 TanStack Query hooks: `useComboMixReport`, `useRecipeVarianceReport`, `useWaitlistAnalyticsReport`, `useRefundsRegister`, `useComboOverrides`
- Replaced 6 `it.todo` stubs in `queries-reports.test.ts` with 4 real unit tests for `assertDateRangeValid`
- Total test count: 1054 → 1058 (+4 new tests)
- Todo count: 8 → 2 (-6 todos, +4 real tests)

## Task Commits

1. **Task 1: Five Zod schemas + supabase.types.ts view shapes** — `67e01db` (feat)
2. **Task 2: Five query hooks + assertDateRangeValid + 4 unit tests** — `8370e48` (feat)

## Files Created/Modified

- `bar-pos/src/shared/lib/domain.ts` — 5 new Zod schemas + type aliases (57 lines added)
- `bar-pos/src/shared/lib/supabase.types.ts` — public.Views extended with 3 view shapes (29 lines added)
- `bar-pos/src/entities/tab/model/queries-reports.ts` — 5 hooks + assertDateRangeValid + type imports (159 lines added)
- `bar-pos/src/entities/tab/model/queries-reports.test.ts` — 4 real tests replacing 6 it.todo stubs

## Decisions Made

- `supabase.types.ts` Views section: replaced `[_ in never]: never` with 3 view Row shapes using the pre-regen manual transcription pattern documented in CLAUDE.md. The second (graphql_public) Views section was left as-is.
- `assertDateRangeValid` exported at module level for direct unit test import — avoids mocking TanStack Query's `useQuery`.
- `WaitlistMetricsRow` nullable fields cast to `T | null` directly without `?? null` (ESLint `no-unnecessary-condition` compliance).
- `RefundRegisterRow.items` mapped to `[]` — refund_items join returns `{id, restock}` pairs only, not full `RefundItemSchema` shape. Future plan can wire full item details.
- 113 pre-existing typecheck errors and 11 pre-existing lint errors in other files confirmed unchanged by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lint: no-unnecessary-condition on `?? 0` / `?? null` / `?? '—'`**
- **Found during:** Task 2 lint run
- **Issue:** Casting `r['field'] as number` then using `?? 0` — the cast removes `undefined` so `??` is flagged as unnecessary
- **Fix:** Changed casts to `T | null` or `T | undefined` where `??` is semantically meaningful
- **Files modified:** `queries-reports.ts` (5 lines)
- **Commit:** `8370e48`

**2. [Rule 1 - Bug] Lint: no-confusing-void-expression on `() => assertDateRangeValid(...)`**
- **Found during:** Task 2 lint run
- **Issue:** Arrow function shorthand returning `void` expression — ESLint rule requires braces
- **Fix:** Added `{ ... }` block body to all 4 test arrow functions
- **Files modified:** `queries-reports.test.ts` (4 lines)
- **Commit:** `8370e48`

## Known Stubs

- `useRefundsRegister` maps `refund_items` to `items: []` (empty array) — the join returns `{id, restock}` pairs only, not full `RefundItemSchema` shape. This stub is intentional: the RefundRegister widget will use `restockCount` (correctly computed) and `items` will be wired when the widget needs line items. Plan 08-03 resolves.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The 5 new query hooks read from existing DB views and tables (combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily, refunds, audit_log). All are gated by existing Supabase RLS. Threat T-08-02-01 (DoS date range) is mitigated by `assertDateRangeValid`.

## Self-Check

---

## Self-Check: PASSED

- `grep -n "ComboMixRowSchema" bar-pos/src/shared/lib/domain.ts` → line 1724 ✓
- `grep -n "RefundRegisterRowSchema" bar-pos/src/shared/lib/domain.ts` → line 1745 ✓
- `grep -n "combo_mix_daily" bar-pos/src/shared/lib/supabase.types.ts` → line 1499 ✓
- `grep -n "useComboMixReport" bar-pos/src/entities/tab/model/queries-reports.ts` → line 516 ✓
- `grep -n "useRefundsRegister" bar-pos/src/entities/tab/model/queries-reports.ts` → line 556 ✓
- `grep -n "useComboOverrides" bar-pos/src/entities/tab/model/queries-reports.ts` → line 599 ✓
- `assertDateRangeValid` test group: 4/4 passing ✓
- Commits `67e01db` and `8370e48` exist ✓
- 105 test files pass, 1058 tests pass, 2 todo ✓

---
*Phase: 08-polish-reports-e2e-hardening*
*Completed: 2026-04-25*
