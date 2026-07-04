---
phase: 14-audit-logs-table
plan: 13
subsystem: ui
tags: [react-router, fsd, rls, supabase, vitest]

requires:
  - phase: 14-audit-logs-table
    provides: "14-10 AuditRoute guard + view_audit_log RBAC action"
  - phase: 14-audit-logs-table
    provides: "14-11 AuditLogTable widget"
provides:
  - "/audit page + route, wired end-to-end (ProtectedRoute + AuditRoute + AuditLogTable)"
  - "append-only RLS on audit_logs proven by an automated integration test (SC2)"
  - "vitest 'integration' project, making **/*.integration.test.ts files actually runnable"
affects: [14-14]

tech-stack:
  added: []
  patterns:
    - "Thin FSD page container (pages/audit/index.tsx): SectionHeader + widget only, no page-level logic — matches pages/staff/index.tsx's mx-auto max-w-6xl space-y-8 shell"

key-files:
  created:
    - src/pages/audit/index.tsx
    - src/entities/audit-log/model/rls-denial.integration.test.ts
  modified:
    - src/app/router.tsx
    - vitest.config.ts
    - .planning/phases/14-audit-logs-table/deferred-items.md

key-decisions:
  - "vitest.config.ts had no working way to execute *.integration.test.ts files at all — the 'unit' project's exclude blanket-excludes them project-wide with no dedicated project defined, so even the pre-existing test:integration npm script and the pre-existing depletion.integration.test.ts reported 'No test files found'. Added a dedicated 'integration' vitest project (node environment) as a Rule 3 blocking-issue fix so the plan's own verify command could run at all; npm run test (unit project) is unaffected."
  - "RLS denial test treats either an explicit Postgres error OR a silently-empty affected-rows array as a valid 'denied' outcome for UPDATE/DELETE, since Supabase RLS with no matching policy filters rows rather than raising an error in most cases — the row's unchanged/still-present state (verified via the service-role client) is the authoritative assertion in both branches."

requirements-completed: [SC2, SC6, SC7]

duration: ~25min
completed: 2026-07-04
---

# Phase 14 Plan 13: /audit page + route + append-only RLS proof Summary

**Wired the /audit page (thin container + AuditLogTable widget) into the router behind ProtectedRoute + AuditRoute, and proved append-only RLS on audit_logs with a live-Supabase integration test that attempts UPDATE/DELETE as an authenticated manager and asserts both are denied**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-04T16:33:00Z
- **Completed:** 2026-07-04T16:41:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **Task 1** — `src/pages/audit/index.tsx`: thin default-export page container, `<BackToHomeButton />` + `mx-auto max-w-6xl space-y-8` wrapper (matching `pages/staff/index.tsx`) + `<SectionHeader title="Audit Log" />` (renders an `<h2>`, satisfying `getByRole('heading', { name: 'Audit Log' })`) + `<AuditLogTable />` from `@widgets/AuditLogTable`. No data-fetching/filter logic in the page.
- **Task 2** — `src/app/router.tsx`: added `import { AuditRoute } from './audit-route';`, `const AuditPage = lazy(() => import('../pages/audit'));`, and a new `<Route path="/audit" element={<ProtectedRoute><AuditRoute><AuditPage /></AuditRoute></ProtectedRoute>} />`, mirroring the `/rbac` block exactly. `npm run build` succeeds — the lazy import resolves.
- **Task 3** — `src/entities/audit-log/model/rls-denial.integration.test.ts`: creates a temporary manager test user, signs in via an anon client (SELECT-permitted, no UPDATE/DELETE policy on `audit_logs`), seeds a real row via the service-role client, then asserts (a) SELECT succeeds (sanity check), (b) UPDATE is denied and the row is unchanged, (c) DELETE is denied and the row still exists. Guarded by `describe.skipIf(!hasEnv)`. All 3 tests pass against the live Supabase project.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | pages/audit/index.tsx — thin container with 'Audit Log' heading + AuditLogTable | `b1d521a` | `src/pages/audit/index.tsx` |
| 2 | Register the /audit route (ProtectedRoute + AuditRoute + lazy AuditPage) | `95bd88e` | `src/app/router.tsx` |
| 3 | Append-only RLS denial integration test (SC2) | `e8acb13` | `src/entities/audit-log/model/rls-denial.integration.test.ts`, `vitest.config.ts`, `.planning/phases/14-audit-logs-table/deferred-items.md` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npm run typecheck` — exit 0, clean.
- `npm run build` — succeeds (route + page resolve, lazy import works).
- `npx eslint src/pages/audit/ src/app/router.tsx src/entities/audit-log/model/rls-denial.integration.test.ts` — clean (0 errors).
- `npm run lint` (full project) — 5 pre-existing errors in files untouched by this plan (`src/app/App.tsx`, `src/entities/tab/model/queries.concurrent.test.ts`, `src/shared/ui/ErrorBoundary.tsx`) — already logged in `deferred-items.md` from 14-11, unchanged by this plan.
- `npx vitest run src/entities/audit-log/model/rls-denial.integration.test.ts --reporter=verbose` — 3/3 tests pass against the live Supabase project (SELECT sanity check, UPDATE denial, DELETE denial).
- `npm run test` (unit project, full suite) — 1161 passed, 2 pre-existing failures unrelated to this plan's files (`src/entities/staff/model/queries.clock.test.ts`, `src/features/close-tab/tests/useCloseTab.test.ts` — both hit the live DB per `test-setup.ts`'s `vi.unmock` convention and appear to be real-network flakiness), logged to `deferred-items.md`.

## Files Created/Modified

- `src/pages/audit/index.tsx` — new: thin `/audit` page container
- `src/app/router.tsx` — added `AuditRoute` import, lazy `AuditPage`, `/audit` route block
- `src/entities/audit-log/model/rls-denial.integration.test.ts` — new: append-only RLS denial integration test (SC2)
- `vitest.config.ts` — added a dedicated `integration` vitest project (Rule 3 fix, see Deviations)
- `.planning/phases/14-audit-logs-table/deferred-items.md` — logged 2 pre-existing full-suite test failures out of scope for this plan

## Decisions Made

- Treated either an explicit Postgres/PostgREST error OR a silently-empty affected-rows result as a valid "denied" outcome for the UPDATE/DELETE assertions, since Supabase RLS with no matching policy typically filters the target row rather than raising an error — the authoritative assertion in both branches is the unchanged/still-present row state, read back via the service-role client (bypasses RLS).
- Added a temporary manager test user (mirroring `depletion.integration.test.ts`'s established pattern) rather than reusing shared E2E credentials, so the test is self-contained and cleans up after itself in `afterAll`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] vitest had no way to run `*.integration.test.ts` files at all**
- **Found during:** Task 3 verification (`npx vitest run src/entities/audit-log/model/rls-denial.integration.test.ts --reporter=verbose`, as specified by the plan)
- **Issue:** `vitest.config.ts`'s single `unit` project excludes `**/*.integration.test.ts` project-wide, and no dedicated project existed to pick them up despite a code comment and an `npm run test:integration` script both claiming this was supported. Running the plan's exact verify command (and even the pre-existing `test:integration` script against the pre-existing `depletion.integration.test.ts`) returned "No test files found, exiting with code 1" — this blocked completing Task 3's verification step and was not specific to my new file.
- **Fix:** Added a dedicated `integration` vitest project (`environment: 'node'`, `include: ['src/**/*.integration.test.ts']`, no jsdom `setupFiles`/mocks) alongside the existing `unit` project. `npm run test` (which pins `--project unit`) is unaffected; integration tests are now runnable via the documented `npx vitest run <file>.integration.test.ts` command.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run src/entities/audit-log/model/rls-denial.integration.test.ts --reporter=verbose` — 3/3 pass. `npm run test` (unit) — same pass/fail counts as before the config change (2 pre-existing, unrelated failures).
- **Committed in:** `e8acb13` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking-issue fix required to execute the plan's own verification command)
**Impact on plan:** No scope creep — this is test-infrastructure required for Task 3's stated verify step to run at all; the fix is additive (new project) and does not alter `npm run test`'s existing behavior.

