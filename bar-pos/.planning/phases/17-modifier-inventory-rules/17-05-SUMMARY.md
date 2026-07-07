---
phase: 17-modifier-inventory-rules
plan: 05
subsystem: ui
tags: [react, tanstack-query, fsd, dialog, shadcn, playwright]

# Dependency graph
requires:
  - phase: 17-modifier-inventory-rules (plan 03)
    provides: modifier_inventory_rules table + deplete_for_order_item v3 live in remote Supabase
  - phase: 17-modifier-inventory-rules (plan 04)
    provides: entities/modifier-inventory-rule FSD slice (useModifierInventoryRules, useMutationSaveModifierInventoryRules)
provides:
  - "manage-modifier-inventory-rules feature slice — per-modifier Ingredient rules dialog + toast save hook"
  - "CatalogModifiersTab per-row Ingredient rules button wired to the dialog"
  - "e2e/24-modifier-inventory-rules.spec.ts — automated UAT proof (add/save/reopen/negative-delta round-trip)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useReducer row-list editor cloned from RecipeEditorTab, renamed qty->delta, dropped yieldQty (no yield concept for modifier rules)"
    - "Signed delta Input: type=\"number\" step=\"0.001\" with NO min attribute — MoneyInput forbidden (clamps negatives to 0)"

key-files:
  created:
    - src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts
    - src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx
    - src/features/manage-modifier-inventory-rules/index.ts
    - bar-pos/e2e/24-modifier-inventory-rules.spec.ts
  modified:
    - src/features/manage-products/ui/CatalogModifiersTab.tsx

key-decisions:
  - "Delta hint/label rendered once above the row list (not per-row via FormField) to avoid visual clutter across N rows, while still surfacing the load-bearing signed-delta explanation from 17-UI-SPEC.md."
  - "Task 3 UAT satisfied via an orchestrator-authored Playwright e2e spec (e2e/24-modifier-inventory-rules.spec.ts) instead of literal manual browser click-through — automates the exact steps from the plan's how-to-verify list, including the negative-delta round-trip regression guard. Orchestrator ran it twice with no flakiness (1 passed, 40.6s) before relaying approval."

requirements-completed: [SC-3]

# Metrics
duration: ~30min
completed: 2026-07-07
---

# Phase 17 Plan 05: Modifier Inventory Rules — Admin UI Summary

