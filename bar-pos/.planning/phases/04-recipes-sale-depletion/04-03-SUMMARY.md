---
phase: 04-recipes-sale-depletion
plan: "03"
subsystem: database, ui, entities
tags: [supabase, postgresql, tanstack-query, shadcn, cmdk, radix-ui, recipe, ingredient, rpc]

requires:
  - phase: 04-02
    provides: RecipeSchema/RecipeWithItemsSchema in domain.ts; supabase.types.ts extended with recipes/recipe_items/audit_log
  - phase: 04-01
    provides: deplete_for_order_item v1, recipes/recipe_items/audit_log tables

provides:
  - v2 migrations applied: create_order_with_items v2 (p_skip_depletion), deplete_for_order_item v2 (p_allow_negative + audit_log bypass), add_combo_to_tab depletion loop
  - entities/recipe/ FSD slice with useRecipe + useMutationSaveRecipe + RecipePreviewPanel
  - shared/ui/command.tsx (shadcn Command with cmdk)
  - shared/ui/popover.tsx (shadcn Popover with radix-ui)
  - shared/ui/input-group.tsx (InputGroup moved to shared layer)

affects: [04-04, 04-05, wave4-recipe-editor, wave4-ingredient-combobox]

tech-stack:
  added: [cmdk ^1.1.1 (already in package.json — activated), shadcn/command, shadcn/popover]
  patterns:
    - shadcn CLI output goes to src/app/components/ui/ — always move to src/shared/ui/ and fix @app/lib/utils → @shared/lib/utils
    - input-group.tsx role=group onClick uses eslint-disable-next-line (shadcn click-to-focus UX pattern)
    - Recipe entity uses db = supabase as any pre-regen cast (same as ingredient entity pattern)
    - useMutationSaveRecipe upsert+delete-all+insert-new replace strategy

key-files:
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
    - bar-pos/src/shared/ui/input-group.tsx
  modified:
    - bar-pos/src/shared/ui/index.ts

key-decisions:
  - "shadcn CLI always writes to src/app/components/ui/ — must move to src/shared/ui/ (FSD boundary; same as Plan 02-01 Collapsible)"
  - "input-group.tsx role=group onClick: eslint-disable-next-line for jsx-a11y (shadcn design pattern; keyboard users use inner input directly)"
  - "useMutationSaveRecipe: upsert+delete-all+insert-new (replace strategy — Wave 4 UI always saves full recipe)"
  - "RecipePreviewPanel shows ingredientId UUID (not name) — name requires join; Wave 4 form resolves via useIngredientsActive()"
  - "Migration 003: 6-arg overload of create_order_with_items (5-arg original coexists)"
  - "Migration 004: 3-arg overload of deplete_for_order_item (2-arg v1 coexists)"
  - "Migration 005: child IDs collected into uuid[] array during INSERT loop; depleted in second loop (avoids re-query)"

patterns-established:
  - "Recipe entity follows ingredient entity pattern: db = supabase as any; mapRecipeRow with schema.parse; staleTime 5min"
  - "shadcn components moved from app/ to shared/: fix @app/lib/utils → @shared/lib/utils; fix @app/components/ui/* → relative ./sibling"

requirements-completed: [S3b-03, S3b-06, S3b-08]

duration: 50min
completed: 2026-04-24
---

# Phase 04 Plan 03: v2 Migrations + Recipe Entity + shadcn Command/Popover Summary

**entities/recipe/ FSD slice (useRecipe + useMutationSaveRecipe) and shadcn Command/Popover moved to shared/ui; v2 migrations applied — Wave 4 recipe editor pre-requisites complete**

## Performance

- **Duration:** ~50 min (Task 1 in prior session + Task 3 in this session)
- **Started:** 2026-04-24T22:00:00Z
- **Completed:** 2026-04-24T23:10:00Z
- **Tasks:** 3 (Task 1 auto, Task 2 blocking checkpoint, Task 3 auto)
- **Files modified:** 15

## Accomplishments

