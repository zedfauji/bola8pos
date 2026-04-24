# Phase 4: Recipes & Sale Depletion — Research

**Researched:** 2026-04-24
**Domain:** PL/pgSQL RPC design, ingredient depletion, shadcn Command autocomplete, React tab composition
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| S3b-01 | Migration: `recipes` + `recipe_items` tables | Migration naming convention documented; schema designed below |
| S3b-02 | RPC `deplete_for_order_item(p_order_item_id, p_direction smallint)` | `record_stock_movement` signature verified from codebase; RPC design fully specified |
| S3b-03 | Extend order-item insert path to call depletion | `create_order_with_items` RPC identified as the correct integration point (NOT an edge function) |
| S3b-04 | Extend void-order to reverse depletion | Hook point identified: client-side in `useVoidOrder` after `callVoidOrder` succeeds; edge function NOT modified |
| S3b-05 | Zod schemas: RecipeSchema, RecipeItemSchema | Existing `IngredientSchema` pattern in `domain.ts` documented; exact schema specified |
| S3b-06 | Entity `src/entities/recipe/` | Existing `entities/ingredient/` pattern documented verbatim; recipe entity structure specified |
| S3b-07 | Feature `src/features/manage-recipe/` | Product edit Dialog structure documented; Recipe tab integration point identified |
| S3b-08 | `IngredientAutocomplete` shared/ui | shadcn Command and Popover confirmed NOT installed; installation commands documented |
| S3b-09 | Product detail Recipe tab + depletion preview | `CatalogProductsTab` Dialog structure documented; tab wrap pattern identified |
| S3b-10 | Negative-stock handling + manager PIN override | `manager-pin-gate` feature structure confirmed; override flow architecture specified |
| S3b-11 | Integration tests: add-item-to-tab → verify ledger deltas | Existing integration test pattern in `entities/tab/model/` documented |
| S3b-12 | Property test P6 (depletion math) | Existing fast-check pattern from Phase 02 documented |
| S3b-13 | E2E `20-recipes.spec.ts` | E2E spec pattern from `03-tab-order.spec.ts` documented |
| S3b-14 | Seed recipes: Michelada, Alitas, Hotdog + 2-3 food | Seed script pattern from prior phases documented |
</phase_requirements>

---

## Summary

Phase 4 wires the existing `record_stock_movement` RPC (Phase 3) into the order flow by adding a `deplete_for_order_item` RPC that reads order_item → product → recipe → depletes each ingredient. The critical integration is that **`add-item-to-tab` uses `create_order_with_items` RPC directly — there is NO edge function**. S3b-03 means modifying the `create_order_with_items` RPC migration to call `deplete_for_order_item` after each order_item INSERT. Void-order **does** go through an edge function (`/functions/v1/void-order`), but S3b-04 is implemented client-side: after `callVoidOrder` succeeds, `useVoidOrder` calls `deplete_for_order_item(-1)` per order_item via the Supabase JS client.

The UI adds a Recipe tab inside the existing product edit Dialog (`CatalogProductsTab`), not a new page. `tabs.tsx` is already installed in `shared/ui/`. `command.tsx` and `popover.tsx` need to be installed. The negative-stock override reuses the existing `manager-pin-gate` feature; no new dialog component is needed. The `audit_log` table must be created in this phase — its INSERT guard exists in the `add_combo_to_tab` RPC as a self-activating guard, but the table itself has not been created.

**Primary recommendation:** Implement in 4 waves: (1) DB migrations + RPC, (2) Zod types + entity + RPC integration into create_order_with_items, (3) UI components + feature slices, (4) tests + seed data.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| recipes / recipe_items schema | Database | — | Pure data model — no client logic |
| `deplete_for_order_item` RPC | Database (PL/pgSQL) | — | Must be transactional with order INSERT |
| Depletion call after order creation | Database (via modified `create_order_with_items`) | — | Same DB transaction as order insert |
| Depletion reversal on void | Frontend (feature hook) | API/RPC | Client calls RPC after edge function void succeeds |
| Recipe CRUD | API/Backend (Supabase RLS) | Feature hook | Standard entity mutation pattern |
| Recipe editor UI | Frontend (feature slice) | Widget | Tab within existing product edit Dialog |
| `IngredientAutocomplete` | Frontend (shared/ui) | — | Reusable across Phase 4, S3c, inventory |
| Negative-stock guard | Database (record_stock_movement raises) | Feature hook (catches error) | DB is authoritative; feature handles UI response |
| Manager PIN override | Frontend (feature) | — | Reuses existing `manager-pin-gate` |
| audit_log writes | Database (SECURITY DEFINER fn) | — | Must be server-side for audit integrity |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PL/pgSQL | PostgreSQL built-in | `deplete_for_order_item` RPC | Same as `record_stock_movement` and `create_order_with_items` |
| `@tanstack/react-query` v5 | already in project | Recipe entity hooks | Same pattern as all other entities |
| `zod` v4 | already in project | RecipeSchema, RecipeItemSchema | Single source of truth in domain.ts |
| `fast-check` v4 | already in project | Property test P6 | Same as P2/P3/P9/P10 in prior phases |
| `@playwright/test` v1.59 | already in project | `20-recipes.spec.ts` | Standard E2E pattern |

