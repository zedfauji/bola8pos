---
phase: 20-promotions-engine
plan: 08
subsystem: api
tags: [react-query, supabase-rpc, pool-billing, optimistic-concurrency, tanstack-query]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 05)
    provides: "stop_pool_session(uuid, int) SECURITY DEFINER RPC — server-authoritative pool billing, pool_grant consumption, pool_billing discount compounding"
  - phase: 20-promotions-engine (plan 06)
    provides: "All Phase 20 migrations (including stop_pool_session) live on the remote Supabase database"
provides:
  - "useMutationStopSession rewired to call the stop_pool_session RPC instead of a raw client .update() on pool_sessions"
  - "Client no longer computes pool session billing (computePoolSessionBilling removed from the write path) — total_charge/billed_minutes are server-authoritative"
  - "Unit test coverage (queries.test.ts, new file) asserting the RPC call args, response mapping, and stale-version error mapping"
affects: [20-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "close_tab/useMutationAddOrder-style RPC rewire: pre-fetch the cached row for its version, forward p_expected_version only when defined (exactOptionalPropertyTypes-safe), let supabaseQuery -> parseSupabaseError map P0V01 to staleVersionError automatically instead of hand-rolled PGRST116 branching"

key-files:
  created:
    - src/entities/pool-table/model/queries.test.ts
  modified:
    - src/entities/pool-table/model/queries.ts

key-decisions:
  - "Kept the pre-fetch SELECT * ... .single() on pool_sessions (rather than switching to the poolTableKeys.all cache lookup) to source the cached version — lower-risk, smaller diff, and the plan explicitly allowed either approach"
  - "Mapped the RPC's returned jsonb subset (id/stopped_at/billed_minutes/total_charge/version/tab_id/table_id) by spreading it onto the pre-fetched full pool_sessions row before calling mapPoolSessionRow, since the RPC intentionally returns only the fields it authoritatively writes"
  - "ratePerHour stays in the mutation's input type (not destructured/used) rather than being removed, preserving StopSessionConfirm's call site and its pre-confirm billing preview untouched"
  - "New queries.test.ts uses the global supabase mock from test-setup.ts (vi.mocked(supabase).rpc / .from) rather than a live-DB integration test, following the caja/ingredient/promotion entity unit-test convention for this codebase"

requirements-completed: [SC-3]

# Metrics
duration: ~25min
completed: 2026-07-10
---

# Phase 20 Plan 08: Pool-Session Stop RPC Rewire Summary

**`useMutationStopSession` now calls the `stop_pool_session` RPC instead of computing billing client-side and writing it via a raw `.update()` — closing the Pitfall 3 gap so pool charge, discount, and grant-consumption are atomic and server-authoritative.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `useMutationStopSession` (`src/entities/pool-table/model/queries.ts`) rewired: removed the `settings` billing fetch, the client-side `computePoolSessionBilling` call, and both the version-guarded and legacy raw `.update()` branches on `pool_sessions`. In their place, a single `supabase.rpc('stop_pool_session', { p_session_id, p_expected_version })` call (via `supabaseQuery`, so P0V01 is automatically mapped to `staleVersionError` through the existing `parseSupabaseError` path — no hand-rolled `PGRST116` branching needed anymore). `p_expected_version` is only included when the cached row carries a numeric `version`, satisfying `exactOptionalPropertyTypes` against the generated `Args: { p_expected_version?: number; p_session_id: string }` type.
- Added `mapStopPoolSessionRpcPayload` + `StopPoolSessionRpcResult` to parse the RPC's returned jsonb shape (`id, stopped_at, billed_minutes, total_charge, version, tab_id, table_id`), then merged that subset onto the pre-fetched full `pool_sessions` row before calling the existing `mapPoolSessionRow` — reusing the established row-to-`PoolSession` mapper rather than duplicating its Zod-parse logic.
- The subsequent `pool_tables` status update (`available` / `current_session_id: null`) and the `onMutate` optimistic table-status block are unchanged.
- `computePoolSessionBilling` and `staleVersionError` are no longer imported in `queries.ts` (both became dead after the rewire); `Json` import retained for the new RPC payload mapper.
- New `src/entities/pool-table/model/queries.test.ts` (no such file existed before this plan): 3 unit tests using the project's global `supabase` mock (`vi.mocked(supabase).rpc` / `.from`) — (1) asserts `stop_pool_session` is called with `p_session_id` + `p_expected_version` sourced from the cached row's version, (2) asserts the RPC's jsonb payload is mapped into a `PoolSession` carrying the server-provided `billedMinutes`/`totalCharge`/`version`, (3) asserts a `P0V01` RPC error resolves to a `Result` with `error.code === 'STALE_VERSION'` rather than throwing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire useMutationStopSession to call stop_pool_session** - `3b2f762` (feat)
2. **Task 2: Update the useMutationStopSession unit test** - `5e0f8cf` (test)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified

- `src/entities/pool-table/model/queries.ts` - `useMutationStopSession` rewired to call `stop_pool_session` RPC; `computePoolSessionBilling`/`staleVersionError` imports removed; new `StopPoolSessionRpcResult` type + `mapStopPoolSessionRpcPayload` helper added
- `src/entities/pool-table/model/queries.test.ts` - New file; 3 unit tests covering the RPC call args, response mapping, and stale-version error mapping

## Decisions Made

- Kept the existing pre-fetch `SELECT * ... .single()` on `pool_sessions` as the source of the cached version (rather than reading it from the `poolTableKeys.all` cache like the offline-queue enqueue path does) — the plan explicitly permitted either approach, and reusing the existing fetch minimized the diff and preserved the full row needed to merge the RPC's partial response back into a complete `PoolSession`.
- `ratePerHour` remains part of the mutation's input *type* but is no longer destructured/used in the write path (it's read server-side by the RPC now) — this keeps `StopSessionConfirm`'s `mutateAsync({ sessionId, tableId, ratePerHour })` call site and its pre-confirm billing preview unaffected, per the plan's explicit instruction.
- The new test file follows the `caja`/`ingredient`/`promotion` entity unit-test convention (global `supabase` mock from `test-setup.ts`, `vi.mocked(supabase).rpc`/`.from`) rather than the live-DB integration pattern used by `useCloseTab.test.ts` — consistent with how this codebase unit-tests other RPC-backed mutation hooks (`useMutationAddOrder` has no direct unit test either; the closest precedent, `entities/promotion/model/queries.test.ts`, mocks `rpc` locally).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules` and `.env.local`**
- **Found during:** Task 1 verification (`npm run typecheck`)
- **Issue:** Fresh worktree checkout had no `node_modules/` and no `.env.local` — the same recurring situation documented in every prior Phase 20 plan's SUMMARY (20-01 through 20-06).
- **Fix:** Ran `npm ci`; copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`).
- **Files modified:** none (gitignored local dev-environment plumbing only, not staged)
- **Committed in:** N/A

