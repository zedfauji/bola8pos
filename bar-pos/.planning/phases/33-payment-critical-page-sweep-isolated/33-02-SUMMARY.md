---
phase: 33-payment-critical-page-sweep-isolated
plan: 02
subsystem: ui
tags: [react, tailwind, posbutton, cart]

requires:
  - phase: 32-touch-target-focus-visible-sweep
    provides: "POSButton touchSize/focusEmphasis CVA variants"
provides:
  - "CartPanel.tsx Clear Cart converted to POSButton (variant=ghost, touchSize=default)"
affects: []

tech-stack:
  added: []
  patterns: ["raw <button> -> POSButton with explicit variant to avoid CVA default bg-primary regression"]

key-files:
  created: []
  modified:
    - src/widgets/OrderPanel/CartPanel.tsx

key-decisions:
  - "Clear Cart is a low-stakes/reversible action, not a D-03 critical action, so touchSize=default (44px floor) not large/xl"

patterns-established: []

requirements-completed: [COMPONENT-04]

coverage:
  - id: D1
    description: "Clear Cart raw <button> converted to POSButton (variant=ghost, touchSize=default), onClick/className/text preserved verbatim, Place Order untouched"
    requirement: "COMPONENT-04"
    verification:
      - kind: unit
        ref: "npm run typecheck (no new errors from this file)"
        status: pass
      - kind: e2e
        ref: "npx playwright test e2e/05-payments.spec.ts (8 passed)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-13
status: complete
---

# Phase 33 Plan 02: Convert Clear Cart to POSButton Summary

**Swapped the raw `<button>` "Clear Cart" text-link in CartPanel.tsx to `POSButton` (variant=ghost, touchSize=default), zero behavior change, Place Order left untouched.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-13T00:00:00Z (approx)
- **Completed:** 2026-07-13
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `CartPanel.tsx`'s "Clear Cart" is now a `POSButton` with explicit `variant="ghost"` (preserving the transparent text-link look, avoiding the CVA default's solid `bg-primary` regression) and `touchSize="default"` (44px floor — not a D-03 critical action)
- `onClick={() => { clearCart(); }}`, `className`, and the literal child text `Clear Cart` preserved byte-identical
- "Place Order" (`touchSize="xl"`) left completely untouched — no `focusEmphasis` added

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert Clear Cart to POSButton (variant=ghost, touchSize=default)** - `ed99bfd` (feat)

## Files Created/Modified
- `src/widgets/OrderPanel/CartPanel.tsx` - Clear Cart raw `<button>` swapped to `POSButton variant="ghost" touchSize="default"`

## Decisions Made
- None beyond the plan's own D-01/D-03/D-04 — followed plan as specified (Clear Cart classified as non-critical, floor tier).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing, unrelated `npm run typecheck` errors surfaced in `src/entities/tab/model/queries.ts(780,11)` and `src/shared/lib/agent/rag.ts(60,7)` — both predate this plan (documented in Phase 32-01's `deferred-items.md`), not in this plan's `files_modified` list. Logged to `.planning/phases/33-payment-critical-page-sweep-isolated/deferred-items.md`, not fixed, out of scope per SCOPE BOUNDARY. `npx eslint src/widgets/OrderPanel/CartPanel.tsx` is clean (no errors, only pre-existing boundaries-plugin config warnings).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Isolated one-file PR/commit landed as required by Success Criterion 2.
- `e2e/05-payments.spec.ts` (8 tests) passes unchanged, confirming zero behavior regression (Success Criterion 3).
- Ready for the next wave-1 plan in Phase 33's payment-critical sweep.

---
*Phase: 33-payment-critical-page-sweep-isolated*
*Completed: 2026-07-13*

## Self-Check: PASSED
- FOUND: src/widgets/OrderPanel/CartPanel.tsx
- FOUND: .planning/phases/33-payment-critical-page-sweep-isolated/33-02-SUMMARY.md
- FOUND: commit ed99bfd
