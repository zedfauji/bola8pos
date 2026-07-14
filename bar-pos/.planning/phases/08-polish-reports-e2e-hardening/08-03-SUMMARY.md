---
phase: 08-polish-reports-e2e-hardening
plan: 03
subsystem: reporting
tags: [widgets, rtl-tests, recharts, report-ui, fsd, amber-highlight, emerald-highlight]

requires:
  - phase: 08-polish-reports-e2e-hardening
    plan: 02
    provides: useComboMixReport, useRecipeVarianceReport, useWaitlistAnalyticsReport, useRefundsRegister, useComboOverrides hooks + Zod row schemas

provides:
  - ComboMixReport widget (stacked bar chart + emerald top-row summary table)
  - RecipeVarianceReport widget (amber left-border row highlight for |variancePct| > 10)
  - WaitlistAnalyticsReport widget (4 metric cards + 24-cell hourly heatmap)
  - RefundsRegister widget (table with totals row; Manager column omitted)
  - ComboOverrideReport widget (Timestamp + Actor + Combo + Reason table)
  - 4 RTL test files (ComboMixReport, RecipeVarianceReport, WaitlistAnalyticsReport, RefundsRegister)

affects:
  - 08-04 (ReportsPage will import and wire these 5 widgets into new tab slots)

tech-stack:
  added: []
  patterns:
    - "Standard report widget DOM: space-y-4 wrapper + flex justify-end ExportButtons + rounded-md border Table"
    - "Emerald top-row highlight: border-l-2 border-l-emerald-500 bg-emerald-500/5 on highest-revenue row"
    - "Amber variance highlight: border-l-4 border-l-amber-400 bg-amber-50/5 on TableRow when |variancePct| > 10"
    - "ExportButtons as-never cast: reportType={'combo-mix' as never} temporary until Plan 08-04 extends Props union"
    - "RTL test pattern: all imports at top, vi.fn() const declared before vi.mock, importOriginal async spread"
    - "Skeleton loading state for WaitlistAnalyticsReport metric cards (grid of 4 Skeleton divs)"
    - "heatmapBgColor: oklch interpolation with max===0 guard to prevent CSS NaN (T-08-03-03 mitigation)"

key-files:
  created:
    - bar-pos/src/widgets/ComboMixReport/ComboMixReport.tsx
    - bar-pos/src/widgets/ComboMixReport/index.ts
    - bar-pos/src/widgets/ComboMixReport/ComboMixReport.test.tsx
    - bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.tsx
    - bar-pos/src/widgets/RecipeVarianceReport/index.ts
    - bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.test.tsx
    - bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.tsx
    - bar-pos/src/widgets/WaitlistAnalyticsReport/index.ts
    - bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.test.tsx
    - bar-pos/src/widgets/RefundsRegister/RefundsRegister.tsx
    - bar-pos/src/widgets/RefundsRegister/index.ts
    - bar-pos/src/widgets/RefundsRegister/RefundsRegister.test.tsx
    - bar-pos/src/widgets/ComboOverrideReport/ComboOverrideReport.tsx
    - bar-pos/src/widgets/ComboOverrideReport/index.ts
  modified: []

key-decisions:
  - "ComboMixReport and RecipeVarianceReport widget files existed in the repo (pre-created stub); import order lint errors were present and fixed as Rule 1 auto-fix"
  - "RTL test pattern changed from post-mock imports to pre-declared vi.fn() const + vi.mock with importOriginal spread — matches CategoryRevenuePanel.test.tsx reference pattern"
  - "ReceiptX is not a valid lucide-react icon; replaced with Receipt (Rule 1 bug fix)"
  - "Skeleton test selector changed from [class*=skeleton] to [class*=animate-pulse] — matches actual Skeleton component output from shared/ui/skeleton.tsx"
  - "WaitlistAnalyticsReport uses Skeleton grid (not LoadingSpinner) for loading state — matches 08-UI-SPEC metric card skeleton rule"
  - "ComboOverrideReport has no RTL tests — per plan must_haves: no conditional rendering or math logic warranting RTL coverage"
  - "RefundsRegister omits manager_pin_approved_by column — column does not exist in DB (RESEARCH.md Risk 2)"

