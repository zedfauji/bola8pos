---
sprint: S2
title: Combos
duration: 2 weeks
tokens: 160k ± 20k
depends_on: [S1]
unlocks: [S4]
status: blocked_on_S1
---

# S2 — Combos

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Ship customer-visible combo support: Cubeta x10 beers (with beer-type selection), combos with 1-hour free pool, multi-slot bundle pricing, day-of-week availability. Combos are a category. Nested combos are forbidden.

## Scope

### In
1. `combo_slots`, `combo_slot_options`, `combo_availability` tables
2. `products.combo_price_override`
3. `order_items.parent_order_item_id`, `order_items.combo_slot_id`
4. `pool_sessions.prepaid_minutes`, `pool_sessions.source_order_item_id`
5. DB triggers: no-nesting, require-combo-eligible
6. `is_combo_available(combo_id, ts)` function + server-side enforcement in `add_order_item` RPC
7. `product_combo_usage` view
8. `ComboBuilderSheet`, `ComboSlotCard`, `ComboAvailabilityEditor`, `ComboBadge`, `ComboUnavailableBadge`
9. Settings → Combos admin UI (builder)
10. Integration with existing `add-item-to-tab` feature: when is_combo=true, open ComboBuilderSheet instead of straight add
11. Integration with existing `start-pool-timer` / session model: prepaid minutes applied first
12. KDS: bundle grouping by `parent_order_item_id`
13. Manager PIN override for day/time availability (hard refuse by default, override logged to audit_log)

### Out
- Split bill support on combos (S4 will handle — parent/child already enables it)
- Refund of individual combo slot (S4)

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S2-01 | DB migrations: combo_slots, combo_slot_options, combo_availability | migration file | M |
| S2-02 | DB migrations: order_items.parent_order_item_id + combo_slot_id; pool_sessions.prepaid_minutes + source_order_item_id; products.combo_price_override | migration file | S |
| S2-03 | DB triggers: no-nesting, require-eligible; function `is_combo_available` | migration file | M |
| S2-04 | DB view: `product_combo_usage` | migration file | XS |
| S2-05 | RPC: `add_combo_to_tab(combo_id, tab_id, slot_selections jsonb)` | supabase edge function or pl/pgsql | L |
| S2-06 | Zod schemas for ComboSlot/Option/Availability in domain.ts | `src/shared/lib/domain.ts` | S |
| S2-07 | Entity: `src/entities/combo/` (model/types, model/queries, ui) | new FSD slice | M |
| S2-08 | Feature: `src/features/add-combo-to-tab/` with ComboBuilderSheet | new FSD slice | L |
| S2-09 | Feature: `src/features/manage-combos/` (admin builder) | new FSD slice | L |
| S2-10 | Feature: `src/features/override-combo-availability/` (manager PIN) | reuses manager-pin-gate | S |
| S2-11 | Extend `add-item-to-tab` to route combos to ComboBuilderSheet | `src/features/add-item-to-tab/` | S |
| S2-12 | Pool session integration: apply prepaid_minutes first | `src/features/start-pool-timer/`, billing logic | M |
| S2-13 | KDS: group by parent_order_item_id | `src/entities/kds/model/queries.ts` + UI | M |
| S2-14 | ProductGrid: combo category filter + ComboBadge + greyed-out unavailable | `src/widgets/ProductGrid/` | M |
| S2-15 | Storybook for ComboBuilderSheet, ComboSlotCard, ComboAvailabilityEditor | stories | S |
| S2-16 | Property tests P2 + P3 | `src/features/add-combo-to-tab/pricing.test.ts`, `availability.test.ts` | M |
| S2-17 | E2E `19-combos.spec.ts` | `e2e/19-combos.spec.ts` | M |
| S2-18 | Seed data: Cubeta Regular, Cubeta Premium, Martes de Cubeta + Pool | `scripts/seed-combos.ts` | S |

## Core RPC contract — `add_combo_to_tab`

