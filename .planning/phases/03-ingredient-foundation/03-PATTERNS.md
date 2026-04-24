# Phase 3: Ingredient Foundation — Pattern Map

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Mapped:** 2026-04-23
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260426000001_ingredients_table.sql` | migration | CRUD | `supabase/migrations/20260425000001_combo_schema.sql` | exact |
| `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` | migration | CRUD | `supabase/migrations/20260424000001_stock_movements.sql` | exact |
| `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | migration | event-driven | `supabase/migrations/20260425000005_add_combo_to_tab_rpc.sql` | exact |
| `src/shared/lib/domain.ts` (extend — add Ingredient/UOM schemas) | utility | transform | `src/shared/lib/domain.ts` lines 1389–1445 (COMBO section) | exact |
| `src/shared/lib/uom.ts` (new) | utility | transform | `src/shared/lib/pool-billing.ts` | role-match |
| `src/shared/lib/uom.test.ts` (new) | test | transform | `src/shared/lib/pool-billing.test.ts` | role-match |
| `src/entities/ingredient/model/types.ts` | model | CRUD | `src/entities/combo/model/types.ts` | exact |
| `src/entities/ingredient/model/queries.ts` | model | CRUD | `src/entities/combo/model/queries.ts` + `src/entities/category/model/queries.ts` | exact |
| `src/entities/ingredient/index.ts` | model | CRUD | `src/entities/combo/index.ts` | exact |
| `src/features/manage-ingredients/ui/ManageIngredientsTab.tsx` | component | CRUD | `src/features/manage-combos/ui/ManageCombosTab.tsx` | exact |
| `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | component | file-I/O | `src/features/manage-combos/ui/ComboBuilderForm.tsx` (Sheet pattern) | partial |
| `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` | component | request-response | `src/features/manage-combos/ui/ManageCombosTab.tsx` (Dialog + mutation pattern) | role-match |
| `src/widgets/IngredientsTable/index.tsx` | component | CRUD | `src/features/manage-combos/ui/ManageCombosTab.tsx` (list + DataTable pattern) | role-match |
| `src/widgets/StockMovementsList/index.tsx` | component | CRUD | `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` (read-only list) | role-match |
| `src/widgets/SettingsTabsPanel/index.tsx` (modify — add Ingredients tab) | component | CRUD | `src/widgets/SettingsTabsPanel/index.tsx` | exact |
| `e2e/33-ingredients.spec.ts` | test | request-response | `e2e/32-combos.spec.ts` | exact |

---

## Pattern Assignments

---

### `supabase/migrations/20260426000001_ingredients_table.sql` (migration, CRUD)

**Analog:** `bar-pos/supabase/migrations/20260425000001_combo_schema.sql`

**File structure pattern** (lines 1–7):
```sql
-- =============================================================================
-- S3a-01: ingredients table + CHECK constraints + indexes
-- =============================================================================

-- UP:
BEGIN;
```

**Table creation pattern with CHECKs** (from combo_schema.sql lines 8–18):
```sql
CREATE TABLE IF NOT EXISTS combo_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label         text NOT NULL,
  slot_type     text NOT NULL CHECK (slot_type IN ('product', 'pool_time')),
  min_qty       integer NOT NULL DEFAULT 1,
  ...
  CONSTRAINT combo_slots_min_max_check CHECK (min_qty >= 1 AND max_qty >= min_qty)
);
```

**Index pattern** (from combo_schema.sql lines 21–22):
```sql
CREATE INDEX idx_combo_slots_combo_product_id ON combo_slots(combo_product_id);
CREATE INDEX idx_combo_slots_sort_order ON combo_slots(sort_order);
```

**RLS pattern** (from combo_schema.sql lines 50–74):
```sql
ALTER TABLE combo_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_auth_select_combo_slots" ON combo_slots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_admin_write_combo_slots" ON combo_slots
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('manager', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('manager', 'admin'));
```

**DOWN block pattern** (from combo_schema.sql lines 76–84):
```sql
-- =============================================================================
-- DOWN:
-- BEGIN;
-- DROP TABLE IF EXISTS combo_availability;
-- DROP TABLE IF EXISTS combo_slot_options;
-- DROP TABLE IF EXISTS combo_slots;
-- COMMIT;
-- =============================================================================
```

---

### `supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` (migration, CRUD)

**Analog:** `bar-pos/supabase/migrations/20260424000001_stock_movements.sql`

**Partial unique index pattern** (from stock_movements.sql lines 12–14):
```sql
ALTER INDEX IF EXISTS idx_inventory_log_product_id RENAME TO idx_stock_movements_product_id;
```

The idempotency index for Phase 3 uses a WHERE clause (partial index). Copy the `BEGIN;` / `COMMIT;` wrapping and the index naming convention `idx_stock_movements_*`:
```sql
-- UP: idempotency unique index on stock_movements
BEGIN;

