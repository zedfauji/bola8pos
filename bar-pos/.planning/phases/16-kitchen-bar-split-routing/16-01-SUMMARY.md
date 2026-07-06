---
phase: 16-kitchen-bar-split-routing
plan: 01
subsystem: database
tags: [zod, supabase, postgres, migration, domain-types]

# Dependency graph
requires:
  - phase: 14-audit-logs
    provides: post-Phase-8 DOWN-script migration convention (BEGIN/COMMIT UP + trailing DOWN comment block)
provides:
  - "CategoryRoutingSchema / CategoryRouting type in src/shared/lib/domain.ts"
  - "CategorySchema.routing enum field (replaces isFood boolean)"
  - "category_routing Postgres enum + categories.routing column via idempotent migration"
  - "supabase.types.ts categories Row/Insert/Update typed with routing instead of is_food"
affects: [16-02, 16-03, 16-04, 16-05, 16-06, 16-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod enum + inferred type pair (CategoryRoutingSchema/CategoryRouting) mirroring existing DiscountTypeSchema/DiscountType naming convention"
    - "Idempotent migration: guarded CREATE TYPE via pg_type existence check, ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS, backfill CASE inside the same BEGIN/COMMIT transaction as the destructive DROP"

key-files:
  created:
    - supabase/migrations/20260706000001_categories_routing.sql
  modified:
    - src/shared/lib/domain.ts
    - src/shared/lib/domain.test.ts
    - src/shared/lib/domain-helpers.test.ts
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "Replaced isFood in-place rather than adding routing alongside it (D-01) — single source of truth, no risk of disagreement between the two fields"
  - "Backfill CASE (is_food=true -> KITCHEN, is_food=false -> BAR) runs in the same transaction as the DROP COLUMN, per T-16-01 mitigation — no categorization data is lost"
  - "Did not add a const-object mirror (like DiscountType) for CategoryRouting per 16-PATTERNS.md guidance — it's consumed as a plain string union in UI selects"

patterns-established:
  - "Category routing enum contract (Zod + SQL enum + generated types) that all downstream Phase 16 plans (KDS query, KdsBoard, CategoryTreeEditor, RBAC, router) import from"

requirements-completed: [KBR-01]

# Metrics
duration: 2min
completed: 2026-07-06
---

# Phase 16 Plan 01: Category Routing Type + Schema Contract Summary

**Replaced `categories.isFood` boolean with a `routing` enum (`KITCHEN | BAR | NONE`) across the Zod domain model, an idempotent Postgres migration, and the generated Supabase types — the root contract every other Phase 16 plan builds on.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-06T14:16:00-06:00 (approx, first commit)
- **Completed:** 2026-07-06T14:17:34-06:00
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- `CategoryRoutingSchema` (`z.enum(['KITCHEN','BAR','NONE'])`) and `CategoryRouting` type exported from `src/shared/lib/domain.ts`, following the existing `DiscountTypeSchema`/`DiscountType` naming convention
- `CategorySchema.routing` (default `'NONE'`) replaces `CategorySchema.isFood`; all touched test fixtures updated
- New idempotent migration `20260706000001_categories_routing.sql`: guarded `category_routing` enum creation, `routing` column add, D-03 backfill (`is_food=true → KITCHEN`, `is_food=false → BAR`), and `is_food` column drop — all inside a single `BEGIN/COMMIT` transaction, with a reversing `-- DOWN:` comment block
- `src/shared/lib/supabase.types.ts` categories `Row`/`Insert`/`Update` blocks now type `routing: 'KITCHEN' | 'BAR' | 'NONE'` in place of `is_food: boolean`

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace CategorySchema.isFood with routing enum in domain.ts + fix test fixtures** - `d650611` (feat)
2. **Task 2: Create categories_routing migration + swap is_food to routing in supabase.types.ts** - `d500033` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator finalizes STATE.md/ROADMAP.md after merge)

## Files Created/Modified
- `src/shared/lib/domain.ts` - Added `CategoryRoutingSchema`/`CategoryRouting`; replaced `CategorySchema.isFood` with `routing: CategoryRoutingSchema.default('NONE')`
- `src/shared/lib/domain.test.ts` - Updated `CategorySchema` fixtures (`isFood: false` → `routing: 'NONE'`, ×2 occurrences)
- `src/shared/lib/domain-helpers.test.ts` - Updated 3 `Category` fixtures (`isFood: false` → `routing: 'NONE'`)
- `src/shared/lib/supabase.types.ts` - `categories` Row/Insert/Update: `is_food: boolean` → `routing: 'KITCHEN' | 'BAR' | 'NONE'`, alphabetical field order preserved
- `supabase/migrations/20260706000001_categories_routing.sql` (new) - Idempotent UP (enum + column + backfill + drop) with trailing DOWN comment block

## Decisions Made
- Followed plan as specified for both tasks — no deviation from the exact code given in `16-PATTERNS.md`.
- Backfill business rule (bar-first: `is_food=false → BAR`) implemented exactly per D-03, inside the same transaction as the destructive `DROP COLUMN` to satisfy threat mitigation T-16-01.

## Deviations from Plan

None - plan executed exactly as written. Local test environment setup (symlinking `node_modules` from the main checkout and copying `.env.local` into the worktree) was required to run `npx vitest` in this isolated worktree, but this is execution-environment plumbing, not a plan deviation — no source files were affected beyond what the plan specified.

## Issues Encountered
- Worktree checkout had no `node_modules` and no `.env.local` (both gitignored, not part of the worktree branch history). Resolved by symlinking `node_modules` from the sibling main checkout and copying `.env.local` so `npx vitest run` could execute against the real test Supabase project. No source changes required.

## User Setup Required

None - no external service configuration required. The migration file is authored but not yet pushed to any Supabase project — that live DB push is explicitly deferred to Plan 16-02 per this plan's `<success_criteria>`.

## Next Phase Readiness
- `CategoryRouting` type, `CategorySchema.routing` field, and the `routing` column/enum shape are now defined and ready for Plan 16-02 (live migration push) and the downstream call-site sweep (16-03…16-06: `KdsOrderItemSchema`, `useKdsItems`, `KdsBoard`, `CategoryTreeEditor`, RBAC, router, `ModifierSheet`, `usePrintPreCheque`, `entities/category/model/queries.ts`).
- Full-project `npm run typecheck` will fail until those downstream plans land (expected per this plan's `<verification>` note) — not a blocker for this plan's completion.

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commits (d650611, d500033) and SUMMARY commit (591e435) verified present in git history.
