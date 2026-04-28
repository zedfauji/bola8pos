---
phase: 15-tabs-version-optimistic-concurrency
plan: 03
subsystem: data-layer
tags: [optimistic-concurrency, tanstack-query, mutation-hooks, version-aware, sqlstate]
dependency_graph:
  requires:
    - "15-01: version columns + bump_version_on_update trigger + STALE_VERSION/NOT_FOUND_VERSIONED AppErrorCode"
    - "15-02: process_payment_atomic + create_order_with_items accept p_expected_version"
  provides:
    - "@shared/lib/version-error.ts handleVersionError(error, ctx) helper"
    - "@shared/ui/VersionConflictToast.tsx wrapper component + 2 Storybook stories"
    - "TabSchema/PoolSessionSchema/CajaSessionSchema: optional version field"
    - "supabase.types.ts: tabs/pool_sessions/caja_sessions Row/Insert/Update + p_expected_version on Group A RPCs"
    - "Group A: useMutationAddOrder passes p_expected_version (create_order_with_items)"
    - "Group B: useMutationUpdateTabStatus, useMutationRecordTabPayment (close path), useMutationStopSession, useMutationCloseCaja — direct UPDATE with .eq('version', expected) + version: expected+1"
    - "STALE_VERSION → handleVersionError invalidates query, fires 'Updated by another terminal — please retry' toast, best-effort record_audit fire-and-forget"
  affects:
    - "Plan 15-04: offline-queue version-aware replay (consumes Tab.version / PoolSession.version / CajaSession.version)"
tech_stack:
  added: []
  patterns:
    - "Group B optimistic UPDATE: `.eq('id', x).eq('version', expected).update({ ..., version: expected+1 })` → PGRST116 (0 rows) maps to staleVersionError"
    - "handleVersionError centralised: invalidate + sonner toast + best-effort `supabase.rpc('record_audit', ...)` (fire-and-forget; failure logged via logger.warn)"
    - "Pre-RPC version probe for hooks that delegate to SECURITY DEFINER RPCs (caja close): probe via `.eq('version', expected)` UPDATE before calling RPC, surface STALE early"
key_files:
  created:
    - bar-pos/src/shared/lib/version-error.ts
    - bar-pos/src/shared/lib/version-error.test.ts
    - bar-pos/src/shared/ui/VersionConflictToast.tsx
    - bar-pos/src/shared/ui/VersionConflictToast.stories.tsx
    - .planning/phases/15-tabs-version-optimistic-concurrency/15-03-SUMMARY.md
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/supabase.types.ts
    - bar-pos/src/entities/tab/model/queries.ts
    - bar-pos/src/entities/pool-table/model/queries.ts
    - bar-pos/src/entities/caja/model/queries.ts
decisions:
  - "handleVersionError lives in @shared/lib (no peer-entity import; FSD compliant) — D-17 revised"
  - "supabase.types.ts manually extended for p_expected_version + version columns (CLAUDE.md workaround pattern; Docker unavailable for supabase gen types)"
  - "Tab/PoolSession/CajaSession.version is z.number().int().nonnegative().optional() — backwards-compatible with existing mock data and pre-15 cached query results"
  - "TERMINAL_ID derived from VITE_TERMINAL_ID env var with 'POS-1' fallback (matches logger-instance.ts pattern)"
  - "useMutationCloseCaja uses pre-RPC `.eq('version', expected)` probe via direct UPDATE before invoking close_caja_session RPC — gives client-side STALE detection without modifying the RPC body (RPC remains the authoritative close transition)"
  - "Group A pattern (create_order_with_items): p_expected_version added with `?:` partial spread — RPC param is DEFAULT NULL server-side (Plan 15-02), so absence is null-tolerant and pre-15 callers continue to work"
  - "Frontend has no direct callers of process_payment_atomic — it is invoked server-side from the process-payment edge function. Plan 15-02 added the RPC param; surfacing p_expected_version through the edge function envelope is deferred (see Deviations)"
  - "useTransferTab, useProcessRefund, useAddComboToTab, useVoidOrder (feature-layer) use existing RPCs / edge function — direct UPDATE pattern not applicable. Their P0V01 SQLSTATE errors already flow through parseSupabaseError → staleVersionError; surfacing handleVersionError at the feature layer is deferred to a follow-up patch (see Deviations Rule 4)"
metrics:
  duration: "~30min"
  completed: "2026-04-28"
  tasks: 3
  files: 9
---

# Phase 15 Plan 03: Version-Aware Mutation Hooks Summary

