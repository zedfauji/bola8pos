---
phase: 24-operational-reports-suite-csv
plan: 10
subsystem: reports
tags: [react-i18next, playwright, supabase-rpc, recharts, tanstack-query, csv]

# Dependency graph
requires:
  - phase: 24-operational-reports-suite-csv (Plan 07)
    provides: "remove_tab_item RPC + required-reason RemoveTabItemDialog (no new PIN gate)"
  - phase: 24-operational-reports-suite-csv (Plan 08)
    provides: "DeletionsPreSendPanel, DeletionsPostCloseReport widgets"
  - phase: 24-operational-reports-suite-csv (Plan 09)
    provides: "ModifierPopularityReport, PaymentMethodsReport widgets, extended HourlyBreakdownPanel"
provides:
  - "4 new /reports tabs wired: deletions-pre, deletions-post, modifier-popularity, payment-methods"
  - "E2E proof of SC-1..SC-4: new tabs render, CSV export writes a file, bartender-initiated reason-required removal works end-to-end and is attributed in Eliminaciones"
  - "remove_tab_item RPC fixed (deplete_for_order_item smallint cast) — the RPC was silently broken (404) since Plan 04, never live-tested until this plan's E2E"
  - "CLAUDE.md documents phase 24's RPC/CSV/widget inventory"
