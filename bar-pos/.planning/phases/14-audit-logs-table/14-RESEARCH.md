# Phase 14: Audit Logs Table - Research

**Researched:** 2026-07-03
**Domain:** Supabase Postgres (SECURITY DEFINER RPCs, RLS, triggers) + React/TanStack Query FSD frontend — completion of a partially-built, previously-untracked compliance feature
**Confidence:** HIGH for what exists in the repo (read directly); MEDIUM-LOW for what needs to be verified live against remote Supabase (push status, live schema)

## Summary

Phase 14 is **not** an 8-RPC wiring task as ROADMAP.md and 14-CONTEXT.md assume. Direct inspection of every call site shows that only 2 of the 8 "remaining RPCs" (`transfer_tab`, and — once created — a new `caja_open`) are actually SECURITY DEFINER RPCs that can be patched with `PERFORM record_audit(...)` the way the 4 already-wired RPCs were. The other 6 targets are a mix of: a client-side direct table `UPDATE`/`INSERT` under RLS (no RPC exists at all), a call to a Supabase Edge Function that **does not exist anywhere in this repository** (`void-order`), a wrongly-named RPC (`manual_stock_movement` should be `record_stock_movement`), and a feature (`force_pin_change`) that has **zero implementation** anywhere in the codebase — no RPC, no UI, and the underlying `must_change_pin` column itself has no migration that created it. The planner must re-scope Wave/task structure around these facts, not around the ROADMAP's RPC list.

Additionally, the `record_audit()` SECURITY DEFINER helper's signature has **no `p_terminal_id` parameter**, so terminal_id will stay NULL forever for every RPC-sourced row — a gap versus the phase's own stated goal ("capturing every domain mutation with ... terminal id"). The Edge Function helper (`_shared/audit.ts`) never captures `actor_id` at all, meaning every edge-function-sourced audit row (once D-09 is done) will show a NULL actor unless the planner fixes the helper signature.

On the frontend, the reusable pieces from the 2026-04-28 orphaned work are in much better shape: `entities/audit-log/`, `json-diff.ts`, and `JsonDiffViewer` are complete, schema-correct, and already implement the D-08 truncation banner. The E2E spec (`38-audit-logs.spec.ts`) already encodes the exact DOM contract (`#audit-filter-action`, `#audit-filter-date-from`, "Apply filters" button, `getByRole('button', {name: /view diff for .* on .*/i })`, heading "Audit Log") that `pages/audit` + `widgets/AuditLogTable` must satisfy — treat it as an executable spec, not just a test. One correction to 14-CONTEXT.md: the HomeDashboard **already has** an `/audit` tile (`data-testid="home-tile-audit"`, `visibleToRoles: ['manager','admin']`) — it is not missing, it just points at a route that doesn't exist yet, and it does not use the RBAC `can()`/`requiredAction` mechanism the way every other gated tile does.

**Primary recommendation:** Split the 8 "remaining RPC" items into three genuinely different task types — (1) true RPC wiring (`transfer_tab`), (2) new-RPC-creation-then-wiring matching the `caja_open` pattern (`caja_open`, `close_tab` [wrap the existing `tabs` UPDATE], `manual_stock_movement`→`record_stock_movement` if not already SECURITY DEFINER-audited, `produce_prep_batch`), and (3) build-from-scratch-then-wire (`force_pin_change`, and investigate/rebuild `void_order` since its edge function is missing from the repo). Fix `record_audit()`'s signature to accept `p_terminal_id` before wiring any of the 8, and fix `_shared/audit.ts` to accept/pass `actor_id` before wiring any Edge Function (D-09).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `audit_logs` table + RLS + `record_audit()` | Database | — | Already migrated in git (push status unverified); append-only compliance ledger belongs at DB tier so it can't be bypassed by any client |
| Post-mutation audit capture inside RPCs | API / Backend (Postgres SECURITY DEFINER) | — | Matches existing 4-RPC pattern; keeps audit atomic with the mutation |
| Post-mutation audit capture inside Edge Functions | API / Backend (Deno Edge Function) | Database (`audit_logs` table write) | `_shared/audit.ts` already establishes this boundary; needs an `actor_id` fix |
| `/audit` page, filters, pagination | Frontend Server → Browser (SPA route) | — | Manager+ gated SPA page; all data fetched client-side via `entities/audit-log` |
| JSON diff rendering | Browser / Client | — | Pure client-side transform (`json-diff.ts`) + presentational component (`JsonDiffViewer`), no server dependency |
| RBAC gate for `/audit` | Browser / Client (route guard) | Database (RLS `SELECT` policy already restricts to manager/admin as defense-in-depth) | Matches `RbacRoute`/`ReportsRoute` client-side pattern; DB RLS is the real enforcement boundary |
| `caja_open` mutation (currently direct client INSERT) | Database (needs new SECURITY DEFINER RPC) | Browser (call site swap only) | D-02 explicitly requires this move — direct INSERT under RLS cannot atomically call `record_audit` |

## Standard Stack

This phase adds **no new external dependencies**. All work uses already-installed, already-verified project dependencies:

| Library | Version (from package.json) | Purpose |
|---------|------|---------|
| `@tanstack/react-query` | ^5.99.0 | `useInfiniteQuery` for the audit log table (pattern already written in `entities/audit-log/model/queries.ts`) |
| `zod` | ^4.3.6 | `AuditLogSchema` / `AuditLogFiltersSchema` / `AuditSourceSchema` already defined in `domain.ts` |
| `react` | ^19.1.0 | UI |
| `zustand` | ^5.0.12 | Not needed for this phase — audit log is pure server state, no local store required |
| `vitest` | ^4.1.4 | Unit tests, incl. the existing CI grep test |
| `playwright` | ^1.59.1 | E2E (`38-audit-logs.spec.ts` already exists) |

