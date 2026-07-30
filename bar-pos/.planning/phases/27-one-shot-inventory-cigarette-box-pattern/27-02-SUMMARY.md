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
  - "4 migrations LIVE on the remote bar-pos Supabase Cloud project: open_units table, products.units_per_package/parent_product_id, consume_open_unit RPC, deplete_for_order_item v5"
  - "6 new open_unit.* AuditActionSchema entries + AuditAction map keys"
  - "consume-open-unit.integration.test.ts — green against the live remote schema"
affects: ["27-03-and-later (concurrency/boundary-crossing tests, lifecycle RPCs, Zod schemas, UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "consume_open_unit nested inside deplete_for_order_item's chokepoint rather than a sibling client-callable RPC"
    - "loop-based auto-transition across open_units rows for multi-quantity lines"
    - "partial unique index (open_units_one_active_per_product) enforces D-07 at the DB level"
    - "persistSession: false / autoRefreshToken: false on both service-role and anon integration-test clients, to prevent GoTrueClient storage-key collision (same-project clients otherwise share a session and silently swap the service-role Authorization header)"

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
  - "Human operator explicitly reviewed the 4 migration SQL files and approved proceeding with the live push to Supabase Cloud, resolving the human-verify checkpoint that halted this plan at commit b4e7153."
  - "consume_open_unit records 'open_unit.deplete' with entity_id=NULL and no active-unit credit when a refund/void (p_direction=-1) finds no active unit — resurrecting an exhausted row would fabricate stock (resolved Open Question 3, per plan)."
  - "Fixed a latent RLS-bypass bug in the integration test's own client setup (Rule 1 auto-fix, found while running this plan's own new test): the service-role `db` client and the `anonClient` shared the same default GoTrueClient storage key, so after anonClient signed in as a bartender-role test user, db's Authorization header was silently swapped to that session and its fixture insert into `products` failed products_insert_manager_admin RLS. Fixed by passing `{ auth: { persistSession: false, autoRefreshToken: false } }` to both clients, mirroring the existing pattern in locale-rls.integration.test.ts. This is scoped to the file this plan authored; the pre-existing depletion.integration.test.ts has the same latent client construction but never tripped it (its test role is 'manager', which has product-write access) and is out of scope to fix here."

patterns-established:
  - "Loop-guarded (p_qty + 2 iteration cap) WHILE loop for atomic multi-unit consumption inside a SECURITY DEFINER RPC"

requirements-completed: [SC-1, SC-2, SC-4]

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
    verification:
      - kind: integration
        ref: "npx supabase migration list — all four 20260729000001-20260729000004 timestamps present in both LOCAL and REMOTE columns; npx vitest run src/entities/open-unit/model/consume-open-unit.integration.test.ts — 1 passed, 0 failed"
        status: pass
    human_judgment: true
    rationale: "Human operator reviewed the raw migration SQL and explicitly approved the live push before this task ran (see key-decisions)."

# Metrics
duration: ~35min (Task 1, prior session) + ~30min (this session: push + debug + fix + full regression)
completed: 2026-07-30
status: complete
---

# Phase 27 Plan 02: One-Shot Inventory Spine (Schema + RPC) Summary

**4 migrations (open_units table, products linkage columns, consume_open_unit RPC with loop-based auto-transition, deplete_for_order_item v5) plus 6 open_unit.* audit actions are live on the remote Supabase Cloud project, proven end-to-end by a green integration test: selling one loose piece through the real deplete_for_order_item chokepoint auto-opens a package, decrements the open unit, decrements package stock, and writes both audit rows.**

## Performance

- **Duration:** ~35 min (prior session: Task 1 authoring + verification, Task 2 test-file authoring) + ~30 min (this session: link + push + integration-test debug/fix + full regression suite)
- **Completed:** 2026-07-30
- **Tasks:** 2 of 2 complete
- **Files modified:** 7 total across the plan (4 new migrations, 1 new integration test, 1 edited: audit-actions.ts; the integration test received one follow-up fix commit in this session)

## Accomplishments

- Authored `open_units` table with the D-07 partial unique index (`open_units_one_active_per_product`), status/lifecycle columns, and RLS (authenticated read, manager/admin write) — matches 27-01-SUMMARY.md's locked schema shape verbatim.
- Authored `products.units_per_package` (BOX) and `products.parent_product_id` (LOOSE) nullable columns, generic per D-04 (no product-name/SKU/category special-casing — verified by grep gate).
- Authored `consume_open_unit(p_product_id, p_qty, p_order_item_id, p_direction, p_allow_negative)`: `FOR UPDATE` row-locking on both `open_units` and the parent's `inventory` row, a loop-guarded `WHILE` loop for multi-quantity lines spanning multiple units (resolved Open Question 2), `INVENTORY_NEGATIVE` guard bypassable via `p_allow_negative` (D-05), and a refund/void branch that credits back the active unit capped at `units_per_package` (resolved Open Question 3). No `GRANT EXECUTE` — reachable only via `deplete_for_order_item` (resolved Open Question 1).
- Authored `deplete_for_order_item` v5: v4's body copied verbatim plus one new branch that `PERFORM`s `consume_open_unit` when the order item's product has `parent_product_id IS NOT NULL`.
- Registered all 6 `open_unit.*` audit actions (`open`, `deplete`, `exhaust`, `void`, `correct`, `override`) in `audit-actions.ts` in the same commit as the RPC migration, satisfying the CI grep gate ahead of plan 27-04's lifecycle RPCs.
- **Linked this worktree's `supabase` CLI session to the remote `bar-pos` project** (`npx supabase link --project-ref shsrhxleopmovzpzqmex`) — the worktree checkout had no local `supabase/.temp` link state (gitignored, per-checkout), even though the global CLI login (`~/.supabase`) was already authenticated.
- **Pushed all 4 phase-27 migrations to the live remote Supabase Cloud project** (`npx supabase db push --yes`) — human-approved per the resolved checkpoint. Confirmed via `npx supabase migration list`: all four `20260729000001`-`20260729000004` timestamps present in both LOCAL and REMOTE columns.
- **Diagnosed and fixed a latent bug in the integration test's own client setup** that caused an RLS failure (`42501`) on the fixture's `products` insert: the service-role `db` client and `anonClient` shared the same default GoTrueClient storage key against this project URL; after `anonClient.auth.signInWithPassword()` (bartender role) fired, `db`'s Authorization header was silently swapped to that session, so the box-product insert ran as bartender (no product-write RLS grant) instead of service_role. Fixed by disabling `persistSession`/`autoRefreshToken` on both clients — the same pattern already established in `locale-rls.integration.test.ts`. Root-caused via an isolated reproduction test (single insert with a bare service-role client passed; the full `beforeAll` sequence with sign-in reproduced the failure) rather than guessing.
- **Ran the integration test green** against the live remote schema: no `open_units` row initially -> sell one loose piece through `deplete_for_order_item` -> exactly one active unit (`remaining_count=19`, non-null `opened_by`/`opened_at`) -> box `inventory.quantity_on_hand` drops from 2 to 1 -> `audit_logs` contains `open_unit.open` + `open_unit.deplete` (both `source='rpc'`, non-null actor) -> a second quantity-1 sale reuses the same active unit (`remaining_count=18`, no second active row).
- **Ran the full unit suite** (`npm run test`): 145 test files passed, 2 skipped, 1331 tests passed, 15 todo — zero failures, confirming the v5 `deplete_for_order_item` replacement broke no existing depletion test.
- **Ran `npm run typecheck`**: clean, after the integration-test client-options edit.

## Task Commits

1. **Task 1 (part 1/4): open_units table** - `f157a82` (feat)
2. **Task 1 (part 2/4): products linkage columns** - `16e9542` (feat)
3. **Task 1 (part 3/4): consume_open_unit RPC + audit-actions.ts** - `506184f` (feat)
4. **Task 1 (part 4/4): deplete_for_order_item v5** - `e92fca2` (feat)
5. **Task 2 (part 1/2): integration test authored** - `b6e693f` (test)
6. **Checkpoint-halt SUMMARY (prior session)** - `b4e7153` (docs)
7. **Task 2 (part 2/2): fix RLS session-hijacking bug in integration test clients** - `6961c4f` (fix)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `supabase/migrations/20260729000001_open_units_table.sql` - table + `open_units_one_active_per_product` partial unique index + RLS
- `supabase/migrations/20260729000002_products_open_unit_columns.sql` - `units_per_package`, `parent_product_id`
- `supabase/migrations/20260729000003_consume_open_unit_rpc.sql` - atomic decrement/credit RPC with auto-transition loop
- `supabase/migrations/20260729000004_deplete_for_order_item_v5_open_units.sql` - v5 = v4 body + one open-unit branch
- `src/shared/lib/audit-actions.ts` - 6 new `open_unit.*` enum entries + `AuditAction` map keys
- `src/entities/open-unit/model/consume-open-unit.integration.test.ts` - happy-path end-to-end proof, now green against the live schema; client construction hardened against session-hijacking

## Decisions Made

- **Refund/void with no active unit discards the credit** (rather than resurrecting an exhausted row) and still records an `open_unit.deplete` audit row with `entity_id=NULL` and a `credit_discarded` detail, so the write-off is never silent — this is 27-RESEARCH.md's recommended resolution to Open Question 3, applied as written since nothing in 27-CONTEXT.md overrode it.
- **The `open_unit.deplete` audit row for a sale is emitted exactly once per call** (after the loop completes), attributed to the last `open_units` row touched — matches the plan's explicit instruction ("not per iteration").
- **The prior session's checkpoint halt (documented in the earlier version of this SUMMARY) was resolved this session**: the human operator reviewed the four migration SQL files and explicitly approved proceeding with `npx supabase db push --yes` against the live Supabase Cloud project, including the integration test run against the now-live schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed RLS-bypass session hijacking in the integration test's own client construction**
- **Found during:** Task 2, first run of the integration test against the newly-live schema.
- **Issue:** `consume-open-unit.integration.test.ts`'s service-role `db` client and `anonClient` were both constructed with default auth options, causing them to share the same GoTrueClient storage key for this project URL. After `anonClient.auth.signInWithPassword()` (signing in as a freshly-created bartender-role test user), `db`'s Authorization header was silently swapped to that user's session token. The subsequent `db.from('products').insert(...)` fixture call for the BOX product therefore ran as bartender, not service_role, and was rejected by `products_insert_manager_admin` RLS (error `42501`).
- **Fix:** Passed `{ auth: { persistSession: false, autoRefreshToken: false } }` to both `createClient` calls, matching the established pattern in `src/entities/staff/model/locale-rls.integration.test.ts`.
- **Files modified:** `src/entities/open-unit/model/consume-open-unit.integration.test.ts`
- **Commit:** `6961c4f`
- **Note:** `depletion.integration.test.ts` has the identical latent client-construction pattern but never surfaced the bug because its test fixture uses a `manager`-role test user, which does have `products` write access — that pre-existing file is unchanged, out of scope per the scope-boundary rule (the bug is not caused by this plan's changes to that file, since this plan didn't touch it).

No other Rule 1-4 auto-fixes were needed.

---

**Total deviations:** 1 (Rule 1 auto-fixed bug, found and fixed while running this plan's own new test)
**Impact on plan:** None on scope or schema — the fix was isolated to test-client construction in the file this plan authored; no production migration or RPC code was touched.

## Issues Encountered

- The worktree checkout had no local Supabase CLI project link (`supabase/.temp/project-ref` is gitignored, per-checkout state) even though the global CLI login was already authenticated against the same account used by the primary checkout. Resolved with `npx supabase link --project-ref shsrhxleopmovzpzqmex` (read from `npx supabase projects list`, which listed the `bar-pos` project under the already-authenticated org) before the push would proceed.
- See "Deviations from Plan" above for the RLS session-hijacking bug found and fixed in the integration test itself.

## User Setup Required

None remaining. All previously-deferred live-database action (the `supabase db push` and integration test run) is now complete, human-approved, and verified.

## Next Phase Readiness

Plan 27-02 is complete. The spine (`open_units` table, `products` linkage columns, `consume_open_unit`, `deplete_for_order_item` v5) is live on the remote `bar-pos` Supabase Cloud project and proven end-to-end by a green integration test. Ready to proceed to plan 27-03 (concurrency/boundary-crossing tests) and onward — those plans can now write against the live schema without any further migration-push gating.

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
- Commit `b4e7153` — FOUND in `git log --oneline`
- Commit `6961c4f` — FOUND in `git log --oneline`
- `npx supabase migration list` — all four `20260729…` timestamps present in both LOCAL and REMOTE columns — CONFIRMED
- `npx vitest run src/entities/open-unit/model/consume-open-unit.integration.test.ts` — 1 passed, 0 failed — CONFIRMED
- `npm run test` — 145 files passed, 2 skipped, 1331 tests passed, 15 todo, 0 failed — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-30*
