---
status: testing
phase: 24-operational-reports-suite-csv
source: [24-VERIFICATION.md]
started: 2026-07-21T16:30:00Z
updated: 2026-07-21T16:30:00Z
---

## Current Test

number: 1
name: CSV formula/injection risk (CR-01) — risk acceptance sign-off
expected: |
  An explicit accept/fix decision from a project owner on the CWE-1236 CSV/formula-injection
  exposure in `src/shared/lib/exporters/csv.ts` (free-text `reason`/`staffName` values beginning
  with `=`/`+`/`-`/`@` become live formulas when the exported file is opened in Excel/Sheets).
  The phase's own threat model (T-24-02-T) rated this "low, accept"; the independent code
  review rated the same finding "critical" post-implementation (21 export types affected).
awaiting: user response

## Tests

### 1. CSV formula/injection risk (CR-01) — risk acceptance sign-off
expected: An explicit accept/fix decision from a project owner — not a default pass-through.
result: [pending]

### 2. Visual confirmation of the 3 new/extended Recharts widgets
expected: |
  Open /reports, visit Modifier Popularity, Payment Methods, and Hourly tabs; each chart
  renders with the correct single emerald-500 accent, readable Tooltip/Legend, no layout
  breakage.
result: [pending]

### 3. E2E suite for Phase 24's new tests
expected: |
  `npx playwright test e2e/07-reports.spec.ts` and
  `npx playwright test e2e/16-table-status.spec.ts --grep "T7|T8|T9"` against a live dev
  server — the 3 new Phase-24 tests and the 3 fixed table-status tests pass.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
