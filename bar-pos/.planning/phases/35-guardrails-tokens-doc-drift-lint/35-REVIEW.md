---
phase: 35-guardrails-tokens-doc-drift-lint
reviewed: 2026-07-17T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - eslint-rules/no-ui-drift.js
  - scripts/generate-design-tokens.ts
  - src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx
  - src/features/manage-categories/ui/CategoryTreeEditor.tsx
  - src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx
  - src/features/manage-products/ui/CategoryForm.tsx
  - src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx
  - src/features/manage-recipe/ui/RecipeEditorTab.tsx
  - src/features/produce-prep-batch/ui/PrepBatchPreview.tsx
  - src/widgets/InventoryPagePanel.tsx
  - src/widgets/PaymentModal/ui/PaymentForm.tsx
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

`eslint-rules/no-ui-drift.js` and `scripts/generate-design-tokens.ts` are sound — the selectors match the documented audit-script regexes 1:1, and the token generator's `:root` regex correctly targets only the first (light-mode) block, ignoring the `@media (prefers-color-scheme: dark)` `:root` override as intended. No issues found in either.

The nine feature/widget files carry real defects. The most serious is in `InventoryPagePanel.tsx`: the inline per-row stock-quantity stepper rendered by `inventoryRowColumns` is never gated by RBAC (`ProtectedAction`/`adjust_inventory`), unlike the neighboring "Adjust" and "Export CSV" buttons — any authenticated role, including `bartender`, can mutate inventory quantities directly from the table, and does so under a hardcoded placeholder staff UUID when nobody is signed in, corrupting the audit trail instead of blocking the write. Several other files (`PaymentForm.tsx`, `RecipeEditorTab.tsx`, `ModifierIngredientRulesDialog.tsx`, `PromotionAvailabilityEditor.tsx`) share a "sync remote data into local draft state" pattern that either silently discards unsaved user edits or fails to enforce validation it displays. `CategoryTreeEditor.tsx` has a keyboard-accessibility regression (`tabIndex={-1}` with no alternative activation path) that contradicts the project's own focus-visible/touch-target conventions.

## Critical Issues

### CR-01: Inline inventory quantity adjuster bypasses RBAC entirely

**File:** `src/widgets/InventoryPagePanel.tsx:102-105` (columns wired via `inventoryRowColumns`, rendered in the `DataTable` at line 256)
**Issue:** The "Adjust" and "Export CSV" toolbar buttons are correctly wrapped in `<ProtectedAction action="adjust_inventory" ...>` (lines 225-247), but the per-row quantity stepper column produced by `inventoryRowColumns(staffId)` and rendered inside `DataTable` has no RBAC gate at all. `QuantityAdjustCell` (in `entities/inventory/ui/InventoryRow.tsx`, wired from this file) calls `adjustMutation.mutate(...)` directly on every `+`/`-` click. Per `CLAUDE.md`, "Inventory page requires `adjust_inventory` (manager+)", but `/inventory` is only auth-gated (`ProtectedRoute`), not role-gated (confirmed in `src/pages/inventory/index.tsx` and `src/app/ProtectedRoute.tsx`). Any authenticated `bartender` can therefore adjust stock quantities inline, completely bypassing the RBAC boundary the rest of the page respects.
**Fix:**
```tsx
// InventoryPagePanel.tsx
const canAdjust = canAccess(currentRole, 'adjust_inventory');

const columns = useMemo(
  () => inventoryRowColumns(staffId || '00000000-0000-0000-0000-000000000001', canAdjust),
  [staffId, canAdjust]
);
```
and in `inventoryRowColumns`/`QuantityAdjustCell`, disable/replace the stepper with a read-only value when `canAdjust` is `false` (mirroring how `ProtectedAction` disables the batch "Adjust" button).

### CR-02: Unauthenticated writes silently attributed to a hardcoded placeholder staff ID

**File:** `src/widgets/InventoryPagePanel.tsx:102-105`
**Issue:** `staffId || '00000000-0000-0000-0000-000000000001'` is used to build the columns passed into the per-row adjuster. Unlike `handleBatchSubmit` (line 168-170), which correctly blocks with `toast.error('Sign in to adjust inventory.')` when `staffId` is empty, the inline stepper has no such guard — if `staffId` is empty (session not yet hydrated, or logged out mid-session), any inline adjustment silently succeeds and is recorded against a fake, non-existent staff UUID instead of being blocked. Combined with CR-01, this means an inventory mutation can be made with no real signed-in identity attached, corrupting the audit trail (`inventory` change log shown just below it lists `Staff ID` per row).
**Fix:** Pass `staffId` (real value, possibly empty) straight through, and block/disable the control when empty instead of substituting a placeholder:
```tsx
const columns = useMemo(() => inventoryRowColumns(staffId, canAdjust), [staffId, canAdjust]);
// inside QuantityAdjustCell: disable the stepper entirely when !staffId, don't fall back to a fake id
```