### Supporting (UI)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `command` | latest | `IngredientAutocomplete` dropdown list | Combobox/autocomplete pattern |
| shadcn `popover` | latest | Popover container for Command | Pairs with Command |
| shadcn `tabs` | ALREADY INSTALLED | Recipe tab in product Dialog | `src/shared/ui/tabs.tsx` confirmed exists |
| `lucide-react` | ALREADY INSTALLED | Check, ChevronsUpDown, AlertTriangle, X icons | Already used project-wide |

### Installation (new components only)
```bash
cd bar-pos
npx shadcn@latest add command
npx shadcn@latest add popover
```

**After installation:** move both to `src/shared/ui/` (shadcn CLI installs to `src/app/components/ui/` — per Phase 02 decision in STATE.md: "shadcn CLI installs collapsible to src/app/components/ui/ — always move to src/shared/ui/ to match FSD layer boundaries"). Export both from `src/shared/ui/index.ts`.

---

## Integration Map — Critical Discovery

### 1. add-item-to-tab Integration Point

```
CartPanel.tsx
  → useMutationAddOrder() [entities/tab/model/queries.ts:580]
    → supabase.rpc('create_order_with_items', payload) [line 604]
      → PL/pgSQL: INSERT orders + INSERT order_items (returns JSONB)
                        ↑
           S3b-03: ADD call to deplete_for_order_item
           for each inserted order_item.id
```

**File:** `bar-pos/supabase/migrations/20260416120000_create_order_with_items_rpc.sql`

S3b-03 means writing a **new migration** that `CREATE OR REPLACE FUNCTION create_order_with_items` to add a depletion loop after the `INSERT INTO order_items` statement. This is NOT an edge function modification. No client-side code changes are needed for S3b-03 (the RPC handles it transparently).

**Exact location in `create_order_with_items` to insert the depletion loop:**
```sql
-- After the INSERT INTO order_items...SELECT FROM jsonb_array_elements block:
-- Loop over each inserted order_item and call deplete_for_order_item
FOR v_item IN
  SELECT id FROM order_items WHERE order_id = v_order.id
LOOP
  PERFORM deplete_for_order_item(v_item.id, 1);
END LOOP;
```

If `deplete_for_order_item` raises `INVENTORY_NEGATIVE`, the exception propagates up and rolls back the entire `create_order_with_items` transaction — this is the desired behavior (sale blocked).

### 2. void-order Integration Point

```
useVoidOrder.ts [src/features/void-order/model/useVoidOrder.ts:36]
  → callVoidOrder(request) [shared/lib/edge-function-contracts.ts:568]
    → POST /functions/v1/void-order (Deno Edge Function — remote only, no local file)
      → order marked voided
  ← on success: callVoidOrder returns ok(undefined)
        ↓
  S3b-04: ADD loop here in useVoidOrder mutationFn
  → for each item in input.order.items:
      await supabase.rpc('deplete_for_order_item', {
        p_order_item_id: item.id,
        p_direction: -1
      })
```

**File to modify:** `bar-pos/src/features/void-order/model/useVoidOrder.ts`

The depletion reversal runs client-side after the edge function void succeeds. This is NOT in the same DB transaction as the void, but is acceptable because:
1. Void edge function marks order as voided
2. Client then calls reversal RPC for each item
3. If reversal fails partially, the ledger is recoverable (re-run the reversal)

**Important:** `useVoidOrder` currently passes `inventoryRestoreItems` to `callVoidOrder` but the edge function's inventory restore was the OLD product-based stock system. For Phase 4, the edge function contract stays unchanged but depletion reversal is added client-side in the feature hook.

### 3. `record_stock_movement` Verified Signature

[VERIFIED: bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql]

```sql
CREATE OR REPLACE FUNCTION record_stock_movement(
  p_ingredient_id  uuid,
  p_delta          numeric,
  p_reason         text,        -- must match stock_movements.reason enum
  p_ref_type       text,        -- e.g. 'order_item'
  p_ref_id         uuid,        -- e.g. order_item.id
  p_notes          text DEFAULT NULL
)
RETURNS stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
```

**Negative-stock guard behavior:** If `v_new < 0 AND p_reason NOT IN ('correction', 'physical_count')`, raises:
```
RAISE EXCEPTION 'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id;
```

This means `deplete_for_order_item` (with `p_reason = 'sale'`) will propagate `INVENTORY_NEGATIVE` up through `create_order_with_items` and the entire order transaction rolls back.

**Idempotency:** `stock_movements` has a unique index on `(ref_id, ingredient_id)` [VERIFIED: 20260426000002_stock_movements_idempotency_index.sql]. Calling twice → `23505 unique_violation` → treat as success (no-op).

**`allow_negative` override:** `record_stock_movement` has NO `allow_negative` parameter. The override path is implemented differently: a separate `record_stock_movement_with_override` helper that bypasses the negative-stock guard, or by inserting directly (writes audit_log row). See Override Flow section below.

---

## Architecture Patterns

### System Architecture Diagram

```
[CartPanel]
    │ useMutationAddOrder()
    ▼
[create_order_with_items RPC]  ← single DB transaction
    │ INSERT orders
    │ INSERT order_items
    │ FOR EACH order_item:
    │   CALL deplete_for_order_item(item_id, +1)
    │     → record_stock_movement('sale', ...)
    │     → if negative: RAISE INVENTORY_NEGATIVE → rollback
    ▼
[Result<{order, items}> or INVENTORY_NEGATIVE error]
    │ on INVENTORY_NEGATIVE:
    ▼
[useVoidOrder / add-item-to-tab error handler]
    │ toast.error + "Allow override" action
    ▼
[manager-pin-gate modal]
    │ on PIN approved:
    ▼
[override-negative-stock feature]
    │ retry with allow_negative flag
    ▼
[record_stock_movement_with_override RPC + audit_log INSERT]
```

