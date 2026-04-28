---
phase: 15-tabs-version-optimistic-concurrency
plan: 04
subsystem: data-layer
tags: [offline-queue, optimistic-concurrency, stale-version, audit-log, replay]
dependency_graph:
  requires:
    - "15-01: STALE_VERSION + NOT_FOUND_VERSIONED AppErrorCode + parseSupabaseError P0V01/P0V02 mapping"
    - "15-03: Tab.version + PoolSession.version + handleVersionError + supabase.types.ts.p_expected_version"
  provides:
    - "OfflineActionSchema (Zod) + OfflineActionTypeSchema (locked 4-literal enum) in domain.ts"
    - "OfflineAction.expectedVersion required on every queued entry"
    - "formatDiscardedSummary helper @shared/lib/offline-summary.ts"
    - "Persist v2 migrate: legacy entries default expectedVersion=0; unknown action types dropped"
    - "OfflineQueueProcessor: STALE_VERSION + NOT_FOUND_VERSIONED → drop + audit + summary toast"
  affects:
    - "Plan 15-05 (BLOCKING db push) — push will activate version cols server-side; offline replay can then surface live STALE_VERSION conflicts"
tech_stack:
  added: []
  patterns:
    - "Zustand persist v2 migrate(): default missing fields + filter unknown enum types"
    - "Summary toast post-batch (single emit) — D-12 / D-16 revised, no per-action prompt"
    - "Fire-and-forget record_audit: void Promise.resolve().then(...).catch(...) so replay never blocks on audit"
key_files:
  created:
    - bar-pos/src/shared/lib/offline-summary.ts
    - bar-pos/src/shared/lib/offline-summary.test.ts
    - bar-pos/src/app/OfflineQueueProcessor.test.tsx
    - .planning/phases/15-tabs-version-optimistic-concurrency/15-04-SUMMARY.md
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/entities/tab/model/store.ts
    - bar-pos/src/entities/tab/model/queries.ts
    - bar-pos/src/entities/pool-table/model/queries.ts
    - bar-pos/src/app/OfflineQueueProcessor.tsx
decisions:
  - "OfflineAction type re-exported from store.ts (back-compat) but sourced from domain.ts (Zod single source of truth, FSD compliant)"
  - "Persist version bumped to 2 with migrate(); legacy entries lacking expectedVersion default to 0 (warning logged), entries with type outside locked enum dropped silently with logger.warn"
  - "place-order enqueue captures cached Tab.version via queryClient.getQueryData(tabKeys.detail(tabId)) at enqueue time; falls back to 0 when cache miss"
  - "stop-pool-timer enqueue captures cached PoolSession.version via poolTableKeys.all (table.currentSession.version); falls back to 0 when cache miss"
  - "open-tab and start-pool-timer pass expectedVersion: 0 — both create new rows so no prior version exists"
  - "Discarded summary toast emitted exactly once per replay batch (post-loop), not per action — D-16 revised"
  - "writeDiscardAuditAsync fires record_audit fire-and-forget; failures swallowed via logger.warn (T-15-04-04 mitigation)"
  - "OfflineQueueProcessor.test.tsx uses module-scoped vi.mock for sonner / supabase / connectivity / mutation hooks; rerender after toggling onlineStatus.value triggers the online-transition useEffect"
metrics:
  duration: "~25min"
  completed: "2026-04-28"
  tasks: 2
  files: 9
---

# Phase 15 Plan 04: Offline Queue Conflict-Aware Replay Summary

Wave 4 of the optimistic-concurrency rollout — extends the persisted offline queue contract with `expectedVersion` capture, adds STALE_VERSION/NOT_FOUND_VERSIONED-aware replay (drop, not retry), surfaces a single post-batch summary toast listing discarded action types, and writes a best-effort `offline.discarded_stale` audit row per drop.

## What Shipped

### Task 1 — Schema + enqueue call sites + summary helper (commit `3737c72`)