## Warnings

### WR-01: Card-charge override silently zeroes the recorded tip

**File:** `src/widgets/PaymentModal/ui/PaymentForm.tsx:333-334`
**Issue:** `const chargeTip = cardChargeOverride !== null ? 0 : tipAmount;` — whenever a manager overrides the card charge amount (e.g. to correct a terminal rounding difference), the tip recorded for that payment is silently forced to `0`, with no warning shown to the cashier that the tip they configured above (preset/custom, still visible in the UI) will not actually be recorded. This directly affects `tip_distribution_entries` (per `CLAUDE.md`, tips are pooled across payment methods for floor/bar/kitchen split reporting), so an overridden card charge quietly removes that transaction's tip from the pool.
**Fix:** Either fold the configured tip into the override default (`cardChargeOverride ?? runningTotal` already includes tip pre-override) and keep `chargeTip = tipAmount` unconditionally, or surface an explicit warning/confirm when overriding removes a non-zero tip.

### WR-02: Payment-form reset effect depends on a non-primitive array reference from query data

**File:** `src/widgets/PaymentModal/ui/PaymentForm.tsx:172-209`
**Issue:** The full-state reset effect (wipes `step`, `errorMessage`, `method`, tip/discount/split state) lists `tipPresets` — `settings?.billing.defaultTipPercentages ?? DEFAULT_TIP_PRESETS`, a new array read out of TanStack Query `data` — directly in its dependency array. TanStack Query's default structural sharing currently protects this (unchanged data keeps the same array reference), but that protection is incidental, not enforced by this file. If the settings query's shape ever changes, or structural sharing is turned off, any background refetch of settings (e.g. window refocus) while a cashier is mid-entry on a split payment would silently wipe all unsaved payment state.
**Fix:** Depend on a primitive derived from the array instead of the array itself, e.g. `tipPresets.join(',')`, or move the tip-preset seeding out of this all-resetting effect into its own effect keyed only on `tab.id`.

### WR-03: "Sync from server" pattern discards unsaved edits with no dirty check

**File:** `src/features/manage-recipe/ui/RecipeEditorTab.tsx:116-122`, `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx:106-112`
**Issue:** Both components reset their entire local draft (`dispatch({ type: 'RESET', ... })`) whenever the underlying query object reference changes, with no check against `state.isDirty`. If the recipe/rules are edited concurrently from another terminal (a scenario this project explicitly tests for elsewhere — `e2e/39-concurrent-edits.spec.ts`) while a user has unsaved changes open in this editor, the incoming refetch silently overwrites their in-progress edits with no warning.
**Fix:** Guard the reset with the dirty flag, or prompt before overwriting:
```tsx
useEffect(() => {
  if (savedRecipe !== prevRecipeRef.current) {
    prevRecipeRef.current = savedRecipe;
    if (!state.isDirty) dispatch({ type: 'RESET', savedRecipe });
  }
}, [savedRecipe, state.isDirty]);
```

### WR-04: Displayed time-window validation error is never enforced on save

**File:** `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx:78-82, 138-140, 236-238`
**Issue:** `hasTimeError` (end time <= start time) is computed per row and rendered as an inline error message, but `handleSave`/`saveMutation.mutate(drafts)` never checks it — a window with an invalid (or equal) start/end time is written straight to `promotion_availability` regardless of the on-screen warning.
**Fix:**
```tsx
function handleSave() {
  const invalid = drafts.some(
    d => d.daysOfWeek.length > 0 && d.startTime && d.endTime && d.endTime <= d.startTime
  );
  if (invalid) {
    toast.error('Fix invalid time windows before saving.');
    return;
  }
  saveMutation.mutate(drafts);
}
```

### WR-05: Category tree expand/collapse toggle is unreachable by keyboard

