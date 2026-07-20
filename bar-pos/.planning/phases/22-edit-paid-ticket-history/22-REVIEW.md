---
phase: 22-edit-paid-ticket-history
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - e2e/47-edit-paid-tab.spec.ts
  - src/app/edit-history-route.tsx
  - src/app/router.tsx
  - src/features/edit-paid-tab/index.ts
  - src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts
  - src/features/edit-paid-tab/model/useEditPaidTab.ts
  - src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx
  - src/pages/edit-history/index.tsx
  - src/shared/lib/audit-actions.ts
  - src/shared/lib/i18n/locales/en-US/featOrders.json
  - src/shared/lib/i18n/locales/en-US/pages.json
  - src/shared/lib/i18n/locales/en-US/wAdmin.json
  - src/shared/lib/i18n/locales/en-US/wPanels.json
  - src/shared/lib/i18n/locales/es-MX/featOrders.json
  - src/shared/lib/i18n/locales/es-MX/pages.json
  - src/shared/lib/i18n/locales/es-MX/wAdmin.json
  - src/shared/lib/i18n/locales/es-MX/wPanels.json
  - src/shared/lib/rbac.test.ts
  - src/shared/lib/rbac.ts
  - src/shared/lib/supabase.types.ts
  - src/widgets/EditHistoryTable/EditHistoryTable.tsx
  - src/widgets/EditHistoryTable/index.ts
  - src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
  - src/widgets/HomeDashboard/ui/HomeDashboard.tsx
  - src/widgets/PaymentPane/ui/PaymentPane.test.tsx
  - src/widgets/PaymentPane/ui/PaymentPane.tsx
  - src/widgets/RBACDashboard/PermissionMatrix.test.tsx
  - supabase/migrations/20260719000001_edit_paid_tab_rpc.sql
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24 (plus 4 generated/locale-pair files diffed for consistency)
**Status:** issues_found

## Summary

