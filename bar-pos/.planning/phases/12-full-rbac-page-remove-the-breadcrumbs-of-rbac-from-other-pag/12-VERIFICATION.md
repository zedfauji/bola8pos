---
phase: 12-full-rbac-page-remove-the-breadcrumbs-of-rbac-from-other-pag
verified: 2026-04-28T00:00:00Z
re_verified: 2026-08-06
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "While on /rbac as admin, click 'Edit Role' on any staff row (not self)"
    expected: "EditRoleDialog opens with the staff member already selected in the dropdown (not blank)"
    why_human: "Automated E2E (T-RBAC-page, 2026-08-06) confirms the dialog opens on click but does not assert the dropdown's pre-selected value"
  - test: "Log in as admin, on /home, click the 'Roles & Permissions' tile"
    expected: "Tile navigates to /rbac"
    why_human: "Automated E2E (T14, 2026-08-06) confirms the tile is visible but does not click it to confirm navigation"
  - test: "Log in as bartender, navigate to /home, look for the 'Roles & Permissions' tile"
    expected: "Tile shows a lock icon; clicking it opens ManagerPinDialog rather than navigating directly to /rbac"
    why_human: "No automated coverage exists for the bartender tile-gating interaction"
---

# Phase 12: Full RBAC Management Page — Verification Report

