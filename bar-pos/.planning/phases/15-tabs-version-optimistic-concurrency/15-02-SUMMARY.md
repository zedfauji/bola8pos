---
phase: 15-tabs-version-optimistic-concurrency
plan: 02
subsystem: data-layer
tags: [migration, optimistic-concurrency, rpc, security-definer, sqlstate]
dependency_graph:
  requires:
    - "15-01: tabs.version column + bump_version_on_update trigger (P0V01 backstop)"
    - "14-03: record_audit() wired into process_payment_atomic success path"
  provides:
    - "process_payment_atomic(p_expected_version) — server-side conflict guard for the payment RPC"
    - "create_order_with_items(p_expected_version) — server-side conflict guard for the order-create RPC"
    - "P0V01 / P0V02 raised on stale or missing tab row (re-raised through EXCEPTION block, not swallowed)"
  affects:
    - "frontend useProcessPayment + create-order hooks (Plan 15-03 will pass p_expected_version)"
    - "Group B (9 direct-table-UPDATE hooks) — NOT touched here; Plan 15-03 owns them"
tech_stack:
  added: []
  patterns:
    - "Canonical FOR UPDATE guard block: select version from tabs ... for update + raise P0V01/P0V02"
    - "Re-raise typed errors through WHEN sqlstate ... THEN RAISE — bypasses generic WHEN OTHERS swallowing"
    - "Last-positional p_expected_version DEFAULT NULL — preserves positional + named-arg compatibility"
key_files:
  created:
    - bar-pos/supabase/migrations/20260512000002_rpc_versioned_group_a.sql
    - .planning/phases/15-tabs-version-optimistic-concurrency/15-02-SUMMARY.md
  modified: []
decisions:
  - "p_expected_version placed LAST as DEFAULT NULL — no breaking change for existing callers; 15-03 hooks must pass the arg by name"
  - "Re-raise P0V01/P0V02 via WHEN sqlstate ... THEN RAISE in process_payment_atomic so the WHEN OTHERS catch-all does not swallow conflicts into ok=false"
  - "Preserve existing 14-03 record_audit success-path call; conflict-path audit is client-side per D-17 revised — raise exception inside the RPC body would roll any audit insert back"
  - "Bump version on partial-pay path too (not just close path) so concurrent partial-pay attempts using the same expected_version are rejected by the next call's guard"
  - "create_order_with_items had no tabs UPDATE before — added explicit `update tabs set version = version + 1` after inserts so the bump trigger advances version consistently"
  - "Migration not pushed in this plan — push deferred to plan 15-05 (BLOCKING) per phase plan"
metrics:
  duration: "~10min"
  completed: "2026-04-28"
  tasks: 1
  files: 1
---

# Phase 15 Plan 02: Group A RPC Version Guards Summary

Server-side optimistic-concurrency enforcement for the 2 SECURITY DEFINER RPCs (`process_payment_atomic`, `create_order_with_items`) — adds `p_expected_version int` parameter, canonical `FOR UPDATE` guard raising `P0V01` / `P0V02`, and `version = version + 1` on every successful UPDATE branch.

## What Shipped

### Task 1 — Migration `20260512000002_rpc_versioned_group_a.sql`

- **`process_payment_atomic`** redefined:
  - `p_expected_version INT DEFAULT NULL` appended as the 14th (LAST) positional parameter, preserving all 13 prior parameters in declaration order.
  - The existing `SELECT status, rappi_order_id ... FOR UPDATE` is extended to also read `version` into `v_current` — single locking read, no extra round-trip.
  - `IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND_VERSIONED' USING ERRCODE = 'P0V02'` (replaces the prior `RETURN ok=false code=TAB_NOT_FOUND` shape for the missing-row case — the new typed SQLSTATE flows through PostgREST to the client `parseSupabaseError` from Plan 15-01).
  - `IF p_expected_version IS NOT NULL AND v_current <> p_expected_version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE = 'P0V01'` — null-tolerant so existing callers that have not yet been updated (Plan 15-03 work) are unaffected.
  - Tab-close UPDATE branch now sets `version = version + 1` alongside `status = 'paid' / closed_at / updated_at`.
  - Partial-pay branch (where total paid does NOT yet meet line subtotal) now also `UPDATE tabs SET updated_at = NOW(), version = version + 1` — so a second concurrent partial-pay using the same expected_version is correctly rejected on the next call's guard.
  - `EXCEPTION` block adds two explicit `WHEN sqlstate 'P0V01' THEN RAISE` and `WHEN sqlstate 'P0V02' THEN RAISE` clauses BEFORE `WHEN OTHERS` so the catch-all does not swallow conflicts into the generic `ok=false code=INTERNAL` shape.
  - Existing Phase 14-03 `record_audit('payment.process', ...)` success-path call preserved — sits AFTER the version guard, so on conflict the raise fires first and audit is correctly skipped (no rollback hazard).
  - REVOKE/GRANT statements updated to the new 14-parameter signature with trailing `INT`.

- **`create_order_with_items`** redefined:
  - `p_expected_version int DEFAULT NULL` appended as the 7th (LAST) positional parameter after the existing `p_skip_depletion` (Plan 04 added).
  - Canonical guard block at the top of the body: `select version into v_current from tabs where id = p_tab_id for update; if v_current is null then raise NOT_FOUND_VERSIONED P0V02; if p_expected_version <> v_current then raise STALE_VERSION P0V01`.
  - Original body had NO `UPDATE tabs` (only INSERTs into orders / order_items + the depletion loop). Added `UPDATE tabs SET version = version + 1, updated_at = NOW() WHERE id = p_tab_id` after the inserts so the `bump_version_on_update` trigger advances version consistently with the optimistic-concurrency contract.
  - GRANT to `authenticated` updated to the 7-parameter signature.
  - No EXCEPTION block in the original — none added; raise propagates naturally to PostgREST.

- DOWN comment block lists the prior signatures from `20260511000002_rpc_audit_wiring.sql` (process_payment_atomic) and `20260428000003_create_order_with_items_v2.sql` (create_order_with_items) — replay restores pre-Phase-15 shape.

- Group B inline header comment present: "Group B (9 hook-side optimistic paths: close_tab, transfer_tab, void_order, process_refund, add_combo_to_tab, assign_pool_session_to_tab, caja_open, caja_close, register_caja_entry, start_pool_timer, stop_pool_timer) is NOT modified here".

- **Not pushed** — migration push is deferred to Plan 15-05 (BLOCKING) per phase plan.

- Commit: `4c6ca9d`

## Path Count Reaffirmation

> **11 conflict-prone paths total — 2 RPC-guarded (this plan), 9 hook-optimistic (Plan 15-03).**

Group A (this plan, 2 paths): `process_payment_atomic`, `create_order_with_items`.

Group B (Plan 15-03, 9 paths): `close_tab`, `transfer_tab`, `void_order`, `process_refund`, `add_combo_to_tab`, `assign_pool_session_to_tab`, `caja_open`, `caja_close`, `register_caja_entry`, `start_pool_timer`, `stop_pool_timer`.

## Audit Logging Strategy

Audit on the **conflict (P0V01/P0V02) error path** is deferred to the frontend `onError` handler (D-17 revised implementation choice). Reason: PL/pgSQL `raise exception` rolls back the entire transaction including any `record_audit` insert that occurred before the raise. Server-side audit-on-raise is not realizable in pure PL/pgSQL; alternatives (Edge Function wrapper, dblink, pg_notify) were rejected for cost/scope per Phase 15 CONTEXT D-17.

Audit on the **success path** is unchanged — the existing `PERFORM record_audit('payment.process', ...)` call from Phase 14-03 is preserved verbatim in `process_payment_atomic` (sits after the version guard, after the payment INSERT, on the success branch only). `create_order_with_items` has no success-path audit call (consistent with its pre-Phase-15 shape).

## Group B Confirmation

No SQL was written for any Group B path in this plan. Confirmed via:
- File scope: only `bar-pos/supabase/migrations/20260512000002_rpc_versioned_group_a.sql` was created.
- Function bodies: only `public.process_payment_atomic` and `public.create_order_with_items` are redefined; the migration contains zero `CREATE OR REPLACE FUNCTION` statements for any of the 9 Group B paths.
- Inline header comment in the migration restates Group B is deferred to Plan 15-03.

## Final Parameter Ordering

| RPC | Pre-15-02 arity | Post-15-02 arity | Position of `p_expected_version` |
|-----|-----------------|------------------|----------------------------------|
| `process_payment_atomic` | 13 | 14 | LAST (14th), DEFAULT NULL |
| `create_order_with_items` | 6 | 7 | LAST (7th), DEFAULT NULL |

## Verification

```
$ grep -ic "p_expected_version int" 20260512000002_rpc_versioned_group_a.sql
3        # signature lines ×2 + body declarations matched case-insensitively

$ grep -c "ERRCODE = 'P0V01'" 20260512000002_rpc_versioned_group_a.sql
2        # one per RPC

$ grep -c "ERRCODE = 'P0V02'" 20260512000002_rpc_versioned_group_a.sql
2        # one per RPC

$ grep -c "version = version + 1" 20260512000002_rpc_versioned_group_a.sql
5        # close branch + partial-pay branch in process_payment_atomic
         # + create_order_with_items tail UPDATE + 2 DOWN-comment refs

$ grep -icE "create or replace function public\.(process_payment_atomic|create_order_with_items)" 20260512000002_rpc_versioned_group_a.sql
2        # both RPCs redefined

$ git log --oneline | head -1
4c6ca9d feat(15-02): Group A RPC version guards ...
```

Plan automated verification command (from `<verify><automated>`) is satisfied — every grep returns ≥ 1.

## Threat Model Compliance

