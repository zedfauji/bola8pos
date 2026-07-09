---
phase: 19-tip-distribution-config
plan: 02
subsystem: database
tags: [postgres, plpgsql, rls, supabase, rpc, tip-distribution, caja]

# Dependency graph
requires:
  - phase: 19-tip-distribution-config
    provides: "Plan 01's TipDistribution Zod schemas + computeTipDistribution (largest-remainder reference implementation, not called directly by SQL but validated the same algorithm)"
provides:
  - "tip_distribution_entries table (append-only, one row per caja_session_id)"
  - "close_caja_session CREATE OR REPLACE: tip computation + version-bump regression fix"
  - "'tip_distribution.compute' enumerated audit action"
  - "Integration test scaffold covering the regression, allocations-sum, config-absent fallback, zero-tip, and RLS append-only behaviors"
affects: [19-03-push-migrations, 19-04-settings-entity-caja-hook, 19-05-settings-tab-report-panel, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only table by RLS omission (SELECT-only policy, no INSERT/UPDATE/DELETE policy) — mirrors audit_logs, sole writer is a SECURITY DEFINER RPC"
    - "In-place RPC extension via CREATE OR REPLACE FUNCTION with identical signature/return contract, bundling a bug fix (version bump) with a new feature (tip computation) in one migration"
    - "Largest-remainder integer-cent split with a deterministic floor>bar>kitchen tiebreak on the leftover remainder"

key-files:
  created:
    - supabase/migrations/20260709000001_tip_distribution_entries_table.sql
    - supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql
    - src/entities/caja/model/tip-distribution-rpc.integration.test.ts
  modified:
    - src/shared/lib/audit-actions.ts

key-decisions:
  - "Bundled the pre-existing close_caja_session STALE_VERSION bug fix (missing version = version + 1) into the same CREATE OR REPLACE as the tip-distribution feature, since both require re-declaring the identical function (19-RESEARCH.md Pitfall 1)"
  - "No INSERT policy on tip_distribution_entries (diverges from audit_logs' redundant insert-authenticated policy) — the write surface is fully closed to clients per the threat model (T-19-TAMPER)"
  - "Tip pooling sums payments.tip_amount across ALL payment methods (no rappi exclusion) per D-A2/Pitfall 3 — matches every existing aggregation in the codebase"
  - "34/33/33 is the fallback split when settings.key='tip_distribution' is absent (Pitfall 4) — Claude's-Discretion default per plan, sums to 100, no lopsided tiebreak windfall"

patterns-established:
  - "Versioned-row seeding in integration tests: any UPDATE against a Phase-15-versioned table (caja_sessions/tabs/pool_sessions) MUST explicitly set version = version + 1 or trg_*_version raises STALE_VERSION — this applies even to test-seeding helper UPDATEs, not just RPCs"

requirements-completed: [SC-2, SC-4]

# Metrics
duration: 16min
completed: 2026-07-09
---

# Phase 19 Plan 02: Tip Distribution DB Layer Summary

**New append-only `tip_distribution_entries` table plus an in-place `close_caja_session` extension that pools tips, splits them via largest-remainder against the `settings.tip_distribution` config, and — bundled in the same migration — fixes the pre-existing `STALE_VERSION` bug that was silently breaking every caja close.**

## Performance

- **Duration:** 16 min (09:25 - 09:41 local)
- **Started:** 2026-07-09T09:25:00-06:00 (approx, first task commit)
- **Completed:** 2026-07-09T09:41:26-06:00
- **Tasks:** 3/3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `tip_distribution_entries` table: `UNIQUE(caja_session_id)` FK-CASCADE to `caja_sessions`, 3 non-negative percentage/amount column groups, manager+ SELECT-only RLS (append-only by omission — no write policy for any role)
- `close_caja_session` `CREATE OR REPLACE`: adds `version = version + 1` to the close UPDATE (fixes a regression that made every caja close raise `STALE_VERSION` under Phase 15's `trg_caja_sessions_version` trigger — verified live, see Issues Encountered), pools `SUM(payments.tip_amount)` over the session's non-deleted tabs, reads `settings.tip_distribution` with a 34/33/33 fallback, computes a largest-remainder split with a floor>bar>kitchen tiebreak, and `INSERT`s one `tip_distribution_entries` row plus a `PERFORM record_audit('tip_distribution.compute', ...)` call — all in the same transaction as the close
- `'tip_distribution.compute'` added to `AuditActionSchema`/`AuditAction` — the audit-actions CI grep test (`__tests__/audit-actions.test.ts`, 12 tests) passes green
- Integration test scaffold (`tip-distribution-rpc.integration.test.ts`, 7 tests): seed sanity, STALE_VERSION regression, SC-2 allocations-sum, config-absent fallback, zero-tip, and RLS append-only (manager + bartender)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration — tip_distribution_entries table + append-only RLS** - `d83db94` (feat)
2. **Task 2: Add audit action + CREATE OR REPLACE close_caja_session (version fix + tip computation)** - `3a21380` (feat)
3. **Task 3: Integration test scaffold — close_caja_session tip computation + RLS** - `f6349e7` (test)

**Plan metadata:** commit pending (this SUMMARY.md)

## Files Created/Modified
- `supabase/migrations/20260709000001_tip_distribution_entries_table.sql` - New append-only table + manager+ SELECT RLS policy + session index
- `supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql` - `CREATE OR REPLACE close_caja_session`: version-bump fix + tip pooling/split/insert/audit
- `src/shared/lib/audit-actions.ts` - Added `'tip_distribution.compute'` to the enum + const
- `src/entities/caja/model/tip-distribution-rpc.integration.test.ts` - New live-Supabase integration test file (env-guarded)

## Decisions Made
- Bundled the Pitfall 1 version-bump fix into this migration rather than a separate one, since Task 2 already requires `CREATE OR REPLACE FUNCTION close_caja_session` for the tip feature — same rationale as `20260708000001_fix_split_tab_rpcs_version_bump.sql`.
- Left `record_audit`'s trailing `p_terminal_id`/`p_user_id` args as defaults (6-positional call) — the live `record_audit` overload accepts 8 params with the last 2 defaulting to `NULL`, matching every existing 6-arg call site (`caja.close`, `payment.process`, etc.).
- Formatted the `PERFORM record_audit('tip_distribution.compute', ...)` call with the action literal on the same line as `PERFORM record_audit(` so the plan's single-line `grep -c` acceptance check matches (the CI test's JS regex would have matched a multi-line call too, but the plan's own bash-grep acceptance criteria would not).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test-seeding helper needed to close pre-existing OPEN caja_sessions before creating new ones**
- **Found during:** Task 3 (integration test scaffold), first live test run
- **Issue:** The live dev Supabase project already had an `open` `caja_sessions` row from a prior manual/E2E session. `caja_sessions_one_open` is a `UNIQUE` partial index (`WHERE status='open'`), so seeding a fresh open session for each test collided with `duplicate key value violates unique constraint "caja_sessions_one_open"`.
- **Fix:** Added a `closeOtherOpenCajas()` helper (mirrors the existing convention in `src/entities/tab/model/pending-total.integration.test.ts`) that closes any pre-existing open session before seeding. Discovered a second-order issue: a blind `.update({status:'closed', ...})` without `version = version + 1` silently violates Phase 15's `trg_caja_sessions_version` trigger (STALE_VERSION), so the helper first `SELECT`s each open row's current `version` and explicitly increments it in the `UPDATE`.
- **Files modified:** `src/entities/caja/model/tip-distribution-rpc.integration.test.ts`
- **Verification:** Reran the file; seeding now succeeds (confirmed via a dedicated `itInt` seed-sanity test that passes).
- **Committed in:** `f6349e7` (Task 3 commit)

**2. [Rule 1 - Bug] `.catch()` chained directly on a Supabase query-builder call is not a function**
- **Found during:** Task 3, first live test run (`afterEach` settings-restore path)
- **Issue:** `svc.from('settings').upsert(...).catch(() => undefined)` threw `TypeError: ... .catch is not a function` — the query builder's thenable does not expose a chainable `.catch()` the way a native `Promise` does in this client version.
- **Fix:** Replaced with `try { await ...; } catch { /* best-effort */ }` for both the `cajaIds` cleanup loop and the settings-restore logic in `afterEach`.
- **Files modified:** `src/entities/caja/model/tip-distribution-rpc.integration.test.ts`
- **Verification:** Reran the file; no more `TypeError`s, only the expected pre-push RPC failures (see Issues Encountered).
- **Committed in:** `f6349e7` (Task 3 commit)

**3. [Rule 3 - Blocking] Worktree missing `node_modules` and `.env.local`**
- **Found during:** Start of Task 2 verification (running `npx vitest`)
- **Issue:** This git worktree had no `node_modules` (not tracked by git) and no `.env.local` (gitignored), so `npx vitest` failed outright.
- **Fix:** Created a Windows directory junction from the worktree's `bar-pos/node_modules` to the main checkout's `bar-pos/node_modules` (`New-Item -ItemType Junction`), and copied `.env.local` from the main checkout. Neither is a tracked/committed change — both remain gitignored and were not staged.
- **Files modified:** none (local dev-environment plumbing only, not part of any commit)
- **Verification:** `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` and the new integration test file both executed successfully against the live Supabase project afterward.

---

**Total deviations:** 3 auto-fixed (2 Rule 1/3 test-code bugs, 1 Rule 3 local-environment blocker)
**Impact on plan:** All fixes were necessary to get the integration test scaffold to actually run (rather than merely parse) against the shared live dev Supabase project. No scope creep — no production code was touched beyond what Task 2 already specified.

## Issues Encountered

- **Live-DB pre-push test state (expected, not a bug):** This sandbox's `bar-pos/.env.local` already points at a live shared Supabase project, so `itAuth`/`itInt` tests do NOT skip — they run for real. Since this plan's two migrations are NOT pushed yet (that is Plan 03's job per this plan's explicit scope), the 6 `itAuth`/`itBartender` tests that call `close_caja_session` currently fail with a real `STALE_VERSION` (`P0V01`) Postgres error, because the currently-deployed `close_caja_session` is still the old, unfixed version. This is exactly the regression the plan's Task 3 "STALE_VERSION regression" test is designed to catch — it is failing RED now, proving Pitfall 1 is real and live, and is expected to go GREEN once Plan 03 pushes both migrations in this plan. The 1 `itInt` seed-sanity test (which only exercises table seeding, not the RPC) passes today. `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` is fully green (12/12) since it only greps the migration files and the `audit-actions.ts` enum, neither of which requires a live push.
- **Side effect on the shared dev DB:** Running these tests closed one pre-existing `open` `caja_sessions` row that was left over from a prior manual/E2E session (via `closeOtherOpenCajas`, following the existing `pending-total.integration.test.ts` convention). This is a shared, expendable dev/test Supabase project, and the same close-on-seed pattern is already established elsewhere in the test suite.

## User Setup Required

None - no external service configuration required. Plan 03 (the next plan in this phase) is a checkpoint plan that pushes these two migrations to the remote Supabase project; that push is explicitly out of scope for this plan.

## Next Phase Readiness

- Plan 03 can push `20260709000001_tip_distribution_entries_table.sql` and `20260709000002_close_caja_session_tip_distribution.sql` directly — both are self-contained, `BEGIN;...COMMIT;`-wrapped, and were verified via grep + live-DB seeding dry-runs (only the RPC body itself is unpushed).
- After Plan 03's push, re-running `npx vitest run src/entities/caja/model/tip-distribution-rpc.integration.test.ts` should flip all 6 currently-failing tests to green with no code changes required in the test file.
- Plan 04 (settings-entity + `useTipDistributionEntry` hook) and Plan 05 (Settings tab + report panel) can rely on: `tip_distribution_entries` columns (`floor_pct`, `bar_pct`, `kitchen_pct`, `total_tips`, `floor_amount`, `bar_amount`, `kitchen_amount`, `created_at`), manager+ SELECT RLS, and the `settings` key `'tip_distribution'` shape `{floorPct, barPct, kitchenPct}` (already admin-scoped via existing `settings_update_manager_admin_scoped` RLS — verified unchanged).

---
*Phase: 19-tip-distribution-config*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260709000001_tip_distribution_entries_table.sql
- FOUND: supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql
- FOUND: src/shared/lib/audit-actions.ts
- FOUND: src/entities/caja/model/tip-distribution-rpc.integration.test.ts
- FOUND: .planning/phases/19-tip-distribution-config/19-02-SUMMARY.md
- FOUND commit: d83db94 (Task 1)
- FOUND commit: 3a21380 (Task 2)
- FOUND commit: f6349e7 (Task 3)
