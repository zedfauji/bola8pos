---
phase: "04"
plan: "04-04"
subsystem: "recipes-sale-depletion"
title: "Void Reversal + Override Feature + IngredientAutocomplete + CartPanel Wiring"
tags: [depletion, override, inventory, ui, fsd]
dependency_graph:
  requires: ["04-02", "04-03"]
  provides: ["useVoidOrder depletion reversal", "useOverrideNegativeStock", "IngredientAutocomplete", "CartPanel INVENTORY_NEGATIVE flow"]
  affects: ["features/void-order", "features/override-negative-stock", "shared/ui", "widgets/OrderPanel"]
tech_stack:
  added: []
  patterns: ["p_skip_depletion RPC flag", "p_allow_negative RPC flag", "ManagerPinDialog onSuccess override flow", "FSD-compliant prop-injection for shared UI"]
key_files:
  created:
    - bar-pos/src/features/override-negative-stock/model/useOverrideNegativeStock.ts
    - bar-pos/src/features/override-negative-stock/index.ts
    - bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.tsx
    - bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.stories.tsx
    - bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx
  modified:
    - bar-pos/src/features/void-order/model/useVoidOrder.ts
    - bar-pos/src/widgets/OrderPanel/CartPanel.tsx
    - bar-pos/src/shared/ui/index.ts
decisions:
  - "IngredientAutocomplete accepts ingredients/isLoading as props (not useIngredients directly) — FSD boundary: shared cannot import from entities; parent widget/feature passes data"
  - "CartPanel: setPendingOverride called unconditionally after INVENTORY_NEGATIVE (activeTabId and currentStaff.id already guarded by earlier checks); removed redundant null guard inside JSX block"
  - "useOverrideNegativeStock uses supabase as any with file-level eslint-disable (same CLAUDE.md pre-regen cast pattern as ingredient queries)"
  - "Depletion reversal in useVoidOrder is non-atomic with void (edge function is remote) — eventual consistency acceptable; idempotent on 23505 unique_violation"
  - "override-negative-stock audit_log failure does not fail the mutation — order is placed; audit is best-effort"
metrics:
  duration: "9 minutes"
  completed: "2026-04-24"
  tasks: 3
  files: 8
---

# Phase 04 Plan 04: Void Reversal + Override Feature + IngredientAutocomplete + CartPanel Wiring Summary

**One-liner:** Depletion lifecycle completed — void reverses ingredient stock, INVENTORY_NEGATIVE triggers manager PIN override via p_skip_depletion + p_allow_negative RPC flags, IngredientAutocomplete built as FSD-compliant prop-injected combobox.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Void reversal + useOverrideNegativeStock | 3ce2449 | useVoidOrder.ts, useOverrideNegativeStock.ts, index.ts |
| 2 | IngredientAutocomplete + stories + tests | a0a6cdf | IngredientAutocomplete.tsx, .stories.tsx, .test.tsx, shared/ui/index.ts |
| 3 | CartPanel INVENTORY_NEGATIVE wiring | a8a1de0 | CartPanel.tsx, IngredientAutocomplete.tsx (FSD fix), useOverrideNegativeStock.ts |

## Implementation Notes

### Task 1: useVoidOrder Depletion Reversal

Inserted reversal loop at **line 75** (after `if (!result.ok)` block, before `logger.info('order.void.succeeded', ...)`). Each `order.items[N].id` is the `order_item` UUID confirmed via `OrderItemSchema`. Loop calls `deplete_for_order_item` with `p_direction: -1`. Idempotent on `23505` (unique_violation). Warns but does not fail void on other errors.

### Task 1: useOverrideNegativeStock

Two-step flow:
1. `create_order_with_items` with `p_skip_depletion: true` — bypasses INVENTORY_NEGATIVE guard
2. For each returned `order_item.id`, calls `deplete_for_order_item` with `p_allow_negative: true` — writes `audit_log` server-side (SECURITY DEFINER)
3. Inserts top-level `audit_log` row for the override event

No RPC param name adjustments needed — confirmed `p_tab_id`, `p_staff_id`, `p_items` match the migration.

### Task 2: IngredientAutocomplete

