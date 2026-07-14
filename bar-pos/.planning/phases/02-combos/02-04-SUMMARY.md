---
phase: 02-combos
plan: "04"
subsystem: shared/ui / widgets
tags:
  - combo-badge
  - storybook
  - product-grid
  - fsd-widget
  - manager-pin-gate

dependency_graph:
  requires:
    - "02-03 (entities/combo/ slice: useComboAvailability hook, ComboSlot/ComboSlotOption/SlotSelection types)"
    - "02-01 (is_combo_available RPC for useComboAvailability)"
    - "shared/ui/badge, checkbox, QuantityControl, MoneyDisplay (existing)"
    - "features/manager-pin-gate (existing ManagerPinDialog)"
  provides:
    - "ComboBadge shared/ui component with bg-pos-accent/20 styling"
    - "ComboUnavailableBadge shared/ui component with Lock icon + aria-label"
    - "ComboSlotCard shared/ui component with slot+option rendering, QuantityControl, border-destructive validation"
    - "ProductGrid combo routing fork: isCombo products open ComboBuilderSheet signal; unavailable combos open ManagerPinDialog override flow"
    - "comboBuilderOpen + overrideActive state in ProductGrid ready for Plan 05"
  affects:
    - "02-05 (ComboBuilderSheet mounts inside ProductGrid using selectedCombo + comboBuilderOpen)"
    - "02-08 (ComboBuilderSheet uses ComboSlotCard for each slot)"

tech_stack:
  added: []
  patterns:
    - "ComboAwareProductCard sub-component wraps useComboAvailability per card (staleTime=30s, no N+1)"
    - "exactOptionalPropertyTypes fix: conditional spread {...(!isAvailable ? { className } : {})} instead of className={x || undefined}"
    - "FSD: shared/ui components import only from @shared/lib/domain (not @entities/*) to respect layer boundaries"
    - "Storybook stories use @storybook/react-vite (not @storybook/react) per project convention"
    - "eslint --fix auto-corrects import/order violations before commit"

key-files:
  created:
    - bar-pos/src/shared/ui/ComboBadge.tsx
    - bar-pos/src/shared/ui/ComboBadge.stories.tsx
    - bar-pos/src/shared/ui/ComboUnavailableBadge.tsx
    - bar-pos/src/shared/ui/ComboUnavailableBadge.stories.tsx
    - bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx
    - bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx
  modified:
    - bar-pos/src/widgets/OrderPanel/ProductGrid.tsx

key-decisions:
  - "ComboSlotCard imports types from @shared/lib/domain (not @entities/combo) — shared/ui layer cannot import from entities layer per FSD boundary rules"
  - "ComboSlotCard option rows use <button role=option> inside role=listbox container for a11y (jsx-a11y/click-events-have-key-events compliance)"
  - "useComboAvailability is called inside ComboAwareProductCard sub-component, not in ProductGrid directly — keeps per-card query isolated and avoids prop drilling"
  - "void selectedCombo; void comboBuilderOpen; void overrideActive; in ProductGrid suppresses no-unused-vars — state is intentionally pre-wired for Plan 05"
  - "overrideActive is only set inside ManagerPinDialog.onSuccess callback — T-2-04-01 elevation threat mitigated"

requirements-completed:
  - S2-11
  - S2-14

duration: 8min
completed: "2026-04-23"
---

# Phase 02 Plan 04: Combo shared/ui Components + ProductGrid Routing Fork Summary

**ComboBadge, ComboUnavailableBadge, ComboSlotCard shared/ui components with Storybook stories; ProductGrid routing fork for is_combo=true products with useComboAvailability-aware card display and ManagerPinDialog manager override flow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-23T23:31:34Z
- **Completed:** 2026-04-23T23:39:45Z
- **Tasks:** 2
- **Files modified:** 7 (6 created in shared/ui, 1 modified widget)

## Accomplishments

