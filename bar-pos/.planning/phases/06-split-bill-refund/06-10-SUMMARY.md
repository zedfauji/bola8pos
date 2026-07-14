---
phase: "06"
plan: "10"
subsystem: integration-tests
tags: [integration-test, split-tab, process-refund, supabase-rpc, vitest]
dependency_graph:
  requires: [06-07, 06-08, 06-09]
  provides: [split-tab-integration-coverage, process-refund-integration-coverage]
  affects: [06-11]
tech_stack:
  added: []
  patterns: [self-seeding-integration-test, describe.skipIf-graceful-skip, authenticated-supabase-client]
key_files:
  created: []
  modified:
    - bar-pos/src/features/split-tab/split-tab-rpc.integration.test.ts
    - bar-pos/src/features/process-refund/process-refund-rpc.integration.test.ts
    - bar-pos/supabase/migrations/20260427000005_fix_process_refund_idempotency.sql
decisions:
  - "Use describe.skipIf(hasEnv) pattern so CI without E2E creds still shows green"
  - "Update sub-tab status to 'paid' BEFORE inserting payment so trigger reads correct state"
  - "Generate idempotency_key as 'refund-' + refund UUID inside the process_refund RPC"
metrics:
  duration: "~2 sessions"
  completed: "2026-04-24"
  tasks_completed: 2
  files_modified: 3
---

# Phase 06 Plan 10: Integration Tests (S4-16 split-tab, S4-17 process-refund) Summary

One-liner: Vitest integration tests for split-tab RPCs and process_refund RPC against live Supabase, with self-seeding/cleanup and graceful skip when E2E creds absent.

## What Was Built

### Task 1 — S4-16: split-tab RPC integration tests (6 scenarios)

File: `bar-pos/src/features/split-tab/split-tab-rpc.integration.test.ts`

| Test | Scenario |
|------|----------|
| `split_tab_by_item: distributes items` | Seeds 10 items, assigns across 3 persons, verifies 3 sub-tabs created with correct item counts |
| `split_tab_evenly: creates equal sub-tabs` | Seeds 6 items ($60 total), splits 3 ways, verifies each sub-tab balance = $20 |
| `split_tab_by_person: delegates to by_item` | Verifies sub-tabs created, items reassigned |
| `split_tab_by_amount: greedy allocation` | Seeds 4 items, splits into 2 amounts, verifies item allocation |
| `PARENT_TAB_PAID guard` | Seeds a 'paid' tab, expects PARENT_TAB_PAID in error message |
| `ITEM_ASSIGNED_TWICE guard` | Duplicates an item_id in assignments, expects ITEM_ASSIGNED_TWICE |

### Task 2 — S4-17: process_refund RPC integration tests (5 scenarios)

File: `bar-pos/src/features/process-refund/process-refund-rpc.integration.test.ts`

| Test | Scenario |
|------|----------|
| `inserts negative payment row and refund record` | Full refund flow: authenticated manager, verifies refunds row + negative payment |
| `REFUND_EXCEEDS_ORIGINAL blocks over-refund` | Partial refund then full refund attempt — expects guard error |
| `AUTH_FORBIDDEN blocks bartender role` | Bartender account calls RPC, expects AUTH_FORBIDDEN |
| `restock=true (stub graceful)` | Calls with restock=true, verifies refund inserted (deplete_for_order_item stub absent OK) |
| `trigger: parent auto-closes when all sub-tabs paid` | Seeds parent+2 sub-tabs, pays each sub-tab (status updated first), verifies parent becomes 'paid' |

### Rule 1 Bug Fix — `process_refund` missing `idempotency_key`

Migration: `20260427000005_fix_process_refund_idempotency.sql`

The `payments.idempotency_key` column is `NOT NULL` (set by `20260417000001_payment_processing.sql`). The original `process_refund` RPC omitted it from the negative-payment INSERT, causing:
```
null value in column "idempotency_key" of relation "payments" violates not-null constraint
```
Fix: generate `'refund-' || v_refund_id::text` as the key — deterministic per refund, never null.

## Test Infrastructure Patterns

- **`hasEnv`**: Checks `VITE_SUPABASE_URL` + `VITE_SUPABASE_SERVICE_ROLE_KEY` before running
- **`itInt`**: `it` alias that skips when `!hasEnv`
- **`itAuth`**: `it` alias that also requires `E2E_MANAGER_NAME` + `E2E_MANAGER_PIN`
- **`getServiceDb()`**: Supabase client with service role key for seeding + direct writes
- **`getAuthClient(name, pin)`**: Signs in via `signInWithPassword` (PIN is password) to get JWT for RPC calls needing `auth.uid()`
- **`seedPaidTabWithPayment(svc)`**: Creates open tab → order → items → payment with `idempotency_key`
- **Cleanup**: Each test runs `cleanup(db, parentTabId)` in `afterEach` to delete sub-tabs, payments, refunds, and parent tab in FK-safe order

## Trigger Timing Note

The `after_payment_insert_check_parent_close` trigger fires `AFTER INSERT ON payments` and reads `tabs.status` to check if all sub-tabs are `'paid'`. When tests insert payments directly (bypassing `process_payment_atomic`), the sub-tab status must be updated to `'paid'` **before** the payment insert, or the trigger still sees `'open'` and skips the parent auto-close. Tests do:
```typescript
await svc.from('tabs').update({ status: 'paid', closed_at: ... }).eq('id', subTabId);
await svc.from('payments').insert({ ... });
```

## Test Results

All 11 tests pass against live Supabase:
- 6/6 split-tab tests ✓
- 5/5 process-refund tests ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `process_refund` RPC missing `idempotency_key` in negative payment INSERT**
- **Found during:** Task 2 — first test run
- **Issue:** `payments.idempotency_key` is `NOT NULL`; RPC did not supply it
- **Fix:** New migration `20260427000005_fix_process_refund_idempotency.sql` adds `'refund-' || v_refund_id::text` as the key and was pushed to remote DB via `supabase db push`
- **Files modified:** `bar-pos/supabase/migrations/20260427000005_fix_process_refund_idempotency.sql`
- **Commit:** `9eac643`

**2. [Rule 1 - Bug] Trigger timing: sub-tab status must be set before payment insert**
- **Found during:** Task 2 — auto-close trigger test
- **Issue:** Trigger reads `tabs.status`; inserting payment without first updating status left trigger counting the sub-tab as unpaid
- **Fix:** Updated test to set `status = 'paid'` on each sub-tab before inserting its payment row
- **Files modified:** `bar-pos/src/features/process-refund/process-refund-rpc.integration.test.ts`

## Known Stubs

None — all tests wire real data to real RPCs.

## Threat Flags

None — integration tests only; no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `bar-pos/src/features/split-tab/split-tab-rpc.integration.test.ts` — exists ✓
- `bar-pos/src/features/process-refund/process-refund-rpc.integration.test.ts` — exists ✓
- `bar-pos/supabase/migrations/20260427000005_fix_process_refund_idempotency.sql` — exists ✓
- Commit `1ed1933` (split-tab tests) — exists ✓
- Commit `9eac643` (process-refund tests + RPC fix) — exists ✓
