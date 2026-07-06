---
phase: 16-kitchen-bar-split-routing
plan: 03
subsystem: rbac-ui-primitives
tags: [rbac, shared-ui, badge, storybook]

# Dependency graph
requires:
  - phase: 16-kitchen-bar-split-routing
    plan: 01
    provides: "CategoryRouting type in src/shared/lib/domain.ts"
provides:
  - "view_kds_bar StaffAction granted to bartender/manager/admin, excluded from kitchen"
  - "RoutingBadge shared/ui component (icon+label for KITCHEN/BAR, null for NONE)"
affects: [16-05, 16-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive RBAC action sets: new action added only to BARTENDER_ACTIONS, inherited upward via Set spread into MANAGER_ACTIONS/ADMIN_ACTIONS — never edit composed sets directly"
    - "Badge component shape (icon + Badge variant=\"secondary\" + text label) mirrored from ChefHatBadge for RoutingBadge"

key-files:
  created:
    - src/shared/ui/RoutingBadge.tsx
    - src/shared/ui/RoutingBadge.stories.tsx
  modified:
    - src/shared/lib/rbac.ts
    - src/shared/lib/rbac.test.ts
    - src/shared/ui/index.ts

key-decisions:
  - "view_kds_bar added only to BARTENDER_ACTIONS (not KITCHEN_ACTIONS, not MANAGER_EXTRA/ADMIN_EXTRA) — manager/admin inherit automatically via Set spread, kitchen explicitly excluded per D-04"
  - "RoutingBadge uses neutral secondary variant for both KITCHEN and BAR — differentiation is icon+text only, no color-coding, per locked UI-SPEC section A / Color section"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-07-06
---

# Phase 16 Plan 03: RBAC view_kds_bar Action + RoutingBadge UI Primitive Summary

**Added the `view_kds_bar` RBAC action (bartender/manager/admin, excluding kitchen) and the `RoutingBadge` shared/ui component (icon+label for KITCHEN/BAR, renders nothing for NONE) — the two independent foundations that gate `/kds-bar` (16-06) and decorate KDS cards + the category editor (16-05, 16-06).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-06T20:31:00Z (approx, first commit)
- **Completed:** 2026-07-06T20:37:07Z
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

- `view_kds_bar` added to `STAFF_ACTIONS` union (immediately after `view_kds`) and to `BARTENDER_ACTIONS`; `MANAGER_ACTIONS`/`ADMIN_ACTIONS` inherit it automatically via existing Set-spread composition — `KITCHEN_ACTIONS` left untouched, so `canAccess('kitchen', 'view_kds_bar')` returns `false`
- `rbac.test.ts` `ALLOWED` mirror matrix updated for `bartender` and `manager` (admin already covered via `new Set(STAFF_ACTIONS)`; kitchen's explicit set unchanged, which asserts the D-04 exclusion) — full parametrized matrix (102 tests, every role × every action) passes
- `RoutingBadge` component created exactly per the locked `16-UI-SPEC.md` section A: returns `null` for `routing === 'NONE'`, renders `UtensilsCrossed` + "Kitchen" for `KITCHEN`, `Beer` + "Bar" for `BAR`, both wrapped in `Badge variant="secondary"` with no color/accent differentiation (icon + text only)
- `RoutingBadge.stories.tsx` created with `Kitchen`/`Bar`/`None` stories, importing from `@storybook/react-vite` per the `storybook/no-renderer-packages` ESLint rule
- `RoutingBadge` exported from the `shared/ui` barrel (`index.ts`) in the Display group, alongside `ChefHatBadge`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add view_kds_bar action to rbac.ts + rbac.test.ts matrix** - `bb40872` (feat)
2. **Task 2: Create RoutingBadge component + Storybook story + barrel export** - `57a12e4` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified

- `src/shared/lib/rbac.ts` - Added `'view_kds_bar'` to `STAFF_ACTIONS` (after `'view_kds'`) and to `BARTENDER_ACTIONS` Set (with inline comment referencing D-04); no change to `KITCHEN_ACTIONS`, `MANAGER_EXTRA`, or `ADMIN_EXTRA`
- `src/shared/lib/rbac.test.ts` - Added `'view_kds_bar'` to the `ALLOWED.bartender` and `ALLOWED.manager` sets in the test mirror matrix
- `src/shared/ui/RoutingBadge.tsx` (new) - `RoutingBadge({ routing }: { routing: CategoryRouting })` component per UI-SPEC section A
- `src/shared/ui/RoutingBadge.stories.tsx` (new) - `Kitchen`, `Bar`, `None` Storybook stories
- `src/shared/ui/index.ts` - Added `export { RoutingBadge } from './RoutingBadge';` in the Display section

## Decisions Made

- Followed plan and 16-PATTERNS.md/16-UI-SPEC.md exactly for both tasks — `view_kds_bar` placement matches the specified 4-point rbac.ts pattern, and `RoutingBadge` reproduces the UI-SPEC's locked code verbatim.
- Import order in `RoutingBadge.tsx` was adjusted (type import from `@shared/lib/domain` placed before the relative `./badge` import) to satisfy the `import/order` ESLint rule — the UI-SPEC's illustrative code snippet had `./badge` first; this is a mechanical lint-driven reordering with no semantic change (Rule 1 auto-fix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import/order ESLint violation in RoutingBadge.tsx**
- **Found during:** Task 2 verification (`npx eslint`)
- **Issue:** The UI-SPEC's illustrative code block imports `Badge` from `./badge` before the `CategoryRouting` type from `@shared/lib/domain`; the project's `import/order` ESLint rule requires the aliased `@shared/*` import first.
- **Fix:** Reordered the two import statements (type import from `@shared/lib/domain` now precedes `./badge`). No behavioral change.
- **Files modified:** `src/shared/ui/RoutingBadge.tsx`
- **Commit:** `57a12e4`

## Issues Encountered

- Worktree checkout had no `node_modules` and no `.env.local` (both gitignored, not part of the worktree branch history) — same environment gap noted in 16-01-SUMMARY.md. Resolved by symlinking `node_modules` from the sibling main checkout and copying `.env.local` so `npx vitest run` / `npx eslint` / `npx tsc` could execute. No source changes required.
- `.planning/phases/16-kitchen-bar-split-routing/16-PATTERNS.md` is gitignored (`.planning/` is fully gitignored per `bar-pos/.gitignore`) and was never force-added to the repo, so it did not exist in this worktree's checkout even though `16-CONTEXT.md`/`16-UI-SPEC.md`/`16-*-PLAN.md` files were present (those were force-added by earlier plan executions). Read directly from the main checkout's working tree (`D:\Projects\Code\POS\bola8pos-kiro\bar-pos\.planning\...\16-PATTERNS.md`) instead — same file content, no discrepancy, just noting the read path differed from the worktree-relative path listed in the plan's `read_first`.

## User Setup Required

None.

## Next Phase Readiness

- `view_kds_bar` and `RoutingBadge` are both ready for consumption by Plan 16-05 (KDS cards) and Plan 16-06 (`KdsBarRoute` guard, `/kds-bar` page, `CategoryTreeEditor` routing selector + `NodeRow` badge/"Not routed" placement).
- No blockers introduced for downstream plans; `rbac.test.ts` (102/102) and RoutingBadge-specific typecheck/lint are green.

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/shared/lib/rbac.ts`, `src/shared/lib/rbac.test.ts`, `src/shared/ui/RoutingBadge.tsx`, `src/shared/ui/RoutingBadge.stories.tsx`, `src/shared/ui/index.ts`, this SUMMARY.md); both task commits (`bb40872`, `57a12e4`) verified present via `git cat-file -e`.