## Issues Encountered

- The worktree had no `node_modules` (fresh checkout) and no `.env.local` (gitignored, per 14-11's precedent). Ran `npm install` (~50s) and copied `.env.local` from the main repo checkout so the integration test could connect to the live Supabase project. Neither is a plan deliverable.
- `.planning/` is gitignored except a few previously force-added files. This SUMMARY.md and the `deferred-items.md` update are force-added per the parallel-execution instructions.
- Full-suite `npm run test` surfaced 2 pre-existing failures in files this plan never touches — logged to `deferred-items.md`, not fixed (scope boundary; both appear to be live-DB-dependent tests per the codebase's own `test-setup.ts` convention, not caused by this plan's router/page/vitest-config changes).

## User Setup Required

None — no external service configuration required. The RLS denial test requires `SUPABASE_SERVICE_ROLE_KEY`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in `.env.local` to run (skips gracefully without them); these were already present in the project's `.env.local`.

## Next Phase Readiness

- `/audit` is now reachable end-to-end: `ProtectedRoute` (auth) → `AuditRoute` (manager+, RBAC) → `AuditPage` (thin container) → `AuditLogTable` (14-11 widget). `e2e/38-audit-logs.spec.ts`'s heading assertion (`getByRole('heading', { name: 'Audit Log' })`) is satisfied by `SectionHeader`'s `<h2>`.
- SC2 (append-only RLS) is now proven by an automated, skippable integration test — no manual verification step remains for this guarantee.
- 14-14 (final phase gate) can now run `e2e/38-audit-logs.spec.ts` against a fully wired `/audit` page and should also pick up the new `vitest.config.ts` `integration` project if it runs `npm run test:integration` as part of its gate.

## Self-Check: PASSED

- FOUND: `src/pages/audit/index.tsx`
- FOUND: `src/app/router.tsx` (modified, contains `AuditRoute`/`/audit`)
- FOUND: `src/entities/audit-log/model/rls-denial.integration.test.ts`
- FOUND: `vitest.config.ts` (modified, contains `integration` project)
- FOUND commit `b1d521a` (Task 1)
- FOUND commit `95bd88e` (Task 2)
- FOUND commit `e8acb13` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
