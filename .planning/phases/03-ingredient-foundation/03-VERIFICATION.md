---
phase: 03-ingredient-foundation
verified: 2026-04-24T18:00:00Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "record_stock_movement RPC exists, atomically locks ingredient row, inserts movement, updates quantity_on_hand"
    status: failed
    reason: "RPC file exists and logic is correct BUT the INSERT omits product_id, which is NOT NULL on stock_movements (inherited from inventory_log). Every RPC call will fail at the DB level with a null-value constraint violation. The fix requires either: (A) ALTER stock_movements to make product_id nullable + pass NULL explicitly in the RPC INSERT + update StockMovementSchema.productId to nullable, or (B) use a sentinel UUID. This makes the entire manual adjustment feature non-functional against the real DB."
    artifacts:
      - path: "bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql"
        issue: "INSERT into stock_movements omits product_id column. Original table created with product_id UUID NOT NULL (see 20260414000007_inventory.sql line 24). No migration has made product_id nullable."
      - path: "bar-pos/src/entities/ingredient/model/queries.ts"
        issue: "mapMovementRow falls back to '' for missing product_id (line 62). StockMovementSchema.productId is UuidSchema (non-nullable), so the query hook will throw on any movement row from the ingredients flow."
      - path: "bar-pos/src/shared/lib/domain.ts"
        issue: "StockMovementSchema.productId is UuidSchema (non-nullable) at line 640. Not updated to nullable after Phase 3 ingredient-only movements were introduced."
    missing:
      - "Migration to ALTER TABLE stock_movements ALTER COLUMN product_id DROP NOT NULL (or make nullable)"
      - "UPDATE record_stock_movement RPC INSERT to include product_id = NULL"
      - "UPDATE StockMovementSchema in domain.ts: productId: UuidSchema.nullable()"
      - "Fix mapMovementRow: productId: (row['product_id'] ?? null) as string | null"
  - truth: "E2E spec 33-ingredients.spec.ts covers T1–T7: create, edit, low-stock indicator, manual adjustment, INVENTORY_NEGATIVE guard, CSV import, delete"
    status: partial
    reason: "E2E spec file exists at bar-pos/e2e/33-ingredients.spec.ts with all 7 tests (T1–T7) implemented. However, T4 (manual adjustment) and T5 (INVENTORY_NEGATIVE guard) both exercise the record_stock_movement RPC which will fail at the DB level due to the product_id NOT NULL constraint (CR-01). These two tests cannot pass until CR-01 is resolved. The spec itself is structurally complete and correctly written — the failure is in the underlying RPC."
    artifacts:
      - path: "bar-pos/e2e/33-ingredients.spec.ts"
        issue: "T4 and T5 will fail at runtime because the record_stock_movement RPC crashes on product_id NOT NULL. The spec code is correct; the underlying RPC needs fixing."
    missing:
      - "Resolve CR-01 (product_id nullable) before T4 and T5 can pass"
      - "Human verification gate: run full E2E suite against live dev server after CR-01 fix"
human_verification:
  - test: "Run E2E spec after CR-01 fix"
    expected: "All 7 tests (T1–T7) pass without failures"
    why_human: "Requires running dev server + .env.local credentials; T4 and T5 cannot be verified until product_id constraint is resolved"
  - test: "Verify Ingredients tab RBAC visibility"
    expected: "Bartender login sees NO Ingredients tab in Settings; Manager/Admin login sees Ingredients tab"
    why_human: "Role-based UI visibility requires live Tauri app with two different user accounts"
  - test: "Verify record_stock_movement RPC in Supabase Studio"
    expected: "After product_id fix: call the RPC via SQL editor with a valid ingredient_id and confirm it inserts a row with product_id=NULL and updates quantity_on_hand atomically"
    why_human: "Cannot test remote DB state programmatically from verifier; requires Supabase Studio or SQL client"
  - test: "CSV import end-to-end (T6 visual flow)"
    expected: "Upload a CSV, preview shows 2 valid rows, click Import, toast shows '2 ingredients imported', rows appear in IngredientsTable"
    why_human: "File picker interaction (fileChooser.setFiles) is only automatable via Playwright with a running server"
