---
phase: 23-reopen-closed-ticket
plan: 02
subsystem: database
tags: [supabase, plpgsql, rpc, migrations, optimistic-concurrency, audit-log]

# Dependency graph
requires:
  - phase: 23-reopen-closed-ticket
    provides: "Plan 01 Wave-0 foundations — 'tab.reopen' registered in AuditActionSchema (CI grep gate), 'reopen_tab' RBAC action, PaymentSchema.status/TabSchema.reopenCount+lastReopenedAt in domain.ts"
provides:
  - "payments.status text NOT NULL DEFAULT 'completed' CHECK (completed|reopened_void) column (D-01)"
  - "tabs.reopen_count int default 0, tabs.last_reopened_at timestamptz columns (D-03)"
  - "reopen_tab(uuid,int,text) RPC: manager+ role re-check, version+cap/window guard, payment void, offsetting expense caja entry, single combined status-flip UPDATE, success-path audit write"
affects: ["23-03", "23-04", "23-05", "23-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-reversal RPC composed from edit_paid_tab's skeleton (role check/version guard/offsetting caja entry/audit) plus a net-new cap+window check evaluated under the same FOR UPDATE lock"
    - "closed_at=NULL and version=version+1 combined into the SAME UPDATE statement as the status flip, satisfying both the closed_at_requires_closed_status CHECK and the bump_version_on_update trigger in one write"

key-files:
  created:
    - supabase/migrations/20260720000002_payments_status_column.sql
    - supabase/migrations/20260720000003_tabs_reopen_columns.sql
    - supabase/migrations/20260720000004_reopen_tab_rpc.sql
  modified: []

key-decisions:
  - "Migrations written and grep-gate-verified this plan but NOT pushed to remote Supabase — Plan 04 owns the blocking db push, per this plan's own scope boundary."

patterns-established:
  - "Third-generation financial-correction RPC (after process_refund, edit_paid_tab) reusing the identical role-check/version-guard/offsetting-caja-entry/audit skeleton, extended with a cap+window check pattern that has no prior analog in this codebase."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "payments.status column exists with the exact 'completed'/'reopened_void' CHECK-constrained enum, wrapped in BEGIN/COMMIT with a manual-DOWN comment"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "grep -c reopened_void (3 matches) + grep -c 'ADD COLUMN IF NOT EXISTS status' (1 match) against 20260720000002_payments_status_column.sql"
        status: pass
    human_judgment: false
  - id: D2
    description: "tabs.reopen_count/last_reopened_at columns exist, additive, no conflicting CHECK added"
    requirement: "SC-3"
    verification:
      - kind: other
        ref: "grep -c 'reopen_count|last_reopened_at' (8 matches) against 20260720000003_tabs_reopen_columns.sql"
        status: pass
    human_judgment: false
  - id: D3
    description: "reopen_tab RPC flips a closed/paid tab to open (clearing closed_at + bumping version in one UPDATE), voids non-refund completed payments, writes an offsetting expense caja entry, and audit-logs the reopen on the success path"
    requirement: "SC-1, SC-2, SC-4"
    verification:
      - kind: other
        ref: "grep gates against 20260720000004_reopen_tab_rpc.sql: CREATE OR REPLACE FUNCTION public.reopen_tab (1), record_audit('tab.reopen' (1), closed_at = NULL present in the status-flip UPDATE, GRANT EXECUTE ... TO authenticated present"
        status: pass
    human_judgment: true
    rationale: "Grep gates confirm the migration file's shape/text matches the plan's must-have truths, but the RPC has not been pushed to a live database yet (Plan 04's scope) — no integration test has executed this function against real Postgres. Runtime correctness (cap/window logic, CHECK-constraint interaction, transaction rollback behavior) is unproven until Plan 04's push + the Wave-0 integration test suite (23-01) runs against it."
  - id: D4
    description: "reopen_tab rejects a non-manager caller (AUTH_FORBIDDEN), a stale version (STALE_VERSION/NOT_FOUND_VERSIONED), reopen_count>=2 (REOPEN_CAP_EXCEEDED), and >24h since last reopen (REOPEN_WINDOW_EXPIRED)"
    requirement: "SC-3"
    verification:
      - kind: other
        ref: "grep gates: TAB_NOT_REOPENABLE, REOPEN_CAP_EXCEEDED, REOPEN_WINDOW_EXPIRED, AUTH_FORBIDDEN, INTERVAL '24 hours', reopen_count >= 2 all present in 20260720000004_reopen_tab_rpc.sql"
        status: pass
    human_judgment: true
    rationale: "Same as D3 — text/shape confirmed by grep, but no live-Postgres execution has occurred yet in this plan. Behavioral proof is Plan 04's integration test scope."

duration: 8min
completed: 2026-07-21
status: complete
---

# Phase 23 Plan 02: Reopen Mechanism Migrations Summary

**Wrote the three additive Postgres migrations for the reopen_tab mechanism — payments.status, tabs.reopen_count/last_reopened_at, and the reopen_tab SECURITY DEFINER RPC itself — composed from edit_paid_tab's proven skeleton plus a net-new 24h/2x cap-and-window guard, not yet pushed to remote Supabase.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-21T03:24:00Z (approx)
- **Completed:** 2026-07-21T03:26:33Z
- **Tasks:** 2 (as planned)
- **Files modified:** 3 (all new)

## Accomplishments
- `payments.status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','reopened_void'))` — the first status column on `payments`, modeling the reopen-void state distinctly from the pre-existing `is_refund` boolean (D-01)
- `tabs.reopen_count int NOT NULL DEFAULT 0` and `tabs.last_reopened_at timestamptz` — additive columns backing the 24h-rolling/2x-total reopen cap, with no conflicting CHECK added alongside the existing `closed_at_requires_closed_status` constraint (D-03)
- `reopen_tab(uuid,int,text) RETURNS jsonb` SECURITY DEFINER RPC composed exactly per RESEARCH.md's Code Examples skeleton: manager+ role re-check (`AUTH_FORBIDDEN`/P0A01), `FOR UPDATE` version guard (`STALE_VERSION`/P0V01, `NOT_FOUND_VERSIONED`/P0V02) with the cap (`REOPEN_CAP_EXCEEDED`, `reopen_count >= 2`) and window (`REOPEN_WINDOW_EXPIRED`, `NOW() - last_reopened_at > INTERVAL '24 hours'`) checks evaluated under the SAME row lock, a plain `tab_id`-scoped payment void (`is_refund=false AND status='completed'` → `'reopened_void'`) that naturally catches every split-payment sibling with no group-aware branching, a conditional offsetting `type='expense'` `caja_entries` insert (skipped when `v_voided_total = 0`, e.g. a comp'd `'closed'` tab), a single combined `tabs` UPDATE that clears `closed_at` and bumps `version`+`reopen_count`+`last_reopened_at` in one statement (satisfying both the `closed_at_requires_closed_status` CHECK and the `bump_version_on_update` trigger), and a success-path-only `record_audit('tab.reopen', ...)` call
- All acceptance-criteria grep gates from the plan pass against the three files (verified below)

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive schema migrations — payments.status + tabs reopen columns** - `bb18eaa` (feat)
2. **Task 2: Write the reopen_tab RPC migration** - `8aa1fa5` (feat)

