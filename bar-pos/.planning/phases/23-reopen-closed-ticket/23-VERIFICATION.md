---
phase: 23-reopen-closed-ticket
verified: 2026-07-21T00:20:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 23: Reopen Closed Ticket Verification Report

**Phase Goal:** Let managers reopen a closed ticket via a `reopen_tab` RPC, introducing a `reopened_void` payment status, offsetting caja entries, and a cap (24h window, max 2 reopens per tab).
**Verified:** 2026-07-21T00:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | `reopen_tab` RPC flips a closed tab back to open, marks original payment(s) `reopened_void`, uses `p_expected_version` | ✓ VERIFIED | `supabase/migrations/20260721000001_fix_reopen_tab_double_count.sql` (live function, `CREATE OR REPLACE`) — role re-check, `FOR UPDATE` + `p_expected_version` guard, single combined `UPDATE tabs SET status='open', closed_at=NULL, ...`. Integration test `reopen-tab-rpc.integration.test.ts` SC-1 happy-path + STALE_VERSION + AUTH_FORBIDDEN tests pass live (10/10 total, run against remote DB, confirmed this session). |
| 2 | Caja gets an offsetting entry so totals stay reconciled after reopen | ✓ VERIFIED | RPC inserts a `type='expense'` `caja_entries` row sized by `v_voided_total` (only when non-zero). CR-01 double-count bug (offsetting expense summed ALL historically-voided rows instead of only the amount voided by *this* call) was found post-execution (23-REVIEW.md) and fixed via a new migration using `UPDATE ... RETURNING amount` capture. Fix migration confirmed applied to remote (`npx supabase migration list` shows `20260721000001` in both LOCAL/REMOTE). Dedicated regression test (`CR-01: reopening the SAME tab a second time...`) reopens a tab twice with a full repayment in between and asserts the 2nd reopen's caja expense = $20 (only the newly-voided amount), not $40 — **ran this test live in this session, passed.** Separately, migration `20260720000005` patches the 5 pre-existing payment-summing sites (`process_payment_atomic`, `process_split_payment_atomic`, `get_caja_report`, `close_caja_session`, `process_refund`) to exclude `reopened_void` rows — confirmed all 5 `CREATE OR REPLACE FUNCTION` statements + 6 exclusion clauses present in the migration file. |
| 3 | Reopen blocked outside a 24h window or after 2 prior reopens on the same tab | ✓ VERIFIED | RPC checks `reopen_count >= 2` → `REOPEN_CAP_EXCEEDED` and `NOW() - last_reopened_at > INTERVAL '24 hours'` → `REOPEN_WINDOW_EXPIRED`, both under the same row lock as the version check (no separate audit-log derivation). Integration tests for both codes pass live; cap test additionally asserts no mutation occurred on rejection. |
| 4 | Every reopen writes an `audit_logs` row (Phase 14) | ✓ VERIFIED | `PERFORM record_audit('tab.reopen', 'tab', p_tab_id, v_before, v_after, 'rpc')` on the success path only (post-exception-boundary, so a rollback never leaves an orphaned audit row). `'tab.reopen'` registered in `AuditActionSchema`/`AuditAction` (`src/shared/lib/audit-actions.ts:28,70`) before the migration references it, satisfying the CI grep gate. Integration SC-4 test (1 audit row, non-null before/after, `after.reason` matches) passes live. |
| 5 | Manager-only access gate (RBAC) | ✓ VERIFIED | `'reopen_tab'` registered in `STAFF_ACTIONS`/`MANAGER_EXTRA` (`src/shared/lib/rbac.ts:39,69`) — manager+ only. Server-side re-check inside the RPC (`SELECT ... WHERE role IN ('manager','admin')` → `AUTH_FORBIDDEN`/P0A01) is the actual security boundary; client `ManagerPinDialog requiredAction="reopen_tab"` is UX-only. E2E test confirms a bartender's own PIN is rejected and no DB write occurs (ran live, passed). |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Post-Review Fix Verification (CR-01 and companion warnings)

