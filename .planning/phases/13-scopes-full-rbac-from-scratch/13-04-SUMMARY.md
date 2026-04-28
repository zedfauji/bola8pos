---
plan: "04"
phase: 13-scopes-full-rbac-from-scratch
status: complete
completed: 2026-04-28
commits:
  - eebc92d
requirements:
  - RBAC13-07
---

# Plan 13-04 Summary

`features/toggle-permission/` — `useMutationTogglePermission` hook handles both INSERT (enable) and DELETE (disable) on `role_permissions`. Invalidates `rbacKeys.list()` on success so the PermissionMatrix grid re-fetches.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | useMutationTogglePermission + barrel + 3 unit tests | done | eebc92d |

## Files created

- `bar-pos/src/features/toggle-permission/useMutationTogglePermission.ts` — TanStack Query mutation. Input `{ role, action, enabled }` (all required). enabled=true → `INSERT { role, action } ... .select().single()`; enabled=false → `DELETE ... .eq('role',X).eq('action',Y)`. Returns `Result<null>`. onSuccess → `invalidateQueries({ queryKey: rbacKeys.list() })`.
- `bar-pos/src/features/toggle-permission/useMutationTogglePermission.test.ts` — 3 Vitest tests:
  1. `enable` path INSERTs and resolves `ok(null)`
  2. `disable` path DELETEs with both `eq()` calls and resolves `ok(null)`
  3. INSERT error → `err({ code: 'SUPABASE_ERROR', message })`
- `bar-pos/src/features/toggle-permission/index.ts` — explicit named-export barrel.

## Verification

- typecheck — PASS (0 errors)
- ESLint on `src/features/toggle-permission/` — PASS (0 errors / 0 warnings)
- `vitest run src/features/toggle-permission/useMutationTogglePermission.test.ts` — 3/3 pass

## Deviations from plan

1. **[Rule 1 — Bug] Test file rewritten to test the actual hook.** Plan 04's draft test exercised the supabase mock directly without invoking the hook. I rewrote with `renderHook + mutateAsync` so behaviour (return shape, error mapping, both paths) is asserted against `useMutationTogglePermission` itself.
2. **[Rule 1 — Convention] Replaced `if (enabled) {...} else {...}` with early-return after the enable path** to satisfy `consistent-return` style and reduce nesting (no behaviour change).
3. **[Rule 2 — Type contract] Extracted `TogglePermissionInput` interface** and re-exported it. The PermissionMatrix in Plan 05 uses this so the cell `onCheckedChange` callback is typed.

## Threat flags

None — plan threat register stands (T-13-11 mitigate via DB RLS + UI gate, T-13-12 accept).

## Self-Check: PASSED

- `bar-pos/src/features/toggle-permission/useMutationTogglePermission.ts` — FOUND
- `bar-pos/src/features/toggle-permission/useMutationTogglePermission.test.ts` — FOUND
- `bar-pos/src/features/toggle-permission/index.ts` — FOUND
- Commit eebc92d — FOUND in `git log`
