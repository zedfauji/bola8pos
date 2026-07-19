# Phase 22: Edit Paid Ticket + History - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow managers to correct an already-paid ticket after the fact via a whitelisted-field `edit_paid_tab` RPC (manager PIN + mandatory reason), surfaced through an `EditPaidTabDialog`, with every edit recorded and reviewable in a new `/edit-history` view. This is a correction tool for mistakes on closed/paid tabs — it does not change payment status and is distinct from Phase 23's `reopen_tab` (which un-closes a tab entirely, with its own 24h/2x cap and `reopened_void` status).

</domain>

<decisions>
## Implementation Decisions

### Whitelist scope
- **D-01:** The whitelist is broad, not narrow: item quantity/price edits, adding/removing `order_items`, and notes/discount fields are all in scope (user selected all three concrete options plus "Claude picks the safest default" — read as "give me full correction capability, use your judgment on the exact column list"). This makes `edit_paid_tab` closer to a full order-line edit than a cosmetic-only patch, but it still operates on an already-paid/closed tab (payment status untouched) rather than reopening it. Research/planner should pin the exact whitelisted column set (`order_items.quantity`, `order_items.unit_price`, add/delete rows, `tabs.notes`, discount fields) against the actual `tabs`/`order_items` schema — this was not narrowed further by the user, only broadened.

### Financial / caja impact
- **D-02:** Edits that change the tab total require an offsetting caja entry recording the delta — mirrors the pattern Phase 23 also needs for `reopen_tab`. **No existing "offsetting entry" code precedent exists yet** — `caja_entries` (Phase migration `20260421000003_caja_entries.sql`) is the closest existing table/concept (manual caja entries) and is the most likely mechanism, but the offsetting-adjustment RPC pattern itself would be new. Since Phase 23 needs the same concept, research should flag whether the offsetting-entry logic belongs in a shared helper both phases can call, or whether Phase 22 establishes it first and Phase 23 reuses it later (Phase 23 is not in scope for this phase — do not implement it, just don't paint this phase into a corner that makes Phase 23 harder).

### Edit eligibility
- **D-03:** No time or caja-session-state cap — any paid tab can be edited regardless of age or whether its original caja session has since closed. This has a direct implication for D-02: if the original caja session is closed, the offsetting entry cannot land in that closed session — it must land in the *current* open caja session as an adjustment that references the original tab/session/date. Flag this as a research question, not re-litigated with the user (they explicitly chose "any time, no cap").

### `/edit-history` view
- **D-04:** Shows a before/after diff table — per edit: field changed, old value, new value, staff, timestamp, reason. Richer than the existing generic `AuditLogTable` (`/audit` page), which shows action/staff/timestamp/freeform-detail only. This likely needs either (a) a new dedicated table/schema capturing structured old/new values per edit, or (b) storing the diff as structured JSON in the existing `audit_logs.metadata`-style column and rendering it specially in a new `/edit-history` route — research should evaluate both against the existing `audit_logs` schema before planning commits to one.

### Claude's Discretion
- Exact whitelisted column list for `edit_paid_tab` (per D-01).
- Whether `/edit-history` is a fully separate route or reuses `AuditLogTable`'s shell with a specialized diff-rendering column (per D-04) — planner's call once research confirms schema feasibility.
- Whether the caja-offsetting mechanism (D-02) is a new dedicated RPC/table or extends `caja_entries` — research's call.
- RBAC gate: ROADMAP already states "managers" — use the existing `manager-pin-gate` feature pattern (manager+ per the bartender < manager < admin hierarchy), consistent with `process-refund`'s RefundSheet. Not re-discussed as a gray area since ROADMAP already pins it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 22: Edit Paid Ticket + History" — goal, depends on Phases 14 (audit logs) and 15 (optimistic concurrency)
- `.planning/ROADMAP.md` §"Phase 23: Reopen Closed Ticket" — adjacent phase sharing the "caja offsetting entries" concept; do not implement Phase 23's scope, but design D-02's mechanism aware of it
- `.planning/REQUIREMENTS.md` — no phase-22-specific entries found; requirement IDs are TBD per ROADMAP note (source POS-COMPARISON.md §22 no longer present), scope is locked here in CONTEXT.md instead

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/process-refund/ui/RefundSheet.tsx` + `src/features/process-refund/index.ts` — closest existing pattern for "manager PIN + mandatory reason + mutate a closed/paid financial record", including its manager-pin-gate integration and audit trail. Use as the structural template for `EditPaidTabDialog`.
- `src/features/manager-pin-gate/` — existing PIN-gate hook/component, reuse directly rather than reinventing.
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` enum, single source of truth for audit action labels (CI-enforced against migration `record_audit()` calls). A new `tab.edit_paid` (or similar) action must be added here before any RPC calls `record_audit()` with it.
- `supabase/migrations/20260421000003_caja_entries.sql` and `20260421000004_caja_report_entries.sql` — existing caja manual-entry mechanism, most likely reuse target for D-02's offsetting entry.
- `src/widgets/AuditLogTable/` — existing `/audit` page's table widget; reference for `/edit-history`'s shell even if the diff-rendering column is new (per D-04).

### Established Patterns
- Optimistic concurrency (`version` column + `STALE_VERSION` handling, Phase 15) — `edit_paid_tab` mutating an already-closed `tabs` row should follow the same conflict-handling convention as other RPCs.
- RBAC PIN-gated destructive/financial actions always pair a `manager-pin-gate` prompt with a `record_audit()` call inside the RPC (see `process-refund`, `void-order`).

### Integration Points
- `tabs` / `order_items` / `payments` tables — the core entities `edit_paid_tab` will read/patch.
- `caja_sessions` / `caja_entries` — where the offsetting entry (D-02) lands.
- `audit_actions.ts` + `audit_logs` table — audit trail source for `/edit-history` (per D-04's schema question).
- `src/app/router.tsx` — new `/edit-history` route registration, RBAC-gated same as `/audit` (`view_reports` or a dedicated action — planner's call).

</code_context>

<specifics>
## Specific Ideas

No particular visual/design references — this phase follows the existing PIN-gate + reason + audit-trail pattern already established by `process-refund`/`void-order`, applied to a broader whitelist of paid-tab fields.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Phase 23 (Reopen Closed Ticket) was referenced only as context for D-02's shared-mechanism question, not pulled into this phase's scope.

</deferred>

---

*Phase: 22-Edit Paid Ticket + History*
*Context gathered: 2026-07-19*
