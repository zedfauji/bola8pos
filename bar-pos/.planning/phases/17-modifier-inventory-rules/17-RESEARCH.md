# Phase 17: Modifier → Inventory Rules - Research

**Researched:** 2026-07-06
**Domain:** Postgres/Supabase RPC extension (PL/pgSQL) + React admin CRUD UI (FSD feature slice)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Delta shape (table schema)**
- **D-01 (scaling):** Modifier rule deltas scale by `order_items.quantity`, exactly like `recipe_items` does today - a rule delta of `x` on a 2-quantity line depletes `2 x`. Same `v_delta` formula shape as the existing recipe loop.
- **D-02 (signed delta):** `modifier_inventory_rules.delta` (or equivalent column) is a **signed numeric**. Positive = "extra X" (adds usage/depletion). Negative = "no X" / "remove X" (reduces usage/depletion). One rule shape covers both directions - no separate mechanism needed for removal modifiers.
- **D-03 (fan-out):** A single modifier can map to **multiple ingredients** - `modifier_inventory_rules` is a join table keyed by `(modifier_id, ingredient_id)` with a delta per row, structurally identical in shape to `recipe_items` (recipe_id, ingredient_id, qty). This covers compound modifiers like "Loaded" -> cheese + bacon. Admin UI must support adding N ingredient rows per modifier, not just one.

**Applicability**
- **D-04 (independent of recipe):** Modifier-driven depletion fires **independently of whether the product has a base recipe**. `deplete_for_order_item`'s early-return when no recipe exists for the product must only skip the *base recipe* loop - the modifier-rule loop (driven by `order_items.modifier_ids`) runs regardless, so a plain bottled product with an "extra lime" modifier still depletes lime stock even though the bottle itself has no recipe row.

**Negative-stock override**
- **D-05 (override parity):** Modifier-driven depletion shares the **exact same `p_allow_negative` override path** already used for recipe depletion - same manager-override bypass of `INVENTORY_NEGATIVE`, same `audit_log` `'stock_override'` insert pattern, same single flag threaded through `create_order_with_items` -> `CartPanel` override flow. No separate override mechanism for modifier-caused negative stock.

### Claude's Discretion

