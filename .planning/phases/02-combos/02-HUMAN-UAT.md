---
status: partial
phase: 02-combos
source: [02-VERIFICATION.md]
started: 2026-04-24T01:00:00Z
updated: 2026-04-24T01:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full E2E suite smoke test on staging
expected: npx playwright test e2e/32-combos.spec.ts runs; T2 (bartender adds Cubeta), T4 (manager PIN override), T5 (NESTED_COMBO_FORBIDDEN assertion via page.evaluate RPC call), T6 (KDS combo grouping) all pass; no existing E2E spec regressions
result: [pending]

### 2. Manual smoke: ComboBuilderSheet end-to-end
expected: Open POS, tap Cubeta Regular (shows ComboBadge), ComboBuilderSheet opens with slot cards, select a beer, Add to Order succeeds with toast, combo appears in tab as parent row
result: [pending]

### 3. Manual smoke: KDS combo grouping
expected: KDS view shows combo order items grouped under one ComboKdsCard parent; child beers are NOT visible as independent top-level cards; Expand/Collapse chevron works
result: [pending]

### 4. Manual smoke: Manager PIN override for unavailable combo
expected: Tap Martes de Cubeta + Pool on non-Tuesday; ComboUnavailableBadge visible; dialog opens; Request override → ManagerPinDialog; enter PIN → ComboBuilderSheet opens with yellow override banner; order succeeds
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
