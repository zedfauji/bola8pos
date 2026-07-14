---
sprint: S1
title: Foundation
duration: 2 weeks
tokens: 70k ± 10k
depends_on: []
unlocks: [S2, S3a]
status: ready
---

# S1 — Foundation

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

## Goal

Ship the schema + primitives every downstream sprint depends on: unified stock ledger, hierarchical categories, modifier groups, and combo-eligibility flags. **No user-facing behavior change in POS flow.** This is an infrastructure sprint.

## Scope

### In
1. Rename `inventory_log` → `stock_movements`; extend reason enum; add polymorphic `ref_type/ref_id` and nullable `ingredient_id`
2. `categories.parent_id` (self-ref) + depth-3 CHECK trigger
3. `modifier_groups` + `modifier_group_items` + `product_modifier_groups` tables
4. `products.combo_eligible` + `products.is_combo` flags
5. Drop `payments.tab_id` isOneToOne constraint
6. Regenerate `supabase.types.ts`; extend Zod schemas in `domain.ts`
7. Admin UI: Category tree editor + Modifier Group editor (both in Settings)

### Out
- Any runtime use of combos (S2)
- Any runtime use of ingredients/recipes (S3a+)
- Any UI change on POS/Tab pages

## Tickets

| ID | Title | Files | Est |
|---|---|---|---|
| S1-01 | DB migration: rename inventory_log → stock_movements + columns | `supabase/migrations/2026xxxx_stock_movements.sql` | S |
| S1-02 | DB migration: categories.parent_id + depth-3 trigger | `supabase/migrations/2026xxxx_categories_tree.sql` | S |
| S1-03 | DB migration: modifier_groups trio + product link | `supabase/migrations/2026xxxx_modifier_groups.sql` | S |
| S1-04 | DB migration: products.combo_eligible, products.is_combo | `supabase/migrations/2026xxxx_product_combo_flags.sql` | XS |
| S1-05 | DB migration: drop payments.tab_id isOneToOne | `supabase/migrations/2026xxxx_payments_constraint.sql` | XS |
| S1-06 | Regenerate types, update Zod schemas | `src/shared/lib/supabase.types.ts`, `src/shared/lib/domain.ts` | M |
| S1-07 | `CategoryTreePicker` shared/ui component | `src/shared/ui/CategoryTreePicker/` + story | M |
| S1-08 | Category tree admin editor in Settings | `src/features/manage-categories/`, Settings tab | M |
| S1-09 | `ModifierGroupEditor` feature | `src/features/manage-modifier-groups/`, Settings tab | M |
| S1-10 | Entity `category` refactor to tree model | `src/entities/category/model/*` | M |
| S1-11 | RLS policies for new tables | `supabase/migrations/2026xxxx_s1_rls.sql` | S |
| S1-12 | Property tests: P1 (tree depth + no cycles) | `src/shared/lib/category-tree.test.ts` | S |
| S1-13 | E2E `18-categories.spec.ts` | `e2e/18-categories.spec.ts` | S |

Sizes: XS=<2h, S=<½d, M=<1d, L=<2d.

## Data model changes
See [02-data-model.md § S1](../02-data-model.md).

## Migrations — order of application
1. stock_movements rename (ensure no queries reference `inventory_log`)
2. categories.parent_id + trigger
3. modifier_groups trio
4. products flags
5. payments constraint drop

Each migration is reversible. Include `DOWN` scripts.

## Breaking-change audit

Grep the codebase for every occurrence before starting:
```
grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e
```
Every hit must be updated to `stock_movements` in the same commit as the migration that renames it.

## Feature flags
None. All changes are additive except the rename (handled atomically).

## Testing requirements

### Unit
- `category-tree`: insert-cycle rejection, depth-3 enforcement, `descendants()` recursive query
- Zod schema tests: valid + invalid inputs for all new schemas

### Property (P1)
`fast-check`: random tree construction up to 1000 nodes; assert no cycle, depth ≤ 3 after each insert.

### E2E (`18-categories.spec.ts`)
1. Admin logs in, opens Settings → Categories
2. Creates root "Beers"
3. Creates child "Regular" under Beers
4. Creates grandchild "Corona" under Regular
5. Attempts great-grandchild → expects UI refusal + backend 4xx
6. Toggles a product's `combo_eligible=false` → saves → confirms DB state

## Definition of Done

- [ ] All 5 migrations run clean against local + staging Supabase
- [ ] `npx supabase gen types typescript` output committed
- [ ] `domain.ts` Zod schemas updated; `type` inferences only, no manual interfaces
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (zero warnings)
- [ ] `npm run test` passes; P1 property test included
- [ ] Existing E2E suite still green (no regression)
- [ ] `18-categories.spec.ts` green
- [ ] Settings → Categories + Modifier Groups manually verified in Tauri dev build
- [ ] RLS policies verified: bartender cannot write to modifier_groups
- [ ] No reference to `inventory_log` remains in codebase
- [ ] Atomic commits per ticket with conventional-commit messages

## Risks

| Risk | Mitigation |
|---|---|
| Table rename breaks live queries | Feature-flag if needed; stage on local first; confirm with `grep` + tests |
| Depth-3 trigger performance on large trees | Trigger fires only on INSERT/UPDATE of parent_id; bounded recursion; expected <100 categories total |
| Dropping payments 1:1 constraint exposes hidden assumptions | Grep `isOneToOne`, `one-payment`, `single payment`; audit any client code assuming single payment |

## Execution notes

- Start with S1-01 (rename) because everything else depends on the new column names
- S1-06 (type regen) is a fan-out point: do it once after all migrations, not per-migration
- S1-07 through S1-10 can parallelize after S1-06