### Recommended Project Structure (new files only)

```
bar-pos/
├── supabase/migrations/
│   ├── 20260428000001_recipes_tables.sql         # S3b-01: recipes + recipe_items + audit_log
│   ├── 20260428000002_deplete_for_order_item.sql  # S3b-02: depletion RPC
│   └── 20260428000003_create_order_with_items_v2.sql  # S3b-03: hook depletion into order insert
│
├── src/entities/recipe/
│   ├── model/
│   │   ├── queries.ts     # useRecipe(productId), useMutationSaveRecipe (upsert)
│   │   └── types.ts       # re-export from domain.ts
│   ├── ui/
│   │   └── RecipePreviewPanel.tsx  # "will deplete" preview (read-only display)
│   └── index.ts           # public barrel
│
├── src/features/
│   ├── manage-recipe/
│   │   ├── model/
│   │   │   └── useManageRecipe.ts  # mutation hook for upsert/delete recipe
│   │   ├── ui/
│   │   │   └── RecipeEditorTab.tsx # full editor tab
│   │   └── index.ts
│   ├── override-negative-stock/
│   │   ├── model/
│   │   │   └── useOverrideNegativeStock.ts  # retry logic + audit_log
│   │   └── index.ts
│   └── void-order/
│       └── model/
│           └── useVoidOrder.ts  # MODIFIED: add depletion reversal loop
│
├── src/shared/ui/
│   ├── command.tsx          # NEW: npx shadcn@latest add command → move here
│   ├── popover.tsx          # NEW: npx shadcn@latest add popover → move here
│   └── IngredientAutocomplete/
│       ├── IngredientAutocomplete.tsx
│       └── IngredientAutocomplete.stories.tsx
│
├── e2e/
│   └── 20-recipes.spec.ts
└── scripts/
    └── seed-recipes.ts
```

### Pattern: Ingredient Entity as Template for Recipe Entity

The `entities/ingredient/` structure is the exact template to follow for `entities/recipe/`.

**Ingredient entity pattern [VERIFIED from codebase]:**
```
entities/ingredient/
  model/
    queries.ts    # const db = supabase as any; ingredientKeys factory; useIngredients(), useIngredient(id), useStockMovements(id)
    types.ts      # re-exports from @shared/lib/domain (never defines types)
  index.ts        # barrel: exports queries, types, Zod schemas
```

**Recipe entity pattern (follow exactly):**
```typescript
// entities/recipe/model/queries.ts
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
const db = supabase as any; // pre-regen cast — remove after types regenerated

export const recipeKeys = {
  all: ['recipes'] as const,
  byProduct: (productId: string) => [...recipeKeys.all, 'product', productId] as const,
};

export function useRecipe(productId: string | null) {
  return useQuery({
    queryKey: recipeKeys.byProduct(productId ?? ''),
    enabled: productId != null && productId.length > 0,
    queryFn: async (): Promise<Recipe | null> => { ... }
  });
}
```

### Pattern: Adding a Tab to the Product Edit Dialog

**Current structure in `CatalogProductsTab.tsx`:**
```tsx
<Dialog open={editProduct != null} onOpenChange={...}>
  <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
    <DialogHeader>
      <DialogTitle>Edit product</DialogTitle>
    </DialogHeader>
    {editProduct ? (
      <ProductForm key={editProduct.id} ... />   // ← currently renders here directly
    ) : null}
  </DialogContent>
</Dialog>
```

**New structure (S3b-09):** Wrap in `Tabs` from `@shared/ui/tabs`. The Dialog already exists — we expand it:
```tsx
<Dialog open={editProduct != null} onOpenChange={...}>
  <DialogContent className="max-w-2xl sm:max-w-2xl" showCloseButton>
    <DialogHeader>
      <DialogTitle>Edit product</DialogTitle>
    </DialogHeader>
    {editProduct ? (
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="recipe">Recipe</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <ProductForm key={editProduct.id} ... />
        </TabsContent>
        <TabsContent value="recipe">
          <RecipeEditorTab productId={editProduct.id} productName={editProduct.name} />
        </TabsContent>
      </Tabs>
    ) : null}
  </DialogContent>
</Dialog>
```

`tabs.tsx` is ALREADY in `src/shared/ui/` — no installation needed.

---

## Migration Naming Convention

Last migration applied: `20260427000004_parent_auto_close_trigger.sql`

Next migrations for Phase 4:
```
20260428000001_recipes_tables.sql       # S3b-01: recipes, recipe_items, audit_log
20260428000002_deplete_for_order_item.sql  # S3b-02: PL/pgSQL depletion RPC
20260428000003_create_order_with_items_v2.sql  # S3b-03: hook depletion into order insert
```

If additional migrations are needed (e.g., separate audit_log migration):
```
20260428000004_audit_log.sql
```

---

## Database Schema Design

### recipes table
```sql
CREATE TABLE recipes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  yield_qty    numeric NOT NULL DEFAULT 1 CHECK (yield_qty > 0),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- One recipe per product (UNIQUE on product_id)
-- Cascade on product delete (recipe meaningless without product)
```

