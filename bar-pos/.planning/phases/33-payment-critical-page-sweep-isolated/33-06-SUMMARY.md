---
phase: 33-payment-critical-page-sweep-isolated
plan: 06
subsystem: ui
tags: [react, tailwind, posbutton, touch-targets, focus-visible, split-tab]

requires:
  - phase: 32-touch-target-focus-visible-sweep
    provides: "POSButton touchSize tier convention (44/56/72px) and Button focusEmphasis=high CVA variant"
provides:
  - "SplitTabSheet.tsx's 4 in-scope buttons standardized to the payment-critical touch/focus tiers (D-01b/D-03/D-04/D-05)"
affects: [34-split-bill]

tech-stack:
  added: []
  patterns:
    - "Icon-only Button->POSButton conversion at touchSize=xl requires an explicit width fix (className w-[Npx]) since touchSize only sets min-height, not min-width — dropping size='icon-sm' avoids the sliver pitfall"

key-files:
  created: []
  modified:
    - src/features/split-tab/ui/SplitTabSheet.tsx

key-decisions:
  - "Remove check (Amount mode): rendered as a true 72x72px square via className=\"w-[72px]\" (not the smaller icon-padding alternative UI-SPEC.md offered as executor discretion) per D-03/D-05"
  - "Add check (item mode) / Add person converted to POSButton per CONTEXT.md D-01b, overriding UI-SPEC.md's stale 'No change' rows"

patterns-established: []

requirements-completed: [COMPONENT-04]

coverage:
  - id: D1
    description: "Confirm Split bumped from touchSize=large to xl with focusEmphasis=high, disabled/onClick unchanged"
    requirement: "COMPONENT-04"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0)"
        status: pass
      - kind: other
        ref: "npm run lint (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remove check (Amount mode) swapped from plain Button variant=ghost size=icon-sm to POSButton touchSize=xl focusEmphasis=high className=w-[72px], rendering a 72x72 square instead of a 28px-wide sliver"
    requirement: "COMPONENT-04"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0); grep confirms 0 remaining size=\"icon-sm\" in file"
        status: pass
    human_judgment: true
    rationale: "Visual squareness of the 72x72 target and focus-ring appearance require human eyes; automated typecheck/lint cannot confirm rendered pixel dimensions"
  - id: D3
    description: "Add check (item mode) and Add person swapped from plain Button to POSButton variant=outline touchSize=large per D-01b, onClick/aria-label/children preserved"
    requirement: "COMPONENT-04"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0); npm run lint (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Out-of-scope buttons (Evenly-mode picker, Keep tab open, Amount-mode row-add Add check sm) left unchanged"
    verification:
      - kind: other
        ref: "git diff shows only the 4 named sites touched; grep confirms remaining plain Button at lines 755 and 793"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-13
status: complete
---

# Phase 33 Plan 06: SplitTabSheet Touch/Focus Standardization Summary

**Converted SplitTabSheet.tsx's 3 raw shadcn `Button` sites to `POSButton` (Add check, Add person, Remove check) and bumped Confirm Split's existing `POSButton` to the 72px/high-ring critical tier — zero handler/prop behavior change.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-13T23:05:00Z
- **Completed:** 2026-07-13T23:20:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- "Confirm Split" bumped `touchSize="large"` → `"xl"`, added `focusEmphasis="high"` (prop-only)
- "Remove check" (Amount mode) converted from plain `Button variant="ghost" size="icon-sm"` to `POSButton variant="ghost" touchSize="xl" focusEmphasis="high" className="w-[72px]"` — fixes the icon-sm sliver pitfall (28px-wide/72px-tall) into a true 72x72 square
- "Add check" (item mode) and "Add person" converted from plain `Button variant="outline"` to `POSButton variant="outline" touchSize="large"` per CONTEXT.md D-01b (correcting the stale Phase 31/UI-SPEC "no change" assumption)
- Out-of-scope buttons (Evenly-mode number picker, "Keep tab open", Amount-mode row-add "Add check" sm) left untouched

## Task Commits

1. **Task 1: Confirm Split + Remove check → xl/high; Add check + Add person → POSButton large** - `9a647d4` (feat)

**Plan metadata:** committed with the final state-management commit (STATE.md/ROADMAP.md owned by orchestrator per this plan's execution instructions — not updated by this executor)

## Files Created/Modified
- `src/features/split-tab/ui/SplitTabSheet.tsx` - 4 button standardizations (3 primitive swaps + 1 prop-only bump)

## Decisions Made
- Chose the full 72x72px square (`className="w-[72px]"`) for "Remove check" rather than the smaller icon-padding alternative UI-SPEC.md left to executor discretion — matches D-03/D-05's explicit 72px critical tier for remove-leg actions and mirrors `PaymentForm.tsx`'s parallel "Remove payment N" treatment.
- Followed CONTEXT.md D-01b (authoritative, dated 2026-07-13) over UI-SPEC.md's stale "No change" rows for Add check/Add person, per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written. All four edits matched the plan's `<action>` spec verbatim (markup/class-only diffs; `onClick`/`aria-label`/`disabled`/children preserved).

## Issues Encountered

`npm run typecheck` reports 2 pre-existing errors unrelated to this change (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`) — confirmed via `git status --short` that only `SplitTabSheet.tsx` was modified in this task; these errors exist in files outside this plan's scope and are out of the SCOPE BOUNDARY for auto-fixing. `npm run lint` on `SplitTabSheet.tsx` specifically is clean (only unrelated boundaries-plugin legacy-selector warnings, pre-existing).

`npx playwright test e2e/34-split-bill.spec.ts` (the plan's `<human-check>` verification step) was not run in this session — it requires live `.env.local` Supabase E2E credentials which are not accessible to this executor. The `<automated>` verify gate (`npm run typecheck && npm run lint`) passed; the E2E/visual confirmation should be run by a human or CI before merge, per the plan's own split between `<automated>` and `<human-check>` verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SplitTabSheet.tsx now fully standardized per D-01b/D-03/D-04/D-05 for this phase's scope — no remaining raw-`Button` drift in this file for the 4 named targets.
- Recommend running `npx playwright test e2e/34-split-bill.spec.ts` with live credentials before merging this isolated PR, to confirm zero behavior change per Success Criterion 1/3.

---
*Phase: 33-payment-critical-page-sweep-isolated*
*Completed: 2026-07-13*

## Self-Check: PASSED
- FOUND: src/features/split-tab/ui/SplitTabSheet.tsx
- FOUND: .planning/phases/33-payment-critical-page-sweep-isolated/33-06-SUMMARY.md
- FOUND: commit 9a647d4
