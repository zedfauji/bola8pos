# Phase 17: Modifier → Inventory Rules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 17-modifier-inventory-rules
**Areas discussed:** Delta sign & scaling, Rules without a base recipe, One ingredient or many per modifier, Negative-stock override parity

---

## Delta sign & scaling

| Option | Description | Selected |
|--------|-------------|----------|
| Scale by qty | Same math as recipe depletion: delta × order_item.quantity | ✓ |
| Fixed per line, no scaling | Rule delta applies once per order line regardless of quantity ordered | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, signed delta | Rule stores signed numeric delta — positive for "extra X", negative for "no X" | ✓ |
| Positive-only, separate mechanism for removals | modifier_inventory_rules only ever adds usage | |

**User's choice:** Scale by quantity; signed delta supporting both add and remove.
**Notes:** None.

---

## Rules without a base recipe

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fire independently | Modifier depletion independent of recipe presence — early-return only skips base recipe loop | ✓ |
| No, require a recipe | Modifier rules only apply when product already has a recipe | |

**User's choice:** Fire independently.
**Notes:** None.

---

## One ingredient or many per modifier

| Option | Description | Selected |
|--------|-------------|----------|
| Many ingredients per modifier | Join table keyed by (modifier_id, ingredient_id), same shape as recipe_items | ✓ |
| One ingredient per modifier only | Simpler table, no compound-modifier support | |

**User's choice:** Many ingredients per modifier.
**Notes:** None.

---

## Negative-stock override parity

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same override path | Shares p_allow_negative bypass + audit_log 'stock_override' pattern with recipe depletion | ✓ |
| No, modifier deltas always hard-block | No bypass mechanism for modifier-caused negative stock | |

**User's choice:** Same override path as recipe depletion.
**Notes:** None.

---

## Claude's Discretion

- Exact column/table naming for `modifier_inventory_rules` (e.g. `delta` vs `qty_delta`)
- Resolution approach for the same-ingredient `stock_movements` unique-index collision when a recipe ingredient and a modifier-rule ingredient coincide on one order_item
- Admin UI shape for adding N ingredient rows per modifier (expandable row vs dialog)
- Whether "no X" negative deltas need extra guarding against over-crediting stock — deferred to research/planning unless a real risk surfaces

## Deferred Ideas

None — discussion stayed within phase scope.