CREATE UNIQUE INDEX idx_stock_movements_idempotency
  ON stock_movements (ref_type, ref_id, ingredient_id)
  WHERE reason IN ('sale', 'refund', 'void', 'prep_production', 'prep_consumption');

COMMIT;
```

---

### `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` (migration, event-driven)

**Analog:** `bar-pos/supabase/migrations/20260425000005_add_combo_to_tab_rpc.sql`

**RPC file structure** (lines 1–11):
```sql
-- =============================================================================
-- S2-05: add_combo_to_tab transactional RPC
-- ...
-- =============================================================================

-- UP: add_combo_to_tab transactional RPC
BEGIN;

CREATE OR REPLACE FUNCTION add_combo_to_tab(...)
```

**SECURITY DEFINER declaration pattern** (lines 23–24):
```sql
LANGUAGE plpgsql
SECURITY DEFINER
```

**`auth.uid()` capture pattern** (lines 43–44):
```sql
  -- Capture calling user for orders.staff_id (SECURITY DEFINER preserves auth.uid())
  v_staff_id := auth.uid();
```

**RAISE EXCEPTION pattern for error codes** (lines 45–50):
```sql
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INGREDIENT_NOT_FOUND: ingredient % does not exist', p_ingredient_id;
  END IF;
  ...
  RAISE EXCEPTION 'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id;
```

**GRANT EXECUTE pattern** (line 245):
```sql
GRANT EXECUTE ON FUNCTION add_combo_to_tab(uuid, uuid, jsonb, boolean, text) TO authenticated;
```

**COMMIT + DOWN block** (lines 247–253):
```sql
COMMIT;

-- =============================================================================
-- DOWN:
-- REVOKE EXECUTE ON FUNCTION ...;
-- DROP FUNCTION IF EXISTS ...;
-- =============================================================================
```

---

### `src/shared/lib/domain.ts` — extensions (IngredientSchema, UomSchema, ManualAdjustReasonSchema)

**Analog:** `src/shared/lib/domain.ts` lines 1389–1445 (COMBO section)

**Section marker pattern** (lines 1389–1391):
```typescript
// ============================================================================
// COMBO
// ============================================================================
```

Copy this pattern, changing the header to `// S3a — INGREDIENT FOUNDATION`.

**Schema + inferred types pattern** (lines 1396–1413):
```typescript
export const ComboSlotSchema = z.object({
  id: UuidSchema,
  comboProductId: UuidSchema,
  label: z.string().min(1).max(100),
  slotType: ComboSlotTypeSchema,
  ...
  createdAt: TimestampSchema,
});

export const ComboSlotCreateSchema = ComboSlotSchema.omit({ id: true, createdAt: true });
export const ComboSlotUpdateSchema = ComboSlotSchema.partial().required({ id: true });

export type ComboSlot = z.infer<typeof ComboSlotSchema>;
export type ComboSlotCreate = z.infer<typeof ComboSlotCreateSchema>;
export type ComboSlotUpdate = z.infer<typeof ComboSlotUpdateSchema>;
```

**`StockMovementSchema` line to change** (line 641):
```typescript
// BEFORE (line 641):
quantityDelta: z.number().int(),
// AFTER (Phase 3 allows non-integer ingredient deltas):
quantityDelta: z.number(),
```

---

### `src/shared/lib/uom.ts` (new utility, transform)

**Analog:** `bar-pos/src/shared/lib/pool-billing.ts`

**File header pattern** (pool-billing.ts lines 1–3):
```typescript
/**
 * Pool session billing — matches `useMutationStopSession` arithmetic exactly.
 */
```

