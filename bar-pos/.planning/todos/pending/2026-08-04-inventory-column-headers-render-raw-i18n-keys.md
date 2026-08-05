---
created: 2026-08-04T00:00:00.000Z
title: Inventory table column headers render raw i18n keys instead of translated labels
area: i18n
severity: major
files:
  - src/widgets/InventoryPagePanel.tsx (lines 98, 114 — wrong-namespace t() passed into inventoryRowColumns)
  - src/entities/inventory/ui/InventoryRow.tsx (inventoryRowColumns, line 168 — expects entities-namespaced t())
  - e2e/44-focus-tab-order.spec.ts (finding B — confirms the break; do not "fix" by relaxing this test)
---

## Problem

Every column header on `/inventory` ("Product", "Category", "Price", "Status", "On hand", "Unit",
"Threshold") renders the literal, untranslated i18n key instead of its label. Confirmed live via
page snapshot during 39-07 (E2E triage):

```
- columnheader "inventoryRow.columns.product" [ref=e66]:
  - button "inventoryRow.columns.product" [active] [ref=e67] [cursor=pointer]
- columnheader "inventoryRow.columns.category" [ref=e68]:
  - button "inventoryRow.columns.category" [ref=e69] [cursor=pointer]
```

`src/widgets/InventoryPagePanel.tsx:98,114` calls `useTranslation('wAdmin')` and passes that
`wAdmin`-scoped `t` into `inventoryRowColumns(t, ...)`
(`src/entities/inventory/ui/InventoryRow.tsx:168`), which expects an `entities`-namespaced
`TFunction` — the `inventoryRow.columns.*` keys live only in `entities.json` (confirmed absent
from `wAdmin.json` in both locales). i18next falls back to the raw key string when a key is
missing from the active namespace, which is exactly what's rendered.

Note: the underlying Tab-order/focus-order accessibility contract (Phase 32, FOCUS-03) is
unaffected — confirmed live that Tab correctly moves focus onto the Product header in the right
position (the `[active]` marker above). This is purely a broken label, not a focus regression.

## Solution

`src/widgets/InventoryPagePanel.tsx` should call `useTranslation(['wAdmin', 'entities'])` (or a
second `useTranslation('entities')` hook) and pass the `entities`-namespaced `t` into
`inventoryRowColumns()`, not the `wAdmin`-namespaced one. Verify no other call site of
`inventoryRowColumns()` has the same wrong-namespace bug. After fixing, `e2e/44-focus-tab-order.spec.ts`
finding B should pass unmodified — its selectors were already correct against the intended
contract.
