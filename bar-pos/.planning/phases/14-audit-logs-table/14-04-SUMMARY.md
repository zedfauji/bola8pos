---
phase: 14-audit-logs-table
plan: 04
subsystem: database
tags: [supabase, postgres, security-definer, rpc, audit-log, caja, prep]

# Dependency graph
requires:
  - phase: 14-audit-logs-table (14-02)
    provides: record_audit(p_action, p_entity_type, p_entity_id, p_before, p_after, p_source, p_terminal_id, p_user_id) 8-arg RPC
provides:
  - caja_open(numeric, uuid, text) SECURITY DEFINER RPC — audits 'caja.open', enforces manager/admin gate
  - produce_prep_batch(uuid, numeric, text, uuid, text) SECURITY DEFINER RPC — audits 'prep.produce'
  - useMutationOpenCaja rewired to call caja_open RPC instead of direct table INSERT
  - useMutationCreatePrepProduction rewired to call produce_prep_batch RPC instead of direct table INSERT
affects: [14-14 (final audit-actions gate), 16-kds-bar-split, 22-edit-paid-ticket]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct client-side table INSERT -> thin SECURITY DEFINER wrapper RPC + atomic PERFORM record_audit() (Pattern 2 from 14-PATTERNS.md)"

key-files:
  created:
    - supabase/migrations/20260703000003_caja_open_prep_batch_rpcs.sql
  modified:
    - src/entities/caja/model/queries.ts
    - src/entities/prep/model/queries.ts

key-decisions:
  - "caja_open re-asserts the manager/admin role gate inside the SECURITY DEFINER function body (SELECT role FROM profiles WHERE id = auth.uid()), since SECURITY DEFINER bypasses the RLS INSERT policy that previously provided this gate for free."
  - "produce_prep_batch does not catch the AFTER INSERT trigger's PREP_INGREDIENT_REQUIRED / INGREDIENT_NOT_FOUND / INVENTORY_NEGATIVE exceptions — they propagate unchanged so the client's existing error-message mapping (queries.ts msg.includes(...) branches) keeps working verbatim."
  - "unique_violation on caja_sessions_one_open is left to raise naturally (not wrapped in EXCEPTION); the exception path is not audited since no state changed."

requirements-completed: [SC3]

# Metrics
duration: 3min
completed: 2026-07-04
---

# Phase 14 Plan 04: caja_open + produce_prep_batch RPCs Summary

**New caja_open and produce_prep_batch SECURITY DEFINER RPCs replace direct client-side table INSERTs, each atomically recording a 'caja.open'/'prep.produce' audit_logs row via record_audit; both entity mutation hooks rewired to call them.**

## Performance

- **Duration:** 3 min (task execution; excludes one-time `npm install` for the fresh worktree checkout)
- **Started:** 2026-07-04T20:14:00Z
- **Completed:** 2026-07-04T20:16:52Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `caja_open(p_opening_cash, p_opened_by, p_terminal_id)` — SECURITY DEFINER RPC that INSERTs into `caja_sessions`, re-checks the manager/admin role gate (parity with the RLS policy it bypasses), and calls `record_audit('caja.open', 'caja_session', ...)` atomically on success.
- Created `produce_prep_batch(p_prep_ingredient_id, p_qty_produced, p_notes, p_produced_by, p_terminal_id)` — SECURITY DEFINER RPC that INSERTs into `prep_productions`, letting the existing `trg_prep_production_insert` depletion trigger fire and (on success) calls `record_audit('prep.produce', 'prep_production', ...)`.
- Rewired `useMutationOpenCaja` and `useMutationCreatePrepProduction` to call the new RPCs via `db.rpc(...)` instead of `.from(table).insert(...)`, preserving all existing Result mapping, error-code branches, and query invalidations.
- `audit-actions.test.ts` per-RPC coverage assertions for `caja_open -> caja.open` and `produce_prep_batch -> prep.produce` now PASS (previously RED per the Phase 14-02 scaffold).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration — create caja_open and produce_prep_batch SECURITY DEFINER RPCs** - `b55e34b` (feat)
2. **Task 2: Rewire useMutationOpenCaja to call caja_open RPC** - `56bb9e0` (feat)
3. **Task 3: Rewire useMutationCreatePrepProduction to call produce_prep_batch RPC** - `93c8ff6` (feat)

_Note: no plan-metadata commit included per orchestrator instruction — STATE.md/ROADMAP.md are updated centrally by the orchestrator after all Phase 14 worktree agents complete._

## Files Created/Modified
- `supabase/migrations/20260703000003_caja_open_prep_batch_rpcs.sql` - Defines `caja_open` and `produce_prep_batch` SECURITY DEFINER RPCs, both wired to `record_audit`
- `src/entities/caja/model/queries.ts` - `useMutationOpenCaja` now calls `db.rpc('caja_open', {...})`
- `src/entities/prep/model/queries.ts` - `useMutationCreatePrepProduction` now calls `db.rpc('produce_prep_batch', {...})`; added module-level `TERMINAL_ID` const (matching the convention already used in `caja/model/queries.ts`)

## Decisions Made
- caja_open re-implements the manager/admin gate inline (matches the `close_caja_session` precedent) rather than relying on any RLS policy, since SECURITY DEFINER bypasses RLS entirely — this satisfies threat T-14-03 (Elevation of Privilege) from the plan's threat model.
- produce_prep_batch deliberately does NOT wrap the INSERT in an exception handler so the depletion trigger's validation errors (PREP_INGREDIENT_REQUIRED / INGREDIENT_NOT_FOUND / INVENTORY_NEGATIVE) continue to propagate to the client exactly as before.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The worktree was a fresh checkout with no `node_modules` and no `.planning/{PROJECT.md,STATE.md,config.json}` present on disk (these `.planning/` files are gitignored in this repo per `bar-pos/.gitignore` line 61 — only a small set of previously-tracked files, like prior SUMMARY.md files, remain tracked). Resolved by running `npm install`, copying `.env.local` from the main checkout, and reading `PLAN.md`/`config.json`/`PROJECT.md` directly from the main repo working tree (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.planning/...`) instead of the worktree copy. This SUMMARY.md is committed with `git add -f` (consistent with how `14-01-SUMMARY.md`/`14-02-SUMMARY.md` are already tracked in this repo despite the `.planning/` gitignore rule), since the orchestrator requires it to be committed before this agent returns.

## User Setup Required

None - no external service configuration required. Note: per the plan's `<done>` criteria, the new migration has NOT been pushed to Supabase Cloud yet — that is deferred to Phase 14-14 (final migration push/verification gate) per project convention for this phase.

## Next Phase Readiness
- `caja_open` and `produce_prep_batch` are ready for the 14-14 final audit-actions gate; their coverage assertions are green.
- Remaining `TARGET_RPCS` scaffold entries (`transfer_tab`, `record_stock_movement`, `close_tab`, `force_pin_change`) are out of scope for this plan and remain RED, to be resolved by their respective Wave-2/Wave-3 plans (14-05..14-09) per the existing scaffold comment in `audit-actions.test.ts`.
- No blockers for downstream phases (16, 17, 22, 23, 24, 27) that depend on Phase 14 completing.

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
