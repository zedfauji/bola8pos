---
phase: 02-combos
plan: "01"
subsystem: database / shared
tags:
  - migrations
  - sql
  - combo-schema
  - error-codes
  - shadcn
dependency_graph:
  requires:
    - 01-foundation/02 (stock_movements, categories_tree, modifier_groups, product_combo_flags migrations)
  provides:
    - combo_slots table
    - combo_slot_options table
    - combo_availability table
    - order_items.parent_order_item_id + combo_slot_id columns
    - pool_sessions.prepaid_minutes + source_order_item_id columns
    - products.combo_price_override column
    - is_combo_available(uuid, timestamptz) PL/pgSQL function
    - NESTED_COMBO_FORBIDDEN trigger
    - INVALID_CHILD trigger
    - product_combo_usage view
    - AppErrorCode: COMBO_UNAVAILABLE, SLOT_MIN_MAX_VIOLATION, INVALID_CHILD, NESTED_COMBO_FORBIDDEN
    - src/shared/ui/collapsible.tsx
  affects:
    - 02-02 (Zod schemas reference combo tables)
    - 02-03 (entity/combo/ model reads combo_slots, combo_slot_options, combo_availability)
    - 02-04 (add-combo-to-tab feature uses error codes)
    - 02-05 (RPC migration uses combo_slots FK)
    - 02-06 (KDS uses parent_order_item_id column)
    - 02-07 (manage-combos uses combo tables)
    - 02-08 (E2E spec tests combo tables exist)
tech_stack:
  added:
    - "@radix-ui/react-collapsible (via shadcn collapsible)"
  patterns:
    - BEGIN/COMMIT + DOWN block SQL migration pattern
    - BEFORE INSERT OR UPDATE PL/pgSQL trigger pattern
    - STABLE SECURITY DEFINER PL/pgSQL function
    - RLS with auth.jwt() role check (manager+admin write gate)
key_files:
  created:
    - bar-pos/supabase/migrations/20260425000001_combo_schema.sql
    - bar-pos/supabase/migrations/20260425000002_combo_columns.sql
    - bar-pos/supabase/migrations/20260425000003_combo_triggers.sql
    - bar-pos/supabase/migrations/20260425000004_combo_view.sql
    - bar-pos/src/shared/ui/collapsible.tsx
  modified:
    - bar-pos/src/shared/lib/result.ts
decisions:
  - "shadcn CLI placed collapsible.tsx in src/app/components/ui/ (wrong); moved to src/shared/ui/ to match FSD and existing shadcn component location"
  - "Added indexes on combo_slots, combo_slot_options, combo_availability FKs for query performance (not in plan spec but Rule 2 - correctness)"
  - "Added indexes on order_items.parent_order_item_id and combo_slot_id with partial WHERE NOT NULL for efficient child lookups"
metrics:
  duration: "4min"
  completed_date: "2026-04-23"
  tasks: 2
  files: 6
---

# Phase 02 Plan 01: Combo Schema Foundations Summary

Four SQL migration files, AppErrorCode extension, and shadcn Collapsible component — DB schema foundations for the entire combos feature phase.

## What Was Built

**Task 1: Four SQL migrations**

- `20260425000001_combo_schema.sql` — three new tables (`combo_slots`, `combo_slot_options`, `combo_availability`) with RLS policies restricting writes to manager/admin via `auth.jwt() ->> 'role'` check; all authenticated users can SELECT
- `20260425000002_combo_columns.sql` — column extensions: `order_items.parent_order_item_id` (self-referential FK for parent/child combo items), `order_items.combo_slot_id` (FK to combo_slots), `pool_sessions.prepaid_minutes` (integer default 0), `pool_sessions.source_order_item_id` (FK to order_items), `products.combo_price_override` (nullable numeric — null means sum of children)
- `20260425000003_combo_triggers.sql` — two BEFORE INSERT OR UPDATE triggers on `combo_slot_options`: `trg_combo_slot_option_no_nesting` (raises NESTED_COMBO_FORBIDDEN if child is_combo=true) and `trg_combo_slot_option_eligible` (raises INVALID_CHILD if child combo_eligible=false); also `is_combo_available(uuid, timestamptz)` PL/pgSQL STABLE SECURITY DEFINER function using America/Mexico_City timezone
- `20260425000004_combo_view.sql` — `product_combo_usage` reporting view joining order_items, products, orders, tabs; filters to top-level combo parent items only

