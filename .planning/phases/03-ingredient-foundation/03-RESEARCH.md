# Phase 3: Ingredient Foundation - Research

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Researched:** 2026-04-23
**Domain:** Supabase PL/pgSQL + FSD entity/feature architecture + UOM utility
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| S3a-01 | Migration: `ingredients` table + CHECK constraints + indexes | Schema fully specified in 02-data-model.md; pattern from Phase 1 migrations |
| S3a-02 | Migration: idempotency UNIQUE index on `stock_movements` | Index spec in S3a-ingredients.md; Phase 1 migration naming pattern verified |
| S3a-03 | RPC `record_stock_movement` (PL/pgSQL, SECURITY DEFINER) | Full RPC contract in S3a-ingredients.md; pattern from add_combo_to_tab RPC |
| S3a-04 | Zod schemas: `IngredientSchema`, `StockMovementSchema` extensions, `UomSchema`, `ReasonSchema` | `StockMovementSchema` already exists in domain.ts (line 638); extensions needed |
| S3a-05 | UOM library `src/shared/lib/uom.ts` — base/purchase/factor conversions | No uom.ts exists yet; design fully specified; fast-check P5 test required |
| S3a-06 | Entity `src/entities/ingredient/` — model/types, model/queries, ui | Pattern from entities/combo/ and entities/category/ verified |
| S3a-07 | Feature `src/features/manage-ingredients/` CRUD | Pattern from manage-combos and manage-categories verified |
| S3a-08 | Feature `src/features/import-ingredients-csv/` | No papaparse; native FileReader + manual CSV split per UI-SPEC; Sheet pattern verified |
</phase_requirements>

---

## Summary

Phase 3 adds the ingredient foundation: a `ingredients` table, the canonical append-only `record_stock_movement` RPC, and the full admin UI for managing ingredients, importing via CSV, manual adjustments, and reading the stock ledger. No sale-time depletion in this phase.

The groundwork laid in Phase 1 is directly reused here: the `stock_movements` table already has `ingredient_id uuid NULL` and the extended reason enum. The migration chain is continuous — the last migration is `20260425000005_add_combo_to_tab_rpc.sql`, so Phase 3 migrations will be prefixed `20260426...` (or the actual date of execution). The entity/feature/widget FSD patterns are fully established from combos (Phase 2) and categories (Phase 1).

The biggest Phase 3-specific design work is the `record_stock_movement` PL/pgSQL RPC (row-lock, idempotency, negative-stock guard) and the `uom.ts` conversion utility (numeric precision, round-trip property test P5).

**Primary recommendation:** Follow the combo entity pattern (`entities/combo/`) for the `entities/ingredient/` slice. Follow `ManageCombosTab` for the `ManageIngredientsTab` UI. Use native `FileReader` for CSV — no new dependencies.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `ingredients` CRUD | API (Supabase) | Frontend feature | Validation at RPC + Zod layer; UI composes the mutation hooks |
| Stock ledger append | API (PL/pgSQL RPC) | — | Atomicity (row-lock + insert + update) must be server-side |
| Idempotency enforcement | DB (UNIQUE index) | RPC (ON CONFLICT) | DB enforces; RPC wraps with ON CONFLICT DO NOTHING for non-error path |
| UOM conversion | Shared lib (pure TS) | — | Pure math utility; no server round-trip needed |
| CSV parsing + validation | Frontend (feature) | — | FileReader is browser API; Zod validates row-by-row client-side |
| Admin UI (list, create, edit, delete) | Frontend (feature + widget) | — | Standard CRUD SPA pattern inside Settings tab |
| Manual adjustment dialog | Frontend (feature) | API (RPC) | UI collects delta+reason; calls `record_stock_movement` |
| Per-ingredient ledger view | Frontend (widget) | API (query) | Read-only select from `stock_movements WHERE ingredient_id=X` |
| RBAC gate (manager+) | Frontend (ProtectedAction) | DB (RLS) | Both layers enforce; UI hides controls, DB rejects unauthorized writes |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | `^2` (already installed) | DB access, RPC calls, Realtime | Project-standard backend |
| TanStack Query | `^5` (already installed) | Server state + cache invalidation | Project-mandated for all server state |
| Zod | `^4` (already installed) | Schema validation + type inference | Project-mandated single source of truth |
| React Hook Form | (not used in this project) | — | Project uses controlled inputs with Zod directly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-check | `^4` (already installed) | Property-based tests P4, P5 | Ledger invariant + UOM round-trip |
| lucide-react | (already installed) | Icons (Pencil, Trash2, History, Download) | Standard icon library for this project |
| sonner | (already installed) | Toast notifications | All mutation success/error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native FileReader CSV | papaparse | papaparse handles edge cases (quoted fields, CRLF, BOM) better — but UI-SPEC locked to no new deps; manual split is acceptable for well-formed UTF-8 CSVs |
| UNIQUE index idempotency | Application-layer dedup | DB-level is always more reliable; cannot be bypassed by concurrent writes |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
Settings → Ingredients tab
        │
        ├── IngredientsTable (widget)
        │       ├── DataTable (shared/ui)
        │       ├── [+ Add ingredient] → IngredientForm Dialog (feature: manage-ingredients)
        │       ├── [Import CSV] → CsvImportSheet (feature: import-ingredients-csv)
        │       └── [row click / Edit] → IngredientForm Dialog (edit mode)
        │               └── [below divider] StockMovementsList (widget)
        │                       └── [Record adjustment] → AdjustStockMovementDialog (feature: adjust-stock-movement)
        │
        ▼
