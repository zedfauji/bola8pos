# Phase 15: Tabs Version (Optimistic Concurrency) - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 8 (3 confirmed gaps, 1 investigation confirmed-gap, 4 investigation confirmed-no-op) + 1 edge function + 1 new E2E spec
**Analogs found:** 5 / 5 (all files needing changes have a strong in-repo analog; nothing needs RESEARCH.md fallback)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/features/close-tab/index.ts` | mutation hook | request-response (optimistic-concurrency CRUD) | `src/entities/caja/model/queries.ts` (`useMutationCloseCaja`) | exact |
| `src/features/transfer-tab/useTransferPoolSession.ts` | mutation hook | request-response (optimistic-concurrency CRUD) | `src/entities/resource/model/queries.ts` (`useMutationStopSession` onSuccess block) | exact |
| `src/features/stop-and-move-table/useStopAndMoveSession.ts` | mutation hook | request-response (optimistic-concurrency CRUD) | `src/entities/resource/model/queries.ts` (`useMutationStopSession` onSuccess block) | exact |
| `src/entities/tab/model/queries.ts` | entity query/mutation module | request-response (optimistic-concurrency CRUD) | `src/entities/resource/model/queries.ts` | exact (same layer, same job — just missing the wiring the analog already has) |
| `supabase/functions/process-payment/index.ts` | edge function (Deno) | request-response, server-to-server RPC call | itself (RPC call already present at line 147; only the missing param needs adding) | n/a (param addition, not a new pattern) |
| `e2e/39-concurrent-edits.spec.ts` | test (E2E) | n/a | other numbered specs in `e2e/` (e.g. `e2e/06-transfer.spec.ts`, `e2e/41-split-payment.spec.ts`) for structure/helpers | role-match |

## Pattern Assignments

### `src/features/close-tab/index.ts` (mutation hook, request-response)

**Gap:** Already has the `.eq('version', versionRes.data.version)` guard (lines 45-62) and returns the raw `Result` from `supabaseMutation` on failure, but the caller (`closeTab` wrapper, lines 72-82) only does `toast.error(result.error.message)` — it never calls `handleVersionError`, so a `STALE_VERSION` conflict shows a generic error toast instead of the standard "Updated by another terminal" conflict UX + cache invalidation + audit write.

**Analog:** `src/entities/caja/model/queries.ts` lines 272-290 (`useMutationCloseCaja.onSuccess`)

**Reference wiring to replicate** (`src/entities/caja/model/queries.ts:272-289`):
```typescript
onSuccess: (result, variables) => {
  if (!result.ok) {
    // Phase 15: surface STALE_VERSION conflict
    const cached = queryClient.getQueryData<Result<CajaSession | null>>(cajaKeys.current());
    const expectedVersion =
      cached?.ok && cached.data && typeof cached.data.version === 'number'
        ? cached.data.version
        : 0;
    handleVersionError(result.error, {
      queryClient,
      queryKey: cajaKeys.all,
      entity: 'caja_sessions',
      entityId: variables.cajaId,
      expectedVersion,
      supabase,
      terminalId: TERMINAL_ID,
    });
    return;
  }
  ...
}
```

**Mechanical fix for close-tab:** `close-tab` uses the `closeTab` async wrapper pattern (no `onSuccess`/`onError` callbacks on the `useMutation` call itself — logic lives in the wrapper at lines 72-82), so wire `handleVersionError` directly in that wrapper before the generic toast, using the `versionRes.data.version` captured earlier in `mutationFn` (need to either return it alongside the `Result` or re-derive `expectedVersion` from the tab query cache the way the analog does via `queryClient.getQueryData`). `entity: 'tabs'`, `entityId: tabId`, `queryKey: tabKeys.all` (or `tabKeys.lists()`, matching what's already invalidated at line 79).

**Required imports to add** (mirror `src/entities/caja/model/queries.ts` lines 33, and the `TERMINAL_ID` symbol used at line 287 — grep its origin in that file before wiring):
```typescript
import { handleVersionError } from '@shared/lib/version-error';
```

---

### `src/features/transfer-tab/useTransferPoolSession.ts` (mutation hook, request-response)

**Gap:** Has an `.eq('version', versionRow.version)` guard (line 74) on the post-RPC `previous_table_id` stamp, but treats a failed stamp as non-fatal (`logger.warn`, lines 76-81) with no `handleVersionError` call — this is arguably correct behavior (the RPC transfer already succeeded; only the informational stamp lost the race) but CONTEXT.md's confirmed-candidates list still names this file at line ~74, so the mechanical fix is to call `handleVersionError` (best-effort, non-blocking) alongside the existing `logger.warn`, not to change the non-fatal control flow.

**Analog:** `src/entities/resource/model/queries.ts` lines 466-475 (`onSuccess` STALE_VERSION handling for a `pool_sessions` UPDATE)

**Reference wiring to replicate:**
```typescript
handleVersionError(result.error, {
  queryClient,
  queryKey: resourceKeys.all,
  entity: 'pool_sessions',
  entityId: variables.sessionId,
  expectedVersion: 0,
  supabase,
  terminalId: TERMINAL_ID,
});
```

**Applied to transfer-tab:** since the stamp UPDATE result (`stampError`) is checked directly in `mutationFn` rather than surfaced through `onSuccess`, call `handleVersionError` inline at the `if (stampError)` branch (lines 76-81) using a synthesized `staleVersionError`-shaped `AppError` from `stampError` (see `src/shared/lib/result.ts` for `staleVersionError` helper, same one used by `supabaseMutation`'s 0-row detection elsewhere in this codebase) — `entity: 'pool_sessions'`, `entityId: sessionId`, `queryKey: resourceKeys.all`.

---

### `src/features/stop-and-move-table/useStopAndMoveSession.ts` (mutation hook, request-response)

**Gap:** Has an `.eq('version', tabVersionRes.data.version)` guard (line 62) on the tab `table_number` UPDATE, and `mutationFn` correctly returns `tabRes` (the failed `Result`) up through `useMutation`, but `onSuccess`/`onError` only handle table-status rollback (lines 74-89) — no `handleVersionError` call for the `tabs` version conflict path.

**Analog:** same as transfer-tab — `src/entities/resource/model/queries.ts` lines 466-475.

**Mechanical fix:** In `onSuccess` (lines 74-78), when `!result.ok`, add a `handleVersionError(result.error, { queryClient: qc, queryKey: resourceKeys.all, entity: 'tabs', entityId: input.tabId, expectedVersion: input.version ?? 0, supabase, terminalId: TERMINAL_ID })` call before/alongside the existing table-status rollback (`useResourceStore.getState().updateTableStatus(input.tableId, 'occupied')`). Note this file also has a `resources` table UPDATE (line 39-42, no version guard — not in scope per CONTEXT.md, only the `tabs.version` conflict at line 62 is the named gap) and a `pool_sessions` version-guarded RPC call (`stop_pool_session`, line 28-31, already Group A / server-guarded via `p_expected_version`).

---

### `src/entities/tab/model/queries.ts` (entity module, request-response)

**CONFIRMED GAP** (resolves the "needs investigation" item): grep found zero `handleVersionError` occurrences and zero import of it in this file. Line 249 shows the file already reads `row.version` when hydrating cached tab data, and line 642 shows an existing `p_expected_version` RPC param usage (Group A, already correct), but there is no Group-B client-side `.eq('version', expected)` UPDATE + `handleVersionError` wiring for tab-status-mutation paths in this file — VERIFICATION.md's claim that "tabs status" and "tabs close-on-payment" were wired here does not match current code. The two actual Group-B tab-status-mutation call sites live in `src/features/close-tab/index.ts` and `src/features/stop-and-move-table/useStopAndMoveSession.ts` (both above), not in `entities/tab/model/queries.ts` itself — this file's job is mostly query/read hooks plus the one Group-A RPC call. **No wiring needs to be added to this file** — VERIFICATION.md was simply wrong about the file location of the fix; the fix location is the two feature-hook files above. Note this for the plan/summary so it doesn't get re-flagged as a mystery gap next verification pass.

**Analog:** `src/entities/resource/model/queries.ts` (structurally the file this one should resemble) — used only to confirm the *expected* shape; no code needs to be copied into `entities/tab/model/queries.ts` itself.

---

### `supabase/functions/process-payment/index.ts` (edge function, request-response)

**D-02 gap:** RPC call at line 147 (`admin.rpc('process_payment_atomic', {...})`) does not pass `p_expected_version`. `ProcessPaymentRequestSchema` (edge-function-contracts.ts line 72) needs an optional `expectedVersion` field added, threaded from the client call site into the request body, then into the RPC param.

**Analog for the RPC-param wiring shape:** `src/entities/resource/model/queries.ts` lines 359-375 (client-side Group A pattern — conditionally include `p_expected_version` only when a cached version exists):
```typescript
const cachedVersion =
  typeof (session as { version?: number }).version === 'number'
    ? (session as { version?: number }).version
    : undefined;
