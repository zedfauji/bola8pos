---
phase: 06-split-bill-refund
plan: 04
subsystem: shared/lib
tags: [domain, types, rbac, split-bill, refund, property-tests]
dependency_graph:
  requires: [06-03]
  provides: [RefundSchema, AppErrorCode-6-new-codes, process_refund-rbac, computeEvenSplit]
  affects: [features/split-tab, features/process-refund, entities/refund]
tech_stack:
  added: [split-math.ts]
  patterns: [Zod schema extension, fast-check property tests, integer-cents arithmetic]
key_files:
  created:
    - bar-pos/src/shared/lib/split-math.ts
    - bar-pos/src/shared/lib/split-math.test.ts
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/result.ts
    - bar-pos/src/shared/lib/rbac.ts
decisions:
  - "splitMode/splitLabel/parentTabId use .nullable().optional() — consistent with cajaSessionId pattern in TabSchema"
  - "computeEvenSplit absorbs rounding remainder in lastAmount (not baseAmount) — P9 invariant is: base*(n-1)+last===total"
  - "process_refund added to MANAGER_EXTRA (not BARTENDER_ACTIONS) — threat T-06-12 mitigated"
  - "RefundSchema.amount uses z.number().positive() (not MoneySchema) — ensures no zero/negative refund at schema level (threat T-06-11)"
metrics:
  duration: 25min
  completed: 2026-04-24
  tasks_completed: 2
  files_changed: 5
---

# Phase 06 Plan 04: Domain + Result + RBAC + Split-Math Summary

**One-liner:** Zod schemas for Refund entity + 6 AppErrorCode values + process_refund RBAC + computeEvenSplit integer-cents utility with P8/P9 property tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend domain.ts + result.ts + rbac.ts | 65858e8 | domain.ts, result.ts, rbac.ts |
| 2 | Write split-math.ts + P8/P9 property tests | be94a14 | split-math.ts, split-math.test.ts |

## What Was Built

### Task 1 — Domain / Result / RBAC Extensions

**domain.ts changes:**
- `TabStatusSchema`: extended to `['open', 'closed', 'paid', 'voided', 'split']`; `TabStatus.SPLIT` constant added
- `TabSchema`: added `parentTabId` (UuidSchema nullable optional), `splitMode` (enum nullable optional), `splitLabel` (string max 50 nullable optional)
- `PaymentSchema`: added `isRefund` (boolean default false), `refundId` (UuidSchema nullable optional)
- New schemas added in S4 section: `RefundReasonSchema`, `RefundItemSchema`, `RefundSchema`, `RefundCreateSchema`
- New types exported: `Refund`, `RefundCreate`, `RefundItem`, `RefundReason`

**result.ts changes:**
- 6 new codes appended to `AppErrorCode` union:
  - `PARENT_TAB_PAID` — parent tab already paid; cannot split
  - `ITEM_NOT_IN_PARENT` — order item does not belong to parent tab
  - `ITEM_ASSIGNED_TWICE` — same item assigned to two sub-tabs
  - `UNASSIGNED_ITEMS` — split completed but some items not assigned
  - `REFUND_EXCEEDS_ORIGINAL` — refund amount > original payment
  - `ITEM_NOT_IN_ORIGINAL_ORDER` — refund item not in original order

**rbac.ts changes:**
- `'process_refund'` added to `STAFF_ACTIONS` as const array
- `'process_refund'` added to `MANAGER_EXTRA` Set (manager+ only)
- `canAccess('bartender', 'process_refund')` returns `false` (threat T-06-12 mitigated)
- `canAccess('manager', 'process_refund')` returns `true`

### Task 2 — split-math.ts Utility + Property Tests

**split-math.ts exports:**
- `toCents(amount: number): number` — decimal to integer cents (Math.round to avoid float drift)
- `fromCents(cents: number): number` — integer cents to decimal
- `computeEvenSplit(totalCents, n): { baseAmount, lastAmount }` — N-way split with P9 invariant
- `buildEvenPayments(totalCents, n): number[]` — full array of payment amounts

**split-math.test.ts (8 tests):**
- Unit: toCents(33.33) → 3333; fromCents(3333) → 33.33
- Unit: splits 10000 by 3 → {3333, 3334}; by 4 → {2500, 2500}; 10001 by 3 → {3333, 3335}
- Unit: throws when n < 2
- **P9 property (fast-check):** for any n ∈ [2..9], totalCents ∈ [1..100_000] → payments sum exactly to totalCents
- **P8 property (fast-check):** for any partition of item prices into groups → sub-group sums equal total

## Verification Results

```
npm run typecheck    → exit 0 (no TS errors)
npx vitest run split-math.test.ts → 8/8 tests passed
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-06-11: RefundSchema amount tampering | `z.number().positive()` on RefundSchema.amount — no zero/negative refund schemas |
| T-06-12: process_refund elevation of privilege | Added to MANAGER_EXTRA only — bartenders cannot process refunds |

## Known Stubs

None — no UI components in this plan; all exports are pure logic/schema.

## Self-Check: PASSED

- [x] `bar-pos/src/shared/lib/domain.ts` exists and exports RefundSchema
- [x] `bar-pos/src/shared/lib/result.ts` contains PARENT_TAB_PAID
- [x] `bar-pos/src/shared/lib/rbac.ts` contains process_refund
- [x] `bar-pos/src/shared/lib/split-math.ts` exists and exports computeEvenSplit
- [x] `bar-pos/src/shared/lib/split-math.test.ts` exists with P8/P9 tests
- [x] Commit 65858e8 exists (Task 1)
- [x] Commit be94a14 exists (Task 2)
