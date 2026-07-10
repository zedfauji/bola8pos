---
phase: 20-promotions-engine
plan: 05
subsystem: database
tags: [postgres, plpgsql, rls, supabase, promotions, pool-billing, pricing-authority]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 03, evaluation + audit)
    provides: "evaluate_promotions_for_item v1 (item/category), applied_promotions table with pool_session_id/pool_minutes_granted/consumed_at columns already present but unwritten"
provides:
  - "evaluate_promotions_for_item v2 — adds a pool_grant branch recording unconsumed pool-minute grants alongside the unchanged item/category price loop"
  - "stop_pool_session(uuid, int) SECURITY DEFINER RPC — FIRST server-side RPC boundary for the pool-session stop write; server-authoritative rate + firstHourMode + billing math + grant consumption + pool_billing discount compounding + audit, version-guarded"
  - "Live-integration scaffold for both pool paths + the version guard (pool-promotions-rpc.integration.test.ts)"
affects: [20-06, 20-08, 20-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "close_tab-style SECURITY DEFINER RPC wrapping a previously-raw client write (pool_sessions stop), with the identical FOR UPDATE + p_expected_version IS DISTINCT FROM guard and explicit version+1 bump"
    - "Server-authoritative billing inputs: rate_per_hour read from pool_tables, firstHourMode read from settings('billing'), never trusted from the client"
    - "Single-UPDATE grant consumption (consumed_at = now()) inside the same transaction as the billing write — a grant cannot be consumed twice"

key-files:
  created:
    - supabase/migrations/20260710000005_evaluate_promotions_pool_grant.sql
    - supabase/migrations/20260710000006_stop_pool_session_rpc.sql
    - src/entities/promotion/model/pool-promotions-rpc.integration.test.ts
  modified: []

key-decisions:
  - "Billing math ported into PL/pgSQL exactly per the plan's explicit action spec (v_elapsed_minutes raw, single block-round after prepaid deduction) rather than byte-for-byte replicating computePoolSessionBilling's double block-rounding (which block-rounds once before AND once after prepaid deduction) — the plan's <action> text is the authoritative spec for this RPC, and its grep-verified structure was followed literally"
  - "stop_pool_session's record_audit call uses action 'promotion.apply' / entity_type 'pool_session' per the plan's exact instruction, reusing the same audit action as the item/category and pool_grant paths rather than introducing a new audit action name"
  - "pool_grant promotions insert applied_promotions with discount_type = NULL (semantically unused for grants — discount_value carries the minutes-granted count) even though promotions.discount_type itself remains NOT NULL/CHECK-constrained at the promotion-definition level (a pool_grant promotion admin must still pick percentage/fixed_amount/fixed_price as a formality; only discount_value is read for pool_grant)"

requirements-completed: [SC-3]

# Metrics
duration: ~40min
completed: 2026-07-09
---

# Phase 20 Plan 05: Pool-Time Promotions (Billing Discount + Bonus-Minute Grant) Summary

**stop_pool_session — the first server-side RPC boundary for the pool-session stop write — computes billing server-side (rate, firstHourMode, block-rounding), consumes unconsumed pool_grant minutes as prepaid, compounds pool_billing discounts onto the charge, and writes the session atomically with a Phase-15 version guard, replacing the prior raw client `.update()`.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3/3 completed
- **Files modified:** 3 (all created)

## Accomplishments

- `evaluate_promotions_for_item` v2 (`20260710000005_evaluate_promotions_pool_grant.sql`): `CREATE OR REPLACE`s the function, preserving the v1 item/category price-compounding loop and combo early-return verbatim, then appends a second loop over active/available `pool_grant`-targeted promotions matching the purchased item's product or category. Each match inserts an `applied_promotions` row with `pool_minutes_granted = discount_value::int` and `consumed_at = NULL` — no `unit_price` mutation, no interaction with the price loop.
- `stop_pool_session(uuid, int)` (`20260710000006_stop_pool_session_rpc.sql`): SECURITY DEFINER RPC mirroring `close_tab`'s raw-write-to-RPC precedent. `FOR UPDATE` locks the session row, guards `p_expected_version IS DISTINCT FROM` current version raising `P0V01`/`P0V02` (Phase 15 parity), reads `rate_per_hour` from `pool_tables` and `firstHourMode` from `settings.value->>'firstHourMode'` (key `'billing'`, default `'prorated'`) — both server-side, never client-trusted. Sums and consumes unconsumed `pool_grant` minutes for the tab in a single `UPDATE ... consumed_at = now()` (no double-consume, T-20-06). Ports the billing math (`v_elapsed_minutes` from `EXTRACT(EPOCH ...)`, firstHourMode full/prorated branch, `GREATEST(0, base - prepaid)`, `CEIL(chargeable/15.0)*15` block-rounding) exactly per the plan's spec. Compounds `pool_billing`-targeted active/available promotions onto the base charge with the identical `GREATEST(0, ROUND(...,2))` sequential-compounding CASE used by `evaluate_promotions_for_item`, inserting one `applied_promotions` row per applied promotion tagged with `pool_session_id`. Writes `pool_sessions.stopped_at/billed_minutes/total_charge/version+1` in the same transaction, fires `record_audit('promotion.apply', 'pool_session', ...)`, and returns a jsonb snapshot of the updated session row for the client (rewire is Plan 20-08).
- `pool-promotions-rpc.integration.test.ts`: env-guarded (`describe.skipIf(!hasE2eEnv)`) live scaffold with 3 cases — a `pool_billing` percentage promotion reduces `total_charge` vs. the deterministic undiscounted base (rate=100/hr, session started 40 min ago, prorated block-rounding → base charge 75, 20% off → 60) with a matching `applied_promotions` row (`target_type='pool_billing'`, `pool_session_id` set); a `pool_grant` purchase records an unconsumed grant that a subsequent `stop_pool_session` call on the same tab's session consumes and deducts from billed minutes (40 min elapsed − 15 prepaid = 25 chargeable → 30 billed minutes); a stale `p_expected_version` surfaces `error.code === 'P0V01'` and leaves the session untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: evaluate_promotions_for_item v2 — pool_grant branch** - `541d55a` (feat)
2. **Task 2: stop_pool_session SECURITY DEFINER RPC** - `d52d232` (feat)
3. **Task 3: Live pool-promotions integration scaffold** - `f0a7209` (test)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified

- `supabase/migrations/20260710000005_evaluate_promotions_pool_grant.sql` - `evaluate_promotions_for_item` v2, adds the pool_grant bonus-minute-grant loop
- `supabase/migrations/20260710000006_stop_pool_session_rpc.sql` - `stop_pool_session(uuid, int)` SECURITY DEFINER RPC
- `src/entities/promotion/model/pool-promotions-rpc.integration.test.ts` - live integration scaffold, pool_billing/pool_grant/version-guard cases

## Decisions Made

- Followed the plan's `<action>` billing-math spec literally (single block-round after prepaid deduction, raw elapsed minutes as the pre-rounding base) rather than reproducing `computePoolSessionBilling`'s TS-side double block-rounding — the plan's grep-verified structure (`rate_per_hour`, `version = v_current_version + 1`, `consumed_at = now()`, `target_type = 'pool_billing'`, `P0V01`) is the authoritative spec for this server-side port, and all six automated verify gates pass against it.
- `record_audit` calls use the existing 7-positional-arg form (matching the already-live `evaluate_promotions_for_item` v1 call site), resolving against the current 8-param signature (`p_user_id` defaults `NULL`) — no new audit action name introduced.
- Test file copies the `evaluate-promotions-rpc.integration.test.ts` / `applied-promotions-rls.integration.test.ts` service-role + signed-in-manager client pattern (rather than importing the app's shared `supabase` singleton) for consistency with this entity's other Phase 20 integration scaffolds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules` and `.env.local`**
- **Found during:** Task 3, first `npx vitest run` attempt
- **Issue:** Fresh worktree checkout had no `node_modules/` and no `.env.local`; the same situation documented in 20-01/20-02/20-03-SUMMARY.md.
- **Fix:** Ran `npm ci` and copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`).
- **Files modified:** none (gitignored local dev-environment plumbing only, not staged)
- **Committed in:** N/A

---

**Total deviations:** 1 (Rule 3 local-environment blocker, identical to prior Phase 20 plans' documented pattern)
**Impact on plan:** No scope creep. No production code touched beyond what each task specified.

## Issues Encountered

- **Live-DB pre-push test state (expected, not a bug — identical to 20-03/20-04's documented situation):** This shared worktree's `.env.local` points at a live shared Supabase project, so `pool-promotions-rpc.integration.test.ts`'s `describe.skipIf(!hasE2eEnv)` guard evaluates to "run" rather than "skip". Because `20260710000001..000006` (this plan's own two migrations plus all of 20-01/20-02/20-03's) are NOT yet pushed to the remote project (Plan 20-06, wave 4, is the BLOCKING push — this plan is wave 3, executed before it), the new suite fails at runtime with `Could not find the table 'public.promotions'`/`PGRST202` (RPC not found), exactly mirroring `evaluate-promotions-rpc.integration.test.ts` and `applied-promotions-rls.integration.test.ts`'s current state in this same worktree (independently re-verified: both existing Plan 20-03 scaffolds also fail identically right now, confirming this is a pre-existing environmental gap, not a regression introduced by this plan). No test-file change was made to force a false "skip" — that would mask a real, expected dependency rather than reflect it.
  - `npx eslint` on the new test file is clean (0 errors, 0 warnings).
  - `npm run typecheck` shows only the 2 pre-existing unrelated errors already documented in STATE.md/CLAUDE.md (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`) — neither touched by this plan.
  - All 4 grep gates for Task 1's migration and all 6 grep gates for Task 2's migration pass (comment-filtered, verified directly).
  - Re-running `npx vitest run src/entities/promotion/model/pool-promotions-rpc.integration.test.ts` after Plan 20-06's push should flip all three cases to green with no code changes required.

## User Setup Required

None — no external service configuration required. Plan 20-06 (the phase's BLOCKING db-push plan, wave 4) will apply this plan's two migrations (in addition to 20-01/20-02/20-03's four) to the remote Supabase project.

## Next Phase Readiness

- Plan 20-06's BLOCKING db push must apply all six Phase 20 migrations to date (20260710000001 through 000006) — all are self-contained, `BEGIN;...COMMIT;`-wrapped, and were verified via each plan's exact grep gates.
- After Plan 20-06's push, re-running `pool-promotions-rpc.integration.test.ts` should flip all three currently-failing cases to green with no code changes required.
- Plan 20-08 (client rewire) can now call `stop_pool_session` from `useMutationStopSession` in place of the raw `.update()`, mapping the RPC's jsonb return payload back onto the cached `pool_sessions` row.
- Plan 20-09's parity gate can compare this RPC's billing output against `computePoolSessionBilling`'s TS mirror for drift detection, noting the documented single-vs-double block-rounding difference above if it surfaces there.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260710000005_evaluate_promotions_pool_grant.sql
- FOUND: supabase/migrations/20260710000006_stop_pool_session_rpc.sql
- FOUND: src/entities/promotion/model/pool-promotions-rpc.integration.test.ts
- FOUND commit: 541d55a (Task 1)
- FOUND commit: d52d232 (Task 2)
- FOUND commit: f0a7209 (Task 3)
