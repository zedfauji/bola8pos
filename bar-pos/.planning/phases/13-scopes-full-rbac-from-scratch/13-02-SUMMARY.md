---
plan: "02"
phase: 13-scopes-full-rbac-from-scratch
status: complete
completed: 2026-04-28
commits:
  - d4411a3
---

# Plan 13-02 Summary

## What was built

Phase 13 migrations applied to remote Supabase DB (`shsrhxleopmovzpzqmex`) and `role_permissions` Row/Insert/Update type block transcribed into `bar-pos/src/shared/lib/supabase.types.ts`.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | `supabase db push` of 20260510000001 + 20260510000002 | ✓ done (with workarounds — see Deviations) |
| 2 | Transcribe `role_permissions` type into `supabase.types.ts` | ✓ done |

## Deviations from plan

### Migration 1 (`20260510000001_rls_rewrite_phase13.sql`)
Two DROP-target tables don't exist on the live DB:
- `inventory_log` — renamed to `stock_movements` in earlier migration
- `receipt_settings` — never created in this environment

Fix applied: BLOCK 1 (147 explicit DROP statements) was replaced with a single dynamic loop iterating `pg_policies` for `schemaname = 'public'`. Original DROP list preserved as a multi-line `/* ... */` comment for documentation. Additionally, the CREATE POLICY block for `receipt_settings` is wrapped in a `DO $rs$ ... IF EXISTS(information_schema.tables) ... END $rs$` guard.

### Migration 2 (`20260510000002_rpc_role_guards.sql`)
`supabase db push` (CLI v2.90.0) rejects this file with `ERROR: cannot insert multiple commands into a prepared statement (SQLSTATE 42601)` even when reduced to a verbatim copy of a known-good baseline migration. Verified with multiple variants (BEGIN/COMMIT wrapper, tagged dollar quotes `$func$`, single-function file). Root cause appears to be a CLI splitter regression on this specific environment.

Workaround: applied each of the 4 functions individually via Supabase Management API (`mcp__claude_ai_Supabase__apply_migration`):
- `process_payment_atomic` — guarded via `p_staff_id` lookup (NOT `auth.uid()` — service_role context)
- `process_refund` — `get_user_role() NOT IN ('manager', 'admin')`
- `deplete_for_order_item` (v2) — kitchen block at BEGIN entry
- `add_combo_to_tab` — kitchen block at BEGIN entry

`schema_migrations` row for `20260510000002` was backfilled via INSERT to align CLI tracking with the canonical file. The single consolidated file in `supabase/migrations/` is the source of truth.

## Verification

```sql
SELECT role, COUNT(*) FROM role_permissions GROUP BY role ORDER BY role;
-- bartender: 9, manager: 17, admin: 22, kitchen: 4 (= 52 total) ✓
```

`supabase migration list` shows both 001 and 002 with matching local + remote columns.

`npm run typecheck` (via `node node_modules/typescript/bin/tsc --noEmit`) → PASS, 0 errors.

## Key files

### Modified
- `bar-pos/supabase/migrations/20260510000001_rls_rewrite_phase13.sql` — dynamic DROP loop + receipt_settings guard
- `bar-pos/supabase/migrations/20260510000002_rpc_role_guards.sql` — consolidated single-file canonical artifact (4 functions)
- `bar-pos/src/shared/lib/supabase.types.ts` — `role_permissions` block inserted alphabetically between `refunds` and `settings`

## Acceptance criteria

- [x] `role_permissions` table type block exists in `supabase.types.ts` with Row/Insert/Update/Relationships
- [x] `Insert.role` is required (no `?:`) — `exactOptionalPropertyTypes` compliant
- [x] `npm run typecheck` passes
- [x] DB has 52 role_permissions rows
- [x] All 4 patched RPCs live on remote DB

## Self-Check: PASSED

## Next plan

`13-03-PLAN.md` — entities/rbac/ FSD slice (RolePermissionSchema in domain.ts, useRolePermissions hook, queries.test.ts).