affects: [reports-suite-csv, future report-widget additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tauri IPC save()/write_file mock via page.addInitScript (mirrors e2e/25-export-reports.spec.ts) for CSV-export E2E proof without a real Tauri runtime"
    - "Bilingual locator regex (/reason|motivo/i, /partial history|historial parcial/i) for E2E assertions that must hold under the default es-MX locale"

key-files:
  created:
    - supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql
  modified:
    - src/pages/reports/index.tsx
    - e2e/07-reports.spec.ts
    - e2e/16-table-status.spec.ts
    - CLAUDE.md
    - .planning/phases/24-operational-reports-suite-csv/deferred-items.md

key-decisions:
  - "The bartender-removal E2E test exercises the REAL app flow (TableStatusPanel's pre-existing, unrelated manager-PIN Step 1, unchanged since the initial commit) rather than asserting a literal absence of any PIN prompt — RemoveTabItemDialog/remove_tab_item themselves add no new gate (D-06/D-07), which is what the phase's threat model (T-24-10-E) actually needs proven"
  - "Fixed remove_tab_item's deplete_for_order_item call via a new migration rather than editing the already-pushed 24-04 migration in place, following the project's append-only CREATE OR REPLACE convention for post-push fixes"
  - "Fixed 16-table-status.spec.ts's T7/T8/T9 (broken by 24-07's required-reason addition, never re-verified) since they block this plan's own full-phase-gate success criterion, despite the file being outside this plan's stated files_modified"
  - "7 pre-existing, unrelated e2e/07-reports.spec.ts failures (confirmed via git blame as unchanged since the initial commit, reproduced deterministically in isolation) logged to deferred-items.md rather than fixed — outside this plan's scope and Task 3's actual gate (typecheck/lint/unit test, not e2e)"

patterns-established: []

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "4 new report tabs (deletions-pre, deletions-post, modifier-popularity, payment-methods) wired into ReportsPage, inserted after voids per UI-SPEC ordering"
    requirement: "SC-1"
    verification:
      - kind: e2e
        ref: "e2e/07-reports.spec.ts#Phase 24: all 4 new report tabs render without crash"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit -p tsconfig.json (no new errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSV export proven end-to-end from a live report tab (Payment Methods), writing a file via the mocked Tauri save()/write_file path"
    requirement: "SC-2"
    verification:
      - kind: e2e
        ref: "e2e/07-reports.spec.ts#Phase 24: CSV export from Payment Methods report writes a file"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bartender-initiated reason-required item removal succeeds without AUTH_FORBIDDEN and is attributed correctly in the deletions-pre (Eliminaciones) report"
    requirement: "SC-1"
    verification:
      - kind: e2e
        ref: "e2e/07-reports.spec.ts#Phase 24: bartender-initiated reason-required removal succeeds (no AUTH_FORBIDDEN) and appears in Eliminaciones"
        status: pass
    human_judgment: false
  - id: D4
    description: "CLAUDE.md documents phase 24's 6 report RPCs, remove_tab_item + order_item.remove audit, CSV export, Recharts widgets"
    verification:
      - kind: other
        ref: "CLAUDE.md Implemented Features section, phase 24 entry"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full phase gate green: typecheck (no new errors beyond the 2 pre-existing), lint (clean), unit tests (all pass)"
    requirement: "SC-1, SC-2, SC-3, SC-4"
    verification:
      - kind: unit
        ref: "npm run typecheck; npm run lint; npm run test — 142 test files / 1297 tests passed"
        status: pass
    human_judgment: false

# Metrics
duration: 56min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 10: ReportsPage 4-tab wiring + E2E proof + phase gate Summary

**Wired the 4 remaining Phase 24 report widgets into `/reports`, then discovered and fixed a real production bug (`remove_tab_item`'s broken `deplete_for_order_item` call) via the plan's own bartender-removal E2E test — the phase's audited item-removal RPC had been silently 404ing since Plan 04 and was never actually exercised live until this plan.**

## Performance

- **Duration:** ~56 min
- **Started:** 2026-07-21T15:13:26-06:00 (after 24-09)
- **Completed:** 2026-07-21T16:09:52-06:00
- **Tasks:** 3 (plus 2 unplanned Rule-1 bug fixes discovered during Task 2's verification)
- **Files modified:** 7 (3 in files_modified + 1 new migration + 1 unrelated E2E fix + 1 deferred-items log)

## Accomplishments

- `ReportsPage` gained 4 new `TabsTrigger`/`TabsContent` pairs (`deletions-pre`, `deletions-post`, `modifier-popularity`, `payment-methods`), inserted immediately after `voids` per the UI-SPEC's Report Tab Inventory ordering, each following the established `<DateRangePicker/><Widget dateRange/>` shape.
- Extended `e2e/07-reports.spec.ts` with 3 new tests: all 4 new tabs render without crash (with the deletions-pre standing historical-gap Alert asserted); a CSV export from the Payment Methods tab writes a file via a mocked Tauri `save()`/`write_file` IPC pair; and a bartender-initiated reason-required removal completes end-to-end with no `AUTH_FORBIDDEN`, correctly attributed in the Eliminaciones (deletions-pre) report.
- **Found and fixed a genuine production bug**: `remove_tab_item`'s call to `deplete_for_order_item(p_item_id, -1, true)` passed an untyped `integer` literal into a `smallint` parameter — Postgres's `int4`→`int2` cast is assignment-only (not implicit), so every `remove_tab_item` call failed with `42883`, surfaced as an HTTP 404. Fixed via a new migration (`20260721000008_fix_remove_tab_item_deplete_cast.sql`) with an explicit `(-1)::smallint` cast, pushed to remote.
- **Found and fixed a regression** in `e2e/16-table-status.spec.ts`'s T7/T8/T9: Plan 24-07 added a required reason field to `RemoveTabItemDialog` but never updated these 3 pre-existing item-removal tests, which clicked Confirm with no reason (permanently disabled without one, timing out). Fixed by filling a reason before each Confirm click.
- CLAUDE.md's Implemented Features list now documents phase 24's 6 report RPCs, the audited `remove_tab_item` RPC, the generic CSV export, and the 4 new Recharts/DataTable widgets.
- Full phase gate green: `npm run typecheck` (0 new errors, 2 pre-existing documented), `npm run lint` (clean), `npm run test` (142 test files / 1297 tests passed).

## Task Commits

1. **Task 1: Wire 4 new report tabs into ReportsPage** - `08e61aa` (feat)
2. **Task 2: Reports E2E — new tabs + CSV export + bartender reason-required removal** - `5ed132f` (test), plus 2 Rule-1 bug-fix commits discovered during its verification: `68f196b` (fix — `remove_tab_item` deplete cast) and `450a9e4` (fix — `16-table-status.spec.ts` T7/T8/T9 required-reason)
3. **Task 3: Update CLAUDE.md + run the full phase gate** - `002d81a` (docs)

Additional commit: `d619f16` (docs — logged 7 pre-existing, unrelated `07-reports.spec.ts` failures to `deferred-items.md`).

## Files Created/Modified

- `src/pages/reports/index.tsx` - 4 new imports, 4 `TabsTrigger`, 4 `TabsContent` blocks inserted after `voids`
- `e2e/07-reports.spec.ts` - 3 new tests + Tauri-mock/seed helpers for the new tabs, CSV export, and bartender removal
- `supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql` - fixes `remove_tab_item`'s broken `deplete_for_order_item` call (new file)
- `e2e/16-table-status.spec.ts` - T7/T8/T9 now fill the required reason field before confirming removal
- `CLAUDE.md` - new Implemented Features entry for phase 24
- `.planning/phases/24-operational-reports-suite-csv/deferred-items.md` - logged the 7 pre-existing, out-of-scope `07-reports.spec.ts` failures

## Decisions Made

- The bartender-removal E2E test exercises the actual app flow — TableStatusPanel's pre-existing (unrelated, unchanged since the initial commit) manager-PIN Step 1 — rather than asserting a literal absence of any PIN dialog. `RemoveTabItemDialog`/`remove_tab_item` themselves add no new gate (D-06/D-07); that's the guarantee the phase's threat model (T-24-10-E) actually requires, and it's what this test proves.
- Fixed `remove_tab_item` via a new migration rather than editing the already-pushed 24-04 migration in place, matching the project's `CREATE OR REPLACE` append-only convention for post-push fixes.
- Fixed `16-table-status.spec.ts`'s T7/T8/T9 despite the file being outside this plan's `files_modified` — the regression was directly caused by Phase 24's own Plan 07 and blocks this plan's explicit "full phase gate green" success criterion.
- The 7 pre-existing, unrelated `07-reports.spec.ts` failures (confirmed via `git log -p` as byte-unchanged since the initial commit, and reproduced deterministically in isolation, ruling out flakiness) were logged to `deferred-items.md` rather than fixed — they're strict-mode Playwright locator ambiguities in components (`EmptyState`, `StaffSalesPanel`, `TipDistributionPanel`, `ProductSalesPanel`, `CajaReportPanel`) none of which this plan touches, and Task 3's actual phase gate is `typecheck`/`lint`/`test` (unit), not `test:e2e`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `remove_tab_item` RPC broken since Plan 04 — `deplete_for_order_item` smallint cast**
- **Found during:** Task 2 (bartender-removal E2E test)
- **Issue:** `deplete_for_order_item`'s `p_direction` parameter is `smallint`; `remove_tab_item`'s call passed an untyped `-1` integer literal. `int4`→`int2` is Postgres's assignment-cast category (not implicit), so overload resolution failed with `42883` on every call — surfaced as an HTTP 404 on `POST /rest/v1/rpc/remove_tab_item`. Every bartender/manager/admin item removal had been silently broken since Plan 04 shipped.
- **Fix:** New migration `20260721000008_fix_remove_tab_item_deplete_cast.sql` — `CREATE OR REPLACE FUNCTION public.remove_tab_item` with `deplete_for_order_item(p_item_id, (-1)::smallint, true)`. Everything else copied verbatim from the 24-04 migration.
- **Files modified:** `supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql`
- **Verification:** `npx supabase db push` succeeded; the bartender-removal E2E test's `tab.removeItem.succeeded` log line and passing assertions confirm the fix.
- **Committed in:** `68f196b`

**2. [Rule 1 - Bug/Regression] `16-table-status.spec.ts` T7/T8/T9 broken by Plan 24-07's required reason field**
- **Found during:** Task 2 verification (running the full E2E gate)
- **Issue:** Plan 24-07 added a required `reason` input to `RemoveTabItemDialog` but never updated these 3 pre-existing item-removal E2E tests, which clicked Confirm directly. The Confirm button is now permanently disabled without a reason, so all 3 timed out.
- **Fix:** Fill a reason (`'E2E test removal'`) before the Confirm click in each of T7, T8, T9; matched the label regex to `/reason|motivo/i` (bilingual, since the default locale is es-MX).
- **Files modified:** `e2e/16-table-status.spec.ts`
- **Verification:** `npx playwright test e2e/16-table-status.spec.ts --grep "T7|T8|T9"` — 3/3 pass in isolation.
- **Committed in:** `450a9e4`

**3. [Rule 3 - Blocking, self-fix] Seed helper bugs in the new E2E tests themselves**
- **Found during:** Task 2 (iterating on the 3 new E2E tests)
- **Issue:** `seedCashPayment`'s tab insert was missing `shift_id`/`closed_at` (NOT NULL / CHECK constraint violations) and the `payments` insert was missing the NOT-NULL `idempotency_key`; the bartender-removal test's hardcoded reason string collided with prior runs' leftover audit rows under Playwright's strict-mode `getByText`.
- **Fix:** Added shift lookup/creation, `closed_at`, and a unique `idempotency_key` to `seedCashPayment`; made the removal reason unique per run (`Date.now()`-suffixed) and matched the es-MX "Historial parcial" translation for the historical-gap Alert assertion.
- **Files modified:** `e2e/07-reports.spec.ts`
- **Verification:** All 3 new tests pass together in a single run.
- **Committed in:** `5ed132f` (folded into the test's own commit — iterative fixes before the first commit of this file)

---

**Total deviations:** 3 (2 Rule-1 bug/regression fixes outside this plan's stated file scope but directly blocking its own success criteria, 1 Rule-3 self-contained fix within the plan's own new test code)
**Impact on plan:** The `remove_tab_item` fix is the most consequential — it repairs a previously-undetected, fully-broken production RPC (every item removal via the UI has been failing since Plan 04). No architectural changes; all fixes are surgical and verified.

## Issues Encountered

- Running two `npx playwright test` invocations concurrently against the same live Supabase dev project produced 9 spurious failures in a full `07-reports.spec.ts` run (shared `resetTestState()`/`openCaja()` contention). Re-running sequentially reduced this to 7 consistent, reproducible, pre-existing failures unrelated to this plan (see `deferred-items.md`) — resolved by never running two E2E processes concurrently against the shared dev DB going forward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 24 (operational-reports-suite-csv) is fully complete: all 10 plans executed, SC-1..SC-4 proven end-to-end.
- The `remove_tab_item` fix is a meaningful production-readiness finding — item removal (a bartender-facing, frequently-used action) was completely broken prior to this plan; it now works correctly and is covered by both a unit-level dialog test (24-07) and a live E2E test (this plan).
- 7 pre-existing, unrelated `07-reports.spec.ts` failures remain (see `deferred-items.md`) — recommend a small follow-up cleanup phase/ticket to fix the `EmptyState` title/description locator ambiguity pattern across the suite, since it will keep tripping any future `getByText` assertion added against these tabs.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED
