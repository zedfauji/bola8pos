---
phase: 20-promotions-engine
plan: 03
subsystem: database
tags: [postgres, plpgsql, rls, supabase, promotions, pricing-authority, fast-check]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 01, schema foundations)
    provides: "promotions/promotion_availability tables, is_promotion_available() evaluator"
  - phase: 20-promotions-engine (plan 02, contracts)
    provides: "AppliedPromotionSchema (domain.ts) column-naming contract, promotion.apply audit action"
provides:
  - "applied_promotions append-only audit table + RLS (SELECT manager/admin only, zero write policies)"
  - "evaluate_promotions_for_item(uuid) SECURITY DEFINER — item/category sequential-compounding promotion evaluation, combo-excluded"
  - "create_order_with_items v3 — same 7-arg signature/version-guard/depletion loop as v2, wires evaluate_promotions_for_item per item"
  - "applyPromotionStack pure fn (cosmetic/preview mirror) + P11 fast-check property test"
  - "2 env-guarded integration scaffolds (applied_promotions RLS, evaluate RPC server-price-wins)"
affects: [20-05, 20-06, 20-07, 20-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable per-transaction audit table pattern (tip_distribution_entries analog) applied to applied_promotions — SELECT-manager-only, zero INSERT/UPDATE/DELETE policies, SECURITY DEFINER RPC is sole writer"
    - "RPC-internal PERFORM loop over freshly-inserted rows (deplete_for_order_item analog) extended with a second PERFORM for promotion evaluation, same transaction"
    - "Server treats client-submitted unit_price as the undiscounted base input, not the final charged price — first server-side pricing authority in this codebase"

key-files:
  created:
    - supabase/migrations/20260710000003_applied_promotions_table.sql
    - supabase/migrations/20260710000004_evaluate_promotions_rpc.sql
    - src/shared/lib/promotion-pricing.ts
    - src/shared/lib/promotion-pricing.test.ts
    - src/entities/promotion/model/applied-promotions-rls.integration.test.ts
    - src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts
  modified: []

key-decisions:
  - "applied_promotions.promotion_id is ON DELETE SET NULL + promotion_name_snapshot preserves audit fidelity if a promotion is hard-deleted (RESEARCH Open Question 4)"
  - "evaluate_promotions_for_item derives v_base_price directly from order_items.unit_price (the client-submitted value at insert time), not from products.base_price — the RPC's promotion discount always applies against whatever base the client submits; the integration test therefore proves 'client cannot get its raw submitted number accepted as final' rather than 'server re-derives the true product price', since the RPC itself never reads products.base_price for this purpose"
  - "P11 property test scoped to what is provably true given per-step ROUND: fixed_amount-only chains of ANY length are exactly order-independent (subtraction + GREATEST(0) clamp are both order-independent); percentage-only PAIRS (length 2, integer inputs) are order-independent WITHIN 1 cent — a real, documented IEEE754 double-rounding artifact of the JS mirror that does not affect the SQL NUMERIC billing path — rather than asserting an always-false strict-equality claim across arbitrary-length percentage chains (per-step rounding genuinely breaks strict order-independence beyond a pair, confirmed empirically during authoring)"
  - "Added an ELSE CONTINUE branch to the evaluate_promotions_for_item CASE (Rule 2 defense-in-depth) so an unrecognized discount_type value skips rather than silently falling through with no v_running_price change and no audit row — the plan's 3 named cases were preserved verbatim, this is additive safety only"

requirements-completed: [SC-2, SC-3]

# Metrics
duration: ~55min
completed: 2026-07-10
---

# Phase 20 Plan 03: Promotion Evaluation + Applied-Promotions Audit Summary

**The `applied_promotions` immutable audit table, the `evaluate_promotions_for_item` SECURITY DEFINER function (sequential compounding, combo exclusion, audit insert), and `create_order_with_items` v3 wiring — the first server-side pricing authority in this codebase, where `evaluate_promotions_for_item` (not the client) becomes the sole writer of `order_items.unit_price` for promotion-eligible items.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (all created)

## Accomplishments

- `applied_promotions` table: `promotion_id ON DELETE SET NULL` + `promotion_name_snapshot NOT NULL` (survives promotion hard-delete), `pool_session_id`/`pool_minutes_granted`/`consumed_at` columns present now for Plan 20-05's pool paths (unwritten by this plan), no UNIQUE constraint (many rows per tab/order-item allowed for stacking), exactly 1 SELECT-manager-only RLS policy, zero INSERT/UPDATE/DELETE policies, 4 indexes (order_item_id, tab_id, pool_session_id, partial unconsumed-grant index)
- `evaluate_promotions_for_item(uuid)` SECURITY DEFINER: resolves product/category/base-price/tab/combo-flags via a single join query; early-RETURNs for combo parent (`is_combo=true`) and combo child (`combo_slot_id IS NOT NULL`) lines (Pitfall 6); loops item/category-targeted active+available promotions `ORDER BY priority ASC, created_at ASC, id ASC`; sequential compounding CASE (`percentage`/`fixed_amount`/`fixed_price`) with `GREATEST(0, ROUND(...,2))` clamping at every step and a `fixed_price` reset (does not compound); inserts one `applied_promotions` row per applied promotion; updates `order_items.unit_price` and fires best-effort `record_audit('promotion.apply', ...)` only if ≥1 promotion applied
- `create_order_with_items` v3: byte-for-byte the v2/Phase-15 body (7-arg signature, `p_expected_version` FOR UPDATE guard, depletion loop) plus exactly one new `PERFORM evaluate_promotions_for_item(v_inserted_item.id)` line immediately after the existing `deplete_for_order_item` PERFORM
- `applyPromotionStack` (`src/shared/lib/promotion-pricing.ts`): pure-fn mirror of the SQL compounding math, documented as cosmetic/preview-only (never billing authority)
- `promotion-pricing.test.ts`: 5 unit cases (empty stack, single percentage, percentage→fixed_amount compounding, fixed_price reset, GREATEST(0) clamp) + 3 P11 property sub-tests (fixed_amount-only order-independence any length, percentage-only pair order-independence within 1 cent, non-negativity for arbitrary mixed stacks) — 8/8 green, 200-300 numRuns each
- Two env-guarded integration scaffolds: `applied-promotions-rls.integration.test.ts` (bartender SELECT denied, manager SELECT permitted, INSERT/UPDATE/DELETE denied for everyone incl. manager) and `evaluate-promotions-rpc.integration.test.ts` (creates an item-targeted promotion, calls `create_order_with_items` with an inflated client `unit_price`, asserts the server-evaluated discounted price is written to both the RPC return payload and the `order_items` row, and that a matching `applied_promotions` row exists)

## Task Commits

Each task was committed atomically:

1. **Task 1: applied_promotions append-only audit table + RLS** - `492f79e` (feat)
2. **Task 2: evaluate_promotions_for_item + create_order_with_items v3** - `f06344f` (feat)
3. **Task 3: promotion-pricing pure fn + P11 property test + integration scaffolds** - `0138b18` (test)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified

- `supabase/migrations/20260710000003_applied_promotions_table.sql` - `applied_promotions` table + 4 indexes + 1 RLS policy
- `supabase/migrations/20260710000004_evaluate_promotions_rpc.sql` - `evaluate_promotions_for_item(uuid)` + `create_order_with_items` v3
- `src/shared/lib/promotion-pricing.ts` - `applyPromotionStack` pure fn (cosmetic/preview mirror only)
- `src/shared/lib/promotion-pricing.test.ts` - 5 unit cases + P11 property test (3 sub-properties)
- `src/entities/promotion/model/applied-promotions-rls.integration.test.ts` - RLS denial/permission scaffold, env-guarded
- `src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts` - server-price-wins + audit-row scaffold, env-guarded

## Decisions Made

- `promotion_id ON DELETE SET NULL` + `promotion_name_snapshot` per RESEARCH Open Question 4 (resolved in 20-01, re-confirmed here for the writer side)
- The evaluator derives its "undiscounted base" strictly from `order_items.unit_price` at insert time (the client-submitted value), never from `products.base_price` — this is what the plan's `<action>` block specifies verbatim ("v_base_price (order_items.unit_price as the undiscounted input)"). The integration test's "inflated client price" scenario therefore demonstrates that the server always (re)applies its own promotion math on top of whatever the client sends — the client cannot get its raw submitted number accepted as the final charged price once a promotion is eligible — rather than a stronger (and NOT what this plan implements) claim that the server independently re-derives the "true" product price from the catalog. This distinction is documented inline in both the migration's header comment and the integration test file.
- P11 property test is scoped to the subset of "commutative ops" that are provably always true given the SQL's own per-step-rounding design (documented in the plan's Code Examples as "ROUND at every step — money drift guard"): fixed_amount-only chains (any length, exact) and percentage-only pairs (length 2, within 1 cent — a genuine IEEE754 double-rounding artifact confirmed by running the property against live counterexamples during authoring, e.g. base=19833/d1=90/d2=35 producing 1289.15 vs 1289.14 depending on order). A strict-equality claim across arbitrary-length or arbitrary-type percentage chains would be mathematically false given per-step rounding and was rejected rather than papered over with a wider tolerance that could mask a real regression.
- Added a defensive `ELSE CONTINUE` branch inside the promotion CASE statement (Rule 2) so a promotion row with an unexpected `discount_type` value (should be impossible given the CHECK constraint from 20-01, but is not database-verifiable at the PL/pgSQL CASE-statement level without an explicit ELSE) is skipped rather than silently leaving `v_running_price` in an undefined state — no scope change to the plan's 3 named cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules` and `.env.local`**
- **Found during:** Task 3, first `npx vitest run` attempt
- **Issue:** Fresh worktree checkout had no `node_modules/` and no `.env.local`; Vitest's `global-setup.ts` hard-requires live Supabase credentials project-wide, independent of any individual test's own env guard (same situation documented in 20-01-SUMMARY.md and 20-02-SUMMARY.md).
- **Fix:** Ran `npm ci` (lockfile-exact install) and copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`). Neither is a tracked/committed change.
- **Files modified:** none (local dev-environment plumbing only)
- **Committed in:** N/A (gitignored, not staged)

**2. [Rule 1 - Bug] ESLint `no-unnecessary-type-conversion` on `Number(...)` calls in the RPC integration test**
- **Found during:** Task 3, `npx eslint` verification pass
- **Issue:** Explicitly typing PostgREST response fields as `number` (e.g. `{ unit_price: number }`) caused TypeScript to consider them already-numeric, so ESLint flagged the defensive `Number(...)` coercion (needed because Postgres `numeric` columns are serialized as strings by PostgREST) as a no-op.
- **Fix:** Changed the local type assertions from `number` to `unknown` for the numeric fields read back from Supabase, matching the pattern already used elsewhere in the codebase (e.g. `tip-distribution-rpc.integration.test.ts` leaves these fields untyped/`any` so the `Number(...)` coercion is meaningful to the type checker).
- **Files modified:** `src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts`
- **Verification:** `npx eslint` clean (0 errors, 0 warnings) after the fix.
- **Committed in:** `0138b18` (Task 3 commit — caught and fixed before the first commit of this file, not a follow-up commit)

---

**Total deviations:** 2 (1 Rule 3 local-environment blocker, 1 Rule 1 lint bug caught and fixed pre-commit)
**Impact on plan:** No scope creep. No production code touched beyond what each task specified.

## Issues Encountered

- **Live-DB pre-push test state (expected, not a bug):** This shared dev environment's `.env.local` points at a live shared Supabase project. Because live credentials are present, both integration scaffolds' `describe.skipIf(!hasE2eEnv)` guards evaluate to "run" rather than "skip". Since `20260710000003_applied_promotions_table.sql` and `20260710000004_evaluate_promotions_rpc.sql` (and Plan 20-01's `20260710000001_promotions_schema.sql`) are NOT yet pushed to the remote project (that is Plan 20-06's explicit BLOCKING job), both suites fail their `beforeAll` with `Could not find the table 'public.promotions'/'public.applied_promotions' in the schema cache`. This is the exact same situation documented in 20-01-SUMMARY.md and 20-02-SUMMARY.md for this phase, and in Phase 19 Plan 02's SUMMARY.md before its own BLOCKING push plan. No code change was made to force a false "skip" — that would mask a real, expected dependency rather than reflect it.
  - `npx eslint` on all 6 new/modified files is clean (0 errors, 0 warnings).
  - `npm run typecheck` shows only the 2 pre-existing unrelated errors already documented in STATE.md/CLAUDE.md (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`) — neither touched by this plan.
  - `npx vitest run src/shared/lib/promotion-pricing.test.ts` is fully green (8/8) — this file has no live-DB dependency.
  - Re-running `npx vitest run src/entities/promotion/model/applied-promotions-rls.integration.test.ts src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts` after Plan 20-06's push should flip both suites to green with no test-file changes required.

