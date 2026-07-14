# Phase 17: Modifier → Inventory Rules - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/2026XXXX_modifier_inventory_rules_table.sql` | migration | CRUD (schema) | `supabase/migrations/20260428000001_recipes_tables.sql` (`recipe_items` table + RLS) | exact — identical join-table shape (`parent_id, ingredient_id, delta/qty`) |
| `supabase/migrations/2026XXXX_deplete_for_order_item_v3.sql` | migration (RPC) | event-driven (atomic depletion on order mutation) | `supabase/migrations/20260510000002_rpc_role_guards.sql` §3 (current `deplete_for_order_item` body) | exact — same function, in-place extension |
| `src/shared/lib/domain.ts` (+ `ModifierInventoryRuleSchema`) | model (Zod schema) | CRUD | `RecipeItemSchema` (lines 1602-1607) + `RecipeItemCreateSchema` (line 1660) | exact — same join-row shape, signed instead of positive |
| `src/shared/lib/domain-helpers.ts` (+ `computeModifierDepletion`) | utility (pure fn) | transform | `computeDepletion` (lines 391-402) | exact — same Map<ingredientId, delta> shape, no yield_qty divisor |
| `src/shared/lib/depletion.test.ts` (extend) | test | transform | existing `computeDepletion` P6 property-test block | exact |
| `src/entities/modifier-inventory-rule/model/queries.ts` (new) | service (TanStack Query hooks) | CRUD | `src/entities/recipe/model/queries.ts` (`useRecipe`, `useMutationSaveRecipe`) | exact — same pre-regen `db = supabase as any`, delete-then-insert replace strategy |
| `src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts` (new) | hook (mutation wrapper) | CRUD | `src/features/manage-recipe/model/useManageRecipe.ts` (not read directly but referenced by `RecipeEditorTab.tsx` as `useManageRecipe`) | role-match — thin wrapper around `useMutationSaveModifierInventoryRules` |
| `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` (new) | component (dialog, row-list editor) | CRUD (form) | `src/features/manage-recipe/ui/RecipeEditorTab.tsx` (row-list `useReducer` pattern) + `CatalogModifiersTab.tsx`'s `ModifierDialog`/`Dialog` wrapper | exact — reducer/row-add/remove pattern from RecipeEditorTab, Dialog chrome from CatalogModifiersTab |
| `src/features/manage-products/ui/CatalogModifiersTab.tsx` (MODIFY) | component (list + CRUD) | request-response | itself (existing file) | exact — add one button + one dialog invocation per row |
| `src/entities/tab/model/depletion.integration.test.ts` (extend) | test (integration) | event-driven | existing I1-I4 recipe-only test cases in same file | exact |

## Pattern Assignments

### `supabase/migrations/2026XXXX_modifier_inventory_rules_table.sql` (migration, CRUD schema)

**Analog:** `supabase/migrations/20260428000001_recipes_tables.sql` lines 43-61 (`recipe_items`)

**Core pattern to copy (structure + RLS):**
```sql
-- Source: supabase/migrations/20260428000001_recipes_tables.sql:43-61 (VERIFIED)
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
```

**New table (adapt as follows — signed delta, FK to `modifiers` not `recipes`):**
```sql
CREATE TABLE modifier_inventory_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id   uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  delta         numeric NOT NULL CHECK (delta <> 0),
  UNIQUE (modifier_id, ingredient_id)
);
ALTER TABLE modifier_inventory_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modifier_inventory_rules_select_authenticated" ON modifier_inventory_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modifier_inventory_rules_write_manager" ON modifier_inventory_rules FOR ALL TO authenticated
  USING (get_user_role() IN ('manager', 'admin'))
  WITH CHECK (get_user_role() IN ('manager', 'admin'));
```

---

### `supabase/migrations/2026XXXX_deplete_for_order_item_v3.sql` (migration, RPC)

**Analog:** `supabase/migrations/20260510000002_rpc_role_guards.sql` §3 — CURRENT authoritative body. **Do NOT** base this on `20260428000004_deplete_for_order_item_v2.sql` (superseded, missing role guard — see Pitfall 1 in RESEARCH.md).

