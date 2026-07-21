---
phase: 24-operational-reports-suite-csv
plan: 07
subsystem: order-management
tags: [supabase-rpc, react-query, result-type, i18next, vitest, tdd]

# Dependency graph
requires:
  - phase: 24-operational-reports-suite-csv (Plan 04)
    provides: "remove_tab_item audited RPC (order_item.remove action, TAB_NOT_OPEN/NOT_FOUND envelope codes)"
  - phase: 24-operational-reports-suite-csv (Plan 05)
    provides: "remove_tab_item pushed to remote + typed in supabase.types.ts (no `as any` needed)"
  - phase: 24-operational-reports-suite-csv (Plan 01)
    provides: "featOrders:removeTabItem.reasonLabel/reasonPlaceholder/reasonRequired i18n keys, order_item.remove audit-action registration"
provides:
  - "useRemoveTabItem rewired to a single db.rpc('remove_tab_item') call, replacing the 3-step client delete/check-remaining/void mutation"
  - "RemoveTabItemInput.reason: string (required)"
  - "RemoveTabItemDialog required-reason Input gating submission (canConfirm), mirroring VoidOrderDialog"
  - "TAB_NOT_OPEN AppErrorCode + tabNotOpenError() factory in shared/lib/result.ts"
affects: [reports-suite-csv, deletions-pre-send-panel, deletions-post-close-report]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC-envelope mutation hook: supabase.rpc(...) -> { ok, code?, message? } -> Result<void> via per-code AppError mapping (mirrors edit_paid_tab/reopen_tab client callers)"
    - "Required-reason ConfirmDialog gate: trimmedReason state -> canConfirm boolean -> confirmDisabled prop (VoidOrderDialog pattern, now shared by RemoveTabItemDialog)"

key-files:
  created: []
  modified:
    - src/features/remove-tab-item/useRemoveTabItem.ts
    - src/features/remove-tab-item/useRemoveTabItem.test.ts
    - src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx
    - src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx
    - src/shared/lib/result.ts

key-decisions:
  - "Added a new TAB_NOT_OPEN AppErrorCode (with tabNotOpenError() factory) rather than reusing TAB_ALREADY_CLOSED — the RPC's TAB_NOT_OPEN guard also fires on voided tabs, and TAB_ALREADY_CLOSED's message ('has already been closed') would misdescribe that case."
  - "notFoundError() called with no argument (default 'Record not found.') instead of notFoundError('Order item') — the literal string tripped the features-layer i18next/no-literal-string lint gate (D-05); the generic message is an acceptable trade for zero new i18n keys on a rare error path."

patterns-established: []

requirements-completed: [SC-1]

coverage:
  - id: D1
    description: "useRemoveTabItem's mutationFn replaced with a single remove_tab_item RPC call; RemoveTabItemInput carries a required reason"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/features/remove-tab-item/useRemoveTabItem.test.ts (5 cases: ok+invalidation, SUPABASE_ERROR, NOT_FOUND, TAB_NOT_OPEN, NETWORK_OFFLINE)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RemoveTabItemDialog gains a required reason Input gating the confirm action, with no PIN gate and no destructive confirmClassName"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx (11 cases incl. disabled-on-empty, whitespace-blocks, enabled-on-reason, trimmed-reason-passed, no-PIN-dialog-rendered)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 07: Rewire order-item removal to the atomic audited RPC Summary

**`useRemoveTabItem` now calls the single audited `remove_tab_item` RPC instead of orchestrating delete/check-remaining/void from the client, and `RemoveTabItemDialog` gates removal on a required reason field mirroring `VoidOrderDialog` — with no new access gate.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-21T20:40:00Z
- **Completed:** 2026-07-21T20:52:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 plan-scoped + `useRemoveTabItem.test.ts` rewrite + a new `AppErrorCode`/factory in `result.ts`)

## Accomplishments

- `useRemoveTabItem`'s mutationFn collapses the old 3-step `DELETE order_items` → check-remaining → conditional-void sequence (plus its stale inventory-restore TODO) into one `supabase.rpc('remove_tab_item', { p_item_id, p_reason })` call, unwrapping the `{ ok, code?, message? }` envelope into a `Result<void>`.
- `RemoveTabItemInput` gains a required `reason: string`; `onSuccess` invalidation of `tabKeys.detail`/`tabKeys.lists` is unchanged.
- `RemoveTabItemDialog` adds a trimmed-reason state + `canConfirm` boolean gating `ConfirmDialog`'s `confirmDisabled`, with a labeled required `Input` using the existing `featOrders:removeTabItem.reasonLabel`/`reasonPlaceholder` i18n keys. No PIN gate, no destructive `confirmClassName` — removal stays bartender-accessible (D-07).
- `RemoveTabItemDialog.test.tsx` extended with RED-then-GREEN cases: confirm disabled on empty/whitespace-only reason, enabled once typed, trimmed reason passed to the mutation, and a no-PIN-dialog-rendered assertion.

## Task Commits

Each task was committed atomically (Task 2 followed the RED/GREEN TDD gate):

1. **Task 1: Rewire useRemoveTabItem to the remove_tab_item RPC (D-06)** - `16804a5` (feat) — includes the rewritten `useRemoveTabItem.test.ts` (the old test mocked the 3-step `.from()` sequence, now obsolete) and the new `TAB_NOT_OPEN`/`tabNotOpenError()` addition to `result.ts`.
   - Follow-up: `c127721` (fix) — dropped an `i18next/no-literal-string` violation discovered by `npx eslint` right after the task commit (Rule 3, blocking).
