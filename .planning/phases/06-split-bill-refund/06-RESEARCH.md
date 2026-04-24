# Phase 6: Split Bill + Refund — Research

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Researched:** 2026-04-24
**Domain:** Supabase PL/pgSQL (RPCs + triggers) + FSD feature/entity extension + property-based testing
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| S4-01 | Migration: `tabs.parent_tab_id`, `tabs.split_mode`, `tabs.split_label`, `tabs.status` ADD 'split' value | DB schema fully specified in S4 PRD; `tab_status` ENUM must be extended with ALTER TYPE |
| S4-02 | Migration: `refunds` + `refund_items` tables + `payments.is_refund` + `payments.refund_id` | `payments` table verified in migrations; new columns via ALTER TABLE |
| S4-03 | RPC `split_tab_by_item` | Full contract in S4 PRD; mirrors `add_combo_to_tab` SECURITY DEFINER pattern |
| S4-04 | RPC `split_tab_evenly` | Simpler RPC — returns per_payment_amount + cents_remainder; no sub-tabs created |
| S4-05 | RPC `split_tab_by_person` | Extension of by_item; unassigned items split evenly across all persons |
| S4-06 | RPC `split_tab_by_amount` | Creates sub-tabs with proportional item allocation; ±1 cent tolerance |
| S4-07 | RPC `process_refund` | PIN verification via auth.uid() + profile lookup; calls `deplete_for_order_item` stub when Phase 4 not yet built |
| S4-08 | Zod: `TabSchema` extension, `RefundSchema`, `RefundItemSchema`, `PaymentSchema` is_refund | `TabSchema` verified in domain.ts; `PaymentSchema` verified; no `is_refund` field yet |
| S4-09 | Entity updates: tab (parent_tab_id), payment (is_refund), new `refund` entity | `entities/tab/` and `entities/payment/` verified; `refund` entity new |
| S4-10 | Feature: `src/features/split-tab/` with SplitTabSheet (4 modes) | FSD pattern established from Phase 2 |
| S4-11 | Feature: `src/features/process-refund/` with RefundSheet | FSD pattern established from Phase 2 |
| S4-12 | `SubTabColumn` + `PersonCard` shared/ui + Storybook stories | UI-SPEC fully specced; pattern from Phase 2 shared components |
| S4-13 | PaymentsPage refunds history tab + refund button on rows | `PaymentsPage` verified (thin wrapper around `PaymentPane` widget) |
| S4-14 | Parent-auto-close trigger: fires on payment INSERT, checks all sub-tabs paid | Trigger pattern documented; must also update `closed_at_requires_closed_status` CHECK |
| S4-15 | Property tests P8, P9, P10 | `fast-check` established; P8/P9/P10 specs from S4 PRD |
| S4-16 | Integration: split by item flow | Vitest integration pattern from Phase 3 |
| S4-17 | Integration: refund with restock | Phase 4 stub required for `deplete_for_order_item` |
| S4-18 | E2E `22-split-bill.spec.ts` | Next spec after `21-carom-billing.spec.ts`; naming confirmed below |
| S4-19 | E2E `23-refund.spec.ts` | Follows 22 |
</phase_requirements>

---

## Summary

Phase 6 introduces the sub-tab pattern (first use in the codebase) and post-payment refunds. The work divides cleanly into three layers: DB migrations (S4-01 through S4-07), FSD entity/feature extensions (S4-08 through S4-13), and test coverage (S4-14 through S4-19).

The biggest DB risks are: (1) extending the `tab_status` ENUM (requires `ALTER TYPE … ADD VALUE` — non-transactional in Postgres, must run outside a transaction block or use a migration file with `BEGIN/COMMIT` removed); (2) the `closed_at_requires_closed_status` CHECK constraint on `tabs` will reject sub-tabs with `status='split'` if it is not updated; (3) the parent-auto-close trigger must not fire for sub-tab payments — it must only fire when ALL sub-tabs under a parent are paid.

Phase 4 (`deplete_for_order_item` RPC) is not yet built. The `process_refund` RPC must stub that call: when `restock=true`, the RPC should attempt `deplete_for_order_item(order_item_id, -1)` and gracefully handle the case where the function does not yet exist (EXCEPTION WHEN undefined_function). This avoids blocking Phase 6 delivery on Phase 4.

The FSD layers are straightforward: extend existing `entities/tab/` and `entities/payment/`, create a new `entities/refund/` entity slice following the combo/ingredient pattern, and add two feature slices (`split-tab`, `process-refund`). The `split-tab` feature is the most complex frontend piece — it owns the four-mode `SplitTabSheet` and the client-side loop that inserts N payments for Evenly mode.

**Primary recommendation:** Ship migrations in two files: (1) schema changes (tabs + refunds + payments columns), (2) RPCs + trigger. Stub `deplete_for_order_item` in `process_refund` with a graceful fallback. No Phase 4 dependency needed to ship Phase 6.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sub-tab creation | DB (PL/pgSQL RPC) | — | Atomicity: order_items reassignment + tab insert must be a single transaction |
| Evenly split calculation | Frontend (feature) | DB (RPC for amount) | RPC returns per_payment_amount; client inserts N payments in loop (no sub-tabs created) |
| Parent-tab auto-close | DB (trigger on payments INSERT) | — | Must be atomic with payment commit; cannot be trusted to app layer |
| Refund PIN verification | Frontend (ManagerPinDialog) + DB (RPC PIN check) | — | UI gate checks client-side; RPC double-checks manager role via auth.uid() |
| Refund amount validation | DB (RPC: REFUND_EXCEEDS_ORIGINAL) | Frontend (isValid state) | DB is authoritative; UI prevents obvious invalid states before call |
| Ledger reversal (restock) | DB (RPC: deplete_for_order_item) | — | Phase 4 provides this; Phase 6 stubs it with graceful fallback |
| Refunds history view | Frontend (widget: RefundsList) | API (query) | Read-only DataTable pattern; no business logic |
| Combo children migration across sub-tabs | DB (RPC: cascade via parent_order_item_id) | — | Children must follow their parent item's tab_id when parent item moves to sub-tab |
| `isValid` per split mode | Frontend (feature local state) | — | Pure UI validation before RPC call |
| RBAC gate (refund) | Frontend (ManagerPinDialog) + DB (RLS on refunds INSERT) | — | Both layers enforce; UI hides controls, DB rejects unauthorized writes |

