---
title: Locked Decisions
status: frozen
decided: 2026-04-23
---

# Locked Decisions

These decisions were debated and locked on 2026-04-23. Do not re-litigate during execution. Reopen only with explicit owner approval.

## Architectural

| ID | Decision | Rationale |
|---|---|---|
| D1 | Combos are modeled as **parent/child `order_items`** linked by `parent_order_item_id`. No JSONB component blobs. | Unlocks split-bill, per-child KDS status, per-child inventory depletion, partial void for free. Industry standard (Toast, Square). |
| D2 | **One unified append-only ledger** for all stock movement. Rename/extend existing `inventory_log` → `stock_movements`. Reasons: `sale | void | refund | waste | delivery | correction | physical_count | prep_production | prep_consumption | combo_component`. | Prevents reconciliation hell. Never mutate historical rows. |
| D3 | **Sub-tabs for split bill** via `tabs.parent_tab_id` + `tabs.split_mode`. Move `order_items.tab_id` on reassignment. Drop `payments.tab_id isOneToOne` constraint. | Matches Toast model. Partial void + per-person tips become trivial. |
| D4 | **Prep items are a flag on ingredients** (`ingredients.is_prep`), not a separate subsystem. | Matches Lightspeed/Compeat/R365. Lower surface area. |
| D5 | **Refund ≠ Void.** Void = pre-payment (exists). Refund = post-payment, new negative row, manager PIN gated, per-item restock toggle. Never mutate originals. | Audit trail + legal compliance. |
| D6 | Split-by-person **kept** in S4 scope. UX: tap-to-assign, no drag-and-drop. | Operator requirement. Touch reliability. |
| D7 | WhatsApp notify via **WasenderAPI** Supabase edge function. Fallback: Realtime manager toast + Tauri native notification when phone absent. Key in Supabase Vault. | Single-venue scope; no Twilio complexity. |

## Data constraints

| ID | Decision |
|---|---|
| N1 | **Category tree max depth = 3** (e.g. `Beers → Regular → Corona`). Enforced by CHECK constraint via recursive CTE on insert trigger + UI guard. |
| N2 | **No nested combos.** `combo_slot_options.child_product_id` must reference a product with `is_combo = false`. Enforced by trigger. |
| N3 | **Day-of-week + time-window availability is a HARD refuse** at add-to-tab (server RPC rejects). Manager override allowed with PIN + reason code, logged to `audit_log`. |

## Feature scope cuts

| ID | Deferred | Reason |
|---|---|---|
| C1 | Nested combos | N2 |
| C2 | SMS for waitlist (WhatsApp only) | One channel is enough |
| C3 | Per-batch prep COGS drift | Flat cost in v1; add in v2 if variance reporting flags it |
| C4 | Partial refund of a single combo slot | Refund whole combo or not at all in v1 |
| C5 | Variant UOM auto-conversion beyond base+purchase (no multi-hop) | Keep conversion table simple |

## Extra scope confirmed

- Hierarchical categories (`categories.parent_id`)
- `products.combo_eligible boolean` (filters options when building combos)
- DB view `product_combo_usage` for reverse lookup ("which combos use this item")
- Combos-as-category (normal category rows; `is_combo=true` just flips the card behavior)
- Combo `availability` with day-of-week array + time windows + date range
- `libphonenumber-js` dependency (S5 only)
- Zero-dep category tree UI (indented list; no DnD library)
