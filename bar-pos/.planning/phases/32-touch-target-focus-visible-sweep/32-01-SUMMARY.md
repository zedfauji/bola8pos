---
phase: 32-touch-target-focus-visible-sweep
plan: 01
subsystem: ui
tags: [shared-ui, cva, tailwind, focus-visible, touch-target, accessibility]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: existing PageContainer/SectionHeader shared-primitive extension pattern this plan follows for Button/ConfirmDialog
provides:
  - focusEmphasis CVA variant (default|high) on buttonVariants/Button/POSButton
  - confirmClassName opt-in passthrough prop on ConfirmDialog
  - 44px SearchInput clear-button touch target
affects: [32-03-wire-confirm-dialogs, 33-payment-critical-page-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CVA variant extension: add a new variants key + defaultVariants entry + thread through component signature identically to existing variant/size props, letting VariantProps auto-expose it (no manual prop-type edits needed)"
    - "Opt-in className passthrough merged LAST in a cn() call so twMerge lets the caller's classes win, with zero change to default behavior for existing call sites"

key-files:
  created:
    - src/shared/ui/button.test.tsx
    - src/shared/ui/POSButton.test.tsx
    - src/shared/ui/ConfirmDialog.test.tsx
    - .planning/phases/32-touch-target-focus-visible-sweep/deferred-items.md
  modified:
    - src/shared/ui/button.tsx
    - src/shared/ui/ConfirmDialog.tsx
    - src/shared/ui/SearchInput.tsx

key-decisions:
  - "focusEmphasis high variant reuses the existing --ring token at full opacity (focus-visible:ring-ring, not ring-ring/50) rather than introducing a new color, per D-09"
  - "confirmClassName is opt-in only (no default changed) since ConfirmDialog has ~20 call sites app-wide including payment flows reserved for Phase 33"

patterns-established:
  - "focusEmphasis: 'default' | 'high' variant, thread pattern for future CVA extensions on shared/ui primitives"

requirements-completed: [FOCUS-01, FOCUS-02, TOUCH-01, TOUCH-02]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 32 Plan 01: Shared-Primitive Focus/Touch Extensions Summary

**Added an opt-in `focusEmphasis="high"` ring variant to the base Button/POSButton, an opt-in `confirmClassName` passthrough on ConfirmDialog, and raised SearchInput's clear button to a 44px touch target — three reusable shared-primitive pieces that Plan 32-03 wires onto the destructive confirm dialogs.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (3 created test files, 3 modified source files, plus 1 deferred-items.md)

## Accomplishments

- `focusEmphasis` CVA variant (`default | high`) added to `buttonVariants` in `src/shared/ui/button.tsx`, threaded through `Button()` exactly like `variant`/`size`; baseline `focus-visible:ring-3 focus-visible:ring-ring/50` in the CVA base string is untouched. Auto-exposed on `POSButton` via `VariantProps` (no manual prop-type edits needed).
- `confirmClassName?: string` added to `ConfirmDialogProps`, merged last onto the confirm `AlertDialogAction`'s `cn()` call so twMerge lets it win; opt-in only, zero default-behavior change verified by a dedicated "no confirmClassName -> unchanged markup" test.
- `SearchInput`'s clear (X) button raised from `h-7 w-7` (28px) to `h-11 w-11` (44px), matching `QuantityControl`'s canonical icon-button shape, plus `touch-manipulation`. Ripple surface confirmed limited to `DataTable.tsx` (its only importer).
- Three new unit-test files close Assumption A1 (focus-ring class output) and Pitfall 2 (confirmClassName reaches the confirm button, not cancel).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add focusEmphasis CVA variant to base Button + unit tests** (TDD) — RED: `342af6b` (test), GREEN: `da87405` (feat)
2. **Task 2: Add confirmClassName passthrough to ConfirmDialog + unit test** — `b42ab83` (feat)
3. **Task 3: Raise SearchInput clear button to a 44px touch target** — `bf20443` (fix)

_Note: Task 1 followed the RED/GREEN TDD cycle — the failing test commit was created first (confirmed `focusEmphasis="high"` test failed against the un-modified button.tsx), then the implementation commit made it pass. No REFACTOR commit was needed._

## Files Created/Modified

- `src/shared/ui/button.tsx` — `focusEmphasis` variant slot (default/high) added to `buttonVariants`, threaded through `Button()`
- `src/shared/ui/button.test.tsx` — new: asserts high -> ring-4/ring-ring, default/plain -> ring-3/ring-ring/50
- `src/shared/ui/POSButton.test.tsx` — new: asserts touchSize -> min-h-[44px]/[56px]/[72px] class output + baseline ring survives the touchSize className merge
- `src/shared/ui/ConfirmDialog.tsx` — `confirmClassName?: string` prop added, merged last onto the confirm button's `cn()` call
- `src/shared/ui/ConfirmDialog.test.tsx` — new: asserts confirmClassName lands on confirm (not cancel) button; asserts omitting it leaves the confirm button unchanged
- `src/shared/ui/SearchInput.tsx` — clear button `h-7 w-7` -> `h-11 w-11` + `touch-manipulation`
- `.planning/phases/32-touch-target-focus-visible-sweep/deferred-items.md` — new: documents 2 pre-existing, out-of-scope typecheck errors (see Deferred Issues below)

## Decisions Made

- `focusEmphasis: 'high'` reuses the existing `--ring` design token at full opacity (`focus-visible:ring-ring`) rather than a new color token, per D-09.
- `confirmClassName` stays strictly opt-in — no default value change — because ConfirmDialog is used at ~20 call sites app-wide, several of which are payment-critical and out of this phase's scope (reserved for Phase 33).

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>`/`<acceptance_criteria>` blocks precisely; no Rule 1-4 auto-fixes were needed.

## Deferred Issues

- **Pre-existing typecheck errors** (out of scope, not caused by this plan, logged to `deferred-items.md`):
  - `src/entities/tab/model/queries.ts(780,11)`: `Type 'number | null' is not assignable to type 'number | undefined'.`
  - `src/shared/lib/agent/rag.ts(60,7)`: `Type 'number[]' is not assignable to type 'string'.`
  - Both predate this plan (repeatedly documented in `.planning/STATE.md`, e.g. Phase 17-03/11-02 session notes) and neither file is in this plan's `files_modified` list — left untouched per the SCOPE BOUNDARY rule.

## Verification Results

- `npx vitest run src/shared/ui/button.test.tsx src/shared/ui/POSButton.test.tsx src/shared/ui/ConfirmDialog.test.tsx` — 3 files / 8 tests passed
- Full unit suite `npm run test` — 136 files passed / 2 skipped, 1225 tests passed / 15 todo, 0 failures
- `npm run typecheck` — 2 pre-existing unrelated errors only (documented above); no new errors introduced by this plan's files
- `npm run lint` — exit 0 (max-warnings 0); only pre-existing non-blocking `boundaries` plugin warnings
- `grep -c "focusEmphasis" src/shared/ui/button.tsx` = 4 (>= 3 required)
- `grep -c "confirmClassName" src/shared/ui/ConfirmDialog.tsx` = 3 (>= 2 required)
- `grep -rl "SearchInput" src --include=*.tsx --include=*.ts | grep -v -E "SearchInput.tsx|index.ts"` = `src/shared/ui/DataTable.tsx` only (ripple surface confirmed)

## Next Steps

Plan 32-03 wires `focusEmphasis="high"` and `confirmClassName` onto the two real destructive-action ConfirmDialog call sites.

## Self-Check: PASSED

All created/modified files and all 5 task/metadata commit hashes verified present.
