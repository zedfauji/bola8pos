---
phase: 33-payment-critical-page-sweep-isolated
plan: 01
subsystem: ui
tags: [react, tailwind, shadcn, posbutton, touch-target]

# Dependency graph
requires:
  - phase: 32-touch-target-focus-visible-sweep
    provides: POSButton touchSize/focusEmphasis CVA variants
provides:
  - POS page panel toggle standardized to POSButton (variant=ghost, touchSize=default)
affects: [33-02, 33-03, 33-04, 33-05, 33-06, 33-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Icon-only toggle buttons converted from raw <button> to POSButton must pair touchSize (height-only) with an explicit width utility class (e.g. w-11) to keep a true square touch target"

key-files:
  created: []
  modified:
    - src/pages/pos/index.tsx

key-decisions:
  - "Used variant=\"ghost\" explicitly to avoid POSButton's CVA default solid bg-primary background, preserving the toggle's existing transparent/bordered look"
  - "Used touchSize=\"default\" (44px floor) not large/xl — this toggle is not one of D-03's 5 critical money actions"
  - "Replaced fixed h-9 w-9 (36px) with w-11 (44px) to fix the icon-button width-only-sizing pitfall (touchSize sets min-height only)"

patterns-established: []

requirements-completed: [COMPONENT-04]

coverage:
  - id: D1
    description: "POS order-panel toggle converted from raw <button> to POSButton (variant=ghost, touchSize=default), 44x44 true square, testid/aria/onClick preserved verbatim"
    requirement: "COMPONENT-04"
    verification:
      - kind: e2e
        ref: "e2e/29-panel-toggle.spec.ts (2 passed)"
        status: pass
      - kind: e2e
        ref: "e2e/05-payments.spec.ts (8 passed)"
        status: pass
      - kind: other
        ref: "npm run typecheck (no new errors introduced by this change)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-13
status: complete
---

# Phase 33 Plan 01: POS Panel Toggle POSButton Conversion Summary

**Converted the POS page's last raw `<button>` (order-panel toggle) to `POSButton variant="ghost" touchSize="default"`, fixing its below-floor 36px width to a true 44px square via an explicit `w-11` class.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-13T19:21:00Z
- **Completed:** 2026-07-13T19:36:53Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- POS page's order-panel toggle is now a `POSButton` (matching the file's existing `Close Tab / Pay` precedent), closing out the last raw-`<button>` drift item on this page from the Phase 29 audit.
- Fixed the toggle's touch target from 36x36px (`h-9 w-9`) to a true 44x44px square (`w-11` + `touchSize="default"`'s `min-h-[44px]`).
- Zero behavior change: `data-testid`, dynamic `aria-label`, `aria-pressed`, and `onClick` all preserved byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert POS panel toggle to POSButton** - `3af2694` (feat)

**Plan metadata:** committed by orchestrator (this executor does not update STATE.md/ROADMAP.md per instructions)

## Files Created/Modified
- `src/pages/pos/index.tsx` - Panel toggle `<button>` → `<POSButton variant="ghost" touchSize="default">` with `w-11` width fix

## Decisions Made
- `variant="ghost"` added explicitly (Pattern B / D-03b rule) to avoid POSButton's CVA default solid `bg-primary` background — the raw button had no prior CVA styling.
- `touchSize="default"` (44px floor), not `large`/`xl` — this toggle is not one of D-03's 5 critical payment actions.
- `w-11` replaces `h-9 w-9` since `touchSize` only controls `min-height`; width needed an explicit companion class to stay a true square (D-03a pitfall).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

During verification I mistakenly ran `git stash` while inspecting typecheck output, which reverted the working-tree edit. This was caught immediately (system reminder showed the file diff disappear) and recovered via `git stash pop` before staging/committing — no data loss, no incorrect commit was made. Noting this per transparency; the `destructive_git_prohibition` section is scoped to worktree-isolated execution and this session runs directly on the main working tree, but `git stash` should still be avoided given cross-worktree contamination risk documented in the executor instructions.

The pre-existing `npm run typecheck` errors in `src/entities/tab/model/queries.ts` and `src/shared/lib/agent/rag.ts` are unrelated to this change (confirmed via `git diff --stat` showing zero diff in those files) — out of scope per the Scope Boundary rule, not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 33-01 complete and isolated (single-file commit) per Success Criterion 2.
- E2E gate green: `e2e/29-panel-toggle.spec.ts` (2/2) and `e2e/05-payments.spec.ts` (8/8) both pass unchanged against live Supabase creds, satisfying Success Criterion 3 for this file.
- Remaining 6 files in Phase 33 scope (CartPanel.tsx, PaymentForm.tsx, TabPaymentCard.tsx, RefundSheet.tsx, SplitTabSheet.tsx, VoidOrderDialog.tsx) are untouched by this plan — ready for subsequent isolated plans (33-02 through 33-07).

---
*Phase: 33-payment-critical-page-sweep-isolated*
*Completed: 2026-07-13*

## Self-Check: PASSED
- FOUND: src/pages/pos/index.tsx
- FOUND: 3af2694 (commit)
- FOUND: .planning/phases/33-payment-critical-page-sweep-isolated/33-01-SUMMARY.md
