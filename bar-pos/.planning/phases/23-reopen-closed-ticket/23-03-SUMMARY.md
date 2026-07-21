---
phase: 23-reopen-closed-ticket
plan: 03
subsystem: database
tags: [supabase, plpgsql, rpc, migrations, correctness-sweep]

# Dependency graph
requires:
  - phase: 23-reopen-closed-ticket
    provides: "Plan 01 Wave-0 foundations (payments.status in domain.ts) + Plan 02's payments.status column / reopen_tab RPC (patches these 5 pre-existing functions to respect the new status value)"
provides:
  - "process_payment_atomic's v_paid_line sum excludes payments.status='reopened_void'"
  - "process_split_payment_atomic's v_paid_line sum excludes payments.status='reopened_void'"
  - "get_caja_report's top-level revenue aggregate AND per-staff sales_total subquery exclude payments.status='reopened_void'"
  - "close_caja_session's tip-pooling SUM(tip_amount) excludes payments.status='reopened_void'"
  - "process_refund's original-payment lookup rejects a payments.status='reopened_void' row (falls into existing NOT_FOUND path)"
affects: ["23-04", "23-05", "23-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Targeted CREATE OR REPLACE FUNCTION re-declaration: full existing body copied verbatim, only the reopened_void exclusion clause(s) added — same discipline as 20260720000001_fix_edit_paid_tab_inventory.sql"

key-files:
  created:
    - supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql
  modified: []

key-decisions:
  - "A3 re-grep (RESEARCH.md Assumptions Log) confirmed the 5 sites named in RESEARCH.md/PATTERNS.md are the complete list — no 6th site found. `grep -rln \"FROM payments\" supabase/migrations/` returns 15 files, but all resolve to prior CREATE OR REPLACE generations of the same 5 functions patched here (or, in list_caja_sessions's case, a function that doesn't query payments at all)."

patterns-established:
  - "Correctness-sweep migration pattern for a newly-introduced status/flag column: grep every existing summing site across the migration history (not just the schema), confirm via function-name dedup which migrations are stale generations vs. the live definition, then CREATE OR REPLACE each live function with a single added exclusion clause."

requirements-completed: [SC-1, SC-2]

coverage:
  - id: D1
    description: "process_payment_atomic's paid-line sum excludes reopened_void rows"
    requirement: "SC-1, SC-2"
    verification:
      - kind: other
        ref: "grep -c \"IS DISTINCT FROM 'reopened_void'\" against the migration file (6 total across all 5 functions, includes this one)"
        status: pass
    human_judgment: true
    rationale: "Grep confirms the SQL text is present and matches the codebase's IS DISTINCT FROM convention, but the migration is not pushed in this plan (Plan 04's scope) — no live-Postgres execution has proven the fix behaviorally yet."
  - id: D2
    description: "process_split_payment_atomic's paid-line sum excludes reopened_void rows"
    requirement: "SC-1, SC-2"
    verification:
      - kind: other
        ref: "Same grep gate as D1; function body diffed against source migration 20260707000003_split_payment_columns_and_rpc.sql, confirmed byte-identical except the one added clause"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — text-level proof only, runtime proof is Plan 04's integration test scope."
  - id: D3
    description: "get_caja_report's revenue + per-staff sales sums exclude reopened_void rows"
    requirement: "SC-1, SC-2"
    verification:
      - kind: other
        ref: "grep confirms 2 occurrences of the exclusion clause inside get_caja_report specifically (top-level aggregate WHERE clause + per-staff LEFT JOIN ON clause)"
        status: pass
    human_judgment: true
    rationale: "Text-level proof; this function previously had NO is_refund filter at all (refunds net out as negative amounts), so the reopened_void exclusion is a genuinely new safeguard not proven at runtime until Plan 04."
  - id: D4
    description: "close_caja_session's tip-pooling sum excludes reopened_void rows"
    requirement: "SC-1, SC-2"
    verification:
      - kind: other
        ref: "grep confirms the clause on the tip-pooling SUM(tip_amount) query, and that 'version + 1' (the Phase 19 STALE_VERSION fix riding along in this same function) is still present unchanged"
        status: pass
    human_judgment: true
    rationale: "Text-level proof; version-bump logic preservation double-checked via grep count and full-file re-read, but no live execution occurred in this plan."
  - id: D5
    description: "process_refund refuses to refund a reopened_void original payment"
    requirement: "SC-1, SC-2"
    verification:
      - kind: other
        ref: "grep confirms the extended WHERE clause on the original-payment lookup (id=... AND is_refund=false AND status IS DISTINCT FROM 'reopened_void'), falling through to the pre-existing NOT_FOUND RAISE EXCEPTION — no new error code introduced"
        status: pass
    human_judgment: true
    rationale: "Text-level proof only; Plan 04 owns the push + integration-test proof that a reopened-void payment ID actually raises NOT_FOUND at runtime."

duration: 5min
completed: 2026-07-20
status: complete
---

# Phase 23 Plan 03: Payment-Sum Correctness Sweep Summary

**One migration re-declares all 5 pre-existing payment-summing functions (process_payment_atomic, process_split_payment_atomic, get_caja_report, close_caja_session, process_refund) with a `status IS DISTINCT FROM 'reopened_void'` exclusion, closing the phase's highest-risk correctness gap before it's ever pushed.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-20T21:28:xxZ (approx, right after 23-02's completion commit)
- **Completed:** 2026-07-20T21:32:26-06:00
- **Tasks:** 2 (as planned)
- **Files modified:** 1 (new)

## Accomplishments
- **A3 re-grep verification (RESEARCH.md Assumptions Log)** performed first, as instructed: `grep -rln "FROM payments" supabase/migrations/` returned 15 files. Cross-checked each against `CREATE OR REPLACE FUNCTION` name — confirmed all resolve to prior generations of the exact 5 functions named in RESEARCH.md (`process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`, `process_refund`) or, for `list_caja_sessions` (the one function not on the list), confirmed by direct read that it never queries `payments` at all. **No 6th site found.**
- `process_payment_atomic`'s `v_paid_line` sum (the "how much has this tab already paid" check) now excludes `status='reopened_void'`, closing the phase's single highest-risk gap: without this, re-paying a reopened tab would sum the voided original payment together with the new one.
- `process_split_payment_atomic`'s identical `v_paid_line` sum patched the same way.
- `get_caja_report`'s top-level revenue aggregate (`totalRevenue`/`cashSales`/`cardSales`/`rappiSales`) AND its per-staff `sales_total` subquery both patched — this function previously had **no `is_refund` filter at all** (refunds net out as negative amounts, so they were never a problem before), meaning a `reopened_void` row would have inflated revenue with zero prior safeguard.
- `close_caja_session`'s tip-pooling `SUM(tip_amount)` patched with the identical clause, while its existing `version + 1` bump logic (the Phase 19 STALE_VERSION trigger fix) and every other line was preserved byte-for-byte.
- `process_refund`'s original-payment lookup guard extended from `WHERE id=... AND is_refund=false` to also require `status IS DISTINCT FROM 'reopened_void'` — a reopened-void payment now falls into the function's pre-existing `NOT_FOUND` exception path with no new error code, per Pitfall 6's explicit guidance.
- All acceptance-criteria grep gates from both tasks pass (verified below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-grep for payment-sum sites, then patch the 3 payment RPCs** - `f62d918` (feat)
2. **Task 2: Patch the 2 caja report/close functions in the same migration** - `472ef6e` (feat)

_Note: no separate plan-metadata commit is included in this list; SUMMARY.md/STATE.md/ROADMAP.md commit follows this document._

## Files Created/Modified
- `supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql` (new) - single `BEGIN;`/`COMMIT;`-wrapped migration containing 5 `CREATE OR REPLACE FUNCTION` statements (one per patched site) and a manual-DOWN comment block pointing back to each function's prior migration.

## Gate Verification
- `grep -c "CREATE OR REPLACE FUNCTION" 20260720000005_fix_payment_sums_exclude_reopened_void.sql` → **5** (all 5 functions present)
- `grep -c "IS DISTINCT FROM 'reopened_void'" 20260720000005_fix_payment_sums_exclude_reopened_void.sql` → **6** (process_payment_atomic ×1, process_split_payment_atomic ×1, process_refund ×1, get_caja_report ×2, close_caja_session ×1)
- `grep -c "^BEGIN;"` → 1, `grep -c "^COMMIT;"` → 1 (single transaction, no stray nested begin/commit)
- `grep -q "version + 1"` → present (close_caja_session's Phase 19 version-bump fix untouched)
- Dollar-quote (`$$ ... $$`) pairing checked programmatically: 5 pairs for 5 function bodies — balanced, no truncated function body.

## Decisions Made
- **No 6th payment-summing site exists.** The A3 re-grep found 15 files matching `FROM payments`, but every one either (a) is a superseded prior-generation `CREATE OR REPLACE` of one of the 5 already-identified functions, or (b) is `list_caja_sessions`, confirmed by direct read to never query `payments`. No new report widget or RPC has been added since RESEARCH.md's original scan that would introduce a 6th site.
- **`get_caja_report`'s per-staff sales_total fix applies the filter in the `LEFT JOIN ... ON` clause, not a `WHERE` clause.** Because `pay` is LEFT-JOINed (a staff member with orders but no payments must still appear in the result), the pre-existing `pay.is_deleted = FALSE` filter is already on the `ON` clause (not `WHERE`) to avoid incorrectly excluding staff rows entirely when the payment side doesn't match. The new `pay.status IS DISTINCT FROM 'reopened_void'` clause was added to the same `ON` clause for the identical reason — placing it in a `WHERE` clause would silently drop staff members whose only payment happens to be `reopened_void`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria and gate commands on the first attempt; no auto-fixes were required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (The db push itself is Plan 04's scope, not a user-setup step, consistent with Plan 02's precedent.)

## Next Phase Readiness
- `supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql` exists, is grep-gate-verified, wrapped in `BEGIN;`/`COMMIT;`, and closes with a manual-DOWN comment — matching the codebase's established no-automated-rollback convention.
- This migration and Plan 02's three migrations (`20260720000002`/`003`/`004`) are all written and gate-verified but **not yet pushed to remote Supabase**. Plan 04 owns the single blocking `npx supabase db push` for all four migrations together, regenerating `supabase.types.ts`, and converting Plan 01's `it.todo` integration scaffold (including the highest-risk "reopen-then-repay does not double-count" regression test) into live assertions against the real, now-patched RPCs.
- No blockers for Plan 04.

---
*Phase: 23-reopen-closed-ticket*
*Completed: 2026-07-20*

## Self-Check: PASSED
Migration file, SUMMARY.md, and both task commits (`f62d918`, `472ef6e`) verified present.
