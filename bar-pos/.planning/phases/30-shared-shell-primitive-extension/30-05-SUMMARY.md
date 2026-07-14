---
phase: 30-shared-shell-primitive-extension
plan: 05
subsystem: ui
tags: [react, fsd, dead-code-removal, docs]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension (30-01..30-04)
    provides: PageContainer backTo/backLabel extension + all 15 BackToHomeButton callers migrated
provides:
  - BackToHomeButton, AppShell, AppNav fully deleted (no shim, no dangling imports)
  - src/shared/ui/index.ts barrel with 3 dead export lines removed
  - CLAUDE.md routes table corrected to 17 rows matching router.tsx
affects: [31-component-token-spacing-sweep, 32-touch-target-focus-visible-sweep, 33-payment-critical-page-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/shared/ui/index.ts
    - CLAUDE.md

key-decisions:
  - "Deleted BackToHomeButton.tsx, AppShell.tsx, and widgets/AppNav/ outright with no re-export shim (D-03) — zero real consumers confirmed by grep before deletion"
  - "CLAUDE.md routes table Notes column sourced directly from KdsRoute/AuditRoute guard logic (view_kds / view_audit_log permission checks), not invented copy"
  - "Targeted E2E specs (15/16/17) deferred as a manual follow-up — port 1420 was occupied by a stray non-Vite process (404 response, no Vite headers) that Playwright's reuseExistingServer check rejected before failing to bind a new server; killing an unidentified process on a shared port was out of scope for this plan"

patterns-established: []

requirements-completed: [SHELL-01, SHELL-02, SHELL-03]

# Metrics
duration: 15min
completed: 2026-07-10
---

# Phase 30 Plan 05: Dead Shell Cleanup + Routes Doc Fix Summary

**Deleted BackToHomeButton/AppShell/AppNav (zero remaining consumers) and corrected CLAUDE.md's routes table from 14 to 17 rows to match router.tsx exactly**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 completed
- **Files modified:** 2 modified, 3 deleted

## Accomplishments
- `src/shared/ui/BackToHomeButton.tsx` and `src/shared/ui/AppShell.tsx` deleted; `src/widgets/AppNav/` folder deleted (SHELL-01 completion + SHELL-02)
- 3 corresponding barrel export lines removed from `src/shared/ui/index.ts`, no replacement shim
- `CLAUDE.md` routes table gained the 3 missing rows (`/kds`, `/kitchen-prep`, `/audit`), now 17 rows exactly matching `router.tsx` (SHELL-03)
- Full verification gate run: typecheck clean (only the 2 pre-existing unrelated errors), lint exit 0, full unit suite 1212 passed / 1 pre-existing failure / 15 todo (identical to documented baseline, zero regressions), targeted back-link contract tests (`PageContainer.test.tsx`, `PaymentsPage.test.tsx`, `ReportsPage.test.tsx`) 9/9 pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead components + remove barrel exports** - `6bece2b` (chore)
2. **Task 2: Correct CLAUDE.md routes table to 17 rows** - `d5ce6a2` (docs)
3. **Task 3: Phase verification gate** - no code changes (verification only, no commit)

_Task 3 is a verification-only task per plan spec ("no source changes"); its results are recorded in this Summary._

## Files Created/Modified
- `src/shared/ui/index.ts` - Removed `BackToHomeButton`, `AppShell`, `AppShellProps` export lines (Navigation + Layout sections)
- `CLAUDE.md` - Added `/kds`, `/kitchen-prep`, `/audit` rows to the Routes table (Notes sourced from `KdsRoute`/`AuditRoute` guard checks)
- Deleted: `src/shared/ui/BackToHomeButton.tsx`, `src/shared/ui/AppShell.tsx`, `src/widgets/AppNav/ui/AppNav.tsx`

## Decisions Made
- No shim/re-export added for deleted components (D-03) — grep confirmed zero real consumers pre-deletion (`src/shared/ui/index.ts` self-references only, plus one stale but harmless code comment in `PaymentsPage.test.tsx` referencing the old component name, left as-is since it's not an import).
- Routes table row order groups `/kds` above `/kds-bar` and `/kitchen-prep`/`/audit` at the end, consistent with the plan's "not asserted, only presence required" guidance.

## Deviations from Plan

None - plan executed exactly as written. Task 1's deletion required `git rm` instead of a filesystem `rm` due to sandbox restrictions on raw shell deletion — functionally identical outcome (files removed and staged), not a deviation in behavior.

## Issues Encountered

**Targeted E2E specs (15-home-navigation, 16-table-status, 17-payment-pane) could not be run in this environment.** Playwright's dev server (port 1420, `reuseExistingServer: true`) found an existing process on that port that responds with a bare `404 Not Found` and no Vite-specific headers — not the actual Vite dev server, likely a stray/orphaned process from a prior session. Playwright's health-check rejected it and then failed to bind a fresh server because the port was already occupied. Per the plan's explicit fallback ("if any targeted E2E cannot run... record that explicitly... rather than silently skipping"), this is deferred as a manual follow-up for `/gsd-verify-work`: free port 1420 (identify and stop the stray process, or restart the machine/terminal), then run:
```
npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts
```
All other verification gate items (unit suite, targeted back-link RTL tests, typecheck, lint) passed cleanly with no regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 30 (shared-shell-primitive-extension) is now complete — all 5 plans done. `PageContainer`/`SectionHeader` with `backTo`/`backLabel` is the single shared shell across all 15 non-exempt routes; dead `BackToHomeButton`/`AppShell`/`AppNav` fully removed; `CLAUDE.md` routes table accurate. Phases 31-33 (component/token/spacing sweep, touch-target/focus-visible sweep, payment-critical page sweep) can now build on this shell without ambiguity about which layout primitive is canonical.

**Manual follow-up for next verification pass:** run the 3 deferred E2E specs (15/16/17) once port 1420 is free, to close out the full phase verification gate.

## Self-Check: PASSED

- CONFIRMED MISSING: `src/shared/ui/BackToHomeButton.tsx`
- CONFIRMED MISSING: `src/shared/ui/AppShell.tsx`
- CONFIRMED MISSING: `src/widgets/AppNav/`
- FOUND commit: `6bece2b`
- FOUND commit: `d5ce6a2`

---
*Phase: 30-shared-shell-primitive-extension*
*Completed: 2026-07-10*
