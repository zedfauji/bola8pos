---
phase: 14-audit-logs-table
plan: 03
subsystem: database
tags: [supabase, postgres, audit, rpc, tab-transfer, inventory]

requires: ["14-02"]
provides:
  - "transfer_tab(uuid, uuid, uuid, int, text, text, text) — audits 'tab.transfer' with before/after tab JSON + terminal_id"
  - "record_stock_movement(uuid, numeric, text, text, uuid, text, text) — audits 'inventory.manual_adjust' with after row + terminal_id"
  - "TERMINAL_ID module constant pattern applied to useTransferTab.ts and AdjustStockMovementDialog.tsx"
affects: [14-14]

tech-stack:
  added: []
  patterns:
    - "PERFORM record_audit(...) immediately before success-path RETURN, never inside a validation-error/RAISE branch — reused verbatim from 20260511000002_rpc_audit_wiring.sql"
    - "DROP FUNCTION IF EXISTS <old-signature> before CREATE OR REPLACE with a new trailing DEFAULT NULL param, to avoid PGRST203 overload ambiguity"

key-files:
  created:
    - supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql
  modified:
    - src/features/transfer-tab/useTransferTab.ts
    - src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx

key-decisions:
  - "transfer_tab's before/after audit snapshot captures the full `tabs` row (not just changed staff_id/table_number) via SELECT to_jsonb(t) — matches the close_caja_session precedent (whole-row diff) rather than a hand-built partial diff object."
  - "record_stock_movement's before is NULL (not the pre-mutation ingredient row) because the audited entity_type is 'ingredient' but the mutation's primary artifact is the newly-inserted stock_movements row (v_row) — consistent with payment.process's NULL-before-for-new-entity rule from 14-PATTERNS.md."

patterns-established: []

requirements-completed: [SC3]

duration: ~25min
completed: 2026-07-04
---

# Phase 14 Plan 03: Wire transfer_tab + record_stock_movement into record_audit Summary

**transfer_tab audits 'tab.transfer' and record_stock_movement audits 'inventory.manual_adjust' on their success paths, both carrying p_terminal_id threaded from two client call sites — advances audit-actions coverage from 6/12 to 8/12**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-04T19:55:00Z
- **Completed:** 2026-07-04T20:20:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1** — Authored `supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql`:
  - `transfer_tab`: added trailing `p_terminal_id text DEFAULT NULL` param; captured `v_before`/`v_after` via `SELECT to_jsonb(t) INTO ... FROM tabs t WHERE t.id = p_tab_id` around the `UPDATE tabs` statement; added `PERFORM record_audit('tab.transfer', 'tab', p_tab_id, v_before, v_after, 'rpc', p_terminal_id)` immediately after the `tab_transfers` INSERT and before the success `RETURN`. `NOT_FOUND`/`TAB_NOT_OPEN` early-return branches are unaudited.
  - `record_stock_movement`: added trailing `p_terminal_id text DEFAULT NULL` param; added `PERFORM record_audit('inventory.manual_adjust', 'ingredient', p_ingredient_id, NULL, to_jsonb(v_row), 'rpc', p_terminal_id)` after the `UPDATE ingredients` statement and before `RETURN v_row`. `INGREDIENT_NOT_FOUND`/`INVENTORY_NEGATIVE` RAISE branches (which abort before any mutation) are unaudited.
  - `DROP FUNCTION IF EXISTS transfer_tab(uuid, uuid, uuid, int, text, text)` and `DROP FUNCTION IF EXISTS record_stock_movement(uuid, numeric, text, text, uuid, text)` precede each `CREATE OR REPLACE` to avoid PGRST203 "function not unique" ambiguity on the old 6-arg positional call form (T-14-07 mitigation). `GRANT EXECUTE` re-issued for both new 7-arg signatures.
  - Migration **not pushed** — push is deferred to plan 14-14 per plan instructions.
