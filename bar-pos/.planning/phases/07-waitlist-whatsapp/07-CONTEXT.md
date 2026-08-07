# Phase 07: Waitlist + WhatsApp - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This is a scope addition to the already-executed Phase 7 (waitlist-whatsapp), discovered as a gap during a `/gsd-plan-phase 7 --gaps` session: seating a waitlist party at an existing table currently only assigns `table_id` on the waitlist entry — it never creates a tab or starts the pool timer, leaving staff to do those as two disconnected manual steps on `/pool-tables`. This phase adds automatic tab-creation and (where applicable) automatic pool-timer-start as part of the existing-table seat action, plus a live-environment bug fix folded in from the backlog (pg_net extension missing, breaking notify-waitlist entirely).

**In scope:**
- Auto-create a tab when a waitlist party is seated at an **existing** table (not the "seat at a new temporary table" path)
- Auto-start the pool timer too, but only for `pool`/`carom` type tables — `consumption`-type tables get a tab only, no timer (they have no rate/timer concept)
- A new shared, atomic Postgres RPC replacing the current 2-step sequential writes inside `useMutationStartSession`, used by both this new waitlist path and the existing manual `/pool-tables` → `StartSessionSheet` flow
- Enable the `pg_net` Postgres extension on the live Supabase project to fix the currently-broken `notify-waitlist` trigger

**Out of scope (this phase):**
- The "seat at a new temporary table" path (`useSeatAtNewTable`, Phase 26) — stays fully manual, no auto-tab/auto-timer
- Any manual override/skip toggle for auto-start — the new behavior is unconditional (branches only on table type, never on staff choice)
- Rewriting the `trg_waitlist_notify` trigger itself — the pg_net fix is "enable the extension," not "redesign the notification mechanism"

</domain>

<decisions>
## Implementation Decisions

### Tab naming
- **D-01:** Auto-created tabs use the waitlist party's name plus party size as the customer name, e.g. `"García (4)"` — read from `waitlist_entries.name` and `waitlist_entries.party_size` (both required, non-null fields). This diverges from `StartSessionSheet`'s existing `"Pool {table.label}"` convention, which is unaffected for the manual flow.

### Failure/rollback semantics
- **D-02:** Seat→open-tab→start-timer is atomic, not sequential-best-effort. This is a deliberate departure from existing precedent in this codebase (`useMutationStartSession` today does 2 sequential non-atomic Supabase calls; `useSeatAtNewTable` composes `addResource`+`seatParty` the same non-atomic way) — the user explicitly chose atomic over matching precedent. — **Reversibility:** costly — undoing this means reverting a new RPC and its call sites back to sequential client-side calls across two features.
- **D-03:** The atomic RPC is **shared** between this new waitlist path and the existing manual `/pool-tables` → `StartSessionSheet` flow — not waitlist-only. It must be swapped in **behind `useMutationStartSession`'s current public interface** (`{tableId, tabId}` → `Result<PoolSession>`), so `StartSessionSheet` and `OfflineQueueProcessor` (both existing callers, confirmed via grep — `OfflineQueueProcessor` replays this mutation for actions queued while offline) need **no code changes**, only the internals of the hook change. — **Reversibility:** one-way — **rationale:** this is a live-project Postgres function; once the manual flow depends on it, dropping it means coordinating a migration rollback plus reverting `useMutationStartSession`'s internals, and any in-flight offline-queued "start session" actions replaying against the old vs. new shape need to be considered.
- **D-04:** Two Postgres functions, not one parameterized function: `start_pool_session(table_id, tab_id)` — the shared/base RPC covering open-tab-already-created + start-session, used by both flows — and `seat_waitlist_party_and_start_session(entry_id, table_id, ...)` — a waitlist-specific wrapper that also updates `waitlist_entries` (`status='seated'`, `table_id`, `seated_at`) in the same transaction. The waitlist RPC calls/wraps the shared one rather than the shared RPC taking an optional waitlist parameter.

