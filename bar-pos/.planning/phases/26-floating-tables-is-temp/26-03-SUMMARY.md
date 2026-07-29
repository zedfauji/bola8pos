---
phase: 26-floating-tables-is-temp
plan: 03
subsystem: database
tags: [postgres, supabase, plpgsql, trigger, soft-delete, zod, vitest-integration]

# Dependency graph
requires:
  - phase: 26-floating-tables-is-temp
    provides: "resources relation (Plan 01), resourceKeys.all === ['resources'] and green typecheck/lint/test baseline (Plan 02)"
provides:
  - "resources.is_temp BOOLEAN NOT NULL DEFAULT FALSE, live on Supabase Cloud"
  - "table_type CHECK admits 'pool'|'carom'|'consumption'|'floating' (resources_table_type_check)"
  - "deactivate_floating_resource() SECURITY DEFINER trigger + deactivate_floating_resource_on_session_stop AFTER UPDATE ON pool_sessions, soft-retiring a floating resource the instant stopped_at transitions null -> non-null"
  - "ResourceTypeSchema 4th value 'floating'; ResourceSchema.isTemp (default false); mapResourceRow maps is_temp; useMutationAddResource accepts isTemp: boolean | undefined"
  - "deactivate-floating-resource.integration.test.ts — 5-case vitest integration-project proof of SC-2, closing VALIDATION.md's Wave 0 SQL-harness gap"
