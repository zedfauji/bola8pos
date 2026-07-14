---
phase: 06-split-bill-refund
plan: 07
subsystem: features/split-tab
tags: [split-bill, feature, ui, mutations, rpc]
dependency_graph:
  requires: [06-04, 06-05, 06-06]
  provides: [SplitTabSheet, useSplitByItem, useSplitEvenly, useSplitByPerson, useSplitByAmount]
  affects: [widgets that embed SplitTabSheet, POS split flow]
tech_stack:
  added: []
  patterns:
    - FSD feature slice with model/useSplitTab.ts + ui/SplitTabSheet.tsx + index.ts barrel
    - supabase-as-any pre-regen cast for split_tab_* RPCs (not in supabase.types.ts)
    - callProcessPayment edge function caller for Evenly payment loop (not supabase.rpc)
    - computeEvenSplit + buildEvenPayments from @shared/lib/split-math for integer precision
    - tap-to-assign UX pattern for Item/Person modes (selectedItemId state + column onSelect)
    - ternary chain for isValid to avoid @typescript-eslint/no-unnecessary-condition on switch exhaustion
key_files:
  created:
    - bar-pos/src/features/split-tab/model/useSplitTab.ts
    - bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx
    - bar-pos/src/features/split-tab/index.ts
  modified: []
decisions:
  - useSplitEvenly uses split_tab_evenly RPC for validation then callProcessPayment loop (N calls); does NOT create sub-tabs
  - SplitTab 'transfer' method removed from SplitEvenlyInput — PaymentMethodSchema only has cash/card/rappi
  - isValid for amount mode uses Math.abs(remaining) <= 0.01 (±1 cent tolerance matching RPC contract)
  - Non-null assertion error at line 43 of the test file (split-tab-rpc.integration.test.ts) is pre-existing; not introduced by this plan
  - ternary chain used for isValid (not switch) to satisfy @typescript-eslint/no-unnecessary-condition rule
  - autoFocusName=true only for newly added PersonCard (idx === personColumns.length - 1 && length > 2) to avoid focus on initial render
metrics:
  duration: 25min
  completed: 2026-04-24
  tasks_completed: 2
  files_created: 3
---

# Phase 06 Plan 07: SplitTabSheet + useSplitTab Hook Summary

**One-liner:** 4-mode split sheet (Evenly/Item/Person/Amount) wired to split_tab_* RPCs + callProcessPayment payment loop, with computeEvenSplit preview and tap-to-assign column UX.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build useSplitTab mutation hook | 8b7d98a | bar-pos/src/features/split-tab/model/useSplitTab.ts |
| 2 | Build SplitTabSheet + feature index | 886a170 | bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx, bar-pos/src/features/split-tab/index.ts |

## What Was Built

### useSplitTab.ts (Task 1)

Four mutation hooks:
- **useSplitByItem** — calls `split_tab_by_item` RPC with `p_assignments`; maps PARENT_TAB_PAID / ITEM_ASSIGNED_TWICE / ITEM_NOT_IN_PARENT errors; invalidates tabKeys on success
- **useSplitEvenly** — calls `split_tab_evenly` RPC for validation, then runs N `callProcessPayment` calls using `buildEvenPayments` for integer-precise amounts; cash payments include `tenderedAmount` only for last payment; non-cash omit `tenderedAmount` entirely (exactOptionalPropertyTypes compliance)
- **useSplitByPerson** — calls `split_tab_by_person` RPC with `p_n` + `p_assignments`; maps PARENT_TAB_PAID / ITEM_ASSIGNED_TWICE errors
- **useSplitByAmount** — calls `split_tab_by_amount` RPC with `p_amounts`; maps PARENT_TAB_PAID error

All use `const db = supabase as any` pre-regen cast (split RPCs not in supabase.types.ts yet).

### SplitTabSheet.tsx (Task 2)

Bottom sheet `h-[85vh] side="bottom"` with four TabsContent modes:

**Evenly:** 1-9 keypad (POSButton touchSize="xl"), computeEvenSplit preview card showing base/last amounts when N ≥ 2. isValid: `n >= 2`.

**By Item:** Horizontal scroll layout with "Unassigned" fixed column + SubTabColumn columns + "Add check" dashed button. Tap-to-assign UX: tap item in any column → selectedItemId state; tap target column → item moves. Selected item indicator bar shown. Items in Unassigned column show as clickable list. isValid: `unassigned.length === 0 && columns.length >= 1`.

**By Person:** Same tap-to-assign UX as Item mode but uses PersonCard (editable name) instead of SubTabColumn. Unassigned column labeled "Unassigned (split evenly)" — items allowed at confirm time. isValid: `columns.length >= 2`.

**By Amount:** Warning banner + label+MoneyInput rows per check + live "Entered total / Remaining / Tab total" card. isValid: `remainingExact && allAmounts > 0 && length >= 2`.

**Footer (all modes):** "Keep tab open" outline button + "Confirm Split" POSButton (touchSize="large", disabled when !isValid || isMutating).

**ConfirmDialog** on cancel when assignments exist: title "Discard split?", description "Your assignments will be lost.", confirm "Discard" (destructive), cancel "Keep editing".

Success toast messages match UI-SPEC copywriting contract exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused functions**
- **Found during:** Task 2 typecheck
- **Issue:** `computeTabTotal`, `handleItemSelect`, `handleSelectPersonUnassignedItem` were declared but never used (TypeScript TS6133)
- **Fix:** Removed the 3 unused function declarations; inline computation used where needed
- **Files modified:** bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx

**2. [Rule 1 - Bug] Fixed @typescript-eslint/no-unnecessary-condition on isValid switch**
- **Found during:** Task 2 lint
- **Issue:** switch statement `case 'amount':` triggered "comparison is always true" since TS narrows to 'amount' at that point
- **Fix:** Replaced switch with ternary chain; amount mode runs as fallthrough without explicit comparison
- **Files modified:** bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx

**3. [Rule 1 - Bug] Removed 'transfer' from SplitEvenlyInput.method**
- **Found during:** Task 1 implementation
- **Issue:** Plan draft included `'transfer'` in method type but `PaymentMethodSchema` only has `'cash' | 'card' | 'rappi'`
- **Fix:** SplitEvenlyInput.method typed as `'cash' | 'card' | 'rappi'`
- **Files modified:** bar-pos/src/features/split-tab/model/useSplitTab.ts

## Known Stubs

None. All four split modes are fully wired to RPCs. The Evenly payment loop uses `callProcessPayment` with `method: 'cash'` hardcoded (the plan specifies this default; callers can be extended later for card payment selection in the UI).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| No new threats | — | T-06-16 (ITEM_ASSIGNED_TWICE) mitigated in both DB RPC and UI local state. T-06-17 (N payment loop DoS) accepted — max N=9 enforced by keypad buttons. |

## Self-Check: PASSED

- [x] `bar-pos/src/features/split-tab/model/useSplitTab.ts` — exists ✓
- [x] `bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx` — exists ✓
- [x] `bar-pos/src/features/split-tab/index.ts` — exists ✓
- [x] Commit 8b7d98a — useSplitTab hook ✓
- [x] Commit 886a170 — SplitTabSheet + index ✓
- [x] `npm run typecheck` → 0 errors ✓
- [x] `npx eslint src/features/split-tab` → 0 errors ✓
