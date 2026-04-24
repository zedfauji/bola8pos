---
title: Navigation & UI Flows
status: locked
---

# Navigation & UI Flows

## New routes

| Path | Page | Sprint | RBAC |
|---|---|---|---|
| `/waitlist` | `WaitlistPage` | S5 | manager+ |
| `/kitchen-prep` | `KitchenPrepPage` | S3c | manager+ (chef role alias → manager) |
| `/settings/categories` | Tab inside `SettingsPage` | S1 | admin |
| `/settings/modifier-groups` | Tab inside `SettingsPage` | S1 | admin |
| `/settings/combos` | Tab inside `SettingsPage` | S2 | admin |
| `/settings/ingredients` | Tab inside `SettingsPage` | S3a | admin |
| `/settings/recipes` | Tab inside `SettingsPage` (or inline on product detail) | S3b | admin |

## No new top-level pages for

- Combos (ProductGrid renders combo products like any other)
- Split bill (modal/sheet from tab detail)
- Refund (modal from PaymentsPage row)

## Component inventory (by sprint)

### S1 — Foundation
- `CategoryTreePicker` (shared/ui) — indented list, zero deps, supports max-depth guard
- `ModifierGroupEditor` (feature UI) — admin form, min/max/required toggles
- **No new shadcn primitives**

### S2 — Combos
- `ComboBuilderSheet` (feature UI) — extends `ModifierSheet` pattern; slot-by-slot picker
- `ComboSlotCard` (shared/ui) — shows slot name, min/max, selected children, running price
- `ComboAvailabilityEditor` (feature UI) — 7 checkboxes + time pickers + date range
- `ComboUnavailableBadge` (shared/ui) — greyed card with "Available Mon 18:00–22:00" hint
- Product card shows `ComboBadge` when `is_combo=true`

### S3a — Ingredients
- `IngredientsTable` (widget) — uses existing `DataTable` primitive
- `IngredientForm` (feature UI) — Dialog with UOM picker, purchase factor
- `CsvImportSheet` (feature UI) — drag-drop-free, file input only
- `StockMovementsList` (widget) — read-only ledger view per ingredient

### S3b — Recipes
- `RecipeEditor` (feature UI) — tab on product detail page; rows of `(ingredient, qty, uom)`
- `IngredientAutocomplete` (shared/ui) — Command/Combobox from shadcn
- Product detail: `RecipePreview` — shows depletion impact of selling 1 unit

### S3c — Prep
- `KitchenPrepPage` (page)
- `PrepProductionForm` (feature UI) — select prep ingredient, qty, notes
- `RawIngredientImpactPanel` (feature UI) — shows what will be consumed by this batch
- `ChefHatBadge` (shared/ui) — flags `is_prep=true` ingredients throughout UI

### S4 — Split & Refund
- `SplitTabSheet` (feature UI) — tabs: Item / Evenly / By Person / By Amount
- `SubTabColumn` (shared/ui) — one per sub-check
- `PersonCard` (shared/ui) — for by-person mode
- `RefundSheet` (feature UI) — item picker + qty + reason + restock toggle + manager PIN
- `RefundsList` (widget) — on PaymentsPage as history tab

### S5 — Waitlist
- `WaitlistPage` (page)
- `WaitlistQueue` (widget) — FIFO list sorted by `(status, created_at)`
- `WaitlistEntryForm` (feature UI) — Dialog, name/phone/party-size
- `WaitlistRow` (shared/ui) — status badge, wait time, notify button
- `PoolTableOccupancyPanel` (widget) — reuse existing pool table grid, overlay ETA

### S6 — Reports
- `ComboMixReport`, `RecipeVarianceReport`, `WaitlistAnalyticsReport` (widgets in ReportsPage)
- All reuse existing chart primitives; no new dep

## Primary user flows (textual mocks)

