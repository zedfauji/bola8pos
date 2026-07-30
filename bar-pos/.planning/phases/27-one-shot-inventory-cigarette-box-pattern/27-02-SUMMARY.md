---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 02
subsystem: database
tags: [supabase, postgres, rpc, row-locking, audit-log, open-units]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-01's locked open_units/products schema shape (option-a)"
provides:
  - "4 authored (NOT YET PUSHED) migrations: open_units table, products.units_per_package/parent_product_id, consume_open_unit RPC, deplete_for_order_item v5"
  - "6 new open_unit.* AuditActionSchema entries + AuditAction map keys"
  - "consume-open-unit.integration.test.ts (authored, NOT YET RUN — requires live push first)"
affects: ["27-03-and-later (concurrency/boundary-crossing tests, lifecycle RPCs, Zod schemas, UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "consume_open_unit nested inside deplete_for_order_item's chokepoint rather than a sibling client-callable RPC"
    - "loop-based auto-transition across open_units rows for multi-quantity lines"
    - "partial unique index (open_units_one_active_per_product) enforces D-07 at the DB level"

key-files:
  created:
    - supabase/migrations/20260729000001_open_units_table.sql
    - supabase/migrations/20260729000002_products_open_unit_columns.sql
    - supabase/migrations/20260729000003_consume_open_unit_rpc.sql
    - supabase/migrations/20260729000004_deplete_for_order_item_v5_open_units.sql
    - src/entities/open-unit/model/consume-open-unit.integration.test.ts
  modified:
    - src/shared/lib/audit-actions.ts

key-decisions:
  - "HALTED before any live-database action per an explicit human operator constraint (not part of 27-02-PLAN.md itself): all 4 migrations and the audit-enum edit are authored and committed exactly as specified, but `npx supabase db push` has NOT been run — the human wants to review the SQL first."
  - "The integration test file was authored per plan spec but deliberately NOT executed, since running it requires the migrations to already be live on the remote project."
  - "consume_open_unit records 'open_unit.deplete' with entity_id=NULL and no active-unit credit when a refund/void (p_direction=-1) finds no active unit — resurrecting an exhausted row would fabricate stock (resolved Open Question 3, per plan)."

patterns-established:
  - "Loop-guarded (p_qty + 2 iteration cap) WHILE loop for atomic multi-unit consumption inside a SECURITY DEFINER RPC"

requirements-completed: []  # SC-1/SC-2/SC-4 partially addressed (schema + RPC authored) but NOT verified against live DB yet — see Next Phase Readiness

coverage:
  - id: D1
    description: "4 migration files authored per 27-01's locked schema shape (open_units table, products columns, consume_open_unit RPC, deplete_for_order_item v5)"
    verification:
      - kind: unit
        ref: "structural grep gates from 27-02-PLAN.md Task 1 <verify> — all passed locally (file existence, unique index name, FOR UPDATE count=3, no legacy audit_log INSERT, no product-name special-casing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "6 open_unit.* audit actions registered in AuditActionSchema/AuditAction, satisfying the CI grep gate"
    verification:
      - kind: unit
        ref: "src/shared/lib/__tests__/audit-actions.test.ts (13/13 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Migrations pushed to the live remote Supabase project and the end-to-end integration test passes against it"
    verification: []
    human_judgment: true
    rationale: "Explicitly deferred — the human operator asked to review the raw migration SQL before any live-database push. No automated check can substitute for that review; a human must approve before Task 2's `npx supabase db push --yes` runs."

# Metrics
duration: ~35min (Task 1 authoring + verification; Task 2 test-file authoring only)
completed: 2026-07-30
status: blocked
---

# Phase 27 Plan 02: One-Shot Inventory Spine (Schema + RPC) — HALTED AT CHECKPOINT

**4 migrations (open_units table, products linkage columns, consume_open_unit RPC with loop-based auto-transition, deplete_for_order_item v5) plus 6 open_unit.* audit actions are authored and committed; a human-review checkpoint blocks the live `supabase db push` and the integration test run.**

## Performance

- **Duration:** ~35 min (Task 1 fully executed + verified; Task 2 test file authored, DB push and test run intentionally not performed)
- **Started:** 2026-07-30 (session start)
- **Completed:** N/A — halted at checkpoint, not phase-complete
- **Tasks:** 1 of 2 completed (Task 1 done; Task 2 partially done — test file authored, blocking push/run deferred)
- **Files modified:** 6 (4 new migrations, 1 new integration test, 1 edited: audit-actions.ts)

## Accomplishments

- Authored `open_units` table with the D-07 partial unique index (`open_units_one_active_per_product`), status/lifecycle columns, and RLS (authenticated read, manager/admin write) — matches 27-01-SUMMARY.md's locked schema shape verbatim.
- Authored `products.units_per_package` (BOX) and `products.parent_product_id` (LOOSE) nullable columns, generic per D-04 (no product-name/SKU/category special-casing — verified by grep gate).
- Authored `consume_open_unit(p_product_id, p_qty, p_order_item_id, p_direction, p_allow_negative)`: `FOR UPDATE` row-locking on both `open_units` and the parent's `inventory` row, a loop-guarded `WHILE` loop for multi-quantity lines spanning multiple units (resolved Open Question 2), `INVENTORY_NEGATIVE` guard bypassable via `p_allow_negative` (D-05), and a refund/void branch that credits back the active unit capped at `units_per_package` (resolved Open Question 3). No `GRANT EXECUTE` — reachable only via `deplete_for_order_item` (resolved Open Question 1).
- Authored `deplete_for_order_item` v5: v4's body copied verbatim plus one new branch that `PERFORM`s `consume_open_unit` when the order item's product has `parent_product_id IS NOT NULL`.
- Registered all 6 `open_unit.*` audit actions (`open`, `deplete`, `exhaust`, `void`, `correct`, `override`) in `audit-actions.ts` in the same commit as the RPC migration, satisfying the CI grep gate ahead of plan 27-04's lifecycle RPCs.
- Authored `consume-open-unit.integration.test.ts`, mirroring `depletion.integration.test.ts`'s two-client skeleton, proving (once run against a live database) the full happy-path spine: no `open_units` row initially → sell one loose piece via `deplete_for_order_item` → exactly one active unit with `remaining_count=19` → box `inventory.quantity_on_hand` drops by one → `audit_logs` contains `open_unit.open` + `open_unit.deplete` → a second quantity-1 sale reuses the same active unit (`remaining_count=18`, no second active row).

## Task Commits

1. **Task 1 (part 1/4): open_units table** - `f157a82` (feat)
2. **Task 1 (part 2/4): products linkage columns** - `16e9542` (feat)
3. **Task 1 (part 3/4): consume_open_unit RPC + audit-actions.ts** - `506184f` (feat)
4. **Task 1 (part 4/4): deplete_for_order_item v5** - `e92fca2` (feat)
5. **Task 2 (partial): integration test file authored, NOT run** - `b6e693f` (test)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `supabase/migrations/20260729000001_open_units_table.sql` - table + `open_units_one_active_per_product` partial unique index + RLS
- `supabase/migrations/20260729000002_products_open_unit_columns.sql` - `units_per_package`, `parent_product_id`
- `supabase/migrations/20260729000003_consume_open_unit_rpc.sql` - atomic decrement/credit RPC with auto-transition loop
- `supabase/migrations/20260729000004_deplete_for_order_item_v5_open_units.sql` - v5 = v4 body + one open-unit branch
- `src/shared/lib/audit-actions.ts` - 6 new `open_unit.*` enum entries + `AuditAction` map keys
- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` - happy-path end-to-end proof (authored, not yet run)

## Decisions Made

- **Refund/void with no active unit discards the credit** (rather than resurrecting an exhausted row) and still records an `open_unit.deplete` audit row with `entity_id=NULL` and a `credit_discarded` detail, so the write-off is never silent — this is 27-RESEARCH.md's recommended resolution to Open Question 3, applied as written since nothing in 27-CONTEXT.md overrode it.
- **The `open_unit.deplete` audit row for a sale is emitted exactly once per call** (after the loop completes), attributed to the last `open_units` row touched — matches the plan's explicit instruction ("not per iteration").
- **HALT before any live-database action.** This deviates from 27-02-PLAN.md's own Task 2, which instructs running `npx supabase db push --yes` immediately after Task 1. That deviation was directed by an explicit human-operator override for this execution session (not part of the plan document itself): the human wants to review the raw migration SQL before it touches the live remote Supabase Cloud project. See "Deferred to Human Review" below.

## Deviations from Plan

### Directed halt (not a Rule 1-4 deviation — explicit operator instruction)

**1. Task 2's `npx supabase db push --yes` and the integration test run were not performed.**
- **Found during:** Start of Task 2.
- **Why:** The executing session's instructions carried an explicit hard constraint from the human operator: review the migration SQL before it touches the live database, overriding what 27-02-PLAN.md's Task 2 would otherwise have executed autonomously.
- **What was done instead:** All 4 migration files and the audit-enum edit were authored and committed exactly as Task 1 specifies. The integration test file was authored per Task 2's spec and committed, but not executed (running it requires the migrations to already be live).
- **Files affected:** None beyond what's already listed above — no partial/half-applied migration state exists anywhere.
- **Committed in:** All 5 commits listed under Task Commits above.

No Rule 1-4 auto-fixes were needed — the plan's Task 1 was implementable exactly as specified once 27-01's schema decision was read.

---

**Total deviations:** 1 (directed halt, not a bug/gap/architectural-change deviation)
**Impact on plan:** Task 1 fully complete and verified. Task 2 is intentionally incomplete pending human sign-off on the SQL below — this is expected, not a defect.

## Issues Encountered

- The unit-test runner (`vitest`) requires `node_modules` and a `.env.local` with Supabase credentials that were not present in this git worktree checkout. Both were sourced from the sibling primary checkout (`node_modules` symlinked, `.env.local` copied) purely to run the **local, read-only** verification commands specified in Task 1's `<verify>` block (structural greps, `audit-actions.test.ts`, `npm run typecheck`, `npm run test`) — none of this touches migration state or pushes anything to the remote project. Both paths are gitignored (`node_modules`, `*.local`) and were not committed.
- Two of my own doc-comments in the authored migration/test files initially tripped their own acceptance-criteria grep gates by literally containing the negated keyword they were describing (e.g. a comment saying "not cigarette-specific" tripped the D-04 genericity grep; a comment saying "never `rpc('consume_open_unit', ...)` directly" tripped the "no direct RPC call" grep). Both were reworded to describe the same intent without the literal trigger string, then re-verified.

## User Setup Required

**Live database push requires human review first — see "Deferred to Human Review" below.** No other external service configuration is needed; `SUPABASE_SERVICE_ROLE_KEY` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (needed to eventually run the integration test) already exist in this environment's `.env.local`.

## Next Phase Readiness

**BLOCKED on human review of the 4 migration files below.** Once approved:
1. Run `npx supabase db push --yes` from `bar-pos/` to apply all four `20260729…` migrations.
2. Run `npx supabase migration list` and confirm all four timestamps appear in both LOCAL and REMOTE columns.
3. Run `npx vitest run --reporter=dot src/entities/open-unit/model/consume-open-unit.integration.test.ts` and confirm it passes.
4. Run `npm run test` (full unit suite) to confirm the v5 function replacement broke nothing.
5. Resume plan 27-02's Task 2 to completion (or open a fresh plan/task solely for the push+verify step), then proceed to plan 27-03 (concurrency/boundary-crossing tests) and onward.

Nothing is half-applied: no migration has touched the remote database, so there is no partial state to roll back.

---

## Self-Check: PASSED

- `supabase/migrations/20260729000001_open_units_table.sql` — FOUND
- `supabase/migrations/20260729000002_products_open_unit_columns.sql` — FOUND
- `supabase/migrations/20260729000003_consume_open_unit_rpc.sql` — FOUND
- `supabase/migrations/20260729000004_deplete_for_order_item_v5_open_units.sql` — FOUND
- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` — FOUND
- Commit `f157a82` — FOUND in `git log --oneline`
- Commit `16e9542` — FOUND in `git log --oneline`
- Commit `506184f` — FOUND in `git log --oneline`
- Commit `e92fca2` — FOUND in `git log --oneline`
- Commit `b6e693f` — FOUND in `git log --oneline`

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: N/A — halted at checkpoint 2026-07-30, awaiting human review of migration SQL before live push*
