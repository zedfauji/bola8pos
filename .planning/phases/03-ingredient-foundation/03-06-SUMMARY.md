---
phase: 03-ingredient-foundation
plan: "06"
subsystem: settings-ui
tags: [settings, ingredients, rbac, widget-composition]
dependency_graph:
  requires: ["03-05"]
  provides: ["Ingredients tab in SettingsTabsPanel for manager+ users"]
  affects: ["bar-pos/src/widgets/SettingsTabsPanel/index.tsx"]
tech_stack:
  added: []
  patterns: ["FSD widget-to-widget import via @widgets alias", "canManageProducts RBAC gate"]
key_files:
  created: []
  modified:
    - bar-pos/src/widgets/SettingsTabsPanel/index.tsx
decisions:
  - "Copied SettingsTabsPanel from main repo working dir (untracked) into worktree before modification — widget existed on disk but not in git history at worktree branch point"
  - "Fixed import order: @widgets/ManageIngredientsTab placed before @features/manage-combos to satisfy ESLint import/order rule"
  - "Deferred pre-existing lint errors in IngredientForm, IngredientsTable, ManageIngredientsTab, StockMovementsList to deferred-items — out of scope for this plan"
metrics:
  duration: "8 minutes"
  completed: "2026-04-23"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 11
---

# Phase 03 Plan 06: Settings Tab Wire-up Summary

**One-liner:** Wired ManageIngredientsTab into SettingsTabsPanel as an RBAC-gated Ingredients tab, making the ingredient management UI reachable from Settings for manager+ users.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Ingredients tab to SettingsTabsPanel | de2aedc | bar-pos/src/widgets/SettingsTabsPanel/index.tsx |

## What Was Built

- `SettingsTabsPanel/index.tsx` now imports `ManageIngredientsTab` from `@widgets/ManageIngredientsTab`
- A new tab entry `{ key: 'ingredients', label: 'Ingredients', render: () => <ManageIngredientsTab /> }` is inserted after the `combos` entry inside the `canManageProducts` block
- Bartenders (role without `manage_products`) see no Ingredients tab — the gate is enforced at the UI level; DB RLS is the defense-in-depth layer

## Acceptance Criteria Verified

- `grep "ManageIngredientsTab"` returns 2 matches: import line + render usage
- `grep "key: 'ingredients'"` returns 1 match
- `grep "label: 'Ingredients'"` returns 1 match
- `grep "@widgets/ManageIngredientsTab"` returns 1 match (import line)
- `npm run typecheck` exits 0
- No `SettingsTabsPanel` lint errors (import/order fixed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint import/order violation**
- **Found during:** Task 1 verification (lint run)
- **Issue:** Import of `@widgets/ManageIngredientsTab` was placed after `@features/manage-combos`, violating the FSD import order rule (widgets before features)
- **Fix:** Moved `@widgets/ManageIngredientsTab` import to line 2, before `@features/manage-combos`
- **Files modified:** bar-pos/src/widgets/SettingsTabsPanel/index.tsx
- **Commit:** de2aedc (included in task commit)

### Out-of-Scope Issues (Deferred)

Pre-existing lint errors from plans 03-04 and 03-05 were found during lint run. These are NOT introduced by this plan:
- `src/features/manage-ingredients/ui/IngredientForm.tsx` — 6 lint errors (unnecessary optional chains, setState in effect, autoFocus, unsafe assignment)
- `src/widgets/IngredientsTable/index.tsx` — 2 import/order errors
- `src/widgets/ManageIngredientsTab/index.tsx` — 2 import/order errors
- `src/widgets/StockMovementsList/index.tsx` — 2 unnecessary type assertion/condition errors

These were deferred and not fixed in this plan (scope boundary rule).

### Context Discovery

The `SettingsTabsPanel` widget existed on disk in the main repo's working directory but was untracked in git and absent from the worktree filesystem. It was copied into the worktree before modification. The full widget directory (index.tsx + test + 9 tab files) was committed as part of this plan — this brings the previously-untracked widget into the worktree's git history.

## Known Stubs

None — the Ingredients tab renders `ManageIngredientsTab` which is fully wired to live Supabase data (implemented in plan 03-05).

## Threat Surface Scan

The tab is correctly placed inside the `canManageProducts` block, consistent with the threat model entry T-03-15 (elevation of privilege). No new trust boundaries introduced.

## Self-Check: PASSED

- bar-pos/src/widgets/SettingsTabsPanel/index.tsx: FOUND (committed de2aedc)
- Commit de2aedc: FOUND in git log
- ManageIngredientsTab import: FOUND (line 2)
- Ingredients tab entry: FOUND (key: 'ingredients', inside canManageProducts block)
