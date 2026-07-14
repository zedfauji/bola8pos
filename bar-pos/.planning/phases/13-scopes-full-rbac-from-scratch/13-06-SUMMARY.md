---
phase: 13-scopes-full-rbac-from-scratch
plan: 06
subsystem: testing
tags: [playwright, e2e, rbac, rls, supabase]

# Dependency graph
requires:
  - phase: 13-scopes-full-rbac-from-scratch
    provides: role_permissions table, RLS rewrite, PermissionMatrix UI (plans 13-01..13-05)
provides:
  - e2e/09-rbac.spec.ts Phase 13 tests (T-RP-01..06) — all passing
  - Full unit + typecheck + lint regression gate for Phase 13 code
  - Fix for a Phase-15 regression silently breaking the openCaja() E2E helper app-wide
affects: [all E2E specs using openCaja() — ~39 spec files]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Any UPDATE against a versioned_rows table (tabs, pool_sessions, caja_sessions) must explicitly set version = version + 1 and check the returned error — the bump_version_on_update trigger silently rejects UPDATEs that don't, and Supabase JS calls with unchecked errors fail invisibly"

key-files:
  created: []
  modified:
    - e2e/helpers/supabase.ts

key-decisions:
  - "Task 2's human-verify checkpoint approved based on: all 6 Phase 13 E2E tests (T-RP-01..06) passing, exact role_permissions count match (bartender=9/manager=17/admin=22/kitchen=4), zero-row action-set diff, full unit suite green (1 pre-existing unrelated failure), and a manual /rbac click-through by the user"
  - "6 pre-existing failures in 09-rbac.spec.ts's original (pre-Phase-13) describe block, all blocked on a missing 'Budweiser' product in the seed catalog, are a pre-existing seed-data gap unrelated to RBAC — confirmed via direct query (zero rows for name ILIKE '%budweiser%') and left untouched as out of Phase 13 scope"
  - "Fixed the openCaja() regression in-scope despite it predating Phase 13 (introduced by Phase 15's version trigger) — its blast radius (~39 E2E specs, not just this one) and its status as the actual blocker preventing this checkpoint from running at all made deferring it impractical"

patterns-established: []

requirements-completed:
  - RBAC13-03
  - RBAC13-04
  - RBAC13-05
  - RBAC13-06
  - RBAC13-07
  - RBAC13-08
  - RBAC13-09

# Metrics
duration: unknown for Task 1 (backfilled from commit history); ~45min for Tasks 2-3 this session
completed: 2026-07-03
---

# Phase 13: Full RBAC From Scratch Summary (Plan 13-06)

**Phase 13 E2E verification complete: all 6 Permission Matrix tests (T-RP-01..06) pass; found and fixed a Phase-15 regression silently breaking the openCaja() E2E helper across ~39 specs**

## Performance

- **Duration:** Task 1 (adding the 6 T-RP tests) duration unknown — committed 2026-04-28 with no summary written at the time. Tasks 2-3 (verification + regression gate) took ~45 min this session, dominated by diagnosing the openCaja() bug.
- **Started:** 2026-04-28 (Task 1); 2026-07-03 (Tasks 2-3, resumed)
- **Completed:** 2026-07-03T22:15:00Z
- **Tasks:** 3
- **Files modified:** 2 (`e2e/09-rbac.spec.ts` for Task 1 in April; `e2e/helpers/supabase.ts` for the regression fix this session)

## Accomplishments
- Confirmed all 6 Phase 13 E2E tests pass: T-RP-01 (22×4 permission matrix with 88 switches), T-RP-02 (toggle + revert), T-RP-03 (bartender redirect from /rbac), T-RP-04 (kitchen RLS block on payments), T-RP-05 (bartender process_refund blocked), T-RP-06 (kitchen blocked from /rappi)
- Ran the full regression gate: unit suite (1133/1134, 1 pre-existing unrelated failure), typecheck (clean), lint (5 pre-existing unrelated errors, 0 new)
- Verified `role_permissions` seed data matches the plan's spec exactly via direct SQL: bartender=9, manager=17, admin=22, kitchen=4; action-set diff against `rbac.ts`'s known action list returned 0 rows
- Human sign-off received on the manual `/rbac` Permission Matrix click-through
- Found and fixed a real regression: `openCaja()` in `e2e/helpers/supabase.ts` had been silently broken since Phase 15 shipped (2026-04-28) — its cleanup UPDATE never bumped `version`, so Phase 15's `bump_version_on_update` trigger rejected it every time, and the error was never checked. This left stale open `caja_sessions` rows in place indefinitely, causing `caja_sessions_one_open` unique-constraint violations in any spec that ran after one failed. Fixing it took the RBAC spec from 20 failures down to only the 6 pre-existing, unrelated ones.

