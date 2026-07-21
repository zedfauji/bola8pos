---
phase: 24-operational-reports-suite-csv
plan: 04
subsystem: database
tags: [postgres, plpgsql, supabase-rpc, audit-log, inventory]

requires:
  - phase: 24-operational-reports-suite-csv (Plan 01)
    provides: "order_item.remove registered in AuditActionSchema (src/shared/lib/audit-actions.ts) so the audit-actions.test.ts grep gate is satisfiable; DeletionsPreRowSchema/DeletionsPostRowSchema in domain.ts"
provides:
  - "remove_tab_item(p_item_id uuid, p_reason text) RETURNS jsonb -- atomic, audited order-item removal with inventory restore"
  - "get_deletions_pre_report(p_from, p_to) -- D-05 variant A (order_item.remove audit rows)"
  - "get_deletions_post_report(p_from, p_to) -- D-05 variant B (tab.edit_paid audit rows)"
affects: [remove-tab-item, deletions-reports, tab-item-removal, audit-logs]

tech-stack:
  added: []
  patterns:
    - "PERFORM deplete_for_order_item(id, -1, true) BEFORE DELETE FROM order_items -- inventory restore must read the row while it still exists"
    - "PERFORM record_audit(...) on the success path only, never inside an EXCEPTION block"
    - "Deletions report RPCs read audit_logs (plural) exclusively, never the legacy singular table"

key-files:
  created:
    - supabase/migrations/20260721000005_remove_tab_item_rpc.sql
    - supabase/migrations/20260721000006_deletions_reports_rpc.sql
  modified: []

key-decisions:
  - "remove_tab_item deliberately omits any manager/admin role gate -- item removal stays bartender-accessible (D-07), matching useRemoveTabItem's current effective access"
  - "get_deletions_post_report derives fieldsChanged by diffing before/after tab-row jsonb top-level keys, excluding updated_at/version (always change) and items (nested array, not a scalar tab field) -- no existing precedent dictated the algorithm, this is the plan's Claude's-discretion resolution"
  - "get_deletions_pre_report resolves itemName via a products join on the before-state's product_id (order_items has no name-snapshot column); products rows are never deleted by removal so the join is always resolvable"

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "remove_tab_item RPC restores inventory before delete, hard-deletes the order_item, voids the order if empty, and audits the removal (no role gate)"
    requirement: SC-1
    verification:
      - kind: other
        ref: "node structural-grep check embedded in 24-04-PLAN.md Task 1 <verify> (confirms deplete_for_order_item precedes DELETE textually, PERFORM record_audit present, no role IN ('manager'...) gate)"
        status: pass
    human_judgment: true
    rationale: "Structural/textual grep proves the SQL contains the right calls in the right order, but does not prove runtime behavior (actual inventory restore math, actual audit row written, actual void-if-empty transition) -- that requires a live Supabase push + integration test, deferred to Plan 05/06 per this plan's own <verification> section ('Live integration tests run in Plan 06, post-push')."
  - id: D2
    description: "get_deletions_pre_report and get_deletions_post_report read the plural audit_logs table at the two correct financial-risk stages (order_item.remove / tab.edit_paid), bounded and SECURITY DEFINER"
    requirement: SC-4
    verification:
      - kind: other
        ref: "node structural-grep check embedded in 24-04-PLAN.md Task 2 <verify> (confirms both function names, both action-literal filters, audit_logs plural reference, SECURITY DEFINER, GRANT EXECUTE; fails on any singular audit_log reference)"
        status: pass
    human_judgment: true
    rationale: "Same as D1 -- SQL has not been pushed to a live database in this plan (Plan 05 owns the push); row shape and join correctness need a live integration test, not just a structural grep."

duration: 25min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 04: Deletions Audit + Reports Summary

**Atomic audited `remove_tab_item` RPC (inventory-restore-before-delete, no role gate) plus two SECURITY DEFINER report RPCs reading the plural `audit_logs` table for pre-send removals and post-close corrections**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-21T16:15:00Z (approx.)
- **Completed:** 2026-07-21T16:39:14Z
- **Tasks:** 2
- **Files modified:** 2 (both new migration files)

## Accomplishments