**Full current body to extend (verified, lines 251-300 per RESEARCH.md Code Examples):**
```sql
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
  IF NOT FOUND THEN RETURN; END IF;   -- MUST become "IF FOUND THEN ... END IF" wrapper (D-04)

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

**Required change 1 — D-04 (recipe-independent):** wrap the recipe loop in `IF FOUND THEN ... END IF` instead of early `RETURN`, so the modifier loop below still runs for recipe-less products.

**Required change 2 — new modifier loop (add after the recipe block, before final `END`):**
```sql
DECLARE
  v_modifier_ids uuid[];
  v_mod_item     record;
  v_mod_delta    numeric;
BEGIN
  -- fetch alongside product_id/quantity in the initial SELECT:
  -- SELECT product_id, quantity, modifier_ids INTO v_product_id, v_qty, v_modifier_ids FROM order_items WHERE id = p_order_item_id;

  FOR v_mod_item IN
    SELECT ingredient_id, delta FROM modifier_inventory_rules WHERE modifier_id = ANY(v_modifier_ids)
  LOOP
    v_mod_delta := -p_direction::numeric * v_qty::numeric * v_mod_item.delta;
    BEGIN
      PERFORM record_stock_movement(v_mod_item.ingredient_id, v_mod_delta, v_reason, 'order_item_modifier', p_order_item_id, NULL);
    EXCEPTION WHEN OTHERS THEN
      IF p_allow_negative AND SQLERRM LIKE '%INVENTORY_NEGATIVE%' THEN
        UPDATE ingredients SET quantity_on_hand = quantity_on_hand + v_mod_delta WHERE id = v_mod_item.ingredient_id;
        INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
        VALUES ('stock_override', 'order_item', p_order_item_id,
          jsonb_build_object('ingredient_id', v_mod_item.ingredient_id, 'delta', v_mod_delta, 'reason', 'manager_override'), now());
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;
END;
```

**Key rule:** distinct `ref_type = 'order_item_modifier'` (vs recipe's `'order_item'`) avoids the `stock_movements` partial unique index collision `(ref_type, ref_id, ingredient_id)` even when the same ingredient appears in both loops for the same order_item. No index/constraint migration needed — see RESEARCH.md Pattern 2.

**Reference (unchanged, no migration needed):** `record_stock_movement` signature — `supabase/migrations/20260426000003_record_stock_movement_rpc.sql`.

---

### `src/shared/lib/domain.ts` (+ `ModifierInventoryRuleSchema`)

**Analog:** `RecipeItemSchema` (lines 1602-1607), `RecipeItemCreateSchema` (line 1660)

```typescript
// Existing analog (verbatim, lines 1602-1607 + 1660):
export const RecipeItemSchema = z.object({
  id: UuidSchema,
  recipeId: UuidSchema,
  ingredientId: UuidSchema,
  qty: z.number().positive(),
});
export const RecipeItemCreateSchema = RecipeItemSchema.omit({ id: true });

// New schema — place in a new "MODIFIER INVENTORY RULES (Phase 17)" section,
// near ModifierSchema (line 207) or RecipeItemSchema (line 1602):
export const ModifierInventoryRuleSchema = z.object({
  id: UuidSchema,
  modifierId: UuidSchema,
  ingredientId: UuidSchema,
  delta: z.number().multipleOf(0.001).refine(v => v !== 0, 'delta must be nonzero'),
});
export const ModifierInventoryRuleCreateSchema = ModifierInventoryRuleSchema.omit({ id: true });
export type ModifierInventoryRule = z.infer<typeof ModifierInventoryRuleSchema>;
export type ModifierInventoryRuleCreate = z.infer<typeof ModifierInventoryRuleCreateSchema>;
```

Note `RecipeItemCreateSchema` keeps `recipeId` (used as `''` placeholder client-side, see `RecipeEditorTab.tsx:127`); mirror the same convention — `modifierId` can be blank/placeholder in the create-row shape client-side since the dialog is scoped to one modifier already, or pass it in explicitly per the parent's `modifierId` prop.

---

### `src/shared/lib/domain-helpers.ts` (+ `computeModifierDepletion`)

**Analog:** `computeDepletion` (lines 391-402)

```typescript
// Existing analog (verbatim):
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

