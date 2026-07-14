# Phase 14: Audit Logs Table - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the `audit_logs` compliance system: finish wiring `record_audit` into all remaining sensitive RPCs/Edge Functions, build the missing `/audit` manager+ page (route, widget, filters, diff viewer), and reconcile the partial prior implementation with ROADMAP/STATE tracking. This is a **completion phase**, not greenfield — substantial work already exists in the codebase but was never tracked to completion (see Code Context below).

</domain>

<decisions>
## Implementation Decisions

### RPC Wiring Scope
- **D-01:** Wire all 8 remaining RPCs with `record_audit`, matching the pattern already used for the 4 done ones (`process_payment_atomic`, `process_refund`, `close_caja_session`, `add_combo_to_tab`): `void_order`, `close_tab`, `transfer_tab`, `produce_prep_batch`, `update_role_permission`, `force_pin_change`, `manual_stock_movement`.
- **D-01a (post-research amendment, confirmed by user 2026-07-03):** Research found `void_order` and `force_pin_change` are NOT simple wiring targets — `void_order` calls an Edge Function absent from the repo entirely (must verify live-Supabase existence first, BLOCKING); `force_pin_change` has zero implementation anywhere (no RPC, no UI, no migration for `must_change_pin` column). **User explicitly confirmed: keep both in Phase 14 scope — planner must build them fully** (RPC + migration + UI as needed), not just add an audit-wiring patch on top of something that doesn't exist. Same applies to `caja_open`, `close_tab`, `produce_prep_batch` (also not real RPCs today per research — need new SECURITY DEFINER wrapper RPCs) and `manual_stock_movement` (misnamed; real RPC is `record_stock_movement`). See `14-RESEARCH.md` for full per-RPC findings and exact file locations.
- **D-02:** `caja_open` has no SECURITY DEFINER RPC today (direct INSERT under RLS). Add a new `caja_open` SECURITY DEFINER RPC wrapping that INSERT so `record_audit` fires atomically — do not do a client-side post-insert audit call.

### /audit Page UX
- **D-03:** Diff viewer opens in a slide-in Sheet on row click — matches existing `SplitTabSheet`/`RefundSheet` pattern already in the codebase.
- **D-04:** Infinite scroll, page size 50 (per ROADMAP success criteria #6 — locked, not revisited).
- **D-05:** Filters: action, entity_type, actor, date range, free text — roadmap's 5, unchanged. No terminal_id/source filter added (considered, not selected — see Claude's Discretion).

