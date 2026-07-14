# Phase 5: Kitchen Prep + Cocktails — Research

**Researched:** 2026-04-24
**Domain:** PostgreSQL triggers, FSD entity slice, new page route
**Confidence:** HIGH (codebase verified; patterns extracted directly from Phases 3 and 4 artifacts)

---

## Summary

Phase 5 adds chef-side batch production to the stock ledger: a chef inserts a `prep_productions` row, a PL/pgSQL trigger fires, and the trigger atomically credits the prep ingredient (+qty_produced) and debits each raw ingredient (–qty_produced × recipe_qty / yield_qty). Prep ingredients are modeled as ordinary `ingredients` rows with `is_prep = true`. This column already exists in the DB schema from Phase 3.

The biggest schema complexity is extending the `recipes` table. Currently `recipes.product_id` is `NOT NULL UNIQUE`. Phase 5 must make it nullable and add a parallel `prep_ingredient_id` nullable FK, with a CHECK constraint enforcing exactly-one-is-non-null. The `deplete_for_order_item` RPC that Phase 4 ships looks up recipes by `product_id` — the lookup must stay `WHERE product_id = v_product_id` (unaffected by the prep column because product_id will never be NULL when called from an order item context).

The FSD slice `entities/prep/` follows the `entities/recipe/` pattern established in Phase 4 exactly. The `/kitchen-prep` page follows `KdsPage` as the closest structural analog: lazy-loaded page + `BackToHomeButton` + `PageContainer`. RBAC for `/kitchen-prep` uses `adjust_inventory` (manager+) — no new action needed, and no new `chef` role entry in `rbac.ts` is required (see RBAC section).

**Primary recommendation:** Implement in 5 waves — (1) migrations only; (2) Zod + types + Wave 0 stubs; (3) entity slice + trigger behavior tests; (4) feature UI + page; (5) E2E gate + seed data.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| prep_productions insert + ledger writes | Database (Trigger) | — | Atomicity requirement; trigger is the only layer that can guarantee ingredient credit and raw-material debits in one transaction |
| is_prep=true enforcement | Database (Trigger) | — | Server-side constraint; client should never be trusted to enforce this |
| Record stock movements for prep | Database (record_stock_movement RPC) | — | Reuses existing Phase 3 RPC; same SELECT FOR UPDATE concurrency safety |
| PrepProduction list / form state | Feature (produce-prep-batch) | Entity (prep) | Feature owns mutation; entity owns read queries |
| Raw-consumption preview | Feature UI (PrepBatchPreview) | Entity (ingredient) | Pure computation from recipe items — can run client-side from already-fetched recipe data |
| RBAC gate on /kitchen-prep | Frontend Server (KitchenPrepRoute component) | rbac.ts | Mirrors KdsRoute pattern |
| Chef-hat badge | shared/ui | — | Purely presentational; no business logic |

---

## 1. Current Schema State

### ingredients table [VERIFIED: bar-pos/supabase/migrations/20260426000001_ingredients_table.sql]

```sql
CREATE TABLE IF NOT EXISTS ingredients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  uom                     text NOT NULL CHECK (uom IN ('g','kg','ml','L','unit','portion')),
  purchase_uom            text NULL CHECK (purchase_uom IS NULL OR purchase_uom IN ('g','kg','ml','L','unit','case_24','portion')),
  purchase_to_base_factor numeric NOT NULL DEFAULT 1 CHECK (purchase_to_base_factor > 0),
  cost_per_base_unit      numeric(10,4) NOT NULL DEFAULT 0 CHECK (cost_per_base_unit >= 0),
  quantity_on_hand        numeric NOT NULL DEFAULT 0,
  reorder_point           numeric NULL,
  is_prep                 boolean NOT NULL DEFAULT false,  -- ALREADY EXISTS
  is_active               boolean NOT NULL DEFAULT true,
  category                text NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
```

**Critical finding:** `is_prep` column is already live in the DB from Phase 3 migration `20260426000001`. No ALTER TABLE needed for this column. There is already an index on it: `CREATE INDEX idx_ingredients_is_prep ON ingredients (is_prep);`

RLS: authenticated SELECT; manager/admin ALL write (same as Phase 3 pattern).

### record_stock_movement RPC [VERIFIED: bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql]

Signature: `record_stock_movement(p_ingredient_id uuid, p_delta numeric, p_reason text, p_ref_type text, p_ref_id uuid, p_notes text DEFAULT NULL) RETURNS stock_movements`

Key behavior:
- SELECT FOR UPDATE on the ingredient row (concurrency-safe)
- INVENTORY_NEGATIVE guard: raises exception when `v_new < 0 AND p_reason NOT IN ('correction', 'physical_count')`
- `p_reason` must be one of the `StockMovementReason` enum values (STATE.md line 68 confirms: 11 values including `prep_production`, `prep_consumption`)
- The idempotency index (migration `20260426000002`) is `UNIQUE (ref_type, ref_id, ingredient_id) WHERE reason IN ('sale', 'refund', 'void', 'prep_production', 'prep_consumption')` — prep movements ARE covered by the idempotency index [VERIFIED: 03-PATTERNS.md]

The trigger must call `record_stock_movement` with:
- `p_reason = 'prep_production'` for the +qty_produced movement on the prep ingredient
- `p_reason = 'prep_consumption'` for each -qty raw ingredient movement
- `p_ref_type = 'prep_production'` (string matching the table name)
- `p_ref_id = NEW.id` (the prep_productions UUID)

### recipes table [VERIFIED: bar-pos/supabase/migrations/20260428000001_recipes_tables.sql]

Current shape:
```sql
CREATE TABLE recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,  -- must become nullable
  yield_qty   numeric NOT NULL DEFAULT 1 CHECK (yield_qty > 0),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**Migration required:** `product_id NOT NULL` constraint must be dropped; new nullable `prep_ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE` added; CHECK exactly-one constraint added.

### deplete_for_order_item v2 [VERIFIED: bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql]

The recipe lookup is `WHERE product_id = v_product_id` (line 52). After Phase 5's migration makes `product_id` nullable, this WHERE clause still works correctly — it will simply return NOT FOUND for any recipe where `product_id IS NULL` (prep-owned recipes). No change to this RPC needed.

### StockMovementReason enum [VERIFIED: STATE.md line 68]

The reason enum was extended in Phase 1 to 11 values including `prep_production` and `prep_consumption`. These are already in the DB. The trigger can use them immediately.

---

## 2. Prep Productions Design

### Table Shape

```sql
CREATE TABLE prep_productions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_ingredient_id  uuid NOT NULL REFERENCES ingredients(id),
  qty_produced        numeric NOT NULL CHECK (qty_produced > 0),
  notes               text,
  produced_by         uuid REFERENCES profiles(id),  -- nullable; staff context
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

- No `updated_at` — productions are immutable (append-only ledger); corrections done via negative `record_stock_movement` manual adjustment
- `qty_produced > 0` enforced by CHECK constraint (S3c-03 partial coverage at table level)
- RLS: authenticated SELECT; manager/admin INSERT (kitchen role needs INSERT too — see RBAC section)
- No UPDATE/DELETE policies — prep productions are audit-critical, immutable

### Trigger: `trg_prep_production_insert` [ASSUMED for exact trigger body; logic derived from S3c-PRD]

Fires `AFTER INSERT ON prep_productions FOR EACH ROW`.

Behavior:

```
Step 1: Verify is_prep=true
  SELECT is_prep FROM ingredients WHERE id = NEW.prep_ingredient_id
  IF NOT FOUND THEN RAISE 'INGREDIENT_NOT_FOUND'
  IF is_prep = false THEN RAISE 'PREP_INGREDIENT_REQUIRED: ingredient % is not a prep ingredient'

Step 2: Credit prep ingredient
  PERFORM record_stock_movement(
    NEW.prep_ingredient_id,
    NEW.qty_produced,
    'prep_production',
    'prep_production',
    NEW.id,
    NULL
  )

Step 3: Look up recipe for this prep ingredient
  SELECT id, yield_qty FROM recipes WHERE prep_ingredient_id = NEW.prep_ingredient_id
  IF NOT FOUND → RETURN (no raw consumption; prep has no recipe yet)

Step 4: For each recipe_item, consume raw ingredients
  FOR v_item IN SELECT ingredient_id, qty FROM recipe_items WHERE recipe_id = v_recipe_id
    v_delta := -(NEW.qty_produced * v_item.qty / v_yield_qty)
    PERFORM record_stock_movement(
      v_item.ingredient_id,
      v_delta,
      'prep_consumption',
      'prep_production',
      NEW.id,
      NULL
    )
```

**Trigger function must be SECURITY DEFINER** — `record_stock_movement` is already SECURITY DEFINER, but the trigger function itself runs in the inserter's security context unless SECURITY DEFINER is declared. Use SECURITY DEFINER to ensure the function can invoke `record_stock_movement` with the correct `auth.uid()` chain.

**Depth guard (S3c risk: trigger recursion):** Prep of prep. Since `record_stock_movement` does NOT write to `prep_productions`, there is no recursive trigger chain. The trigger only fires on `prep_productions INSERT`; consuming raw ingredients via `record_stock_movement` inserts into `stock_movements` only. **No recursion is possible with this design.** The risk item in the PRD is moot given this architecture.

### Idempotency

The `stock_movements` idempotency index `UNIQUE (ref_type, ref_id, ingredient_id) WHERE reason IN (..., 'prep_production', 'prep_consumption')` means a duplicate prep_productions.id + ingredient_id combination raises `23505`. The trigger should catch `23505` and treat it as a no-op (same pattern as `deplete_for_order_item` callers).

### AppErrorCode

Phase 5 needs one new AppErrorCode: `PREP_INGREDIENT_REQUIRED`. Add to `src/shared/lib/result.ts` union. Current codes listed in CLAUDE.md do not include this.

---

## 3. Recipes Table Extension

### Migration Strategy

New migration file (e.g., `20260429000001_recipes_prep_extension.sql`):

