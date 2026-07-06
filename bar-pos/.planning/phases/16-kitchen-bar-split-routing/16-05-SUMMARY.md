---
phase: 16-kitchen-bar-split-routing
plan: 05
subsystem: kds-board
tags: [react, tanstack-query, rbac, kds, routing]

# Dependency graph
requires:
  - phase: 16-kitchen-bar-split-routing
    plan: 01
    provides: "CategoryRouting type / CategoryRoutingSchema in src/shared/lib/domain.ts"
  - phase: 16-kitchen-bar-split-routing
    plan: 03
    provides: "view_kds_bar RBAC action + RoutingBadge shared/ui component"
provides:
  - "useKdsItems(routing: 'KITCHEN' | 'BAR') parameterized query + kdsKeys.items(routing) cache key"
  - "KdsOrderItem.routing field (replaces isFood)"
  - "KdsBoard({ routing }) parameterized widget with RoutingBadge on cards + station-derived copy"
  - "KdsBarRoute guard (src/app/kds-bar-route.tsx) gated on view_kds_bar"
  - "KdsBarPage (src/pages/kds-bar/index.tsx) rendering KdsBoard routing=\"BAR\""
  - "/kds-bar route registered in src/app/router.tsx"
affects: [16-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parameterized TanStack Query key (kdsKeys.items(routing)) so two boards never share a cache entry, with a broad kdsKeys.all invalidate on realtime/mutation events since the bridge/mutation hook can't know which board(s) are mounted"
    - "Widget parameterization by prop (KdsBoard({ routing })) rather than duplicating the board, reusing KdsCard/ComboKdsCard/bump logic verbatim across two route/page pairs"
    - "Route guard clone pattern (KdsBarRoute mirrors KdsRoute exactly, single can() string swap) matching ReportsRoute/RbacRoute/WaitlistRoute precedent"

key-files:
  created:
    - src/app/kds-bar-route.tsx
    - src/pages/kds-bar/index.tsx
  modified:
    - src/entities/kds/model/types.ts
    - src/entities/kds/model/queries.ts
    - src/widgets/KdsBoard/index.tsx
    - src/pages/kds/index.tsx
    - src/app/router.tsx
    - src/features/bump-kds-item/useBumpKdsItem.ts

key-decisions:
  - "useKdsRealtimeBridge and useBumpKdsItem (Rule 3 fix, not in plan's files_modified) both invalidate kdsKeys.all rather than a routing-specific key — neither hook knows which board(s) are currently mounted, so a broad invalidate is correct and matches 16-PATTERNS.md's stated approach for the realtime bridge"
  - "Collapsed the categories!inner select from multi-line to categories!inner(id, routing) on one line — it's a template literal (Supabase query string), not formatted code, so this was a safe zero-risk edit to satisfy the plan's literal grep verification"
  - "Removed an eslint-flagged unnecessary type assertion (categoryRouting as 'KITCHEN' | 'BAR') on the pushed item — TS narrows categoryRouting via the preceding `if (categoryRouting !== routing) continue` guard, so the cast was redundant; auto-fixed via eslint --fix (Rule 1)"

requirements-completed: [KBR-02, KBR-03]

# Metrics
duration: 15min
completed: 2026-07-06
---

# Phase 16 Plan 05: Bar KDS Board (routing-parameterized) Summary

**Parameterized `useKdsItems`/`KdsOrderItem`/`KdsBoard` by a `routing` filter and shipped a new `/kds-bar` (Bar Display) page reusing the exact same widget, guarded by `view_kds_bar` — the kitchen board (`/kds`) is unchanged in behavior, only now explicit about which station it renders.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-06T20:39:00Z (approx, first commit)
- **Completed:** 2026-07-06T20:47:03Z
- **Tasks:** 3
- **Files modified:** 8 (6 modified, 2 created)

## Accomplishments

- `KdsOrderItemSchema.isFood` replaced with `routing: CategoryRoutingSchema` (imported from `@shared/lib/domain`)
- `useKdsItems(routing: 'KITCHEN' | 'BAR')` filters strictly on `categoryRouting !== routing`; `kdsKeys.items(routing)` keys `/kds` and `/kds-bar` caches separately so they never bleed into each other
- Supabase select swapped `categories!inner(id, is_food)` → `categories!inner(id, routing)`
- `KdsBoard({ routing })` threads the prop to `useKdsItems(routing)`; both `KdsCard` and `ComboKdsCard` render `<RoutingBadge routing={item.routing} />` next to the product name (before `ComboBadge` on the combo variant)
- Loading/error/empty copy in `KdsBoard` now derives from `stationLabel` ("kitchen"/"bar") instead of hardcoded "food"/"kitchen" literals
- `/kds` (`src/pages/kds/index.tsx`) now passes `routing="KITCHEN"` explicitly — no implicit default
- New `KdsBarRoute` guard (`src/app/kds-bar-route.tsx`) — exact clone of `KdsRoute`, checks `can('view_kds_bar')`, silent redirect to `/home` (no toast, matching `KdsRoute` precedent)
- New `KdsBarPage` (`src/pages/kds-bar/index.tsx`) — exact clone of `KdsPage`, title "Bar Display", renders `<KdsBoard routing="BAR" />`
- `/kds-bar` registered in `src/app/router.tsx` immediately after `/kds`, same `<ProtectedRoute><KdsBarRoute>...` shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Parameterize useKdsItems + KdsOrderItem by routing** - `4effcab` (feat)
2. **Task 2: Thread routing prop through KdsBoard (copy + RoutingBadge) + update /kds page** - `54535d6` (feat)
3. **Task 3: Add KdsBarRoute guard + /kds-bar page + router registration** - `36a69b3` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified

- `src/entities/kds/model/types.ts` - `KdsOrderItemSchema.isFood: z.boolean()` → `routing: CategoryRoutingSchema` (imports `CategoryRoutingSchema` from `@shared/lib/domain`)
- `src/entities/kds/model/queries.ts` - `kdsKeys.items(routing)` parameterized key; `useKdsItems(routing)` signature; select `categories!inner(id, routing)`; filter `categoryRouting !== routing`; pushed item carries `routing`; realtime bridge invalidates `kdsKeys.all`
- `src/widgets/KdsBoard/index.tsx` - `KdsBoard({ routing })` signature; `RoutingBadge` import + render on `KdsCard`/`ComboKdsCard`; `stationLabel`-derived loading/error/empty copy
- `src/pages/kds/index.tsx` - `<KdsBoard routing="KITCHEN" />` (explicit, was implicit no-prop call)
- `src/app/kds-bar-route.tsx` (new) - `KdsBarRoute` guard, `can('view_kds_bar')`, silent redirect
- `src/pages/kds-bar/index.tsx` (new) - `KdsBarPage` default export, title "Bar Display", `<KdsBoard routing="BAR" />`
- `src/app/router.tsx` - `KdsBarRoute` import, `KdsBarPage` lazy import, `/kds-bar` route block after `/kds`
- `src/features/bump-kds-item/useBumpKdsItem.ts` - `kdsKeys.items()` → `kdsKeys.all` (Rule 3 fix — call site broken by Task 1's parameterized key, not in plan's `files_modified`)

## Decisions Made

- Followed the plan and `16-PATTERNS.md`/`16-UI-SPEC.md` exactly for structure and copy; two mechanical deviations documented below.
- `useBumpKdsItem`'s realtime invalidate target was fixed alongside the realtime bridge's, using the same `kdsKeys.all` broad-invalidate rationale the plan specified for the bridge (neither hook knows which board is mounted).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Fixed `kdsKeys.items()` call site in `useBumpKdsItem.ts`**
- **Found during:** Task 1 (`npx tsc --noEmit` after parameterizing `kdsKeys.items`)
- **Issue:** `src/features/bump-kds-item/useBumpKdsItem.ts` (not listed in this plan's `files_modified`) calls `kdsKeys.items()` with no argument on mutation success — this is a direct compile break caused by Task 1's signature change (`kdsKeys.items(routing)`), not a pre-existing/out-of-scope issue.
- **Fix:** Changed to `queryClient.invalidateQueries({ queryKey: kdsKeys.all })` — same broad-invalidate rationale as `useKdsRealtimeBridge` (the mutation doesn't know which board(s) are mounted).
- **Files modified:** `src/features/bump-kds-item/useBumpKdsItem.ts`
- **Commit:** `4effcab`

**2. [Rule 1 - Bug] Removed eslint-flagged unnecessary type assertion in `queries.ts`**
- **Found during:** Task 1 (`npx eslint --fix`)
- **Issue:** `routing: categoryRouting as 'KITCHEN' | 'BAR'` — TS narrows `categoryRouting` to `'KITCHEN' | 'BAR'` via the preceding `if (categoryRouting !== routing) continue;` guard, making the assertion redundant (`@typescript-eslint/no-unnecessary-type-assertion`).
- **Fix:** Removed the assertion (`routing: categoryRouting,`). No behavior change.
- **Files modified:** `src/entities/kds/model/queries.ts`
- **Commit:** `4effcab`

**3. [Rule 1 - Bug] Collapsed multi-line `categories!inner` select to a single line**
- **Found during:** Task 1 verification (plan's literal grep `categories!inner(id, routing)` does not match across newlines)
- **Issue:** The Supabase select template literal formatted `categories!inner(...)` across 4 lines (matching the pre-existing `is_food` formatting); the plan's automated verify command expects the exact literal string on one line.
- **Fix:** Reformatted to `categories!inner(id, routing)` on a single line inside the template literal — this is a query string, not linted/formatted code, so the change is purely cosmetic with zero functional risk.
- **Files modified:** `src/entities/kds/model/queries.ts`
- **Commit:** `4effcab`

## Issues Encountered

- Worktree checkout had no `node_modules` and no `.env.local` (both gitignored) — same gap noted in prior 16-01/16-03 summaries. Resolved by symlinking `node_modules` from the sibling main checkout and copying `.env.local` so `npx tsc`/`npx eslint` could run. No source changes required.
- Full-project `npx tsc --noEmit` shows 3 remaining errors after all 3 tasks: `src/entities/tab/model/queries.ts` (pre-existing, unrelated), `src/shared/lib/agent/rag.ts` (pre-existing, unrelated), and `src/features/manage-categories/ui/CategoryTreeEditor.tsx` (in-scope for sibling plan 16-06, which adds the `routing` field to `CategoryFormData`/`handleCreate`/`handleUpdate` — expected per this plan's verification note: "full-project typecheck/lint gate runs in 16-07 after the whole sweep lands").

## User Setup Required

None.

## Next Phase Readiness

- `/kds-bar` is live, guarded, and renders BAR-routed items; `/kds` is unchanged in behavior (still KITCHEN-only) and now explicit about its routing param.
- `RoutingBadge` is now consumed on both KDS card variants — 16-06's `CategoryTreeEditor.tsx` `NodeRow` consumption is independent and unaffected by this plan.
- 16-07 (final sweep) still needs to resolve the `CategoryTreeEditor.tsx` `isFood` reference (owned by 16-06) before a clean full-project `typecheck`/`lint` gate passes — not a blocker introduced by this plan.
- No HomeDashboard `/kds-bar` tile was added in this plan (that file/task is out of this plan's `files_modified` scope — confirm whether 16-06 or 16-07 owns it).

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*