## Task Commits

1. **Task 1: Add T-RP-01 through T-RP-05 (T-RP-06 also included)** — `5d6c97b` (test) — completed 2026-04-28, backfilled to this summary
2. **Task 2 + 3: Verification + regression gate + openCaja fix** — `a692e3f` (fix) — this session

## Files Created/Modified
- `e2e/09-rbac.spec.ts` — 6 new tests (T-RP-01..06) in a new `Phase 13: Permission Matrix` describe block (Task 1, April 2026)
- `e2e/helpers/supabase.ts` — `openCaja()` now reads each open `caja_sessions` row's current version and closes it individually with `version + 1`, with errors surfaced instead of silently swallowed

## Decisions Made
- Approved the Task 2 human-verify checkpoint on the combined weight of: all 6 in-scope Phase 13 tests passing, exact seed-data counts, a clean regression gate, and the user's own manual `/rbac` click-through — rather than requiring every unrelated pre-existing E2E test in the same spec file to also pass
- Treated the 6 "Select Budweiser" failures as a pre-existing, out-of-scope seed-data gap (confirmed via direct query: zero products match `%budweiser%`) rather than something to fix under Phase 13
- Fixed `openCaja()` in-scope even though the bug predates Phase 13 (introduced by Phase 15's version trigger) — it was the actual blocker preventing this checkpoint's E2E suite from running at all, and its blast radius spans ~39 E2E spec files, not just this one

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking discovery] openCaja() silently broken by Phase 15's version trigger**
- **Found during:** Task 2's E2E verification run — all 20 tests in `09-rbac.spec.ts` failed with `caja_sessions_one_open` unique constraint violations
- **Issue:** `openCaja()`'s cleanup `UPDATE caja_sessions SET status='closed' ... WHERE status='open'` never set `version`, so the `bump_version_on_update` trigger (added in Phase 15, D-02) rejected it with `P0V01` every time; the error was never checked, so the stale open row was never actually closed, and the subsequent INSERT always failed once any prior test left a session open
- **Fix:** Read each open row's `id` and `version` first, then close each individually with `version: version + 1`, checking and surfacing errors
- **Files modified:** `e2e/helpers/supabase.ts`
- **Verification:** RBAC spec went from 20/20 failing to 6/20 failing (all 6 remaining failures confirmed pre-existing and unrelated — missing "Budweiser" seed product)
- **Committed in:** `a692e3f`

---

**Total deviations:** 1 auto-fixed (blocking discovery with app-wide E2E blast radius)
**Impact on plan:** Necessary — without this fix, Task 2's E2E verification step could not run at all for any spec. No scope creep; fix is scoped exactly to the broken function.

## Issues Encountered
- A stale open `caja_sessions` row from 2026-04-26 (predating this session, leftover from earlier manual testing) additionally required a one-time manual close via direct SQL before the `openCaja()` fix could be verified — this was environment cleanup, not a code issue.
- 6 pre-existing failures in `09-rbac.spec.ts`'s original (pre-Phase-13) test block, all blocked on a "Select Budweiser" locator — confirmed via SQL that no product named "Budweiser" exists in the current seed catalog. Left unfixed as a pre-existing, out-of-scope seed-data gap.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 13 (Full RBAC From Scratch) is now fully complete: all 6 plans have SUMMARY.md
- The `openCaja()` fix should improve pass rates across other E2E specs that were silently affected by the same Phase-15 regression — worth a full `npm run test:e2e` pass before the next release to quantify the improvement
- The "Select Budweiser" seed-data gap affecting 6 pre-existing RBAC tests (and likely other specs) is a separate, unscoped issue worth its own investigation

---
*Phase: 13-scopes-full-rbac-from-scratch*
*Completed: 2026-07-03*
*Note: Task 1 of this plan was completed and committed 2026-04-28 but had no SUMMARY.md written at the time. Tasks 2-3 (verification checkpoint + regression gate) were completed this session (2026-07-03), which also surfaced and fixed the openCaja() regression described above.*
