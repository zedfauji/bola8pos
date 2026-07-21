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

## From Plan 24-10

- **7 pre-existing `e2e/07-reports.spec.ts` failures, unrelated to this plan's changes.**
  Confirmed via `git log -p --follow -- e2e/07-reports.spec.ts`: every one of these
  assertions is unchanged since the file's initial commit (`ecf717b`) — none were touched
  by any Phase 24 plan, and re-running them in isolation (no concurrent E2E processes)
  reproduces the same failures deterministically, ruling out flakiness from this plan's
  work. Root cause (5 of 7): a strict-mode Playwright violation — `getByText(/no X/i)`
  matches BOTH an `EmptyState`'s `<h3>` title ("No staff activity") AND its `<p>`
  description ("No staff activity in this date range.") since the description text
  contains the title text verbatim. Affects: `Sprint 10: Staff Performance tab shows
  column headers or empty state`, `Sprint 10: Staff Performance tab shows empty state for
  year 2020 date range`, `Sprint 10: Tip Distribution tab shows column headers or empty
  state`, `Sprint 10: Tip Distribution tab shows empty state for year 2020 date range`,
  `Sprint 10: Export button appears in Staff Performance tab when data rows exist`.
  A 6th (`Product Sales: date range filter to far past shows empty state`) times out
  waiting for `getByRole('status').filter({ hasText: /No sales data/i })` — the "no rows"
  status region for a 2020 date range doesn't render within the 20s timeout on the current
  shared dev DB (data-volume/latency related, not a Task 1/2/3 regression). The 7th
  (`Cash reconciliation variance displayed`) is a pre-existing strict-mode violation of a
  different kind: `getByText('Variance', { exact: false })` matches both the `Recipe
  Variance` tab trigger (added by an earlier phase, well before Phase 24) and the intended
  `<span>Variance</span>` in the Session View panel. None of the 4 new report tabs, the CSV
  export path, or the `remove_tab_item` fix touch any of these five components
  (`StaffSalesPanel`, `TipDistributionPanel`, `ProductSalesPanel`, `CajaReportPanel`,
  `EmptyState`) — out of scope to fix under this plan's file boundary
  (`src/pages/reports/index.tsx`, `e2e/07-reports.spec.ts` new tests only, `CLAUDE.md`).
  This plan's own 3 new E2E tests (the 4-tabs render check, the CSV export check, and the
  bartender reason-required removal check) all pass in isolation and pass together as a
  group; `npm run typecheck`/`npm run lint`/`npm run test` (the phase gate Task 3 actually
  requires) do not exercise Playwright at all.

- **Genuine bug fixed (not deferred): `remove_tab_item` RPC → `deplete_for_order_item`
  signature mismatch.** Discovered by this plan's own bartender-removal E2E test: every
  `remove_tab_item` call failed with Postgres `42883` ("function
  `deplete_for_order_item(uuid, integer, boolean)` does not exist"), surfaced as an HTTP
  404 on `POST /rest/v1/rpc/remove_tab_item`. `deplete_for_order_item`'s `p_direction`
  parameter is `smallint`; the untyped integer literal `-1` in 24-04's migration
  (`20260721000005_remove_tab_item_rpc.sql`) doesn't implicitly cast to `smallint` (int4→int2
  is Postgres's assignment-cast category, not implicit), so overload resolution failed on
  every call. Fixed via a new migration, `20260721000008_fix_remove_tab_item_deplete_cast.sql`
  (explicit `(-1)::smallint` cast), pushed to remote. Rule 1 (bug directly blocking this
  plan's own required E2E verification) — see SUMMARY.md Deviations section for full detail.

- **Fixed (not deferred): `e2e/16-table-status.spec.ts` T7/T8/T9 broke after 24-07's
  required-reason field.** Plan 24-07 added a required `reason` input to
  `RemoveTabItemDialog` (D-07) but never updated the 3 pre-existing item-removal E2E tests
  in `16-table-status.spec.ts`, which clicked Confirm directly with no reason — the button
  is now permanently disabled without one, so all 3 timed out. Fixed by filling a reason
  (`'E2E test removal'`) before the Confirm click in each of T7/T8/T9. Rule 1 (regression
  from a prior Phase 24 plan, blocking this plan's own "full phase gate green" success
  criterion) — not in this plan's `files_modified`, but directly caused by Phase 24's own
  work in a prior wave.
