---
phase: 15-tabs-version-optimistic-concurrency
plan: 05
type: summary
wave: 5
status: complete
---

# 15-05 Schema Push to Remote Supabase

## What was applied

Two migrations pushed to remote project `shsrhxleopmovzpzqmex` (bar-pos):

1. `20260512000001_versioned_rows.sql` — `version int not null default 1` + `bump_version_on_update` trigger on `tabs`, `pool_sessions`, `caja_sessions`. Applied via `supabase db push` (CLI, normal path).
2. `20260512000002_rpc_versioned_group_a.sql` — `process_payment_atomic` and `create_order_with_items` redefined with `p_expected_version int` last-positional + canonical `FOR UPDATE` guard raising `P0V01` (STALE_VERSION) / `P0V02` (NOT_FOUND_VERSIONED). Applied via Supabase MCP `apply_migration` then marked applied in CLI history.

## Verification (live remote DB)

```
version_cols   = 3   (tabs, pool_sessions, caja_sessions)
triggers       = 3   (trg_tabs_version, trg_pool_sessions_version, trg_caja_sessions_version)
rpcs_with_pev  = 2   (process_payment_atomic, create_order_with_items both expose p_expected_version integer)
```

## Migration history housekeeping (one-time, pre-existing drift)

The remote `supabase_migrations` history table contained two orphan rows (`20260428195956`, `20260428201240`) — applied via dashboard at some prior date, never committed to repo. Marked `reverted` so push could proceed. The DDL they encoded remains live; they are not in scope for Phase 15.

Phase 14 audit-log migrations (`20260511000001`, `20260511000002`) had been applied via dashboard but were unrecorded in the history table — marked `applied` so the CLI no longer attempts to re-run them (the `audit_logs_select_manager` policy already exists on remote).

## CLI parser workaround

`supabase db push` (CLI 2.90.0) failed on `20260512000002` with `SQLSTATE 42601 — cannot insert multiple commands into a prepared statement`. Same structure as the working `20260511000002_rpc_audit_wiring.sql`. Whitespace-/parser-equivalent file produced the same failure with and without explicit `BEGIN; ... COMMIT;`. Applied via Supabase MCP `apply_migration` instead (single-shot SQL exec, no extended-protocol parse), then `supabase migration repair --status applied 20260512000002` to sync local history.

## Push timestamp

2026-04-28 (single session).

## Wave 6 unblocked

Live DB now enforces version contract. E2E (`39-concurrent-edits.spec.ts`) and integration tests (`version-rpc-guard.test.ts`, `version-hook-optimistic.test.ts`) in Plan 15-06 can run against remote.