Copy this style: a single-line purpose JSDoc, then exported interfaces/types, then pure functions.

**Pure utility function pattern** (pool-billing.ts lines 38–50):
```typescript
export function computePoolSessionBilling(
  input: ComputePoolSessionBillingInput
): ComputePoolSessionBillingResult {
  const { firstHourMode = 'prorated', prepaidMinutes = 0 } = input;
  const elapsedMs = Math.max(0, input.endTime.getTime() - input.startedAt.getTime());
  ...
}
```

**No imports** — pool-billing.ts has zero imports; uom.ts should also have zero imports (pure arithmetic).

**`as const` tuple pattern** (domain.ts lines 111–122 for enum pattern):
```typescript
export const BASE_UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'portion'] as const;
export type BaseUom = typeof BASE_UOMS[number];
```

---

### `src/entities/ingredient/model/types.ts` (model, CRUD)

**Analog:** `bar-pos/src/entities/combo/model/types.ts` (all 21 lines)

**Full file pattern** (combo/model/types.ts lines 1–21):
```typescript
// src/entities/combo/model/types.ts
// Re-export all combo types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  ComboSlot,
  ComboSlotCreate,
  ComboSlotUpdate,
  ComboSlotOption,
  ComboSlotOptionCreate,
  ComboAvailability,
  ComboAvailabilityCreate,
  SlotSelection,
  AddComboToTabInput,
} from '@shared/lib/domain';
export {
  ComboSlotSchema,
  ComboSlotOptionSchema,
  ComboAvailabilitySchema,
  SlotSelectionSchema,
} from '@shared/lib/domain';
```

Replace combo types with ingredient types (`Ingredient`, `IngredientCreate`, `IngredientUpdate`, `IngredientSchema`, `IngredientCreateSchema`, `IngredientUpdateSchema`).

---

### `src/entities/ingredient/model/queries.ts` (model, CRUD)

**Primary analog:** `bar-pos/src/entities/combo/model/queries.ts` (full file, 197 lines)
**Secondary analog:** `bar-pos/src/entities/category/model/queries.ts` (for Result<T> + row mapper pattern)

**File header + pre-regen cast** (combo/model/queries.ts lines 1–21):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/combo/model/queries.ts
 *
 * TanStack Query hooks for combo data.
 * Uses `const db = supabase as any` pre-regen cast — combo tables not yet in supabase.types.ts.
 * Regenerate types after migrations applied: npx supabase gen types typescript --local
 */