### recipe_items table
```sql
CREATE TABLE recipe_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  qty           numeric NOT NULL CHECK (qty > 0),
  UNIQUE (recipe_id, ingredient_id)  -- no duplicate ingredient in one recipe
);
```

### audit_log table (created in this phase — referenced by add_combo_to_tab guard)
```sql
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action      text NOT NULL,         -- e.g. 'override_negative_stock'
  actor_id    uuid REFERENCES profiles(id),
  target_type text,                  -- e.g. 'order_item'
  target_id   uuid,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- RLS: authenticated can insert; manager+ can select
```

**Important:** The `audit_log` INSERT guard in `add_combo_to_tab` RPC uses:
```sql
BEGIN
  INSERT INTO audit_log (...) VALUES (...);
EXCEPTION WHEN undefined_table THEN
  NULL; -- silently skip until table exists
END;
```
Once `audit_log` is created in this phase, that guard auto-activates — the combo RPC will start writing audit rows immediately. No migration changes needed to `add_combo_to_tab`.

---

## RPC Design — `deplete_for_order_item`

```sql
CREATE OR REPLACE FUNCTION deplete_for_order_item(
  p_order_item_id  uuid,
  p_direction      smallint  -- +1 sale (subtract), -1 refund/void (add back)
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
  -- 1. Resolve order_item → product_id + qty
  SELECT product_id, quantity INTO v_product_id, v_qty
  FROM order_items WHERE id = p_order_item_id;

  IF NOT FOUND THEN RETURN; END IF;  -- order_item not found (shouldn't happen)

  -- 2. Find recipe; if none → return early (no depletion — beer with no recipe)
  SELECT id, yield_qty INTO v_recipe_id, v_yield_qty
  FROM recipes WHERE product_id = v_product_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- 3. Set reason from direction
  v_reason := CASE WHEN p_direction = 1 THEN 'sale' ELSE 'refund' END;

  -- 4. For each recipe_item, compute delta and call record_stock_movement
  FOR v_item IN
    SELECT ingredient_id, qty FROM recipe_items WHERE recipe_id = v_recipe_id
  LOOP
    -- delta = -(direction × qty × recipe_qty / yield_qty)
    -- positive p_direction = sale = negative delta (subtract)
    v_delta := -p_direction::numeric * v_qty::numeric * v_item.qty / v_yield_qty;

    PERFORM record_stock_movement(
      v_item.ingredient_id,
      v_delta,
      v_reason,
      'order_item',
      p_order_item_id,
      NULL
    );
    -- Unique constraint violation (idempotency) → caller catches 23505 and treats as success
    -- INVENTORY_NEGATIVE → propagates up (rolls back transaction on sale path)
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION deplete_for_order_item(uuid, smallint) TO authenticated;
```

---

## Allow-Negative Override Path

The override flow is architecturally separate from `deplete_for_order_item`:

1. `add-item-to-tab` fails: `INVENTORY_NEGATIVE` error from `create_order_with_items` RPC
2. Client catches error in `CartPanel.handlePlaceOrder` → passes to error handler
3. Error handler: `toast.error("{ingredient} is out of stock. Manager PIN required to override.", { action: { label: "Allow override", onClick: openManagerPinGate } })`
4. Manager enters PIN → existing `ManagerPinDialog` verifies PIN → calls `onApprove()`
5. `override-negative-stock` feature: retries `create_order_with_items` but calls a **different RPC** per item: `record_stock_movement_with_override`

**`record_stock_movement_with_override` (new RPC, separate migration):**
- Same as `record_stock_movement` but removes the `INVENTORY_NEGATIVE` guard
- Adds `INSERT INTO audit_log (action, actor_id, target_type, target_id, payload)` before the movement INSERT
- Named distinctly so the override is explicit and auditable

**Alternative simpler approach:** Call `deplete_for_order_item` with a wrapper that catches `INVENTORY_NEGATIVE`, removes the guard for that call, and writes audit_log. The sprint brief says "caller retries with allow_negative flag" — the cleanest implementation is a new `deplete_for_order_item_with_override(p_order_item_id, p_actor_id)` RPC.

---

## shadcn Components Status

| Component | Status | Action Required |
|-----------|--------|----------------|
| `tabs.tsx` | ✅ INSTALLED | `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs'` |
| `dialog.tsx` | ✅ INSTALLED | Already used in CatalogProductsTab |
| `command.tsx` | ❌ NOT INSTALLED | `npx shadcn@latest add command` → move to `src/shared/ui/` |
| `popover.tsx` | ❌ NOT INSTALLED | `npx shadcn@latest add popover` → move to `src/shared/ui/` |
| `skeleton.tsx` | ✅ INSTALLED | Used for loading states in IngredientAutocomplete |
| `badge.tsx` | ✅ INSTALLED | Used for UOM chip in IngredientAutocomplete |
| `input.tsx` | ✅ INSTALLED | Used for Qty and yield inputs |
| `collapsible.tsx` | ✅ INSTALLED | (Phase 02 installed it) |
| `select.tsx` | ✅ INSTALLED | (Phase 06 installed it) |

---

## Supabase Types Manual Extension

Docker is unavailable (`supabase gen types --local` cannot run). Following the established pattern, manually extend `src/shared/lib/supabase.types.ts` after applying migrations.

