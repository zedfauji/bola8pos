---
phase: 31-component-token-spacing-consistency-sweep
plan: 04
subsystem: ui
tags: [react, shadcn, tailwind, button, tokens]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: "PageContainer backTo prop — the surviving persistent back affordance in pool-table-status"
provides:
  - "TableStatusPanel row-remove control migrated from raw <button> to shared Button (variant=ghost size=icon-sm)"
  - "Duplicate main-render 'Back to Pool Tables' POSButton block deleted (COMPONENT-03/D-09)"
  - "CategoryForm + ModifierSheet category.color hex sites documented as TOKEN-01 exempt (D-08) with a D-05 native-input comment"
affects: [32-touch-target-focus-visible-sweep, 35-guardrails]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Icon-only row-remove controls use shared Button variant=ghost size=icon-sm (matches SplitTabSheet precedent)"
    - "Per-row user-data hex colors get an inline TOKEN-01 exemption comment instead of being forced onto a Tailwind CSS-variable token"

key-files:
  created: []
  modified:
    - src/widgets/TableStatusPanel/index.tsx
    - src/features/manage-products/ui/CategoryForm.tsx
    - src/features/add-item-to-tab/ui/ModifierSheet.tsx

key-decisions:
  - "Row-remove swap and duplicate-back-button deletion kept in one task/commit since both touch the same file (TableStatusPanel/index.tsx)"
  - "EmptyState 'Back to Pool Tables' CTA (~line 176, no-session state) deliberately left untouched — distinct affordance from the deleted main-render block"

requirements-completed: [COMPONENT-01, COMPONENT-02, COMPONENT-03, TOKEN-01]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 31 Plan 04: TableStatusPanel Button Swap + Duplicate Back-Button Deletion + TOKEN-01 Comments Summary

**TableStatusPanel row-remove uses shared Button, duplicate persistent back affordance deleted, CategoryForm/ModifierSheet hex sites documented as TOKEN-01 exempt user-data colors**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-11T13:35:00-06:00
- **Completed:** 2026-07-11T13:42:00-06:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `TableStatusPanel/index.tsx`'s icon-only row-remove control (opens the PIN-for-removal flow) now uses `Button variant="ghost" size="icon-sm"` instead of a raw `<button>`, preserving `title="Remove item"` and the existing `onClick` (COMPONENT-01)
- Deleted the redundant main-render `POSButton` "Back to Pool Tables" block (~lines 382-395, identified by its `ArrowLeft` icon) — superseded by Phase 30's `PageContainer backTo="/pool-tables"` (COMPONENT-03/D-09); removed the now-unused `ArrowLeft` import; kept `useNavigate`/`navigate` (5 remaining call sites) and the separate `EmptyState` "Back to Pool Tables" CTA (no-session state, ~line 176) untouched
- `CategoryForm.tsx`: added a D-05 inline comment above the native `type="color"` input (no `shared/ui` color-picker primitive exists) and TOKEN-01 exemption comments above both `#6B7280` hex sites (`useState` default + `placeholder`)
- `ModifierSheet.tsx`: added the same TOKEN-01 exemption comment above the `'#808080'` fallback default — no color values changed anywhere

## Task Commits

Each task was committed atomically:

1. **Task 1: TableStatusPanel — Button row-remove + delete duplicate main-render back-button block** - `1bc0857` (feat)
2. **Task 2: CategoryForm + ModifierSheet — D-05 color comment + D-08 hex exemption comments** - `5daaf5d` (docs)

_No plan-metadata commit in worktree mode — SUMMARY.md commit below serves that role, per worktree isolation instructions._

## Files Created/Modified
- `src/widgets/TableStatusPanel/index.tsx` - Row-remove swapped to `Button`; duplicate back-button block + `ArrowLeft` import removed
- `src/features/manage-products/ui/CategoryForm.tsx` - D-05 + TOKEN-01 exemption comments (2 hex sites), no value changes
- `src/features/add-item-to-tab/ui/ModifierSheet.tsx` - TOKEN-01 exemption comment (1 hex site), no value change

## Decisions Made
- Kept the row-remove swap and the duplicate-back-button deletion as a single task/commit since both edits land in the same file (`TableStatusPanel/index.tsx`), per the plan's own atomicity note.
- Verified via `rg` that `ArrowLeft` occurred only inside the deleted block (0 matches after deletion) and that `navigate(` still has 5 matches (all outside the deleted block, including the EmptyState CTA), confirming no functional regression.

## Deviations from Plan

None — plan executed exactly as written. One environment-level adjustment (not a plan deviation): this worktree checkout had no `node_modules/` (git worktrees don't carry untracked/ignored directories), so a Windows directory junction was created pointing at the main repo's `node_modules` (verified identical `package-lock.json` beforehand) to run `npm run typecheck`/`lint`/`eslint` without a full reinstall. The junction is itself gitignored/untracked and was not committed.

## Issues Encountered
None beyond the node_modules junction workaround described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `TableStatusPanel`, `CategoryForm`, `ModifierSheet` are now fully conformant for this phase's COMPONENT-01/02/03 and TOKEN-01 requirements; no follow-up work identified for these three files.
- `npm run typecheck` shows only the 2 pre-existing, unrelated errors already documented in STATE.md (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`) — zero new errors introduced.
- `npm run lint` exits 0 (only a pre-existing `eslint-plugin-boundaries` config warning, not an error, unrelated to this plan's files).
- Recommended (non-blocking) follow-up per the plan's `<verification>` section: `npx playwright test e2e/16-table-status.spec.ts` once a dev server is available — Phase 30 already documented a pre-existing live-Supabase-RPC-latency flake on this spec, unrelated to this change.

---
*Phase: 31-component-token-spacing-consistency-sweep*
*Completed: 2026-07-11*
