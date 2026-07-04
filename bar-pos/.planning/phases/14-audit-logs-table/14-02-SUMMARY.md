---
phase: 14-audit-logs-table
plan: 02
subsystem: database
tags: [supabase, postgres, audit, edge-functions, vitest]

requires: ["14-01"]
provides:
  - "record_audit(text,text,uuid,jsonb,jsonb,text,text,uuid) — 8-arg signature carrying p_terminal_id + p_user_id"
  - "supabase/functions/_shared/audit.ts writes actor_id + terminal_id for edge-sourced audit rows"
  - "TARGET_RPCS coverage scaffold in audit-actions.test.ts (4 green, 6 pending Wave-2/Wave-3)"
affects: [14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09, 14-14]

tech-stack:
  added: []
  patterns:
    - "record_audit() additive-signature migration: DROP the old fixed-arity overload, then CREATE the single wider overload with new trailing DEFAULT NULL params, so existing positional callers keep resolving without ambiguity"
    - "it.each per-RPC coverage test — each target RPC gets its own named test result (visible pass/fail per fn), rather than one aggregate assertion, so a scaffold test can show partial coverage without masking which RPCs still need wiring"

key-files:
  created:
    - supabase/migrations/20260703000001_record_audit_terminal_id.sql
  modified:
    - supabase/functions/_shared/audit.ts
    - src/shared/lib/__tests__/audit-actions.test.ts

key-decisions:
  - "record_audit/6 is DROPped (not left alongside a new /8 overload) because Postgres would otherwise register two overloads that are both satisfiable by 6 positional args once the 2 new trailing params default to NULL, making every existing 6-arg PERFORM call site ambiguous (42725 error). A single /8 overload is defined instead."
  - "v_actor_id := COALESCE(p_user_id, auth.uid()) — lets trusted server-side callers (OfflineQueueProcessor's discard-audit path) explicitly attribute an actor while normal RPC callers omitting p_user_id keep deriving the actor from the JWT."
  - "The RPC-coverage scaffold test uses it.each so each of the 10 target RPCs produces its own named vitest result; 6 are expected to fail until their Wave-2/Wave-3 migrations land (14-03..14-09) per the plan's explicit scaffold design — this is not a regression, the overall test file intentionally reports RED until 14-14's final gate."

patterns-established:
  - "Edge-function audit helper (_shared/audit.ts) now mirrors the RPC path's terminal_id/actor_id capture — future edge functions (e.g. void-order in 14-07) should pass actorId/terminalId explicitly since service-role clients bypass auth.uid()."

requirements-completed: [SC4, SC5]

duration: ~40min
completed: 2026-07-04
---

# Phase 14 Plan 02: record_audit terminal_id/actor_id + edge helper + coverage scaffold Summary

