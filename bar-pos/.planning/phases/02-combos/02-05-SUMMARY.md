---
phase: 02-combos
plan: "05"
subsystem: features/add-combo-to-tab / widgets/OrderPanel
tags:
  - combo-builder-sheet
  - mutation-hook
  - tdd
  - product-grid-wiring
  - fsd-feature

dependency_graph:
  requires:
    - "02-04 (ProductGrid combo routing fork: selectedCombo, comboBuilderOpen, overrideActive state)"
    - "02-03 (entities/combo/ slice: useComboSlots, useComboSlotOptions, AddComboToTabInput)"
    - "02-01 (add_combo_to_tab RPC migration)"
    - "shared/ui/ComboSlotCard (02-04)"
    - "entities/tab/model/queries (tabKeys.all for cache invalidation)"
  provides:
    - "useAddComboToTab TanStack mutation hook with 5 RPC error code mappings"
    - "ComboBuilderSheet bottom-sheet UI with slot selection, running total, override banner"
    - "Integration tests: 5 behaviors, all passing"
    - "ProductGrid wired: ComboBuilderSheet mounted, activeTabId from useTabStore"
    - "shared/ui/alert.tsx shadcn Alert component"
  affects:
    - "02-08 (ComboBuilderSheet is the primary consumer of ComboSlotCard in POS flow)"
    - "02-07 (combo seeding will make this flow testable end-to-end)"

tech_stack:
  added:
    - "shared/ui/alert.tsx — shadcn Alert component (required by override banner)"
  patterns:
    - "TDD: RED (import-resolve fail) → GREEN (5/5 pass) → typecheck + lint clean"
    - "Per-slot hook pattern: SingleSlotRow sub-component per slot keeps useComboSlotOptions at top level (hook rule compliant)"
    - "productMap built from useProducts() — avoids N+1 per-option product fetches"
    - "useTabStore(s => s.activeTabId) for tabId in ProductGrid — consistent with CartPanel pattern"
    - "eslint-disable file-level for unsafe-any in useAddComboToTab (pre-regen cast pattern per CLAUDE.md)"

key-files:
  created:
    - bar-pos/src/features/add-combo-to-tab/index.ts
    - bar-pos/src/features/add-combo-to-tab/model/useAddComboToTab.ts
    - bar-pos/src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx
    - bar-pos/src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx
    - bar-pos/src/shared/ui/alert.tsx
  modified:
    - bar-pos/src/widgets/OrderPanel/ProductGrid.tsx

key-decisions:
  - "productMap derived from useProducts() in ComboBuilderSheetInner — avoids additional per-slot join queries; useComboSlotOptions already returns child product IDs, products catalog is already cached by ProductGrid"
  - "SingleSlotRow sub-component pattern — each slot calls useComboSlotOptions(slot.id) at component top level, satisfying React hook rules without conditional hook calls"
  - "shared/ui/alert.tsx created (not already present) — Rule 3 deviation; shadcn add placed in wrong directory, manually moved to shared/ui with @shared/lib/utils import"
  - "activeTabId sourced from useTabStore not useCartStore — cartStore has no activeTabId; consistent with CartPanel.tsx and OrderPanel.tsx patterns"

requirements-completed:
  - S2-08

duration: 8min
completed: "2026-04-23"
---

# Phase 02 Plan 05: add-combo-to-tab Feature Slice + ProductGrid Wiring Summary

**useAddComboToTab TanStack mutation hook with 5 RPC error code mappings; ComboBuilderSheet bottom sheet with slot selection, running total, override banner; integration tests (5/5); ProductGrid wired with activeTabId from useTabStore**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-23T23:43:27Z
- **Completed:** 2026-04-23T23:51:47Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `useAddComboToTab`: TanStack `useMutation` hook calling `add_combo_to_tab` RPC via `supabase as any` pre-regen cast. Maps 5 error codes (`COMBO_UNAVAILABLE`, `SLOT_MIN_MAX_VIOLATION`, `INVALID_CHILD`, `NESTED_COMBO_FORBIDDEN`, `AUTH_FORBIDDEN`) to specific toast messages per UI-SPEC. Invalidates `tabKeys.all` on success.
- `ComboBuilderSheet`: Bottom sheet following ModifierSheet pattern. Slots fetched via `useComboSlots(combo.id)`. Per-slot options via `SingleSlotRow` sub-component (one `useComboSlotOptions` per slot). `productMap` built from `useProducts()` cache. Running total uses `comboPriceOverride` if set, else sums child `basePrice × qty`. Override banner (`border-yellow-500 bg-yellow-950/20`) shown when `overrideActive=true`. Confirm button disabled until `allSlotsFilled`. Discard resets all selections and calls `onClose`.
- `ComboBuilderSheet.test.tsx`: 5 integration tests with vi.mock for supabase, entities/combo, entities/product/model/queries. All 5 pass: disabled-when-unfilled, enabled-when-filled, discard-no-rpc, override-banner, rpc-called-on-confirm.
- `ProductGrid`: Imported `ComboBuilderSheet` from `@features/add-combo-to-tab`, added `useTabStore` for `activeTabId`, removed Plan 04 `void` suppressions, mounted `ComboBuilderSheet` with all 5 props.
- `shared/ui/alert.tsx`: Added shadcn Alert component (corrected import path from `@shared/lib/utils`).

## Task Commits

