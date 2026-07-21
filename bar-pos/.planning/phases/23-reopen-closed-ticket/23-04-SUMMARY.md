---
phase: 23-reopen-closed-ticket
plan: 04
subsystem: database
tags: [supabase, plpgsql, rpc, migrations, integration-tests, live-db]

# Dependency graph
requires:
  - phase: 23-reopen-closed-ticket
    provides: "Plan 02's 3 migrations (payments.status, tabs.reopen_count/last_reopened_at, reopen_tab RPC) + Plan 03's payment-sum correctness-sweep migration — all written and grep-verified but not yet pushed"
provides:
  - "All 4 Phase 23 migrations (20260720000002..20260720000005) live on the remote Supabase database"
  - "src/shared/lib/supabase.types.ts regenerated from the migrated remote schema (Functions.reopen_tab, payments.status, tabs.reopen_count/last_reopened_at)"
  - "src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts: 9 live tests proving SC-1..SC-4 + the double-count regression against the real, pushed RPC"
affects: ["23-05", "23-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-mutation cap/window test harness: service-role client sets tabs.reopen_count/last_reopened_at directly (bumping version in the SAME UPDATE to satisfy bump_version_on_update), bypassing the RPC to construct otherwise-unreachable precondition states"
    - "Two-payment discriminating regression test: a partial re-payment smaller than the owed total is the only assertion that actually falsifies a reintroduced double-count bug (a full-amount repayment would close the tab whether or not the bug was fixed, since owed <= paid_line is trivially true either way)"

key-files:
  created: []
  modified:
    - src/shared/lib/supabase.types.ts
    - src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts

key-decisions:
  - "npx supabase db push presented an interactive [Y/n] confirmation prompt but did not block — the CLI's default stdin behavior in this Bash tool proceeded and applied all 4 migrations without needing SUPABASE_ACCESS_TOKEN. No auth gate/checkpoint was needed."
  - "The double-count regression test pays a PARTIAL amount ($5 of $20 owed) before paying the remainder, not the full amount in one call. A single full-amount repayment ($20) would close the tab whether the reopened_void exclusion was present or not (buggy paid_line would be $20 voided + $20 new = $40 >= $20 owed; fixed paid_line would be $20 new >= $20 owed — both close). Only a partial payment ($5 new) discriminates: buggy paid_line = $20 voided + $5 new = $25 >= $20 owed (incorrectly closes), fixed paid_line = $5 new < $20 owed (correctly stays open). This is a stronger proof than the plan's literal wording implied and was chosen deliberately."

patterns-established:
  - "Live-DB verification plan pattern (4th instance after Phase 18/22-05's precedent): grep-gate-verified migrations from prior plans are pushed, types regenerated, and Wave-0 it.todo scaffolds converted to real assertions — all in the same BLOCKING plan, since build/type checks alone give a false green without the live push."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "All 4 Phase 23 migrations (20260720000002_payments_status_column, 20260720000003_tabs_reopen_columns, 20260720000004_reopen_tab_rpc, 20260720000005_fix_payment_sums_exclude_reopened_void) applied to the remote database"
    requirement: "SC-1, SC-2, SC-3, SC-4"
    verification:
      - kind: automated
        ref: "npx supabase migration list — all 4 timestamps present in both LOCAL and REMOTE columns, no divergence"
        status: pass
    human_judgment: false
  - id: D2
    description: "supabase.types.ts regenerated from the live schema, includes Functions.reopen_tab and the new payments.status/tabs.reopen_count/tabs.last_reopened_at members; typecheck introduces no new errors"
    requirement: "SC-1, SC-2, SC-3, SC-4"
    verification:
      - kind: automated
        ref: "grep -c reopen_tab (1), grep -c 'reopen_count|last_reopened_at' (6); npm run typecheck shows only the 2 pre-existing documented errors (queries.ts:788, rag.ts:60)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reopen_tab RPC proven live: happy path flips status/clears closed_at/bumps version+reopen_count, voids matching payment(s), STALE_VERSION and AUTH_FORBIDDEN gates enforced"
    requirement: "SC-1"
    verification:
      - kind: automated
        ref: "npx vitest run src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts — 3 SC-1 tests pass against live Supabase"
        status: pass
    human_judgment: false
  - id: D4
    description: "REOPEN_CAP_EXCEEDED (reopen_count>=2, no mutation) and REOPEN_WINDOW_EXPIRED (last_reopened_at >24h ago) both proven live"
    requirement: "SC-3"
    verification:
      - kind: automated
        ref: "2 SC-3 tests pass; cap test additionally asserts tab.status/version/reopen_count unchanged after the ok:false response"
        status: pass
    human_judgment: false
  - id: D5
    description: "A reopen voids every non-refund completed payment sharing a tab_id (split-payment siblings) while leaving is_refund=true rows untouched"
    requirement: "SC-1, SC-2"
    verification:
      - kind: automated
        ref: "D-05 test seeds 2 completed non-refund legs + 1 is_refund=true row; asserts both legs flip to reopened_void and the refund row's status/is_refund are unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "A non-zero voided total inserts exactly one type=expense caja_entries row; a payment-less closed-tab reopen (voided total 0) inserts none"
    requirement: "SC-2"
    verification:
      - kind: automated
        ref: "SC-2 test's two sub-cases both pass in the same test body"
        status: pass
    human_judgment: false
  - id: D7
    description: "A successful reopen writes exactly one audit_logs row (action='tab.reopen', entity_type='tab') with non-null before/after and after.reason equal to the passed reason"
    requirement: "SC-4"
    verification:
      - kind: automated
        ref: "SC-4 test passes"
        status: pass
    human_judgment: false
  - id: D8
    description: "Re-paying a reopened tab via process_payment_atomic does not double-count the reopened_void amount — proven with a discriminating partial-then-full payment sequence, not a single full-amount payment"
    requirement: "SC-1, SC-2"
    verification:
      - kind: automated
        ref: "CRITICAL regression test: $5 partial payment leaves tab 'open' (would incorrectly close to 'paid' if the bug were present), $15 remainder then closes it to 'paid' exactly once"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-21
status: complete
---

# Phase 23 Plan 04: Push Migrations, Regenerate Types, Live Integration Tests Summary

**Pushed all 4 Phase 23 migrations to the remote Supabase database, regenerated `supabase.types.ts`, and converted the Wave-0 `it.todo` scaffold into 9 live tests — all green on the first run — proving SC-1..SC-4 and, via a discriminating partial-payment sequence, that re-paying a reopened tab does not double-count the voided original payment.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-21T04:49:37Z
- **Completed:** 2026-07-21T04:58:15Z
- **Tasks:** 3 (as planned)
- **Files modified:** 2

## Accomplishments

- **[BLOCKING] `npx supabase db push`** applied all four Phase 23 migrations (`20260720000002_payments_status_column`, `20260720000003_tabs_reopen_columns`, `20260720000004_reopen_tab_rpc`, `20260720000005_fix_payment_sums_exclude_reopened_void`) to the remote `bar-pos` project (`shsrhxleopmovzpzqmex`). The CLI presented its normal `[Y/n]` confirmation but did not actually block waiting for interactive input in this environment — the push proceeded and completed cleanly. No `SUPABASE_ACCESS_TOKEN` was needed; the pre-linked CLI session (confirmed via `supabase projects list` showing `bar-pos` as the linked `●` project) was sufficient. `npx supabase migration list` confirms all 4 timestamps present in both LOCAL and REMOTE columns with no divergence.
- **`supabase.types.ts` regenerated** via `npx supabase gen types typescript --project-id shsrhxleopmovzpzqmex`, now containing `Functions.reopen_tab` (with its exact `p_expected_version`/`p_reason`/`p_tab_id` arg shape) and `payments.status` / `tabs.reopen_count` / `tabs.last_reopened_at` on the Row/Insert/Update types. `npm run typecheck` shows only the 2 pre-existing documented errors (`src/entities/tab/model/queries.ts:788`, `src/shared/lib/agent/rag.ts:60`) — no new errors introduced.
- **`reopen-tab-rpc.integration.test.ts` rewritten** from an 8-`it.todo` pending scaffold into 9 live tests, mirroring `edit-paid-tab-rpc.integration.test.ts`'s exact harness (service-role seed/cleanup client, `createAuthStaff`/`signInClient` temp auth users, caja seed/reuse, `cleanupCajaEntryConcepts` pattern). `seedTab` was extended to insert a real `payments` row (`status='completed'`, `is_refund=false`, amount matching the item subtotal) by default, giving the void step and the double-count regression real data to act on. All 9 tests passed on the **first live run** against the newly-migrated remote database:
  1. SC-1 happy path (status→open, closed_at→null, version+1, reopen_count→1, payment→reopened_void)
  2. SC-1 STALE_VERSION
  3. SC-1 AUTH_FORBIDDEN (bartender)
  4. SC-3 REOPEN_CAP_EXCEEDED (reopen_count=2, asserts no mutation)
  5. SC-3 REOPEN_WINDOW_EXPIRED (last_reopened_at 25h ago)
  6. D-05 split-payment sibling void (2 completed legs void, 1 is_refund=true row untouched)
  7. SC-2 caja offset (nonzero voided total → 1 expense row; zero voided total → 0 rows)
  8. SC-4 audit trail (1 `tab.reopen` row, before/after non-null, `after.reason` matches)
  9. **CRITICAL double-count regression** — see Decisions Made below for why this test pays partially before paying in full.

## Task Commits

Each task was committed atomically:

1. **Task 1: [BLOCKING] Apply Phase 23 migrations to the remote database** — no file commit (remote DB state change only; verified via `npx supabase migration list`)
2. **Task 2: Regenerate supabase.types.ts** - `2f56950` (feat)
3. **Task 3: Convert the integration scaffold to live SC-1..SC-4 + regression tests** - `617832b` (test)

_Note: no separate plan-metadata commit is included in this list; SUMMARY.md/STATE.md/ROADMAP.md commit follows this document._

## Files Created/Modified

- `src/shared/lib/supabase.types.ts` (modified) - regenerated from the live remote schema; adds `Functions.reopen_tab`, `payments.status`, `tabs.reopen_count`, `tabs.last_reopened_at`
- `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` (modified) - 8 `it.todo` placeholders replaced with 9 live tests (D-05 split-sibling-void test was net-new, not in the original scaffold, added per this plan's `<behavior>` spec)

## Decisions Made

- **`npx supabase db push`'s `[Y/n]` prompt did not require an auth-gate checkpoint.** The plan anticipated this might block on interactive confirmation (hence `autonomous: false` and the `SUPABASE_ACCESS_TOKEN` user-setup entry), but in this execution environment the push proceeded past the prompt and completed successfully on the first attempt. No checkpoint was surfaced to the user.
- **The double-count regression test pays partially before paying in full, not the full amount in one call.** A single full-amount ($20) repayment would close the tab regardless of whether the reopened_void exclusion bug was present or fixed (buggy: $20 voided + $20 new = $40 >= $20 owed, closes; fixed: $20 new >= $20 owed, also closes) — this would NOT actually prove the fix. The chosen sequence (pay $5, assert still `open`; pay the remaining $15, assert now `paid`) is the only assertion that discriminates: with the bug present, the $5 payment alone would incorrectly close the tab ($20 stale + $5 new = $25 >= $20 owed); with the fix, $5 new < $20 owed correctly keeps it open. This is a stronger proof than the plan's literal behavior wording implied, chosen deliberately during test authoring.
- **`seedTab`'s cleanup deletes `payments` by `tab_id` before deleting the `tabs` row.** `payments.tab_id` has an `ON DELETE RESTRICT` foreign key (the `payments_tab_id_key` UNIQUE constraint was dropped in `20260424000005` allowing multiple payments per tab, but the FK's `RESTRICT` action was untouched) — confirmed via the pre-existing `split-payment-rpc.integration.test.ts`'s identical `cleanup()` helper pattern. Without this, every seeded tab with a payment row would silently fail to delete inside the `safe()` wrapper, leaking rows across test runs.
- **`process_payment_atomic` is called via the service-role `db` client, not `managerClient`**, matching the established `split-payment-rpc.integration.test.ts` precedent — this RPC is `GRANT EXECUTE ... TO service_role` only (called via the edge function's admin client in production), so an authenticated-user JWT would receive a PostgREST permission-denied error.

## Deviations from Plan

### Auto-fixed Issues

None requiring Rule 1/2/3 fixes — both the migration push and the type regeneration matched their acceptance criteria on the first attempt.

**1. [Rule 2 - Added missing test coverage] D-05 split-payment-sibling-void test added, beyond the original 8-item scaffold**
- **Found during:** Task 3 (reading the plan's `<behavior>` block against the original Wave-0 scaffold)
- **Issue:** The Plan 01 scaffold's 8 `it.todo` items did not include a dedicated test for D-05 (split-payment sibling void with an untouched refund row) even though this plan's own `<behavior>` block explicitly required it.
- **Fix:** Added a 9th test seeding two completed non-refund payment legs plus one `is_refund=true` row, asserting the two legs flip to `reopened_void` while the refund row is untouched.
- **Files modified:** `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts`
- **Commit:** `617832b`

## Issues Encountered

None. All three tasks — the blocking push, the type regeneration, and the live test conversion — passed their acceptance criteria on the first attempt with zero live-database failures or retries.

## Auth Gates

None encountered. `npx supabase db push`'s interactive confirmation prompt did not require a checkpoint — see Decisions Made above.

## User Setup Required

None was ultimately needed. The plan's `user_setup` entry (`SUPABASE_ACCESS_TOKEN`, in case the CLI could not present an interactive login) did not apply — the CLI's existing linked session (confirmed via `supabase projects list`) was already sufficient, and the push's confirmation prompt did not block execution in this environment.

## Next Phase Readiness

- All 4 Phase 23 migrations are live on the remote database; `reopen_tab`, `payments.status`, `tabs.reopen_count`, and `tabs.last_reopened_at` all exist and behave exactly as the migration SQL specifies.
- `supabase.types.ts` is current — Plan 05 (the client-facing `useReopenTab` hook + UI) can now type its RPC call against the real generated `Functions.reopen_tab` signature without any `as any` cast or hand-added type members.
- The live integration suite (9/9 passing) is the authoritative proof that the RPC's cap/window/audit/caja-offset/payment-void behavior — and the payment-sum correctness sweep's exclusion of `reopened_void` rows from `process_payment_atomic` — all work correctly against real Postgres, not just grep-verified SQL text.
- No blockers for Plan 05 or Plan 06.

---
*Phase: 23-reopen-closed-ticket*
*Completed: 2026-07-21*

## Self-Check: PASSED
Both modified files (`src/shared/lib/supabase.types.ts`, `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts`) verified present; both task commit hashes (`2f56950`, `617832b`) verified present in git log; all 4 remote migrations verified applied via `npx supabase migration list`.
