---
created: 2026-07-25T20:46:23.076Z
title: Fix 2 pre-existing tsc errors blocking tauri build CI job
area: tooling
severity: major
files:
  - src/entities/tab/model/queries.ts:791
  - src/shared/lib/agent/rag.ts:60
resolved: 2026-07-28
resolved_in: "Phase 26 Plan 02 (floating-tables-is-temp)"
---

## Problem

`npx tsc --noEmit` currently fails with 2 pre-existing errors, unrelated to and predating the Ubuntu dev-environment migration (Phase 36):

1. `src/entities/tab/model/queries.ts:791` — `Type 'number | null' is not assignable to type 'number | undefined'`
2. `src/shared/lib/agent/rag.ts:60` — `Type 'number[]' is not assignable to type 'string'`

This blocks `npm run build`, which blocks `npm run tauri build`, which blocks the new `tauri-build` CI job added in Phase 36 plan 36-03 (and the existing `quality` job) from ever going green.

Found and dispositioned during Phase 36 (migrate-development-environment-from-windows-to-ubuntu), plan 36-04, Task 2 checkpoint decision (option-b: backlog todos).

## Solution

Fix both type errors at their source (respect `exactOptionalPropertyTypes: true` per CLAUDE.md — e.g. `prop: number | undefined` not `prop?: number`; do not silence with `as any` or `// @ts-ignore`). This is a prerequisite for the "activate inert git hooks" todo (husky can't be safely activated while `tsc` is red — every commit would fail) and for the "relocate GitHub workflows" todo (the relocated `ci.yml`'s `quality`/`tauri-build` jobs need `tsc` to pass to go green).

## Resolution

Both fixed opportunistically while Phase 26 Plan 02 (`entities/pool-table` → `entities/resource` rename sweep) was already driving `npm run typecheck` to zero as its own exit gate and had already touched the first file for an unrelated reason:

1. `entities/tab/model/queries.ts:791` — the `close_tab` RPC call was passing `p_expected_version: expected ?? null`, but the generated arg type is `p_expected_version?: number` (optional-key, not nullable). Fixed by conditionally spreading the key (`...(expected !== undefined ? { p_expected_version: expected } : {})`), the same pattern already used elsewhere in this codebase (e.g. `useMutationStopSession`'s `p_expected_version` handling) for RPC args under `exactOptionalPropertyTypes: true`.
2. `shared/lib/agent/rag.ts:60` — `match_codebase_chunks`'s generated arg type declares `query_embedding: string` (PostgREST serializes the Postgres `vector` column as its literal text form), but the call site passed the raw `number[]` embedding. Fixed with `JSON.stringify(embedding)`, producing the `"[0.1,0.2,...]"` literal form pgvector expects.

`npm run typecheck` is green after both fixes; no `as any`/`@ts-ignore` used.
