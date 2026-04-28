---
plan: "03"
phase: 13-scopes-full-rbac-from-scratch
status: complete
completed: 2026-04-28
commits:
  - 5087d42
  - a60815a
requirements:
  - RBAC13-02
  - RBAC13-08
---

# Plan 13-03 Summary

`entities/rbac/` FSD slice — RolePermission Zod schema in `domain.ts`, plus a `useRolePermissions` TanStack Query hook that returns `Map<StaffRole, Set<StaffAction>>` for O(1) cell lookup in the upcoming PermissionMatrix grid.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | RolePermissionSchema + RolePermissionCreateSchema in `domain.ts`; `entities/rbac/` scaffold (types.ts, model/index.ts, index.ts) | done | 5087d42 |
| 2 | `useRolePermissions` hook + 3 Vitest unit tests (Map shape, empty DB, supabase error) | done | a60815a |

## Files created / modified

- `bar-pos/src/shared/lib/domain.ts` — added RolePermissionSchema + RolePermissionCreateSchema (Phase 13 block, immediately after UserRoleSchema)
- `bar-pos/src/entities/rbac/model/types.ts` — re-exports RolePermissionSchema/RolePermissionCreateSchema and types from domain (staff/ analog)
- `bar-pos/src/entities/rbac/model/queries.ts` — `rbacKeys` factory + `useRolePermissions` hook returning `Result<Map<StaffRole, Set<StaffAction>>>`; `staleTime: 30s`; pre-regen `supabase as any` cast (file-level eslint-disable)
- `bar-pos/src/entities/rbac/model/queries.test.ts` — 3 tests: map shape with mock rows, empty Map for empty DB, `SUPABASE_ERROR` propagation
- `bar-pos/src/entities/rbac/model/index.ts` — model barrel
- `bar-pos/src/entities/rbac/index.ts` — explicit named export barrel (no `export *` per project lint rule)

## Verification

- `node node_modules/typescript/bin/tsc --noEmit` — PASS (0 errors)
- `node node_modules/eslint/bin/eslint.js src/shared/lib/domain.ts src/entities/rbac/` — PASS (0 errors / 0 warnings; only pre-existing repo-wide boundaries-plugin legacy-selector warning unrelated to these files)
- `npx vitest run src/entities/rbac/model/queries.test.ts` — 3/3 tests pass

## Deviations from plan

1. **[Rule 1 — Bug] noUncheckedIndexedAccess Map fix.** Plan 03 sample code used `if (!map.has(role)) map.set(role, new Set()); map.get(role)!.add(action);` — non-null assertion forbidden by repo lint config. Replaced with explicit `let bucket = map.get(role); if (bucket === undefined) { bucket = new Set(); map.set(role, bucket); } bucket.add(action);` to satisfy `noUncheckedIndexedAccess`.

2. **[Rule 2 — Convention] `index.ts` uses explicit named exports.** Plan 03 sample said `export * from './model'`, but ESLint `no-restricted-syntax` rule blocks `export *` (decision recorded in STATE for `entities/combo/`, Phase 02-03). Wrote explicit named exports of `RolePermissionSchema`, `RolePermissionCreateSchema`, `rbacKeys`, `useRolePermissions` and types.

3. **[Rule 1 — Bug] Test wrapper anonymous component.** RTL `renderHook` `wrapper` arrow component triggered `react/display-name`. Hoisted to a named `Wrapper` const with `displayName = 'TestQueryClientProvider'`.

4. **[Rule 1 — Bug] `expect()` inside arrow `waitFor` callback.** ESLint `@typescript-eslint/no-confusing-void-expression` rejects `() => expect(...)`. Wrapped each in a block body.

5. **[Rule 1 — Bug] Removed unused `no-unsafe-return` from queries.ts file-level disable.** Lint warning surfaced; left only the four directives that are actually triggered by `db = supabase as any`.

## Threat flags

None — plan threat register stands (T-13-09 accept, T-13-10 accept).

## Self-Check: PASSED

- `bar-pos/src/entities/rbac/index.ts` — FOUND
- `bar-pos/src/entities/rbac/model/types.ts` — FOUND
- `bar-pos/src/entities/rbac/model/index.ts` — FOUND
- `bar-pos/src/entities/rbac/model/queries.ts` — FOUND
- `bar-pos/src/entities/rbac/model/queries.test.ts` — FOUND
- domain.ts RolePermissionSchema — FOUND
- Commits 5087d42, a60815a — FOUND in `git log`
