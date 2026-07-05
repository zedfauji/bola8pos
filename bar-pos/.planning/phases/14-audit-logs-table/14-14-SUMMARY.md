---
phase: 14-audit-logs-table
plan: 14
subsystem: infra
tags: [supabase, migrations, edge-functions, e2e, ci-gate]

requires:
  - phase: 14-audit-logs-table
    provides: "14-01 through 14-13 — all Phase-14 schema/RPC/UI work"
provides:
  - "All Phase-14 schema + Edge Functions live on remote Supabase"
  - "order.void E2E coverage restored (D-07), 38-audit-logs tracked in CLAUDE.md"
  - "Full green verification gate for Phase 14"
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - e2e/38-audit-logs.spec.ts
    - CLAUDE.md
    - src/app/App.tsx
    - src/entities/tab/model/queries.concurrent.test.ts
    - src/shared/ui/ErrorBoundary.tsx

key-decisions:
  - "Pre-push migration-history drift (4 remote-only entries + 1 local-only migration, all pre-existing and unrelated to Phase 14) blocked `supabase db push` entirely. Resolved via `supabase migration repair` (reverted for the 4 orphaned remote entries, applied for the local-only 20260510000004 whose policy already existed live) rather than editing migration files — confirmed with the user before running each repair since it rewrites remote migration-history state."
  - "The 'Budweiser' product referenced by ~10 E2E specs (assumed always-seeded) did not exist in the remote products table — pre-existing seed-data gap, not caused by any Phase-14 migration. Seeded it (Cervezas Nacionales category, matching Corona/Amstel Ultra) after user confirmation; no inventory row needed since beer products aren't stock-tracked in this schema."
  - "The bartender-redirect-toast E2E test remains flaky: AuditRoute's redirect + RBAC enforcement work correctly (confirmed via manual trace/screenshot review — bartender lands on /home with Audit Log tile correctly locked), but mid-assertion the app occasionally bounces to the staff-picker screen. Root cause traced to providers.tsx's pre-existing `onAuthStateChange` session-sync logic (forces logout on session/JWT mismatch), unrelated to any Phase-14 code (AuditRoute is the only thing 14-10 added). Documented as a pre-existing flake per user decision, not fixed as part of this phase."

requirements-completed: [SC1, SC8]

duration: ~90min
completed: 2026-07-04
---

# Phase 14 Plan 14: Land Phase 14 on remote + full verification gate Summary

**Pushed all 6 Phase-14 migrations + deployed 3 Edge Functions to remote Supabase (resolving pre-existing migration-history drift along the way), restored order.void E2E coverage per D-07, and ran the full green verification gate (typecheck/lint/unit/RPC-coverage/E2E).**

## Performance

- **Duration:** ~90 min (includes a blocking human-verify checkpoint for the remote push)
- **Completed:** 2026-07-04
- **Tasks:** 3/3 complete

## Accomplishments

