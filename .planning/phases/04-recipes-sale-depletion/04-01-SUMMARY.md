---
phase: "04"
plan: "04-01"
subsystem: "DB migrations — recipes + depletion RPC"
tags: [sql, migrations, rls, rpc, audit-log, recipes]
dependency_graph:
  requires: [03-ingredient-foundation]
  provides: [recipes table, recipe_items table, audit_log table, deplete_for_order_item RPC]
  affects: [04-02-types-zod, 04-03-manage-recipes-ui, 04-04-sale-depletion-hook]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER RPC, RLS with get_user_role(), SELECT FOR UPDATE via record_stock_movement]
key_files:
  created:
    - bar-pos/supabase/migrations/20260428000001_recipes_tables.sql
    - bar-pos/supabase/migrations/20260428000002_deplete_for_order_item.sql
  modified: []
key-decisions:
  - "audit_log canonical columns confirmed from add_combo_to_tab INSERT: action, entity_type, entity_id, details, created_at — actor_id added as nullable"
  - "deplete_for_order_item v1 takes (uuid, smallint); v2 with p_allow_negative comes in migration 004 as planned"
  - "No BEGIN/COMMIT wrapper on migration 002 — deplete_for_order_item uses CREATE OR REPLACE (idempotent); migration 001 wraps in BEGIN/COMMIT"
requirements-completed: [S3b-01, S3b-02]
metrics:
  duration: "~30 minutes (including human checkpoint)"
  completed: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
---

# Phase 04 Plan 01: DB Migrations — Recipes Tables + deplete_for_order_item RPC Summary

**recipes + recipe_items + audit_log tables and deplete_for_order_item(uuid, smallint) RPC applied to remote DB; audit_log canonical columns confirmed from add_combo_to_tab**

## Performance

- **Duration:** ~30 minutes (including human checkpoint for supabase db push)
- **Started:** 2026-04-24
- **Completed:** 2026-04-24
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- Two SQL migration files written and applied to remote Supabase DB
- audit_log column names confirmed from add_combo_to_tab INSERT (action, entity_type, entity_id, details, created_at) — schema matches exactly, actor_id added as nullable
- deplete_for_order_item RPC callable from authenticated client: resolves order_item → product → recipe → depletes each ingredient via record_stock_movement
- All STRIDE threat mitigations in place: RLS manager/admin write, CHECK (qty > 0), SECURITY DEFINER audit trail, SELECT FOR UPDATE concurrency safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 20260428000001 — recipes, recipe_items, audit_log tables** - `5a5733d` (feat)
2. **Task 2: Write migration 20260428000002 — deplete_for_order_item RPC** - `4919965` (feat)
3. **Task 3: [BLOCKING] Apply migrations 001 + 002** - human checkpoint; both migrations confirmed "applied" by user

**Plan metadata:** `f37a397` (docs: SUMMARY.md + STATE.md, prior checkpoint commit, now updated)

## Files Created/Modified

- `bar-pos/supabase/migrations/20260428000001_recipes_tables.sql` — recipes, recipe_items, audit_log tables with RLS policies
- `bar-pos/supabase/migrations/20260428000002_deplete_for_order_item.sql` — SECURITY DEFINER depletion RPC, GRANT EXECUTE to authenticated

## What Was Built

### Migration 1: `20260428000001_recipes_tables.sql`

Three tables created:

**recipes** — links a product to its recipe with yield_qty scaling:
- `product_id UNIQUE REFERENCES products(id)` — one recipe per product
- `yield_qty numeric DEFAULT 1 CHECK (yield_qty > 0)` — supports scaled recipes
- RLS: authenticated SELECT; manager/admin INSERT/UPDATE/DELETE

**recipe_items** — individual ingredient quantities within a recipe:
- `qty numeric CHECK (qty > 0)` — T-04-02 DB-level guard
- `UNIQUE (recipe_id, ingredient_id)` — prevents duplicate ingredient entries
- RLS: authenticated SELECT; manager/admin write

**audit_log** — canonical columns confirmed from `add_combo_to_tab` INSERT:
```sql
action, entity_type, entity_id, details, created_at  -- canonical
actor_id (nullable)                                    -- added, not in original INSERT
```
- RLS: authenticated INSERT (SECURITY DEFINER functions insert here); manager/admin SELECT

Also: `update_recipes_updated_at()` trigger on recipes table.

### Migration 2: `20260428000002_deplete_for_order_item.sql`

`deplete_for_order_item(p_order_item_id uuid, p_direction smallint) RETURNS void`:
- SECURITY DEFINER, `SET search_path = public`
- `p_direction = +1` → sale (subtract stock), `-1` → refund/void (add back)
- Resolves `order_items.product_id` → looks up `recipes` → iterates `recipe_items`
- No recipe found → early return (no depletion for beer, water, etc.)
- Calls `record_stock_movement(ingredient_id, delta, reason, 'order_item', p_order_item_id, NULL)` per ingredient
- `delta = -direction × order_qty × ingredient_qty / yield_qty`
- `INVENTORY_NEGATIVE` propagates up → transaction rollback on sale direction
- `23505 unique_violation` propagates up → caller handles as idempotent no-op
- `GRANT EXECUTE TO authenticated`

## Audit_log Column Confirmation

Confirmed by reading `add_combo_to_tab`'s INSERT:
```sql
INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
```
Migration schema matches exactly. `actor_id` column is nullable and absent from existing INSERT — no migration needed for `add_combo_to_tab` when audit_log goes live.

## Migration Application Verification

User confirmed both migrations applied to remote DB:
- `20260428000001_recipes_tables.sql` — applied
- `20260428000002_deplete_for_order_item.sql` — applied

Both show "applied" status in `npx supabase migration list`.

## Decisions Made

- audit_log canonical columns from add_combo_to_tab INSERT: action, entity_type, entity_id, details, created_at; actor_id added as nullable
- deplete_for_order_item v1 takes (uuid, smallint); v2 with p_allow_negative in migration 004
- No BEGIN/COMMIT wrapper on migration 002 — CREATE OR REPLACE is idempotent; migration 001 wraps in BEGIN/COMMIT

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints. RLS policies align with threat model:
- T-04-01: manager/admin-only write RLS on recipes + recipe_items
- T-04-02: `CHECK (qty > 0)` on recipe_items.qty
- T-04-04: SECURITY DEFINER on deplete_for_order_item; audit_log INSERT inaccessible to client
- T-04-05: `record_stock_movement` uses SELECT FOR UPDATE; inherited by deplete_for_order_item

## Next Phase Readiness

- Plan 04-02 can now extend domain.ts with RecipeSchema, RecipeItemSchema Zod types
- deplete_for_order_item(uuid, smallint) is callable from authenticated client
- audit_log table is live — add_combo_to_tab's EXCEPTION WHEN undefined_table guard will auto-activate and start writing audit rows (expected behavior, documented in decisions)

## Self-Check

Files created:
- bar-pos/supabase/migrations/20260428000001_recipes_tables.sql — FOUND
- bar-pos/supabase/migrations/20260428000002_deplete_for_order_item.sql — FOUND

Commits:
- 5a5733d (feat(04-01): migration 20260428000001) — FOUND
- 4919965 (feat(04-01): migration 20260428000002) — FOUND

Remote DB: both migrations confirmed applied by user (2026-04-24)

## Self-Check: PASSED