requirements-completed: [S6-03, S6-04, S6-05, S6-06, S6-09]

duration: 25min
completed: 2026-04-26
---

# Phase 08 Plan 03: Wave 4 Report Widgets Summary

**Five FSD widget components with RTL tests — ComboMixReport (stacked bar + emerald top-row), RecipeVarianceReport (amber variance highlight), WaitlistAnalyticsReport (metric cards + heatmap), RefundsRegister (totals row, no Manager column), ComboOverrideReport (audit table)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-26T13:40:00Z
- **Completed:** 2026-04-26T13:48:00Z
- **Tasks:** 2 of 2
- **Files created:** 14

## Accomplishments

### Task 1: ComboMixReport + RecipeVarianceReport widgets

- `ComboMixReport`: stacked recharts `BarChart` aggregated by day-of-week + summary `Table` sorted by netRevenue descending. Top row gets `border-l-2 border-l-emerald-500 bg-emerald-500/5`. ExportButtons with `as never` cast for Plan 08-04.
- `RecipeVarianceReport`: standard table with amber left-border row highlight (`border-l-4 border-l-amber-400 bg-amber-50/5`) when `Math.abs(variancePct) > 10`. Totals row with `border-t-2 font-semibold bg-muted/20`.
- Fixed import order lint errors in both `.tsx` and `.test.tsx` files (features before entities; testing-library before vitest).
- Restructured test files to use pre-declared `vi.fn()` pattern matching `CategoryRevenuePanel.test.tsx` — avoids post-mock import lint violations.
- 8 RTL tests: loading, empty state, data rendering, highlight class per widget.

### Task 2: WaitlistAnalyticsReport + RefundsRegister + ComboOverrideReport widgets

- `WaitlistAnalyticsReport`: 4 metric cards (Parties Seated, No-Show Rate, Avg Quoted Wait, Avg Actual Wait) with `text-xl font-semibold` values + Skeleton loading state. 24-cell hourly heatmap grid with `heatmapBgColor` oklch interpolation (max===0 guard per T-08-03-03).
- `RefundsRegister`: Date / Operator / Tab / Items / Amount / Reason / Restock columns. Totals row: `border-t-2 font-semibold`. Manager/Approved column intentionally omitted.
- `ComboOverrideReport`: Timestamp / Actor / Combo / Reason table. No RTL tests (no conditional logic per plan must_haves).
- 10 RTL tests: loading state, empty state, data rendering, metric card labels, heatmap label, totals sum, forbidden column check.

## Task Commits

1. **Task 1: ComboMixReport + RecipeVarianceReport** — `c5d5743` (feat)
2. **Task 2: WaitlistAnalyticsReport + RefundsRegister + ComboOverrideReport** — `a8e71a4` (feat)

## Files Created

- `bar-pos/src/widgets/ComboMixReport/ComboMixReport.tsx` — stacked bar + emerald top-row summary
- `bar-pos/src/widgets/ComboMixReport/index.ts`
- `bar-pos/src/widgets/ComboMixReport/ComboMixReport.test.tsx` — 4 RTL tests
- `bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.tsx` — amber variance highlight
- `bar-pos/src/widgets/RecipeVarianceReport/index.ts`
- `bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.test.tsx` — 4 RTL tests
- `bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.tsx` — metric cards + heatmap
- `bar-pos/src/widgets/WaitlistAnalyticsReport/index.ts`
- `bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.test.tsx` — 5 RTL tests
- `bar-pos/src/widgets/RefundsRegister/RefundsRegister.tsx` — totals row; no Manager column
- `bar-pos/src/widgets/RefundsRegister/index.ts`
- `bar-pos/src/widgets/RefundsRegister/RefundsRegister.test.tsx` — 5 RTL tests
- `bar-pos/src/widgets/ComboOverrideReport/ComboOverrideReport.tsx` — audit table
- `bar-pos/src/widgets/ComboOverrideReport/index.ts`

## Decisions Made

