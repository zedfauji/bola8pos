---
phase: 12-full-rbac-page-remove-the-breadcrumbs-of-rbac-from-other-pag
plan: "02"
subsystem: routing, home-dashboard, e2e
tags: [rbac, routing, home-dashboard, e2e, playwright]
dependency_graph:
  requires:
    - "12-01"  # RbacRoute + RbacPage + RBACDashboard widget created
  provides:
    - "/rbac route registered in router with RbacRoute guard"
    - "Roles & Permissions tile on HomeDashboard"
    - "E2E coverage: T-RBAC-page, T-RBAC-redirect, T12, T14"
  affects:
    - bar-pos/src/app/router.tsx
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx
    - bar-pos/CLAUDE.md
    - bar-pos/e2e/09-rbac.spec.ts
tech_stack:
  added: []
  patterns:
    - "Lazy-loaded route with RbacRoute guard (same pattern as WaitlistRoute)"
    - "ITEMS array entry with requiredAction + managerLabel for Admin-gated tile"
key_files:
  created: []
  modified:
    - bar-pos/src/app/router.tsx
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx
    - bar-pos/CLAUDE.md
    - bar-pos/e2e/09-rbac.spec.ts
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
decisions:
  - "Import order fix: rbac-route placed before reports-route alphabetically per ESLint import/order rule"
  - "Roles & Permissions tile uses manage_staff requiredAction (same as RbacRoute guard) for consistent UX gating"
metrics:
  duration: "4min"
  completed_date: "2026-04-28"
  tasks: 2
  files: 5
---

# Phase 12 Plan 02: Wire /rbac Route + HomeDashboard Tile + E2E Coverage Summary

**One-liner:** /rbac route wired with lazy RbacPage + RbacRoute guard, Roles & Permissions tile added to HomeDashboard with ShieldCheck icon, four new Playwright E2E tests (T-RBAC-page, T-RBAC-redirect, T12, T14) added to 09-rbac.spec.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire /rbac route + HomeDashboard tile + CLAUDE.md | 8051884 | router.tsx, HomeDashboard.tsx, CLAUDE.md |
| 2 | Add T-RBAC-page, T-RBAC-redirect, T12, T14 E2E tests | 5fdba18 | e2e/09-rbac.spec.ts |

## Verification Results

- typecheck: EXIT 0
- lint: EXIT 0 (fixed import order: rbac-route before reports-route)
- unit tests: 1104 passed, 15 todo (2 skipped) — no regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint import/order violation in router.tsx**
- **Found during:** Task 1 verification (lint run)
- **Issue:** `rbac-route` import was appended after `waitlist-route` but `import/order` rule requires alphabetical order within the same import group; `rbac-route` must precede `reports-route`
- **Fix:** Reordered local imports so `rbac-route` comes before `reports-route` and `waitlist-route`
- **Files modified:** bar-pos/src/app/router.tsx
- **Commit:** 8051884 (included in Task 1 commit)

**2. [Rule 1 - Bug] HomeDashboard unit test lock icon count stale after new tile added**
- **Found during:** Post-task unit test run
- **Issue:** `HomeDashboard.test.tsx` asserted `lockIcons.length === 5` (Reports, Inventory, Settings, Kitchen Prep, Waitlist) — adding the Roles & Permissions tile (also gated) made it 6
- **Fix:** Updated assertion to `toBe(6)` and updated the comment to include "Roles & Permissions"
- **Files modified:** bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
- **Commit:** a8b1332

## Known Stubs

None — all functionality is fully wired. RbacPage and RBACDashboard widget were created in Plan 01.

## Threat Flags

No new security surface introduced. The /rbac route is wrapped in both `ProtectedRoute` (auth check) and `RbacRoute` (role check: `can('manage_staff')`), satisfying threat T-12-04 mitigation.

## Self-Check: PASSED

- bar-pos/src/app/router.tsx — contains RbacRoute, RbacPage, /rbac route entry
- bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx — contains ShieldCheck, /rbac ITEMS entry
- bar-pos/CLAUDE.md — contains /rbac row in routes table
- bar-pos/e2e/09-rbac.spec.ts — contains T-RBAC-page, T12, T14 test blocks
- Commits 8051884, 5fdba18, a8b1332 exist in git log
