---
phase: 07-waitlist-whatsapp
plan: 01
subsystem: database
tags: [postgres, supabase, rls, pg_net, migrations, waitlist]

requires:
  - phase: 05-kitchen-prep
    provides: "prep_productions trigger pattern (SECURITY DEFINER, DROP/CREATE idempotency)"

provides:
  - "waitlist_entries table: 9 columns, 4 RLS policies, 3 indexes (FIFO/status/partial seated)"
  - "waitlist_notifications table: 6 columns, manager+ SELECT policy, 1 FK index"
  - "notify_waitlist_entry() pg_net trigger function + trg_waitlist_notify trigger"

affects:
  - 07-02 (Zod schemas + entity hooks reference these tables)
  - 07-03 (edge function send-waitlist-notification is called by trg_waitlist_notify)
  - 07-04 (entity queries use waitlist_entries + waitlist_notifications)

tech-stack:
  added: []
  patterns:
    - "pg_net AFTER UPDATE OF status trigger with COALESCE(current_setting, fallback) for operator-configurable URL"
    - "waitlist RLS: SELECT for all authenticated, INSERT/UPDATE/DELETE for manager+ via get_user_role()"
    - "waitlist_notifications INSERT blocked at RLS — only service-role edge function can insert"

key-files:
  created:
    - bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql
    - bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql
    - bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql
  modified: []

key-decisions:
  - "[Phase 07-waitlist 07-01]: pg_net trigger uses COALESCE(current_setting('app.supabase_url', true), 'https://YOUR_PROJECT_REF.supabase.co') — DB settings approach with placeholder fallback; operator must run ALTER DATABASE postgres SET before production"
  - "[Phase 07-waitlist 07-01]: waitlist_notifications has no client-side INSERT RLS policy — edge function inserts using service-role key which bypasses RLS"
  - "[Phase 07-waitlist 07-01]: status column uses text + CHECK constraint (not PG ENUM) to avoid ALTER TYPE migration complexity"
  - "[Phase 07-waitlist 07-01]: AFTER UPDATE OF status (column-specific) trigger prevents spurious fires on non-status field updates"

patterns-established:
  - "Pattern: pg_net COALESCE(current_setting('app.supabase_url', true), placeholder) allows migration to deploy without DB settings configured while documenting the required operator setup"
  - "Pattern: waitlist_entries_seated_at_party_idx partial index on (party_size, seated_at) WHERE status='seated' supports 7-day rolling avg query without full table scan"

requirements-completed:
  - S5-01
  - S5-02
  - S5-03

duration: 8min
completed: 2026-04-25
---

# Phase 7 Plan 01: Waitlist DB Migrations Summary

**Three SQL migrations establishing waitlist_entries + waitlist_notifications tables with RLS and a pg_net trigger that calls the send-waitlist-notification edge function on status→'notified' transitions.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-25T00:00:00Z
- **Completed:** 2026-04-25T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `waitlist_entries` with all 9 columns (id, name, party_size, phone_e164, status CHECK, table_id FK→pool_tables, seated_at, notified_at, created_at), 4 RLS policies, and 3 indexes
- Created `waitlist_notifications` audit table with FK→waitlist_entries ON DELETE CASCADE, channel + status CHECK constraints, manager+ SELECT policy, and FK index
- Created `notify_waitlist_entry()` SECURITY DEFINER trigger function + `trg_waitlist_notify` AFTER UPDATE OF status trigger using pg_net for async HTTP dispatch to edge function

## Task Commits

Each task was committed atomically:

1. **Task 1: Create waitlist_entries and waitlist_notifications migrations** - `8c738c5` (feat)
2. **Task 2: Create pg_net trigger migration** - `e63b21b` (feat)

**Plan metadata:** (committed with SUMMARY)

## Files Created/Modified

- `bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql` — waitlist_entries table + RLS + 3 indexes
- `bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql` — waitlist_notifications table + RLS + 1 index
- `bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql` — notify_waitlist_entry() function + trg_waitlist_notify trigger

## Decisions Made

- pg_net trigger URL injection uses COALESCE(current_setting('app.supabase_url', true), hardcoded_placeholder). This lets the migration deploy to any environment without crashing while requiring the operator to set `app.supabase_url` and `app.supabase_anon_key` DB settings before the trigger will actually reach the edge function in production.
- `waitlist_notifications` has no client-side INSERT RLS policy. The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely. This ensures notification audit rows can only be created by the trusted edge function, not by any authenticated client.
- `status` column uses `text NOT NULL ... CHECK (status IN (...))` rather than a PG ENUM type. This matches the pattern used in other Phase 7+ tables and avoids the ALTER TYPE + COMMIT complexity that PG ENUMs require when adding values in future migrations.

## Deviations from Plan

None - plan executed exactly as written. The trigger migration includes the DB settings COALESCE pattern (per resolved Open Question #1 in RESEARCH.md) as specified in the plan.

## Issues Encountered

None.

## User Setup Required

Before applying migration 20260501000003 to production, the operator must run:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = 'YOUR_ANON_KEY';
```

Find these values at: https://supabase.com/dashboard/project/<ref>/settings/api

These settings are read by the `notify_waitlist_entry()` trigger function to construct the edge function URL and auth header. Without them, the trigger will silently use the placeholder values and fail to call the edge function.

## Next Phase Readiness

- All three migration files exist and are ready for `supabase db push` (Plan 07-02)
- Schema fully defines the trust boundaries for Plan 07-03 (edge function) and Plan 07-04 (entity hooks)
- RLS policies establish the access pattern: bartenders read-only, manager+ write, service-role edge function for notification inserts
- No blockers — Plan 07-02 can proceed immediately

---
*Phase: 07-waitlist-whatsapp*
*Completed: 2026-04-25*
