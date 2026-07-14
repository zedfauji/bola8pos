---
phase: 03-ingredient-foundation
plan: "05"
subsystem: widgets
tags: [fsd, widget, feature, tanstack-query, ingredient, crud, stock-movements, typescript]
dependency_graph:
  requires:
    - "03-03: entities/ingredient — useIngredients, useStockMovements, ingredientKeys, Ingredient, IngredientCreate"
    - "03-04: features/adjust-stock-movement — AdjustStockMovementDialog; features/import-ingredients-csv — CsvImportSheet"
  provides:
    - "widgets/IngredientsTable — 8-column DataTable with low-stock row highlight, toolbar, row-click edit"
    - "widgets/StockMovementsList — read-only ledger DataTable with delta color coding"
    - "features/manage-ingredients — IngredientForm (create/edit controlled form, 8 fields)"
    - "widgets/ManageIngredientsTab — full Settings tab: CRUD dialogs, adjust dialog, CSV import"
  affects:
    - "widgets/SettingsTabsPanel (Plan 03-06 — adds Ingredients tab entry)"
tech_stack:
  added: []
  patterns:
    - "Native <select> with optgroup (no @shared/ui/select — not installed); same Tailwind class as AdjustStockMovementDialog"
    - "Discriminated DialogState union (create/edit/delete/adjust) — no boolean flags"
    - "Soft delete via update({ is_active: false }) — preserves ledger history"
    - "supabase as any pre-regen cast with eslint-disable comment (widgets layer)"
    - "EmptyState action prop: { label, onClick } object (not JSX node)"
    - "React.SyntheticEvent<HTMLFormElement> for form submit — consistent with Phase 03-04 pattern"
    - "StockMovementsList rendered inside edit Dialog below border-t divider"
key_files:
  created:
    - bar-pos/src/widgets/IngredientsTable/index.tsx
    - bar-pos/src/widgets/StockMovementsList/index.tsx
    - bar-pos/src/features/manage-ingredients/ui/IngredientForm.tsx
    - bar-pos/src/features/manage-ingredients/index.ts
    - bar-pos/src/widgets/ManageIngredientsTab/index.tsx
  modified: []
decisions:
  - "Used native <select>/<optgroup> for UOM pickers — @shared/ui/select not installed; consistent with AdjustStockMovementDialog (03-04 decision)"
  - "IngredientForm stays at features/manage-ingredients/ui/ — no widget imports needed; ManageIngredientsTab promoted to widgets/ because it imports IngredientsTable + StockMovementsList from @widgets/*"
  - "EmptyState action uses { label, onClick } object API (required by component) — not JSX node as plan template showed"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
requirements:
  - S3a-07
---

# Phase 03 Plan 05: UI Widgets — IngredientsTable + StockMovementsList + ManageIngredientsTab Summary

**One-liner:** IngredientsTable (8 columns, low-stock bg-pos-danger/10 row class, toolbar CTAs) + StockMovementsList (pos-accent/pos-danger delta colors, newest-first) + IngredientForm (8 controlled fields, native optgroup selects) + ManageIngredientsTab (discriminated union dialog state, 3 mutations, soft delete, ledger below edit form) — all typecheck and lint clean.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | widgets/IngredientsTable + widgets/StockMovementsList | 4f82136 | IngredientsTable/index.tsx, StockMovementsList/index.tsx |
| 2 | IngredientForm (feature) + ManageIngredientsTab (widget) | bd43508 | IngredientForm.tsx, manage-ingredients/index.ts, ManageIngredientsTab/index.tsx |

## Verification Results

- `npm run typecheck`: PASS (0 errors)
- `npm run lint`: PASS (0 errors, 0 warnings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EmptyState action prop is `{ label, onClick }` object, not JSX node**
- **Found during:** Task 1 read-first phase (DataTable.tsx + EmptyState.tsx)
- **Issue:** The plan template shows `action={<Button>...</Button>}` JSX but `EmptyState` accepts `action: { label: string; onClick: () => void }` object
- **Fix:** Used `action={{ label: 'Add ingredient', onClick: onAddClick }}` in IngredientsTable emptyState
- **Files modified:** `IngredientsTable/index.tsx`
- **Commit:** 4f82136

**2. [Rule 2 - Missing functionality] @shared/ui/select not installed — native select used**
- **Found during:** Task 2 read-first phase
- **Issue:** Plan imports `Select, SelectGroup, SelectContent, SelectTrigger, SelectValue` from `@shared/ui/select` but that file does not exist in the project
- **Fix:** Used native `<select>`/`<optgroup>` elements with the same Tailwind `SELECT_CLASS` string as AdjustStockMovementDialog (established pattern from Plan 03-04)
- **Files modified:** `IngredientForm.tsx`
- **Commit:** bd43508

**3. [Rule 1 - Bug] Plan template used `React.FormEvent` — replaced with `React.SyntheticEvent<HTMLFormElement>`**
- **Found during:** Task 2 implementation — consistency check with 03-04 deviation #2
- **Issue:** `@typescript-eslint/no-deprecated` flags `React.FormEvent` as deprecated
- **Fix:** Used `React.SyntheticEvent<HTMLFormElement>` in `handleSubmit` — same fix applied in 03-04
- **Files modified:** `IngredientForm.tsx`
- **Commit:** bd43508

## Known Stubs

None — all components are fully wired:
- `IngredientsTable` reads from `ingredients` prop (supplied by `useIngredients()` in ManageIngredientsTab)
- `StockMovementsList` calls `useStockMovements(ingredientId)` directly — live data
- `IngredientForm` calls `onSubmit` which triggers real Supabase mutations
- `ManageIngredientsTab` mutations call real Supabase insert/update via `supabase as any` pre-regen cast

## Threat Flags

None — no new network endpoints beyond those in the plan's `<threat_model>`. T-03-13 (elevation of privilege) is mitigated by RLS `manager_admin_write_ingredients` at DB layer; RBAC UI gate (Plan 03-06 SettingsTabsPanel) will hide tab from bartenders. T-03-14 (client validation bypass) is mitigated by `IngredientCreateSchema` Zod parse in entity layer + DB CHECK constraints as final gate.

## Self-Check: PASSED

- `bar-pos/src/widgets/IngredientsTable/index.tsx`: FOUND
- `bar-pos/src/widgets/StockMovementsList/index.tsx`: FOUND
- `bar-pos/src/features/manage-ingredients/ui/IngredientForm.tsx`: FOUND
- `bar-pos/src/features/manage-ingredients/index.ts`: FOUND
- `bar-pos/src/widgets/ManageIngredientsTab/index.tsx`: FOUND
- Commit 4f82136 (IngredientsTable + StockMovementsList): FOUND
- Commit bd43508 (IngredientForm + ManageIngredientsTab): FOUND
- typecheck PASS, lint PASS: VERIFIED