```sql
BEGIN;

-- 1. Make product_id nullable
ALTER TABLE recipes
  ALTER COLUMN product_id DROP NOT NULL;

-- 2. Add prep_ingredient_id FK
ALTER TABLE recipes
  ADD COLUMN prep_ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE;

-- 3. Drop old UNIQUE constraint on product_id
--    (original was: UNIQUE(product_id), built into column definition)
--    In PostgreSQL the implicit unique index name from column-level UNIQUE is typically
--    "recipes_product_id_key". Use IF EXISTS for idempotency.
ALTER TABLE recipes
  DROP CONSTRAINT IF EXISTS recipes_product_id_key;

-- 4. Add new UNIQUE constraints (nullable columns — each can have at most one row per value)
CREATE UNIQUE INDEX recipes_product_id_unique
  ON recipes (product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX recipes_prep_ingredient_id_unique
  ON recipes (prep_ingredient_id)
  WHERE prep_ingredient_id IS NOT NULL;

-- 5. Exactly-one CHECK constraint
ALTER TABLE recipes
  ADD CONSTRAINT recipes_exactly_one_owner
  CHECK (
    (product_id IS NOT NULL AND prep_ingredient_id IS NULL)
    OR
    (product_id IS NULL AND prep_ingredient_id IS NOT NULL)
  );

COMMIT;
```

**Important:** Existing `recipes` rows all have `product_id NOT NULL` — the migration is safe to run on data.

### Impact on Phase 4 code

| Component | Impact | Required change |
|-----------|--------|-----------------|
| `deplete_for_order_item` RPC | `WHERE product_id = v_product_id` still works | None — NULL product_id rows won't match |
| `useRecipe(productId)` hook | `WHERE product_id = productId` still works | None |
| `useMutationSaveRecipe` | Upsert on `product_id` conflict | Works; Phase 5 needs a separate `useMutationSavePrepRecipe` hook that upserts on `prep_ingredient_id` conflict |
| `RecipeSchema` in domain.ts | `productId: UuidSchema` — currently NOT NULL | Must become `productId: UuidSchema.nullable()` and add `prepIngredientId: UuidSchema.nullable()` |

### Zod Schema Changes [ASSUMED — change needed based on current RecipeSchema shape]

```typescript
// domain.ts — extend RecipeSchema
export const RecipeSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema.nullable(),          // was UuidSchema (NOT NULL)
  prepIngredientId: UuidSchema.nullable(),   // new
  yieldQty: z.number().positive(),
  notes: z.string().nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
```

The `RecipeCreateSchema` used by `useMutationSaveRecipe` currently passes `product_id` explicitly. Both save functions (for products and for preps) can use the same table schema; they differ only in which owner column they pass.

---

## 4. FSD Slice Patterns

### entities/prep/ Structure

Follow `entities/recipe/` pattern exactly (Phase 4 established this):

```
src/entities/prep/
  model/
    queries.ts    -- usePrep, usePrepProductions, useMutationCreatePrepProduction, prepKeys
    types.ts      -- re-export PrepProductionSchema from domain.ts
  ui/
    PrepOnHandCard.tsx  -- read-only card showing qty_on_hand for one prep ingredient
  index.ts        -- public barrel
```

**queries.ts pattern** (from `entities/recipe/model/queries.ts`):

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
const db = supabase as any;  // pre-regen cast until supabase.types.ts regenerated

export const prepKeys = {
  all: ['prep_productions'] as const,
  lists: () => [...prepKeys.all, 'list'] as const,
  byIngredient: (id: string) => [...prepKeys.all, 'ingredient', id] as const,
};

export function usePrepProductions(prepIngredientId?: string) { ... }
export function useMutationCreatePrepProduction() {
  // INSERT into prep_productions — trigger does all the ledger work
  // Result<PrepProduction>; on PREP_INGREDIENT_REQUIRED → err(...)
}
```

**index.ts exports:**

```typescript
export { prepKeys, usePrepProductions, useMutationCreatePrepProduction } from './model/queries';
export type { PrepProduction, PrepProductionCreate } from './model/types';
export { PrepProductionSchema, PrepProductionCreateSchema } from './model/types';
export { PrepOnHandCard } from './ui/PrepOnHandCard';
```

### features/produce-prep-batch/ Structure

```
src/features/produce-prep-batch/
  model/
    useProducePrepBatch.ts  -- thin wrapper: calls useMutationCreatePrepProduction
                               orchestrates preview + confirm flow
  ui/
    PrepProductionForm.tsx  -- Dialog form: ingredient picker (is_prep filter), qty, notes
    PrepBatchPreview.tsx    -- raw consumption table (client-side, reads recipe items)
  index.ts
```

`PrepProductionForm.tsx` follows `ComboBuilderForm.tsx` and `AdjustStockMovementDialog.tsx` patterns:
- `Dialog` (not Sheet — compact form)
- `IngredientAutocomplete` from `@entities/ingredient` (reuse Phase 4 component), filter to `is_prep = true`
- `Input` for qty
- `Textarea` for notes
- Confirm button → `useMutationCreatePrepProduction`

`PrepBatchPreview.tsx` is a read-only panel showing the raw ingredient consumption preview before confirming. It takes `recipe: RecipeWithItems | null` + `qtyProduced: number` as props and renders a table. This is purely a client-side calculation — no new query needed.

### shared/ui: ChefHatBadge (S3c-09)

```typescript
// src/shared/ui/ChefHatBadge.tsx
import { ChefHat } from 'lucide-react';
import { Badge } from './badge';