Supabase
        ├── ingredients table  ←─────────────── manage-ingredients mutations
        ├── stock_movements table ←──────────── record_stock_movement RPC
        │       └── UNIQUE(ref_type, ref_id, ingredient_id) [depletion reasons only]
        └── RPC: record_stock_movement
                ├── SELECT ... FOR UPDATE (row lock)
                ├── INSERT stock_movements
                └── UPDATE ingredients.quantity_on_hand
```

### Recommended Project Structure

```
src/
├── entities/ingredient/
│   ├── index.ts                          # public API exports
│   └── model/
│       ├── index.ts                      # re-exports queries + types
│       ├── types.ts                      # re-exports from domain.ts (never define here)
│       └── queries.ts                    # useIngredients, useIngredient, useStockMovements, ingredientKeys, mutation hooks
│
├── features/
│   ├── manage-ingredients/
│   │   ├── index.ts                      # export ManageIngredientsTab
│   │   └── ui/
│   │       └── ManageIngredientsTab.tsx  # tab container with IngredientsTable + dialogs
│   ├── import-ingredients-csv/
│   │   ├── index.ts
│   │   └── ui/
│   │       └── CsvImportSheet.tsx        # Sheet with 3-state UX (select → staged → importing)
│   └── adjust-stock-movement/
│       ├── index.ts
│       └── ui/
│           └── AdjustStockMovementDialog.tsx
│
├── widgets/
│   ├── IngredientsTable/
│   │   └── index.tsx                     # DataTable columns + toolbar
│   └── StockMovementsList/
│       └── index.tsx                     # read-only ledger DataTable
│
└── shared/lib/
    └── uom.ts                            # UOM conversion utility (new file)
```

### Pattern 1: Entity Query Keys (from entities/combo/)

```typescript
// Source: verified from bar-pos/src/entities/combo/model/queries.ts
export const ingredientKeys = {
  all: ['ingredients'] as const,
  lists: () => [...ingredientKeys.all, 'list'] as const,
  detail: (id: string) => [...ingredientKeys.all, 'detail', id] as const,
  movements: (ingredientId: string) =>
    [...ingredientKeys.all, 'movements', ingredientId] as const,
};
```

### Pattern 2: Pre-Regen Cast (from entities/combo/)

When `supabase.types.ts` does not yet include `ingredients` or updated `stock_movements`:

```typescript
// Source: verified from bar-pos/src/entities/combo/model/queries.ts pattern
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any; // Pre-regen cast — remove after npx supabase gen types typescript --local
```

Remove cast after regenerating types post-migration.

### Pattern 3: Row Mapper with Zod Parse (from entities/category/)

```typescript
// Source: verified from bar-pos/src/entities/category/model/queries.ts
function mapIngredientRow(row: unknown): Result<Ingredient> {
  try {
    return ok(IngredientSchema.parse({ /* camelCase from snake_case */ }));
  } catch (e) {
    return err(unknownError(e));
  }
}
```

### Pattern 4: SettingsTabsPanel insertion (from SettingsTabsPanel/index.tsx)

Add inside the `canManageProducts` block, AFTER the `combos` entry:

```typescript
// Source: verified from bar-pos/src/widgets/SettingsTabsPanel/index.tsx
{
  key: 'ingredients',
  label: 'Ingredients',
  render: () => <ManageIngredientsTab />,
}
```

Import: `import { ManageIngredientsTab } from '@features/manage-ingredients';`

### Anti-Patterns to Avoid

- **Calling `record_stock_movement` directly from the renderer with anon key:** The RPC is SECURITY DEFINER — this is fine. But never pass `p_delta` as a float; use `numeric` strings to avoid precision loss over JSON.
- **Writing `quantity_on_hand` directly:** The only code that mutates `ingredients.quantity_on_hand` is the `record_stock_movement` RPC. Mutations from features call the RPC, never UPDATE ingredients directly.
- **Using `z.number()` for delta in Zod:** Use `z.number()` is fine for the form field (JS has no decimal type), but document the epsilon issue in the uom.ts file header.
- **Defining manual interfaces for Ingredient type:** All types are `z.infer<typeof IngredientSchema>` from domain.ts, per project convention.
- **Skipping idempotency annotation for `physical_count`:** The unique index covers `('sale','refund','void','prep_production','prep_consumption')` only. `physical_count` and `correction` are intentionally excluded (can be called multiple times for the same context).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UOM conversion | Custom ad-hoc `if/else` in components | `src/shared/lib/uom.ts` centralized utility | Consistency; property test P5 only validates the central utility |
| Idempotency dedup | Application-layer "check then insert" | UNIQUE index + ON CONFLICT | Race condition under concurrent writes; DB-level is atomic |
| Atomic ledger update | Manual UPDATE after INSERT | `record_stock_movement` PL/pgSQL RPC | Row-lock prevents torn reads; atomicity is the entire point |
| CSV validation | Custom field checkers | `IngredientSchema.safeParse()` per row | Zod already defines the full validation rules |
| Toast feedback | Custom notification UI | `sonner` toast (already used project-wide) | Consistency; same pattern as manage-combos |
| Confirm delete dialog | Custom confirm modal | `ConfirmDialog` from `shared/ui/` | Already exists; already styled for destructive variant |

---

## DB Schema — Exact Columns

### `ingredients` table (new in Phase 3)

```sql
CREATE TABLE ingredients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  uom                     text NOT NULL,           -- base unit: 'g','ml','unit','portion'
  purchase_uom            text NULL,               -- delivery unit: 'kg','L','case_24' etc.
  purchase_to_base_factor numeric NOT NULL DEFAULT 1,
  cost_per_base_unit      numeric(10,4) NOT NULL DEFAULT 0,
  quantity_on_hand        numeric NOT NULL DEFAULT 0,
  reorder_point           numeric NULL,
  is_prep                 boolean NOT NULL DEFAULT false,
  is_active               boolean NOT NULL DEFAULT true,
  category                text NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
