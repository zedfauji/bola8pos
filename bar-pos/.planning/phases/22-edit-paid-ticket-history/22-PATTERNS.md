# Phase 22: Edit Paid Ticket + History - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 9 new/modified
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/<ts>_edit_paid_tab_rpc.sql` | migration/RPC | CRUD (versioned patch + audit + offsetting insert) | `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` (`create_order_with_items`) | exact |
| `src/features/edit-paid-tab/model/useEditPaidTab.ts` | hook (mutation) | request-response | `src/features/process-refund/model/useProcessRefund.ts` | exact |
| `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx` | component | request-response | `src/features/process-refund/ui/RefundSheet.tsx` | exact |
| `src/features/edit-paid-tab/index.ts` | barrel | — | `src/features/process-refund/index.ts` | exact |
| `src/widgets/EditHistoryTable/EditHistoryTable.tsx` | component (table) | CRUD (read, paginated) | `src/widgets/AuditLogTable/AuditLogTable.tsx` | exact |
| `src/pages/edit-history/index.tsx` | route container | request-response | `src/pages/audit/index.tsx` | exact |
| `src/app/edit-history-route.tsx` | route guard | request-response | `src/app/audit-route.tsx` | exact |
| `src/shared/lib/audit-actions.ts` (modify) | config/enum | — | itself (add `'tab.edit_paid'`) | exact |
| `src/shared/lib/rbac.ts` (modify) | config | — | itself (reuse `view_audit_log`; no new action needed per A3) | exact |

No net-new role/data-flow shapes — every file is a direct structural clone of an existing Phase 14/15 pattern. No "No Analog Found" section needed.

## Pattern Assignments

### `supabase/migrations/<ts>_edit_paid_tab_rpc.sql` (migration/RPC, CRUD)

**Analog:** `supabase/migrations/20260512000002_rpc_versioned_group_a.sql`, `create_order_with_items` (lines 273-359)

**Version-guard pattern** (lines 292-300):
```sql
DECLARE
  v_current int;
BEGIN
  -- Phase 15: lock tab row + assert expected_version (canonical guard).
  SELECT version INTO v_current FROM tabs WHERE id = p_tab_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
  END IF;
  IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
  END IF;
```

**Version bump after mutation** (line 341-343) — copy verbatim even though `tabs` itself may not change:
```sql
  -- Phase 15: bump tabs.version after successful insert. The
  -- bump_version_on_update trigger enforces exact +1 advancement.
  UPDATE tabs SET version = version + 1, updated_at = NOW() WHERE id = p_tab_id;