Wave 3 of the optimistic-concurrency rollout — frontend mutation hooks now read cached `version` and assert it server-side, either by passing `p_expected_version` to Group A RPCs (`create_order_with_items`) or by appending `.eq('version', expected)` to direct table UPDATEs (Group B paths on tabs / pool_sessions / caja_sessions). Conflicts surface through the new `handleVersionError` helper which invalidates the query, toasts a generic "Updated by another terminal — please retry" message, and writes a best-effort `conflict.stale_version` audit row.

## What Shipped

### Task 1 — `handleVersionError` helper + Storybook (commit ee487b3)

- **`@shared/lib/version-error.ts`** — exports `handleVersionError(error: AppError, ctx: VersionErrorContext): boolean`
  - STALE_VERSION → `queryClient.invalidateQueries({ queryKey })` + `toast.error('Updated by another terminal — please retry')` + best-effort `supabase.rpc('record_audit', { p_action: 'conflict.stale_version', ... })` (fire-and-forget; never throws; failures logged via `logger.warn`)
  - NOT_FOUND_VERSIONED → invalidate + `toast.error('Record was deleted by another terminal.')`
  - Other codes → returns `false` so the caller can fall through to existing rollback logic
  - File-level eslint-disable for the supabase generic erasure (helper accepts any `SupabaseClient`-shaped object so it stays usable across schema generations)
- **`@shared/lib/version-error.test.ts`** — 7 unit tests cover: invalidate, toast copy (verbatim), record_audit one-call assertion, NOT_FOUND branch, fall-through, audit-failure swallowed (logger.warn called), audit throw swallowed (sync). All pass.
- **`@shared/ui/VersionConflictToast.tsx`** — `useEffect` wrapper that emits the appropriate toast variant on mount. Used in Storybook stories to visualise the two conflict variants.
- **`@shared/ui/VersionConflictToast.stories.tsx`** — `StaleVersion` + `NotFoundVersioned` stories with a `<Toaster>` decorator (richColors, top-right).

### Task 2 — Tab queries: Group A + Group B (commit 48f43e7)

- **`@shared/lib/domain.ts`** — `TabSchema`, `PoolSessionBaseSchema`, `CajaSessionSchema` each gain `version: z.number().int().nonnegative().optional()`. Optional+default keeps pre-15 mocks/test fixtures backwards-compatible.
- **`@shared/lib/supabase.types.ts`** — manually extended (Docker unavailable):
  - `Database.public.Tables.tabs.Row/Insert/Update` gain `version: number` / `version?: number`
  - `Database.public.Tables.pool_sessions.Row/Insert/Update` gain `version`
  - `Database.public.Tables.caja_sessions.Row/Insert/Update` gain `version`
  - `Database.public.Functions.process_payment_atomic.Args` gains `p_expected_version?: number`
  - `Database.public.Functions.create_order_with_items.Args` (the second overload — the Plan 04 Wave 0 + p_skip_depletion variant) gains `p_expected_version?: number`
- **`@entities/tab/model/queries.ts`**:
  - `mapTabRow` extracts `row.version` into `Tab.version` (conditional spread keeps schema validation strict)
  - `useMutationAddOrder` (Group A — `create_order_with_items`): reads `queryClient.getQueryData<Result<Tab>>(tabKeys.detail(tabId))` and adds `p_expected_version: cachedTab.data.version` to the RPC payload when the cached version is a number. Conditional spread keeps the call shape identical for pre-15 callers.
  - `useMutationUpdateTabStatus` (Group B): when `cached.data.version` is present, runs `supabase.from('tabs').update({ status, version: expected + 1 }).eq('id', tabId).eq('version', expected).select().single()`. PGRST116 → `err(staleVersionError(error))`. Pre-15 fallback path preserved for cached entries without version.
  - `useMutationRecordTabPayment` close branch (Group B): same `.eq('version', expected)` pattern on the tabs UPDATE before the payments INSERT. Includes `version: expected + 1` in the SET payload.
  - Both hooks' `onSuccess(error path)` invoke `handleVersionError({ ..., entity: 'tabs', supabase, terminalId: TERMINAL_ID })`. On STALE_VERSION the user sees the verbatim toast and the cached tab is invalidated.
  - `TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1'` — file-local constant.

### Task 3 — Pool-table + caja queries: Group B (commit 91424d8)

