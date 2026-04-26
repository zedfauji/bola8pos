---
phase: 08-polish-reports-e2e-hardening
plan: 04
subsystem: reporting
tags: [export, excel, pdf, report-tabs, fsd, export-type, export-buttons, reports-page]

requires:
  - phase: 08-polish-reports-e2e-hardening
    plan: 03
    provides: ComboMixReport, RecipeVarianceReport, WaitlistAnalyticsReport, RefundsRegister, ComboOverrideReport widgets with as-never casts

provides:
  - ExportType union with 23 variants (14 existing + 9 new)
  - ExportButtons Props union with 12 branches (7 existing + 5 new)
  - 5 Excel workbook builders in excel.ts
  - 4 PDF builder functions in pdf.tsx (combo-overrides has no PDF)
  - ReportsPage with 12 tabs (flex-wrap TabsList)
  - All as-never casts removed from 5 widget files

affects:
  - ReportsPage (/reports route) now shows all 12 report tabs

tech-stack:
  added: []
  patterns:
    - "ExportType discriminated union extended with 9 new variants — overload signatures per existing pattern"
    - "ExportButtons handleExport: else-if chain extended (no switch — TypeScript discriminated union via reportType)"
    - "excel.ts workbook builders: aoa_to_sheet with [title], [], header pattern; moneyCell for money columns"
    - "pdf.tsx builders: React.createElement(Doc, props) via docToBytes helper; same styles object reused"
    - "TabsList className='mb-4 flex flex-wrap' for 12-tab overflow on narrow Tauri window"

key-files:
  created: []
  modified:
    - bar-pos/src/features/export-report/model/useExportReport.ts
    - bar-pos/src/features/export-report/ui/ExportButtons.tsx
    - bar-pos/src/shared/lib/exporters/excel.ts
    - bar-pos/src/shared/lib/exporters/pdf.tsx
    - bar-pos/src/pages/reports/index.tsx
    - bar-pos/src/widgets/ComboMixReport/ComboMixReport.tsx
    - bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.tsx
    - bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.tsx
    - bar-pos/src/widgets/RefundsRegister/RefundsRegister.tsx
    - bar-pos/src/widgets/ComboOverrideReport/ComboOverrideReport.tsx

key-decisions:
  - "TabsTrigger count of 13 from grep -c includes the import line — actual JSX trigger count is 12 (lines 52-63)"
  - "combo-overrides has no PDF builder — Excel only, per plan spec (audit log does not benefit from PDF format)"
  - "ExportButtons handleExport uses else-if chain (not switch) — consistent with existing pattern in the file"

requirements-completed: [S6-07, S6-08]

duration: 20min
completed: 2026-04-26
---

# Phase 08 Plan 04: Export Infrastructure + ReportsPage Wiring Summary

**ExportType union extended to 23 variants + ExportButtons to 12 branches + 5 Excel builders + 4 PDF builders + ReportsPage wired with 12 tabs and flex-wrap TabsList; all as-never casts removed from widget files.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-26T19:37:00Z
- **Completed:** 2026-04-26T19:57:00Z
- **Tasks:** 2 of 2
- **Files modified:** 10

## Accomplishments

### Task 1: Extend ExportType + ExportButtons + workbook builders

- `useExportReport.ts`: ExportType extended with 9 new variants (`combo-mix-excel`, `combo-mix-pdf`, `recipe-variance-excel`, `recipe-variance-pdf`, `waitlist-analytics-excel`, `waitlist-analytics-pdf`, `refunds-register-excel`, `refunds-register-pdf`, `combo-overrides-excel`). Five new context types added. Five new overload signatures added. Nine new switch cases inserted before `default`.
- `ExportButtons.tsx`: Imports extended with 5 new domain types. Five new Props types (`ComboMixProps`, `RecipeVarianceProps`, `WaitlistAnalyticsProps`, `RefundsRegisterProps`, `ComboOverridesProps`) added. Props union extended to 12 branches. `handleExport` extended with 5 new `else if` branches.
- `excel.ts`: Imports extended with 5 new domain types. Five new workbook builders added (`comboMixToWorkbook`, `recipeVarianceToWorkbook`, `waitlistMetricsToWorkbook`, `refundsRegisterToWorkbook`, `comboOverridesToWorkbook`) following the `aoa_to_sheet` + `moneyCell` pattern.
- `pdf.tsx`: Imports extended with 4 new domain types. Four new PDF builder Document components + exported async functions added (`comboMixToPdfBytes`, `recipeVarianceToPdfBytes`, `waitlistMetricsToPdfBytes`, `refundsRegisterToPdfBytes`). No PDF for combo-overrides (Excel only per plan).
- All 5 widget files: `as never` casts removed from `reportType` and `data` props — now use proper typed props.

