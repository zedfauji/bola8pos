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

**Corroboration during Task 3's automation-first run:** re-running the FULL live promotion
integration suite (`npx vitest run src/entities/promotion/model/`) as required by Task 3
reproduces this same bug in a SECOND, independent test file:
`pool-promotions-rpc.integration.test.ts`'s `pool_grant` case (Plan 20-05) also passes
`p_skip_depletion: true` and fails identically (`expected [] to have a length of 1 but got +0` —
zero unconsumed `pool_minutes_granted` rows, because the pool_grant loop inside
`evaluate_promotions_for_item` never ran). This confirms the bug is not test-authoring error
specific to this plan — it is a real, live defect affecting TWO of the six Phase-20 promotion
integration test files (`evaluate-promotions-rpc.integration.test.ts`,
`pool-promotions-rpc.integration.test.ts`), and by extension the
`override-negative-stock` production order path. Task 3's acceptance criterion "All live
promotion integration tests pass against the live DB" is currently **NOT met** for this reason —
surfaced explicitly at the blocking checkpoint rather than silently reported as green.

---

## STATUS: FIXED (Plan 20-09, Task 3 gap-closure session)

**Fix migration:** `supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql`
(commit `bd8f1d1`), pushed live via `npx supabase db push --yes`, confirmed applied
(`npx supabase db push --dry-run` reports "Remote database is up to date").

**What changed:** `create_order_with_items` v4 (`CREATE OR REPLACE`, same 7-arg signature,
same `SECURITY INVOKER`, same `p_expected_version FOR UPDATE` guard) splits the single
per-item loop into two: ingredient depletion stays gated on `NOT p_skip_depletion`
(unchanged behavior), and `evaluate_promotions_for_item` now runs in its own loop,
unconditionally, for every inserted order item regardless of `p_skip_depletion`.
Depletion and promotion pricing are independent concerns and are no longer coupled to the
same conditional.

**Verification after the fix:**
- `evaluate-promotions-rpc.integration.test.ts` and `pool-promotions-rpc.integration.test.ts`
  (both files, targeted re-run): **4/4 tests PASS** (previously 2 failures).
- Full live promotion integration suite (`npx vitest run src/entities/promotion/model/`),
  re-run twice: first pass showed 1 unrelated cross-file flake
  (`pool_billing percentage promotion...`, `54` vs expected `60`) that did NOT reproduce on
  an immediate second full-suite run (**6/6 files, 20/20 tests PASS**) and also passed in
  file-isolation on its own — consistent with the same category of live-DB
  cross-file/shared-state test-isolation flake already documented for
  `src/entities/staff/model/queries.clock.test.ts` in Plan 20-09's original session. Not a
  regression introduced by this fix.
- `npm run typecheck`: same 2 pre-existing errors only (`tab/model/queries.ts:778`,
  `agent/rag.ts:60` — both predate Phase 20, documented since Plan 20-06). No new errors.
- `npm run lint`: exit 0 (same pre-existing informational `eslint-plugin-boundaries` warning).
- `npm run test` (full unit suite): 1247/1248 pass — only the pre-existing, documented
  `useCloseTab.test.ts:95` failure (documented since Phase 15, unrelated to Phase 20). No new
  regressions.

**Production impact resolved:** `src/features/override-negative-stock/model/useOverrideNegativeStock.ts`'s
order-placement call (`p_skip_depletion: true`) now correctly receives promotion evaluation —
the manager-PIN "override negative stock" flow no longer silently skips eligible discounts.

**Remaining gap (not a blocker for this fix):** the full `npx playwright test
e2e/43-promotions.spec.ts` browser run was not re-attempted in this gap-closure session — port
1420 was still occupied by a sibling parallel worktree agent's dev server. `--list` had already
confirmed both tests load/enumerate cleanly in the prior session; a full browser run remains a
recommended follow-up once a port is free, but does not block this correctness fix.

## Plan 20-10, Task 1