2. **Task 2: Add required reason field to RemoveTabItemDialog + test (D-07)** - `f409ee2` (test, RED — confirmed 6 new/changed cases failing against the pre-change dialog) → `7bc8ca0` (feat, GREEN — all 11 `RemoveTabItemDialog.test.tsx` cases pass).

**Plan metadata:** _(pending final commit)_

_Note: Task 2 is a `tdd="true"` task — test → feat commit sequence per the TDD gate._

## Files Created/Modified

- `src/features/remove-tab-item/useRemoveTabItem.ts` - mutationFn now calls `remove_tab_item` RPC; `RemoveTabItemInput.reason: string` added
- `src/features/remove-tab-item/useRemoveTabItem.test.ts` - rewritten against the RPC surface (`supabase.rpc` mock) instead of the old chained `.from()` mock sequence
- `src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx` - required reason `Input` + `canConfirm` gate on `ConfirmDialog`'s `confirmDisabled`
- `src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx` - reason-required RED/GREEN cases + no-PIN-dialog assertion added to the existing suite
- `src/shared/lib/result.ts` - new `TAB_NOT_OPEN` `AppErrorCode` + `tabNotOpenError()` factory

## Decisions Made

- Added `TAB_NOT_OPEN` as a new `AppErrorCode` rather than reusing `TAB_ALREADY_CLOSED` — the RPC's defense-in-depth guard (`v_tab_status <> 'open'`) also fires for voided tabs, and `TAB_ALREADY_CLOSED`'s message would misdescribe that case.
- `notFoundError()` called with no argument (falls back to the default `'Record not found.'` message) instead of `notFoundError('Order item')`, to satisfy the features-layer `i18next/no-literal-string` lint gate without adding a new i18n key for a rare, non-user-actionable error path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useRemoveTabItem.test.ts` fully rewritten (not in plan's `files_modified`)**
- **Found during:** Task 1
- **Issue:** The existing test file mocked the old 3-step `.from()`-based mutation (delete → check-remaining → void). After rewiring the mutation to a single `supabase.rpc()` call, every existing test in that file broke (`tsc` + `vitest` both failed) since the mocked builder sequence no longer matched the implementation.
- **Fix:** Rewrote the file against the new RPC surface, mocking `supabase.rpc` directly (pattern borrowed from `entities/staff/model/queries.test.ts`'s `set_own_locale` RPC test). Covers: ok + invalidation, `SUPABASE_ERROR` (RPC transport error), `NOT_FOUND` and `TAB_NOT_OPEN` (RPC envelope codes), and `NETWORK_OFFLINE`.
- **Files modified:** `src/features/remove-tab-item/useRemoveTabItem.test.ts`
- **Verification:** `npx vitest run src/features/remove-tab-item/useRemoveTabItem.test.ts` — 5/5 pass
- **Committed in:** `16804a5` (part of Task 1 commit)

**2. [Rule 3 - Blocking] Added `TAB_NOT_OPEN` AppErrorCode + `tabNotOpenError()` factory (not in plan's `files_modified`)**
- **Found during:** Task 1
- **Issue:** The live `remove_tab_item` RPC (shipped in Plan 04, migration `20260721000005_remove_tab_item_rpc.sql`) returns two distinct failure codes — `NOT_FOUND` and `TAB_NOT_OPEN` — but `AppErrorCode` had no entry for the latter. The plan's `read_first` note explicitly anticipated this ("map ... NOT_FOUND / TAB_NOT_OPEN ... add one only if a suitable code is absent").
- **Fix:** Added `TAB_NOT_OPEN` to the `AppErrorCode` union and a `tabNotOpenError()` factory in `src/shared/lib/result.ts`, following the existing factory-function pattern exactly (mirrors `tabAlreadyClosedError`).
- **Files modified:** `src/shared/lib/result.ts`
- **Verification:** `npx tsc --noEmit` clean; new `useRemoveTabItem.test.ts` case asserts `TAB_NOT_OPEN` mapping
- **Committed in:** `16804a5` (part of Task 1 commit)

**3. [Rule 1 - Bug/Lint] Dropped literal-string argument to `notFoundError()`**
- **Found during:** Task 1 (post-commit `npx eslint` check)
- **Issue:** `notFoundError('Order item')` tripped the features-layer `i18next/no-literal-string` gate (D-05, no-grandfather ESLint rule from Phase 21).
- **Fix:** Called `notFoundError()` with no argument, falling back to its default `'Record not found.'` message.
- **Files modified:** `src/features/remove-tab-item/useRemoveTabItem.ts`
- **Verification:** `npx eslint src/features/remove-tab-item/useRemoveTabItem.ts` clean
- **Committed in:** `c127721` (follow-up fix commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 lint bug) — all directly caused by rewiring the mutation to the new RPC; no scope creep beyond the plan's stated D-06/D-07 objective.
**Impact on plan:** Necessary for the plan's own `npm run typecheck`/`npm run lint` success criteria to hold. No architectural changes.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `order_item.remove` audit rows are now reachable from the UI end-to-end (SC-1 client half complete; server half shipped in Plan 04/05).
- Plan 06/08's deletions-pre-send report can now surface real client-triggered removals with attributed reasons.
- Pre-existing baseline `tsc` failures in `queries.ts`, `agent/rag.ts`, and `HourlyBreakdownPanel.test.tsx` (last touched by Phase 23, unrelated to this plan's files) remain — logged in `24-operational-reports-suite-csv/deferred-items.md`, out of this plan's scope.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED

All 5 modified/created source files and all 4 task commit hashes (`16804a5`, `c127721`, `f409ee2`, `7bc8ca0`) verified present on disk / in git log.