export function ChefHatBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <ChefHat className="h-3 w-3" />
      Prep
    </Badge>
  );
}
```

Storybook story required (CLAUDE.md testing rule: "Storybook: Required for every new shared/ui component").

---

## 5. UI / Page Patterns

### KitchenPrepPage — `src/pages/kitchen-prep/index.tsx`

Closest structural analog: `src/pages/kds/index.tsx` — simple page wrapper with `BackToHomeButton` + `PageContainer`.

```typescript
import { KitchenPrepDashboard } from '@widgets/KitchenPrepDashboard';
import { BackToHomeButton, PageContainer } from '@shared/ui';

export default function KitchenPrepPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Prep">
          <KitchenPrepDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
```

### KitchenPrepDashboard widget — `src/widgets/KitchenPrepDashboard/`

```
src/widgets/KitchenPrepDashboard/
  index.ts
  ui/
    KitchenPrepDashboard.tsx   -- "Prep on hand" grid + "New batch" CTA + recent productions list
```

Layout from PRD:
1. Header section: "Prep on hand" — grid of prep ingredients with `PrepOnHandCard` per item (qty_on_hand + reorder_point visual)
2. "New batch" Button → opens `PrepProductionForm` Dialog
3. Recent productions list: `DataTable` of `prep_productions` (newest first) with columns: prep ingredient name, qty_produced, produced_by, created_at

### Route Registration

In `src/app/router.tsx` add:

```typescript
const KitchenPrepPage = lazy(() => import('../pages/kitchen-prep'));
```

And in Routes:

```tsx
<Route
  path="/kitchen-prep"
  element={
    <ProtectedRoute>
      <KitchenPrepRoute>
        <KitchenPrepPage />
      </KitchenPrepRoute>
    </ProtectedRoute>
  }
/>
```

`KitchenPrepRoute` mirrors `KdsRoute` — checks `can('adjust_inventory')` (see RBAC section).

### Home Dashboard Tile

In `HomeDashboard.tsx` `ITEMS` array, add:

```typescript
{
  path: '/kitchen-prep',
  label: 'Kitchen Prep',
  icon: ChefHat,      // lucide-react ChefHat (already used in ChefHatBadge)
  requiredAction: 'adjust_inventory',
  managerLabel: 'Manager',
},
```

This makes the tile visible to all roles but locked (with pin gate) for bartenders, matching the `adjust_inventory` pattern used by the Inventory tile.

### IngredientsTable Filter (S3c-11)

In `src/widgets/IngredientsTable/`, add an optional `filterPrep?: 'prep' | 'raw' | 'all'` prop. When set, filter the `ingredients` data before rendering:

```typescript
const filtered = filterPrep === 'prep' ? ingredients.filter(i => i.isPrep)
               : filterPrep === 'raw'  ? ingredients.filter(i => !i.isPrep)
               : ingredients;
```

Render `<ChefHatBadge />` in the name column for rows where `isPrep = true`.

---

## 6. RBAC

### Chef Role [VERIFIED: bar-pos/src/shared/lib/rbac.ts]

The `kitchen` role already exists in `rbac.ts` and `STAFF_ROLES`. It currently has `KITCHEN_ACTIONS = new Set(['view_kds', 'clock_in', 'clock_out'])`.

**S3c-16 requires: "chef role alias — treat as manager for prep purposes."**

The PRD says alias chef to manager. There is no separate `chef` role in the DB (`profiles.role` is one of `bartender | manager | admin | kitchen`). The intended meaning is: kitchen staff should be able to insert prep productions.

**Recommended approach:** Add `adjust_inventory` to `KITCHEN_ACTIONS`. This grants kitchen staff access to `/kitchen-prep` and the prep production form without any DB schema change or new role. Kitchen staff do NOT gain access to full inventory management (the `/inventory` page RBAC check is more coarse — the page itself is navigable from Home tile with the manage_products action, not adjust_inventory).

Wait — re-checking: the Inventory Home tile uses `requiredAction: 'adjust_inventory'` (line 51 in HomeDashboard.tsx). If kitchen gets `adjust_inventory`, they get the Inventory tile too. This may be acceptable since the PRD says "treat as manager" for prep purposes.

**Alternative:** Add a new `produce_prep_batch` action to `STAFF_ACTIONS`, add it to `KITCHEN_ACTIONS` and `MANAGER_EXTRA`, and gate `/kitchen-prep` on this new action. This is cleaner RBAC but adds code.

**Recommendation: Add `produce_prep_batch` to STAFF_ACTIONS + KITCHEN_ACTIONS + MANAGER_EXTRA.** This is surgical and doesn't accidentally expand kitchen role permissions to `/inventory`. The planner should confirm this choice.

### RLS on prep_productions

The trigger runs SECURITY DEFINER (inherits the insert user's session), so kitchen staff need INSERT permission on `prep_productions`. RLS policy:

```sql
-- Authenticated can read
CREATE POLICY "prep_productions_select_authenticated" ON prep_productions
  FOR SELECT TO authenticated USING (true);

