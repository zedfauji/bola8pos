---
phase: 14-audit-logs-table
plan: 05
subsystem: database
tags: [supabase, postgres, audit, optimistic-concurrency, tanstack-query]

requires:
  - phase: 14-audit-logs-table (14-02)
    provides: "record_audit(text,text,uuid,jsonb,jsonb,text,text,uuid) 8-arg signature carrying p_terminal_id"
  - phase: 15-tabs-version-optimistic-concurrency
    provides: "tabs.version column + bump_version_on_update trigger (P0V01) + Group A version-guard RPC pattern + parseSupabaseError P0V01/P0V02 mapping + handleVersionError"
provides:
  - "close_tab(uuid, tab_status, int, text) SECURITY DEFINER RPC — version-guarded (P0V01/P0V02), audits 'tab.close'"
  - "useMutationUpdateTabStatus rewired to call close_tab instead of a direct .from('tabs').update() UPDATE"
affects: [14-14]

tech-stack:
  added: []
  patterns:
    - "Group B → Group A migration: a hook-optimistic direct-UPDATE mutation path can be moved into a SECURITY DEFINER RPC without changing its observable STALE_VERSION/NOT_FOUND_VERSIONED contract, because supabaseMutation's parseSupabaseError already maps P0V01/P0V02 the same way it maps PGRST116 — the hook's onSuccess/handleVersionError code needs zero changes."

key-files:
  created:
    - supabase/migrations/20260703000004_close_tab_rpc.sql
  modified:
    - src/entities/tab/model/queries.ts
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "close_tab explicitly sets version = v_current_version + 1 in its UPDATE — bump_version_on_update only VALIDATES new.version = old.version + 1, it does not perform the increment itself, so every writer (Group A and this RPC) must bump explicitly, matching process_payment_atomic/create_order_with_items."
  - "Rule 2 addition (not explicit in the plan): closed_at is now set/cleared consistent with the pre-existing closed_at_requires_closed_status CHECK constraint on tabs. The prior direct-UPDATE hook path never touched closed_at, so any transition into a terminal status would have violated that constraint — latent because the hook has no live UI call site today. close_tab now sets closed_at = COALESCE(closed_at, NOW()) for non-open target statuses and NULL when returning to 'open'."
  - "supabase.types.ts manually extended with a close_tab Functions entry (Docker unavailable for `supabase gen types` regen, per CLAUDE.md workaround) instead of using a `supabase as any` cast — keeps the new rpc('close_tab', ...) call fully typed."

patterns-established:
  - "On RPC success where the RPC returns only {ok:true} (no row), re-fetch the canonical row via the entity's existing list-select string (tabListSelect) + mapTabRow rather than fabricating a Tab from cached data — avoids drift between the optimistic cache and the authoritative post-mutation row."

requirements-completed: [SC3]

duration: ~20min
completed: 2026-07-04
---

# Phase 14 Plan 05: close_tab RPC + useMutationUpdateTabStatus rewire Summary

