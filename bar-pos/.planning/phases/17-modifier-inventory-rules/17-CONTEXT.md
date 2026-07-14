# Phase 17: Modifier → Inventory Rules - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Let modifiers (e.g. "extra cheese", "no ice") drive inventory depletion. Add a `modifier_inventory_rules` join table mapping modifier options to ingredient deltas, extend the `deplete_for_order_item` RPC to apply modifier-driven deltas atomically alongside base recipe depletion, and add an admin UI inside `manage-modifier-groups` to configure the rules.

</domain>

<decisions>
## Implementation Decisions

### Delta shape (table schema)
- **D-01 (scaling):** Modifier rule deltas scale by `order_items.quantity`, exactly like `recipe_items` does today — a rule delta of `x` on a 2-quantity line depletes `2 × x`. Same `v_delta` formula shape as the existing recipe loop.
- **D-02 (signed delta):** `modifier_inventory_rules.delta` (or equivalent column) is a **signed numeric**. Positive = "extra X" (adds usage/depletion). Negative = "no X" / "remove X" (reduces usage/depletion). One rule shape covers both directions — no separate mechanism needed for removal modifiers.
- **D-03 (fan-out):** A single modifier can map to **multiple ingredients** — `modifier_inventory_rules` is a join table keyed by `(modifier_id, ingredient_id)` with a delta per row, structurally identical in shape to `recipe_items` (recipe_id, ingredient_id, qty). This covers compound modifiers like "Loaded" → cheese + bacon. Admin UI must support adding N ingredient rows per modifier, not just one.

### Applicability
- **D-04 (independent of recipe):** Modifier-driven depletion fires **independently of whether the product has a base recipe**. `deplete_for_order_item`'s early-return when no recipe exists for the product must only skip the *base recipe* loop — the modifier-rule loop (driven by `order_items.modifier_ids`) runs regardless, so a plain bottled product with an "extra lime" modifier still depletes lime stock even though the bottle itself has no recipe row.

### Negative-stock override
- **D-05 (override parity):** Modifier-driven depletion shares the **exact same `p_allow_negative` override path** already used for recipe depletion — same manager-override bypass of `INVENTORY_NEGATIVE`, same `audit_log` `'stock_override'` insert pattern, same single flag threaded through `create_order_with_items` → `CartPanel` override flow. No separate override mechanism for modifier-caused negative stock.

