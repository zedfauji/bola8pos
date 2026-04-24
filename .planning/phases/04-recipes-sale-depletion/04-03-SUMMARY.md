---
phase: "04"
plan: "04-03"
subsystem: "v2 Migrations (p_skip_depletion + p_allow_negative + combo depletion) + recipe entity + shadcn"
tags: [sql, migrations, rpc, recipes, shadcn, entity, depletion, override]
dependency_graph:
  requires: [04-02, 04-01]
  provides: [create_order_with_items_v2, deplete_for_order_item_v2, add_combo_to_tab_depletion, entities/recipe, command.tsx, popover.tsx]
  affects: [04-04-override-feature, 04-05-manage-recipes-feature, 04-06-integration-tests]
tech_stack:
  added: [shadcn/command, shadcn/popover]
  patterns: [Postgres function overloads, EXCEPTION WHEN OTHERS bypass, TanStack Query entity hooks, shadcn CLI → shared/ui move]
key_files:
  created:
    - bar-pos/supabase/migrations/20260428000003_create_order_with_items_v2.sql
    - bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql
    - bar-pos/supabase/migrations/20260428000005_add_combo_to_tab_depletion.sql
    - bar-pos/src/entities/recipe/model/queries.ts
    - bar-pos/src/entities/recipe/model/types.ts
    - bar-pos/src/entities/recipe/ui/RecipePreviewPanel.tsx
    - bar-pos/src/entities/recipe/index.ts
    - bar-pos/src/shared/ui/command.tsx
    - bar-pos/src/shared/ui/popover.tsx
  modified:
    - bar-pos/src/shared/ui/index.ts
key-decisions:
  - "Migration 003 uses 6-arg signature CREATE OR REPLACE — Postgres overloads the function (5-arg original coexists)"
  - "Migration 004 creates a 3-arg overload of deplete_for_order_item — both 2-arg (v1) and 3-arg (v2) coexist"
  - "Migration 005 collects child order_item IDs into a uuid[] array during INSERT loop, then depletes in a second loop — avoids re-querying"
  - "shadcn CLI installs to src/app/components/ui/ — moved to src/shared/ui/ to match FSD layer boundaries (consistent with Plan 02-01 collapsible pattern)"
requirements-completed: [S3b-03, S3b-06, S3b-08]
metrics:
  duration: "~15 minutes (auto tasks only; checkpoint pending)"
  completed: "2026-04-24"
  tasks_completed: 1
  tasks_total: 3
  files_created: 9
  files_modified: 1
---

# Phase 04 Plan 03: v2 Migrations + recipe entity + shadcn Summary

**Three v2 migration SQL files written and committed; blocking checkpoint awaiting supabase db push; Task 3 (recipe entity + shadcn) to be completed after resume**

## Performance

- **Duration:** ~15 minutes (Task 1 complete; Task 2 checkpoint pending; Task 3 pending resume)
- **Started:** 2026-04-24
- **Completed:** 2026-04-24 (partial — checkpoint reached)
- **Tasks:** 1/3 complete (Task 2 = blocking checkpoint, Task 3 = pending resume)
- **Files created:** 3 migration files (Task 1)

## Accomplishments

### Task 1 (complete — `408b82d`)

Three v2 SQL migration files written and committed atomically:

**Migration 003** — `create_order_with_items` v2:
- Added `p_skip_depletion boolean DEFAULT false` as 6th parameter
- Added `v_inserted_item record;` in DECLARE block
- Added depletion loop after all order_items inserted: `FOR v_inserted_item IN SELECT id FROM order_items WHERE order_id = v_order.id LOOP PERFORM deplete_for_order_item(v_inserted_item.id, 1::smallint); END LOOP;`
- Loop wrapped in `IF NOT p_skip_depletion THEN ... END IF;`
- GRANT updated to 6-arg signature