// New helper — NO yield_qty divisor (modifier deltas are absolute-per-line):
export function computeModifierDepletion(
  rules: ModifierInventoryRule[],
  orderQty: number,
  direction: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const rule of rules) {
    deltas.set(rule.ingredientId, -direction * orderQty * rule.delta);
  }
  return deltas;
}
```

---

### `src/shared/lib/depletion.test.ts` (extend)

**Analog:** existing `computeDepletion` P6 property-test block in the same file.

**Pattern to mirror:** add a `describe('computeModifierDepletion', ...)` block using `fast-check` to assert: linear scaling with `orderQty`, sign inversion between sale (`direction=1`) and refund (`direction=-1`), and an empty-`rules` array yielding an empty Map. No file read was needed beyond the grep excerpt above — the shape is identical to `computeDepletion`'s existing property test, just swap the recipe-with-yieldQty fixture for a flat `rules: ModifierInventoryRule[]` fixture.

---

### `src/entities/modifier-inventory-rule/model/queries.ts` (new)

**Analog:** `src/entities/recipe/model/queries.ts` (full file read, 166 lines)

**Imports + pre-regen cast pattern** (lines 1-17):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModifierInventoryRuleSchema } from '@shared/lib/domain';
import type { ModifierInventoryRule, ModifierInventoryRuleCreate } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts is regenerated after modifier_inventory_rules migration
const db = supabase as any;
```

**Query key factory pattern** (lines 23-26):
```typescript
export const modifierInventoryRuleKeys = {
  all: ['modifier_inventory_rules'] as const,
  byModifier: (modifierId: string) => [...modifierInventoryRuleKeys.all, 'modifier', modifierId] as const,
};
```

**Query hook pattern** (`useRecipe`, lines 60-79) — adapt to `useModifierInventoryRules(modifierId)`:
```typescript
export function useModifierInventoryRules(modifierId: string | null) {
  return useQuery({
    queryKey: modifierInventoryRuleKeys.byModifier(modifierId ?? ''),
    enabled: modifierId != null && modifierId.length > 0,
    queryFn: async (): Promise<ModifierInventoryRule[]> => {
      const { data, error } = await db
        .from('modifier_inventory_rules')
        .select('*')
        .eq('modifier_id', modifierId);
      if (error) {
        logger.error('useModifierInventoryRules: query failed', { modifierId, error });
        throw error;
      }
      return (data ?? []).map((row: Record<string, unknown>) =>
        ModifierInventoryRuleSchema.parse({
          id: row['id'],
          modifierId: row['modifier_id'],
          ingredientId: row['ingredient_id'],
          delta: Number(row['delta']),
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

**Delete-all-then-insert mutation pattern** (`useMutationSaveRecipe`, lines 96-165 — NOTE: no parent upsert step is needed here since the modifier row already exists, unlike `recipes`):
```typescript
type SaveModifierInventoryRulesInput = {
  modifierId: string;
  rules: ModifierInventoryRuleCreate[];
};

export function useMutationSaveModifierInventoryRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveModifierInventoryRulesInput): Promise<Result<ModifierInventoryRule[]>> => {
      // 1. Delete existing rows for this modifier (replace strategy — no parent upsert needed)
      const { error: deleteError } = await db
        .from('modifier_inventory_rules')
        .delete()
        .eq('modifier_id', input.modifierId);
      if (deleteError) {
        logger.error('useMutationSaveModifierInventoryRules: delete failed', { error: deleteError });
        return err({ code: 'SUPABASE_ERROR', message: deleteError.message });
      }

      // 2. Insert new rows (if any)
      if (input.rules.length > 0) {
        const rows = input.rules.map(r => ({
          modifier_id: input.modifierId,
          ingredient_id: r.ingredientId,
          delta: r.delta,
        }));
        const { error: insertError } = await db.from('modifier_inventory_rules').insert(rows);
        if (insertError) {
          logger.error('useMutationSaveModifierInventoryRules: insert failed', { error: insertError });
          return err({ code: 'SUPABASE_ERROR', message: insertError.message });
        }
      }

      // 3. Re-fetch canonical rows
      const { data: fresh, error: fetchError } = await db
        .from('modifier_inventory_rules')
        .select('*')
        .eq('modifier_id', input.modifierId);
      if (fetchError) return err({ code: 'SUPABASE_ERROR', message: fetchError.message });

      const parsed = (fresh ?? []).map((row: Record<string, unknown>) =>
        ModifierInventoryRuleSchema.parse({
          id: row['id'],
          modifierId: row['modifier_id'],
          ingredientId: row['ingredient_id'],
          delta: Number(row['delta']),
        }),
      );
      return ok(parsed);
    },
    onSuccess: (result, variables) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: modifierInventoryRuleKeys.byModifier(variables.modifierId) });
    },
  });
}
```

---

### `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` (new)

**Analogs:** `RecipeEditorTab.tsx` (row-list `useReducer` pattern, full file read) + `CatalogModifiersTab.tsx`'s `ModifierDialog`/`Dialog` wrapper (full file read)

**Imports pattern** (from `RecipeEditorTab.tsx` lines 1-7, adapted):
```typescript
import { Trash2 } from 'lucide-react';
import { useEffect, useReducer, useRef } from 'react';
import { useIngredientsActive } from '@entities/ingredient';
import { useModifierInventoryRules } from '@entities/modifier-inventory-rule';
import type { Ingredient, ModifierInventoryRuleCreate } from '@shared/lib/domain';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { IngredientAutocomplete, Input, Label, LoadingSpinner, POSButton } from '@shared/ui';
import { useManageModifierInventoryRules } from '../model/useManageModifierInventoryRules';
```

**Row-list `useReducer` pattern to clone** (`RecipeEditorTab.tsx` lines 9-97): copy the `RecipeRow`/`EditorState`/`EditorAction`/`reducer` shape verbatim, renaming `qty` → `delta` (still string-backed for controlled input) and dropping the `yieldQty` field entirely (no yield concept for modifier rules).

**Row rendering pattern** (`RecipeEditorTab.tsx` lines 157-196) — reuse verbatim, with **one critical deviation** (Pitfall 3 in RESEARCH.md / UI-SPEC.md Component Inventory): the qty `<Input>` at lines 172-184 has `min="0.001"` — the delta field must **drop the `min` attribute entirely** and use `step="0.001"` only, since delta is signed:
```typescript
// RecipeEditorTab.tsx:172-184 (existing qty input, DO NOT copy the min="0.001" for delta):
<Input
  type="number"
  min="0.001"
  step="0.001"
  value={row.qty}
  onChange={e => { dispatch({ type: 'SET_QTY', rowId: row.id, value: e.target.value }); }}
  className="font-mono text-right"
  aria-label="Quantity"
