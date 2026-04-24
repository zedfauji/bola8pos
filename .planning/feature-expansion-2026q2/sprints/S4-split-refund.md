---
sprint: S4
title: Split Bill + Refund
duration: 2 weeks
tokens: 175k ± 25k
depends_on: [S1, S3b]
unlocks: [S6]
status: blocked_on_S3b
---

# S4 — Split Bill + Refund

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Ship two customer-facing features that share the sub-tab pattern and manager-gated workflows. Split bill supports four modes (item, evenly, by person, by amount). Refund is post-payment, PIN-gated, with optional per-line inventory reversal.

## Scope

### In
1. `tabs.parent_tab_id`, `tabs.split_mode`, `tabs.split_label`
2. `refunds` + `refund_items` tables
3. `payments.is_refund`, `payments.refund_id`
4. RPCs: `split_tab_by_item`, `split_tab_evenly`, `split_tab_by_person`, `split_tab_by_amount`, `process_refund`
5. `SplitTabSheet` with 4 mode tabs
6. `RefundSheet` with per-item qty pickers + manager PIN
7. Refunds history tab on PaymentsPage
8. Parent-tab auto-close when all sub-tabs paid
9. Ledger reversal integration (uses `deplete_for_order_item(id, -1)` from S3b)
10. Property tests P8, P9, P10
11. E2E specs `22-split-bill.spec.ts`, `23-refund.spec.ts`

### Out
- Per-combo-slot refund (C4 deferred)
- Tip adjustments post-payment (future)
- Splitting a tab that has combo children across multiple persons: supported (children have their own tab_id now) but UX caveat documented

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S4-01 | Migration: tabs split columns | migration | S |
| S4-02 | Migration: refunds + refund_items + payments.is_refund/refund_id | migration | S |
| S4-03 | RPC `split_tab_by_item(parent_id, assignments jsonb)` | migration | L |
| S4-04 | RPC `split_tab_evenly(parent_id, n)` (no sub-tabs, N payments path) | migration | M |
| S4-05 | RPC `split_tab_by_person(parent_id, n, assignments jsonb)` | migration | L |
| S4-06 | RPC `split_tab_by_amount(parent_id, amounts jsonb)` | migration | M |
| S4-07 | RPC `process_refund(payment_id, items jsonb, reason, manager_pin)` | migration | L |
| S4-08 | Zod: TabSchema extension, RefundSchema, RefundItemSchema, PaymentSchema is_refund | domain.ts | S |
| S4-09 | Entity updates: tab (parent_tab_id), payment (is_refund), new `refund` entity | entities | M |
| S4-10 | Feature: `src/features/split-tab/` with SplitTabSheet (4 modes) | new FSD slice | L |
| S4-11 | Feature: `src/features/process-refund/` with RefundSheet | new FSD slice | L |
| S4-12 | SubTabColumn shared/ui + PersonCard shared/ui | shared/ui + stories | M |
| S4-13 | PaymentsPage: refunds history tab + refund button on rows | `src/pages/PaymentsPage/` | M |
| S4-14 | Parent-auto-close logic: trigger on payment insert, check all sub-tabs paid | migration trigger + entity | M |
| S4-15 | Property tests P8, P9, P10 | test files | L |
| S4-16 | Integration: split by item flow with realistic tab (10 items, 3 persons) | tests | M |
| S4-17 | Integration: refund with restock=true ↔ ledger reversal | tests | M |
| S4-18 | E2E `22-split-bill.spec.ts` | e2e | L |
| S4-19 | E2E `23-refund.spec.ts` | e2e | M |

## RPC contracts

### `split_tab_by_item(p_parent_tab_id, p_assignments jsonb)`
```
p_assignments = [
  { sub_tab_label: "Alice", order_item_ids: [uuid, uuid, ...] },
  { sub_tab_label: "Bob",   order_item_ids: [...] },
  ...
]

Behavior (transactional):
  1. Verify parent tab is OPEN, no payments yet
  2. For each assignment:
     - Insert new tab (parent_tab_id=parent, split_mode='item', split_label=label)
     - UPDATE order_items SET tab_id = new_sub_tab_id WHERE id IN (...)
  3. Mark parent tab as split: parent.split_mode='item', parent.status='split' (new status)
  4. Return array of sub-tab IDs

Errors: PARENT_TAB_PAID, ITEM_NOT_IN_PARENT, ITEM_ASSIGNED_TWICE, UNASSIGNED_ITEMS (if strict)
```

### `split_tab_evenly(p_parent_tab_id, p_n)`
```
No sub-tabs created. Parent tab stays as-is. Caller inserts N payments with
amount = total / N (last one absorbs rounding cent).

Returns { per_payment_amount, cents_remainder }.
```

### `split_tab_by_person(p_parent_tab_id, p_n, p_assignments)`
```
Similar to by_item. Assignments may leave items unassigned — those split evenly across all N at the end.
split_mode='by_person', split_label='Person 1'..'Person N'.
```

### `split_tab_by_amount(p_parent_tab_id, p_amounts)`
```
p_amounts = [{ sub_tab_label, amount }, ...]
  sum(amounts) must equal parent.total (±1 cent)
  Creates sub-tabs with line_items moved proportionally (simple allocation)
  Note: this mode is less common in bars; ship with warning that item-level reporting loses precision
```

