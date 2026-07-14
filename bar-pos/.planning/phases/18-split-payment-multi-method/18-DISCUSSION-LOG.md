# Phase 18: Split Payment (Multi-Method) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 18-split-payment-multi-method
**Areas discussed:** Entry & methods, Tip/tax split, Row fields, Schema & receipt, Sum validation, Submission flow

---

## Entry & methods

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle in PaymentForm, cash+card only | Add a 'Split payment' toggle to the existing PaymentForm. Split mode allows only cash + card rows (up to 4). Rappi tabs stay single-method. | |
| Toggle in PaymentForm, any method mix | Same toggle location, but any enabled method (cash/card/rappi) can appear in any row, including multiple rows of the same method. | ✓ |
| Separate dedicated split flow | New UI path that replaces PaymentForm entirely with a multi-row split screen. | |

**User's choice:** Toggle in PaymentForm, any method mix.
**Notes:** None provided.

---

## Tip/tax split

| Option | Description | Selected |
|--------|-------------|----------|
| Compute once, split proportionally | Tip/discount/tax computed on the full tab total, rows just need to sum to the single grand total. No per-row tip UI. | |
| Per-row tip entry | Each payment row gets its own tip amount. Discount/tax still computed once on the base total. | ✓ |

**User's choice:** Per-row tip entry.
**Notes:** None provided.

---

## Row fields

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same fields per row | A cash row still gets its own tendered-amount input + change-due display; a card row still gets its own reference # field. | ✓ |
| Simplified — amount only per row | Split rows are just method + amount, no tendered/change/reference tracking per row. | |

**User's choice:** Yes — same fields per row.
**Notes:** None provided.

---

## Schema & receipt

| Option | Description | Selected |
|--------|-------------|----------|
| One receipt, refund per leg | Drop UNIQUE(tab_id), add payment_group_id + split_index. One combined receipt. Existing RefundSheet continues to work per-leg. | |
| Separate receipt per leg | Same schema change, but each payment leg prints/shows its own mini-receipt instead of one combined summary. | ✓ |

**User's choice:** Separate receipt per leg.
**Notes:** None provided.

---

## Sum validation

| Option | Description | Selected |
|--------|-------------|----------|
| Rows sum to subtotal+tax; tips add on top | Each row's amount is toward the subtotal+tax total (same base as today). Each row's tip is separate and doesn't count toward the required split total. | ✓ |
| Rows sum to subtotal+tax+own tip | Each row's amount already includes that row's tip; validation sums (row amounts) across all rows against subtotal+tax+sum(all tips). | |

**User's choice:** Rows sum to subtotal+tax; tips add on top.
**Notes:** None provided.

---

## Submission flow

| Option | Description | Selected |
|--------|-------------|----------|
| Enter all rows, submit atomically, print receipts in sequence | Cashier fills in all rows first. Backend RPC processes all legs in one transaction (tab closes only if the full set succeeds). Receipts print one after another. | ✓ |
| Sequential per-leg processing | Cashier processes and confirms each row one at a time; tab only closes after the last leg; partial failure leaves some legs already charged. | |

**User's choice:** Enter all rows, submit atomically, print receipts in sequence.
**Notes:** None provided.

---

## Claude's Discretion

- Exact UI layout for adding/removing rows within PaymentForm.
- Whether payment_group_id is nullable for single-method payments or always populated.
- Idempotency-key strategy for multi-leg atomic RPC calls.
- Whether the new multi-row RPC is a new function or an extension of process_payment_atomic.

## Deferred Ideas

None — discussion stayed within phase scope.
