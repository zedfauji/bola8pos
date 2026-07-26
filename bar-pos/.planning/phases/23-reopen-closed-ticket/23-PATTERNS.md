# Phase 23: Reopen Closed Ticket - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 11 new/modified
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/<ts1>_payments_status_column.sql` | migration (schema) | CRUD | `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` (column-add style) | role-match |
| `supabase/migrations/<ts2>_tabs_reopen_columns.sql` | migration (schema) | CRUD | `supabase/migrations/20260427000001_split_bill_schema.sql` (adds columns + CHECK to `tabs`) | role-match |
| `supabase/migrations/<ts3>_reopen_tab_rpc.sql` | migration/RPC | CRUD (versioned status-reversal + audit + offsetting insert) | `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (`edit_paid_tab`) | exact |
| `supabase/migrations/<ts4>_fix_payment_sums_exclude_reopened_void.sql` | migration (RPC patch) | CRUD | `supabase/migrations/20260720000001_fix_edit_paid_tab_inventory.sql` (targeted `CREATE OR REPLACE` follow-up fix) | exact |
| `src/features/reopen-tab/model/useReopenTab.ts` | hook (mutation) | request-response | `src/features/edit-paid-tab/model/useEditPaidTab.ts` | exact |
| `src/features/reopen-tab/ui/ReopenTabDialog.tsx` | component | request-response | `src/features/process-refund/ui/RefundSheet.tsx` (simpler: no item overrides, reason-only) | exact |
| `src/features/reopen-tab/index.ts` | barrel | — | `src/features/edit-paid-tab/index.ts` | exact |
| `src/widgets/PaymentPane/ui/PaymentPane.tsx` (modify — add `ReopenTabButton`) | component | request-response | itself, `RefundButton`/`EditTicketButton` (lines 24-66) | exact |
| `src/shared/lib/audit-actions.ts` (modify) | config/enum | — | itself (add `'tab.reopen'`, same pattern as `'tab.edit_paid'` at line 27) | exact |
| `src/shared/lib/rbac.ts` (modify) | config | — | itself (add `'reopen_tab'` to `STAFF_ACTIONS` + `MANAGER_EXTRA`, same as `'edit_paid_tab'` lines 38, 67) | exact |
| `src/shared/lib/rbac.test.ts` (modify) | test/config mirror | — | itself (hand-written `ALLOWED` fixture — Phase 22 Pitfall 7 recurs) | exact |
| `src/shared/lib/domain.ts` (modify — `PaymentSchema` += `status`, `TabSchema` += `reopenCount`/`lastReopenedAt`) | model/schema | — | itself | exact |

No net-new role/data-flow shapes — every file is a direct structural clone of an existing Phase 15/18/22 pattern, except the cap/window check inside the RPC which is genuinely new logic (still same file/role). No "No Analog Found" section needed.

## Pattern Assignments

### `supabase/migrations/<ts1>_payments_status_column.sql` (migration, schema)

**Analog:** column-add + CHECK style used throughout, e.g. `20260707000003_split_payment_columns_and_rpc.sql`

```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'
  CHECK (status IN ('completed', 'reopened_void'));
```

---

### `supabase/migrations/<ts2>_tabs_reopen_columns.sql` (migration, schema)

**Analog:** `supabase/migrations/20260427000001_split_bill_schema.sql` lines 30-34 — the `closed_at_requires_closed_status` CHECK this migration MUST NOT violate later:
```sql
CHECK (
  (closed_at IS NULL AND status IN ('open','split'))
  OR (closed_at IS NOT NULL AND status IN ('closed','paid','voided'))
)
```

New columns:
```sql
ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS reopen_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reopened_at timestamptz;
```

---

### `supabase/migrations/<ts3>_reopen_tab_rpc.sql` (migration/RPC, CRUD)

**Analog:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (`edit_paid_tab`) — copy its exact skeleton: role re-check, `FOR UPDATE` + `p_expected_version` guard, offsetting `caja_entries` insert (free-text `concept`), single combined `tabs` UPDATE, before/after audit write, `EXCEPTION` block re-raising `P0V01`/`P0V02`/`P0A01` and swallowing everything else into `{ok:false, code:'INTERNAL'}`.

**Role re-check** (copy verbatim, same as `edit_paid_tab`):
```sql
SELECT id INTO v_staff_id FROM profiles
WHERE id = auth.uid() AND role IN ('manager', 'admin');
IF NOT FOUND THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required' USING ERRCODE = 'P0A01';
END IF;
```

