---
plan: "05"
phase: 13-scopes-full-rbac-from-scratch
status: complete
completed: 2026-04-28
commits:
  - bcc8536
  - f61501a
requirements:
  - RBAC13-07
  - RBAC13-08
---

# Plan 13-05 Summary

`PermissionMatrix` widget (22-action × 4-role Switch grid backed by `role_permissions`) composed into the existing `RBACDashboard`. Admin can toggle any cell; non-admin sees the matrix in read-only state.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | shadcn Switch primitive + PermissionMatrix.tsx + 4 unit tests | done | bcc8536 |
| 2 | Extend RBACDashboard.tsx — two-panel layout (Staff Roles + Permission Matrix) | done | f61501a |

## Files created

- `bar-pos/src/shared/ui/switch.tsx` — Radix `Switch.Root` + `Switch.Thumb`, project-style classes (mirrors `checkbox.tsx`). Built directly from `radix-ui` umbrella import (the `radix-ui` package and `@radix-ui/react-switch` were already in `node_modules`, so no new dependency was added).
- `bar-pos/src/widgets/RBACDashboard/PermissionMatrix.tsx` — 22×4 matrix:
  - column header loop `STAFF_ROLES.map(...)` (Bartender / Manager / Admin / Kitchen)
  - row loop `STAFF_ACTIONS.map(...)` (22 actions, action label in mono, one Switch per (action,role))
  - `permMap.get(role)?.has(action) ?? false` for null-safe lookup (`noUncheckedIndexedAccess`-compliant)
  - `disabled={!isAdmin || mutation.isPending}` for admin gate + concurrent-toggle guard
  - toggle handler awaits `mutation.mutateAsync`; on `result.ok=false` logs + toasts error, else success toast with role/action description
- `bar-pos/src/widgets/RBACDashboard/PermissionMatrix.test.tsx` — 4 RTL tests: 22 action-text rows, 4 role headers, 88 switches total, switches enabled for admin user (mocks `useRolePermissions`, `useStaffStore`, `useMutationTogglePermission`, `sonner`, `logger-instance`).

## Files modified

- `bar-pos/src/shared/ui/index.ts` — added `export { Switch } from './switch';`
- `bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx` — wrapped existing content in a "Staff Roles" labelled panel (Phase 12 logic untouched) and added a second "Permission Matrix" panel below; outer wrapper switched from `space-y-6` to `space-y-8`.

## Verification

- typecheck — PASS (0 errors)
- ESLint on plan files — PASS (0 errors / 0 warnings)
- Combined Phase 13 widget+entity+feature unit tests: 10 pass / 6 todo (3 rbac queries, 3 toggle-permission, 4 PermissionMatrix)

## Deviations from plan

1. **[Rule 3 — Tooling] shadcn CLI bypass.** `npx shadcn@latest add switch` is non-deterministic on this Windows shell environment (and the project pattern calls for files to live in `src/shared/ui/`, not the CLI default `src/app/components/ui/`). Wrote `switch.tsx` directly using the `radix-ui` umbrella import that the project already uses for `checkbox.tsx` and other primitives — same visual contract as a shadcn-generated file.
2. **[Rule 1 — Bug] Import order.** ESLint `import/order` enforces `@features/*` before `@entities/*` in widgets (FSD layer hierarchy is logical, not alphabetical). Reordered imports in `PermissionMatrix.tsx` accordingly.
3. **[Rule 2 — Type safety] Replaced `permResult?.ok ? permResult.data : new Map()` with explicit `permResult && permResult.ok ? ...`** so TS narrowing works without optional chaining on the discriminator.

## Threat flags

None — plan threat register stands (T-13-13 mitigate via `disabled={!isAdmin}` + DB RLS, T-13-14 accept; `mutation.isPending` short-circuits double-clicks).

## Self-Check: PASSED

- `bar-pos/src/shared/ui/switch.tsx` — FOUND
- `bar-pos/src/widgets/RBACDashboard/PermissionMatrix.tsx` — FOUND
- `bar-pos/src/widgets/RBACDashboard/PermissionMatrix.test.tsx` — FOUND
- `bar-pos/src/widgets/RBACDashboard/RBACDashboard.tsx` — modified (PermissionMatrix imported and rendered)
- Commits bcc8536, f61501a — FOUND in `git log`
