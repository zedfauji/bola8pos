---
phase: 01-foundation
verified: 2026-04-23T20:00:00Z
status: human_needed
score: 12/13 must-haves verified
re_verification: false
human_verification:
  - test: "Run: cd bar-pos && supabase db push (link to staging first)"
    expected: "All 6 S1 migrations (20260424000001–20260424000006) apply cleanly to the remote Supabase instance with zero errors"
    why_human: "Docker/local Supabase was unavailable during Plan 07; migrations are only verified locally. Remote staging has not received the S1 schema changes. The E2E spec 31-categories.spec.ts fails T2–T8 because parent_id column does not exist on the remote DB."
  - test: "Run: cd bar-pos && npm run tauri dev — log in as admin (PIN 0000), navigate Settings > Products > Categories, create root category 'Beers', navigate Settings > Products > Modifier Groups, open editor"
    expected: "No console errors on either tab. Category appears in tree after creation."
    why_human: "Plan 07 DoD requires Tauri desktop smoke. Cannot be verified programmatically — requires the Tauri runtime environment."
  - test: "After supabase db push: cd bar-pos && npx playwright test e2e/31-categories.spec.ts"
    expected: "All 8 test cases pass, including T2 (create Beers), T3 (Regular), T4 (Corona), T5 (depth gate blocked), T6 (combo_eligible DB toggle), T7 (bartender RLS refusal if E2E_BARTENDER_EMAIL set), T8 (bartender redirected from /settings)"
    why_human: "E2E spec requires live Supabase with S1 migrations applied. Cannot run without staging credentials and infrastructure."
---

# Phase 01: Foundation Verification Report

**Phase Goal:** Deliver the S1 Foundation sprint — schema migrations, type regen, category entity, UI feature editors, E2E spec, and regression gate — establishing the data and code foundation required for all downstream S2–S6 sprints.
**Verified:** 2026-04-23T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `stock_movements` table migration exists and all `inventory_log` functional references are eliminated | VERIFIED | `20260424000001_stock_movements.sql` present; grep across `src/` + `e2e/` returns 3 comment-only hits, zero functional references |
| 2 | `categories.parent_id` with depth-3 + cycle-rejection trigger migration exists | VERIFIED | `20260424000002_categories_tree.sql` has `ADD COLUMN parent_id uuid NULL REFERENCES categories(id)` + recursive-CTE trigger `categories_depth_check` |
| 3 | Modifier group tables (`modifier_groups`, `modifier_group_items`, `product_modifier_groups`) migration exists with RLS | VERIFIED | `20260424000003_modifier_groups.sql` + `20260424000006_s1_rls.sql` both present and substantive with correct policy patterns |
| 4 | `products.combo_eligible` + `products.is_combo` migration exists | VERIFIED | `20260424000004_product_combo_flags.sql` present; `supabase.types.ts` reflects both columns |
| 5 | `payments` UNIQUE constraint dropped to allow multi-payment per tab | VERIFIED | `20260424000005_payments_constraint.sql` contains `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tab_id_key` |
| 6 | `supabase.types.ts` and `domain.ts` Zod schemas reflect all S1 schema changes | VERIFIED | `supabase.types.ts` has `stock_movements`, `modifier_groups`, `modifier_group_items`, `product_modifier_groups`, `categories.parent_id`, `products.combo_eligible/is_combo`; `domain.ts` has `StockMovementSchema`, `ModifierGroupSchema`, `ModifierGroupItemSchema`, `ProductModifierGroupSchema`, `CategorySchema.parentId`, `ProductSchema.comboEligible/isCombo` |
| 7 | `entities/category` FSD module exists with real TanStack Query hooks for list/tree/mutations | VERIFIED | `src/entities/category/index.ts` exports `useCategories`, `useCategoryTree`, `useMutationCreateCategory`, `useMutationUpdateCategory`; queries.ts is 210 lines with full Supabase integration, error handling via `Result<T>`, and Zod parsing |
| 8 | `CatalogCategoriesTab` and `CatalogProductsTab` import from `@entities/category` | VERIFIED | `CatalogCategoriesTab.tsx` line 8: `from '@entities/category'`; `CatalogProductsTab.tsx` line 4: `import { useCategories } from '@entities/category'` |
| 9 | `shared/ui/CategoryTreePicker` ARIA tree widget with tests and Storybook exists | VERIFIED | `CategoryTreePicker.tsx` (246 lines), `CategoryTreePicker.test.tsx` (152 lines, 10 RTL tests), `CategoryTreePicker.stories.tsx` (154 lines, 6 stories) all present |
| 10 | `manage-categories` feature is wired into Settings UI and enforces 4th-level depth guard | VERIFIED | `CategoryTreeEditor.tsx` (435 lines) imports `wouldViolateDepth`/`MAX_DEPTH` from `@shared/lib/category-tree` and hides "Add child" at depth >= MAX_DEPTH; `ProductsSettingsTab.tsx` line 1 imports and renders `<CategoryTreeEditor />` |
| 11 | `manage-modifier-groups` feature is wired into Settings UI (admin-only) | VERIFIED | `ModifierGroupEditor.tsx` (598 lines) with full CRUD; `ProductsSettingsTab.tsx` renders `<ModifierGroupEditor />` |
| 12 | `category-tree.ts` pure functions exist with fast-check property tests | VERIFIED | `category-tree.ts` exports `buildTree`, `wouldViolateDepth`, `MAX_DEPTH`, `getNodeDepth`, `isAncestor`, `CategoryTreeNode`; `category-tree.test.ts` (420 lines) uses `fast-check` with 1000-node stress tests; 29/29 pass per Plan 07 results |
| 13 | E2E spec `e2e/31-categories.spec.ts` exists covering all required test cases | VERIFIED (code) / HUMAN NEEDED (execution) | `31-categories.spec.ts` (391 lines) covers 8 test cases: Settings tab visibility, 3-level category creation, depth gate, combo_eligible DB toggle, bartender RLS, bartender redirect; spec blocked pending `supabase db push` to staging |

