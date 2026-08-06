---
created: 2026-08-04T00:00:00.000Z
title: view_all_shifts RBAC permission is defined but never enforced anywhere
area: rbac
severity: minor
files:
  - src/shared/lib/rbac.ts:83 (ADMIN_EXTRA)
  - src/widgets/StaffDashboard/StaffDashboard.tsx
---

## Problem

Discovered during Phase 39's E2E triage of `e2e/22-staff-management.spec.ts` SM6
("admin sees all shifts; bartender sees only own").

`view_all_shifts` is a defined `StaffAction` (`rbac.ts:29`) granted only to `admin`
(`ADMIN_EXTRA`, `rbac.ts:83`) — not manager, not bartender — per CLAUDE.md's own RBAC
Actions documentation. Confirmed by grep: this action is referenced nowhere else in
`src/` outside its own definition site. `StaffDashboard.tsx` (the `/staff` page's shift
table) calls `useStaffList()` unconditionally and renders the full staff/shift list to
every authenticated role with no `can('view_all_shifts')` check or role-based
filtering — a bartender sees the exact same full roster and clock-in/shift-duration
data as an admin.

This is a genuine authorization-enforcement gap, not just a stale test expectation:
the permission is deliberately defined and role-scoped in `rbac.ts`, but nothing
consumes it. Severity is moderate (clock-in/shift-duration data, not payment/inventory
data — the RBAC-gated actions on each row, clock-in/out/force-pin-change, are
correctly protected via `ProtectedAction`), but it's still a real gap between the
documented permission model and actual enforcement.

## Solution

TBD. Options to evaluate:
- Filter `useStaffList()`'s result (or the table rows) to the current staff member only
  when `!can('view_all_shifts')`, matching the intended admin-only "see everyone"
  scope.
- Alternatively, if showing the full roster to all roles is actually the intended
  design (e.g. for scheduling visibility), retire the unused `view_all_shifts`
  permission from `rbac.ts` and CLAUDE.md's RBAC Actions list rather than leaving a
  defined-but-dead permission that implies protection that doesn't exist.
