---
phase: "04"
plan: "05"
subsystem: recipes-sale-depletion
tags: [manage-recipe, recipe-editor, product-dialog, seed-data]
dependency_graph:
  requires: [04-03, 04-04]
  provides: [manage-recipe-feature, recipe-tab-in-product-dialog, seed-recipes-script]
  affects: [features/manage-products, features/manage-recipe, scripts]
tech_stack:
  added: []
  patterns: [useReducer-for-multi-state-sync, feature-barrel-export, service-role-seed-script]
key_files:
  created:
    - bar-pos/src/features/manage-recipe/model/useManageRecipe.ts
    - bar-pos/src/features/manage-recipe/ui/RecipeEditorTab.tsx
    - bar-pos/src/features/manage-recipe/index.ts
    - bar-pos/scripts/seed-recipes.ts
  modified:
    - bar-pos/src/features/manage-products/ui/CatalogProductsTab.tsx
decisions:
  - useReducer replaces multiple useState calls in RecipeEditorTab to satisfy react-hooks/set-state-in-effect ESLint rule — single dispatch from useEffect avoids the violation
  - RecipeEditorTab fetches ingredients via useIngredientsActive() internally (features can import from entities); passes them as ingredients prop to IngredientAutocomplete (FSD boundary: shared cannot import from entities)
  - seed-recipes.ts follows seed-combos.ts pattern — loads VITE_SUPABASE_URL from .env.local, eslint-disable at file level, supabase as any cast
  - Import order in CatalogProductsTab: @features/* before @entities/* per ESLint import/order rule
metrics:
  duration: "10min"
  completed: "2026-04-24"
  tasks: 3
  files: 5
---

# Phase 04 Plan 05: manage-recipe Feature + Recipe Tab + Seed Data Summary

Full recipe editing UX wired end-to-end: useManageRecipe hook + RecipeEditorTab component added to the product edit Dialog via a Tabs wrapper; seed-recipes.ts creates Michelada, Alitas, and Hotdog recipes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create manage-recipe feature | 721ed6b | useManageRecipe.ts, RecipeEditorTab.tsx, index.ts |
| 2 | Add Recipe tab to CatalogProductsTab | 03ba13a | CatalogProductsTab.tsx |
| fix | Lint fixes (import order + useReducer) | d6828a2 | CatalogProductsTab.tsx, RecipeEditorTab.tsx |
| 3 | Create seed-recipes.ts | 3ff88bc | scripts/seed-recipes.ts |

## What Was Built

### `useManageRecipe` (features/manage-recipe/model)
Thin wrapper around `useMutationSaveRecipe` from `@entities/recipe`. Returns `saveRecipe(input)` and `isSaving`. Handles toast feedback: `toast.success('Recipe saved')` on success, `toast.error(message)` on failure.

### `RecipeEditorTab` (features/manage-recipe/ui)
Two-column recipe editor (`grid-cols-1 gap-6 md:grid-cols-[1fr_260px]`):
- **Left column:** ingredient rows (IngredientAutocomplete + qty Input + remove button), "+ Add ingredient" button
- **Right column:** Yield (servings) input, Save/Discard buttons, depletion preview via RecipePreviewPanel
- State managed with `useReducer` to satisfy `react-hooks/set-state-in-effect` rule
- Ingredients fetched via `useIngredientsActive()` and passed as prop to `IngredientAutocomplete`
- Copy strings exactly match UI-SPEC: "No recipe yet", "Save recipe", "Discard changes", "+ Add ingredient"

### CatalogProductsTab (modified)
- Edit Dialog widened: `max-w-md sm:max-w-md` → `max-w-2xl sm:max-w-2xl`
- ProductForm wrapped in `<TabsContent value="details">`
- New `<TabsContent value="recipe">` containing `<RecipeEditorTab productId={editProduct.id} productName={editProduct.name} />`
- Create Dialog unchanged at max-w-md

### seed-recipes.ts
Seeds 3 recipes using service role key from `.env.local`. Idempotent (upsert recipe + delete-then-insert items). Warns on missing product/ingredient without crashing. Run with `npx tsx scripts/seed-recipes.ts`.

| Recipe | Yield | Ingredients |
|--------|-------|-------------|
| Michelada | 1 | Beer 0.355, Lime juice 0.5, Clamato 2, Salt 0.5 |
| Alitas | 1 | Chicken wings 6, Buffalo sauce 2 |
| Hotdog | 1 | Hot dog bun 1, Hot dog sausage 1 |

Ingredient names must match exactly what is in the `ingredients` table. Mismatches print a warning and skip that ingredient. The seed script was NOT run against the remote DB during this plan execution (no remote credentials available in this context) — ingredient name matches depend on the seed-ingredients.ts data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `ingredients` prop to IngredientAutocomplete**
- **Found during:** Task 1
- **Issue:** Plan's RecipeEditorTab code called `<IngredientAutocomplete value={...} onSelect={...} onClear={...} />` without passing `ingredients` prop. Since Plan 04-04 changed the component to receive ingredients as props (FSD boundary: shared cannot import from entities), the component would always show an empty dropdown.
- **Fix:** Added `useIngredientsActive()` call in `RecipeEditorTab` and passed `ingredients={ingredients} isLoading={ingredientsLoading}` to each `IngredientAutocomplete` instance.
- **Files modified:** `bar-pos/src/features/manage-recipe/ui/RecipeEditorTab.tsx`

**2. [Rule 1 - Bug] `react-hooks/set-state-in-effect` ESLint violation**
- **Found during:** Lint run after Task 1
- **Issue:** Multiple `setState` calls inside `useEffect` triggered the `react-hooks/set-state-in-effect` ESLint rule (max-warnings: 0 fails the build).
- **Fix:** Replaced three `useState` variables (rows, yieldQty, isDirty) + multi-setState in useEffect with a single `useReducer`. The `useEffect` now dispatches a single `RESET` action. All state transitions are pure functions in the reducer.
- **Commit:** d6828a2

**3. [Rule 1 - Bug] Import order violation in CatalogProductsTab**
- **Found during:** Lint run after Task 2
- **Issue:** `@features/manage-recipe` was placed after `@entities/*` imports, violating the `import/order` rule (features layer > entities layer in FSD).
- **Fix:** Moved `@features/manage-recipe` import before `@entities/category`.
- **Commit:** d6828a2

## Known Stubs

None — all plan goals achieved. RecipeEditorTab is fully wired. The `ingredientName` field in RecipeRow is initialized from `item.ingredientId` (UUID) when loading from savedRecipe (since `recipe_items` only stores `ingredient_id`, not the name). This is a display cosmetic only — the autocomplete component resolves the correct name by matching the ingredient list by ID. The ingredientName field in the row type is used only for fallback display and is immediately overwritten when the user interacts with the autocomplete.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `seed-recipes.ts` uses service role key — documented in file header warning. RLS enforced server-side for all recipe writes from the UI (T-04-01 mitigated via existing RLS policies from Plan 04-01).

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `grep -c "max-w-2xl" CatalogProductsTab.tsx` | 1 (edit Dialog only) |
| `grep -c "RecipeEditorTab" CatalogProductsTab.tsx` | 2 (import + usage) |
| `grep -c "No recipe yet" RecipeEditorTab.tsx` | 1 |
| Manual: Recipe tab visible in product edit dialog | Pending human verification |

## Self-Check: PASSED

Files created/exist:
- bar-pos/src/features/manage-recipe/model/useManageRecipe.ts: FOUND
- bar-pos/src/features/manage-recipe/ui/RecipeEditorTab.tsx: FOUND
- bar-pos/src/features/manage-recipe/index.ts: FOUND
- bar-pos/scripts/seed-recipes.ts: FOUND
- bar-pos/src/features/manage-products/ui/CatalogProductsTab.tsx: FOUND (modified)

Commits: 721ed6b, 03ba13a, d6828a2, 3ff88bc — all present in git log.