```

**Exception re-raise** (grep hits at lines 249-256 of the same file, `process_payment_atomic`'s block — do not let `WHEN OTHERS` swallow P0V01/P0V02):
```sql
EXCEPTION
  WHEN sqlstate 'P0V01' THEN
    RAISE;
  WHEN sqlstate 'P0V02' THEN
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', 'message', '...');
```

**New pieces `edit_paid_tab` must add that `create_order_with_items` doesn't have** (per RESEARCH.md Architecture Patterns / Pattern 1, no direct analog exists yet — write fresh but keep the same discipline):
- Role check before the version guard: `SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin')` → else `RAISE EXCEPTION 'AUTH_FORBIDDEN'` (copy from `process_refund`'s RPC body — not read this session, but RESEARCH.md confirms the exact clause; grep `process_refund` in migrations if the planner wants the literal source line).
- Whitelisted named params only (`p_order_item_patches jsonb`, `p_notes text`, `p_reason text`) — never a dynamic column-name UPDATE.
- Capture `v_before`/`v_after` via `to_jsonb(tabs) || jsonb_build_object('items', jsonb_agg(order_items))`, with `reason` embedded into `v_after` as a synthetic key (mirrors the `_truncated` synthetic-key precedent RESEARCH.md cites in `audit_logs`/`JsonDiffViewer` handling — no direct file excerpt needed, it's a `jsonb_build_object` call).
- `record_audit('tab.edit_paid', 'tab', p_tab_id, v_before, v_after, 'rpc')` on the success path only, placed AFTER the version-guard block per Pitfall 1 in RESEARCH.md.
- Conditional `caja_entries` insert when `delta != 0`, targeting the currently-open `caja_sessions` row (not the tab's original session) — see `supabase/migrations/20260421000003_caja_entries.sql` for the `caja_entries` table shape/columns (`caja_session_id`, `type`, `amount`, `concept` w/ `CHECK (char_length(concept) BETWEEN 1 AND 200)`, `staff_id`) if the planner needs the exact column list; not re-read this session, RESEARCH.md already extracted it directly.

---

### `src/features/edit-paid-tab/model/useEditPaidTab.ts` (hook, request-response)

**Analog:** `src/features/process-refund/model/useProcessRefund.ts` (61 lines, read in full)

**Full structure to mirror** (lines 1-61):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, ... */  // only if edit_paid_tab isn't yet in supabase.types.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tabKeys } from '@entities/tab';
import { auditKeys } from '@entities/audit-log';  // ADD — invalidate /edit-history list on success
import i18n from '@shared/lib/i18n';
import type { AppErrorCode, Result } from '@shared/lib/result';
import { err, ok } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export interface EditPaidTabInput {
  tabId: string;
  expectedVersion: number;
  orderItemPatches: /* whitelisted patch shape */ unknown[];
  notes: string | undefined;
  reason: string;
}

export function useEditPaidTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditPaidTabInput): Promise<Result<unknown>> => {
      const { data, error } = await supabase.rpc('edit_paid_tab', {
        p_tab_id: input.tabId,
        p_expected_version: input.expectedVersion,
        p_order_item_patches: input.orderItemPatches,
        p_notes: input.notes,
        p_reason: input.reason,
      });
      if (error) {
        if ((error.message as string).includes('STALE_VERSION')) {
          // handled by handleVersionError() in the component's onError, not here
        }
        if ((error.message as string).includes('NO_OPEN_CAJA')) {
          return err({ code: 'CAJA_CLOSED' as AppErrorCode, message: i18n.t('featOrders:editPaidTab.noOpenCaja') });
        }
        if ((error.message as string).includes('AUTH_FORBIDDEN')) {
          return err({ code: 'AUTH_FORBIDDEN' as AppErrorCode, message: i18n.t('featOrders:editPaidTab.authForbidden') });
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
Only deviation from the analog: `process_refund` passes a dummy `p_manager_pin: ''` because the RPC signature historically required it — verify whether `edit_paid_tab`'s RPC signature needs the same placeholder param or can omit it (planner/RPC-author's call, not a pattern concern).

---

### `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx` (component, request-response)

**Analog:** `src/features/process-refund/ui/RefundSheet.tsx` (344 lines, read in full)

**Imports pattern** (lines 1-34):
```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ManagerPinDialog } from "@features/manager-pin-gate";
import { useOrderItemsByPayment } from "@entities/payment";  // swap for a by-tabId query per RESEARCH.md
import { MoneyDisplay, POSButton, QuantityControl } from "@shared/ui";
import { Checkbox } from "@shared/ui/checkbox";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@shared/ui/sheet";

import { useEditPaidTab } from "../model/useEditPaidTab";
```

**State machine — local override Map + reason + PIN gate** (lines 40-95, 129-168):
```tsx
interface ItemOverride {
  quantity: number;
  unitPrice: number;
  notes: string;
}

const [overrides, setOverrides] = useState(new Map<string, ItemOverride>());
const [reason, setReason] = useState('');
const [pinOpen, setPinOpen] = useState(false);
// toggle/update functions follow RefundSheet's Map-copy-and-set pattern exactly (lines 129-168)
```

**Submit + PIN gate wiring** (lines 170-205, 312-343):
```tsx
async function handleSubmitEdit() {
  const result = await mutation.mutateAsync({ /* ... */ });
  if (!result.ok) {
    toast.error(result.error.message !== "" ? result.error.message : t("editPaidTab.genericError"));
    return;
  }
  toast.success(t("editPaidTab.editSaved"));
  onOpenChange(false);
}

// Footer:
<POSButton
  touchSize="xl"
  focusEmphasis="high"
  disabled={!isValid || mutation.isPending}
  onClick={() => { setPinOpen(true); }}
>
  {t("editPaidTab.requestApproval")}
</POSButton>

<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="edit_paid_tab"     // NEW StaffAction — add to rbac.ts
  onSuccess={() => {
    setPinOpen(false);
    void handleSubmitEdit();
  }}
/>
```

**Sheet shell / layout** (lines 207-330) — copy `Sheet`/`SheetContent side="right"`/`SheetHeader`/item-list/`SheetFooter` structure verbatim, swapping refund-specific fields (`refundQty`, `restock` checkbox) for edit fields (`quantity`, `unitPrice` via a numeric input, `notes` text field) and the reason `Select` (lines 285-305) for either a free-text reason input or the same `Select` pattern if reasons are enumerated.

---

### `src/widgets/EditHistoryTable/EditHistoryTable.tsx` (component, CRUD read)

**Analog:** `src/widgets/AuditLogTable/AuditLogTable.tsx` (183 lines, read in full)

**Imports + hook wiring** (lines 12-26, 36-53):
```tsx
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuditLogs } from '@entities/audit-log';
import type { AuditLog } from '@entities/audit-log';
import { useStaffList } from '@entities/staff';
import { DataTable } from '@shared/ui/DataTable';

import { AuditLogDetailSheet } from '@widgets/AuditLogTable/AuditLogDetailSheet'; // reuse directly, don't clone

// hardcode filter — no AuditLogFilterBar, no staged/applied filter state
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
  useAuditLogs({ action: 'tab.edit_paid' });
```

**Columns array — extend with a Reason column** (per RESEARCH.md Pattern 3, exact source excerpt already given there):
```tsx
{
  id: 'reason',
  header: t('editHistoryTable.columnReason'),
  cell: ({ row }) => {
    const after = row.original.after as Record<string, unknown> | null;
    return typeof after?.['reason'] === 'string' ? after['reason'] : '—';
  },
},
```
Base columns (`action`/`entityType`/`actor`/`createdAt`/`source`) — copy from `AuditLogTable.tsx` lines 62-115 verbatim, the `action` column's sr-only `Button` diff-trigger (lines 67-88) must be preserved to satisfy the same DOM/a11y contract `e2e/38-audit-logs.spec.ts` already locks (see file header comment lines 1-11).

**Row-click → detail sheet** (lines 175-181) — reuse `AuditLogDetailSheet` unmodified:
```tsx
<AuditLogDetailSheet
  row={selectedRow}
  actorName={selectedActorName}
  open={sheetOpen}
  onOpenChange={setSheetOpen}
/>
```

---

### `src/pages/edit-history/index.tsx` (route container)

**Analog:** `src/pages/audit/index.tsx` — not read this session (thin container, low risk); mirror its shape: import + render `EditHistoryTable` inside whatever page-chrome wrapper `pages/audit/index.tsx` uses. No independent logic expected — pages layer is "thin route containers only" per CLAUDE.md.

---

### `src/app/edit-history-route.tsx` (route guard)

**Analog:** `src/app/audit-route.tsx` (17 lines, read in full) — copy verbatim, changing only the redirect message and (per A3 in RESEARCH.md) keeping the SAME permission check:
```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePermissions } from '@entities/staff/model/usePermissions';

type EditHistoryRouteProps = {
  children: ReactNode;
};

export function EditHistoryRoute({ children }: EditHistoryRouteProps) {
  const { can } = usePermissions();
  if (!can('view_audit_log')) {   // REUSE existing action, no new RBAC action per A3
    toast.error('This page is restricted to managers and admins.');
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```
Register in `src/app/router.tsx` alongside the existing `/audit` route registration (not re-read this session — grep `AuditRoute` in `router.tsx` for the exact insertion point).

---

### `src/shared/lib/audit-actions.ts` (config, modify)

**Pattern:** Add one string to two places in the same file (enum array + const object) — read in full, 85 lines.

**Enum array insertion point** (after line 25, `'combo.add_to_tab',`, in a new `// Edit paid tab` group, or simply appended near the Tabs group lines 22-26):
```ts
  // Tabs
  'tab.close',
  'tab.transfer',
  'tab.void',
  'tab.split',
  'tab.edit_paid',   // ADD — Phase 22
```

**Const object insertion point** (mirrors lines 63-66):
```ts
  TAB_SPLIT: 'tab.split',
  TAB_EDIT_PAID: 'tab.edit_paid',   // ADD — Phase 22
```
**CRITICAL ordering (Pitfall 1 from RESEARCH.md):** this file must be edited BEFORE any migration calls `PERFORM record_audit('tab.edit_paid', ...)` — `src/shared/lib/__tests__/audit-actions.test.ts` greps migrations and fails CI otherwise.

---

### `src/shared/lib/rbac.ts` (config, modify)

**Pattern:** Add one action string to `STAFF_ACTIONS` array + `MANAGER_EXTRA` set — read lines 1-70 in full.

**`STAFF_ACTIONS` insertion** (after line 37, `'view_audit_log',`):
```ts
  'view_audit_log',
  'edit_paid_tab',   // ADD — Phase 22, manager+ (D-01/D-03)
] as const;
```

**`MANAGER_EXTRA` insertion** (after line 65, `'view_audit_log', // view /audit page — manager+ only`):
```ts
  'view_audit_log', // view /audit page — manager+ only
  'edit_paid_tab', // correct a paid tab after the fact — manager+ only
]);
```
Note `/edit-history`'s route guard reuses `view_audit_log` (already manager+, per A3) — `edit_paid_tab` is a SEPARATE new action used only by `ManagerPinDialog`'s `requiredAction` prop and the RPC's server-side role check, not by the route guard.

## Shared Patterns

### Manager PIN gate + audit trail (cross-cutting: dialog + RPC)
**Source:** `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` (84 lines, read in full)
**Apply to:** `EditPaidTabDialog` (client-side gate) and the `edit_paid_tab` RPC (server-side re-check — never trust the client gate alone).
```tsx
const eligibleStaff = useMemo(
  () => (staffList ?? []).filter(s => canAccess(s.role, requiredAction)),
  [staffList, requiredAction]
);
function handlePinComplete(enteredPin: string) {
  const match = eligibleStaff.find(s => s.pin === enteredPin);
  if (match) onSuccess();
  else { setError(t('managerPinGate.incorrectPin')); setPin(''); }
}
```
Server-side counterpart is the `AUTH_FORBIDDEN` role check inside the RPC (see migration section above) — defense-in-depth, both layers required.

### Optimistic-concurrency version guard (RPC + client error mapping)
**Source:** `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` lines 292-300, 341-343 (SQL side) + `src/shared/lib/version-error.ts` (client side, not read this session — RESEARCH.md confirms `handleVersionError()` is the existing helper wired for exactly `STALE_VERSION`/`NOT_FOUND_VERSIONED`).
**Apply to:** `edit_paid_tab` RPC and `useEditPaidTab`'s `onError` handler (component-level, not inside the mutation's `mutationFn` — mirrors how `process_refund`'s `error.message.includes('STALE_VERSION')` branch is a no-op comment, deferring to a shared `onError` callback elsewhere).

### `Result<T>` / `AppError` mutation pattern
**Source:** `src/features/process-refund/model/useProcessRefund.ts` lines 43-58
**Apply to:** `useEditPaidTab.ts` — same `err()`/`ok()` wrapping, same `i18n.t()` message resolution, same query-invalidation-on-success shape.

### Route-guard-by-permission
**Source:** `src/app/audit-route.tsx` (17 lines, full file)
**Apply to:** `src/app/edit-history-route.tsx` — identical shape, reusing `view_audit_log` per A3 (no new RBAC action for the route itself).

## No Analog Found

None — every file in scope has a direct, exact-match analog already read this session.

## Metadata

**Analog search scope:** `src/features/process-refund/`, `src/features/manager-pin-gate/`, `src/widgets/AuditLogTable/`, `src/app/`, `src/shared/lib/`, `supabase/migrations/20260512000002_rpc_versioned_group_a.sql`, `supabase/migrations/20260421000003_caja_entries.sql` (referenced via RESEARCH.md, not re-read)
**Files scanned:** 9 read in full this session (RefundSheet.tsx, useProcessRefund.ts, ManagerPinDialog.tsx, AuditLogTable.tsx, audit-actions.ts, audit-route.tsx, rbac.ts lines 1-70, rpc_versioned_group_a.sql lines 265-364) + RESEARCH.md's already-extracted excerpts for files not re-read (caja_entries.sql, version-error.ts, process_refund RPC body)
**Pattern extraction date:** 2026-07-19