- `remove_tab_item(p_item_id uuid, p_reason text)` replaces `useRemoveTabItem`'s 3-step client mutation (delete -> check -> void) with one atomic RPC: captures before-state, restores inventory via `deplete_for_order_item(p_item_id, -1, true)` **before** the row is deleted, hard-deletes the order_item, voids the parent order if now empty, and `PERFORM record_audit('order_item.remove', ...)` on the success path only. Includes a lightweight `TAB_NOT_OPEN` defense-in-depth guard. No manager/admin role check added — stays bartender-accessible (D-07).
- `get_deletions_pre_report(p_from, p_to)` and `get_deletions_post_report(p_from, p_to)` — two bounded, SECURITY DEFINER report RPCs reading the plural `audit_logs` table (never the legacy singular table — Pitfall 1) at `action = 'order_item.remove'` and `action = 'tab.edit_paid'` respectively, closing the deletions-reports gap (D-05).
- This closes the last un-audited destructive order-lifecycle mutation (T-24-04-R): every path that removes an order_item from an open tab now writes a tamper-evident `audit_logs` row.

## Task Commits

Each task was committed atomically:

1. **Task 1: remove_tab_item audited RPC (D-06, D-07 — no role gate)** - `62bcc0c` (feat)
2. **Task 2: deletions-pre + deletions-post report RPCs (D-05, Pitfall 1)** - `7c951a7` (feat)

_Note: Both tasks were single-commit; no TDD phase applied to this SQL-only plan._

## Files Created/Modified

- `supabase/migrations/20260721000005_remove_tab_item_rpc.sql` - Atomic audited order-item removal RPC (inventory restore, hard delete, void-if-empty, audit)
- `supabase/migrations/20260721000006_deletions_reports_rpc.sql` - `get_deletions_pre_report` + `get_deletions_post_report` RPCs

## Decisions Made

- **No role gate on `remove_tab_item`** — deliberately did not copy `edit_paid_tab`'s `role IN ('manager','admin')` guard; item removal remains bartender-accessible per D-07/UI-SPEC. Verified by the plan's own negative grep (`bad=/role\s+IN\s*\(\s*'manager'/`).
- **`fieldsChanged` derivation algorithm (Claude's discretion, D-01 area not otherwise specified)** — computed as a top-level jsonb key diff between `audit_logs.before` and `audit_logs.after`, excluding `updated_at`/`version` (which always change on every `edit_paid_tab` call regardless of intent) and `items` (a nested array requiring a separate diff strategy, out of scope for this bounded report). This is a pragmatic, bounded definition; a more granular per-order-item diff was not built since no precedent or explicit requirement demanded it (YAGNI).
- **`itemName` resolved via a live `products` join**, not a denormalized snapshot — `order_items` has no name-snapshot column, and since removal never deletes the `products` row itself, the join is always resolvable at report-read time. Matches the existing pattern in `get_voids_report` (products/profiles joined at report time, not snapshotted).

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the PATTERNS.md verbatim templates; the one design gap the plan explicitly left open (`fieldsChanged` derivation algorithm) was resolved per the guidance above without requiring a Rule 4 architectural checkpoint, since it is a report-query implementation detail, not a schema or access-control change.

## Issues Encountered

- Task 2's first draft tripped its own structural-grep verification (`USES_SINGULAR_audit_log`) because a header comment described the legacy singular table by name for context ("never the legacy singular audit_log"). The grep is a blunt whole-file regex, not comment-aware. Reworded the comment to avoid the literal token while preserving the same explanatory content; re-ran verification, passed. No SQL logic changed.

## User Setup Required

None - no external service configuration required. Both migrations are authored only; the blocking `npx supabase db push` is explicitly owned by Plan 05 per this plan's frontmatter/objective.

## Next Phase Readiness

- Both migrations are ready to be pushed as part of Plan 05's single blocking `db push`.
- Plan 06 owns live integration tests against these two new RPCs plus `remove_tab_item` (per this plan's `<verification>` section).
- `useRemoveTabItem.ts` and `RemoveTabItemDialog.tsx` (client-side wiring to call `remove_tab_item` instead of the old 3-step mutation) are separate plan scope (per 24-PATTERNS.md file classification) — not touched here, no blocker for those to proceed once the RPC is live.
- The two new report widgets (`DeletionsPreSendPanel`, `DeletionsPostCloseReport`) depend on these RPCs plus the `useDeletionsPreReport`/`useDeletionsPostReport` query hooks (separate plan scope) — RPC surface is now stable for those to be built against.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260721000005_remove_tab_item_rpc.sql
- FOUND: supabase/migrations/20260721000006_deletions_reports_rpc.sql
- FOUND: .planning/phases/24-operational-reports-suite-csv/24-04-SUMMARY.md
- FOUND commit: 62bcc0c
- FOUND commit: 7c951a7