### `process_refund(p_original_payment_id, p_items jsonb, p_reason, p_manager_pin)`
```
p_items = [{ order_item_id, qty, amount, restock }, ...]

Behavior (transactional):
  1. Verify manager_pin (reuse manager-pin-gate pattern)
  2. Verify sum(items.amount) ≤ original_payment.amount - already_refunded_amount
  3. Insert refunds row
  4. Insert refund_items rows
  5. Insert negative payments row with is_refund=true, refund_id=new_refund
  6. For each refund_item where restock=true:
     call deplete_for_order_item(order_item_id, -1)  -- reverse depletion
  7. Write audit_log row
  8. Return refund id

Errors: AUTH_FORBIDDEN, REFUND_EXCEEDS_ORIGINAL, ITEM_NOT_IN_ORIGINAL_ORDER
```

## UI flows
See [04-navigation-ui-flows.md § Split by person, Refund](../04-navigation-ui-flows.md).

Additional split-by-item UX detail:
- Sheet opens with 4 sub-tabs (shadcn Tabs)
- Default active tab: "Evenly" (fastest)
- Each mode shows its own view:
  - **Evenly**: big numeric keypad for N; preview shows per-person amount
  - **Item**: left column = unassigned items; right = N sub-check columns; tap item → tap column
  - **By Person**: identical to Item visually; difference is metadata (persons are named)
  - **By Amount**: N amount inputs; "Remaining: $X.XX" live total; validates to parent.total
- "Confirm Split" button disabled until valid

## Testing

### Property
- **P8** conservation: for any split, `sum(sub_tab_totals) + tip + discount = parent_tab_total ± 1 cent`
- **P9** rounding: for N-way even split of amount X, sum of N payments = X exactly; no cent lost
- **P10** refund: refund amount ≤ original; restock produces exact inverse of original ledger deltas

### Integration
- Split by item of a tab with 10 items across 3 persons → 3 sub-tabs with correct item distribution
- Pay one sub-tab → parent remains open with 2 unpaid
- Pay last sub-tab → parent auto-closes (trigger verified)
- Refund 2 of 5 items with restock → payments sum correctly; 2 items' ingredients returned to stock
- Refund full payment → original payment still exists; refund row present; negative payment row present
- Attempt over-refund (refund already-refunded item twice) → blocked

### E2E `22-split-bill.spec.ts`
1. Seed a tab with 6 items totalling $100
2. Split evenly into 3 → $33.34 / $33.33 / $33.33 (assert cents sum to $100)
3. Reset, split by item → Alice gets items 1,2,3; Bob 4; Charlie 5,6 → verify sub-tab totals
4. Pay Alice's sub-tab → parent open, Alice closed
5. Pay Bob + Charlie → parent auto-closes
6. Split by person (N=3, 4 of 6 items unassigned) → unassigned evenly split across 3 persons

### E2E `23-refund.spec.ts`
1. Complete a paid tab with 5 Alitas
2. Navigate to PaymentsPage → Refund button
3. Select 2 Alitas with restock=true, reason "wrong order"
4. Manager PIN modal → enter admin PIN 0000 → confirm
5. Verify negative payments row; wings inventory increased by 1500g; salsa +2; audit_log row present
6. Attempt to refund same 2 Alitas again → blocked
7. Refund remaining 3 with restock=false → verify no ledger change

## Definition of Done

- [ ] Migrations applied; types regenerated
- [ ] All 5 RPCs tested in isolation
- [ ] Parent auto-close trigger verified
- [ ] SplitTabSheet: all 4 modes usable in Tauri dev build
- [ ] RefundSheet usable; manager PIN gate enforced
- [ ] PaymentsPage refunds history visible
- [ ] Property tests P8, P9, P10 green
- [ ] E2E `22-split-bill.spec.ts` green
- [ ] E2E `23-refund.spec.ts` green
- [ ] Existing E2E regressions checked (`05-payments`, `03-tab-order`)
- [ ] typecheck + lint clean
- [ ] Manual smoke: split a combo Cubeta between two persons → children follow their parent's tab_id move correctly

## Risks

| Risk | Mitigation |
|---|---|
| Parent-child order_items when splitting: do children follow the parent's reassignment? | Explicit: when moving parent order_item to sub-tab, cascade to children via app-layer logic (or DB trigger). Test fails if missed. |
| Split-by-amount loses item attribution for reports | Document in tooltip; mode stamped on tabs.split_mode for report awareness |
| Rounding cent drift across many tests | Use centavos-integer internally; convert for display only |
| Refund after partial sub-tab payment | Only allow refund on fully-paid sub-tabs in v1; documented limitation |
| Payments `isOneToOne` drop (from S1) causes latent bugs | Grep again; full test sweep |

## Notes

- Sub-tabs persist in DB as first-class rows with `parent_tab_id`. They appear in reports under the parent.
- "Split evenly" intentionally does NOT create sub-tabs — it's a shortcut. Reports still show one tab with multiple payments.
