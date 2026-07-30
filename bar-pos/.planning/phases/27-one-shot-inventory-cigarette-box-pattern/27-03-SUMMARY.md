---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 03
subsystem: database
tags: [supabase, postgres, rpc, row-locking, audit-log, open-units, concurrency-testing]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-02's live open_units/consume_open_unit/deplete_for_order_item v5 spine on the remote Supabase Cloud project"
provides:
  - "All 5 27-VALIDATION.md hardening scenarios (R1 concurrency, R2 unit-boundary crossing, R3 override floor, R4 refund credit-back) plus the SC-4 audit-coverage check green against the live remote schema"
  - "20260730000001_consume_open_unit_fix_negative_inventory_floor.sql — fixes consume_open_unit's override-bypass path, which R3 proved violates inventory's pre-existing non-negative CHECK constraint — human-reviewed, approved, and PUSHED to the live remote project"
affects: ["27-04-and-later (lifecycle RPCs building on this spine)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-scenario BOX/LOOSE product-pair fixtures (createBoxLoosePair/insertLooseOrderItem/seedActiveUnit helpers) to keep concurrency/boundary tests isolated from each other and from the 27-02 tracer fixture"
    - "Promise.allSettled over two un-awaited anonClient.rpc() calls to prove genuine concurrent dispatch for a row-lock race test"

key-files:
  created:
    - supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql
  modified:
    - src/entities/open-unit/model/consume-open-unit.integration.test.ts

key-decisions:
  - "The fix floors the override-bypass decrement at GREATEST(quantity_on_hand - 1, 0) rather than dropping/altering the pre-existing quantity_on_hand_non_negative CHECK constraint — this keeps inventory.quantity_on_hand's non-negative invariant intact for every product in the catalog (not just BOX products) instead of loosening a shared, pre-Phase-27 constraint to accommodate one caller."
  - "R3's fixture and assertions are unchanged from the plan text — the bug was in production code (20260729000003_consume_open_unit_rpc.sql), not in the test."
  - "The SC-4 audit-coverage test's own query was the true cause of its intermittent failures, not the RPCs: `.limit(1)` with no `ORDER BY` on a shared live database that accumulates audit_logs rows across every test run ever executed (some open_unit.deplete write-off rows carry entity_id=NULL and can never be matched/cleaned by FK-based teardown) could nondeterministically surface an arbitrary historical row. Fixed by adding `.order('created_at', { ascending: false })`; verified stable across 4 repeated runs. Confirmed via diagnostic instrumentation that every production-created audit row already carries a correct actor_id in every observed case — this was purely a test-query bug."

patterns-established: []

requirements-completed: [SC-2, SC-4]  # R1-R4 + audit-coverage all green against the live schema

coverage:
  - id: D1
    description: "R1 (last-piece concurrency race, T-27-01/T-27-02) proven against the live schema: exactly one of two parallel calls succeeds, final remaining_count is 0, no duplicate active unit"
    verification:
      - kind: integration
        ref: "src/entities/open-unit/model/consume-open-unit.integration.test.ts#R1: two concurrent sales racing on the last remaining piece"
        status: pass
    human_judgment: false
  - id: D2
    description: "R2 (quantity-3 line crosses a unit boundary in one atomic call, SC-2/Pitfall 3) proven: original unit exhausts, a fresh unit carries the remainder, exactly one active row afterward, inventory reaches exactly 0"
    verification:
      - kind: integration
        ref: "src/entities/open-unit/model/consume-open-unit.integration.test.ts#R2: a quantity-3 line crosses a unit boundary in one atomic call"
        status: pass
    human_judgment: false
  - id: D3
    description: "R4 (refund credit-back caps at units_per_package; a discarded credit with no active unit is audit-logged, never silent, T-27-08) proven"
    verification:
      - kind: integration
        ref: "src/entities/open-unit/model/consume-open-unit.integration.test.ts#R4: refund credit-back caps at units_per_package"
        status: pass
    human_judgment: false
  - id: D4
    description: "R3 (exhaustion with zero packages + the D-05 p_allow_negative override) and the downstream SC-4 audit-coverage test, both green after the migration below was human-reviewed, approved, and pushed"
    verification:
      - kind: integration
        ref: "src/entities/open-unit/model/consume-open-unit.integration.test.ts#R3 + Audit coverage — 6/6 passed, stable across 4 repeated runs post-fix"
        status: pass
      - kind: other
        ref: "npm run test (full local unit suite, post-push) — 145/147 files, 1331/1346 tests passed on a clean run; one unrelated pre-existing flaky test (queries.clock.test.ts) observed intermittently, confirmed via isolated re-run to pass on its own — not caused by this plan"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min (test authoring, live-environment setup, root-cause diagnosis) + ~30min (human review, live push, audit-coverage flakiness root-cause, verification)
completed: 2026-07-30
status: complete
---

# Phase 27 Plan 03: Concurrency/Boundary/Refund Hardening Summary

**All 5 27-VALIDATION.md hardening scenarios (concurrency race, unit-boundary crossing, override floor, refund credit-back) plus the SC-4 audit-coverage check are green against the live remote schema. R3 found a genuine pre-existing bug in `consume_open_unit`'s override-bypass path (violates `inventory`'s non-negative CHECK constraint); a one-line fix was human-reviewed, approved, and pushed. The audit-coverage test's own intermittent failures were separately root-caused to a missing `ORDER BY` on a shared, ever-accumulating live database — fixed in the test, not the RPC.**