- `ComboBadge`: trivial Badge wrapper with `bg-pos-accent/20 text-pos-accent border-pos-accent/30` styling; 1 Storybook story
- `ComboUnavailableBadge`: Lock icon (14px) + availabilityHint text + `aria-label="Combo unavailable. {hint}"`; 3 Storybook stories (DaysOnly, DaysWithTime, AllDay)
- `ComboSlotCard`: full slot rendering — product slot with scrollable `<button role=option>` list per option, Checkbox + Label per row, selected row `bg-accent/50`, QuantityControl for `min!=max`, read-only qty badge for fixed qty, pool_time non-interactive info card, `border-destructive` when `isRequired && childProductId===null`; 5 Storybook stories
- `ProductGrid`: combo routing fork (`isCombo` check before modifiers check), `ComboAwareProductCard` sub-component with per-card `useComboAvailability`, `ComboBadge`/`ComboUnavailableBadge` overlay, `ComboUnavailableDialog` with manager override button, `ManagerPinDialog` sets `overrideActive=true` and opens `ComboBuilderSheet` signal

## Task Commits

1. **Task 1: ComboBadge, ComboUnavailableBadge, ComboSlotCard** - `b4f2c9f` (feat)
2. **Task 2: ProductGrid combo routing fork** - `c762fe5` (feat)

## Files Created/Modified

- `bar-pos/src/shared/ui/ComboBadge.tsx` — Badge wrapper, bg-pos-accent/20 styling
- `bar-pos/src/shared/ui/ComboBadge.stories.tsx` — 1 story: Default
- `bar-pos/src/shared/ui/ComboUnavailableBadge.tsx` — Lock + availabilityHint + aria-label
- `bar-pos/src/shared/ui/ComboUnavailableBadge.stories.tsx` — 3 stories: DaysOnly, DaysWithTime, AllDay
- `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` — full slot card with option list, validation, pool_time branch, QuantityControl
- `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx` — 5 stories: Default, Filled, QuantityRange, PoolTimeSlot, ValidationError
- `bar-pos/src/widgets/OrderPanel/ProductGrid.tsx` — combo routing fork, ComboAwareProductCard, dialogs, state signal

## Decisions Made

- `ComboSlotCard` imports types from `@shared/lib/domain` — FSD boundary enforced by `eslint-plugin-boundaries`; `shared/ui` layer cannot import from `entities` layer
- `<button role="option">` inside `role="listbox"` container — resolves `jsx-a11y/click-events-have-key-events` and `no-static-element-interactions` ESLint errors
- `ComboAwareProductCard` sub-component — per-card `useComboAvailability(id)` avoids N+1 (each card independently caches at `staleTime=30_000`)
- `exactOptionalPropertyTypes` fix — `{...(!isAvailable ? { className: 'opacity-60' } : {})}` instead of `className={x || undefined}` to avoid TS2375

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed `@storybook/react` to `@storybook/react-vite` in story imports**
- **Found during:** Task 1 (pre-commit lint hook)
- **Issue:** Stories used `import from '@storybook/react'` which triggers `storybook/no-renderer-packages` ESLint error. Project convention (all existing stories) uses `@storybook/react-vite`.
- **Fix:** Updated all 3 story files to import from `@storybook/react-vite`.
- **Files modified:** ComboBadge.stories.tsx, ComboUnavailableBadge.stories.tsx, ComboSlotCard.stories.tsx

**2. [Rule 1 - Bug] Moved ComboSlotCard types import from `@entities/combo` to `@shared/lib/domain`**
- **Found during:** Task 1 (pre-commit lint hook)
- **Issue:** `boundaries/dependencies` rule blocks `shared` layer from importing `entities` layer. `ComboSlot`, `ComboSlotOption`, `SlotSelection` are all re-exported from `@shared/lib/domain` directly.
- **Fix:** Changed import to `import type { ComboSlot, ComboSlotOption, SlotSelection } from '@shared/lib/domain'`; same fix applied in stories file.
- **Files modified:** ComboSlotCard.tsx, ComboSlotCard.stories.tsx

