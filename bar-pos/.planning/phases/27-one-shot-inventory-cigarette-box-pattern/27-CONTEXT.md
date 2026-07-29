# Phase 27: One-Shot Inventory (Cigarette-Box Pattern) - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Support "open one unit, sell individually" inventory: a whole-package product (e.g. a cigarette box) can be opened into an `open_units` row tracking remaining piece count, and a linked "loose piece" product (e.g. a single stick) can then be sold one at a time via a `consume_open_unit` SQL function that atomically decrements the count and auto-transitions to a fresh unit when exhausted. Includes an admin Open-Units tab (view + manually open + correct/void) and audit-log lifecycle tracking (opened → depleting → exhausted).

</domain>

<decisions>
## Implementation Decisions

### Product & sellable-unit model
- **D-01:** A loose piece (e.g. "Marlboro - Suelto") is a **distinct catalog product**, linked to its parent package product, shown in the product grid like any other product — not a special quantity/unit typed against the box product itself. — **Reversibility:** costly — **rationale:** switching to a fractional-quantity-on-one-product model later would require reworking cart/order_items quantity semantics across receipts, KDS, and reports; the linked-product model reuses existing product/order_items plumbing unchanged.
- **D-02:** "Units per box" (e.g. 20 sticks) is a **fixed value configured once on the parent product** (new field, e.g. `products.units_per_package`), not entered by staff each time a box is opened.
- **D-03:** The loose-piece product has its **own explicit `base_price`**, set by admin like any other product — never auto-derived from `box_price / units_per_package`. Reflects real per-piece markup.
- **D-04:** The feature is **generic**, not cigarette-specific — any product can be flagged as "sells via open units." Matches the ROADMAP's generic `open_units` table name; the cigarette box is the first (not only) use case.

### Exhaustion / no-restock behavior
- **D-05:** When an open unit reaches 0 and the parent product also has 0 unopened boxes in stock, selling the loose-piece product is **blocked with the same override mechanism as existing negative-stock handling** (`INVENTORY_NEGATIVE`-style error, manager PIN override to proceed, audit-logged `stock_override`) — one consistent override mechanism app-wide, not a second one specific to open units.
- **D-06:** **No proactive low-remaining-count warning** in this phase (e.g. no "2 sticks left" indicator). The system only reacts once a unit is fully exhausted and a new one must be opened. Existing box-level `low_stock_threshold` already covers package-level low stock; open-unit-level warnings are an explicit future enhancement, not this phase's scope.

### Concurrent open units
- **D-07:** **Strictly one active open unit per product at a time.** A box cannot be opened while another open unit of the same product is still active (has remaining count > 0). — **Reversibility:** costly — **rationale:** allowing multiple concurrent open units later would require reworking `consume_open_unit`'s targeting logic (which unit a sale decrements from) and any DB uniqueness constraint enforcing "one active row per product."
- **D-08:** Manually trying to open a new unit while one is still active is **blocked with a clear message** ("An open unit already exists for this product ({N} remaining) — sell through it first"), not auto-closed/discarded.