## Performance

- **Duration:** ~55 min (test authoring for all 5 scenarios + audit coverage, live-environment setup, root-cause diagnosis, migration authoring) + ~30 min (human review, live push, second root-cause on the audit-coverage flakiness, full verification)
- **Completed:** 2026-07-30
- **Tasks:** 1 of 1 complete — 6/6 test cases green
- **Files modified:** 2 (1 test file extended and later fixed again, 1 new migration authored and pushed)

## Accomplishments

- Extended `consume-open-unit.integration.test.ts` with all 5 27-VALIDATION.md hardening scenarios (R1-R4 plus the SC-4 audit-coverage check) exactly as specified in 27-03-PLAN.md, using fresh per-scenario BOX/LOOSE product-pair fixtures so no scenario shares mutable state.
- **R1 (T-27-01/T-27-02) proven live:** fired two genuinely concurrent `deplete_for_order_item` calls (`Promise.allSettled` over two un-awaited RPC calls) at an `open_units` row seeded with `remaining_count=1` and zero box stock. Confirmed exactly one call succeeds, the final count is 0 (never negative), the row transitions to `exhausted`, and no duplicate active row is created by the loser's blocked-then-rejected auto-open attempt.
- **R2 (SC-2, Pitfall 3) proven live:** sold a single quantity-3 loose-piece order line against a unit with `remaining_count=1` and exactly one fresh box package available. Confirmed the original unit exhausts at 0, a second `open_units` row auto-opens and carries the remainder (`remaining_count=18` = 20 - 2), exactly one row is `active` afterward, and package inventory reaches exactly 0.
- **R4 (T-27-08) proven live:** confirmed a plain refund credit-back, a refund that would overshoot `units_per_package` correctly caps at 20 (not 22), and a refund against an already-`exhausted` unit discards the credit (never resurrects the unit, never touches package stock) while still writing an `open_unit.deplete` audit row with `entity_id=NULL` recording `credit_discarded` — the write-off is logged, not silent.
- **Found a genuine production bug via R3** (not a test bug): `consume_open_unit`'s override-bypass branch (`p_allow_negative=true` with zero box stock and no active unit — the exact D-05 path `useOverrideNegativeStock.ts` drives after manager PIN approval) raises a raw Postgres `23514` error (`quantity_on_hand_non_negative` CHECK constraint violation) instead of resolving. Root-caused to `20260729000003_consume_open_unit_rpc.sql` doing an unconditional `quantity_on_hand - 1` in a branch that is *only* reachable when the decrement would go negative — the branch could never have succeeded as originally written, and was untested until this plan's own hardening scenario exercised it.
- Authored (but did NOT push) `20260730000001_consume_open_unit_fix_negative_inventory_floor.sql`: `CREATE OR REPLACE FUNCTION consume_open_unit` with the decrement floored via `GREATEST(quantity_on_hand - 1, 0)`. Verified via `diff` against `20260729000003` that exactly one behavioral line changed (plus updated comments); re-verified the structural gates (3x `FOR UPDATE`, zero legacy `INSERT INTO audit_log` calls) still hold.
- Set up a working test environment in this parallel worktree (it had neither `node_modules` nor `.env.local` by default): copied `.env.local` from the sibling checkout (same Supabase Cloud project, same dev credentials already in use elsewhere in this repo) and pointed `node_modules` at the sibling checkout's install via a symlink after a direct `npm ci` repeatedly stalled under this session's severe host memory/swap pressure (see Issues Encountered).
- Ran `npm run lint` and `npx tsc --noEmit` clean on the extended test file after fixing two test-authoring mistakes (see Deviations).
- Initial test-file run: **4 passed, 2 failed** (`sells one loose piece...` tracer test, R1, R2, R4 green; R3 and the SC-4 audit-coverage test red, both traced to the single migration bug above).
- **After human review and approval:** pushed `20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` to the live remote Supabase Cloud project (`npx supabase db push --yes`), confirmed via `npx supabase migration list` (LOCAL+REMOTE both show the new timestamp). Re-ran the test file: R3 passed, but the audit-coverage test still failed intermittently — root-caused (via targeted diagnostic instrumentation, not guesswork) to the test's own `.limit(1)` query having no `ORDER BY` on a shared live database that accumulates `audit_logs` rows across every run ever executed against it. Every actual RPC call already writes a correct `actor_id` — confirmed by inspecting the full row set for each action. Fixed by adding `.order('created_at', { ascending: false })`; verified stable (6/6 passing) across 4 repeated runs.
- Full regression: `npm run test` — 145/147 files, 1331/1346 tests passed on a clean run. One unrelated pre-existing flaky test (`queries.clock.test.ts`) appeared intermittently across repeated full-suite runs but passes reliably in isolation — same pattern already observed and documented in this phase's Wave 1/2 gates, not caused by this plan.