### Scope — which seat paths + table-type branching
- **D-05:** Only the existing-table seat path (`useSeatWaitlistParty` / the main `SeatPartySheet` table picker) gets this automation. The seat-at-a-new-temporary-table path (`useSeatAtNewTable`, Phase 26's floating tables) is explicitly out of scope and stays fully manual.
- **D-06:** `resources.tableType` is a 4-value enum: `'pool' | 'carom' | 'consumption' | 'floating'`. Branch on it: for `pool`/`carom` tables, auto-create the tab **and** start the pool timer (call `seat_waitlist_party_and_start_session`). For `consumption` tables (regular bar/dining tables — no rate, no timer concept), auto-create the tab **only**, skip the pool-session step entirely. This is unconditional — no manual toggle to skip either behavior for any table type.
- **D-07 (codebase fact, not a decision):** No query changes needed for the table picker. `SeatPartySheet`'s `usePoolTables()` query already selects `table_type` for every resource row, unfiltered by type — the data needed for the D-06 branch is already available client-side today.

### pg_net remediation (folded todo)
- **D-08:** Fix is `CREATE EXTENSION IF NOT EXISTS pg_net;` on the live Supabase project — matches the existing `trg_waitlist_notify` trigger's async-HTTP design (it calls `net.http_post` to invoke the `send-waitlist-notification` edge function). Not a trigger rewrite. — **Reversibility:** reversible — extension can be dropped if this turns out to be the wrong call, no data/schema dependency created beyond the trigger that already assumed it existed.

### Claude's Discretion
- Exact RPC parameter shapes/return types for `start_pool_session` and `seat_waitlist_party_and_start_session` (beyond the names and composition relationship locked in D-04)
- Whether `start_pool_session` still needs a `tab_id` to already exist as a parameter, or whether tab-creation itself also happens inside the shared RPC (needs research into whether `tabs` inserts belong in the same Postgres function or stay a separate client-side `useOpenTab` call before invoking the RPC)
- Exact error/toast copy when the atomic RPC fails
- Whether `carom` tables need any distinct handling from `pool` tables beyond "both get timer + tab" (no evidence found of behavioral differences between the two in current code — treat identically unless research finds otherwise)

### Folded Todos
- **`.planning/todos/pending/2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md`** ("Notify-waitlist UPDATE fails outright — 'net' schema does not exist (pg_net not enabled)", severity: major) — folded into this phase's scope per D-08. Original problem: `useNotifyWaitlist.ts`'s plain `UPDATE waitlist_entries` fails outright against the live project because the `net` schema doesn't exist, and a Postgres trigger exception rolls back the entire statement — `notify-waitlist` is completely non-functional in the live environment right now, not just showing stale UI.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's existing artifacts
- `.planning/phases/07-waitlist-whatsapp/07-VERIFICATION.md` — the fresh (2026-08-06) re-verification report; confirms CR-01/CR-02 from the original 2026-04-25 report are closed, and lists the still-open `human_needed` items (live E2E run, 3 human UAT scenarios) that are separate from this new scope
- `.planning/phases/07-waitlist-whatsapp/07-HUMAN-UAT.md` — existing human UAT tracker, still 0/3 pending; not addressed by this phase
- `.planning/phases/26-floating-tables-is-temp/` — origin of `useSeatAtNewTable` / the `floating` resource type and `isTemp` flag, referenced by D-05/D-06 (out-of-scope path)

### Folded todo
- `.planning/todos/pending/2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md` — full pg_net failure writeup, see D-08

### RBAC
- `src/shared/lib/rbac.ts` — confirms `manage_waitlist` (manager+) already inherits `start_pool_timer` and `create_order` (both bartender-level, and `MANAGER_ACTIONS = [...BARTENDER_ACTIONS, ...MANAGER_EXTRA]`) — no new RBAC action or gating needed for this feature

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/start-pool-timer/ui/StartSessionSheet.tsx` — proves out the exact `openTab` → `startSession` composition this phase needs to make atomic; its "auto-create new tab" branch (lines ~61-80) is the closest existing analog for tab-naming/creation logic
- `src/entities/resource/model/queries.ts` `useMutationStartSession` (lines ~225-270+) — the function to be refactored per D-03; currently does `pool_sessions` insert then `resources` status update as two separate `supabaseMutation` calls
- `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` — the existing `seatParty`/`useSeatAtNewTable` hooks; `useSeatAtNewTable`'s doc comment already documents the "composes X with existing Y" pattern this phase extends

### Established Patterns
- FSD: mutation hook + 1 UI component per feature folder — a new/extended `seat-waitlist-party` feature (or a modification within it) is the right home, not a new top-level feature, since it's extending the existing seat action rather than a new user action
- `Result<T>` (`ok`/`err`) return type convention from `src/shared/lib/result.ts` — the new RPC-backed mutations must follow this, matching every other mutation in the codebase
- `const db = supabase as any` + file-level eslint-disable is the documented workaround (per CLAUDE.md) for calling a not-yet-typed RPC before `supabase.types.ts` is regenerated

### Integration Points
- `SeatPartySheet.tsx` is the single call site needing modification to route through the new atomic path when seating at an existing table (vs. `useSeatAtNewTable`'s separate, untouched call site)
- `OfflineQueueProcessor.tsx` replays `useMutationStartSession`'s mutation for offline-queued actions — must keep working unchanged per D-03's interface-preservation requirement

</code_context>

<specifics>
## Specific Ideas

User's own words on the trigger for this phase: "make sure waitlist -> assign pool table -> new tab gets created automatically -> pool timer automatically starts." Then, on discovering the consumption-table nuance mid-discussion: "Seating doesn't not always start the timer, Sometime party comes and they get to be seated on consumption type tables not on pool tables" — this is the origin of the D-06 table-type branch; it is not a hypothetical edge case, it's a real, expected operating scenario the user raised unprompted.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The floating-table seat path (D-05) was explicitly discussed and deliberately excluded, not deferred as an oversight.

### Reviewed Todos (not folded)
The `todo.match-phase` scan surfaced 18 other pending todos for Phase 7 by keyword overlap (RBAC on `/inventory`, promotions, recipes, etc.) — all reviewed and judged unrelated to this phase's domain (waitlist/pool-timer), not presented to the user as fold candidates, and left in the general backlog.

</deferred>

---

*Phase: 07-waitlist-whatsapp*
*Context gathered: 2026-08-07*