import { useQuery } from '@tanstack/react-query';
import { ... } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts is regenerated after combo migrations
const db = supabase as any;
```

**Query key factory pattern** (combo/model/queries.ts lines 23–30):
```typescript
export const comboKeys = {
  all: ['combos'] as const,
  lists: () => [...comboKeys.all, 'list'] as const,
  detail: (id: string) => [...comboKeys.all, 'detail', id] as const,
  slots: (comboId: string) => [...comboKeys.all, 'slots', comboId] as const,
};
```

For ingredients, extend with a `movements` key:
```typescript
export const ingredientKeys = {
  all: ['ingredients'] as const,
  lists: () => [...ingredientKeys.all, 'list'] as const,
  detail: (id: string) => [...ingredientKeys.all, 'detail', id] as const,
  movements: (ingredientId: string) => [...ingredientKeys.all, 'movements', ingredientId] as const,
};
```

**useQuery hook pattern** (combo/model/queries.ts lines 33–50):
```typescript
export function useCombos() {
  return useQuery({
    queryKey: comboKeys.lists(),
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await db
        .from('products')
        .select('*, categories(*)')
        .eq('is_combo', true)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) {
        logger.error('useCombos: query failed', { error });
        throw error;
      }
      return (data ?? []) as Product[];
    },
  });
}
```

**Row mapper with Zod parse** (category/model/queries.ts lines 28–46):
```typescript
function mapCategoryRow(row: Tables<'categories'>): Result<Category> {
  try {
    return ok(
      CategorySchema.parse({
        id: row.id,
        name: row.name,
        color: row.color,
        sortOrder: row.sort_order,
        ...
        createdAt: new Date(row.created_at),
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}
```

**Enabled guard pattern** (combo/model/queries.ts lines 53–70):
```typescript
export function useCombo(id: string | null) {
  return useQuery({
    queryKey: comboKeys.detail(id ?? ''),
    enabled: id != null && id.length > 0,
    queryFn: async (): Promise<Product | null> => {
      if (!id) return null;
      ...
    },
  });
}
```

Use this `enabled: id != null && id.length > 0` guard for `useIngredient(id)` and `useStockMovements(ingredientId)`.

**useMutation with invalidation pattern** (category/model/queries.ts lines 147–176):
```typescript
export function useMutationCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryCreate): Promise<Result<Category>> => {
      const res = await supabaseMutation(() =>
        supabase.from('categories').insert(insertRow).select('*').single()
      );
      if (!res.ok) {
        logger.error('categories.create_failed', { message: res.error.message });
        return res;
      }
      return mapCategoryRow(res.data as unknown as Tables<'categories'>);
    },
    onSuccess: result => {
      if (result.ok) invalidateCategoryQueries(queryClient);
    },
  });
}
```

---

### `src/entities/ingredient/index.ts` (model public API)

**Analog:** `bar-pos/src/entities/combo/index.ts` (all 29 lines)

**Full file pattern** (combo/index.ts lines 1–29):
```typescript
/**
 * Combo entity public API.
 *
 * Import from here: `import { useCombos } from '@entities/combo'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export {
  useCombo,
  useCombos,
  comboKeys,
} from './model/queries';
export type {
  ComboSlot,
  ...
} from './model/types';
```

Replace with ingredient exports: `useIngredients`, `useIngredient`, `useStockMovements`, `useIngredientsActive`, `ingredientKeys` from queries; `Ingredient`, `IngredientCreate`, `IngredientUpdate`, `IngredientSchema` from types.

---

### `src/features/manage-ingredients/ui/ManageIngredientsTab.tsx` (component, CRUD)

**Analog:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` (all 254 lines)

**File header + pre-regen cast** (lines 1–27):
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
/**
 * ManageCombosTab
 * ...
 * Uses `const db = supabase as any` pre-regen cast ...
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCombos, comboKeys } from '@entities/combo';
...
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';

const db = supabase as any;
```

**Mutation pattern** (lines 33–58):
```typescript
function useMutationCreateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await db
        .from('products')
        .insert({ name: 'New Combo', base_price: 0, is_combo: true, is_active: true, category_id: null })
        .select('id').single();
      if (error) {
        logger.error('useMutationCreateCombo: insert failed', { error });
        throw error;
      }
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.lists() });
    },
  });
}
```

**Dialog state union pattern** (line 91):
```typescript
type ComboDialogState = { kind: 'edit'; comboId: string } | { kind: 'delete'; combo: Product };
```

**Loading / error / empty state pattern** (lines 119–130):
```typescript
if (queryError) {
  return <p className="text-sm text-destructive">Could not load combos: {queryError.message}</p>;
}
if (isLoading) {
  return <p className="text-sm text-muted-foreground">Loading combos…</p>;
}
```

**Header with description + CTA** (lines 131–145):
```typescript
<div className="space-y-4">
  <div className="flex items-center justify-between gap-2">
    <p className="text-sm text-muted-foreground">
      Manage combo products — bundles of items sold at a single price.
    </p>
    <Button type="button" size="sm" disabled={createMutation.isPending} onClick={...}>
      {createMutation.isPending ? 'Creating…' : '+ Add combo'}
    </Button>
  </div>
```

**Empty state pattern** (lines 147–163):
```typescript
<div className="rounded-md border px-4 py-10 text-center space-y-2">
  <p className="font-semibold text-base">No combos yet</p>
  <p className="text-sm text-muted-foreground">...</p>
  <Button type="button" size="sm" className="mt-2" ...>Add combo</Button>
</div>
```

**Row action icon pattern** (lines 172–198):
```typescript
<div className="flex items-center gap-1">
  <Button type="button" variant="outline" size="sm" aria-label={`Edit ${combo.name}`}
    onClick={() => { setDialogState({ kind: 'edit', comboId: combo.id }); }}>
    <Pencil className="size-3.5" />
    <span className="ml-1 text-xs">Edit</span>
  </Button>
  <Button type="button" variant="outline" size="sm" aria-label={`Delete ${combo.name}`}
    onClick={() => { setDialogState({ kind: 'delete', combo }); }}>
    <Trash2 className="size-3.5" />
  </Button>
</div>
```

**Edit dialog pattern** (lines 203–232):
```typescript
<Dialog open={dialogState?.kind === 'edit'} onOpenChange={o => { if (!o) setDialogState(null); }}>
  <DialogContent className="max-w-lg sm:max-w-lg overflow-y-auto max-h-[90vh]" showCloseButton>
    <DialogHeader>
      <DialogTitle>Edit Combo</DialogTitle>
    </DialogHeader>
    {dialogState?.kind === 'edit' && (
      <div className="space-y-6">
        <ComboBuilderForm key={dialogState.comboId} comboId={dialogState.comboId} />
        <div className="border-t pt-4">
          {/* Secondary section — in ingredients: StockMovementsList */}
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
```

**ConfirmDialog delete pattern** (lines 234–250):
```typescript
{dialogState?.kind === 'delete' && (
  <ConfirmDialog
    open
    title={`Delete '${dialogState.combo.name}'?`}
    description="This will remove the combo and all its slots. Orders already placed are not affected."
    confirmLabel="Delete Combo"
    variant="destructive"
    isLoading={deleteMutation.isPending}
    onConfirm={() => { void handleDelete(dialogState.combo.id); }}
    onCancel={() => { setDialogState(null); }}
  />
)}
```

---

### `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` (component, request-response)

**Analog:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` (Dialog + mutation pattern)

