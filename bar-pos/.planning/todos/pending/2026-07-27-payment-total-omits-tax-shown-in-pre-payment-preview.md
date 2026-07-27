---
created: 2026-07-27T15:01:46.265Z
title: Payment total omits tax shown in pre-payment preview
area: payments
severity: major
files:
  - src/features/process-payment (payment modal preview logic)
  - .planning/phases/25-receipt-item-grouping-2-level/25-04-SUMMARY.md (evidence)
---

## Problem

The payment modal's pre-submission preview displays a "Tax (16%)" line item and
a higher Total than what actually gets charged. Observed on a real paid tab
during Phase 25's Task 4 cross-surface verification (2026-07-27):

- **Payment modal preview** (before clicking "Process payment"): Subtotal
  $259.00 + Tax (16%) $41.44 + Tip $45.07 = **Total $345.51**
- **Actual charge / final receipt / Caja Report** (after payment completes):
  Subtotal $259.00 + Tip $45.07 = **Total $304.07** — no tax line at all

The customer-facing preview and the amount actually charged disagree by
exactly the tax amount ($41.44). This is not caused by Phase 25's changes —
no plan in that phase touches tax logic — Phase 25's verification walkthrough
just happened to be the first place this was noticed and captured with
concrete numbers.

Two possible root causes, needs investigation to determine which:
1. Tax is a real requirement that's computed for display but silently dropped
   before the actual charge/payment RPC — i.e. undercharging, revenue-affecting.
2. The payment modal shows a phantom "Tax (16%)" line that was never meant to
   be charged (e.g. leftover/unfinished UI from a tax feature that isn't
   actually wired up) — a misleading customer-facing display bug, not a
   revenue issue.

## Solution

TBD — first confirm whether `tax_rate`/tax computation exists anywhere in the
payment RPC (`process_payment` / `process_split_payment_atomic`) or is purely
client-side display logic in the payment modal. If tax is meant to be real,
wire it into the actual charge and receipt. If it's leftover/unfinished UI,
remove the phantom tax line from the preview so the customer sees the true
total before paying.
