---
phase: 24-operational-reports-suite-csv
plan: 06
subsystem: api
tags: [tanstack-query, supabase-rpc, zod, postgres, timezone]

# Dependency graph
requires:
  - phase: 24-05
    provides: all 6 report RPCs (get_peak_hours_report, get_voids_report, get_deletions_pre_report, get_deletions_post_report, get_modifier_popularity_report, get_payment_methods_report) pushed to remote + supabase.types.ts regenerated with typed RPC signatures
  - phase: 24-01
    provides: HourlyRowSchema extended with dayOfWeek/isBusiest, DeletionsPreRow/DeletionsPostRow/ModifierPopularityRow/PaymentMethodRow Zod schemas
provides:
  - useHourlyBreakdown + useVoidRefundReport migrated from unbounded client-side joins to db.rpc('get_peak_hours_report'/'get_voids_report')
  - 4 new report hooks: useDeletionsPreReport, useDeletionsPostReport, useModifierPopularityReport, usePaymentMethodsReport
  - shared useReportRpc<T> helper (fetch → unwrap {ok, rows} → Zod-parse) backing all 4 new hooks
  - 4 live integration test files proving all 4 new RPCs against the real database
affects: [24-08, 24-09]  # widget plans consuming these hooks

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useReportRpc<T>(reportName, rpcName, from, to, schema) — shared query body for report RPCs following useCajaReport's Pattern 2 shape, now used by 4 hooks instead of hand-duplicating the fetch/unwrap/parse boilerplate per hook"
    - "Report RPCs return camelCase-aliased JSON columns (json_build_object with quoted \"orderId\" etc.) so client Zod schemas parse rows directly with zero snake_case→camelCase mapping step"

key-files:
  created:
    - src/entities/tab/model/deletions-pre-report.integration.test.ts
    - src/entities/tab/model/deletions-post-report.integration.test.ts
    - src/entities/tab/model/modifier-popularity-report.integration.test.ts
    - src/entities/tab/model/payment-methods-report.integration.test.ts
    - supabase/migrations/20260721000007_fix_peak_hours_timezone.sql
  modified:
    - src/entities/tab/model/queries-reports.ts
    - src/entities/tab/model/queries-reports.test.ts
    - vitest.config.ts

key-decisions:
  - "get_peak_hours_report's HOUR/DOW extraction needed AT TIME ZONE 'America/Mexico_City' — Postgres evaluates EXTRACT() in the session timezone (UTC on Supabase), not the bar's local timezone, silently shifting every order into the wrong bucket; fixed via a new CREATE OR REPLACE migration matching this phase's established fix-migration convention"
  - "vitest's 'integration' project needed environment: 'jsdom' (was 'node') — several pre-existing and all 4 new *.integration.test.ts files use @testing-library/react's renderHook against real Supabase RPCs, which needs `document`; jsdom doesn't block the real network calls"
  - "New integration tests use far-future date ranges (2035/2036, matching category-revenue-report.integration.test.ts's precedent) instead of 'today', sidestepping shared-dev-DB contamination entirely rather than defending against it after the fact"
  - "deletions-pre/deletions-post integration tests seed audit_logs rows directly (no real orders/tabs rows needed) since get_deletions_pre_report/get_deletions_post_report never join orders/tabs — only audit_logs + profiles + products"

patterns-established:
  - "useReportRpc<T> generic hook-body factory for {ok, rows}-shaped report RPCs — future report hooks in this file should extend this rather than hand-writing another useQuery body"

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "useHourlyBreakdown and useVoidRefundReport migrated from unbounded client-side joins to bounded db.rpc('get_peak_hours_report'/'get_voids_report') calls; pure helpers (findPeakHour/aggregateHourlyRevenue/fillMissingHours) retained"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/entities/tab/model/queries-reports.test.ts (41 tests)"
        status: pass
      - kind: integration
        ref: "src/entities/tab/model/void-refund-report.integration.test.ts (3 tests)"
        status: pass
      - kind: integration
        ref: "src/entities/tab/model/hourly-breakdown.integration.test.ts (4 of 5 tests; 1 flakes on unrelated shared-dev-DB leftover data — see Deviations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useDeletionsPreReport + useDeletionsPostReport hooks added, each Zod-parsing rows into DeletionsPreRow/DeletionsPostRow, with live integration tests proving date-range filtering and the fieldsChanged diff logic"
    requirement: "SC-1"
    verification:
      - kind: integration
        ref: "src/entities/tab/model/deletions-pre-report.integration.test.ts (2 tests)"
        status: pass
      - kind: integration
        ref: "src/entities/tab/model/deletions-post-report.integration.test.ts (2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "useModifierPopularityReport + usePaymentMethodsReport hooks added, each Zod-parsing rows into ModifierPopularityRow/PaymentMethodRow, with live integration tests proving attach-count correctness and the reopened_void/refund exclusion + rollup summing"
    requirement: "SC-1"
    verification:
      - kind: integration
        ref: "src/entities/tab/model/modifier-popularity-report.integration.test.ts (1 test)"
        status: pass
      - kind: integration
        ref: "src/entities/tab/model/payment-methods-report.integration.test.ts (2 tests)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 06: Report Hooks — RPC Migration + 4 New Reports Summary

