---
phase: 13-scopes-full-rbac-from-scratch
plan: 01
subsystem: auth
tags: [postgres, rls, security-definer, rbac]

# Dependency graph
requires:
  - phase: 12-full-rbac-page-remove-the-breadcrumbs-of-rbac-from-other-pag
    provides: /rbac admin-only management page (frontend RBAC editing UI)
provides:
  - role_permissions table (52-row seed matching rbac.ts ROLE_SET exactly)
  - 156 rewritten RLS policies using canonical get_user_role() + EXISTS(role_permissions) pattern
  - role guards on 4 SECURITY DEFINER RPCs (process_payment_atomic, process_refund, deplete_for_order_item v2, add_combo_to_tab)
affects: [13-02, 13-03, 13-04, 13-05, 13-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "get_user_role() + EXISTS(role_permissions) is the canonical RLS pattern — replaces broken auth.jwt() ->> 'role' and profile-table EXISTS checks"
    - "SECURITY DEFINER RPCs called via service_role edge functions must resolve caller role via p_staff_id lookup, not auth.uid() (uid() is NULL under service_role)"

key-files:
  created:
    - supabase/migrations/20260510000001_rls_rewrite_phase13.sql
    - supabase/migrations/20260510000002_rpc_role_guards.sql
  modified: []

key-decisions:
  - "Two separate migration files (RLS rewrite vs RPC guards) is intentional per RESEARCH.md Section 8 — not a D-03 single-migration violation, since D-03 applies to the RLS rewrite only"
  - "rappi_orders scoped to bartender+, replacing a broken tenant_id check (Risk 7)"
  - "audit_log INSERT remains WITH CHECK (true) — writes only ever happen via SECURITY DEFINER RPCs, so no additional caller-role gate needed there"

patterns-established:
  - "Role guard pattern: get_user_role() IS NULL OR get_user_role() = 'kitchen' block at RPC BEGIN for kitchen-forbidden mutations"

requirements-completed:
  - RBAC13-01
  - RBAC13-02

# Metrics
duration: unknown (backfilled from commit history)
completed: 2026-04-28
---

# Phase 13: Full RBAC From Scratch Summary (Plan 13-01)

**DB-level RBAC from scratch: role_permissions table (52-row seed) + 156 rewritten RLS policies + role guards on 4 SECURITY DEFINER RPCs**

## Performance

- **Duration:** unknown — SUMMARY.md backfilled retroactively; work was completed and committed 2026-04-27/28 but no summary was written at the time
- **Started:** 2026-04-27 (per commit timestamps)
- **Completed:** 2026-04-27T23:30:10-06:00
- **Tasks:** 2
- **Files modified:** 2 (both new migration files)

## Accomplishments
- Dropped all pre-existing RLS policies across 12 prior migrations (147 drops) and replaced with 156 policies on the canonical `get_user_role() + EXISTS(role_permissions)` pattern
- Created `role_permissions` table with a `user_role` enum and `UNIQUE(role, action)`, seeded with 52 rows matching `rbac.ts`'s `ROLE_SET` exactly (bartender=9, manager=17, admin=22, kitchen=4)
- Added role guards to 4 SECURITY DEFINER RPCs: `process_payment_atomic` (via `p_staff_id` lookup, since `auth.uid()` is NULL when called through the service_role edge function), `process_refund` (replaced a broken SELECT+WHERE role check with the canonical guard), `deplete_for_order_item` v2 and `add_combo_to_tab` (both block the kitchen role at RPC entry)

## Task Commits

1. **Task 1: RLS full rewrite migration** — `98fa463` (feat)
2. **Task 2: RPC role guards** — `8cfd6c5` (feat)

## Files Created/Modified
- `supabase/migrations/20260510000001_rls_rewrite_phase13.sql` — role_permissions table + 52-row seed + 156 policies
- `supabase/migrations/20260510000002_rpc_role_guards.sql` — role guards on process_payment_atomic, process_refund, deplete_for_order_item, add_combo_to_tab

## Decisions Made
- Two migration files instead of one — RESEARCH.md Section 8 recommended separating the RLS rewrite from RPC guards; the plan's D-03 (single migration file) constraint was scoped to only apply to the RLS rewrite
- `rappi_orders` scoped to bartender+, replacing a broken `tenant_id` check that didn't match the actual multi-terminal, single-tenant deployment model (Risk 7)

## Deviations from Plan
None documented — plan executed as written per commit messages.

## Issues Encountered
None documented.

## User Setup Required
None — no external service configuration required (migration push to remote handled in Plan 13-02, the [BLOCKING] step).

## Next Phase Readiness
- Migrations exist on disk and were pushed to remote in Plan 13-02 (`supabase.types.ts` manually transcribed for `role_permissions`)
- Ready for Plan 13-03's FSD type layer for the `role_permissions` domain

---
*Phase: 13-scopes-full-rbac-from-scratch*
*Completed: 2026-04-28*
*Note: This SUMMARY.md was backfilled retroactively on 2026-07-03 — the work was completed and committed on 2026-04-27/28, but no summary was written at the time. Content is reconstructed from commit messages and the plan file; no re-execution was performed.*
