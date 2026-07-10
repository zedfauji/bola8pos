---
phase: 20-promotions-engine
plan: 06
subsystem: database
tags: [supabase, postgres, migrations, promotions, happy-hour, typescript, codegen]

# Dependency graph
requires:
  - phase: 20-promotions-engine
    provides: "Plans 20-01/20-03/20-04/20-05 authored the promotions/promotion_availability/applied_promotions schema, is_promotion_available, evaluate_promotions_for_item (v1+v2 pool_grant), create_order_with_items v3, and stop_pool_session — all migration files, not yet applied to the live DB"
provides:
  - "D-07 additive HH -> promotions data migration (20260710000007_migrate_happy_hour_data.sql)"
  - "All Phase-20 migrations LIVE on the Supabase database (verified: 3 tables + 3 functions + create_order_with_items wiring + HH promotion count parity)"
  - "supabase.types.ts regenerated from the live schema — promotions/promotion_availability/applied_promotions table types + is_promotion_available/evaluate_promotions_for_item/stop_pool_session function entries"
affects: [20-07, 20-08, 20-09, 20-10, 20-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only data migration with NOT EXISTS idempotency guard, reproducing legacy resolveProductPrice semantics as fixed_price promotions (Pitfall 4 parity window preserved for Plan 20-09 column drop)"
    - "npx supabase gen types typescript --project-id <ref> against the linked remote project regenerates the full types file cleanly (no Docker/local pipe needed this time)"

key-files:
  created:
    - supabase/migrations/20260710000007_migrate_happy_hour_data.sql
  modified:
    - src/shared/lib/supabase.types.ts
    - .planning/phases/20-promotions-engine/deferred-items.md

key-decisions:
  - "Used npx supabase gen types typescript --project-id shsrhxleopmovzpzqmex (linked remote) rather than the --local Docker workaround — it succeeded on first attempt and produced a clean, purely-additive diff"
  - "Regeneration also surfaced two live functions not previously reflected in supabase.types.ts (get_payments_split_columns, process_split_payment_atomic) — left as-is, out of scope for this plan"
  - "Two pre-existing npm run typecheck failures (tab/model/queries.ts close_tab arg typing, agent/rag.ts embedding typing) were reproduced against the pre-Task-3 types file to confirm they predate this plan; logged to deferred-items.md rather than fixed, per SCOPE BOUNDARY"

patterns-established:
  - "Additive HH->promotions conversion pattern: INSERT ... SELECT with NOT EXISTS guard, RETURNING id back into a second INSERT for the availability window — reusable for any future legacy-column-to-new-table backfill"

requirements-completed: [SC-1, SC-2, SC-3]

# Metrics
duration: 26min
completed: 2026-07-10
---

# Phase 20 Plan 06: Live DB Push + HH Data Migration + Types Refresh Summary

**Applied all six prior Phase-20 migrations plus a new additive Happy-Hour-to-promotions data migration to the live Supabase database, verified every schema object, and regenerated `supabase.types.ts` from the live schema — the server-side promotions engine is now LIVE.**

## Performance

- **Duration:** 26 min (across two agent sessions, resumed after the blocking human-verify checkpoint)
- **Started:** 2026-07-09T20:01Z (Task 1)
- **Completed:** 2026-07-10T02:27Z (Task 3, this session)
- **Tasks:** 3 (1 auto, 1 blocking checkpoint, 1 auto)
- **Files modified:** 2 (1 created, 1 modified) + 1 deferred-items log

## Accomplishments
- Authored `20260710000007_migrate_happy_hour_data.sql`: additive, idempotent (`NOT EXISTS` guard) conversion of every `products.happy_hour_price` + category HH-window pair into an equivalent `fixed_price` promotion + `promotion_availability` window — reproduces `resolveProductPrice`'s legacy override semantics exactly, with zero admin re-entry burden (D-07) and no destructive statements (Pitfall 4 preserved for Plan 20-09).
- `npx supabase db push` applied all seven Phase-20 migrations to the live database with no errors (human-verified: `to_regclass` confirmed `promotions`/`promotion_availability`/`applied_promotions` all non-null; `is_promotion_available`/`evaluate_promotions_for_item`/`stop_pool_session` all present; `create_order_with_items` definition confirmed to call `evaluate_promotions_for_item`; `Happy Hour:%` promotion count matched pre-migration HH product count).
- Regenerated `src/shared/lib/supabase.types.ts` via `npx supabase gen types typescript --project-id shsrhxleopmovzpzqmex` against the linked remote project — a clean, 231-line purely-additive diff adding `promotions`, `promotion_availability`, `applied_promotions` table types and `is_promotion_available`, `evaluate_promotions_for_item`, `stop_pool_session` function entries. `create_order_with_items`'s 7-arg signature is unchanged (the v3 body change was internal — one new `PERFORM` call, no new RPC parameter).

## Task Commits

Each task was committed atomically:

1. **Task 1: D-07 additive HH -> promotions data migration** - `c89cb3b` (feat)
2. **Task 2: [BLOCKING] Apply all Phase-20 migrations via supabase db push** - no code commit (DB-only operation; human-approved via "approved" resume signal after automated push + verification queries)
3. **Task 3: Regenerate/extend supabase.types.ts for the new tables + RPCs** - `8fc7cf2` (feat)

**Plan metadata:** commit pending (this SUMMARY)

## Files Created/Modified
- `supabase/migrations/20260710000007_migrate_happy_hour_data.sql` - Additive HH->promotions data migration with idempotency guard
- `src/shared/lib/supabase.types.ts` - Regenerated: adds promotions/promotion_availability/applied_promotions table types + 3 new RPC Function entries (also picked up 2 pre-existing live functions not previously reflected: `get_payments_split_columns`, `process_split_payment_atomic`)
- `.planning/phases/20-promotions-engine/deferred-items.md` - New: logs 2 pre-existing, out-of-scope `npm run typecheck` failures

## Decisions Made
- Regenerated types via the linked-remote `npx supabase gen types typescript --project-id <ref>` path rather than the `--local` Docker workaround documented as a fallback in CLAUDE.md — it worked cleanly on the first attempt, so no manual transcription was needed.
- Left the two extra live functions (`get_payments_split_columns`, `process_split_payment_atomic`) that the regen surfaced untouched — they predate this phase and are out of scope for Plan 20-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed node_modules via `npm ci` before typecheck**
- **Found during:** Task 3 verification
- **Issue:** The worktree had no `node_modules` (gitignored, not carried into the worktree checkout), so `npm run typecheck` / `npx tsc` failed with "'tsc' is not recognized" / "not the tsc command you are looking for".
- **Fix:** Ran `npm ci` to hydrate `node_modules` from the existing `package-lock.json` (not a new/arbitrary package install — falls outside the package-manager-install exclusion in Rule 3, which targets installing an unreviewed *new* package name).
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npm run typecheck` then ran successfully (modulo the pre-existing failures below)
- **Committed in:** N/A (no trackable file changes)

---

**Total deviations:** 1 auto-fixed (1 blocking — environment setup)
**Impact on plan:** Necessary to run the plan's own verification command. No scope creep.

## Issues Encountered

`npm run typecheck` does not exit 0 — it reports 2 pre-existing errors unrelated to this plan's changes:
1. `src/entities/tab/model/queries.ts(778,11)`: `close_tab` RPC call passes `p_expected_version: expected ?? null` where the generated `Args` type expects `number | undefined` (not `null`).
2. `src/shared/lib/agent/rag.ts(60,7)`: assigns a raw `number[]` embedding where `pos_codebase_index.embedding` is typed `string | null`.

Both were reproduced against the **pre-Task-3** `supabase.types.ts` (via `git show HEAD:bar-pos/src/shared/lib/supabase.types.ts`, temporarily restored, typecheck re-run, identical 2 errors) to confirm they are pre-existing and not caused by this plan's type regeneration. Neither `close_tab` nor `pos_codebase_index` was touched by any Phase 20 migration or this plan's files. Logged to `.planning/phases/20-promotions-engine/deferred-items.md` per the executor's SCOPE BOUNDARY rule (only fix issues directly caused by the current task's changes) rather than fixed inline.

The plan's automated verify string (`npm run typecheck && grep ...`) therefore does not pass end-to-end as a single shell pipeline, but all of the plan's actual acceptance criteria that are in scope for this task are satisfied: `supabase.types.ts` contains `promotions`, `promotion_availability`, `applied_promotions`, `is_promotion_available`, `evaluate_promotions_for_item`, `stop_pool_session`, and the unchanged 7-arg `create_order_with_items` signature — and no *new* typecheck errors were introduced by the regeneration.

## User Setup Required

None - no external service configuration required. The Supabase push (Task 2) was already completed and verified in the prior session using the project's existing linked Supabase CLI session.

## Next Phase Readiness
- The server-side promotions engine is fully live: schema, RLS, evaluator functions, `create_order_with_items` v3 wiring, `stop_pool_session`, and the HH backfill data are all on the production database.
- `supabase.types.ts` accurately reflects the live schema for all Phase 20 consumers (Plans 20-07 through 20-11).
- Legacy `happy_hour_price`/`happy_hour_start`/`happy_hour_end` columns remain untouched (additive-only) — Plan 20-09's parity verification must run before any column drop (Pitfall 4).
- Two pre-existing, unrelated typecheck failures remain open in `deferred-items.md` for a future cleanup plan.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260710000007_migrate_happy_hour_data.sql`
- FOUND: `src/shared/lib/supabase.types.ts`
- FOUND: `.planning/phases/20-promotions-engine/deferred-items.md`
- FOUND: `.planning/phases/20-promotions-engine/20-06-SUMMARY.md`
- FOUND: commit `c89cb3b` (verified via `git cat-file -e`)
- FOUND: commit `8fc7cf2` (verified via `git cat-file -e`)
