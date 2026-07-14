# Phase 18: Split Payment (Multi-Method) - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260707000001_split_payment_columns_and_rpc.sql` | migration | CRUD (atomic multi-row insert) | `supabase/migrations/20260427000002_split_tab_rpcs.sql` (`split_tab_by_amount`, jsonb-array loop) + `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` (`process_payment_atomic`, version guard) | exact (composite of 2 precedents) |
| `supabase/functions/process-split-payment/index.ts` | route (edge function) | request-response | `supabase/functions/process-payment/index.ts` | exact |
| `src/shared/lib/domain.ts` (extend `PaymentSchema`, add `SplitPaymentLegSchema`) | model | transform | `src/shared/lib/domain.ts` lines 586-615 (`PaymentSchema`) | exact |
| `src/shared/lib/edge-function-contracts.ts` (extend — add split request/success/envelope schemas + `callProcessSplitPayment`) | service | request-response | same file, `ProcessPaymentRequestSchema`/`callProcessPayment` block (lines 135-291) | exact |
| `src/shared/lib/payment-processor.ts` (extend — add `processSplitPayment`) | service | request-response | same file, `processCashPayment`/`processCardPayment` (lines 38-102) | exact |
| `src/shared/lib/result.ts` (extend `AppErrorCode` union if new code needed) | utility | transform | same file, `AppErrorCode` union (lines 165-204 per research) | exact |
| `src/widgets/PaymentModal/ui/PaymentForm.tsx` (extend — `isSplitMode` toggle + row list + receipt queue) | component | request-response | itself (single-payment state/submit block, lines 89-306) for the toggle/submit branch pattern; `src/features/manage-recipe/ui/RecipeEditorTab.tsx` (lines 1-97) for the add/remove-row list mechanics | exact (self) / role-match (row-list UI) |
| `src/entities/payment/model/*.integration.test.ts` (new) | test | CRUD | none existing at this path — follow Phase 17-03 verification-query convention (per RESEARCH.md) | no analog (new test dir) |
| `e2e/4X-split-payment.spec.ts` (new) | test | request-response | `e2e/05-payments.spec.ts` | role-match |

## Pattern Assignments

### `supabase/migrations/20260707000001_split_payment_columns_and_rpc.sql` (migration)

**Analog 1 — column addition:** `supabase/migrations/20260421000001_payments_discount_columns.sql` (additive `ALTER TABLE` precedent)
```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_group_id UUID,
  ADD COLUMN IF NOT EXISTS split_index SMALLINT CHECK (split_index >= 0 AND split_index <= 3);

CREATE INDEX IF NOT EXISTS idx_payments_payment_group_id
  ON payments(payment_group_id) WHERE payment_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_group_split_unique
  ON payments(payment_group_id, split_index) WHERE payment_group_id IS NOT NULL;
```

**Analog 2 — jsonb-array loop RPC pattern:** `supabase/migrations/20260427000002_split_tab_rpcs.sql` lines 261-283 (`split_tab_by_amount`)
```sql
CREATE OR REPLACE FUNCTION split_tab_by_amount(
  p_parent_tab_id uuid,
  p_amounts       jsonb   -- [{sub_tab_label: text, amount: numeric}, ...]
) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_amount_row jsonb;
BEGIN
  -- validate sum
  SELECT SUM((row_data->>'amount')::numeric) INTO v_amounts_sum
  FROM jsonb_array_elements(p_amounts) AS row_data;
  IF ABS(v_amounts_sum - v_total) > 0.01 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: amounts sum % does not match tab total % (±0.01 allowed)', v_amounts_sum, v_total;
  END IF;

  FOR v_amount_row IN SELECT * FROM jsonb_array_elements(p_amounts) LOOP
    -- per-row INSERT logic, using v_amount_row->>'field'
  END LOOP;
END;
$$;
```
Apply this shape to `p_legs jsonb` in the new RPC — validate `1 <= jsonb_array_length(p_legs) <= 4` and `ABS(SUM(leg.amount) - p_expected_total) <= 0.01` before the loop, then `FOR i, v_leg_row IN ... LOOP INSERT INTO payments (..., payment_group_id, split_index) VALUES (..., v_group_id, i) END LOOP`.

