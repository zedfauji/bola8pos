# Phase 1: Foundation — Research

**Researched:** 2026-04-23
**Domain:** Supabase (PostgreSQL) schema migrations + Zod/TS codegen + FSD feature scaffolding (brownfield)
**Confidence:** HIGH
**Validity:** 30 days (brownfield audit may drift as codebase changes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 13 tickets (S1-01..S1-13) ship as specified in CONTEXT.md. Key locked items:

- **S1-01** Rename `inventory_log` → `stock_movements`. Extend reason enum with `prep_production | prep_consumption | combo_component | refund` (existing: `sale | manual_adjustment | waste | delivery | correction | physical_count`). Add `ref_type text`, `ref_id uuid`, nullable `ingredient_id uuid` (FK deferred to Phase 3). Reversible with DOWN.
- **S1-02** `categories.parent_id uuid null references categories(id)`. CHECK trigger on INSERT/UPDATE enforcing depth ≤ 3 AND rejecting cycles.
- **S1-03** New tables `modifier_groups`, `modifier_group_items`, `product_modifier_groups` (existing `modifiers` + `product_modifiers` stay). Reversible DOWN.
- **S1-04** `products.combo_eligible boolean NOT NULL DEFAULT true`; `products.is_combo boolean NOT NULL DEFAULT false`.
- **S1-05** Drop `payments.tab_id` UNIQUE constraint (currently `CONSTRAINT payments_tab_id_key UNIQUE` via `UUID NOT NULL UNIQUE` at migration 20260414000006 line 7).
- **S1-06** Single type regen after all 5 migrations. Extend Zod schemas for Category (+parent_id), ModifierGroup, ModifierGroupItem, ProductModifierGroup, StockMovement, Product (+combo flags). **Never hand-write entity types; infer from Zod.**
- **S1-07** `shared/ui/CategoryTreePicker/` + Storybook story (project rule).
- **S1-08** `features/manage-categories/` — Settings tab, admin-only (`manage_settings`).
- **S1-09** `features/manage-modifier-groups/` — Settings tab, admin-only.
- **S1-10** `entities/category/model/{types,store,queries}.ts` (NEW FOLDER — category currently lives under `entities/product`). Tree-aware `descendants()` / `ancestors()` via recursive CTE.
- **S1-11** RLS: bartender read-only on modifier_* tables, manager+ write. Same pattern as existing inventory policies.
- **S1-12** `fast-check` property test at `src/shared/lib/category-tree.test.ts` — random tree up to 1000 nodes, depth ≤ 3 + no cycles.
- **S1-13** New Playwright spec `e2e/18-categories.spec.ts`. **⚠️ COLLISION: `e2e/18-void-order.spec.ts` already exists** — see §Spec-number collision below.

**Migration order (locked):** 1) stock_movements rename → 2) categories tree → 3) modifier_groups trio → 4) products flags → 5) payments constraint drop → 6) RLS policies (S1-11).

### Claude's Discretion

- Migration timestamps (sequential UTC — research recommends `20260424000001..000006`)
- Internal component layout of `CategoryTreePicker` (indented list, zero-dep — per `04-navigation-ui-flows.md`)
- Query-cache keys (follow existing `entities/<name>/model/queries.ts` `categoryKeys` pattern)
- Zustand store shape for category tree
- Test fixture data

### Deferred Ideas (OUT OF SCOPE)

- Runtime combos (Phase 2)
- Runtime ingredients / recipes / depletion (Phase 3+)
- Any UI change on POS/Tab pages — POS must render identically
- `stock_movements.ingredient_id` FK → added in Phase 3 when `ingredients` table exists (column stays nullable, unreferenced, in Phase 1)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| S1-01 | Rename `inventory_log` → `stock_movements` + polymorphic cols + extended enum | §Brownfield audit (40+ refs), §Migration 1 DDL, §Type-regen fan-out |
| S1-02 | `categories.parent_id` + depth-3 CHECK + cycle rejection trigger | §Migration 2 DDL, §Recursive-CTE trigger pattern |
| S1-03 | `modifier_groups` trio of tables | §Migration 3 DDL, §Existing `modifiers` pattern |
| S1-04 | `products.combo_eligible`, `products.is_combo` | §Migration 4 DDL (XS additive) |
| S1-05 | Drop `payments.tab_id` UNIQUE | §Migration 5 DDL, §`isOneToOne` audit (no client-code impact) |
| S1-06 | Type regen + Zod schema extensions | §Type-regen pipeline, §Zod domain.ts location, §exactOptionalPropertyTypes workaround |
| S1-07 | `CategoryTreePicker` shared/ui + Storybook | §Storybook pattern (4 existing `.stories.tsx`), §Zero-dep design |
| S1-08 | `manage-categories` feature + Settings tab | §SettingsTabsPanel.tsx tab-array pattern (lines 26-76), §manage_settings gate |
| S1-09 | `manage-modifier-groups` feature + Settings tab | §Same SettingsTabsPanel pattern |
| S1-10 | New `entities/category/` folder (currently in `entities/product`) | §Existing `entities/inventory/model/*` as template |
| S1-11 | RLS policies for new tables | §Existing `inventory_log` RLS pattern (manager_admin select/insert) |
| S1-12 | `fast-check` property test P1 | §5 existing `fast-check` test files as templates |
| S1-13 | `e2e/18-categories.spec.ts` | §Spec collision fix, §Existing auth + supabase helpers |