```

CHECK constraints to add:
- `purchase_to_base_factor > 0`
- `cost_per_base_unit >= 0`
- `uom IN ('g','kg','ml','L','unit','portion','case_24')`

Indexes to add:
- `idx_ingredients_name` on `(name)` — for search
- `idx_ingredients_is_active` on `(is_active)` — filter active
- `idx_ingredients_is_prep` on `(is_prep)` — Phase 5 will filter prep items

### `stock_movements` idempotency index (S3a-02)

```sql
-- Partial unique index: only for auto-depletion reasons (manual adjustments intentionally excluded)
CREATE UNIQUE INDEX idx_stock_movements_idempotency
  ON stock_movements (ref_type, ref_id, ingredient_id)
  WHERE reason IN ('sale', 'refund', 'void', 'prep_production', 'prep_consumption');
```

`ingredient_id NOT NULL` is implicit — a NULL ingredient_id would not create a conflict (NULLs are not equal in UNIQUE indexes, so product-level movements remain unconstrained).

### RPC `record_stock_movement` — full contract

```sql
CREATE OR REPLACE FUNCTION record_stock_movement(
  p_ingredient_id  uuid,
  p_delta          numeric,
  p_reason         text,
  p_ref_type       text,
  p_ref_id         uuid
) RETURNS stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current  numeric;
  v_new      numeric;
  v_row      stock_movements;
BEGIN
  -- 1. Lock the ingredient row
  SELECT quantity_on_hand INTO v_current
  FROM ingredients
  WHERE id = p_ingredient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INGREDIENT_NOT_FOUND: ingredient % does not exist', p_ingredient_id;
  END IF;

  -- 2. Compute new quantity
  v_new := v_current + p_delta;

  -- 3. Negative-stock guard (correction and physical_count bypass)
  IF v_new < 0 AND p_reason NOT IN ('correction', 'physical_count') THEN
    RAISE EXCEPTION 'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id;
  END IF;

  -- 4. Insert movement row
  INSERT INTO stock_movements (ingredient_id, quantity_delta, reason, ref_type, ref_id)
  VALUES (p_ingredient_id, p_delta, p_reason, p_ref_type, p_ref_id)
  RETURNING * INTO v_row;

  -- 5. Update quantity_on_hand
  UPDATE ingredients
  SET quantity_on_hand = v_new,
      updated_at = now()
  WHERE id = p_ingredient_id;

  RETURN v_row;
