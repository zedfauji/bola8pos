# Phase 23: Reopen Closed Ticket - Research

**Researched:** 2026-07-20
**Domain:** Supabase PL/pgSQL RPC design (status-reversal + optimistic concurrency + cap/window enforcement + audit trail), plus a targeted correctness sweep of every existing RPC/report query that sums `payments` — on top of the same FSD/React codebase Phase 22 already extended.
**Confidence:** HIGH — every claim below is grounded in the actual current schema/RPC/component code read this session (migrations, `domain.ts`, `rbac.ts`, `audit-actions.ts`, `PaymentPane.tsx`), not general Supabase/React knowledge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `payments.status` column (not a boolean) — `'completed' | 'reopened_void'`, default `'completed'`. Reporting/receipt code that assumes payment rows are always final must be checked and updated to exclude `reopened_void` from revenue totals.
- **D-05 (Claude's discretion):** Default assumption unless research finds a reason otherwise: every completed payment leg for the tab (including all `payment_group_id` siblings from a split payment, Phase 18) flips to `reopened_void`; existing `isRefund: true` rows are left untouched.
- **D-02:** The 24h window resets on each reopen — a manager has 24h from the MOST RECENT reopen (not the original close) to reopen again, still capped at 2 reopens total, ever (no reset of the count).
- **D-03:** Reopen count is tracked via a new `tabs.reopen_count` column (int, default 0), incremented atomically inside `reopen_tab` under the same row lock (`FOR UPDATE`) used for the `p_expected_version` check — same locking pattern as `edit_paid_tab`. Do not derive the cap from counting `audit_logs` rows. Store the "most recent reopen timestamp" — likely `tabs.last_reopened_at` (planner's call on exact column name).
- **D-04:** Manager+ (`manager` or `admin` role) — same gate as `edit_paid_tab`/`process_refund`. Reuse `manager-pin-gate` and the server-side role re-check pattern. No new RBAC tier.
- **D-06:** Reopening produces a fully normal open tab. No special "reopened mode" UI. Existing `add-item-to-tab`/`remove-item-from-tab`/other order-editing features apply; re-close via normal `close_tab`/`process_payment` flow (fresh payment row(s), separate from voided originals).

### Claude's Discretion

- Exact `payments.status` enum values beyond `'completed'`/`'reopened_void'` — default: keep minimal, only these two.
- Exact new-column names (`tabs.reopen_count`, `tabs.last_reopened_at` or equivalent).
- Which non-refund payment rows flip to `reopened_void` on a split-payment tab (per D-05) — **research resolves this below**: confirmed against the actual `payment_group_id`/`split_index` schema (Phase 18).
- Whether the offsetting caja entry mechanism introduces `caja_entries.source_tab_id`/`source_type` columns or continues the free-text `concept` encoding Phase 22 established — default: continue the free-text pattern.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. `edit_paid_tab` (Phase 22, shipped) was referenced only as implementation precedent.
</user_constraints>

<phase_requirements>
## Phase Requirements

No `REQUIREMENTS.md` exists for this milestone (confirmed absent, consistent with every Phase 20-23 session). Scope is defined by the 4 Success Criteria in the phase description (copied from ROADMAP.md), used here as the requirement IDs the planner must trace tasks to:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `reopen_tab` RPC flips a closed tab back to open, marks original payment(s) `reopened_void`, uses `p_expected_version` | See Architecture Patterns (Pattern 1), Common Pitfalls 1-2 (CHECK constraint + version-guard template) |
| SC-2 | Caja gets an offsetting entry so totals stay reconciled after reopen | See Architecture Patterns (Pattern 1 step 7), reusing Phase 22's `caja_entries` free-text pattern exactly |
| SC-3 | Reopen blocked outside a 24h window or after 2 prior reopens on the same tab | See Architecture Patterns (Pattern 1 steps 3-4), Code Examples |
| SC-4 | Every reopen writes an `audit_logs` row (Phase 14) | See Architecture Patterns (Pattern 1 step 9), Common Pitfalls 6 |
| (implicit) | Re-closing a reopened tab must compute correct payment/revenue totals — NOT double-count the voided original payment | **See Common Pitfalls 3-5 — this is the single highest-risk gap in the phase and is not named by any SC, but breaks re-payment/reporting if skipped** |
</phase_requirements>

## Summary

This phase is structurally the mirror image of Phase 22: one new RPC (`reopen_tab`), reusing every version-guard/PIN-gate/audit-wiring convention already established, plus one new `payments.status` column. The RPC body itself is the easy 80% — it follows `edit_paid_tab`'s exact template (role re-check, `FOR UPDATE` + `p_expected_version` guard, offsetting `caja_entries` insert, success-path `record_audit`).

The hard 20%, and the part CONTEXT.md's Success Criteria don't explicitly call out, is this: **`reopen_tab` doesn't operate in isolation — it un-voids a tab so it re-enters the exact code paths (`process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`'s tip pooling) that Phase 22 and prior phases wrote under the assumption that every `payments` row for a tab is either a real charge or a refund, never a "this used to count, now it doesn't" row.** Concretely: `process_payment_atomic`'s "is this tab fully paid yet" check is `SELECT SUM(p.amount) FROM payments p WHERE p.tab_id = p_tab_id AND p.is_refund = false` — with **no status filter**. After `reopen_tab` flips the original payment to `reopened_void` but leaves the row in the table, re-paying the reopened tab will sum the OLD voided amount together with the NEW payment, silently corrupting the "fully paid" determination (closing early, or rejecting a legitimate partial payment as already-covered). The same blind-spot exists in `get_caja_report`'s revenue/staff-summary sums and `close_caja_session`'s tip-pooling sum. **All four sites must add a `status IS DISTINCT FROM 'reopened_void'` filter as part of this phase** — this is a direct, unavoidable consequence of introducing `payments.status`, not scope creep.

A second landmine: `tabs` has a `CHECK (closed_at_requires_closed_status)` constraint — `(closed_at IS NULL AND status IN ('open','split')) OR (closed_at IS NOT NULL AND status IN ('closed','paid','voided'))`. `reopen_tab` MUST set `closed_at = NULL` in the SAME `UPDATE` that flips `status` to `'open'`, or the constraint rejects the write outright.

D-05 (which payment rows flip) resolves cleanly once the schema is read: `payment_group_id`/`split_index` are just tags on rows that already share `tab_id` — there is no special grouping logic needed. `UPDATE payments SET status = 'reopened_void' WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed'` naturally catches every split-payment sibling and every sequential single-method payment, in one statement, with zero group-aware branching.

**Primary recommendation:** Add `payments.status text DEFAULT 'completed' CHECK (status IN ('completed','reopened_void'))`, write `reopen_tab` following `edit_paid_tab`'s exact skeleton (role check -> `FOR UPDATE` + version guard -> cap/window check -> void payments by plain `tab_id` WHERE clause -> offsetting `caja_entries` insert -> single `UPDATE tabs SET status='open', closed_at=NULL, reopen_count=reopen_count+1, last_reopened_at=NOW(), version=version+1` -> `record_audit('tab.reopen', ...)`), and in the SAME phase patch the 4 payment-summing sites (`process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`) to exclude `status = 'reopened_void'` rows, plus `process_refund`'s existing-payment lookup to reject refunding an already-voided-by-reopen row.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status reversal + cap/window check + version guard + offsetting caja entry + audit write | API / Backend (Supabase RPC, `SECURITY DEFINER`) | — | Must be atomic (payment void + tabs flip + caja entry + audit in one transaction); RLS/client code cannot express the 24h/2x cap or the atomic multi-table write |
| Manager PIN verification | Frontend Client (existing `ManagerPinDialog`) | API (RPC re-validates role via `auth.uid()`) | Same defense-in-depth split as `edit_paid_tab`/`process_refund` — PIN dialog is UX-only, RPC is the real boundary |
| Payment-sum correctness after reopen | API / Backend (4 existing RPCs/functions: `process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`) | — | These pre-existing sums silently assumed every non-refund `payments` row is "real" revenue/paid-amount forever — introducing `status` breaks that assumption unless each site is patched in this same phase |
| Post-reopen order editing / re-payment | Browser / Client (existing `add-item-to-tab`, `close-tab`, `process-payment` features, unmodified) | — | Per D-06, the reopened tab is a fully normal open tab — no new UI needed |
| `ReopenTabDialog` trigger + reason capture | Browser / Client | — | New, small — PIN-gated Sheet/Dialog mirroring `RefundSheet`'s reason-required pattern, triggered from `PaymentPane`'s payment-history row (next to the existing Refund/Edit-ticket buttons) |

## Standard Stack

No new libraries — 100% additive on the existing stack (React 19, TanStack Query v5, Zod v4, Supabase PL/pgSQL, shadcn/ui), identical to Phase 22.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5 (installed) | `useReopenTab` mutation hook | Sole server-state layer in this codebase |
| `zod` | ^4.3.6 (installed) | Extend `domain.ts` `PaymentSchema` with `status`, `TabSchema` with `reopenCount`/`lastReopenedAt` | Single source of truth per CLAUDE.md |
| Supabase PL/pgSQL (`plpgsql`, `SECURITY DEFINER`) | project-pinned via CLI | `reopen_tab` RPC + 4 patched existing functions | Matches every sensitive mutation in this codebase (no ORM) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `tab_id`-scoped `UPDATE payments SET status='reopened_void' WHERE tab_id=... AND is_refund=false AND status='completed'` (no group-awareness) | Loop over `payment_group_id` siblings explicitly, mirroring `process_split_payment_atomic`'s per-leg loop | Unnecessary — `payment_group_id` is a tag on rows that already share `tab_id`; a plain `WHERE tab_id=` clause already selects every sibling in one statement with less code and no risk of missing a leg |
| `tabs.reopen_count`/`tabs.last_reopened_at` (D-03) | Derive from `audit_logs` count/max(created_at) filtered to `action='tab.reopen'` | CONTEXT.md explicitly rejects this (D-03) — an indexed integer/timestamp column is O(1) under the same row lock already taken for the version check, vs. a full audit_logs scan on every reopen attempt |
| Continuing `caja_entries.concept` free-text encoding | Adding `caja_entries.source_tab_id`/`source_type` columns now | CONTEXT.md's Claude's-Discretion default says continue free-text; Phase 22's migration comment explicitly deferred this exact decision to Phase 23 and this research does not find a strong enough reason to add schema now — flagged again in Open Questions for a final call |

**Installation:** None.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

Not applicable — zero new npm/pip/cargo dependencies. All required primitives (`Sheet`, `ManagerPinDialog`, TanStack Query, Zod, existing `caja_entries`/`audit_logs` tables) already exist and are in use.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[PaymentPane payment-history row, tab status = 'closed'|'paid']
        |
        v
["Reopen ticket" button, mirrors RefundButton/EditTicketButton guard pattern]
        |
        v
[ReopenTabDialog: reason (required) -> Confirm]
        |
        v
[ManagerPinDialog requiredAction="reopen_tab"] --(PIN match via profiles.pin, client-side UX gate)
        |
        v (onSuccess)
[useReopenTab mutation] --> supabase.rpc('reopen_tab', { p_tab_id, p_expected_version, p_reason })
        |
+------------------------------- reopen_tab RPC (SECURITY DEFINER, one transaction) -------------------------------+
| 1. SELECT role FROM profiles WHERE id = auth.uid() -> manager/admin only (else AUTH_FORBIDDEN)                    |
| 2. SELECT version, status, reopen_count, last_reopened_at FROM tabs WHERE id=p_tab_id FOR UPDATE                 |
|    -> NOT FOUND: raise P0V02 (NOT_FOUND_VERSIONED)                                                                |
|    -> status NOT IN ('closed','paid'): return ok=false TAB_NOT_REOPENABLE (excludes 'open'/'split'/'voided')      |
|    -> version <> p_expected_version: raise P0V01 (STALE_VERSION)                                                  |
| 3. Cap check: IF reopen_count >= 2 THEN return ok=false REOPEN_CAP_EXCEEDED                                       |
| 4. Window check: IF last_reopened_at IS NOT NULL AND NOW() - last_reopened_at > interval '24 hours'               |
|      THEN return ok=false REOPEN_WINDOW_EXPIRED (D-02: window is from MOST RECENT reopen, not original close;    |
|      on the FIRST reopen last_reopened_at is NULL so this check is skipped entirely)                              |
| 5. Capture v_before = to_jsonb(tabs row)                                                                          |
| 6. UPDATE payments SET status = 'reopened_void'                                                                   |
|      WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed'                                       |
|      -- plain tab_id scope naturally catches every payment_group_id sibling (D-05) and every sequential          |
|      -- single-method row; existing isRefund=true rows are untouched by the is_refund=false clause                |
|    RETURNING id, amount INTO ... (sum for the offsetting caja entry)                                              |
| 7. IF v_voided_total <> 0:                                                                                        |
|      SELECT id FROM caja_sessions WHERE status='open' LIMIT 1 -> NO_OPEN_CAJA if none (same as edit_paid_tab)     |
|      INSERT INTO caja_entries (caja_session_id, type='expense', amount=v_voided_total, concept=<free text>,      |
|        staff_id) -- expense: reopening reverses revenue already booked as income                                  |
| 8. UPDATE tabs SET status='open', closed_at=NULL, reopen_count=reopen_count+1, last_reopened_at=NOW(),            |
|      version=version+1, updated_at=NOW() WHERE id=p_tab_id                                                        |
|    -- closed_at=NULL is MANDATORY in this same statement: the closed_at_requires_closed_status CHECK constraint  |
|    -- rejects (status='open' AND closed_at IS NOT NULL)                                                           |
| 9. v_after = to_jsonb(tabs row) || jsonb_build_object('reason', p_reason)                                          |
| 10. PERFORM record_audit('tab.reopen', 'tab', p_tab_id, v_before, v_after, 'rpc')  -- NEW audit action, register  |
|     in audit-actions.ts BEFORE this migration (CI-enforced, Phase 22 Pitfall 1 recurs)                            |
| 11. RETURN jsonb_build_object('ok', true, 'reopenCount', new_count, 'voidedPaymentTotal', v_voided_total)          |
+---------------------------------------------------------------------------------------------------------------+
        |
        v
[Tab is now a normal 'open' tab. Manager uses existing add-item-to-tab/remove-item-from-tab, then closes]
        |
        v
[close_tab / process_payment_atomic / process_split_payment_atomic re-invoked]
   -- MUST filter status <> 'reopened_void' in their "how much has been paid" sum, or the voided
   -- original payment amount gets summed alongside the new payment (Pitfall 3)
```

### Recommended Project Structure
```
supabase/migrations/
├── <ts1>_payments_status_column.sql        # NEW: payments.status text, default 'completed', CHECK
├── <ts2>_tabs_reopen_columns.sql            # NEW: tabs.reopen_count int default 0, tabs.last_reopened_at timestamptz
├── <ts3>_reopen_tab_rpc.sql                 # NEW: reopen_tab RPC (Pattern 1 above)
└── <ts4>_fix_payment_sums_exclude_reopened_void.sql
                                              # NEW: CREATE OR REPLACE on process_payment_atomic,
                                              #      process_split_payment_atomic, get_caja_report,
                                              #      close_caja_session, process_refund — add
                                              #      status filter to each (Pitfalls 3-5)
src/
├── shared/lib/
│   ├── audit-actions.ts                     # ADD 'tab.reopen' (Wave 0 — CI-gated)
│   ├── rbac.ts                              # ADD 'reopen_tab' to STAFF_ACTIONS + MANAGER_EXTRA
│   └── rbac.test.ts                         # UPDATE hand-written ALLOWED mirror fixture (Phase 22 recurred this exact gap)
│   └── domain.ts                            # PaymentSchema += status; TabSchema += reopenCount/lastReopenedAt
├── features/reopen-tab/                     # NEW FSD slice, mirrors features/process-refund/
│   ├── model/useReopenTab.ts                # mutation hook, mirrors useProcessRefund.ts / useEditPaidTab.ts
│   ├── ui/ReopenTabDialog.tsx                # mirrors RefundSheet's PIN-gate + required-reason pattern (simpler — no item list)
│   └── index.ts
└── widgets/PaymentPane/ui/PaymentPane.tsx    # ADD a ReopenTabButton alongside RefundButton/EditTicketButton,
                                              # gated on payment.status !== 'reopened_void' and tab.status IN ('closed','paid')
```

### Pattern 1: Status-reversal RPC with cap/window guard (new — no direct analog, composed from 3 precedents)
**What:** A `SECURITY DEFINER` RPC that locks the tab row `FOR UPDATE`, asserts `p_expected_version`, checks a count+timestamp cap BEFORE mutating anything, voids sibling payment rows via a plain `tab_id` filter, writes an offsetting `caja_entries` row, flips `tabs.status` back to `'open'` while simultaneously clearing `closed_at` (CHECK-constraint requirement), bumps `version`+`reopen_count`+`last_reopened_at` in ONE `UPDATE`, and calls `record_audit()` on the success path only.
**When to use:** Exactly `reopen_tab`. Compose from: `edit_paid_tab`'s role-check/version-guard/offsetting-caja-entry/audit skeleton (structure), `process_split_payment_atomic`'s tab-status transition pattern (status literal check before mutating), and this phase's own new cap/window logic (no precedent exists for a rolling count+timestamp cap anywhere in this codebase — write it fresh, but keep it inside the same locked read as the version check, per D-03).
**Example:**
```sql
-- Source: supabase/migrations/20260719000001_edit_paid_tab_rpc.sql (skeleton to copy)
SELECT version, status, reopen_count, last_reopened_at INTO v_current, v_status, v_reopen_count, v_last_reopened
FROM tabs WHERE id = p_tab_id FOR UPDATE;

IF v_current IS NULL THEN
  RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
END IF;
IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
  RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
END IF;
IF v_status NOT IN ('closed', 'paid') THEN
  RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_REOPENABLE', 'message', 'Only closed or paid tabs can be reopened');
END IF;

-- D-03: cap check under the SAME lock, before any mutation
IF v_reopen_count >= 2 THEN
  RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_CAP_EXCEEDED', 'message', 'This tab has already been reopened twice');
END IF;

-- D-02: window resets on each reopen; NULL last_reopened_at means "never reopened", skip the check
IF v_last_reopened IS NOT NULL AND NOW() - v_last_reopened > INTERVAL '24 hours' THEN
  RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_WINDOW_EXPIRED', 'message', 'Reopen window has expired');
END IF;
```

### Pattern 2: Excluding voided-by-reopen rows from every existing payment-sum site (CRITICAL — new, no precedent, must be added by this phase)
**What:** Every existing function/RPC that computes "total paid" or "total revenue" by summing `payments` must additionally exclude rows where `status = 'reopened_void'`.
**When to use:** All 4 sites confirmed by direct read this session:
1. `process_payment_atomic` (`supabase/migrations/20260512000002_rpc_versioned_group_a.sql` line 190-193) — `v_paid_line` calc, currently `WHERE p.tab_id = p_tab_id AND p.is_refund = false`.
2. `process_split_payment_atomic` (`supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` line 258-261) — same `v_paid_line` calc, same missing filter.
3. `get_caja_report` (`supabase/migrations/20260421000004_caja_report_entries.sql` lines 56-64, 118-137) — `v_total_revenue`/`v_cash_sales`/`v_card_sales`/`v_rappi_sales` and per-staff `sales_total`, currently filtered only by `is_deleted = FALSE`, no `is_refund` or `status` filter at all (refunds already net out because they're stored as negative amounts — a `reopened_void` row is NOT negative, so it WILL inflate revenue unless excluded).
4. `close_caja_session` (`supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql` lines 140-142) — tip-pooling `SUM(tip_amount)`, currently `WHERE tab_id = ANY(v_tab_ids) AND is_deleted = FALSE`.
5. (Bonus, same root cause) `process_refund` (latest: `supabase/migrations/20260708000003_fix_process_refund_audit_log_column.sql` line 40-41) — the original-payment lookup `WHERE id = p_original_payment_id AND is_refund = false` should also reject a `reopened_void` row (a manager should not be able to refund a payment that a reopen already voided).
**Example:**
```sql
-- BEFORE (process_payment_atomic, live today):
SELECT COALESCE(ROUND(SUM(p.amount), 2), 0) INTO v_paid_line
FROM payments p
WHERE p.tab_id = p_tab_id
  AND p.is_refund = false;

-- AFTER (this phase must patch all 4-5 sites this way):
SELECT COALESCE(ROUND(SUM(p.amount), 2), 0) INTO v_paid_line
FROM payments p
WHERE p.tab_id = p_tab_id
  AND p.is_refund = false
  AND p.status IS DISTINCT FROM 'reopened_void';
```
Use `IS DISTINCT FROM` (not `<>`) so existing rows where `status` might read as the column's own default (`'completed'`) are unaffected regardless of NULL-handling — matches this codebase's existing `IS DISTINCT FROM` usage for nullable-comparison-safety (see `process_split_payment_atomic` line 205: `v_rappi_tab IS DISTINCT FROM v_leg_rappi`).

### Pattern 3: PIN-gated single-reason confirm dialog (reuse — simpler than `RefundSheet`/`EditPaidTabDialog`)
**What:** No item list, no field editors — just a reason textarea + Confirm + PIN gate, since `reopen_tab` takes no payload beyond `p_tab_id`/`p_expected_version`/`p_reason`.
**When to use:** `ReopenTabDialog`. Mirror `RefundSheet.tsx`'s PIN-gate wiring (`ManagerPinDialog` + `requiredAction`), but drop the per-item override `Map` state entirely — this is the simplest of the three PIN-gated dialogs in this codebase (refund has item overrides, edit-paid-tab has item overrides + notes, reopen has neither).
**Example:**
```tsx
// Source: src/features/manager-pin-gate/ui/ManagerPinDialog.tsx pattern (Pattern 2, 22-PATTERNS.md)
<ManagerPinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  requiredAction="reopen_tab"
  onSuccess={() => {
    setPinOpen(false);
    void handleSubmitReopen();
  }}
/>
```

### Anti-Patterns to Avoid
- **Updating `tabs.status` without clearing `closed_at` in the same statement:** `closed_at_requires_closed_status` CHECK constraint (`supabase/migrations/20260427000001_split_bill_schema.sql` lines 30-34) rejects `status='open' AND closed_at IS NOT NULL`. `reopen_tab`'s tabs UPDATE must set both in one statement, exactly like it must bump `version` by exactly +1 in one statement (same "combine into one UPDATE" discipline `edit_paid_tab` already established).
- **Deriving the reopen cap from `audit_logs` COUNT:** Explicitly rejected by D-03 — use the dedicated `tabs.reopen_count` column under the same `FOR UPDATE` lock already taken for the version check.
- **Looping over `payment_group_id` siblings individually:** Unnecessary complexity — a single `UPDATE payments SET status=... WHERE tab_id=p_tab_id AND is_refund=false AND status='completed'` already catches every split-payment leg in one statement (see Summary).
- **Leaving `process_payment_atomic`/`get_caja_report`/etc. unpatched "because CONTEXT.md's Success Criteria don't mention them":** They are a direct, unavoidable consequence of adding `payments.status` — every pre-existing SUM over `payments` implicitly assumed every non-refund row counts forever. Skipping this patch is a correctness bug, not scope discipline (see Common Pitfalls 3-5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version-guarded row lock + P0V01/P0V02 re-raise | A new concurrency-control mechanism | The Phase 15 Group-A template (`FOR UPDATE` + `p_expected_version` + explicit `RAISE` in the `EXCEPTION` block) | Every mutating RPC in this codebase already follows this exact contract; a new one would fragment the concurrency model |
| Manager PIN verification | A new PIN dialog/hook | `ManagerPinDialog` (`src/features/manager-pin-gate/`) | Already handles PIN entry, eligible-staff filtering via `canAccess(role, requiredAction)`, error state |
| Offsetting financial-correction bookkeeping | A new caja-adjustment table/mechanism | `caja_entries` free-text `concept` pattern, exactly as `edit_paid_tab` uses it | Phase 22 explicitly built this pattern anticipating Phase 23's identical need (see its migration comment) |
| Audit trail | A new audit table/mechanism | `record_audit()` + `audit_logs.before`/`after` jsonb | Same mechanism used by every other financial-correction RPC in this codebase |

**Key insight:** The RPC-writing infrastructure (version guard, PIN gate, audit trail, offsetting caja entry) is 100% solved by Phase 14/15/22 precedent. The genuinely new work is: (1) the cap/window check (no precedent, write fresh but keep it inside the existing lock), and (2) the payment-sum correctness sweep across 4-5 existing functions (also no precedent — this is the part a planner unfamiliar with the codebase's actual query sites would miss entirely).

## Common Pitfalls

### Pitfall 1: `closed_at_requires_closed_status` CHECK constraint blocks the reopen UPDATE
**What goes wrong:** `UPDATE tabs SET status = 'open', reopen_count = reopen_count + 1, ... WHERE id = p_tab_id` (without also clearing `closed_at`) violates `CHECK ((closed_at IS NULL AND status IN ('open','split')) OR (closed_at IS NOT NULL AND status IN ('closed','paid','voided')))` — the whole RPC transaction aborts.
**Why it happens:** The constraint was added in Phase 6 (`20260427000001_split_bill_schema.sql`) for the split-tab feature, long before anyone needed to flip `status` backward from a terminal state to `'open'`. No prior RPC has ever done this (`edit_paid_tab` explicitly does NOT change `status`).
**How to avoid:** `UPDATE tabs SET status='open', closed_at=NULL, reopen_count=reopen_count+1, last_reopened_at=NOW(), version=version+1, updated_at=NOW() WHERE id=p_tab_id` — one statement, both columns.
**Warning signs:** Integration test gets a raw Postgres `check_violation` (SQLSTATE 23514) instead of the expected `ok:true` response.

### Pitfall 2: `AuditActionSchema` must register `'tab.reopen'` before the migration lands
**What goes wrong:** `src/shared/lib/__tests__/audit-actions.test.ts` greps every migration file for `PERFORM record_audit('...'` and fails CI if the action string isn't in `AuditActionSchema.options`. This bit Phase 22 (`tab.edit_paid`) and will bite this phase identically.
**How to avoid:** Add `'tab.reopen'` to `AuditActionSchema`'s enum array AND the `AuditAction` const object in `src/shared/lib/audit-actions.ts` as a Wave-0 task, before the migration task.
**Warning signs:** `npm run test` fails on `audit-actions enforcement` after the migration lands.

### Pitfall 3: `process_payment_atomic`/`process_split_payment_atomic`'s "fully paid" check double-counts the voided original payment
**What goes wrong:** Both RPCs compute `v_paid_line = SUM(p.amount) WHERE p.tab_id=p_tab_id AND p.is_refund=false` with no `status` filter (confirmed at `20260512000002_rpc_versioned_group_a.sql:190-193` and `20260707000003_split_payment_columns_and_rpc.sql:258-261`). After `reopen_tab` flips the original payment to `reopened_void` (row stays in the table, amount unchanged), a NEW payment on the reopened tab will sum `old_voided_amount + new_amount` against `v_owed` — closing the tab prematurely (before the new payment covers the actual owed total) or rejecting a legitimate partial payment.
**Why it happens:** These sums were written before `payments.status` existed; `is_refund` was the only "does this row still count" signal, and a reopen-voided row is explicitly NOT a refund (D-05 says leave `isRefund` rows alone — reopen uses a separate mechanism).
**How to avoid:** Add `AND p.status IS DISTINCT FROM 'reopened_void'` to both `v_paid_line` calculations, in the same phase, in a dedicated migration (`CREATE OR REPLACE FUNCTION` re-declares the full existing body with only this one added clause — same "targeted addition, not a rewrite" discipline as Phase 22's CR-01 fix).
**Warning signs:** A reopened-and-repaid tab closes on a payment smaller than the actual owed amount, or a manager's legitimate second payment attempt gets rejected as unnecessary.

### Pitfall 4: `get_caja_report`'s revenue totals inflate after a reopen unless patched
**What goes wrong:** `get_caja_report` (`20260421000004_caja_report_entries.sql:56-64,118-137`) sums `amount + tip_amount` filtered only by `is_deleted = FALSE` — no `is_refund` exclusion either, because refund rows are stored as negative amounts and net out naturally (per `domain.ts`'s documented ledger convention). A `reopened_void` row is NOT negative — leaving it unfiltered means its amount is counted as real revenue forever, even though the money it represents was never actually kept (the tab was reopened specifically because that payment needs to be undone/corrected).
**How to avoid:** Add `AND status IS DISTINCT FROM 'reopened_void'` to every `SELECT ... FROM payments` in `get_caja_report` (both the top-level revenue aggregate and the per-staff `sales_total` subquery).
**Warning signs:** A caja report's `totalRevenue` doesn't reconcile with the sum of caja_entries + genuinely-completed payments after any reopen occurred during that session.

### Pitfall 5: `close_caja_session`'s tip-bucket pooling includes voided tips
**What goes wrong:** `close_caja_session` (`20260709000002_close_caja_session_tip_distribution.sql:140-142`) pools `SUM(tip_amount) WHERE tab_id = ANY(v_tab_ids) AND is_deleted = FALSE` with no status filter — a `reopened_void` payment's tip amount would still be distributed to floor/bar/kitchen staff even though the underlying payment was voided.
**How to avoid:** Add the same `AND status IS DISTINCT FROM 'reopened_void'` filter to this SUM.
**Warning signs:** `tip_distribution_entries.total_tips` doesn't match the sum of genuinely-completed payments' `tip_amount` for the session.

### Pitfall 6: `process_refund` should reject refunding an already-voided-by-reopen payment
**What goes wrong:** `process_refund` (latest at `20260708000003_fix_process_refund_audit_log_column.sql:40-41`) looks up the original payment via `WHERE id = p_original_payment_id AND is_refund = false` — a `reopened_void` row passes this check (it's not a refund), so a manager could attempt to refund money that was already voided by a reopen, double-correcting the same payment.
**How to avoid:** Extend the guard to `AND is_refund = false AND status IS DISTINCT FROM 'reopened_void'`, raising the existing `NOT_FOUND` exception for the reopened-void case too (reuse the message, no new error code needed).
**Warning signs:** Two competing correction records (a `reopened_void` flag AND a `refunds` row) exist for the same original payment.

### Pitfall 7: `rbac.test.ts`'s hand-written `ALLOWED` mirror fixture goes stale (recurred every phase since Phase 13)
**What goes wrong:** `src/shared/lib/rbac.test.ts` has a hand-maintained fixture mirroring `STAFF_ACTIONS`/`MANAGER_EXTRA` — Phase 22's SUMMARY explicitly documents this exact test needing a manual addition (`edit_paid_tab` under `manager`) as "1 real regression (Rule 1)" when the same pattern was followed.
**How to avoid:** When adding `'reopen_tab'` to `STAFF_ACTIONS` + `MANAGER_EXTRA` in `rbac.ts`, also add it to the mirror fixture in `rbac.test.ts` in the same commit.
**Warning signs:** `npm run test` fails on the RBAC fixture-mismatch assertion after the `rbac.ts` change.

## Code Examples

### Full reopen_tab skeleton (composed from edit_paid_tab + process_split_payment_atomic precedents)
```sql
-- Source: supabase/migrations/20260719000001_edit_paid_tab_rpc.sql (structure),
--         supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql (status-literal check style)
CREATE OR REPLACE FUNCTION public.reopen_tab(
  p_tab_id uuid,
  p_expected_version int,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_current int;
  v_status tab_status;
  v_reopen_count int;
  v_last_reopened timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_voided_total numeric;
  v_caja uuid;
  v_concept text;
BEGIN
  SELECT id INTO v_staff_id FROM profiles
  WHERE id = auth.uid() AND role IN ('manager', 'admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required' USING ERRCODE = 'P0A01';
  END IF;

  SELECT version, status, reopen_count, last_reopened_at
  INTO v_current, v_status, v_reopen_count, v_last_reopened
  FROM tabs WHERE id = p_tab_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02';
  END IF;
  IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01';
  END IF;
  IF v_status NOT IN ('closed', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_REOPENABLE', 'message', 'Only closed or paid tabs can be reopened');
  END IF;
  IF v_reopen_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_CAP_EXCEEDED', 'message', 'This tab has already been reopened twice');
  END IF;
  IF v_last_reopened IS NOT NULL AND NOW() - v_last_reopened > INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REOPEN_WINDOW_EXPIRED', 'message', 'Reopen window has expired');
  END IF;

  SELECT to_jsonb(t.*) INTO v_before FROM tabs t WHERE t.id = p_tab_id;

  UPDATE payments
  SET status = 'reopened_void', updated_at = NOW()
  WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed';

  SELECT COALESCE(SUM(amount), 0) INTO v_voided_total
  FROM payments WHERE tab_id = p_tab_id AND status = 'reopened_void';

  IF v_voided_total <> 0 THEN
    SELECT id INTO v_caja FROM caja_sessions WHERE status = 'open' LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NO_OPEN_CAJA: an open caja session is required to record a reopen adjustment'
        USING ERRCODE = 'P0A02';
    END IF;
    v_concept := left(format('Reopen tab %s: %s', substr(p_tab_id::text, 1, 8),
      regexp_replace(COALESCE(NULLIF(TRIM(p_reason), ''), 'no reason given'), '[,.()]', '', 'g')), 200);
    INSERT INTO caja_entries (caja_session_id, type, amount, concept, staff_id)
    VALUES (v_caja, 'expense', v_voided_total, v_concept, v_staff_id);
  END IF;

  UPDATE tabs
  SET status = 'open', closed_at = NULL, reopen_count = reopen_count + 1,
      last_reopened_at = NOW(), version = version + 1, updated_at = NOW()
  WHERE id = p_tab_id;

  SELECT to_jsonb(t.*) || jsonb_build_object('reason', p_reason) INTO v_after
  FROM tabs t WHERE t.id = p_tab_id;

  PERFORM record_audit('tab.reopen', 'tab', p_tab_id, v_before, v_after, 'rpc');

  RETURN jsonb_build_object('ok', true, 'voidedPaymentTotal', v_voided_total);
EXCEPTION
  WHEN sqlstate 'P0V01' THEN RAISE;
  WHEN sqlstate 'P0V02' THEN RAISE;
  WHEN sqlstate 'P0A01' THEN RAISE;
  WHEN sqlstate 'P0A02' THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_tab(uuid, int, text) TO authenticated;
```

### `payments.status` migration
```sql
-- New column, minimal enum per D-01/Claude's Discretion
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'
  CHECK (status IN ('completed', 'reopened_void'));
```

### `tabs.reopen_count`/`tabs.last_reopened_at` migration
```sql
ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS reopen_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reopened_at timestamptz;
```

## State of the Art

Internal-pattern evolution only. Phase 15 (2026-04-28) established the `p_expected_version`/`FOR UPDATE` contract every mutating RPC must follow. Phase 22 (2026-07-19) established the "financial-correction RPC" shape (role check + version guard + offsetting caja entry + audit) that this phase's `reopen_tab` directly extends — but Phase 22 deliberately stopped short of ever changing `tabs.status` ("this is a correction tool, not a reopen. Phase 23 (reopen_tab) is out of scope here" — literal comment in `20260719000001_edit_paid_tab_rpc.sql`). This phase is the first to flip a terminal `tabs.status` back to `'open'`, which is why the `closed_at_requires_closed_status` CHECK constraint interaction (Pitfall 1) has never been exercised before.

**Deprecated/outdated:** None specific to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A plain `WHERE tab_id = p_tab_id AND is_refund = false AND status = 'completed'` correctly resolves D-05 (which payment rows flip) without any `payment_group_id`-aware branching | Summary, Pattern 1 | Low risk — verified directly against the Phase 18 split-payment schema/migration this session; `payment_group_id` is purely a descriptive tag, not a filtering requirement |
| A2 | The offsetting caja entry should be `type='expense'` (reopening reverses previously-booked income) | Architecture Patterns Pattern 1 step 7, Code Examples | Medium risk — CONTEXT.md doesn't explicitly specify the sign; this mirrors the intuition that "money already counted as income must be pulled back out" and is symmetric with `edit_paid_tab`'s delta-sign convention (`delta>0 -> income, delta<0 -> expense`, and a reopen's delta from the caja's perspective is always negative/an expense since it un-earns previously-recorded revenue) |
| A3 | The 4-5 payment-summing sites identified (Pattern 2) are the COMPLETE list of places needing a `reopened_void` exclusion filter | Common Pitfalls 3-6 | Medium risk — these were found via targeted `grep` for `FROM payments`/`is_refund` across all migrations this session; a new report widget added between now and execution could introduce a 6th site not caught here. Recommend the planner re-run the same grep at execution time as a Wave-0 verification step |
| A4 | `caja_entries.source_tab_id`/`source_type` columns should NOT be added in this phase (continue free-text `concept`) | Standard Stack Alternatives, Open Questions | Low risk — matches CONTEXT.md's stated default and Phase 22's explicit deferral comment; flagged again below in case the user wants to finally close this out now that both phases needing it exist |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Should `caja_entries` finally gain `source_tab_id`/`source_type` columns now that BOTH Phase 22 and Phase 23 need the identical offsetting-entry mechanism?**
   - What we know: Phase 22's migration comment explicitly deferred this decision to Phase 23's research phase ("Phase 23 (reopen_tab) needs the identical offsetting-entry mechanism and may introduce those columns later to replace this text encoding — do not add them here"). CONTEXT.md's Claude's Discretion section defaults to "continue free-text... unless research finds a strong reason to add columns now."
   - What's unclear: whether two consumers of the same workaround is "the reason" the deferral comment was waiting for, or whether it's still premature since neither is a reporting/query need yet (nothing currently parses `concept` back out programmatically).
   - Recommendation: Continue free-text for this phase (per CONTEXT.md's default) — no reporting code currently queries `caja_entries` by source, so the FK columns would be unused schema surface today. Revisit only if a future phase needs to filter/join caja_entries by originating tab.

2. **Does a reopened tab's re-payment stay attributed to its ORIGINAL (possibly long-closed) `caja_sessions` row, or should it move to the currently-open session?**
   - What we know: `tabs.caja_session_id` is set once at tab-open time and never reassigned (confirmed: no `UPDATE tabs SET caja_session_id` exists anywhere in the migration history). `get_caja_report` groups by `tabs.caja_session_id = p_caja_id`, so a reopened tab's NEW payment (inserted via `process_payment_atomic` after re-close) will be attributed to the tab's ORIGINAL caja session for reporting purposes — even if that session was closed days ago and its report already reviewed.
   - What's unclear: whether this is acceptable ("the tab always belongs to the session it opened under, corrections just adjust its numbers retroactively" — consistent with how `edit_paid_tab`'s offsetting entry ALSO targets the CURRENT open session while the edit itself stays attributed to the original tab) or whether product intent wants the re-payment to count toward TODAY's session instead.
   - Recommendation: Leave `tabs.caja_session_id` unchanged (no reassignment) — this matches the existing `edit_paid_tab` precedent exactly (edits change the tab's numbers but the tab keeps its original session attribution; only the offsetting caja_entries row targets the current session). Flag this behavior explicitly in the phase's UAT/verification so the user can confirm it matches expectations, since it's a genuine product nuance, not a bug.

3. **Should the `ReopenTabButton` also appear on a `'closed'`-status tab (D-06/D-04 say "closed or paid"), even though a `'closed'` tab may have zero payment rows (a comp'd/no-payment close via the existing `close-tab` feature)?**
   - What we know: `close-tab` feature (`src/features/close-tab/index.ts:56`) sets `status: 'closed'` — confirmed distinct from `'paid'` (set by `process_payment_atomic` when the item subtotal is fully covered). A `'closed'` tab may have zero `payments` rows.
   - What's unclear: nothing functionally — `reopen_tab`'s payment-void step naturally no-ops (0 rows updated, `v_voided_total = 0`, no caja entry needed) for a payment-less closed tab. This is just a UX confirmation, not a technical gap.
   - Recommendation: Allow reopening `'closed'` tabs with zero payments — the RPC already handles this gracefully via the `v_voided_total <> 0` guard around the caja-entry insert. No special-casing needed.

## Environment Availability

Not applicable — no new external dependencies. Uses the existing Supabase CLI/remote project already configured for this codebase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 (unit/integration) + Playwright ^1.59.1 (E2E) |
| Config file | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) — both pre-existing |
| Quick run command | `npx vitest run src/features/reopen-tab` (once created) |
| Full suite command | `npm run test` (unit), `npm run test:e2e` (E2E) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `reopen_tab` flips status, voids payment(s), enforces version guard | integration (live Supabase, mirrors `edit-paid-tab-rpc.integration.test.ts`) | `npx vitest run src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` | ❌ Wave 0 |
| SC-2 | Offsetting `caja_entries` row created | integration (same file, assert `caja_entries` row post-call) | same as above | ❌ Wave 0 |
| SC-3 | 24h window (from most recent reopen) + 2x cap enforced | integration (same file: seed `reopen_count=2` -> `REOPEN_CAP_EXCEEDED`; seed `last_reopened_at` > 24h ago -> `REOPEN_WINDOW_EXPIRED`) | same as above | ❌ Wave 0 |
| SC-4 | `audit_logs` row written on every reopen | integration (same file, assert row post-call) | same as above | ❌ Wave 0 |
| (implicit) | Re-paying a reopened tab does NOT double-count the voided original payment | integration (NEW test: reopen a paid tab, re-pay via `process_payment_atomic`, assert the tab closes only once the NEW payment covers `v_owed`, not `v_owed - old_voided_amount`) | same file or a dedicated `process-payment-atomic-reopen-interaction.integration.test.ts` | ❌ Wave 0 — **do not skip this test; it is the phase's highest-risk regression** |
| (implicit) | `get_caja_report`/`close_caja_session` exclude `reopened_void` from totals | integration (assert report totals for a session containing a reopen match hand-computed expected values) | same as above | ❌ Wave 0 |
| SC-3 (UI) | `ReopenTabDialog` PIN gate -> reason -> confirm flow | E2E | `npx playwright test e2e/48-reopen-closed-ticket.spec.ts` (new — next available number after `47-edit-paid-tab.spec.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run typecheck && npm run lint && npm run test`
- **Phase gate:** Full suite green (`npm run test` + targeted `npm run test:e2e -- e2e/48-reopen-closed-ticket.spec.ts`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` — covers SC-1, SC-2, SC-3, SC-4 (mirror `edit-paid-tab-rpc.integration.test.ts`'s live-Supabase pattern)
- [ ] A dedicated integration test (in the same file or a sibling) proving `process_payment_atomic`'s paid-line calc excludes `reopened_void` rows after a reopen — this is the phase's single most important regression test and has no existing analog to copy structurally
- [ ] `e2e/48-reopen-closed-ticket.spec.ts` — covers SC-3 (UI flow)
- Framework install: none — Vitest/Playwright already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing Supabase Auth session (`auth.uid()`) reused |
| V3 Session Management | no | No change |
| V4 Access Control | yes | Two layers (defense-in-depth, matches `edit_paid_tab`/`process_refund`): (1) client-side `ManagerPinDialog` filters eligible staff via `canAccess(role, 'reopen_tab')`; (2) RPC re-checks `role IN ('manager','admin')` server-side |
| V5 Input Validation | yes | `p_reason` sanitized before caja_entries `concept` concatenation (mirror `edit_paid_tab`'s `regexp_replace(...,'[,.()]','','g')` — `caja_entries.concept` has a `CHECK (char_length BETWEEN 1 AND 200)`) |
| V6 Cryptography | no | No new cryptographic surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-manager calls `reopen_tab` directly via the Supabase client, bypassing the UI's `ManagerPinDialog` | Elevation of Privilege | Server-side `SELECT id FROM profiles WHERE id=auth.uid() AND role IN ('manager','admin')` check, raising `AUTH_FORBIDDEN` |
| A manager repeatedly reopens the same tab to launder revenue/avoid caja reconciliation | Repudiation / Tampering | The 2x hard cap + 24h rolling window (D-02/D-03) directly bound this; every reopen is audit-logged with `before`/`after` state and a mandatory reason |
| Two managers race to reopen the same tab concurrently | Tampering (data race) | `p_expected_version` + `FOR UPDATE` + `bump_version_on_update` trigger — identical to every other versioned RPC |
| A reopened tab's voided-but-not-deleted payment row gets refunded a second time via `process_refund`, or double-counted in a payment-sum, because callers assume every non-refund `payments` row is still "live" | Tampering / Repudiation | `payments.status='reopened_void'` filter added to `process_refund`'s lookup AND all 4 payment-summing sites (Pattern 2) — this is the phase's core new invariant |

## Sources

### Primary (HIGH confidence — read directly from this codebase this session)
- `.planning/phases/23-reopen-closed-ticket/23-CONTEXT.md` — locked decisions
- `.planning/phases/23-reopen-closed-ticket/23-DISCUSSION-LOG.md` — alternatives considered
- `.planning/phases/22-edit-paid-ticket-history/22-RESEARCH.md`, `22-PATTERNS.md` — direct precedent for this phase's RPC shape
- `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql`, `20260720000001_fix_edit_paid_tab_inventory.sql` — `edit_paid_tab` full body (skeleton to copy)
- `supabase/migrations/20260512000002_rpc_versioned_group_a.sql` — `process_payment_atomic` full body (`v_paid_line` gap, lines 190-193)
- `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` — `process_split_payment_atomic` full body (`payment_group_id`/`split_index` schema, `v_paid_line` gap lines 258-261)
- `supabase/migrations/20260421000004_caja_report_entries.sql` — `get_caja_report` full body (revenue/staff-summary gap, lines 56-64, 118-137)
- `supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql` — `close_caja_session` full body (tip-pooling gap, lines 140-142)
- `supabase/migrations/20260708000003_fix_process_refund_audit_log_column.sql` — latest `process_refund` body (original-payment lookup gap, lines 40-41)
- `supabase/migrations/20260427000001_split_bill_schema.sql` — `closed_at_requires_closed_status` CHECK constraint (lines 30-34) — the Pitfall 1 landmine
- `supabase/migrations/20260427000004_parent_auto_close_trigger.sql` — confirms `check_parent_tab_auto_close` fires on INSERT only, unaffected by reopen's UPDATE-based void
- `supabase/migrations/20260414000001_enums.sql` — `tab_status` enum base values
- `src/shared/lib/domain.ts` — `PaymentSchema` (lines 611-640, `isRefund`/`paymentGroupId`/`splitIndex` fields, no `status` yet), `TabSchema` (lines 427-458, `closedAt`/`version`, no `reopenCount`/`lastReopenedAt` yet)
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` enum, CI-enforced (confirms `tab.reopen` not yet registered)
- `src/shared/lib/rbac.ts` — `STAFF_ACTIONS`/`MANAGER_EXTRA`/`ADMIN_ACTIONS` composition (lines 13-94)
- `src/shared/lib/rbac.test.ts` — hand-written `ALLOWED` mirror fixture (line 44, confirms Phase 22's exact gap recurs)
- `src/widgets/PaymentPane/ui/PaymentPane.tsx` — `RefundButton`/`EditTicketButton` guard pattern (lines 24-66) to mirror for `ReopenTabButton`
- `src/entities/payment/model/queries.ts` — `usePayments()`/`mapPaymentRow` (no `status` mapping yet — must be added)
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement` absent (treated enabled)
- `e2e/` directory listing — confirms `48-reopen-closed-ticket.spec.ts` is the next available spec number after `47-edit-paid-tab.spec.ts`

### Secondary (MEDIUM confidence)
None — all findings this session were grounded directly in primary sources (live codebase read).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, pure internal reuse verified by direct file reads
- Architecture: HIGH — RPC skeleton, CHECK constraint interaction, and all 4-5 payment-sum sites confirmed via direct migration reads this session, not inferred
- Pitfalls: HIGH for schema-grounded pitfalls (1-6, based on actual constraint/query text read this session); MEDIUM for the completeness of Pitfall 3-6's site list (A3 in Assumptions Log — recommend a Wave-0 re-grep as a cheap confirmation step)

**Research date:** 2026-07-20
**Valid until:** Until the next migration touching `tabs`/`payments`/`caja_entries`/`caja_sessions`/`process_payment_atomic`/`get_caja_report` lands (internal-codebase research has no external staleness clock, but a schema or RPC change would invalidate the exact line-number citations above)