- **Task 2** — `useTransferTab.ts`: added module-level `const TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';` (matches `OfflineQueueProcessor.tsx` convention exactly) and added `p_terminal_id: TERMINAL_ID` to the `db.rpc('transfer_tab', {...})` params object. No other behavior changed.
- **Task 3** — `AdjustStockMovementDialog.tsx`: added the same `TERMINAL_ID` module constant and added `p_terminal_id: TERMINAL_ID` to the `record_stock_movement` rpc params object. `INVENTORY_NEGATIVE` error mapping, toasts, and query invalidations left unchanged.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration — wire transfer_tab + record_stock_movement | `1a2df63` | `supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql` |
| 2 | Pass TERMINAL_ID from transfer_tab client call site | `9a1db77` | `src/features/transfer-tab/useTransferTab.ts` |
| 3 | Pass TERMINAL_ID from manual stock-adjust client call site | `f8a5b39` | `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` |

**Plan metadata:** (this SUMMARY commit)

## Verification

- `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts --reporter=verbose` — **8/12 passed** (up from 6/12 in 14-02's baseline). The two RPCs targeted by this plan flipped green: `'transfer_tab' -> 'tab.transfer'` and `'record_stock_movement' -> 'inventory.manual_adjust'`. Remaining 4 failures (`caja_open`, `close_tab`, `produce_prep_batch`, `force_pin_change`) are out of scope for 14-03 — those RPCs do not exist yet in any migration and are deferred to plans 14-04 through 14-09 per the plan's stated scope ("the rest need new RPCs or client-side calls").
- `npm run typecheck` — exit 0, run twice (once after Task 2, once after Task 3).
- `npx eslint src/features/transfer-tab/useTransferTab.ts src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` — clean, no output.

## Deviations from Plan

None - plan executed exactly as written. Both migration bodies were copied verbatim from the current source files (`20260420000003_transfers.sql`, `20260426000003_record_stock_movement_rpc.sql`) with only the two specified edits applied (trailing terminal_id param + PERFORM record_audit call), matching the plan's `<action>` instructions precisely.

## Issues Encountered

- The worktree had no `node_modules` (fresh git checkout) — ran `npm install` (1240 packages, ~35s). `.planning/` files (PLAN.md, PROJECT.md, STATE.md, config.json, 14-PATTERNS.md, 14-CONTEXT.md) and `.env.local` are gitignored/untracked in this repo except a handful of previously force-added SUMMARY/REVIEW files, so they were copied in from the main repo's working tree rather than checked out via git — same pattern documented in 14-02-SUMMARY.md. Neither is a plan deliverable.

## User Setup Required

None - no external service configuration required. The migration created in Task 1 is **not pushed** to remote Supabase; push is explicitly deferred to plan 14-14 (BLOCKING push gate covering all Phase 14 migrations at once).

## Next Phase Readiness

- 14-14's push gate must include `20260703000002_wire_transfer_tab_stock_movement_audit.sql` alongside the other Phase 14 migrations (`20260703000001_record_audit_terminal_id.sql` from 14-02, plus whatever 14-04 through 14-09 add).
- The `it.each` coverage scaffold in `audit-actions.test.ts` now shows 8/12 passing; the remaining 4 (`caja_open`, `close_tab`, `produce_prep_batch`, `force_pin_change`) require net-new RPCs to be authored by their respective plans (14-04..14-09) before they can flip green.
- `transfer_tab` and `record_stock_movement`'s new signatures (`..., p_terminal_id text DEFAULT NULL`) are additive/backward-compatible for any other call sites not touched by this plan (none found via grep — `useTransferTab.ts` and `AdjustStockMovementDialog.tsx` are the only two client call sites for these two RPCs).

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260703000002_wire_transfer_tab_stock_movement_audit.sql`
- FOUND: `src/features/transfer-tab/useTransferTab.ts` (p_terminal_id present)
- FOUND: `src/features/adjust-stock-movement/ui/AdjustStockMovementDialog.tsx` (p_terminal_id present)
- FOUND commit `1a2df63` (Task 1)
- FOUND commit `9a1db77` (Task 2)
- FOUND commit `f8a5b39` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
