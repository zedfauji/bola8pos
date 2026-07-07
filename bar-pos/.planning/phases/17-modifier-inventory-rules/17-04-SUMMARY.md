---
phase: 17-modifier-inventory-rules
plan: 04
subsystem: frontend
tags: [entities, tanstack-query, fsd, integration-test, supabase]

# Dependency graph
requires:
  - phase: 17-modifier-inventory-rules (plan 01)
    provides: ModifierInventoryRuleSchema + ModifierInventoryRuleCreateSchema in domain.ts
  - phase: 17-modifier-inventory-rules (plan 03)
    provides: modifier_inventory_rules table + deplete_for_order_item v3 live in remote Supabase
provides:
  - "entities/modifier-inventory-rule FSD slice — typed CRUD surface for the admin UI (17-05)"
  - "I5/I6 integration proof: modifier deltas hit stock_movements with ref_type='order_item_modifier', independent of recipe presence (D-04)"
affects: [17-05-admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "delete-all-then-insert save mutation with NO parent-upsert step (modifier row already exists, unlike recipes)"

key-files:
  created:
    - src/entities/modifier-inventory-rule/model/types.ts
    - src/entities/modifier-inventory-rule/model/queries.ts
    - src/entities/modifier-inventory-rule/index.ts
  modified:
    - src/entities/tab/model/depletion.integration.test.ts

key-decisions:
  - "Cloned entities/recipe/model/queries.ts shape verbatim (query-key factory, row mapper, delete-all-then-insert mutation) but dropped the recipe's parent-upsert step — the modifier row is owned by the existing modifiers table, not created by this mutation."
  - "I5/I6 restore ingredient stock to 100/500 at the top of I5 — I4 (pre-existing test, unmodified) intentionally leaves stock at 0 after its override-bypass assertion and never restores it, which would otherwise make I5/I6 hit INVENTORY_NEGATIVE."

patterns-established:
  - "17-PATTERNS.md referenced by the plan does not exist in this phase — entities/recipe was used directly as the clone source instead."

requirements-completed: [SC-1, SC-2, SC-4]

# Metrics
duration: ~25min
completed: 2026-07-07
---

# Phase 17 Plan 04: Modifier Inventory Rules — Entity + Integration Tests Summary

**Built the entities/modifier-inventory-rule FSD slice (read hook + delete-all-then-insert save mutation) and proved the v3 RPC's modifier-driven depletion end-to-end with two new live-Supabase integration cases.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `entities/modifier-inventory-rule/` FSD slice created: `modifierInventoryRuleKeys` query-key factory, `useModifierInventoryRules(modifierId)` read hook (parse-on-read via `ModifierInventoryRuleSchema`), `useMutationSaveModifierInventoryRules()` delete-all-then-insert save mutation supporting N ingredient rows per modifier (D-03), explicit named-export barrel (no `export *`).
- `depletion.integration.test.ts` extended with I5 (modifier rule writes a distinct `order_item_modifier` stock_movements row alongside the existing 2 recipe rows for the same order_item — no idempotency-index collision) and I6 (a recipe-less product with the same modifier still depletes via the modifier loop, D-04, while writing zero `order_item` rows).
- All 6 integration cases (I1-I6) pass against live remote Supabase; I1-I4 unchanged, proving SC-4 (no regression to recipe-only depletion).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entities/modifier-inventory-rule FSD slice** - `31f03a1` (feat)
2. **Task 2: Extend depletion.integration.test.ts with modifier cases (I5/I6)** - `52c98e8` (test)

## Files Created/Modified

- `src/entities/modifier-inventory-rule/model/types.ts` - Re-exports `ModifierInventoryRuleSchema`, `ModifierInventoryRuleCreateSchema`, and inferred types from `@shared/lib/domain`.
- `src/entities/modifier-inventory-rule/model/queries.ts` - `modifierInventoryRuleKeys`, `useModifierInventoryRules`, `useMutationSaveModifierInventoryRules` (file-level eslint-disable + `const db = supabase as any` pre-regen cast per CLAUDE.md workaround).
- `src/entities/modifier-inventory-rule/index.ts` - Explicit named-export barrel.
- `src/entities/tab/model/depletion.integration.test.ts` - Added modifier fixture setup (a `__test_extra_lime__` modifier + `modifier_inventory_rules` row + a recipe-less `__test_bottle__` product), I5/I6 test cases, and extended `afterAll` cleanup.

## Decisions Made

- Cloned `entities/recipe/model/queries.ts`'s exact shape (query-key factory, row mapper, delete-all-then-insert mutation, `err`/`ok`/`logger` usage) rather than inventing a new pattern, per the plan's explicit read-first instruction — the only structural deviation is omitting the parent-upsert step, since a modifier row is not created by this mutation (it already exists in the `modifiers` table).
- `17-PATTERNS.md` was referenced by the plan's `read_first` list and context block but does not exist anywhere in `.planning/phases/17-modifier-inventory-rules/` (confirmed via directory listing) — proceeded using `entities/recipe/model/queries.ts` as the clone source directly, which the plan also listed as a read-first file.
- Added a `restore ingredient stock` step at the top of I5: the pre-existing I4 test (untouched, out of this plan's scope) intentionally zeroes both test ingredients' stock and leaves them at 0 after its override-bypass assertion (it was never designed to restore afterward, since it was previously the last test in the file). Without a restore, I5/I6 (which run after I4 and use `p_allow_negative: false`) would hit `INVENTORY_NEGATIVE` on setup-adjacent stock. This is a test-fixture-ordering fix scoped entirely inside the new test file, not a change to I1-I4's behavior or the RPC.

## Deviations from Plan

None substantive. The `17-PATTERNS.md` file referenced in the plan's context/read-first lists does not exist in this phase directory; `entities/recipe/model/queries.ts` (also listed as read-first) was used as the direct clone source instead, which fully satisfied the task's intent.

## Issues Encountered

Initial integration test run failed I5/I6 with `INVENTORY_NEGATIVE` errors — root cause was I4's leftover zeroed ingredient stock (see Decisions above). Fixed by restoring stock to 100/500 at the start of I5. All 6 tests (I1-I6) pass on the subsequent run.

## User Setup Required

None. The `modifier_inventory_rules` table and `deplete_for_order_item` v3 RPC were already live in remote Supabase from plan 17-03; this plan's integration test ran directly against them with no additional migration or manual setup.

## Next Phase Readiness

- `entities/modifier-inventory-rule` is a complete typed CRUD surface — 17-05 (admin UI) can build the modifier-rule editor directly against `useModifierInventoryRules` / `useMutationSaveModifierInventoryRules` with no further data-layer work.
- SC-1 (typed read/write with N-row support), SC-2 (ledger proof via `order_item_modifier`), and SC-4 (recipe-only regression + recipe-independence) are all satisfied.
- `npm run typecheck` exits with only the 2 pre-existing, out-of-scope errors documented since plan 17-03 (`tab/model/queries.ts:778`, `agent/rag.ts:60`); `npm run lint` is clean on all touched files; full unit suite is 1187 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`, documented since Phase 15) / 15 todo.
- No blockers identified for 17-05.

---
*Phase: 17-modifier-inventory-rules*
*Completed: 2026-07-07*