- **`@shared/lib/domain.ts`**:
  - New `OfflineActionTypeSchema = z.enum(['open-tab', 'place-order', 'start-pool-timer', 'stop-pool-timer'] as const)` — locked 4-literal enum (revised D-11 / CONTEXT.md `<specifics>`).
  - New `OfflineActionSchema` with required `id` (UuidSchema), `type`, `payload`, `expectedVersion: z.number().int().min(0)`, `timestamp: z.number().int().nonnegative()`, `retryCount`.
  - Exported types `OfflineAction`, `OfflineActionType`.

- **`@shared/lib/offline-summary.ts`** (new):
  - `formatDiscardedSummary(actions: readonly OfflineAction[]): string` — `''` on empty, otherwise `'Discarded {N} queued action(s) — data changed: {a,b,c}'`.

- **`@shared/lib/offline-summary.test.ts`** (new):
  - 3 tests: empty list returns `''`; fast-check property test (12-action batches) confirms regex `^Discarded \d+ queued action\(s\) — data changed: .+$` and N appears in string; literal-format test for two-action sample. **3/3 pass.**

- **`@entities/tab/model/store.ts`**:
  - Manual interface removed; types re-imported from `@shared/lib/domain` and re-exported (single source of truth, FSD compliant).
  - Persist config: `version: 2` + `migrate()` callback that:
    1. Filters out queue entries whose `type` is not in `OfflineActionTypeSchema.options` (logs `offline_queue.legacy_entry_dropped_unknown_type`).
    2. Defaults `expectedVersion: 0` for entries lacking it (logs `offline_queue.legacy_entry`).
    3. Falls back through `crypto.randomUUID()` / `Date.now()` for any other missing primitive fields so the rehydrated queue is always shape-valid.

- **Enqueue call sites — all four updated to pass `expectedVersion`:**
  | Call site | File | Source of expectedVersion |
  | --- | --- | --- |
  | `useMutationOpenTab` (NETWORK_OFFLINE branch) | `entities/tab/model/queries.ts:514` | `0` (new row, no prior version) |
  | `useMutationAddOrder` (NETWORK_OFFLINE branch) | `entities/tab/model/queries.ts:702` | `queryClient.getQueryData<Result<Tab>>(tabKeys.detail(variables.tabId))` → `cachedTab.data.version`, fallback `0` |
  | `useMutationStartSession` (NETWORK_OFFLINE branch) | `entities/pool-table/model/queries.ts:274` | `0` (new pool_session row) |
  | `useMutationStopSession` (NETWORK_OFFLINE branch) | `entities/pool-table/model/queries.ts:449` | `queryClient.getQueryData<Result<PoolTable[]>>(poolTableKeys.all)` → `table.currentSession.version`, fallback `0` |

### Task 2 — OfflineQueueProcessor STALE_VERSION drop + summary toast + audit (commit `ad4af3f`)

- **`@app/OfflineQueueProcessor.tsx`**:
  - New imports: `toast` from `sonner`, `formatDiscardedSummary` from `@shared/lib/offline-summary`, `supabase` from `@shared/lib/supabase`.
  - File-local `TERMINAL_ID` constant (matches `entities/caja/queries.ts` pattern).
  - `ENTITY_BY_ACTION_TYPE` lookup: `open-tab/place-order → 'tabs'`, `start-pool-timer/stop-pool-timer → 'pool_sessions'`.
  - `payloadEntityId(action)` extracts `tabId | sessionId | tableId` from payload (best-effort; falls back to `null`).
  - `writeDiscardAuditAsync(action)` — fire-and-forget `supabase.rpc('record_audit', { p_action: 'offline.discarded_stale', p_entity_type, p_entity_id, p_before: { expectedVersion, action_type }, p_after: null, p_terminal_id, p_user_id: null })`. Failures and throws are swallowed via `logger.warn`.
  - Replay loop:
    - On `result.error.code === 'STALE_VERSION'` or `'NOT_FOUND_VERSIONED'`: set `dropAndAudit = true`, push to `discarded[]` after dequeue, fire audit RPC.
    - On other error codes: existing `logger.error` path (no toast, no audit).
    - On success: existing `logger.info` path.
  - Post-loop: `if (discarded.length > 0) toast.error(formatDiscardedSummary(discarded))` — single emit per replay batch.
  - `setSyncing(false)` and `isReplayingRef.current = false` reset unchanged.