1. **Task 1: add-combo-to-tab feature slice** - `e01474c` (feat)
2. **Task 2: wire ComboBuilderSheet into ProductGrid** - `0a8962d` (feat)

## Files Created/Modified

- `bar-pos/src/features/add-combo-to-tab/index.ts` — public API (exports ComboBuilderSheet + useAddComboToTab)
- `bar-pos/src/features/add-combo-to-tab/model/useAddComboToTab.ts` — mutation hook, 5 error code mappings
- `bar-pos/src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx` — bottom sheet UI component
- `bar-pos/src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx` — 5 integration tests
- `bar-pos/src/shared/ui/alert.tsx` — shadcn Alert component
- `bar-pos/src/widgets/OrderPanel/ProductGrid.tsx` — ComboBuilderSheet mounted, activeTabId added

## Decisions Made

- `productMap` from `useProducts()` — avoids additional per-option join queries; products catalog already cached by ProductGrid's own `useProducts` call
- `SingleSlotRow` sub-component per slot — satisfies React hook rules (no conditional hooks) while keeping slot-specific options query isolated
- `activeTabId` from `useTabStore` — `useCartStore` has no `activeTabId`; consistent with `CartPanel.tsx` and `OrderPanel.tsx`
- `shared/ui/alert.tsx` created manually — `npx shadcn add alert` placed file in `src/app/components/ui/`, moved to `src/shared/ui/` with corrected `@shared/lib/utils` import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added shared/ui/alert.tsx (missing dependency)**
- **Found during:** Task 1 (ComboBuilderSheet imports `@shared/ui/alert`)
- **Issue:** `@shared/ui/alert` did not exist. Plan specified importing `Alert, AlertDescription` from that path.
- **Fix:** Ran `npx shadcn@latest add alert`, then moved generated file from wrong directory (`src/app/components/ui/alert.tsx`) to `src/shared/ui/alert.tsx` and updated import from `@app/lib/utils` to `@shared/lib/utils`.
- **Files modified:** `src/shared/ui/alert.tsx` (created)
- **Commit:** `e01474c`

**2. [Rule 2 - Missing Critical] Added eslint-disable for unbound-method in test file**
- **Found during:** Task 1 (lint check)
- **Issue:** `vi.mocked(supabaseModule.supabase.rpc).mockResolvedValue(...)` triggers `@typescript-eslint/unbound-method` — standard pattern in test files when asserting on mocked object methods.
- **Fix:** Added `/* eslint-disable @typescript-eslint/unbound-method */` at file top.
- **Files modified:** `ComboBuilderSheet.test.tsx`
- **Commit:** `e01474c`

**3. [Rule 1 - Bug] Plan AC count for `comboBuilderOpen` expected 3 — grep returns 2**
- **Found during:** Task 2 (acceptance criteria verification)
- **Issue:** Plan AC says `grep "comboBuilderOpen" ProductGrid.tsx` returns ≥3. Actual: 2 lines (`const [comboBuilderOpen, ...]` declaration and `open={comboBuilderOpen}` prop). Lines with `setComboBuilderOpen` don't contain lowercase `comboBuilderOpen` substring.
- **Fix:** No code change needed — the functional wiring is correct (state declared, passed as prop, reset in onClose). AC discrepancy is in the plan's grep pattern, not the implementation.
- **Impact:** None — ComboBuilderSheet is correctly mounted with all required props.

## Known Stubs

- `tabId={activeTabId ?? ''}` — when no tab is active, tabId is empty string `''`. The RPC will fail server-side with an error in this case. This is acceptable behavior: the POS flow requires an active tab before ordering; an empty tabId will produce a clear RPC error caught by `onError` toast handler.

## Threat Flags

No new threat surface beyond the plan's threat model.

- T-2-05-01 (overrideActive without real PIN): mitigated — `setOverrideActive(true)` only called inside `ManagerPinDialog.onSuccess`
- T-2-05-02 (slot_selections no schema validation): mitigated — `AddComboToTabInputSchema` validates full input in `useAddComboToTab.mutationFn` via implicit Zod; selections filtered to non-null `childProductId` before RPC call
- T-2-05-03 (audit_log override path): accepted — RPC writes audit_log on override; verified at DB level

## Self-Check: PASSED

- [x] `bar-pos/src/features/add-combo-to-tab/index.ts` — exists
- [x] `bar-pos/src/features/add-combo-to-tab/model/useAddComboToTab.ts` — exists, has `COMBO_UNAVAILABLE`, `NESTED_COMBO_FORBIDDEN`
- [x] `bar-pos/src/features/add-combo-to-tab/ui/ComboBuilderSheet.tsx` — exists, has `useAddComboToTab`, `overrideActive` (2+ matches), `Manager override` banner text, `disabled` on confirm button
- [x] `bar-pos/src/shared/ui/alert.tsx` — exists
- [x] `grep "ComboBuilderSheet" ProductGrid.tsx` — 3 matches (import + JSX open + JSX close tag area)
- [x] `grep "from '@features/add-combo-to-tab'" ProductGrid.tsx` — 1 match
- [x] `cd bar-pos && npx vitest run src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx` — 5/5 pass
- [x] `cd bar-pos && npm run typecheck` — exit 0
- [x] `cd bar-pos && npx eslint src/features/add-combo-to-tab/ src/shared/ui/alert.tsx` — 0 errors
- [x] Commits `e01474c` and `0a8962d` exist in git log

---
*Phase: 02-combos*
*Completed: 2026-04-23*
