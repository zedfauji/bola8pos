---
phase: 17-modifier-inventory-rules
plan: 02
subsystem: database
tags: [postgres, plpgsql, supabase, rls, inventory, modifiers]

# Dependency graph
requires:
  - phase: 04-recipes-and-sale-depletion
    provides: "recipe_items table + RLS pattern, record_stock_movement RPC, stock_movements idempotency index, deplete_for_order_item base body"
  - phase: 13-rpc-role-guards
    provides: "deplete_for_order_item kitchen-forbidden role guard (current authoritative body)"
provides:
  - "modifier_inventory_rules table (modifier_id, ingredient_id, signed delta) with RLS mirroring recipe_items"
  - "deplete_for_order_item v3: modifier-driven depletion loop that fires independently of whether the product has a base recipe"
affects: [17-03-push-and-verify, 17-04-integration-tests, entities/modifier-inventory-rule, features/manage-modifier-inventory-rules]

# Tech tracking
tech-stack:
  added: []
  patterns: ["distinct ref_type per depletion source to avoid stock_movements idempotency-index collisions", "IF FOUND wrapper to make one depletion loop optional without early-returning the whole RPC"]

key-files:
  created:
    - supabase/migrations/20260706000002_modifier_inventory_rules_table.sql
    - supabase/migrations/20260706000003_deplete_for_order_item_v3.sql
  modified: []

key-decisions:
  - "Based the v3 rewrite on 20260510000002_rpc_role_guards.sql's body (the current live definition), not the stale 20260428000004_v2 file, to preserve the kitchen role guard (Pitfall 1 from research)."
  - "Used ref_type='order_item_modifier' (distinct from the recipe loop's 'order_item') for modifier-driven stock_movements rows so the (ref_type, ref_id, ingredient_id) partial unique index never collides even when the same ingredient appears in both loops for the same order_item."
  - "Recipe lookup's function-wide early RETURN replaced with an IF FOUND wrapper scoped to only the recipe loop, so the new modifier loop always runs regardless of recipe existence (D-04)."
  - "modifier_inventory_rules.delta uses CHECK (delta <> 0) (signed, not positive-only) to support both 'extra X' (positive) and 'no X' (negative) rules in one shape (D-02)."

patterns-established:
  - "Modifier loop delta formula: v_mod_delta := -p_direction::numeric * v_qty::numeric * v_mod_item.delta — no yield_qty divisor (delta is absolute-per-line, unlike recipe qty which divides by yield_qty)."

requirements-completed: [SC-1, SC-2, SC-4]

# Metrics
duration: 15min
completed: 2026-07-06
---

# Phase 17 Plan 02: Modifier Inventory Rules — Backend Migrations Summary

**Authored two SQL migrations: `modifier_inventory_rules` join table + RLS, and a v3 rewrite of `deplete_for_order_item` that adds a modifier-driven depletion loop alongside the existing recipe loop, tagged with a distinct `ref_type` to avoid idempotency-index collisions.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- `modifier_inventory_rules` table created: `(id, modifier_id → modifiers ON DELETE CASCADE, ingredient_id → ingredients, delta numeric CHECK (delta <> 0), UNIQUE(modifier_id, ingredient_id))`, with RLS policies `modifier_inventory_rules_select_authenticated` (read all authenticated) and `modifier_inventory_rules_write_manager` (write manager/admin only).
- `deplete_for_order_item(uuid, smallint, boolean)` rewritten (v3): recipe loop preserved verbatim but wrapped in `IF FOUND` (no longer function-wide early return), plus a new modifier loop reading `order_items.modifier_ids` against `modifier_inventory_rules`, scaled by order quantity with no yield-qty divisor, writing to `stock_movements` with `ref_type='order_item_modifier'`.
- Both loops share the identical `p_allow_negative` bypass + `audit_log 'stock_override'` insert pattern (D-05); kitchen role guard and trailing `GRANT EXECUTE` preserved unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create modifier_inventory_rules table migration + RLS** - `0a64013` (feat)
2. **Task 2: Create deplete_for_order_item v3 migration (add modifier loop)** - `829c869` (feat)

## Files Created/Modified
- `supabase/migrations/20260706000002_modifier_inventory_rules_table.sql` - New join table + RLS mirroring `recipe_items`, signed delta, `(modifier_id, ingredient_id)` unique key.
- `supabase/migrations/20260706000003_deplete_for_order_item_v3.sql` - `CREATE OR REPLACE FUNCTION deplete_for_order_item` v3: recipe loop conditional on `IF FOUND`, new modifier loop with distinct `ref_type`, shared override/audit path, kitchen guard preserved.

## Decisions Made
- Based the v3 function body on `20260510000002_rpc_role_guards.sql` §3 (the current live definition confirmed by research as having no later redefinition), not the stale `20260428000004_v2` file, to avoid silently regressing the kitchen role guard.
- Adjusted the modifier-loop SQL query to keep `FROM modifier_inventory_rules WHERE modifier_id = ANY(...)` on a single line so the task's automated grep verification gate (which checks for this exact substring) passes — a formatting-only adjustment with no semantic difference from the initially-drafted multi-line version.
- No `notes` column added to `modifier_inventory_rules` (per research's resolved Open Question 1 — omitted, can be added later if requested).

## Deviations from Plan

None — plan executed exactly as written. The single-line SQL formatting adjustment noted above was made during initial drafting to satisfy the plan's own verification gate, not a deviation from the plan's intent.

## Issues Encountered

Initial draft of the modifier-loop query split `FROM modifier_inventory_rules` and `WHERE modifier_id = ANY(...)` across two lines for readability, which caused the Task 2 automated verify grep (`modifier_inventory_rules WHERE modifier_id = ANY`) to report a count of 3 instead of the required >=4 (since `grep -c` counts matching lines, not occurrences, and the pattern spans what were two lines). Fixed by collapsing the query onto one line; verification then passed (count 4).

## User Setup Required

None. These migrations are files-only in this plan — they are NOT pushed to the remote Supabase project here. Push is the blocking gate in plan 17-03.

## Next Phase Readiness

Both migration files are authored, pass all task-level grep/source-assertion gates, and are ready for plan 17-03 to push them to the remote Supabase project and verify them live (table exists, RPC applies modifier deltas). No blockers. Plan 17-04's integration tests and any frontend feature work (entity/feature slices for the admin editor UI) can proceed once 17-03 confirms the migrations apply cleanly against the live schema.

---
*Phase: 17-modifier-inventory-rules*
*Completed: 2026-07-06*
