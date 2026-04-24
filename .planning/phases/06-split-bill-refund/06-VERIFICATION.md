---
phase: 06-split-bill-refund
status: human_needed
verified_at: "2026-04-24T21:00:00.000Z"
must_haves_score: 13/13
human_verification:
  - "Run: npx playwright test e2e/34-split-bill.spec.ts --headed (split bill E2E — 5 tests)"
  - "Run: npx playwright test e2e/35-refund.spec.ts --headed (refund E2E — 3 tests)"
  - "Regression: npx playwright test e2e/05-payments.spec.ts e2e/03-tab-order.spec.ts"
---

# Phase 06 Verification: Split Bill & Refund

## Summary

**All 13 automated must-haves verified. Human E2E run required before `done`.**

Note: Verification was performed via `git show HEAD` and `Get-Content` to avoid Read-tool cache issues. `SplitTabSheet.tsx` is 819 lines and `RefundSheet.tsx` is 335 lines of full implementation in HEAD.

## Must-Haves Verified

### S4-01..S4-07, S4-14: Schema (Plan 06-01, 06-02, 06-03)
- ✅ `tab_status` ENUM includes `'split'` (migration 20260427000000 applied)
- ✅ `tabs.parent_tab_id`, `split_mode`, `split_label` columns exist
- ✅ `refunds` and `refund_items` tables exist
- ✅ `payments.is_refund` and `payments.refund_id` columns exist
- ✅ 4 split-tab RPCs + `process_refund` RPC + auto-close trigger deployed
- ✅ `supabase.types.ts` transcribed with all new types
- ✅ `idempotency_key` bug in `process_refund` fixed (migration 20260427000005)

### S4-08, S4-15: Domain types (Plan 06-04)
- ✅ `TabStatusSchema` includes `'split'`; `TabSchema` has `parentTabId`, `splitMode`, `splitLabel`
- ✅ `PaymentSchema` has `isRefund` (default false) and `refundId`
- ✅ `RefundSchema`, `RefundItemSchema`, `RefundReasonSchema` exported from `domain.ts`
- ✅ 6 new `AppErrorCode` values: `PARENT_TAB_PAID`, `ITEM_NOT_IN_PARENT`, `ITEM_ASSIGNED_TWICE`, `UNASSIGNED_ITEMS`, `REFUND_EXCEEDS_ORIGINAL`, `ITEM_NOT_IN_ORIGINAL_ORDER`
- ✅ `process_refund` in `STAFF_ACTIONS` and `MANAGER_EXTRA` (manager+ only)
- ✅ `split-math.ts`: `computeEvenSplit`, `buildEvenPayments` with P8/P9 property tests (8/8 pass)

### S4-09: Entity queries (Plan 06-05)
- ✅ `useSubTabs(parentTabId)` in `entities/tab/model/queries.ts`
- ✅ `useTabs` excludes sub-tabs via `.is('parent_tab_id', null)` filter
- ✅ `entities/refund/` FSD slice: `useRefunds`, `useRefundsByPayment`, `refundKeys`

### S4-12: Shared UI (Plan 06-06)
- ✅ `SubTabColumn` (123 lines): label, item list, running total, drop zone, selected ring, WCAG-compliant
- ✅ `PersonCard` (76 lines): editable name Input, composes SubTabColumn
- ✅ Both have 4-variant Storybook stories

### S4-10: SplitTabSheet (Plan 06-07)
- ✅ `SplitTabSheet.tsx` — 819 lines, full 4-mode implementation:
  - Evenly: keypad + computeEvenSplit preview, useSplitEvenly mutation
  - By Item: tap-to-assign with SubTabColumn columns, ITEM_ASSIGNED_TWICE guard
  - By Person: PersonCard columns, unassigned items allowed
  - By Amount: MoneyInput rows, live remaining counter
- ✅ `useSplitTab.ts`: all 4 mutation hooks wired to split RPCs
- ✅ ConfirmDialog on cancel with assignments; Confirm disabled until isValid per mode

### S4-11, S4-15: RefundSheet (Plan 06-08)
- ✅ `RefundSheet.tsx` — 335 lines, full implementation:
  - Item checkboxes with qty spinner and restock toggle
  - isValid: selectedItems >= 1 AND reason != '' AND refundTotal > 0
  - `ManagerPinDialog` with `requiredAction='process_refund'`
  - `useProcessRefund` RPC mutation
  - `REFUND_EXCEEDS_ORIGINAL`, `AUTH_FORBIDDEN` surface as toasts
- ✅ P10 property test: refund amount <= original (4/4 pass)

### S4-13: UI integration (Plan 06-09)
- ✅ `PaymentsPage` has Payments + Refunds tabs
- ✅ `RefundsList` widget: DataTable with refund rows, sorted newest-first
- ✅ Refund button on eligible payment rows (hidden for is_refund=true / fully refunded)
- ✅ `OrderPanel`: Split bill button on open tabs with items
- ✅ Sub-checks section: `useSubTabs(tab.id)` with correct Result<Tab[]> unwrap

### S4-16, S4-17: Integration tests (Plan 06-10)
- ✅ 11 integration tests pass against live Supabase (6 split-tab + 5 process-refund)
- ✅ Trigger timing documented: sub-tab `status='paid'` must be set before payment INSERT

### S4-18, S4-19: E2E specs (Plan 06-11, autonomous: false)
- ✅ `e2e/34-split-bill.spec.ts` written (5 tests, 459 lines)
- ✅ `e2e/35-refund.spec.ts` written (3 tests, 497 lines)
- ⏳ **AWAITING HUMAN RUN** — specs require running dev server

## Human Verification Required

Plan 06-11 is `autonomous: false`. Run with a live dev server + Supabase:

```bash
cd bar-pos

# Split bill E2E (5 tests)
npx playwright test e2e/34-split-bill.spec.ts --headed

# Refund E2E (3 tests)
npx playwright test e2e/35-refund.spec.ts --headed

# Regression (existing suites must still pass)
npx playwright test e2e/05-payments.spec.ts e2e/03-tab-order.spec.ts
```

Type **"approved"** when all checks pass.

## Pre-existing Test Failures (not Phase 6 regressions)

- `hourly-breakdown.integration.test.ts` — live Supabase data drift, documented in STATE.md decisions
- `product-sales-report.integration.test.ts` — same, pre-existing, deferred
