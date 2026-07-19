---
phase: 22-edit-paid-ticket-history
plan: 04
subsystem: edit-history-view
tags: [react, i18n, rbac, audit-log, home-dashboard]
dependency_graph:
  requires:
    - "22-01: AuditActionSchema 'tab.edit_paid' enum registration"
  provides:
    - "src/widgets/EditHistoryTable — filtered read-only audit table widget"
    - "/edit-history route (guarded by view_audit_log)"
  affects:
    - "src/app/router.tsx"
    - "src/widgets/HomeDashboard/ui/HomeDashboard.tsx"
tech_stack:
  added: []
  patterns:
    - "Filtered clone of AuditLogTable (hardcoded action filter, no filter bar)"
    - "Route-guard-by-permission reuse (no new RBAC action for the route itself)"
key_files:
  created:
    - src/widgets/EditHistoryTable/EditHistoryTable.tsx
    - src/widgets/EditHistoryTable/index.ts
    - src/app/edit-history-route.tsx
    - src/pages/edit-history/index.tsx
  modified:
    - src/app/router.tsx
    - src/widgets/HomeDashboard/ui/HomeDashboard.tsx
    - src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
    - src/shared/lib/i18n/locales/es-MX/wAdmin.json
    - src/shared/lib/i18n/locales/en-US/wAdmin.json
    - src/shared/lib/i18n/locales/es-MX/wPanels.json
    - src/shared/lib/i18n/locales/en-US/wPanels.json
    - src/shared/lib/i18n/locales/es-MX/pages.json
    - src/shared/lib/i18n/locales/en-US/pages.json
decisions:
  - "es-MX values for genuinely new keys (editHistoryTable.*, homeDashboard.tiles.editHistory, pages.editHistory.title) got natural Spanish translations, not byte-identical-to-English copies — unlike pre-existing keys, there is no pre-migration hardcoded literal to preserve for a brand-new page (per plan's explicit instruction, distinct from Phase 21's general convention)"
  - "'tab.edit_paid' literal passed to useAuditLogs({ action: ... }) needed a scoped eslint-disable-next-line i18next/no-literal-string comment (AuditAction enum identifier, not UI copy) — the global config's object-properties exclude list doesn't include 'action' since that key is used elsewhere for genuine UI copy"
metrics:
  duration: ~45m
  completed: 2026-07-19
status: complete
---

# Phase 22 Plan 04: Edit History View Summary

Read-only `/edit-history` page listing only `tab.edit_paid` audit entries with Reason/Ticket columns and a diff drill-down, reusing the existing AuditLogTable shell verbatim.

## What Was Built

- **`EditHistoryTable` widget** (`src/widgets/EditHistoryTable/`) — a filtered clone of `AuditLogTable.tsx`: calls `useAuditLogs({ action: 'tab.edit_paid' })` with no user-facing filter bar, keeps the base `action`/`entityType`/`actor`/`createdAt`/`source` columns (including the sr-only "View diff" trigger button preserving the e2e/38 a11y contract), and adds two new columns — `reason` (reads `after.reason`, falls back to `—`) and `ticket` (reads `entityId`, sliced to 8 chars, falls back to `—`). Row click and the sr-only trigger both open the unmodified `AuditLogDetailSheet`/`JsonDiffViewer`. All copy resolves through `useTranslation('wAdmin')`'s new `editHistoryTable.*` key group.
- **`/edit-history` route** — `EditHistoryRoute` (exact clone of `AuditRoute`, reusing `view_audit_log`, no new RBAC action per RESEARCH.md A3) wraps a thin `EditHistoryPage` container (mirrors `pages/audit/index.tsx`, `PageContainer` + `pages.editHistory.title`). Registered in `router.tsx` immediately after the `/audit` route block, lazy-loaded.
- **Home dashboard reachability** — added a `/edit-history` tile to `HomeDashboard`'s `ITEMS` array (lucide `History` icon, gated on `view_audit_log`, "Manager" badge when locked), matching the `/audit` tile's shape exactly.
- **i18n** — `editHistoryTable.*` (14 keys) added to `wAdmin.json`, `homeDashboard.tiles.editHistory` added to `wPanels.json`, `editHistory.title` added to `pages.json`, all in both `es-MX`/`en-US` with byte-identical key sets confirmed via a script diff.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `eslint-plugin-i18next` flagged the hardcoded `action: 'tab.edit_paid'` value**
- **Found during:** Task 1 lint verification
- **Issue:** `useAuditLogs({ action: 'tab.edit_paid' })`'s object-property value tripped `i18next/no-literal-string` — `action` is not in the committed config's `object-properties.exclude` list (unlike `status`/`accessorKey`), because that key is genuinely user-facing copy in other call sites.
- **Fix:** Added a scoped `// eslint-disable-next-line i18next/no-literal-string -- AuditAction enum identifier, not UI copy` comment on that one line, matching the established codebase precedent (`ComboBuilderForm.tsx`, `WaitlistAnalyticsReport.tsx`) rather than widening the global exclude list.
- **Files modified:** `src/widgets/EditHistoryTable/EditHistoryTable.tsx`
- **Commit:** `6ec412e`

