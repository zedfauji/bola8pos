# Phase 31: Component, Token & Spacing Consistency Sweep - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 26 (16 button files, 8 input files, 3 hex-color files [2 files overlap with input list], 1 duplicate-primitive deletion)
**Analogs found:** 26 / 26 (every target primitive already exists in-repo; this is a pure conformance sweep — no "no analog" files)

This phase requires no external analog search: `31-UI-SPEC.md` and `31-RESEARCH.md` already pin an exact target primitive + exact current code per file. This document restates that mapping in planner-consumable form, adding the already-compliant in-repo consumer of each target primitive as the "analog to copy" (per Step 3's ranking: same role + same data flow, most recently touched).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/agent-chat/ui/AgentButton.tsx` | component (icon button) | request-response (onClick) | `src/widgets/HomeDashboard/ui/HomeDashboard.tsx:156` (Button, custom className preserved) | exact |
| `src/features/agent-chat/ui/CommandChips.tsx` | component (pill chip) | request-response | `src/widgets/ProductSalesPanel/ProductSalesPanel.tsx:94` (pill toggle, post-fix) / `ComboAvailabilityEditor.tsx:88` | exact |
| `src/features/agent-chat/ui/FileDropZone.tsx` | component (icon buttons ×2) | request-response | `src/widgets/TableStatusPanel/index.tsx:244` (icon-only ghost Button, post-fix) | exact |
| `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` | component (text link) | request-response | `src/widgets/ManageIngredientsTab/index.tsx:268` (text link, post-fix) | exact |
| `src/features/manage-categories/ui/CategoryTreeEditor.tsx` (button:166) | component (icon toggle) | request-response | `src/widgets/PoolTableGrid/index.tsx:120` (disclosure toggle, post-fix) | role-match |
| `src/features/manage-categories/ui/CategoryTreeEditor.tsx` (input:82-95, color) | component (form field) | CRUD (local form state) | already inside `FormField` — comment-only, no analog needed | n/a — already compliant |
| `src/features/manage-categories/ui/CategoryTreeEditor.tsx` (hex:465) | component (default value) | CRUD | n/a — comment-only exemption | n/a |
| `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` (button:88) | component (toggle chip) | request-response | `src/widgets/ProductSalesPanel/ProductSalesPanel.tsx:94-119` (identical selected/unselected ternary shape) | exact |
| `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` (inputs:113,125, time) | component (form field) | CRUD | `src/features/manage-products/ui/CategoryForm.tsx:128-155` (`FormField` wrap around a native non-text input) | exact |
| `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` (buttons ×2) | component (card-tile selector) | request-response | `src/widgets/EmployeeSelector/EmployeeSelector.tsx:31` (card-tile selector, post-fix) | exact |
| `src/features/split-tab/ui/SplitTabSheet.tsx` (buttons :597,693,735) | component (add-tile ×2, icon-remove ×1) | request-response | **same file**, `SplitTabSheet.tsx:747` — already-compliant sibling `Button variant="outline" size="sm"` | exact (same-file precedent) |
| `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` (checkbox ×2) | component (form field) | CRUD | `src/features/manage-ingredients/ui/IngredientForm.tsx:272-278` (production `Checkbox` usage) | exact |
| `src/widgets/AuditLogTable/AuditLogTable.tsx` (button:69) | component (sr-only trigger) | request-response | **same file** already imports `Button` from `@shared/ui/button` (line 21) — tag swap only | exact |
| `src/widgets/EmployeeSelector/EmployeeSelector.tsx` (button:31) | component (card-tile selector) | request-response | `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx:119` (same shape, fixed together) | exact |
| `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (button:156) | component (nav tile card) | request-response | **same file** already imports `{ Badge, Button }` from `@shared/ui` (line 28) | exact |
| `src/widgets/ManageIngredientsTab/index.tsx` (button:268) | component (text link) | request-response | `src/widgets/PINLoginForm/PINLoginForm.tsx:254` (text link, same fix shape) | exact |
| `src/widgets/PINLoginForm/PINLoginForm.tsx` (button:254) | component (text link) | request-response | `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx:216` (text link, `variant="link"`) | exact |
| `src/widgets/PoolTableGrid/index.tsx` (button:120) | component (disclosure toggle) | request-response | `src/features/manage-categories/ui/CategoryTreeEditor.tsx:166` (expand/collapse toggle) | exact |
| `src/widgets/ProductSalesPanel/ProductSalesPanel.tsx` (buttons ×2) | component (sort-toggle pill pair) | request-response | `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx:88` (day-chip selected/unselected ternary) | exact |
| `src/widgets/TableStatusPanel/index.tsx` (button:244, row-remove) | component (icon-only remove) | request-response | `src/features/split-tab/ui/SplitTabSheet.tsx:735` (icon-only row-remove, same fix) | exact |
| `src/widgets/TableStatusPanel/index.tsx` (lines 382-395, delete) | component (duplicate nav affordance — COMPONENT-03) | request-response | `src/pages/pool-table-status/index.tsx` — `PageContainer`'s `backTo="/pool-tables"` (the surviving affordance) | exact (deletion, not swap) |
| `src/widgets/SettingsTabsPanel/tabs/HardwareSettingsTab.tsx` (checkboxes ×6) | component (mapped form fields) | CRUD | `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx:335-343` (per-item mapped `Checkbox`, same `id`-preserve requirement) | exact |
| `src/widgets/AuditLogTable/AuditLogFilterBar.tsx` (inputs:139,149, date) | component (filter form field) | CRUD | `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` (bare-label → `FormField` wrap, same transformation) — **plus E2E fix, see Shared Patterns** | exact + risk |
| `src/widgets/InventoryPagePanel.tsx` (input:353, number) | component (form field, signed delta) | CRUD | Phase 17 precedent (modifier-delta opt-out) — same-shape `FormField` wrap keeping native `<input type="number">`, no `MoneyInput` | exact |
| `src/features/manage-products/ui/CategoryForm.tsx` (hex:33,151) | component (default/placeholder) | CRUD | n/a — comment-only exemption | n/a |
| `src/features/add-item-to-tab/ui/ModifierSheet.tsx` (hex:22) | component (fallback) | CRUD | n/a — comment-only exemption | n/a |

## Pattern Assignments

### Button role — Form/dashed-tile add actions, icon-only removes, disclosure toggles, text links, chips
**Analog:** `src/features/split-tab/ui/SplitTabSheet.tsx:747` (already compliant, same file as 3 of the fixes)
```tsx
<Button variant="outline" size="sm" onClick={addAmountRow} className="w-full">
  <Plus className="h-4 w-4 mr-2" />Add check
</Button>
```
Apply the same `Button` swap (never `POSButton`) to every icon-only/chip/card/link control. Preserve the existing `className` string via `cn()`/verbatim retention — do not let `Button`'s own default classes override bespoke shape/color classes already present. Preserve `aria-label`, `aria-pressed`, `aria-expanded`, `data-testid`, `disabled`, `title` exactly as they exist today (see UI-SPEC's per-file notes — several are load-bearing for E2E, e.g. `AuditLogTable.tsx`'s `sr-only` name asserted by `e2e/38-audit-logs.spec.ts`, and `PoolTableGrid`'s `data-testid="pool-filters-toggle"`).

**Icon-only sizing:** use `size="icon"` (40px+ controls, e.g. `FileDropZone`'s mic/send) or `size="icon-sm"` (smaller controls, e.g. `CategoryTreeEditor`'s chevron, `SplitTabSheet`'s row-remove, `TableStatusPanel`'s row-remove) — match whichever existing sibling icon-button size class is closest to the current raw `<button>`'s `size-*` class.

**Variant selection by role** (locked in UI-SPEC, do not deviate):
- `ghost` — icon-only/hover-only controls, disclosure toggles, nav-tile cards (`HomeDashboard`)
- `link` — underlined text links (`CsvImportSheet`, `ManageIngredientsTab`, `PINLoginForm`, `AuditLogTable`'s sr-only trigger)
- `outline` — pill/chip toggles (`CommandChips`, `ComboAvailabilityEditor`, `ProductSalesPanel`), dashed add-tiles (`SplitTabSheet:597,693`), card-tile selectors (`SeatPartySheet`, `EmployeeSelector`)

### Checkbox — `checked` + `onCheckedChange`
**Analog:** `src/features/manage-ingredients/ui/IngredientForm.tsx:272-278` (production usage, confirms `Checkbox` is proven — NOT an unused primitive despite CONTEXT.md's stale premise)
```tsx
<Checkbox
  id="ing-is-prep"
  checked={isPrep}
  onCheckedChange={checked => {
    setIsPrep(checked === true);
  }}
  disabled={isPending}
/>
```
Rule: **always** `onCheckedChange={(c) => setX(c === true)}` — never `!!c` (Radix `CheckedState = boolean | 'indeterminate'`; `!!'indeterminate'` is `true`, semantically wrong for a binary checkbox). Preserve any existing `id`/`htmlFor` pairing verbatim — pass `id` straight through to `Checkbox` (it does not clobber `id` the way `FormField` does).

Apply to: `ModifierGroupEditor.tsx:253-263` (replace `<label><input type="checkbox">...</label>` with `<label className="flex items-center gap-2 text-sm"><Checkbox checked={isRequired} onCheckedChange={c => setIsRequired(c === true)} />Required...</label>`), `ModifierGroupEditor.tsx:335-343` (per-modifier, keep explicit `id={`mod-${m.id}`}`), `HardwareSettingsTab.tsx:135-159` (mapped array, keep `id={`receipt-${key}`}` + existing `<Label htmlFor>` pairing).

### FormField — wraps native non-text inputs (color/time/date/number), keeps native input
**Analog:** `src/features/manage-products/ui/CategoryForm.tsx:128-155` (already-compliant `FormField` wrap around a `type="color"` input)
```tsx
<FormField label="Color" required error={fieldErrors.color ?? ''} hint="Hex or use the picker">
  <div className="flex flex-wrap items-center gap-2">
    <input type="color" aria-label="Color picker" className="h-9 w-14 cursor-pointer rounded border bg-transparent p-0"
      value={color.startsWith('#') ? color.slice(0, 7) : `#${color}`.slice(0, 7)}
      onChange={e => { setColor(e.target.value.toUpperCase()); }} disabled={submitting} />
    ...
  </div>
</FormField>
```
**Critical gotcha (from RESEARCH.md Pitfall 1):** `FormField.tsx` does `React.cloneElement(children, { id, ... })` — this **always overwrites** any `id` the child already had with its own `useId()`-generated id. This is harmless for `ComboAvailabilityEditor.tsx`'s `startId`/`endId` and `InventoryPagePanel.tsx`'s `batch-delta` (no external references, confirmed by grep), but **breaks `e2e/38-audit-logs.spec.ts:231`'s `page.locator('#audit-filter-date-from')`** if `AuditLogFilterBar.tsx` is wrapped naively.

Apply to:
- `ComboAvailabilityEditor.tsx:107-138` — wrap each bare `<label htmlFor={startId}>From</label><input id={startId} type="time" .../>` pair in `<FormField label="From">...</FormField>` / `<FormField label="To">...</FormField>`. Keep the cross-field `hasTimeError` message as a sibling `<p>`, not forced into one `FormField`'s `error` slot.
- `InventoryPagePanel.tsx:349-363` — `<FormField label="Quantity delta" hint="Use negative numbers to remove stock."><input id="batch-delta" type="number" .../></FormField>`. Keep native number input, do NOT use `MoneyInput` (signed-delta opt-out, Phase 17 precedent).
- `AuditLogFilterBar.tsx:139-158` — wrap in `FormField label="Date from"` / `FormField label="Date to"`, drop the now-redundant `aria-label`. **Must land in the same commit/task as updating `e2e/38-audit-logs.spec.ts:231` to `page.getByLabel('Date from')`** (recommended fix per RESEARCH.md Pitfall 1) — do not ship the wrap alone.
- `CategoryTreeEditor.tsx:82-95` and `CategoryForm.tsx:128-155` (color) — already structurally inside `FormField`; **comment-only** fix, no markup change.

### Duplicate-primitive removal (COMPONENT-03)
**Target:** `src/widgets/TableStatusPanel/index.tsx:382-395`
**Analog for the surviving affordance:** `src/pages/pool-table-status/index.tsx`'s `PageContainer` `backTo="/pool-tables"` prop (added Phase 30)
```tsx
// DELETE lines 382-395 entirely — no replacement:
      {/* Back button */}
      <div>
        <POSButton type="button" variant="ghost" touchSize="default" onClick={() => { navigate('/pool-tables'); }}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Pool Tables
        </POSButton>
      </div>
```
Also remove `ArrowLeft` from the `lucide-react` import line (confirmed unused elsewhere in the file). **Do NOT remove `useNavigate`/`navigate`** — used at lines 113, 122, 178, 407, 422, all outside the deleted block.

### TOKEN-01 exemption comment (3 sites, comment-only)
**Pattern to insert verbatim above each hex literal:**
```ts
// TOKEN-01 exempt: category.color is arbitrary per-row USER DATA (each category
// picks its own color), not an app theme color. Do not map to a Tailwind CSS-variable
// token — see 31-CONTEXT.md D-08.
```
Sites: `ModifierSheet.tsx:22`, `CategoryTreeEditor.tsx:465`, `CategoryForm.tsx:33,151`.

## Shared Patterns

### `Button` variant preservation via `cn()` merge
**Source:** `src/widgets/HomeDashboard/ui/HomeDashboard.tsx:156-190` (keeps entire bespoke `className` string verbatim through the swap)
**Apply to:** every button swap in this phase — never let `Button`'s default variant classes visually override the existing bespoke className; `cn()`'s tailwind-merge resolves conflicts predictably (later class wins), so passing the full existing className after `variant` is safe.

### Radix `CheckedState` strict-boolean comparison
**Source:** `src/features/manage-ingredients/ui/IngredientForm.tsx:275`
**Apply to:** all `Checkbox` swaps — `onCheckedChange={(c) => setX(c === true)}`, never `!!c`.

### FormField id-clobber risk gate
**Source:** `src/shared/ui/FormField.tsx` (`React.cloneElement(children, { id, ... })`)
**Apply to:** `AuditLogFilterBar.tsx` only (the sole in-scope input whose `id` has a live external dependent — the Playwright locator). All other `FormField`-wrap targets in this phase have no external `id` reference (confirmed by grep across `src/` and `e2e/`) and are safe as-is.

## No Analog Found

None. Every in-scope file has either a same-file precedent (`SplitTabSheet`, `AuditLogTable`, `HomeDashboard` already import the target primitive) or a cross-file exact/role-match analog already using the identical primitive in production. The 3 hex-color sites and the 2 already-`FormField`-wrapped color inputs require comment-only changes with no code pattern to copy.

## Metadata

**Analog search scope:** No filesystem search was required — `31-RESEARCH.md` already performed direct-read verification of every target primitive (`POSButton.tsx`, `button.tsx`, `checkbox.tsx`, `FormField.tsx`) and every in-scope consumer file, plus grep-verified which `id`s have external (E2E/test) references. This document restates those findings as planner-consumable per-file pattern assignments.
**Files scanned:** 26 in-scope files (per `31-UI-SPEC.md`'s file table) + 4 shared/ui primitive source files + 4 already-compliant reference consumers (`IngredientForm.tsx`, `ModifierSheet.tsx`, `ProductForm.tsx`, `ComboSlotCard.tsx`)
**Pattern extraction date:** 2026-07-11
</content>
</invoke>