---

**Total deviations:** 1 (Rule 3 local-environment blocker, identical to every prior Phase 20 plan's documented pattern)
**Impact on plan:** No scope creep. No production code touched beyond what each task specified.

## Issues Encountered

None beyond the environment-setup deviation above. `npm run typecheck` shows only the 2 pre-existing, unrelated errors already documented since Plan 20-06 (`src/entities/tab/model/queries.ts:778` close_tab arg typing, `src/shared/lib/agent/rag.ts:60` embedding typing) — neither touched by this plan. `npm run lint` is clean on both touched files (0 errors, 0 warnings; only a pre-existing `eslint-plugin-boundaries` informational warning about legacy selector syntax, unrelated to this plan). `npx vitest run src/entities/pool-table/model/queries.test.ts` is 3/3 green; a broader run across `src/entities/pool-table`, `src/features/stop-pool-timer`, `src/features/start-pool-timer`, and `src/app/OfflineQueueProcessor.test.tsx` (32 tests across 5 files) confirms no regressions from the rewire.

## User Setup Required

None — no external service configuration required. The RPC this plan calls (`stop_pool_session`) was already applied to the live Supabase database in Plan 20-06's blocking push.

## Next Phase Readiness

- `useMutationStopSession` is now RPC-backed; `pool_sessions.total_charge`/`billed_minutes` are exclusively written by `stop_pool_session` from this point forward in the client codebase.
- `StopSessionConfirm` is unaffected — its pre-confirm preview still calls `computePoolSessionBilling` client-side for display purposes only (that TS mirror is untouched by this plan and remains available for Plan 20-09's parity gate to diff against the RPC's authoritative output).
- Plan 20-09's parity verification can now exercise the live `stop_pool_session` RPC end-to-end via the UI flow (StopSessionConfirm → useMutationStopSession → RPC) in addition to the Plan 20-05 integration scaffold.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: src/entities/pool-table/model/queries.ts
- FOUND: src/entities/pool-table/model/queries.test.ts
- FOUND commit: 3b2f762 (Task 1)
- FOUND commit: 5e0f8cf (Task 2)