Tables to add to `supabase.types.ts`:
```typescript
// In Tables section:
recipes: {
  Row: {
    id: string;
    product_id: string;
    yield_qty: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: { product_id: string; yield_qty?: number; notes?: string | null; };
  Update: Partial<Tables<'recipes'>['Insert']> & { id?: string };
};
recipe_items: {
  Row: {
    id: string;
    recipe_id: string;
    ingredient_id: string;
    qty: number;
  };
  Insert: { recipe_id: string; ingredient_id: string; qty: number; };
  Update: Partial<Tables<'recipe_items'>['Insert']>;
};
audit_log: {
  Row: {
    id: string;
    action: string;
    actor_id: string | null;
    target_type: string | null;
    target_id: string | null;
    payload: Json | null;
    created_at: string;
  };
  Insert: { action: string; actor_id?: string | null; target_type?: string | null; target_id?: string | null; payload?: Json | null; };
  Update: never;
};
```

Also add RPC signature:
```typescript
// In Functions section:
deplete_for_order_item: {
  Args: { p_order_item_id: string; p_direction: number };
  Returns: void;
};
```

---

## Zod Schemas to Add in `domain.ts`

```typescript
// ============================================================================
// RECIPE (Phase 4)
// ============================================================================

export const RecipeSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  yieldQty: z.number().positive(),
  notes: z.string().nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const RecipeItemSchema = z.object({
  id: UuidSchema,
  recipeId: UuidSchema,
  ingredientId: UuidSchema,
  qty: z.number().positive(),
});

export const RecipeCreateSchema = RecipeSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const RecipeUpdateSchema = RecipeSchema.partial().required({ id: true });
export const RecipeItemCreateSchema = RecipeItemSchema.omit({ id: true });

export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeCreate = z.infer<typeof RecipeCreateSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type RecipeItemCreate = z.infer<typeof RecipeItemCreateSchema>;

// RecipeWithItems — the aggregate view used by the recipe editor
export const RecipeWithItemsSchema = RecipeSchema.extend({
  items: z.array(RecipeItemSchema),
});
export type RecipeWithItems = z.infer<typeof RecipeWithItemsSchema>;
```

**AppErrorCode addition needed:** No new AppErrorCode needed — `INVENTORY_NEGATIVE` already exists in `result.ts`.

---

## Existing Zod Schemas (already present, verified)

| Schema | Location | Relevant to Phase 4 |
|--------|----------|---------------------|
| `IngredientSchema` | `domain.ts:1503` | Ingredient autocomplete data shape |
| `StockMovementSchema` | `domain.ts:649` | Verifying movement rows in tests |
| `StockMovementReasonSchema` | `domain.ts:112` | 'sale' and 'refund' already in enum |
| `INVENTORY_NEGATIVE` | `result.ts:176` | Error code for stock guard |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox/autocomplete | Custom select with filter logic | shadcn `Command` + `Popover` | Handles keyboard nav, accessibility, ARIA |
| Ingredient search filtering | Custom filter algorithm | shadcn Command's built-in `cmdk` filter | Fuzzy match, sorting built in |
| Dialog tab switching | Custom tab state management | shadcn `Tabs` (already installed) | Keyboard accessible, ARIA roles |
| Fractional qty display | `Number.toFixed(2)` inline | `<MoneyDisplay>` for prices, `font-mono` input for qty | Project rules |
| PIN verification | Custom PIN input | Existing `manager-pin-gate` feature + `PINKeypad` | Already built, tested |

---

## Common Pitfalls

### Pitfall 1: `create_order_with_items` RPC — Not an Edge Function
**What goes wrong:** Developer creates a new edge function for S3b-03 instead of modifying the RPC migration.
**Why it happens:** Sprint brief says "edge function" but the actual order creation path is a Supabase RPC called directly from the frontend.
**How to avoid:** S3b-03 = new migration that `CREATE OR REPLACE FUNCTION create_order_with_items` to add the depletion loop.
**Warning signs:** Looking for a `supabase/functions/add-item-to-tab/` directory — it doesn't exist.

### Pitfall 2: SECURITY INVOKER vs SECURITY DEFINER for `deplete_for_order_item`
**What goes wrong:** Using `SECURITY INVOKER` means `auth.uid()` in `record_stock_movement` returns the calling user's ID — but `record_stock_movement` is `SECURITY DEFINER`. The chain: `create_order_with_items` (INVOKER) → `deplete_for_order_item` (DEFINER?) → `record_stock_movement` (DEFINER).
**How to avoid:** Use `SECURITY DEFINER` on `deplete_for_order_item` so it runs as function owner, consistent with `record_stock_movement`. The `auth.uid()` context is preserved via JWT claims.

### Pitfall 3: Void-order reversal is NOT in the same transaction as the void
**What goes wrong:** Assuming the void and depletion reversal are atomic because they happen in sequence.
**Why it happens:** The void goes to an edge function; the reversal is a separate client-side RPC call.
**How to avoid:** Accept eventual consistency. If the reversal fails, the ledger is recoverable by re-running `deplete_for_order_item(-1)`. Idempotency (unique constraint on `ref_id + ingredient_id`) prevents double-reversals.

### Pitfall 4: shadcn CLI installs to wrong directory
**What goes wrong:** `npx shadcn@latest add command` installs to `src/app/components/ui/` instead of `src/shared/ui/`.
**How to avoid:** After running `npx shadcn@latest add command` and `npx shadcn@latest add popover`, immediately move files to `src/shared/ui/` and export from `src/shared/ui/index.ts`. This is documented in STATE.md as an established pattern from Phase 02.

