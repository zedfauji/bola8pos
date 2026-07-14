---
phase: 03-ingredient-foundation
plan: "01"
subsystem: database
tags: [sql, migrations, supabase, plpgsql, rls, ingredients, stock-movements]
dependency_graph:
  requires: []
  provides:
    - ingredients table (S3a-01)
    - stock_movements idempotency index (S3a-02)
    - record_stock_movement RPC (S3a-03)
  affects:
    - bar-pos/supabase/migrations/
    - All downstream ingredient entity hooks (plans 03-02, 03-03)
    - All stock movement recording features (plans 03-04, 03-05)
tech_stack:
  added: []
  patterns:
    - PL/pgSQL SECURITY DEFINER RPC with SELECT FOR UPDATE row-lock
    - Partial UNIQUE index for idempotency on depletion reasons
    - RLS: SELECT for authenticated, INSERT/UPDATE/DELETE for manager/admin
key_files:
  created:
    - bar-pos/supabase/migrations/20260426000001_ingredients_table.sql
    - bar-pos/supabase/migrations/20260426000002_stock_movements_idempotency_index.sql
    - bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql
  modified: []
decisions:
  - p_notes parameter added to record_stock_movement RPC (from 03-01 PLAN fix — p_notes text DEFAULT NULL for manual adjustment notes)
  - staff_id captured via auth.uid() inside SECURITY DEFINER RPC for full audit trail
  - correction and physical_count reasons bypass INVENTORY_NEGATIVE guard by design
  - case_24 excluded from base uom CHECK (purchase-only unit); allowed in purchase_uom CHECK
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 0
requirements:
  - S3a-01
  - S3a-02
  - S3a-03
---

# Phase 3 Plan 01: DB Migrations — Ingredients Foundation Summary

Three SQL migration files created for the ingredient database foundation: ingredients table DDL with full constraints and RLS, idempotency index on stock_movements, and the record_stock_movement PL/pgSQL RPC with row-lock, negative guard, and audit trail.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migration 1: ingredients table + indexes + RLS | 2937be1 | bar-pos/supabase/migrations/20260426000001_ingredients_table.sql |
| 2 | Migration 2: stock_movements idempotency index | 8b63ee4 | bar-pos/supabase/migrations/20260426000002_stock_movements_idempotency_index.sql |
| 3 | Migration 3: record_stock_movement PL/pgSQL RPC | f26d47a | bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql |
| 4 | Push schema to remote Supabase | confirmed | Human confirmed: `supabase db push` applied all 3 migrations |

## What Was Built

### Migration 1: `20260426000001_ingredients_table.sql`

- `ingredients` table with 13 columns
- CHECK constraints: `uom` enum (6 base values), `purchase_uom` enum (7 values incl. `case_24`), `purchase_to_base_factor > 0`, `cost_per_base_unit >= 0`
- 3 indexes: `idx_ingredients_name`, `idx_ingredients_is_active`, `idx_ingredients_is_prep`
- RLS enabled: SELECT for all authenticated users; ALL for manager/admin only
- `is_prep` column informational only in Phase 3 (Phase 5 adds enforcement trigger)

### Migration 2: `20260426000002_stock_movements_idempotency_index.sql`

- Partial UNIQUE index `idx_stock_movements_idempotency` on `stock_movements (ref_type, ref_id, ingredient_id)`
- WHERE clause covers exactly 5 depletion reasons: `sale`, `refund`, `void`, `prep_production`, `prep_consumption`
- Manual adjustment reasons (`waste`, `delivery`, `correction`, `physical_count`) intentionally excluded
- NULL `ingredient_id` values not constrained (NULLs not equal in UNIQUE indexes — by design)

### Migration 3: `20260426000003_record_stock_movement_rpc.sql`

- `record_stock_movement(uuid, numeric, text, text, uuid, text)` — 6-arg signature incl. `p_notes`
- SECURITY DEFINER + `SET search_path = public`
- `auth.uid()` captured as `v_staff_id` for full audit trail on `stock_movements.staff_id`
- `SELECT quantity_on_hand ... FOR UPDATE` row-lock prevents concurrent quantity drift
- `INGREDIENT_NOT_FOUND` exception when ingredient ID does not exist
- `INVENTORY_NEGATIVE` exception when delta would drive qty < 0 (bypass for `correction` and `physical_count`)
- `INSERT stock_movements RETURNING * INTO v_row` — full row returned to caller
- `UPDATE ingredients SET quantity_on_hand = v_new, updated_at = now()` — atomic in same transaction
- `GRANT EXECUTE` to `authenticated` role

## Deviations from Plan

### Auto-applied improvements (consistent with plan revision)

**1. [Rule 2 - Pre-existing plan fix] p_notes parameter in record_stock_movement**
- The PLAN.md was already updated (in commit 6c68537) to include `p_notes text DEFAULT NULL` in the RPC signature
- The RPC implementation correctly includes this parameter
- Files modified: `20260426000003_record_stock_movement_rpc.sql`
- No deviation from the current plan specification

None — plan executed exactly as written in the updated plan file.

## Schema Push: Complete

Task 4 (`supabase db push`) was confirmed complete by the human operator. All three migrations were applied to the remote Supabase project:

- `20260426000001_ingredients_table.sql` — applied
- `20260426000002_stock_movements_idempotency_index.sql` — applied
- `20260426000003_record_stock_movement_rpc.sql` — applied

The `ingredients` table is queryable and the `record_stock_movement` RPC is callable by authenticated users.

## Threat Surface Scan

All threat mitigations from the plan's threat model are implemented:

| Threat ID | Mitigation | Implemented |
|-----------|-----------|-------------|
| T-03-01 | INVENTORY_NEGATIVE guard in RPC | Yes — line: `RAISE EXCEPTION 'INVENTORY_NEGATIVE: ...'` |
| T-03-02 | Partial UNIQUE index on (ref_type, ref_id, ingredient_id) | Yes — Migration 2 |
| T-03-03 | RLS INSERT/UPDATE/DELETE requires manager/admin | Yes — `manager_admin_write_ingredients` policy |
| T-03-04 | SELECT accepted for all authenticated (low sensitivity) | Yes — `all_auth_select_ingredients` policy |

No new threat surface beyond what the plan's threat model covers.

## Known Stubs

None — this plan creates SQL migration files only; no UI stubs or placeholder data.

## Self-Check: PASSED

- `bar-pos/supabase/migrations/20260426000001_ingredients_table.sql`: FOUND on disk
- `bar-pos/supabase/migrations/20260426000002_stock_movements_idempotency_index.sql`: FOUND on disk
- `bar-pos/supabase/migrations/20260426000003_record_stock_movement_rpc.sql`: FOUND on disk
- Commits 2937be1, 8b63ee4, f26d47a, a653b64: FOUND in git log (all branches)
- Task 4 (supabase db push): CONFIRMED by human operator
- All 4/4 tasks complete