affects: [26-04-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TEXT + CHECK extension (not a new enum) for a 4th table_type value, matching 20260421000002's established convention"
    - "SECURITY DEFINER + SET search_path = public on a trigger function, matching stop_pool_session's convention, as defense-in-depth even though the only realistic caller (stop_pool_session) is already a definer"
    - "Soft-delete via a null->non-null transition guard (OLD.stopped_at IS NULL AND NEW.stopped_at IS NOT NULL) plus an is_temp/is_deleted=FALSE predicate for idempotence — never a hard DELETE against a relation with an incoming ON DELETE RESTRICT FK"
    - "Integration test client isolation: a service-role Supabase client used alongside a signed-in anon client in the same jsdom-based vitest integration project MUST set auth: { persistSession: false, autoRefreshToken: false } — both clients otherwise share window.localStorage's GoTrue session key, and the service-role client silently starts running as the anon session's JWT (subject to RLS) once that session signs in"

key-files:
  created:
    - supabase/migrations/20260728000002_resources_is_temp_floating.sql
    - supabase/migrations/20260728000003_deactivate_floating_resource_trigger.sql
    - src/entities/resource/model/deactivate-floating-resource.integration.test.ts
  modified:
    - src/shared/lib/supabase.types.ts
    - src/shared/lib/supabase-contracts.ts
    - src/shared/lib/domain.ts
    - src/entities/resource/model/queries.ts
    - src/entities/resource/ui/ResourceCard.tsx
    - src/entities/resource/ui/ResourceCard.stories.tsx
    - src/features/start-pool-timer/ui/StartSessionSheet.test.tsx
    - src/features/stop-and-move-table/ui/StopAndMoveDialog.test.tsx
    - src/features/stop-pool-timer/ui/StopSessionConfirm.test.tsx
    - src/widgets/PoolTableGrid/index.tsx
    - src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx
    - src/shared/lib/i18n/locales/es-MX/entities.json
    - src/shared/lib/i18n/locales/en-US/entities.json

key-decisions:
  - "The pre-existing table_type CHECK constraint kept its Postgres-generated name (pool_tables_table_type_check) unchanged across Plan 01's table rename — confirmed live via pg_constraint before writing the DROP, not guessed. The plan's own read_first flagged this as a live-catalog lookup requirement."
  - "Widening ResourceType to 4 values is a breaking change to every Record<ResourceType, ...> exhaustive lookup and every hand-built Resource fixture in the codebase (isTemp is a required, non-optional TS field despite its Zod .default(false)). Rule 3 fixes: ResourceCard's two TABLE_TYPE_* lookup tables plus a new i18n key (both locales), 4 test/story fixtures gained isTemp: false, and both existing useMutationAddResource callers were updated to pass isTemp: undefined explicitly."
  - "useMutationAddResource's new isTemp field is typed `boolean | undefined` (mandatory key, no `?`) per the plan's explicit exactOptionalPropertyTypes instruction — this means existing callers must now pass the key (even as undefined), matching this repo's own established `notes: undefined` convention elsewhere (e.g. manage-recipe), not left implicitly optional."
  - "Integration test's service-role client requires persistSession:false/autoRefreshToken:false — discovered via a real test failure (see Deviations), not applied preemptively; the pre-existing pool-promotions-rpc.integration.test.ts analog carries the same latent risk but never manifests it because none of its assertions depend on the service-role client bypassing an RLS is_deleted predicate specifically."

requirements-completed: [SC-1, SC-2]

coverage:
  - id: D1
    description: "resources.is_temp column and the 4-value table_type CHECK are live; every pre-existing row is unaffected (is_temp=false, original table_type preserved)"
    requirement: SC-1
    verification:
      - kind: integration
        ref: "live pg_constraint/information_schema query post-push: is_temp column with false default, resources_table_type_check listing all 4 values, 0 pre-existing rows with is_temp=true"
        status: pass
    human_judgment: false
  - id: D2
    description: "deactivate_floating_resource() trigger soft-retires a floating resource the instant its pool session's stopped_at transitions null->non-null, is idempotent on a repeated stop, spares non-floating resources, and never hard-deletes"
    requirement: SC-2
    verification:
      - kind: integration
        ref: "src/entities/resource/model/deactivate-floating-resource.integration.test.ts — 5/5 cases pass against live Supabase Cloud"
        status: pass
    human_judgment: false
  - id: D3
    description: "Retired rows are invisible to authenticated clients via the resources SELECT RLS policy's is_deleted=FALSE predicate, while still resolvable via the service-role client and by pool_sessions.table_id"
    requirement: SC-2
    verification:
      - kind: integration
        ref: "deactivate-floating-resource.integration.test.ts > 'policy invisibility' and 'soft-delete only' cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zod/TypeScript layer exposes isTemp and the 'floating' type value with the full app (typecheck/lint/unit-test) still green, and pool-timer billing math is unaffected"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run lint && npm run test (1325/1340 pass, unchanged baseline); npx vitest run src/entities/resource/model/usePoolTimer.test.ts (8/8 pass)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-07-29
status: complete
---

# Phase 26 Plan 03: Schema Additions (`is_temp`/`floating`) + Auto-Deactivate Trigger Summary

**Added `resources.is_temp` and the `'floating'` table_type value via two live-pushed migrations, installed a `SECURITY DEFINER` trigger that soft-retires a floating resource the instant its pool session's `stopped_at` flips from null, extended `ResourceSchema`/`ResourceTypeSchema` and the entity layer to expose both, and proved the trigger end-to-end (retirement, soft-delete persistence, RLS invisibility, no-regression, idempotence) with a new 5-case vitest integration test.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-29
- **Tasks:** 3 (2 `type="auto"`, 1 `type="auto" tdd="true"`)
- **Files modified:** 16 (3 created, 13 modified)

## Accomplishments

- **Task 1** wrote two migrations: `20260728000002_resources_is_temp_floating.sql` adds `is_temp BOOLEAN NOT NULL DEFAULT FALSE` and replaces the table_type CHECK with a 4-value version (`pool`/`carom`/`consumption`/`floating`) under an explicit new name (`resources_table_type_check`), dropping the *actual live* pre-existing constraint name (`pool_tables_table_type_check`, confirmed via a live `pg_constraint` query before writing the DROP — Postgres never renamed it during Plan 01's table rename). `20260728000003_deactivate_floating_resource_trigger.sql` adds `deactivate_floating_resource()` (`SECURITY DEFINER`, `SET search_path = public`) and its single `AFTER UPDATE ON pool_sessions` trigger, guarded by the `OLD.stopped_at IS NULL AND NEW.stopped_at IS NOT NULL` transition plus `is_temp = TRUE AND is_deleted = FALSE` narrowing — never a `DELETE`, per D-04 and the FK's `ON DELETE RESTRICT`.
- **Task 2 (BLOCKING)** applied both migrations live via `supabase db push` against the linked Supabase Cloud project (`bar-pos`). Live catalog assertions all passed: `is_temp` with a `false` default, the 4-value CHECK, `prosecdef=true` with `search_path=public` in `proconfig`, exactly one trigger on `pool_sessions` for this function (none on `tabs`), and 0 pre-existing rows carrying `is_temp=true`. Regenerated `supabase.types.ts` (additive-only diff) and hand-synced the `supabase-contracts.ts` resources shim block. Extended `ResourceTypeSchema` to 4 values and added `ResourceSchema.isTemp` (default false); `mapResourceRow` now maps `is_temp`; `useMutationAddResource` gained `isTemp: boolean | undefined` (exactOptionalPropertyTypes-safe, defaults to `false` on insert).
- **Task 3** added `deactivate-floating-resource.integration.test.ts`, following the `pool-promotions-rpc.integration.test.ts` harness convention exactly (env-guarded `describe.skipIf`, service-role + anon clients, per-test id registries, `afterEach` cleanup ordered sessions-before-resources). Drives the trigger by updating `pool_sessions.stopped_at` directly (with the required Phase 15 version bump), never via `stop_pool_session`. All 5 required behaviors pass against live Supabase Cloud: retirement, soft-delete-not-hard-delete persistence via the service-role client (and the session still resolving `table_id`), RLS-driven invisibility to an anon/authenticated read, the SC-4 non-floating no-regression case, and idempotence on a repeated stop.
- Full regression baseline unchanged and green: `npm run typecheck && npm run lint && npm run test` all exit 0 (1325/1340 unit tests pass, same 15 `test.todo`/2 `describe.skip` as before this plan). `npm run test` does not execute the new `*.integration.test.ts` file, confirmed. `usePoolTimer.test.ts` (8/8) confirms billing math untouched (SC-4).

## Task Commits

1. **Task 1: Schema additions and the auto-deactivate trigger** — `f2c56be` (feat)
2. **Task 2: Apply migrations, regenerate types, extend the Zod schema** — `891ea74` (feat)
3. **Task 3: Integration test proving the trigger retires floating resources and spares real ones** — `f8c2a75` (test)

**Plan metadata:** commit for this SUMMARY.md + STATE.md/ROADMAP.md (see final commit).

## Files Created/Modified

- `supabase/migrations/20260728000002_resources_is_temp_floating.sql` — `is_temp` column + 4-value `table_type` CHECK
- `supabase/migrations/20260728000003_deactivate_floating_resource_trigger.sql` — `deactivate_floating_resource()` trigger function + single trigger on `pool_sessions`
- `src/shared/lib/supabase.types.ts` — regenerated (`--linked`), additive `is_temp` field only
- `src/shared/lib/supabase-contracts.ts` — hand-synced `resources` shim block with `is_temp`
- `src/shared/lib/domain.ts` — `ResourceTypeSchema` 4th value `'floating'`, `ResourceSchema.isTemp` (default false)
- `src/entities/resource/model/queries.ts` — `mapResourceRow` maps `is_temp` -> `isTemp`; `useMutationAddResource` accepts/defaults `isTemp`
- `src/entities/resource/ui/ResourceCard.tsx` — `TABLE_TYPE_LABEL_KEY`/`TABLE_TYPE_VARIANT` gain a `floating` entry (Rule 3, required by the widened `ResourceType` union)
- `src/entities/resource/ui/ResourceCard.stories.tsx`, `src/features/start-pool-timer/ui/StartSessionSheet.test.tsx`, `src/features/stop-and-move-table/ui/StopAndMoveDialog.test.tsx`, `src/features/stop-pool-timer/ui/StopSessionConfirm.test.tsx` — fixture `Resource` objects gain `isTemp: false` (Rule 3, now a required field)
- `src/widgets/PoolTableGrid/index.tsx`, `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx` — existing `addTable.mutateAsync` calls pass `isTemp: undefined` explicitly (Rule 3)
- `src/shared/lib/i18n/locales/{es-MX,en-US}/entities.json` — new `poolTableCard.tableType.floating` key (Rule 3, badge lookup needs a resolvable i18n key)
- `src/entities/resource/model/deactivate-floating-resource.integration.test.ts` — new 5-case integration test (Task 3)

## Decisions Made

- **Resolved the live constraint name before writing the DROP, per the plan's own instruction**: `pool_tables_table_type_check`, not a guessed/assumed name — confirmed via a `pg_constraint` query against the live `bar-pos` project.
- **`isTemp: boolean | undefined` (no `?`) on the mutation input**, per the plan's explicit acceptance criterion — this makes the key mandatory-but-nullable rather than omittable, matching this repo's existing `notes: undefined`-style convention elsewhere (`manage-recipe`, `edit-paid-tab`), not the more common `isTemp?: boolean` shortcut.
- **Both existing `useMutationAddResource` callers updated to pass `isTemp: undefined`** — required to keep `npm run typecheck` green after the field became mandatory; not a functional UI change, purely the minimal key needed to satisfy the new required field.
- **Integration test's service-role client needs `persistSession: false, autoRefreshToken: false`** — see Deviations below; this is now the required pattern for any future integration test in this repo that mixes a service-role client with a signed-in anon client inside the shared `jsdom`-environment `integration` vitest project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widening `ResourceType` to 4 values broke every exhaustive `Record<ResourceType, ...>` lookup and hand-built `Resource` fixture**
- **Found during:** Task 2, running `npm run typecheck` per the plan's own verify gate
- **Issue:** `ResourceCard.tsx`'s `TABLE_TYPE_LABEL_KEY`/`TABLE_TYPE_VARIANT` `Record<ResourceType, ...>` lookups became non-exhaustive (missing `floating`); 4 test/story files construct plain `Resource` object literals that now fail because `isTemp` is a required TS field (Zod's `.default(false)` only affects parsing, not the inferred output type's required-ness); 2 widgets (`PoolTableGrid`, `PoolTablesSettingsTab`) call `addTable.mutateAsync({...})` without the now-mandatory `isTemp` key.
- **Fix:** Added a `floating` entry to both `ResourceCard.tsx` lookup tables plus a matching `poolTableCard.tableType.floating` i18n key in both locale files; added `isTemp: false` to the 4 fixture objects; added `isTemp: undefined` to both `mutateAsync` call sites.
- **Files modified:** `src/entities/resource/ui/ResourceCard.tsx`, `src/entities/resource/ui/ResourceCard.stories.tsx`, `src/features/start-pool-timer/ui/StartSessionSheet.test.tsx`, `src/features/stop-and-move-table/ui/StopAndMoveDialog.test.tsx`, `src/features/stop-pool-timer/ui/StopSessionConfirm.test.tsx`, `src/widgets/PoolTableGrid/index.tsx`, `src/widgets/SettingsTabsPanel/tabs/PoolTablesSettingsTab.tsx`, `src/shared/lib/i18n/locales/{es-MX,en-US}/entities.json`
- **Verification:** `npm run typecheck && npm run lint && npm run test` all exit 0.
- **Committed in:** `891ea74` (Task 2 commit)

**2. [Rule 1 - Bug] Integration test's "service-role" client was silently subject to RLS after the anon client signed in**
- **Found during:** Task 3, first live run of the new integration test — 3 of 5 cases failed with "expected [row] not to be null" even though a standalone debug script proved the trigger itself was correct
- **Issue:** This repo's `integration` vitest project runs under `environment: 'jsdom'` (needed by other integration tests for `renderHook`/`document`). Both the service-role client and the anon client, created via plain `createClient(url, key)`, default to `window.localStorage` as their GoTrue session storage backend — keyed by the Supabase project ref, not by which API key was used to construct the client (confirmed by the "Multiple GoTrueClient instances detected in the same browser context" warning). Once `anonClient.auth.signInWithPassword(...)` persisted a session under that shared key, the "service-role" client began using that session's JWT instead of the raw service-role key for its own requests — subjecting it to RLS and hiding exactly the soft-deleted rows the assertions needed it to see.
- **Fix:** Constructed the service-role client with `auth: { persistSession: false, autoRefreshToken: false }`, which pins it to always authenticate with the raw service-role key regardless of what the anon client does to shared storage.
- **Files modified:** `src/entities/resource/model/deactivate-floating-resource.integration.test.ts`
- **Verification:** Re-ran the full test file — 5/5 pass; re-confirmed zero orphaned test rows in the live DB afterward.
- **Committed in:** `f8c2a75` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 — blocking type-widening fallout, 1 Rule 1 — genuine test-infra bug). No scope creep: no billing math, RLS policy body, or user-facing UI beyond the mechanically-required badge/i18n entry was touched.

## Issues Encountered

- Same root cause as Deviation 2 above — documented there in full since it required real investigation (a standalone debug script isolating the trigger from the test harness) before the fix was clear. Worth flagging for Plan 04 and any future integration test in this repo: any test mixing a service-role client with a client that calls `auth.signInWithPassword` in the `integration` vitest project must set `persistSession: false` on the service-role client, or risk this exact silent RLS-leak failure mode. The pre-existing `pool-promotions-rpc.integration.test.ts` analog has the same latent risk but has never surfaced it, because none of its assertions specifically depend on the service-role client bypassing an `is_deleted`-style RLS predicate.

## User Setup Required

None — no external service configuration required. The Supabase CLI was already authenticated non-interactively and the `bar-pos` project already linked, satisfying Task 2's precondition without needing to export `SUPABASE_ACCESS_TOKEN` explicitly. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` were already present in `.env.local`, so Task 3's integration test ran with live credentials rather than the skip path.

## Next Phase Readiness

- `resources.is_temp`, the 4-value `table_type` CHECK, and the auto-deactivate trigger are live on Supabase Cloud and proven end-to-end by an automated integration test — Plan 04 (waitlist auto-create flow, D-05/D-06) can insert a resource with `tableType: 'floating', isTemp: true` and rely on this trigger retiring it automatically once its session stops.
- The resolved mutation-input field name Plan 04 must pass is **`isTemp`** (typed `boolean | undefined`; pass `true` explicitly — `undefined` defaults to `false`).
- The resolved pre-existing generated CHECK constraint name that was dropped is **`pool_tables_table_type_check`** (its Postgres-generated name survived Plan 01's table rename unchanged); the new constraint is explicitly named `resources_table_type_check`.
- No blockers. `npm run typecheck && npm run lint && npm run test` all green; `e2e/04-pool-timer.spec.ts` remains an open, separately-tracked environment gap from Plan 02 (dev-server connectivity in this sandboxed session), unrelated to this plan's scope and not re-attempted here.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260728000002_resources_is_temp_floating.sql
- FOUND: supabase/migrations/20260728000003_deactivate_floating_resource_trigger.sql
- FOUND: src/entities/resource/model/deactivate-floating-resource.integration.test.ts
- FOUND: commit f2c56be in git log
- FOUND: commit 891ea74 in git log
- FOUND: commit f8c2a75 in git log

---
*Phase: 26-floating-tables-is-temp*
*Completed: 2026-07-29*