...
  ...(cachedVersion !== undefined ? { p_expected_version: cachedVersion } : {}),
```

**Apply the mirror shape** in `process-payment/index.ts`'s RPC call: `...(validatedRequest.expectedVersion !== undefined ? { p_expected_version: validatedRequest.expectedVersion } : {})`. The RPC param is already null-tolerant per CONTEXT.md D-02, so this is additive/non-breaking. Client caller of `callProcessPaymentEdgeFunction` (edge-function-contracts.ts ~line 166) needs the new optional field passed through from its own cached tab/version if available — find that call site in `src/features/process-payment/` (not read in this pass; investigate at plan time, same file family as the schema).

---

## Confirmed NOT gaps (investigation resolved — no code change needed)

| Path | Finding |
|------|---------|
| `void-order` | `src/features/void-order/model/useVoidOrder.ts` calls `deplDb.rpc('deplete_for_order_item', ...)` only — no direct `.eq('version', ...)` client-side mutation. No Group-B gap. |
| `add-combo-to-tab` | `src/features/add-combo-to-tab/model/useAddComboToTab.ts` calls `supabase.rpc('add_combo_to_tab', ...)` only — routes entirely through an RPC (Group A candidate, not Group B). No client-side version guard exists or is needed here. |
| `assign-pool-session-to-tab` | `src/features/assign-pool-session-to-tab/index.ts` has no direct `supabase.from`/`.rpc` calls at all — it composes/delegates to `useMutationLinkPoolSessionToTab` in `src/entities/resource/model/queries.ts`, which is **already correctly wired** (uses a pre-fetch-then-`.eq('version', ...)` guard at lines 513-529, though note: this specific mutation does not itself call `handleVersionError` on the UPDATE result — it returns `res` raw. If the planner wants full coverage, `useMutationLinkPoolSessionToTab`'s caller would need the same onError wiring as `useMutationStopSession`. Flagging as a possible secondary gap discovered during this investigation — not named in CONTEXT.md's confirmed list, so treat as discretionary.) |
| `process-refund` | `src/features/process-refund/model/useProcessRefund.ts` calls `db.rpc('process_refund', ...)` only — Group A, server-guarded. No client-side gap. |

## Shared Patterns

### `handleVersionError` (the one helper every gap-closure call site needs)
**Source:** `src/shared/lib/version-error.ts` (lines 43-85)
**Signature:**
```typescript
export const handleVersionError = (error: AppError, ctx: VersionErrorContext): boolean
// ctx: { queryClient, queryKey, entity: 'tabs' | 'pool_sessions' | 'caja_sessions', entityId, expectedVersion, supabase, terminalId }
```
**Apply to:** `close-tab`, `transfer-tab`, `stop-and-move-table` (all three confirmed gaps above).
**Behavior:** on `STALE_VERSION` → invalidate query + toast "Updated by another terminal — please retry" + fire-and-forget `record_audit` RPC write; on `NOT_FOUND_VERSIONED` → invalidate + toast "Record was deleted"; returns `false` for any other code (caller should fall through to its existing generic error handling, e.g. the `toast.error(result.error.message)` already in `close-tab`).

### `TERMINAL_ID`
Every existing correct call site (`src/entities/caja/model/queries.ts`, `src/entities/resource/model/queries.ts`) passes a `TERMINAL_ID` constant into `handleVersionError`'s ctx. Grep its import source in one of those two files before wiring the new call sites — it is a shared module-level constant, not something to redefine locally.

### Pre-UPDATE version fetch-then-guard (Group B mutation shape)
**Source:** `src/entities/resource/model/queries.ts` lines 511-529 and `src/features/stop-and-move-table/useStopAndMoveSession.ts` lines 47-63 (both already correct on the *fetch+guard* half — only missing the `handleVersionError` *call* half)
```typescript
const versionRes = await supabaseQuery<{ version: number }>(() =>
  supabase.from('<table>').select('version').eq('id', id).single()
);
if (!versionRes.ok) return versionRes;

const res = await supabaseMutation(() =>
  supabase
    .from('<table>')
    .update({ ...changes, version: versionRes.data.version + 1 })
    .eq('id', id)
    .eq('version', versionRes.data.version)
);
```
This half is already implemented correctly in all 3 gap files — do not rewrite it, only add the `handleVersionError` call on the failure path.

## No Analog Found

None. Every file needing a change has a same-repo, same-phase analog already doing the correct thing.

## Metadata

**Analog search scope:** `src/entities/{caja,resource,tab}/model/queries.ts`, `src/features/{close-tab,transfer-tab,stop-and-move-table,void-order,add-combo-to-tab,assign-pool-session-to-tab,process-refund}/`, `src/shared/lib/{version-error.ts,agent/tools/posTools.ts,edge-function-contracts.ts}`, `supabase/functions/process-payment/index.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-08-07
