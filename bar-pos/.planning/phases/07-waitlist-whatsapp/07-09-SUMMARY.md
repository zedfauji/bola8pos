---
phase: 07-waitlist-whatsapp
plan: 09
subsystem: database
tags: [postgres, plpgsql, supabase, rpc, pg_net, waitlist, pool-sessions]

requires:
  - phase: 07-waitlist-whatsapp (earlier plans)
    provides: waitlist_entries table + trg_waitlist_notify trigger (assumed pg_net, never had it)
  - phase: 26 (resources rename)
    provides: resources.table_type CHECK ('pool','carom','consumption','floating'), resource_status enum
provides:
  - "public.start_pool_session(uuid, uuid) RETURNS jsonb — atomic pool-session start with FOR UPDATE occupancy guard"
  - "public.seat_waitlist_party_and_start_session(uuid, uuid, uuid, uuid, uuid) RETURNS jsonb — atomic seat->tab->session wrapper"
  - "pg_net extension enabled on the live Supabase project"
  - "regenerated src/shared/lib/supabase.types.ts with both new RPC signatures"
affects: [07-10, 07-11]

actuals:
  tokens: 4900
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC re-asserting the RLS policy it bypasses as its first statement (get_user_role() gate)"
    - "Nested RPC-calls-RPC atomicity: a RAISE EXCEPTION guard on a called function's jsonb ok:false result, since a plain plpgsql RETURN does not roll back the caller's already-committed-within-transaction writes"

key-files:
  created:
    - supabase/migrations/20260807000001_pool_session_atomic_rpcs.sql
  modified:
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "D-08 fix implemented as CREATE EXTENSION IF NOT EXISTS pg_net only — no trigger rewrite, per plan"
  - "start_pool_session keeps zero role gate (bartender-accessible today via start_pool_timer); seat_waitlist_party_and_start_session re-asserts the manager+ RLS policy it bypasses"
  - "consumption branch deliberately never writes resources.status — nothing in the codebase clears it without a session to stop"

patterns-established:
  - "RAISE EXCEPTION ... USING errcode = 'P0S01' as the load-bearing atomicity guard when one SECURITY DEFINER RPC calls another and must abort the whole transaction on the callee's soft ok:false failure"

requirements-completed: []

coverage:
  - id: D1
    description: "start_pool_session(uuid, uuid) and seat_waitlist_party_and_start_session(uuid, uuid, uuid, uuid, uuid) exist live, SECURITY DEFINER, and the waitlist RPC calls the shared one rather than duplicating its body (D-04)"
    verification:
      - kind: integration
        ref: "live DB: SELECT proname, prosecdef FROM pg_proc WHERE proname IN (...) returned 2 rows, both prosecdef=true"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seating a waitlist party at a pool table creates a tab with customer_name = \"{name} ({party_size})\" (D-01)"
    verification:
      - kind: integration
        ref: "live DB rolled-back transaction: tabs.customer_name = 'García (4)' asserted verbatim"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seat->open-tab->start-timer is all-or-nothing; a forced tab-insert failure leaves waitlist_entries.status still 'waiting', no tabs row, no pool_sessions row (D-02)"
    verification:
      - kind: integration
        ref: "live DB: seat_waitlist_party_and_start_session called with a nonexistent p_staff_id, FK violation 23503 raised; post-failure SELECT confirmed status='waiting', table_id IS NULL, 0 tabs/pool_sessions rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "pool/carom tables get tab+session; consumption gets tab only with no pool_sessions row and untouched resources.status; floating gets neither (D-06)"
    verification:
      - kind: integration
        ref: "live DB: 3 scenarios (consumption, carom, floating) each run in a rolled-back transaction against a throwaway resource+entry, assertions matched exactly"
        status: pass
    human_judgment: false
  - id: D5
    description: "pg_net is enabled on the live project; net.http_post resolves and the previously-broken notify UPDATE now succeeds (D-08)"
    verification:
      - kind: integration
        ref: "live DB: pg_extension row for pg_net; net.http_post proc lookup returned 1 row; UPDATE waitlist_entries SET status='notified' on a throwaway row succeeded (previously raised schema \"net\" does not exist)"
        status: pass
    human_judgment: false
  - id: D6
    description: "supabase.types.ts regenerated (or as-any fallback explicitly recorded) and npm run typecheck green"
    verification:
      - kind: integration
        ref: "npm run typecheck (exit 0); grep confirms both new function names present in the generated Functions block"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-07