### Pitfall 5: Combo parent products and recipe depletion
**What goes wrong:** A combo product (is_combo=true) has no recipe. When its child order_items are inserted, each child's recipe depletes correctly. But if code naively tries to deplete the parent combo product_id, it gets a recipe-not-found and returns early.
**How to avoid:** `deplete_for_order_item` already handles this: if no recipe found for a product_id, it `RETURN`s early. No special-casing needed. Confirm with a unit test: "combo parent with no recipe → zero ledger rows".

### Pitfall 6: `record_stock_movement` negative guard blocks refund direction
**What goes wrong:** Calling `deplete_for_order_item(-1)` for a refund writes a POSITIVE delta (add stock back). This should always succeed since it's increasing quantity. BUT if `v_delta > 0`, the guard `IF v_new < 0` is not triggered. Refunds never block.
**How to avoid:** Confirm the math: `v_delta = -(-1) × qty × recipe_qty / yield = +value`. No issue. Document in tests.

### Pitfall 7: `exactOptionalPropertyTypes` violations in RecipeSchema
**What goes wrong:** Writing `notes?: string` in the Zod schema's TypeScript type causes a build error.
**How to avoid:** Use `.nullable().optional()` in Zod (which produces `string | null | undefined` — satisfies exactOptionalPropertyTypes), or use explicit `notes: string | undefined` in any input type.

---

## Code Examples

### How ingredients entity queries are structured [VERIFIED from codebase]
```typescript
// src/entities/ingredient/model/queries.ts — EXACT PATTERN TO FOLLOW
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, ... */
const db = supabase as any;

export const ingredientKeys = {
  all: ['ingredients'] as const,
  lists: () => [...ingredientKeys.all, 'list'] as const,
  detail: (id: string) => [...ingredientKeys.all, 'detail', id] as const,
};

export function useIngredients() {
  return useQuery({
    queryKey: ingredientKeys.lists(),
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await db.from('ingredients').select('*').eq('is_active', true).order('name');
      if (error) { logger.error('useIngredients: query failed', { error }); throw error; }
      return ((data ?? []) as Record<string, unknown>[]).map(mapIngredientRow);
    },
  });
}
```

### computeDepletion pure function (for property test P6)
```typescript
// src/shared/lib/domain-helpers.ts (or colocated with entity)
export function computeDepletion(
  recipe: RecipeWithItems,
  orderQty: number,
  direction: 1 | -1
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const item of recipe.items) {
    const delta = -direction * orderQty * item.qty / recipe.yieldQty;
    deltas.set(item.ingredientId, delta);
  }
  return deltas;
}
```

### Calling deplete_for_order_item via Supabase client (for void reversal)
```typescript
// In useVoidOrder mutationFn, after callVoidOrder succeeds:
const db = supabase as any;
for (const item of input.order.items) {
  const { error: deplError } = await db.rpc('deplete_for_order_item', {
    p_order_item_id: item.id,
    p_direction: -1,
  });
  if (deplError) {
    // Log but don't fail the void — reversal is eventually consistent
    logger.warn('void_order.depletion_reversal_failed', { orderItemId: item.id, error: deplError });
  }
}
```

---

## Wave Decomposition (for Parallel Planning)

| Wave | Tickets | Rationale | Can Parallelize |
|------|---------|-----------|-----------------|
| Wave 0 | S3b-01 + audit_log migration | DB schema must exist before RPCs | Sequential |
| Wave 1 | S3b-02 (deplete_for_order_item RPC) | Needs recipes + recipe_items tables | After Wave 0 |
| Wave 1 | S3b-05 (Zod schemas) | Independent of DB state | With Wave 1 |
| Wave 2 | S3b-03 (create_order_with_items v2) | Needs depletion RPC to exist | After Wave 1 |
| Wave 2 | S3b-06 (entities/recipe/) | Needs Zod schemas + DB | After Wave 0+S3b-05 |
| Wave 3 | S3b-08 (IngredientAutocomplete) | Needs shadcn command+popover installed | After Wave 0 |
| Wave 3 | S3b-04 (void-order reversal) | Needs depletion RPC | After Wave 1 |
| Wave 3 | S3b-10 (override-negative-stock feature) | Needs depletion RPC + manager-pin-gate | After Wave 1 |
| Wave 4 | S3b-07 (manage-recipe feature) | Needs entity + IngredientAutocomplete | After Wave 2+3 |
| Wave 4 | S3b-09 (Recipe tab in Dialog) | Needs manage-recipe feature | After Wave 4a |
| Wave 5 | S3b-14 (seed recipes) | Needs recipes table | After Wave 0 |
| Wave 5 | S3b-11 (integration tests) | Needs full stack | After Wave 4 |
| Wave 5 | S3b-12 (property test P6) | computeDepletion is pure fn | After S3b-05 Zod schemas |
| Wave 5 | S3b-13 (E2E) | Needs full stack + seed | After Wave 5a |

**Critical path:** S3b-01 → S3b-02 → S3b-03 → S3b-06/07/08 → S3b-09 → S3b-13

---

## Environment Availability

