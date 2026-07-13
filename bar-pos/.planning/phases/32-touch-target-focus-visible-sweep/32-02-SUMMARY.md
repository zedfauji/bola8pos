---
phase: 32-touch-target-focus-visible-sweep
plan: 02
subsystem: ui
tags: [react, tailwind, shadcn, touch-target, accessibility, pos]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: PageContainer/SectionHeader shell primitives already in place on inventory page
  - phase: 31-component-token-spacing-consistency-sweep
    provides: Component/token/spacing conformance baseline this touch-target sweep builds on
provides:
  - Every raw shadcn Button / native button on pool-tables, pool-table-status, inventory, kds, kds-bar is at or above its assigned touch-size floor (44px default / 56px frequent)
  - Grid-gap floor (8px) verified across PoolTableGrid, KdsBoard, KitchenPrepDashboard, PrepBatchPreview
affects: [32-03-touch-target-focus-visible-sweep, 33-payment-critical-page-sweep, 34-visual-regression-baseline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "POSButton touchSize prop (default=44px/large=56px/xl=72px) is the canonical mechanism for touch-target compliance; icon-only buttons combine size=\"icon\" with an explicit h-11 w-11 className to hit the 44px square floor"
    - "Native (non-shadcn) interactive elements (e.g. tanstack-table sort-header <button>) get min-h-[44px] + touch-manipulation added directly rather than being wrapped in POSButton"

key-files:
  created: []
  modified:
    - src/widgets/PoolTableGrid/index.tsx
    - src/widgets/KdsBoard/index.tsx
    - src/pages/inventory/index.tsx
    - src/widgets/TableStatusPanel/index.tsx
    - src/entities/inventory/ui/InventoryRow.tsx

key-decisions:
  - "KDS/kds-bar per-card bump buttons sized touchSize=\"large\" (56px) per D-03 frequent-action tier; Retry/filters-toggle/Physical Count sized touchSize=\"default\" (44px) as secondary actions"
  - "TableStatusPanel remove-item icon button uses POSButton size=\"icon\" touchSize=\"default\" plus an explicit h-11 w-11 className (POSButton's touchSize classes alone set min-height only, not width — the square target needs both)"
  - "InventoryRow SortHeader stays a native <button> (not converted to POSButton) per RESEARCH.md Open Question 2 — it's a tanstack-table header cell, converting would fight the header render for no benefit; min-h-[44px] + touch-manipulation added directly"

patterns-established:
  - "Icon-only touch targets: size=\"icon\" + h-11 w-11 + touch-manipulation (44px square), matching the QuantityControl reference shape"

requirements-completed: [TOUCH-01, TOUCH-02, TOUCH-03]

# Metrics
duration: ~20min
completed: 2026-07-13
---

# Phase 32 Plan 02: Touch Target & Focus-Visible Sweep — Text/Icon Buttons + Grid-Gap Audit Summary

**Converted 6 raw-Button/native-button sites across pool-tables, kds, kds-bar, and inventory to POSButton at their assigned touch size (44px/56px), and confirmed all in-scope grids already meet the 8px gap floor with zero regressions.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-13T16:17:51Z
- **Tasks:** 3 (2 code-change, 1 verify-only)
- **Files modified:** 5

## Accomplishments
- PoolTableGrid filters-toggle, KdsBoard's 3 raw Buttons (2 bump + Retry), and inventory's Physical Count button all converted to POSButton with the correct touchSize tier
- TableStatusPanel's remove-item icon button raised from 28px (`icon-sm`) to a 44px square (`size="icon"` + `h-11 w-11`)
- InventoryRow's native SortHeader button raised to the 44px floor via `min-h-[44px]`
- Grid-gap audit confirmed PoolTableGrid (gap-4), KdsBoard (gap-6 board / space-y-4 card lists), KitchenPrepDashboard (gap-4), and PrepBatchPreview (gap-2) all already meet or exceed the 8px floor — no changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert text-button sites (PoolTableGrid, KdsBoard, inventory) to POSButton** - `89a7b64` (feat)
2. **Task 2: Raise the icon and native-button sites (TableStatusPanel remove-item, InventoryRow SortHeader) to 44px** - `dcc8ce7` (feat)
3. **Task 3: Grid-gap audit (TOUCH-03)** - verify-only, no code changes (see Grid-Gap Audit Result below)

## Files Created/Modified
- `src/widgets/PoolTableGrid/index.tsx` - filters-toggle raw Button -> `POSButton touchSize="default"`; unused `Button` import removed
- `src/widgets/KdsBoard/index.tsx` - 2 per-card bump Buttons -> `POSButton touchSize="large"`; Retry Button -> `POSButton touchSize="default"`; import switched from deep `@shared/ui/button` to `@shared/ui/POSButton`
- `src/pages/inventory/index.tsx` - Physical Count Button -> `POSButton touchSize="default"`; import switched from `{ Button, PageContainer }` to `{ PageContainer, POSButton }`
- `src/widgets/TableStatusPanel/index.tsx` - remove-item Button (`size="icon-sm"`, 28px) -> `POSButton size="icon" touchSize="default"` with `h-11 w-11 touch-manipulation` (44px square); unused `Button` import removed
- `src/entities/inventory/ui/InventoryRow.tsx` - SortHeader native `<button>` gains `min-h-[44px] touch-manipulation`

## Grid-Gap Audit Result (Task 3)

| File | Grid site | Gap class | Result |
|------|-----------|-----------|--------|
| `PoolTableGrid/index.tsx` | table-card grids (lines 160, 174) | `gap-4` (16px) | PASS |
| `KdsBoard/index.tsx` | board grid (line 238) | `gap-6` (24px) | PASS |
| `KdsBoard/index.tsx` | pending/in-progress card lists | `space-y-4` (16px) | PASS |
| `KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx` | on-hand card grid (line 108) | `gap-4` (16px) | PASS |
| `features/produce-prep-batch/ui/PrepBatchPreview.tsx` | ingredient rows (lines 30, 43) | `gap-2` (8px) | PASS |

All in-scope grids already at or above the 8px floor. No `gap-0`/`gap-1` found on any audited grid. No changes required (D-05/D-06/D-07 confirmed by RESEARCH.md pre-execution).

## Decisions Made
- POSButton's `size="icon"` alone only constrains via the shadcn `size-8` class; the touchSize classes are `min-h-[*]` only (no width). For a 44px *square* icon target, an explicit `h-11 w-11` was required on top of `touchSize="default"` — matching the existing QuantityControl reference shape cited in the plan's read_first.
- InventoryRow's SortHeader intentionally stayed a native `<button>` rather than being wrapped in POSButton, per the plan's resolution of RESEARCH.md's Open Question 2 (a tanstack-table header-cell render function shouldn't fight POSButton's ref-forwarding for no behavioral benefit).

## Deviations from Plan

None - plan executed exactly as written. One clarification worth recording: the plan's Task 3 automated verify command (`grep -rnE "\bgap-(0|1)\b" ...`) is a whole-file regex and also matches 2 pre-existing, out-of-scope `gap-1` occurrences that are unrelated to the audited tappable-card/button grids — `PoolTableGrid/index.tsx:129` (icon-to-label spacing inside the single "Filters" toggle button) and `KdsBoard/index.tsx:121` (icon-to-label spacing inside the `ComboKdsCard`'s `CollapsibleTrigger`). Both are internal spacing within one interactive control, not gaps between adjacent tappable elements in a grid, so they are out of TOUCH-03's scope per the task's own `<read_first>` line references (which cite only the grid-container lines, not these). Left unmodified, consistent with the task's explicit instruction: "Do NOT change gap classes that already meet the 8px floor" for non-grid sites. The four actual in-scope grids (see table above) all pass cleanly.

