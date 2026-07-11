---
phase: 31-component-token-spacing-consistency-sweep
plan: 03
subsystem: ui
tags: [react, shadcn, button, formfield, tailwind, fsd]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: PageContainer/SectionHeader primitives (unrelated but confirms shared/ui conventions used here)
provides:
  - SplitTabSheet's 3 raw buttons (2 dashed add-tiles, 1 icon row-remove) converted to Button
  - ComboAvailabilityEditor's day-of-week toggle chip converted to Button; both time inputs wrapped in FormField
  - CategoryTreeEditor's expand/collapse chevron converted to Button; D-05 native-color-input comment; D-08 TOKEN-01 hex-exemption comment
affects: [31-component-token-spacing-consistency-sweep remaining plans, 35-guardrails drift-lint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Icon-only/chip/toggle raw <button> swapped to shared/ui Button (never POSButton) with variant chosen by role (outline for dashed-tiles/chips, ghost for icon-only)"
    - "Native non-text inputs (type=time) wrapped in FormField while keeping the native input (D-05 opt-out, no shared time-picker exists)"
    - "TOKEN-01 exemption documented via inline comment at arbitrary per-row user-data hex sites, value unchanged"

key-files:
  created: []
  modified:
    - src/features/split-tab/ui/SplitTabSheet.tsx
    - src/features/manage-combos/ui/ComboAvailabilityEditor.tsx
    - src/features/manage-categories/ui/CategoryTreeEditor.tsx

key-decisions:
  - "Import ordering for @shared/ui/* named imports follows ASCII path sort (uppercase before lowercase), e.g. FormField before button, RoutingBadge before button — matched to existing eslint import/order output"

patterns-established:
  - "Pattern 1: Dashed-border add-tile / icon-only remove / toggle-chip / disclosure-chevron controls all swap to Button (not POSButton), preserving className/aria-*/handlers verbatim"
  - "Pattern 2: FormField wraps a native input whose id has no external (E2E/test) reference — the id-clobber via FormField's cloneElement is harmless in that case"

requirements-completed: [COMPONENT-01, COMPONENT-02, TOKEN-01]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 31 Plan 03: SplitTabSheet, ComboAvailabilityEditor, CategoryTreeEditor Consistency Sweep Summary

**Converted 3 multi-concern feature files' raw buttons to `Button`, wrapped 2 native time inputs in `FormField`, and documented 2 TOKEN-01 hex/native-input exemptions — zero behavior change, zero new dependencies.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-11
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- `SplitTabSheet.tsx`'s 3 raw buttons (Add-check dashed tile, Add-person dashed tile, icon-only row-remove) now render via `Button`, matching the file's pre-existing compliant sibling `Button variant="outline" size="sm"`.
- `ComboAvailabilityEditor.tsx`'s day-of-week toggle chip now renders via `Button variant="outline"` with `aria-pressed` preserved; both `type="time"` inputs are wrapped in `FormField` with the native input kept and the cross-field `hasTimeError` message preserved as a sibling paragraph.
- `CategoryTreeEditor.tsx`'s expand/collapse chevron now renders via `Button variant="ghost" size="icon-sm"` with `tabIndex={-1}` and dynamic `aria-label` preserved; a D-05 comment documents the native color input (already inside `FormField`, no markup change); a D-08 TOKEN-01 exemption comment documents the `'#6366f1'` new-category default (value unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap SplitTabSheet's 3 raw buttons to Button (D-02)** - `6449f87` (feat)
2. **Task 2: ComboAvailabilityEditor — day-chip Button + wrap 2 time inputs in FormField (D-05)** - `55aee53` (feat)
3. **Task 3: CategoryTreeEditor — chevron Button + D-05 color comment + D-08 hex comment** - `fb93393` (feat)

_Note: no TDD tasks in this plan — all 3 are markup-only conformance swaps with no `tdd="true"` flag._

## Files Created/Modified
- `src/features/split-tab/ui/SplitTabSheet.tsx` - 2 dashed add-tile buttons + 1 icon row-remove button converted to `Button`
- `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` - day-chip button converted to `Button`; both time inputs wrapped in `FormField`
- `src/features/manage-categories/ui/CategoryTreeEditor.tsx` - chevron button converted to `Button`; D-05 + D-08 exemption comments added

## Decisions Made
- Import ordering for new `@shared/ui/*` named imports (`Button`, `FormField`) placed per the codebase's existing ASCII path-sort convention (uppercase path segments sort before lowercase, e.g. `@shared/ui/FormField` before `@shared/ui/button`, `@shared/ui/RoutingBadge` before `@shared/ui/button`) — confirmed by re-running `npm run lint` after each edit (0 import/order violations).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria (`rg '<button'` zero matches per file, `FormField`/`TOKEN-01 exempt` present, aria-labels/handlers/conditional-render-guards preserved, `tabIndex={-1}` preserved after re-reading `CategoryTreeEditor.tsx:166-180` per Open Question 1's resolution) were met without needing any auto-fixes.

## Issues Encountered
- The worktree had no `node_modules/` (gitignored, not carried over from the main checkout). Ran `npm install --prefer-offline --no-audit --no-fund` once at the start of execution to enable `npm run typecheck`/`npm run lint`. This is environment setup, not a plan deviation — no source files were affected.
- `npx vitest run` requires `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (`.env.local`, not present in this worktree) — the full unit suite could not be run in this environment. Not required by this plan's own `<verify>` blocks (typecheck + lint + `rg` only); no test files exist for any of the 3 touched components (confirmed by 31-RESEARCH.md's "Wave 0 Gaps" section), so this is a pre-existing gap, not a regression risk introduced here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 files in this plan are now zero-raw-button, FormField-wrapped-native-time-input, and TOKEN-01-documented conformant.
- `npm run typecheck` (2 pre-existing unrelated errors in `src/entities/tab/model/queries.ts` and `src/shared/lib/agent/rag.ts`, both predating this plan) and `npm run lint` (exit 0, only pre-existing non-blocking `boundaries` config warning) both pass on the touched files and the full `src/` tree.
- No blockers for the remaining Phase 31 plans (this plan's files do not overlap with any other in-flight Phase 31 plan per the phase's Wave 1 grouping).

---
*Phase: 31-component-token-spacing-consistency-sweep*
*Completed: 2026-07-11*
