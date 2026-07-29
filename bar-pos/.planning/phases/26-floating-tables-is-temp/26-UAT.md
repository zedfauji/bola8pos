---
status: testing
phase: 26-floating-tables-is-temp
source: [26-VERIFICATION.md]
started: 2026-07-29T17:37:59.271Z
updated: 2026-07-29T17:37:59.271Z
---

## Current Test

number: 1
name: Pool-timer E2E full-journey verdict (SC-4)
expected: |
  Fix `e2e/helpers/supabase.ts`'s `resetTestState()` (and the ~9 other e2e spec files still
  on `.from('pool_tables')`) to target `resources`, then run
  `npx playwright test e2e/04-pool-timer.spec.ts`. All 10 cases pass, giving an end-to-end
  (not just unit/DB-level) proof that starting, stopping, and billing a normal pool session
  is unaffected by the D-01 rename.
awaiting: user response

## Tests

### 1. Pool-timer E2E full-journey verdict (SC-4)
expected: Fix `e2e/helpers/supabase.ts`'s `resetTestState()` (and the ~9 other e2e spec files still on `.from('pool_tables')`) to target `resources`, then run `npx playwright test e2e/04-pool-timer.spec.ts`. All 10 cases pass, giving an end-to-end (not just unit/DB-level) proof that starting, stopping, and billing a normal pool session is unaffected by the D-01 rename.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
