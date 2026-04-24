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
decisions:
  - "audit_log canonical columns confirmed from add_combo_to_tab INSERT: action, entity_type, entity_id, details, created_at — actor_id added as nullable (not in original INSERT)"
  - "deplete_for_order_item v1 takes (uuid, smallint); v2 with p_allow_negative comes in migration 004 as planned"
  - "No BEGIN/COMMIT wrapper on migration 002 — deplete_for_order_item uses CREATE OR REPLACE (idempotent); migration 001 wraps in BEGIN/COMMIT"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-24"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
---

# Phase 04 Plan 01: DB Migrations — Recipes Tables + deplete_for_order_item RPC Summary

Two SQL migration files written and committed. Pending human-run `supabase db push` to apply to remote DB (Task 3 checkpoint).

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

Confirmed by reading `add_combo_to_tab`'s INSERT (line 66):
```sql
INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
```
Migration schema matches exactly. `actor_id` column is nullable and absent from existing INSERT — no migration needed for `add_combo_to_tab` when audit_log goes live.

## Checkpoint Status

Task 3 is a blocking human checkpoint — requires:
```bash
cd bar-pos
npx supabase db push
```
Expected output: both `20260428000001` and `20260428000002` show "applied" in `npx supabase migration list`.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints. RLS policies align with threat model:
- T-04-01: manager/admin-only write RLS on recipes + recipe_items ✓
- T-04-02: `CHECK (qty > 0)` on recipe_items.qty ✓
- T-04-04: SECURITY DEFINER on deplete_for_order_item; audit_log INSERT inaccessible to client ✓
- T-04-05: `record_stock_movement` uses SELECT FOR UPDATE; inherited by deplete_for_order_item ✓

## Self-Check

Files created:
- bar-pos/supabase/migrations/20260428000001_recipes_tables.sql — FOUND
- bar-pos/supabase/migrations/20260428000002_deplete_for_order_item.sql — FOUND

Commits:
- 5a5733d (feat(04-01): migration 20260428000001) — FOUND
- 4919965 (feat(04-01): migration 20260428000002) — FOUND

## Self-Check: PASSED