> Only noting items relevant to Phase 4 that differ from standard.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (local) | `supabase gen types` | ✗ (Docker unavailable) | — | Manual supabase.types.ts extension (established pattern) |
| shadcn CLI | `npx shadcn@latest add` | ✓ (npx) | latest | — |
| fast-check | Property test P6 | ✓ (already in devDeps) | v4 | — |
| Playwright | E2E spec | ✓ | v1.59 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | `bar-pos/vite.config.ts` (vitest section) |
| Quick run | `npm run test` (from bar-pos/) |
| Single file | `npx vitest run src/path/to.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| S3b-02 | `computeDepletion` math | unit | `npx vitest run src/shared/lib/depletion.test.ts` | ❌ Wave 0 gap |
| S3b-02 | Depletion direction=-1 is exact additive inverse | unit | same | ❌ Wave 0 gap |
| S3b-02 | Product with no recipe → zero ledger rows | unit | same | ❌ Wave 0 gap |
| S3b-12 | P6: random recipe × random order qty → correct delta sum | property | `npx vitest run src/shared/lib/depletion.test.ts` | ❌ Wave 0 gap |
| S3b-03 | Add beer (no recipe) → no stock_movements rows | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts` | ❌ Wave 0 gap |
| S3b-03 | Add Alitas → 2 ledger rows with correct deltas | integration | same | ❌ Wave 0 gap |
| S3b-04 | Void Alitas → 2 positive reversal rows | integration | same | ❌ Wave 0 gap |
| S3b-10 | INVENTORY_NEGATIVE → blocked; manager PIN → succeeds; audit_log row | integration | same | ❌ Wave 0 gap |
| S3b-13 | Full E2E: create recipe → sell → void → override | E2E | `npx playwright test e2e/20-recipes.spec.ts` | ❌ Wave 5 gap |
| S3b-08 | IngredientAutocomplete renders, selects, clears | unit/Storybook | `npx vitest run src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx` | ❌ Wave 0 gap |

### Wave 0 Test Gaps (create before implementation)
- [ ] `src/shared/lib/depletion.test.ts` — pure `computeDepletion` unit + P6 property tests
- [ ] `src/entities/tab/model/depletion.integration.test.ts` — integration tests (uses live Supabase via service role)
- [ ] `src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx` — component tests

### Sampling Rate
- Per task commit: `npm run typecheck && npm run lint`
- Per wave merge: `npm run test` (all unit + integration)
- Phase gate: `npm run test && npx playwright test e2e/20-recipes.spec.ts` green before `/gsd-verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Recipe management is behind authenticated session (existing auth) |
| V3 Session Management | no | Handled by existing Supabase auth |
| V4 Access Control | yes | `manage_products` RBAC action gates recipe editor; RLS on recipes/recipe_items |
| V5 Input Validation | yes | Zod schemas validate recipe qty > 0, ingredient_id UUID format |
| V6 Cryptography | no | No new crypto needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated recipe write | Tampering | RLS: authenticated only; `manage_products` RBAC on UI |
| Negative qty in recipe_item | Tampering | `CHECK (qty > 0)` constraint in DB migration |
| Manager PIN bypass on override | Elevation of privilege | Existing `manager-pin-gate` verifies PIN server-side via Supabase auth |
| Audit log omission on override | Repudiation | `audit_log` INSERT in `record_stock_movement_with_override` is SECURITY DEFINER — cannot be skipped by client |
| Depletion race condition | Tampering | `SELECT FOR UPDATE` in `record_stock_movement` prevents concurrent quantity drift |

### RLS Rules for New Tables
```sql
-- recipes: all authenticated can read; manager+ can write
CREATE POLICY "recipes_select_authenticated" ON recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipes_write_manager" ON recipes FOR ALL TO authenticated
  USING (get_user_role() IN ('manager', 'admin'))
  WITH CHECK (get_user_role() IN ('manager', 'admin'));

-- recipe_items: same as recipes (cascade from recipe)
-- audit_log: all authenticated can insert; manager+ can select
CREATE POLICY "audit_log_insert_authenticated" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_log_select_manager" ON audit_log FOR SELECT TO authenticated
  USING (get_user_role() IN ('manager', 'admin'));