- Exact column/table naming for `modifier_inventory_rules` (e.g. `delta` vs `qty_delta`) - follow closest existing convention (`recipe_items.qty`).
- How to avoid a `stock_movements` unique-index collision when a recipe ingredient and a modifier rule ingredient are the *same ingredient* on the *same order_item* (existing unique index is `(ref_type, ref_id, ingredient_id)`). Not raised as a user concern - resolve at planning/implementation time (e.g. distinct `ref_type` for modifier-driven movements, or aggregate deltas per ingredient before calling `record_stock_movement`). Whichever approach is chosen must preserve idempotency on retry. **Research resolution: use distinct `ref_type` - see Architecture Patterns / Pattern 2 below.**
- Whether the admin UI for adding ingredient rows per modifier lives as an expandable row/panel under each modifier in `ModifierGroupEditor.tsx`, or a separate dialog opened per modifier - no specific UI reference was given; follow closest existing pattern (`RecipeEditorTab`'s ingredient-row editor is the nearest analog for "attach N ingredients with deltas to a thing"). **Research resolution: neither literal option as posed - the correct integration point is `CatalogModifiersTab.tsx` (features/manage-products), not `ModifierGroupEditor.tsx`; see Common Pitfalls / Pitfall 2 below.**
- Whether "no X" (negative-delta) modifiers can ever cause `quantity_on_hand` to *exceed* on-hand beyond what was originally depleted (e.g. rounding/edge cases) - treat as out of scope unless research surfaces a real risk. **Research resolution: no such risk surfaced - see Open Questions.**

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **FSD import direction:** `app -> pages -> widgets -> features -> entities -> shared`, enforced by `eslint-plugin-boundaries`. The new feature slice (`manage-modifier-inventory-rules`) may import from `entities/ingredient` (and a new `entities/modifier-inventory-rule` if created), but never the reverse.
- **Types single source of truth:** `src/shared/lib/domain.ts` (Zod). Never hand-write a `ModifierInventoryRule` interface - infer via `z.infer<typeof ModifierInventoryRuleSchema>`, mirroring `RecipeItemSchema`.
- **Generated files - never edit manually:** `src/shared/lib/supabase.types.ts` (regenerate via `npx supabase gen types typescript`); until regenerated, use the project's documented `const db = supabase as any` + file-level `/* eslint-disable */` workaround (already the pattern in `ModifierGroupEditor.tsx`, `CatalogModifiersTab.tsx`'s underlying `entities/product` queries, and `entities/recipe/model/queries.ts` - follow the same pattern for the new table's queries).
- **Error handling:** All async operations return `Result<T>` (`Ok`/`Err` from `src/shared/lib/result.ts`); use `src/shared/lib/logger.ts` for structured logging, never `console.log`.
- **State:** Server state (the new rules list) belongs in a TanStack Query hook with optimistic-update-friendly mutations, not a Zustand store - matches `useRecipe`/`useMutationSaveRecipe` precedent, not `tabsStore`-style realtime state.
- **`exactOptionalPropertyTypes: true`:** Any new mutation input type must write `prop: string | undefined`, never `prop?: string`.
- **`noUncheckedIndexedAccess: true`:** Any array/map access on `ModifierInventoryRule[]` or the delta `Map` returned by `computeModifierDepletion` must be checked before use.
- **No `any` without a same-line justification comment** - the pre-regen `supabase as any` casts already carry file-level justification comments in the codebase; new files following that pattern must do the same.
- **Testing:** Unit tests co-located with source (Vitest + RTL); property-based tests via `fast-check` for pure utilities (`computeModifierDepletion` must get a property test mirroring `computeDepletion`'s P6 test). E2E specs (if added) go in `bar-pos/e2e/`, numbered sequentially (next available: `41-*.spec.ts`).
- **Commit convention:** Conventional Commits `<type>(<ticket-id>): <description>`; no `--no-verify`; husky + lint-staged pre-commit hooks must pass.
- **RBAC:** The new admin UI sits under `ProductsSettingsTab`, already gated by `manage_products` (manager+) via `<ProtectedAction>` - no new RBAC action needed. The new table's RLS should independently enforce `get_user_role() IN ('manager','admin')` for writes (defense in depth, matching `recipe_items`'s pattern - RLS must not rely solely on the UI-level gate).

## Summary

This phase extends an existing, well-tested depletion pipeline rather than building anything new. All three pieces already exist and just need to be widened: `deplete_for_order_item` (RPC), `record_stock_movement` (atomic stock writer), and the modifier catalog admin UI. The highest-risk open question from CONTEXT.md — how to avoid a `stock_movements` unique-index collision when a recipe ingredient and a modifier-rule ingredient are the same ingredient on the same order_item — has a clean, low-risk answer: **tag modifier-driven movements with a distinct `ref_type` value (`'order_item_modifier'`) instead of pre-aggregating deltas.** This requires zero migration changes to the existing partial unique index or `record_stock_movement`, keeps the recipe loop's code untouched, and — as a side benefit — is invisible to `recipe_variance_daily` (which discriminates by `reason`, not `ref_type`) so modifier-driven consumption correctly rolls into existing variance reporting without any view changes.

The second major finding corrects a stale reference in `17-CONTEXT.md`'s canonical_refs: the function body to extend is **not** the one in `20260428000004_deplete_for_order_item_v2.sql`. A later migration, `20260510000002_rpc_role_guards.sql` (§3), did `CREATE OR REPLACE FUNCTION deplete_for_order_item(...)` and is the current live body — it adds a `get_user_role()` role guard (kitchen forbidden) at the top. The planner's migration must be written against *this* body, preserving the role guard, or it will silently regress role enforcement.

The third finding corrects the UI target: `ModifierGroupEditor.tsx` manages modifier **groups** (cardinality rules + attach-existing-modifier-to-group), not individual `Modifier` rows. The actual per-modifier CRUD surface — where `modifier_id` foreign keys are meaningful — is `CatalogModifiersTab.tsx` in `src/features/manage-products/ui/`, rendered under the separate "Modifiers" tab in `ProductsSettingsTab.tsx`. The new ingredient-rule editor should attach there, not to `ModifierGroupEditor.tsx`.

**Primary recommendation:** Extend `deplete_for_order_item`'s current (`20260510000002`) body in-place with a second loop reading `order_items.modifier_ids` and calling `record_stock_movement` with `ref_type = 'order_item_modifier'`; add `modifier_inventory_rules(id, modifier_id, ingredient_id, delta)` mirroring `recipe_items`'s shape and RLS; build the admin editor as a new FSD feature slice invoked from a per-row button in `CatalogModifiersTab.tsx`, reusing `RecipeEditorTab.tsx`'s row-list pattern with a signed-delta input instead of `MoneyInput`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modifier-to-ingredient rule storage | Database / Storage | — | New join table, same tier as `recipe_items` |
| Modifier-driven stock depletion | API / Backend (Postgres RPC) | Database / Storage | Must be atomic with recipe depletion inside `deplete_for_order_item`; DB-tier `record_stock_movement` does the actual write + lock |
| Negative-stock override for modifier deltas | API / Backend (Postgres RPC) | — | Reuses existing `p_allow_negative` branch — no new tier |
| Admin configuration UI (rules editor) | Frontend Server / Client (React) | API / Backend (Supabase REST via PostgREST) | Standard CRUD widget pattern already used by `RecipeEditorTab`/`ModifierGroupEditor` |
| Read path for KDS / order display of modifiers | Browser / Client | API / Backend | Unchanged — `order_items.modifier_ids` already resolved client-side (no new read path needed) |

## Standard Stack

### Core
No new libraries. This phase is 100% additive to the existing stack (React 19.1.0, TypeScript 5.8.3 strict, Zod v4, TanStack Query v5, Supabase/PostgREST, PL/pgSQL). All package versions are unchanged from `CLAUDE.md`'s "Actual Stack" table — no `npm install` required for this phase.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-check | ^4 (already installed) | Property-based test for the new pure delta-formula helper | Mirror `depletion.test.ts`'s P6 property for the modifier-rule formula |

### Alternatives Considered
Not applicable — no new packages evaluated. This is a pure schema/RPC/UI extension of code already in the repo.

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. Skip the Package Legitimacy Gate protocol; no `## Assumptions Log` entries are generated from package provenance.

## Architecture Patterns

### System Architecture Diagram

```
CatalogModifiersTab.tsx (Modifiers tab, manage_products RBAC gate)
  │
  ├─ existing: Modifier CRUD (name, priceDelta, sortOrder)   [unchanged]
  │
  └─ NEW: "Ingredient rules" button per modifier row
       │
       ▼
  ModifierIngredientRulesDialog (new feature: manage-modifier-inventory-rules)
       │  reads/writes modifier_inventory_rules(modifier_id, ingredient_id, delta)
       │  via delete-all-then-insert replace strategy (mirrors useMutationSaveRecipe)
       ▼
  Supabase Postgres: modifier_inventory_rules table (RLS: read all, write manager+admin)

───────────────────────────────────────────────────────────────────────────

Order placement flow (unchanged callers):
  create_order_with_items (v2, inserts order_items incl. modifier_ids uuid[])
  add_combo_to_tab (per combo child order_item)
  process_refund (restock=true path)
       │  each calls: deplete_for_order_item(order_item_id, direction, allow_negative)
       ▼
  deplete_for_order_item RPC (SECURITY DEFINER, role guard: bartender+)
       │
       ├─ 1. Resolve order_item → product_id, quantity, modifier_ids[]
       │
       ├─ 2. IF recipe exists for product_id:
       │        FOR each recipe_items row → compute v_delta (yield-scaled)
       │          → record_stock_movement(..., ref_type='order_item', ref_id=order_item_id)
       │      (early-return here is REMOVED — must only skip this branch, not the function)
       │
       ├─ 3. NEW: IF modifier_ids is non-empty:
       │        FOR each modifier_inventory_rules row WHERE modifier_id = ANY(modifier_ids)
       │          → compute v_delta = -direction × qty × rule.delta   (no yield_qty divisor)
       │          → record_stock_movement(..., ref_type='order_item_modifier', ref_id=order_item_id)
       │        (same ingredient as step 2 does NOT collide — different ref_type)
       │
       └─ 4. Both branches share the same p_allow_negative bypass + audit_log 'stock_override' insert
                ▼
       stock_movements (append-only ledger) ──▶ ingredients.quantity_on_hand (atomic UPDATE)
                ▼
       recipe_variance_daily view (GROUP BY reason='sale'/'physical_count' — NOT ref_type)
       automatically includes modifier-driven consumption, no view migration needed
```

### Recommended Project Structure
```
supabase/migrations/
├── 2026XXXXXXXXXX_modifier_inventory_rules_table.sql   # new table + RLS (mirrors recipe_items)
└── 2026XXXXXXXXXX_deplete_for_order_item_v3.sql        # CREATE OR REPLACE, based on 20260510000002 body

src/shared/lib/
├── domain.ts                     # + ModifierInventoryRuleSchema (mirrors RecipeItemSchema)
└── domain-helpers.ts             # + computeModifierDepletion pure fn (mirrors computeDepletion)
└── depletion.test.ts             # + property tests for computeModifierDepletion

src/entities/modifier-inventory-rule/    # NEW entity slice (or extend entities/recipe pattern)
├── model/queries.ts              # useModifierInventoryRules(modifierId) + useMutationSaveModifierInventoryRules
└── index.ts

src/features/manage-modifier-inventory-rules/   # NEW feature slice (one action per folder, per CLAUDE.md)
├── model/useManageModifierInventoryRules.ts
├── ui/ModifierIngredientRulesDialog.tsx   # clone of RecipeEditorTab's row-list, keyed by modifierId
└── index.ts

src/features/manage-products/ui/CatalogModifiersTab.tsx   # MODIFY: add "Ingredient rules" button per row
```

### Pattern 1: Delete-all-then-insert replace strategy for join-table rows
**What:** Save mutation upserts the parent (here: no parent upsert needed, modifier already exists), deletes all existing child rows for the FK, then bulk-inserts the new set.
**When to use:** Any "N rows attached to one parent, full-replace-on-save" editor — exactly what D-03 requires (N ingredient rows per modifier).
**Example:**
```typescript
// Source: src/entities/recipe/model/queries.ts (useMutationSaveRecipe) — clone this shape
// 1. DELETE FROM modifier_inventory_rules WHERE modifier_id = :modifierId
// 2. INSERT INTO modifier_inventory_rules (modifier_id, ingredient_id, delta) VALUES (...)
// No upsert step needed here (unlike recipes) because the modifier row already exists —
// only the child rows are replaced.
```

### Pattern 2: Distinct ref_type per movement source (collision avoidance)
**What:** `stock_movements` has a PARTIAL unique index `(ref_type, ref_id, ingredient_id) WHERE reason IN ('sale','refund','void','prep_production','prep_consumption')` (`20260426000002_stock_movements_idempotency_index.sql`). The `reason` column is constrained by a separate CHECK enum that does NOT include a "modifier" value and should not be extended for this phase (D-05 requires reusing the exact same reason computation `sale`/`refund`).
**When to use:** Whenever two independent depletion sources might touch the same `(ref_id, ingredient_id)` pair under an idempotency-constrained reason.
**Example:**
```sql
-- Source: supabase/migrations/20260426000002_stock_movements_idempotency_index.sql (verified)
-- Recipe loop (unchanged):
PERFORM record_stock_movement(v_item.ingredient_id, v_delta, v_reason, 'order_item', p_order_item_id, NULL);

-- NEW modifier loop — distinct ref_type avoids the unique-index collision even when
-- the SAME ingredient_id appears in both loops for the SAME order_item:
PERFORM record_stock_movement(v_mod_item.ingredient_id, v_mod_delta, v_reason, 'order_item_modifier', p_order_item_id, NULL);
```
This requires **zero migration changes** to the unique index itself — `reason` stays `'sale'`/`'refund'` (already inside the partial index's `WHERE reason IN (...)` scope), only `ref_type` differs, and the index is defined over the full `(ref_type, ref_id, ingredient_id)` tuple, so a differing `ref_type` naturally produces a distinct tuple. Retries remain idempotent: a re-run of the modifier loop for the same order_item hits the SAME `(ref_type='order_item_modifier', ref_id, ingredient_id)` tuple and is blocked by the unique index exactly like the recipe loop already is.

### Pattern 3: Independent-of-recipe early return (D-04)
**What:** The current body does `IF NOT FOUND THEN RETURN; END IF;` immediately after the recipe lookup — this exits the ENTIRE function, which today is correct (no recipe = nothing to deplete) but must change since modifier rules must still fire for recipe-less products.
**When to use:** This exact spot in `deplete_for_order_item`.
**Example:**
```sql
-- BEFORE (current, in 20260510000002_rpc_role_guards.sql):
SELECT id, yield_qty INTO v_recipe_id, v_yield_qty FROM recipes WHERE product_id = v_product_id;
IF NOT FOUND THEN RETURN; END IF;   -- exits whole function

-- AFTER (required for D-04):
SELECT id, yield_qty INTO v_recipe_id, v_yield_qty FROM recipes WHERE product_id = v_product_id;
IF FOUND THEN
  -- existing recipe_items loop goes here, unchanged
END IF;
-- modifier_ids loop runs unconditionally below, regardless of whether recipe existed
```

### Anti-Patterns to Avoid
- **Pre-aggregating deltas before calling `record_stock_movement`:** Considered as the alternative to distinct `ref_type`. Rejected — it requires restructuring the recipe loop into a two-phase "build delta map, then flush" shape (recipe currently loops-and-calls-immediately), loses per-source attribution in `stock_movements` (can't tell "this movement was recipe vs. modifier" for debugging/audit), and buys nothing extra since the distinct-`ref_type` approach already fully solves idempotency with a 1-line change.
- **Reusing `MoneyInput` for the signed delta field:** `MoneyInput.parseToCents` clamps `parsed < 0` to `0` (`src/shared/ui/MoneyInput.tsx:45`) — it cannot represent a negative delta at all. Use a plain `<Input type="number" step="0.01">` with no `min` attribute (or `min` set very negative), mirroring `RecipeEditorTab.tsx`'s qty `<Input>` but WITHOUT its `min="0.001"` bound.
- **Adding a new `stock_movements.reason` enum value (e.g. `'modifier'`):** Not needed and actively conflicts with D-05 ("modifier-driven depletion shares the exact same `p_allow_negative` override path... same reason computation"). The CHECK constraint change would also need a migration touching a constraint currently marked `NOT VALID` for historical-row performance reasons — avoid unless a future phase needs reason-level reporting granularity.
- **Assuming `modifier_ids` needs a junction table:** It doesn't. `order_items.modifier_ids uuid[]` (added in `20260414000004_tabs_and_orders.sql`) is authoritative — this is the exact landmine the KDS fix in commit `6dfaba3` already hit once (querying a nonexistent junction table). Read the array directly off `order_items`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic stock write + row lock | A new UPDATE+INSERT sequence | `record_stock_movement(ingredient_id, delta, reason, ref_type, ref_id, notes)` | Already does `SELECT ... FOR UPDATE`, negative-stock guard, and the ledger INSERT atomically — exactly what the modifier loop needs, unchanged signature |
| Negative-stock manager override | A second override mechanism for modifier-only negative stock | The existing `p_allow_negative` catch block + `audit_log 'stock_override'` insert already in `deplete_for_order_item` | D-05 explicitly requires reuse; the catch block is generic (`SQLERRM LIKE '%INVENTORY_NEGATIVE%'`) and will catch failures from either loop without modification |
| N-ingredient-rows-per-parent editor | A bespoke rows-with-add/remove component | Clone `RecipeEditorTab.tsx`'s `useReducer` + row-list pattern | Already handles add/remove/select/qty-edit with `IngredientAutocomplete`; only the qty field's sign constraint needs to change |
| Ingredient search/select control | A new autocomplete | `IngredientAutocomplete` from `@shared/ui` (already has Storybook stories + unit tests) | Existing, tested, FSD-boundary-compliant (accepts `ingredients`/`isLoading` as props per shared-cannot-import-entities rule) |

**Key insight:** Every piece of infrastructure this phase needs (atomic stock writer, override/audit path, row-editor UI pattern, ingredient picker) was built in Phase 4 and is battle-tested via `depletion.integration.test.ts`. The entire phase is glue code around existing primitives — the risk is in getting the SQL loop placement and `ref_type` tagging right, not in building anything new.

## Common Pitfalls

### Pitfall 1: Extending the wrong migration file
**What goes wrong:** Writing the new `CREATE OR REPLACE FUNCTION deplete_for_order_item` migration by copying the body from `20260428000004_deplete_for_order_item_v2.sql` (as CONTEXT.md's canonical_refs suggests) silently drops the `get_user_role()` kitchen-forbidden guard added later in `20260510000002_rpc_role_guards.sql`.
**Why it happens:** Postgres functions have no version history in the DB itself — only the migration files show intent, and the file with "v2" in its name looks authoritative but was superseded by a later `CREATE OR REPLACE` in a role-guards migration with an unrelated-sounding filename.
**How to avoid:** Base the new function body on `20260510000002_rpc_role_guards.sql` §3 (verified as the last `CREATE OR REPLACE FUNCTION deplete_for_order_item` in the migrations directory — confirmed via full-repo grep, no later redefinition exists).
**Warning signs:** If the new migration's body doesn't include the `IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN RAISE EXCEPTION 'AUTH_FORBIDDEN...'` block, it was copied from the wrong source file.

### Pitfall 2: Attaching the UI to ModifierGroupEditor.tsx instead of CatalogModifiersTab.tsx
**What goes wrong:** `ModifierGroupEditor.tsx` (in `features/manage-modifier-groups/`) manages `modifier_groups` (cardinality rules) and an "attach existing modifiers to a group" checkbox dialog — it never renders an editable list of individual `Modifier` rows with an edit affordance that could sensibly grow an "ingredient rules" button. The individual `Modifier` CRUD list (with `id`, `name`, `priceDelta`, edit/delete buttons) lives in `CatalogModifiersTab.tsx` (in `features/manage-products/ui/`), rendered under a *separate* "Modifiers" tab in `ProductsSettingsTab.tsx`.
**Why it happens:** The phase description's phrase "admin UI inside `manage-modifier-groups`" is imprecise — it's describing the general modifier-management area of Settings, not the literal `manage-modifier-groups` feature folder.
**How to avoid:** Add the "Ingredient rules" per-row button to `CatalogModifiersTab.tsx`'s existing `<li>` row (next to the Edit/Delete `POSButton`s), opening a new dialog — this is the correct integration point since `modifier_inventory_rules.modifier_id` FKs to the exact rows rendered there.
**Warning signs:** If the plan references adding rows/state to `ModifierGroupEditor.tsx`'s `GroupForm` or `ModifierSelector`, it's targeting the wrong file.

### Pitfall 3: Reusing MoneyInput for the signed delta
**What goes wrong:** `MoneyInput`'s `parseToCents` forces `parsed < 0 → 0` — a "no ice" (-1) rule would silently become 0 (no-op) if entered via `MoneyInput`.
**Why it happens:** `MoneyInput` was built for prices (always ≥ 0); nothing in its name signals the negative-clamping behavior. Notably, `Modifier.priceDelta` (which CAN be negative per its Zod schema `z.number().multipleOf(0.01)`, no min bound) already suffers this same bug in `ModifierDialogForm` today — a pre-existing, unrelated gap.
**How to avoid:** Use a plain `<Input type="number" step="0.01">` (no `min` prop) for the delta field, matching the qty `<Input>` pattern in `RecipeEditorTab.tsx` but without its `min="0.001"` bound.
**Warning signs:** Any test entering `-1` into the delta field and seeing it round-trip as `0`.

### Pitfall 4: Forgetting `order_items.modifier_ids` defaults to `'{}'` (empty array, not NULL)
**What goes wrong:** A PL/pgSQL `FOR ... IN SELECT ... WHERE modifier_id = ANY(v_modifier_ids)` over an empty array correctly yields zero rows (no bug) — but if the implementation instead checks `IF v_modifier_ids IS NULL THEN ... END IF;` as a guard, it will never trigger since the column has `NOT NULL DEFAULT '{}'` (confirmed in `20260414000004_tabs_and_orders.sql:54`). This isn't a functional bug (empty-array iteration is already a no-op) but wastes a defensive check.
**Why it happens:** Habitual NULL-checking on array columns without checking the actual DDL default.
**How to avoid:** Loop directly over `modifier_id = ANY(v_modifier_ids)` without a NULL guard — the empty-array case is already safe and satisfies D-04's parity requirement ("existing recipe-only depletion... behavior unchanged" when no modifiers selected).

## Code Examples

### Current deplete_for_order_item (authoritative body to extend)
```sql
-- Source: supabase/migrations/20260510000002_rpc_role_guards.sql lines 321-413 (VERIFIED — latest CREATE OR REPLACE, no later redefinition found in migrations/)
CREATE OR REPLACE FUNCTION deplete_for_order_item(
  p_order_item_id  uuid,
  p_direction      smallint,
  p_allow_negative boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id  uuid;
  v_qty         int;
  v_recipe_id   uuid;
  v_yield_qty   numeric;
  v_item        record;
  v_delta       numeric;
  v_reason      text;
BEGIN
  IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: bartender or higher required to call deplete_for_order_item';
  END IF;

  SELECT product_id, quantity INTO v_product_id, v_qty
    FROM order_items WHERE id = p_order_item_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT id, yield_qty INTO v_recipe_id, v_yield_qty
    FROM recipes WHERE product_id = v_product_id;
  IF NOT FOUND THEN RETURN; END IF;   -- <-- must become "IF FOUND THEN ... END IF" wrapper (D-04)

  v_reason := CASE WHEN p_direction = 1 THEN 'sale' ELSE 'refund' END;

  FOR v_item IN SELECT ingredient_id, qty FROM recipe_items WHERE recipe_id = v_recipe_id LOOP
    v_delta := -p_direction::numeric * v_qty::numeric * v_item.qty / v_yield_qty;
    BEGIN
      PERFORM record_stock_movement(v_item.ingredient_id, v_delta, v_reason, 'order_item', p_order_item_id, NULL);
    EXCEPTION WHEN OTHERS THEN
      IF p_allow_negative AND SQLERRM LIKE '%INVENTORY_NEGATIVE%' THEN
        UPDATE ingredients SET quantity_on_hand = quantity_on_hand + v_delta WHERE id = v_item.ingredient_id;
        INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
        VALUES ('stock_override', 'order_item', p_order_item_id,
          jsonb_build_object('ingredient_id', v_item.ingredient_id, 'delta', v_delta, 'reason', 'manager_override'), now());
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;
```

### record_stock_movement (verified signature, unchanged — no migration needed)
```sql
-- Source: supabase/migrations/20260426000003_record_stock_movement_rpc.sql (VERIFIED)
CREATE OR REPLACE FUNCTION record_stock_movement(
  p_ingredient_id  uuid,
  p_delta          numeric,
  p_reason         text,
  p_ref_type       text,
  p_ref_id         uuid,
  p_notes          text DEFAULT NULL
)
RETURNS stock_movements
-- ... SELECT FOR UPDATE lock, negative-stock guard (bypassed for 'correction'/'physical_count' only),
--     INSERT into stock_movements, UPDATE ingredients.quantity_on_hand — all atomic in one function.
```

### recipe_items table + RLS (structural + RLS template for modifier_inventory_rules)
```sql
-- Source: supabase/migrations/20260428000001_recipes_tables.sql lines 43-61 (VERIFIED)
CREATE TABLE recipe_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  qty           numeric NOT NULL CHECK (qty > 0),
  UNIQUE (recipe_id, ingredient_id)
);
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_items_select_authenticated" ON recipe_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipe_items_write_manager" ON recipe_items FOR ALL TO authenticated
  USING (get_user_role() IN ('manager', 'admin'))
  WITH CHECK (get_user_role() IN ('manager', 'admin'));

-- New table (recommended shape — mirrors the above, delta is signed so no positive-only CHECK):
-- CREATE TABLE modifier_inventory_rules (
--   id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   modifier_id   uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
--   ingredient_id uuid NOT NULL REFERENCES ingredients(id),
--   delta         numeric NOT NULL CHECK (delta <> 0),   -- signed; zero rows are meaningless (suggestion, not a locked decision)
--   UNIQUE (modifier_id, ingredient_id)
-- );
-- Same RLS pair as recipe_items (select authenticated, write manager+admin).
```

### Zod schema to mirror (RecipeItemSchema)
```typescript
// Source: src/shared/lib/domain.ts lines 1602-1607 (VERIFIED)
export const RecipeItemSchema = z.object({
  id: UuidSchema,
  recipeId: UuidSchema,
  ingredientId: UuidSchema,
  qty: z.number().positive(),
});
// New schema (recommended shape):
// export const ModifierInventoryRuleSchema = z.object({
//   id: UuidSchema,
//   modifierId: UuidSchema,
//   ingredientId: UuidSchema,
//   delta: z.number().multipleOf(0.001).refine(v => v !== 0, 'delta must be nonzero'),
// });
```

### Pure formula helper to mirror (computeDepletion)
```typescript
// Source: src/shared/lib/domain-helpers.ts lines 386-402 (VERIFIED)
export function computeDepletion(
  recipe: RecipeWithItems,
  orderQty: number,
  direction: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const item of recipe.items) {
    const delta = -direction * orderQty * item.qty / recipe.yieldQty;
    deltas.set(item.ingredientId, delta);
  }
  return deltas;
}
// New helper (recommended — NO yield_qty divisor per canonical_refs "Established Patterns" note):
// export function computeModifierDepletion(
//   rules: ModifierInventoryRule[],
//   orderQty: number,
//   direction: 1 | -1,
// ): Map<string, number> {
//   const deltas = new Map<string, number>();
//   for (const rule of rules) {
//     deltas.set(rule.ingredientId, -direction * orderQty * rule.delta);
//   }
//   return deltas;
// }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `deplete_for_order_item(uuid, smallint)` 2-arg only | `deplete_for_order_item(uuid, smallint, boolean)` 3-arg, 2-arg overload dropped | `20260506000003_fix_deplete_overload_ambiguity.sql` | All callers already use the 3-arg-compatible call shape (2-arg calls resolve unambiguously via default `p_allow_negative=false`) |
| No role guard on `deplete_for_order_item` | `get_user_role()` guard forbidding `kitchen` role | `20260510000002_rpc_role_guards.sql` | This phase's new migration MUST preserve this guard — it is the current live behavior, not the older `20260428000004` body |

**Deprecated/outdated:** None relevant — no libraries or APIs used by this phase have been deprecated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CHECK (delta <> 0)` on `modifier_inventory_rules` is a reasonable addition (not explicitly requested by any D-0x decision) | Code Examples, Architecture Patterns | Low — purely a data-quality nicety; omitting it has zero functional impact, just allows silently-useless zero-delta rows to be saved |
| A2 | New feature slice should be named `manage-modifier-inventory-rules` (not explicitly named in CONTEXT.md) | Recommended Project Structure | Low — cosmetic naming choice; planner/discuss-phase may pick a different folder name without any functional consequence |

**If this table is empty:** N/A — see above; both entries are low-risk naming/nicety choices, not technical-approach uncertainties. All load-bearing technical claims (RPC signatures, migration bodies, RLS patterns, table shapes, UI file locations) were verified directly against repository source in this session.

## Open Questions

1. **Should `modifier_inventory_rules` support a `notes` column like `recipes.notes`?**
   - What we know: `recipe_items` itself has no `notes` column (only the parent `recipes` table does); `modifier_inventory_rules` has no parent table to hang notes off.
   - What's unclear: Whether admins will want a free-text explanation per rule (e.g., "double-shot rule assumes 2oz pour").
   - Recommendation: Omit for now — not requested in any D-0x decision; can be added in a follow-up migration if requested.

2. **Should the `CHECK (delta <> 0)` constraint (A1 above) be included?**
   - What we know: `recipe_items.qty` has `CHECK (qty > 0)` (positive-only, makes sense since qty can't be zero-or-negative there); the modifier case is signed, so the equivalent guard is `<> 0` not `> 0`.
   - What's unclear: Whether this is a "Claude's Discretion" naming/shape item covered by CONTEXT.md's "column/table naming" discretion bullet, or requires explicit sign-off.
   - Recommendation: Include it — it's a strict improvement (rejects meaningless rows) with no behavioral downside, consistent with the `recipe_items` precedent of enforcing sane data at the DB level.

## Environment Availability

Skipped — this phase has no external dependencies beyond the already-configured Supabase project and existing npm toolchain. No new CLIs, services, or runtimes are introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (unit + integration, `--project unit`) + Playwright v1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts` |
| Quick run command | `npx vitest run src/shared/lib/depletion.test.ts` |
| Full suite command | `npm run test` (unit) — integration tests under `src/entities/tab/model/depletion.integration.test.ts` require live Supabase creds and are `describe.skipIf(skip)` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `modifier_inventory_rules` table maps modifier options to ingredient deltas | unit (Zod schema) | `npx vitest run src/shared/lib/domain.test.ts` | ❌ Wave 0 (add schema test alongside existing `RecipeItemSchema` tests, or new file) |
| SC-2 | `deplete_for_order_item` applies modifier deltas atomically alongside recipe depletion | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ✅ EXISTS — extend with new `it('I5: modifier-driven depletion...')` cases (file already covers I1-I4 recipe-only cases) |
| SC-2 | Pure formula correctness (mirrors computeDepletion) | unit + property (fast-check) | `npx vitest run src/shared/lib/depletion.test.ts` | ✅ EXISTS — extend with `computeModifierDepletion` describe block, mirroring existing P6 property test |
| SC-3 | Admin UI lets managers configure per-modifier rules | unit (RTL) | `npx vitest run src/features/manage-modifier-inventory-rules/**/*.test.tsx` | ❌ Wave 0 — no test file exists yet for the new feature slice (note: `CatalogModifiersTab.tsx` and `ModifierGroupEditor.tsx` also currently have NO `.test.tsx` files — this is consistent with existing project pattern of relying on integration/E2E for this admin-UI area, not a gap unique to this phase) |
| SC-4 | Existing recipe-only depletion (no modifiers) unchanged | integration (regression) | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ✅ EXISTS — I1-I4 already assert exactly 2 rows with `ref_type='order_item'` for a product with a 2-ingredient recipe and no modifiers; these must continue passing unmodified |

### Sampling Rate
- **Per task commit:** `npx vitest run src/shared/lib/depletion.test.ts`
- **Per wave merge:** `npm run test` (full unit suite) + `npx vitest run src/entities/tab/model/depletion.integration.test.ts` (requires `SUPABASE_SERVICE_ROLE_KEY` env)
- **Phase gate:** Full suite green + `npm run typecheck` + `npm run lint` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `ModifierInventoryRuleSchema` + `ModifierInventoryRuleCreateSchema` to `src/shared/lib/domain.ts`, with unit tests (parse valid/invalid delta, zero-delta rejection if A1's CHECK constraint is adopted)
- [ ] Add `computeModifierDepletion` to `src/shared/lib/domain-helpers.ts` + property test block in `depletion.test.ts` (mirror existing `computeDepletion` P6 test: linear scaling, sign inversion sale↔refund, empty-rules → empty map)
- [ ] Extend `src/entities/tab/model/depletion.integration.test.ts` with modifier-rule test setup (insert a test `modifiers` row + `modifier_inventory_rules` row + an `order_items` row with `modifier_ids` populated) — reuse the existing `beforeAll`/`afterAll` scaffolding, add to cleanup lists
- [ ] No E2E gap identified as strictly required — this is an admin-config + backend-RPC phase; a minimal E2E click-through of the new "Ingredient rules" dialog MAY be added as `41-modifier-inventory-rules.spec.ts` (next available number after `40-kds-bar.spec.ts`) at the planner's discretion, but existing precedent (`RecipeEditorTab`, `ModifierGroupEditor`) shipped without dedicated E2E specs, relying on unit + integration coverage

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — Supabase Auth / PIN login, no new auth surface |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | RLS on `modifier_inventory_rules` mirroring `recipe_items` (`SELECT` all authenticated, `ALL` write restricted to `get_user_role() IN ('manager','admin')`); RPC-level role guard already present in `deplete_for_order_item` (kitchen forbidden) is preserved, not weakened |
| V5 Input Validation | yes | Zod `ModifierInventoryRuleSchema` client-side + Postgres `CHECK` constraints (FK existence, optionally `delta <> 0`) server-side — defense in depth matching `recipe_items`'s `CHECK (qty > 0)` precedent |
| V6 Cryptography | no | Not applicable — no secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bartender writes `modifier_inventory_rules` directly via PostgREST, bypassing intended manager-only config gate | Elevation of Privilege | RLS `WITH CHECK (get_user_role() IN ('manager','admin'))` on the new table — same pattern already enforced on `recipe_items`/`recipes` |
| Client sends a fabricated/foreign `modifier_id` in `order_items.modifier_ids` to trigger unintended stock movements | Tampering | `modifier_inventory_rules.modifier_id` has an FK constraint to `modifiers(id)` — a nonexistent modifier simply yields zero matching rows in the new loop (`SELECT ... WHERE modifier_id = ANY(v_modifier_ids)`), a no-op, not an error; no new attack surface since `order_items.modifier_ids` was already client-writable pre-phase (existing risk, unchanged by this phase) |
| Repudiation of a manager-approved negative-stock override caused by a modifier delta | Repudiation | Already mitigated — the shared `p_allow_negative` branch writes `audit_log` with action `'stock_override'` inside the same `SECURITY DEFINER` context regardless of whether the negative stock came from the recipe loop or the modifier loop (D-05) |
| Modifier-rule ingredient not found (deleted ingredient row, dangling FK) | Denial of Service (partial) | `ingredients` FK is `ON DELETE` unspecified (default `NO ACTION`) on `recipe_items` — same default expected for `modifier_inventory_rules`, meaning ingredient deletion is blocked while rules reference it, preventing silent dangling references (verify this matches recipe_items' actual FK action at migration-write time — not specified in the migration snippet reviewed, default is `NO ACTION`) |

## Sources

### Primary (HIGH confidence — verified directly against repository source in this session)
- `supabase/migrations/20260510000002_rpc_role_guards.sql` — current authoritative `deplete_for_order_item` body (role guard confirmed, latest `CREATE OR REPLACE`)
- `supabase/migrations/20260428000004_deplete_for_order_item_v2.sql` — superseded body (still useful for delta-formula reference, NOT for role-guard behavior)
- `supabase/migrations/20260506000003_fix_deplete_overload_ambiguity.sql` — confirms only the 3-arg signature exists
- `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` — `record_stock_movement` signature and body
- `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` — partial unique index definition (governs the collision discretion item)
- `supabase/migrations/20260424000001_stock_movements.sql` — `reason` CHECK enum values (confirms no 'modifier' reason exists)
- `supabase/migrations/20260428000001_recipes_tables.sql` — `recipe_items` shape + RLS pattern (template for new table)
- `supabase/migrations/20260414000004_tabs_and_orders.sql` — confirms `order_items.modifier_ids uuid[] NOT NULL DEFAULT '{}'`
- `supabase/migrations/20260414000003_products_and_categories.sql` — `modifiers` table shape
- `supabase/migrations/20260424000003_modifier_groups.sql` — `modifier_groups`/`modifier_group_items` shape (confirms these are distinct from individual `Modifier` CRUD)
- `supabase/migrations/20260505000001_s6_reporting_views.sql` — `recipe_variance_daily` view definition (confirms it filters by `reason`, not `ref_type`)
- `src/shared/lib/domain.ts` — `ModifierSchema`, `RecipeItemSchema`, `IngredientSchema` exact shapes
- `src/shared/lib/domain-helpers.ts` + `src/shared/lib/depletion.test.ts` — `computeDepletion` pure function + property test pattern to mirror
- `src/entities/tab/model/depletion.integration.test.ts` — integration test pattern + confirms one-order-item-per-test constraint from the unique index
- `src/entities/recipe/model/queries.ts` — `useMutationSaveRecipe` delete-all-then-insert pattern to mirror
- `src/features/manage-recipe/ui/RecipeEditorTab.tsx` — row-list editor UI pattern to clone
- `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` — confirms this manages GROUPS, not individual modifiers
- `src/features/manage-products/ui/CatalogModifiersTab.tsx` — confirms this is the actual individual-`Modifier` CRUD surface (correct UI integration point)
- `src/widgets/SettingsTabsPanel/tabs/ProductsSettingsTab.tsx` — confirms "Modifiers" and "Modifier Groups" are separate tabs
- `src/shared/ui/MoneyInput.tsx` — confirms negative-value clamping bug (pitfall source)
- `src/shared/lib/rbac.ts` — confirms `manage_products` is `MANAGER_EXTRA` (manager+admin), matching the RLS pattern recommended for the new table
- `src/entities/kds/model/queries.ts` — confirms `modifier_ids` array read pattern (no junction table)
- `.planning/config.json` — confirms `nyquist_validation: true` (Validation Architecture section required), `security_enforcement` absent (Security Domain section required)

### Secondary (MEDIUM confidence)
None — all claims in this research were verified directly against repository source; no external web sources were needed since this phase is entirely internal-codebase extension work.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions already pinned in `package.json`/CLAUDE.md
- Architecture (RPC extension + collision resolution): HIGH — verified against live migration files, cross-checked against the unique index definition and the reporting view that consumes `stock_movements`
- UI integration point: HIGH — verified by reading both `ModifierGroupEditor.tsx` and `CatalogModifiersTab.tsx` in full; the discrepancy with CONTEXT.md's canonical_refs is a directly-observed file-content mismatch, not a guess
- Pitfalls: HIGH — each pitfall (stale migration file, wrong UI target, MoneyInput negative-clamp bug) was reproduced by reading the exact source lines, not inferred

**Research date:** 2026-07-06
**Valid until:** 30 days (stable internal codebase; only invalidated by a future migration further modifying `deplete_for_order_item` or the modifier admin UI before this phase executes)