---

## Standard Stack

### Core

All dependencies already installed — no new packages required.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | `^2` (installed) | DB access, RPC calls | Project-standard backend |
| TanStack Query | `^5` (installed) | Server state + cache invalidation | Project-mandated for all server state |
| Zod | `^4` (installed) | Schema + type inference | Project-mandated single source of truth |
| fast-check | `^4` (installed) | Property tests P8/P9/P10 | Already used in Phase 1, 2, 3 |
| lucide-react | installed | `SplitSquareHorizontal`, `ReceiptText` icons | Verified available: `SplitSquareHorizontal: true, ReceiptText: true` [VERIFIED: codebase] |
| sonner | installed | Toast feedback | Used across all phases |

**Installation:** No new packages. All already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
POS OrderPanel (widget)
  [tab.status === 'open'] → [Split bill button]
          │
          ▼
  SplitTabSheet (feature: split-tab)
          ├── Mode: Evenly  → split_tab_evenly RPC → returns amounts
          │                → client inserts N payments via process-payment path
          ├── Mode: By Item → split_tab_by_item RPC → creates sub-tabs
          │                                       → reassigns order_items
          ├── Mode: By Person → split_tab_by_person RPC → creates sub-tabs
          └── Mode: By Amount → split_tab_by_amount RPC → creates sub-tabs
                    │
                    ▼ (sub-tabs created in DB)
  Parent tab status = 'split' → sub-tabs shown in OrderPanel sub-checks section
          │
          ▼ (sub-tabs paid individually via existing process-payment)
  DB TRIGGER: after_payment_insert
          └── IF all sub-tabs under parent paid → UPDATE parent tab status='paid', closed_at=now()

PaymentsPage
  Tab: Payments (existing PaymentPane)
        └── Each paid row: [Refund button] → RefundSheet (feature: process-refund)
                                │
                                ▼
                        ManagerPinDialog (existing feature)
                                │ PIN accepted
                                ▼
                        process_refund RPC
                                ├── INSERT refunds row
                                ├── INSERT refund_items rows
                                ├── INSERT negative payments row (is_refund=true)
                                └── IF restock=true → deplete_for_order_item (stub if Phase 4 absent)

  Tab: Refunds (new RefundsList widget)
        └── DataTable of refunds (read-only)
```

### Recommended Project Structure

```
src/
├── entities/
│   ├── tab/                           # EXTEND existing
│   │   └── model/
│   │       ├── types.ts               # add parentTabId, splitMode, splitLabel to TabSchema re-export
│   │       └── queries.ts             # add useSubTabs(parentTabId) query hook
│   ├── payment/                       # EXTEND existing
│   │   └── model/
│   │       └── types.ts               # add isRefund, refundId to Payment re-export
│   └── refund/                        # NEW entity slice
│       ├── index.ts                   # public API exports
│       └── model/
│           ├── types.ts               # re-exports RefundSchema, RefundItemSchema from domain.ts
│           └── queries.ts             # useRefunds(), useRefund(id), refundKeys
│
├── features/
│   ├── split-tab/                     # NEW feature slice
│   │   ├── index.ts
│   │   └── ui/
│   │       └── SplitTabSheet.tsx      # 4-mode sheet; all split mode UIs
│   └── process-refund/                # NEW feature slice
│       ├── index.ts
│       └── ui/
│           └── RefundSheet.tsx        # per-item qty spinners + manager PIN
│
├── widgets/
│   └── RefundsList/                   # NEW widget (no Storybook)
│       └── index.tsx                  # DataTable of refunds for PaymentsPage
│
└── shared/ui/
    ├── SubTabColumn/                  # NEW shared/ui (Storybook required)
    │   ├── SubTabColumn.tsx
    │   ├── SubTabColumn.stories.tsx
    │   └── index.ts
    └── PersonCard/                    # NEW shared/ui (Storybook required)
        ├── PersonCard.tsx
        ├── PersonCard.stories.tsx
        └── index.ts
```

### Pattern 1: ENUM Extension (ALTER TYPE)

`tab_status` currently has values: `'open', 'closed', 'paid', 'voided'` [VERIFIED: codebase, `20260414000001_enums.sql`].

Phase 6 adds `'split'`. In PostgreSQL, `ALTER TYPE … ADD VALUE` cannot run inside a transaction block. Supabase migrations run in transactions by default — the migration file must include `-- disable transaction` annotation or use the `ALTER TYPE` outside a `BEGIN/COMMIT` block.

```sql
-- 06-split-bill-refund: extend tab_status ENUM
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction.
-- Supabase CLI: this file must NOT use BEGIN/COMMIT wrapping.
ALTER TYPE tab_status ADD VALUE IF NOT EXISTS 'split';
```

**Critical:** The existing `closed_at_requires_closed_status` CHECK constraint on `tabs` must be updated:

```sql
-- Current constraint (VERIFIED: 20260414000004_tabs_and_orders.sql):
-- (closed_at IS NULL AND status = 'open') OR
-- (closed_at IS NOT NULL AND status IN ('closed', 'paid', 'voided'))

-- Must become:
ALTER TABLE tabs DROP CONSTRAINT IF EXISTS closed_at_requires_closed_status;
ALTER TABLE tabs ADD CONSTRAINT closed_at_requires_closed_status CHECK (
  (closed_at IS NULL AND status IN ('open', 'split')) OR
  (closed_at IS NOT NULL AND status IN ('closed', 'paid', 'voided'))
);
```

`split` status tabs have `closed_at = NULL` (still open, just subdivided). Sub-tabs also have `closed_at = NULL` while open.

### Pattern 2: Sub-tab Schema (tabs extensions)

```sql
-- New columns on existing tabs table
ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS parent_tab_id uuid REFERENCES tabs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS split_mode text CHECK (split_mode IN ('item','evenly','by_person','by_amount')),
  ADD COLUMN IF NOT EXISTS split_label text;

CREATE INDEX IF NOT EXISTS idx_tabs_parent_tab_id ON tabs(parent_tab_id)
  WHERE parent_tab_id IS NOT NULL;