- Three v2 SQL migration files written and applied to remote DB (migrations 003/004/005 all confirmed applied via checkpoint)
- entities/recipe/ entity built following ingredient entity pattern: useRecipe (byProduct maybeSingle), useMutationSaveRecipe (upsert-replace), RecipePreviewPanel, barrel index
- shadcn command.tsx and popover.tsx installed via CLI, moved from app/components/ui/ to shared/ui/, imports corrected to @shared/*
- input-group.tsx (Command dependency) moved to shared layer with corrected imports
- shared/ui/index.ts updated to export Command family (9 named exports) + Popover family (7 named exports)
- typecheck and lint both pass (0 errors, 0 warnings)

## Task Commits

1. **Task 1: Write migrations 003, 004, 005** — `408b82d` (feat)
2. **Task 2: [BLOCKING checkpoint] Apply migrations** — user confirmed applied; no commit
3. **Task 3: Recipe entity + shadcn command/popover** — `b9b6713` (feat)

**Plan metadata:** docs commit (this file)

## Files Created/Modified

**Migration files (Task 1):**
- `bar-pos/supabase/migrations/20260428000003_create_order_with_items_v2.sql` — create_order_with_items v2 with p_skip_depletion + depletion loop
- `bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql` — 3-arg overload with p_allow_negative + audit_log bypass
- `bar-pos/supabase/migrations/20260428000005_add_combo_to_tab_depletion.sql` — add_combo_to_tab updated with child depletion loop

**Recipe entity (Task 3):**
- `bar-pos/src/entities/recipe/model/queries.ts` — useRecipe + useMutationSaveRecipe TanStack Query hooks
- `bar-pos/src/entities/recipe/model/types.ts` — re-exports from domain.ts
- `bar-pos/src/entities/recipe/ui/RecipePreviewPanel.tsx` — read-only ingredient depletion list
- `bar-pos/src/entities/recipe/index.ts` — FSD public API barrel

**shadcn components (Task 3):**
- `bar-pos/src/shared/ui/command.tsx` — shadcn Command (cmdk-based; imports fixed to @shared/*)
- `bar-pos/src/shared/ui/popover.tsx` — shadcn Popover (radix-ui; imports fixed)
- `bar-pos/src/shared/ui/input-group.tsx` — InputGroup moved from app layer to shared layer
- `bar-pos/src/shared/ui/index.ts` — added Command family + Popover exports

## Decisions Made

- shadcn CLI output goes to `src/app/components/ui/` — must always move to `src/shared/ui/` and fix `@app/lib/utils` → `@shared/lib/utils`; this matches the FSD boundary (same pattern documented in 02-01 for Collapsible)
- input-group.tsx `role="group"` `onClick`: eslint-disable-next-line for `jsx-a11y` (shadcn design pattern; keyboard users interact with the inner `<input>` directly)
- useMutationSaveRecipe uses upsert+delete-all+insert-new replace strategy — simpler and correct for recipe editing; Wave 4 UI always saves full recipe

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shadcn-generated files with invalid @app/lib/utils imports**
- **Found during:** Task 3 (shadcn install + move)
- **Issue:** `npx shadcn@latest add command` installs to `src/app/components/ui/` with `@app/lib/utils` import alias that doesn't exist in this project; typecheck produced 7 errors
- **Fix:** Rewrote command.tsx, popover.tsx, input-group.tsx with corrected `@shared/lib/utils` and relative sibling imports; deleted shadcn-generated files from wrong location
- **Files modified:** shared/ui/command.tsx, shared/ui/popover.tsx, shared/ui/input-group.tsx
- **Verification:** `npm run typecheck` exits 0
- **Committed in:** b9b6713

**2. [Rule 1 - Bug] Fixed pre-existing import order lint errors in 4 unrelated files**
- **Found during:** Task 3 lint gate
- **Issue:** OrderPanel.tsx, PaymentPane.tsx, RefundsList/index.tsx, split-tab-rpc.integration.test.ts had import ordering violations and unused eslint-disable comments (pre-existing from Phase 6)
- **Fix:** Reordered imports; removed unused blanket `/* eslint-disable */` from split-tab integration test (test files have any-rules disabled globally in ESLint config) and unused disable from RefundsList
- **Files modified:** 4 pre-existing files
- **Verification:** `npm run lint` exits 0, 0 warnings
- **Committed in:** b9b6713

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required to pass lint gate (max-warnings: 0). No scope creep.

## Issues Encountered

- shadcn CLI always writes to `src/app/components/ui/` — this is a known pattern (documented in STATE.md decisions for 02-01 Collapsible). Manual move + import correction required every time shadcn is used.

## Known Stubs

- `RecipePreviewPanel` shows `item.ingredientId` (raw UUID) instead of ingredient name — intentional; the Wave 4 recipe editor form will resolve names via `useIngredientsActive()`. The panel is a read-only preview, not the editing UI.

## Threat Surface Scan

No new network endpoints introduced. Migration 004's `audit_log INSERT` is in SECURITY DEFINER context — client cannot bypass the audit trail when p_allow_negative=true (T-04-07 mitigated as planned).

## Self-Check

Files created (verified):
- bar-pos/supabase/migrations/20260428000003_create_order_with_items_v2.sql — FOUND
- bar-pos/supabase/migrations/20260428000004_deplete_for_order_item_v2.sql — FOUND
- bar-pos/supabase/migrations/20260428000005_add_combo_to_tab_depletion.sql — FOUND
- bar-pos/src/entities/recipe/model/queries.ts — FOUND
- bar-pos/src/entities/recipe/model/types.ts — FOUND
- bar-pos/src/entities/recipe/ui/RecipePreviewPanel.tsx — FOUND
- bar-pos/src/entities/recipe/index.ts — FOUND
- bar-pos/src/shared/ui/command.tsx — FOUND
- bar-pos/src/shared/ui/popover.tsx — FOUND
- bar-pos/src/shared/ui/input-group.tsx — FOUND

Commits verified:
- 408b82d (feat(04-03): write v2 migration files) — FOUND
- b9b6713 (feat(04-03): recipe entity + shadcn command/popover) — FOUND

## Self-Check: PASSED

## Next Phase Readiness

- Plan 04-04 (useOverrideNegativeStock feature) can now proceed — migrations 003/004 applied
- Wave 4 recipe editor (plan TBD) can import from `@entities/recipe` and use Command + Popover for ingredient combobox
- No blockers

---
*Phase: 04-recipes-sale-depletion*
*Completed: 2026-04-24*