**Phase Goal:** Full RBAC management page — single admin-only page for role management, breadcrumbs of RBAC removed from other pages, protected by navigation rule.
**Verified:** 2026-04-28
**Status:** human_needed
**Re-verification:** Yes — 2026-08-06 (live E2E run against current code; original 2026-04-28 findings still hold, no regressions found)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can navigate to /rbac without being redirected | VERIFIED | `RbacRoute` checks `can('manage_staff')`; admin has this permission; route registered in `router.tsx` with `<ProtectedRoute><RbacRoute>` wrapping `RbacPage` |
| 2 | Non-admin (bartender/manager) visiting /rbac is redirected to /home | VERIFIED | `rbac-route.tsx` line 11: `if (!can('manage_staff')) return <Navigate to="/home" replace />`; E2E tests T-RBAC-redirect + T12 cover both bartender and manager |
| 3 | RBACDashboard renders a DataTable of staff with Name, Role, and Edit Role column | VERIFIED | `RBACDashboard.tsx` defines three `ColumnDef<Staff>` entries: `accessorKey: 'name'` (Name), `id: 'role'` with Badge (Role), `id: 'actions'` with POSButton "Edit Role" |
| 4 | Clicking Edit Role for a row opens EditRoleDialog pre-seeded with that staff member selected | VERIFIED | `RBACDashboard.tsx` sets `selectedStaffId` state on button click, passes `preSelectedStaffId={selectedStaffId}` and uses `key={selectedStaffId ?? 'no-selection'}` to force remount with `useState(preSelectedStaffId ?? '')` seeding |
| 5 | StaffDashboard no longer shows the Administration section or EditRoleDialog mount | VERIFIED | `StaffDashboard.tsx` contains no references to `Administration`, `EditRoleDialog`, `editRoleOpen`, `can`, or `usePermissions` — all removed; grep confirms zero matches |
| 6 | Navigating to /rbac in the app loads RbacPage (not 404) | VERIFIED | `router.tsx` line 155–164: `/rbac` route with lazy-loaded `RbacPage` registered in `<Routes>` |
| 7 | HomeDashboard shows a 'Roles & Permissions' tile locked to Admin for manager/bartender | VERIFIED | `HomeDashboard.tsx` ITEMS array line 79–85: `{ path: '/rbac', label: 'Roles & Permissions', icon: ShieldCheck, requiredAction: 'manage_staff', managerLabel: 'Admin' }`; `ShieldCheck` imported from lucide-react |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/src/app/rbac-route.tsx` | Admin-only route guard checking `can('manage_staff')` | VERIFIED | 15 lines; exports `RbacRoute`; checks `manage_staff`; redirects to `/home` |
| `bar-pos/src/pages/rbac/index.tsx` | Thin page container rendering RBACDashboard widget | VERIFIED | 15 lines; imports `RBACDashboard`, `BackToHomeButton`, `PageContainer`; renders `<PageContainer title="Roles & Permissions">` |
| `bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx` | Staff DataTable with per-row Edit Role button | VERIFIED | 114 lines; substantive implementation with `useStaffList`, `DataTable`, `EditRoleDialog`, `POSButton`, 3-column definition |
| `bar-pos/src/widgets/RBACDashboard/index.ts` | Named barrel exports (no export *) | VERIFIED | Single named export: `export { RBACDashboard } from './RBACDashboard'` |
| `bar-pos/src/widgets/RBACDashboard/RBACDashboard.test.tsx` | Wave 0 test stubs with `it.todo` | VERIFIED | 6 `it.todo` stubs; no component imports of non-existent files |
| `bar-pos/src/features/edit-staff-role/EditRoleDialog.test.tsx` | Wave 0 test stubs for preSelectedStaffId prop | VERIFIED | 4 `it.todo` stubs for preSelectedStaffId behavior |
| `bar-pos/src/features/edit-staff-role/ui/EditRoleDialog.tsx` | `preSelectedStaffId: string \| undefined` prop + state seeding | VERIFIED | Line 31: `preSelectedStaffId: string \| undefined`; line 45: `useState(preSelectedStaffId ?? '')`; no `exactOptionalPropertyTypes` violation |
| `bar-pos/src/app/router.tsx` | Lazy-loaded RbacPage under /rbac route wrapped in RbacRoute | VERIFIED | Line 25: `const RbacPage = lazy(...)`, line 7: `import { RbacRoute }`, lines 155–164: route entry |
| `bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx` | ITEMS entry for /rbac with ShieldCheck icon and manage_staff requiredAction | VERIFIED | Lines 13: `ShieldCheck` imported; lines 79–85: ITEMS entry confirmed |
| `bar-pos/e2e/09-rbac.spec.ts` | T-RBAC-page, T-RBAC-redirect, T12, T14 tests inside existing describe block | VERIFIED | Lines 201–239: all four tests present inside `test.describe('Role-Based Access', ...)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pages/rbac/index.tsx` | `widgets/RBACDashboard/RBACDashboard.tsx` | `import RBACDashboard` | WIRED | Line 1: `import { RBACDashboard } from '@widgets/RBACDashboard'`; used in JSX at line 9 |
| `RBACDashboard.tsx` | `features/edit-staff-role/ui/EditRoleDialog.tsx` | `import EditRoleDialog, pass preSelectedStaffId` | WIRED | Line 4: `import { EditRoleDialog }`; line 110: `preSelectedStaffId={selectedStaffId}` passed |
| `rbac-route.tsx` | `entities/staff/model/usePermissions` | `usePermissions().can('manage_staff')` | WIRED | Line 3: `import { usePermissions }`; line 11: `can('manage_staff')` |
| `router.tsx` | `pages/rbac/index.tsx` | `lazy(() => import('../pages/rbac'))` | WIRED | Line 25: lazy import confirmed; line 156–164: route entry confirmed |
| `router.tsx` | `rbac-route.tsx` | `import { RbacRoute }` | WIRED | Line 7: `import { RbacRoute } from './rbac-route'`; used at line 159 |
| `HomeDashboard.tsx` | `router.tsx` | `path: '/rbac' in ITEMS navigates to registered route` | WIRED | ITEMS path `/rbac` matches registered route; `handleItemClick` calls `navigate(item.path)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RBACDashboard.tsx` | `staffList` from `useStaffList()` | `@entities/staff` TanStack Query hook | Yes — `useStaffList` is a pre-existing entity query fetching from Supabase `profiles` table (established in prior phases) | FLOWING |
| `RBACDashboard.tsx` | `currentStaffId` from `useStaffStore` | Zustand store, populated on login | Yes — populated at auth time, not hardcoded | FLOWING |

### Behavioral Spot-Checks

Step 7b: RUN LIVE on 2026-08-06 — this sandbox has a running dev server (`localhost:1420`), `.env.local` E2E credentials, and Chrome, so the 4 tests originally deferred as "require a running server" were executed directly:

```
npx playwright test e2e/09-rbac.spec.ts --grep "T-RBAC-page|T-RBAC-redirect|T12:|T14:"
  ✓ T-RBAC-page: admin can access /rbac page and open per-row edit role dialog (11.6s)
  ✓ T-RBAC-redirect: non-admin (bartender) visiting /rbac is redirected to /home (12.1s)
  ✓ T12: non-admin (manager) visiting /rbac is redirected to /home (12.0s)
  ✓ T14: admin sees Roles & Permissions tile on home dashboard (11.6s)
  4 passed (1.1m)