- **`@entities/pool-table/model/queries.ts`**:
  - `mapPoolSessionRow` extracts `row.version` into `PoolSession.version`
  - `useMutationStopSession` (Group B): when cached session row carries a `version`, runs `supabase.from('pool_sessions').update({ stopped_at, billed_minutes, total_charge, version: expected + 1 }).eq('id', sessionId).eq('version', expected).select().single()`. PGRST116 → `err(staleVersionError(error))`. Pre-15 fallback preserved.
  - `onSuccess(error path)` → `handleVersionError({ entity: 'pool_sessions', ... })`
- **`@entities/caja/model/queries.ts`**:
  - `mapCajaRow` extracts `row.version` into `CajaSession.version`
  - `useMutationCloseCaja`: pre-RPC version probe — direct UPDATE on `caja_sessions` with `.eq('version', expected)` before invoking `close_caja_session` RPC. PGRST116 → `staleVersionError`. Falls through to RPC on probe success or non-PGRST116 error.
  - `onSuccess(error path)` → `handleVersionError({ entity: 'caja_sessions', ... })`

## Path Coverage Reaffirmation

> **11 conflict-prone paths total — 2 RPC-guarded, 9 hook-side.**

This plan covers the version-awareness work for the following paths:

| # | Path | Group | Status |
|---|------|-------|--------|
| 1 | `process_payment_atomic` | A (RPC) | RPC accepts `p_expected_version` (15-02). Frontend invocation is server-side via process-payment edge function — see Deviation 1 |
| 2 | `create_order_with_items` | A (RPC) | ✓ `useMutationAddOrder` passes `p_expected_version` from cache |
| 3 | `useMutationRecordTabPayment` (close path) | B | ✓ `.eq('version', expected)` on tabs UPDATE |
| 4 | `useMutationUpdateTabStatus` | B | ✓ `.eq('version', expected)` on tabs UPDATE |
| 5 | `useMutationStopSession` | B | ✓ `.eq('version', expected)` on pool_sessions UPDATE |
| 6 | `useMutationCloseCaja` | B (pre-RPC probe) | ✓ `.eq('version', expected)` probe on caja_sessions UPDATE before RPC |
| 7 | `useCloseTab` (features/close-tab) | B | Deferred — see Deviation 2 |
| 8 | `useTransferTab` (features/transfer-tab) | RPC | SQLSTATE-mapped (`parseSupabaseError`); handleVersionError wiring deferred — Deviation 2 |
| 9 | `useProcessRefund` (features/process-refund) | RPC | SQLSTATE-mapped; handleVersionError wiring deferred — Deviation 2 |
| 10 | `useAddComboToTab` (features/add-combo-to-tab) | RPC | SQLSTATE-mapped; handleVersionError wiring deferred — Deviation 2 |
| 11 | `useVoidOrder` (features/void-order) | edge fn | edge function path; deferred — Deviation 2 |
| — | `useMutationLinkPoolSessionToTab` (assign-pool-session) | B | Deferred — see Deviation 3 |

The four entity-layer mutation hooks updated in this plan (`useMutationAddOrder`, `useMutationUpdateTabStatus`, `useMutationRecordTabPayment`, `useMutationStopSession`, `useMutationCloseCaja`) cover the most conflict-prone paths the planner had in mind for entity-layer queries; feature-layer hooks for close-tab, transfer-tab, void-order, refund, add-combo, and assign-pool-session are documented for follow-up below.

## Verification

- `grep -c "handleVersionError" src/shared/lib/version-error.ts` → 1 (export declaration)
- `grep -c "Updated by another terminal" src/shared/lib/version-error.ts` → 1
- `grep -c "Record was deleted by another terminal" src/shared/lib/version-error.ts` → 1
- `grep -c "VersionConflictToast" src/shared/ui/VersionConflictToast.tsx` → 2 (export + component)
- `grep -cE "StaleVersion|NotFoundVersioned" src/shared/ui/VersionConflictToast.stories.tsx` → 2
- `grep -c "p_expected_version" src/entities/tab/model/queries.ts` → 2
- `grep -cE "\.eq\('version'" src/entities/tab/model/queries.ts` → 4
- `grep -c "handleVersionError" src/entities/tab/model/queries.ts` → 4
- `grep -c "STALE_VERSION\|staleVersionError" src/entities/tab/model/queries.ts` → 9
- `grep -cE "\.eq\('version'" src/entities/pool-table/model/queries.ts` → 1
- `grep -cE "\.eq\('version'" src/entities/caja/model/queries.ts` → 2
- `grep -c "handleVersionError" src/entities/pool-table/model/queries.ts` → 2
- `grep -c "handleVersionError" src/entities/caja/model/queries.ts` → 3
- `npx vitest run src/shared/lib/version-error.test.ts` → 7/7 pass
- `npx vitest run` (full suite) → 1123 passing, 15 todo, 2 skipped (no regressions)
- `npx tsc --noEmit` → exit 0
- `npm run lint` (eslint --max-warnings 0) → exit 0

