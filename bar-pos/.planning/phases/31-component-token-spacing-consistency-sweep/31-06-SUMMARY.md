---
phase: 31-component-token-spacing-consistency-sweep
plan: 06
subsystem: ui
tags: [react, formfield, e2e, playwright, accessibility]

# Dependency graph
requires:
  - phase: 31-component-token-spacing-consistency-sweep
    provides: 31-RESEARCH.md's FormField id-clobber pitfall (Pitfall 1) and 31-UI-SPEC.md's file-by-file target mapping
provides:
  - AuditLogFilterBar's 2 date inputs wrapped in FormField with visible labels
  - e2e/38-audit-logs.spec.ts date-from locator switched to getByLabel('Date from') (atomic with the wrap)
  - InventoryPagePanel's signed batch-delta number input wrapped in FormField, native input kept (no MoneyInput)
affects: [31-component-token-spacing-consistency-sweep (other waves), 35-guardrails]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FormField wraps native non-text inputs (date/number) for label consistency, keeping the native input"
    - "FormField's React.cloneElement always overwrites any id prop on its child — any E2E/test locator depending on that id must move to getByLabel(...) in the same commit as the wrap"

key-files:
  created: []
  modified:
    - src/widgets/AuditLogTable/AuditLogFilterBar.tsx
    - e2e/38-audit-logs.spec.ts
    - src/widgets/InventoryPagePanel.tsx

key-decisions:
  - "AuditLogFilterBar wrap and the e2e/38 selector fix landed in the same commit (70ff3ca) — FormField's id clobber would have silently broken the #audit-filter-date-from locator otherwise"
  - "InventoryPagePanel batch-delta kept the native type=number input (not MoneyInput) since it's a signed quantity delta that must allow negative values (D-06, Phase 17 precedent)"

patterns-established: []

requirements-completed: [COMPONENT-02]

# Metrics
duration: 30min
completed: 2026-07-11
---

# Phase 31 Plan 06: FormField wraps for date/number inputs Summary

**Wrapped AuditLogFilterBar's 2 date inputs and InventoryPagePanel's signed batch-delta number input in `FormField`, with the load-bearing e2e/38 date-from locator moved to `getByLabel('Date from')` atomically with the wrap.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-11T13:26:26-06:00 (base commit a3181a2)
- **Completed:** 2026-07-11T13:55:04-06:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `AuditLogFilterBar.tsx`'s two `type="date"` inputs are now wrapped in `FormField` with visible `"Date from"`/`"Date to"` labels; the redundant `aria-label` props were dropped
- `e2e/38-audit-logs.spec.ts`'s date-from locator moved from the id-based `page.locator('#audit-filter-date-from')` (which `FormField`'s `cloneElement` would silently clobber) to `page.getByLabel('Date from')`, landed in the same commit as the wrap
- `InventoryPagePanel.tsx`'s signed quantity-delta `type="number"` input is wrapped in `FormField` (label + hint), with the native input kept — no `MoneyInput`, preserving negative-value submission

## Task Commits

Each task was committed atomically:

1. **Task 1: AuditLogFilterBar FormField wrap + atomic e2e/38 date-from selector fix** - `70ff3ca` (feat)
2. **Task 2: InventoryPagePanel batch-delta FormField wrap** - `5e48d38` (feat)

## Files Created/Modified
- `src/widgets/AuditLogTable/AuditLogFilterBar.tsx` - Both date inputs wrapped in `FormField`, `aria-label` dropped, `FormField` import added (ordered before `button` import per `import/order`)
- `e2e/38-audit-logs.spec.ts` - date-from locator switched from `#audit-filter-date-from` to `getByLabel('Date from')`
- `src/widgets/InventoryPagePanel.tsx` - batch-delta input wrapped in `FormField` with `hint="Use negative numbers to remove stock."`, replacing the manual `label`/`input`/`p` trio; native number input and `value`/`onChange` binding unchanged

## Decisions Made
- Same-commit atomicity for the `AuditLogFilterBar` wrap + e2e selector fix, per RESEARCH.md Pitfall 1 and the plan's explicit instruction — shipping the wrap alone would have broken CI with no obvious cause.
- `InventoryPagePanel`'s batch-delta kept as a native `type="number"` input inside `FormField` rather than `MoneyInput`, since it's a signed delta (Phase 17 precedent, D-06).

## Deviations from Plan

**1. [Rule 3 - Blocking] Fixed `import/order` ESLint violation from the new `FormField` import**
- **Found during:** Task 1 (`AuditLogFilterBar.tsx`)
- **Issue:** Adding `import { FormField } from '@shared/ui/FormField';` after the existing `Button`/`Input` imports triggered `import/order` (case-sensitive sort places uppercase `FormField` before lowercase `button`)
- **Fix:** Reordered the import line to precede `@shared/ui/button`
- **Files modified:** `src/widgets/AuditLogTable/AuditLogFilterBar.tsx`
- **Verification:** `npm run lint` exits 0
- **Committed in:** `70ff3ca` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — lint ordering)
**Impact on plan:** Trivial import-order fix, no scope creep.

## Issues Encountered
- The worktree had no `node_modules` (git worktrees don't carry gitignored directories). Attempted a Windows junction/symlink to the main repo's `node_modules` to save time, but MSYS `ln -s` on this machine silently fell back to a slow recursive copy (confirmed via `ln.exe` process inspection) rather than creating a true symlink. Killed the process, removed the partial copy, and ran a normal `npm ci --prefer-offline` (completed in ~2 min from local cache) instead. No effect on the actual task changes.
- Ran the full unit suite (`npm run test`) for extra confidence beyond the plan's own `typecheck && lint` gate, temporarily copying `.env.local` from the main repo (gitignored, not committed, removed afterward). Result: 1212 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`, documented since Phase 15) / 15 todo — exact match to the STATE.md baseline, zero regressions. A `.snap` file picked up a line-ending-only diff during the run (no content change) — reverted via `git checkout --` before committing, not part of any task commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both in-scope files for this plan (`AuditLogFilterBar.tsx`, `InventoryPagePanel.tsx`) are now FormField-conformant per COMPONENT-02; `LogoUploader.tsx` remains untouched per D-07 (documented in the plan's objective, no shared file-input primitive exists).
- Recommended wave-gate follow-up (dev-server dependent, not run in this isolated worktree): `npx playwright test e2e/38-audit-logs.spec.ts -g "date range filter"` to confirm the new `getByLabel('Date from')` locator resolves correctly against a live dev server.
- No blockers for other Phase 31 waves — this plan touched no files shared with other in-flight plans in this wave.

---
*Phase: 31-component-token-spacing-consistency-sweep*
*Completed: 2026-07-11*