**2. [Rule 1 - Bug] `HomeDashboard.test.tsx`'s hardcoded lock-icon count went stale**
- **Found during:** Task 3 full-suite regression run
- **Issue:** `gated buttons show lock icon for bartender` asserted `lockIcons.length` === a hardcoded `8`. Adding the new gated `/edit-history` tile made the real count `9`, failing the test — same category of stale-hardcoded-count regression documented in Phase 21's `PermissionMatrix.test.tsx` fix.
- **Fix:** Updated the expected count to `9` and the inline comment listing the gated tile set.
- **Files modified:** `src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx`
- **Commit:** `6b3ebbd`

**3. [Rule 3 - Blocking] Import-order lint violation in the new widget**
- **Found during:** Task 1 lint verification
- **Issue:** `import { AuditLogDetailSheet } from '@widgets/AuditLogTable/AuditLogDetailSheet'` was placed after the `@entities/audit-log` import, violating `import/order` (widgets-layer import must sort before entities-layer per the project's group ordering).
- **Fix:** Reordered the import block so the cross-widget import comes first.
- **Files modified:** `src/widgets/EditHistoryTable/EditHistoryTable.tsx`
- **Commit:** `6ec412e`

No auth gates encountered. No architectural changes needed.

## Known Stubs

None — the widget is fully wired to the live `useAuditLogs` hook and the real `AuditLogDetailSheet`; there is no mock/placeholder data path. (The underlying `tab.edit_paid` audit rows themselves are only produced once the 22-03 `edit-paid-tab` feature ships and a manager actually saves a correction — this plan's own SC-4 acceptance is scoped to "the view renders and gates correctly," with the full real-edit-appears-and-diff-opens flow verified end-to-end by 22-05's E2E spec, as stated in the plan's `<verification>` section.)

## Threat Flags

None — both `T-22-05` (route access) and `T-22-06` (rendering `after.reason`) from the plan's threat model were mitigated exactly as specified (route gated on `view_audit_log`; `after.reason` rendered as plain text, no `dangerouslySetInnerHTML`). No new trust-boundary surface introduced beyond what the threat model already covers.

## Verification

- `npm run typecheck` — clean (only the 2 pre-existing unrelated errors in `src/entities/tab/model/queries.ts:788` and `src/shared/lib/agent/rag.ts:60`)
- `npm run lint` — full-repo run exits 0, zero `i18next/no-literal-string` violations
- Locale JSON valid in both locales; scripted key-set diff confirmed `wPanels`/`wAdmin`/`pages` have zero one-sided keys between `es-MX` and `en-US`
- `npm run test` — 140 files / 1254 tests pass, 15 todo, 2 skipped, zero regressions (after the Rule 1 `HomeDashboard.test.tsx` fix)
- `/edit-history` registered in `router.tsx`, wrapped in `ProtectedRoute` + `EditHistoryRoute`; reachable via a new gated Home tile

## Self-Check: PASSED

- FOUND: src/widgets/EditHistoryTable/EditHistoryTable.tsx
- FOUND: src/widgets/EditHistoryTable/index.ts
- FOUND: src/app/edit-history-route.tsx
- FOUND: src/pages/edit-history/index.tsx
- FOUND commit: 6ec412e
- FOUND commit: c99fcc1
- FOUND commit: 6b3ebbd