</phase_requirements>

## Summary

This is an **infrastructure-only brownfield sprint** against a well-established Tauri 2 + React 19 + Supabase codebase. The core discipline is: **atomic DB rename in one commit** so 40+ codebase references to `inventory_log` flip together, and a single type-regen fan-out after all 5 migrations apply cleanly. After brownfield audit, no runtime code path turned out to assume single-payment-per-tab beyond auto-generated Supabase type metadata, which regenerates automatically. The `entities/category/` folder does **not exist** today (category lives inside `entities/product/`) — S1-10 requires a small refactor of imports across `features/manage-products/ui/CatalogCategoriesTab.tsx`.

**Spec-number collision:** `e2e/18-void-order.spec.ts` already exists. Recommend naming the new spec `e2e/31-categories.spec.ts` (next free slot — highest existing is `30-help-manual.spec.ts`). Keep `18-categories` in ticket title text if desired, but the file name must be unique.

**Primary recommendation:** Execute in waves: Wave 0 setup → Wave 1 (migrations 1–5 serial) → Wave 2 type+Zod regen (fan-in) → Wave 3 (UI + entity + RLS + tests in parallel).

## Brownfield Audit

### `inventory_log` references — EXHAUSTIVE LIST (must flip atomically with S1-01)

**Migrations (7 files):**
- `supabase/migrations/20260414000007_inventory.sql` — **the table definition** (lines 22-33). Rename target.
- `supabase/migrations/20260414000008_triggers.sql` — lines 61, 89 (`decrement_inventory_on_order_item`, `restore_inventory_on_order_item_delete`). Must update trigger function bodies.
- `supabase/migrations/20260414000009_rls_policies.sql` — lines 19, 483, 489, 495 (RLS enable + 3 policies). Must drop+recreate policies against new table name.
- `supabase/migrations/20260420000007_fix_inventory_trigger_rls.sql` — lines 13, 33 (SECURITY DEFINER rewrite of triggers).
- `supabase/migrations/20260422000003_add_physical_count_reason.sql` — lines 10, 30, 46 (latest trigger rewrite + CHECK constraint `inventory_log_reason_check`). **Constraint must be renamed AND extended to include new enum values.**

**Source (3 files):**
- `src/entities/inventory/model/queries.ts` — lines 345, 352, 353, 443 (INSERT, mutation, SELECT).
- `src/features/physical-count/model/usePhysicalCount.ts` — lines 129, 136, 137 (INSERT from physical-count flow).
- `src/features/physical-count/model/usePhysicalCount.test.ts` — lines 118, 225, 324, 422 (mock table name string — **just text replace**).

**E2E (2 files):**
- `e2e/27-inventory-intelligence.spec.ts` — lines 149, 151, 220 (comments + spec title "writes inventory_log").
- `e2e/helpers/supabase.ts` — lines 515, 530 (helper `getLatestInventoryLog` — query `.from('inventory_log')`).

**Generated/docs (2 files):**
- `src/shared/lib/supabase.types.ts` — line 215 (`inventory_log` row type). Will regenerate as `stock_movements` by S1-06.
- `src/shared/lib/supabase-contracts.ts` — line 173 (`inventory_logs` token — comment/doc only).
- `bar-pos/TANSTACK-QUERY-HOOKS.md` — line 546 (docs; not runtime).

**Count:** 16 non-generated source/migration/e2e sites + 1 generated + 2 docs sites. **All must land in the S1-01 commit** (except the generated types file, handled in S1-06).

### `isOneToOne` audit (S1-05 safety check)

