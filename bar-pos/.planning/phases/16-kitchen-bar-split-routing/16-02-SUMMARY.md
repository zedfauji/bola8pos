---
phase: 16-kitchen-bar-split-routing
plan: 02
subsystem: database
tags: [supabase, postgres, migration, enum]

requires:
  - phase: 16-kitchen-bar-split-routing (16-01)
    provides: categories_routing.sql migration + CategoryRouting Zod schema
provides:
  - Live categories.routing enum column (KITCHEN | BAR | NONE), categories.is_food dropped on remote DB
  - supabase.types.ts regenerated from live schema (--linked)
affects: [16-03, 16-04, 16-05, 16-06, 16-07]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - supabase/migrations/20260706000001_categories_routing.sql
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "Fixed migration bug found during push: backfill CASE expression needed explicit ::category_routing cast (Postgres does not infer enum type from string literals in a CASE)."
  - "Regenerated types.ts via `supabase gen types typescript --linked` (remote, no local Docker stack needed) instead of keeping the manual 16-01 edit, to guarantee live-schema accuracy."

patterns-established: []

requirements-completed: [KBR-01]

duration: ~15min
completed: 2026-07-06
---

# Phase 16 Plan 02: Live DB Migration Push Summary

**`categories.routing` enum column live on remote Supabase project (bar-pos), `is_food` dropped; supabase.types.ts regenerated and confirmed to match.**

## Performance

- **Duration:** ~15 min (including a migration bug fix)
- **Completed:** 2026-07-06
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments
- `supabase db push` applied `20260706000001_categories_routing.sql` to the remote project
- Fixed a real bug in the migration (uncovered only by pushing to a real Postgres instance): the backfill `CASE WHEN is_food THEN 'KITCHEN' ELSE 'BAR' END` needs an explicit `::category_routing` cast — Postgres doesn't infer the enum type from string literals inside a CASE, so the first push attempt failed with `SQLSTATE 42804`
- Confirmed live: `routing` column present as `category_routing` enum, `is_food` column dropped
- Regenerated `supabase.types.ts` against the live schema via `--linked` (no local Docker/stack needed)

## Task Commits

1. **Task 1: Push categories_routing migration to the live database**
   - `39cbcc5` fix(16-01): cast routing backfill CASE expression to category_routing enum
   - (db push applied via CLI, no local commit)
   - `91813fd` feat(16-02): regenerate supabase.types.ts from live schema after routing migration push

## Files Created/Modified
- `supabase/migrations/20260706000001_categories_routing.sql` - added `::category_routing` cast to backfill CASE expression
- `src/shared/lib/supabase.types.ts` - regenerated from live schema (routing enum present, is_food absent)

## Decisions Made
- Regenerated types via `--linked` rather than trusting the manual 16-01 edit, since it's cheap and removes any risk of drift between the manual edit and the actual live schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed enum cast bug in migration surfaced only by live push**
- **Found during:** Task 1 (`supabase db push`)
- **Issue:** `UPDATE categories SET routing = CASE WHEN is_food THEN 'KITCHEN' ELSE 'BAR' END` failed with `SQLSTATE 42804` — Postgres treats the CASE result as `text`, not `category_routing`, so the strict enum column assignment fails.
- **Fix:** Added `::category_routing` cast to the CASE expression.
- **Files modified:** `supabase/migrations/20260706000001_categories_routing.sql`
- **Verification:** Second push attempt succeeded; `grep routing`/`grep is_food` checks on regenerated types.ts pass.
- **Committed in:** `39cbcc5`

---

**Total deviations:** 1 auto-fixed (1 missing critical — migration was transactional so the failed first attempt left the live DB untouched, no partial-state risk).
**Impact on plan:** Necessary correctness fix; no scope creep.

## Issues Encountered
- First `supabase db push` attempt failed mid-transaction (rolled back cleanly, no live DB impact) due to the enum cast bug above; fixed and re-pushed successfully.

## User Setup Required
None - no external service configuration required beyond the CLI push itself (already-linked project, cached CLI login).

## Next Phase Readiness
- KBR-01 complete: live `categories.routing` enum column exists with D-03 backfill applied.
- Wave 3 plans (16-05, 16-06) and Wave 4 (16-07) can now assume the routing column exists in both code and the live database — no more "types pass, DB missing column" false-positive risk.

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*
