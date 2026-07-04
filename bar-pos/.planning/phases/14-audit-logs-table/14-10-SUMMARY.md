---
phase: 14-audit-logs-table
plan: 10
subsystem: auth
tags: [rbac, react-router, supabase, rls]

requires:
  - phase: 14-audit-logs-table
    provides: "14-02 record_audit terminal_id/actor_id foundation"
provides:
  - "view_audit_log StaffAction (manager+) added to rbac.ts"
  - "AuditRoute guard with toast-on-redirect, matching /audit E2E contract"
  - "HomeDashboard /audit tile switched from visibleToRoles to requiredAction gating (consistency fix)"
  - "role_permissions seed migration granting view_audit_log to manager+admin"
affects: [14-13]

tech-stack:
  added: []
  patterns:
    - "AuditRoute is the only route guard that shows a toast on redirect (per E2E contract) — other guards silently redirect"

key-files:
  created:
    - src/app/audit-route.tsx
    - src/app/audit-route.test.tsx
    - supabase/migrations/20260703000006_role_permissions_view_audit_log.sql
  modified:
    - src/shared/lib/rbac.ts
    - src/widgets/HomeDashboard/ui/HomeDashboard.tsx

key-decisions:
  - "HomeDashboard's /audit tile now uses requiredAction: 'view_audit_log' instead of the inconsistent visibleToRoles gating every other manager+ tile avoided (RESEARCH.md Pitfall 8)"

patterns-established:
  - "AuditRoute: toast-on-redirect route guard pattern (unique among app's guards) — used when the E2E contract requires user-visible feedback on access denial rather than silent redirect"

requirements-completed: []

duration: 20min
completed: 2026-07-04
---

# Phase 14: Audit Logs Table Summary (Plan 10 — RBAC + Route Guard Foundation for /audit)

**Added view_audit_log StaffAction, AuditRoute guard with toast-on-redirect, and fixed HomeDashboard's /audit tile to use requiredAction gating like every other manager+ tile**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3
- **Files modified:** 5 (2 created source files, 1 created test file, 1 created migration, 2 modified)

## Accomplishments
- Added `view_audit_log` to `StaffAction` in `src/shared/lib/rbac.ts` (manager+ gated).
- Built `src/app/audit-route.tsx` — an `AuditRoute` guard that, uniquely among the app's route guards, shows a toast on redirect (per the `/audit` E2E contract) rather than silently redirecting.
- Fixed `HomeDashboard`'s `/audit` tile, which previously used inconsistent `visibleToRoles` gating (RESEARCH.md Pitfall 8), to use `requiredAction: 'view_audit_log'` like every other manager+ tile in the dashboard.
- Added `supabase/migrations/20260703000006_role_permissions_view_audit_log.sql` seeding `view_audit_log` into `role_permissions` for manager+admin (Phase-13 DB-parity requirement). Not yet pushed to remote — deferred to 14-14's blocking push gate.

## Task Commits

Each task was committed atomically on the worktree branch (merged to main via `chore: merge executor worktree (worktree-agent-a0592af1b96811a29)`, commit `c440efa`):

1. **Task 1: view_audit_log StaffAction + role_permissions seed migration** - `f797d62`
2. **Task 2: AuditRoute guard with toast-on-redirect** - `ece8e1a`
3. **Task 2 (deviation fix): correct import order in audit-route.test.tsx** - `55d9a6b`
4. **Task 3: HomeDashboard /audit tile switched to requiredAction gating** - `263224f`
5. **Task 3 (deviation fix): update PermissionMatrix.test.tsx STAFF_ACTIONS count 22 -> 23** - `0deff36`

**Plan metadata:** this SUMMARY (reconstructed post-merge — original was not committed in the worktree before removal; see Issues Encountered).

## Files Created/Modified
- `src/shared/lib/rbac.ts` - added `view_audit_log` StaffAction
- `src/app/audit-route.tsx` - new AuditRoute guard, toast-on-redirect
- `src/app/audit-route.test.tsx` - new RTL test for the guard
- `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` - `/audit` tile gating fix
- `supabase/migrations/20260703000006_role_permissions_view_audit_log.sql` - new seed migration (not pushed; deferred to 14-14)

## Decisions Made
- `AuditRoute` shows a toast on redirect — the only guard in the app that does, because the `/audit` E2E spec requires user-visible feedback rather than a silent redirect like other manager+ routes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1] Corrected import order in audit-route.test.tsx**
- **Found during:** Task 2 (AuditRoute guard)
- **Issue:** Lint flagged import ordering in the new test file
- **Fix:** Reordered imports per project ESLint import/order rule
- **Committed in:** `55d9a6b`

**2. [Rule 1] Updated PermissionMatrix.test.tsx STAFF_ACTIONS count 22 -> 23**
- **Found during:** Task 3 (adding view_audit_log)
- **Issue:** Adding a new StaffAction broke a hardcoded count assertion in an existing test
- **Fix:** Updated the expected count to 23
- **Committed in:** `0deff36`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — lint/test-count corrections required by the new StaffAction)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered
- The executor agent treated `gsd-tools.cjs query commit`'s `{committed:false, skipped:true, reason:'skipped_gitignored'}` response for this plan's own SUMMARY.md as an acceptable terminal state (since `.planning/` is gitignored project-wide) instead of force-adding it as 14-01/14-02/14-03 did. Because worktree-mode SUMMARY.md commits are mandatory (the worktree is force-removed after merge), this SUMMARY.md was lost when the worktree was cleaned up post-merge. This file was reconstructed by the orchestrator from the executor's completion report (task notification) rather than the original file. Content is faithful to that report; no code was affected — only this documentation artifact needed recovery.
- Full unit suite showed 1143/1165 passing at the time of this plan's run in its isolated worktree; the 22 non-passing were the documented Wave-2/Wave-3 RPC-coverage scaffold RED cases (6, awaiting sibling plans not yet merged into that worktree) plus 1 pre-existing Phase-15 `useCloseTab.test.ts` issue — not regressions from this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 14-13 (wire the `/audit` page + route) can now use `AuditRoute` + `view_audit_log` as its guard foundation.
- `role_permissions` seed migration for `view_audit_log` is ready; must be included in 14-14's remote push list.

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
