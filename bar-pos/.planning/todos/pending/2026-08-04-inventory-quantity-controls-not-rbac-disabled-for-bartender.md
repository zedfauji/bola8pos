---
created: 2026-08-04T00:00:00.000Z
title: Inventory quantity +/- controls are not RBAC-disabled for bartender role
area: rbac
severity: minor
files:
  - src/entities/inventory/ui/InventoryRow.tsx:83-118 (QuantityAdjustCell)
  - src/pages/inventory/index.tsx (page-level gating)
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/21-product-management.spec.ts` PM8
("bartender navigating to product management — button absent or PIN gate shown").

A bartender navigating directly to `/inventory` (bypassing any nav-button click) lands
on the full Inventory page with the on-hand-levels table fully rendered, including each
row's `QuantityControl` (+/- stepper). `QuantityAdjustCell` in `InventoryRow.tsx` only
disables the control while a mutation for that row is in flight
(`disabled={isThisRowPending}`) — there is no RBAC check gating the control itself,
unlike other manager+-only actions in this codebase (e.g. `void_order`'s
`ProtectedAction` wrapper, which renders a denied control visible-but-disabled with an
explanatory tooltip).

**Confirmed this is not a live data-integrity vulnerability**: `inventory`'s RLS policy
(`inventory_update_manager_admin`, `supabase/migrations/20260510000001_rls_rewrite_phase13.sql:720-723`)
requires `role_permissions` to grant `adjust_inventory` for the UPDATE to succeed — a
bartender's role isn't in `MANAGER_EXTRA` (`src/shared/lib/rbac.ts`), so the write is
rejected server-side. `useMutationAdjustInventory` (`src/entities/inventory/model/queries.ts:320`)
does surface the resulting error via a toast, so the actual database state cannot be
corrupted.

What's missing is client-side defense-in-depth and UX clarity: a bartender who clicks
+/- gets a confusing error toast instead of a disabled control with a denial reason,
which is the established pattern used elsewhere in this codebase for the same class of
manager+-only action.

## Solution

TBD. Options to evaluate:
- Wrap `QuantityAdjustCell`'s `QuantityControl` in the existing `ProtectedAction`
  (`src/shared/ui/ProtectedAction.tsx`) with `action="adjust_inventory"`, matching the
  pattern already used for `void_order` in `ActiveTabSelector.tsx`.
- Alternatively, pass an RBAC-derived `disabled` prop down from the page/table level
  (the row already receives `staffId` — would need `currentRole` too).
