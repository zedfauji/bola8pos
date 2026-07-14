---
phase: "06"
plan: "09"
subsystem: payments-ui
tags: [refunds, split-bill, payments-page, order-panel, widgets]
dependency_graph:
  requires:
    - "06-05: entities/refund with useRefunds, useRefundsByPayment"
    - "06-07: SplitTabSheet 4-mode implementation"
    - "06-08: RefundSheet UI, useProcessRefund, usePayments"
  provides:
    - "PaymentsPage Payments/Refunds tab layout"
    - "RefundsList DataTable widget"
    - "Refund button on eligible PaymentPane rows"
    - "Split bill button on OrderPanel"
    - "Sub-checks section for split tabs"
  affects:
    - "pages/payments"
    - "widgets/PaymentPane"
    - "widgets/OrderPanel"
    - "widgets/RefundsList"
tech_stack:
  patterns:
    - "FSD widget layer: RefundsList at src/widgets/RefundsList"
    - "shadcn Tabs for Payments/Refunds tab layout"
    - "DataTable with ColumnDef<Refund> for refund history"
    - "useSubTabs Result<Tab[]> unwrap pattern: data?.ok ? data.data : []"
key_files:
  created:
    - "bar-pos/src/widgets/RefundsList/index.tsx"
    - "bar-pos/src/pages/payments/index.tsx"
    - "bar-pos/src/entities/tab/index.ts"
    - "bar-pos/src/entities/tab/model/index.ts"
  modified:
    - "bar-pos/src/widgets/PaymentPane/ui/PaymentPane.tsx"
    - "bar-pos/src/widgets/OrderPanel/OrderPanel.tsx"
decisions:
  - "Used usePayments hook (added in plan 08) for PaymentHistoryList in PaymentPane"
  - "Refund button eligibility: isRefund===false AND refundedTotal < payment.amount"
  - "Split bill button disabled when items.length===0; not shown when tab.status!==open"
  - "SubChecksSection only renders when tab.status==='split'; Result<Tab[]> unwrapped with data?.ok check"
metrics:
  duration_minutes: 30
  completed_date: "2026-04-24"
  tasks_completed: 2
  files_created: 4
  files_modified: 2
---

# Phase 06 Plan 09: Payments Page UI + Split Bill Entry Points Summary

PaymentsPage restructured with Payments/Refunds tabs; RefundsList DataTable widget created; Refund button wired on PaymentPane payment rows; Split bill button and sub-checks section added to OrderPanel.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | RefundsList widget + PaymentsPage Payments/Refunds tabs | b80b188 |
| 2 | Refund button on PaymentPane + Split bill button on OrderPanel | f42cc58 |

## What Was Built

### Task 1 — RefundsList Widget + PaymentsPage Tabs

**`widgets/RefundsList/index.tsx`**  
Read-only DataTable of all processed refunds. Columns: Date (formatted with `toLocaleDateString`), Payment ref (truncated UUID), Reason (snake_case → Title Case), Items count, Amount (negative `MoneyDisplay`), Restocked (Badge), Staff (truncated UUID). Sorted by `created_at` descending. Empty state shows "No refunds yet" with `ReceiptText` icon.

**`pages/payments/index.tsx`**  
Wraps the payments screen in a `Tabs` component from `@shared/ui/tabs`. "Payments" tab (`defaultValue="payments"`) renders the existing `<PaymentPane />`. "Refunds" tab renders `<RefundsList />`. Tab list is flush-left with `w-fit`.

**`entities/tab/index.ts` + `entities/tab/model/index.ts`**  
Barrel files that export `useSubTabs` (and all other tab entity hooks/types) so the widget layer can import `useSubTabs` from `@entities/tab`.

### Task 2 — Refund Button on PaymentPane + Split Bill on OrderPanel

**`widgets/PaymentPane/ui/PaymentPane.tsx`**  
- Added `PaymentHistoryList` component that uses `usePayments()` to show recent payments in the right panel when no tab is selected
- Added `RefundButton` component per payment row: uses `useRefundsByPayment(payment.id)` to compute `refundedTotal`; visible only when `payment.isRefund !== true` and `refundedTotal < payment.amount`
- Clicking Refund sets `refundTarget` state; `<RefundSheet open paymentId={refundTarget} onOpenChange>` rendered at bottom

**`widgets/OrderPanel/OrderPanel.tsx`**  
- Added "Split bill" `POSButton` with `SplitSquareHorizontal` icon; visible when `tab.status === 'open'`; disabled when `items.length === 0`; opens `SplitTabSheet` via `splitSheetOpen` state
- Added `SubChecksSection` component: calls `useSubTabs(parentTabId)` and correctly unwraps `Result<Tab[]>` (`queryResult.data?.ok ? queryResult.data.data : []`); rendered below order items when `tab.status === 'split'`; shows sub-tab label, status badge (pos-accent when paid), and `MoneyDisplay` total

## Deviations from Plan

### Cross-Plan Dependencies Resolved by Prior Executors

**Context:** Plans 07 and 08 were executed before this Plan 09 session ran. The plan 08 executor committed `OrderPanel.tsx` and `PaymentPane.tsx` changes (Task 2) under commit `f42cc58 docs(06-08)`. This session confirmed those commits contain the correct Plan 09 changes and did not need to re-apply them.

**Impact:** Only Task 1 files required new commits in this session. Task 2 code was verified correct and already committed.

### Rule 2 — Missing Entity Barrel Exports

`entities/tab/index.ts` and `entities/tab/model/index.ts` were untracked pre-existing files not yet committed to the repository. Since `widgets/OrderPanel` and `widgets/PaymentPane` import `useSubTabs` from `@entities/tab`, these barrel files were committed as part of Task 1 to complete the dependency chain.

## Known Stubs

None — all components use real data sources:
- `RefundsList` → `useRefunds()` from `@entities/refund`
- `PaymentHistoryList` → `usePayments()` from `@entities/payment`
- `RefundButton` → `useRefundsByPayment()` from `@entities/refund`
- `SubChecksSection` → `useSubTabs()` from `@entities/tab`
- `RefundSheet` → full implementation committed in plan 08
- `SplitTabSheet` → full 4-mode implementation committed in plan 07

## Self-Check

- [x] `bar-pos/src/widgets/RefundsList/index.tsx` — FOUND
- [x] `bar-pos/src/pages/payments/index.tsx` — FOUND
- [x] `bar-pos/src/widgets/PaymentPane/ui/PaymentPane.tsx` — FOUND (committed)
- [x] `bar-pos/src/widgets/OrderPanel/OrderPanel.tsx` — FOUND (committed)
- [x] Task 1 commit b80b188 — FOUND
- [x] Task 2 commit f42cc58 — FOUND
- [x] TypeScript typecheck: PASSED (0 errors)

## Self-Check: PASSED