- **`@app/OfflineQueueProcessor.test.tsx`** (new): 5 tests covering all required behaviours via module-mocked `sonner` / `supabase` / `connectivity` / mutation hooks. **5/5 pass.**
  | # | Behaviour |
  | --- | --- |
  | 1 | All 3 actions succeed → no toast, queue empty, no audit |
  | 2 | 1 of 3 returns STALE_VERSION → drop, summary toast `Discarded 1 queued action(s) — data changed: place-order`, other 2 succeed |
  | 3 | STALE_VERSION fires `record_audit` once with `p_action='offline.discarded_stale'`, `p_entity_type='tabs'`, `p_entity_id='TAB-A'` |
  | 4 | NOT_FOUND_VERSIONED also drops + audits + toasts (terminal failure, no requeue) |
  | 5 | NETWORK_OFFLINE error does NOT drop / audit / toast (existing transient-error behaviour preserved) |

## Verification

```
$ grep -c "expectedVersion" bar-pos/src/entities/tab/model/store.ts
1   # type re-export from domain (the rest of the field is in domain.ts)

$ grep -c "OfflineActionSchema\|OfflineActionTypeSchema\|expectedVersion" bar-pos/src/shared/lib/domain.ts
4   # OfflineActionTypeSchema (decl) + OfflineActionSchema (decl) + expectedVersion field + comment

$ grep -cE "'open-tab'|'place-order'|'start-pool-timer'|'stop-pool-timer'" bar-pos/src/shared/lib/domain.ts
4   # one per literal in the locked enum

$ grep -rcE "enqueueOfflineAction\(" bar-pos/src/
bar-pos/src/entities/tab/model/queries.ts:2
bar-pos/src/entities/pool-table/model/queries.ts:2
# every call site now passes expectedVersion

$ grep -c "STALE_VERSION\|NOT_FOUND_VERSIONED" bar-pos/src/app/OfflineQueueProcessor.tsx
2   # both terminal codes branched in replay loop

$ grep -c "offline.discarded_stale" bar-pos/src/app/OfflineQueueProcessor.tsx
1   # single audit-action constant

$ grep -c "formatDiscardedSummary" bar-pos/src/app/OfflineQueueProcessor.tsx
2   # import + post-loop toast call

$ npx vitest run src/shared/lib/offline-summary.test.ts
3/3 pass

$ npx vitest run src/app/OfflineQueueProcessor.test.tsx
5/5 pass

$ npm run typecheck   # tsc --noEmit
exit 0

$ npm run lint        # eslint --max-warnings 0
exit 0

$ npm run test        # full Vitest suite
120 test files passed | 2 skipped | 1131 tests passed | 15 todo
```

All plan-defined automated grep verification commands return ≥ 1.

## Path / Call-Site Coverage Reaffirmation

> **All 4 enqueueOfflineAction call sites updated.** Plan declared this as the universe of offline-eligible mutations (locked enum is also 4 literals).

| # | Hook | File | expectedVersion source |
|---|------|------|------------------------|
| 1 | useMutationOpenTab | entities/tab/model/queries.ts | 0 (creation) |
| 2 | useMutationAddOrder | entities/tab/model/queries.ts | cached Tab.version |
| 3 | useMutationStartSession | entities/pool-table/model/queries.ts | 0 (creation) |
| 4 | useMutationStopSession | entities/pool-table/model/queries.ts | cached PoolSession.version |

