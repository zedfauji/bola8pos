---
phase: 03-ingredient-foundation
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - bar-pos/e2e/33-ingredients.spec.ts
  - bar-pos/scripts/seed-ingredients.ts
  - bar-pos/src/entities/ingredient/index.ts
  - bar-pos/src/entities/ingredient/model/queries.test.ts
  - bar-pos/src/entities/ingredient/model/queries.ts
  - bar-pos/src/entities/ingredient/model/types.ts
  - bar-pos/src/features/adjust-stock-movement/index.ts
  - bar-pos/src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx
  - bar-pos/src/features/import-ingredients-csv/index.ts
  - bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx
  - bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx
  - bar-pos/src/features/import-ingredients-csv/ui/csv-parse.ts
  - bar-pos/src/features/manage-ingredients/index.ts
  - bar-pos/src/features/manage-ingredients/ui/IngredientForm.tsx
  - bar-pos/src/shared/lib/domain.test.ts
  - bar-pos/src/shared/lib/domain.ts
  - bar-pos/src/shared/lib/ledger.test.ts
  - bar-pos/src/shared/lib/uom.test.ts
  - bar-pos/src/shared/lib/uom.ts
  - bar-pos/src/widgets/IngredientsTable/index.tsx
  - bar-pos/src/widgets/ManageIngredientsTab/index.tsx
  - bar-pos/src/widgets/SettingsTabsPanel/index.tsx
  - bar-pos/src/widgets/StockMovementsList/index.tsx
  - bar-pos/supabase/migrations/20260426000001_ingredients_table.sql
  - bar-pos/supabase/migrations/20260426000002_stock_movements_idempotency_index.sql
  - bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 03: Ingredient Foundation — Code Review Report

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the full Phase 3 ingredient foundation: Zod schemas in `domain.ts`, UOM utilities, ledger property tests, entity query hooks, three new features (manage, adjust-stock, import-csv), three widgets, three SQL migrations, the seed script, and the E2E spec.

The architecture is well-structured and consistent with FSD conventions. UOM utilities, property-based ledger tests, and the Zod schema additions are all correct and complete. The pre-regen `as any` casts are properly scoped and documented.

One critical runtime crash exists: the `record_stock_movement` RPC inserts a row into `stock_movements` without providing `product_id`, which is almost certainly a NOT NULL column on the existing table. This will cause T4 and T5 E2E tests to fail and the adjustment feature to be non-functional. Four warnings cover a data loss scenario on import error recovery, a silent type cast on the UOM field, a 500-row limit advertised in the UI but not enforced in code, and a misleading delete description. Three info items cover code quality.

---

## Critical Issues

### CR-01: `record_stock_movement` RPC will crash — `product_id` omitted from INSERT

**File:** `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql:57-74`

**Issue:** The RPC's INSERT into `stock_movements` lists only `ingredient_id, quantity_delta, reason, ref_type, ref_id, staff_id, notes`. The existing `stock_movements` table almost certainly has a `product_id` column with a NOT NULL constraint (it is required in `StockMovementSchema` and was present before Phase 3). Omitting it will cause a PostgreSQL `null value in column "product_id" violates not-null constraint` error on every call. T4 and T5 E2E tests will fail, and the entire manual adjustment feature is non-functional against a real DB.

Additionally, `mapMovementRow` in `queries.ts` (line 62) masks this by falling back to `''` for a missing `product_id`, but `StockMovementSchema.productId` is `UuidSchema` which will reject an empty string — causing the query hook to throw on any ingredient that has movements.

**Fix:**

Option A — if Phase 3 ingredient movements genuinely have no product, make `product_id` nullable in the table and the schema:

```sql
-- In record_stock_movement RPC INSERT, add product_id NULL explicitly:
INSERT INTO stock_movements (
  product_id,      -- allow NULL for ingredient-only movements
  ingredient_id,
  quantity_delta,
  reason,
  ref_type,
  ref_id,
  staff_id,
  notes
)
VALUES (
  NULL,            -- ingredient-only movement; no product
  p_ingredient_id,
  p_delta,
  p_reason,
  p_ref_type,
  p_ref_id,
  v_staff_id,
  p_notes
)
```

And update `StockMovementSchema` in `domain.ts` to make `productId` nullable:

```typescript
// domain.ts ~line 639
productId: UuidSchema.nullable(), // nullable for ingredient-only movements (Phase 3+)
```

And fix `mapMovementRow` in `queries.ts` line 62 to not fall back to `''`:

```typescript
productId: (row['product_id'] ?? null) as string | null,
```

Option B — if `product_id NOT NULL` is a hard invariant, add a sentinel/placeholder UUID to all ingredient-only movements (less clean, not recommended).

---

## Warnings

### WR-01: CSV import error recovery loses validation error list

**File:** `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx:164-169`

**Issue:** When the bulk Supabase insert fails, `handleConfirmImport` resets state to `{ step: 'staged', validRows, failedRows: [] }`. This discards the original `failedRows` that were shown in the preview. The user sees an import failure toast but the row-level validation errors (which rows had problems) disappear. The user cannot tell which rows were invalid when they try again.