status: complete
---

# Phase 07 Plan 09: Atomic Pool-Session RPCs + pg_net Enable Summary

**Two SECURITY DEFINER Postgres RPCs (`start_pool_session`, `seat_waitlist_party_and_start_session`) make "seat waitlist party → open tab → start pool timer" a single atomic transaction, plus `pg_net` finally enabled on the live project so the year-old broken WhatsApp-notify trigger works.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 created, 1 regenerated)
- **Commits:** 2

## Accomplishments
- Authored and pushed `supabase/migrations/20260807000001_pool_session_atomic_rpcs.sql` containing `CREATE EXTENSION IF NOT EXISTS pg_net`, `start_pool_session(uuid, uuid)`, and `seat_waitlist_party_and_start_session(uuid, uuid, uuid, uuid, uuid)`.
- Proved the full pool happy path end-to-end against real rows in a rolled-back transaction: entry seated, tab `customer_name = 'García (4)'`, matching `pool_sessions` row.
- Regenerated `src/shared/lib/supabase.types.ts` — both new RPCs now typed for 07-10/07-11 to call without a cast. `npm run typecheck` and `npm run lint` both green.
- Smoke-tested D-08: `net.http_post` resolves, and the previously-broken `UPDATE waitlist_entries SET status='notified'` (which aborted with `schema "net" does not exist` since Phase 7 shipped) now succeeds.
- Proved all four D-06/D-02 scenarios against the live database: consumption (tab only, no session, `resources.status` untouched), carom (tab + session + `resources.status='occupied'`, identical to pool), floating (neither tab nor session, entry still seated), and a forced FK-violation failure (zero partial writes — full D-02 rollback proof).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author both atomic RPCs + pg_net in one migration, push it, and prove the pool happy path** - `1f670b6` (feat)
2. **Task 2: Regenerate Supabase types + smoke-test the pg_net notify path** - `3f50e67` (chore)
3. **Task 3: Prove the D-06 branch and D-02 rollback against the live database** - no files modified (live-DB-only verification task; see evidence below)

**Plan metadata:** committed by orchestrator per worktree convention (STATE.md/ROADMAP.md not touched here).

## Files Created/Modified
- `supabase/migrations/20260807000001_pool_session_atomic_rpcs.sql` - pg_net extension + both atomic RPCs
- `src/shared/lib/supabase.types.ts` - regenerated; both new RPCs now typed, plus unrelated pre-existing schema drift (see Deviations)

## Migration & Function Details

**Migration filename:** `supabase/migrations/20260807000001_pool_session_atomic_rpcs.sql`

**Route used to enable pg_net:** `CREATE EXTENSION IF NOT EXISTS pg_net;` inside the migration itself succeeded on the first `supabase db push` — no Dashboard fallback was needed (the project had sufficient privilege).

**Final signatures (both live, confirmed via `pg_proc`):**
- `public.start_pool_session(p_table_id uuid, p_tab_id uuid) RETURNS jsonb` — `prosecdef = true`
- `public.seat_waitlist_party_and_start_session(p_entry_id uuid, p_table_id uuid, p_staff_id uuid, p_shift_id uuid, p_caja_session_id uuid) RETURNS jsonb` — `prosecdef = true`

**Type regeneration:** Succeeded via `npx supabase gen types typescript --linked`. Both `start_pool_session` and `seat_waitlist_party_and_start_session` appear in the generated `Functions` block — the `as any` fallback is NOT needed for 07-10/07-11.

## Task 1 Verbatim Evidence — Pool Happy Path

