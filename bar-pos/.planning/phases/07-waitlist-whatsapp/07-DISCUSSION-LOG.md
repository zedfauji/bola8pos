# Phase 07: Waitlist + WhatsApp - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 07-waitlist-whatsapp
**Areas discussed:** Tab naming, Failure/rollback semantics, Scope — which seat paths + manual override, pg_net remediation choice

---

## Plans exist — proceed anyway?

| Option | Description | Selected |
|--------|-------------|----------|
| Continue and replan after | Capture context now, replan afterward | ✓ |
| View existing plans | Show existing plan list first | |
| Cancel | Stop the workflow | |

**User's choice:** Continue and replan after

---

## Fold pg_net todo?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in | Include the pg_net/notify-waitlist fix as part of this phase's scope | ✓ |
| Leave separate | Keep it as its own backlog todo | |

**User's choice:** Fold it in

---

## Tab naming

| Option | Description | Selected |
|--------|-------------|----------|
| Party name | Use `waitlist_entries.name` directly, e.g. "García" | |
| Party name + party size | e.g. "García (4)" | ✓ |
| Keep StartSessionSheet convention | "Pool {table.label}" | |

**User's choice:** Party name + party size
**Notes:** No follow-up questions needed — settled in one round.

---

## Failure/rollback semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential, stop-and-report | Matches existing precedent (`useMutationStartSession`, `useSeatAtNewTable` are both non-atomic today) | |
| Atomic RPC (new) | New Postgres function, all-or-nothing | ✓ |

**User's choice:** Atomic RPC (new) — explicitly against the recommended, precedent-matching option.

**Follow-up 1 — RPC scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| New RPC, waitlist-only | Isolated to the new path, `StartSessionSheet` untouched | |
| Shared atomic RPC for both flows | Also replaces `useMutationStartSession`'s internals for the manual flow | ✓ |

**User's choice:** Shared atomic RPC for both flows.
**Notes:** Confirmed via codebase check that `useMutationStartSession` has exactly one other caller besides `StartSessionSheet` — `OfflineQueueProcessor.tsx`, which replays this mutation for offline-queued actions. Swapping internals behind the existing `{tableId, tabId} → Result<PoolSession>` interface means neither caller needs code changes.

**Follow-up 2 — RPC shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Waitlist RPC wraps the shared one | Two functions: `start_pool_session` (shared) + `seat_waitlist_party_and_start_session` (waitlist-specific wrapper) | ✓ |
| One RPC, optional waitlist param | Single function with an optional `waitlist_entry_id` param | |

**User's choice:** Waitlist RPC wraps the shared one.

---

## Scope — which seat paths + manual override

**Question 1 — which paths:**

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Existing-table AND seat-at-new-temp-table (Phase 26) paths get the automation | |
| Existing-table path only | Seat-at-new-table stays fully manual | ✓ |

**User's choice:** Existing-table path only.

**Question 2 — manual override:**

| Option | Description | Selected |
|--------|-------------|----------|
| Always auto-start | No toggle, always automatic | |
| Add a toggle/checkbox | Staff can opt out per-seat | |

**User's choice:** Neither — free-text response: "Seating doesn't not always start the timer, Sometime party comes and they get to be seated on consumption type tables not on pool tables"
**Notes:** This response redirected the discussion. It revealed `resources.tableType` is a 4-value enum (`pool`/`carom`/`consumption`/`floating`) and that consumption-type tables have no rate/timer concept at all — the "always vs. toggle" framing was the wrong question; the real distinction is per-table-type, not per-staff-choice.

**Follow-up — consumption-table branch:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tab only, no timer | Consumption tables get auto-tab, skip the timer step entirely | ✓ |
| No auto-anything for consumption tables | Consumption tables stay fully manual, only pool/carom get the automation | |

**User's choice:** Yes — tab only, no timer.
**Notes:** Confirmed via codebase check that `SeatPartySheet`'s table-picker query already selects `table_type` for every resource unfiltered — no query change needed to support this branch, the data is already available client-side.

---

## pg_net remediation choice

| Option | Description | Selected |
|--------|-------------|----------|
| Enable pg_net extension | `CREATE EXTENSION IF NOT EXISTS pg_net;` — matches existing trigger design | ✓ |
| Rewrite the trigger | Bigger change, different notification-delivery mechanism | |

**User's choice:** Enable pg_net extension.

---

## Claude's Discretion

- Exact RPC parameter shapes/return types for `start_pool_session` and `seat_waitlist_party_and_start_session` beyond the names and composition relationship
- Whether tab-creation itself happens inside the shared RPC or stays a separate client-side `useOpenTab` call before invoking it (needs research)
- Exact error/toast copy on RPC failure
- Whether `carom` tables need any distinct handling from `pool` tables (no evidence found of a difference in current code; treat identically unless research finds otherwise)

## Deferred Ideas

None — discussion stayed within phase scope. The floating-table seat path was explicitly discussed and deliberately excluded (see "Scope" above), not deferred as an oversight.

18 other pending todos matched Phase 7 by keyword overlap (RBAC on `/inventory`, promotions, recipes, etc.) — reviewed and judged unrelated to this phase's domain, not presented as fold candidates, left in the general backlog.