23-REVIEW.md found 1 critical + 4 warning issues after the 6 plans completed; 23-REVIEW-FIX.md claims 4 fixed, 1 deliberately skipped (non-blocking, deferred). Independently re-verified against the live codebase and live DB rather than trusting the fix report:

| Finding | Claimed Fix | Verified Live? |
|---|---|---|
| CR-01 (critical) — 2nd reopen double-counts caja expense | New migration `20260721000001_fix_reopen_tab_double_count.sql`, `RETURNING`-based capture | ✓ Migration applied to remote (confirmed via `npx supabase migration list` — no LOCAL/REMOTE divergence). New regression test present and **passing when run live in this session** (10/10 integration tests green against remote Supabase). |
| WR-01 — `reopenCount`/`lastReopenedAt` never mapped into `Tab` | Wire through `mapTabRow` | ✓ `src/entities/tab/model/queries.ts:246-247` conditionally spreads both fields into `TabSchema.parse(...)`. |
| WR-02 — duplicate `PaymentSchema` in entities layer | Deliberately skipped, deferred to cleanup phase | Confirmed skip is documented and reasoned (non-blocking per the review itself); not a phase-23 blocker. |
| WR-03 — `RefundButton`/`EditTicketButton` don't hide for voided payments | Add `status === 'reopened_void'` guard | ✓ `src/widgets/PaymentPane/ui/PaymentPane.tsx:31,54` both now include the guard, matching `ReopenTabButton`'s (line 78) pre-existing guard. |
| WR-04 — Cancel/success/version-conflict bypass state-reset handler | Route all 3 call sites through `handleOpenChange` | ✓ `src/features/reopen-tab/ui/ReopenTabDialog.tsx:74,81,125` all call `handleOpenChange(false)`, no raw `onOpenChange(false)` calls remain. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/20260720000002_payments_status_column.sql` | `payments.status` column | ✓ VERIFIED | Applied to remote; `payments.status` present in regenerated `supabase.types.ts` |
| `supabase/migrations/20260720000003_tabs_reopen_columns.sql` | `tabs.reopen_count`/`last_reopened_at` | ✓ VERIFIED | Applied to remote; both columns present in `supabase.types.ts` and mapped into `Tab` |
| `supabase/migrations/20260720000004_reopen_tab_rpc.sql` | Original `reopen_tab` RPC | ✓ VERIFIED | Applied to remote; superseded in behavior (not schema) by the CR-01 fix migration below |
| `supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql` | 5-site exclusion sweep | ✓ VERIFIED | Applied to remote; 5 `CREATE OR REPLACE FUNCTION` + 6 exclusion clauses confirmed in file |
| `supabase/migrations/20260721000001_fix_reopen_tab_double_count.sql` | CR-01 fix | ✓ VERIFIED | Applied to remote (confirmed via `migration list`); `RETURNING`-based capture confirmed by direct read |
| `src/features/reopen-tab/model/useReopenTab.ts` | Mutation hook | ✓ VERIFIED | Exists, wraps `supabase.rpc('reopen_tab', ...)` via `supabaseMutation` |
| `src/features/reopen-tab/ui/ReopenTabDialog.tsx` | PIN-gated reason Sheet | ✓ VERIFIED | Exists, `requiredAction="reopen_tab"`, all close paths route through `handleOpenChange` |
| `src/widgets/PaymentPane/ui/PaymentPane.tsx` | `ReopenTabButton` wiring | ✓ VERIFIED | `ReopenTabButton` present, hides on `isRefund`/`reopened_void`; sibling buttons also patched (WR-03) |
| `e2e/48-reopen-closed-ticket.spec.ts` | Manager + bartender E2E | ✓ VERIFIED | 2 live tests, both pass when run in this session |
| `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` | Integration suite incl. CR-01 regression | ✓ VERIFIED | 10 tests, all pass live against remote DB in this session |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `reopen_tab` audit call | `audit-actions.ts` | `record_audit('tab.reopen', ...)` | ✓ WIRED | `'tab.reopen'` registered before migration references it |
| `PaymentPane` ReopenTabButton | `mapPaymentRow`/`payment.status` | payment-status gate | ✓ WIRED | `payment.status === 'reopened_void'` hides button |
| `ReopenTabDialog` | `rbac.ts reopen_tab` | `ManagerPinDialog requiredAction="reopen_tab"` | ✓ WIRED | RBAC action registered manager+; server-side re-check is authoritative |
| `reopen_tab` void step | `process_payment_atomic`/report sums | `status IS DISTINCT FROM 'reopened_void'` | ✓ WIRED | Confirmed by CR-01 regression test proving re-payment doesn't double-count |
| CR-01 fix migration | live remote DB | `npx supabase db push` | ✓ WIRED | Confirmed applied via `supabase migration list` (no divergence) and by running the regression test live |

### Behavioral Spot-Checks / Live Test Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Integration suite (10 tests incl. CR-01 regression) | `npx vitest run src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts` | 10 passed (10) against live remote Supabase | ✓ PASS |
| Migrations applied, no drift | `npx supabase migration list` | All Phase 23 timestamps (incl. `20260721000001`) present in both LOCAL and REMOTE columns | ✓ PASS |
| Typecheck | `npm run typecheck` | Only the 2 pre-existing, unrelated errors (`entities/tab/model/queries.ts:791` close_tab area, `shared/lib/agent/rag.ts:60`) — confirmed unrelated to Phase 23 by content inspection | ✓ PASS |
| Lint | `npm run lint` | 0 errors (1 informational boundaries-plugin warning about legacy selector syntax, pre-existing/unrelated) | ✓ PASS |
| Full unit suite | `npm run test` | 140 passed / 2 skipped (142 files), 1258 passed / 15 todo (1273 tests) | ✓ PASS |
| E2E spec | `npx playwright test e2e/48-reopen-closed-ticket.spec.ts` | 2 passed (2) — manager-positive + bartender-negative | ✓ PASS |
| CLAUDE.md registration | `grep -c 48-reopen-closed-ticket CLAUDE.md` | 1 (present in E2E Test Suite list, 26 specs total) | ✓ PASS |

### Requirements Coverage

No `.planning/REQUIREMENTS.md` exists in this project (confirmed: file not found). Per 23-CONTEXT.md, the source doc `POS-COMPARISON.md §23` is no longer present, and requirement scope is locked to ROADMAP.md's Success Criteria (SC-1 through SC-4), which is what this report verifies against directly. No orphaned requirement IDs — plan frontmatter (`requirements: [SC-1, SC-2, SC-3, SC-4]` distributed across the 6 plans) maps 1:1 onto the 4 ROADMAP success criteria with no unclaimed IDs.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX` markers found in any Phase 23 file. No stub implementations, no hardcoded empty returns on the reopen path. The one deliberately-deferred item (WR-02, duplicate `PaymentSchema`) is explicitly reasoned as non-blocking by the review itself and does not affect this phase's goal.

### Human Verification Required

None. All must-haves were verifiable via live migration state, live integration tests (run in this session against the real remote database), live E2E tests (run in this session), and direct code inspection.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are implemented, live-tested, and pass. The post-execution code review found a real financial bug (CR-01) that was NOT covered by the original plans' acceptance criteria; the follow-up fix migration and regression test were independently verified in this session (not merely trusted from 23-REVIEW-FIX.md) — the fix migration is applied to the remote database, and running the regression test live confirms the second-reopen double-count no longer occurs. Three of four review warnings were also fixed and verified live in code; the fourth (WR-02) is a reasoned, non-blocking deferral.

---

_Verified: 2026-07-21T00:20:00Z_
_Verifier: Claude (gsd-verifier)_