---

# Phase 3: Ingredient Foundation Verification Report

**Phase Goal:** Build the ingredient entity and the canonical `record_stock_movement` RPC. No sale-time depletion yet — get the ledger right before anything writes to it.
**Verified:** 2026-04-24T18:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | ingredients table exists in Supabase with all required columns, CHECK constraints, and indexes | VERIFIED | `20260426000001_ingredients_table.sql` — 13 columns, 3 CHECK constraints, 3 indexes, RLS enabled; supabase db push confirmed by human in 03-01-SUMMARY |
| 2 | stock_movements has a partial UNIQUE index covering (ref_type, ref_id, ingredient_id) for depletion reasons | VERIFIED | `20260426000002_stock_movements_idempotency_index.sql` — partial index on exactly 5 depletion reasons: sale, refund, void, prep_production, prep_consumption |
| 3 | record_stock_movement RPC exists, atomically locks ingredient row, inserts movement, updates quantity_on_hand | FAILED | RPC file exists with correct logic (SELECT FOR UPDATE, negative guard, RETURNING), but INSERT omits product_id which is NOT NULL on stock_movements. DB will reject every call. |
| 4 | RPC raises INVENTORY_NEGATIVE when delta would drive qty below 0 for non-correction/physical_count reasons | VERIFIED (code) | Guard present in migration SQL lines 52–54. However, this path cannot be reached until CR-01 (product_id) is fixed. Code itself is correct. |
| 5 | IngredientSchema, UomSchema, ManualAdjustReasonSchema exported from domain.ts | VERIFIED | All schemas confirmed at domain.ts lines 1472–1519 under `// S3a — INGREDIENT FOUNDATION` section marker |
| 6 | uom.ts exports toBase, fromBase, roundTrip with zero imports; P5 property test passes | VERIFIED | `bar-pos/src/shared/lib/uom.ts` confirmed with all 3 exports and JSDoc. 03-02-SUMMARY reports 11/11 tests passing including P5 (1000 runs) |
| 7 | entities/ingredient FSD slice exists with 4 query hooks + ingredientKeys + Zod row mappers | VERIFIED | All files confirmed: index.ts, model/types.ts, model/queries.ts. 4 hooks present. ingredientKeys factory with all/lists/detail/movements keys. Pre-regen cast with eslint-disable. |
| 8 | ManageIngredientsTab wired in SettingsTabsPanel under canManageProducts gate | VERIFIED | SettingsTabsPanel/index.tsx lines 81–85 confirmed: `key: 'ingredients'`, `label: 'Ingredients'`, `render: () => <ManageIngredientsTab />` inside canManageProducts block |

**Score:** 6/8 truths verified (Truth 3 = FAILED with blocker; Truth 4 = code-correct but unreachable until fix)

### Deferred Items