All STRIDE mitigations from the plan's `<threat_model>` are implemented:

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-15-02-01 (Tampering — TOCTOU on tabs) | mitigate | `SELECT version ... FOR UPDATE` acquires row lock; concurrent RPC waits and re-checks. Implemented in both RPCs. |
| T-15-02-02 (Spoofing — forged p_expected_version) | accept | Mismatch raises P0V01 harmlessly; no privilege escalation; null-tolerant guard means a forged-null falls through to existing logic without bypassing other validation. |
| T-15-02-03 (Info Disclosure — error message leak) | mitigate | `RAISE EXCEPTION 'STALE_VERSION'` carries no row data, no current version, no terminal id. Generic SQLSTATE only. |
| T-15-02-04 (DoS — FOR UPDATE contention) | accept | Single-row pessimistic lock; existing RPCs already locked the row implicitly via UPDATE. No new contention. |
| T-15-02-05 (EoP — SECURITY DEFINER + search_path) | mitigate | `SET search_path = public` preserved on `process_payment_atomic`. `create_order_with_items` is `SECURITY INVOKER` (unchanged), `SET search_path = public` preserved. No new SECURITY DEFINER functions introduced. |
| T-15-02-06 (Repudiation — conflict invisible to audit) | mitigate | Frontend hook (Plan 15-03) calls `record_audit` on STALE_VERSION error path; acknowledged crash-window limitation per D-17 revised. |

## Deviations from Plan

**[Rule 3 — Critical correctness] Re-raise P0V01/P0V02 in process_payment_atomic exception block.**
- **Found during:** Task 1 implementation, while re-reading the existing `EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'code', 'INTERNAL', ...)` block from `20260511000002_rpc_audit_wiring.sql`.
- **Issue:** The existing catch-all `WHEN OTHERS` would swallow our newly-raised `P0V01`/`P0V02` SQLSTATEs and return them to the client as `ok=false code=INTERNAL message="Payment failed"`. The frontend `parseSupabaseError` (Plan 15-01) maps SQLSTATE `P0V01`/`P0V02` to typed `STALE_VERSION`/`NOT_FOUND_VERSIONED` errors — but only if the SQLSTATE actually reaches the client. Without the re-raise, conflicts would surface as opaque INTERNAL errors and the toast UX from D-08 would never fire.
- **Fix:** Added explicit `WHEN sqlstate 'P0V01' THEN RAISE` and `WHEN sqlstate 'P0V02' THEN RAISE` clauses BEFORE `WHEN OTHERS` so the typed errors propagate intact. `create_order_with_items` has no exception block in its current shape, so the raise propagates naturally — no fix needed there.
- **Files modified:** `bar-pos/supabase/migrations/20260512000002_rpc_versioned_group_a.sql`
- **Commit:** `4c6ca9d` (same task commit; caught + fixed inline before commit)

**[Rule 2 — Missing critical functionality] Bump version on partial-pay branch.**
- **Found during:** Task 1 implementation, while reviewing the multi-payment branch in `process_payment_atomic` (the `IF v_paid_line + 0.0001 >= v_owed` close branch vs. the implicit fall-through partial-pay branch).
- **Issue:** The plan's `<interfaces>` example assumes a single UPDATE branch. The actual function has TWO mutation outcomes: (1) close (status='paid') when fully covered, (2) partial pay (no status change, but a `payments` row was inserted). If only the close branch bumps version, two concurrent partial-pay calls from different terminals using the same `expected_version` would both succeed — one inserts `payments` row A, the other inserts row B, no version conflict. This breaks the optimistic-concurrency contract on partial-pay and would let last-write-wins races re-emerge in split-bill workflows (the very thing Phase 15 closes — see CONTEXT.md Phase Boundary).
- **Fix:** Added an `ELSE` branch with `UPDATE tabs SET updated_at = NOW(), version = version + 1 WHERE id = p_tab_id` so every successful payment-insert path advances version exactly once. This matches the `<must_haves><truths>` invariant: "Successful path UPDATEs with version = version + 1".
- **Files modified:** `bar-pos/supabase/migrations/20260512000002_rpc_versioned_group_a.sql`
- **Commit:** `4c6ca9d` (same task commit; caught + fixed inline before commit)

No other deviations. Plan executed as written.

## TDD Gate Compliance

Not applicable — plan has `type: execute` (not `type: tdd`). No RED/GREEN gate sequence required; verification is via the plan's automated grep block (all checks pass) and Plan 15-03 will add fast-check + integration tests against the live DB shape.

## Self-Check: PASSED

- FOUND: bar-pos/supabase/migrations/20260512000002_rpc_versioned_group_a.sql
- FOUND: commit 4c6ca9d (feat(15-02) Group A RPC version guards)
- FOUND: process_payment_atomic redefined (signature includes `p_expected_version INT`)
- FOUND: create_order_with_items redefined (signature includes `p_expected_version int`)
- FOUND: P0V01 raise (×2), P0V02 raise (×2), version = version + 1 (×3 in code body)
- FOUND: re-raise of P0V01/P0V02 in process_payment_atomic EXCEPTION block (defends against pre-existing WHEN OTHERS swallow)
- FOUND: DOWN comment block listing prior signatures
- FOUND: Group B deferral comment in migration header