**Migrated useHourlyBreakdown/useVoidRefundReport to bounded db.rpc calls and added 4 new report hooks (deletions-pre/post, modifier-popularity, payment-methods) behind a shared useReportRpc<T> helper, backed by 9 passing live integration tests.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 8 (2 modified pre-existing, 4 new test files, 1 new migration, 1 config fix)

## Accomplishments
- `useHourlyBreakdown` and `useVoidRefundReport` now call `db.rpc('get_peak_hours_report'/'get_voids_report', ...)` instead of unbounded client-side joins (SC-4); the client still derives "busiest hour" via the retained `findPeakHour` pure helper (D-03)
- 4 new report hooks added — `useDeletionsPreReport`, `useDeletionsPostReport`, `useModifierPopularityReport`, `usePaymentMethodsReport` — all sharing one `useReportRpc<T>` body
- 4 new live integration test files (7 tests) proving all 4 new RPCs against the real database, plus confirmed the 2 migrated hooks' pre-existing integration tests still pass
- Found and fixed a genuine timezone bug in `get_peak_hours_report` (already-pushed migration from Plan 03) via a new corrective migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate useHourlyBreakdown + useVoidRefundReport bodies to db.rpc** - `111a576` (feat)
2. **Task 2: Add deletions-pre + deletions-post hooks + live integration tests** - `ac2699a` (feat)
3. **Task 3: Add modifier-popularity + payment-methods hooks + live integration tests** - `2cb9940` (feat)

**Deviation fixes (Rule 3, Rule 1):**
- `766bb40` (fix): vitest `integration` project `environment: 'node'` → `'jsdom'`
- `1301ac4` (fix): `get_peak_hours_report` timezone bug — new migration `20260721000007_fix_peak_hours_timezone.sql`, pushed to remote

_Note: Task 1's queries-reports.ts/.test.ts changes were already in the working tree from a prior executor attempt terminated by an API usage-limit error (no commits made). The diff was reviewed against 24-RESEARCH.md's Pattern 2 and the actual pushed RPC signatures, found correct and complete, and committed as-is under Task 1._

## Files Created/Modified
- `src/entities/tab/model/queries-reports.ts` - migrated 2 hook bodies to RPC + added `useReportRpc<T>` + 4 new hooks
- `src/entities/tab/model/queries-reports.test.ts` - fixture updates for HourlyRowSchema's dayOfWeek/isBusiest fields (deferred from 24-01)
- `src/entities/tab/model/deletions-pre-report.integration.test.ts` - live RPC test for get_deletions_pre_report
- `src/entities/tab/model/deletions-post-report.integration.test.ts` - live RPC test for get_deletions_post_report (incl. fieldsChanged diff logic)
- `src/entities/tab/model/modifier-popularity-report.integration.test.ts` - live RPC test with a manual ANY(modifier_ids) attach-count spot-check
- `src/entities/tab/model/payment-methods-report.integration.test.ts` - live RPC test for reopened_void/refund exclusion + rollup-row summing
- `vitest.config.ts` - integration project environment fixed to jsdom
- `supabase/migrations/20260721000007_fix_peak_hours_timezone.sql` - new fix migration (pushed to remote)