**3. [Rule 2 - Missing Critical] Added `role="listbox"` + `<button role="option">` to option rows**
- **Found during:** Task 1 (pre-commit lint hook — `jsx-a11y/click-events-have-key-events` + `no-static-element-interactions`)
- **Issue:** Option rows were plain `<div onClick>` which violates accessibility rules. The `div` is interactive but has no keyboard support or ARIA role.
- **Fix:** Wrapped options in `role="listbox"` container div; each option row changed to `<button type="button" role="option" aria-selected>` which is natively keyboard-accessible and has correct ARIA semantics.
- **Files modified:** ComboSlotCard.tsx

**4. [Rule 1 - Bug] Fixed `exactOptionalPropertyTypes` TS2375 on ProductGrid `className` prop**
- **Found during:** Task 2 (typecheck)
- **Issue:** `className={!isAvailable ? 'opacity-60' : undefined}` produces type `string | undefined` which is not assignable to `className?: string` under `exactOptionalPropertyTypes: true`.
- **Fix:** Changed to conditional spread `{...(!isAvailable ? { className: 'opacity-60' } : {})}` — only the key is present when the value is set.
- **Files modified:** ProductGrid.tsx

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical, 1 Rule 1 bug)
**Impact on plan:** All required by project conventions (ESLint rules, FSD boundaries, TypeScript strict mode). No scope change.

## Known Stubs

- `ComboUnavailableBadge availabilityHint="Check schedule"` in `ComboAwareProductCard` — hardcoded fallback string. Plan 05 will pass the real availability window text from `useComboAvailabilityWindows` when building the ComboBuilderSheet.
- `selectedCombo`, `comboBuilderOpen`, `overrideActive` state in ProductGrid — wired but not consumed (ComboBuilderSheet not yet mounted). Plan 05 mounts ComboBuilderSheet using these signals.

## Threat Flags

No new threat surface beyond the plan's threat model.

- T-2-04-01 (overrideActive without PIN): mitigated — `setOverrideActive(true)` only called inside `ManagerPinDialog.onSuccess`
- T-2-04-02 (stale availability data): accepted — `staleTime=30s`; RPC re-validates at write time
- T-2-04-03 (ComboSlotCard no server validation): accepted — display-only; `add_combo_to_tab` RPC validates all selections

## Self-Check: PASSED

- [x] `bar-pos/src/shared/ui/ComboBadge.tsx` — exists
- [x] `bar-pos/src/shared/ui/ComboBadge.stories.tsx` — exists, 1 story (Default)
- [x] `bar-pos/src/shared/ui/ComboUnavailableBadge.tsx` — exists, has `aria-label`, has Lock icon
- [x] `bar-pos/src/shared/ui/ComboUnavailableBadge.stories.tsx` — exists, 3 stories (DaysOnly, DaysWithTime, AllDay)
- [x] `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.tsx` — exists, has `border-destructive`, `pool_time` branch, `QuantityControl`
- [x] `bar-pos/src/shared/ui/ComboSlotCard/ComboSlotCard.stories.tsx` — exists, 5 stories
- [x] `bar-pos/src/widgets/OrderPanel/ProductGrid.tsx` — modified, has `isCombo` (2 hits), `setComboBuilderOpen` (3 hits), `overrideActive` (3 hits), `ComboBadge`, `ComboUnavailableBadge`, `ManagerPinDialog`, `useComboAvailability`
- [x] `cd bar-pos && npm run typecheck` — exit 0
- [x] `cd bar-pos && npm run lint` — exit 0 (0 warnings)
- [x] Commits `b4f2c9f` and `c762fe5` exist in bar-pos git log

---
*Phase: 02-combos*
*Completed: 2026-04-23*
