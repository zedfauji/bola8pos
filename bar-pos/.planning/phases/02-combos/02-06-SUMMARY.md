---
phase: 02-combos
plan: "06"
subsystem: features/manage-combos / widgets/KdsBoard / entities/kds
tags:
  - combo-admin
  - settings-tab
  - kds-grouping
  - collapsible

dependency_graph:
  requires:
    - "02-04 (ComboBadge, ComboSlotCard shared/ui; Collapsible installed)"
    - "02-03 (entities/combo/ slice: useCombos, useComboSlots, useComboSlotOptions, useComboAvailabilityWindows)"
    - "02-01 (combo_availability, combo_slots, combo_slot_options tables)"
    - "shared/ui/collapsible (installed Plan 02-01)"
    - "features/manage-modifier-groups (pattern reference)"
  provides:
    - "manage-combos feature: ManageCombosTab CRUD, ComboBuilderForm slot editor, ComboAvailabilityEditor"
    - "Settings Combos tab under canManageProducts gate"
    - "KdsBoard combo child grouping in Collapsible cards"
    - "KdsOrderItem.parentOrderItemId + comboSlotId fields"
  affects:
    - "02-08 (ComboBuilderSheet — slot selection UI in POS; not needed for settings admin)"

tech_stack:
  added: []
  patterns:
    - "ModifierGroupEditor pattern: file-level eslint-disable + supabase as any + useQuery/useMutation/useQueryClient"
    - "useId() for accessible label/input association (avoids jsx-a11y/label-has-associated-control)"
    - "WindowRow sub-component in ComboAvailabilityEditor — each window gets unique useId() for From/To labels"
    - "comboChildren prop (not children) in ComboKdsCard — avoids react/no-children-prop lint error"
    - "delete-all + re-insert pattern for combo_availability (idempotent, sub-second gap accepted per T-2-06-02)"
    - "noUncheckedIndexedAccess: acc[parent] guarded with const existing = acc[parent]; if (existing)"

key-files:
  created:
    - bar-pos/src/features/manage-combos/index.ts
    - bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx
    - bar-pos/src/features/manage-combos/ui/ComboBuilderForm.tsx
    - bar-pos/src/features/manage-combos/ui/ComboAvailabilityEditor.tsx
  modified:
    - bar-pos/src/widgets/SettingsTabsPanel/index.tsx
    - bar-pos/src/entities/kds/model/types.ts
    - bar-pos/src/entities/kds/model/queries.ts
    - bar-pos/src/widgets/KdsBoard/index.tsx

key-decisions:
  - "ComboAvailabilityEditor uses WindowRow sub-component so each window row gets its own useId() — required because useId() cannot be called inside .map() (Rules of Hooks)"
  - "comboChildren prop name (not children) in ComboKdsCard — React reserves children prop; using it as a plain prop triggers react/no-children-prop lint error"
  - "KdsOrderItem uses z.string().nullable() for parentOrderItemId/comboSlotId (not z.string().optional().nullable()) — exactOptionalPropertyTypes; null sentinel used to mean absent"
  - "ManageCombosTab local dialog state uses ComboDialogState union type to avoid naming collision with imported Dialog component"
  - "NESTED_COMBO_FORBIDDEN detection: msg.includes('NESTED_COMBO_FORBIDDEN') (exact string from DB trigger RAISE EXCEPTION)"
  - "KdsBoard filters topLevelItems = items.filter(i => !i.parentOrderItemId) — combo children excluded from top-level render entirely"

requirements-completed:
  - S2-09
  - S2-10
  - S2-13

duration: 17min
completed: "2026-04-23"
---

# Phase 02 Plan 06: Manage-Combos Admin Feature + KDS Grouping Summary

**Combo admin UI (ManageCombosTab + ComboBuilderForm + ComboAvailabilityEditor) wired into Settings Combos tab under canManageProducts; KDS extended to group combo children under Collapsible parent cards with parentOrderItemId filtering**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-23T23:39:45Z
- **Completed:** 2026-04-23T23:56:20Z
- **Tasks:** 2
- **Files modified:** 8 (4 created in features/manage-combos, 1 modified widget, 3 modified entities/kds + KdsBoard)

## Accomplishments

**Task 1 — manage-combos feature + SettingsTabsPanel:**
- `ManageCombosTab`: combo list CRUD — Add/Edit/Delete per combo; empty state "No combos yet" with copywriting per UI-SPEC; delete ConfirmDialog with cascade note
- `ComboBuilderForm`: name + price override fields; slot list with `SlotForm` inline creator (label, slotType select, min/max qty); `SlotEditor` per slot with option add/delete; NESTED_COMBO_FORBIDDEN DB trigger error caught and shown as toast
- `ComboAvailabilityEditor`: `WindowRow` sub-component (useId for From/To labels); 7-day ISO toggle buttons (Mon–Sun); time inputs shown when ≥1 day selected; end-time validation error; delete-all + re-insert save; "No windows = always available" note
- `SettingsTabsPanel`: `ManageCombosTab` imported from `@features/manage-combos`; Combos tab inserted after Billing inside `canManageProducts` block

**Task 2 — KDS combo grouping:**
- `KdsOrderItemSchema`: added `parentOrderItemId: z.string().nullable()` and `comboSlotId: z.string().nullable()`
- `useKdsItems` SELECT: added `parent_order_item_id` and `combo_slot_id` columns; mapped to `parentOrderItemId`/`comboSlotId` in push loop
- `KdsBoard`: `topLevelItems` filter excludes children; `childrenByParent` reduce groups by `parentOrderItemId`; `ComboKdsCard` renders combo parents with `ComboBadge` + `Collapsible` expand/collapse; `comboChildren` prop (renamed from `children`); aria-label toggles "Expand combo items" / "Collapse combo items"; children render as `pl-6 text-sm` lines inside `CollapsibleContent`

