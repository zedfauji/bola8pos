---
phase: 32-touch-target-focus-visible-sweep
plan: 03
subsystem: ui
tags: [confirm-dialog, focus-visible, touch-target, e2e, playwright, accessibility]

# Dependency graph
requires:
  - phase: 32-touch-target-focus-visible-sweep
    plan: "01"
    provides: focusEmphasis CVA variant + confirmClassName passthrough on ConfirmDialog
  - phase: 32-touch-target-focus-visible-sweep
    plan: "02"
    provides: POSButton touch-target rollout across operational pages
provides:
  - 72px + emphasized-ring destructive confirms (StopSessionConfirm, StopAndMoveDialog)
  - e2e/44-focus-tab-order.spec.ts (FOCUS-03 regression coverage)
  - CLAUDE.md E2E suite list + Implemented Features updated for Phase 32
affects: [33-payment-critical-page-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "confirmClassName consumer pattern: ConfirmDialog.confirmClassName=\"min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring\" wired at the two real destructive call sites, no new component work"

key-files:
  created:
    - e2e/44-focus-tab-order.spec.ts
  modified:
    - src/features/stop-pool-timer/ui/StopSessionConfirm.tsx
    - src/features/stop-and-move-table/ui/StopAndMoveDialog.tsx
    - CLAUDE.md

key-decisions:
  - "72px/focusEmphasis target set is the corrected 2-control set (void/cancel pool session via StopSessionConfirm, stop-and-move table via StopAndMoveDialog) — 'delete inventory batch' dropped per CONTEXT.md D-03/D-10 correction, not a shipped feature"
  - "e2e spec renumbered to 44 (43 taken by 43-promotions.spec.ts)"
  - "FOCUS-03 e2e tests the actual inventory category-filter -> sortable-column-header sequence, not a search-input flow, because InventoryPagePanel's DataTable doesn't pass the searchable prop (documented gap, not a defect introduced by this plan)"

requirements-completed: [TOUCH-02, FOCUS-02, FOCUS-03]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 32 Plan 03: Finalize — Destructive Confirms + Tab-Order E2E Summary

**Wired the Plan 32-01 shared pieces (`confirmClassName`) onto the two real destructive-action confirm dialogs, added an automated Playwright Tab-order regression spec for FOCUS-03, and updated CLAUDE.md's E2E suite list and Implemented Features section for Phase 32.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created e2e spec, 2 modified source files, 1 modified doc)

## Accomplishments

- `StopSessionConfirm.tsx` and `StopAndMoveDialog.tsx` now pass `confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"` to their `ConfirmDialog` — the two real destructive/irreversible actions in scope (void/cancel pool session, stop-and-move table) get the 72px touch target and emphasized focus ring. No copy, handler, or variant changes.
- `e2e/44-focus-tab-order.spec.ts` added — a read-only Playwright spec asserting keyboard Tab order across the 3 D-12 surfaces: `ManagerPinDialog` PIN entry (reached via `TableStatusPanel`'s Edit Start Time flow), the inventory category filter → sortable column headers, and the Batch Adjustment dialog's product/qty/Cancel/Apply fields. Verified against a live `npm run dev` server + real Chrome — 3/3 passed, not just written speculatively. Does not modify `ManagerPinDialog`, `PINKeypad`, `DataTable`, or `SearchInput`.
- `CLAUDE.md` updated: E2E suite count 22 → 23 spec files (appended `44-focus-tab-order` to the enumerated list); Implemented Features gained a terse Phase 32 line naming `focusEmphasis`, the `touchSize` rollout, `confirmClassName`, and the new spec.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire confirmClassName onto the 2 destructive confirm dialogs** — `1695252` (feat)
2. **Task 2: Add e2e/44-focus-tab-order.spec.ts (FOCUS-03)** — `add3370` (test)
3. **Task 3: Update CLAUDE.md E2E suite list + Implemented Features** — `863e882` (docs)

## Files Created/Modified

- `src/features/stop-pool-timer/ui/StopSessionConfirm.tsx` — `confirmClassName` added to its `ConfirmDialog` usage
- `src/features/stop-and-move-table/ui/StopAndMoveDialog.tsx` — `confirmClassName` added to its `ConfirmDialog` usage
- `e2e/44-focus-tab-order.spec.ts` — new (203 lines): Tab-order assertions across ManagerPinDialog/TableStatusPanel, inventory category-filter/sort-header, Batch Adjustment dialog
- `CLAUDE.md` — E2E Test Suite list (22→23 specs) + Implemented Features (Phase 32 line)

## Decisions Made

- Target set is the corrected 2-control set per CONTEXT.md D-03/D-10 (void/cancel pool session, stop-and-move table) — "delete inventory batch" was confirmed not to exist as a shipped feature and was dropped during planning; this plan implements only the 2 real targets.
- e2e spec numbered `44`, not the originally-proposed `43` (collision with `e2e/43-promotions.spec.ts`).
- FOCUS-03's inventory surface tests the category-filter → sortable-column-header sequence rather than a search-input flow, because `InventoryPagePanel`'s `DataTable` doesn't pass the `searchable` prop — no such flow exists on `/inventory` today. Documented as a gap, not silently worked around.

## Deviations from Plan

None on task scope — all three tasks matched their `<action>`/`<acceptance_criteria>` blocks. One process deviation from the worktree contract: this plan's SUMMARY.md was not force-committed inside the worktree before the worktree was removed (unlike 32-01/32-02), so it was lost when the worktree directory was deleted post-merge. Reconstructed by the orchestrator from the retained task-completion notification and the merged commit history (`1695252`, `add3370`, `863e882`) — consistent with the same recovery pattern documented for Phase 30 in STATE.md.

## Verification Results

- `npx playwright test e2e/44-focus-tab-order.spec.ts` — 3/3 passed against a live dev server + real Chrome
- `npm run typecheck` — 2 pre-existing unrelated errors only (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`); no new errors from this plan's files
- `npm run lint` — exit 0 (max-warnings 0); only pre-existing non-blocking `boundaries` plugin warnings
- `grep -q "min-h-\[72px\].*focus-visible:ring-4" src/features/stop-pool-timer/ui/StopSessionConfirm.tsx` — match confirmed
- `grep -q "44-focus-tab-order" CLAUDE.md` — match confirmed

## Next Steps

Phase 32 plans complete (32-01, 32-02, 32-03). Ready for phase verification (`/gsd-verify-work` or equivalent) — all 6 requirements (TOUCH-01/02/03, FOCUS-01/02/03) covered across the three plans.

## Self-Check: PASSED

All created/modified files and all 3 task commit hashes verified present in merged history (orchestrator-reconstructed summary; commits verified via `git show` post-merge, not self-reported by the original agent transcript).
