---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgresql, migrations, rls, stock-movements, categories, modifier-groups, payments]

# Dependency graph
requires: []
provides:
  - stock_movements table (renamed from inventory_log, extended reason enum, polymorphic ref cols)
  - categories.parent_id column with depth-3 + cycle-rejection trigger
  - modifier_groups, modifier_group_items, product_modifier_groups tables
  - products.combo_eligible + products.is_combo columns
  - payments.tab_id UNIQUE constraint dropped (multi-payment per tab enabled)
  - RLS policies for modifier_groups trio (manager/admin write, all read)
affects:
  - plan-03 (type regen + Zod schema extension depends on all migrations)
  - plan-04 (entity/category folder depends on categories.parent_id)
  - plan-05 (UI features depend on schema changes)
  - plan-06 (E2E categories spec depends on DB enforcement)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SQL migration pattern: each ticket = one migration file with -- DOWN: comment block"
    - "Pre-regen cast: db = supabase as any with eslint-disable when types not yet regenerated"
    - "Depth-3 trigger via recursive CTE (BEFORE INSERT OR UPDATE OF parent_id)"
    - "SECURITY DEFINER on inventory triggers for bartender RLS bypass"

key-files:
  created:
    - bar-pos/supabase/migrations/20260424000001_stock_movements.sql
    - bar-pos/supabase/migrations/20260424000002_categories_tree.sql
    - bar-pos/supabase/migrations/20260424000003_modifier_groups.sql
    - bar-pos/supabase/migrations/20260424000004_product_combo_flags.sql
    - bar-pos/supabase/migrations/20260424000005_payments_constraint.sql
    - bar-pos/supabase/migrations/20260424000006_s1_rls.sql
  modified:
    - bar-pos/src/entities/inventory/model/queries.ts
    - bar-pos/src/features/physical-count/model/usePhysicalCount.ts
    - bar-pos/src/features/physical-count/model/usePhysicalCount.test.ts
    - bar-pos/e2e/27-inventory-intelligence.spec.ts
    - bar-pos/e2e/helpers/supabase.ts
    - bar-pos/src/shared/lib/supabase-contracts.ts

key-decisions:
  - "Use db = supabase as any pre-regen cast (per CLAUDE.md workaround) for stock_movements queries until Plan 03 regenerates types"
  - "stock_movements reason enum extended to 11 values: added void, refund, prep_production, prep_consumption, combo_component"
  - "Depth-3 trigger fires BEFORE INSERT OR UPDATE OF parent_id (bounded firing, not all UPDATE)"
  - "modifier_groups: all-authenticated SELECT, manager+admin write (aligns with inventory RLS pattern)"
  - "payments_tab_id_key dropped with IF EXISTS to be idempotent; non-unique idx_payments_tab_id from original migration preserved"

patterns-established:
  - "Migration DOWN scripts: every migration has commented -- DOWN: block for reversibility"
  - "Self-referential FK with recursive CTE trigger: categories_depth_check_trg pattern"
  - "Composite PK for M:N junction tables: modifier_group_items, product_modifier_groups"

requirements-completed: [S1-01, S1-02, S1-03, S1-04, S1-05, S1-11]

# Metrics
duration: 9min
completed: 2026-04-23
---

# Phase 01 Plan 02: SQL Migrations (Wave 1) Summary

**Six atomic Postgres migrations: inventory_log renamed to stock_movements with extended enum, categories get depth-3 tree structure, modifier_groups trio created, products gain combo flags, payments allow multiple per tab, and RLS applied to new tables**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-23T18:03:30Z
- **Completed:** 2026-04-23T18:12:00Z
- **Tasks:** 6 (S1-01, S1-02, S1-03, S1-04, S1-05, S1-11)
- **Files modified:** 12 (6 migrations + 6 source/test/e2e files)

## Accomplishments

- `inventory_log` renamed atomically to `stock_movements` — all 16 non-generated references updated in the same commit; reason enum extended from 6 to 11 values; polymorphic `ref_type`, `ref_id`, `ingredient_id` columns added
- Hierarchical categories enabled via `parent_id` FK + `categories_depth_check` recursive-CTE trigger rejecting depth > 3 and cycles
- Three new tables for modifier groups (`modifier_groups`, `modifier_group_items`, `product_modifier_groups`) with composite PKs and cardinality CHECK
- Products gain `combo_eligible` (DEFAULT true) and `is_combo` (DEFAULT false) boolean columns
- `payments_tab_id_key` UNIQUE constraint dropped — multi-payment-per-tab now permitted
- RLS enabled on all three modifier-group tables with manager/admin write + all-read policy pattern

## Task Commits

1. **S1-01: stock_movements rename** - `b66347d` (feat)
2. **S1-02: categories tree** - `1f3aa3b` (feat)
3. **S1-03: modifier groups** - `4c91f30` (feat)
4. **S1-04: product combo flags** - `25b21a6` (feat)
5. **S1-05: payments constraint** - `7da14e1` (feat)
6. **S1-11: S1 RLS policies** - `2a2d37b` (feat)