-- Manager, admin, and kitchen can insert preps
CREATE POLICY "prep_productions_insert_kitchen_manager" ON prep_productions
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('manager', 'admin', 'kitchen'));
```

No UPDATE/DELETE (immutable ledger entries).

---

## 7. Testing Strategy

### Unit Tests (collocated with source)

**`src/shared/lib/prep-math.test.ts`** (or inline in entity):
- `computePrepConsumption(qtyProduced, recipeItems, yieldQty)` — pure function
- Verify: 10 portions × 100g tomato per portion / yield_qty=1 → −1000g
- Verify: partial yield (yield_qty=5, qty_per=200g, produced=3) → −120g per raw ingredient
- Edge: `qty_produced = 0` (should not happen; CHECK in DB; verify pure function handles it)

**`src/entities/prep/model/queries.test.ts`**:
- `usePrepProductions` returns empty array when no productions
- `useMutationCreatePrepProduction` maps `PREP_INGREDIENT_REQUIRED` error correctly

### Property Test P7 (S3c-12)

**Invariant:** For any set of prep_productions inserting into the same prep ingredient, the total positive stock_movements quantity_delta for that ingredient equals the sum of qty_produced across all productions. No double-counting: exactly one `prep_production` movement row per (prep_productions.id, ingredient_id) pair.

```typescript
// src/features/produce-prep-batch/model/prep-ledger.test.ts
import fc from 'fast-check';

// Simulate the trigger logic in pure functions
function simulatePrepBatch(batches: Array<{id: string, qtyProduced: number}>): number {
  // sum of all positive movements for the prep ingredient
  return batches.reduce((sum, b) => sum + b.qtyProduced, 0);
}

test('P7: total prep credit = sum(qty_produced) — no double-count', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.uuidV(4),
          qtyProduced: fc.float({ min: Math.fround(0.01), max: Math.fround(9999) }),
        }),
        { minLength: 1, maxLength: 20 }
      ),
      batches => {
        const expected = batches.reduce((s, b) => s + b.qtyProduced, 0);
        expect(simulatePrepBatch(batches)).toBeCloseTo(expected, 5);
      }
    ),
    { numRuns: 500 }
  );
});
```

**Note:** `fc.float` boundaries must use `Math.fround()` per fast-check v4 pattern confirmed in STATE.md (Phase 04-06 decision).

### Integration Tests

Location pattern: `src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts`

Mirrors `split-tab-rpc.integration.test.ts` and `process-refund-rpc.integration.test.ts` patterns from Phase 6.

Test cases:
1. **I1 — Prep with no recipe:** Insert prep_production → prep ingredient qty +N; stock_movements has exactly 1 row for this prep_productions.id; raw ingredients unchanged
2. **I2 — Prep with recipe:** Insert prep_production for Salsa (recipe: 100g tomato + 10g onion per portion) at qty=10 → salsa +10, tomato −1000, onion −100; stock_movements has 3 rows for this prep_productions.id
3. **I3 — Non-prep ingredient rejected:** Insert prep_production referencing `is_prep=false` ingredient → trigger raises `PREP_INGREDIENT_REQUIRED`; no stock movements written
4. **I4 — Negative raw stock guard:** Insert prep_production when raw ingredient has insufficient stock → `INVENTORY_NEGATIVE` raised; no partial movements committed (transaction rolled back)
5. **I5 — Sell menu item using prep:** After seeding Alitas recipe (1 portion Salsa), sell 1 Alitas order_item → salsa quantity_on_hand decreases by 1 (deplete_for_order_item finds recipe via `product_id`)

**Credential skip pattern** (from STATE.md Phase 06 decision):
```typescript
describe.skipIf(!hasIntegrationEnv)('Integration tests', () => { ... })
```

### E2E spec: 21-prep.spec.ts

Follows `36-recipes.spec.ts` and `33-ingredients.spec.ts` patterns.

| Test | Flow | Key Assertion |
|------|------|---------------|
| T1 | Seed data validation | Salsa Mexicana is_prep=true, tomato 2000g, onion 300g visible |
| T2 | Chef produces 10 Salsa batches | Toast "Batch recorded"; stock_movements: salsa +10, tomato −1000, onion −100 |
| T3 | Bartender sells 3 Alitas | Salsa qty goes from 10 → 7 (deplete_for_order_item via product recipe) |
| T4 | Edge produce (10 more, exactly 1000g tomato) | Succeeds at boundary |
| T5 | Blocked produce (11 batches, only 1000g tomato → needs 1100g) | Error toast "insufficient stock"; no movement rows written |

---

## 8. Validation Architecture

### Test Framework [VERIFIED: bar-pos/package.json pattern from CLAUDE.md]

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | bar-pos/vitest.config.ts |
| Quick run | `cd bar-pos && npx vitest run src/features/produce-prep-batch` |
| Full suite | `cd bar-pos && npm run test` |
| E2E | `cd bar-pos && npx playwright test e2e/21-prep.spec.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| S3c-01 | prep_productions table exists with correct shape | integration I1 | `npx vitest run src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` |
| S3c-02 | Trigger writes +prep and −raw movements atomically | integration I2 | same |
| S3c-03 | Trigger rejects non-prep ingredient | integration I3 | same |
| S3c-04 | PrepProductionSchema validates correctly | unit | `npx vitest run src/entities/prep/model/queries.test.ts` |
| S3c-05 | entities/prep/ slice exports correct API | unit | `npx vitest run src/entities/prep` |
| S3c-06 | PrepProductionForm submits and reflects result | E2E T2 | `npx playwright test e2e/21-prep.spec.ts` |
| S3c-07 | /kitchen-prep route loads with prep grid | E2E T1 | same |
| S3c-08 | Home tile navigates to /kitchen-prep | E2E T1 | same |
| S3c-09 | ChefHatBadge renders (visual) | Storybook | `npm run storybook` |
| S3c-12 | P7 no double-count invariant | property | `npx vitest run src/features/produce-prep-batch/model/prep-ledger.test.ts` |
| S3c-13 | Sell item using prep → prep qty drops | integration I5 | integration test file |
| S3c-14 | Full E2E flow T1–T5 | E2E | `npx playwright test e2e/21-prep.spec.ts` |