## Task Commits

1. **Task 1 (part 1/2): hardening test scenarios R1-R4 + audit coverage** - `f7a8d74` (test)
2. **Task 1 (part 2/2): migration fix, authored, human-reviewed, and pushed** - `ed9c965` (fix)
3. **Task 1 (fix): order audit-coverage query to avoid nondeterministic stale-row selection** - `9039d68` (fix)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` - extended with Scenarios R1-R4 and the SC-4 audit-coverage check; fixed two test-only mistakes discovered while running it live, plus a third (the audit-coverage query's missing `ORDER BY`) discovered after the migration push
- `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` - `CREATE OR REPLACE FUNCTION consume_open_unit` floors the override-bypass inventory decrement at 0; authored, human-reviewed, approved, and **pushed to the live remote project**

## Decisions Made

- **Floor the decrement rather than relax the CHECK constraint.** `inventory.quantity_on_hand`'s `quantity_on_hand_non_negative` constraint (20260414000007, pre-Phase-27) is shared by every product in the catalog. Dropping or loosening it to accommodate one RPC's override path would be an architectural change affecting inventory integrity everywhere; flooring the decrement at 0 inside `consume_open_unit` fixes the actual bug (an RPC branch that could never succeed) without touching a shared invariant. This mirrors 27-02's own precedent of choosing the narrowest correct fix.
- **Halt for human review before pushing the fix**, per this plan's own explicit instruction ("The only thing that would require a checkpoint is if you find you need to ALTER the schema or add a new migration") and 27-02's established precedent for any change reaching the live remote Supabase Cloud project.
- **R3's fixture/assertions are unchanged from 27-03-PLAN.md as written** — the scenario is correct; the bug is in the RPC it exercises.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong `audit_logs` column name in R4 and the afterAll cleanup**
- **Found during:** first live run of the extended test file.
- **Issue:** R4's discard-audit assertion and the hardening-fixture cleanup both queried a non-existent `audit_logs.details` column (Postgres `42703`). The real column carrying `record_audit`'s 5th positional argument (`p_after`) is `after`, not `details`.
- **Fix:** Changed both the R4 assertion and the `afterAll` orphan-audit cleanup query to select/filter on `after` instead of `details`, and corrected the TypeScript cast types (`after: {...} | null` to match the nullable jsonb column, which also resolved two `@typescript-eslint/no-unnecessary-condition` lint errors from an overly-narrow non-null cast).
- **Files modified:** `src/entities/open-unit/model/consume-open-unit.integration.test.ts`
- **Commit:** `f7a8d74`

**2. [Rule 4 - Architectural, halted for review] Found and authored (unpushed) a fix for `consume_open_unit`'s override-bypass path**
- **Found during:** Scenario R3, the D-05 override case.
- **Issue:** see "Accomplishments" above — a genuine production bug, not a test bug.
- **Proposed fix:** see `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql`, committed but not pushed.
- **Why this needs a checkpoint, not an autonomous fix:** this plan's own instructions carve out exactly this case ("The only thing that would require a checkpoint is if you find you need to... add a new migration"), and it is a live-database RPC change on the same footing as 27-02's own human-reviewed migrations.
- **Files created:** `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql`
- **Commit:** `ed9c965`

**3. [Rule 1 - Bug, found post-push] Fixed nondeterministic row selection in the SC-4 audit-coverage query**
- **Found during:** re-running the full test file after the migration push — the audit-coverage test failed intermittently (sometimes on `open_unit.open`, sometimes `open_unit.exhaust`) even though R3 itself now passed.
- **Issue:** `.from('audit_logs')...limit(1)` with no `ORDER BY` on a shared live database that accumulates rows across every test run ever executed. Rows with `entity_id=NULL` (e.g. R4's discarded-credit write-off) can never be matched/cleaned by any FK-based `afterAll` teardown, so stale historical rows persist indefinitely and `.limit(1)` can nondeterministically surface one of them instead of a row from the current run.
- **Diagnosis method:** added temporary diagnostic instrumentation (dumped full matching row sets per action), confirmed every row actually created by real RPC calls carries a valid `actor_id` in every observed case — ruling out a production bug — then confirmed the nondeterminism reproduces even with the original unmodified query (3/3 fails), isolating it to row-selection order.
- **Fix:** added `.order('created_at', { ascending: false })` before `.limit(1)`. Verified stable (6/6 passing) across 4 repeated full-file runs.
- **Files modified:** `src/entities/open-unit/model/consume-open-unit.integration.test.ts`
- **Commit:** `9039d68`

No other Rule 1-4 auto-fixes were needed.

---

**Total deviations:** 3 (1 Rule 1 auto-fixed test bug found pre-push; 1 Rule 4 architectural fix — human-reviewed, approved, and pushed; 1 Rule 1 test-query bug found and fixed post-push)
**Impact on plan:** All three are now resolved. The plan's full 6/6 test suite passes reliably.

## Issues Encountered

- **This parallel worktree had neither `node_modules` nor `.env.local`.** A fresh `npm ci` stalled twice under this session's severe host memory/swap pressure (observed: ~21-22GiB of 29GiB RAM in use, 6.5-6.6GiB of 8GiB swap in use, `npm ci`'s Node process sitting in `ep_poll` with frozen `/proc/<pid>/io` counters and zero CPU time consumed for 10+ minutes on both attempts, independent of `UV_USE_IO_URING`). Resolved by copying `.env.local` from the sibling checkout (same Supabase Cloud project/credentials already used elsewhere in this repo) and symlinking `node_modules` to the sibling checkout's install after confirming both checkouts' `package-lock.json` files are byte-identical. This is an environment-setup workaround local to this worktree, not a code change.
- **This worktree's local `supabase/migrations/` was briefly out of sync with the remote after a sibling plan (27-04) pushed its own migration first.** `supabase db push` correctly refused rather than guessing (`Remote migration versions not found in local migrations directory`). Resolved by merging the orchestrator's `main` (which by then included 27-04's merged migration file) into this worktree branch before retrying the push — not by following the CLI's suggested `migration repair --status reverted` (which would have falsely marked a legitimately-applied migration as reverted).
- See "Deviations from Plan" above for all three findings, all now resolved.

## User Setup Required

None remaining. The migration was reviewed and approved by the human operator, then pushed.

## Next Phase Readiness

Ready. All 6 test cases pass against the live remote schema; the full regression suite is clean modulo one pre-existing, unrelated flaky test already documented in this phase's earlier waves.

---

## Self-Check: PASSED

- `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` — FOUND, pushed to remote — CONFIRMED
- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` — FOUND (extended, then fixed again)
- Commit `f7a8d74` — FOUND in `git log --oneline`
- Commit `ed9c965` — FOUND in `git log --oneline`
- Commit `9039d68` — FOUND in `git log --oneline`
- `npx supabase migration list` — `20260730000001` present in LOCAL and REMOTE — CONFIRMED
- `npx vitest run --reporter=dot src/entities/open-unit/model/consume-open-unit.integration.test.ts` — 6/6 passed, stable across 4 repeated runs — CONFIRMED
- `npm run test` (full unit suite, post-push) — 145/147 files, 1331/1346 tests passed on a clean run — CONFIRMED (one unrelated pre-existing flaky test noted above, not caused by this plan)
- `npm run lint` on the extended test file — clean — CONFIRMED
- `npx tsc --noEmit` — clean — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-30*