```

All 4 passed against current `main` — no regressions from the 3.5 months of work landed since the original 2026-04-28 verification (including the i18n namespace migration and touch-target sweep, both of which touched these files incidentally).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RBAC-01 | 12-01, 12-02 | `/rbac` route + `RbacRoute` guard admin-only | SATISFIED | `rbac-route.tsx` + `router.tsx` registration confirmed |
| RBAC-02 | 12-01 | Non-admin redirected to `/home` | SATISFIED | `rbac-route.tsx` line 11: `<Navigate to="/home" replace />` |
| RBAC-03 | 12-01 | `RBACDashboard` DataTable: Name, Role, Edit Role columns | SATISFIED | Three `ColumnDef<Staff>` entries confirmed in `RBACDashboard.tsx` |
| RBAC-04 | 12-01 | Per-row Edit Role opens `EditRoleDialog` with pre-seeded staff | SATISFIED | `key={selectedStaffId ?? 'no-selection'}` + `preSelectedStaffId` prop confirmed |
| RBAC-05 | 12-01, 12-02 | `StaffDashboard` cleaned of Administration section | SATISFIED | Zero grep matches for `Administration`, `EditRoleDialog`, `editRoleOpen` in `StaffDashboard.tsx` |
| RBAC-06 | 12-02 | HomeDashboard "Roles & Permissions" tile with `manage_staff` gate | SATISFIED | ITEMS entry with `ShieldCheck`, `requiredAction: 'manage_staff'`, `managerLabel: 'Admin'` confirmed |

No REQUIREMENTS.md file found at `.planning/REQUIREMENTS.md` — requirement IDs sourced from ROADMAP.md Phase 12 section.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `RBACDashboard.tsx` | 74, 86 | `toast.message` stub buttons (Add Staff, Deactivate) | Info | Intentional stubs per plan spec — create-staff and deactivate-staff features not yet built; not blocking |

No TODO/FIXME, no `console.log`, no hardcoded empty returns in any new or modified file.

### Human Verification Required

Automated E2E (2026-08-06, see Behavioral Spot-Checks) now covers most of what this section originally deferred. What's left:

#### 1. Per-row Edit Role dialog pre-seeding (value, not just open/close)

**Test:** On `/rbac` as admin, click "Edit Role" on a non-self staff row
**Expected:** `EditRoleDialog` opens with that staff member already selected in the "Staff member" dropdown (not blank)
**Why human:** T-RBAC-page confirms the dialog opens on click; it does not assert the dropdown's selected value, so the `key`-based remount + `useState(preSelectedStaffId ?? '')` seeding still needs a visual confirm (no unit test covers this either — stubs are `it.todo`)

#### 2. HomeDashboard tile click-through

**Test:** Log in as admin, go to `/home`, click the "Roles & Permissions" tile
**Expected:** Navigates to `/rbac`
**Why human:** T14 confirms the tile is visible with the right label; it does not click it to confirm the navigation

#### 3. Non-admin tile gating via ManagerPinDialog

**Test:** Log in as bartender, go to `/home`
**Expected:** "Roles & Permissions" tile is visible but shows a lock icon and "Admin" badge; clicking it opens ManagerPinDialog rather than navigating directly
**Why human:** No E2E test exercises this interaction; interaction-dependent

**Resolved by automated E2E, no longer blocking:**
- Admin page access + DataTable rendering with live data — T-RBAC-page
- Manager redirect to /home — T12
- Bartender redirect to /home — T-RBAC-redirect
- HomeDashboard tile visibility for admin — T14
- Redirect timing: functionally confirmed (URL changes immediately in both cases); the sub-visual "no flash of RBAC content" nuance remains formally unautomated but is low-risk given the route guard renders before the protected content mounts (code-verified above) — optional spot-check, not blocking

### Gaps Summary

No code-level gaps found, then or now. All 7 observable truths are VERIFIED. All artifacts exist, are substantive, and are wired correctly. All 6 requirement IDs are satisfied. The `preSelectedStaffId` implementation correctly uses the key-based remount pattern (documented deviation from plan's `useEffect` approach, justified by `react-hooks/set-state-in-effect` lint constraint). Commit history (501c036, 3ce2029, 5c97c9a, 8051884, 5fdba18, a8b1332) corroborates all claimed changes.

Status stays `human_needed` — but narrower than the original pass. The 2026-08-06 re-verification ran the 4 E2E tests live (see Behavioral Spot-Checks) and all passed, resolving 4 of the original 5 human-verification items (page load, both redirects, tile visibility). What remains is genuinely interaction/visual-only: the Edit Role dialog's pre-seeded *value* (dialog-opens is now automated, dropdown-content is not), the tile's click-through navigation, and the bartender lock+PIN tile-gating flow (see Human Verification Required). No `--gaps` gap-closure plan was created for this phase — there is no code defect to write a task against.

---

_Verified: 2026-04-28_
_Re-verified: 2026-08-06 — live E2E run (4/4 passed), no regressions; see Behavioral Spot-Checks_
_Verifier: Claude (gsd-verifier)_