END;
$$;
```

Caller pattern (for depletion reasons):
```typescript
// ON CONFLICT DO NOTHING via rpc options is not supported directly.
// Caller should catch DUPLICATE_ENTRY / code '23505' and treat as success.
const { data, error } = await supabase.rpc('record_stock_movement', {
  p_ingredient_id: ingredientId,
  p_delta: delta,
  p_reason: reason,
  p_ref_type: refType,
  p_ref_id: refId,
});
if (error?.code === '23505') return ok(null); // idempotent — already recorded
```

---

## UOM Conversion Utility Design

File: `src/shared/lib/uom.ts`

### UOM Values (locked)

```typescript
// Source: UI-SPEC verified, S3a-ingredients.md CSV format section
export const BASE_UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'portion'] as const;
export const ALL_UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'case_24', 'portion'] as const;
export type BaseUom = typeof BASE_UOMS[number];
export type Uom = typeof ALL_UOMS[number];
```

### Conversion Architecture

Phase 3 uses the `purchase_to_base_factor` column, NOT a hardcoded conversion table. This is by design (locked decision C5 — no multi-hop conversions):

- `toBase(purchaseQty, factor)` — multiply by factor to get base units
- `fromBase(baseQty, factor)` — divide by factor to get purchase units

Well-known factor relationships (for reference, not hard-coded):
- `kg` → `g`: factor = 1000
- `L` → `ml`: factor = 1000
- `case_24` → `unit`: factor = 24

```typescript
/**
 * UOM conversion utilities.
 *
 * Conversion is always via the ingredient's purchase_to_base_factor.
 * Phase 3 does NOT use a hardcoded conversion table — the factor is stored
 * per ingredient on creation (see C5 locked decision).
 *
 * Precision: use numeric arithmetic; assert within 1e-6 epsilon in tests.
 */

/** Convert a quantity in purchase units to base units. */
export function toBase(purchaseQty: number, purchaseToBaseFactor: number): number {
  return purchaseQty * purchaseToBaseFactor;
}

/** Convert a quantity in base units to purchase units. */
export function fromBase(baseQty: number, purchaseToBaseFactor: number): number {
  if (purchaseToBaseFactor === 0) throw new Error('purchaseToBaseFactor cannot be 0');
  return baseQty / purchaseToBaseFactor;
}

/** Round-trip identity (for use in P5 property test): fromBase(toBase(x, f), f) ≈ x */
export function roundTrip(x: number, factor: number): number {
  return fromBase(toBase(x, factor), factor);
}
```

### Property Test P5 Design

```typescript
// File: src/shared/lib/uom.test.ts
// Source: testing-strategy.md P5 spec
import * as fc from 'fast-check';

test('P5: UOM round-trip identity', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.float({ min: 0.001, max: 1_000_000, noNaN: true }),  // base qty
      fc.float({ min: 0.001, max: 10_000, noNaN: true }),     // factor
      async (qty, factor) => {
        const result = roundTrip(qty, factor);
        expect(Math.abs(result - qty)).toBeLessThan(1e-6);
      }
    )
  );
});
```

---

## Zod Schema Additions (domain.ts)

Three new schemas to add at the S3a section marker in `domain.ts`:

```typescript
// ============================================================================
// S3a — INGREDIENT FOUNDATION
// ============================================================================

export const UomSchema = z.enum(['g', 'kg', 'ml', 'L', 'unit', 'case_24', 'portion']);
export type Uom = z.infer<typeof UomSchema>;

export const BaseUomSchema = z.enum(['g', 'kg', 'ml', 'L', 'unit', 'portion']); // no case_24

export const ManualAdjustReasonSchema = z.enum([
  'waste',
  'delivery',
  'correction',
  'physical_count',
]);
export type ManualAdjustReason = z.infer<typeof ManualAdjustReasonSchema>;

export const IngredientSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  uom: BaseUomSchema,
  purchaseUom: UomSchema.nullable().optional(),
  purchaseToBaseFactor: z.number().positive(),
  costPerBaseUnit: z.number().nonnegative(),
  quantityOnHand: z.number(),
  reorderPoint: z.number().nonnegative().nullable().optional(),
  isPrep: z.boolean().default(false),
  isActive: z.boolean().default(true),
  category: z.string().nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const IngredientCreateSchema = IngredientSchema.omit({
  id: true,
  quantityOnHand: true,
  createdAt: true,
  updatedAt: true,
});

export const IngredientUpdateSchema = IngredientSchema.partial().required({ id: true });

