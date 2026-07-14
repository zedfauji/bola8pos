---
phase: 12-full-rbac-page-remove-the-breadcrumbs-of-rbac-from-other-pag
plan: "01"
subsystem: rbac
tags: [rbac, route-guard, widget, staff-management, fsd]
dependency_graph:
  requires: []
  provides:
    - RbacRoute guard (app layer)
    - RbacPage thin container (pages layer)
    - RBACDashboard widget (widgets layer)
    - EditRoleDialog preSelectedStaffId prop
  affects:
    - bar-pos/src/features/edit-staff-role/ui/EditRoleDialog.tsx
    - bar-pos/src/widgets/StaffDashboard/StaffDashboard.tsx
tech_stack:
  added: []
  patterns:
    - key-based remount pattern for controlled dialog state seeding
    - route guard pattern (mirrors ReportsRoute)
    - thin page container pattern (mirrors WaitlistPage)
key_files:
  created:
    - bar-pos/src/app/rbac-route.tsx
    - bar-pos/src/pages/rbac/index.tsx
    - bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx
    - bar-pos/src/widgets/RBACDashboard/index.ts
    - bar-pos/src/widgets/RBACDashboard/RBACDashboard.test.tsx
    - bar-pos/src/features/edit-staff-role/EditRoleDialog.test.tsx
  modified:
    - bar-pos/src/features/edit-staff-role/ui/EditRoleDialog.tsx
    - bar-pos/src/features/edit-staff-role/index.ts
    - bar-pos/src/widgets/StaffDashboard/StaffDashboard.tsx
    - bar-pos/src/widgets/StaffDashboard/StaffDashboard.test.tsx
decisions:
  - "key-based remount pattern used for preSelectedStaffId instead of useEffect+setState: react-hooks/set-state-in-effect lint rule blocks setState in effects; key={selectedStaffId ?? 'no-selection'} on EditRoleDialog forces remount with fresh state initialized from preSelectedStaffId"
  - "StaffDashboard Administration section fully removed: usePermissions, can, toast, Button, EditRoleDialog, editRoleOpen all cleaned up as they had zero remaining uses after removal"
  - "StaffDashboard.test.tsx: three existing tests (shows Administration, hides Administration, fires toast on Add Staff) replaced with it.todo stubs since they tested the now-removed section"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_changed: 10
---

# Phase 12 Plan 01: RBAC Page Scaffold Summary

Admin-gated `/rbac` page with `RBACDashboard` widget (DataTable + per-row `EditRoleDialog` with `preSelectedStaffId`), `RbacRoute` guard checking `can('manage_staff')`, and `StaffDashboard` fully cleaned of its Administration section.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Wave 0 test stub files | 501c036 | RBACDashboard.test.tsx, EditRoleDialog.test.tsx, StaffDashboard.test.tsx |
| 1 | Extend EditRoleDialog + clean StaffDashboard | 3ce2029 | EditRoleDialog.tsx, index.ts, StaffDashboard.tsx |
| 2 | rbac-route.tsx + pages/rbac + RBACDashboard widget + barrel | 5c97c9a | rbac-route.tsx, pages/rbac/index.tsx, RBACDashboard.tsx, index.ts |

## Verification

- `npm run typecheck` — EXIT 0
- `npm run lint` — EXIT 0 (max-warnings: 0)
- `npm run test` — 1104 passed, 15 todo, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-hooks/set-state-in-effect lint error in EditRoleDialog**
- **Found during:** Task 1 lint verification
- **Issue:** Plan specified `useEffect` calling `setSelectedStaffId` synchronously — blocked by `react-hooks/set-state-in-effect` ESLint rule (same rule that caused Phase 04 useReducer fix per STATE.md decisions)
- **Fix:** Replaced `useEffect` + setState with `useState(preSelectedStaffId ?? '')` initializer; `RBACDashboard` uses `key={selectedStaffId ?? 'no-selection'}` on `EditRoleDialog` to force remount with fresh state whenever a different staff row's Edit Role is clicked
- **Files modified:** `bar-pos/src/features/edit-staff-role/ui/EditRoleDialog.tsx`, `bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx`
- **Commits:** 3ce2029, 5c97c9a

**2. [Rule 1 - Bug] StaffDashboard.test.tsx had 3 tests asserting the Administration section exists**
- **Found during:** Task 0 — pre-existing tests would fail after Task 1 removes the Administration section
- **Fix:** Replaced `shows Administration when can manage_staff`, `hides Administration when cannot manage_staff`, and `fires toast on Add Staff` tests with `it.todo` stubs matching the plan's Wave 0 spec; removed now-unused `userEvent` and `toast` imports
- **Files modified:** `bar-pos/src/widgets/StaffDashboard/StaffDashboard.test.tsx`
- **Commit:** 501c036

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Add Staff button shows toast | `RBACDashboard.tsx:69` | create-staff feature not yet built; stub intentional per plan spec |
| Deactivate button shows toast | `RBACDashboard.tsx:78` | deactivate-staff feature not yet built; stub intentional per plan spec |

## Threat Flags

None — `RbacRoute` implements T-12-01 mitigation (`can('manage_staff')` + `<Navigate replace>`). No new trust boundaries introduced beyond what the threat model specifies.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| bar-pos/src/app/rbac-route.tsx | FOUND |
| bar-pos/src/pages/rbac/index.tsx | FOUND |
| bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx | FOUND |
| bar-pos/src/widgets/RBACDashboard/index.ts | FOUND |
| commit 501c036 | FOUND |
| commit 3ce2029 | FOUND |
| commit 5c97c9a | FOUND |