### Wave 0 Gaps

- [ ] `src/entities/prep/model/queries.test.ts` — unit stubs for S3c-04, S3c-05
- [ ] `src/features/produce-prep-batch/model/prep-ledger.test.ts` — P7 property test stub
- [ ] `src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` — integration stubs I1–I5
- [ ] `bar-pos/e2e/21-prep.spec.ts` — E2E spec stub

---

## 9. Risk Register

### Risk 1: recipes table extension breaks Phase 4 recipe editor UI [HIGH likelihood if not careful]

**What could go wrong:** `RecipeSchema.productId` changes from `UuidSchema` to `UuidSchema.nullable()`. Any component that reads `recipe.productId` without a null guard will throw a TypeScript error after the schema change.

**Impact:** `RecipePreviewPanel.tsx`, `RecipeEditorTab.tsx`, `useMutationSaveRecipe` all use `productId` directly.

**Mitigation:**
1. Update `RecipeSchema` in domain.ts to make `productId` nullable AND add `prepIngredientId` nullable.
2. Run `npm run typecheck` immediately after schema change — TypeScript strict mode will surface all null-safety gaps.
3. In `useMutationSaveRecipe`, the upsert on `{ onConflict: 'product_id' }` will break if `product_id` is NULL. Split into two save functions: `useMutationSaveRecipe` (product owner) and `useMutationSavePrepRecipe` (prep owner). Each passes the correct `onConflict` target.
4. `deplete_for_order_item` lookup is `WHERE product_id = v_product_id` — NOT `WHERE product_id IS NOT NULL AND product_id = v_product_id`. The latter form would be safer; consider adding `AND product_id IS NOT NULL` to that WHERE clause in a v3 migration for clarity [ASSUMED — confirm with SQL behavior: equality predicate `WHERE product_id = uuid_value` already excludes NULL rows by default in PostgreSQL].

### Risk 2: INVENTORY_NEGATIVE during prep rolls back the entire trigger [MEDIUM — by design, but UX implication]

**What could go wrong:** The trigger calls `record_stock_movement` for both the prep credit (+qty) and all raw debits (−qty). If any raw ingredient hits INVENTORY_NEGATIVE, the entire trigger rolls back — including the prep credit row. This is correct atomic behavior, but the user needs to see a clear error message identifying WHICH raw ingredient is short.

**Impact:** Without specific messaging, the user sees a generic error and cannot act.

**Mitigation:**
1. The trigger should pass `p_ingredient_id` in the RAISE EXCEPTION message when INVENTORY_NEGATIVE occurs (same pattern as `record_stock_movement` itself: `'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id`).
2. The `useProducePrepBatch` mutation hook must parse the error message to extract the ingredient_id and display a meaningful toast: "Insufficient [ingredient name] — need [X], have [Y]."
3. The PrepBatchPreview panel highlights in red any raw ingredient whose `qty_on_hand < needed` (purely client-side, no RPC call needed).

### Risk 3: supabase.types.ts manual transcription errors [MEDIUM — inherent to Docker-unavailable workflow]

**What could go wrong:** Phase 5 adds `prep_productions` table and extends `recipes` table. Manual transcription to `supabase.types.ts` may miss columns or use wrong types.

**Impact:** TypeScript compiles with errors after transcription; or worse, silent type mismatch if `supabase as any` cast is used everywhere.

**Mitigation:**
1. Use the established `const db = supabase as any` pre-regen cast in all new entity/feature files until types are regenerated (CLAUDE.md documented workaround).
2. Add a `// TODO: regenerate types after Phase 5 migrations applied` comment in `supabase.types.ts` extension block.
3. Transcribe only the columns that are actually queried (not exhaustive) — reduces surface area for errors.
4. STATE.md decision from Phase 02: "supabase.types.ts manually extended (Docker unavailable); all Plan 02 migration columns/tables transcribed deterministically" — follow same discipline.

---

## 10. Implementation Sequence

### Recommended Wave Ordering

**Wave 1 — Schema (blocking):**
- Migration 1: `prep_productions` table + RLS + indexes
- Migration 2: `recipes` table extension (product_id nullable + prep_ingredient_id + CHECK)
- Migration 3: `prep_productions_insert` trigger + `trg_prep_production` function (SECURITY DEFINER)
- `[BLOCKING]` supabase db push checkpoint
- Manual transcription of `prep_productions` + `recipes` extension into `supabase.types.ts`