/>
// Adapted for delta — NO min attribute:
<Input
  type="number"
  step="0.001"
  value={row.delta}
  onChange={e => { dispatch({ type: 'SET_DELTA', rowId: row.id, value: e.target.value }); }}
  className="font-mono text-right"
  aria-label="Delta"
/>
```

**Empty-state copy** (`RecipeEditorTab.tsx` line 154): `<p className="text-pos-muted text-sm italic">No recipe yet</p>` → adapt text to "No ingredient rules yet" per UI-SPEC.md.

**Add-row button copy** (`RecipeEditorTab.tsx` lines 198-206): `+ Add ingredient` — reuse verbatim per UI-SPEC.md's copywriting contract.

**Save/Discard button pattern** (`RecipeEditorTab.tsx` lines 226-248): reuse `disabled={!state.isDirty || isSaving}` gating and `LoadingSpinner` + "Saving…" pattern verbatim; label "Save rules" instead of "Save recipe" per UI-SPEC.md.

**Dialog chrome to wrap the above in** (`CatalogModifiersTab.tsx` lines 188-207, `ModifierDialog` component): reuse the `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` wrapper shape, conditionally rendering the form body only when `open` (avoids stale state across opens, same as `ModifierDialogForm`'s `key={...}` remount trick at line 196).

---

### `src/features/manage-products/ui/CatalogModifiersTab.tsx` (MODIFY)

**Analog:** itself (existing file, full read, 287 lines)

**Insertion point** — add a new `POSButton` (outline variant, matching Edit/Delete styling at lines 79-100) to each `<li>` row's button cluster:
```typescript
// Existing button cluster pattern (lines 78-101) to extend with one more POSButton:
<div className="flex gap-1">
  <POSButton type="button" variant="outline" touchSize="default" onClick={() => { setEditModifier(m); }}>
    <Pencil className="size-4" />
    <span className="sr-only">Edit</span>
  </POSButton>
  <POSButton type="button" variant="outline" touchSize="default" onClick={() => { setDeleteId(m.id); }}>
    <Trash2 className="size-4" />
    <span className="sr-only">Delete</span>
  </POSButton>
  {/* NEW: */}
  <POSButton type="button" variant="outline" touchSize="default" onClick={() => { setRulesModifierId(m.id); }}>
    <FlaskConical className="size-4" />
    <span className="sr-only">Ingredient rules</span>
  </POSButton>