## Task Commits

Code written to working tree (bar-pos/ is gitignored — only .planning/ commits to git per project pattern):

1. **Task 1: manage-combos feature + SettingsTabsPanel** — code in working tree
2. **Task 2: KDS parentOrderItemId + ComboKdsCard grouping** — code in working tree

## Files Created/Modified

**Created:**
- `bar-pos/src/features/manage-combos/index.ts` — barrel: exports ManageCombosTab
- `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` — CRUD list, Add/Edit/Delete dialogs
- `bar-pos/src/features/manage-combos/ui/ComboBuilderForm.tsx` — slot + option editor, NESTED_COMBO_FORBIDDEN toast
- `bar-pos/src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` — day-of-week grid + time windows

**Modified:**
- `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` — Combos tab under canManageProducts
- `bar-pos/src/entities/kds/model/types.ts` — parentOrderItemId + comboSlotId added to schema
- `bar-pos/src/entities/kds/model/queries.ts` — SELECT + mapping extended
- `bar-pos/src/widgets/KdsBoard/index.tsx` — ComboKdsCard, topLevelItems grouping, Collapsible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed `children` prop to `comboChildren` in ComboKdsCard**
- **Found during:** Task 2 (lint)
- **Issue:** Passing `children` as a regular prop triggers `react/no-children-prop` ESLint error — React reserves `children` for JSX nesting.
- **Fix:** Renamed prop to `comboChildren` throughout the component definition and call site.
- **Files modified:** KdsBoard/index.tsx

**2. [Rule 2 - Missing Critical] Added `useId()` + `htmlFor` for label/input associations**
- **Found during:** Task 1 (lint — `jsx-a11y/label-has-associated-control`)
- **Issue:** Plain `<label>` elements without `htmlFor` linking to inputs violate accessibility rules.
- **Fix:** Used `useId()` in `SlotForm` (4 IDs) and extracted `WindowRow` sub-component in `ComboAvailabilityEditor` so each window gets unique `useId()` IDs for From/To time labels.
- **Files modified:** ComboBuilderForm.tsx, ComboAvailabilityEditor.tsx

**3. [Rule 1 - Bug] Fixed `React.FormEvent` deprecated → `React.SyntheticEvent<HTMLFormElement>`**
- **Found during:** Task 1 (lint — `@typescript-eslint/no-deprecated`)
- **Fix:** Changed type annotation on `handleSubmit` in `SlotForm`.
- **Files modified:** ComboBuilderForm.tsx

**4. [Rule 1 - Bug] Removed unnecessary `String()` conversion and always-true conditions**
- **Found during:** Task 1 (lint — `@typescript-eslint/no-unnecessary-type-conversion`, `no-unnecessary-condition`)
- **Fix:** `${\`product.comboPriceOverride.toFixed(2)\`}` directly (no String() wrapper); removed inner `if (dialogState.kind === 'delete')` guard inside already-narrowed block.
- **Files modified:** ManageCombosTab.tsx

**5. [Rule 1 - Bug] Fixed import order via `lint:fix`**
- **Found during:** Tasks 1 & 2 (lint — `import/order`)
- **Fix:** Auto-fixed by `npx eslint --fix`.
- **Files modified:** SettingsTabsPanel/index.tsx, KdsBoard/index.tsx

---

**Total deviations:** 5 auto-fixed (3 Rule 1 bugs, 1 Rule 2 missing critical, 1 Rule 1 bug import order)
**Impact on plan:** All required by project conventions (ESLint rules, accessibility). No scope change.

## Known Stubs

None — ManageCombosTab is fully wired to live Supabase queries. ComboAvailabilityEditor performs real delete+insert. KDS grouping is live data from `parent_order_item_id` column.

## Threat Flags

No new threat surface beyond the plan's threat model.

- T-2-06-01 (NESTED_COMBO_FORBIDDEN): mitigated — UI catches DB trigger error and shows descriptive toast
- T-2-06-02 (delete-all + re-insert gap): accepted — sub-second; RLS requires authenticated session
- T-2-06-03 (combo children inherit parent bump): accepted — children display-only in KDS Phase 2

## Self-Check: PASSED

- [x] `bar-pos/src/features/manage-combos/ui/ManageCombosTab.tsx` — exists, has "No combos yet" (1 hit), NESTED_COMBO_FORBIDDEN (2 hits via ComboBuilderForm)
- [x] `bar-pos/src/features/manage-combos/ui/ComboBuilderForm.tsx` — exists, has NESTED_COMBO_FORBIDDEN (2 hits), label/input IDs wired
- [x] `bar-pos/src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` — exists, has daysOfWeek (11 hits), text-sm text-destructive (1 hit)
- [x] `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` — has "combos" (2 hits), ManageCombosTab (2 hits), inside canManageProducts block
- [x] `bar-pos/src/entities/kds/model/types.ts` — has parentOrderItemId (1 hit)
- [x] `bar-pos/src/entities/kds/model/queries.ts` — has parent_order_item_id (2 hits), combo_slot_id (2 hits)
- [x] `bar-pos/src/widgets/KdsBoard/index.tsx` — has Collapsible (7 hits), topLevelItems (5 hits), ComboKdsCard (2 hits), ComboBadge (2 hits), aria-label Expand/Collapse combo items (1 hit)
- [x] `cd bar-pos && npm run typecheck` — exit 0
- [x] `cd bar-pos && npm run lint` — exit 0 (0 warnings)