_Note: no separate plan-metadata commit is included in this list; SUMMARY.md/STATE.md/ROADMAP.md commit follows this document._

## Files Created/Modified
- `supabase/migrations/20260720000002_payments_status_column.sql` (new) - `payments.status` column with the minimal two-value CHECK enum, manual-DOWN comment
- `supabase/migrations/20260720000003_tabs_reopen_columns.sql` (new) - `tabs.reopen_count`/`tabs.last_reopened_at` columns, manual-DOWN comment
- `supabase/migrations/20260720000004_reopen_tab_rpc.sql` (new) - `reopen_tab` RPC, manual-DOWN comment (REVOKE + DROP FUNCTION)

## Decisions Made
- **Migrations were written and grep-verified but deliberately NOT pushed to remote Supabase in this plan.** Per the plan's own `<objective>`/`<verification>` scope boundary, the blocking `npx supabase db push` step belongs to Plan 04, which will also run the Wave-0 integration test suite created in Plan 01 against the live function. This plan's job was solely to produce correct, gate-passing SQL text.
- No deviations from the RESEARCH.md skeleton were needed — the composed skeleton (role check, version+cap/window guard, payment void, offsetting caja entry, combined status-flip UPDATE, audit write, EXCEPTION re-raise discipline) was copied essentially verbatim, as the plan explicitly instructed.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria on the first attempt; no auto-fixes were required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (The db push itself is Plan 04's scope, not a user-setup step.)

## Next Phase Readiness
- All three migration files exist, are wrapped in `BEGIN;`/`COMMIT;`, and each has a manual-DOWN comment block following the codebase's established Phase-8-era convention (no automated rollback on Supabase Cloud).
- `reopen_tab` references `record_audit('tab.reopen', ...)` which is already registered in `AuditActionSchema` (Plan 01) — the CI grep gate (`src/shared/lib/__tests__/audit-actions.test.ts`) will not fail when these migrations are picked up by that test's migration scan.
- Plan 03 can now write the `<ts4>_fix_payment_sums_exclude_reopened_void.sql` migration patching the 5 confirmed payment-summing sites (`process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`, `process_refund`) to exclude `status = 'reopened_void'` rows — this is the phase's highest-risk correctness gap per RESEARCH.md and has no dependency on Plan 02's migrations actually being pushed yet (it patches existing functions, independent of whether `reopen_tab` itself has run).
- Plan 04 owns: `npx supabase db push` (pushing all three of this plan's migrations plus Plan 03's fix migration together), regenerating `supabase.types.ts`, and converting Plan 01's `it.todo` integration scaffold into live assertions against the real RPC.
- No blockers for Plan 03.

---
*Phase: 23-reopen-closed-ticket*
*Completed: 2026-07-21*

## Self-Check: PASSED
All 3 created migration files and this SUMMARY.md verified present; both task commit hashes (`bb18eaa`, `8aa1fa5`) verified present in git log.