**Analog 3 — full current `process_payment_atomic` body to copy the version guard, idempotency, and tab-close logic from:** `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` lines 44-213

Idempotency check (adapt to per-leg derived keys per RESEARCH.md Pattern 3 — `p_idempotency_key || '-leg' || i`, sentinel lookup on `-leg0`):
```sql
SELECT id, tab_id INTO v_existing_id, v_existing_tab
FROM payments
WHERE idempotency_key = p_idempotency_key
LIMIT 1;

IF v_existing_id IS NOT NULL THEN
  IF v_existing_tab IS DISTINCT FROM p_tab_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_MISMATCH', 'message', 'Idempotency key belongs to another tab');
  END IF;
  RETURN jsonb_build_object('ok', true, 'idempotent', true, 'paymentId', v_existing_id);
END IF;
```

Version guard — copy verbatim, do not modify the shape:
```sql
SELECT status, rappi_order_id, version
INTO v_tab_status, v_rappi_tab, v_current
FROM tabs
WHERE id = p_tab_id
FOR UPDATE;

IF NOT FOUND THEN
  RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
END IF;

IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
  RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
END IF;
```

Tab-close logic — copy verbatim, this is the "sum of all non-refund payments >= item subtotal" logic that already supports multi-row inserts with zero changes:
```sql
SELECT COALESCE(ROUND(SUM(oi.unit_price * oi.quantity), 2), 0) INTO v_owed
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.tab_id = p_tab_id
  AND oi.parent_order_item_id IS NULL;

SELECT COALESCE(ROUND(SUM(p.amount), 2), 0) INTO v_paid_line
FROM payments p
WHERE p.tab_id = p_tab_id
  AND p.is_refund = false;

IF v_paid_line + 0.0001 >= v_owed THEN
  UPDATE tabs
  SET status = 'paid'::tab_status, closed_at = NOW(), updated_at = NOW(), version = version + 1
  WHERE id = p_tab_id AND status = 'open'::tab_status;
  GET DIAGNOSTICS v_tab_updated = ROW_COUNT;
  IF v_tab_updated = 0 THEN
    DELETE FROM payments WHERE id = v_payment_id;  -- adapt: delete ALL leg rows for the group on this race
    RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_OPEN', 'message', 'Tab is not open or was already closed');
  END IF;
END IF;
```

**Audit wiring pattern** (`supabase/migrations/20260703000001_record_audit_terminal_id.sql`):
```sql
PERFORM record_audit(
  'payment.process_split',
  'payment',
  v_payment_group_id,
  NULL,
  jsonb_build_object('paymentIds', v_payment_ids, 'legCount', jsonb_array_length(p_legs)),
  'rpc'
);
```

---

### `supabase/functions/process-split-payment/index.ts` (route, request-response)

**Analog:** `supabase/functions/process-payment/index.ts` (full file, 314 lines) — mirror structurally end to end.

