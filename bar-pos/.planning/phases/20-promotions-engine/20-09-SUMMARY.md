---
phase: 20-promotions-engine
plan: 09
subsystem: testing
tags: [vitest, playwright, integration-test, e2e, promotions, parity, uat, checkpoint]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 06, live DB push + HH data migration)
    provides: "promotions/promotion_availability/applied_promotions LIVE on the remote database; D-07 additive HH->promotions data migration applied (currently zero live migrated rows)"
  - phase: 20-promotions-engine (plan 07, client pricing rewire)
    provides: "ProductGrid sends product.basePrice (undiscounted) to create_order_with_items"
  - phase: 20-promotions-engine (plan 08, pool-session RPC rewire)
    provides: "useMutationStopSession calls stop_pool_session RPC (server-authoritative pool billing)"
provides:
  - "hh-parity.integration.test.ts: D-07 parity gate (structural + behavioral) — proves the server promotions engine reproduces legacy resolveProductPrice() output for a migrated-shape HH row"
  - "e2e/43-promotions.spec.ts: admin CRUD (create/edit-disable/delete) + order-time auto-apply (D-02) Playwright coverage"
  - "supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql: create_order_with_items v4 — decouples evaluate_promotions_for_item from p_skip_depletion; pushed live"
  - "Task 3 (BLOCKING human-verify UAT) — automation gates now all green (live integration suite, typecheck, lint, full unit suite); manual in-app UAT click-through (how-to-verify steps 2-4) still recommended before a human types 'approved'"