**Version guard + NEW cap/window check under the SAME lock** (D-02/D-03 — no prior analog for the cap/window logic itself, compose fresh but keep inside this existing lock pattern):
```sql
SELECT version, status, reopen_count, last_reopened_at
INTO v_current, v_status, v_reopen_count, v_last_reopened
FROM tabs WHERE id = p_tab_id FOR UPDATE;

IF v_current IS NULL THEN
  RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
END IF;
IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
  RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
END IF;
IF v_status NOT IN ('closed', 'paid') THEN
  RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_REOPENABLE', 'message', 'Only closed or paid tabs can be reopened');
END IF;
IF v_reopen_count >= 2 THEN
  RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_CAP_EXCEEDED', 'message', 'This tab has already been reopened twice');
END IF;
IF v_last_reopened IS NOT NULL AND NOW() - v_last_reopened > INTERVAL '24 hours' THEN
  RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_WINDOW_EXPIRED', 'message', 'Reopen window has expired');
END IF;
```

**Payment void (D-05 — plain `tab_id` scope, no group-aware branching needed)**:
```sql
UPDATE payments
SET status = 'reopened_void', updated_at = NOW()
WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed';

SELECT COALESCE(SUM(amount), 0) INTO v_voided_total
FROM payments WHERE tab_id = p_tab_id AND status = 'reopened_void';
```

**Offsetting caja entry — reuse `edit_paid_tab`'s exact `concept`-sanitization + `type` sign convention** (this reopen's delta is always an expense — reversing previously-booked income):
```sql
IF v_voided_total <> 0 THEN
  SELECT id INTO v_caja FROM caja_sessions WHERE status = 'open' LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_OPEN_CAJA: an open caja session is required to record a reopen adjustment'
      USING ERRCODE = 'P0A02';
  END IF;
  v_concept := left(format('Reopen tab %s: %s', substr(p_tab_id::text, 1, 8),
    regexp_replace(COALESCE(NULLIF(TRIM(p_reason), ''), 'no reason given'), '[,.()]', '', 'g')), 200);
  INSERT INTO caja_entries (caja_session_id, type, amount, concept, staff_id)
  VALUES (v_caja, 'expense', v_voided_total, v_concept, v_staff_id);
END IF;
```

**Single combined `tabs` UPDATE — MUST clear `closed_at` in the same statement** (Pitfall 1 — the `closed_at_requires_closed_status` CHECK constraint from the `<ts2>` migration above rejects `status='open' AND closed_at IS NOT NULL`):
```sql
UPDATE tabs
SET status = 'open', closed_at = NULL, reopen_count = reopen_count + 1,
    last_reopened_at = NOW(), version = version + 1, updated_at = NOW()
WHERE id = p_tab_id;
```

**Audit write — same shape as `edit_paid_tab`'s `record_audit('tab.edit_paid', ...)`**:
```sql
SELECT to_jsonb(t.*) || jsonb_build_object('reason', p_reason) INTO v_after
FROM tabs t WHERE t.id = p_tab_id;

PERFORM record_audit('tab.reopen', 'tab', p_tab_id, v_before, v_after, 'rpc');

RETURN jsonb_build_object('ok', true, 'voidedPaymentTotal', v_voided_total);
```