**Imports pattern** (lines 1-3):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
```

**Request Zod schema pattern** (lines 5-38) — replace flat fields with a `legs: z.array(legSchema).min(1).max(4)` and keep `superRefine` for per-method-per-leg field rules (cash requires tenderedAmount, rappi requires rappiOrderId).

**Auth/JWT verification pattern** (lines 90-120) — copy verbatim, including the ES256 workaround comment:
```typescript
// admin.auth.getUser() in supabase-js@2.49.1 fails with ES256-signed tokens
// ("Unsupported JWT algorithm ES256") ... The Auth REST API handles ES256 correctly.
const token = authHeader.slice(7);
const authVerifyResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
});
if (!authVerifyResp.ok) {
  return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }, 401);
}
const authUser = await authVerifyResp.json() as { id: string };
const admin = createClient(supabaseUrl, serviceRoleKey);
```

**RPC call pattern** (lines 147-157) — swap to `process_split_payment_atomic` with `p_legs` array param:
```typescript
const { data: rpcData, error: rpcError } = await admin.rpc('process_split_payment_atomic', {
  p_tab_id: body.tabId,
  p_staff_id: authUser.id,
  p_legs: body.legs,
  p_expected_total: body.expectedTotal,
  p_idempotency_key: body.idempotencyKey,
});
```

**Error status mapping pattern** (lines 60-79) — reuse `statusForCode` shape, extend switch with any new split codes (or keep them all under `VALIDATION_ERROR`/409 per RESEARCH.md Open Question #2 recommendation).

**Receipt assembly pattern** (lines 176-306) — loop this exact block **once per leg's `paymentId`** (items/pool-charges query only needs to run once per tab, not once per leg — reuse the `items`/`poolRows` computation across all legs, only `paymentRow`/`tendered`/`changeAmount`/`receiptNumber` differ per leg). Build a `receipts: ReceiptData[]` array and return `{ success: true, paymentGroupId, paymentIds, receipts }`.

---

### `src/shared/lib/domain.ts` (model, extend `PaymentSchema`)

**Analog:** same file, `PaymentSchema` (lines 586-615)
```typescript
export const PaymentSchema = z.object({
  id: UuidSchema,
  tabId: UuidSchema,
  amount: MoneySchema,
  tipAmount: MoneySchema,
  method: PaymentMethodSchema,
  // ...
  discountScope: DiscountScopeSchema.optional(),
  discountType: DiscountTypeSchema.optional(),
  discountValue: z.number().nonnegative().optional(),
  discountAmount: MoneySchema.optional(),
  isRefund: z.boolean().default(false),
  refundId: UuidSchema.nullable().optional(),
});
```
Add (following the exact `.nullable().optional()` idiom already used for `refundId`/`referenceNumber` — never bare `?:` per `exactOptionalPropertyTypes`):
```typescript
paymentGroupId: UuidSchema.nullable().optional(),
splitIndex: z.number().int().min(0).max(3).nullable().optional(),
```
New `SplitPaymentLegSchema` should follow `PaymentCreateSchema`'s `.omit()` composition style (line 609-612) rather than a hand-written interface.

---

### `src/shared/lib/edge-function-contracts.ts` (service, request-response)

**Analog:** same file — `ProcessPaymentRequestSchema` / `ProcessPaymentSuccessSchema` / `ProcessPaymentEnvelopeSchema` / `callProcessPayment` (lines 135-291), plus `mapProcessPaymentEdgeError` (lines 200-223).

**Request schema + superRefine pattern** (lines 135-172):
```typescript
export const ProcessPaymentRequestSchema = z
  .object({
    tabId: UuidSchema,
    amount: MoneySchema,
    // ...
  })
  .superRefine((data, ctx) => {
    if (data.method === 'cash' && data.tenderedAmount == null) {
      ctx.addIssue({ code: 'custom', message: 'tenderedAmount is required for cash', path: ['tenderedAmount'] });
    }
  });
```
For the split request, wrap this same per-leg superRefine logic inside `z.array(SplitPaymentLegRequestSchema).min(1).max(4)` at the top level, plus a top-level check that legs sum to `expectedTotal` (client-side pre-check; RPC re-validates authoritatively).

**Success/envelope schema pattern** (lines 182-198) — same shape but `paymentId` → `paymentIds: z.array(UuidSchema)`, `receiptData` → `receipts: z.array(ReceiptDataSchema)`, add `paymentGroupId: UuidSchema`.

**Error mapper pattern** (lines 200-223) — copy `mapProcessPaymentEdgeError` verbatim as `mapProcessSplitPaymentEdgeError`, extend the `case` list only if new split-specific codes are introduced (RESEARCH.md recommends reusing `VALIDATION_ERROR` for all split failures — zero new cases needed in the common case).

**`callProcessPayment` fetch pattern** (lines 230-291) — copy verbatim structure, swap the endpoint:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/process-split-payment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    apikey: supabaseAnonKey,
  },
  body: JSON.stringify(validatedRequest),
});
```
Auth-token guard (lines 240-243) — copy verbatim:
```typescript
const accessToken = getCachedAccessToken();
if (!accessToken) {
  return err({ code: 'AUTH_REQUIRED', message: 'Not authenticated' });
}
```