Reviewed the `edit_paid_tab` SECURITY DEFINER RPC, its client-side mutation hook and dialog, the read-only `/edit-history` view, and the RBAC/i18n/audit wiring that supports them. The security fundamentals asked for in this review are solid: the RPC re-checks `manager`/`admin` role server-side via `auth.uid()` (not trusting the client's `ManagerPinDialog`), enforces the Phase 15 `p_expected_version`/`FOR UPDATE` optimistic-concurrency contract, uses a parameterized (non-dynamic-SQL) whitelist for the patch loop, and writes a single success-path `record_audit()` call with a real before/after diff. `payments` is never touched, matching the stated design.

However, tracing the RPC's write paths against sibling features (specifically `void-order`, which restores inventory via an explicit `deplete_for_order_item` RPC call on soft-delete) surfaced a real data-integrity gap: **`edit_paid_tab`'s whitelisted `update`/`delete` ops never adjust `inventory.quantity_on_hand` or write a `stock_movements` row**, even though `quantity` and item removal are both in-scope, whitelisted corrections. This silently desyncs stock counts every time this tool is used to fix a quantity or remove a line item. Several lower-severity gaps (combo-child rows not excluded from the whitelist scope, malformed patches silently no-op'ing, an unlocked caja-session read, and a client-side API footgun) round out the findings below.

## Critical Issues

### CR-01: `edit_paid_tab`'s quantity/delete corrections never adjust inventory — stock drifts silently

**File:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql:127-155`

**Issue:** The whitelisted patch loop applies `update` (including `quantity`) and `delete` (soft-delete via `is_deleted = true`) directly with plain `UPDATE order_items ...` statements:

```sql
IF v_op = 'update' THEN
  UPDATE order_items
  SET quantity = COALESCE((v_patch->>'quantity')::int, quantity), ...
ELSIF v_op = 'delete' THEN
  UPDATE order_items
  SET is_deleted = true, deleted_at = NOW()
  ...
```

Neither of these touches `inventory.quantity_on_hand` or `stock_movements`. This is inconsistent with the two other code paths that mutate `order_items` in this codebase:

- A hard `INSERT INTO order_items` (used by this RPC's own `add` op, line 147) *does* get inventory decremented automatically via the pre-existing `trigger_decrement_inventory_on_order_item` AFTER-INSERT trigger (`supabase/migrations/20260424000001_stock_movements.sql:44-62`) — so `add` happens to work, but only incidentally.
- A hard `DELETE FROM order_items` fires `restore_inventory_on_order_item_delete` (same file, lines 64-82) — but this RPC never hard-deletes, it soft-deletes (`is_deleted = true`), so that trigger never fires.
- `src/features/void-order/model/useVoidOrder.ts:83-86` — the established pattern for "remove/void an existing order_item after the fact" — explicitly calls `supabase.rpc('deplete_for_order_item', { p_order_item_id: item.id, p_direction: -1 })` to reverse the depletion for exactly this soft-delete scenario. `edit_paid_tab` does not replicate this call for its `delete` op, nor does it call `deplete_for_order_item` with the delta direction for a `quantity` change on `update`.

Net effect: a manager who uses this tool to correct "we billed 3, should have been 2" (an `update` reducing quantity) or "this item shouldn't be on the ticket" (`delete`) gets a correct, audited financial correction (item total + caja offset), but `inventory.quantity_on_hand` is never restored — the stock is permanently short by the corrected/removed quantity, with no `stock_movements` row to explain the drift. Conversely, a manager who *increases* a quantity via `update` never gets the extra unit depleted at all (no trigger fires on `UPDATE`, unlike `INSERT`).

**Fix:** Mirror `void-order`'s pattern — call `deplete_for_order_item(item_id, direction)` (or its SQL equivalent, since this is already inside a `plpgsql` function and can call it directly: `PERFORM deplete_for_order_item(v_item_id, v_qty_delta::smallint)`) for both branches:

```sql
ELSIF v_op = 'delete' THEN
  UPDATE order_items
  SET is_deleted = true, deleted_at = NOW()
  WHERE id = (v_patch->>'id')::uuid
    AND order_id IN (SELECT o.id FROM orders o WHERE o.tab_id = p_tab_id)
  RETURNING quantity INTO v_item_qty;
  IF FOUND THEN
    PERFORM deplete_for_order_item((v_patch->>'id')::uuid, -1);  -- restore stock
  END IF;
```

and for `update`, compute the quantity delta before/after the `UPDATE` and call `deplete_for_order_item` with the signed difference (or a dedicated `p_allow_negative`/delta-aware call), so a `2 → 3` correction depletes 1 more unit and a `3 → 1` correction restores 2 units.

## Warnings

### WR-01: Combo-child `order_items` rows are not excluded from the whitelist patch scope or from the editable item list

**File:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql:127-141`, `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx:94-112`

**Issue:** Combo child rows (`order_items.parent_order_item_id IS NOT NULL`, always inserted with `unit_price = 0` — see `supabase/migrations/20260425000005_add_combo_to_tab_rpc.sql:201-213`) are correctly excluded from the RPC's total calculation (`AND oi.parent_order_item_id IS NULL`, lines 112/162), but the `update`/`delete` branches of the patch loop have no such filter — any order_item id belonging to the tab, including a combo child, can be targeted. On the client, `EditPaidTabDialog`'s `existingRows` is built directly from `tab?.items` (`src/entities/tab/model/queries.ts`'s `tabListSelect`, which also does not filter `parent_order_item_id`), so combo child lines render as ordinary, independently editable/removable rows.

A manager could (accidentally, since the UI doesn't label these rows as combo children) set a non-zero `unit_price` on a combo-child row. That mutation is applied to the DB, but the total/delta/caja-offset math — here and everywhere else in the codebase that follows the `parent_order_item_id IS NULL` convention (`process_payment_atomic`, `split_tab`, etc.) — will silently ignore it, so the change is never reflected in what the customer was charged or in any offsetting caja entry, breaking the "every total-changing edit gets a caja entry" invariant this migration exists to guarantee.

**Fix:** Add `AND parent_order_item_id IS NULL` to the `update`/`delete` `WHERE` clauses (matching the total-calc filter), and filter `tab.items` by the same predicate before building `existingRows` in the dialog, so combo children are simply not reachable as edit targets from this tool.

### WR-02: Malformed patch elements silently no-op instead of surfacing an error

**File:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql:123-156`

**Issue:** The `FOR v_patch IN ...` loop has no `ELSE` branch for an unrecognized `op`, and for `update`/`delete` the `WHERE id = (v_patch->>'id')::uuid AND order_id IN (...)` silently matches zero rows if `id` is missing/null or doesn't belong to the tab — `UPDATE ... WHERE id = NULL` is valid SQL that just updates nothing, it does not error. The function still returns `ok: true` with a `newTotal`/`delta` computed from whatever *did* apply, and audit/caja entries are written as if the whole patch succeeded.

This means a client-side bug (e.g. an item id that got stale/undefined before submit) produces a false-positive success toast ("Ticket correction saved.") even though one or more of the intended line-item edits were silently dropped — there's no way for the caller to distinguish "3 of 3 patches applied" from "1 of 3 patches applied, 2 silently ignored."

**Fix:** Track whether each patch element actually matched a row (e.g. `GET DIAGNOSTICS v_rows = ROW_COUNT;` after each `UPDATE`) and raise a distinct exception (e.g. `PATCH_ITEM_NOT_FOUND`) if any patch element with `op IN ('update','delete')` affects zero rows, or if `op` is not one of the three recognized values.

### WR-03: Open-caja lookup is not locked — race window before the offsetting `caja_entries` insert

**File:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql:170`

**Issue:** `SELECT id INTO v_caja FROM caja_sessions WHERE status = 'open' LIMIT 1;` reads the open session without `FOR UPDATE`. Between this read and the later `INSERT INTO caja_entries (caja_session_id, ...)` (line 195), a concurrent `close_caja_session` call could close that same session. The offsetting entry would then be attributed to an already-closed session, silently excluding it from that session's reconciled totals (it would only show up in the *next* session's numbers, if at all, depending on how reports scope by `caja_session_id`).

**Fix:** `SELECT id INTO v_caja FROM caja_sessions WHERE status = 'open' LIMIT 1 FOR UPDATE;` to serialize against a concurrent close, consistent with the `FOR UPDATE` already used for the `tabs` row.

### WR-04: `useEditPaidTab` collapses "leave notes unchanged" into "clear notes"

**File:** `src/features/edit-paid-tab/model/useEditPaidTab.ts:65`

**Issue:** The RPC's `tabs.notes` update uses `COALESCE(p_notes, notes)` (migration line 210), i.e. passing SQL `NULL` is the documented "don't touch notes" sentinel. But the hook does:

```ts
p_notes: input.notes ?? '',
```

`EditPaidTabInput.notes` is typed `string | undefined`; any future caller that passes `notes: undefined` intending "leave tab notes as-is" will instead send `''`, which `COALESCE('', notes)` treats as a real value and overwrites existing notes with an empty string. Today's only caller (`EditPaidTabDialog`) always supplies the full current `tabNotes` string, so this doesn't manifest yet, but the hook's public contract doesn't actually support the "no-op" case the RPC was designed for.

**Fix:** Either send `null` through when `input.notes` is `undefined` (widen the wire type to allow it), or drop the `COALESCE` no-op contract from the RPC doc/comment since this hook can never exercise it.

## Info

### IN-01: Hardcoded `$` currency literal ignores locale-aware formatting

**File:** `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx:407`

**Issue:** `t("editPaidTab.totalDeltaHint", { amount: \`$${Math.abs(totalDelta).toFixed(2)}\` })` hardcodes a `$` prefix regardless of the active locale, and doesn't reuse `MoneyDisplay`'s formatting used two lines above for the same value. This matches an existing pattern elsewhere in the codebase (`registerCajaEntry.expenseRecorded`), so it's not a regression specific to this phase, but it is worth fixing alongside those call sites since this phase's new feature is a fresh opportunity to not repeat it.

**Fix:** Format via the same currency formatter/`MoneyDisplay`-style helper used for `newTotal` instead of a template literal.

### IN-02: `EditHistoryRoute` is a byte-for-byte duplicate of `AuditRoute`

**File:** `src/app/edit-history-route.tsx`, `src/app/audit-route.tsx`

**Issue:** Both components are identical except for the permission-guard's hardcoded copy of `usePermissions().can('view_audit_log')` and the hardcoded English toast text — genuinely the same component, just typed out twice. Any future change to the "restricted page" pattern (e.g. adding i18n to this toast, which is currently hardcoded English even in this es-MX-default app) has to be made in two places and will drift.

**Fix:** Extract a shared `RequirePermission({ action, children })` wrapper in `src/app/` and have both `AuditRoute` and `EditHistoryRoute` (and any future manager-gated route) use it.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
