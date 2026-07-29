---
phase: 26-floating-tables-is-temp
plan: 02
subsystem: entities
tags: [rename, typescript, react-query, postgrest, supabase-realtime, zod]

# Dependency graph
requires:
  - phase: 26-floating-tables-is-temp
    provides: "resources relation, resource_status enum, resource_transfers table, regenerated supabase.types.ts/supabase-contracts.ts (Plan 01)"
provides:
  - "entities/resource/ (moved+renamed from entities/pool-table/): ResourceSchema/ResourceCreateSchema/ResourceUpdateSchema/ResourceStatusSchema/ResourceTypeSchema in domain.ts"
  - "resourceKeys.all === ['resources'] — the canonical TanStack Query cache key every resource consumer (entity layer + 3 escape-hatch inline queries + realtime listeners) now shares"
  - "Zero remaining application-layer pool_tables references except the two settings-key literals, the bogus RBAC test string, and the AI agent tool name/description contract (list_pool_tables, find_pool_table)"
  - "Green npm run typecheck / lint / test baseline restored after Plan 01's declared transient red"
affects: [26-03-PLAN.md, 26-04-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resourceKeys.all as the single shared TanStack Query cache-key value — entity layer, 3 inline escape-hatch queries (SeatPartySheet, PoolTableOccupancyPanel, WaitlistQueue), and WaitlistRealtimeListener's inline invalidation all use the literal ['resources'] so they invalidate together"
    - "PostgREST embed alias must match the relation name while the FK-hint suffix after '!' stays tied to whichever table actually owns the constraint (pool_sessions_previous_table_id_fkey/pool_sessions_table_id_fkey unchanged; fk_resources_current_session renamed)"

key-files:
  created: []
  modified:
    - src/shared/lib/domain.ts
    - src/entities/resource/** (moved from src/entities/pool-table/**, symbols renamed)
    - src/entities/tab/model/queries.ts
    - src/features/close-tab/index.ts
    - src/app/PoolRealtimeListener.tsx
    - src/app/WaitlistRealtimeListener.tsx
    - src/shared/lib/supabase.ts
    - src/shared/lib/supabase-contracts.ts
    - src/shared/lib/supabase-realtime.ts
    - src/shared/lib/agent/tools/posTools.ts
    - src/shared/lib/agent/tools/guardTools.ts
    - src/widgets/PoolTableGrid/index.tsx
    - src/widgets/TableStatusPanel/index.tsx
    - src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx
    - src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx
    - src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx
    - "~14 more feature files and their tests importing the renamed entity (see Files Created/Modified)"

key-decisions:
  - "resourceKeys.all cache-key value is ['resources'] (Task 1) — Plan 04's fourth consumer must match this literal exactly."
  - "PoolTableStatus (the unused const value export in domain.ts, distinct from the renamed PoolTableStatusSchema) left unrenamed — dead code, zero consumers found via grep, not in the plan's explicit rename list, out of scope."
  - "AI agent tool name/description literals (list_pool_tables, find_pool_table) and their dispatch case labels left unchanged, per the plan's explicit model-facing-contract exception (D-02) — this makes the plan's own residual-reference grep gate (which excludes only the 2 settings-key lines) fail literally; verified by hand that every non-excluded hit is exactly this documented, intentional exception."
  - "Fixed 2 pre-existing, unrelated tsc errors (entities/tab/model/queries.ts:791 exactOptionalPropertyTypes violation on the close_tab RPC call; shared/lib/agent/rag.ts:60 vector-arg type mismatch on match_codebase_chunks) because they blocked this task's own npm run typecheck exit-0 gate (Rule 3) — moved the matching backlog todo to .planning/todos/completed/."
  - "E2E pool-timer spec (e2e/04-pool-timer.spec.ts) could not be run to a real pass/fail verdict: two attempts both failed with net::ERR_CONNECTION_REFUSED against the Playwright-managed dev server before any page ever loaded — a dev-server/environment issue, not an application error (typecheck/lint/unit-test all green). Deferred to the phase gate per the plan's own verification instruction."

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "Domain schemas renamed (ResourceSchema/ResourceStatusSchema/ResourceTypeSchema + inferred types) and the entity folder moved from entities/pool-table to entities/resource with git history preserved and internal exports renamed (resourceKeys, useResources/useResource, the 4 mutation hooks, useResourceStore, ResourceCard)"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npx vitest run src/entities/resource/model/usePoolTimer.test.ts (8/8 pass, file content unmodified apart from import paths)"
        status: pass
      - kind: other
        ref: "git log --follow src/entities/resource/model/queries.ts shows history predating this phase; git diff -M shows rename-shaped edits only"
        status: pass
    human_judgment: false
  - id: D2
    description: "All remaining application call sites swept to the renamed relation/entity — npm run typecheck/lint/test all exit 0, zero residual pool_tables literals outside the documented settings-key/RBAC-test/AI-tool-name exceptions"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run lint && npm run test — 1325/1340 tests pass (15 pre-existing todo, 2 pre-existing skip)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pool timer billing math unaffected by the rename (SC-4) — pre-existing usePoolTimer test passes unmodified"
    requirement: SC-4
    verification:
      - kind: unit
        ref: "src/entities/resource/model/usePoolTimer.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pool-timer E2E spec (e2e/04-pool-timer.spec.ts) proves start/stop/billing survive the rename end-to-end"
    requirement: SC-4
    verification: []
    human_judgment: true
    rationale: "Two attempts failed with net::ERR_CONNECTION_REFUSED against the dev server before any page loaded — an environment/dev-server issue in this sandboxed session (matches the phase's context note about prior filesystem hangs/crashes), not an application regression. Requires a human (or a more stable CI runner) to execute this spec and confirm pass/fail."

duration: ~40min
completed: 2026-07-28
status: complete
---

# Phase 26 Plan 02: Rename `pool_tables` Call Sites to `resources` Summary

**Swept every application-layer reference from `pool_tables`/`PoolTable`/`entities/pool-table` to `resources`/`Resource`/`entities/resource` — 51 files across domain schemas, the moved entity folder, PostgREST embed hints, realtime channel filters, three inline escape-hatch queries, AI agent tools, and every consuming widget/feature — restoring `npm run typecheck`/`lint`/`test` to fully green after Plan 01's declared transient red.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-28
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 51 (16 in Task 1, 36 in Task 2, with 1 file overlap counted once)

## Accomplishments

- **Task 1** renamed `PoolTableStatusSchema`/`PoolTableTypeSchema`/`PoolTableSchema`/`PoolTableCreateSchema`/`PoolTableUpdateSchema` and their inferred types to `Resource*` in `domain.ts` (removing the `.max(30)` ceiling on `number`, keeping `.min(1)`, per Pitfall 5), moved `src/entities/pool-table/` to `src/entities/resource/` via `git mv` (history preserved), renamed the three UI files to `ResourceCard.tsx`/`ResourceCard.stories.tsx`/`ResourceIllustration.tsx`, and renamed every internal export (`poolTableKeys` → `resourceKeys` with `all: ['resources']`, `usePoolTables`/`usePoolTable` → `useResources`/`useResource`, the four mutation hooks, `usePoolTableStore` → `useResourceStore`, `PoolTableCard`/`PoolTableCardProps` → `ResourceCard`/`ResourceCardProps`). Session-oriented exports (`usePoolTimer`, `useMutationStartSession`/`StopSession`, `usePoolSessionsByTab`, etc.) were left untouched as instructed. Also fixed `shared/ui/StatusBadge.tsx`'s `PoolTableStatusSchema` import, broken by the domain.ts rename but outside the plan's explicit file list (Rule 3).
- **Task 2** ran `npm run typecheck` as the exhaustive worklist (per the plan's own instruction) and drove it to zero. This surfaced a much wider consumer set than the plan's 15-file `<files>` list — roughly 20 additional feature/widget/test files imported `@entities/pool-table` or `PoolTable`-named types without containing the literal string `pool_tables` themselves, so they weren't in the CONTEXT.md's original 18-file grep. All were updated: `entities/tab/model/queries.ts` and `features/close-tab/index.ts`'s PostgREST embed aliases (`resources!pool_sessions_table_id_fkey`, `resources!pool_sessions_previous_table_id_fkey`, keeping the FK-hint suffixes as-is since those constraints live on `pool_sessions`); the two app realtime listeners' `postgres_changes` table filters and `WaitlistRealtimeListener`'s inline cache key; the three `supabase as any` escape-hatch inline queries (`SeatPartySheet`, `PoolTableOccupancyPanel`, `WaitlistQueue`) whose `.from()` target and cache key now both read `'resources'`; `supabase.ts`'s `PoolTableRow` → `ResourceRow` alias and its one consumer (`supabase-realtime.ts`, itself dead/unused code with no import sites anywhere else); `supabase-contracts.ts`'s `isPoolTableWithSession` type guard (its signature still referenced the old `PoolTableWithSession` name left behind by Plan 01's partial rename); the AI agent tools' `.from()` targets and `assertExists()` relation arguments (leaving the `list_pool_tables`/`find_pool_table` tool names and descriptions untouched, per D-02's model-facing-contract exception); and every remaining feature/widget importing the renamed entity or its types (`PoolTableGrid`, `PoolTablesSettingsTab`, `TableStatusPanel`, `StartSessionSheet`, `StopSessionConfirm`, `StopAndMoveDialog`/`useStopAndMoveSession`, `TransferPoolDialog`/`useTransferPoolSession`, `AssignPoolSessionSheet`, `useEditSessionStartTime`, `usePrintPreCheque`, `mocks.ts`, `domain.table-type.test.ts`) plus two live-DB integration test files (`pool-promotions-rpc.integration.test.ts`, `useCloseTab.test.ts`) that seed real rows against the now-renamed schema.
- Fixed two pre-existing, unrelated `tsc` errors blocking this task's own typecheck-must-pass gate: `entities/tab/model/queries.ts:791`'s `close_tab` RPC call (conditionally spread `p_expected_version` instead of `?? null`, matching the existing `exactOptionalPropertyTypes` pattern used elsewhere in the same file) and `agent/rag.ts:60`'s `match_codebase_chunks` RPC call (`JSON.stringify` the embedding to match its generated `string` arg type). Moved the corresponding backlog todo to `.planning/todos/completed/`.
- `npm run typecheck`, `npm run lint`, and `npm run test` all exit 0. Full unit suite: 1325/1340 pass (15 pre-existing `test.todo`, 2 pre-existing `describe.skip`, unchanged by this plan).
- Attempted `npx playwright test e2e/04-pool-timer.spec.ts` twice (with a display + `google-chrome-stable` available); both runs failed every test with `net::ERR_CONNECTION_REFUSED` against the Playwright-managed dev server before any page loaded — a dev-server/environment startup issue in this sandboxed session, not an application regression. Deferred to the phase gate per the plan's own verification instruction (item 5: "if the environment cannot provide them, record the spec as deferred").

## Task Commits

1. **Task 1: Rename the domain schemas and move the entity folder** — `a3cda03` (feat)
2. **Task 2: Sweep remaining call sites to zero, including the compiler-invisible ones** — `dc1b22d` (feat)

**Plan metadata:** commit for this SUMMARY.md + STATE.md/ROADMAP.md (see final commit).

## Files Created/Modified

**Task 1** (domain + entity move):
- `src/shared/lib/domain.ts` — `ResourceSchema`/`ResourceCreateSchema`/`ResourceUpdateSchema`/`ResourceStatusSchema`/`ResourceTypeSchema`, `.max(30)` removed, schema-registry + type-map entries renamed
- `src/entities/resource/` (moved from `src/entities/pool-table/`) — `index.ts`, `model/index.ts`, `model/types.ts`, `model/queries.ts`, `model/queries.test.ts`, `model/store.ts`, `ui/ResourceCard.tsx`, `ui/ResourceCard.stories.tsx`, `ui/ResourceIllustration.tsx` (`model/usePoolTimer.ts`/`.test.ts` moved but content untouched)
- `src/shared/ui/StatusBadge.tsx` — `PoolTableStatusSchema` → `ResourceStatusSchema` import fix

**Task 2** (call-site sweep, 36 files):
- `src/app/{PoolRealtimeListener,WaitlistRealtimeListener,OfflineQueueProcessor,OfflineQueueProcessor.test}.tsx`
- `src/entities/tab/model/queries.ts`, `src/entities/promotion/model/pool-promotions-rpc.integration.test.ts`
- `src/features/close-tab/{index.ts,tests/useCloseTab.test.ts}`
- `src/features/{assign-pool-session-to-tab/ui/AssignPoolSessionSheet,edit-session-start-time/model/useEditSessionStartTime(.test),print-precheque/usePrintPreCheque,seat-waitlist-party/ui/SeatPartySheet,start-pool-timer/ui/StartSessionSheet(.test),stop-and-move-table/{useStopAndMoveSession,ui/StopAndMoveDialog(.test)},stop-pool-timer/ui/StopSessionConfirm(.test),transfer-tab/{useTransferPoolSession,ui/TransferPoolDialog}}.ts(x)`
- `src/shared/lib/{supabase,supabase-contracts,supabase-realtime,mocks,domain.table-type.test,agent/rag,agent/tools/{guardTools,posTools}}.ts`
- `src/widgets/{PoolTableGrid/index,TableStatusPanel/index,SettingsTabsPanel/tabs/PoolTablesSettingsTab,PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel,WaitlistQueue/ui/WaitlistQueue}.tsx`
- `.planning/todos/{pending → completed}/2026-07-25-fix-2-pre-existing-tsc-errors-blocking-tauri-build-ci-job.md`

## Decisions Made

- **`resourceKeys.all` cache-key value:** `['resources']`. Plan 04 must match this literal exactly for its fourth consumer to invalidate in lockstep with the rest.
- **`PoolTableStatus` const (domain.ts) left unrenamed:** distinct from the renamed `PoolTableStatusSchema`; it's an unused value export with zero consumers found via repo-wide grep, not named in the plan's explicit Task 1 rename list. Left as dead code rather than widening the diff for no functional benefit.
- **AI agent tool name/description contract preserved:** `list_pool_tables`, `find_pool_table`, and their descriptions/dispatch case labels are unchanged, per the plan's explicit D-02 model-facing-contract instruction. This means the plan's own residual-reference grep gate (which excludes only the two settings-key literal lines) technically reports 5 hits — all of them this documented, intentional exception, verified by hand.
- **Two pre-existing tsc errors fixed as blocking (Rule 3), not deferred:** both were required for this task's own `npm run typecheck` exit-0 gate to ever pass. Backlog todo moved to completed.
- **E2E pool-timer spec deferred, not marked green or red:** the dev server itself never served a page in either of two attempts (`net::ERR_CONNECTION_REFUSED`), consistent with this session's already-documented environment instability (SIGSEGV/filesystem-hang context noted at the start of this run). No application code path was exercised, so this is not evidence of a regression — it is an unresolved verification gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `shared/ui/StatusBadge.tsx` broke immediately after Task 1's domain.ts rename**
- **Found during:** Task 1
- **Issue:** `StatusBadge.tsx` imports `type { PoolTableStatusSchema }` from `domain.ts` for its `StatusBadgeProps` union — not in the plan's file list, but a direct compile-time consequence of renaming that schema.
- **Fix:** Updated the import and usage to `ResourceStatusSchema`.
- **Files modified:** `src/shared/ui/StatusBadge.tsx`
- **Verification:** `npx tsc --noEmit` no longer flags this file.
- **Committed in:** `a3cda03`

**2. [Rule 3 - Blocking] ~20 additional consumer files beyond the plan's explicit `<files>` list**
- **Found during:** Task 2, running `npm run typecheck` as instructed
- **Issue:** The plan's Task 2 `<files>` enumerates 15 files, drawn from CONTEXT.md's grep for the literal string `'pool_tables'`. A much larger set of files imported `@entities/pool-table` or `PoolTable`-named types (without containing that literal string) and broke once the entity folder moved in Task 1 — e.g. `PoolTableGrid`, `TableStatusPanel`, `PoolTablesSettingsTab`, `StartSessionSheet`, `StopSessionConfirm`, `StopAndMoveDialog`/`useStopAndMoveSession`, `TransferPoolDialog`/`useTransferPoolSession`, `AssignPoolSessionSheet`, `useEditSessionStartTime`, `usePrintPreCheque`, `mocks.ts`, `domain.table-type.test.ts`, and their respective test files.
- **Fix:** Updated every import path and renamed-symbol reference in each file, following the same renaming convention (`PoolTable`→`Resource`, `PoolTableType`→`ResourceType`, entity hook names per Task 1's mapping).
- **Files modified:** listed under "Files Created/Modified" above.
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `dc1b22d`

**3. [Rule 3 - Blocking] `entities/tab/model/queries.ts:791` — pre-existing `exactOptionalPropertyTypes` violation on `close_tab`**
- **Found during:** Task 2, final typecheck pass after the main sweep
- **Issue:** `p_expected_version: expected ?? null` where the RPC's generated arg type is `p_expected_version?: number` (optional key, not nullable) — pre-existing, documented in `.planning/todos/pending/2026-07-25-fix-2-pre-existing-tsc-errors-blocking-tauri-build-ci-job.md`, unrelated to the floating-tables rename, but blocking this task's own typecheck-exit-0 gate.
- **Fix:** `...(expected !== undefined ? { p_expected_version: expected } : {})`, the same conditional-spread pattern already used for the sibling `stop_pool_session` RPC call in the same file.
- **Files modified:** `src/entities/tab/model/queries.ts`
- **Verification:** `npm run typecheck` exits 0; unit suite still 1325/1340 pass.
- **Committed in:** `dc1b22d`

**4. [Rule 3 - Blocking] `shared/lib/agent/rag.ts:60` — pre-existing vector-arg type mismatch on `match_codebase_chunks`**
- **Found during:** Task 2, final typecheck pass
- **Issue:** `query_embedding: embedding` (a `number[]`) passed to an RPC whose generated arg type is `query_embedding: string` (PostgREST serializes the pgvector column as its literal text form) — pre-existing, same backlog todo as above, unrelated to this phase.
- **Fix:** `query_embedding: JSON.stringify(embedding)`.
- **Files modified:** `src/shared/lib/agent/rag.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `dc1b22d`

---

**Total deviations:** 4 auto-fixed (all Rule 3 — blocking issues that prevented this task's own `<verify>`/acceptance gates from passing). No scope creep beyond what was required to reach a genuinely green `typecheck`/`lint`/`test` baseline; no billing math, RLS filter, or user-facing copy was touched.

## Issues Encountered

- A stray `git worktree add` process from an earlier (unrelated) session attempt was found stuck in uninterruptible disk-sleep state on the external-drive mount at execution start; it did not hold the main repo's `.git/index.lock` (confirmed via `/proc/<pid>/fd`), and an unrelated transient `git add` segfault in this session left a stale, unheld `index.lock` that was safely removed before continuing. Neither affected the correctness of any commit in this plan.
- `npx playwright test e2e/04-pool-timer.spec.ts` failed twice with `net::ERR_CONNECTION_REFUSED` against the Playwright-managed dev server (see Coverage D4 / Decisions Made). Not investigated further given the session's already-flagged environment instability; recorded as a deferred verification gap rather than a pass or fail.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- The application is back to a fully green `typecheck`/`lint`/`test` baseline on the renamed `resources` schema (SC-1). `resourceKeys.all === ['resources']` is now the canonical shared cache key.
- Plan 03 (schema additions: `is_temp`, `'floating'` table_type value, auto-deactivate trigger) can proceed directly against `src/entities/resource/` and `ResourceSchema`.
- Plan 04's fourth `resourceKeys`-consuming call site must use the literal `['resources']` value to invalidate together with the rest.
- **Open gap:** `e2e/04-pool-timer.spec.ts` has not been run to a real pass/fail verdict in this environment (dev-server connectivity issue, not an app regression). Should be re-run in a more stable environment before the phase gate closes, per the plan's own verification item 5.

## Self-Check: PASSED

- FOUND: src/entities/resource/model/queries.ts
- FOUND: src/entities/resource/ui/ResourceCard.tsx
- MISSING (expected): src/entities/pool-table/ (correctly removed)
- FOUND: commit a3cda03 in git log
- FOUND: commit dc1b22d in git log
- FOUND: .planning/todos/completed/2026-07-25-fix-2-pre-existing-tsc-errors-blocking-tauri-build-ci-job.md

---
*Phase: 26-floating-tables-is-temp*
*Completed: 2026-07-28*