**close_tab SECURITY DEFINER RPC replaces the direct tabs UPDATE in useMutationUpdateTabStatus, adding an atomic 'tab.close' audit row while preserving the Phase-15 P0V01/P0V02 optimistic-concurrency contract byte-for-byte**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-04T14:05:00Z
- **Completed:** 2026-07-04T14:25:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1** — Authored `supabase/migrations/20260703000004_close_tab_rpc.sql`: `close_tab(p_tab_id uuid, p_status tab_status, p_expected_version int DEFAULT NULL, p_terminal_id text DEFAULT NULL) RETURNS jsonb`, `SECURITY DEFINER`, `SET search_path = public`. Locks the row with `FOR UPDATE`, raises `P0V02` (`NOT_FOUND_VERSIONED`) on a missing tab and `P0V01` (`STALE_VERSION`) on an expected-version mismatch (NULL expected version skips the check, mirroring the hook's prior no-cached-version fallback). Neither SQLSTATE is caught — both propagate to PostgREST/the client unmodified. On the success path only, captures before/after `to_jsonb(tabs)` snapshots and calls `PERFORM record_audit('tab.close', 'tab', p_tab_id, v_before, v_after, 'rpc', p_terminal_id)`. `GRANT EXECUTE ... TO authenticated`. Migration is **not pushed** — deferred to the 14-14 BLOCKING push gate per plan instructions.
- **Task 2 (tdd)** — Rewired `useMutationUpdateTabStatus`'s `mutationFn` in `src/entities/tab/model/queries.ts`: both the version-guarded `.eq('version', expected)` branch and the no-version fallback branch were replaced by a single `supabaseMutation(() => supabase.rpc('close_tab', { p_tab_id, p_status, p_expected_version: expected ?? null, p_terminal_id: TERMINAL_ID }))` call. `expected` is still read from the cached `Result<Tab>` exactly as before. On RPC failure, `supabaseMutation`'s existing `parseSupabaseError` mapping already converts `P0V01`/`P0V02` into the same `AppError` shapes (`STALE_VERSION`/`NOT_FOUND_VERSIONED`) the pre-RPC `PGRST116` branch produced — so `onSuccess`'s `handleVersionError` call required zero changes. On RPC success, since `close_tab` returns `{ok:true}` only (not the row), the hook re-fetches the canonical tab via the existing `tabListSelect` + `mapTabRow` pattern already used by `useVoidOrder`. `onMutate`/`onSuccess`/`onError` bodies are unchanged.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration — close_tab SECURITY DEFINER RPC with version guard + tab.close audit | `717e7fd` | `supabase/migrations/20260703000004_close_tab_rpc.sql` |
| 2 | Rewire useMutationUpdateTabStatus to call close_tab | `9929c41` | `src/entities/tab/model/queries.ts`, `src/shared/lib/supabase.types.ts` |

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `supabase/migrations/20260703000004_close_tab_rpc.sql` - close_tab RPC (new)
- `src/entities/tab/model/queries.ts` - useMutationUpdateTabStatus mutationFn rewired to call the RPC
- `src/shared/lib/supabase.types.ts` - manual `close_tab` Functions entry (Docker unavailable for regen)

## Decisions Made

See `key-decisions` in frontmatter: (1) explicit `version = v_current_version + 1` bump since the trigger only validates, (2) Rule 2 `closed_at` fix to satisfy the pre-existing CHECK constraint that the old direct-UPDATE path silently risked violating (never exercised live — `useMutationUpdateTabStatus` has no current UI call site), (3) manual `supabase.types.ts` extension over an `as any` cast to keep the call fully typed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] closed_at not set/cleared consistent with the tabs CHECK constraint**
- **Found during:** Task 1 (writing the close_tab UPDATE)
- **Issue:** `tabs` has `CONSTRAINT closed_at_requires_closed_status CHECK ((closed_at IS NULL AND status = 'open') OR (closed_at IS NOT NULL AND status IN ('closed','paid','voided')))` (`20260414000004_tabs_and_orders.sql`). The pre-RPC direct `.from('tabs').update({status, ...})` path never touched `closed_at`, so a transition into any terminal status via this path would have raised a Postgres CHECK-constraint violation. This was never observed live because `useMutationUpdateTabStatus` currently has no wired UI call site (confirmed via `grep -rln` across `src/`).
- **Fix:** `close_tab`'s UPDATE sets `closed_at = CASE WHEN p_status = 'open'::tab_status THEN NULL ELSE COALESCE(closed_at, NOW()) END`, matching the constraint and preserving an existing `closed_at` on an idempotent re-close.
- **Files modified:** `supabase/migrations/20260703000004_close_tab_rpc.sql`
- **Verification:** SQL comment documents the reasoning; migration is not yet pushed to remote so this can't be integration-tested until 14-14, but the logic is a direct match to the CHECK constraint's own predicate.
- **Committed in:** `717e7fd` (part of Task 1 commit)

**2. [Rule 3 - Blocking issue] close_tab RPC missing from generated supabase.types.ts**
- **Found during:** Task 2 (typecheck after the rewire)
- **Issue:** `supabase.rpc('close_tab', ...)` has no corresponding entry in `Database['public']['Functions']`, which would either fail typecheck or force an untyped `as any` cast (the CLAUDE.md-documented workaround for missing-types situations, but broader than needed here since the rest of the file's types are intact).
- **Fix:** Added a `close_tab` entry to the `Functions` map in `supabase.types.ts` (alphabetically between `close_caja_session` and `create_order_with_items`), matching the `Args`/`Returns` shape of the migration's RPC signature. `p_status` typed as `Database['public']['Enums']['tab_status']`.
- **Files modified:** `src/shared/lib/supabase.types.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `9929c41` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both fixes were necessary for correctness (CHECK constraint) and to complete the task (typecheck). No scope creep — no new tables, no new UI, no behavioral change beyond what the plan's `<behavior>` block specified.

## Issues Encountered

None beyond the two auto-fixes above. Worktree required `npm install` (fresh checkout, no shared `node_modules`) and `.env.local` copied from the main repo checkout (gitignored, untracked) to run vitest's live-Supabase test-setup probe — same one-time setup noted in 14-02's SUMMARY.

## User Setup Required

None - no external service configuration required. The migration created in Task 1 is **not pushed** to remote Supabase; push is deferred to plan 14-14 (BLOCKING push gate covering all Phase 14 migrations at once).

## Next Phase Readiness

- 14-14's push gate must include `20260703000004_close_tab_rpc.sql` alongside all other Phase 14 migrations.
- The `it.each` coverage scaffold in `audit-actions.test.ts` now shows `close_tab -> tab.close` GREEN (verified: `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts --reporter=verbose` — 7 passed / 5 failed, up from 6/6; the 5 remaining RED cases — `transfer_tab`, `record_stock_movement`, `caja_open`, `produce_prep_batch`, `force_pin_change` — belong to other Wave-2/Wave-3 plans (14-03/14-06/14-07/14-09), not this plan's scope).
- `useMutationUpdateTabStatus` still has no wired UI call site (pre-existing condition, out of scope for this plan) — the RPC and rewire are ready for whichever future plan wires it to a call site, and the CHECK-constraint fix means that wiring will not immediately hit a Postgres error.
- Phase 15 concurrent-edit test suite (`queries.concurrent.test.ts`) remains green — confirmed unaffected since it exercises an independent in-memory simulation, not the real hook.

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260703000004_close_tab_rpc.sql`
- FOUND: `src/entities/tab/model/queries.ts` (modified)
- FOUND: `src/shared/lib/supabase.types.ts` (modified)
- FOUND commit `717e7fd` (Task 1)
- FOUND commit `9929c41` (Task 2)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
