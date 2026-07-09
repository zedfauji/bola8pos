---
phase: 19-tip-distribution-config
plan: 03
subsystem: database
tags: [supabase, postgres, migrations, rls, rpc, tip-distribution, caja, ci]

# Dependency graph
requires:
  - phase: 19-tip-distribution-config
    provides: "Plan 02's two migrations (tip_distribution_entries table + append-only RLS; close_caja_session CREATE OR REPLACE with version-bump fix + tip pooling/split/insert/audit) and the tip-distribution-rpc.integration.test.ts scaffold"
provides:
  - "Both Phase 19 migrations (20260709000001, 20260709000002) applied to the remote Supabase project shsrhxleopmovzpzqmex"
  - "tip_distribution_entries table live and queryable with exactly one manager+ SELECT-only RLS policy"
  - "close_caja_session live with the version=version+1 STALE_VERSION fix AND the tip-pooling/largest-remainder computation"
  - "supabase.types.ts extended with the tip_distribution_entries Row/Insert/Update/Relationships block"
  - "Plan 02 integration test proven green against the live database (7/7 passing)"
affects: [19-04-settings-entity-caja-hook, 19-05-settings-tab-report-panel, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual supabase.types.ts extension (Docker unavailable) — Phase 15/17 precedent continued"
    - "npx supabase db push against a linked project (project_id already set in supabase/config.toml) to promote local migrations to the remote database"

key-files:
  created: []
  modified:
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "No code changes were required for Task 2 — the checkpoint's job was solely to promote already-authored/committed migration files (Plan 02) to the remote project; git status confirmed zero diffs after the push, so no Task 2 commit was made beyond this SUMMARY"
  - "Resumed the prior executor's worktree (agent-a06ce64d6cd54bcae) in-place per continuation instructions instead of re-doing Task 1 in a fresh worktree, avoiding a duplicate types.ts commit"

requirements-completed: [SC-2, SC-4]

# Metrics
duration: 8min (continuation session; Task 1 was completed in a prior session)
completed: 2026-07-09
---

# Phase 19 Plan 03: Push Tip Distribution Migrations + Verify Live Summary

**Both Phase 19 migrations (tip_distribution_entries table + the close_caja_session version-bump/tip-pooling rewrite) pushed to the live remote Supabase project via `npx supabase db push`, with all 4 SQL verification checks and the 7-test live integration suite passing green.**

## Performance

- **Duration:** 8 min (this continuation session, from BLOCKING checkpoint approval to completion)
- **Started:** 2026-07-09T18:45:00Z (approx, checkpoint resume)
- **Completed:** 2026-07-09T18:53:11Z
- **Tasks:** 2/2 (Task 1 committed in prior session as `9521002`; Task 2 executed and verified this session)
- **Files modified:** 1 (Task 1 only; Task 2 was a database-state change, no local files)

## Accomplishments
- `npx supabase db push` applied `20260709000001_tip_distribution_entries_table.sql` and `20260709000002_close_caja_session_tip_distribution.sql` to the remote project `shsrhxleopmovzpzqmex`; `npx supabase migration list` confirms both now show a matching remote timestamp (previously local-only)
- Verified `to_regclass('public.tip_distribution_entries')` returns non-null — table is live
- Verified `pg_policies` shows exactly one policy on `tip_distribution_entries`: `tip_distribution_entries_select_manager` (cmd `SELECT`) — no INSERT/UPDATE/DELETE policy exists, confirming append-only-by-omission
- Verified `pg_get_functiondef('public.close_caja_session(uuid,uuid,numeric,text)')` contains both `version = version + 1` (the STALE_VERSION regression fix) and `INSERT INTO tip_distribution_entries (...)` (the tip computation feature) in the same live function body
- Ran `npx vitest run src/entities/caja/model/tip-distribution-rpc.integration.test.ts` live against the now-migrated remote database — **7/7 tests passed**, including the previously-RED STALE_VERSION regression test and the SC-2 allocations-sum test (floor+bar+kitchen === total_tips)
- `src/shared/lib/supabase.types.ts` extended (prior session, commit `9521002`) with the `tip_distribution_entries` Row/Insert/Update/Relationships block (10 columns, one-to-one FK to `caja_sessions`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend supabase.types.ts with the tip_distribution_entries block** - `9521002` (feat, prior session)
2. **Task 2: Apply both Phase 19 migrations via supabase db push + verify live** - no commit (database-state change only; `git status` confirmed zero local diffs after push)

**Plan metadata:** commit pending (this SUMMARY.md)

## Files Created/Modified
- `src/shared/lib/supabase.types.ts` - Added `tip_distribution_entries` table type block (Row/Insert/Update/Relationships, 10 columns, FK to `caja_sessions`)

## Decisions Made
- Resumed the original executor worktree (`agent-a06ce64d6cd54bcae`, branch `worktree-agent-a06ce64d6cd54bcae`) in place rather than redoing Task 1 in the newly-spawned worktree, since it was still present with a clean working tree and the Task 1 commit intact — avoids a duplicate/conflicting `supabase.types.ts` edit.
- Confirmed via `git status --short` (both `bar-pos/` and repo root) that the `supabase db push` produced no local file diffs — the migrations were already committed as files in Plan 02; this checkpoint only changed remote database state. No Task 2 commit was necessary beyond this plan-completion SUMMARY.

## Deviations from Plan

None - plan executed exactly as written. The BLOCKING checkpoint was explicitly pre-approved by the user before this continuation session started (per the orchestrator's instructions), so Task 2 proceeded directly through `npx supabase db push` and the 4 how-to-verify steps without re-pausing.

## Issues Encountered

None. All 4 verification checks passed on the first attempt:
1. `to_regclass('public.tip_distribution_entries')` → `tip_distribution_entries` (non-null)
2. `pg_policies` → exactly one row: `tip_distribution_entries_select_manager` / `SELECT`
3. `pg_get_functiondef(...close_caja_session...)` → contains both `version = version + 1` and `INSERT INTO tip_distribution_entries`
4. `npx vitest run src/entities/caja/model/tip-distribution-rpc.integration.test.ts` → 7/7 passed

This directly resolves the "expected failure" documented in Plan 02's Issues Encountered section (the 6 `itAuth`/`itBartender` tests that were RED against the old, unfixed `close_caja_session` due to `STALE_VERSION` now pass GREEN against the pushed version).

## User Setup Required

None - no external service configuration required. The remote Supabase project was already linked (`project_id = "shsrhxleopmovzpzqmex"` in `supabase/config.toml`) and `.env.local` was already present in this worktree from the prior session.

## Next Phase Readiness

- Both Phase 19 migrations are live on the remote Supabase project. `tip_distribution_entries` is queryable by manager/admin roles; `close_caja_session` computes and persists the tip split on every close.
- Plan 04 (settings entity + `useTipDistributionEntry` hook) can now read live `tip_distribution_entries` rows (columns: `floor_pct`, `bar_pct`, `kitchen_pct`, `total_tips`, `floor_amount`, `bar_amount`, `kitchen_amount`, `created_at`) and the `settings` key `'tip_distribution'` shape `{floorPct, barPct, kitchenPct}`.
- Plan 05 (Settings tab + report panel) can build UI against the now-live, typed `tip_distribution_entries` table without any further backend work.
- No blockers or concerns carried forward.

---
*Phase: 19-tip-distribution-config*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/shared/lib/supabase.types.ts (tip_distribution_entries block present)
- FOUND commit: 9521002 (Task 1)
- FOUND: remote migration 20260709000001 (confirmed via `npx supabase migration list`)
- FOUND: remote migration 20260709000002 (confirmed via `npx supabase migration list`)
- FOUND: tip_distribution_entries table live (to_regclass check)
- FOUND: tip_distribution_entries_select_manager RLS policy (SELECT only)
- FOUND: close_caja_session function body contains version fix + tip INSERT
- FOUND: 7/7 tests passing in tip-distribution-rpc.integration.test.ts
