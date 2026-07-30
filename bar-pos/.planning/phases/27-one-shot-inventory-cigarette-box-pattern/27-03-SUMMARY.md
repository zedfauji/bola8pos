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
  - "4 of 5 27-VALIDATION.md hardening scenarios green against the live remote schema (R1 concurrency, R2 unit-boundary crossing, R4 refund credit-back, plus the pre-existing tracer test)"
  - "A found-and-authored (NOT YET PUSHED) migration fixing consume_open_unit's override-bypass path, which R3 proved violates inventory's pre-existing non-negative CHECK constraint"
affects: ["27-03-completion (resume after migration push), 27-04-and-later (lifecycle RPCs building on this spine)"]

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
  - "HALTED before pushing the new migration to the live remote Supabase Cloud project, per the same human-review precedent 27-02 established for schema/RPC-affecting changes. The fix is authored, committed, and diffed to exactly one changed line versus 20260729000003, but `npx supabase db push` has NOT been run."
  - "The fix floors the override-bypass decrement at GREATEST(quantity_on_hand - 1, 0) rather than dropping/altering the pre-existing quantity_on_hand_non_negative CHECK constraint — this keeps inventory.quantity_on_hand's non-negative invariant intact for every product in the catalog (not just BOX products) instead of loosening a shared, pre-Phase-27 constraint to accommodate one caller."
  - "R3's fixture and assertions are unchanged from the plan text — the bug is in production code (20260729000003_consume_open_unit_rpc.sql), not in the test."

patterns-established: []

requirements-completed: []  # SC-2/SC-4 partially proven (R1/R2/R4 + tracer test green); R3 and the audit-coverage test remain red pending the migration push — see Next Phase Readiness

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
    description: "R3 (exhaustion with zero packages + the D-05 p_allow_negative override) and the downstream SC-4 audit-coverage test, both blocked on a live migration push the human must approve first"
    verification:
      - kind: integration
        ref: "src/entities/open-unit/model/consume-open-unit.integration.test.ts#R3: exhaustion with zero packages rejects the sale — currently red (Postgres 23514, quantity_on_hand_non_negative) pending the migration below"
        status: fail
    human_judgment: true
    rationale: "The fix requires pushing a CREATE OR REPLACE FUNCTION migration to the live remote Supabase Cloud project — a schema/RPC-affecting action that, per 27-02's established precedent and this plan's own explicit instructions, needs human review before push, not an automated check."

# Metrics
duration: ~55min (test authoring, live-environment setup, root-cause diagnosis of the R3 failure, migration authoring)
completed: 2026-07-30
status: blocked
---

# Phase 27 Plan 03: Concurrency/Boundary/Refund Hardening — HALTED AT CHECKPOINT

**4 of 5 27-VALIDATION.md hardening scenarios (concurrency race, unit-boundary crossing, refund credit-back, plus the original tracer test) are green against the live remote schema; the 5th (D-05 override) found a genuine pre-existing bug in `consume_open_unit` — its override-bypass path violates `inventory`'s non-negative CHECK constraint — and a one-line fix is authored but not yet pushed, pending human review.**

## Performance

- **Duration:** ~55 min (test authoring for all 5 scenarios + audit coverage, live-environment setup in this worktree, root-cause diagnosis, migration authoring and structural verification)
- **Completed:** N/A — halted at checkpoint, not plan-complete
- **Tasks:** 1 of 1 (Task 1) — 4/6 test cases in the file green, 2 red pending a live migration push
- **Files modified:** 2 (1 test file extended, 1 new migration authored)

## Accomplishments

- Extended `consume-open-unit.integration.test.ts` with all 5 27-VALIDATION.md hardening scenarios (R1-R4 plus the SC-4 audit-coverage check) exactly as specified in 27-03-PLAN.md, using fresh per-scenario BOX/LOOSE product-pair fixtures so no scenario shares mutable state.
- **R1 (T-27-01/T-27-02) proven live:** fired two genuinely concurrent `deplete_for_order_item` calls (`Promise.allSettled` over two un-awaited RPC calls) at an `open_units` row seeded with `remaining_count=1` and zero box stock. Confirmed exactly one call succeeds, the final count is 0 (never negative), the row transitions to `exhausted`, and no duplicate active row is created by the loser's blocked-then-rejected auto-open attempt.
- **R2 (SC-2, Pitfall 3) proven live:** sold a single quantity-3 loose-piece order line against a unit with `remaining_count=1` and exactly one fresh box package available. Confirmed the original unit exhausts at 0, a second `open_units` row auto-opens and carries the remainder (`remaining_count=18` = 20 - 2), exactly one row is `active` afterward, and package inventory reaches exactly 0.
- **R4 (T-27-08) proven live:** confirmed a plain refund credit-back, a refund that would overshoot `units_per_package` correctly caps at 20 (not 22), and a refund against an already-`exhausted` unit discards the credit (never resurrects the unit, never touches package stock) while still writing an `open_unit.deplete` audit row with `entity_id=NULL` recording `credit_discarded` — the write-off is logged, not silent.
- **Found a genuine production bug via R3** (not a test bug): `consume_open_unit`'s override-bypass branch (`p_allow_negative=true` with zero box stock and no active unit — the exact D-05 path `useOverrideNegativeStock.ts` drives after manager PIN approval) raises a raw Postgres `23514` error (`quantity_on_hand_non_negative` CHECK constraint violation) instead of resolving. Root-caused to `20260729000003_consume_open_unit_rpc.sql` doing an unconditional `quantity_on_hand - 1` in a branch that is *only* reachable when the decrement would go negative — the branch could never have succeeded as originally written, and was untested until this plan's own hardening scenario exercised it.
- Authored (but did NOT push) `20260730000001_consume_open_unit_fix_negative_inventory_floor.sql`: `CREATE OR REPLACE FUNCTION consume_open_unit` with the decrement floored via `GREATEST(quantity_on_hand - 1, 0)`. Verified via `diff` against `20260729000003` that exactly one behavioral line changed (plus updated comments); re-verified the structural gates (3x `FOR UPDATE`, zero legacy `INSERT INTO audit_log` calls) still hold.
- Set up a working test environment in this parallel worktree (it had neither `node_modules` nor `.env.local` by default): copied `.env.local` from the sibling checkout (same Supabase Cloud project, same dev credentials already in use elsewhere in this repo) and pointed `node_modules` at the sibling checkout's install via a symlink after a direct `npm ci` repeatedly stalled under this session's severe host memory/swap pressure (see Issues Encountered).
- Ran `npm run lint` and `npx tsc --noEmit` clean on the extended test file after fixing two test-authoring mistakes (see Deviations).
- Full test-file run: **4 passed, 2 failed** (`sells one loose piece...` tracer test, R1, R2, R4 green; R3 and the SC-4 audit-coverage test red, both traced to the single migration bug above, not to test logic).

