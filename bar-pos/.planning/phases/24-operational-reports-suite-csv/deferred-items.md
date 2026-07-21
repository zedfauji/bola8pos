# Deferred Items — Phase 24

## From Plan 24-06

- **`hourly-breakdown.integration.test.ts` — "date range filter excludes items from 2020" flakes on shared dev DB.**
  Not in 24-06's `files_modified`; out of scope to fix here. Root cause: a leftover real
  order today (`hour=0, orderCount=2, revenue=$30`) in the shared Supabase dev project —
  confirmed via a direct `get_peak_hours_report` RPC call outside the test's own seed/cleanup
  (`{"hour":0,"dayOfWeek":2,"orderCount":2,"revenue":30}`), i.e. pre-existing dev-data
  hygiene noise unrelated to Plan 06's queries-reports.ts changes. The test's own defensive
  cleanup only targets `customer_name LIKE 'KDS E2E Tab%'` leftovers, which doesn't catch
  this row. Needs either a broader defensive cleanup query or a scoped assertion (filter
  computed total to the test's own seeded order IDs rather than summing all 24 buckets).

## From Plan 24-07

- **Pre-existing `npx tsc --noEmit` baseline failures, unrelated to this plan's files.**
  Last touched by phase 23 (`de23fe4`), not modified by 24-07:
  - `src/entities/tab/model/queries.ts(791,11)` — `number | null` not assignable to `number | undefined`
  - `src/shared/lib/agent/rag.ts(60,7)` — `number[]` not assignable to `string`
  - `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx` (4 sites) — test fixtures
    missing `dayOfWeek`/`isBusiest` (likely stale after 24-06/24-03's `HourlyBreakdownPanel` extension)
  Out of scope per this plan's file boundary (`useRemoveTabItem.ts`, `RemoveTabItemDialog.tsx`,
  `RemoveTabItemDialog.test.tsx`) — not fixed here.