- The 29 `isOneToOne` occurrences in `src/shared/lib/supabase.types.ts` are **auto-generated FK-introspection metadata**. The only `isOneToOne: true` entries pointing at `tab_id`/`payments` are lines 209 (not the payment one — that's `inventory.product_id` actually) and 489 (`payments_tab_id_fkey`).
- **No hand-written source code uses `isOneToOne` as a runtime flag.** Only one runtime INSERT to `payments` (`entities/tab/model/queries.ts:816`) — it already uses `.single()` which will continue to work regardless of FK cardinality.
- Grep for `one-payment` / `single payment`: zero hits. Safe to drop the constraint.

### Current schema (verified)

- **`categories`** (migration 20260414000003 lines 6-20): columns = `id`, `name`, `color`, `sort_order`, `happy_hour_start`, `happy_hour_end`, `created_at`, `updated_at`. **Note:** `is_food boolean` column was added later (migration 20260422000005_categories_is_food.sql — Zod schema already reflects it at line 136). **No `parent_id` yet.**
- **`products`** (migration 20260414000003 lines 25-39): `id`, `name`, `category_id`, `base_price`, `happy_hour_price`, `sku`, `is_active`, `image_url`, `created_at`, `updated_at`. Later additions: `stock_threshold` (migration 20260422000002), `barcode` (migration 20260423000002). **No combo flags yet.**
- **`inventory_log`** (migration 20260414000007 lines 22-33): `id`, `product_id` (FK products), `quantity_delta int`, `reason varchar(255)`, `staff_id` (FK profiles), `created_at`. Has CHECK `inventory_log_reason_check` enumerating: `sale | manual_adjustment | waste | delivery | correction | physical_count`.
- **`payments`** (migration 20260414000006 line 7): `tab_id UUID NOT NULL UNIQUE REFERENCES tabs(id) ON DELETE RESTRICT` — the unique constraint is **inline** on the column, not named. Must drop via `ALTER TABLE payments DROP CONSTRAINT payments_tab_id_key` (default PostgreSQL name) or query `pg_constraint` if name differs.

### Current Zod schemas (`src/shared/lib/domain.ts`)

- `CategorySchema` (line 129) — no `parentId` yet.
- `ModifierSchema` (line 155) — existing modifier, unrelated to new `modifier_groups`.
- `ProductSchema` (line 174) — no `comboEligible` / `isCombo` yet. `category: CategorySchema.optional()` (line 185) stays as scalar category association.
- `PaymentSchema` (line 517) — add `isRefund`, `refundId` **only in Phase 6 (S4)**, not now.
- `InventoryLogSchema` is re-exported from domain.ts via `entities/inventory/model/types.ts:2` (confirmed). Rename → `StockMovementSchema`; add fields.

### FSD entity structure

- **No** `src/entities/category/` folder exists. Category is managed inside `entities/product/model/queries.ts` + `entities/product/model/store.ts`. S1-10 requires:
  - Create `src/entities/category/model/{types,store,queries,index}.ts`
  - Move category hooks (`useCategories`, `useMutationCreateCategory`, `useMutationUpdateCategory`) from `@entities/product` to `@entities/category`
  - Update import at `src/features/manage-products/ui/CatalogCategoriesTab.tsx:4-8` (currently imports from `@entities/product`)

### Settings page — how to add tabs (S1-08, S1-09)

- `src/pages/settings/index.tsx` renders `<SettingsTabsPanel />` (a widget).
- `src/widgets/SettingsTabsPanel/index.tsx` — tab registration is a `useMemo` array (lines 26-76). Tabs are gated by `canManageSettings` / `canManageProducts`.
- **Pattern for S1-08 / S1-09:** push two new entries into the `canManageSettings` branch (admin-only):
  ```tsx
  { key: 'categories', label: 'Categories',
    render: () => <ManageCategoriesPanel currentRole={currentRole} /> },
  { key: 'modifier-groups', label: 'Modifier Groups',
    render: () => <ManageModifierGroupsPanel currentRole={currentRole} /> },
  ```
- The existing flat `/settings` route handles both (no new routes needed — navigation-ui-flows.md mentions `/settings/categories` conceptually but the implementation is a tab key, not a route).
- **NOT** to be confused with `widgets/SettingsCatalogPanel.tsx` which wraps the older `features/manage-products` triple-tab (Products/Categories/Modifiers). That existing Categories tab (`CatalogCategoriesTab`) will remain — it handles flat category CRUD. The new Categories tab adds hierarchical tree editing. Both can coexist until a future unification.

## Standard Stack (Already-Installed, Verified)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Supabase JS | ^2 | PostgreSQL client + RLS | package.json |
| TanStack Query | ^5 | Server-state hooks (`useQuery`, `useMutation`) | CLAUDE.md |
| Zustand | v5 | Local/UI store (+ realtime subscriptions) | CLAUDE.md |
| Zod | v4 | Single-source-of-truth domain types | domain.ts |
| fast-check | v4 | Property tests (5 existing files) | Grep |
| Vitest | v4 | Unit test runner | package.json |
| Playwright | v1.59 | E2E | e2e/ |
| shadcn/ui `tabs` | latest | Tab primitive (used by SettingsTabsPanel) | @shared/ui/tabs |
| Storybook | v10 | Required for every new shared/ui | CLAUDE.md |

**No new dependencies needed for Phase 1** (zero-dep category tree UI is a locked decision — no DnD lib).

## Architecture Patterns

### Migration file conventions

- Location: `bar-pos/supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Date format: existing files use `20260420000007` (UTC date + increment). Use `20260424000001..000006` for this phase.
- **Single file per ticket.** Don't merge migrations.
- **Include reverse/DOWN in a comment block** at the bottom of each migration (convention used by GSD milestone). Example: `-- DOWN:\n-- ALTER TABLE stock_movements RENAME TO inventory_log;`

### Depth-3 trigger (S1-02) — recommended implementation

**Approach:** BEFORE INSERT OR UPDATE OF `parent_id` ON categories, run a recursive CTE to count ancestors. This matches PRD `N1` locked decision ("enforced by CHECK constraint via recursive CTE on insert trigger").

```sql
CREATE OR REPLACE FUNCTION categories_depth_check()
RETURNS TRIGGER AS $$
DECLARE
  depth int;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  -- Cycle detection + depth count via recursive CTE.
  WITH RECURSIVE ancestry AS (
    SELECT id, parent_id, 1 AS d FROM categories WHERE id = NEW.parent_id
    UNION ALL
    SELECT c.id, c.parent_id, a.d + 1
    FROM categories c
    JOIN ancestry a ON c.id = a.parent_id
    WHERE a.d < 10  -- hard safety bound
  )
  SELECT MAX(d) INTO depth FROM ancestry;

  IF depth IS NULL THEN depth := 0; END IF;
  IF depth >= 3 THEN
    RAISE EXCEPTION 'Category depth exceeds 3 (got %)', depth + 1
      USING ERRCODE = 'check_violation';
  END IF;
  -- Cycle check: the new id itself must not appear in its own ancestry.
  IF EXISTS (
    WITH RECURSIVE walk AS (
      SELECT NEW.parent_id AS id
      UNION ALL
      SELECT c.parent_id FROM categories c JOIN walk w ON c.id = w.id WHERE c.parent_id IS NOT NULL
    )
    SELECT 1 FROM walk WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Category cycle detected for %', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER categories_depth_check_trg
  BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION categories_depth_check();
```

The trigger fires only on parent_id INSERT/UPDATE (bounded firing). Expected <100 categories — performance is non-issue.

### Zod schema extension — watch exactOptionalPropertyTypes

Because of `exactOptionalPropertyTypes: true` (CLAUDE.md) and `noUncheckedIndexedAccess: true`:
- `parentId: UuidSchema.nullable()` — nullable (explicit `null`) is correct for a nullable DB column.
- Generated Supabase type will have `parent_id: string | null` (from `REFERENCES`). No casting needed.
- Do NOT write `parentId?: UuidSchema` — that produces `parentId?: string` which is incompatible.

### Settings tab pattern (confirmed)

See `src/widgets/SettingsTabsPanel/index.tsx` lines 28-55. Push two new entries inside `if (canManageSettings)` block. Each tab's render callback receives `currentRole` for further `<ProtectedAction action="manage_settings">` gating.

### Feature folder scaffold (mirrored from `features/manage-products/`)

```
src/features/manage-categories/
  ui/
    ManageCategoriesPanel.tsx       # top-level, mounted in SettingsTabsPanel
    CategoryTreeView.tsx            # consumes shared/ui/CategoryTreePicker
    CategoryNodeForm.tsx            # add/edit dialog
  index.ts                           # barrel
```

### Property test pattern (from 5 existing fast-check files)

Example — `src/shared/lib/pool-billing.test.ts` uses `fc.assert(fc.property(arb, predicate))`. Replicate at `src/shared/lib/category-tree.test.ts`:
- Arbitrary: `fc.array(fc.tuple(nodeIdArb, parentIdArbOrNull), { maxLength: 1000 })`
- Property A (depth): applying inserts sequentially, filter to feasible parents, assert `maxDepth(tree) ≤ 3`
- Property B (no cycles): apply moves; assert `isAcyclic(tree)`

**Pure-function target.** Don't hit the DB for the property test — run the logic against a local in-memory tree mirror that implements the same rules. This lets P1 run in Vitest under a second.

### E2E spec boilerplate (from `01-ci.spec.ts`)

```ts
import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { getServiceClient, resetTestState } from './helpers/supabase';

test.describe('Categories — hierarchical CRUD', () => {
  test.beforeEach(async () => { await resetTestState(); });
  test('admin creates root → child → grandchild; depth-3 guard', async ({ page }) => {
    await loginAs(page, 'admin'); // PIN 0000
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Categories/ }).click();
    // ... create flows
  });
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree traversal UI | Custom drag-drop | Zero-dep indented list (locked decision `bar_pos_design` + nav-flows.md) | DnD lib adds 40KB + touch flakiness on Tauri |
| Cycle detection | Application-side recursion | PostgreSQL recursive CTE in trigger | Atomic enforcement, race-free |
| Property test arbitrary | Hand-rolled randomness | `fc.letrec` for recursive structures | Shrinking + reproducibility |
| Settings tab routing | New `/settings/:tab` route | Push into SettingsTabsPanel's `tabs` array | Existing pattern; no router change |
| Modifier-group ↔ product cardinality | Extra join code | `product_modifier_groups` composite PK | DDL-enforced 1:N:M |

## Common Pitfalls

### Pitfall 1: Atomicity of rename (S1-01)

**What goes wrong:** Rename table in migration but forget to update trigger function body, RLS policy, or E2E helper. Staging Supabase breaks silently; queries return 0 rows (permission-denied hidden by RLS).

**Prevention:** The S1-01 commit must include **ALL 16 non-generated sites** listed in the Brownfield Audit. Verify post-rename with:
```bash
grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e
# Expected hits: only the migration file that performs the rename (in comments / DOWN script)
```

### Pitfall 2: CHECK constraint on existing `inventory_log` rows blocks rename

**What goes wrong:** `inventory_log_reason_check` CHECK constraint (from migration 20260422000003) still references the old table name; `ALTER TABLE RENAME` carries constraint name but not content changes. After rename + enum extension, constraint must be dropped+recreated with the new allowed values.

**Prevention:** In S1-01 migration: `ALTER TABLE stock_movements DROP CONSTRAINT inventory_log_reason_check; ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check CHECK (reason IN (...<11 values>...));`

### Pitfall 3: Generated `supabase.types.ts` import path drift

**What goes wrong:** Renaming the table regenerates types as `stock_movements`. Any `TablesInsert<'inventory_log'>` / `Tables<'inventory_log'>` generic arg in `src/entities/inventory/model/queries.ts` (lines 345, 352) becomes a TS error after regen.

**Prevention:** S1-06 (type regen) is sequenced AFTER S1-01..S1-05 migrations. Run `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` once, then search/replace `'inventory_log'` → `'stock_movements'` in queries.ts and usePhysicalCount.ts and usePhysicalCount.test.ts in the SAME commit. Typecheck gate will catch misses.

### Pitfall 4: `exactOptionalPropertyTypes` + nullable supabase column

**What goes wrong:** Generated type is `parent_id: string | null`. If Zod schema uses `z.string().optional()` (no `.nullable()`), TS fails with "property 'parent_id' has type 'string | null' not assignable to 'string | undefined'".

**Prevention:** Always use `UuidSchema.nullable()` for nullable FKs, not `.optional()`. Matches existing pattern in `CategorySchema.happyHourStart: TimeStringSchema.nullable()`.

### Pitfall 5: FK trigger interaction with BEFORE trigger

**What goes wrong:** BEFORE INSERT trigger reads `categories` — but the new row is not yet in the table, so recursive CTE won't traverse through itself. That's fine for depth, but cycle-detect on UPDATE (re-parenting an existing node) must exclude the current row's children from becoming its ancestor.

**Prevention:** The cycle check above walks upward from `NEW.parent_id` and asserts `NEW.id` never appears. Covers both INSERT (trivially — NEW.id isn't in the table yet) and UPDATE (walks only ancestors, which must not include NEW.id).

### Pitfall 6: E2E spec number collision

**What goes wrong:** Creating `e2e/18-categories.spec.ts` when `18-void-order.spec.ts` exists produces duplicate test IDs in reports + confuses `npx playwright test e2e/18-...` globs.

**Prevention:** Rename the new spec to `e2e/31-categories.spec.ts` (next unused number — existing max is 30). Keep ticket-ID text as `S1-13 (spec 18-categories in PRD, renamed 31-categories to avoid collision)`.

### Pitfall 7: `payments.tab_id` DEFAULT-named UNIQUE constraint

**What goes wrong:** `UUID NOT NULL UNIQUE` inline creates a constraint named `payments_tab_id_key` by PostgreSQL convention — not `isOneToOne`. Writing `ALTER TABLE payments DROP CONSTRAINT isOneToOne` fails.

**Prevention:** Use `ALTER TABLE payments DROP CONSTRAINT payments_tab_id_key;` and verify in local DB with `\d payments` or `SELECT conname FROM pg_constraint WHERE conrelid = 'payments'::regclass;` before committing.

## Code Examples

### Migration 1 — stock_movements rename (S1-01)

```sql
-- bar-pos/supabase/migrations/20260424000001_stock_movements.sql
BEGIN;

-- Rename
ALTER TABLE inventory_log RENAME TO stock_movements;
ALTER INDEX idx_inventory_log_product_id RENAME TO idx_stock_movements_product_id;
ALTER INDEX idx_inventory_log_staff_id RENAME TO idx_stock_movements_staff_id;
ALTER INDEX idx_inventory_log_created_at RENAME TO idx_stock_movements_created_at;

-- Drop old CHECK (tied to old name).
ALTER TABLE stock_movements DROP CONSTRAINT inventory_log_reason_check;

-- Add polymorphic ref + ingredient FK column (FK deferred to Phase 3).
ALTER TABLE stock_movements
  ADD COLUMN ref_type text,
  ADD COLUMN ref_id uuid,
  ADD COLUMN ingredient_id uuid NULL;

-- Re-add CHECK with extended enum.
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN (
    'sale','manual_adjustment','waste','delivery','correction','physical_count',
    'prep_production','prep_consumption','combo_component','refund','void'
  )) NOT VALID;

-- Rewrite trigger functions (defined in earlier migrations) to write to stock_movements.
-- ... (carry content from 20260420000007 + 20260422000003 rewritten for new table name)

-- Drop+recreate RLS policies (renamed table keeps row-level enable but policies are name-bound).
DROP POLICY IF EXISTS "inventory_log_select_manager_admin" ON stock_movements;
DROP POLICY IF EXISTS "inventory_log_insert_manager_admin" ON stock_movements;
DROP POLICY IF EXISTS "inventory_log_delete_admin" ON stock_movements;
CREATE POLICY "stock_movements_select_manager_admin" ON stock_movements
  FOR SELECT TO authenticated USING (get_user_role() IN ('manager','admin'));
CREATE POLICY "stock_movements_insert_manager_admin" ON stock_movements
  FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('manager','admin'));
-- Append-only: revoke DELETE from authenticated.
REVOKE DELETE ON stock_movements FROM authenticated;

COMMIT;

-- DOWN
-- BEGIN;
-- ALTER TABLE stock_movements DROP COLUMN ingredient_id, DROP COLUMN ref_id, DROP COLUMN ref_type;
-- ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_reason_check;
-- ALTER TABLE stock_movements ADD CONSTRAINT inventory_log_reason_check
--   CHECK (reason IN ('sale','manual_adjustment','waste','delivery','correction','physical_count')) NOT VALID;
-- ALTER TABLE stock_movements RENAME TO inventory_log;
-- ...rename indexes/policies back...
-- COMMIT;
```

### Migration 2 — categories tree (S1-02)

See DDL in §Architecture Patterns → Depth-3 trigger. Prepend:
```sql
ALTER TABLE categories ADD COLUMN parent_id uuid NULL REFERENCES categories(id) ON DELETE RESTRICT;
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
```

### Migration 3 — modifier_groups trio (S1-03)

Matches DDL in `02-data-model.md § S1` verbatim:
```sql
CREATE TABLE modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_select >= 0 AND max_select >= min_select)
);
CREATE TABLE modifier_group_items (
  group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  modifier_id uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, modifier_id)
);
CREATE TABLE product_modifier_groups (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order int,
  PRIMARY KEY (product_id, group_id)
);
```

### Migration 4 — products flags (S1-04)

```sql
ALTER TABLE products
  ADD COLUMN combo_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN is_combo boolean NOT NULL DEFAULT false;
-- DOWN: ALTER TABLE products DROP COLUMN is_combo, DROP COLUMN combo_eligible;
```

### Migration 5 — payments constraint (S1-05)

```sql
-- Pre-check: confirm constraint name with: SELECT conname FROM pg_constraint WHERE conrelid='payments'::regclass AND conname LIKE '%tab_id%';
ALTER TABLE payments DROP CONSTRAINT payments_tab_id_key;
-- Keep the index (PG drops the implicit unique index with the constraint; re-create non-unique if needed).
CREATE INDEX IF NOT EXISTS idx_payments_tab_id ON payments(tab_id);
-- DOWN: ALTER TABLE payments ADD CONSTRAINT payments_tab_id_key UNIQUE (tab_id);
```
Note: `idx_payments_tab_id` already exists (migration 20260414000006 line 22). Drop-constraint removes the auto-created unique index only; the named non-unique index remains.

### Migration 6 — RLS for new tables (S1-11)

```sql
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated.
CREATE POLICY "modifier_groups_select_all" ON modifier_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "modifier_group_items_select_all" ON modifier_group_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_modifier_groups_select_all" ON product_modifier_groups
  FOR SELECT TO authenticated USING (true);

-- Write: manager + admin (NOT bartender).
CREATE POLICY "modifier_groups_write_manager_admin" ON modifier_groups
  FOR ALL TO authenticated
  USING (get_user_role() IN ('manager','admin'))
  WITH CHECK (get_user_role() IN ('manager','admin'));
-- (repeat pattern for the other two tables)
```

### Zod extension examples (S1-06)

```ts
// src/shared/lib/domain.ts
export const CategorySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(50),
  color: HexColorSchema,
  sortOrder: z.number().int().nonnegative(),
  happyHourStart: TimeStringSchema.nullable(),
  happyHourEnd: TimeStringSchema.nullable(),
  isFood: z.boolean().default(false),
  parentId: UuidSchema.nullable(),   // NEW S1-02
  createdAt: TimestampSchema,
});

export const ProductSchema = z.object({
  // ... existing ...
  comboEligible: z.boolean().default(true),   // NEW S1-04
  isCombo: z.boolean().default(false),         // NEW S1-04
});

export const ModifierGroupSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive(),
  isRequired: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
}).refine(v => v.maxSelect >= v.minSelect, { message: 'maxSelect >= minSelect' });

export const StockMovementSchema = z.object({
  id: UuidSchema,
  productId: UuidSchema,
  quantityDelta: z.number().int(),
  reason: z.enum([
    'sale','manual_adjustment','waste','delivery','correction','physical_count',
    'prep_production','prep_consumption','combo_component','refund','void',
  ]),
  staffId: UuidSchema,
  refType: z.string().nullable(),
  refId: UuidSchema.nullable(),
  ingredientId: UuidSchema.nullable(),
  createdAt: TimestampSchema,
});
export type StockMovement = z.infer<typeof StockMovementSchema>;
```

## State of the Art

| Old | Current | Notes |
|-----|---------|-------|
| Flat `inventory_log` per-product | Unified `stock_movements` with polymorphic ref | Industry-standard (Toast, Lightspeed ledger) |
| Single-payment-per-tab | Multiple payments per tab | Enables sub-tabs (Phase 6) |
| Hand-written TS interfaces | Zod schema → `z.infer` | Project-locked (CLAUDE.md) |

## Open Questions

1. **Should the existing `CatalogCategoriesTab` (flat) coexist with new hierarchical Categories tab?**
   - What we know: Both will live in Settings → two admin sections with different tabs.
   - Recommendation: Keep both in Phase 1 (no scope creep). Flat tab continues to work because `parent_id` is nullable. A future phase can remove the flat tab.

2. **Do we run migrations against staging during Phase 1, or only local?**
   - What we know: DoD says "local + staging clean run".
   - Recommendation: Planner should include a staging-run step in the final plan's verification wave.

3. **Is `ingredient_id` required to have a CHECK that it's NULL until Phase 3?**
   - What we know: PRD says "nullable, FK added in Phase 3". Not gating.
   - Recommendation: No CHECK in Phase 1 — just the NULL default is sufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit/Property | Vitest v4 + fast-check v4 |
| E2E | Playwright v1.59 |
| Unit config | `bar-pos/vitest.config.ts` |
| E2E config | `bar-pos/playwright.config.ts` |
| Quick unit run | `cd bar-pos && npx vitest run src/shared/lib/category-tree.test.ts` |
| Full unit | `cd bar-pos && npm run test` |
| Single E2E | `cd bar-pos && npx playwright test e2e/31-categories.spec.ts` |
| Full E2E | `cd bar-pos && npm run test:e2e` |
| Typecheck gate | `cd bar-pos && npm run typecheck` |
| Lint gate | `cd bar-pos && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| S1-01 | `stock_movements` table exists + accepts extended reasons | integration (psql) | `cd bar-pos && npx supabase db reset && psql $DB -c "SELECT reason FROM stock_movements LIMIT 0;"` | N/A — DB assertion |
| S1-01 | Renames break nothing (smoke) | E2E | `cd bar-pos && npx playwright test e2e/27-inventory-intelligence.spec.ts` (after text-replace to `stock_movements`) | Wave 0 update |
| S1-02 | Depth-3 trigger rejects 4th-level insert | unit (pure fn) | `npx vitest run src/shared/lib/category-tree.test.ts` | Wave 0 create |
| S1-02 | Cycle rejection | unit (pure fn) | same as above | Wave 0 create |
| S1-02 | DB-level enforcement (trigger fires) | E2E | `npx playwright test e2e/31-categories.spec.ts -g "great-grandchild"` | Wave 0 create |
| S1-03 | Modifier group tables queryable | unit (Zod parse) | `npx vitest run src/shared/lib/domain.test.ts` | exists |
| S1-04 | Products have combo flags, default values correct | unit (Zod parse) + E2E toggle | `npx playwright test e2e/31-categories.spec.ts -g "combo_eligible"` | Wave 0 create |
| S1-05 | Two payments can be inserted against the same tab | integration | psql assertion `INSERT INTO payments (tab_id, ...) × 2` | manual gate; optional unit with service-role test client |
| S1-06 | Type regen compiles | typecheck | `npm run typecheck` | gate |
| S1-06 | Zod schemas infer correctly | unit | `npx vitest run src/shared/lib/domain.test.ts` | exists |
| S1-07 | `CategoryTreePicker` renders tree | Storybook + RTL | `npm run storybook` + `npx vitest run src/shared/ui/CategoryTreePicker` | Wave 0 create |
| S1-08 | Settings → Categories visible only to admin | E2E | `npx playwright test e2e/31-categories.spec.ts -g "admin sees Categories tab"` + `e2e/09-rbac.spec.ts` | create + update |
| S1-09 | Settings → Modifier Groups admin-only | E2E | `npx playwright test e2e/31-categories.spec.ts -g "Modifier Groups tab"` | Wave 0 create |
| S1-10 | Import path works from new `@entities/category` | typecheck + lint (FSD boundaries) | `npm run typecheck && npm run lint` | gate |
| S1-11 | Bartender cannot write modifier_groups | E2E | `npx playwright test e2e/31-categories.spec.ts -g "bartender write refused"` | Wave 0 create |
| S1-12 | Random tree depth ≤ 3 invariant | property | `npx vitest run src/shared/lib/category-tree.test.ts -t "P1"` | Wave 0 create |
| S1-13 | Full E2E flow green | E2E | `npx playwright test e2e/31-categories.spec.ts` | Wave 0 create |
| Regression | All 30 existing E2E specs pass | E2E | `npm run test:e2e` | gate |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run lint && npx vitest run <touched test files>`
- **Per wave merge:** `npm run test` (full unit) + `npx supabase db reset` to verify migrations from zero
- **Phase gate:** Full unit suite green + `npm run test:e2e` (30+ specs) + manual Tauri-dev smoke of Settings → Categories + Modifier Groups

### Wave 0 Gaps
- [ ] `src/shared/lib/category-tree.test.ts` — P1 property test + depth/cycle unit tests (S1-12)
- [ ] `src/shared/ui/CategoryTreePicker/index.tsx` + `.stories.tsx` + test (S1-07)
- [ ] `src/entities/category/model/{types,store,queries,index}.ts` (S1-10)
- [ ] `src/features/manage-categories/` scaffold (S1-08)
- [ ] `src/features/manage-modifier-groups/` scaffold (S1-09)
- [ ] `e2e/31-categories.spec.ts` (S1-13 — renamed from `18` due to collision)
- [ ] Update `e2e/27-inventory-intelligence.spec.ts` + `e2e/helpers/supabase.ts` for rename (S1-01)
- [ ] Update `src/entities/inventory/model/queries.ts` + `src/features/physical-count/**` for rename (S1-01)

## Wave Recommendation (for Planner)

Based on locked sequencing constraints and fan-in/fan-out points:

**Wave 0 — Setup (serial, 1 task):**
- Breaking-change audit confirmed (already done in this research); create empty placeholder directories for new features/entities; set up migration timestamps.

**Wave 1 — Database (serial, 5 tasks, MUST run in listed order):**
- S1-01 stock_movements rename (+ atomic update of all 16 non-generated code sites)
- S1-02 categories tree
- S1-03 modifier_groups trio
- S1-04 products flags
- S1-05 payments constraint drop

**Wave 2 — Type fan-in (serial, 1 task, depends on all of Wave 1):**
- S1-06 type regen + Zod schema extension. **BLOCKING** for Wave 3.

**Wave 3 — Code fan-out (parallel, 5 tasks, all depend on Wave 2):**
- S1-07 CategoryTreePicker + story
- S1-08 manage-categories feature + Settings tab wiring
- S1-09 manage-modifier-groups feature + Settings tab wiring
- S1-10 entities/category refactor
- S1-11 RLS migration #6 (can actually run in Wave 1 position 6 if preferred; put here to keep Wave 1 = "additive schema" and Wave 3 = "policy + code" — planner's call)

**Wave 4 — Tests (parallel, 2 tasks, depend on Wave 3):**
- S1-12 P1 property test
- S1-13 E2E spec 31-categories

**Wave 5 — Gate (serial, 1 task):**
- Full regression: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`. Manual Tauri-dev smoke.

## Sources

### Primary (HIGH confidence — verified against codebase files)
- `.planning/phases/01-foundation/01-CONTEXT.md` — all locked decisions
- `.planning/feature-expansion-2026q2/02-data-model.md § S1` — exact DDL target
- `.planning/feature-expansion-2026q2/01-locked-decisions.md` — N1 depth rule
- `.planning/feature-expansion-2026q2/03-testing-strategy.md` — P1 definition
- `.planning/feature-expansion-2026q2/04-navigation-ui-flows.md` — zero-dep tree UI, Settings tabs
- `./CLAUDE.md` — stack versions, TS gotchas, testing commands
- `bar-pos/supabase/migrations/20260414000003_products_and_categories.sql` — current categories/products schema
- `bar-pos/supabase/migrations/20260414000006_payments.sql` — payments schema + UNIQUE constraint location
- `bar-pos/supabase/migrations/20260414000007_inventory.sql` — current inventory_log schema
- `bar-pos/supabase/migrations/20260422000003_add_physical_count_reason.sql` — current reason CHECK
- `bar-pos/supabase/migrations/20260414000009_rls_policies.sql` — RLS pattern
- `bar-pos/src/shared/lib/domain.ts` — current Zod schemas at lines 129, 155, 174, 517
- `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` — Settings tab registration pattern
- `bar-pos/src/features/manage-products/ui/CatalogCategoriesTab.tsx` — existing flat category UI pattern
- `bar-pos/src/entities/inventory/model/queries.ts` — existing ledger write pattern
- Grep-verified brownfield: 16 non-generated `inventory_log` refs, 29 `isOneToOne` (all generated metadata)

### Secondary (MEDIUM — inferred from pattern matching)
- `src/shared/lib/pool-billing.test.ts` + 4 others — fast-check idiom
- `e2e/01-ci.spec.ts`, `e2e/helpers/auth.ts` — E2E login helper
- Existing Storybook `.stories.tsx` (ColorPalette, Spacing, Typography, Button) — story pattern

### Tertiary (LOW — not used; training-data only, no assertions made on it)
- None. All claims grounded in files read during this research.

## Metadata

**Confidence breakdown:**
- Brownfield audit: **HIGH** — grep-verified, every site enumerated
- Migration DDL: **HIGH** — matches `02-data-model.md` verbatim; constraint names confirmed from source
- FSD placement: **HIGH** — existing folder patterns inspected
- Trigger implementation: **MEDIUM** — pattern is idiomatic PL/pgSQL but not executed against DB during research; planner should instruct executor to run `npx supabase db reset` locally as first verification
- Spec-number collision resolution: **HIGH** — existing E2E files enumerated (max 30)

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30-day stable window — brownfield codebase changes could invalidate grep counts earlier)