### Existing Partial Code
- **D-06:** Before reusing `json-diff.ts`, `JsonDiffViewer`, `entities/audit-log/`, `audit-actions.ts` as-is, planner/researcher should verify they still match current schema/RLS (they were built 2026-04-28 and orphaned from ROADMAP/STATE tracking since — unclear why). If verification passes, extend rather than rewrite.
- **D-07:** E2E `e2e/38-audit-logs.spec.ts` exists but deviates from its own plan (swapped `order.void` test for `combo.add_to_tab` because `order.void` wasn't wired yet). Now that `order.void` will be wired (D-01), restore the original `order.void` filter test per the plan's intent, and add coverage for the newly-wired RPCs. Also add this spec to CLAUDE.md's tracked E2E spec list (currently missing).

### Truncation + Edge Function Coverage
- **D-08:** When `_truncated: true` (payload >64KB), show a warning banner ("Diff truncated — payload exceeded 64KB") above the partial before/after JSON in `JsonDiffViewer`.
- **D-09:** Grep `supabase/functions/` for any Edge Function performing sensitive mutations not already covered by RPC-level `record_audit`, and wire `recordAudit` (via `_shared/audit.ts`) into each.

### Claude's Discretion
- Whether to add a terminal_id/source filter to `/audit` beyond the roadmap's 5 (considered, no final call — default to the 5 unless discovery work shows a strong need).
- Exact wiring order/waves for the 8 remaining RPCs.
- Whether truncation banner styling reuses an existing shared/ui alert component.

**Note:** The final 2 discussion turns (E2E rewrite depth, and confirming truncation/edge-fn answers) received no user response within timeout — Claude proceeded with the recommended option in each case per the tool's guidance. Flag these to the user for a quick confirm during planning if anything looks off: D-06/D-07 (audit-first + update-existing-spec) and D-08/D-09 (banner+partial-diff + audit-all-sensitive-edge-fns).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Requirements
- `.planning/ROADMAP.md` §"Phase 14: Audit Logs Table" (line 398) — goal, 9 success criteria, RPC list
- `.planning/PROJECT.md` — Phase 14 listed as hard dependency for Phases 16, 17, 22, 23, 24, 27
- **GAP:** ROADMAP references "POS-COMPARISON.md §15" as the requirements source — this file does not exist anywhere in the repo (`find` turned up nothing). Researcher should note this as a missing doc, not re-derive it from memory.

### Existing Partial Implementation (verify before reuse — D-06)
- `supabase/migrations/20260511000001_audit_logs_table.sql` — `audit_logs` table + `record_audit` SECURITY DEFINER RPC
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` — wires 4 of 12 target RPCs (documents which ones, and why `caja_open` was skipped)
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` Zod enum, single source of truth for action labels; already includes labels for actions not yet wired (e.g. `order.void`, `tab.close`, `tab.transfer`, `tab.split`, `caja.open`, `caja.entry`, `order.create`, `inventory.*`, `prep.produce`)
- `src/shared/lib/__tests__/audit-actions.test.ts` — CI grep test asserting migration `record_audit` calls use enumerated actions; verify it still passes after new RPCs wired
- `src/shared/lib/json-diff.ts` + `src/shared/ui/JsonDiffViewer/` (+ stories) — diff util and viewer component
- `src/entities/audit-log/` — FSD entity slice
- `src/shared/lib/result.ts` — `AUDIT_WRITE_FAILED` already in `AppErrorCode` union
- `supabase/functions/_shared/audit.ts` — Edge Function audit helper (`recordAudit`)
- `e2e/38-audit-logs.spec.ts` — E2E spec (6 tests), header documents its own known deviation (see D-07)

### Missing (must be built)
- No `/audit` page under `src/pages/`
- No `AuditRoute` guard
- No router entry in `src/app/router.tsx`
- No HomeDashboard tile for Audit
- No `widgets/AuditLogTable/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `JsonDiffViewer` (`src/shared/ui/JsonDiffViewer/`): built and stories exist — reuse in the new Sheet-based detail view (D-03) if verification (D-06) passes.
- `entities/audit-log/`: FSD slice already scaffolded — build `widgets/AuditLogTable/` and `pages/audit/` on top rather than re-deriving entity queries.
- `SplitTabSheet` / `RefundSheet` (existing features): reference pattern for the diff-viewer Sheet (D-03).

### Established Patterns
- `record_audit` is called post-mutation, pre-RETURN, only on the SUCCESS path of SECURITY DEFINER RPCs (validation-error returns are not audited — no state changed). Audit failures are non-fatal (record_audit catches its own exceptions, returns NULL) — follow this exact pattern for the 8 remaining RPCs (D-01).
- Manager+ gating pattern already established via `ReportsRoute`/`RbacRoute` guards — `AuditRoute` should follow the same shape.

### Integration Points
- `src/app/router.tsx` — no `/audit` entry yet; add alongside existing routes table in CLAUDE.md.
- `HomeDashboard` — needs an Audit tile (roadmap success criteria #7 implies this, per existing RBAC/Reports tile precedent).

</code_context>

<specifics>
## Specific Ideas

No additional specific UI/behavior references beyond the roadmap's own success criteria and the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (User confirmed "Full re-discuss" rather than narrowing to a pure completion-audit — see Discussion Log for the initial scoping question and answer.)

</deferred>

---

*Phase: 14-audit-logs-table*
*Context gathered: 2026-07-03*
