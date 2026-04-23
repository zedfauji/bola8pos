---
phase: 01-foundation
plan: "03"
subsystem: database
tags: [zod, typescript, supabase, types, domain, modifier-groups, stock-movements, combos]

# Dependency graph
requires:
  - phase: 01-foundation-02
    provides: SQL migrations for stock_movements, categories_tree, modifier_groups, product_combo_flags

provides:
  - supabase.types.ts extended with all Sprint 1 new tables and columns
  - CategorySchema with optional parentId for hierarchical categories (depth-3)
  - ProductSchema with comboEligible and isCombo flags
  - StockMovementReasonSchema (11 values supersetting InventoryAdjustReason)
  - StockMovementSchema for the renamed stock_movements ledger table
  - ModifierGroupSchema, ModifierGroupItemSchema, ProductModifierGroupSchema
  - domain.test.ts with 50 unit tests covering all new/extended schemas

affects:
  - 04-entity-category (uses CategorySchema.parentId)
  - 05-ui-features (uses ProductSchema.isCombo/comboEligible)
  - 06-e2e-categories (depends on domain types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod optional().default() for DB-defaulted boolean columns (comboEligible, isCombo)"
    - "StockMovementReason as superset enum of InventoryAdjustReason (11 vs 6 values)"
    - "lint-staged --no-warn-ignored to suppress supabase.types.ts ignore-pattern warning"

key-files:
  created:
    - bar-pos/src/shared/lib/domain.test.ts
  modified:
    - bar-pos/src/shared/lib/supabase.types.ts
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/lint-staged.config.cjs
    - bar-pos/src/entities/tab/model/cartStore.test.ts
    - bar-pos/src/entities/tab/ui/CartItem.stories.tsx
    - bar-pos/src/entities/tab/ui/TabDetail.stories.tsx
    - bar-pos/src/features/add-item-to-tab/ui/ModifierSheet.stories.tsx
    - bar-pos/src/features/physical-count/model/usePhysicalCount.test.ts
    - bar-pos/src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx
    - bar-pos/src/features/void-order/ui/VoidOrderDialog.test.tsx
    - bar-pos/src/shared/lib/domain-helpers.test.ts
    - bar-pos/src/shared/lib/groupOrderItems.test.ts
    - bar-pos/src/widgets/OrderPanel/CartPanel.stories.tsx
    - bar-pos/src/widgets/PaymentModal/PaymentModal.test.tsx

key-decisions:
  - "supabase.types.ts updated manually (not via npx supabase gen types) because Docker / local Supabase was unavailable; all new columns/tables from Plan 02 migrations manually transcribed"
  - "comboEligible and isCombo use z.boolean().optional().default() so the fields are absent-safe in struct literals while parse() fills defaults"
  - "lint-staged --no-warn-ignored added to suppress false-positive warning from supabase.types.ts being ESLint-ignored but matched by src/**/*.{ts,tsx} glob"
  - "StockMovementReason extends InventoryAdjustReason to 11 values including prep_production, prep_consumption, combo_component, refund, void"

patterns-established:
  - "New table schemas: define Row shape as Zod schema, export Create/Update schemas via omit/partial, export all three TypeScript types"
  - "domain.test.ts: test every new schema with valid happy-path + at least 2 invalid cases (missing required field + wrong type)"

requirements-completed: [S1-06]

# Metrics
duration: 25min
completed: "2026-04-23"
---

# Phase 1 Plan 03: Types + Zod (S1-06) Summary

**supabase.types.ts hand-extended with 4 new Sprint-1 tables and 7 new columns; domain.ts gains StockMovement, ModifierGroup, and combo-flag schemas; 50 Zod unit tests added**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-23T12:00:00Z
- **Completed:** 2026-04-23T12:25:00Z
- **Tasks:** 1 (S1-06, 4 sub-steps)
- **Files modified:** 15

## Accomplishments

- `supabase.types.ts` extended to reflect all Plan 02 migrations: `categories.parent_id`, `categories.is_food`, `products.barcode/combo_eligible/is_combo`, `inventory_log` renamed to `stock_movements` (with `ref_type`/`ref_id`/`ingredient_id`), plus new tables `modifier_groups`, `modifier_group_items`, `product_modifier_groups`; `user_role` enum extended with `kitchen`
- `domain.ts` extended: `CategorySchema` gains `parentId` (nullable optional UUID); `ProductSchema` gains `comboEligible`/`isCombo` (optional, DB-defaulted booleans); new `StockMovementReasonSchema` (11 values), `StockMovementSchema`, `ModifierGroupSchema`, `ModifierGroupItemSchema`, `ProductModifierGroupSchema` — all exported in the `domain` namespace
- `domain.test.ts` created with 50 passing unit tests covering all new schemas (valid + boundary + invalid cases)
- Fixed compile breaks across 10 test/story files caused by new required-but-defaulted Product fields; `npm run typecheck` and `npm run lint` both clean

## Task Commits

1. **S1-06: types + Zod** - `67be414` (feat)

## Files Created/Modified

- `bar-pos/src/shared/lib/supabase.types.ts` - Hand-extended with Sprint 1 schema changes
- `bar-pos/src/shared/lib/domain.ts` - Extended with 5 new schemas + StockMovementReason enum
- `bar-pos/src/shared/lib/domain.test.ts` - Created: 50 unit tests for new/extended schemas
- `bar-pos/lint-staged.config.cjs` - Added `--no-warn-ignored` to eslint call
- 10 test/story files - Added `comboEligible: true, isCombo: false` to Product fixtures

## Decisions Made

- **Manual types update:** Docker/local Supabase was unavailable, so `supabase.types.ts` was manually updated to reflect Plan 02 migration SQL. This is the documented fallback per CLAUDE.md (`supabase as any` + regenerate ASAP); in this case a full manual transcription was done instead because the schema was deterministic from the migration files.
- **`optional().default()` for combo flags:** Zod's `.optional().default(true/false)` pattern used so: (a) parse() fills in defaults when absent, (b) existing struct literals in tests/stories don't break, (c) TypeScript input type allows the field to be omitted.
- **`--no-warn-ignored` in lint-staged:** `supabase.types.ts` is in ESLint `ignores[]` but matches the `src/**/*.{ts,tsx}` lint-staged glob. ESLint 9 emits a "file ignored" warning when passed an ignored file explicitly. Adding `--no-warn-ignored` suppresses this without affecting actual linting.
- **StockMovementReason as superset:** Rather than modifying `InventoryAdjustReason`, a new `StockMovementReasonSchema` with 11 values was created. Existing `InventoryAdjustReason` (6 values) is preserved for backwards compat in the manual adjustment feature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed compile breaks in 10 test/story Product fixtures**
- **Found during:** S1-06 (step 4 — fix compile breaks after schema change)
- **Issue:** Adding `comboEligible` and `isCombo` to `ProductSchema` made them required in the output TS type; 10 test/story files created `Product` objects directly without these fields, causing TS2739 errors
- **Fix:** Added `comboEligible: true, isCombo: false` to every affected Product literal (cartStore.test.ts, CartItem.stories.tsx, TabDetail.stories.tsx, ModifierSheet.stories.tsx, usePhysicalCount.test.ts, RemoveTabItemDialog.test.tsx, VoidOrderDialog.test.tsx, domain-helpers.test.ts, groupOrderItems.test.ts, CartPanel.stories.tsx, PaymentModal.test.tsx)
- **Files modified:** 10 test/story files
- **Verification:** `npm run typecheck` passes, all tests pass
- **Committed in:** `67be414` (same task commit)

**2. [Rule 3 - Blocking] Fixed lint-staged rejecting supabase.types.ts via --no-warn-ignored**
- **Found during:** S1-06 commit (pre-commit hook failure)
- **Issue:** lint-staged ran ESLint on `supabase.types.ts` (matched by `src/**/*.{ts,tsx}`) even though it's in eslint `ignores[]`; ESLint emitted a "file ignored" warning which `--max-warnings 0` treated as failure
- **Fix:** Added `--no-warn-ignored` to the eslint call in `lint-staged.config.cjs`
- **Files modified:** `lint-staged.config.cjs`
- **Verification:** `git commit` succeeded with pre-commit hooks passing
- **Committed in:** `67be414` (same task commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 compile-break, 1 Rule 3 blocking)
**Impact on plan:** Both fixes were directly caused by the schema extension in S1-06. No scope creep.

## Issues Encountered

- **Docker/local Supabase unavailable:** `npx supabase gen types typescript --local` requires Docker Desktop running. Docker was not running. Resolved by manually transcribing all Plan 02 migration changes into `supabase.types.ts` deterministically from the migration SQL files.

## Next Phase Readiness

- Plan 04 (entity-category) can now use `CategorySchema.parentId` and `Tables<'categories'>` with `parent_id`
- Plan 05 (UI + P1) can use `ProductSchema.comboEligible` / `isCombo`
- Plan 06 (E2E) and Plan 07 (regression gate) depend on domain types being correct

---
*Phase: 01-foundation*
*Completed: 2026-04-23*