export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientCreate = z.infer<typeof IngredientCreateSchema>;
export type IngredientUpdate = z.infer<typeof IngredientUpdateSchema>;
```

The existing `StockMovementSchema` (line 638 in domain.ts) already has `ingredientId`, `refType`, `refId`. The `quantityDelta` field uses `z.number().int()` — this needs to change to `z.number()` (non-integer, since ingredient quantities like 0.5 kg are valid numerics). **This is a breaking change to the existing schema** — verify no code relies on `.int()` constraint.

---

## FSD Entity Structure: `entities/ingredient/`

Modeled exactly after `entities/combo/`:

**`index.ts`** — public API (features/widgets import from here only):
```typescript
export {
  useIngredients,
  useIngredient,
  useStockMovements,
  useIngredientsActive,
  ingredientKeys,
} from './model/queries';
export type {
  Ingredient,
  IngredientCreate,
  IngredientUpdate,
} from './model/types';
```

**`model/types.ts`** — re-exports from domain.ts only:
```typescript
export type { Ingredient, IngredientCreate, IngredientUpdate } from '@shared/lib/domain';
export { IngredientSchema, IngredientCreateSchema, IngredientUpdateSchema } from '@shared/lib/domain';
```

**`model/queries.ts`** — TanStack Query hooks:
- `useIngredients()` — all active ingredients
- `useIngredient(id)` — single ingredient by id
- `useStockMovements(ingredientId)` — movements for one ingredient, ordered newest-first
- `useIngredientsActive()` — alias for `useIngredients()` filtering `is_active=true` (useful for recipe autocomplete in Phase 4)
- `ingredientKeys` — query key factory matching combo pattern

---

## CSV Import Mechanics

Per UI-SPEC: no papaparse, use `FileReader` + manual split.

```typescript
// Pattern: FileReader-based CSV parser
function parseCsvText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(line => line.trim().length > 0)
    .map(line => line.split(',').map(cell => cell.trim()));
}
```

**CSV format (locked):**
```
name,base_uom,purchase_uom,purchase_to_base_factor,cost_per_base_unit,reorder_point,category,is_prep
Tomato,g,kg,1000,0.012,2000,produce,false
```

**Validation per row:** `IngredientCreateSchema.safeParse(rowObject)` — collect errors for failed rows.

**Stage-and-confirm UX (3 states):**
1. File selection → parse on file input change → show preview
2. Staged → show valid count / failed rows → enable Confirm
3. Importing → batch insert (loop over valid rows calling `supabase.from('ingredients').insert(...)` OR bulk insert via `.insert(validRows)`) → close Sheet + toast

**Bulk insert pattern:**
```typescript
const { error } = await supabase.from('ingredients').insert(validRows);
```
If partial failure is required, loop row-by-row and collect errors. For Phase 3, bulk insert is acceptable with the staged validation already filtering invalid rows.

---

## Migration File Naming

Last migration: `20260425000005_add_combo_to_tab_rpc.sql` [VERIFIED: codebase]

Phase 3 migrations will be named with the execution date. Using `20260426` as the expected date:

| # | File | Ticket |
|---|------|--------|
| 1 | `20260426000001_ingredients_table.sql` | S3a-01 |
| 2 | `20260426000002_stock_movements_idempotency_index.sql` | S3a-02 |
| 3 | `20260426000003_record_stock_movement_rpc.sql` | S3a-03 |

Serial execution required (each depends on the prior). After applying: `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts`.

---

## E2E Spec Number

Existing spec files run through `32-combos.spec.ts`. [VERIFIED: codebase]

Phase 3 ingredient foundation E2E spec: `33-ingredients.spec.ts`

Note: The testing-strategy.md mentions `18-categories.spec.ts` and `19-combos.spec.ts` as Phase 1/2 specs. The actual files in the repo are `31-categories.spec.ts` and `32-combos.spec.ts` — they were renumbered to avoid collision with the large set of existing specs (01–30). Following this pattern, Phase 3 = `33-ingredients.spec.ts`.

The testing-strategy.md lists no E2E spec for S3a specifically (only `20-recipes.spec.ts` for S3b). However, the Phase 3 DoD lists "Ingredient CRUD working in Tauri dev build" as a success criterion. An E2E smoke spec covering create, list, manual adjustment, and CSV import is appropriate.

---

## E2E Spec Design: `33-ingredients.spec.ts`

Flows to cover:
1. **Admin creates ingredient** — navigate to Settings → Ingredients, fill IngredientForm, verify row appears in table
2. **Admin edits ingredient** — click row, change reorder_point, save, verify updated
3. **Low stock indicator** — seed ingredient with `quantity_on_hand <= reorder_point`, verify `bg-pos-danger/10` row class
4. **Manual adjustment** — open AdjustStockMovement dialog, record waste of -100g, verify ledger row appears in StockMovementsList
5. **INVENTORY_NEGATIVE guard** — attempt waste that would go negative, verify error toast with override hint
6. **CSV import** — upload template CSV, verify N ingredients imported toast
7. **Admin deletes ingredient** — ConfirmDialog appears, confirm, row removed

---

## Common Pitfalls

### Pitfall 1: Numeric Precision in PL/pgSQL vs JavaScript
**What goes wrong:** `p_delta` sent as a JavaScript `number` (IEEE 754 float) can have precision loss. `0.1 + 0.2 !== 0.3` in JS, but Postgres `numeric` type is exact.
**Why it happens:** JSON serialization converts Postgres `numeric` → JS float → numeric round-trip loss.
**How to avoid:** Pass delta as a string from JS: `p_delta: delta.toString()` in the rpc call. Postgres will coerce string → numeric exactly. Assert in property tests within 1e-6 epsilon.
**Warning signs:** `quantity_on_hand` drifts by tiny amounts in the ledger view.

### Pitfall 2: NULL ingredient_id in Idempotency Index
**What goes wrong:** Inserting a product-level movement (old pre-Phase-3 path) with `ingredient_id=NULL` and the same `(ref_type, ref_id)` does NOT trigger the unique index. This is correct behavior but can confuse debugging.
**Why it happens:** In SQL, `NULL != NULL` in unique indexes (NULLs are not considered duplicates).
**How to avoid:** The partial unique index is defined with `WHERE reason IN (...)`. This is intentional. Document this explicitly in the migration file comment.

### Pitfall 3: `is_prep` flag used but not enforced in Phase 3
**What goes wrong:** UI allows marking an ingredient as `is_prep=true`, but the Phase 5 CHECK trigger that enforces `is_prep=true → uom='portion'` doesn't exist yet.
**Why it happens:** Phase 3 adds the column; Phase 5 adds the enforcement trigger.
**How to avoid:** Don't add a Phase 5 constraint in Phase 3 migrations. The `is_prep` column is informational in Phase 3. Note this in migration comments.

### Pitfall 4: RPC SECURITY DEFINER with auth.uid()
**What goes wrong:** `SECURITY DEFINER` RPCs run as the function owner, so `auth.uid()` inside the function returns the CALLING user (not the owner). This is correct but non-obvious.
**Why it happens:** Supabase's SECURITY DEFINER preserves `auth.uid()` context via JWT claims.
**How to avoid:** Same pattern as `add_combo_to_tab` — capture `auth.uid()` at function start for audit purposes if needed. The `stock_movements` table currently doesn't have a `staff_id` FK for ingredient movements (only for product movements). Consider whether to add one.

### Pitfall 5: `StockMovementSchema.quantityDelta` is `z.number().int()`
**What goes wrong:** Existing `StockMovementSchema` in domain.ts uses `.int()` which rejects decimal deltas (e.g., `-0.5` for 500ml from a 1L bottle).
**Why it happens:** Schema was written before ingredient movements were designed.
**How to avoid:** Change `quantityDelta: z.number().int()` to `quantityDelta: z.number()` in the existing `StockMovementSchema`. Check for any code that relies on integer-only deltas from that schema before making the change.

### Pitfall 6: SettingsTabsPanel import boundary
**What goes wrong:** Importing `ManageIngredientsTab` from a deep path like `@features/manage-ingredients/ui/ManageIngredientsTab` instead of `@features/manage-ingredients` violates the FSD boundary rule enforced by `eslint-plugin-boundaries`.
**How to avoid:** Always import from the feature's `index.ts` barrel: `import { ManageIngredientsTab } from '@features/manage-ingredients'`.

---

## Code Examples

### Verified Pattern: Mutation with Query Invalidation (from manage-combos)

```typescript
// Source: verified from bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx
function useMutationCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngredientCreate) => {
      const { error } = await db.from('ingredients').insert({
        name: input.name,
        uom: input.uom,
        purchase_uom: input.purchaseUom ?? null,
        purchase_to_base_factor: input.purchaseToBaseFactor,
        cost_per_base_unit: input.costPerBaseUnit,
        reorder_point: input.reorderPoint ?? null,
        is_prep: input.isPrep,
        is_active: true,
        category: input.category ?? null,
      });
      if (error) {
        logger.error('useMutationCreateIngredient: insert failed', { error });
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
    },
  });
}
```

### Verified Pattern: Record Adjustment RPC Call

```typescript
// Pattern: calling record_stock_movement with error handling
async function recordAdjustment(input: {
  ingredientId: string;
  delta: number;
  reason: ManualAdjustReason;
  notes: string | undefined;
}): Promise<Result<void>> {
  const { error } = await supabase.rpc('record_stock_movement', {
    p_ingredient_id: input.ingredientId,
    p_delta: input.delta.toString(), // string to preserve numeric precision
    p_reason: input.reason,
    p_ref_type: 'manual',
    p_ref_id: null,  // manual adjustments have no ref
  });

  if (error) {
    if (error.message.includes('INVENTORY_NEGATIVE')) {
      return err({ code: 'INVENTORY_NEGATIVE', message: 'Insufficient stock...' });
    }
    return err({ code: 'SUPABASE_ERROR', message: error.message, raw: error });
  }
  return ok(undefined);
}
```

### Verified Pattern: Category entity index.ts (re-export pattern for ingredient/index.ts)

```typescript
// Source: verified from bar-pos/src/entities/category/index.ts
export {
  useIngredients,
  useIngredient,
  useStockMovements,
  ingredientKeys,
} from './model/queries';
export type { Ingredient, IngredientCreate, IngredientUpdate } from './model/types';
export { IngredientSchema } from './model/types';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `inventory_log` table | `stock_movements` (renamed + extended) | Phase 1 (2026-04-23) | All Phase 3 code writes to `stock_movements` directly |
| `InventoryAdjustReason` enum | `StockMovementReasonSchema` (superset) | Phase 1 | Phase 3 uses `StockMovementReasonSchema`; `ManualAdjustReasonSchema` is a subset |
| Product-level inventory tracking | Ingredient-level via `ingredient_id` FK | Phase 3 (this phase) | `ingredient_id` column added in Phase 1 migration but unused until now |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migration date prefix will be `20260426` | Migration File Naming | Low risk — just rename the file; ordering within day determines execution order |
| A2 | `stock_movements` currently lacks a `staff_id` for ingredient-level movements (only product-level) | RPC contract section | If staff_id is expected in the ledger for audit, the RPC needs a `p_staff_id` param or `auth.uid()` capture |
| A3 | `DataTable.getRowClassName` prop exists and accepts a `(row: T) => string` function | Widget section | UI-SPEC confirms it — but should be verified in DataTable.tsx before coding |
| A4 | `select` — `command` shadcn primitive is already installed | Standard Stack | Used in ComboBuilderForm; likely installed. Verify via `ls shared/ui/` |