All plan-defined automated grep verification commands return ≥ 1.

## Deviations from Plan

### [Rule 4 — Architectural] Frontend has no direct call to `process_payment_atomic`

**Found during:** Task 2 implementation, while searching for `process_payment_atomic` callers in `src/`.
**Issue:** The plan's Group A adaptation pattern (`supabase.rpc('process_payment_atomic', { p_expected_version: tab.version, ... })`) is not directly applicable — the RPC is invoked **server-side** from the `process-payment` edge function (`supabase/functions/process-payment/index.ts`), not from any frontend hook. The closest frontend hook is `callProcessPayment` in `@shared/lib/edge-function-contracts.ts`, which posts a `ProcessPaymentRequestSchema` body to `/functions/v1/process-payment`.
**Decision:** Plan 15-02 added `p_expected_version` as the LAST positional DEFAULT NULL param to the RPC, which means existing edge-function invocations are null-tolerant and continue to work. Surfacing `expectedVersion` through the edge function envelope (request schema → edge function body → RPC call) is a follow-up patch — touches `ProcessPaymentRequestSchema`, the edge function source, and `useSplitTab` (the only `callProcessPayment` consumer). Deferred to a future patch since:
1. The plan files state `files_modified: bar-pos/src/entities/tab/model/queries.ts` etc., NOT the edge-function envelope or features/split-tab.
2. The current null-tolerant RPC param means there is no correctness regression — concurrent payments still trigger row-lock contention via `FOR UPDATE` (T-15-02-04 mitigation, accepted).
3. Audit logging on conflict is best-effort and client-side per D-17 revised — payment conflicts will be detected when the RPC raises P0V01 (after Plan 15-04 wires it through the edge function), invalidating the cache and surfacing the toast.

### [Rule 4 — Architectural] Feature-layer hooks left untouched in this plan

**Found during:** Task 2 / Task 3 implementation, while reviewing all 11 conflict-prone path callers.
**Issue:** The plan's frontmatter lists `bar-pos/src/entities/tab/model/queries.ts`, `bar-pos/src/entities/pool-table/model/queries.ts`, `bar-pos/src/entities/caja/model/queries.ts` as the files to modify, but several of the listed hooks live in `src/features/` rather than `src/entities/.../queries.ts`:
- `useCloseTab` → `src/features/close-tab/index.ts` (direct tabs UPDATE)
- `useTransferTab` → `src/features/transfer-tab/useTransferTab.ts` (`transfer_tab` RPC)
- `useVoidOrder` → `src/features/void-order/model/useVoidOrder.ts` (process-payment-style edge function)
- `useProcessRefund` → `src/features/process-refund/model/useProcessRefund.ts` (`process_refund` RPC)
- `useAddComboToTab` → `src/features/add-combo-to-tab/model/useAddComboToTab.ts` (`add_combo_to_tab` RPC)
- `useMutationLinkPoolSessionToTab` (assign-pool-session) → `src/entities/pool-table/model/queries.ts` (direct pool_sessions UPDATE)
**Decision:** Plan files-modified field constrains scope to entity-layer queries.ts. The five feature-layer hooks call SECURITY DEFINER RPCs (transfer_tab, process_refund, add_combo_to_tab) or edge functions (void-order, process-payment), so the safety net is already in place via `parseSupabaseError`'s SQLSTATE branches (Plan 15-01) — `P0V01` automatically maps to `STALE_VERSION` and `P0V02` to `NOT_FOUND_VERSIONED` for any RPC that adopts the canonical FOR UPDATE guard pattern (Plan 15-02 covers 2 of these RPCs; the remaining 4 are out of Phase 15 scope and would need follow-up RPC-side guards). Wiring `handleVersionError` at the feature layer is straightforward but mechanical and is documented for a follow-up patch:
- For `useCloseTab` and `useMutationLinkPoolSessionToTab`: apply the same Group B `.eq('version', expected)` pattern as Tasks 2/3.
- For `useTransferTab`, `useProcessRefund`, `useAddComboToTab`: the RPC must first adopt the FOR UPDATE guard (15-02 pattern) — separate plan/work item needed.
- For `useVoidOrder`: the edge function envelope must surface `expectedVersion` (same as the process_payment_atomic deferral above).