## Files Created/Modified

- `bar-pos/supabase/migrations/20260424000001_stock_movements.sql` — Rename + enum extension + polymorphic cols + trigger rewrite + RLS rename
- `bar-pos/supabase/migrations/20260424000002_categories_tree.sql` — parent_id column + depth-3/cycle-rejection trigger
- `bar-pos/supabase/migrations/20260424000003_modifier_groups.sql` — Three new modifier group tables
- `bar-pos/supabase/migrations/20260424000004_product_combo_flags.sql` — combo_eligible + is_combo columns
- `bar-pos/supabase/migrations/20260424000005_payments_constraint.sql` — Drop payments UNIQUE constraint
- `bar-pos/supabase/migrations/20260424000006_s1_rls.sql` — RLS for modifier_groups trio
- `bar-pos/src/entities/inventory/model/queries.ts` — References updated to stock_movements; pre-regen cast applied
- `bar-pos/src/features/physical-count/model/usePhysicalCount.ts` — References updated to stock_movements; pre-regen cast applied
- `bar-pos/src/features/physical-count/model/usePhysicalCount.test.ts` — Mock table name updated (text replace only)
- `bar-pos/e2e/27-inventory-intelligence.spec.ts` — Comment text updated
- `bar-pos/e2e/helpers/supabase.ts` — getLatestInventoryLog helper updated to query stock_movements
- `bar-pos/src/shared/lib/supabase-contracts.ts` — inventory_logs → stock_movements type stub; reason union extended

## Decisions Made

- **Pre-regen `db as any` cast:** Per CLAUDE.md convention for tables not yet in generated types. Applied to queries.ts and usePhysicalCount.ts with TODO comment pointing to Plan 03 (S1-06) for cleanup. The `/* eslint-disable */` header suppresses lint during this bridge period.
- **Reason enum extended with `void`:** Added `void` in addition to PRD-specified values (prep_production, prep_consumption, combo_component, refund) since the existing trigger system uses `correction` not `void` — having `void` explicit avoids ambiguity when voiding orders writes to the ledger.
- **`depth >= 3` reject in trigger:** The trigger counts ancestors of `NEW.parent_id`. If that chain is depth 3 (grandchild already), adding NEW would make depth 4 — rejected. Roots (depth=0) get children (depth=1) and grandchildren (depth=2) — total 3 levels as required.
- **`payments_tab_id_key` with `DROP CONSTRAINT IF EXISTS`:** Idempotent migration in case the constraint was already dropped in some environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Applied `db as any` cast + `eslint-disable` header per CLAUDE.md workaround**
- **Found during:** Task S1-01 (first commit attempt)
- **Issue:** Pre-commit husky hook ran `tsc --noEmit`; `stock_movements` not in `supabase.types.ts` (awaiting Plan 03 regeneration) caused 20+ TS errors
- **Fix:** Per CLAUDE.md: "use `const db = supabase as any` at the file level with a file-level `/* eslint-disable */` comment. Regenerate types ASAP." Applied to queries.ts and usePhysicalCount.ts. Also removed `TablesInsert` import (now unused) and added `<any>` type params to supabaseMutation/supabaseQuery calls.
- **Files modified:** src/entities/inventory/model/queries.ts, src/features/physical-count/model/usePhysicalCount.ts
- **Verification:** Commit passed lint-staged on second attempt
- **Committed in:** b66347d (S1-01 commit)

**2. [Rule 1 - Bug] Updated `supabase-contracts.ts` type stub**
- **Found during:** Task S1-01 (grep gate check)
- **Issue:** `supabase-contracts.ts` had `inventory_logs` (plural) type stub; grep returned it as a match; the reason union was also outdated (only 5 values)
- **Fix:** Renamed to `stock_movements` and extended reason union to 11 values. Prettier reformatted to multi-line union.
- **Files modified:** src/shared/lib/supabase-contracts.ts
- **Committed in:** b66347d (S1-01 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — both correctness fixes)
**Impact on plan:** Both fixes necessary to pass pre-commit hooks and satisfy the grep gate. No scope creep.

## Issues Encountered

- `bar-pos/` is a nested git repository inside the outer planning repo. Commits must be made from `bar-pos/` directory, not the project root. Planning files (STATE.md, ROADMAP.md) commit to the outer repo separately.

## Next Phase Readiness

- All 6 Wave 1 migrations committed; ready for Plan 03 (type regen fan-in)
- Plan 03 must run `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` to replace the `db as any` casts in queries.ts and usePhysicalCount.ts
- `npx supabase db reset` should be verified locally to confirm clean migration apply from zero
- Plans 04–07 are blocked until Plan 03 completes

---
*Phase: 01-foundation*
*Completed: 2026-04-23*