**Scope expansion beyond the plan's `files_modified` list (Rule 1/3 — bug/blocking, not
architectural):** `src/entities/tab/model/queries.ts` and `src/entities/inventory/model/queries.ts`
were NOT in this plan's stated file list, but both directly read the raw `happy_hour_start`,
`happy_hour_end`, and `happy_hour_price` DB columns (a `CategoryEmbed` interface + an explicit
column list inside `tabListSelect`'s nested `category:categories(...)` select in
`tab/model/queries.ts`; row-mapper reads off fully-typed `Tables<'products'>`/`Tables<'categories'>`
joins in `inventory/model/queries.ts`). Left unfixed, Plan 20-10 Task 2's own acceptance criterion
("`npm run typecheck` exits 0" after the column drop) would fail (TS2339 — property does not
exist on the regenerated `Tables<'categories'>`/`Tables<'products'>` types), AND the live
`tabListSelect` query (used by `useTabs`/`useTab`/`useSubTabs` — the core order-taking read path)
would break at runtime with a PostgREST "column does not exist" error the moment the columns are
dropped, since it explicitly lists `happy_hour_start, happy_hour_end` in its embedded category
select. Both files were updated in Task 1's commit using the same "supply `null`" pattern as the
plan's originally-listed files. Verified: `npm run typecheck` green (only the 2 pre-existing
documented errors remain), `npm run lint` exit 0, full unit suite 1247/1248 pass (only the
pre-existing `useCloseTab.test.ts:95` failure).

**`@deprecated` JSDoc tag reverted to a plain "DEPRECATED" comment (Rule 1 — bug):** The plan's
Task 1 action said to annotate `happyHourStart`/`happyHourEnd`/`happyHourPrice` in `domain.ts`
with a JSDoc `@deprecated` tag. Doing so literally trips the project's
`@typescript-eslint/no-deprecated` ESLint rule (`max-warnings 0`) at every remaining consumer of
those fields — `ProductCard.tsx`, `CatalogProductsTab.tsx`, and `domain-helpers.ts`
(`resolveProductPrice`/`isHappyHourActive`) — none of which are in Plan 20-10's scope; their
removal is explicitly Plan 20-11's job. A literal `@deprecated` tag would break `npm run lint`
project-wide from this plan's own commit until Plan 20-11 lands. Fixed by using a plain
"DEPRECATED — ..." doc comment (not the JSDoc `@deprecated` tag syntax) that documents the same
intent without invoking the linter rule. `npm run lint` confirmed exit 0 after the change.

**Runtime-only gap flagged for awareness (NOT fixed, out of scope for Task 1 — a Plan 20-09 test
file):** `src/entities/promotion/model/hh-parity.integration.test.ts` (created by Plan 20-09,
not in Plan 20-10's `files_modified`) directly `.insert()`s and `.select()`s the raw
`happy_hour_start`/`happy_hour_end`/`happy_hour_price` columns against a `createClient(...) as any`
client. Because the client is cast to `any`, this does NOT break `npm run typecheck` (confirmed —
typecheck is green with this file unmodified). It WILL break at runtime the moment Task 2's
column drop is pushed live: its `beforeAll` fixture inserts a category/product row with those
columns, which will fail once the columns no longer exist. The test file's own comment already
acknowledges this ("columns still present — this plan runs BEFORE Plan 20-10's column drop").
This is expected obsolescence documented by its own author (Plan 20-09), not a new defect
introduced here — flagged so whoever runs Task 2 / a subsequent full `npm run test` is not
surprised by a new failure in this specific file. No fix applied (out of scope for Task 1;
retiring/updating this test is not listed in either Plan 20-10 or Plan 20-11's `files_modified`
and should be tracked as its own follow-up).

**Non-blocking drift noted, not fixed:** `src/shared/lib/supabase-contracts.ts` also contains
`happy_hour_start`/`happy_hour_end`/`happy_hour_price` field entries, but this file is an
explicitly-labeled "Placeholder for Supabase generated types" documentation file (see its own
header comment) that is not imported for its `Database.public.Tables` shape by any real query
code (verified via `grep -rln "supabase-contracts"` — the only 3 importers use unrelated exports).
Left untouched; does not affect typecheck or runtime.