**Imports pattern** — same set as ManageCombosTab but add RPC call imports:
```typescript
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { ok, err, type Result } from '@shared/lib/result';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
```

**RPC call pattern** (from RESEARCH.md verified pattern):
```typescript
async function recordAdjustment(input: { ingredientId: string; delta: number; reason: ManualAdjustReason }): Promise<Result<void>> {
  const { error } = await supabase.rpc('record_stock_movement', {
    p_ingredient_id: input.ingredientId,
    p_delta: input.delta.toString(),  // string to preserve numeric precision — see Pitfall 1
    p_reason: input.reason,
    p_ref_type: 'manual',
    p_ref_id: null,
  });
  if (error) {
    if (error.message.includes('INVENTORY_NEGATIVE')) {
      return err({ code: 'INVENTORY_NEGATIVE', message: 'Insufficient stock...' } as AppError);
    }
    return err({ code: 'SUPABASE_ERROR', message: error.message } as AppError);
  }
  return ok(undefined);
}
```

**Error toast without closing dialog** (copy from ManageCombosTab async handler pattern):
```typescript
} catch (e: unknown) {
  toast.error(e instanceof Error ? e.message : 'Failed to record adjustment');
  // Do NOT close dialog — let user correct reason
}
```

**Dialog size for compact form** (from UI-SPEC):
```typescript
<DialogContent className="max-w-sm sm:max-w-sm" showCloseButton>
```

---

### `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (component, file-I/O)

**Analog:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` (Dialog pattern), Sheet from shadcn

**Sheet import pattern** (match existing sheet usage in the project):
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@shared/ui/sheet';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IngredientCreateSchema } from '@entities/ingredient';
import { ingredientKeys } from '@entities/ingredient';
```

**3-state UX via `useState`** (no analog exists — new pattern; use discriminated union):
```typescript
type ImportState =
  | { step: 'select' }
  | { step: 'staged'; validRows: IngredientCreate[]; failedRows: Array<{rowNum: number; reason: string}> }
  | { step: 'importing' };
```

**Bulk insert pattern** (from RESEARCH.md):
```typescript
const { error } = await db.from('ingredients').insert(validRows.map(r => ({
  name: r.name,
  uom: r.uom,
  purchase_uom: r.purchaseUom ?? null,
  purchase_to_base_factor: r.purchaseToBaseFactor,
  cost_per_base_unit: r.costPerBaseUnit,
  reorder_point: r.reorderPoint ?? null,
  is_prep: r.isPrep,
  is_active: true,
  category: r.category ?? null,
})));
```