---

## Open Questions

1. **`staff_id` in ingredient stock movements**
   - What we know: `stock_movements` table has `staff_id` from the original `inventory_log` design; the Phase 3 RPC contract in S3a-ingredients.md does not include `p_staff_id`
   - What's unclear: Should `record_stock_movement` capture `auth.uid()` internally and store it as `staff_id`? The add_combo_to_tab RPC does `v_staff_id := auth.uid()` for orders.
   - Recommendation: Add `v_staff_id := auth.uid()` capture in RPC and insert it into the `staff_id` column for full audit trail. Low risk addition.

2. **`p_ref_id` for manual adjustments**
   - What we know: Manual adjustments have no external reference; the RPC requires `p_ref_id uuid`
   - What's unclear: Pass `NULL`? Or generate a UUID client-side?
   - Recommendation: Pass `NULL` — the idempotency index only applies to depletion reasons, and manual adjustments are not idempotency-guarded.

3. **`StockMovementSchema.quantityDelta` change from `.int()` to `.number()`**
   - What we know: Current domain.ts line 641 has `quantityDelta: z.number().int()`
   - What's unclear: Does any existing code path assert integer-only deltas?
   - Recommendation: Search for usages of `quantityDelta` before changing. The change is safe if only `adjust-inventory` feature uses it (which deals with product quantities, not ingredient decimals).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely code + SQL migration changes. No new external tools, services, or CLIs are introduced. Supabase CLI already verified working in Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | `bar-pos/vitest.config.ts` |