```

---

## Risk Flags

### Risk 1: Depletion latency inside order transaction
**Concern:** `create_order_with_items` now calls `deplete_for_order_item` for each item in the same transaction. If a product has a 10-ingredient recipe and the order has 5 line items, that's 50 `record_stock_movement` calls (each with `SELECT FOR UPDATE`).

**Mitigation strategy:** Benchmark in staging. The sprint brief says: "if >200ms, move to post-commit trigger with eventual consistency (fallback plan)". The default plan is synchronous depletion (simpler, correct). The fallback is an `AFTER INSERT ON order_items` trigger that calls `deplete_for_order_item` asynchronously via `pg_notify` + Supabase Realtime.

**Action:** Tag this as a performance verification requirement in the plan: measure round-trip time for placing a Michelada order after S3b-03 is implemented.

### Risk 2: void-order edge function not locally available
**Concern:** `supabase/functions/void-order/` does NOT exist as a local file. S3b-04 is client-side in `src/features/void-order/model/useVoidOrder.ts` — this is intentional (as described above). But if the reversal RPC needs to be called inside the edge function for transactionality, the edge function source would need to be reconstructed.

**Decision:** Keep S3b-04 client-side. The reversal is idempotent (unique constraint prevents double-reversal). Document this explicitly in the `useVoidOrder` code.

### Risk 3: `add_combo_to_tab` will start writing to `audit_log` on Phase 4 deployment
**Concern:** The EXCEPTION WHEN undefined_table guard in `add_combo_to_tab` means that once `audit_log` is created, combo overrides start writing audit rows. This is desired behavior, but could cause unexpected DB rows if not expected.

**Mitigation:** Verify audit_log columns match what `add_combo_to_tab` tries to insert before applying the migration. Check the migration file `20260425000005_add_combo_to_tab_rpc.sql` for the INSERT shape.

### Risk 4: Product edit Dialog max-w-md is too narrow for Recipe tab two-column layout
**Concern:** The current product edit Dialog uses `max-w-md` (`~448px`). The UI-SPEC shows a two-column Recipe tab layout (`grid grid-cols-1 gap-6 md:grid-cols-[1fr_260px]`). This won't fit in `max-w-md`.

**Mitigation:** S3b-09 expands the Dialog to `max-w-2xl` (`~672px`) for the edit flow. Create is unaffected (no Recipe tab on create — recipe can only be added after the product exists and has an ID).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `void-order` edge function exists remotely but has no local source file | Integration Map | If it doesn't exist remotely, void-order is entirely broken — would be caught by E2E regression |
| A2 | `add_combo_to_tab` audit_log INSERT tries the same columns as the Phase 4 audit_log schema | Risk 3 | Combo RPC would throw on first override attempt — requires re-check of combo RPC migration |
| A3 | `record_stock_movement` unique constraint keyed on `(ref_id, ingredient_id)` | Idempotency section | Double-depletion possible if no unique constraint |

---

## Open Questions

1. **Allow-negative override RPC name**
   - What we know: Sprint brief says "caller retries with allow_negative flag"; `record_stock_movement` has no such flag
   - What's unclear: Is the override a new RPC (`deplete_for_order_item_with_override`) or does `deplete_for_order_item` gain an optional `p_allow_negative boolean DEFAULT false`?
   - Recommendation: Add `p_allow_negative boolean DEFAULT false` to `deplete_for_order_item` as it avoids a new RPC. When `true`, skip the negative guard and write audit_log. Call from `override-negative-stock` feature with `p_allow_negative = true`.

2. **Recipe editor — create vs edit product Dialog**
   - What we know: Recipe tab can only exist for an existing product (needs product_id)
   - What's unclear: UI-SPEC mentions "product detail page" — this doesn't exist as a route, only as a Dialog
   - Recommendation: Add Recipe tab only to the EDIT Dialog (when `editProduct != null`). The CREATE Dialog keeps only ProductForm. Confirm with planner.

3. **Combo children depletion on add_combo_to_tab**
   - What we know: Sprint notes say "each child has its own recipe and depletes normally on insert"
   - What's unclear: Does `add_combo_to_tab` also call `create_order_with_items` internally? Or does it insert order_items differently?
   - Recommendation: Check `20260425000005_add_combo_to_tab_rpc.sql` to see how combo children create order_items — if it calls `create_order_with_items`, depletion is free. If it does its own INSERT, it needs its own depletion loop.

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql` — `record_stock_movement` exact signature
- `bar-pos/src/entities/tab/model/queries.ts:580-636` — `useMutationAddOrder` calling `create_order_with_items` RPC
- `bar-pos/supabase/migrations/20260416120000_create_order_with_items_rpc.sql` — exact RPC body
- `bar-pos/src/features/void-order/model/useVoidOrder.ts` — void integration point
- `bar-pos/src/shared/lib/edge-function-contracts.ts:568` — `callVoidOrder` goes to `/functions/v1/void-order`
- `bar-pos/src/entities/ingredient/model/queries.ts` — ingredient entity pattern to follow
- `bar-pos/src/features/manage-products/ui/CatalogProductsTab.tsx:385-449` — product edit Dialog structure
- `bar-pos/src/widgets/SettingsTabsPanel/tabs/ProductsSettingsTab.tsx` — `tabs.tsx` already used (INSTALLED)
- `bar-pos/src/shared/lib/domain.ts` — `StockMovementReasonSchema` (sale + refund already in enum)
- `bar-pos/src/shared/lib/result.ts` — `INVENTORY_NEGATIVE` already in `AppErrorCode`
- `bar-pos/.planning/STATE.md` — shadcn CLI installs to wrong dir; Docker unavailable; audit_log guard decision
- Migration listing — last migration is `20260427000004`, next should be `20260428000001`

### Secondary (MEDIUM confidence — from UI-SPEC + sprint brief)
- `.planning/phases/04-recipes-sale-depletion/04-UI-SPEC.md` — component specs and shadcn component list
- `.planning/feature-expansion-2026q2/sprints/S3b-recipes.md` — RPC contract, test cases, risks

---

## Metadata

**Confidence breakdown:**
- Integration map (add-item-to-tab + void-order): HIGH — verified by reading actual source files
- Migration naming: HIGH — enumerated all migrations, next slot confirmed
- `record_stock_movement` signature: HIGH — read from migration file
- shadcn component status: HIGH — enumerated `src/shared/ui/` directory
- Recipe DB schema: MEDIUM — designed from sprint brief, not from an existing migration
- Override flow architecture: MEDIUM — derived from sprint brief + STATE.md patterns; exact RPC signature to be determined at planning
- audit_log shape: MEDIUM — designed to match STATE.md guard + combo RPC expectations

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable domain; no fast-moving dependencies)