### Task 2: Wire 5 new tabs into ReportsPage

- `pages/reports/index.tsx`: 5 new widget imports added in alphabetical order within `@widgets/*` group. `TabsList` updated to `className="mb-4 flex flex-wrap"`. 5 new `TabsTrigger` entries added (combos, variance, waitlist, refunds-reg, overrides) — 12 total JSX triggers. 5 new `TabsContent` blocks appended with `DateRangePicker` + widget pattern matching existing tabs.
- All 109 test files, 1076 tests pass after changes.

## Task Commits

1. **Task 1: Extend ExportType + ExportButtons + workbook builders** — `9dbfe0e` (feat)
2. **Task 2: Wire 5 analytics tabs into ReportsPage** — `40f8480` (feat)

## Files Modified

- `bar-pos/src/features/export-report/model/useExportReport.ts` — ExportType +9 variants, +5 context types, +5 overloads, +9 switch cases
- `bar-pos/src/features/export-report/ui/ExportButtons.tsx` — +5 Props types, Props union extended to 12, +5 handleExport branches
- `bar-pos/src/shared/lib/exporters/excel.ts` — +5 workbook builder functions
- `bar-pos/src/shared/lib/exporters/pdf.tsx` — +4 PDF builder functions
- `bar-pos/src/pages/reports/index.tsx` — +5 widget imports, TabsList flex-wrap, +5 TabsTrigger, +5 TabsContent
- `bar-pos/src/widgets/ComboMixReport/ComboMixReport.tsx` — as-never cast removed
- `bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.tsx` — as-never cast removed
- `bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.tsx` — as-never cast removed
- `bar-pos/src/widgets/RefundsRegister/RefundsRegister.tsx` — as-never cast removed
- `bar-pos/src/widgets/ComboOverrideReport/ComboOverrideReport.tsx` — as-never cast removed

## Decisions Made

- `combo-overrides` has no PDF builder — Excel only per plan spec (audit log table does not warrant PDF format).
- `ExportButtons.handleExport` uses `else if` chain consistent with existing pattern in the file (not a switch statement).
- `grep -c "TabsTrigger"` returns 13 because it includes the import line — actual JSX `<TabsTrigger` element count is 12.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

Inherited from Plan 08-03 (not introduced in this plan):
- `WaitlistAnalyticsReport` heatmap `hourCounts`: all 24 hours initialized to `count: 0` — hourly breakdown requires future view extension.
- `RefundsRegister` `row.items.length` column: `RefundRegisterRow.items` is always `[]` — renders as `0` for all rows.

These stubs do not prevent the plan's goal (wiring tabs to ReportsPage) from being achieved.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All new code is export/display logic. ExportButtons `canAccess(role, 'view_reports')` RBAC gate is inherited automatically by all 5 new `reportType` branches (T-08-04-01 mitigated). SheetJS `aoa_to_sheet` with string data never sets `.t: 'f'` — formula injection not possible (T-08-04-02 accepted). `assertDateRangeValid` in query hooks bounds export data size to 365 days (T-08-04-03 mitigated).

## Self-Check: PASSED

- `combo-mix-excel` in `useExportReport.ts` line 65 ✓
- `reportType: 'combo-mix'` in `ExportButtons.tsx` line 65 ✓
- `comboMixToWorkbook` in `excel.ts` line 231 ✓
- No `as never` casts in any of the 5 widget directories ✓
- `TabsTrigger value="combos"` in `pages/reports/index.tsx` line 59 ✓
- `TabsTrigger value="refunds-reg"` in `pages/reports/index.tsx` line 62 ✓
- `flex flex-wrap` in `pages/reports/index.tsx` line 51 ✓
- Commits `9dbfe0e` and `40f8480` exist ✓
- 109 test files, 1076 tests pass ✓