## User Setup Required

None — no external service configuration required. Plan 20-06 (the phase's BLOCKING db-push plan) will apply `20260710000003_applied_promotions_table.sql` and `20260710000004_evaluate_promotions_rpc.sql` (alongside Plan 20-01's two migrations) to the remote Supabase project; that push is explicitly out of scope for Plan 03.

## Next Phase Readiness

- Plan 20-05 (pool-time billing discount + pool-grant paths, D-05a/D-05b) can extend `evaluate_promotions_for_item`'s sibling pool-path RPCs and reuse the same `applied_promotions` table (its `pool_session_id`/`pool_minutes_granted`/`consumed_at` columns are already present, unwritten until 20-05).
- Plan 20-06's BLOCKING db push must apply both this plan's migrations (in addition to 20-01's two) — all four are self-contained, `BEGIN;...COMMIT;`-wrapped, and were verified via each plan's exact grep gates.
- After Plan 20-06's push, re-running the two integration test files here should flip all currently-failing tests to green with no code changes required.
- Plan 20-09's parity gate can now directly compare `applyPromotionStack`'s TS output against `evaluate_promotions_for_item`'s SQL output for drift detection.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260710000003_applied_promotions_table.sql
- FOUND: supabase/migrations/20260710000004_evaluate_promotions_rpc.sql
- FOUND: src/shared/lib/promotion-pricing.ts
- FOUND: src/shared/lib/promotion-pricing.test.ts
- FOUND: src/entities/promotion/model/applied-promotions-rls.integration.test.ts
- FOUND: src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts
- FOUND commit: 492f79e (Task 1)
- FOUND commit: f06344f (Task 2)
- FOUND commit: 0138b18 (Task 3)