No `npm install` step is required for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages — it only wires existing RPCs/Edge Functions and builds a React page from already-installed shadcn/ui primitives (`Sheet`, `Select`, `Button`, table primitives already used elsewhere in the codebase). Skip the slopcheck/registry-verification protocol.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ BROWSER (manager+ only)                                             │
│                                                                       │
│  HomeDashboard "/audit" tile (ALREADY EXISTS, data-testid=          │
│  home-tile-audit, visibleToRoles gate — not RBAC can())              │
│         │                                                            │
│         ▼                                                            │
│  AuditRoute guard (NEW — must show a toast/message matching          │
│  /restricted to managers and admins/i on redirect, per E2E spec)     │
│         │ allow                                                      │
│         ▼                                                            │
│  pages/audit/index.tsx (NEW)                                         │
│         │                                                             │
│         ▼                                                             │
│  widgets/AuditLogTable (NEW)                                          │
│    ├─ Filter bar: action / entity_type / actor / date range / search  │
│    │    (ids #audit-filter-action, #audit-filter-date-from per E2E)   │
│    ├─ useAuditLogs(filters) ── useInfiniteQuery, page=50 (EXISTS)     │
│    │       │                                                          │
│    │       ▼                                                          │
│    │   entities/audit-log/model/queries.ts → supabase                 │
│    │       .from('audit_logs').select().range()  (EXISTS)             │
│    └─ Row click → Sheet slides in (D-03, matches SplitTabSheet/        │
│         RefundSheet pattern) → JsonDiffViewer(before, after,           │
│         truncated) (EXISTS, D-08 banner already implemented)          │
└─────────────────────────────────────────────────────────────────────┘
                              ▲ SELECT (manager/admin RLS policy)
                              │
┌─────────────────────────────────────────────────────────────────────┐
│ DATABASE (Supabase Postgres)                                         │
│                                                                       │
│  audit_logs table (append-only, RLS SELECT manager+, no UPDATE/DELETE)│
│         ▲ INSERT (via record_audit(), SECURITY DEFINER bypasses RLS) │
│         │                                                             │
│  record_audit(p_action, p_entity_type, p_entity_id, p_before,         │
│               p_after, p_source) — MISSING p_terminal_id (gap)        │
│         ▲ PERFORM record_audit(...) — pre-RETURN, success path only   │
│         │                                                             │
│  ┌──────┴──────────────────────────────────────────────────────┐     │
│  │ WIRED (4):  process_payment_atomic · process_refund ·        │     │
│  │             close_caja_session · add_combo_to_tab            │     │
│  ├────────────────────────────────────────────────────────────  │     │
│  │ TRUE RPC, NOT WIRED (1): transfer_tab                         │     │
│  ├────────────────────────────────────────────────────────────  │     │
│  │ NO RPC EXISTS TODAY — needs new SECURITY DEFINER wrapper (4): │     │
│  │   caja_open (direct INSERT today) · close_tab (direct UPDATE  │     │
│  │   on tabs.status today) · produce_prep_batch (direct INSERT   │     │
│  │   on prep_productions today) · manual_stock_movement (real    │     │
│  │   RPC name is record_stock_movement — verify if already        │    │
│  │   SECURITY DEFINER / already audited)                          │    │
│  ├────────────────────────────────────────────────────────────  │     │
│  │ update_role_permission — NO RPC; two DIRECT table mutations:   │     │
│  │   role_permissions INSERT/DELETE (toggle-permission feature)   │    │
│  │   AND profiles.role UPDATE (edit-staff-role feature) — both    │    │
│  │   need new SECURITY DEFINER wrapper(s), or client-side          │    │
│  │   record_audit() call (OfflineQueueProcessor precedent)        │    │
│  ├────────────────────────────────────────────────────────────  │     │
│  │ force_pin_change — NOTHING EXISTS: no RPC, no UI, no mutation, │     │
│  │   and must_change_pin column has NO CREATING MIGRATION          │    │
│  └────────────────────────────────────────────────────────────  │     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTIONS (Deno, supabase/functions/)                            │
│                                                                       │
│  void_order → callVoidOrder() fetches '/functions/v1/void-order' —    │
│  THIS FUNCTION DOES NOT EXIST in supabase/functions/ (only 11 other   │
│  functions exist: create-staff, get-server-time, process-payment,     │
│  rappi-sync-menu, rappi-webhook, send-receipt-email,                  │
│  send-waitlist-notification, settings-backup/email-status/restore/    │
│  test-email). recordAudit() is called by ZERO edge functions today    │
│  (D-09 fully unimplemented) and its actor_id capture is also missing. │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (new files only — do not rewrite existing reusable pieces)

```
src/
├── app/
│   ├── audit-route.tsx                  # NEW — copy RbacRoute pattern + add toast on redirect
│   └── router.tsx                       # MODIFY — add /audit route (lazy import)
├── pages/
│   └── audit/
│       └── index.tsx                    # NEW — thin container per FSD convention
├── widgets/
│   └── AuditLogTable/
│       ├── AuditLogTable.tsx             # NEW — filter bar + infinite-scroll table + row click → Sheet
│       ├── AuditLogFilterBar.tsx         # NEW (or inline) — action/entity_type/actor/date/search filters
│       └── AuditLogDetailSheet.tsx       # NEW — Sheet wrapper around existing JsonDiffViewer
├── entities/
│   └── audit-log/                        # EXISTS — reuse as-is (types.ts, queries.ts, index.ts)
├── shared/
│   ├── lib/
│   │   ├── audit-actions.ts              # EXISTS — extend enum only if a genuinely new action label is needed
│   │   ├── json-diff.ts                  # EXISTS — reuse as-is
│   │   └── rbac.ts                       # MODIFY — add 'view_audit_log' StaffAction if HomeDashboard tile
│   │                                       # should use requiredAction like every other gated tile (currently
│   │                                       # it uses visibleToRoles, inconsistent with the rest of the app)
│   └── ui/JsonDiffViewer/                # EXISTS — reuse as-is, truncated prop already wired
supabase/
├── migrations/
│   ├── 20260511000001_audit_logs_table.sql    # EXISTS — verify pushed to remote (BLOCKING, see Pitfall 1)
│   ├── 20260511000002_rpc_audit_wiring.sql    # EXISTS — verify pushed to remote (BLOCKING)
│   ├── <new>_record_audit_add_terminal_id.sql # NEW — ALTER record_audit() to accept p_terminal_id
│   ├── <new>_caja_open_rpc.sql                # NEW — wraps caja_sessions INSERT, calls record_audit
│   ├── <new>_close_tab_rpc.sql                # NEW (or wire client-side record_audit call — see Open Q1)
│   ├── <new>_produce_prep_batch_rpc.sql       # NEW (or wire client-side record_audit call)
│   ├── <new>_wire_transfer_tab_audit.sql      # PATCH existing transfer_tab function body
│   └── <new>_wire_record_stock_movement_audit.sql # PATCH record_stock_movement (confirm real name first)
└── functions/
    ├── _shared/audit.ts                        # MODIFY — add actor_id param
    └── void-order/                              # INVESTIGATE THEN CREATE — see Open Question 2 (BLOCKING)
```

### Pattern 1: SECURITY DEFINER post-mutation audit call (established, reuse verbatim)

**What:** Every wired RPC calls `PERFORM record_audit(...)` immediately before its final `RETURN`, only on the success path. Validation-error early-returns are never audited (no state changed).
**When to use:** Any of the true-RPC wiring targets (`transfer_tab`, and any newly-created wrapper RPCs).
**Example (from `close_caja_session`, migration `20260511000002_rpc_audit_wiring.sql`):**
```sql
-- Capture before state
SELECT to_jsonb(c) INTO v_before_row FROM caja_sessions c WHERE c.id = p_caja_id;

UPDATE caja_sessions SET closed_at = now(), ... WHERE id = p_caja_id AND status = 'open';
IF NOT FOUND THEN
  RETURN json_build_object('ok', false, 'error', json_build_object('code','NOT_FOUND', ...));
END IF;

-- AUDIT: record successful caja close (Phase 14-03)
SELECT to_jsonb(c) INTO v_after_row FROM caja_sessions c WHERE c.id = p_caja_id;
PERFORM record_audit('caja.close', 'caja_session', p_caja_id, v_before_row, v_after_row, 'rpc');

RETURN json_build_object('ok', true);
```

### Pattern 2: Direct-INSERT-under-RLS → new SECURITY DEFINER wrapper (the `caja_open` precedent, D-02)

**What:** When a mutation is currently a plain client-side `.from(table).insert(...)` (or `.update(...)`) under RLS with no RPC, the atomic-audit requirement means creating a thin SECURITY DEFINER RPC that performs the same INSERT/UPDATE and then calls `record_audit`, and swapping the client call site from `supabase.from(...).insert(...)` to `supabase.rpc('new_rpc_name', {...})`.
**When to use:** `caja_open` (confirmed call site: `src/entities/caja/model/queries.ts:147-178`, `useMutationOpenCaja`), `close_tab` (confirmed call site: `src/entities/tab/model/queries.ts:752-867`, `useMutationUpdateTabStatus` — a generic status-UPDATE RPC or a status-specific one), `produce_prep_batch` (confirmed call site: `src/entities/prep/model/queries.ts:70-114`, `useMutationCreatePrepProduction`).
**Caution:** `useMutationUpdateTabStatus` already has Phase-15 optimistic-concurrency logic (`.eq('version', expected)` + `staleVersionError`) baked into its direct-UPDATE path. Wrapping this in a new RPC means the RPC must also accept and enforce `p_expected_version` (matching the Group A pattern from Phase 15's `process_payment_atomic`) — do not silently drop version-conflict handling when converting to an RPC.

### Pattern 3: Client-side direct `record_audit` RPC call (established precedent — lighter-weight alternative to Pattern 2)

**What:** The client calls `supabase.rpc('record_audit', {...})` directly, without wrapping the underlying mutation in a new RPC. Already used in production code.
**Example (from `src/app/OfflineQueueProcessor.tsx:37`):**
```typescript
const res = await supabase.rpc('record_audit', {
  p_action: 'offline.discarded_stale',
  // ...
});
```
**When to use:** Consider this for `update_role_permission` (role_permissions INSERT/DELETE, staff.role UPDATE) if the planner decides atomicity with the underlying mutation is not required (these are lower-frequency, manager-only actions where a dropped audit call on a race is a smaller risk than for payment/caja paths). This is a genuine tradeoff the planner must decide explicitly — Pattern 2 is safer (atomic) but requires a new migration per action; Pattern 3 is faster to ship but the audit call can fail independently of the underlying mutation succeeding (non-atomic, same risk class as `void_order`'s current edge-function/depletion-reversal split).

### Anti-Patterns to Avoid
- **Assuming ROADMAP's RPC names are literal function names to grep for.** `manual_stock_movement` does not exist — the real function is `record_stock_movement` (canonical since Phase 3, invoked with `p_ref_type: 'manual'`). Trying to `CREATE OR REPLACE FUNCTION manual_stock_movement` would create a dead, uncalled function.
- **Wiring `record_audit` into `useMutationUpdateTabStatus`'s RPC-form without preserving the Phase 15 version-guard.** Any new `close_tab`-style RPC must replicate the `p_expected_version` / `P0V01` STALE_VERSION contract already established, or tab-closing will silently regress the Phase 15 concurrency work.
- **Trusting `supabase.types.ts` presence as proof of a pushed migration.** This codebase has a well-established pattern (per STATE.md, multiple phases) of manually hand-editing `supabase.types.ts` in advance of an actual `supabase db push` (due to local Docker being unavailable). `audit_logs` and `must_change_pin` both appear in `supabase.types.ts` with **no corresponding applied-and-confirmed migration** — do not treat type presence as schema presence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON before/after diffing | A new diff library or recursive diff algorithm | `src/shared/lib/json-diff.ts` (`diffJson`) | Already implemented, tested via Storybook, handles nested objects/arrays, `added`/`removed`/`modified`/`unchanged` statuses |
| Diff rendering UI | A new collapsible tree component | `src/shared/ui/JsonDiffViewer/JsonDiffViewer.tsx` | Already implements expand/collapse, color coding, and the D-08 truncation banner (`truncated` prop) |
| Paginated/filtered audit query | A new fetch-and-manually-paginate hook | `src/entities/audit-log/model/queries.ts` (`useAuditLogs`) | Already implements all 5 ROADMAP filters + `useInfiniteQuery` page-size-50 pattern; only needs a UI wiring layer on top |
| Action label taxonomy | Ad hoc string literals per RPC | `src/shared/lib/audit-actions.ts` (`AuditActionSchema`) | Single source of truth enforced by CI grep test; add new labels here FIRST |

**Key insight:** The frontend half of this phase (diff rendering, paginated query, action taxonomy) is essentially complete and well-built. Nearly all real remaining risk is on the database/RPC-topology side, where the ROADMAP's naming assumptions do not match the actual codebase.

## Common Pitfalls

### Pitfall 1: Migration push status is unverifiable from the repo alone — BLOCKING
**What goes wrong:** Assuming `20260511000001_audit_logs_table.sql` and `20260511000002_rpc_audit_wiring.sql` are live on remote Supabase because they exist as committed files with real commits (`68eab89`, `0b3918b`).
**Why it happens:** This repo's established pattern (documented repeatedly in STATE.md across Phases 4, 8, 15) is: write migration → manually hand-edit `supabase.types.ts` → defer the actual `supabase db push` to a separate BLOCKING checkpoint plan. STATE.md's only Phase 14 entry is "PLAN.md complete" (plan creation) — there is **no** STATE.md log entry confirming 14-01/14-02/14-03 were executed or pushed, unlike e.g. Phase 5 ("applied to remote DB, user confirmed") or Phase 15 ("migration not pushed, deferred to 15-05 BLOCKING").
**How to avoid:** Planner MUST insert a `checkpoint:human-verify` (or equivalent BLOCKING db-push task) as the FIRST task of Phase 14, verifying live (via `supabase db push` or a live query) that `audit_logs` table, `record_audit()` function, and the 4-RPC wiring are actually present on the target Supabase project before any new wiring work begins.
**Warning signs:** Any RPC call to `record_audit` failing with `function record_audit does not exist`, or `/audit` page returning empty because `audit_logs` doesn't exist yet.

### Pitfall 2: `void_order`'s edge function does not exist in the repository
**What goes wrong:** Planning a task "wire record_audit into the void-order edge function" assuming the function body is somewhere in `supabase/functions/`.
**Why it happens:** `src/shared/lib/edge-function-contracts.ts`'s `callVoidOrder()` does `fetch('/functions/v1/void-order', ...)`, but `find supabase/functions -type d` lists only: `create-staff, get-server-time, process-payment, rappi-sync-menu, rappi-webhook, send-receipt-email, send-waitlist-notification, settings-backup, settings-email-status, settings-restore, settings-test-email, _shared`. No `void-order` directory exists, and it was never deleted in git history either (a `VOID-ORDER-FEATURE-SUMMARY.md` and old `src/features/void-order/*` files were deleted in one commit, but no `supabase/functions/void-order/*` files ever appear in `git log --all`).
**How to avoid:** Treat this as an open question requiring a live check (does `/functions/v1/void-order` actually respond in the deployed Supabase project, i.e., was it deployed out-of-band without ever being committed?) before deciding whether Phase 14 needs to (a) recreate the missing edge function from scratch with `recordAudit` built in from day one, or (b) discover the void flow is actually implemented differently than `edge-function-contracts.ts` suggests. This blocks D-01's `void_order` wiring and D-07's E2E restoration of the `order.void` filter test.
**Warning signs:** `callVoidOrder` returning a 404 in a live test run.

### Pitfall 3: `record_audit()` cannot capture `terminal_id` — signature gap
**What goes wrong:** Wiring all 8 remaining call sites without first fixing `record_audit()`'s signature means `terminal_id` stays NULL forever, contradicting the phase's own stated goal (ROADMAP: "capturing every domain mutation with ... terminal id").
**Why it happens:** The original `record_audit(p_action, p_entity_type, p_entity_id, p_before, p_after, p_source)` signature (migration `20260511000001`) has no `p_terminal_id` parameter, and none of the 4 already-wired RPCs pass one either.
**How to avoid:** Add a migration that does `CREATE OR REPLACE FUNCTION record_audit(..., p_terminal_id text DEFAULT NULL)` (safe, additive, default-valued — does not break the 4 existing call sites) before wiring any new call site that should carry terminal_id. Note: RPCs run server-side and have no inherent knowledge of which physical terminal invoked them — the client must pass its own `TERMINAL_ID` (see `src/shared/lib/logger-instance.ts:19` / re-declared locally in `queries.ts` files as `(import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1'`) as a new RPC parameter on every affected function signature. This is a moderate blast-radius change (touches every wired RPC's parameter list) — do it once, early, in its own task/wave.
**Warning signs:** Every row in `/audit` showing a blank/dash Terminal ID column.

### Pitfall 4: Edge Function `recordAudit` never sets `actor_id`
**What goes wrong:** `supabase/functions/_shared/audit.ts`'s `recordAudit()` does a raw `.from('audit_logs').insert({...})` with no `actor_id` field at all — unlike the RPC path, which captures `auth.uid()` automatically inside the SECURITY DEFINER function body.
**Why it happens:** Edge functions frequently use a service-role client (bypassing RLS and auth context entirely), so `auth.uid()` semantics don't apply the same way; the helper was written without accounting for this.
**How to avoid:** Add an `actorId` field to `AuditParams` and require every call site to pass the acting staff ID explicitly (available in most edge function request bodies already, e.g. `p_staff_id` in `process_payment_atomic`'s Edge Function `process-payment`).
**Warning signs:** Every edge-function-sourced audit row (`source: 'edge'`) showing a NULL/blank actor once D-09 ships.

### Pitfall 5: `force_pin_change` has zero implementation, including its own DB column
**What goes wrong:** Treating `force_pin_change` as "the 8th RPC to wire with record_audit, same effort as the other 7."
**Why it happens:** `must_change_pin` (camelCase `mustChangePin` in `domain.ts`/TypeScript) exists in `supabase.types.ts` (manually hand-added) and in `StaffSchema` (`domain.ts:272`), and is read in `entities/staff/model/queries.ts:45` (`mapStaffRow`) — but grep across the **entire** `supabase/migrations/` directory for `must_change_pin` returns zero hits. No migration ever created this column. Separately, there is no RPC, no mutation hook, and no UI component anywhere (`ChangePinDialog`, `ForcePinChangeDialog`, etc. do not exist) that sets `mustChangePin = true` for a staff member, nor a flow that lets a logged-in staff member with `mustChangePin = true` actually change their PIN and clear the flag.
**How to avoid:** Scope `force_pin_change` as a **net-new feature** (migration to add the column if not already present live + a `force_pin_change` SECURITY DEFINER RPC + a "must change PIN" gate somewhere in the login flow + the audit wiring), not a wiring-only task. This is likely 3-5x the effort of the other 7 items and should be its own wave/plan, or explicitly descoped with user sign-off if out of budget for this phase.
**Warning signs:** Attempting to `ALTER FUNCTION force_pin_change` and getting "function does not exist"; attempting to query `profiles.must_change_pin` on remote and getting "column does not exist."

### Pitfall 6: `close_tab` and `produce_prep_batch` are not RPCs — RPC name in ROADMAP is aspirational, not descriptive
**What goes wrong:** Grepping migrations for `CREATE OR REPLACE FUNCTION close_tab` or `produce_prep_batch` and concluding "not found yet, must have been dropped" rather than "never existed as an RPC — these are direct table mutations."
**Why it happens:** `close_tab` in the ROADMAP almost certainly refers to the tab-status transition to `'paid'`/`'closed'`, which today happens two ways: (a) automatically inside `process_payment_atomic` when the tab is fully paid (**already audited** as `payment.process`), or (b) via `useMutationUpdateTabStatus`'s direct `.from('tabs').update({status, version})` call. `produce_prep_batch` similarly is `useMutationCreatePrepProduction`'s direct `.from('prep_productions').insert(...)` (validation happens via a DB trigger, not an RPC).
**How to avoid:** Confirm with the user/CONTEXT owner whether "close_tab" audit coverage is actually already satisfied by the existing `payment.process` audit event (path a), and only the manual-status-change path (b, e.g. staff manually voiding/canceling a tab without payment) needs new wiring. Don't assume 1:1 with the ROADMAP bullet list.
**Warning signs:** Confusion in planning about "why can't I find this RPC" — check the frontend call site first, not just migrations.

### Pitfall 7: `AuditActionSchema` has both `tab.void` and `order.void` — likely one is an orphan
**What goes wrong:** Wiring the `void_order` flow to use `'tab.void'` when the E2E spec and 14-CONTEXT.md's D-07 both clearly intend `'order.void'`.
**Why it happens:** `src/shared/lib/audit-actions.ts` enumerates both `'tab.void'` (under the "Tabs" comment section) and `'order.void'` (under "Orders"). `e2e/38-audit-logs.spec.ts`'s header comment and D-07 both reference "order.void" as the intended label for the void-order flow.
**How to avoid:** Use `'order.void'` (entity_type `'order'`) for the void-order wiring, per D-07 and the E2E spec's own documented intent. Flag `'tab.void'` to the user as a possible dead enum value — confirm whether it's meant for a different, not-yet-planned "void an entire tab" action (distinct from voiding one order within a tab) before removing it.

### Pitfall 8: HomeDashboard's `/audit` tile uses `visibleToRoles`, not the RBAC `can()` mechanism every other tile uses
**What goes wrong:** Assuming the HomeDashboard tile is "missing" (per 14-CONTEXT.md's canonical_refs, which is stale) and re-adding a duplicate tile, or leaving the existing tile's inconsistent gating mechanism unaddressed.
**Why it happens:** `src/widgets/HomeDashboard/ui/HomeDashboard.tsx:87-92` already has an `/audit` `DashboardItem` with `visibleToRoles: ['manager', 'admin']` — a hardcoded role list, unlike every other manager+-gated tile (`Reports`, `Inventory`, `Settings`, `Kitchen Prep`, `Waitlist`, `Roles & Permissions`) which uses `requiredAction: StaffAction` wired through `usePermissions().can(...)`. This is inconsistent with the RBAC-action-based pattern established in Phase 12/13.
**How to avoid:** Decide (and flag to user) whether to (a) leave `visibleToRoles` as-is (simplest, matches current code) or (b) add a `'view_audit_log'` `StaffAction` to `rbac.ts` + `role_permissions` seed data and switch the tile to `requiredAction: 'view_audit_log'` for consistency with the rest of the app and with Phase 13's DB-level RLS-parity philosophy. Either way, the tile itself does not need to be created — only its gating mechanism is in question.

## Code Examples

### `record_audit()` exact current signature (verified — read directly from migration)
```sql
-- Source: supabase/migrations/20260511000001_audit_logs_table.sql (lines 73-115)
CREATE OR REPLACE FUNCTION record_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid        DEFAULT NULL,
  p_before      jsonb       DEFAULT NULL,
  p_after       jsonb       DEFAULT NULL,
  p_source      text        DEFAULT 'rpc'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- captures auth.uid() automatically; truncates before/after >64KB with
-- {_truncated: true, _reason: '...'}; catches its own exceptions, returns NULL
-- (audit failure never fails the primary action)
$$;
```
Call convention used by all 4 wired RPCs: `PERFORM record_audit('<action>', '<entity_type>', <entity_id>, <before_jsonb_or_NULL>, <after_jsonb>, 'rpc');` — always immediately before the success-path `RETURN`, never inside `EXCEPTION` blocks.

### `audit_logs` exact current schema (verified)
```sql
-- Source: supabase/migrations/20260511000001_audit_logs_table.sql (lines 20-36)
CREATE TABLE audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid        NULL,
  before      jsonb       NULL,
  after       jsonb       NULL,
  terminal_id text        NULL,     -- never populated today (Pitfall 3)
  source      text        NOT NULL DEFAULT 'rpc' CHECK (source IN ('rpc','edge','client','trigger')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_before_size CHECK (pg_column_size(before) <= 65536),
  CONSTRAINT audit_logs_after_size  CHECK (pg_column_size(after)  <= 65536)
);
-- RLS: SELECT manager+admin only; INSERT authenticated (defense-in-depth,
-- actual writes go through SECURITY DEFINER record_audit); no UPDATE/DELETE policy at all
```

### Existing infinite-scroll query hook to build the widget on top of (verified, reuse as-is)
```typescript
// Source: src/entities/audit-log/model/queries.ts (already complete)
export function useAuditLogs(filters: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => { /* .range(pageParam, pageParam+49), all 5 filters applied */ },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}
```
No `useInfiniteQuery` precedent exists anywhere else in the codebase — this is the first and only usage. The widget consuming it (`AuditLogTable`) has no sibling pattern to copy for the "load more on scroll" trigger; use a standard IntersectionObserver-on-sentinel-row or a manual "Load more" button (TanStack Query v5 docs recommend either).

### `_truncated` flag mapping needed in the new widget (gap — not yet wired anywhere)
```typescript
// entities/audit-log/model/queries.ts's mapAuditRow does NOT extract this today.
// The NEW widget/detail-sheet component must do:
const isTruncated =
  (row.before as { _truncated?: boolean } | null)?._truncated === true ||
  (row.after as { _truncated?: boolean } | null)?._truncated === true;
// then: <JsonDiffViewer before={row.before} after={row.after} truncated={isTruncated} />
```

### Sheet pattern to copy for the diff detail view (D-03)
```typescript
// Source: src/features/process-refund/ui/RefundSheet.tsx (imports)
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@shared/ui/sheet';
// Also see: src/features/split-tab/ui/SplitTabSheet.tsx for the second reference implementation
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Logger-only forensics (`src/shared/lib/logger.ts` structured logs) | Durable `audit_logs` DB table, queryable via `/audit` | Phase 14 (in progress) | Logger remains for operational/debug logging; `audit_logs` becomes the compliance source of record. Do not conflate the two — the phase goal explicitly says "replace logger-only forensics path," meaning audit_logs is additive/authoritative, not a logger replacement |
| Legacy `audit_log` table (singular, pre-Phase-14) | New `audit_logs` table (plural) | Phase 14 migration | `process_refund` and `add_combo_to_tab` RPCs still contain legacy `INSERT INTO audit_log (...)` blocks wrapped in `EXCEPTION WHEN undefined_table THEN NULL` guards (kept "for backward compat; will be removed in Phase 22" per inline SQL comment) — both the legacy insert AND the new `record_audit` call coexist in the same function body today. Do not remove the legacy block in Phase 14; it's explicitly scheduled for Phase 22 |

**Deprecated/outdated:** The singular `audit_log` table (see `04-recipes-sale-depletion` migrations, `deplete_for_order_item`, `combo_availability_override`) is legacy and coexists with the new plural `audit_logs`. Phase 14 should not touch or migrate it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `20260511000001` and `20260511000002` have NOT been pushed to remote Supabase | Pitfall 1, Architecture | If actually already pushed, the BLOCKING checkpoint task is a no-op (low cost either way — verify, don't skip) |
| A2 | The `void-order` Edge Function was never deployed at all (not just "missing from git") | Pitfall 2 | If it WAS deployed out-of-band (config drift, not committed), the planner needs a "pull down and commit the existing deployed function" task instead of "build from scratch" — materially different task |
| A3 | `close_tab`'s audit coverage intent is satisfied by the existing `payment.process` wiring for the auto-close-on-full-payment path, and only needs new wiring for the manual/no-payment status-change path | Pitfall 6 | If the user actually wants BOTH paths separately labeled (e.g. `tab.close` distinct from `payment.process`), scope grows to include relabeling the already-shipped `process_payment_atomic` wiring too |
| A4 | `'tab.void'` in `AuditActionSchema` is an unused/orphan enum value, and `'order.void'` is the correct label for the void-order flow | Pitfall 7 | If `tab.void` was intended for a distinct future "void whole tab" feature, removing/ignoring it could be premature — confirm with user, don't delete |
| A5 | Adding `p_terminal_id DEFAULT NULL` to `record_audit()` and propagating a new `p_terminal_id` parameter through wired RPCs is in-scope for Phase 14 (not deferred) | Pitfall 3 | If deferred, `/audit`'s Terminal ID column and filter (if ever added) will be non-functional for the life of the phase; user should explicitly accept this gap if descoping |

## Open Questions

1. **Is `close_tab` audit coverage already satisfied by `payment.process`, or does it need its own distinct wiring path?**
   - What we know: `process_payment_atomic` already sets `tabs.status = 'paid'` and is already audited as `'payment.process'` when the tab is fully paid. A separate `useMutationUpdateTabStatus` direct-UPDATE path exists for other status transitions (manual close without payment, void-related transitions).
   - What's unclear: Whether ROADMAP's "close_tab" bullet means "audit every tab status transition" (needs new RPC wrapping `useMutationUpdateTabStatus`) or is already substantially covered by the payment path.
   - Recommendation: Confirm with user before planning; default to wiring the `useMutationUpdateTabStatus` path too (safer, matches D-01's literal intent) unless the user says the payment-path coverage is sufficient.

2. **Does the `void-order` Edge Function exist live on the deployed Supabase project even though it's absent from git?** [BLOCKING]
   - What we know: `callVoidOrder()` fetches `/functions/v1/void-order`; no such directory exists under `supabase/functions/` in this repo, and git history shows no such directory was ever committed or deleted.
   - What's unclear: Whether this function was deployed directly via `supabase functions deploy` without ever being committed (config/deploy drift, same category as the "n8n workflows not exported to git" pattern), or whether void-order has simply never worked and nobody noticed (all 3 `void-order` unit test files are for the FRONTEND hook only, mocking `callVoidOrder` — they would not catch a missing/404 backend).
   - Recommendation: This must be checked live (call the endpoint or check the Supabase dashboard's Edge Functions list) before planning D-01's void_order wiring — the task is either "add ~15 lines of `recordAudit()` call to an existing function" or "author, test, and deploy a new edge function from scratch." Flag as [BLOCKING] discovery task, first wave.

3. **Should `update_role_permission`'s audit wiring use Pattern 2 (new wrapping RPC, atomic) or Pattern 3 (client-side direct `record_audit` call, non-atomic but faster to ship)?**
   - What we know: Both underlying mutations (`role_permissions` INSERT/DELETE via `toggle-permission` feature, `profiles.role` UPDATE via `edit-staff-role` feature) are currently plain client-side table calls under RLS. `OfflineQueueProcessor.tsx` already establishes Pattern 3 as a valid, shipped precedent in this codebase.
   - What's unclear: Whether RBAC permission changes are frequent/sensitive enough to warrant the atomicity guarantee of Pattern 2, or whether Pattern 3's fire-and-forget model is acceptable for this specific action.
   - Recommendation: Given RBAC changes are low-frequency, manager+-only actions (per `MANAGER_EXTRA`/`ADMIN_EXTRA` in `rbac.ts`), Pattern 3 (client-side `supabase.rpc('record_audit', {...})` immediately after the mutation succeeds) is proportionate and much cheaper to implement across 2 call sites. Recommend Pattern 3 to the planner but flag as a discretionary call for the user.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase / Docker | Regenerating `supabase.types.ts` after schema changes | ✗ (per STATE.md, repeatedly documented as unavailable across Phases 2, 4, 15) | — | Continue the established manual-hand-edit-of-`supabase.types.ts` pattern; do not block the phase on Docker |
| Remote Supabase project (live push target) | Verifying Pitfall 1 / applying new migrations | Unverified — no MCP/CLI tool available to this research agent to check live | — | Planner MUST insert a BLOCKING `checkpoint:human-verify` task to confirm push status before wiring proceeds |
| `supabase` CLI | `supabase db push` | Assumed present (used throughout prior phases per STATE.md) | — | — |

**Missing dependencies with no fallback:**
- Live confirmation of remote schema state (audit_logs table, record_audit function, must_change_pin column, void-order edge function) — none of these can be verified by static repo inspection alone. This blocks any RPC-wiring task until resolved.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.4 (unit) + Playwright v1.59.1 (E2E) |
| Config file | `vitest.config.ts` (unit), `playwright.config.ts` (E2E) — both pre-existing, no changes needed |
| Quick run command | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` |
| Full suite command | `npm run test` (unit) / `npm run test:e2e` (Playwright, requires `.env.local` E2E creds) |

### Phase Requirement (ROADMAP success criteria) → Test Map
| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| SC1 | `audit_logs` + `record_audit` migrated to remote | manual/integration | live Supabase check | ❌ no automated test — needs a live-DB smoke check, e.g. `SELECT record_audit('test.probe','test')` in a throwaway integration test |
| SC2 | Append-only RLS enforced | integration | new test needed: attempt UPDATE/DELETE as authenticated user, expect RLS denial | ❌ Wave 0 gap |
| SC3 | All sensitive RPCs call `record_audit` post-mutation | CI grep (existing) + integration | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` (checks label validity only, NOT call coverage) | ⚠️ partial — existing test validates action LABELS are enumerated, does NOT assert that all 12 target RPCs actually call `record_audit` at all. Consider extending the grep test to assert presence of `PERFORM record_audit` in each target RPC's migration file |
| SC4 | Sensitive Edge Functions call `recordAudit` | integration | none exists | ❌ Wave 0 gap — needs a new test iterating `supabase/functions/*/index.ts` asserting `recordAudit(` import+call for a defined "sensitive" allowlist |
| SC5 | Action-label enum + CI grep test | unit (existing) | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` | ✅ exists |
| SC6 | `/audit` page filters + infinite scroll + diff viewer | E2E (existing, partial) | `npx playwright test e2e/38-audit-logs.spec.ts` | ⚠️ exists but will fail entirely today (no `/audit` route) — becomes the phase's primary E2E gate once the page is built |
| SC7 | `entities/audit-log` + `widgets/AuditLogTable` + `pages/audit` + `AuditRoute` | unit (RTL) | new component tests needed for `AuditLogTable`, `AuditRoute` | ❌ Wave 0 gap |
| SC8 | E2E covers payment/refund/void → visible; bartender redirect | E2E (existing, needs the order.void restoration per D-07) | `npx playwright test e2e/38-audit-logs.spec.ts` | ⚠️ exists, needs D-07 update (swap `combo.add_to_tab` substitute test back to `order.void` once wired) |
| SC9 | `AUDIT_WRITE_FAILED` in AppError union + 64KB truncation | unit (existing for enum) + new (for truncation banner integration) | grep `result.ts` (manual) — confirmed present at `src/shared/lib/result.ts:199` | ✅ enum present; ⚠️ truncation banner component-level test not yet written for the new widget's `_truncated` extraction logic (Pitfall/gap noted above) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-test-file>` + `npm run typecheck`
- **Per wave merge:** `npm run test` (full unit suite, currently ~1147+ tests) + `npm run lint`
- **Phase gate:** `npm run test:e2e -- e2e/38-audit-logs.spec.ts` green (requires live Supabase + `.env.local` E2E creds) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `src/shared/lib/__tests__/audit-actions.test.ts` (or a new test) to assert `PERFORM record_audit` appears at least once per target RPC's current migration file, not just that used labels are valid
- [ ] New integration test: RLS denial on `UPDATE`/`DELETE` against `audit_logs` as an authenticated (non-service-role) user
- [ ] New unit test(s) for `AuditLogTable`, `AuditRoute`, and the `_truncated` extraction logic feeding `JsonDiffViewer`
- [ ] New test asserting a defined allowlist of "sensitive" Edge Functions all import and call `recordAudit`
- [ ] `e2e/38-audit-logs.spec.ts` header + Test 2 needs updating per D-07 once `order.void` is actually wired (remove the documented substitution)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not touched by this phase (uses existing PIN-based session auth) |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS `SELECT` policy already restricts `audit_logs` to `manager`/`admin` via `get_user_role()`; `AuditRoute` client guard is defense-in-depth only, not the enforcement boundary — do not treat the client guard as sufficient on its own |
| V5 Input Validation | yes | `AuditLogFiltersSchema` (Zod) already validates filter inputs before querying; free-text search filter uses Supabase `.or()` with `ilike` — verify no raw string interpolation risk (current code: `` `entity_id::text.ilike.%${filters.search}%,action.ilike.%${filters.search}%` `` — this IS string-interpolated into a PostgREST filter expression; a search string containing `,` or `.` could alter the filter structure. Recommend the planner add input sanitization or escape commas/periods in `filters.search` before this ships to `/audit`, since it's the only field in this phase with direct user-controlled interpolation into a query filter) |
| V6 Cryptography | no | No new cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PostgREST filter-string injection via free-text search (`.or()` with interpolated `ilike` pattern) | Tampering | Escape/strip `,` and `.` (PostgREST `or()` filter-string metacharacters) from `filters.search` before building the query string in `useAuditLogs`; already flagged above as a real, not hypothetical, gap in the existing (reusable) code |
| Audit log tampering (post-write modification) | Tampering, Repudiation | Already mitigated at the DB layer — no `UPDATE`/`DELETE` RLS policy exists on `audit_logs` (append-only by omission, verified in migration) |
| Privilege escalation via client-controlled role check | Elevation of Privilege | `record_audit`'s `SELECT` RLS uses `get_user_role()` (server-side function), not a client-supplied role param — correct pattern, no change needed |
| Non-atomic audit write allowing a mutation to succeed with no compliance trail | Repudiation | Acceptable per this codebase's established design (`record_audit` catches its own exceptions and returns NULL rather than failing the primary action) — this is an explicit, intentional tradeoff already made and documented; do not "fix" it by making audit writes blocking/transactional, that would violate the phase's own stated non-fatal-audit-failure design |

## Sources

### Primary (HIGH confidence — read directly from the repository)
- `supabase/migrations/20260511000001_audit_logs_table.sql` — full read, table schema + `record_audit()` signature
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` — full read, all 4 wired RPC bodies
- `src/shared/lib/audit-actions.ts`, `src/shared/lib/__tests__/audit-actions.test.ts` — full read
- `src/shared/lib/json-diff.ts`, `src/shared/ui/JsonDiffViewer/JsonDiffViewer.tsx` — full read
- `src/entities/audit-log/model/{types,queries}.ts`, `src/entities/audit-log/index.ts` — full read
- `supabase/functions/_shared/audit.ts` — full read
- `e2e/38-audit-logs.spec.ts` — full read
- `src/features/void-order/model/useVoidOrder.ts`, `src/features/transfer-tab/useTransferTab.ts`, `src/features/produce-prep-batch/model/useProducePrepBatch.ts`, `src/entities/prep/model/queries.ts`, `src/entities/tab/model/queries.ts`, `src/entities/caja/model/queries.ts`, `src/features/edit-staff-role/ui/EditRoleDialog.tsx`, `src/features/toggle-permission/useMutationTogglePermission.ts`, `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` — full reads confirming actual (not assumed) RPC/mutation call sites
- `src/app/router.tsx`, `src/app/rbac-route.tsx`, `src/app/reports-route.tsx`, `src/widgets/HomeDashboard/ui/HomeDashboard.tsx`, `src/shared/lib/rbac.ts` — full reads confirming route/RBAC/tile patterns
- `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/phases/14-audit-logs-table/14-CONTEXT.md`, `CLAUDE.md` — full reads
- `package.json` — grep for exact installed dependency versions

### Secondary (MEDIUM confidence)
- None — all findings in this research were verified by direct repository inspection rather than external documentation, since this is an internal-codebase completion phase, not a new-library-adoption phase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all versions read directly from `package.json`
- Architecture: HIGH for what exists in the repo (all read directly); LOW for remote/live Supabase state (push status, whether `void-order` edge function is deployed out-of-band, whether `must_change_pin` column exists live) — these require live verification this research agent could not perform
- Pitfalls: HIGH — all 8 pitfalls are grounded in direct code/migration inspection, not inference

**Research date:** 2026-07-03
**Valid until:** Effectively unbounded for the static-code findings (won't go stale unless the codebase changes underneath); the live-Supabase-state findings (Pitfall 1, Open Question 2) must be re-verified at plan-execution time regardless of date, since they were never resolved by this research pass — they are BLOCKING discovery items, not time-sensitive facts.