### Cubeta (Combo) order
```
POS page → ProductGrid filter "Combos" category → tap "Cubeta Regular"
  → if unavailable today: card shows "Available Mon 18-22" + greyed
  → if available: ComboBuilderSheet opens
    → Slot 1 "Pick beer type" (min=max=10)
      → show filtered options (is_active=true, combo_eligible=true, children of "Regular" category)
      → user taps Corona → qty defaults to 10
    → Confirm → 10 child order_items inserted with parent_order_item_id
    → Tab view shows 1 collapsible parent line "Cubeta Regular x1 — $450" with chevron to expand 10 children
  → KDS receives 1 bundle ticket grouped by parent_order_item_id
```

### Combo with pool time (Martes de Cubeta + Pool)
```
Combo has 2 slots:
  Slot 1: product, min=max=10, options=[Regular beers]
  Slot 2: pool_time, pool_minutes=60, options=null
→ On add to tab:
  → 10 child beers inserted (as above)
  → Create pool_sessions row with prepaid_minutes=60, source_order_item_id=parent
  → Pool session auto-links to tab
  → If manager later starts the pool timer, prepaid 60min applied first, overage bills normally
```

### Recipe depletion on sale (Alitas)
```
Bartender adds "Alitas x2" to tab → order_item inserted → edge function calls deplete_for_order_item
  → Recipe: 1 alita = 750g wings + 1 salsa portion
  → For 2 order_items:
    record_stock_movement(wings_id,   -1500, 'sale', 'order_item', oi_id)
    record_stock_movement(salsa_id,   -2,    'sale', 'order_item', oi_id)
  → If any ingredient would go negative and allow_negative=false → RPC fails, order insertion rolls back
  → UI: toast "Insufficient salsa stock. Ask manager to override or prep more."
```

### Kitchen prep batch (Salsa)
```
Chef → /kitchen-prep → "New batch" → select "Salsa Mexicana (prep)" → qty 20 portions
  → Preview panel shows raw consumption: tomato 2kg, onion 500g, chile 100g, lime 3u
  → Confirm → prep_productions row + ledger:
    +20 salsa_portions (prep_production)
    -2000 tomato, -500 onion, -100 chile, -3 lime (prep_consumption)
```

### Split by person
```
Tab detail → "Split" button → SplitTabSheet → tab "By Person"
  → User sets N=3 → 3 PersonCards appear + "Unassigned" column showing all order_items
  → Tap item → tap person card → item moves (visual, state only)
  → Unassigned items at time of Confirm are split evenly across all N persons
  → Confirm → 3 sub-tabs created with parent_tab_id; order_items.tab_id reassigned
  → Each sub-tab has its own Pay button; parent auto-closes when all sub-tabs paid
```

### Refund
```
PaymentsPage → row has "Refund" button (hidden if already fully refunded)
  → RefundSheet opens listing original order_items with qty pickers
  → Select items to refund, set qty per item, reason, restock toggles (defaults: food=false, retail=true)
  → Total auto-computed
  → "Request approval" → manager_pin_gate modal → manager enters PIN
  → process_refund RPC: writes refunds + refund_items + negative payments row + (if restock) positive ledger deltas
  → Receipt printer prompt: reprint refund receipt y/n
```

### Waitlist
```
/waitlist (manager)
  → Left pane: queue with [Name | Party | Wait | Phone badge | Actions]
  → Add Walk-in → Dialog (name, phone?, party_size) → libphonenumber-js validates phone
  → Save → status=waiting, created_at=now, quoted_wait=heuristic
  → When a tab closes and a pool table frees:
    Realtime event → queue re-sorted → head-of-line highlighted
    → If phone present: auto-call edge function → WasenderAPI WhatsApp
    → If no phone: Tauri native notification + manager pane flashes
  → "Seat" button → choose table → status=seated, seated_at=now, table_id set
```

## Accessibility & UX guardrails

- All new interactive elements reachable via keyboard
- Focus traps in `Sheet` and `Dialog` (shadcn defaults are fine — don't override)
- Color contrast on availability badges ≥ 4.5:1
- `ComboUnavailableBadge` includes screen-reader text announcing reason
- Manager-PIN modals trap focus and clear on dismiss (existing pattern)
- No action happens on single-tap-without-confirm for destructive flows (refund, void, waitlist remove)