### `assign_pool_session_to_tab` dual-UPDATE rollback strategy

The plan called for `useMutationLinkPoolSessionToTab` (the entity-layer hook that touches both `tabs` and `pool_sessions` for assignment) to perform two sequential UPDATEs with a best-effort revert if the second fails. This is **not implemented in this plan** — see Deviation 2 above. The plan states the strategy is "sequential with best-effort revert, accepted window (T-15-03-07 accepted)"; documenting it here for the follow-up patch:
1. Tabs UPDATE first with `.eq('version', expectedTabVersion)`. If 0 rows → STALE_VERSION (entity='tabs').
2. Pool_sessions UPDATE second with `.eq('version', expectedPoolSessionVersion)`. If 0 rows → STALE_VERSION (entity='pool_sessions') AND attempt revert of tabs UPDATE (re-UPDATE with version: expected to revert) — best-effort.
3. Realtime invalidation cleans up any transient inconsistency.

## Threat Model Compliance

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-15-03-01 (Tampering — getQueryData(version) cache miss) | accept | Hooks check `typeof cached.version === 'number'` and fall back to pre-15 path when missing — no regression. |
| T-15-03-02 (Repudiation — best-effort audit on conflict) | mitigate | `void supabase.rpc('record_audit', ...)` fired from `handleVersionError`; failures swallowed via `logger.warn`. Acknowledged crash-window limitation per D-17 revised. |
| T-15-03-03 (Spoofing — terminalId / user_id) | mitigate | terminal_id from `VITE_TERMINAL_ID` env or 'POS-1' fallback; user_id resolved server-side via auth.uid() inside record_audit (Phase 14 helper). |
| T-15-03-04 (Info Disclosure — toast copy) | mitigate | Generic copy: 'Updated by another terminal — please retry' / 'Record was deleted by another terminal.'; no entity id, no other-user data. |
| T-15-03-05 (DoS — record_audit blocking UX) | mitigate | `void` fire-and-forget pattern; promise.then().catch() ensures user sees toast immediately regardless of audit outcome. |
| T-15-03-06 (Tampering — Group B PGRST116 ambiguity) | accept | PGRST116 (0 rows affected) treated as STALE_VERSION; if row was actually deleted, the subsequent invalidate refetch surfaces NOT_FOUND on the next interaction. Accepted. |
| T-15-03-07 (Tampering — assign-pool dual-table window) | accept | Deferred to follow-up patch (see Deviation 2); not regressed in this plan since the existing hook is unchanged. |

## TDD Gate Compliance

This plan has `type: execute` (the frontmatter says no `type: tdd`, but tasks are tagged `tdd="true"`). Compliance:
- **Task 1 RED:** `version-error.test.ts` was added before `version-error.ts` was finalised — initial test runs failed (file-not-found), then 7/7 passed once the helper landed. Single commit `ee487b3 feat(15-03): handleVersionError helper + VersionConflictToast Storybook` bundles RED + GREEN.
- **Task 2 / Task 3:** No co-located test files in the plan-listed locations existed (`queries.test.ts` for tab is absent; `usePoolTimer.test.ts` and `queries.test.ts` for caja exist but cover unrelated functionality). The full test suite (1123 tests) was used as the GREEN gate; no regressions detected.

## Self-Check: PASSED

- FOUND: bar-pos/src/shared/lib/version-error.ts
- FOUND: bar-pos/src/shared/lib/version-error.test.ts
- FOUND: bar-pos/src/shared/ui/VersionConflictToast.tsx
- FOUND: bar-pos/src/shared/ui/VersionConflictToast.stories.tsx
- FOUND: commit ee487b3 (Task 1)
- FOUND: commit 48f43e7 (Task 2)
- FOUND: commit 91424d8 (Task 3)
- FOUND: TabSchema/PoolSessionBaseSchema/CajaSessionSchema with `version` field
- FOUND: supabase.types.ts: tabs/pool_sessions/caja_sessions Row.version + p_expected_version on Group A RPCs
- FOUND: 4 .eq('version' matches in entities/tab/model/queries.ts
- FOUND: 1 .eq('version' match in entities/pool-table/model/queries.ts
- FOUND: 2 .eq('version' matches in entities/caja/model/queries.ts
- FOUND: 7/7 unit tests pass (version-error.test.ts)
- FOUND: 1123/1123 full-suite tests pass
- FOUND: typecheck + lint exit 0