### Admin Open-Units tab placement & controls
- **D-09:** Open-Units management lives as a **new tab inside the existing `/inventory` page** (alongside `InventoryPagePanel`'s current content), not a new standalone route.
- **D-10:** Beyond viewing open units and manually opening a new one, staff can also **manually correct the remaining count or void/close an open unit early** (e.g. damaged pieces, miscount, abandoning a box) — this is in scope for this phase, not deferred.
- **D-11:** **Any staff (bartender+) can open a new unit** — matches the low-friction, high-frequency nature of the action at a busy bar; does not require the `adjust_inventory` (manager+) gate used for other inventory-adjusting actions.
- **D-12:** **Manual count correction or void of an open unit requires manager+** (same RBAC tier as `adjust_inventory`) — unlike opening a fresh box, correcting/voiding a count is a stock write-off/shrinkage vector and should carry the same trust level as other inventory-adjusting actions.

### Claude's Discretion
- Whether `open_units` rows integrate with the existing `stock_movements` ledger (e.g. write a `stock_movements` row when a unit is opened/depleted/exhausted) or track state independently — no specific preference given; follow whichever keeps `consume_open_unit` atomic and consistent with `record_stock_movement`'s existing role-locking pattern, without forcing an artificial fit if the shapes don't match.
- Exact `open_units` column names/shape (e.g. `remaining_count` vs `remaining`) — follow closest existing convention (`inventory.quantity_on_hand`, `recipe_items.qty`).
- New `audit-actions.ts` enum entries for the open-unit lifecycle (open/deplete/exhaust/void/correct) — `src/shared/lib/audit-actions.ts` already has generic `inventory.*` actions but none open-unit-specific; add new entries following the existing enum + `record_audit` pattern (Phase 14), do not overload the generic `inventory.manual_adjust` action for this.
- Whether the loose-piece product is linked to its parent via a new FK column on `products` (e.g. `parent_product_id`) or via the `open_units` table itself — no reference given; follow whichever keeps `consume_open_unit` and the product-grid query simplest.
- Exact UI layout of the new Open-Units tab (table vs. cards, how "open new unit" and "correct/void" actions are triggered) — no specific reference given; follow the nearest existing admin-tab pattern in the codebase (e.g. Settings tabs, `InventoryPagePanel`'s existing batch-adjustment dialog).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Requirements
- `.planning/ROADMAP.md` §"Phase 27: One-Shot Inventory (Cigarette-Box Pattern)" — goal, 4 success criteria, depends on Phase 14 (audit_logs) and Phase 17 (modifier-inventory-rules)
- `.planning/PROJECT.md` — Phase 27 listed as unstarted backlog, depends on Phases 14 and 17
- **GAP:** ROADMAP references "POS-COMPARISON.md §27" as the requirements source — this file does not exist anywhere in the repo (same gap already flagged in `14-CONTEXT.md`, `16-CONTEXT.md`, `17-CONTEXT.md`). Treat the ROADMAP bullet + this CONTEXT.md as the actual requirements source.

### Existing Schema to Extend
- `src/shared/lib/supabase.types.ts` — `inventory` table (lines ~604-650: `product_id` 1:1 FK to `products`, `quantity_on_hand`, `low_stock_threshold`, `unit`) — the existing box-level stock table; `open_units` is a new sibling table, not a replacement
- `src/shared/lib/supabase.types.ts` — `products` table (lines ~1355-1417: no `units_per_package` or parent-link field today — both are new columns this phase adds)
- `src/shared/lib/supabase.types.ts` — `stock_movements` table (~line 2063) and `record_stock_movement` RPC pattern — reference for the atomic-write/row-locking convention if `open_units` chooses to integrate with the ledger (Claude's Discretion above)

### Established Patterns (from Phase 14/17, still relevant)
- `.planning/phases/17-modifier-inventory-rules/17-CONTEXT.md` — negative-stock override pattern (`p_allow_negative`, manager PIN override, `stock_override` audit insert) that D-05 explicitly reuses; also documents the `const db = supabase as any` pre-type-regen workaround (CLAUDE.md) used for new/untyped tables like `open_units` will be until `supabase.types.ts` is regenerated
- `.planning/phases/14-audit-logs-table/14-CONTEXT.md` and `supabase/migrations/20260511000001_audit_logs_table.sql` — `audit_logs` table + `record_audit` SECURITY DEFINER RPC, called post-mutation success-path-only, non-fatal on its own failure — the pattern D-05/lifecycle tracking must follow
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` Zod enum + `AUDIT_ACTIONS` map, single source of truth for action labels (generic `inventory.*` entries already exist; new open-unit-specific entries needed per Claude's Discretion above)
- `src/shared/lib/rbac.ts` — `adjust_inventory` RBAC action (manager+) that D-12 reuses for count correction/void; role hierarchy `bartender < manager < admin` that D-11 places "open a new unit" below

### UI/Feature Structure to Extend
- `src/widgets/InventoryPagePanel.tsx` — existing `/inventory` page content; D-09's new Open-Units tab is added alongside this (no existing `Tabs` component in this file today — will need one added, or reuse the shared tabs primitive used elsewhere, e.g. Settings page tabs)
- `src/entities/inventory/model/` (`queries.ts`, `store.ts`, `types.ts`) — nearest existing entity-model structure to mirror for a new `open-unit` entity
- `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` — nearest existing "admin dialog attached to an inventory-adjacent feature" pattern, useful reference for the open/correct/void actions' UI
- `src/features/adjust-inventory/` — currently an empty stub (`.gitkeep` only); the actual batch-adjustment UI lives inline in `InventoryPagePanel.tsx` today, not as a separate feature folder — don't assume this directory has existing code to extend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `record_stock_movement` RPC and `p_allow_negative` override pattern: the atomic, row-locked stock-write primitive and negative-stock override mechanism D-05 explicitly reuses rather than inventing a parallel one.
- `record_audit` SECURITY DEFINER RPC + `audit-actions.ts` enum: ready-made lifecycle-logging primitive; only new enum entries are needed, not new logging infrastructure.
- `InventoryPagePanel.tsx`: existing `/inventory` page — the mount point for the new Open-Units tab (D-09).

### Established Patterns
- Negative-stock handling always pairs a blocking error with a manager-PIN override and an audit-logged bypass — never a silent allow (Phase 17, D-05 above follows this exactly).
- New/untyped Supabase tables are accessed via `const db = supabase as any` + file-level `eslint-disable` until `supabase.types.ts` is regenerated (CLAUDE.md workaround; used today in `ModifierGroupEditor.tsx`).
- RBAC actions are defined once in `src/shared/lib/rbac.ts` and checked consistently across RLS + frontend gating — new open-unit actions (open vs. correct/void) need their own action names if their role gates differ (D-11 vs D-12).

### Integration Points
- `InventoryPagePanel.tsx` — new Open-Units tab mounts here (D-09).
- Product grid / catalog (wherever sellable products are listed for order entry) — the new loose-piece product (D-01) must appear there like any other product; no special-cased UI path.
- `consume_open_unit` (new RPC) — the single new integration point order-entry needs to call when a loose-piece product is added to a tab, mirroring how `deplete_for_order_item` is invoked today.

</code_context>

<specifics>
## Specific Ideas

The cigarette-box example itself (box → loose sticks) is the concrete reference case throughout — a "Marlboro" box product opens into an `open_units` row, and a "Marlboro - Suelto" (loose stick) product is what actually gets sold and decrements it. No other specific UI mockups or naming preferences were given beyond the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- Proactive low-remaining-count warnings/indicators on open units (D-06) — explicitly deferred, not this phase.
- Multiple concurrent open units per product for batch/expiry tracking (D-07) — explicitly rejected for this phase, could be revisited later if a real need arises.

None of the 3 low-relevance pending todos surfaced by `todo.match-phase` (misplaced `.github/workflows/`, inert git hooks, print-popup Playwright hang) matched this phase's domain — all were generic keyword hits ("pos", "currently", "one") on unrelated tooling/testing todos, not folded.

</deferred>

---

*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Context gathered: 2026-07-29*
