---
phase: 05-kitchen-prep-cocktails
plan: 01
subsystem: database
tags: [migrations, schema, prep-productions, recipes, supabase-types]
dependency_graph:
  requires: []
  provides:
    - prep_productions DB table (DDL + RLS + indexes)
    - recipes.prep_ingredient_id FK column + partial unique indexes
    - recipes_exactly_one_owner CHECK constraint
    - trg_prep_production_insert trigger (AFTER INSERT, SECURITY DEFINER)
    - TypeScript types for prep_productions in supabase.types.ts
  affects:
    - bar-pos/src/shared/lib/supabase.types.ts
tech_stack:
  added: []
  patterns:
    - SQL migration idempotency (IF NOT EXISTS / OR REPLACE guards)
    - SECURITY DEFINER trigger for cross-table writes
    - Manual type transcription (Docker unavailable pattern)
key_files:
  created:
    - bar-pos/supabase/migrations/20260429000001_prep_productions_table.sql
    - bar-pos/supabase/migrations/20260429000002_recipes_prep_extension.sql
    - bar-pos/supabase/migrations/20260429000003_prep_productions_trigger.sql
  modified:
    - bar-pos/src/shared/lib/supabase.types.ts
decisions:
  - prep_productions is append-only ledger (no UPDATE/DELETE RLS policies)
  - trigger fn_prep_production_insert is SECURITY DEFINER to call record_stock_movement
  - recipes.product_id made nullable; CHECK constraint enforces exactly-one-owner semantics
  - Manual type transcription used (Docker unavailable); regenerate when Docker available
metrics:
  duration: ~20min (2 sessions: Task 1+2 in session 1, Task 3 in session 2)
  completed_date: "2026-04-25T17:35:15Z"
  tasks_completed: 3
  files_modified: 4
---

# Phase 05 Plan 01: DB Migrations + Types Summary

**One-liner:** 3 SQL migrations adding prep_productions table + recipes extension + stock-movement trigger, with manual TypeScript type transcription.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write 3 SQL migration files | a611392 | 3 migration files |
| 2 | [BLOCKING] Apply migrations to remote DB | — (human action) | — |
| 3 | Transcribe new types into supabase.types.ts | 98cb6a1 | supabase.types.ts |

## What Was Built

**Migration 1 — prep_productions table:**
- `prep_productions` table: `id`, `prep_ingredient_id` (FK ingredients), `qty_produced`, `notes`, `produced_by` (FK profiles), `created_at`
- RLS: authenticated SELECT (all), INSERT restricted to manager/admin/kitchen roles
- Indexes on `prep_ingredient_id` and `created_at DESC`

**Migration 2 — recipes extension:**
- `product_id` made nullable (was NOT NULL)
- `prep_ingredient_id uuid` column added with FK to ingredients ON DELETE CASCADE
- Partial unique indexes on each owner column (NULL-safe)
- `recipes_exactly_one_owner` CHECK constraint: exactly one of product_id or prep_ingredient_id must be non-null

**Migration 3 — trigger:**
- `fn_prep_production_insert()` SECURITY DEFINER trigger function
- Validates is_prep = true on target ingredient
- Credits prep ingredient via `record_stock_movement(..., 'prep_production', ...)`
- Looks up recipe and debits each raw ingredient via `record_stock_movement(..., 'prep_consumption', ...)`
- Handles idempotency via EXCEPTION WHEN unique_violation

**supabase.types.ts:**
- `prep_productions` Row/Insert/Update types added (manual transcription)
- `recipes.prep_ingredient_id` was already present from Phase 04 work

## Deviations from Plan

### Notes

**prep_ingredient_id already in recipes type**
- Task 3 Step 2 (update recipes type) was already complete from Phase 04 prior session
- supabase.types.ts already had `prep_ingredient_id: string | null` in recipes Row/Insert/Update
- Only `prep_productions` table type needed to be added

**prep_productions already partially transcribed**
- A prior session had already added `prep_productions` at line 888 of supabase.types.ts
- Task 3 would have created a duplicate; duplicate was detected and removed
- Final state: single correct entry at line 888

## Known Stubs

None — this plan creates DB schema and types only. No UI stubs.

## Threat Flags

No new network endpoints or auth paths introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] Migration files exist: 20260429000001, 20260429000002, 20260429000003
- [x] prep_productions type in supabase.types.ts (grep returns 3 lines)
- [x] recipes.prep_ingredient_id in supabase.types.ts
- [x] Commit a611392 exists (Task 1)
- [x] Commit 98cb6a1 exists (Task 3)
- [x] npm run typecheck exits 0