**Query invalidation after success** (match ManageCombosTab pattern):
```typescript
void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
toast.success(`${validRows.length} ingredients imported`);
onOpenChange(false);
```

**CSV parse helper** (from RESEARCH.md):
```typescript
function parseCsvText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(line => line.trim().length > 0)
    .map(line => line.split(',').map(cell => cell.trim()));
}
```

---

### `src/widgets/IngredientsTable/index.tsx` (component, CRUD)

**Analog:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` (list pattern) + DataTable usage

**DataTable import** (used across manage-categories, inventory page):
```typescript
import { DataTable } from '@shared/ui/DataTable';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
```

**`getRowClassName` for low stock** (from UI-SPEC — DataTable prop already exists):
```typescript
getRowClassName={(row) =>
  row.reorderPoint != null && row.reorderPoint > 0 && row.quantityOnHand <= row.reorderPoint
    ? 'bg-pos-danger/10'
    : ''
}
```

**Toolbar pattern** (match ManageCombosTab header):
```typescript
toolbar={
  <div className="flex items-center gap-2">
    <Button size="sm" onClick={onAddClick}>+ Add ingredient</Button>
    <Button size="sm" variant="outline" onClick={onImportClick}>Import CSV</Button>
  </div>
}
```

---

### `src/widgets/StockMovementsList/index.tsx` (component, CRUD read-only)

**Analog:** Read-only DataTable pattern from ManageCombosTab list.

**DataTable read-only pattern** — no `onRowClick`, no action column. From UI-SPEC:
```typescript
<DataTable
  columns={columns}
  data={movements ?? []}
  isLoading={isLoading}
  enableSorting={true}
  initialSorting={[{ id: 'created_at', desc: true }]}
  searchable={false}
  emptyState={<EmptyState icon={History} title="No movements recorded" description="..." />}
/>
```

**Delta color pattern** (from UI-SPEC):
```typescript
// In column cell renderer:
<span className={`font-mono text-sm ${delta > 0 ? 'text-pos-accent' : 'text-pos-danger'}`}>
  {delta > 0 ? '+' : ''}{delta} {uom}
</span>
```

---

### `src/widgets/SettingsTabsPanel/index.tsx` — modification

**Analog:** `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` (all 113 lines)

**Tab insertion point** (lines 76–80):
```typescript
        {
          key: 'combos',
          label: 'Combos',
          render: () => <ManageCombosTab />,
        }
      );  // ← Insert ingredients tab AFTER this entry, BEFORE the closing `}`
    }
```

**New entry to add** (after combos key, within `canManageProducts` block):
```typescript
        {
          key: 'ingredients',
          label: 'Ingredients',
          render: () => <ManageIngredientsTab />,
        }
```

**Import to add at top of file** (line 2, after ManageCombosTab import):
```typescript
import { ManageIngredientsTab } from '@features/manage-ingredients';
```

---

### `e2e/33-ingredients.spec.ts` (test, request-response)

**Analog:** `bar-pos/e2e/32-combos.spec.ts` (all 905 lines)

**File header pattern** (lines 1–20):
```typescript
/**
 * E2E spec: Phase 3 — Ingredient Foundation
 *
 * Tickets: S3a-07, S3a-08, S3a-09
 *
 * Covers:
 *  T1: Admin creates ingredient via Settings → Ingredients
 *  T2: Admin edits ingredient — reorder_point updated
 *  T3: Low stock indicator — bg-pos-danger/10 row class
 *  T4: Manual adjustment — waste recorded, ledger row appears
 *  T5: INVENTORY_NEGATIVE guard — error toast shown, dialog stays open
 *  T6: CSV import — N ingredients imported toast
 *  T7: Admin deletes ingredient — ConfirmDialog, row removed
 */

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';
```

**Service client helper pattern** (lines 25–30):
```typescript
function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

**`test.beforeEach` pattern** (lines 101–107):
```typescript
test.beforeEach(async ({ page }) => {
  requireIntegrationEnv();
  await resetTestState();
  await openCaja(570);
  await page.goto('/');
});
```

**`test.afterEach` logout** (lines 109–111):
```typescript
test.afterEach(async ({ page }) => {
  await logout(page).catch(() => undefined);
});
```