Built with `Popover` + `Command` combobox. Stock color indicators:
- `text-destructive` — `quantityOnHand <= 0`
- `text-yellow-500` — `quantityOnHand <= reorderPoint` (when reorderPoint is set)
- `text-pos-accent` — adequate stock

**FSD fix (Rule 1):** Plan template called `useIngredients()` directly inside the component but `shared/*` cannot import from `entities/*` (ESLint `boundaries/dependencies` error). Refactored to accept `ingredients: Ingredient[]` and `isLoading: boolean` as props. Parent widget/feature passes data from `useIngredients()`.

### Task 3: CartPanel Wiring

Added to `handlePlaceOrder` after the `NETWORK_OFFLINE` check:
- Catches `result.error.code === 'INVENTORY_NEGATIVE'` or message includes `'INVENTORY_NEGATIVE'`
- `setPendingOverride(...)` captures `orderItems`, `tabId`, `staffId`
- `toast.error(...)` with `action: { label: 'Allow override', onClick: () => setIsPinDialogOpen(true) }`
- `{pendingOverride !== null && <ManagerPinDialog ... onSuccess={() => handleOverrideSuccess(pendingOverride)} />}` added to JSX

`handleOverrideSuccess` calls `overrideMutation.mutateAsync(override)` then `clearCart()` + `setPendingOverride(null)` on success.

## Verification Results

1. `npm run typecheck` → exits 0
2. `npm run lint` → 0 errors in plan files (6 pre-existing errors in `ActiveTabSelector.tsx` deferred)
3. `npx vitest run IngredientAutocomplete.test.tsx` → 5/5 pass
4. `grep -c "deplete_for_order_item" useVoidOrder.ts` → 1
5. `grep -c "p_allow_negative" useOverrideNegativeStock.ts` → 3
6. `grep -c "INVENTORY_NEGATIVE" CartPanel.tsx` → 4

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FSD boundary violation: shared importing from entities**
- **Found during:** Task 2 lint check
- **Issue:** Plan template called `useIngredients()` directly in `IngredientAutocomplete.tsx`, but `shared/*` cannot import `@entities/*` per FSD + ESLint `boundaries/dependencies`
- **Fix:** Refactored component to accept `ingredients: Ingredient[]` and `isLoading?: boolean` as props; tests updated to pass mock data directly (no entity mock needed)
- **Files modified:** `IngredientAutocomplete.tsx`, `IngredientAutocomplete.test.tsx`
- **Commit:** a8a1de0

**2. [Rule 1 - Bug] scrollIntoView not implemented in jsdom**
- **Found during:** Task 2 test run
- **Issue:** cmdk library calls `element.scrollIntoView()` on popover open; jsdom throws `TypeError: e.scrollIntoView is not a function`
- **Fix:** Added `beforeEach(() => { window.HTMLElement.prototype.scrollIntoView = vi.fn(); })` in test file
- **Files modified:** `IngredientAutocomplete.test.tsx`
- **Commit:** a0a6cdf

**3. [Rule 1 - Bug] ESLint import order + unnecessary-condition violations in CartPanel**
- **Found during:** Task 3 lint check
- **Issue:** Multiple lint errors from import ordering (react must follow external packages per project rule), and `pendingOverride !== null` inside JSX block guarded by same condition
- **Fix:** `npm run lint:fix` auto-fixed import order; refactored `onSuccess` to call `handleOverrideSuccess(pendingOverride)` directly (TypeScript knows it's non-null inside the block)
- **Files modified:** `CartPanel.tsx`
- **Commit:** a8a1de0

## Known Stubs

None — all functionality is fully wired. IngredientAutocomplete renders real data passed by parent. CartPanel override flow is fully connected.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers. The `p_skip_depletion` path is only reachable via `useOverrideNegativeStock`, which is only called from `ManagerPinDialog.onSuccess`.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| useVoidOrder.ts exists | FOUND |
| useOverrideNegativeStock.ts exists | FOUND |
| override-negative-stock/index.ts exists | FOUND |
| IngredientAutocomplete.tsx exists | FOUND |
| CartPanel.tsx exists | FOUND |
| Commit 3ce2449 exists | FOUND |
| Commit a0a6cdf exists | FOUND |
| Commit a8a1de0 exists | FOUND |