</div>
```
Then render `<ModifierIngredientRulesDialog modifierId={rulesModifierId} open={rulesModifierId != null} onOpenChange={...} />` alongside the existing `ModifierDialog`/`ConfirmDialog` instances at the bottom of the component (lines 106-166 show the sibling-dialog pattern to follow — one `useState` per dialog's open/target id).

**Error/loading pattern already established in this file (reuse verbatim for the new entity hook)** (lines 42-50):
```typescript
if (resultError) {
  return <p className="text-destructive text-sm">Could not load modifiers: {resultError.message}</p>;
}
if (isLoading) {
  return <p className="text-muted-foreground text-sm">Loading modifiers…</p>;
}
```

---

### `src/entities/tab/model/depletion.integration.test.ts` (extend)

**Analog:** existing I1-I4 recipe-only test cases in the same file (not re-read in full this session — file confirmed to exist and cover I1-I4 per RESEARCH.md Validation Architecture table; reuse its existing `beforeAll`/`afterAll` scaffolding pattern).

**Pattern:** add `it('I5: modifier-driven depletion...', ...)` cases that insert a test `modifiers` row + `modifier_inventory_rules` row + an `order_items` row with `modifier_ids` populated, then assert `stock_movements` rows with `ref_type = 'order_item_modifier'` appear alongside (or instead of, for recipe-less products) `ref_type = 'order_item'` rows. Add new rows to the same cleanup/teardown lists used by I1-I4.

---

## Shared Patterns

### Pre-regen Supabase cast
**Source:** `src/entities/recipe/model/queries.ts:1,17` — `const db = supabase as any` + file-level `/* eslint-disable @typescript-eslint/no-explicit-any, ... */`
**Apply to:** `src/entities/modifier-inventory-rule/model/queries.ts` (new table not yet in `supabase.types.ts`)

### Delete-all-then-insert replace strategy
**Source:** `src/entities/recipe/model/queries.ts` `useMutationSaveRecipe` (lines 96-165)
**Apply to:** `useMutationSaveModifierInventoryRules` — same shape, minus the parent-upsert step (modifier row already exists)

### Row-list `useReducer` editor
**Source:** `src/features/manage-recipe/ui/RecipeEditorTab.tsx` (lines 9-97 reducer, 145-256 render)
**Apply to:** `ModifierIngredientRulesDialog.tsx` — clone verbatim, rename `qty`→`delta`, drop `yieldQty`, drop the `min="0.001"` bound on the numeric input (Pitfall 3)

### Dialog chrome + per-row action button
**Source:** `src/features/manage-products/ui/CatalogModifiersTab.tsx` (`ModifierDialog` lines 171-207, button cluster lines 78-101, sibling-dialog-per-row pattern lines 106-166)
**Apply to:** `CatalogModifiersTab.tsx` modification + `ModifierIngredientRulesDialog.tsx` wrapper

### `Result<T>` error handling
**Source:** `src/shared/lib/result.ts` (`ok`/`err`), used throughout `src/entities/recipe/model/queries.ts`
**Apply to:** all new query/mutation hooks

### Depletion RPC extension shape (SECURITY DEFINER + p_allow_negative override + audit_log)
**Source:** `supabase/migrations/20260510000002_rpc_role_guards.sql` §3 (current `deplete_for_order_item` body)
**Apply to:** the modifier loop added to the same function — reuse the exact `EXCEPTION WHEN OTHERS` / `p_allow_negative` / `audit_log 'stock_override'` block, only changing `ref_type` to `'order_item_modifier'`

### Distinct `ref_type` to avoid idempotency-index collision
**Source:** `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` (partial unique index `(ref_type, ref_id, ingredient_id)`)
**Apply to:** every `record_stock_movement` call in the new modifier loop — use `ref_type = 'order_item_modifier'`, never reuse `'order_item'`

## No Analog Found

None — every file in scope has a strong (exact or role-match) existing analog. This phase is glue code around already-established Phase 4/14 primitives (per RESEARCH.md's "Key insight").

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/shared/lib/`, `src/entities/recipe/`, `src/entities/tab/`, `src/features/manage-recipe/`, `src/features/manage-products/`, `src/features/manage-modifier-groups/`
**Files scanned:** 9 read in full or targeted (RecipeEditorTab.tsx, CatalogModifiersTab.tsx, entities/recipe/model/queries.ts, domain.ts excerpts, domain-helpers.ts excerpt) + migration bodies quoted from 17-RESEARCH.md (already verified there against live migration files)
**Pattern extraction date:** 2026-07-06