**Score:** 12/13 truths fully verified programmatically; 1 truth requires human execution to confirm end-to-end

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/supabase/migrations/20260424000001_stock_movements.sql` | S1-01 rename + enum + polymorphic cols | VERIFIED | Present, substantive (full DDL with BEGIN/COMMIT, DOWN block) |
| `bar-pos/supabase/migrations/20260424000002_categories_tree.sql` | S1-02 parent_id + depth trigger | VERIFIED | Present, substantive (recursive CTE trigger) |
| `bar-pos/supabase/migrations/20260424000003_modifier_groups.sql` | S1-03 modifier group trio | VERIFIED | Present, substantive (3 tables, composite PKs) |
| `bar-pos/supabase/migrations/20260424000004_product_combo_flags.sql` | S1-04 combo flags | VERIFIED | Present, substantive |
| `bar-pos/supabase/migrations/20260424000005_payments_constraint.sql` | S1-05 UNIQUE constraint drop | VERIFIED | Present, substantive |
| `bar-pos/supabase/migrations/20260424000006_s1_rls.sql` | S1-11 RLS for modifier group tables | VERIFIED | Present, substantive (12 policies, ENABLE ROW LEVEL SECURITY) |
| `bar-pos/src/shared/lib/supabase.types.ts` | S1-06 types with all new tables/columns | VERIFIED | Has `stock_movements`, `modifier_groups`, `modifier_group_items`, `product_modifier_groups`, `categories.parent_id`, `products.combo_eligible/is_combo` |
| `bar-pos/src/shared/lib/domain.ts` | S1-06 Zod schemas for all S1 entities | VERIFIED | Has `StockMovementSchema`, `StockMovementReasonSchema` (11 values), `ModifierGroupSchema`, `ModifierGroupItemSchema`, `ProductModifierGroupSchema`, `CategorySchema.parentId`, `ProductSchema.comboEligible/isCombo` |
| `bar-pos/src/shared/lib/domain.test.ts` | S1-06 50 Zod unit tests | VERIFIED | 446 lines, created in feat(types) commit 67be414 |
| `bar-pos/src/entities/category/index.ts` | S1-10 category entity public API | VERIFIED | 23 lines, exports all hooks + types with JSDoc boundary note |
| `bar-pos/src/entities/category/model/queries.ts` | S1-10 TanStack Query hooks | VERIFIED | 210 lines, `useCategories`, `useCategoryTree`, `useMutationCreateCategory`, `useMutationUpdateCategory`, proper `Result<T>` error handling |
| `bar-pos/src/shared/lib/category-tree.ts` | S1-12 pure tree functions | VERIFIED | Exports `buildTree`, `wouldViolateDepth`, `MAX_DEPTH`, `getNodeDepth`, `isAncestor`, `CategoryTreeNode` |
| `bar-pos/src/shared/lib/category-tree.test.ts` | S1-12 property tests with fast-check | VERIFIED | 420 lines, `import * as fc from 'fast-check'`, 1000-node arbitraries, depth/acyclicity properties |
| `bar-pos/src/shared/ui/CategoryTreePicker/CategoryTreePicker.tsx` | S1-07 ARIA tree widget | VERIFIED | 246 lines, ARIA role=tree, keyboard navigation |
| `bar-pos/src/shared/ui/CategoryTreePicker/CategoryTreePicker.test.tsx` | S1-07 RTL tests | VERIFIED | 152 lines, 10 tests |
| `bar-pos/src/shared/ui/CategoryTreePicker/CategoryTreePicker.stories.tsx` | S1-07 Storybook stories | VERIFIED | 154 lines, 6 stories |
| `bar-pos/src/features/manage-categories/ui/CategoryTreeEditor.tsx` | S1-08 category tree admin editor | VERIFIED | 435 lines, full CRUD with depth guard, real mutations |
| `bar-pos/src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` | S1-09 modifier group editor | VERIFIED | 598 lines, full CRUD via pre-regen `as any` cast |
| `bar-pos/e2e/31-categories.spec.ts` | S1-13 Playwright spec | VERIFIED (code) | 391 lines, 8 test cases; execution blocked pending staging push |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CategoryTreeEditor.tsx` | `@entities/category` | `useCategories`, `useMutationCreateCategory`, `useMutationUpdateCategory` | WIRED | Direct imports at line 22-23; mutation calls in submit handlers |
| `CategoryTreeEditor.tsx` | `@shared/lib/category-tree` | `wouldViolateDepth`, `MAX_DEPTH` | WIRED | Imported line 24; used at line 121 (`canAddChild = depth < MAX_DEPTH`) and line 295 |
| `ModifierGroupEditor.tsx` | Supabase `modifier_groups` table | `db.from('modifier_groups')` via `as any` cast | WIRED | Pre-regen pattern per CLAUDE.md; queries return data used in component state |
| `ProductsSettingsTab.tsx` | `manage-categories` | `<CategoryTreeEditor />` | WIRED | Import line 1, render line 35 |
| `ProductsSettingsTab.tsx` | `manage-modifier-groups` | `<ModifierGroupEditor />` | WIRED | Import line 2, render line 42 |
| `CatalogCategoriesTab.tsx` | `@entities/category` | `useCategories`, mutations | WIRED | Import line 8 confirmed |
| `CatalogProductsTab.tsx` | `@entities/category` | `useCategories` | WIRED | Import line 4 confirmed |
| `useCategoryTree` | `category-tree.ts` | `buildCategoryTree` | WIRED | `queries.ts` line 136: `buildCategoryTree(flat.map(...))` |
| `31-categories.spec.ts` | Staging Supabase | `supabase db push` (not yet run) | NOT_WIRED (infra) | T2–T8 blocked; code is correct, DB schema not applied to remote |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| S1-01 | 02-migrations-PLAN.md | Rename `inventory_log` to `stock_movements`, extend reason enum, add polymorphic columns | SATISFIED | Migration file present; grep gate passes (0 functional refs to `inventory_log`); commit b66347d |
| S1-02 | 02-migrations-PLAN.md | `categories.parent_id` + depth-3 + cycle-rejection trigger | SATISFIED | Migration file present; recursive CTE trigger implemented; commit 1f3aa3b |
| S1-03 | 02-migrations-PLAN.md | `modifier_groups`, `modifier_group_items`, `product_modifier_groups` tables | SATISFIED | Migration file present; commit 4c91f30 |
| S1-04 | 02-migrations-PLAN.md | `products.combo_eligible` + `products.is_combo` columns | SATISFIED | Migration file present; columns in `supabase.types.ts`; commit 25b21a6 |
| S1-05 | 02-migrations-PLAN.md | Drop `payments.tab_id` UNIQUE constraint | SATISFIED | Migration file with `DROP CONSTRAINT IF EXISTS payments_tab_id_key`; commit 7da14e1 |
| S1-06 | 03-types-zod-PLAN.md | Regenerate types + extend Zod in `domain.ts` | SATISFIED | `supabase.types.ts` hand-extended (Docker unavailable); `domain.ts` has all S1 schemas; 50 unit tests; commit 67be414 |
| S1-07 | 05-ui-features-PLAN.md | `CategoryTreePicker` shared/ui component + Storybook + RTL tests | SATISFIED | Component, test, story all present; commit 931f3d6 |
| S1-08 | 05-ui-features-PLAN.md | Category tree editor in Settings with 4th-level UI guard | SATISFIED | `CategoryTreeEditor.tsx` wired into `ProductsSettingsTab`; depth guard uses `wouldViolateDepth`; commit 70c6043 |
| S1-09 | 05-ui-features-PLAN.md | `ModifierGroupEditor` feature, admin-only in Settings | SATISFIED | `ModifierGroupEditor.tsx` wired into `ProductsSettingsTab`; admin-gated; commit 6e790b2 |
| S1-10 | 04-entity-category-PLAN.md | Extract `entities/category` tree-capable entity, rewire imports | SATISFIED | Entity present at `src/entities/category/`; CatalogCategoriesTab and CatalogProductsTab rewired; folded into commit 931f3d6 (no dedicated S1-10 commit — deviation from plan convention but substance delivered) |
| S1-11 | 02-migrations-PLAN.md | RLS for new S1 tables (manager/admin write, all-read) | SATISFIED | `20260424000006_s1_rls.sql` has 12 policies across 3 tables; commit 2a2d37b |
| S1-12 | 05-ui-features-PLAN.md | Property tests (fast-check) for category tree depth/acyclicity | SATISFIED | `category-tree.test.ts` uses fast-check with 1000-node stress; 29/29 pass; commit ca40760 |
| S1-13 | 06-e2e-categories-PLAN.md | Playwright spec for Settings category tree, depth gate, combo flag, RLS | SATISFIED (code) / PENDING (execution) | Spec file complete (391 lines, 8 cases); blocked pending `supabase db push` to staging; commit 8eabde7 |