- `ComboMixReport` and `RecipeVarianceReport` widget files existed as pre-created stubs with import order lint errors — fixed as Rule 1 auto-fix.
- RTL test pattern changed to pre-declared `vi.fn()` const (all imports at top) matching `CategoryRevenuePanel.test.tsx` — avoids ESLint `import/order` violations from post-mock imports.
- `ReceiptX` is not a valid lucide-react icon; `Receipt` used instead (Rule 1 bug fix).
- Skeleton test selector uses `[class*="animate-pulse"]` (actual class from `shared/ui/skeleton.tsx`).
- `ComboOverrideReport` intentionally has no RTL test file — no conditional rendering or math warranting coverage per plan `must_haves`.
- `RefundsRegister` `manager_pin_approved_by` column omitted per RESEARCH.md Risk 2 (column not in DB DDL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import order lint errors in pre-existing widget stubs**
- **Found during:** Task 1 lint run
- **Issue:** `@features/export-report` import placed after `@entities/*` import in `.tsx` files; `vitest` import before `@testing-library/react` in `.test.tsx` files
- **Fix:** Reordered imports to features → entities → shared hierarchy; moved `vitest` after testing-library; restructured test files to use `vi.fn()` pre-declaration pattern (all imports at top)
- **Files modified:** `ComboMixReport.tsx`, `ComboMixReport.test.tsx`, `RecipeVarianceReport.tsx`, `RecipeVarianceReport.test.tsx`
- **Commit:** `c5d5743`

**2. [Rule 1 - Bug] ReceiptX icon does not exist in lucide-react**
- **Found during:** Task 2 test run
- **Issue:** `import { ReceiptX } from 'lucide-react'` — icon name invalid; React renders `undefined` component causing test failure
- **Fix:** Changed import to `Receipt`
- **Files modified:** `RefundsRegister.tsx`
- **Commit:** `a8e71a4`

**3. [Rule 1 - Bug] Skeleton test selector matched 0 elements**
- **Found during:** Task 2 test run
- **Issue:** Selector `[class*="skeleton"]` doesn't match — `Skeleton` renders `<div className="animate-pulse rounded-md bg-muted ...">`
- **Fix:** Changed selector to `[class*="animate-pulse"]`
- **Files modified:** `WaitlistAnalyticsReport.test.tsx`
- **Commit:** `a8e71a4`

## Known Stubs

- `WaitlistAnalyticsReport` heatmap `hourCounts`: all 24 hours initialized to `count: 0` — `waitlist_metrics_daily` view does not include hourly breakdown. The heatmap structure is correct and renders all 24 cells; real hourly counts require a future view extension or additional query. Plan 08-04 wires the widget to `ReportsPage` but does not need to resolve this stub.
- `RefundsRegister` `row.items.length` column: `RefundRegisterRow.items` is always `[]` per the stub documented in Plan 08-02 SUMMARY — `items` count renders as `0` for all rows. Plan 08-02 decision: wire full item details in a future plan.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All widgets are read-only display components consuming existing TanStack Query hooks gated by Supabase RLS. `RefundsRegister` inherits `canAccess(role, 'view_reports')` check via `ExportButtons` and will be further gated by `ReportsRoute` in Plan 08-04 (two-layer RBAC — T-08-03-01 mitigated). `heatmapBgColor` max===0 guard prevents CSS NaN (T-08-03-03 mitigated).

## Self-Check: PASSED

- `ComboMixReport.tsx` contains `useComboMixReport` ✓
- `RecipeVarianceReport.tsx` contains `border-l-amber-400` ✓
- `RecipeVarianceReport.tsx` does NOT contain `variant.*destructive` ✓
- `WaitlistAnalyticsReport.tsx` contains `partiesSeated` and `Queue Length by Hour` ✓
- `RefundsRegister.tsx` does NOT contain `Manager` or `Approved` ✓
- `RefundsRegister.tsx` contains `border-t-2 font-semibold` ✓
- `ComboOverrideReport.tsx` contains `useComboOverrides` ✓
- All 5 index.ts files export their component ✓
- Commits `c5d5743` and `a8e71a4` exist ✓
- 109 test files, 1076 tests pass (was 1058 after Plan 08-02; +18 new tests) ✓
- Lint: 11 errors (all pre-existing; 0 new widget errors) ✓
