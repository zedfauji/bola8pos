---
phase: 16-kitchen-bar-split-routing
plan: 04
subsystem: category-persistence
tags: [zod, supabase, category, kds, printer, domain-types]

# Dependency graph
requires:
  - phase: 16-kitchen-bar-split-routing
    plan: 01
    provides: "CategoryRoutingSchema / CategoryRouting type + CategorySchema.routing enum field in src/shared/lib/domain.ts, categories.routing column + supabase.types.ts routing typing"
provides:
  - "entities/category/model/queries.ts round-trips routing (read via mapCategoryRow, write via create insert + update partial)"
  - "ModifierSheet.tsx categoryForPricing synthetic fallback uses routing: 'NONE'"
  - "usePrintPreCheque.ts pre-cheque filter excludes both KITCHEN and BAR routed items when KDS is enabled"
affects: [16-05, 16-06, 16-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category persistence call-site migration off isFood boolean onto routing enum ('KITCHEN' | 'BAR' | 'NONE'), following 16-PATTERNS.md exact-edit guidance"

key-files:
  created: []
  modified:
    - src/entities/category/model/queries.ts
    - src/features/add-item-to-tab/ui/ModifierSheet.tsx
    - src/features/print-precheque/usePrintPreCheque.ts

key-decisions:
  - "Confirmed pre-cheque semantics per plan: routing === 'NONE' is the sole print condition when KDS is enabled — both KITCHEN and BAR items are now KDS-routed and excluded from the printed pre-cheque"
  - "No supabase-as-any cast needed — Tables/TablesInsert/TablesUpdate<'categories'> already carry routing from 16-01/16-02's supabase.types.ts regeneration, confirmed present in worktree before editing"

patterns-established: []

requirements-completed: [KBR-01, KBR-04]

# Metrics
duration: 12min
completed: 2026-07-06
---

# Phase 16 Plan 04: Category Persistence + Pricing/Printer Call-Site Routing Migration Summary

**Migrated `entities/category/model/queries.ts`, `ModifierSheet`'s synthetic-category pricing fallback, and `usePrintPreCheque`'s KDS-enabled filter off the retired `isFood` boolean onto the `routing` enum contract established in Plan 16-01.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T20:23:00Z (approx, first commit)
- **Completed:** 2026-07-06T20:35:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `mapCategoryRow` in `src/entities/category/model/queries.ts` now reads `row.routing` (cast via `CategoryRouting`) with a `'NONE'` fallback, replacing `row.is_food ?? false`
- `useMutationCreateCategory`'s insert row writes `routing: input.routing` (was `is_food: input.isFood`)
- `useMutationUpdateCategory`'s partial update conditionally sets `row.routing = rest.routing` (was `row.is_food = rest.isFood`), closing the pre-existing gap where `isFood` was never actually written on update (T-16-08 mitigation)
- `CategoryRouting` added to the `@shared/lib/domain` type import in `queries.ts`
- `ModifierSheet.tsx`'s `categoryForPricing()` synthetic fallback (fires only when `product.category` is entirely missing) now sets `routing: 'NONE'` instead of `isFood: false`
- `usePrintPreCheque.ts`'s KDS-enabled item filter now reads `item.product?.category?.routing === 'NONE'` instead of `item.product?.category?.isFood !== true`; the adjacent comment was updated to describe KITCHEN- and BAR-routed items as both being KDS-handled (excluded from print) rather than only "food items" (T-16-09 mitigation)
- No `supabase as any` cast was needed — `Tables`/`TablesInsert`/`TablesUpdate<'categories'>` already typed `routing` from the 16-01/16-02 `supabase.types.ts` regeneration

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate entities/category/model/queries.ts to routing** - `0611dc2` (feat)
2. **Task 2: Update ModifierSheet fallback + usePrintPreCheque filter to routing** - `74f4c2d` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified

- `src/entities/category/model/queries.ts` - `mapCategoryRow` reads `row.routing` (`'NONE'` fallback); `useMutationCreateCategory` insert writes `routing`; `useMutationUpdateCategory` partial update writes `routing`; `CategoryRouting` added to domain import
- `src/features/add-item-to-tab/ui/ModifierSheet.tsx` - `categoryForPricing()` synthetic fallback category object sets `routing: 'NONE'` (was `isFood: false`)
- `src/features/print-precheque/usePrintPreCheque.ts` - KDS-enabled filter predicate reads `routing === 'NONE'`; comment updated to describe KITCHEN/BAR KDS routing

## Decisions Made

- Followed plan and `16-PATTERNS.md` exactly for both tasks — no deviation from the given code.
- Per the plan's explicit confirmation, the pre-cheque now excludes both `KITCHEN` and `BAR` routed items when `kdsEnabled` is true (previously only `isFood` items were excluded) — this is the intended semantics for the bar KDS board this phase introduces (bar items go to `/kds-bar`, not the printer).

## Deviations from Plan

None - plan executed exactly as written. `supabase.types.ts` (from prior-wave 16-01/16-02) already had `routing` typed on `Tables`/`TablesInsert`/`TablesUpdate<'categories'>`, so the documented fallback (`supabase as any` + file-level eslint-disable) was not needed — this was an anticipated fast-path in the plan's own task instructions, not a deviation.

## Issues Encountered

- Worktree checkout had no `node_modules` and no `.env.local` (both gitignored). Resolved identically to 16-01: created a directory junction to the sibling main checkout's `node_modules` and copied `.env.local`, so `npx tsc --noEmit` could run against the real project config. No source changes required.
- `npx eslint` failed in this worktree with `ERR_MODULE_NOT_FOUND: eslint-plugin-storybook` when resolving `eslint.config.js` through the junction-based `node_modules` — this is an execution-environment artifact of the junction setup (ESM resolution through a Windows junction), not a code issue. Out of scope per the deviation rules' scope boundary (pre-existing environment issue unrelated to this task's file changes). `npx tsc --noEmit` (targeted grep on touched files) showed zero errors for all three touched files, confirming the migration is type-correct.

## User Setup Required

None - no external service configuration required. This plan only edits application source files; the underlying `routing` column/migration was already pushed to the remote database in Plan 16-02.

## Next Phase Readiness

- `entities/category/model/queries.ts`, `ModifierSheet.tsx`, and `usePrintPreCheque.ts` are now fully migrated off `isFood`/`is_food` — no lingering tokens remain in these three files (confirmed via grep).
- Remaining Phase 16 call sites (`entities/kds/model/types.ts`, `entities/kds/model/queries.ts`, `widgets/KdsBoard`, `CategoryTreeEditor`, RBAC, router, HomeDashboard) are covered by sibling Plans 16-03/16-05/16-06 running in parallel or in later waves.
- Full-project `npm run typecheck` will still fail until the whole Phase 16 sweep lands (expected per this plan's `<verification>` note — gate deferred to 16-07, not this plan).

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*
