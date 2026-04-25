---
phase: 08-polish-reports-e2e-hardening
plan: 01
subsystem: database
tags: [sql, migrations, supabase, views, indexes, waitlist, reporting]

requires:
  - phase: 07-waitlist-whatsapp
    provides: waitlist_entries + waitlist_notifications tables + pg_net notify trigger

provides:
  - combo_mix_daily SQL view (S6-01)
  - recipe_variance_daily SQL view (S6-01)
  - waitlist_metrics_daily SQL view (S6-01)
  - idx_stock_movements_ingredient_ts index (S6-02)
  - idx_waitlist_entries_status_created_at index (S6-02)
  - Commented DOWN blocks on all 4 Phase 7 waitlist migrations (S6-15)
  - Wave 0 test stubs for 6 new report hooks

affects:
  - 08-02 (query hooks will SELECT from these views)
  - 08-03 (report widgets depend on query hook data)

tech-stack:
  added: []
  patterns:
    - "Reporting views use CREATE OR REPLACE for idempotency"
    - "NULL::numeric cast used when column absent from schema (Risk 3 pattern)"
    - "All migration files include commented -- DOWN: blocks for reversibility"
    - "Wave 0 test stubs use it.todo() — counted as pending, not failures"

key-files:
  created:
    - bar-pos/supabase/migrations/20260505000001_s6_reporting_views.sql
    - bar-pos/supabase/migrations/20260505000002_s6_performance_indexes.sql
  modified:
    - bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx
    - bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts
    - bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts
    - bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts
    - bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts
    - bar-pos/src/pages/waitlist/index.tsx
    - bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql
    - bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql
    - bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql
    - bar-pos/supabase/migrations/20260501000004_waitlist_trigger_url.sql
    - bar-pos/src/entities/tab/model/queries-reports.test.ts

key-decisions:
  - "waitlist_metrics_daily uses NULL::numeric AS avg_quoted_wait — quoted_wait_minutes column absent from waitlist_entries schema (Risk 3 from RESEARCH.md)"
  - "Phase 7 migration file names differ from plan (notify_trigger vs pg_net_trigger, trigger_url vs schema_fix) — DOWN blocks added to actual files"

requirements-completed: [S6-01, S6-02, S6-15]

duration: 15min
completed: 2026-04-25
---

# Phase 08 Plan 01: Wave 0 Prerequisite Cleanup + S6 DB Migrations Summary

**3 SQL reporting views (combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily) + 2 performance indexes + 6 lint fixes committed, unblocking pre-commit hooks and establishing the DB foundation for Phase 8 report hooks**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-25T17:00:00Z
- **Completed:** 2026-04-25T17:15:00Z
- **Tasks:** 2 of 3 (Task 3 is a blocking human-verify checkpoint: `supabase db push`)
- **Files modified:** 11

## Accomplishments

- Committed 6 Phase 7 waitlist files with fixed import order (pre-commit hook now passes)
- Created `20260505000001_s6_reporting_views.sql` with 3 reporting views
- Created `20260505000002_s6_performance_indexes.sql` with 2 performance indexes
- Added commented DOWN blocks to all 4 Phase 7 waitlist migrations
- Added 6 `it.todo` stubs to `queries-reports.test.ts` for Wave 0 TDD gate
- All: typecheck + lint + 105 test files pass (1054 tests, 8 todo)

## Task Commits

1. **Task 1a: Fix import order lint violations** - `716154e` (fix)
2. **Task 1b: Wave 0 query-hook stubs** - `0c2d617` (test)
3. **Task 2: S6-01 views + S6-02 indexes + S6-15 DOWN scripts** - `0eaa10d` (feat)

## Files Created/Modified

- `bar-pos/supabase/migrations/20260505000001_s6_reporting_views.sql` - combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily views
- `bar-pos/supabase/migrations/20260505000002_s6_performance_indexes.sql` - idx_stock_movements_ingredient_ts + idx_waitlist_entries_status_created_at
- `bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql` - added DOWN block
- `bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql` - added DOWN block
- `bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql` - added DOWN block
- `bar-pos/supabase/migrations/20260501000004_waitlist_trigger_url.sql` - added DOWN block
- `bar-pos/src/entities/tab/model/queries-reports.test.ts` - 6 new it.todo stubs
- `bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` - brace style lint fix
- `bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts` - import order fix
- `bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` - import order fix
- `bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts` - import order fix
- `bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` - import order fix
- `bar-pos/src/pages/waitlist/index.tsx` - FSD import order fix (@widgets before @shared)

## Decisions Made

- `waitlist_metrics_daily` uses `NULL::numeric AS avg_quoted_wait` — the `quoted_wait_minutes` column is not present in the `waitlist_entries` schema (RESEARCH.md Risk 3). The view still compiles and the column can be wired up in a future migration when the column is added.
- Phase 7 migration files were named differently than the plan specified (`waitlist_notify_trigger.sql` and `waitlist_trigger_url.sql` instead of `waitlist_pg_net_trigger.sql` and `waitlist_schema_fix.sql`). DOWN blocks were added to the actual files.

## Deviations from Plan

None — plan executed exactly as written. The `quoted_wait_minutes` absence was anticipated in the plan's Risk 3 handling and handled per the specified fallback pattern.

## Issues Encountered

- Phase 7 migration file names in the plan (`20260501000003_waitlist_pg_net_trigger.sql`, `20260501000004_waitlist_schema_fix.sql`) did not match the actual files on disk (`20260501000003_waitlist_notify_trigger.sql`, `20260501000004_waitlist_trigger_url.sql`). Resolved by working with the actual files.

## User Setup Required (Task 3 — Blocking Checkpoint)

**`supabase db push` must be run manually to apply the new migrations to the remote DB.**

Run from `bar-pos/`:
```
supabase db push
```

After push, verify:
```
supabase db psql -c "\dv combo_mix_daily"
supabase db psql -c "\dv recipe_variance_daily"
supabase db psql -c "\dv waitlist_metrics_daily"
supabase db psql -c "\d stock_movements" | grep idx_stock_movements_ingredient_ts
```

Report whether `quoted_wait_minutes` column exists on `waitlist_entries` (affects view accuracy):
```
supabase db psql -c "\d waitlist_entries" | grep quoted_wait
```

## Next Phase Readiness

- DB foundation complete once `supabase db push` is confirmed
- Plan 08-02 (query hooks for combo mix, recipe variance, waitlist analytics) depends on the views being present in the remote DB
- Pre-commit hooks unblocked — all 6 Phase 7 lint violations committed

---
*Phase: 08-polish-reports-e2e-hardening*
*Completed: 2026-04-25*