## Threat Model Compliance

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-15-04-01 (Tampering — localStorage offlineQueue) | accept | localStorage trust model unchanged. expectedVersion captured at enqueue from a per-tab cached entity that the user just interacted with; server enforces via P0V01 on replay. |
| T-15-04-02 (Repudiation — silent drop) | mitigate | Every drop fires `writeDiscardAuditAsync` with `action='offline.discarded_stale'`, expectedVersion + action_type in `p_before`. Summary toast notifies user. Best-effort failure path logged via `logger.warn`. |
| T-15-04-03 (Info Disclosure — toast leak) | accept | Toast lists only locked enum types (e.g. `place-order`); no row ids, no payment amounts, no entity payloads. |
| T-15-04-04 (DoS — audit RPC slows replay) | mitigate | `void Promise.resolve().then(...)` — replay loop never awaits audit; loop continues immediately after dequeue. Test 3 confirms audit called once per discard but does not block dispatch. |

## Deviations from Plan

None — plan executed as written. Two minor implementation choices worth noting (not deviations from the plan's `<action>` instructions, just additional resilience documented for the SUMMARY):

1. **Persist `migrate()` is more defensive than plan minimum.** Plan asked for "default expectedVersion: 0 + filter unknown types". Implementation also defaults missing `id` (`crypto.randomUUID()`), missing `timestamp` (`Date.now()`), and missing `retryCount` (0) so the rehydrated queue is always Zod-shape-valid; this prevents a corrupted-localStorage edge case from crashing the dispatch loop. Logged via `logger.warn('offline_queue.legacy_entry', ...)`.
2. **`payloadEntityId` is best-effort.** The plan's example RPC call mentions `p_entity_id: <fromPayload>` without specifying extraction. Implementation looks up `tabId → sessionId → tableId` and falls back to `null` (record_audit accepts NULL `p_entity_id` per Phase 14-02 schema). Audit row is still useful even when entity id cannot be derived.

## TDD Gate Compliance

Plan tasks are tagged `tdd="true"`:

- **Task 1 RED:** `offline-summary.test.ts` written before `offline-summary.ts` was finalised. Single commit `3737c72` bundles RED + GREEN (test file lives alongside the helper; co-commit is the canonical pattern in this repo per `version-error.test.ts` precedent in 15-03).
- **Task 2 RED:** `OfflineQueueProcessor.test.tsx` written alongside the OfflineQueueProcessor.tsx changes. Initial test runs failed (no STALE_VERSION branch, no toast, no audit) before the dispatch-loop changes landed. Single commit `ad4af3f` bundles RED + GREEN.

Per-test pass status verified: 3/3 + 5/5 = 8/8 new tests, 0 regressions across the full 1131-test suite.

## Self-Check: PASSED

- FOUND: bar-pos/src/shared/lib/offline-summary.ts
- FOUND: bar-pos/src/shared/lib/offline-summary.test.ts
- FOUND: bar-pos/src/app/OfflineQueueProcessor.test.tsx
- FOUND: domain.ts.OfflineActionSchema + OfflineActionTypeSchema (locked 4-literal enum)
- FOUND: store.ts type re-export from domain
- FOUND: 4 enqueueOfflineAction call sites all passing expectedVersion
- FOUND: OfflineQueueProcessor.tsx STALE_VERSION + NOT_FOUND_VERSIONED branch
- FOUND: OfflineQueueProcessor.tsx 'offline.discarded_stale' audit action
- FOUND: OfflineQueueProcessor.tsx formatDiscardedSummary post-loop toast call
- FOUND: commit 3737c72 (Task 1)
- FOUND: commit ad4af3f (Task 2)
- FOUND: typecheck exit 0
- FOUND: lint exit 0
- FOUND: 1131 tests pass + 8 new tests (3 offline-summary + 5 OfflineQueueProcessor)

## Self-Check: PASSED (verified)

All artifacts exist on disk; both per-task commits (3737c72, ad4af3f) present in git log.