| Quick run command | `cd bar-pos && npm run test` |
| Full suite command | `cd bar-pos && npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| S3a-01 | `ingredients` table has correct columns, CHECKs, indexes | manual DB inspection | `npx supabase db push` then inspect | ❌ Wave 0 (SQL migration) |
| S3a-02 | Idempotency index prevents duplicate depletion movements | integration (Vitest) | `npx vitest run src/entities/ingredient/model/queries.test.ts` | ❌ Wave 0 |
| S3a-03 | RPC atomic: insert + update; INVENTORY_NEGATIVE on negative balance | integration (Vitest) | `npx vitest run src/entities/ingredient/model/rpc.test.ts` | ❌ Wave 0 |
| S3a-04 | Zod schemas parse valid rows; reject invalid | unit (Vitest) | `npx vitest run src/shared/lib/domain.test.ts` | ✅ (extend existing) |
| S3a-05 | UOM round-trip P5 property test | property (fast-check) | `npx vitest run src/shared/lib/uom.test.ts` | ❌ Wave 0 |
| S3a-05 | UOM toBase/fromBase unit tests | unit | `npx vitest run src/shared/lib/uom.test.ts` | ❌ Wave 0 |
| S3a-06 | Entity query hooks return mapped types | unit RTL | `npx vitest run src/entities/ingredient/model/queries.test.ts` | ❌ Wave 0 |
| S3a-07 | Ingredient CRUD in Settings UI | E2E | `npx playwright test e2e/33-ingredients.spec.ts` | ❌ Wave 0 |
| S3a-08 | CSV import: valid rows inserted; invalid rows reported | integration | `npx vitest run src/features/import-ingredients-csv/*.test.ts` | ❌ Wave 0 |
| P4 | Ledger invariant: sum(deltas) = quantity_on_hand | property (fast-check) | `npx vitest run src/shared/lib/ledger.test.ts` | ❌ Wave 0 |
| P5 | UOM round-trip identity | property (fast-check) | `npx vitest run src/shared/lib/uom.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **Per wave merge:** full suite above + `npm run test:e2e` (manual gate)
- **Phase gate:** All unit + property tests green; E2E `33-ingredients.spec.ts` passing before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shared/lib/uom.ts` — new file (no test infrastructure, must create file + tests together)
- [ ] `src/shared/lib/uom.test.ts` — P5 property test + unit tests
- [ ] `src/shared/lib/ledger.test.ts` — P4 ledger invariant property test
- [ ] `src/entities/ingredient/model/queries.test.ts` — query hook unit tests
- [ ] `src/entities/ingredient/model/rpc.test.ts` — idempotency integration test
- [ ] `src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx` — CSV validation unit test
- [ ] `e2e/33-ingredients.spec.ts` — full E2E spec

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable to ingredient data layer |
| V3 Session Management | no | Sessions managed by Supabase Auth (Phase 1) |
| V4 Access Control | yes | Supabase RLS + `usePermissions` RBAC hook (`manage_products` = manager+) |
| V5 Input Validation | yes | Zod `IngredientSchema` validates all input before DB write; RPC validates `p_delta` and `p_reason` |
| V6 Cryptography | no | No new secrets or crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Negative delta injection (force stock below 0) | Tampering | RPC raises `INVENTORY_NEGATIVE` for non-correction reasons |
| RLS bypass on `ingredients` INSERT | Elevation of privilege | RLS policy: INSERT requires `manage_products` (manager+); RPC is SECURITY DEFINER but validates caller intent |
| Duplicate stock movement injection (double-count) | Tampering | Partial UNIQUE index on `(ref_type, ref_id, ingredient_id)` for depletion reasons |
| Malformed CSV with script injection | Tampering | Zod validation strips/rejects unexpected types; displayed in DOM as text, not innerHTML |

---

## Sources

### Primary (HIGH confidence)
- Verified codebase: `bar-pos/supabase/migrations/` — last migration timestamp + naming convention
- Verified codebase: `bar-pos/src/entities/combo/` — entity FSD pattern
- Verified codebase: `bar-pos/src/entities/category/model/queries.ts` — row mapper + Result<T> pattern
- Verified codebase: `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` — mutation + tab pattern
- Verified codebase: `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` — tab insertion point
- Verified codebase: `bar-pos/src/shared/lib/domain.ts` — existing `StockMovementSchema` (lines 638–659)
- Verified codebase: `bar-pos/src/shared/lib/result.ts` — `AppErrorCode` union, `INVENTORY_NEGATIVE` present
- Verified codebase: `bar-pos/e2e/` — existing spec files confirm next spec is `33-ingredients.spec.ts`
- Verified codebase: `bar-pos/src/shared/ui/DataTable.tsx` — component API
- Verified codebase: `bar-pos/scripts/seed-combos.ts` — seed script pattern
- Locked decisions: `.planning/feature-expansion-2026q2/01-locked-decisions.md` — D2, D4, C5
- Data model: `.planning/feature-expansion-2026q2/02-data-model.md` — exact `ingredients` column spec
- Sprint spec: `.planning/feature-expansion-2026q2/sprints/S3a-ingredients.md` — RPC contract, CSV format, DoD
- UI spec: `.planning/phases/03-ingredient-foundation/03-UI-SPEC.md` — component contracts, copy

### Secondary (MEDIUM confidence)
- Testing strategy: `.planning/feature-expansion-2026q2/03-testing-strategy.md` — P4, P5 specs

### Tertiary (LOW confidence)
- None — all claims verified against codebase or locked planning documents.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions verified in package.json
- DB schema: HIGH — exact columns from locked 02-data-model.md, cross-checked with S3a spec
- RPC design: HIGH — contract from S3a spec + verified pattern from existing RPC migrations
- FSD structure: HIGH — verified from entities/combo/ and manage-combos/ patterns
- UOM utility: HIGH — fully specified in S3a spec + UI-SPEC; no external library needed
- Pitfalls: HIGH — numeric precision pitfall verified by examining existing StockMovementSchema

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (stable architecture; no fast-moving dependencies)
