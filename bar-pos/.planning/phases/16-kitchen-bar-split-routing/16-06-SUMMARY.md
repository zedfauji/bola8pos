---
phase: 16-kitchen-bar-split-routing
plan: 06
subsystem: ui
tags: [react, category-admin, home-dashboard, rbac, routing]

# Dependency graph
requires:
  - phase: 16-kitchen-bar-split-routing
    plan: 03
    provides: "view_kds_bar StaffAction + RoutingBadge shared/ui component"
  - phase: 16-kitchen-bar-split-routing
    plan: 04
    provides: "entities/category/model/queries.ts round-trips routing on create/update"
provides:
  - "CategoryTreeEditor.tsx: routing selector on create/edit, RoutingBadge/'Not routed' per tree row, routing persisted on both create AND update"
  - "HomeDashboard.tsx: /kds-bar 'Bar Display' tile gated by view_kds_bar (bartender+)"
affects: [16-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requiredAction gating pattern reused for /kds-bar tile (not the legacy visibleToRoles pattern used by /kds)"
    - "Select onValueChange narrowed via 'as CategoryRouting' cast, matching existing codebase convention (RefundSheet.tsx, SplitTabSheet.tsx) rather than UI-SPEC's illustrative direct setState pass"

key-files:
  created: []
  modified:
    - src/features/manage-categories/ui/CategoryTreeEditor.tsx
    - src/widgets/HomeDashboard/ui/HomeDashboard.tsx

key-decisions:
  - "Used &apos; entity (not a raw apostrophe) in the new helper text to stay consistent with react/no-unescaped-entities safety, matching the &rsquo; already used adjacent in the same sentence per UI-SPEC"
  - "Cast Select's onValueChange string payload to CategoryRouting via 'as' inline, following the established codebase pattern (RefundSheet.tsx/SplitTabSheet.tsx) instead of passing the CategoryRouting-typed setState function directly (UI-SPEC's illustrative snippet), since the state setter's narrower parameter type is not directly assignable from the Select primitive's string-typed onValueChange callback"

requirements-completed: [KBR-02, KBR-03]

# Metrics
duration: 12min
completed: 2026-07-06
---

# Phase 16 Plan 06: CategoryTreeEditor Routing UI + HomeDashboard Bar Display Tile Summary

**Added a "Routing station" Select (Kitchen/Bar/None) to the category admin form with per-row RoutingBadge/"Not routed" display and persistence on both create and update, plus a view_kds_bar-gated "Bar Display" tile on the home dashboard.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T14:33:00-06:00 (approx, first read)
- **Completed:** 2026-07-06T14:45:14-06:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `CategoryFormData` gained a `routing: CategoryRouting` field; `CategoryForm` now renders a "Routing station" `Select` (Kitchen/Bar/None, with `UtensilsCrossed`/`Beer` icons on the Kitchen/Bar items) directly after the "Color" field, with muted helper text explaining the KDS-board routing effect
- `NodeRow` now shows a `RoutingBadge` for KITCHEN/BAR categories, or muted "Not routed" text for NONE, positioned between the category name and the `L{depth+1}` depth badge — no change to the row's `gap-2`/`py-1.5` rhythm
- `handleCreate`'s hardcoded `isFood: false` replaced with `routing: data.routing`
- `handleUpdate` now includes `routing: data.routing` in its `CategoryUpdate` payload — this closes a real pre-existing gap where routing/isFood was never persisted on edit (only name+color were)
- Both `CategoryForm` `initial={...}` props updated: edit seeds `routing: dialog.category.routing`; create defaults to `routing: 'NONE'`
- No `isFood` token remains anywhere in `CategoryTreeEditor.tsx`
- `HomeDashboard.tsx`'s `ITEMS` array gained a `/kds-bar` `DashboardItem` (`label: 'Bar Display'`, `icon: Beer`, `requiredAction: 'view_kds_bar'`, `managerLabel: 'Bartender'`) using the standard `requiredAction` gating pattern (not the legacy `visibleToRoles` pattern the pre-existing `/kds` tile uses) — non-holders see the tile with a lock icon and hit the `ManagerPinGate` on click; holders (bartender+) navigate directly
- Confirmed the `managerLabel` badge render (`{item.managerLabel}`) is free-text, not a hardcoded enum, so `'Bartender'` renders correctly alongside existing `'Manager'`/`'Admin'` values

## Task Commits

Each task was committed atomically:

1. **Task 1: Add routing selector + tree badge + create/update persistence to CategoryTreeEditor** - `e06b589` (feat)
2. **Task 2: Add the /kds-bar Bar Display tile to HomeDashboard** - `ffd77af` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified

- `src/features/manage-categories/ui/CategoryTreeEditor.tsx` - `CategoryFormData`/`CategoryForm` gain `routing`; new "Routing station" `Select` field; `NodeRow` shows `RoutingBadge`/"Not routed"; `handleCreate`/`handleUpdate` persist `routing`; Dialog `initial` props seed routing
- `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` - `Beer` icon import added; new `/kds-bar` `DashboardItem` using `requiredAction: 'view_kds_bar'`

## Decisions Made

- Followed the plan and 16-UI-SPEC.md/16-PATTERNS.md exactly for both tasks' structure and placement.
- Minor deviation from the UI-SPEC's illustrative `onValueChange={setRouting}` snippet: used `onValueChange={value => { setRouting(value as CategoryRouting); }}` instead, matching the established codebase convention for narrowing a Radix `Select`'s `string` payload to a domain union type (see `RefundSheet.tsx`, `SplitTabSheet.tsx`). Passing the `CategoryRouting`-typed state setter directly to a `(value: string) => void` prop is not type-safe under this project's strict config (target parameter `string` is not assignable to `CategoryRouting`), so the cast form was required — same category of mechanical illustrative-snippet fix as `16-03`'s import-order adjustment (Rule 1 auto-fix, no behavioral change).
- Used `&apos;` (not a raw apostrophe) for "category's" in the new helper text to stay lint-safe with `react/no-unescaped-entities`, keeping the raw UI-SPEC copy's meaning unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted Select's onValueChange to avoid a type error**
- **Found during:** Task 1 (Routing station Select)
- **Issue:** UI-SPEC's illustrative JSX (`<Select value={routing} onValueChange={setRouting}>`) passes a `Dispatch<SetStateAction<CategoryRouting>>` directly where a `(value: string) => void` is expected; `string` is not assignable to the narrower `CategoryRouting` union, so this fails `tsc --noEmit` under the project's strict settings.
- **Fix:** Wrapped in an inline handler casting the value: `onValueChange={value => { setRouting(value as CategoryRouting); }}`, matching the existing codebase pattern used in `RefundSheet.tsx` and `SplitTabSheet.tsx` for the same class of Select-to-union-type binding.
- **Files modified:** `src/features/manage-categories/ui/CategoryTreeEditor.tsx`
- **Commit:** `e06b589`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Purely mechanical type-safety fix required for the file to compile; no behavioral change, no scope creep.

## Issues Encountered

- Worktree checkout had no `node_modules` and no `.env.local` (both gitignored). A first `mklink /J` attempt using an absolute Windows path produced a doubled drive-letter reparse point (`D:\D:\...`) due to path handling through the git-bash/cmd boundary, resulting in an empty/broken junction. Resolved by removing it and re-running `mklink /J node_modules ..\..\..\..\bar-pos\node_modules` with a relative path, which linked correctly (813 entries). `.env.local` copied from the sibling main checkout. No source changes required; this is an execution-environment setup step, not a deviation in application code.
- `npx tsc`/`npx eslint` initially failed with a "This is not the tsc command you are looking for" banner (npx resolving a global npm stub instead of the local binary through the junction); ran `node node_modules/typescript/bin/tsc` and `node node_modules/eslint/bin/eslint.js` directly instead, which worked correctly.
- Full-project `tsc --noEmit` shows two pre-existing errors unrelated to this plan's files (`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/rag.ts`) — confirmed via targeted grep that neither `CategoryTreeEditor.tsx` nor `HomeDashboard.tsx` produce any errors. Full-project typecheck/lint gate is deferred to 16-07 per this plan's `<verification>` note.

## User Setup Required

None - no external service configuration required. This plan only edits application source files.

## Next Phase Readiness

- Routing is now fully editable end-to-end (create AND update) and visible per-category in the admin tree, closing the T-16-13 tampering mitigation from this plan's threat model.
- `/kds-bar` now has a discoverable, correctly-gated entry point on the home dashboard (T-16-14 mitigation — non-holders hit `ManagerPinGate`, not free navigation); `KdsBarRoute` (16-05) remains the authoritative route-level guard as defense in depth.
- No blockers for 16-07's full-project typecheck/lint sweep from this plan's changes.

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*

## Self-Check: PASSED

All modified files verified present on disk (`src/features/manage-categories/ui/CategoryTreeEditor.tsx`, `src/widgets/HomeDashboard/ui/HomeDashboard.tsx`, this SUMMARY.md); all three commits (`e06b589`, `ffd77af`, `ff04ffc`) verified present via `git cat-file -e`.