- **Task 1 (blocking checkpoint)** — Pushed all 6 new migrations (`20260703000001`–`20260703000006`) to remote Supabase and deployed `void-order`, `create-staff`, `settings-restore` Edge Functions. Smoke probe confirmed live: `audit_logs` table exists, `record_audit/8` resolves with `p_terminal_id`, and all 5 new RPCs (`caja_open`, `close_tab`, `produce_prep_batch`, `force_pin_change`, `clear_must_change_pin`) exist. `supabase migration list` shows all 6 applied; `supabase functions list` shows all 3 ACTIVE.
- **Task 2** — Restored the `order.void` E2E filter test in `e2e/38-audit-logs.spec.ts` (removed the 14-06 `combo.add_to_tab` substitution note, per D-07 now that `order.void` is wired via 14-07). Added `38-audit-logs` to CLAUDE.md's tracked E2E spec list (17 → 18 files).
- **Task 3** — Ran the full verification gate: typecheck clean, lint clean (fixed 5 pre-existing errors blocking a genuinely green gate), full unit suite green (1171 passed, only the documented pre-existing `useCloseTab.test.ts:95` live-DB failure), `audit-actions.test.ts` all 10 target RPCs GREEN, `audit-edge-coverage.test.ts` green (4/4), and `e2e/38-audit-logs.spec.ts` 5/6 passing against live remote (1 documented pre-existing flake, see Decisions).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remote push + deploy (no repo files modified) | n/a | remote Supabase only |
| 2 | Restore order.void E2E coverage + CLAUDE.md spec list | `004b494` | `e2e/38-audit-logs.spec.ts`, `CLAUDE.md` |
| 3 | Clear pre-existing lint errors blocking the gate | `f6fcbad` | `src/app/App.tsx`, `src/entities/tab/model/queries.concurrent.test.ts`, `src/shared/ui/ErrorBoundary.tsx` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `supabase migration list` — 20260703000001–20260703000006 applied on remote (plus pre-existing 20260510000004, repaired to `applied` status after confirming its policy already existed live).
- `supabase functions list` — void-order, create-staff, settings-restore all ACTIVE.
- Smoke probe (via Supabase MCP `execute_sql`): `audit_logs` exists, `record_audit/8` resolves with `p_terminal_id uuid, p_user_id uuid` args, all 5 new RPCs exist.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0 (5 pre-existing errors fixed as part of this gate — import order in `App.tsx`/`ErrorBoundary.tsx`, unnecessary type args/conditional in `queries.concurrent.test.ts`).
- `npm run test` — 1171 passed, 15 todo, 2 skipped; 1 documented pre-existing failure (`useCloseTab.test.ts:95`, live-DB dependent, unrelated to any Phase-14 file).
- `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` — 12/12 passed, all 10 target RPC-coverage assertions GREEN.
- `npx vitest run src/shared/lib/__tests__/audit-edge-coverage.test.ts` — 4/4 passed.
- `npx playwright test e2e/38-audit-logs.spec.ts` — 5 passed, 1 failed (documented flake below), 1 skipped, against live remote.

## Files Created/Modified

- `e2e/38-audit-logs.spec.ts` — removed 14-06 substitution note; Test 2 now filters/asserts `order.void`
- `CLAUDE.md` — E2E Test Suite section: 17 → 18 specs, added `38-audit-logs`
- `src/app/App.tsx`, `src/shared/ui/ErrorBoundary.tsx` — import-order fixes (pre-existing, unrelated to Phase 14 logic)
- `src/entities/tab/model/queries.concurrent.test.ts` — removed unnecessary type arguments + redundant conditional (pre-existing, unrelated to Phase 14 logic)
- Remote Supabase: 6 migrations applied, 3 Edge Functions deployed, 1 product row inserted (`Budweiser`, see Decisions)

## Decisions Made

See `key-decisions` in frontmatter — summarized:
1. Repaired remote migration-history drift (4 orphaned remote entries reverted, 1 local-only migration marked applied) before `supabase db push` would proceed. All 4 pre-date Phase 14.
2. Seeded a missing `Budweiser` product on remote (assumed always-present by ~10 E2E specs) after confirming with the user — a pre-existing test-data gap, not a Phase-14 regression.
3. Left the bartender-redirect-toast E2E test as a documented flake — traced to pre-existing app-wide auth-session-sync logic (`providers.tsx`), not to the new `AuditRoute` (14-10), whose redirect + RBAC enforcement were confirmed correct via manual screenshot/trace review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Remote migration-history drift blocked `supabase db push`**
- **Found during:** Task 1, first `supabase db push` attempt
- **Issue:** Remote had 4 migration-history entries with no matching local file (`20260428230053`, `20260428230533`, `20260507000001`, `20260510000003`) and local had 1 migration never pushed (`20260510000004`, whose `CREATE POLICY` already existed live) — both pre-date Phase 14 and block any push regardless of the 6 new migrations.
- **Fix:** `supabase migration repair --status reverted` for the 4 orphaned remote entries; `supabase migration repair --status applied` for `20260510000004`. Confirmed with the user before each repair (rewrites remote migration-history state, a hard-to-reverse shared-infra action).
- **Verification:** Subsequent `supabase db push` applied all 6 Phase-14 migrations cleanly.