**Exception block** (copy `edit_paid_tab`'s exact re-raise discipline, add `P0A02` for the no-open-caja case):
```sql
EXCEPTION
  WHEN sqlstate 'P0V01' THEN RAISE;
  WHEN sqlstate 'P0V02' THEN RAISE;
  WHEN sqlstate 'P0A01' THEN RAISE;
  WHEN sqlstate 'P0A02' THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', 'message', SQLERRM);
```

Full composed skeleton is in `.planning/phases/23-reopen-closed-ticket/23-RESEARCH.md` §"Code Examples" — copy that verbatim as the starting point.

---

### `supabase/migrations/<ts4>_fix_payment_sums_exclude_reopened_void.sql` (migration, RPC patch)

**Analog:** `supabase/migrations/20260720000001_fix_edit_paid_tab_inventory.sql` — same "targeted `CREATE OR REPLACE`, full existing body + one added clause, not a rewrite" discipline.

**Pattern — add `AND p.status IS DISTINCT FROM 'reopened_void'` (or `AND status IS DISTINCT FROM 'reopened_void'` for unaliased queries) to 5 confirmed sites:**

1. `process_payment_atomic` — `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` lines 190-193:
```sql
-- BEFORE
SELECT COALESCE(ROUND(SUM(p.amount), 2), 0) INTO v_paid_line
FROM payments p
WHERE p.tab_id = p_tab_id
  AND p.is_refund = false;

-- AFTER
SELECT COALESCE(ROUND(SUM(p.amount), 2), 0) INTO v_paid_line
FROM payments p
WHERE p.tab_id = p_tab_id
  AND p.is_refund = false
  AND p.status IS DISTINCT FROM 'reopened_void';
```
2. `process_split_payment_atomic` — `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` lines 258-261 — identical `v_paid_line` fix.
3. `get_caja_report` — `supabase/migrations/20260421000004_caja_report_entries.sql` lines 56-64 and 118-137 — add the filter to both the top-level revenue aggregate AND the per-staff `sales_total` subquery.
4. `close_caja_session` — `supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql` lines 140-142 — tip-pooling `SUM(tip_amount)`.
5. `process_refund` — `supabase/migrations/20260708000003_fix_process_refund_audit_log_column.sql` lines 40-41 — original-payment lookup guard:
```sql
-- BEFORE
WHERE id = p_original_payment_id AND is_refund = false

-- AFTER
WHERE id = p_original_payment_id AND is_refund = false AND status IS DISTINCT FROM 'reopened_void'
```
Use `IS DISTINCT FROM`, matching this codebase's existing nullable-comparison-safety convention (`process_split_payment_atomic` line 205: `v_rappi_tab IS DISTINCT FROM v_leg_rappi`).

**This is the phase's highest-risk gap — do not skip.** See RESEARCH.md Pitfalls 3-6.

---

### `src/features/reopen-tab/model/useReopenTab.ts` (hook, request-response)

**Analog:** `src/features/edit-paid-tab/model/useEditPaidTab.ts` (mirrors `src/features/process-refund/model/useProcessRefund.ts`) — copy the full structure, simpler payload (no `orderItemPatches`):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tabKeys } from '@entities/tab';
import { auditKeys } from '@entities/audit-log';
import i18n from '@shared/lib/i18n';
import type { AppErrorCode, Result } from '@shared/lib/result';
import { err, ok } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export interface ReopenTabInput {
  tabId: string;
  expectedVersion: number;
  reason: string;
}

export function useReopenTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReopenTabInput): Promise<Result<unknown>> => {
      const { data, error } = await supabase.rpc('reopen_tab', {
        p_tab_id: input.tabId,
        p_expected_version: input.expectedVersion,
        p_reason: input.reason,
      });
      if (error) {
        if ((error.message as string).includes('REOPEN_CAP_EXCEEDED')) {
          return err({ code: 'VALIDATION_ERROR' as AppErrorCode, message: i18n.t('featOrders:reopenTab.capExceeded') });
        }
        if ((error.message as string).includes('REOPEN_WINDOW_EXPIRED')) {
          return err({ code: 'VALIDATION_ERROR' as AppErrorCode, message: i18n.t('featOrders:reopenTab.windowExpired') });
        }
        if ((error.message as string).includes('NO_OPEN_CAJA')) {
          return err({ code: 'CAJA_CLOSED' as AppErrorCode, message: i18n.t('featOrders:reopenTab.noOpenCaja') });
        }
        if ((error.message as string).includes('AUTH_FORBIDDEN')) {
          return err({ code: 'AUTH_FORBIDDEN' as AppErrorCode, message: i18n.t('featOrders:reopenTab.authForbidden') });
        }
        return err({ code: 'SUPABASE_ERROR' as AppErrorCode, message: error.message as string, raw: error });
      }
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      void qc.invalidateQueries({ queryKey: auditKeys.lists() });
      return ok(data);
    },
  });
}
```

---

### `src/features/reopen-tab/ui/ReopenTabDialog.tsx` (component, request-response)

**Analog:** `src/features/process-refund/ui/RefundSheet.tsx` — simplest of the three PIN-gated dialogs (no item-override `Map`, no numeric quantity/price fields). Structural shell to copy: `Sheet`/`SheetContent`/`SheetHeader`/`SheetFooter` (same imports as `EditPaidTabDialog`, drop the `QuantityControl`/`Checkbox`/item-list machinery entirely, keep only a reason `Textarea` + Confirm button).

**PIN gate wiring** (copy `EditPaidTabDialog`'s pattern verbatim, swap `requiredAction`):
```tsx
<POSButton
  touchSize="xl"
  focusEmphasis="high"
  disabled={reason.trim() === '' || mutation.isPending}
  onClick={() => { setPinOpen(true); }}
>
  {t('reopenTab.requestApproval')}