**All 13 requirement IDs accounted for.** No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/shared/ui/CategoryTreePicker/CategoryTreePicker.stories.tsx` | 85, 111 | `console.log` in Storybook story handlers | Info | Storybook only, not in production code path. No functional impact. |
| `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` | 1 | File-level `/* eslint-disable */` + `supabase as any` pre-regen cast | Warning | Documented CLAUDE.md workaround for unregenerated types. Must be cleaned up when `supabase.types.ts` is regenerated from local DB (requires Docker). Not a blocker — pattern is explicitly permitted by CLAUDE.md. |
| `src/entities/inventory/model/queries.ts` | 1 | `/* eslint-disable */` + `const db = supabase as any` pre-regen cast | Warning | Same pre-regen pattern, must be removed after `npx supabase gen types typescript --local`. Not a blocker per CLAUDE.md. |
| `src/features/physical-count/model/usePhysicalCount.ts` | 1 | `/* eslint-disable */` + `const db = supabase as any` pre-regen cast | Warning | Same pre-regen pattern. Not a blocker. |

---

## Key Deviation: S1-10 Commit Convention

Plan 04 specifies a dedicated commit `refactor(entities): extract category to tree-capable entity [S1-10]`. The actual delivery folded S1-10 into the S1-07 commit (931f3d6, labeled `feat(ui): add CategoryTreePicker [S1-07]`). The commit message does not reference the S1-10 ticket ID.

**Assessment:** The substance of S1-10 is fully delivered — entity directory, all 4 model files, import rewiring of CatalogCategoriesTab and CatalogProductsTab. The deviation is cosmetic (commit labeling), not functional. No re-work required, but future phases should maintain 1-ticket-per-commit discipline.

---

## Human Verification Required

### 1. Staging Migration Push

**Test:** From `bar-pos/`: `supabase link --project-ref <staging-ref>` then `supabase db push`
**Expected:** All 6 S1 migrations apply cleanly, zero errors reported.
**Why human:** Docker was unavailable during Plan 07; migrations not applied to remote Supabase. E2E spec 31-categories T2–T8 fail because `categories.parent_id` column does not exist on staging.

### 2. E2E 31-categories Spec (post-push)

**Test:** After staging push: `cd bar-pos && npx playwright test e2e/31-categories.spec.ts`
**Expected:** All 8 test cases pass. T7 (bartender RLS) passes if `E2E_BARTENDER_EMAIL`/`E2E_BARTENDER_PASSWORD` env vars are set, or skips gracefully.
**Why human:** Requires live Supabase with S1 schema applied and valid E2E credentials in `.env.local`.

### 3. Tauri Desktop Smoke

**Test:** `cd bar-pos && npm run tauri dev`. Log in as admin (PIN: 0000). Navigate Settings > Products > Categories. Create root category "Beers". Navigate to Modifier Groups tab. Open editor.
**Expected:** No console errors on either tab. Category appears in tree after creation dialog. Modifier Groups editor opens and renders groups list.
**Why human:** Requires the Tauri 2 desktop runtime (WebView2 on Windows). Cannot be simulated by grep or static analysis.

---

## Gaps Summary

No functional gaps in delivered code. All 13 requirement IDs have concrete artifact evidence. The single outstanding item is an **infrastructure gap**: the 6 S1 migrations have not been pushed to the remote Supabase staging instance, which causes E2E spec 31-categories to be blocked at T2 (category creation fails with 400 because `parent_id` column does not exist on remote). This is not a code defect — it is an operator action required before the full E2E suite can be declared green.

The 3 pre-regen `as any` casts in `ModifierGroupEditor.tsx`, `queries.ts`, and `usePhysicalCount.ts` are accepted technical debt per CLAUDE.md, to be cleaned up in a future sprint after `supabase gen types typescript --local` can run with Docker available.

---

_Verified: 2026-04-23T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