**File:** `src/features/manage-categories/ui/CategoryTreeEditor.tsx:168-189`
**Issue:** The expand/collapse `Button` for a tree node is given `tabIndex={-1}` (line 181), permanently removing it from the tab order. There is no alternative keyboard mechanism (e.g. Enter/Space on the row, arrow-key navigation) to expand or collapse a subcategory. Keyboard-only users can reach "Edit"/"Add subcategory" for a node but can never see its children. This contradicts the project's own focus-visible/keyboard-navigation conventions (Phase 32/33 touch-target sweep, `e2e/44-focus-tab-order.spec.ts`).
**Fix:** Remove `tabIndex={-1}` (or make the whole row's `Button`s reachable and give the toggle a real keyboard affordance), and add it to the relevant focus-order regression coverage.

### WR-06: `ingredientName` seeded with the ingredient UUID instead of its name

**File:** `src/features/manage-recipe/ui/RecipeEditorTab.tsx:38-45`
**Issue:** `rowsFromRecipe` sets `ingredientName: item.ingredientId` — the raw UUID, not the ingredient's display name (`RecipeItemSchema` has no `name` field to read from). The field is written correctly elsewhere (`SELECT_INGREDIENT` sets it from `action.ingredient.name`), but on initial load from a saved recipe it holds a UUID. It's currently unused for rendering (`IngredientAutocomplete` resolves its own display name from `ingredients.find(i => i.id === value)`), so this is presently dead/inert, but it's a landmine: any future code that reads `row.ingredientName` for display will show a UUID for previously-saved rows.
**Fix:** Resolve the name from the loaded `ingredients` list when building rows from a saved recipe, or drop the unused field entirely if it will never be read.

### WR-07: Inventory CSV export doesn't neutralize spreadsheet formula characters

**File:** `src/widgets/InventoryPagePanel.tsx:47-52, 54-86`
**Issue:** `escapeCsvField` only escapes `"`, `,`, and `\n` for CSV quoting; it does not neutralize leading `=`, `+`, `-`, or `@` characters. Product/category names are free-text user input (via `manage-products`), and this CSV is designed to be opened by staff (`inventory-YYYY-MM-DD.csv`, likely in Excel). A product or category named e.g. `=HYPERLINK(...)` would be exported verbatim and could execute as a formula/DDE payload when opened in Excel — a known CSV/formula-injection class.
**Fix:** Prefix a leading `'` (or space) when the first character of a field is one of `=+-@`:
```ts
function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}
```

## Info

### IN-01: Duplicated row-id-counter/reducer boilerplate

**File:** `src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx:34-38`, `src/features/manage-recipe/ui/RecipeEditorTab.tsx:32-36`, `src/widgets/PaymentModal/ui/PaymentForm.tsx:53-57`
**Issue:** All three files independently declare a module-level `let ...Counter = 0` plus a `next...Id()` function with identical shape, purely to generate stable React keys for locally-added rows.
**Fix:** Extract a single `makeIdCounter(prefix: string)` helper into `shared/lib` and reuse it.

### IN-02: Two divergent "CategoryForm" implementations for the same domain entity

**File:** `src/features/manage-categories/ui/CategoryTreeEditor.tsx:57-133` (local `CategoryForm`), `src/features/manage-products/ui/CategoryForm.tsx`
**Issue:** Two independently-maintained category create/edit forms exist with diverging behavior: the tree editor auto-computes `sortOrder` from sibling count and defaults `color` to `#6366f1`, while `manage-products/ui/CategoryForm.tsx` lets the user type an arbitrary `sortOrder` and defaults `color` to `#6B7280`. Bug fixes or validation changes made to one will not propagate to the other.
**Fix:** Consolidate on one shared category form component, or explicitly document why the two flows intentionally differ.

### IN-03: Lenient `parseFloat` accepts trailing garbage as a valid delta

**File:** `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx:52-55`
**Issue:** `parseFloat(delta)` treats `"5abc"` as `5` (not `NaN`), so the `isNaN` guard doesn't catch malformed input; only fully non-numeric strings are rejected.
**Fix:** Validate with a stricter pattern (e.g. `/^-?\d+(\.\d+)?$/.test(delta.trim())`) before calling `parseFloat`.

### IN-04: False "insufficient stock" flag on a zero-need row with no stock record

**File:** `src/features/produce-prep-batch/ui/PrepBatchPreview.tsx:36-38`
**Issue:** `const isInsufficient = stock ? stock.qty < need : true;` — when an ingredient has no `currentStock` entry and `need` is `0` (e.g. `qtyProduced` not yet entered by the user), the row is still flagged insufficient even though nothing is actually needed yet.
**Fix:** `const isInsufficient = need > 0 && (stock ? stock.qty < need : true);`

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
