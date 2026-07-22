---
status: complete
phase: 24-operational-reports-suite-csv
source: [24-VERIFICATION.md]
started: 2026-07-21T16:30:00Z
updated: 2026-07-22T08:57:00Z
---

## Current Test

[testing complete]

## Tests

### 1. CSV formula/injection risk (CR-01) — risk acceptance sign-off
expected: An explicit accept/fix decision from a project owner — not a default pass-through.
result: pass
reason: "Decision: fix. Patched `src/shared/lib/exporters/csv.ts` — sanitizeCsvCell() prefixes any cell value starting with =,+,-,@,tab,CR with a leading single quote, applied to all rows before XLSX serialization (covers all 21 export types via the shared rowsToCsv). Added regression tests (csv.test.ts); 13/13 pass."

### 2. Visual confirmation of the 3 new/extended Recharts widgets
expected: |
  Open /reports, visit Modifier Popularity, Payment Methods, and Hourly tabs; each chart
  renders with the correct single emerald-500 accent, readable Tooltip/Legend, no layout
  breakage.
result: issue
reported: "Automated Playwright check (admin login, /reports, This Month range): Modificadores tab is an empty state (no data in range, not a rendering defect). Métodos de pago tab renders correctly — emerald donut, readable legend/table. Hourly Breakdown tab has 2 real bugs: (1) Revenue table column shows a doubled dollar sign, e.g. '$$30.00' / '$$0.00' instead of '$30.00'. (2) chart bars are grey/green mixed (peak-hour highlight) but the 'Revenue' legend swatch renders black, matching neither bar color — not the single emerald-500 accent the spec calls for."
severity: minor

### 3. E2E suite for Phase 24's new tests
expected: |
  `npx playwright test e2e/07-reports.spec.ts` and
  `npx playwright test e2e/16-table-status.spec.ts --grep "T7|T8|T9"` against a live dev
  server — the 3 new Phase-24 tests and the 3 fixed table-status tests pass.
result: pass
reason: "All 3 'Phase 24:' tests in 07-reports.spec.ts pass (all-4-tabs-render, CSV export writes file, bartender reason-required removal). All 3 table-status T7/T8/T9 pass (3/3). First run showed 14 failures but that run straddled a midnight rollover (system date flipped 07-21→07-22 mid-run), producing date-off-by-one flakes; re-run after the rollover dropped failures to 9, none of them the 3 Phase-24 tests. Remaining 9 failures (Sprint 10 Staff/Tip tabs, Cash reconciliation, Voids & Refunds, Product Sales empty-state) are pre-existing strict-mode-locator/selector-ambiguity bugs in test code unrelated to Phase 24, already noted as known debt."

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-24-2
  truth: "Hourly Breakdown tab renders with the correct single emerald-500 accent and readable Legend, no layout breakage."
  status: failed
  reason: "User reported: Automated Playwright check found (1) Revenue table column doubles the dollar sign ('$$30.00' instead of '$30.00'), (2) 'Revenue' legend swatch renders black instead of matching the chart's emerald/grey bar colors."
  severity: minor
  test: 2
  artifacts: []
  missing: []