---

### `src/shared/lib/payment-processor.ts` (service, request-response)

**Analog:** same file — `processCashPayment` (lines 38-70), `processCardPayment` (lines 72-102).
```typescript
export async function processSplitPayment(
  tabId: string,
  legs: SplitPaymentLegInput[],
  expectedTotal: number,
  discountInfo?: DiscountInfo
): Promise<Result<SplitPaymentResult, AppError>> {
  const idempotencyKey = generateIdempotencyKey('payment_split');
  const result = await callProcessSplitPayment({
    tabId,
    legs,
    expectedTotal,
    idempotencyKey,
    discountScope: discountInfo?.scope,
    discountType: discountInfo?.type,
    discountValue: discountInfo?.value,
    discountAmount: discountInfo?.amount,
  });
  if (!result.ok) {
    return result;
  }
  return ok({ paymentGroupId: result.data.paymentGroupId, paymentIds: result.data.paymentIds, receipts: result.data.receipts });
}
```
Follows the exact `generateIdempotencyKey(prefix)` → `callProcess*` → `if (!result.ok) return result;` → `ok({...})` idiom used by all three existing wrappers. Use prefix `'payment_split'`.

---

### `src/widgets/PaymentModal/ui/PaymentForm.tsx` (component, request-response)

**Analog A (self) — submit/side-effect branch to extend:** same file, `handlePrimary` (lines 248-286). Cash-drawer/print loop must NOT be copied verbatim per-leg (see Pitfall 4 in RESEARCH.md / UI-SPEC interaction contract #8) — open drawer once if any leg is cash, print once per leg:
```typescript
// Split-mode adaptation of the existing pattern (lines 271-280):
const anyCash = legs.some(l => l.method === 'cash');
if (anyCash) {
  const drawer = await openCashDrawer();
  if (!drawer.ok) logHardwareFail('cash_drawer.failed', drawer.error.message);
}
for (const receipt of receipts) {
  const printed = await printReceipt(receipt);
  if (!printed.ok) logHardwareFail('printer.receipt.failed', printed.error.message);
}
```

**Analog A — receipt-queue rendering pattern to extend** (lines 295-306):
```tsx
if (step === 'receipt' && receiptData) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
      <ReceiptPreview
        receipt={receiptData}
        onDone={() => { onClose?.(); }}
      />
    </div>
  );
}
```
Split-mode version: track `receiptQueue: ReceiptData[]` + `receiptIndex: number`; `onDone` advances `receiptIndex + 1` until exhausted, then calls `onClose?.()` — do not fork `ReceiptPreview` itself (UI-SPEC interaction contract #7).

**Analog A — submit-gating (`canSubmit`) pattern** (lines 187-192):
```typescript
const canSubmitCash = tenderedAmount >= runningTotal && runningTotal > 0;
const canSubmitCard = effectiveCardAmount > 0;
const canSubmit =
  (method !== 'cash' || canSubmitCash) &&
  (method !== 'card' || canSubmitCard);
```
Split-mode version extends this to: `2 <= rows.length <= 4 && rows.every(r => r.amount > 0) && Math.abs(rows.reduce((s,r)=>s+r.amount,0) - subtotalWithTax) <= 0.01 && rows.every(perRowMethodValidity)`.

**Analog A — discount/tax-computed-once `useMemo` chain** (lines 164-172) — reuse unchanged; split rows must NOT recompute discount/tax per row (D-04):
```typescript
const discountBase = useMemo(
  () => getDiscountBase(itemsSubtotal, poolChargesTotal, discountScope),
  [itemsSubtotal, poolChargesTotal, discountScope]
);
const discountAmount = useMemo(
  () => calculateDiscountAmount(discountBase, discountType, discountValue),
  [discountBase, discountType, discountValue]
);
```

**Analog B — add/remove-row list mechanics:** `src/features/manage-recipe/ui/RecipeEditorTab.tsx` lines 1-97 (`useReducer` + row-array pattern). This is the pattern for the split-row list state machine (add row, remove row, update field per row), NOT for money math:
```typescript
type EditorAction =
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'SET_QTY'; rowId: string; value: string };

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ROW':
      return { ...state, rows: [...state.rows, { id: nextRowId(), ... }], isDirty: true };
    case 'REMOVE_ROW':
      return { ...state, rows: state.rows.filter(r => r.id !== action.rowId), isDirty: true };
    // ...
  }
}
```
Adapt field names to `{ id, method, amount, tip, tenderedAmount, cardReference }` per UI-SPEC row shape; cap `ADD_ROW` at 4 rows and floor `REMOVE_ROW` at 2 rows per D-02 / UI-SPEC interaction contract #4.

**Method-selector button group pattern** (lines ~505-546, single-payment method buttons) — reuse per row at `touchSize="large"` instead of `"xl"` per UI-SPEC:
```tsx
<POSButton
  variant={method === 'cash' ? 'default' : 'outline'}
  ...
/>
{method === 'cash' && (
  <MoneyInput label="Amount tendered" ... />
)}
```

---

## Shared Patterns

### Result<T> / AppError wrapping
**Source:** `src/shared/lib/payment-processor.ts` (all three existing functions), `src/shared/lib/result.ts`
**Apply to:** `processSplitPayment`, `callProcessSplitPayment`
```typescript
if (!result.ok) {
  return result;
}
return ok({ ... });
```

### Edge function auth verification (ES256 workaround)
**Source:** `supabase/functions/process-payment/index.ts` lines 103-120
**Apply to:** `supabase/functions/process-split-payment/index.ts` — copy verbatim, do not attempt `admin.auth.getUser()`.

### Postgres optimistic-concurrency version guard (Phase 15 protocol)
**Source:** `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` lines 101-115
**Apply to:** `process_split_payment_atomic` — mandatory; re-raise `P0V01`/`P0V02` in the `EXCEPTION` block, do not swallow into `ok=false`.

### Idempotency-key resubmission detection (adapted for multi-row)
**Source:** `process_payment_atomic` lines 89-99 (single-row original) + RESEARCH.md Pattern 3 (multi-row adaptation via `-leg{i}` suffix)
**Apply to:** `process_split_payment_atomic` — single caller-supplied key, per-row derived storage keys, sentinel lookup on `-leg0`.

### Discount/tax computed once, trusted from client
**Source:** `process_payment_atomic` (no `AMOUNT_MISMATCH` server recompute, per `20260421000001_payments_discount_columns.sql` comment) + `PaymentForm.tsx` `useMemo` chain (lines 164-172)
**Apply to:** `process_split_payment_atomic` (validate `Σ(leg.amount) == p_expected_total` only, do not re-derive from `order_items`) and `PaymentForm.tsx` split-mode rows (discount/tax computed once at the top, not per row — D-04).

### `exactOptionalPropertyTypes` idiom for new nullable fields
**Source:** `src/shared/lib/domain.ts` `PaymentSchema.refundId` / `referenceNumber` (`.nullable().optional()`)
**Apply to:** `PaymentSchema.paymentGroupId`, `PaymentSchema.splitIndex`, and any new mutation input types — never bare `field?: T`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/entities/payment/model/*.integration.test.ts` | test | CRUD | No `entities/payment/model/` integration-test directory exists yet; follow the Phase 17-03 live-Supabase verification-query convention referenced in RESEARCH.md (query `information_schema.columns` / `to_regclass`) rather than copying a specific file — no direct precedent file to cite. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/functions/process-payment/`, `src/shared/lib/`, `src/widgets/PaymentModal/ui/`, `src/features/manage-recipe/ui/`, `src/features/split-tab/model/` (reviewed as anti-pattern reference only)
**Files scanned:** 12 (read in full or targeted sections)
**Pattern extraction date:** 2026-07-07