None — no later phases in this milestone explicitly address the product_id constraint gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/supabase/migrations/20260426000001_ingredients_table.sql` | ingredients table DDL with RLS | VERIFIED | 13 columns, 4 constraints, 3 indexes, 2 RLS policies |
| `bar-pos/supabase/migrations/20260426000002_stock_movements_idempotency_index.sql` | Partial UNIQUE index | VERIFIED | idx_stock_movements_idempotency on 5 depletion reasons |
| `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql` | PL/pgSQL RPC | STUB-RUNTIME | File exists, logic correct, but omits product_id from INSERT — will crash at DB layer |
| `bar-pos/src/shared/lib/uom.ts` | UOM conversion utility | VERIFIED | toBase, fromBase, roundTrip, BASE_UOMS, ALL_UOMS exported |
| `bar-pos/src/shared/lib/domain.ts` | IngredientSchema + UOM schemas | VERIFIED | All 6 schemas under S3a section marker at line 1472 |
| `bar-pos/src/entities/ingredient/index.ts` | FSD public API barrel | VERIFIED | All 4 hooks + ingredientKeys + types exported |
| `bar-pos/src/entities/ingredient/model/queries.ts` | TanStack Query hooks | VERIFIED (with warning) | 4 hooks present; mapMovementRow uses unsafe fallback to '' for product_id — will throw when Zod parses movements |
| `bar-pos/src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` | Manual adjustment dialog | VERIFIED (code) | Calls record_stock_movement RPC with p_delta.toString(), INVENTORY_NEGATIVE handling present. Non-functional until CR-01 fixed. |
| `bar-pos/src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | 3-state CSV import Sheet | VERIFIED | parseCsvText (extracted to csv-parse.ts), FileReader, 3-state UX, IngredientCreateSchema.safeParse per row, bulk insert |
| `bar-pos/src/features/manage-ingredients/ui/IngredientForm.tsx` | Create/edit form | VERIFIED | 8 fields (name, category, base_uom, purchase_uom, factor, cost, reorder_point, is_prep). Native select used (shadcn Select not available). |
| `bar-pos/src/widgets/IngredientsTable/index.tsx` | DataTable with 8 columns | VERIFIED | 8 columns, getRowClassName for bg-pos-danger/10, toolbar with Add+Import buttons |
| `bar-pos/src/widgets/StockMovementsList/index.tsx` | Read-only ledger DataTable | VERIFIED | Delta color coding (text-pos-accent/text-pos-danger), newest-first, read-only |
| `bar-pos/src/widgets/ManageIngredientsTab/index.tsx` | Settings tab container | VERIFIED | Discriminated DialogState (create/edit/delete/adjust), 3 mutations, soft delete, StockMovementsList in edit dialog |
| `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` | Updated with Ingredients tab | VERIFIED | ManageIngredientsTab imported and rendered under canManageProducts gate |
| `bar-pos/e2e/33-ingredients.spec.ts` | E2E spec T1–T7 | PARTIAL | All 7 tests structurally complete. T1, T2, T3, T6, T7 should pass. T4 and T5 will fail until CR-01 is resolved. |
| `bar-pos/src/shared/lib/ledger.test.ts` | P4 property test | VERIFIED | simulateLedger(), 4 unit tests + P4 property test (500 runs). 03-07-SUMMARY reports 5/5 passing. |
| `bar-pos/scripts/seed-ingredients.ts` | Dev seed data | VERIFIED | 6 core ingredients (Corona, Modelo, Wings, Lime, Clamato, Salsa Mexicana), idempotent by name |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SettingsTabsPanel | ManageIngredientsTab | `import { ManageIngredientsTab } from '@widgets/ManageIngredientsTab'` | WIRED | Confirmed at line 2 of SettingsTabsPanel/index.tsx |
| ManageIngredientsTab | AdjustStockMovementDialog | `import { AdjustStockMovementDialog } from '@features/adjust-stock-movement'` | WIRED | Confirmed in ManageIngredientsTab/index.tsx |
| ManageIngredientsTab | CsvImportSheet | `import { CsvImportSheet } from '@features/import-ingredients-csv'` | WIRED | Confirmed in ManageIngredientsTab/index.tsx |
| AdjustStockMovementDialog | record_stock_movement RPC | `supabase.rpc('record_stock_movement', { p_ingredient_id, p_delta: delta.toString(), ... })` | WIRED (code) | Code calls RPC correctly. Call will fail at DB due to product_id NOT NULL. |
| record_stock_movement RPC | stock_movements.product_id | INSERT omits product_id | NOT_WIRED | stock_movements.product_id is NOT NULL (original inventory_log schema). Omitting it causes immediate constraint violation. |
| entities/ingredient queries | ingredients table | `db.from('ingredients').select('*').eq('is_active', true)` | WIRED | Confirmed in queries.ts. Pre-regen cast in place. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| IngredientsTable | `ingredients` prop | `useIngredients()` → Supabase `ingredients` table | Yes (when table has data) | FLOWING |
| StockMovementsList | `movements` state | `useStockMovements(ingredientId)` → `stock_movements` table | Conditional — data exists only if movements were inserted. With CR-01 blocking RPC, no movements will exist via the Phase 3 adjustment flow. | STATIC/BLOCKED |
| AdjustStockMovementDialog | mutation result | `supabase.rpc('record_stock_movement', ...)` | No — RPC will crash on product_id NOT NULL | DISCONNECTED |