Rolled-back transaction: throwaway `waitlist_entries` row (`name='García', party_size=4, status='waiting'`), throwaway `available` `pool`-type resource (real project had none available; created one inline per the plan's fallback clause), real `staff_id`/`shift_id`/`caja_session_id` read from existing open-shift/open-caja rows.

```json
{
  "entry_status": "seated",
  "tab_customer_name": "García (4)",
  "pool_session_id": "18199fa5-2ac0-4597-b6a3-5670c3e6f814",
  "session_tab_id": "38a77171-f6ff-4469-bb45-7c362f714491"
}
```

Post-rollback fixture check: `waitlist_entries` count for name `'García'` = 0, `resources` count for the throwaway number = 0.

## Task 2 Verbatim Evidence — pg_net Notify Smoke Test

```sql
-- net.http_post lookup
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'net' AND p.proname = 'http_post';
-- => count = 1

-- rolled-back UPDATE (previously raised: schema "net" does not exist)
UPDATE waitlist_entries SET status = 'notified' WHERE name = '__pg_net_smoke_test__' AND status = 'waiting'
RETURNING id, status, notified_at;
-- => { "id": "60ae64ba-...", "status": "notified", "notified_at": null }
```

`npm run typecheck` exit 0. Fixture check after rollback: 0 rows for `__pg_net_smoke_test__`.

## Task 3 Verbatim Evidence — D-06/D-02 Scenarios

All four scenarios run against the live database, each with its own throwaway `waitlist_entries` row and a throwaway `resources` row of the required type (none pre-existing `available` pool/carom/consumption/floating resources were found live).

**Scenario 1 — consumption (tab only, D-06):**
```json
{
  "rpc_result": { "ok": true, "tab_id": "b6a42367-4f48-4993-b152-7fe2f16cb6c4", "session": null },
  "entry_status": "seated",
  "session_count": 0,
  "resource_status": "available"
}
```
Rolled back — 0 fixture rows remain.

**Scenario 2 — carom (tab + session, treated identically to pool, D-06):**
```json
{
  "rpc_result": {
    "ok": true,
    "tab_id": "ce7d1e22-fc92-4b13-9db7-d58a86e55c69",
    "session": { "id": "c55dd807-d4eb-408d-8999-a4b888e9a5f4", "table_id": "056626df-288f-4883-a14c-2bf5a3a32575", "tab_id": "ce7d1e22-fc92-4b13-9db7-d58a86e55c69", "version": 1, "stopped_at": null, "started_at": "2026-08-07T18:59:30.515413+00:00" }
  },
  "entry_status": "seated",
  "session_count": 1,
  "resource_status": "occupied",
  "resource_current_session_id": "c55dd807-d4eb-408d-8999-a4b888e9a5f4"
}
```
Rolled back — 0 fixture rows remain.

**Scenario 3 — floating (neither tab nor session, D-05/D-06):**
```json
{
  "rpc_result": { "ok": true, "tab_id": null, "session": null },
  "entry_status": "seated",
  "session_count": 0,
  "tab_count": 0
}
```
Rolled back — 0 fixture rows remain.

**Scenario 4 — forced failure, full rollback (D-02):**
```
Call errored (expected): ERROR 23503 (foreign_key_violation) on "tabs_staff_id_fkey"
DETAIL: Key (staff_id)=(00000000-0000-0000-0000-000000000000) is not present in table "profiles".
CONTEXT: PL/pgSQL function seat_waitlist_party_and_start_session(...) line 58 at SQL statement

Post-failure assertion (fresh call):
{ "status": "waiting", "table_id": null }
{ "tab_count": 0, "session_count": 0, "resource_status": "available" }
```
Fixtures for this scenario were committed (required so the failing call and the post-failure assertion could run as separate connections) then explicitly `DELETE`d afterward. Final fixture check across all four scenarios: `waitlist_entries` count for `name LIKE '__d0%'` = 0, `resources` count for numbers 9101/9102/9103/9104 = 0.

## Decisions Made
- pg_net enabled via a plain `CREATE EXTENSION IF NOT EXISTS` inside the migration — no Dashboard fallback was required.
- `start_pool_session` kept with zero role gate per the plan's explicit rationale (matches `remove_tab_item` precedent); `seat_waitlist_party_and_start_session` re-asserts the `waitlist_entries_update_manager` RLS policy it bypasses as its very first statement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an accidental duplicate `SECURITY DEFINER` phrase from an in-body comment**
- **Found during:** Task 1's own structural verify gate (`grep -c "SECURITY DEFINER"` returned 3, expected exactly 2)
- **Issue:** An explanatory comment inside `seat_waitlist_party_and_start_session`'s body literally used the phrase "SECURITY DEFINER function bypasses", which the plan's grep-based verify counts alongside the two real `LANGUAGE plpgsql SECURITY DEFINER` declarations.
- **Fix:** Reworded the comment to "this function bypasses by running as the table owner" — same meaning, no longer collides with the grep pattern.
- **Files modified:** `supabase/migrations/20260807000001_pool_session_atomic_rpcs.sql`
- **Verification:** Re-ran the exact verify-gate grep; count is now 2.
- **Committed in:** `1f670b6` (Task 1 commit — caught before commit, no separate fix commit needed)

**2. [Rule 3 - Blocking] `node_modules` was missing in this worktree; ran `npm ci`**
- **Found during:** Task 2 (`npm run typecheck` failed with `tsc: not found`)
- **Issue:** This worktree checkout had no `node_modules` at all (a fresh worktree, not the platform-mismatch case CLAUDE.md documents for Windows→Ubuntu migrations).
- **Fix:** Ran `npm ci` (project-standard lockfile install, not a new dependency — excluded from the package-legitimacy checkpoint requirement, which only applies to installing a new/unverified package).
- **Files modified:** none (node_modules is gitignored)
- **Verification:** `npm run typecheck` and `npm run lint` both passed afterward.
- **Committed in:** N/A — no files to commit (node_modules gitignored)

---

**Total deviations:** 2 auto-fixed (1 bug/self-caught verify-gate collision, 1 blocking/environment bootstrap)
**Impact on plan:** Both trivial, no scope creep. Neither touched the RPC logic itself.

## Known Stubs

None — this plan is server-only (migration + type regeneration); no client-side stubs were introduced.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-0709-01 through T-0709-06, T-0709-SC) — no new trust boundaries were introduced during execution.