```
Input:
  combo_product_id: uuid
  tab_id: uuid
  slot_selections: [{ slot_id, child_product_id, qty }]
  override_availability: boolean (requires manager PIN server-side validation)
  override_reason: text | null

Behavior (transactional):
  1. Verify is_combo_available(combo_product_id, now()) unless override=true
  2. If override=true: verify manager-pin in request context; write audit_log row
  3. Validate slot_selections:
     - every required slot filled
     - qty within min_qty..max_qty
     - child_product_id ∈ combo_slot_options(slot_id)
     - child.combo_eligible = true
     - child.is_combo = false (defense-in-depth vs trigger)
  4. Insert parent order_item (is_combo=true, price = combo_price_override || sum)
  5. For each slot_selection:
     - if slot_type='product': insert N child order_items with parent + combo_slot_id, price=0 (parent holds the total)
     - if slot_type='pool_time': insert pool_sessions row with prepaid_minutes, source_order_item_id = parent
  6. Return parent order_item id

Errors:
  COMBO_UNAVAILABLE, SLOT_MIN_MAX_VIOLATION, INVALID_CHILD, NESTED_COMBO_FORBIDDEN,
  AUTH_FORBIDDEN (override requested without PIN)
```

## UI flows
See [04-navigation-ui-flows.md § Cubeta order, Combo w/ pool time](../04-navigation-ui-flows.md).

## Testing

### Unit
- Combo pricing: override beats sum when set; sum-of-children when null
- Availability: `isComboAvailable` returns true/false across 7×24 grid with fixtures

### Property
- P2 (combo pricing): `override_price ≤ sum(child_list_prices)` always
- P3 (availability): all permutations of `days_of_week × (start,end) × target_ts` vs hand-computed truth table

### Integration
- ComboBuilderSheet: required slot missing → confirm disabled
- Slot qty < min → validation error shown
- Nested combo attempt (test via seeded child with is_combo=true) → mutation rejected with NESTED_COMBO_FORBIDDEN

### E2E (`19-combos.spec.ts`)
1. Admin builds "Cubeta Regular" combo (10× beer slot from Regular category) with Mon–Fri availability
2. Bartender on Wednesday adds Cubeta → succeeds; tab shows parent + 10 children collapsible
3. Bartender on Saturday attempts Cubeta → UI shows "Available Mon–Fri"; tap → disabled
4. Manager PIN override → succeeds → `audit_log` row present
5. Attempt to nest: admin tries to add Cubeta as option of another combo → save fails
6. KDS view shows 10 beers grouped under one Cubeta card

## Definition of Done

- [ ] All migrations applied; types regenerated
- [ ] `add_combo_to_tab` RPC behaves per contract (unit + integration)
- [ ] ComboBuilderSheet usable end-to-end on Tauri dev build
- [ ] Cubeta Regular seeded and manually ordered successfully
- [ ] Combo with pool time creates session with correct prepaid_minutes
- [ ] Nested combo rejected at DB level (trigger) and RPC level (defense-in-depth)
- [ ] Day-of-week refuse verified + manager override path verified + audit_log entry verified
- [ ] KDS groups children correctly
- [ ] Property tests P2 + P3 green
- [ ] `19-combos.spec.ts` green
- [ ] Existing E2E suite still green (especially `03-tab-order`, `04-pool-timer`)
- [ ] typecheck + lint clean
- [ ] Storybook stories for 3 new shared UI components

## Risks

| Risk | Mitigation |
|---|---|
| Parent/child KDS grouping breaks existing single-item KDS | Only group when parent_order_item_id present; untouched items render as before |
| Pool prepaid logic conflicts with existing billing | Cover with property test that combined (prepaid + overage) billing = expected |
| Combo price override causes reporting double-count | Report sums parent price only when is_combo=true; child prices are 0 |
| Manager override UX friction | Reuse existing manager-pin-gate; measure override rate in S6 report |

## Notes

- Combos-as-category: simply create category "Combos" (or nest "Bundles" under it); `is_combo=true` products live there. ProductGrid treats them visually identically.
- Beer-type selection: combo slot has `combo_slot_options` listing all children of category "Regular" or "Premium". The picker within ComboBuilderSheet shows only these.