### Behavioral Spot-Checks

Step 7b SKIPPED for DB-dependent behaviors — cannot test remote Supabase RPC without a running server. Unit/property tests verified from SUMMARY files.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| P5 UOM round-trip (uom.test.ts) | `npx vitest run src/shared/lib/uom.test.ts` | 11/11 PASS (per 03-02-SUMMARY) | PASS |
| P4 Ledger invariant (ledger.test.ts) | `npx vitest run src/shared/lib/ledger.test.ts` | 5/5 PASS (per 03-07-SUMMARY) | PASS |
| Entity query hook tests | `npx vitest run src/entities/ingredient/model/queries.test.ts` | 4/4 PASS (per 03-03-SUMMARY) | PASS |
| CSV parse + Zod validation tests | `npx vitest run src/features/import-ingredients-csv/ui/CsvImportSheet.test.tsx` | 8/8 PASS (per 03-04-SUMMARY) | PASS |
| record_stock_movement RPC call | Would require live DB | Will fail: product_id NOT NULL constraint | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| S3a-01 | 03-01 | ingredients table + RLS | SATISFIED | Migration confirmed, supabase db push applied |
| S3a-02 | 03-01 | stock_movements idempotency index | SATISFIED | idx_stock_movements_idempotency confirmed in migration |
| S3a-03 | 03-01 | record_stock_movement RPC | BLOCKED | RPC exists but will crash due to product_id NOT NULL omission |
| S3a-04 | 03-02 | Ingredient + UOM Zod schemas | SATISFIED | All schemas confirmed in domain.ts under S3a section |
| S3a-05 | 03-02 | UOM conversion utility (uom.ts) | SATISFIED | uom.ts confirmed with all exports, P5 passing |
| S3a-06 | 03-03 | entities/ingredient FSD slice + hooks | SATISFIED | All 4 hooks + key factory confirmed |
| S3a-07 | 03-04/05/06 | Ingredient management UI + Settings tab | PARTIAL | UI complete and wired; adjustment feature blocked by CR-01 |
| S3a-08 | 03-04/07 | CSV import + E2E coverage | PARTIAL | CsvImportSheet fully functional; T4+T5 E2E blocked by CR-01 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `20260426000003_record_stock_movement_rpc.sql` | 57–74 | INSERT omits product_id (NOT NULL column) | BLOCKER | Every RPC call fails at DB layer — adjustment feature non-functional |
| `src/entities/ingredient/model/queries.ts` | 62 | `productId: (row['product_id'] ?? '') as string` — empty string fallback | BLOCKER | StockMovementSchema.productId is UuidSchema (non-nullable); Zod will reject '' — query hook throws when ingredient has movements |
| `src/shared/lib/domain.ts` | ~640 | `productId: UuidSchema` — not updated to nullable after Phase 3 | BLOCKER | Zod schema inconsistent with Phase 3 ingredient-only movements that have product_id=NULL |
| `src/widgets/ManageIngredientsTab/index.tsx` | ~298 | Delete ConfirmDialog copy says "permanently remove...all stock movement history" | WARNING | Soft delete (`is_active=false`) preserves history — misleading copy per CR-WR-04 |
| `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | ~165 | Error recovery resets failedRows to `[]` | WARNING | User loses validation error list on bulk insert failure per CR-WR-01 |
| `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | ~227 | UI says "max 500 rows" but no enforcement | WARNING | Unenforced limit per CR-WR-02 |

