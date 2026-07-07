---
phase: 17-modifier-inventory-rules
plan: 03
subsystem: database
tags: [supabase, postgres, migrations, rls, plpgsql, types]

# Dependency graph
requires:
  - phase: 17-modifier-inventory-rules (plan 02)
    provides: authored SQL migrations for modifier_inventory_rules table + deplete_for_order_item v3 RPC
provides:
  - Live modifier_inventory_rules table + RLS policies in remote Supabase
  - Live deplete_for_order_item v3 RPC (recipe loop + new modifier loop, kitchen guard preserved)
  - modifier_inventory_rules Row/Insert/Update/Relationships shape in supabase.types.ts
affects: [17-04 (entity queries + integration test), 17-05 (admin UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual supabase.types.ts transcription (Docker/supabase gen types unavailable) — recipe_items block used as template"

key-files:
  created: []
  modified:
    - src/shared/lib/supabase.types.ts

key-decisions:
  - "modifier_inventory_rules type block inserted alphabetically between modifier_groups and modifiers (matches file's existing sort order)"
  - "Both migrations applied via a single npx supabase db push — the CLI multi-statement splitter did not reject the function migration this time (no workaround needed)"

patterns-established:
  - "supabase db query --linked -o table/json used for live verification queries (to_regclass, pg_get_functiondef, pg_policies) instead of psql or MCP tools"

requirements-completed: [SC-1, SC-2]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 17 Plan 03: Apply Modifier-Inventory Migrations Summary

**Both Phase-17 migrations (modifier_inventory_rules table + deplete_for_order_item v3) applied to live remote Supabase; supabase.types.ts extended with the new table's typed shape.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-07 (session start)
- **Completed:** 2026-07-07T18:45:50Z
- **Tasks:** 2 (1 auto + 1 blocking checkpoint)
- **Files modified:** 1 (+ 1 deferred-items.md doc)

## Accomplishments
- `modifier_inventory_rules` table (id, modifier_id, ingredient_id, delta) + both RLS policies live in remote Supabase, confirmed via `to_regclass` and `pg_policies` queries
- `deplete_for_order_item` v3 live — `pg_get_functiondef` confirms the new modifier-driven depletion loop (`order_item_modifier` ref_type) and the preserved kitchen role guard are both present in the live function body
- `supabase.types.ts` extended with a `modifier_inventory_rules` Row/Insert/Update/Relationships block (two FKs: `modifier_id` → `modifiers.id`, `ingredient_id` → `ingredients.id`), unblocking 17-04's entity queries from needing an `as any` cast

## Task Commits

Each task was committed atomically:

1. **Task 1: Transcribe modifier_inventory_rules shape into supabase.types.ts** - `64a19d1` (feat)
2. **Task 2: [BLOCKING] Apply Phase-17 migrations to remote Supabase** - no code commit (DB-only migration apply + human-verify checkpoint; approved by orchestrator)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/shared/lib/supabase.types.ts` - Added `modifier_inventory_rules` table type block (Row/Insert/Update/Relationships)
- `.planning/phases/17-modifier-inventory-rules/deferred-items.md` - Logged 2 pre-existing, out-of-scope typecheck errors discovered while running this task's verification gate

## Decisions Made
- Inserted the new type block alphabetically between `modifier_groups` and `modifiers` to match the file's existing sort order (recipe_items block used as the structural template per plan instruction)
- Ran `npm ci` before typecheck since `node_modules` was empty at session start (environment setup, not a plan deviation)
- Both migrations pushed in a single `npx supabase db push` — the CLI multi-statement splitter issue flagged as a possible risk in the plan did not occur; no fallback to Management API / MCP `apply_migration` was needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `npm ci` to populate empty `node_modules`**
- **Found during:** Task 1 (typecheck verification step)
- **Issue:** `node_modules` was empty (0 packages) at session start; `tsc`/`eslint` were unresolvable via npx
- **Fix:** Ran `npm ci` (1240 packages installed, package-lock.json unchanged)
- **Files modified:** None (node_modules is gitignored)
- **Verification:** `npx tsc --noEmit` resolved and ran successfully afterward
- **Committed in:** N/A (tooling setup, no file changes to commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/tooling)
**Impact on plan:** No scope creep — required to run the plan's own verification commands.

## Issues Encountered

`npm run typecheck` surfaced 2 pre-existing TypeScript errors unrelated to this plan's changes:
- `src/entities/tab/model/queries.ts(778,11)` — `number | null` not assignable to `number | undefined` (last touched Phase 14, commit `9929c41`)
- `src/shared/lib/agent/rag.ts(60,7)` — `number[]` not assignable to `string` (last touched Phase 15, commits `3737c72`/`48f43e7`)

Both are outside this plan's `<files>` scope (`src/shared/lib/supabase.types.ts` only) and predate this plan per `git log`. Logged to `.planning/phases/17-modifier-inventory-rules/deferred-items.md`, not fixed (out-of-scope per executor scope-boundary rule). The `modifier_inventory_rules` block itself introduced zero typecheck errors.

## User Setup Required

None - no external service configuration required. Migration apply was performed by the executor via `npx supabase db push` against the already-linked remote project (`shsrhxleopmovzpzqmex`); orchestrator/human approval was given for the checkpoint after reviewing the 4 verification query outputs (table live, RLS policies present, v3 function body contains `order_item_modifier` + kitchen guard).

## Next Phase Readiness

- `modifier_inventory_rules` table + RLS and `deplete_for_order_item` v3 are live in remote Supabase — 17-04 (entity queries + integration test) and 17-05 (admin UI) can now build against real data without any `as any` workaround for `modifier_inventory_rules` reads/writes
- No blockers identified

---
*Phase: 17-modifier-inventory-rules*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/shared/lib/supabase.types.ts
- FOUND: .planning/phases/17-modifier-inventory-rules/deferred-items.md
- FOUND: .planning/phases/17-modifier-inventory-rules/17-03-SUMMARY.md
- FOUND: commit 64a19d1 (confirmed via `git cat-file -t 64a19d1` — `git log --all` failed on an unrelated stale ref `refs/heads/worktree-agent-a2b390553ea68f417`, not this commit)
