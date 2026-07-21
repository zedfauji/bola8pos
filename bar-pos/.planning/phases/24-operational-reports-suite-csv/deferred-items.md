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