**Settings navigation pattern** (lines 118–124):
```typescript
await loginAs(page, 'admin');
await page.goto('/settings');
await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
await page.getByRole('tab', { name: 'Ingredients' }).click();
await expect(page.getByText(/ingredient/i).first()).toBeVisible({ timeout: 15_000 });
```

**Graceful skip on missing seed data** (lines 130–139):
```typescript
if (!cubetaVisible) {
  test.info().annotations.push({
    type: 'note',
    description: 'Seed data not present — test skipped with annotation.',
  });
  await logout(page);
  return;
}
```

**RPC error verification via service client** (lines 519–540 pattern — service client DB assertion):
```typescript
const admin = getServiceClient();
const { data: movement } = await admin
  .from('stock_movements')
  .select('id, reason, quantity_delta')
  .eq('ingredient_id', ingredientId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (movement) {
  expect((movement as { reason: string }).reason).toBe('waste');
}
```

---

## Shared Patterns

### Pre-regen Cast
**Source:** `bar-pos/src/entities/combo/model/queries.ts` lines 1–22
**Apply to:** All files that query `ingredients` or `stock_movements` tables (ingredient queries, manage-ingredients, adjust-stock-movement, import-csv)
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// Pre-regen cast — remove once supabase.types.ts is regenerated after ingredient migrations
const db = supabase as any;
```

### Result<T> Error Handling
**Source:** `bar-pos/src/entities/category/model/queries.ts` lines 1–13 (imports) + lines 162–175 (usage)
**Apply to:** `entities/ingredient/model/queries.ts`, `features/adjust-stock-movement/`
```typescript
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
```

### Logger Import
**Source:** `bar-pos/src/entities/combo/model/queries.ts` line 16
**Apply to:** All entity queries and feature mutations
```typescript
import { logger } from '@shared/lib/logger-instance';
```

### Toast Feedback
**Source:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` lines 15, 105, 113
**Apply to:** All feature UI components (manage-ingredients, adjust-stock-movement, import-csv)
```typescript
import { toast } from 'sonner';
// Success:
toast.success('Ingredient added');
// Error:
toast.error(e instanceof Error ? e.message : 'Failed to save ingredient');
```

### ConfirmDialog Delete
**Source:** `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` lines 234–250
**Apply to:** `features/manage-ingredients` delete action
```typescript
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
// Usage:
<ConfirmDialog
  open
  title={`Delete "${ingredient.name}"?`}
  description="This will permanently remove the ingredient and all its stock movement history. This cannot be undone."
  confirmLabel="Delete ingredient"
  variant="destructive"
  isLoading={deleteMutation.isPending}
  onConfirm={() => { void handleDelete(ingredient.id); }}
  onCancel={() => { setDialogState(null); }}
/>
```

### FSD Barrel Export
**Source:** `bar-pos/src/entities/combo/index.ts` lines 1–29
**Apply to:** `entities/ingredient/index.ts`, `features/manage-ingredients/index.ts`, `features/import-ingredients-csv/index.ts`, `features/adjust-stock-movement/index.ts`, `widgets/IngredientsTable/index.tsx`, `widgets/StockMovementsList/index.tsx`

Every feature/widget must have an `index.ts` that re-exports only the public API. Deep imports into `ui/` or `model/` from outside the slice are a lint error.

### RBAC Gate Pattern
**Source:** `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` lines 22–26
**Apply to:** `SettingsTabsPanel` tab insertion, any RBAC-gated UI in this phase
```typescript
const { can } = usePermissions();
const canManageProducts = can('manage_products');
// Gate:
if (canManageProducts) { out.push({ key: 'ingredients', ... }); }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` (Sheet + FileReader) | component | file-I/O | No existing file-upload feature in the codebase; Sheet component is used but not for multi-step file import. Use shadcn Sheet pattern + manual FileReader. |

---

## Metadata

**Analog search scope:** `bar-pos/src/entities/`, `bar-pos/src/features/`, `bar-pos/src/widgets/`, `bar-pos/src/shared/lib/`, `bar-pos/supabase/migrations/`, `bar-pos/e2e/`
**Files scanned:** 22 source files + 51 migration files
**Pattern extraction date:** 2026-04-23
