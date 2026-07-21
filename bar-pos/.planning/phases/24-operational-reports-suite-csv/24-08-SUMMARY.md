---
phase: 24-operational-reports-suite-csv
plan: 08
subsystem: ui
tags: [react, tanstack-table, i18next, reports, csv-export]

requires:
  - phase: 24-operational-reports-suite-csv (plan 06)
    provides: useDeletionsPreReport / useDeletionsPostReport hooks over get_deletions_pre_report / get_deletions_post_report RPCs
  - phase: 24-operational-reports-suite-csv (plan 02)
    provides: generic CSV exporter (rowsToCsv/csvToBytes) + ExportButtons -csv branches, incl. deletions-pre/deletions-post reportType support
provides:
  - DeletionsPreSendPanel widget (DataTable + standing historical-gap Alert, reportType=deletions-pre)
  - DeletionsPostCloseReport widget (DataTable, no banner, reportType=deletions-post)
  - Alert/AlertTitle/AlertDescription/AlertAction now re-exported from the src/shared/ui barrel (previously unexported despite the underlying alert.tsx primitive already existing)
  - deletionsPreSendPanel.column* / deletionsPostCloseReport.column* i18n keys (es-MX + en-US, wAdmin namespace)
affects: [24-09 (sibling wave-5 widgets, no file overlap), reports page wiring (later plan adds the 2 new TabsTrigger/TabsContent pairs)]

tech-stack:
  added: []
  patterns:
    - "VoidRefundPanel-shaped DataTable widget: useQuery result -> rows via result.ok ? result.data : [] -> ColumnDef[] -> DataTable(toolbar=ExportButtons, emptyState=EmptyState)"
    - "Standing (non-dismissible) shared/ui Alert banner rendered unconditionally above a DataTable, wrapped in a <div className=\"space-y-4\"> root"

key-files:
  created:
    - src/widgets/DeletionsPreSendPanel/DeletionsPreSendPanel.tsx
    - src/widgets/DeletionsPreSendPanel/index.ts
    - src/widgets/DeletionsPostCloseReport/DeletionsPostCloseReport.tsx
    - src/widgets/DeletionsPostCloseReport/index.ts
  modified:
    - src/shared/ui/index.ts
    - src/shared/lib/i18n/locales/es-MX/wAdmin.json
    - src/shared/lib/i18n/locales/en-US/wAdmin.json

key-decisions:
  - "Barrel-exported Alert/AlertTitle/AlertDescription/AlertAction from src/shared/ui/index.ts — the primitive (src/shared/ui/alert.tsx) already existed but was never wired into the single allowed barrel file, which would have blocked the plan's specified `@shared/ui` import (Rule 3 blocking-issue auto-fix)."
  - "Added column-header i18n keys (columnOrderId/columnItemName/columnRemovedAt/columnTabId/columnEditedAt/columnStaffName/columnReason/columnFieldsChanged) under the pre-existing deletionsPreSendPanel/deletionsPostCloseReport wAdmin namespace blocks — UI-SPEC only specified empty-state and historical-gap copy, not column headers, so these were authored following the existing columnX naming convention from voidRefundPanel/auditLogTable."
  - "DeletionsPostCloseReport also wraps its DataTable in a <div className=\"space-y-4\"> root (matching the plan's Task 2 action text) even without a banner, keeping both sibling widgets structurally identical for future additions."

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "DeletionsPreSendPanel renders a DataTable of order_item.remove rows with a standing historical-gap Alert always visible above it, and an ExportButtons reportType='deletions-pre'"
    requirement: "SC-3"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json (no new errors from this file) + grep gate: includes useDeletionsPreReport/AlertTriangle/historicalGap/reportType="
        status: pass
    human_judgment: true
    rationale: "Visual rendering (Alert always-visible above table, correct column formatting) and the Reports-page tab wiring itself are not yet integration-tested — this plan only builds the widget in isolation; the page-level TabsContent wiring is a later plan's scope."
  - id: D2
    description: "DeletionsPostCloseReport renders a DataTable of tab.edit_paid rows with NO historical-gap banner, and an ExportButtons reportType='deletions-post'"
    requirement: "SC-3"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json (no new errors from this file) + grep gate: includes useDeletionsPostReport/reportType=, excludes historicalGap"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — widget built and typechecked in isolation; full page-level render/UAT deferred to the Reports page wiring plan."

duration: 20min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 08: Deletions Report Widgets Summary

**Two VoidRefundPanel-shaped DataTable widgets for order-item deletions — DeletionsPreSendPanel with a permanent historical-gap Alert, DeletionsPostCloseReport without one — both wired to their Plan-06 report hooks and Plan-02 CSV export.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-21T20:55:53Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `DeletionsPreSendPanel` — 5-column DataTable (orderId/itemName/removedAt/staffName/reason) plus a standing, non-dismissible `Alert` (AlertTriangle icon, default variant) rendered unconditionally above the table, stating the report only covers data since this phase's audit went live
- `DeletionsPostCloseReport` — 5-column DataTable (tabId/editedAt/staffName/reason/fieldsChanged) with no banner, since Phase 22 already audits `tab.edit_paid` from its own ship date
- Both widgets expose `ExportButtons` with their respective `reportType` (`deletions-pre`/`deletions-post`), passing `{ rows, dateRange }`, and contain no chart component (D-16)