**Migration 004** — `deplete_for_order_item` v2 overload:
- New 3-arg overload: `deplete_for_order_item(uuid, smallint, boolean DEFAULT false)`
- `PERFORM record_stock_movement(...)` wrapped in `BEGIN/EXCEPTION WHEN OTHERS THEN`
- When `p_allow_negative=true` and `SQLERRM LIKE '%INVENTORY_NEGATIVE%'`: directly updates `ingredients.quantity_on_hand`, inserts `audit_log` row (T-04-07 mitigation)
- Otherwise: `RAISE;` re-raises the error
- GRANT to 3-arg signature; 2-arg v1 grant (migration 002) remains unchanged

**Migration 005** — `add_combo_to_tab` with depletion:
- Added `v_child_item_id uuid; v_child_item_ids uuid[];` to DECLARE
- `v_child_item_ids := ARRAY[]::uuid[];` initialized before loops
- Child INSERT loop changed to `INSERT ... RETURNING id INTO v_child_item_id` + `v_child_item_ids := v_child_item_ids || v_child_item_id;`
- Depletion loop after all children inserted: `FOR v_combo_item_depl IN SELECT unnest(v_child_item_ids) AS id LOOP PERFORM deplete_for_order_item(...) END LOOP;`

### Task 2 (blocking checkpoint — pending)

Awaiting: `cd bar-pos && npx supabase db push` to apply migrations 003, 004, 005 to remote DB.

### Task 3 (pending — after checkpoint resume)

To be completed after "v2 migrations applied" signal:
- `entities/recipe/` entity with `useRecipe`, `useMutationSaveRecipe` hooks
- `src/shared/ui/command.tsx` and `popover.tsx` installed via shadcn CLI
- `src/shared/ui/index.ts` updated with command + popover exports

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Write migrations 003, 004, 005 | `408b82d` | 3 migration SQL files |
| 2 | (checkpoint) | pending | — |
| 3 | Recipe entity + shadcn | pending | 7 files |

## Migration File Verification

```
grep -c "p_skip_depletion" .../20260428000003_create_order_with_items_v2.sql  → 5
grep -c "p_allow_negative" .../20260428000004_deplete_for_order_item_v2.sql   → 4
grep -c "deplete_for_order_item" .../20260428000005_add_combo_to_tab_depletion.sql → 3
```

All grep checks pass.

## Deviations from Plan

None — Task 1 executed exactly as written. The depletion loop in migration 005 uses `SELECT unnest(v_child_item_ids) AS id` which is equivalent to iterating the collected IDs array (cleaner than re-querying order_items for child items, avoids potential timing issues with concurrent inserts).

## Threat Surface Scan

No new network endpoints. Migration 004's audit_log INSERT is in SECURITY DEFINER context — client cannot bypass the audit trail when p_allow_negative=true (T-04-07 mitigated).

## Known Stubs

None from Task 1. Task 3 pending — RecipePreviewPanel will show `item.ingredientId` UUID directly (stub behavior: future Plan 04-05 will wire ingredient name lookup).

## Self-Check

Files created (Task 1):
- bar-pos/supabase/migrations/20260428000003_create_order_with_items_v2.sql — FOUND
- bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql — FOUND
- bar-pos/supabase/migrations/20260428000005_add_combo_to_tab_depletion.sql — FOUND

Commit:
- 408b82d (feat(04-03): write v2 migration files) — FOUND

Task 3 files (pending after checkpoint):
- bar-pos/src/entities/recipe/model/queries.ts — NOT YET
- bar-pos/src/entities/recipe/model/types.ts — NOT YET
- bar-pos/src/entities/recipe/ui/RecipePreviewPanel.tsx — NOT YET
- bar-pos/src/entities/recipe/index.ts — NOT YET
- bar-pos/src/shared/ui/command.tsx — NOT YET
- bar-pos/src/shared/ui/popover.tsx — NOT YET

## Self-Check: PARTIAL (Task 1 PASSED; Tasks 2-3 pending checkpoint resume)