</POSButton>

<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="reopen_tab"
  onSuccess={() => {
    setPinOpen(false);
    void handleSubmitReopen();
  }}
/>
```

---

### `src/widgets/PaymentPane/ui/PaymentPane.tsx` (modify — add `ReopenTabButton`)

**Analog:** itself — `RefundButton`/`EditTicketButton` in the same file, `src/widgets/PaymentPane/ui/PaymentPane.tsx` lines 19-66 (read in full this session):
```tsx
interface RefundButtonProps {
  payment: Payment;
  onRefund: (paymentId: string) => void;
}

function RefundButton({ payment, onRefund }: RefundButtonProps) {
  const { t } = useTranslation('wPanels');
  const { data: refunds } = useRefundsByPayment(payment.id);
  const refundedTotal = (refunds ?? []).reduce((sum, r) => sum + r.amount, 0);
  const isFullyRefunded = refundedTotal >= payment.amount;

  if (payment.isRefund === true || isFullyRefunded) return null;

  return (
    <POSButton variant="destructive" size="sm" onClick={() => { onRefund(payment.id); }}>
      {t('paymentPane.refund')}
    </POSButton>
  );
}

interface EditTicketButtonProps {
  payment: Payment;
  onEdit: (tabId: string) => void;
}

function EditTicketButton({ payment, onEdit }: EditTicketButtonProps) {
  const { t } = useTranslation('wPanels');
  if (payment.isRefund === true) return null;
  return (
    <POSButton variant="outline" size="sm" onClick={() => { onEdit(payment.tabId); }}>
      {t('paymentPane.editTicket')}
    </POSButton>
  );
}
```

**`ReopenTabButton` to add — mirror this exact shape**, gated on `payment.status !== 'reopened_void'` AND the tab's status being `'closed'`/`'paid'` (needs `tab: Tab` prop, not just `payment`, since the guard reads `tab.status` — `Tab` is already imported in this file at line 14):
```tsx
interface ReopenTabButtonProps {
  tab: Tab;
  payment: Payment;
  onReopen: (tabId: string) => void;
}

function ReopenTabButton({ tab, payment, onReopen }: ReopenTabButtonProps) {
  const { t } = useTranslation('wPanels');
  if (payment.status === 'reopened_void') return null;
  if (tab.status !== 'closed' && tab.status !== 'paid') return null;

  return (
    <POSButton variant="outline" size="sm" onClick={() => { onReopen(tab.id); }}>
      {t('paymentPane.reopenTab')}
    </POSButton>
  );
}
```
Wire alongside the existing `EditPaidTabDialog`/`RefundSheet` state pair already present in this file (lines 6-8 import them; follow the same `useState` + dialog-open pattern for `ReopenTabDialog`).

---

### `src/shared/lib/audit-actions.ts` (config, modify)

**Analog:** itself — `'tab.edit_paid'` insertion at line 27 (read in full, lines 1-40):
```ts
  // Tabs
  'tab.close',
  'tab.transfer',
  'tab.void',
  'tab.split',
  'tab.edit_paid',
  'tab.reopen',   // ADD — Phase 23