### Human Verification Required

#### 1. E2E Spec After CR-01 Fix

**Test:** After resolving the product_id NOT NULL constraint issue (Option A: make nullable + update RPC + update schema), run `npx playwright test e2e/33-ingredients.spec.ts --headed` against a running dev server.
**Expected:** All 7 tests (T1–T7) pass. T4 verifies a 'waste' movement row appears in DB. T5 verifies INVENTORY_NEGATIVE toast appears and dialog stays open.
**Why human:** Requires live dev server with `.env.local` credentials and a running Tauri/Vite app.

#### 2. Ingredients Tab RBAC Visibility

**Test:** Log in as bartender (role: bartender) → Settings → verify NO Ingredients tab. Log in as manager or admin → Settings → verify Ingredients tab IS visible.
**Expected:** Tab hidden for bartender, visible for manager and admin.
**Why human:** Role-based UI visibility requires live app with two different user sessions.

#### 3. record_stock_movement RPC Live Validation

**Test:** After CR-01 fix is applied and `supabase db push` run, test via Supabase Studio SQL editor: `SELECT record_stock_movement('<valid-ingredient-uuid>', -100, 'waste', 'manual', NULL, 'test note');`
**Expected:** Returns a stock_movements row with product_id=NULL, ingredient_id=valid UUID, quantity_delta=-100, reason='waste'. Then verify `SELECT quantity_on_hand FROM ingredients WHERE id = '<uuid>'` decreased by 100.
**Why human:** Cannot execute remote Supabase RPCs from the verifier without a running server and credentials.

#### 4. Low-Stock Row Highlight Visual Verification

**Test:** In Settings → Ingredients, ensure an ingredient exists with `quantity_on_hand <= reorder_point`. Open browser DevTools and inspect the DataTable row — confirm the row has class `bg-pos-danger/10`.
**Expected:** Row has the low-stock class applied, badge shows "Low stock".
**Why human:** Visual regression; no visual test configured in CI.

### Gaps Summary

**Root cause:** The `record_stock_movement` RPC (S3a-03) was implemented without accounting for the existing `NOT NULL` constraint on `stock_movements.product_id`. The original `inventory_log` table (renamed to `stock_movements` in Phase 1) was designed for product-level movements only, where `product_id` was required. Phase 3 introduces ingredient-only movements with no product reference, but no migration was added to make `product_id` nullable.

**Impact chain:**
1. RPC INSERT crashes → S3a-03 non-functional
2. AdjustStockMovementDialog calls the RPC → T4 (waste adjustment) E2E fails
3. INVENTORY_NEGATIVE guard unreachable → T5 E2E fails
4. mapMovementRow falls back to '' for product_id → StockMovementSchema.parse() will throw → useStockMovements hook broken for any ingredient with movements
5. StockMovementsList cannot display any data once movements exist

**Two related gaps (warnings, not blockers):**
- CR-WR-01: CSV import error recovery loses the failedRows list
- CR-WR-02: "max 500 rows" limit advertised in UI but not enforced in code

**Fix path for CR-01 (Option A — recommended):**
1. Add migration: `ALTER TABLE stock_movements ALTER COLUMN product_id DROP NOT NULL;`
2. Update RPC: add `product_id,` to INSERT column list and `NULL,` to VALUES
3. Update `StockMovementSchema` in domain.ts: `productId: UuidSchema.nullable()`
4. Fix `mapMovementRow`: `productId: (row['product_id'] ?? null) as string | null`
5. Run `supabase db push` and `npm run typecheck`

---

_Verified: 2026-04-24T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