## Issues Encountered
- The worktree had no `node_modules` (git worktrees don't carry gitignored directories). Created a Windows directory junction (`node_modules` -> the main checkout's `node_modules`) via PowerShell `New-Item -ItemType Junction` so `npm run typecheck`/`npm run lint` could run without a full reinstall. This is a local, non-committed filesystem link — no repo files were touched.
- `npm run typecheck` reports the same 2 pre-existing, unrelated errors documented in STATE.md's baseline (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`) both before and after this plan's changes — confirmed no regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 32-03 (destructive 72px confirm-dialog targets, out of this plan's scope) is unblocked and can proceed independently — no shared files with this plan.
- All 5 modified files pass typecheck (baseline-only errors) and lint (`--max-warnings 0` clean, only non-blocking `[boundaries]` legacy-selector-syntax warnings which are pre-existing tooling notices, not lint failures).
- Manual/E2E gate still pending per plan's `<verification>`: `npx playwright test e2e/16-table-status.spec.ts e2e/28-kds.spec.ts e2e/40-kds-bar.spec.ts e2e/10-inventory.spec.ts` — not run in this worktree (requires a dev server); testids and handlers were preserved verbatim so no regression is expected, but this is a wave/phase-level gate to be run by the orchestrator/verifier.

---
*Phase: 32-touch-target-focus-visible-sweep*
*Completed: 2026-07-13*