## Task Commits

1. **Task 1 (part 1/2): hardening test scenarios R1-R4 + audit coverage** - `f7a8d74` (test)
2. **Task 1 (part 2/2): migration fix, authored/committed, NOT pushed** - `ed9c965` (fix)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` - extended with Scenarios R1-R4 and the SC-4 audit-coverage check; also fixed two test-only mistakes discovered while running it live (see Deviations)
- `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` - `CREATE OR REPLACE FUNCTION consume_open_unit` floors the override-bypass inventory decrement at 0; authored and committed, **not yet pushed to the live remote project**

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

No other Rule 1-4 auto-fixes were needed.

---

**Total deviations:** 2 (1 Rule 1 auto-fixed test bug; 1 Rule 4 architectural fix authored but halted for human review before push)
**Impact on plan:** The Rule 1 fix was necessary for the test itself to assert correctly and is fully resolved. The Rule 4 finding blocks 2 of 6 test cases (R3, and the SC-4 audit-coverage test that depends on R3 having produced an `open_unit.override` audit row) until the migration is reviewed and pushed.

## Issues Encountered

- **This parallel worktree had neither `node_modules` nor `.env.local`.** A fresh `npm ci` stalled twice under this session's severe host memory/swap pressure (observed: ~21-22GiB of 29GiB RAM in use, 6.5-6.6GiB of 8GiB swap in use, `npm ci`'s Node process sitting in `ep_poll` with frozen `/proc/<pid>/io` counters and zero CPU time consumed for 10+ minutes on both attempts, independent of `UV_USE_IO_URING`). Resolved by copying `.env.local` from the sibling checkout (same Supabase Cloud project/credentials already used elsewhere in this repo) and symlinking `node_modules` to the sibling checkout's install after confirming both checkouts' `package-lock.json` files are byte-identical. This is an environment-setup workaround local to this worktree, not a code change.
- See "Deviations from Plan" above for the two findings (one resolved, one halted for review).

## User Setup Required

**A database migration requires human review before this plan can complete.** Before resuming:

1. Review `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` — the diff against the already-live `20260729000003_consume_open_unit_rpc.sql` is exactly one behavioral line (`quantity_on_hand - 1` to `GREATEST(quantity_on_hand - 1, 0)`), verified via `diff`.
2. If approved, push it to the live remote Supabase Cloud project: `npx supabase db push --yes` (requires the CLI to be linked in whichever checkout runs it — `npx supabase link --project-ref shsrhxleopmovzpzqmex` if not already linked, per 27-02's precedent).
3. Re-run `npx vitest run --reporter=dot src/entities/open-unit/model/consume-open-unit.integration.test.ts` and confirm all 6 tests pass (currently 4/6).
4. Re-run `npm run test` for the full regression suite.

## Next Phase Readiness

Not ready — this plan is halted at a checkpoint, not complete. Once the migration above is reviewed, pushed, and the full test file is confirmed green (6/6), this plan's Task 1 `<verify>`/`<acceptance_criteria>` will be satisfied and a final SUMMARY.md revision should replace this one, matching 27-02's own two-stage (halt-then-finalize) pattern.

---

## Self-Check: PASSED

- `supabase/migrations/20260730000001_consume_open_unit_fix_negative_inventory_floor.sql` — FOUND
- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` — FOUND (extended)
- Commit `f7a8d74` — FOUND in `git log --oneline`
- Commit `ed9c965` — FOUND in `git log --oneline`
- `npx vitest run --reporter=verbose src/entities/open-unit/model/consume-open-unit.integration.test.ts` — 4 passed, 2 failed (R3, audit-coverage) — CONFIRMED, both failures traced to the single migration bug documented above
- `npm run lint` on the extended test file — clean — CONFIRMED
- `npx tsc --noEmit` — clean — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: N/A — halted at checkpoint*