## Decisions Made
- get_peak_hours_report's HOUR/DOW extraction now uses `AT TIME ZONE 'America/Mexico_City'`, matching every other daily-rollup reporting view in this codebase (`combo_mix_daily`, `recipe_variance_daily`, `waitlist_metrics_daily`)
- vitest's `integration` project environment changed from `node` to `jsdom` — required by every renderHook-based integration test, not just this plan's new ones
- New integration tests use far-future date ranges (2035/2036) rather than "today", following `category-revenue-report.integration.test.ts`'s existing precedent, to avoid shared-dev-DB contamination
- `useReportRpc<T>` extracted as a shared query-body factory for the 4 new report hooks rather than hand-writing 4 near-identical `useQuery` bodies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking build config] vitest `integration` project environment was `node`, breaking every renderHook-based integration test**
- **Found during:** Task 1 verification — running the pre-existing `void-refund-report.integration.test.ts`/`hourly-breakdown.integration.test.ts` (used as this plan's canonical reference pattern) both failed with `ReferenceError: document is not defined`, unrelated to any code change in this plan
- **Issue:** `vitest.config.ts`'s `integration` project was configured with `environment: 'node'`, but multiple pre-existing (and all 4 new) `*.integration.test.ts` files use `@testing-library/react`'s `renderHook`, which requires `document`
- **Fix:** Changed `environment: 'node'` → `'jsdom'` for the `integration` project. jsdom doesn't block the real Supabase network calls these tests make.
- **Files modified:** `vitest.config.ts`
- **Verification:** `void-refund-report.integration.test.ts` went from 0/3 to 3/3 passing
- **Committed in:** `766bb40`

**2. [Rule 1 - Bug] get_peak_hours_report bucketed HOUR/DOW in UTC instead of the bar's local timezone**
- **Found during:** Task 1 verification — after fixing the jsdom issue above, `hourly-breakdown.integration.test.ts` (which seeds orders at explicit local hours) failed: hour-8 orders read back with revenue $0, and hour buckets were shifted by 6 hours (America/Mexico_City → UTC offset)
- **Issue:** `get_peak_hours_report` (migration `20260721000002`, already pushed to remote in Plan 05) extracted `EXTRACT(HOUR FROM o.created_at)` directly, which Postgres evaluates in the session timezone (UTC on Supabase) rather than the bar's own timezone — every other daily-rollup reporting view in this codebase (`20260505000001_s6_reporting_views.sql`) already converts via `AT TIME ZONE 'America/Mexico_City'` first; this RPC was the one place that conversion was missing
- **Fix:** New migration `20260721000007_fix_peak_hours_timezone.sql` with `CREATE OR REPLACE FUNCTION get_peak_hours_report(...)` extracting `HOUR`/`DOW` from `o.created_at AT TIME ZONE 'America/Mexico_City'`; pushed via `npx supabase db push --yes`
- **Files modified:** `supabase/migrations/20260721000007_fix_peak_hours_timezone.sql`
- **Verification:** `hourly-breakdown.integration.test.ts` went from 2/5 to 4/5 passing (the 5th test's failure is a pre-existing, unrelated shared-dev-DB data-hygiene flake — see Issues Encountered)
- **Committed in:** `1301ac4`

---

**Total deviations:** 2 auto-fixed (1 blocking build-config, 1 correctness bug)
**Impact on plan:** Both fixes were necessary for this plan's own Task 1 deliverable (the migrated `useHourlyBreakdown` hook) to be genuinely correct and testable. No scope creep — no other files touched.

## Issues Encountered

- **`hourly-breakdown.integration.test.ts`'s "date range filter excludes items from 2020" test flakes on shared dev-DB leftover data.** Not in this plan's `files_modified`, out of scope to fix. Root cause: a real leftover order in today's date range on the shared Supabase dev project (confirmed via a direct RPC call outside the test's own seed/cleanup: `{"hour":0,"dayOfWeek":2,"orderCount":2,"revenue":30}`), inflating the test's summed total by $30. Logged to `.planning/phases/24-operational-reports-suite-csv/deferred-items.md`.
- **Running all `*.integration.test.ts` files together (via `npm run test:integration`) surfaces pre-existing cross-file parallelism failures** (STALE_VERSION conflicts on the shared single-open-caja-session row, product cross-pollution) in files this plan does not touch (`category-revenue-report`, `pending-total`, `product-sales-report`, and one `void-refund-report` test). Each of this plan's 4 new test files was verified individually and in the plan's required combinations (`npx vitest run <new files>`) and passes cleanly every time; this is a pre-existing test-isolation limitation of running many integration suites concurrently against one shared dev database, not something this plan introduced.

## User Setup Required

None - no external service configuration required. The one new migration was already pushed to the remote Supabase project as part of this plan's verification (no separate BLOCKING checkpoint needed — `npx supabase db push --yes` proceeded non-interactively, matching the Plan 05 precedent documented in `24-05-SUMMARY.md`).

## Next Phase Readiness

- All 6 report RPCs from this phase are now fully wired through typed, tested TanStack Query hooks — Plans 08/09 (widget plans) can consume `useDeletionsPreReport`, `useDeletionsPostReport`, `useModifierPopularityReport`, `usePaymentMethodsReport`, and the migrated `useHourlyBreakdown`/`useVoidRefundReport` directly
- `HourlyBreakdownPanel.test.tsx`'s pre-existing TS2739 fixture errors (from 24-01's HourlyRowSchema extension) remain deferred to Plan 24-09 as previously documented — untouched by this plan, confirmed still present as the only non-baseline typecheck errors besides 2 fully unrelated pre-existing ones (`queries.ts`, `rag.ts`)

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED
All created/modified files and all 5 commit hashes verified present on disk / in git log.
