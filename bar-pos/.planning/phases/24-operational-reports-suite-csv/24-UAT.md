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
result: pass
reason: "Automated Playwright check found 2 bugs in Hourly Breakdown (double-$ and black legend swatch), both fixed and re-verified visually: (1) root cause was `MoneyDisplay.tsx` prepending a literal '$' in front of `formatMoney()`'s output, which already includes '$' — affected all 44 call sites app-wide, not just this tab; removed the duplicate literal. (2) `<Bar>` had no `fill` prop (only its per-cell `shape` override), so recharts' `<Legend>` fell back to a default black swatch; added `fill={chartColor(0)}` so the legend matches the chart's base bar color. Re-screenshotted with Last-7-Days range: Revenue column now shows '$30.00'/'$0.00', legend swatch matches. Modificadores and Métodos de pago tabs already rendered correctly (emerald donut, readable legend/table). vitest (82 tests, HourlyBreakdownPanel + domain-helpers + csv) and lint both clean."

### 3. E2E suite for Phase 24's new tests
expected: |
  `npx playwright test e2e/07-reports.spec.ts` and
  `npx playwright test e2e/16-table-status.spec.ts --grep "T7|T8|T9"` against a live dev
  server — the 3 new Phase-24 tests and the 3 fixed table-status tests pass.
result: pass
reason: "All 3 'Phase 24:' tests in 07-reports.spec.ts pass (all-4-tabs-render, CSV export writes file, bartender reason-required removal). All 3 table-status T7/T8/T9 pass (3/3). First run showed 14 failures but that run straddled a midnight rollover (system date flipped 07-21→07-22 mid-run), producing date-off-by-one flakes; re-run after the rollover dropped failures to 9, none of them the 3 Phase-24 tests. Remaining 9 failures (Sprint 10 Staff/Tip tabs, Cash reconciliation, Voids & Refunds, Product Sales empty-state) are pre-existing strict-mode-locator/selector-ambiguity bugs in test code unrelated to Phase 24, already noted as known debt."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-24-2
  truth: "Hourly Breakdown tab renders with the correct single emerald-500 accent and readable Legend, no layout breakage."
  status: resolved
  resolved_by: "inline fix during UAT (src/shared/ui/MoneyDisplay.tsx, src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx)"
  resolved_at: 2026-07-22
  reason: "Automated Playwright check found (1) Revenue table column doubles the dollar sign ('$$30.00' instead of '$30.00'), (2) 'Revenue' legend swatch renders black instead of matching the chart's emerald/grey bar colors."
  severity: minor
  test: 2
  artifacts: []
  missing: []