**Wave 2 — Types + Zod + AppErrorCode (parallel after Wave 1):**
- `domain.ts`: `PrepProductionSchema`, `PrepProductionCreateSchema` + update `RecipeSchema` (productId nullable, add prepIngredientId)
- `result.ts`: add `PREP_INGREDIENT_REQUIRED` to AppErrorCode union
- `rbac.ts`: add `produce_prep_batch` to STAFF_ACTIONS + KITCHEN_ACTIONS + MANAGER_EXTRA
- Wave 0 test stubs (4 files)

**Wave 3 — Entity + Feature model (parallel after Wave 2):**
- `src/entities/prep/` FSD slice (queries + types + PrepOnHandCard + index)
- `src/features/produce-prep-batch/model/useProducePrepBatch.ts`
- Integration tests I1–I5
- P7 property test

**Wave 4 — UI (parallel after Wave 3):**
- `src/shared/ui/ChefHatBadge.tsx` + Storybook story
- `src/features/produce-prep-batch/ui/PrepProductionForm.tsx`
- `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx`
- `src/widgets/KitchenPrepDashboard/` (PrepOnHandGrid + PrepProductionsList)
- `src/pages/kitchen-prep/index.tsx` + `src/app/kitchen-prep-route.tsx`
- Router registration + Home tile
- `src/widgets/IngredientsTable/` filter prop + `ChefHatBadge` in name column

**Wave 5 — Seed + E2E (serial gate):**
- `scripts/seed-prep.ts` — Michelada mix + Salsa Mexicana + Alitas recipe
- `e2e/21-prep.spec.ts` — T1–T5
- Typecheck + lint + full unit suite gate
- Human E2E run + sign-off

---

## Project Constraints (from CLAUDE.md)

