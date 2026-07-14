---
phase: "06"
plan: "08"
subsystem: "process-refund"
tags: [refund, mutation, ui, property-test, fsd]
dependency_graph:
  requires: ["06-05 (refund entity)", "06-07 (split-tab patterns)", "shared/ui/select", "manager-pin-gate"]
  provides: ["features/process-refund/RefundSheet", "features/process-refund/useProcessRefund"]
  affects: ["widgets/PaymentPane (consumer)", "entities/payment (queries extended)"]
tech_stack:
  added: ["@shared/ui/select.tsx (Radix-UI Select)"]
  patterns: ["useMutation with Result<T,E> return", "supabase as any RPC cast", "ManagerPinDialog outside Sheet for stacking context", "useMemo for derived item list + useState for overrides"]
key_files:
  created:
    - "bar-pos/src/features/process-refund/model/useProcessRefund.ts"
    - "bar-pos/src/features/process-refund/ui/RefundSheet.tsx"
    - "bar-pos/src/features/process-refund/index.ts"
    - "bar-pos/src/features/process-refund/model/refund-math.test.ts"
    - "bar-pos/src/shared/ui/select.tsx"
  modified:
    - "bar-pos/src/entities/payment/model/queries.ts"
    - "bar-pos/src/entities/payment/model/index.ts"
    - "bar-pos/src/entities/payment/index.ts"
    - "bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx"
decisions:
  - "ManagerPinDialog rendered outside Sheet to avoid z-index stacking context issues"
  - "Item list derived via useMemo from raw data + overrides Map (avoids setState-in-effect pattern)"
  - "supabase as any with file-level eslint-disable (matches project convention in useAddComboToTab)"
  - "Select component created manually from Radix-UI (shadcn Select was missing from @shared/ui)"
  - "useOrderItemsByPayment uses 3-step join (payment -> orders -> order_items) to resolve items"
metrics:
  duration: "~3 hours (includes prior session + this continuation)"
  completed: "2026-04-24"
  tasks_completed: 4
  files_changed: 9
---

# Phase 06 Plan 08: Process Refund FSD Slice — Summary

Right-side RefundSheet with per-item quantity/restock controls, ManagerPinDialog PIN gate, and Result-typed `process_refund` RPC mutation. Includes P10 property test guaranteeing refund amounts never exceed the original payment balance.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| T1 | P10 property test: refund amount ≤ original − already_refunded | `9ca02aa` |
| T2 | `useProcessRefund` mutation hook + `useOrderItemsByPayment` entity query | `9ca02aa`, `121f2fa` |
| T3 | `Select` shared UI component (prerequisite) | `e1635f4` |
| T4 | `RefundSheet` UI with ManagerPinDialog integration | `0f9f280` |
| T5 | Feature barrel `process-refund/index.ts` | `0f9f280` |

## Implementation Notes

### RefundSheet

- Opens as `<Sheet side="right">` from `@shared/ui/sheet`
- Items loaded via `useOrderItemsByPayment(paymentId)` — 3-step join (payment→tab→order_items)
- Already-refunded quantities fetched via `useRefundsByPayment` and merged into display
- Each item row: Checkbox (select), QuantityControl (qty spinner, shown when selected), restock Toggle
- `isValid`: `selectedItems.length >= 1 && reason !== '' && refundTotal > 0`
- "Request approval" button → `setPinOpen(true)` → `ManagerPinDialog` with `requiredAction='process_refund'`
- PIN accepted → calls `useProcessRefund().mutateAsync(...)` → toast success/error
- `MoneyDisplay` used for refund total (no `.toFixed`)

### useProcessRefund

- Wraps `supabase.rpc('process_refund', {...})` in `Result<string>` return type
- Error codes mapped: `REFUND_EXCEEDS_ORIGINAL`, `ITEM_NOT_IN_ORIGINAL_ORDER`, `AUTH_FORBIDDEN`
- Cache invalidation: `refundKeys.lists()`, `refundKeys.byPayment(id)`, `tabKeys.lists()`
- File-level `eslint-disable` for `no-explicit-any / no-unsafe-*` (matches project convention)

### P10 Property Test

```
P10: refund amount ≤ original - already_refunded
Strategy: Integer cent arithmetic to avoid floating-point precision issues
Runs 100 fast-check cases; all 4 tests pass
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `useProcessRefund.ts` committed as stub initially**
- **Found during:** Continuation of previous session
- **Issue:** File written by previous session's `Write` tool was not persisted correctly
- **Fix:** Rewrote using PowerShell `Set-Content`, verified content with `Get-Content`
- **Files modified:** `useProcessRefund.ts`
- **Commit:** `121f2fa`

**2. [Rule 2 - Missing critical functionality] `SplitTabSheetProps` not exported**
- **Found during:** TypeScript compilation after plan 08 work
- **Issue:** `split-tab/index.ts` re-exported `SplitTabSheetProps` but the interface was not `export interface`
- **Fix:** Added `export` to the interface declaration
- **Files modified:** `bar-pos/src/features/split-tab/ui/SplitTabSheet.tsx`
- **Commit:** `a2964c6`

**3. [Rule 2 - Missing component] `Select` not in `@shared/ui`**
- **Found during:** RefundSheet implementation needed a reason dropdown
- **Issue:** `@shared/ui` had no `Select` component (not installed via shadcn/ui CLI)
- **Fix:** Created `select.tsx` manually using Radix-UI primitives following shadcn patterns
- **Files modified:** `bar-pos/src/shared/ui/select.tsx`, `bar-pos/src/shared/ui/index.ts`
- **Commit:** `e1635f4`

**4. [Rule 3 - Blocking] `ManagerPinDialog` rendered outside `<Sheet>` stacking context**
- **Found during:** Implementation analysis of Sheet + Dialog composition
- **Issue:** Dialog inside Sheet causes z-index conflicts in Radix-UI
- **Fix:** Rendered `ManagerPinDialog` as sibling fragment outside `<Sheet>`, controlled by `pinOpen` state
- **Files modified:** `RefundSheet.tsx` (architectural decision, not bug)

## Known Stubs

None — all stubs from the initial commit were replaced with full implementations.

## Self-Check: PASSED

- [x] `bar-pos/src/features/process-refund/model/useProcessRefund.ts` — real implementation, ESLint clean
- [x] `bar-pos/src/features/process-refund/ui/RefundSheet.tsx` — 335 lines, `requiredAction="process_refund"` at line 327
- [x] `bar-pos/src/features/process-refund/index.ts` — barrel exports RefundSheet and useProcessRefund
- [x] `bar-pos/src/features/process-refund/model/refund-math.test.ts` — 4/4 tests pass
- [x] `bar-pos/src/shared/ui/select.tsx` — Radix-UI Select component created
- [x] TypeScript: `npm run typecheck` exits 0
- [x] ESLint: `npx eslint src/features/process-refund/ src/entities/payment/` exits 0
- [x] Vitest: all 4 property tests pass
