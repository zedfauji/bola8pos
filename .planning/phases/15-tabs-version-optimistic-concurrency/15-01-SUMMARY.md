---
phase: 15-tabs-version-optimistic-concurrency
plan: 01
subsystem: data-layer
tags: [migration, optimistic-concurrency, error-handling, sqlstate]
dependency_graph:
  requires: []
  provides:
    - "version columns on tabs/pool_sessions/caja_sessions"
    - "bump_version_on_update trigger (P0V01 backstop)"
    - "STALE_VERSION + NOT_FOUND_VERSIONED AppErrorCode members"
    - "parseSupabaseError P0V01/P0V02 mapping"
  affects:
    - "all 11 conflict-prone mutation paths (Group A RPCs + Group B hooks) — landed in subsequent waves"
tech_stack:
  added: []
  patterns:
    - "Custom SQLSTATE P0Vxx range for version-conflict family"
    - "BEFORE UPDATE FOR EACH ROW trigger — universal +1 advancement guard"
key_files:
  created:
    - bar-pos/supabase/migrations/20260512000001_versioned_rows.sql
    - .planning/phases/15-tabs-version-optimistic-concurrency/15-01-SUMMARY.md
  modified:
    - bar-pos/src/shared/lib/result.ts
decisions:
  - "Custom SQLSTATE P0V01/P0V02 over reusing 40001 (would mask real serialization errors) — D-18"
  - "Trigger guard rejects any UPDATE not advancing version by exactly +1 — universal backstop for both Group A RPC and Group B hook patterns — D-02"
  - "Migration not pushed in this plan — push deferred to BLOCKING plan 15-05"
metrics:
  duration: "~5min"
  completed: "2026-04-28"
  tasks: 2
  files: 2
---

# Phase 15 Plan 01: Versioned Rows Foundation Summary

Foundational layer for optimistic concurrency: ships migration adding `version int not null default 1` plus `bump_version_on_update` trigger to `tabs`, `pool_sessions`, `caja_sessions`, and extends `result.ts` with `STALE_VERSION` + `NOT_FOUND_VERSIONED` error codes and SQLSTATE P0V01/P0V02 mapping.

## What Shipped

### Task 1 — Migration `20260512000001_versioned_rows.sql`
- `alter table ... add column if not exists version int not null default 1` on `public.tabs`, `public.pool_sessions`, `public.caja_sessions`
- `public.bump_version_on_update()` `language plpgsql` function — raises `STALE_VERSION` with `errcode = 'P0V01'` if `new.version is distinct from (old.version + 1)`
- Three `before update for each row execute function` triggers: `trg_tabs_version`, `trg_pool_sessions_version`, `trg_caja_sessions_version`
- DOWN block included in trailing comments (Phase 8 standard)
- **Not pushed** — push deferred to plan 15-05 (BLOCKING)
- Commit: `45e110d`

### Task 2 — `result.ts` extensions
- Added `'STALE_VERSION'` and `'NOT_FOUND_VERSIONED'` to `AppErrorCode` union (before `'UNKNOWN_ERROR'`)
- Exported `staleVersionError(raw?)` factory — message `"Updated by another terminal — please retry"` (single em-dash, no period)
- Exported `notFoundVersionedError(raw?)` factory — message `"Record was deleted by another terminal."` (period; user-approved 2026-04-28)
- Extended `parseSupabaseError` with SQLSTATE branches: `P0V01 -> staleVersionError(error)`, `P0V02 -> notFoundVersionedError(error)`
- Commit: `3e1d29b`

## Verification

- `grep -c "version int not null default 1" 20260512000001_versioned_rows.sql` → 3 (expected 3)
- `grep "errcode = 'P0V01'"` → matches
- `grep -c "trg_tabs_version|trg_pool_sessions_version|trg_caja_sessions_version"` → 9 (3 drop-if-exists + 3 create + 3 references)
- `grep -c "STALE_VERSION|NOT_FOUND_VERSIONED|P0V01|P0V02" src/shared/lib/result.ts` → 8 hits across union, factories, mapping branches
- `cd bar-pos && npm run typecheck` → exit 0
- `npx eslint src/shared/lib/result.ts` → no errors (only pre-existing config warnings)

## Deviations from Plan

None — plan executed exactly as written. Per-task commit picked up unrelated MM-state planning files (`STATE.md`, `ROADMAP.md`) that were already modified pre-execution; this is incidental and matches the GSD final-commit pattern that bundles state updates.

## Threat Model Compliance

All STRIDE mitigations from the plan's `<threat_model>` are implemented:

| Threat | Mitigation Status |
|--------|-------------------|
| T-15-01-01 (Tampering — direct UPDATE bypass) | trigger guards `new.version is distinct from (old.version + 1)` — P0V01 raised |
| T-15-01-02 (Repudiation) | accepted (audit logging is plan 15-03 scope) |
| T-15-01-03 (DoS) | accepted (single-statement BEFORE trigger, O(1)) |
| T-15-01-04 (Info Disclosure) | toast copy is generic, no row id / terminal id leak |
| T-15-01-05 (Privilege Elevation) | function is plain `language plpgsql` — no SECURITY DEFINER, runs as caller |

## Required Note

> NOT_FOUND_VERSIONED toast copy `"Record was deleted by another terminal."` user-approved 2026-04-28. Trigger pattern unchanged. Plan 15-01 unaffected by Group A/B revision (purely foundational — version columns + trigger + AppErrorCode union still required by both groups).

## Self-Check: PASSED

- FOUND: bar-pos/supabase/migrations/20260512000001_versioned_rows.sql
- FOUND: bar-pos/src/shared/lib/result.ts (modified)
- FOUND: commit 45e110d (Task 1 migration)
- FOUND: commit 3e1d29b (Task 2 result.ts)