### Claude's Discretion
- Exact column/table naming for `modifier_inventory_rules` (e.g. `delta` vs `qty_delta`) — follow closest existing convention (`recipe_items.qty`).
- How to avoid a `stock_movements` unique-index collision when a recipe ingredient and a modifier rule ingredient are the *same ingredient* on the *same order_item* (existing unique index is `(ref_type, ref_id, ingredient_id)`). Not raised as a user concern — resolve at planning/implementation time (e.g. distinct `ref_type` for modifier-driven movements, or aggregate deltas per ingredient before calling `record_stock_movement`). Whichever approach is chosen must preserve idempotency on retry.
- Whether the admin UI for adding ingredient rows per modifier lives as an expandable row/panel under each modifier in `ModifierGroupEditor.tsx`, or a separate dialog opened per modifier — no specific UI reference was given; follow closest existing pattern (`RecipeEditorTab`'s ingredient-row editor is the nearest analog for "attach N ingredients with deltas to a thing").
- Whether "no X" (negative-delta) modifiers can ever cause `quantity_on_hand` to *exceed* on-hand beyond what was originally depleted (e.g. rounding/edge cases) — treat as out of scope unless research surfaces a real risk.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Requirements
- `.planning/ROADMAP.md` §"Phase 17: Modifier → Inventory Rules" (line 487) — goal, 4 success criteria, depends-on Phase 14
- `.planning/PROJECT.md` — Phase 17 listed as depending on Phase 14 (Audit Logs, complete) and as a dependency of Phase 27 (One-Shot Inventory)
- **GAP:** ROADMAP references "POS-COMPARISON.md §17" as the requirements source — this file does not exist anywhere in the repo (same gap already flagged in `14-CONTEXT.md` and `16-CONTEXT.md`). Treat the ROADMAP bullet + this CONTEXT.md as the actual requirements source.

### Existing Implementation to Extend
- `supabase/migrations/20260428000004_deplete_for_order_item_v2.sql` — current `deplete_for_order_item(uuid, smallint, boolean)` RPC body; the function to extend with a modifier-rule loop alongside the existing recipe loop
- `supabase/migrations/20260506000003_fix_deplete_overload_ambiguity.sql` — dropped the v1 2-arg overload; only the 3-arg `(uuid, smallint, boolean)` signature exists now — extend that one, do not add a new overload
- `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` — `record_stock_movement(ingredient_id, delta, reason, ref_type, ref_id, notes)` — the atomic stock-write primitive both recipe and modifier deltas must call
- `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` — `UNIQUE (ref_type, ref_id, ingredient_id)` partial index on `stock_movements` — the constraint that governs the same-ingredient-collision discretion item above
- `src/shared/lib/domain.ts` — `ModifierSchema` (line 207, has `id/name/priceDelta/sortOrder`, no ingredient link today), `RecipeItemSchema` (line 1602, nearest structural analog for the new join schema), `IngredientSchema` (line 1530)
- `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` — admin UI to extend with per-modifier ingredient-rule configuration; currently uses `const db = supabase as any` pre-regen cast pattern (follow same pattern for the new table until types are regenerated)
- `src/features/manage-recipe/ui/RecipeEditorTab.tsx` — nearest existing "attach N ingredient rows with deltas to a thing" UI pattern to model the modifier-rule editor after
- `src/entities/kds/model/queries.ts` (lines ~34-88) — confirms modifiers are stored on `order_items.modifier_ids` (`uuid[]`), NOT a junction table; the modifier-rule loop in `deplete_for_order_item` must read this array off the order_item, not join through a nonexistent table (same landmine the recent KDS fix, commit `6dfaba3`, already hit once)

### Established Patterns (from Phase 4/14 context, still relevant)
- Recipe depletion loop pattern: resolve `product_id`/`quantity` from `order_items`, loop ingredients, compute `v_delta = -direction × qty × item.qty / yield_qty`, call `record_stock_movement`, catch `INVENTORY_NEGATIVE` and bypass only when `p_allow_negative` — the modifier loop should mirror this shape (`direction × qty × rule.delta`, no `yield_qty` division since modifier deltas are absolute-per-line, not recipe-yield-relative)
- `record_audit`/audit_log post-mutation, success-path-only, non-fatal pattern (Phase 14) — applies to the existing `'stock_override'` insert this phase reuses (D-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `record_stock_movement` RPC: atomic ingredient-quantity writer with row locking — modifier deltas call this exact same primitive, no new stock-write path needed.
- `RecipeEditorTab.tsx` + its ingredient-autocomplete/row-list pattern: closest existing UI to clone for per-modifier ingredient-rule rows.
- `ModifierGroupEditor.tsx`: existing admin surface (`db = supabase as any` cast pattern) to extend rather than building a new admin page.

### Established Patterns
- Depletion RPCs use `SECURITY DEFINER`, `SET search_path = public`, and a `p_allow_negative` override param with an audit-logged bypass branch — new modifier logic must live inside the same RPC and follow the same override semantics (D-05).
- `order_items.modifier_ids` (`uuid[]`) is the single source of truth for which modifiers were selected on a line — no junction table exists or should be created for this lookup.
- Admin CRUD UIs for new/untyped tables use `const db = supabase as any` + file-level eslint-disable until `supabase.types.ts` is regenerated (per CLAUDE.md workaround, followed in `ModifierGroupEditor.tsx` today).

### Integration Points
- `deplete_for_order_item` — single extension point; called from `create_order_with_items` v2, `add_combo_to_tab`, `process_refund` (all already pass `p_allow_negative`, no caller-side changes expected for the modifier-rule addition itself).
- `ModifierGroupEditor.tsx` — new ingredient-rule editor slots in alongside existing modifier CRUD rows.

</code_context>

<specifics>
## Specific Ideas

No additional specific UI/behavior references beyond the decisions above — user confirmed the recommended (research-grounded) option on all 5 discussed decisions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-modifier-inventory-rules*
*Context gathered: 2026-07-06*