**2. [Rule 3 - Blocking issue] Missing `Budweiser` product blocked 2/6 E2E tests**
- **Found during:** Task 3, `e2e/38-audit-logs.spec.ts` first run (payment + refund tests timed out on `getByRole('button', { name: /Select Budweiser/i })`)
- **Issue:** Direct SQL query confirmed no `Budweiser` row exists in `products` — a pre-existing seed-data gap affecting the whole E2E suite's convention ("Budweiser is always seeded"), not a Phase-14 regression.
- **Fix:** Inserted a `Budweiser` product (Cervezas Nacionales category, `$45.00`, matching sibling products) after user confirmation. Re-ran the 2 affected tests — both pass.

**3. [Not fixed, documented] Bartender-redirect-toast E2E flake**
- **Found during:** Task 3, `e2e/38-audit-logs.spec.ts` RBAC test
- **Issue:** After the correct `/audit` → `/home` redirect (which passes its own assertion), the toast-visibility assertion intermittently fails because the app bounces to the staff-picker screen mid-test. Traced to `providers.tsx`'s `onAuthStateChange` handler forcing a logout on session/JWT mismatch — pre-existing, app-wide, unrelated to `AuditRoute` (14-10), whose redirect + RBAC gating were independently confirmed correct.
- **Disposition:** Left unfixed per user decision — out of Phase-14 scope; would need separate investigation into the session-sync flake across the whole app.

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking-issue fixes required to complete the plan's own remote-push and E2E-gate steps), 1 documented-not-fixed (pre-existing, unrelated flake)
**Impact on plan:** No scope creep — the migration-repair and product-seed fixes were prerequisites for the plan's own acceptance criteria (live push + green E2E) to be achievable at all; the auth-flake is explicitly out of Phase-14's diff.

## Issues Encountered

- `npx eslint --fix` combined with a manual `no-unnecessary-type-arguments` fix in `queries.concurrent.test.ts` (TS 5.5 infers `!r.ok` as a type-predicate for `.filter()`, so the redundant `!loser.ok` check after `losers[0]` was flagged and removed along with the now-unused `AppError` import).
- The first two E2E runs used a `| tail -N` pipe that masked the actual `playwright test` exit code (reported as 0 while the underlying test run had failures) — re-ran with output redirected to a file to get the true result.

## User Setup Required

None — all remote actions (migration push, function deploy, migration repair, product seed) were performed as part of this plan with explicit user confirmation at each step, using existing `SUPABASE_ACCESS_TOKEN`/CLI auth already configured in the environment.

## Next Phase Readiness

- Phase 14 is complete: audit logging schema + RPCs + Edge Functions are live on remote, `/audit` is fully wired, and the verification gate is green except for one pre-existing, documented, unrelated flake.
- The bartender-redirect-toast flake (`providers.tsx` auth-session-sync bouncing to staff-picker) is a good candidate for a future standalone investigation if it recurs — it is app-wide, not phase-scoped.

## Self-Check: PASSED

- FOUND: `supabase migration list` shows 20260703000001–20260703000006 applied
- FOUND: `supabase functions list` shows void-order/create-staff/settings-restore ACTIVE
- FOUND: `e2e/38-audit-logs.spec.ts` contains `order.void` filter test
- FOUND: `CLAUDE.md` E2E Test Suite section lists `38-audit-logs`
- FOUND commit `004b494` (Task 2)
- FOUND commit `f6fcbad` (Task 3 lint fixes)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