**Fix:**
```typescript
// Store failedRows in a ref or capture them before transitioning to 'importing':
// In handleConfirmImport, capture them before the state transition:
const { validRows, failedRows: originalFailedRows } = importState;
setImportState({ step: 'importing' });
// ...
if (error) {
  // restore with original failedRows, not []
  setImportState({ step: 'staged', validRows, failedRows: originalFailedRows });
  return;
}
```

### WR-02: CSV bulk import has no server-side or client-side row limit enforcement

**File:** `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx:227`

**Issue:** The UI copy says "max 500 rows" but `handleConfirmImport` sends all valid rows to Supabase with no guard. A CSV with 10,000 rows will attempt to bulk-insert all of them in a single call, risking a timeout or hitting Supabase's request body size limit. The advertised limit is silently unenforced.

**Fix:**
```typescript
const MAX_CSV_ROWS = 500;

async function handleConfirmImport() {
  if (importState.step !== 'staged' || importState.validRows.length === 0) return;

  const { validRows } = importState;
  if (validRows.length > MAX_CSV_ROWS) {
    toast.error(`Too many rows — maximum ${MAX_CSV_ROWS} per import (found ${validRows.length})`);
    return;
  }
  // ... rest of handler
}
```

### WR-03: `IngredientForm` — `uom` field bypasses Zod validation via `as any` cast

**File:** `bar-pos/src/features/manage-ingredients/ui/IngredientForm.tsx:89-91`

**Issue:** The `uom` field is a local `string` state value initialized to `ingredient?.uom ?? ''`. On submit it is cast to the correct Zod enum type via `uom: uom as any`. If `uom` is `''` (user never selected a value), the `validate()` function catches it and returns early — so the guard is present. However, `as any` suppresses TypeScript's ability to catch future breakage (e.g., if someone adds a code path that skips `validate()`). The `uom` state type should be `BaseUom | ''` and the submit logic should use a proper cast.

**Fix:**
```typescript
// Change state declaration:
const [uom, setUom] = useState<BaseUom | ''>(ingredient?.uom ?? '');

// In handleSubmit, after validate() passes, uom is guaranteed non-empty.
// Use a type assertion with a comment instead of as any:
uom: uom as BaseUom, // safe: validate() guards against ''
```

### WR-04: Misleading delete confirmation text — describes hard delete but action is a soft delete

**File:** `bar-pos/src/widgets/ManageIngredientsTab/index.tsx:298`

**Issue:** The `ConfirmDialog` description reads: "This will permanently remove the ingredient and all its stock movement history. This cannot be undone." But `useMutationDeleteIngredient` performs a soft delete (`UPDATE ingredients SET is_active = false`). The ingredient record and all its ledger history are preserved. The copy actively misinforms the user about what will happen.

**Fix:**
```typescript
description="This will deactivate the ingredient and hide it from the list. Stock movement history is preserved. You can re-activate it via the database if needed."
```

---

## Info

### IN-01: `mapMovementRow` in `queries.ts` uses direct property casts instead of Zod parsing

**File:** `bar-pos/src/entities/ingredient/model/queries.ts:59-71`

**Issue:** `mapIngredientRow` correctly uses `IngredientSchema.parse()` which gives runtime validation. `mapMovementRow` bypasses this and uses manual `as string` / `Number()` casts, with a comment that `StockMovementSchema.parse()` cannot be used yet. This means malformed data from the DB will propagate silently as incorrectly typed objects rather than throwing a schema parse error. The comment correctly explains the pre-regen workaround, but it should be clearly tracked for removal.

**Fix:** Add a TODO comment that is tied to the supabase types regeneration task, and plan to replace with `StockMovementSchema.parse()` once `product_id` nullable question is resolved (see CR-01).

### IN-02: `Record adjustment` CTA in edit dialog uses a plain `<button>` instead of the `<Button>` component

**File:** `bar-pos/src/widgets/ManageIngredientsTab/index.tsx:268-275`

**Issue:** The "Record adjustment" button in the stock movements section uses a raw `<button>` element with manual className styling (`text-xs text-primary underline-offset-4 hover:underline`). All other interactive elements in this file use `<Button>` from `@shared/ui/button`. This is an inconsistency — future global button style changes will not apply here.

**Fix:** Replace with the `Button` component using `variant="link"` and `size="sm"`:
```tsx
<Button
  type="button"
  variant="link"
  size="sm"
  className="h-auto p-0 text-xs"
  onClick={() => {
    setDialogState({ kind: 'adjust', ingredient: dialogState.ingredient });
  }}
>
  Record adjustment
</Button>
```

### IN-03: `domain.test.ts` — `StockMovementSchema` tests do not cover `ingredientId`-only movements

**File:** `bar-pos/src/shared/lib/domain.test.ts:229-308`

**Issue:** The `StockMovementSchema` test suite validates `sale`, `prep_production`, `void`, etc. but does not include a test for an ingredient-only movement where `productId` might be null/absent (as will be needed if CR-01 is resolved by making `productId` nullable). Once the schema is updated, a regression test should be added to prevent re-introducing the NOT NULL constraint assumption.

**Fix:** After resolving CR-01, add a test case:
```typescript
it('parses an ingredient-only movement (productId = null)', () => {
  const result = StockMovementSchema.safeParse({
    ...baseValid,
    productId: null,
    ingredientId: UUID2,
    reason: 'waste',
  });
  expect(result.success).toBe(true);
});
```

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
