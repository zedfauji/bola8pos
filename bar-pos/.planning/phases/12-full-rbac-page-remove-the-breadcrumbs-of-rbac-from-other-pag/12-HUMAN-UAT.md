---
status: partial
phase: 12-full-rbac-page-remove-the-breadcrumbs-of-rbac-from-other-pag
source: [12-VERIFICATION.md]
started: "2026-04-27T22:10:00Z"
updated: "2026-04-27T22:10:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin RBAC page loads with live staff data
expected: Log in as admin (PIN 0000), navigate to /rbac — page shows "Roles & Permissions" heading and DataTable populated with staff names, roles, and Edit Role buttons
result: [pending]

### 2. Per-row Edit Role dialog pre-seeded
expected: Click "Edit Role" on any staff row — EditRoleDialog opens with that staff member pre-selected in the dropdown (not empty)
result: [pending]

### 3. Manager redirect timing (no flash)
expected: Log in as manager, navigate directly to /rbac — immediately redirected to /home with no flash of the RBAC page
result: [pending]

### 4. HomeDashboard tile click-through
expected: Admin on /home — "Roles & Permissions" tile visible with ShieldCheck icon; clicking it navigates to /rbac
result: [pending]

### 5. Non-admin tile gating via ManagerPinDialog
expected: Bartender on /home — "Roles & Permissions" tile shows lock icon; clicking it opens ManagerPinDialog (not direct navigation to /rbac)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