**Additive record_audit(text,text,uuid,jsonb,jsonb,text,text,uuid) signature carries terminal_id + actor override; edge audit helper gains actorId/terminalId; per-RPC coverage scaffold (it.each, 4 green / 6 pending) drives Wave-2/Wave-3 wiring**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-04T19:20:00Z
- **Completed:** 2026-07-04T20:03:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1** — Authored `supabase/migrations/20260703000001_record_audit_terminal_id.sql`: `DROP FUNCTION IF EXISTS record_audit(text, text, uuid, jsonb, jsonb, text)` followed by a single `CREATE FUNCTION record_audit(...)` with the original 6 params plus `p_terminal_id text DEFAULT NULL, p_user_id uuid DEFAULT NULL`. Preserved verbatim: `SECURITY DEFINER`, `SET search_path = public`, the 64KB truncation guards on `v_before`/`v_after`, and the `EXCEPTION WHEN OTHERS -> RAISE WARNING + RETURN NULL` fire-and-forget contract. Two behavioral changes: `v_actor_id := COALESCE(p_user_id, auth.uid())` and `terminal_id` added to the INSERT column list. `GRANT EXECUTE ... TO authenticated` re-issued for the new 8-arg signature. Matching `DOWN:` block included that restores the original 6-arg definition. Migration is **not pushed** in this plan — push is BLOCKING at 14-14 per plan instructions.
- **Task 2 (tdd)** — Extended `supabase/functions/_shared/audit.ts`: `AuditParams` gains `actorId?: string | null` and `terminalId?: string | null`; the `.from('audit_logs').insert({...})` object now writes `actor_id: params.actorId ?? null` and `terminal_id: params.terminalId ?? null`. The fire-and-forget try/catch structure, `console.error` logging shape, and `source ?? 'edge'` default were left untouched.
- **Task 3** — Extended `src/shared/lib/__tests__/audit-actions.test.ts` with a `TARGET_RPCS` array of 10 `{fn, action}` pairs and a new `it.each` test (`every migration-wired target RPC calls record_audit`) asserting, per RPC, that (a) the function is defined (`CREATE (OR REPLACE) FUNCTION <fn>(`) somewhere across all migration files and (b) a `PERFORM record_audit('<action>', ...)` call exists in the same concatenated SQL corpus. Comment lines (`^\s*--.*$`) are stripped before matching so migration-header prose cannot self-satisfy the grep. Ran the test file directly to confirm the expected split: **4 pass** (`process_payment_atomic`, `process_refund`, `close_caja_session`, `add_combo_to_tab` — all wired by the pre-existing `20260511000002_rpc_audit_wiring.sql`), **6 RED** (`transfer_tab`, `record_stock_movement`, `caja_open`, `close_tab`, `produce_prep_batch`, `force_pin_change` — confirmed via grep that `transfer_tab`/`record_stock_movement` exist as functions but have no `record_audit` call, and that `caja_open`/`close_tab`/`produce_prep_batch`/`force_pin_change` do not exist as functions in any migration at all yet).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration — add p_terminal_id + p_user_id to record_audit() | `0b497ce` | `supabase/migrations/20260703000001_record_audit_terminal_id.sql` |
| 2 | Add actorId to the Edge Function audit helper | `189992a` | `supabase/functions/_shared/audit.ts` |
| 3 | Extend the CI grep test to assert per-RPC record_audit coverage (scaffold) | `014becf` | `src/shared/lib/__tests__/audit-actions.test.ts` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` — Task 1 verify: 2/2 pre-existing tests pass (ran before Task 3's new test existed).
- `grep -q "actor_id: params.actorId" supabase/functions/_shared/audit.ts && grep -q "actorId" supabase/functions/_shared/audit.ts && echo OK` — Task 2 verify: `OK`.
- `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts --reporter=verbose` — Task 3 verify: **12 tests total, 6 passed / 6 failed** — exactly matching the plan's documented scaffold expectation (2 pre-existing + 4 already-wired RPC tests green; 6 not-yet-wired RPC tests red). This is a **known/expected RED state**, not a regression — the plan explicitly designs this test to be fully green only after 14-03 through 14-09 land, enforced at the 14-14 gate.
- `npm run typecheck` — exit 0 (Deno `_shared/audit.ts` is outside the Vite tsconfig by design; verified via grep per plan instructions, not typecheck).
- `npx eslint src/shared/lib/__tests__/audit-actions.test.ts` — clean.

## Deviations from Plan

None - plan executed exactly as written. One implementation choice made where the plan left room for interpretation: the plan's `<action>` text for Task 3 described the coverage assertion in terms of "assert the concatenated SQL contains ... AND a PERFORM record_audit(...)" without specifying whether this should be one aggregate `it()` or per-RPC. Chose `it.each` over a single aggregate `it()` so that vitest's own reporter naturally shows "4 passed / 6 failed" per-RPC (matching the acceptance criteria's literal wording: "the 4 already-wired RPC assertions PASS immediately; the 6 not-yet-wired assertions are RED") rather than folding all 10 checks into one pass/fail boolean. This is a test-structure choice, not a scope change — no user decision needed (Rule 1/3 territory: implementation detail required to satisfy the acceptance criteria as literally stated).

## Issues Encountered

- The worktree had no `node_modules` (fresh git checkout, no shared install) and no `.env.local` (gitignored, not tracked). Ran `npm install` (1240 packages, ~44s) and copied `.env.local` from the main repo checkout so `npx vitest run` could connect to the live Supabase test-setup probe in `src/test/global-setup.ts`. Neither is part of this plan's deliverables — noted here for visibility only.
- `.planning/` is entirely gitignored in this repo except a handful of previously force-added files (`07-REVIEW.md`, `07-VERIFICATION.md`, `14-01-SUMMARY.md`). PLAN.md, PROJECT.md, STATE.md, and config.json were read from the main repo's working tree (not the worktree) since they are untracked and therefore absent from a fresh worktree checkout. This SUMMARY.md is being force-added/committed per the parallel-execution instructions (worktree mode still commits SUMMARY.md/REQUIREMENTS.md even though `.planning/` is otherwise gitignored).

## User Setup Required

None - no external service configuration required. The migration created in Task 1 is **not pushed** to remote Supabase; push is explicitly deferred to plan 14-14 (BLOCKING push gate covering all Phase 14 migrations at once).

## Next Phase Readiness

- 14-03 (RPC wiring wave) can proceed: `record_audit/8` is defined additively so `transfer_tab` and `record_stock_movement` migrations can safely add `PERFORM record_audit('tab.transfer', ...)` / `PERFORM record_audit('inventory.manual_adjust', ...)` calls, which will flip 2 of the 6 currently-RED `it.each` cases to green.
- 14-07 (void-order edge function, building from scratch per 14-01) and any other new edge functions should pass `actorId`/`terminalId` explicitly into `recordAudit(...)` now that the helper supports both.
- 14-09 (force_pin_change RPC, building fresh per 14-01) should wire `PERFORM record_audit('permission.force_pin_change', ...)` into its new RPC body to flip the corresponding `it.each` case green.
- 14-14's push gate must include `20260703000001_record_audit_terminal_id.sql` alongside all other Phase 14 migrations.
- The `it.each` coverage scaffold in `audit-actions.test.ts` will only reach a fully green `npm run test` run once 14-03 through 14-09 have all landed their respective `PERFORM record_audit(...)` calls — until then, `npm run test` will report these 6 specific sub-test failures by design; this is documented so no future session mistakes it for a regression.

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
