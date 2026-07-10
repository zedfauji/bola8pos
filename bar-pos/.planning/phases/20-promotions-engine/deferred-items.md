# Deferred Items — Phase 20 (Promotions Engine)

## Plan 20-06, Task 3

**Pre-existing `npm run typecheck` failures (out of scope, not caused by this task):**

Confirmed by temporarily restoring the pre-Task-3 `src/shared/lib/supabase.types.ts` (via
`git show HEAD:bar-pos/src/shared/lib/supabase.types.ts`) and re-running `npm run typecheck`
— the identical two errors reproduce, proving they predate the Task 3 types regeneration:

1. `src/entities/tab/model/queries.ts(778,11)`: `error TS2322: Type 'number | null' is not
   assignable to type 'number | undefined'.` — `close_tab` RPC call passes
   `p_expected_version: expected ?? null` where the generated `Args` type expects
   `number | undefined`. Unrelated to promotions/`close_tab` was untouched by this plan.
2. `src/shared/lib/agent/rag.ts(60,7)`: `error TS2322: Type 'number[]' is not assignable to
   type 'string'.` — `pos_codebase_index.embedding` is typed `string | null` in
   `supabase.types.ts` (pgvector represented as a string) but `rag.ts` assigns a raw
   `number[]` embedding. Unrelated to promotions; `pos_codebase_index` was untouched by this
   plan.

Both are logged here per the SCOPE BOUNDARY rule (do not fix pre-existing failures outside
the current task's files) and left for a future cleanup plan.

## Plan 20-09, Task 1

**Bug found (pre-existing, out of scope for this task's files): `p_skip_depletion: true` also
silently skips promotion evaluation.**

`create_order_with_items` v3's `PERFORM evaluate_promotions_for_item(v_inserted_item.id);`
call sits inside the same `IF NOT p_skip_depletion THEN ... END IF;` block as
`PERFORM deplete_for_order_item(...)` (introduced in Plan 20-03,
`supabase/migrations/20260710000004_evaluate_promotions_rpc.sql`, lines 233-242). These are
two independent concerns (ingredient depletion vs. promotion pricing) that got coupled to the
same conditional. Any order placed with `p_skip_depletion: true` gets ZERO promotion
evaluation, even if an eligible, active promotion exists for the item.

**Live production impact:** confirmed one real call site is affected —
`src/features/override-negative-stock/model/useOverrideNegativeStock.ts` places its order with
`p_skip_depletion: true` (by design, to bypass the inventory-negative guard on the first pass).
Any item ordered through the manager-PIN "override negative stock" flow will NOT get an
otherwise-eligible promotion discount applied, silently overcharging the customer relative to
what the cart/banner may have implied. Every other order-taking call site
(`src/entities/tab/model/queries.ts`, `src/shared/lib/agent/tools/posTools.ts`,
`src/entities/rappi-order/model/accept-flow.ts`) sends `p_skip_depletion: false`, so the normal
order flow is unaffected.

**How this was discovered:** `hh-parity.integration.test.ts`'s behavioral-parity case initially
used `p_skip_depletion: true` (mirroring `evaluate-promotions-rpc.integration.test.ts`) and got
back the undiscounted base price instead of the promotion price. Re-running
`evaluate-promotions-rpc.integration.test.ts` (Plan 20-03's own test, unmodified) against the
live DB reproduces the same failure — confirming this is a live, pre-existing defect, not new
test-authoring error. `hh-parity.integration.test.ts` was changed to pass
`p_skip_depletion: false` instead (also more representative of the real order flow), which
resolved it for this plan's own test.

**Why not fixed here:** the fix (decoupling the `evaluate_promotions_for_item` PERFORM call
from the `p_skip_depletion` conditional so it always runs regardless of depletion-skip) touches
`create_order_with_items`, a shared production RPC outside this plan's `files_modified`
(`hh-parity.integration.test.ts`, `e2e/43-promotions.spec.ts`), and would require its own
`supabase db push` to a production database — this project consistently gates DB pushes behind
an explicit BLOCKING human-verify checkpoint (see Plan 20-06 Task 2), which this plan's Task 3
does not cover for a *new* migration. Per SCOPE BOUNDARY, this is logged rather than fixed
inline. **Flagged explicitly in the Task 3 UAT checkpoint** for human awareness before
authorizing Plan 20-10's column drop — recommend a follow-up plan/migration
(`evaluate_promotions_for_item`'s PERFORM call moved outside the `p_skip_depletion` guard in
`create_order_with_items`) before or shortly after the drop.