```
**CRITICAL ordering (Pitfall 2 from RESEARCH.md, recurrence of Phase 22 Pitfall 1):** edit this file BEFORE the `<ts3>_reopen_tab_rpc.sql` migration lands — `src/shared/lib/__tests__/audit-actions.test.ts` greps migrations and fails CI otherwise. Also add the mirrored const-object entry (same file, further down, matching the `TAB_EDIT_PAID: 'tab.edit_paid'` pattern from 22-PATTERNS.md).

---

### `src/shared/lib/rbac.ts` (config, modify)

**Analog:** itself — `'edit_paid_tab'` insertion at `STAFF_ACTIONS` line 38 and `MANAGER_EXTRA` line 67 (read in full, lines 1-70):
```ts
export const STAFF_ACTIONS = [
  ...
  'view_audit_log',
  'edit_paid_tab',
  'reopen_tab',   // ADD — Phase 23, manager+ (D-04)
] as const;
```
```ts
const MANAGER_EXTRA: ReadonlySet<StaffAction> = new Set([
  ...
  'view_audit_log',
  'edit_paid_tab', // correct a paid tab after the fact — manager+ only
  'reopen_tab', // reopen a closed/paid tab — manager+ only
]);
```

---

### `src/shared/lib/rbac.test.ts` (modify)

**Analog:** itself — hand-written `ALLOWED` mirror fixture (line 44 per RESEARCH.md, Phase 22 Pitfall 7 recurred this exact gap). Add `'reopen_tab'` to the `manager`/`admin` entries in the SAME commit as the `rbac.ts` change, or `npm run test` fails on the fixture-mismatch assertion.

---

### `src/shared/lib/domain.ts` (modify)

**Analog:** itself — `PaymentSchema` (lines 611-640, currently has `isRefund`/`paymentGroupId`/`splitIndex`, no `status`) and `TabSchema` (lines 427-458, currently has `closedAt`/`version`, no `reopenCount`/`lastReopenedAt`). Add:
```ts
// PaymentSchema
status: z.enum(['completed', 'reopened_void']).default('completed'),
```
```ts
// TabSchema
reopenCount: z.number().int().default(0),
lastReopenedAt: z.string().nullable().default(null), // or z.date()-equivalent per existing closedAt convention
```
Match whatever nullable-timestamp convention `closedAt` already uses in this same schema — do not invent a new date-handling convention.

Also update `src/entities/payment/model/queries.ts`'s `mapPaymentRow` (no `status` mapping yet, per RESEARCH.md Sources) to surface the new column.

## Shared Patterns

### Manager PIN gate + server-side role re-check (cross-cutting: dialog + RPC)
**Source:** `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` (same as Phase 22's Shared Patterns entry — unchanged this phase)
**Apply to:** `ReopenTabDialog` (client-side gate, `requiredAction="reopen_tab"`) and the `reopen_tab` RPC (server-side `role IN ('manager','admin')` check — never trust the client gate alone).

### Optimistic-concurrency version guard (RPC + client error mapping)
**Source:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (same pattern, extended with the cap/window check under the same lock)
**Apply to:** `reopen_tab` RPC and `useReopenTab`'s error mapping (component-level `onError`/`handleVersionError()` for `STALE_VERSION`/`NOT_FOUND_VERSIONED`, same as `edit_paid_tab`).

### Offsetting `caja_entries` free-text encoding
**Source:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (concept sanitization: `regexp_replace(...,'[,.()]','','g')`, 200-char `left()` truncation)
**Apply to:** `reopen_tab`'s offsetting entry — continue free-text `concept`, do NOT add `caja_entries.source_tab_id`/`source_type` columns this phase (per CONTEXT.md Claude's Discretion default and RESEARCH.md Open Question 1).

### `Result<T>` / `AppError` mutation pattern
**Source:** `src/features/edit-paid-tab/model/useEditPaidTab.ts` (itself mirroring `src/features/process-refund/model/useProcessRefund.ts`)
**Apply to:** `useReopenTab.ts` — same `err()`/`ok()` wrapping, same `i18n.t()` message resolution, same query-invalidation-on-success shape (`tabKeys.lists()` + `auditKeys.lists()`).

### `IS DISTINCT FROM` nullable-safe status filter
**Source:** `process_split_payment_atomic` line 205 (`v_rappi_tab IS DISTINCT FROM v_leg_rappi`)
**Apply to:** All 5 payment-summing sites patched by `<ts4>_fix_payment_sums_exclude_reopened_void.sql`.

## No Analog Found

None — every file in scope has a direct analog already read this session or fully specified in RESEARCH.md's Code Examples section (the cap/window check inside `reopen_tab` is net-new logic but lives inside an otherwise-analog-matched file/role).

## Metadata

**Analog search scope:** `src/features/edit-paid-tab/`, `src/features/process-refund/`, `src/features/manager-pin-gate/`, `src/widgets/PaymentPane/`, `src/shared/lib/`, `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql`, `supabase/migrations/20260720000001_fix_edit_paid_tab_inventory.sql`, plus RESEARCH.md's already-extracted excerpts (`20260512000002_rpc_versioned_group_a.sql`, `20260707000003_split_payment_columns_and_rpc.sql`, `20260421000004_caja_report_entries.sql`, `20260709000002_close_caja_session_tip_distribution.sql`, `20260708000003_fix_process_refund_audit_log_column.sql`, `20260427000001_split_bill_schema.sql`)
**Files read this session:** `.planning/phases/23-reopen-closed-ticket/23-CONTEXT.md`, `23-RESEARCH.md`, `.planning/phases/22-edit-paid-ticket-history/22-PATTERNS.md`, `src/widgets/PaymentPane/ui/PaymentPane.tsx` (lines 1-70), `src/shared/lib/audit-actions.ts` (lines 1-40), `src/shared/lib/rbac.ts` (lines 1-70)
**Pattern extraction date:** 2026-07-20