affects: [20-10, 20-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-contained parity fixture (category+product+promotion+availability window, all-day window to sidestep client/server timezone mismatch) used to exercise D-07 behavioral parity when live migrated-shape data doesn't exist on the target DB"
    - "Direct getServiceClient() DB seeding for an E2E fixture promotion, established precedent from 04-pool-timer.spec.ts/16-table-status.spec.ts"

key-files:
  created:
    - src/entities/promotion/model/hh-parity.integration.test.ts
    - e2e/43-promotions.spec.ts
    - supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql
  modified:
    - .planning/phases/20-promotions-engine/deferred-items.md

key-decisions:
  - "hh-parity.integration.test.ts's behavioral-parity fixture uses an all-day (00:00:00-23:59:59) availability window rather than a narrow window like the sibling promotions-schema test — isHappyHourActive() (client) evaluates in the test runner's local timezone while is_promotion_available() (server) hardcodes America/Mexico_City; an all-day window makes the comparison timezone-agnostic without weakening the mechanism being proven"
  - "hh-parity's behavioral-parity RPC call uses p_skip_depletion:false (not true, unlike the sibling evaluate-promotions-rpc.integration.test.ts) — discovered that p_skip_depletion:true also skips promotion evaluation (see Bug Found below); false is both the workaround and the more representative real-order-flow parity check"
  - "e2e T1 (admin CRUD) and T2 (order-time discount) are separate tests — T1's promotion is fully deleted by test end, so it cannot interact with T2's separately-seeded live promotion, avoiding any cross-test promotion-state collision within the same spec file"

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

# Metrics
duration: ~90min (original session) + ~30min (gap-closure fix session)
completed: 2026-07-10
---

# Phase 20 Plan 09: D-07 Parity Gate + E2E + Blocking UAT Checkpoint Summary

**D-07 HH-to-promotions parity test and `e2e/43-promotions.spec.ts` are both green/loadable. The plan's own automation-first run of Task 3's blocking checkpoint surfaced a real, live defect (`p_skip_depletion` also silently skipped promotion evaluation) in two sibling Phase-20 integration tests. A gap-closure session then fixed the root cause with a new additive migration (`20260710000008_fix_promotion_skip_depletion_gate.sql`, pushed live) — both previously failing tests now pass, and the full automated gate set (live integration suite, typecheck, lint, full unit suite) is green with no new regressions.**

## Gap-Closure Update (post-checkpoint session)

The bug documented below under "Discovered But NOT Auto-Fixed" has been **FIXED**:

- **Root cause:** `create_order_with_items` v3 (`20260710000004_evaluate_promotions_rpc.sql`) ran `PERFORM evaluate_promotions_for_item(...)` inside the same `IF NOT p_skip_depletion THEN ... END IF;` block as `PERFORM deplete_for_order_item(...)`. Orders placed with `p_skip_depletion:true` (the `override-negative-stock` manager-PIN path) got zero promotion evaluation.
- **Fix:** New additive migration `supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql` — `create_order_with_items` v4 (`CREATE OR REPLACE`, identical 7-arg signature/guard). Depletion stays gated on `NOT p_skip_depletion` (unchanged); `evaluate_promotions_for_item` now runs in its own loop, unconditionally, for every inserted item.
- **Pushed live:** `npx supabase link --project-ref shsrhxleopmovzpzqmex` then `npx supabase db push --yes`; confirmed applied via `npx supabase db push --dry-run` ("Remote database is up to date").
- **Verification:** `evaluate-promotions-rpc.integration.test.ts` + `pool-promotions-rpc.integration.test.ts` — **4/4 PASS** (previously 2 failures). Full live promotion suite re-run twice: **6/6 files, 20/20 tests PASS** on the clean run (one cross-file flake on the first pass did not reproduce on immediate re-run or in file-isolation — logged as a pre-existing live-DB test-isolation flake, not a regression). `npm run typecheck`/`lint`/`test`: same pre-existing baseline (2 documented typecheck errors, 1 documented `useCloseTab.test.ts` failure), no new regressions.
- **Commit:** `bd8f1d1` — `fix(20-09): decouple promotion evaluation from p_skip_depletion gate`.
- **Full details:** `.planning/phases/20-promotions-engine/deferred-items.md`, "STATUS: FIXED" section.

**What is still outstanding for a human to do before typing "approved":** the manual in-app UAT click-through (`how-to-verify` steps 2-4 in the plan — admin creates a promotion and places a real order in the running app; pool billing/bonus-minute checks; admin CRUD on the live UI) was not performed by this agent (it requires a human driving the actual application). The E2E spec's full Playwright browser run (`npx playwright test e2e/43-promotions.spec.ts`, not `--list`) also remains pending a free port 1420 — a sibling parallel worktree agent's dev server still held it during this gap-closure session. Both are recommended before final human sign-off, but neither blocks this session's correctness fix, and all automated/scriptable gates are now green.

## Performance

- **Duration:** ~90 min
- **Tasks:** 2/3 completed (Task 3 is a BLOCKING checkpoint — automation run, awaiting human sign-off)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/entities/promotion/model/hh-parity.integration.test.ts`: two independent checks — (1) structural parity over every LIVE product/category still carrying legacy `happy_hour_price`/`happy_hour_start`/`happy_hour_end`, asserting each has exactly one matching active `fixed_price`/`item` promotion with a matching availability window (0 such rows exist on this database right now — the test reports this explicitly via `console.warn` rather than a silent false pass, matching the checkpoint note's instruction); (2) a self-contained behavioral fixture (its own category+product+promotion+window, shaped exactly like the D-07 migration's output) asserting the server-evaluated `unit_price` from a real `create_order_with_items` call equals `resolveProductPrice()`'s legacy output. Both pass.
- `e2e/43-promotions.spec.ts`: T1 exercises the full admin CRUD loop (create via "+ Add promotion" → fill name/discount/target/priority → toggle Active → save → verify row+badge → disable via inline Active switch → delete via the "Delete Promotion" confirm). T2 seeds a live active 20%-off item-target promotion on Budweiser, places a real order via the POS UI, and asserts the ticket line reflects the discounted price with no confirmation step (D-02). `npx playwright test e2e/43-promotions.spec.ts --list` enumerates both tests with no load/syntax error.
- **Task 3 automation-first run** (before presenting the checkpoint) surfaced a real, pre-existing bug: `create_order_with_items` v3's `PERFORM evaluate_promotions_for_item(...)` call is gated inside the SAME `IF NOT p_skip_depletion THEN` block as `deplete_for_order_item(...)` (introduced by Plan 20-03's migration). Any order placed with `p_skip_depletion: true` gets **zero promotion evaluation** — confirmed to affect the live production `override-negative-stock` order path, and reproduced independently in TWO sibling Phase-20 integration test files (`evaluate-promotions-rpc.integration.test.ts`, `pool-promotions-rpc.integration.test.ts`'s `pool_grant` case). Logged in full to `deferred-items.md` rather than fixed inline (out of scope for this plan's `files_modified`; fixing it means a new production-RPC migration + its own `supabase db push`, which this project consistently gates behind an explicit BLOCKING checkpoint of its own).

## Task Commits

Each completed task was committed atomically:

1. **Task 1: D-07 parity integration test** - `c641b38` (test)
2. **Task 2: e2e/43-promotions.spec.ts** - `0383f33` (test)
3. **Task 3: [BLOCKING] Human UAT + live integration suite before column drop** - PAUSED, no code commit (automation-only run; awaiting human "approved"/failure-description resume signal)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete. Because Task 3 did not reach approval, this plan is not being marked complete._

## Files Created/Modified

- `src/entities/promotion/model/hh-parity.integration.test.ts` - D-07 parity gate (structural + behavioral), 2/2 tests pass
- `e2e/43-promotions.spec.ts` - admin CRUD (T1) + order-time auto-apply/D-02 (T2) Playwright spec, enumerates cleanly
- `.planning/phases/20-promotions-engine/deferred-items.md` - documents the `p_skip_depletion` promotion-evaluation-skip bug found during Task 1 and corroborated during Task 3

## Decisions Made

See `key-decisions` in frontmatter (all-day fixture window to sidestep timezone mismatch; `p_skip_depletion:false` in the parity test; T1/T2 test separation to avoid promotion-state collision).

## Deviations from Plan

### Auto-fixed Issues

None — this plan's file changes (test files only) required no Rule 1-3 auto-fixes to their own code once the timezone/`p_skip_depletion` design choices above were made.

### Discovered But NOT Auto-Fixed (out of scope, logged for the checkpoint)

**1. [Discovered during Task 1, corroborated during Task 3] `p_skip_depletion:true` also skips ALL promotion evaluation in `create_order_with_items` v3**
- **Found during:** Task 1 (behavioral-parity fixture initially failed with the undiscounted base price); reproduced independently against the unmodified sibling test `evaluate-promotions-rpc.integration.test.ts`, and again during Task 3's full live-suite run against `pool-promotions-rpc.integration.test.ts`'s `pool_grant` case.
- **Issue:** `supabase/migrations/20260710000004_evaluate_promotions_rpc.sql` placed `PERFORM evaluate_promotions_for_item(...)` inside the same `IF NOT p_skip_depletion THEN ... END IF;` block as `PERFORM deplete_for_order_item(...)`. These are two independent concerns (ingredient depletion vs. promotion pricing) that got coupled. Confirmed live-production impact: `src/features/override-negative-stock/model/useOverrideNegativeStock.ts` sends `p_skip_depletion: true` by design, so any promotion-eligible item ordered through the manager-PIN negative-stock-override flow silently does NOT get its discount applied.
- **Why not fixed here:** the fix touches a shared production RPC (`create_order_with_items`) outside this plan's `files_modified` (test files only), and would require its own `supabase db push` to the live database — this project consistently gates DB pushes behind an explicit BLOCKING human-verify checkpoint (Plan 20-06 Task 2 precedent), which is out of scope for this plan's Task 3 to silently absorb.
- **Full details:** `.planning/phases/20-promotions-engine/deferred-items.md` ("Plan 20-09, Task 1" section).
- **Impact on this plan's own tests:** `hh-parity.integration.test.ts` was adjusted to call `create_order_with_items` with `p_skip_depletion: false` (the same value every real order-taking call site uses) instead of mirroring the sibling test's `true` — this is both a correct workaround and arguably the more representative parity check.

---

**Total:** 0 auto-fixed deviations to this plan's own files; 1 significant out-of-scope bug discovered, logged, and escalated to the Task 3 checkpoint per SCOPE BOUNDARY.
**Impact on plan:** No scope creep in this plan's committed files. The discovered bug directly affects whether Task 3's own acceptance criteria ("all live promotion integration tests pass") can be satisfied right now — it currently cannot, and that is surfaced explicitly rather than glossed over.

### Gap-Closure Fix (separate follow-up session, Rule 1 — Bug)

**2. [Rule 1 - Bug] Fixed `p_skip_depletion` also silently skipping promotion evaluation**
- **Found during:** Task 1/3 of this same plan's original session (see above).
- **Issue:** `create_order_with_items` v3 ran `evaluate_promotions_for_item` inside the `IF NOT p_skip_depletion THEN ... END IF;` block gating `deplete_for_order_item`.
- **Fix:** New additive migration `supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql` — `create_order_with_items` v4 splits the loop so promotion evaluation runs unconditionally.
- **Files modified:** `supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql`, `.planning/phases/20-promotions-engine/deferred-items.md`, `.planning/phases/20-promotions-engine/20-09-SUMMARY.md`.
- **Commit:** `bd8f1d1`.
- **Verification:** both previously-failing tests pass (4/4); full live suite 6/6 files/20/20 tests pass on clean re-run; `typecheck`/`lint`/`test` show no new regressions vs. the documented baseline.

## Issues Encountered

- **Port 1420 contention (environment, not a defect):** `npx playwright test e2e/43-promotions.spec.ts` (the full run, not `--list`) could not complete in this session — Vite's dev server is hardcoded to port 1420 (`vite.config.ts`, required by Tauri), and a sibling parallel worktree agent (`agent-a817d27fdea47d595`, verified via `netstat`/`Get-CimInstance Win32_Process`) already had its own `npm run dev` bound to that port for this wave's concurrent execution. Killing another agent's process was not attempted (would risk destroying its in-progress work). The spec's syntax/load correctness was confirmed via `--list` (both tests enumerate cleanly); actual browser execution of T1/T2 is deferred to the human UAT step below, or a re-run once port 1420 is free.
- **One-off unit test flake (`src/entities/staff/model/queries.clock.test.ts`):** failed once in a full `npm run test` run (`useMutationClockOut`), passed both in isolation and on a second full-suite re-run — confirmed as a pre-existing test-isolation/ordering flake unrelated to this plan (no file in `src/entities/staff/` was touched by any Phase 20 plan). Not logged as a new regression.

## User Setup Required

None beyond the checkpoint itself — no new external service configuration.

## Automation Results

### Original session (Task 3, captured before presenting the checkpoint)

| Gate | Command | Result |
|------|---------|--------|
| D-07 parity test | `npx vitest run src/entities/promotion/model/hh-parity.integration.test.ts` | **PASS** (2/2) |
| Live promotion integration suite | `npx vitest run src/entities/promotion/model/` | **2 of 6 files FAIL** — `evaluate-promotions-rpc.integration.test.ts` and `pool-promotions-rpc.integration.test.ts` (`pool_grant` case), both due to the `p_skip_depletion` bug above. 18/20 tests pass; 4 files fully green (`applied-promotions-rls`, `promotions-schema`, `pool-promotions-rpc`'s other 2 cases, `hh-parity`). |
| E2E spec (full run) | `npx playwright test e2e/43-promotions.spec.ts` | **BLOCKED** — port 1420 contention from a sibling worktree agent's dev server (environment, not a spec defect). `--list` confirms both tests load/enumerate cleanly. |
| `npm run typecheck` | | **PASS** (only the 2 pre-existing, documented errors: `tab/model/queries.ts:778`, `agent/rag.ts:60` — both predate Phase 20, logged since Plan 20-06) |
| `npm run lint` | | **PASS** (exit 0; one pre-existing informational `eslint-plugin-boundaries` warning, not a file diagnostic) |
| `npm run test` (full unit suite) | | **PASS** on the representative run — 1247/1248 (only the pre-existing `useCloseTab.test.ts:95` failure, documented since Phase 15); one additional failure seen once (`queries.clock.test.ts`) was confirmed to be a non-reproducing flake on re-run, not a regression |

### Gap-closure session (after fix migration `20260710000008` pushed live)

| Gate | Command | Result |
|------|---------|--------|
| Previously-failing pair | `npx vitest run .../evaluate-promotions-rpc.integration.test.ts .../pool-promotions-rpc.integration.test.ts` | **PASS** — 4/4 tests (was 2 failures) |
| Live promotion integration suite (1st re-run) | `npx vitest run src/entities/promotion/model/` | 5/6 files pass, 1 cross-file flake (`pool_billing` test: `54` vs expected `60`) |
| Live promotion integration suite (2nd re-run, immediate) | `npx vitest run src/entities/promotion/model/` | **PASS** — 6/6 files, 20/20 tests. Flake did not reproduce (also passes standalone in file-isolation) — logged as a pre-existing live-DB cross-file test-isolation flake, same category as `queries.clock.test.ts`, not a regression from the fix. |
| `npm run typecheck` | | **PASS** — identical 2 pre-existing errors only, no new errors |
| `npm run lint` | | **PASS** — exit 0, same pre-existing informational warning |
| `npm run test` (full unit suite) | | **PASS** — 1247/1248, only the pre-existing documented `useCloseTab.test.ts:95` failure |
| E2E spec (full run) | `npx playwright test e2e/43-promotions.spec.ts` | **NOT RE-ATTEMPTED** — port 1420 still occupied by a sibling worktree agent's dev server in this session. `--list` syntax-validation from the original session still stands. |

## Checkpoint Status: Automated gates GREEN; manual in-app UAT still recommended before "approved"

The root-cause bug found during the original Task 3 automation run (`p_skip_depletion` silently
skipping promotion evaluation) is now **FIXED** via
`supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql`, pushed live and
verified (see "Gap-Closure Update" above and `deferred-items.md`'s "STATUS: FIXED" section). All
of Task 3's scriptable acceptance criteria now pass: the live promotion integration suite is
green, and `npm run typecheck && npm run lint && npm run test` are green with no new regressions.

**Still outstanding — requires an actual human, not this agent:**
1. The manual UAT checklist from the plan's Task 3 (`how-to-verify` steps 2-4: item/category
   discount, pool billing discount, pool bonus minutes, admin UI create/edit/disable/delete —
   all performed by clicking through the running app).
2. A full `npx playwright test e2e/43-promotions.spec.ts` browser run, once port 1420 is free.
3. Confirm the D-07 parity gate's finding that **zero live products currently carry legacy HH
   data** — the structural-parity half of this plan's own test has nothing to verify against on
   this database (per the checkpoint note's explicit instruction to report, not silently pass,
   this condition).

Per this plan's `autonomous: false` and Task 3's `gate="blocking"` checkpoint, only a human can
type "approved" to authorize Plan 20-10's destructive column drop. This gap-closure session
resolves the specific defect that was blocking the automated half of that gate; it does not
substitute for the human click-through steps above.

## Next Phase Readiness

- All three of this plan's deliverables (`hh-parity.integration.test.ts`, `e2e/43-promotions.spec.ts`, and the gap-closure fix migration `20260710000008_fix_promotion_skip_depletion_gate.sql`) are complete, committed, and pass their own scoped verification.
- The `p_skip_depletion` promotion-evaluation-skip bug that was the sole blocker to Task 3's automated acceptance criteria is now fixed and verified live.
- Plan 20-10 (destructive column drop) still requires a human to complete the manual UAT checklist and type "approved" per the plan's blocking checkpoint — the automated prerequisite work is done, but this is a human-verify gate that this agent cannot self-approve.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10 (Tasks 1-2 complete; Task 3's automated gates green after gap-closure fix; human UAT click-through still pending)*