**Task 2: TypeScript + shadcn**

- `result.ts` — AppErrorCode union extended with COMBO_UNAVAILABLE, SLOT_MIN_MAX_VIOLATION, INVALID_CHILD, NESTED_COMBO_FORBIDDEN (inserted before SUPABASE_ERROR, after POOL_TABLE_OCCUPIED)
- `collapsible.tsx` — shadcn Collapsible component installed at `src/shared/ui/collapsible.tsx` (correct FSD location); exports Collapsible, CollapsibleTrigger, CollapsibleContent from Radix UI

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 009a829 | feat(02-01): add combo schema migrations — tables, column extensions, triggers, view |
| 2 | d94b22f | feat(02-01): extend AppErrorCode with combo error codes; install shadcn Collapsible |

## Deviations from Plan

### Auto-added Improvements

**1. [Rule 2 - Missing Performance] Added FK indexes to all new tables**
- **Found during:** Task 1
- **Issue:** Plan spec did not include indexes on FK columns in combo_slots, combo_slot_options, combo_availability; queries joining via FK would do full table scans
- **Fix:** Added `idx_combo_slots_combo_product_id`, `idx_combo_slot_options_combo_slot_id`, `idx_combo_slot_options_child_product_id`, `idx_combo_availability_combo_product_id`; also added partial indexes on `order_items.parent_order_item_id` and `order_items.combo_slot_id` (WHERE NOT NULL)
- **Files modified:** 20260425000001_combo_schema.sql, 20260425000002_combo_columns.sql
- **Commit:** 009a829

**2. [Rule 1 - Wrong Location] shadcn CLI installed collapsible to wrong FSD layer**
- **Found during:** Task 2 — CLI created `src/app/components/ui/collapsible.tsx` instead of `src/shared/ui/collapsible.tsx`
- **Issue:** `app/` layer is above `shared/` in FSD; components imported from `app/` by features/entities/widgets would violate FSD import boundary and fail lint
- **Fix:** Moved file to `src/shared/ui/collapsible.tsx` (matching all other shadcn components); removed incorrectly placed file
- **Files modified:** src/shared/ui/collapsible.tsx (created at correct path)
- **Commit:** d94b22f

## Known Stubs

None — this plan produces SQL migrations and TypeScript type extensions. No UI stubs or placeholder data.

## Threat Flags

No new threat surface beyond what the plan's threat model documented. All three mitigations from the STRIDE register are implemented:
- T-2-01-01: `trg_combo_slot_option_no_nesting` trigger fires BEFORE INSERT OR UPDATE
- T-2-01-02: `trg_combo_slot_option_eligible` trigger fires BEFORE INSERT OR UPDATE
- T-2-01-03: RLS restricts ALL mutations on combo tables to role IN ('manager', 'admin')

## Self-Check: PASSED

- [x] `bar-pos/supabase/migrations/20260425000001_combo_schema.sql` exists
- [x] `bar-pos/supabase/migrations/20260425000002_combo_columns.sql` exists
- [x] `bar-pos/supabase/migrations/20260425000003_combo_triggers.sql` exists
- [x] `bar-pos/supabase/migrations/20260425000004_combo_view.sql` exists
- [x] `bar-pos/src/shared/ui/collapsible.tsx` exists with 3 exports
- [x] `bar-pos/src/shared/lib/result.ts` has all 4 combo error codes
- [x] `cd bar-pos && npm run typecheck` — exit 0
- [x] `cd bar-pos && npm run lint` — exit 0 (0 warnings from our code)
- [x] Commits 009a829 and d94b22f exist in bar-pos git log