## Task Commits

Each task was committed atomically:

1. **Task 1: DeletionsPreSendPanel (DataTable + standing historical-gap Alert)** - `13d2c85` (feat)
2. **Task 2: DeletionsPostCloseReport (DataTable, no banner)** - `4d257c9` (feat)

## Files Created/Modified
- `src/widgets/DeletionsPreSendPanel/DeletionsPreSendPanel.tsx` - Pre-send deletions DataTable + standing historical-gap Alert + ExportButtons
- `src/widgets/DeletionsPreSendPanel/index.ts` - Barrel export
- `src/widgets/DeletionsPostCloseReport/DeletionsPostCloseReport.tsx` - Post-close corrections DataTable + ExportButtons, no banner
- `src/widgets/DeletionsPostCloseReport/index.ts` - Barrel export
- `src/shared/ui/index.ts` - Added `Alert`/`AlertTitle`/`AlertDescription`/`AlertAction` to the shared/ui barrel (previously unexported)
- `src/shared/lib/i18n/locales/es-MX/wAdmin.json` - Added column-header keys for both widgets
- `src/shared/lib/i18n/locales/en-US/wAdmin.json` - Added column-header keys for both widgets

## Decisions Made
- Barrel-exported the pre-existing `Alert` primitive from `src/shared/ui/index.ts` rather than importing directly from `@shared/ui/alert`, matching the plan's specified `@shared/ui`-barrel import shape and the codebase's "only allowed barrel" convention.
- Authored column-header i18n keys following the existing `columnX` naming convention (`voidRefundPanel`/`auditLogTable`) since UI-SPEC only specified empty-state/historical-gap copy for these two widgets, not column headers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Barrel-exported the shared/ui Alert primitive**
- **Found during:** Task 1 (DeletionsPreSendPanel)
- **Issue:** `src/shared/ui/alert.tsx` (shadcn `Alert`/`AlertTitle`/`AlertDescription`/`AlertAction`) already existed in the codebase but was never re-exported from `src/shared/ui/index.ts` — the plan's specified import (`import { ..., Alert, AlertTitle, AlertDescription } from '@shared/ui'`) would fail to compile.
- **Fix:** Added `export { Alert, AlertTitle, AlertDescription, AlertAction } from './alert';` to the barrel, alongside the existing shadcn-primitive exports.
- **Files modified:** `src/shared/ui/index.ts`
- **Verification:** `npx tsc --noEmit` produces no new errors referencing this import; grep gate for `AlertTriangle`/`historicalGap` passes.
- **Committed in:** `13d2c85` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added column-header i18n keys**
- **Found during:** Task 1 and Task 2
- **Issue:** UI-SPEC's Copywriting Contract only specified `emptyTitle`/`emptyDescription`/`historicalGapTitle`/`historicalGapDescription` keys (already present in both locale files from an earlier plan) — no column-header keys existed, but the "no hardcoded UI strings" i18next lint gate (D-05) requires every rendered string to resolve to a translation key.
- **Fix:** Added `columnOrderId`/`columnItemName`/`columnRemovedAt`/`columnStaffName`/`columnReason` (pre-send) and `columnTabId`/`columnEditedAt`/`columnStaffName`/`columnReason`/`columnFieldsChanged` (post-close) to both `es-MX/wAdmin.json` and `en-US/wAdmin.json`, following the existing `columnX` naming pattern.
- **Files modified:** `src/shared/lib/i18n/locales/es-MX/wAdmin.json`, `src/shared/lib/i18n/locales/en-US/wAdmin.json`
- **Verification:** `npx eslint` on both new widget files reports no `i18next/no-literal-string` violations.
- **Committed in:** `13d2c85` (Task 1 commit; both locale files touched in that single commit since the keys for both widgets were added together)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes were required for the widgets to compile and pass lint as specified by the plan and CLAUDE.md's i18n enforcement gate. No scope creep — no new dependencies, no architectural changes.

## Issues Encountered
- `npx tsc --noEmit -p tsconfig.json` reports several pre-existing errors unrelated to this plan's files (`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/rag.ts`, `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx`) — these belong to other in-flight Phase 24 plans/waves and are out of scope per the executor's scope-boundary rule. Not fixed; logged here rather than in a separate deferred-items.md since they don't touch any file this plan modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both widgets are ready to be wired into `src/pages/reports/index.tsx`'s `TabsTrigger`/`TabsContent` pairs (deletions-pre / deletions-post tabs) by a later plan in this phase (per 24-PATTERNS.md's `src/pages/reports/index.tsx` file classification).
- No blockers for the sibling wave-5 plan (24-09) — no file overlap.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED

All 4 created files found on disk; both task commits (`13d2c85`, `4d257c9`) found in git log.