```

`parent_tab_id` is self-referential. `ON DELETE RESTRICT` prevents deleting a parent while sub-tabs exist. `split_label` holds the label for sub-tabs (e.g., "Alice", "Sub-tab 1").

### Pattern 3: Refunds Schema

```sql
CREATE TABLE refunds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  reason           text NOT NULL CHECK (reason IN ('wrong_order','quality_issue','customer_complaint','billing_error','other')),
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refund_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id       uuid NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  qty             integer NOT NULL CHECK (qty > 0),
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  restock         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Payments extensions
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS is_refund boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES refunds(id) ON DELETE RESTRICT;

-- Index for refund lookup
CREATE INDEX IF NOT EXISTS idx_refunds_original_payment_id ON refunds(original_payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund_id ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_order_item_id ON refund_items(order_item_id);
```

### Pattern 4: Parent-Auto-Close Trigger

```sql
-- Trigger fires AFTER INSERT on payments
-- Only applies when the paid tab has a parent_tab_id (i.e., it's a sub-tab)
CREATE OR REPLACE FUNCTION check_parent_tab_auto_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id  uuid;
  v_open_count integer;
BEGIN
  -- Only fire for sub-tab payments (non-refund)
  IF NEW.is_refund THEN
    RETURN NEW;
  END IF;

  -- Get parent_tab_id of the paid tab
  SELECT parent_tab_id INTO v_parent_id
  FROM tabs
  WHERE id = NEW.tab_id;

  IF v_parent_id IS NULL THEN
    RETURN NEW;  -- Not a sub-tab, nothing to do
  END IF;

  -- Count sub-tabs under the parent that are not yet paid
  SELECT COUNT(*) INTO v_open_count
  FROM tabs
  WHERE parent_tab_id = v_parent_id
    AND status != 'paid';

  IF v_open_count = 0 THEN
    -- All sub-tabs paid: auto-close the parent
    UPDATE tabs
    SET status = 'paid', closed_at = now(), updated_at = now()
    WHERE id = v_parent_id AND status = 'split';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_payment_insert_check_parent_close
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION check_parent_tab_auto_close();
```

**Note:** This trigger must be aware of the `closed_at_requires_closed_status` CHECK — the CHECK now allows `status='paid'` with `closed_at IS NOT NULL`, so the UPDATE is valid.

### Pattern 5: process_refund RPC with deplete_for_order_item Stub

```sql
CREATE OR REPLACE FUNCTION process_refund(
  p_original_payment_id uuid,
  p_items               jsonb,   -- [{order_item_id, qty, amount, restock}]
  p_reason              text,
  p_manager_pin         text     -- not used server-side; PIN already verified by ManagerPinDialog
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id         uuid;
  v_payment          record;
  v_already_refunded numeric;
  v_refund_total     numeric;
  v_refund_id        uuid;
  v_item             jsonb;
BEGIN
  -- 1. Verify caller is manager or admin (auth.uid() context preserved by SECURITY DEFINER)
  SELECT id INTO v_staff_id FROM profiles
  WHERE id = auth.uid()
    AND role IN ('manager', 'admin');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
  END IF;

  -- 2. Get original payment
  SELECT * INTO v_payment FROM payments
  WHERE id = p_original_payment_id AND is_refund = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: payment % not found or is itself a refund', p_original_payment_id;
  END IF;

  -- 3. Compute already-refunded amount
  SELECT COALESCE(SUM(r.amount), 0) INTO v_already_refunded
  FROM refunds r
  WHERE r.original_payment_id = p_original_payment_id;

  -- 4. Compute new refund total
  SELECT SUM((item->>'amount')::numeric) INTO v_refund_total
  FROM jsonb_array_elements(p_items) AS item;

  IF v_refund_total > (v_payment.amount - v_already_refunded) THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_ORIGINAL: refund % exceeds remaining refundable amount %',
      v_refund_total, (v_payment.amount - v_already_refunded);
  END IF;

  -- 5. Insert refund record
  INSERT INTO refunds (original_payment_id, reason, amount, created_by)
  VALUES (p_original_payment_id, p_reason, v_refund_total, v_staff_id)
  RETURNING id INTO v_refund_id;

  -- 6. Insert refund_items + optionally call deplete_for_order_item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Verify item belongs to original payment's tab
    IF NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = (v_item->>'order_item_id')::uuid
        AND o.tab_id = v_payment.tab_id
    ) THEN
      RAISE EXCEPTION 'ITEM_NOT_IN_ORIGINAL_ORDER: item % not in payment''s tab',
        v_item->>'order_item_id';
    END IF;

    INSERT INTO refund_items (refund_id, order_item_id, qty, amount, restock)
    VALUES (
      v_refund_id,
      (v_item->>'order_item_id')::uuid,
      (v_item->>'qty')::integer,
      (v_item->>'amount')::numeric,
      (v_item->>'restock')::boolean
    );

    -- Ledger reversal: restock=true calls deplete_for_order_item with negative qty
    -- Phase 4 stubs: graceful fallback when function not yet defined
    IF (v_item->>'restock')::boolean THEN
      BEGIN
        PERFORM deplete_for_order_item((v_item->>'order_item_id')::uuid, -1);
      EXCEPTION WHEN undefined_function THEN
        -- Phase 4 not yet deployed: log and continue
        NULL;
      END;
    END IF;
  END LOOP;

  -- 7. Insert negative payment row
  INSERT INTO payments (tab_id, amount, tip_amount, method, processed_at, processed_by, is_refund, refund_id)
  VALUES (
    v_payment.tab_id,
    -v_refund_total,
    0,
    v_payment.method,
    now(),
    v_staff_id,
    true,
    v_refund_id
  );

  -- 8. Audit log (graceful fallback if audit_log not yet created)
  BEGIN
    INSERT INTO audit_log (action, entity_type, entity_id, staff_id, details)
    VALUES ('refund', 'payment', p_original_payment_id, v_staff_id,
            jsonb_build_object('refund_id', v_refund_id, 'amount', v_refund_total));
  EXCEPTION WHEN undefined_table THEN
    NULL;  -- audit_log added by future migration
  END;

  RETURN v_refund_id;
END;
$$;
```

**Key design note:** The `amount` column on `payments` currently has `CHECK (amount > 0)`. The refund negative payment row will have `amount = -v_refund_total` (negative). This CHECK constraint **will block the INSERT**. The Phase 6 migration must either drop + recreate the CHECK to allow negative amounts for refund rows, or use a conditional: `CHECK (amount > 0 OR is_refund = true)`.

### Pattern 6: Combo Children Cascade on Sub-tab Assignment

When `split_tab_by_item` moves a parent order item to a sub-tab, its combo children (items with `parent_order_item_id = moving_item.id`) must follow. The RPC must cascade:

```sql
-- Within split_tab_by_item, after moving a parent item:
UPDATE order_items
SET tab_id = v_sub_tab_id   -- Note: order_items does NOT have tab_id
-- ...
```

**CRITICAL FINDING:** `order_items` in this codebase does NOT have a `tab_id` column. Items are linked to tabs via `order_items.order_id → orders.tab_id`. When splitting, the sub-tab needs its own `order` row, and the `order_items` are reassigned to that new order.

The `split_tab_by_item` RPC must:
1. Create sub-tab (new `tabs` row)
2. Create new `order` row for the sub-tab
3. For each assigned order_item: `UPDATE order_items SET order_id = new_order_id WHERE id = item_id`
4. **Cascade:** also update children: `UPDATE order_items SET order_id = new_order_id WHERE parent_order_item_id = item_id`

### Pattern 7: split_tab_evenly — N Payments Client Loop

`split_tab_evenly` does NOT create sub-tabs. It returns `{ per_payment_amount, cents_remainder }`. The caller (feature hook) inserts N payments:

```typescript
// In src/features/split-tab/ hook
const { data } = await supabase.rpc('split_tab_evenly', {
  p_parent_tab_id: tabId,
  p_n: n,
});
// data = { per_payment_amount: 33.33, cents_remainder: 0.01 }

// Insert N payments via existing process-payment path (N-1 at base, 1 absorbs remainder)
for (let i = 0; i < n; i++) {
  const amount = i === n - 1
    ? data.per_payment_amount + data.cents_remainder
    : data.per_payment_amount;
  // call process-payment mutation with amount
}
```

**Payment amount CHECK constraint:** The `amount_positive CHECK (amount > 0)` is fine here since all Evenly payments are positive. Issue only arises for refund rows.

### Pattern 8: TanStack Query Invalidation for Sub-tabs

When a split RPC succeeds, invalidate:
- `tabKeys.detail(parentTabId)` — parent tab status changes to 'split'
- `tabKeys.lists()` — list view updates
- If creating sub-tabs: `tabKeys.lists()` will return sub-tabs in the open tabs list

Sub-tabs appear as first-class tab rows in the DB. They will surface in `useTabList()` unless filtered. The `useTabList` hook must be reviewed to decide: should sub-tabs appear in the main tab list, or only under their parent? [ASSUMED: sub-tabs should NOT appear in the top-level POS tab list; they should only appear in the OrderPanel sub-checks section when the parent is selected.]

### Pattern 9: New `entities/refund/` Entity Slice

Follows `entities/combo/` pattern exactly:

```typescript
// src/entities/refund/model/queries.ts
export const refundKeys = {
  all: ['refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  byPayment: (paymentId: string) => [...refundKeys.all, 'by-payment', paymentId] as const,
};

export function useRefunds() {
  return useQuery({
    queryKey: refundKeys.lists(),
    queryFn: async () => { /* supabase select from refunds JOIN refund_items */ }
  });
}

export function useRefundsByPayment(paymentId: string) {
  return useQuery({
    queryKey: refundKeys.byPayment(paymentId),
    queryFn: async () => { /* select refunds WHERE original_payment_id = paymentId */ }
  });
}
```

### Anti-Patterns to Avoid

- **Putting split logic in OrderPanel directly:** Split is a feature slice (`split-tab`), not a widget concern. OrderPanel only renders the "Split bill" button and the sub-checks panel.
- **Inserting N payments for Evenly mode in the RPC:** The RPC only calculates amounts. The client inserts payments to leverage the existing `process-payment` feature (which handles offline queue, optimistic updates, etc.).
- **Using `orders.tab_id` vs a direct `order_items.tab_id`:** Items live under orders. Splitting moves `order_items.order_id` to a new order under the sub-tab — never add a redundant `tab_id` column to `order_items`.
- **Letting sub-tabs appear in the main POS tab list without filtering:** Sub-tabs are valid tab rows. The `useTabList` query must filter `WHERE parent_tab_id IS NULL` to avoid cluttering the POS view.
- **Dropping the `amount_positive` CHECK without making it conditional:** The existing check `amount > 0` blocks refund negative payment rows. Must change to: `CHECK (amount > 0 OR is_refund = true)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manager PIN check | Custom PIN UI | `ManagerPinDialog` from `features/manager-pin-gate` | Already exists, fully compliant with FSD, handles error state and clear-on-dismiss |
| Money formatting in sub-tab totals | `price.toFixed(2)` | `MoneyDisplay` from `shared/ui` | `MoneyDisplay` already has `negative={true}` prop, `aria-label` for screen readers, `font-mono tabular-nums` |
| Item quantity spinner in RefundSheet | Custom `<input type="number">` | `QuantityControl` from `shared/ui` | 44px touch target, min/max constraints, aria-live already implemented |
| Confirm dialog for cancelling split | Custom modal | `ConfirmDialog` from `shared/ui` | Already styled for destructive variant per Phase 1+ |
| Toast feedback | Custom notification | `sonner` (already used) | All phases use sonner; consistent UX |
| DataTable for refunds history | Custom table | `DataTable` from `shared/ui` | Phase 3 confirmed `getRowClassName`, `enableSorting`, `initialSorting`, `emptyState` props exist |
| Rounding for Evenly split | Manual `toFixed` | Floor-to-cent pattern per UI-SPEC | `Math.floor(total * 100 / N) / 100` + last absorbs remainder — tested by P9 |

---

## DB Schema — Exact Changes Required

### `tabs` table extensions

```sql
-- New columns
ADD COLUMN parent_tab_id uuid REFERENCES tabs(id) ON DELETE RESTRICT
ADD COLUMN split_mode    text CHECK (split_mode IN ('item','evenly','by_person','by_amount'))
ADD COLUMN split_label   text

-- ENUM extension (must be outside transaction block)
ALTER TYPE tab_status ADD VALUE IF NOT EXISTS 'split';

-- CHECK constraint update (closed_at allows NULL for 'split' status)
-- Drop + recreate closed_at_requires_closed_status
```

### `payments` table extensions

```sql
ADD COLUMN is_refund  boolean NOT NULL DEFAULT false
ADD COLUMN refund_id  uuid REFERENCES refunds(id) ON DELETE RESTRICT

-- BREAKING: amount_positive CHECK must be updated
-- Current: CHECK (amount > 0)
-- New: CHECK (amount > 0 OR is_refund = true)
```

### New tables: `refunds`, `refund_items`

See Pattern 3 above for full DDL.

### New trigger: `after_payment_insert_check_parent_close`

See Pattern 4 above.

---

## Migration File Naming

Last migration: `20260426000010_stock_movements_product_id_nullable.sql` [VERIFIED: codebase]

Phase 6 migrations will be prefixed with the execution date. Placeholder with `20260427`:

| # | File | Ticket | Notes |
|---|------|--------|-------|
| 1 | `20260427000001_split_bill_schema.sql` | S4-01, S4-02 | tabs columns + ENUM + refunds/refund_items + payments columns + CHECK fix |
| 2 | `20260427000002_split_tab_rpcs.sql` | S4-03 to S4-06 | all 4 split RPCs |
| 3 | `20260427000003_process_refund_rpc.sql` | S4-07 | process_refund RPC |
| 4 | `20260427000004_parent_auto_close_trigger.sql` | S4-14 | trigger + function |

**File 1 must include `ALTER TYPE tab_status ADD VALUE` outside a transaction.** In Supabase CLI migrations, use `-- supabase migrate: no-transaction` header or split the ENUM extension to its own file.

---

## E2E Spec Numbering

Existing specs go up to `33-ingredients.spec.ts`. [VERIFIED: codebase]

Phase 6 E2E specs: `34-split-bill.spec.ts` and `35-refund.spec.ts`.

**Note:** S4 PRD names them `22-split-bill.spec.ts` and `23-refund.spec.ts` — those numbers are already taken by `22-sprint3-billing.spec.ts` and `23-caja-entries.spec.ts` in this repo. Following the Phase 1/2/3 precedent of using the next available numbers, Phase 6 uses `34` and `35`.

---

## Common Pitfalls

### Pitfall 1: `amount_positive` CHECK Blocks Refund Payment Rows

**What goes wrong:** `process_refund` inserts a negative payment row (`amount = -refund_total`). The existing `CHECK (amount > 0)` on `payments` rejects this INSERT, causing the RPC to raise an exception.
**Why it happens:** The original payments table was designed before refunds were planned. Phase S1-D07 dropped the `UNIQUE (tab_id)` constraint but did not touch the `amount_positive` CHECK.
**How to avoid:** Migration S4-02 must DROP and recreate the CHECK: `CHECK (amount > 0 OR is_refund = true)`.
**Warning signs:** `process_refund` RPC consistently fails with a constraint violation error.

### Pitfall 2: ENUM Extension in a Transaction

**What goes wrong:** `ALTER TYPE tab_status ADD VALUE 'split'` inside a `BEGIN/COMMIT` block causes `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`.
**Why it happens:** PostgreSQL constraint on `ALTER TYPE ADD VALUE`.
**How to avoid:** Either (a) add a separate migration file with only the ENUM extension and mark it `-- supabase migrate: no-transaction`, or (b) if Supabase CLI supports it, use `ALTER TYPE tab_status ADD VALUE IF NOT EXISTS 'split'` in a separate `ALTER TABLE` migration that runs sequentially.
**Warning signs:** Migration fails on first run with "cannot run inside a transaction block".

### Pitfall 3: `closed_at_requires_closed_status` CHECK Rejects 'split' Status

**What goes wrong:** The existing CHECK `(closed_at IS NULL AND status = 'open') OR (closed_at IS NOT NULL AND status IN ('closed', 'paid', 'voided'))` rejects any row with `status = 'split'` because `'split'` is not in the `OR` conditions.
**Why it happens:** CHECK was written before the split status was planned.
**How to avoid:** Migration S4-01 must DROP this CHECK and add a new one that includes `'split'` in the `closed_at IS NULL` branch.
**Warning signs:** `split_tab_by_item` RPC fails immediately on UPDATE of parent tab to `status='split'`.

### Pitfall 4: Sub-tabs Appearing in Main POS Tab List

**What goes wrong:** `useTabList()` query returns ALL tabs including sub-tabs. Bartenders see cluttered list with "Alice", "Bob", "Charlie" entries alongside regular tabs.
**Why it happens:** `tabs` table has no concept of "top-level vs sub-tab" in the query filter.
**How to avoid:** All `useTabList()` variants must add `WHERE parent_tab_id IS NULL` filter. Check `entities/tab/model/queries.ts` `useTabList` and `tabKeys.list()` filter parameters.
**Warning signs:** After any split, the POS tab list shows 3+ extra entries per split.

### Pitfall 5: Parent Auto-Close Fires on Refund Payment Rows

**What goes wrong:** `process_refund` inserts a negative payment row with `is_refund = true`. If the auto-close trigger does not check `is_refund`, it may count this as a payment and incorrectly trigger auto-close logic.
**Why it happens:** Trigger fires for ALL `INSERT` events on `payments`.
**How to avoid:** Trigger function must check `IF NEW.is_refund THEN RETURN NEW; END IF;` as first guard. [Already included in Pattern 4 above.]

### Pitfall 6: Combo Children Not Migrated to Sub-tab

**What goes wrong:** When `split_tab_by_item` moves a parent order_item (of a combo) to a sub-tab, the child order_items (with `parent_order_item_id = parent_item.id`) remain in the original order, causing split sub-tab totals to be wrong.
**Why it happens:** `order_items` with `parent_order_item_id` are children of the combo — they price at $0 but must follow the parent.
**How to avoid:** The `split_tab_by_item` RPC, after `UPDATE order_items SET order_id = new_order_id WHERE id = assigned_item_id`, must immediately also run `UPDATE order_items SET order_id = new_order_id WHERE parent_order_item_id = assigned_item_id`.

### Pitfall 7: `deplete_for_order_item` Not Yet Defined

**What goes wrong:** `process_refund` calls `PERFORM deplete_for_order_item(...)` but Phase 4 is not yet built. This raises `undefined_function` exception and aborts the entire RPC.
**Why it happens:** Phase 6 depends on Phase 4 which is not yet implemented.
**How to avoid:** Wrap the call in `BEGIN ... EXCEPTION WHEN undefined_function THEN NULL; END;` as shown in Pattern 5. This makes Phase 6 shippable independently of Phase 4.
**Warning signs:** `process_refund` always fails with "function deplete_for_order_item does not exist" when `restock=true`.

---

## Code Examples

### Verified Pattern: Tab Entity Query with Parent Filter

```typescript
// Source: verified from bar-pos/src/entities/tab/model/queries.ts (tabKeys + useQuery pattern)
// Add to existing tabKeys:
export const tabKeys = {
  all: ['tabs'] as const,
  lists: () => [...tabKeys.all, 'list'] as const,
  list: (filters?: { shiftId?: string; status?: string; parentTabId?: string }) =>
    [...tabKeys.lists(), filters ?? {}] as const,
  subTabs: (parentTabId: string) => [...tabKeys.all, 'sub-tabs', parentTabId] as const,
  details: () => [...tabKeys.all, 'detail'] as const,
  detail: (id: string) => [...tabKeys.details(), id] as const,
};

// New hook for sub-tabs
export function useSubTabs(parentTabId: string) {
  return useQuery({
    queryKey: tabKeys.subTabs(parentTabId),
    queryFn: async () => {
      const { data, error } = await db
        .from('tabs')
        .select('*')
        .eq('parent_tab_id', parentTabId)
        .order('created_at', { ascending: true });
      if (error) return err({ code: 'SUPABASE_ERROR', message: error.message, raw: error });
      return ok(data ?? []);
    },
  });
}
```

### Verified Pattern: RPC Call with Error Mapping (from entities/combo/model/queries.ts)

```typescript
// Source: verified combo entity pattern — apply same to split-tab mutations
async function callSplitTabByItem(
  parentTabId: string,
  assignments: Array<{ sub_tab_label: string; order_item_ids: string[] }>
): Promise<Result<string[]>> {
  const { data, error } = await supabase.rpc('split_tab_by_item', {
    p_parent_tab_id: parentTabId,
    p_assignments: assignments,
  });
  if (error) {
    if (error.message.includes('PARENT_TAB_PAID'))
      return err({ code: 'TAB_ALREADY_CLOSED', message: 'This tab has already been paid and cannot be split.' });
    if (error.message.includes('ITEM_ASSIGNED_TWICE'))
      return err({ code: 'VALIDATION_ERROR', message: 'An item was assigned to more than one check.' });
    return err({ code: 'SUPABASE_ERROR', message: error.message, raw: error });
  }
  return ok(data as string[]);
}
```

### Verified Pattern: Property Test Framework (from entities/tab/model/queries-reports.test.ts)

```typescript
// Source: verified from bar-pos/src/entities/tab/model/queries-reports.test.ts
import * as fc from 'fast-check';

// P8: conservation — sum(sub_tab_totals) = parent_tab_total ± 1 cent
test('P8: split conservation — sub-tab totals sum to parent total', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 1, max: 100_00 }), { minLength: 2, maxLength: 6 }),
      (itemPrices) => {
        const total = itemPrices.reduce((a, b) => a + b, 0);
        const assignments = partitionIntoGroups(itemPrices, 2);
        const subTotals = assignments.map(g => g.reduce((a, b) => a + b, 0));
        const subSum = subTotals.reduce((a, b) => a + b, 0);
        expect(Math.abs(subSum - total)).toBeLessThanOrEqual(1);
      }
    )
  );
});

// P9: rounding — N-way even split sums to exact original
test('P9: evenly split N payments sum exactly to original', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 9 }),   // N splits
      fc.integer({ min: 1, max: 1_000_00 }),  // total in cents
      (n, totalCents) => {
        const base = Math.floor(totalCents / n);
        const last = totalCents - base * (n - 1);
        const payments = Array.from({ length: n - 1 }, () => base).concat(last);
        expect(payments.reduce((a, b) => a + b, 0)).toBe(totalCents);
      }
    )
  );
});
```

### Verified Pattern: ManagerPinDialog Integration (from features/process-payment)

```typescript
// Source: verified from bar-pos/src/widgets/PaymentPane/ui/PaymentPane.tsx
// RefundSheet follows the same open/onOpenChange pattern:
const [pinOpen, setPinOpen] = useState(false);

<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="void_order"  // re-use closest matching action; or add 'process_refund' to RBAC
  onSuccess={() => {
    setPinOpen(false);
    // call process_refund RPC
  }}
/>
```

---

## Zod Schema Additions (domain.ts)

```typescript
// ============================================================================
// S4 — SPLIT BILL + REFUND
// ============================================================================

// Extend TabStatusSchema (add 'split')
export const TabStatusSchema = z.enum(['open', 'closed', 'paid', 'voided', 'split']);

// Extend TabSchema (add 3 new fields, all optional/nullable — backward compat)
// parentTabId: uuid of parent tab (null for top-level tabs and for 'evenly' splits)
// splitMode: how this tab was created via split
// splitLabel: label for this sub-tab ("Alice", "Sub-tab 1", etc.)
// The TabSchema object definition must include:
//   parentTabId: UuidSchema.nullable().optional(),
//   splitMode: z.enum(['item','evenly','by_person','by_amount']).nullable().optional(),
//   splitLabel: z.string().max(50).nullable().optional(),

// Extend PaymentSchema (add 2 new fields)
// isRefund: true for negative refund payment rows
// refundId: links a refund payment row to the refunds table
//   isRefund: z.boolean().default(false),
//   refundId: UuidSchema.nullable().optional(),

// New RefundSchema
export const RefundReasonSchema = z.enum([
  'wrong_order', 'quality_issue', 'customer_complaint', 'billing_error', 'other'
]);

export const RefundItemSchema = z.object({
  id: UuidSchema,
  refundId: UuidSchema,
  orderItemId: UuidSchema,
  qty: z.number().int().min(1),
  amount: z.number().positive(),
  restock: z.boolean(),
  createdAt: TimestampSchema,
});

export const RefundSchema = z.object({
  id: UuidSchema,
  originalPaymentId: UuidSchema,
  reason: RefundReasonSchema,
  amount: z.number().positive(),
  createdBy: UuidSchema,
  createdAt: TimestampSchema,
  items: z.array(RefundItemSchema).default([]),
});

export const RefundCreateSchema = RefundSchema.omit({ id: true, createdAt: true, items: true });
export type Refund = z.infer<typeof RefundSchema>;
export type RefundCreate = z.infer<typeof RefundCreateSchema>;
export type RefundItem = z.infer<typeof RefundItemSchema>;
export type RefundReason = z.infer<typeof RefundReasonSchema>;
```

**Breaking change alert:** `TabStatusSchema` currently is `z.enum(['open', 'closed', 'paid', 'voided'])` [VERIFIED: codebase, line 52]. Adding `'split'` is additive to Zod but the DB ENUM must also be extended. No existing code should break — `switch` statements on `TabStatus` should add a `split` case or fall through to default.

---

## AppErrorCode Extensions Required

Current `AppErrorCode` union [VERIFIED: codebase, result.ts] does not include Phase 6 error codes. Add:

```typescript
| 'PARENT_TAB_PAID'           // Tab already paid; cannot split
| 'ITEM_NOT_IN_PARENT'        // Order item not found in parent tab
| 'ITEM_ASSIGNED_TWICE'       // Item assigned to multiple sub-checks
| 'UNASSIGNED_ITEMS'          // Items not assigned (strict mode)
| 'REFUND_EXCEEDS_ORIGINAL'   // Refund amount > remaining refundable
| 'ITEM_NOT_IN_ORIGINAL_ORDER' // Order item not in original payment's tab
```

---

## RBAC Extension

Current RBAC actions (verified in `src/shared/lib/rbac.ts`): `create_order`, `close_tab`, `void_order`, `view_reports`, `adjust_inventory`, `manage_products`, `manage_staff`, `manage_settings`, `manage_caja`, `transfer_tab`, `delete_tab`, `view_all_shifts`.

Phase 6 should add: `process_refund` (manager+). This is the `requiredAction` passed to `ManagerPinDialog` for the refund flow.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `payments.tab_id UNIQUE` (one payment per tab) | Multiple payments per tab allowed | Phase 1 (D-07, migration 20260424000005) | Split evenly can insert N payments on same tab |
| `tab_status IN ('open','closed','paid','voided')` | Add 'split' | Phase 6 (this phase) | Parent tabs in split state are 'split'; sub-tabs are 'open' until paid |
| No sub-tab concept | Sub-tabs via `parent_tab_id` FK | Phase 6 (this phase) | Sub-tabs are first-class tab rows; reports aggregate under parent |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sub-tabs should NOT appear in the main POS open tab list (`useTabList` must filter `parent_tab_id IS NULL`) | Pitfall 4, Pattern 9 | If sub-tabs do appear, the POS tab list becomes cluttered; bartender sees Alice/Bob instead of the parent tab |
| A2 | The `amount_positive CHECK (amount > 0)` on payments is still active (it was not dropped in any later migration) | Pattern 3 / Pitfall 1 | If already relaxed, the migration step to fix it is a no-op — low risk |
| A3 | `ManagerPinDialog` works with any `StaffAction` string from the RBAC map — adding `'process_refund'` to the RBAC actions map is sufficient | RBAC Extension section | If ManagerPinDialog validates against a closed enum, a new action key type-checks to never — low risk given existing pattern is `requiredAction: StaffAction` as a typed string enum |
| A4 | Phase 4's `deplete_for_order_item` RPC will accept signature `(order_item_id uuid, qty_multiplier integer)` | Pattern 5 (stub) | If Phase 4 uses a different signature, the stub call will fail at EXCEPTION level — but gracefully caught |
| A5 | E2E spec numbers `34` and `35` are unoccupied | E2E Spec Numbering | If spec files `34-*` or `35-*` already exist in a branch, rename |

---

## Open Questions (RESOLVED)

1. **Sub-tab visibility in POS tab list**
   - What we know: Sub-tabs are valid `tabs` rows with `parent_tab_id` set
   - What's unclear: Should sub-tabs appear in the POS "open tabs" panel alongside regular tabs, or only inside the parent tab's sub-checks section?
   - Recommendation: Filter sub-tabs out of the main POS list (`WHERE parent_tab_id IS NULL`). This is the standard UX pattern for sub-checks in restaurant POS systems.
   - RESOLVED: Plan 04 (entities/tab/model/queries.ts) implements `WHERE parent_tab_id IS NULL` filter in useTabList. Sub-tabs are not shown in the POS open-tabs list.

2. **`process_payment` RPC compatibility with sub-tabs**
   - What we know: The existing `process_payment` edge function marks `tab.status = 'paid'`. If a sub-tab goes through `process_payment`, this fires normally.
   - What's unclear: Does `process_payment` have any guards that check tab status ('split' is a new value)?
   - Recommendation: Audit `process_payment` RPC / edge function to ensure `IF v_tab_status IS DISTINCT FROM 'open'::tab_status` does not also need to allow `'open'` status for sub-tabs. Sub-tabs have `status='open'`, so this should be fine.
   - RESOLVED: Sub-tabs have status='open'; process_payment guards check for 'open' only, so sub-tabs pass through without modification. No edge-function change required.

3. **`supabase.types.ts` regeneration**
   - What we know: Docker is unavailable on this machine; types are regenerated against local Docker or manually transcribed.
   - What's unclear: Phase 6 migration produces significant new tables/columns — manual transcription is error-prone.
   - Recommendation: Plan a "types regeneration" task after `supabase db push`. Use the established `supabase as any` cast pattern for all new tables until regeneration is done.
   - RESOLVED: Plan 03 Task 2 manually transcribes new types into supabase.types.ts immediately after db push. All new entity files use `const db = supabase as any` with eslint-disable until transcription is complete.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely code + SQL migration changes. No new external tools, services, or CLIs are introduced beyond what was verified in Phases 1–3 (Supabase CLI, Node, npm).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 + fast-check v4 |
| Config file | `bar-pos/vitest.config.ts` |
| Quick run command | `cd bar-pos && npm run test` |
| Full suite command | `cd bar-pos && npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| S4-01/02 | Schema migrations apply; ENUM has 'split'; refunds tables created | manual DB inspection | `supabase db push` then inspect | ❌ Wave 0 (SQL files) |
| S4-03 | `split_tab_by_item` creates sub-tabs, reassigns order_items, cascades combo children | integration (Vitest) | `npx vitest run src/features/split-tab/` | ❌ Wave 0 |
| S4-04 | `split_tab_evenly` returns correct per_payment_amount + cents_remainder; N client payments sum exactly | unit + property (P9) | `npx vitest run src/shared/lib/split-math.test.ts` | ❌ Wave 0 |
| S4-07 | `process_refund` blocks over-refund; creates correct rows | integration (Vitest) | `npx vitest run src/features/process-refund/` | ❌ Wave 0 |
| S4-08 | Zod schemas parse new fields; reject invalid | unit | `npx vitest run src/shared/lib/domain.test.ts` | ✅ extend |
| S4-14 | Auto-close trigger fires after last sub-tab paid; does not fire on refund rows | integration | DB-level test or E2E T5 in 34-split-bill | ❌ Wave 0 |
| P8 | Conservation: sub-tab totals sum to parent total ± 1 cent | property (fast-check) | `npx vitest run src/shared/lib/split-math.test.ts` | ❌ Wave 0 |
| P9 | Rounding: N-way split; sum of N payments = original exactly | property (fast-check) | same file | ❌ Wave 0 |
| P10 | Refund: refund amount ≤ original; restock produces inverse ledger | property (fast-check) | `npx vitest run src/features/process-refund/refund-math.test.ts` | ❌ Wave 0 |
| S4-18 | Full split bill E2E flow (6 items, 3 modes) | E2E | `npx playwright test e2e/34-split-bill.spec.ts` | ❌ Wave 0 |
| S4-19 | Full refund E2E flow (5 items, restock, over-refund block) | E2E | `npx playwright test e2e/35-refund.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **Per wave merge:** full suite + `npm run test:e2e`
- **Phase gate:** All unit + property tests green; E2E `34-split-bill.spec.ts` and `35-refund.spec.ts` passing before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/shared/lib/split-math.ts` — pure utility for split/rounding logic (P8, P9)
- [ ] `src/shared/lib/split-math.test.ts` — P8 + P9 property tests
- [ ] `src/features/process-refund/refund-math.test.ts` — P10 property test
- [ ] `src/features/split-tab/` — unit tests for mode validation logic
- [ ] `e2e/34-split-bill.spec.ts` — full split bill E2E spec
- [ ] `e2e/35-refund.spec.ts` — full refund E2E spec

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sessions managed by Supabase Auth |
| V3 Session Management | no | Existing Supabase session pattern |
| V4 Access Control | yes | RLS on `refunds` (INSERT: manager+); `ManagerPinDialog` gate for process_refund; RBAC `process_refund` action |
| V5 Input Validation | yes | Zod `RefundSchema`, `RefundItemSchema` validate all input; RPC validates amounts server-side |
| V6 Cryptography | no | No new secrets or crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Over-refund (refund already-refunded amount) | Tampering | RPC checks `sum(existing_refunds) + new_refund ≤ original_payment.amount` |
| Refund a payment you didn't process (cross-tab fraud) | Elevation of privilege | RPC verifies `order_item_id` belongs to payment's tab; manager PIN required |
| Negative payment inserted without `is_refund=true` | Tampering | `CHECK (amount > 0 OR is_refund = true)` on payments; `is_refund` set by RPC only |
| Sub-tab item double-assignment (ITEM_ASSIGNED_TWICE) | Tampering | RPC verifies each `order_item_id` appears only once across all assignments; returns error |
| Bartender creating refunds without manager approval | Elevation of privilege | `ManagerPinDialog` client gate + RLS policy requires `manager+` role on `refunds` INSERT |

---

## Sources

### Primary (HIGH confidence)
- Verified codebase: `bar-pos/supabase/migrations/` — all migration files, schema state confirmed
- Verified codebase: `bar-pos/src/shared/lib/domain.ts` — `TabSchema`, `PaymentSchema`, `TabStatusSchema`, `OrderItemSchema` exact current state
- Verified codebase: `bar-pos/src/shared/lib/result.ts` — `AppErrorCode` union, current list of 23 codes
- Verified codebase: `bar-pos/e2e/` — existing spec files, confirmed next free spec is `34`
- Verified codebase: `bar-pos/src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` — exact props interface
- Verified codebase: `bar-pos/src/entities/tab/model/queries.ts` — tabKeys factory, invalidation patterns
- Verified codebase: `bar-pos/src/widgets/PaymentPane/ui/PaymentPane.tsx` — existing payment flow
- Verified codebase: `bar-pos/src/pages/payments/index.tsx` — current PaymentsPage structure
- Verified codebase: `bar-pos/supabase/migrations/20260425000002_combo_columns.sql` — `parent_order_item_id` on order_items confirmed
- Verified codebase: `node -e "require('lucide-react')"` — `SplitSquareHorizontal: true, ReceiptText: true`
- Locked spec: `.planning/feature-expansion-2026q2/sprints/S4-split-refund.md` — RPC contracts, DoD
- UI spec: `.planning/phases/06-split-bill-refund/06-UI-SPEC.md` — component contracts, copywriting
- Phase research: `.planning/phases/03-ingredient-foundation/03-RESEARCH.md` — established patterns

### Secondary (MEDIUM confidence)
- Property test patterns: verified from `src/entities/tab/model/queries-reports.test.ts` and `src/entities/caja/model/queries.test.ts`

### Tertiary (LOW confidence)
- None — all claims verified against codebase or locked planning documents.

---

## Metadata

**Confidence breakdown:**
- DB schema changes: HIGH — verified against actual migration files and current domain.ts
- RPC design: HIGH — based on verified `add_combo_to_tab` pattern + S4 PRD contracts
- FSD structure: HIGH — verified entity/feature/widget patterns from Phases 1-3
- Pitfalls: HIGH — grounded in verified codebase constraints (CHECK, ENUM, tab_id join)
- Property tests: HIGH — verified fast-check is installed and pattern established in codebase

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable architecture; all dependencies already in-repo)