| Constraint | Category | Applies to Phase 5 |
|------------|----------|-------------------|
| FSD import hierarchy: app→pages→widgets→features→entities→shared | Architecture | All new slices |
| `exactOptionalPropertyTypes: true` — use `prop: string \| undefined`, never `prop?: string` for mutation inputs | TypeScript | PrepProductionCreate inputs |
| `noUncheckedIndexedAccess: true` — array access is `T \| undefined` | TypeScript | Recipe items loop in preview |
| No `any` without justification comment | TypeScript | Pre-regen cast requires eslint-disable |
| Zod schemas in domain.ts — never manual interfaces | Architecture | PrepProductionSchema goes in domain.ts |
| `supabase as any` pre-regen cast pattern with eslint-disable at file level | DB | All new entity/feature query files |
| `export * banned` — use explicit named exports | ESLint | index.ts barrels |
| shadcn CLI installs to src/app/components/ui/ — always move to src/shared/ui/ | Convention | If any new shadcn component needed |
| Storybook required for every new shared/ui component | Testing | ChefHatBadge.stories.tsx |
| `fast-check` import must precede vitest in test files (import/order) | ESLint | P7 test file |
| `fc.float` must use `Math.fround()` boundaries (fast-check v4) | Testing | P7 test |
| Seed scripts: `eslint-disable` at file level + `supabase as any` + VITE_SUPABASE_URL from .env.local | Convention | seed-prep.ts |
| Docker unavailable for supabase gen types — manual transcription to supabase.types.ts | Infrastructure | Post Wave-1 transcription |
| `import order`: @features/* before @entities/* per ESLint import/order rule | ESLint | KitchenPrepDashboard imports |
| `useReducer` over multiple `useState` in useEffect contexts (react-hooks/set-state-in-effect) | ESLint | PrepProductionForm if complex state needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The trigger function should be SECURITY DEFINER to match record_stock_movement's call expectations | Prep Productions Design | Without SECURITY DEFINER, auth.uid() may be null in trigger context; audit trail breaks |
| A2 | Adding `produce_prep_batch` action to STAFF_ACTIONS is cleaner than aliasing kitchen to manager | RBAC | If alias approach preferred, KITCHEN_ACTIONS would include adjust_inventory — inadvertently grants access to full /inventory page |
| A3 | `WHERE product_id = v_product_id` excludes NULL rows by default in PostgreSQL (no NULL equality) | Recipes Extension — Impact on Phase 4 | Standard SQL behavior; virtually certain, but worth confirming during migration testing |
| A4 | The constraint name for `product_id UNIQUE` on recipes table is `recipes_product_id_key` | Recipes Extension | If different name, DROP CONSTRAINT will fail; use IF EXISTS guard or introspect via `\d recipes` |
| A5 | `useReducer` will be needed in PrepProductionForm (has staged state: select prep → set qty → preview) | UI Patterns | If simple useState suffices, useReducer adds unnecessary complexity; planner should decide based on form complexity |

**If this table is empty:** All claims were verified. It is not empty — 5 assumptions require confirmation or validation during implementation.

---

## Open Questions (RESOLVED)

1. **RBAC: produce_prep_batch vs. adjust_inventory** — RESOLVED: Add `produce_prep_batch` to STAFF_ACTIONS + KITCHEN_ACTIONS + MANAGER_EXTRA. Surgical new action avoids accidentally granting kitchen access to full `/inventory` page.
   - What we know: `kitchen` role exists; PRD says "treat as manager for prep"; adjust_inventory is the closest existing action
   - What's unclear: Whether granting kitchen the full `/inventory` page access is acceptable
   - Recommendation: Add `produce_prep_batch` action — surgical and reversible

2. **useMutationSavePrepRecipe — separate hook or extend existing?** — RESOLVED: Two separate hooks. `useMutationSaveRecipe` unchanged (product-owner upsert); new `useMutationSavePrepRecipe` in entities/prep/ (prep-owner upsert on prep_ingredient_id conflict).
   - What we know: `useMutationSaveRecipe` currently upserts on `product_id` conflict
   - What's unclear: Whether a single hook with a discriminated union input or two separate hooks is cleaner
   - Recommendation: Two hooks (`useMutationSaveRecipe` unchanged, new `useMutationSavePrepRecipe`) — simpler and avoids conditional upsert logic

3. **Trigger: AFTER INSERT vs BEFORE INSERT** — RESOLVED: Use AFTER INSERT. Postgres AFTER triggers can RAISE EXCEPTION which rolls back the triggering INSERT. Same pattern as add_combo_to_tab exception guards.
   - What we know: The trigger must reject non-prep ingredients (step 1) before writing movements
   - What's unclear: BEFORE INSERT triggers can prevent the INSERT but cannot call RPCs that modify other tables in some configurations
   - Recommendation: Use AFTER INSERT trigger with the RAISE EXCEPTION in step 1 still working (Postgres AFTER triggers can raise exceptions, which rolls back the INSERT). This is the same pattern as `add_combo_to_tab` EXCEPTION guards.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase remote DB | All migrations | ✓ | Remote (verified by prior phases) | — |
| Docker | supabase gen types | ✗ | — | Manual supabase.types.ts transcription (established pattern) |
| Node / npx tsx | seed scripts | ✓ | (matches prior phases) | — |
| Playwright | E2E spec | ✓ | v1.59 (CLAUDE.md) | — |
| Vitest | unit + property tests | ✓ | v4 (CLAUDE.md) | — |
| fast-check | P7 property test | ✓ | v4 (STATE.md confirmed) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Docker → manual types transcription (established workflow).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not a new auth surface |
| V3 Session Management | No | No new session logic |
| V4 Access Control | Yes | RBAC gate on /kitchen-prep + RLS on prep_productions |
| V5 Input Validation | Yes | Zod PrepProductionCreateSchema; DB CHECK (qty_produced > 0) |
| V6 Cryptography | No | No new crypto surfaces |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bartender inserts prep_production directly (bypass UI) | Elevation of Privilege | RLS `WITH CHECK (get_user_role() IN ('manager', 'admin', 'kitchen'))` on INSERT |
| Negative qty_produced to subtract prep stock | Tampering | DB-level `CHECK (qty_produced > 0)` |
| Double-insert of same prep_productions row | Tampering | Idempotency index on stock_movements `(ref_type, ref_id, ingredient_id)` for prep_production reason |
| Client passes non-prep ingredient_id | Tampering | Trigger RAISES PREP_INGREDIENT_REQUIRED; INSERT rolled back |
| Prep audit trail bypass | Repudiation | Trigger is SECURITY DEFINER; stock_movements insert cannot be bypassed from client |

---

## Sources

### Primary (HIGH confidence)

- `bar-pos/supabase/migrations/20260426000001_ingredients_table.sql` — ingredients schema + is_prep column
- `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql` — RPC signature + INVENTORY_NEGATIVE behavior
- `bar-pos/supabase/migrations/20260428000001_recipes_tables.sql` — recipes table current shape
- `bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql` — recipe lookup pattern
- `bar-pos/src/shared/lib/rbac.ts` — existing roles, actions, and KITCHEN_ACTIONS set
- `bar-pos/src/app/router.tsx` — route registration pattern
- `bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx` — ITEMS array + DashboardItem type
- `bar-pos/src/app/kds-route.tsx` — RBAC route guard pattern
- `bar-pos/src/pages/kds/index.tsx` — page structure pattern
- `.planning/STATE.md` — decisions + StockMovementReason enum values
- `.planning/feature-expansion-2026q2/sprints/S3c-prep-cocktails.md` — PRD requirements

### Secondary (MEDIUM confidence)

- `.planning/phases/03-ingredient-foundation/03-PATTERNS.md` — FSD slice patterns + pre-regen cast pattern
- `.planning/phases/04-recipes-sale-depletion/04-01-SUMMARY.md` — audit_log schema
- `.planning/phases/04-recipes-sale-depletion/04-03-PLAN.md` — recipe entity implementation

---

## Metadata

**Confidence breakdown:**
- Current schema state: HIGH — read directly from migration files
- Prep productions design: HIGH for table shape; MEDIUM for trigger body (derived from PRD, not implemented)
- Recipes extension: HIGH for migration strategy; MEDIUM for downstream impact
- FSD patterns: HIGH — carbon copy of entities/recipe/ and entities/ingredient/ patterns
- RBAC: HIGH for existing setup; MEDIUM for Phase 5 addition recommendation
- Testing strategy: HIGH — mirrors established Phase 3/4 test patterns exactly

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable domain; recipes/ingredients schema not expected to change)

---

## RESEARCH COMPLETE