**Per-modifier "Ingredient rules" dialog in Settings → Products → Modifiers, letting managers attach N ingredient rules with signed deltas (positive/negative round-trip correctly via a plain numeric input, never MoneyInput).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 automated tasks + 1 checkpoint (satisfied via automated e2e proof)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `features/manage-modifier-inventory-rules/` slice created: `ModifierIngredientRulesDialog` (row-list editor cloned from `RecipeEditorTab`'s `useReducer` pattern, dialog chrome cloned from `CatalogModifiersTab`'s `ModifierDialog`) + `useManageModifierInventoryRules` (toast-wrapping save hook) + explicit-export barrel.
- Delta input is a plain `type="number" step="0.001"` field with **no `min` attribute** — the explicit regression guard against Pitfall 3 (MoneyInput clamps negatives to 0), since delta is signed.
- `CatalogModifiersTab.tsx` gains a per-row `FlaskConical` "Ingredient rules" button opening the dialog scoped to that modifier — mirrors the existing Edit/Delete `POSButton` cluster and the `CatalogProductsTab` → `RecipeEditorTab` cross-feature import precedent.
- SC-3 satisfied: managers can now configure per-modifier inventory depletion rules from the UI (previously SQL-only).
- Automated UAT via `e2e/24-modifier-inventory-rules.spec.ts` (added by the orchestrator, committed here): logs in as admin, opens the dialog for a real modifier, adds a positive-delta and a negative-delta ingredient row, saves, reopens and asserts both rows persisted exactly (`-1`, not clamped to `0`), verifies Save-button dirty/clean gating and row-remove behavior, logs out. Ran twice with no flakiness (1 passed, 40.6s).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create manage-modifier-inventory-rules feature (dialog + save hook + barrel)** - `ad9098a` (feat)
2. **Task 2: Wire the "Ingredient rules" button + dialog into CatalogModifiersTab** - `ed03b83` (feat)
3. **Task 3: [UAT] automated e2e proof (in place of manual click-through)** - `b3279c7` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts` - Toast-wrapping save hook over `useMutationSaveModifierInventoryRules` (`Ingredient rules saved` success toast, `toast.error` on failure).
- `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx` - Dialog + `useReducer` row-list editor (add/remove/select-ingredient/set-delta), signed delta input, empty-state/loading/dirty-gating states per 17-UI-SPEC.md.
- `src/features/manage-modifier-inventory-rules/index.ts` - Explicit named-export barrel.
- `src/features/manage-products/ui/CatalogModifiersTab.tsx` - Added `FlaskConical` per-row button + `rulesModifier` state + rendered `ModifierIngredientRulesDialog`.
- `bar-pos/e2e/24-modifier-inventory-rules.spec.ts` - Automated UAT spec (add/save/reopen/negative-delta round-trip/dirty-gating/row-remove).

## Decisions Made

- Cloned `RecipeEditorTab.tsx`'s `useReducer` row-list shape verbatim per the plan, renaming `qty` → `delta` and dropping `yieldQty` entirely (no yield concept for modifier rules).
- Rendered the "Delta" label + signed-delta hint once above the row list rather than wrapping each row's input in its own `FormField` instance — keeps the load-bearing hint text visible without repeating it N times per row; each row's `Input` still carries `aria-label="Delta"` for accessibility/testability (used directly by the e2e spec's `getByLabel('Delta')`).
- Task 3's blocking `checkpoint:human-verify` was satisfied via an automated Playwright e2e spec (orchestrator-authored, run twice with no flakiness) rather than literal manual browser click-through, per an explicit course-correction relayed by the orchestrator. The spec covers every step in the plan's `how-to-verify` list, including the Pitfall 3 negative-delta regression guard.

## Deviations from Plan

**1. [Process deviation, orchestrator-directed] Task 3 UAT method changed from manual click-through to automated Playwright e2e**
- **Found during:** Task 3 (checkpoint)
- **Issue:** The plan specified a blocking `checkpoint:human-verify` requiring a human to manually click through the dev app UI.
- **Change:** The orchestrator wrote and ran `e2e/24-modifier-inventory-rules.spec.ts`, which automates every step in the plan's `how-to-verify` list (dialog open, empty state, add positive + negative delta rows, save, toast, reopen + assert round-trip including the `-1` regression guard, dirty/clean Save gating, row-remove, logout). Result: 1 passed (40.6s), stable across 2 runs (an initial locator bug in the test itself was found and fixed before the passing runs).
- **Files added:** `bar-pos/e2e/24-modifier-inventory-rules.spec.ts`
- **Commit:** `b3279c7`
- **Not executed by this agent:** the manual RLS spot-check for a bartender-role write attempt (plan step 7, marked "Optional") was not covered by the automated spec and was not separately verified.

---

**Total deviations:** 1 (process/verification-method change, orchestrator-directed — not a code deviation)
**Impact on plan:** No code scope creep. SC-3's functional requirements (add/remove/save/persist N rules with signed deltas, correct round-trip) are proven by the automated spec with the same rigor as the planned manual steps.

## Issues Encountered

None on the implementation side. `npm run typecheck` exits with only the 2 pre-existing, out-of-scope errors documented since Phase 17-03 (`tab/model/queries.ts:778`, `agent/rag.ts:60`); `npm run lint` is clean on all touched files; full unit suite is 1187 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`, documented since Phase 15) / 15 todo — no regressions.

## User Setup Required

None. No new migrations, environment variables, or external service configuration — this plan is UI-only, built entirely on the `modifier_inventory_rules` table and entity slice already live from plans 17-03/17-04.

## Next Phase Readiness

- Phase 17 (modifier-inventory-rules) is now feature-complete for its planned scope: SC-1 through SC-4 all satisfied across plans 17-03/17-04/17-05.
- No blockers identified for subsequent phases.

---
*Phase: 17-modifier-inventory-rules*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all task commits (`ad9098a`, `ed03b83`, `b3279c7`) confirmed present in git history.