## Issues Encountered
- Live project had zero `available` pool/carom/consumption/floating resources at execution time (all pool/carom tables were `occupied` from prior test/demo data, and no consumption/floating resources existed yet). Resolved per the plan's explicit fallback: created a throwaway resource row of the needed type inside each rolled-back (or, for Scenario 4, explicitly cleaned-up) transaction.
- `supabase db query` (used in place of interactive `psql`/Supabase MCP tools, neither of which was available in this execution environment) executes each invocation as its own connection — an open `BEGIN` does not survive across separate tool calls. Worked around by keeping each scenario's full lifecycle (fixture insert → RPC call → assertions → `ROLLBACK`) inside a single `supabase db query` invocation, except Scenario 4 where the RPC call must fail as its own atomic unit — its fixtures were committed, then explicitly deleted after assertions.
- Regenerating `supabase.types.ts` surfaced pre-existing, unrelated schema drift never previously synced: the `open_units` table + 4 RPCs (`open_open_unit`, `consume_open_unit`, `correct_open_unit`, `void_open_unit`) and `products.parent_product_id`/`products.units_per_package` columns, all from the `20260729*` migration batch. Kept as-is per CLAUDE.md's "generated files are never hand-edited" rule; not this plan's scope to investigate further.

## User Setup Required

None - no external service configuration required. `pg_net` and both RPCs are live on the shared Supabase project; no per-developer setup needed.

## Next Phase Readiness

Both RPCs (`start_pool_session`, `seat_waitlist_party_and_start_session`) are live, `SECURITY DEFINER`, typed in `supabase.types.ts`, and their full success/failure contract (D-01, D-02, D-04, D-06, D-08) has been demonstrated against real data. Plans 07-10 and 07-11 can proceed with client-side wiring — no further database work is required from this plan.

---
*Phase: 07-waitlist-whatsapp*
*Completed: 2026-08-07*
