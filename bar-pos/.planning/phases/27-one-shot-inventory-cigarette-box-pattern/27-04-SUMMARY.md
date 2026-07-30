---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 04
subsystem: database
status: "checkpoint"
tags: [supabase, postgres, rpc, row-locking, audit-log, open-units, rbac]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-02's live open_units table, products.units_per_package/parent_product_id, consume_open_unit RPC, deplete_for_order_item v5 (all already pushed to the remote Supabase Cloud project)"
provides:
  - "supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql — open_open_unit (bartender+), correct_open_unit / void_open_unit (manager+) — AUTHORED and COMMITTED, NOT YET PUSHED to the live remote project"
  - "src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts — AUTHORED and COMMITTED, NOT YET RUN (requires the migration above to be pushed first)"
affects: ["27-07-and-27-08 (the admin Open-Units tab UI that will call these three RPCs)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Insert-then-catch-unique_violation for open_open_unit's D-08 duplicate rejection, mirroring the existing stock_movements idempotency-index precedent — no look-then-insert race window"
    - "get_user_role() guard inside the RPC body (not RLS-only) as the actual RBAC control, per the process_refund precedent — bartender+ for open_open_unit (D-11), manager+ for correct_open_unit/void_open_unit (D-12)"
    - "record_audit() before/after to_jsonb sandwich for every mutating lifecycle RPC, with the correction reason merged into the after payload so it is recoverable from audit_logs even when the correction doesn't zero the unit out"

key-files:
  created:
    - supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql
    - src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts
  modified: []

key-decisions:
  - "Human operator's established preference (set during plan 27-02) is to review new migration SQL before it touches the live database. This plan halts at the same kind of checkpoint before running `supabase db push` or executing the new integration test against the live remote project — see 'Deferred to Human Review' below."
  - "Merged the supplied correction reason into correct_open_unit's audit `after` payload (not specified verbatim by the plan, but a small Rule-2 addition): the row's own `closed_reason` column is only populated when a correction zeroes the unit out, so without this merge a non-zeroing correction's reason would be unrecoverable from the audit trail, which is exactly the T-27-10 gap this RPC exists to close."
  - "Reordered the last two Task-2 test assertions (the plan's items 6 and 7) so the 'freed product accepts a fresh open_open_unit call' assertion runs BEFORE the 'a sale never resurrects the voided row' assertion, not after as literally sequenced in the plan text. Running them in the plan's literal order is self-contradictory against the plan's own fixture (BOX_INITIAL_STOCK=3): after the void, 2 packages remain, so the sale in item 7 would auto-open a fresh active unit via consume_open_unit's nested logic — meaning the following 'fresh open_open_unit succeeds' assertion in item 6 would then hit the D-08 duplicate rejection instead of succeeding. Swapping the order preserves both invariants (index released; voided row never resurrected) without contradiction. This is untested code (see Deferred to Human Review) — the ordering choice is documented here for the human reviewer and for whoever runs this test after the migration is pushed."

requirements-completed: []  # SC-1/SC-3/SC-4 are authored but NOT verified against the live schema yet — see below.

coverage:
  - id: D1
    description: "open_open_unit, correct_open_unit, void_open_unit authored per 27-02's locked schema shape, with the D-11/D-12 RBAC split, D-08's insert-then-catch duplicate rejection, and record_audit before/after wiring"
    verification:
      - kind: unit
        ref: "structural grep gates from 27-04-PLAN.md Task 1 <verify> — all passed locally (3 functions, 3 SECURITY DEFINER, 2 manager-guard occurrences, 1 kitchen-guard occurrence, unique_violation present, 3 record_audit calls, 5 to_jsonb calls, no p_allow_negative, no legacy audit_log INSERT)"
        status: pass
      - kind: unit
        ref: "npx vitest run --project unit --reporter=dot src/shared/lib/__tests__/audit-actions.test.ts — 13/13 passed"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint — both clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "open-unit-lifecycle.integration.test.ts authored, covering the open path, D-07/D-08 duplicate rejection, D-12/T-27-09 escalation rejection, D-10 correction with audit trail, correction validation, D-10 void, freed-index re-open, and voided-row-never-resurrected"
    verification: []
    human_judgment: true
    rationale: "This test has NOT been executed — it requires migration 20260729000005 to be pushed to the live remote Supabase project first, and this plan deliberately halts before that push per the human operator's established review-before-push preference (same discipline as 27-02's checkpoint). A human must review the migration SQL, approve the push, and then a follow-up session runs this test against the live schema before SC-1/SC-3/SC-4 can be marked verified."

# Metrics
duration: ~45min (Task 1 authoring + verification; Task 2 test authoring, deliberately not executed)
completed: 2026-07-30
status: checkpoint
---

# Phase 27 Plan 04: Open-Unit Lifecycle RPCs (open/correct/void) Summary

**The three manual lifecycle RPCs the admin Open-Units tab will drive — `open_open_unit` (bartender+, D-11), `correct_open_unit` and `void_open_unit` (manager+, D-12) — are authored, committed, and pass every structural verification gate, plus a full integration test proving their RBAC split, D-08 rejection wording, and audit wiring is authored and committed; NEITHER has been run against the live remote database — this plan halts at a checkpoint for human review of the migration SQL before any push, per the established phase-27 discipline.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-30
- **Tasks:** 1 of 2 complete (Task 1 fully done and verified; Task 2's test file is authored/committed but its live-push-and-run half is deliberately deferred to the checkpoint below)
- **Files modified:** 2 new files (1 migration, 1 integration test)

## Accomplishments

- Authored `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql` with all three lifecycle RPCs:
  - `open_open_unit(p_product_id uuid) RETURNS uuid` — bartender+ (D-11). Locks the BOX product's `inventory` row, inserts the new `open_units` row, and only decrements package stock after the insert succeeds. Catches `unique_violation` on the partial unique index (rather than a look-then-insert pre-check) to implement D-07/D-08: the loser of a simultaneous double-tap gets `DUPLICATE_ENTRY: an open unit already exists for this product (% remaining) — sell through it first` with the live remaining count interpolated, not a silent auto-close. Takes no negative-stock-bypass parameter of any kind (D-05/T-27-12 — that single override mechanism stays on the order-entry path where the manager PIN gate already exists).
  - `correct_open_unit(p_open_unit_id uuid, p_remaining_count int, p_reason text) RETURNS void` — manager+ (D-12). Requires a non-blank reason (T-27-10), validates the target unit is `active` and the new count is within `0..units_per_package`, captures a before/after `to_jsonb` sandwich for `record_audit`, and auto-transitions the unit to `exhausted` when corrected to zero (freeing the partial unique index).
  - `void_open_unit(p_open_unit_id uuid, p_reason text) RETURNS void` — manager+ (D-12), same guard and reason requirement. Sets `status='void'`, `remaining_count=0`, does **not** credit `inventory` back (D-10/T-27-11 — the package is already physically gone; crediting it would fabricate stock).
  - All three: `SECURITY DEFINER SET search_path = public`, `GRANT EXECUTE ... TO authenticated`, and every mutation routes through `record_audit()` — never the legacy singular `audit_log` table.
- Verified all of Task 1's structural grep gates pass (3 functions, 3 `SECURITY DEFINER`, exactly 2 manager-guard occurrences, at least 1 kitchen-guard occurrence, `unique_violation` present, exactly 3 `record_audit` calls, at least 5 `to_jsonb` calls, no `p_allow_negative`, no legacy `audit_log` INSERT).
- Ran `npx vitest run --project unit --reporter=dot src/shared/lib/__tests__/audit-actions.test.ts`: 13/13 passed — confirms the CI audit-action enum gate is satisfied by the new migration's `open_unit.open` / `open_unit.correct` / `open_unit.void` action strings (already registered in `audit-actions.ts` by plan 27-02).
- Ran `npm run typecheck`: clean. Ran `npm run lint`: clean (only a pre-existing unrelated `boundaries` config warning).
- Ran the full local unit suite (`npm run test`, which is `vitest run --project unit` — this project config excludes every `**/*.integration.test.ts` file, so it never touches the live remote database): 145 files passed, 2 skipped, 1331 tests passed, 15 todo, 0 failed. No regression from this plan's new files.
- Authored `src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts`, mirroring `depletion.integration.test.ts`'s temp-user skeleton but creating **two** temporary auth users (bartender-role and manager-role) so the RBAC-split assertions call the RPCs as a real bartender/manager, never the service-role client. Covers, in order: the D-11/SC-3 open path (unit fields, package decrement, audit rows); D-07/D-08 duplicate rejection (live remaining count in the message, no package consumed); D-12/T-27-09 escalation rejection (bartender calling `correct_open_unit`/`void_open_unit` directly, both rejected with `AUTH_FORBIDDEN`, unit unchanged); D-10 correction (before=20/after=5 recoverable from `audit_logs`); correction validation (out-of-range both directions, blank reason, count stays 5); D-10 void (status/remaining_count/closed_by/closed_reason fields, inventory unchanged, audit row present); the freed product accepting a fresh `open_open_unit` call (partial unique index released); and a sale via `deplete_for_order_item` never resurrecting the voided row.

## Task Commits

1. **Task 1: Author open_open_unit, correct_open_unit, and void_open_unit** - `9513cf9` (feat)
2. **Task 2 (test-authoring half only): open-unit-lifecycle integration test** - `55371b3` (test)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql` - the three lifecycle RPCs; authored, committed, **not pushed to the remote project**
- `src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts` - full RBAC/D-08/audit-trail coverage; authored, committed, **not executed** (requires the migration above to be live first)

## Decisions Made

- See `key-decisions` in the frontmatter: (1) reason-merge into `correct_open_unit`'s audit `after` payload for full T-27-10 recoverability, and (2) the test-ordering swap between the plan's literal items 6 and 7 to avoid a self-contradictory assertion pair given the plan's own fixture quantities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Merged the correction reason into `correct_open_unit`'s audit `after` payload**
- **Found during:** Task 1 authoring, while working through the `record_audit` call for `correct_open_unit`.
- **Issue:** The plan's spec has `correct_open_unit` set `closed_reason` on the row only when the corrected count reaches zero. For any non-zero correction (the common case — "recounted, it's actually 5 not 20"), the supplied `p_reason` would not be stored anywhere, making it unrecoverable from `audit_logs` even though the whole point of requiring a non-blank reason is T-27-10's audit-trail completeness.
- **Fix:** `record_audit('open_unit.correct', ..., v_after || jsonb_build_object('reason', p_reason), 'rpc')` — merges the reason into the after-payload sent to the audit function, without touching the table schema.
- **Files modified:** `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql`
- **Commit:** `9513cf9`

**2. [Rule 1 - Bug] Reordered two of Task 2's integration-test assertions**
- **Found during:** Task 2, while writing the test cases for the plan's items 6 ("freed product accepts a fresh open_open_unit call") and 7 ("a sale never resurrects the voided row").
- **Issue:** Run in the plan's literal order (item 7 before item 6's tail), the sale in item 7 would auto-open a fresh active `open_units` row via `consume_open_unit`'s nested auto-open logic (the fixture leaves 2 packages in `inventory` at that point), which would then make the following "fresh `open_open_unit` call succeeds" assertion in item 6 fail with a D-08 duplicate rejection instead of succeeding — the two assertions as literally sequenced cannot both pass against the plan's own fixture data.
- **Fix:** Swapped the order — the fresh manual `open_open_unit` call is tested first (proving the partial unique index released), then the sale test (proving the *voided* row specifically stays untouched, regardless of which unit the sale itself lands on).
- **Files modified:** `src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts`
- **Commit:** `55371b3`
- **Note:** Both invariants the plan cares about (index released; voided row never resurrected) are still fully asserted — only the *order* of the two test cases changed. This test has not been executed yet (see checkpoint below), so this is a design-time correction, not a debug-and-fix of an observed failure.

---

**Total deviations:** 2 (1 Rule 2 auto-add, 1 Rule 1 auto-fix), both isolated to the two files this plan created.
**Impact on plan:** No scope creep — both are small, defensible corrections inside the plan's own two artifacts. No production RPC behavior changed beyond the audit-payload reason merge.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

**Live push and integration-test execution are deferred to a human-reviewed checkpoint — see below.** No other external service configuration is required; this plan reuses the same pre-linked Supabase CLI session and environment variables established in plan 27-02.

## Next Phase Readiness

Not yet ready to hand off to 27-07/27-08 (the Open-Units tab UI) — those plans call these three RPCs as their write API, so the migration must be live on the remote project first. Once the human operator reviews and approves the migration SQL below and it is pushed (`npx supabase db push --yes` from `bar-pos/`), a follow-up session should: (1) confirm `npx supabase migration list` shows `20260729000005` in both LOCAL and REMOTE, (2) run `npx vitest run --reporter=dot src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts` and confirm all 8 tests pass, and (3) re-run `npm run test` to confirm no regressions — mirroring exactly how 27-02's equivalent checkpoint was resolved.

---

## CHECKPOINT: Human review required before live push

**No migration has been pushed to the remote Supabase Cloud project. No integration test has been executed against it.** Per the hard constraint governing this plan's execution, both are deliberately withheld pending human review of the SQL below.

### What to review

The full contents of `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql` (three `SECURITY DEFINER` functions: `open_open_unit`, `correct_open_unit`, `void_open_unit`) — reproduced here in full for review without needing to open the repo:

```sql
-- =============================================================================
-- Phase 27 (27-04): open_open_unit / correct_open_unit / void_open_unit
--
-- The three manual lifecycle RPCs the admin Open-Units tab drives. Unlike
-- consume_open_unit (27-02), which only auto-opens units as a side effect of
-- a sale, these are the client-callable write API for SC-3 ("staff can
-- manually open a new one") and D-10 ("correct the count / void a unit
-- early").
--
-- RBAC split (the security-relevant part of this migration):
--   - open_open_unit is bartender+ (D-11) — a high-frequency, low-risk action
--     at a busy bar, same guard shape as deplete_for_order_item.
--   - correct_open_unit / void_open_unit are manager+ (D-12) — both are stock
--     write-off vectors, same guard shape as process_refund. The client-side
--     ManagerPinDialog is UX only; the get_user_role() guard inside each
--     function body is the actual control (T-27-09).
--
-- open_open_unit deliberately takes no negative-stock-bypass parameter of any
-- kind: D-05 scopes that single override mechanism to the order-entry path,
-- where a manager PIN gate already exists, and a bypass here would be a
-- second override mechanism D-05 explicitly rejects (T-27-12).
--
-- All three go through record_audit()/audit_logs, never the legacy singular
-- audit_log table (27-RESEARCH.md Pitfall 1).
-- =============================================================================

-- UP:
BEGIN;

-- -----------------------------------------------------------------------
-- open_open_unit — bartender+ (D-11)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION open_open_unit(p_product_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_package int;
  v_qty_on_hand int;
  v_unit_id     uuid;
  v_existing    record;
  v_after       jsonb;
BEGIN
  IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: bartender or higher required to open a unit';
  END IF;

  SELECT units_per_package INTO v_per_package
  FROM   products
  WHERE  id = p_product_id;

  IF v_per_package IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: product % is not configured for open units', p_product_id;
  END IF;

  -- Lock the BOX product's inventory row before deciding whether a package
  -- is available. No bypass parameter exists here (see header note) — the
  -- manager-PIN-gated override lives on the order-entry path only.
  SELECT quantity_on_hand INTO v_qty_on_hand
  FROM   inventory
  WHERE  product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_qty_on_hand < 1 THEN
    RAISE EXCEPTION 'INVENTORY_NEGATIVE: no unopened package available for product %', p_product_id;
  END IF;

  -- Insert-then-catch (not look-then-insert): the partial unique index
  -- open_units_one_active_per_product decides, so two bartenders tapping
  -- simultaneously is race-proof by construction (D-07). The loser gets the
  -- friendly D-08 message with the live remaining count, not a silent
  -- auto-close of the existing unit.
  BEGIN
    INSERT INTO open_units (product_id, remaining_count, status, opened_by)
    VALUES (p_product_id, v_per_package, 'active', auth.uid())
    RETURNING id INTO v_unit_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM   open_units
    WHERE  product_id = p_product_id AND status = 'active';

    RAISE EXCEPTION 'DUPLICATE_ENTRY: an open unit already exists for this product (% remaining) — sell through it first', v_existing.remaining_count;
  END;

  -- Package decrement happens only after the insert succeeds — a rejected
  -- open must never consume a package (T-27-03).
  UPDATE inventory
  SET    quantity_on_hand = quantity_on_hand - 1,
         updated_at       = now()
  WHERE  product_id = p_product_id;

  SELECT to_jsonb(u) INTO v_after FROM open_units u WHERE u.id = v_unit_id;
  PERFORM record_audit('open_unit.open', 'open_unit', v_unit_id, NULL, v_after, 'rpc');

  RETURN v_unit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION open_open_unit(uuid) TO authenticated;

-- -----------------------------------------------------------------------
-- correct_open_unit — manager+ (D-12)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION correct_open_unit(
  p_open_unit_id    uuid,
  p_remaining_count int,
  p_reason          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit        record;
  v_per_package int;
  v_before      jsonb;
  v_after       jsonb;
BEGIN
  -- The client-side ManagerPinDialog is UX; this guard is the actual
  -- control (T-27-09) — a bartender calling this RPC directly must be
  -- rejected here, independent of any UI.
  IF get_user_role() NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
  END IF;

  -- A correction with no reason is exactly the unaudited-shrinkage hole
  -- T-27-10 covers.
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason is required';
  END IF;

  SELECT * INTO v_unit
  FROM   open_units
  WHERE  id = p_open_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: open unit % does not exist', p_open_unit_id;
  END IF;

  -- Correcting a closed unit would silently reopen stock.
  IF v_unit.status <> 'active' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: open unit % is not active', p_open_unit_id;
  END IF;

  SELECT units_per_package INTO v_per_package
  FROM   products
  WHERE  id = v_unit.product_id;

  IF p_remaining_count < 0 OR p_remaining_count > v_per_package THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: remaining count % is out of range 0..%', p_remaining_count, v_per_package;
  END IF;

  v_before := to_jsonb(v_unit);

  UPDATE open_units
  SET    remaining_count = p_remaining_count,
         updated_at      = now(),
         -- Freeing the partial unique index when corrected down to zero lets
         -- a fresh unit be opened for this product.
         status          = CASE WHEN p_remaining_count = 0 THEN 'exhausted' ELSE status END,
         closed_at       = CASE WHEN p_remaining_count = 0 THEN now() ELSE closed_at END,
         closed_by       = CASE WHEN p_remaining_count = 0 THEN auth.uid() ELSE closed_by END,
         closed_reason   = CASE WHEN p_remaining_count = 0 THEN 'corrected_to_zero' ELSE closed_reason END
  WHERE  id = p_open_unit_id;

  SELECT to_jsonb(u) INTO v_after FROM open_units u WHERE u.id = p_open_unit_id;

  -- Both the old and new counts must be recoverable from the audit row,
  -- which is why the before/after sandwich is mandatory here rather than
  -- optional. The supplied reason is merged into the after payload so it is
  -- recoverable even when the correction doesn't zero the unit out (in
  -- which case closed_reason on the row itself stays null).
  PERFORM record_audit(
    'open_unit.correct',
    'open_unit',
    p_open_unit_id,
    v_before,
    v_after || jsonb_build_object('reason', p_reason),
    'rpc'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION correct_open_unit(uuid, int, text) TO authenticated;

-- -----------------------------------------------------------------------
-- void_open_unit — manager+ (D-12)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION void_open_unit(
  p_open_unit_id uuid,
  p_reason       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit   record;
  v_before jsonb;
  v_after  jsonb;
BEGIN
  IF get_user_role() NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason is required';
  END IF;

  SELECT * INTO v_unit
  FROM   open_units
  WHERE  id = p_open_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: open unit % does not exist', p_open_unit_id;
  END IF;

  IF v_unit.status <> 'active' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: open unit % is not active', p_open_unit_id;
  END IF;

  v_before := to_jsonb(v_unit);

  -- D-10 frames voiding as abandoning a physically opened box (damage,
  -- miscount) — the package is already gone, so inventory is NOT credited
  -- back (T-27-11: doing so would fabricate stock).
  UPDATE open_units
  SET    status        = 'void',
         remaining_count = 0,
         closed_at     = now(),
         closed_by     = auth.uid(),
         closed_reason = p_reason,
         updated_at    = now()
  WHERE  id = p_open_unit_id;

  SELECT to_jsonb(u) INTO v_after FROM open_units u WHERE u.id = p_open_unit_id;

  PERFORM record_audit('open_unit.void', 'open_unit', p_open_unit_id, v_before, v_after, 'rpc');
END;
$$;

GRANT EXECUTE ON FUNCTION void_open_unit(uuid, text) TO authenticated;

COMMIT;

-- =============================================================================
-- DOWN:
-- BEGIN;
-- DROP FUNCTION IF EXISTS open_open_unit(uuid);
-- DROP FUNCTION IF EXISTS correct_open_unit(uuid, int, text);
-- DROP FUNCTION IF EXISTS void_open_unit(uuid, text);
-- COMMIT;
-- =============================================================================
```

### How to verify (once approved)

1. From `bar-pos/`, run `npx supabase db push --yes`.
2. Confirm with `npx supabase migration list` that `20260729000005` appears in both LOCAL and REMOTE.
3. Run `npx vitest run --reporter=dot src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts` and confirm all 8 tests pass.
4. Re-run `npm run test` to confirm no regressions in the broader unit suite.

### Awaiting

Human review and explicit approval to proceed with the live push, exactly as was done for plan 27-02's equivalent checkpoint (resolved at commit `b4e7153` → `6961c4f` in that plan's history).

---

## Self-Check: PASSED

- `supabase/migrations/20260729000005_open_unit_lifecycle_rpcs.sql` — FOUND
- `src/entities/open-unit/model/open-unit-lifecycle.integration.test.ts` — FOUND
- Commit `9513cf9` — FOUND in `git log --oneline`
- Commit `55371b3` — FOUND in `git log --oneline`
- `npx vitest run --project unit --reporter=dot src/shared/lib/__tests__/audit-actions.test.ts` — 13/13 passed — CONFIRMED
- `npm run typecheck` — clean — CONFIRMED
- `npm run lint` — clean — CONFIRMED
- `npm run test` (project unit, excludes all `*.integration.test.ts`) — 145 files passed, 2 skipped, 1331 tests passed, 15 todo, 0 failed — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-30 (checkpoint — awaiting human review before live push)*
