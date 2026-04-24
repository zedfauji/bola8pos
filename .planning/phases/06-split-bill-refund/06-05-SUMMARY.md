---
phase: 06-split-bill-refund
plan: 05
subsystem: entities
tags: [tab-entity, refund-entity, payment-entity, fsd, tanstack-query]
dependency_graph:
  requires: [06-03]
  provides: [useSubTabs, useRefunds, useRefundsByPayment, refundKeys, tabKeys.subTabs, parent_tab_id-filter]
  affects: [entities/tab, entities/refund, entities/payment]
tech_stack:
  added: [entities/refund FSD slice]
  patterns: [pre-regen cast (supabase as any), tabKeys key factory extension, Result<T> query pattern]
key_files:
  created:
    - bar-pos/src/entities/refund/model/types.ts
    - bar-pos/src/entities/refund/model/queries.ts
    - bar-pos/src/entities/refund/index.ts
  modified:
    - bar-pos/src/entities/tab/model/queries.ts
    - bar-pos/src/entities/payment/model/types.ts
    - bar-pos/src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx
    - bar-pos/src/shared/ui/PersonCard/PersonCard.stories.tsx
decisions:
  - "Used pre-regen cast (supabase as any) for refund queries since refunds/refund_items not yet in supabase.types.ts"
  - "isRefund and refundId added to local entities/payment PaymentSchema (not re-exported from domain.ts since that schema is separate)"
  - "parent_tab_id is already in supabase.types.ts from Phase 06-03 migration — no cast needed for .is() filter"
metrics:
  duration_minutes: 15
  completed_date: 2026-04-24
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 06 Plan 05: Entity Hooks — useSubTabs + Refund FSD Slice

## One-liner

Extended tab entity with sub-tab query hook and POS-list exclusion filter; created new entities/refund FSD slice with useRefunds, useRefundsByPayment, and refundKeys.

## What Was Built

### Task 1 — Tab Entity Extensions

**`tabKeys.subTabs`** — new key factory added to `tabKeys`:
```typescript
subTabs: (parentTabId: string) => [...tabKeys.all, 'sub-tabs', parentTabId] as const
```

**`useSubTabs(parentTabId)`** — new exported hook that queries tabs where `parent_tab_id = parentTabId`. Returns `Result<Tab[]>` using the existing `supabaseQuery` + `mapTabRow` pattern. Disabled when `parentTabId` is null or empty.

**`useTabs` filter** — added `.is('parent_tab_id', null)` to the existing useTabs query chain, ensuring sub-tabs never appear in the main POS tab list (satisfies S4 Pitfall 4 requirement).

### Task 2 — Payment Types + Refund Entity

**`entities/payment/model/types.ts`** — added `isRefund: z.boolean().optional()` and `refundId: z.uuid().nullable().optional()` to the local PaymentSchema, matching the DB columns added in Phase 06-01.

**`entities/refund/model/types.ts`** — re-exports `Refund`, `RefundCreate`, `RefundItem`, `RefundReason`, `RefundSchema`, `RefundItemSchema`, `RefundReasonSchema`, `RefundCreateSchema` from `@shared/lib/domain`.

**`entities/refund/model/queries.ts`** — complete TanStack Query hook layer:
- `refundKeys` factory with `all`, `lists()`, `byPayment(paymentId)`, `detail(id)`
- `mapRefundRow()` — maps raw DB rows (with nested refund_items) to `Refund` type
- `useRefunds()` — fetches all refunds ordered newest-first
- `useRefundsByPayment(paymentId)` — fetches refunds for a specific payment, disabled when null
- Uses pre-regen cast `const db = supabase as any` (refunds table not yet in supabase.types.ts)

**`entities/refund/index.ts`** — public barrel exposing hooks, keys, types, and schemas as named exports.

## Verification

```
✅ tabKeys.subTabs exists in entities/tab/model/queries.ts
✅ useSubTabs exported from entities/tab/model/queries.ts
✅ .is('parent_tab_id', null) in useTabs query
✅ entities/refund/model/types.ts, queries.ts, index.ts all exist
✅ useRefunds, useRefundsByPayment, refundKeys exported from entities/refund/index.ts
✅ npm run typecheck — 0 errors
✅ npm run lint — 0 errors, 0 warnings
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing story mock missing Product fields**
- **Found during:** Task 1 typecheck run
- **Issue:** `SubTabColumn.stories.tsx` and `PersonCard.stories.tsx` had product mock objects missing `comboEligible` and `isCombo` fields (added to ProductSchema in a prior plan but stories not updated)
- **Fix:** Added `comboEligible: true, isCombo: false` to product mock objects in both story files
- **Files modified:** `bar-pos/src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx`, `bar-pos/src/shared/ui/PersonCard/PersonCard.stories.tsx`
- **Commits:** 06f8aa7

**2. [Rule 1 - Bug] z.string().uuid() deprecated lint error**
- **Found during:** Task 2 lint run
- **Issue:** Used `z.string().uuid()` for `refundId` field in payment types — deprecated in Zod v4, should be `z.uuid()`
- **Fix:** Changed to `z.uuid().nullable().optional()`
- **Files modified:** `bar-pos/src/entities/payment/model/types.ts`
- **Commits:** d9ca64b

## Known Stubs

None — all hooks are fully wired to Supabase queries.

## Threat Flags

None — no new network endpoints or auth paths introduced. The refund query uses RLS SELECT policy `USING (true)` per T-06-13 (intentional: all authenticated staff can see refunds for reporting).

## Self-Check

- [x] `bar-pos/src/entities/tab/model/queries.ts` — exists (modified)
- [x] `bar-pos/src/entities/refund/model/types.ts` — exists (created)
- [x] `bar-pos/src/entities/refund/model/queries.ts` — exists (created)
- [x] `bar-pos/src/entities/refund/index.ts` — exists (created)
- [x] Commit 06f8aa7 — Task 1 (tab entity extensions + story fixes)
- [x] Commit d9ca64b — Task 2 (refund entity + payment types)

## Self-Check: PASSED
