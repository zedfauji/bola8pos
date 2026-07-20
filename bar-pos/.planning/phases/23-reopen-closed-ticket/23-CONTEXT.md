# Phase 23: Reopen Closed Ticket - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Let a manager reopen a closed/paid tab via a `reopen_tab` RPC: flips `tabs.status` back to `open` (using the existing `open`/`closed`/`paid`/`voided` `tab_status` enum), voids the original payment(s) via a new `payments.status` field, writes an offsetting caja entry, enforces a 24h/2x reopen cap, and audit-logs every reopen. Once reopened, the tab is a fully normal open tab — items are added/removed through the existing order-editing features and it is re-closed through the normal `close_tab`/`process_payment` path. This is distinct from Phase 22's `edit_paid_tab`, which patches a paid/closed tab in place without ever un-closing it.

</domain>

<decisions>
## Implementation Decisions

### Payment status modeling
- **D-01:** Add a new `payments.status` column (not a boolean flag) — e.g. `'completed' | 'reopened_void'`, default `'completed'`. This matches the ROADMAP's literal `reopened_void` wording and gives a single queryable status field rather than stacking another boolean alongside `isRefund`. Research/planner must check whether any reporting/receipt code assumes payment rows are always "final" and update it to treat `reopened_void` as excluded from revenue totals.
- **D-05 (Claude's discretion):** Whether ALL non-refund payment rows for the tab flip to `reopened_void` on reopen, or only some — user deferred this to research/planner. Default assumption unless research finds a reason otherwise: every completed payment leg for the tab (including all `payment_group_id` siblings from a split payment, Phase 18) flips to `reopened_void`; existing `isRefund: true` rows are left untouched (refunds are already their own voiding mechanism, don't double-void them).

### Reopen cap (24h window, max 2)
- **D-02:** The 24h window resets on each reopen — i.e., a manager has 24h from the MOST RECENT reopen (not the original close) to reopen again, still capped at 2 reopens total, ever (no reset of the count).
- **D-03:** Reopen count is tracked via a new `tabs.reopen_count` column (int, default 0), incremented atomically inside `reopen_tab` under the same row lock (`FOR UPDATE`) used for the `p_expected_version` check — same locking pattern as `edit_paid_tab`. Do not derive the cap from counting `audit_logs` rows.
- Store the "most recent reopen timestamp" needed for the 24h check — likely a new `tabs.last_reopened_at` column (planner's call on exact column name), read/written in the same locked UPDATE as `reopen_count`.

### RBAC gate
- **D-04:** Manager+ (`manager` or `admin` role) — same gate as `edit_paid_tab`/`process_refund`. Reuse the existing `manager-pin-gate` feature and the same server-side role re-check pattern (`SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin')`) already used in `edit_paid_tab`'s RPC. No new RBAC tier.

### Post-reopen behavior
- **D-06:** Reopening produces a fully normal open tab. No special "reopened mode" UI restricting what can be edited — the manager uses the existing `add-item-to-tab`/`remove-item-from-tab`/other order-editing features, then closes it again via the normal `close_tab`/`process_payment` flow (which will create fresh payment row(s), separate from the voided originals).

### Claude's Discretion
- Exact `payments.status` enum values beyond `'completed'` / `'reopened_void'` (e.g., whether to also introduce `'refunded'` while touching this column, or leave that for a future phase — default: keep it minimal, only add `'completed'` and `'reopened_void'` now).
- Exact new-column names (`tabs.reopen_count`, `tabs.last_reopened_at` or equivalent) — planner's call once research confirms schema conventions.
- Which non-refund payment rows flip to `reopened_void` on a split-payment tab (per D-05) — research's call, confirm against `payment_group_id`/`split_index` schema from Phase 18.
- Whether the offsetting caja entry mechanism introduces `caja_entries.source_tab_id`/`source_type` columns (flagged as a possible future step in Phase 22's migration comment) or continues the free-text `concept` encoding Phase 22 established — default: continue the free-text pattern for consistency unless research finds a strong reason to add columns now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 23: Reopen Closed Ticket" — goal, depends on Phases 14 (audit logs) and 15 (optimistic concurrency)
- `.planning/ROADMAP.md` §"Phase 22: Edit Paid Ticket + History" — adjacent phase; `reopen_tab` must NOT duplicate `edit_paid_tab`'s whitelist-patch behavior, but should reuse its offsetting-caja-entry and version-guard patterns
- No REQUIREMENTS.md file exists in `.planning/`; requirement IDs are TBD per ROADMAP note (source `POS-COMPARISON.md` §23 no longer present) — scope is locked here in CONTEXT.md instead

### Prior-phase implementation precedent (read before planning)
- `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` — the `edit_paid_tab` RPC. Copy its exact patterns: manager role re-check, `p_expected_version`/`FOR UPDATE` version guard, single combined UPDATE for `tabs` (bump_version_on_update trigger rejects any UPDATE to `tabs` that doesn't advance version by exactly +1), offsetting `caja_entries` row (free-text `concept` encoding, `type` = `'income'|'expense'` by delta sign, sanitized reason), before/after audit write.
- `supabase/migrations/20260720000001_fix_edit_paid_tab_inventory.sql` — follow-up correction to the above; read for any inventory-adjustment nuance that might also apply to reopen (adding/removing items after reopen goes through the normal add/remove-item features, which already handle inventory — this RPC itself should NOT touch inventory directly).

No other external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/process-refund/ui/RefundSheet.tsx` + `src/features/manager-pin-gate/` — manager PIN + mandatory reason pattern; use as the structural template for a `ReopenTabDialog`/similar.
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema` enum; add a new `tab.reopen` action here before any RPC calls `record_audit()` with it (CI-enforced against migration `record_audit()` calls, per `src/shared/lib/__tests__/audit-actions.test.ts`).
- `supabase/migrations/20260421000003_caja_entries.sql` — existing caja manual-entry mechanism, reuse for the offsetting entry exactly as `edit_paid_tab` does.
- `src/features/add-item-to-tab/`, `src/features/remove-item-from-tab/`, `src/features/close-tab/`, `src/features/process-payment/` — the normal open-tab feature set the reopened tab re-enters (per D-06); no new order-editing UI needed.

### Established Patterns
- Optimistic concurrency (`version` column + `p_expected_version`/`STALE_VERSION` handling, Phase 15) — `reopen_tab` must follow the same convention when flipping `tabs.status` back to `open`.
- RBAC PIN-gated destructive/financial actions always pair a `manager-pin-gate` prompt with a server-side role re-check and a `record_audit()` call inside the RPC (see `process_refund`, `edit_paid_tab`).
- `tab_status` enum is `'open' | 'closed' | 'paid' | 'voided'` (`supabase/migrations/20260414000001_enums.sql`) — `reopen_tab` transitions FROM `'closed'`/`'paid'` back TO `'open'`; no new tab-status enum value is needed (the "reopened_void" label applies to `payments.status`, not `tabs.status`).
- `payments` table currently has no status column (`PaymentSchema` in `src/shared/lib/domain.ts` has only `isRefund: boolean`) — D-01 introduces the first one.

### Integration Points
- `tabs` table — status flip, `version` bump, new `reopen_count`/`last_reopened_at`-style columns (D-03).
- `payments` table — new `status` column (D-01), flipped on the original payment row(s) for the tab.
- `caja_sessions` / `caja_entries` — offsetting entry destination (same as Phase 22).
- `audit_actions.ts` + `audit_logs` table — new `tab.reopen` action, audit trail.
- Reports/receipt code that reads `payments` — must be checked for any assumption that payment rows are always final/counted toward revenue; `reopened_void` rows should likely be excluded from totals (planner/research to confirm exact touch points).

</code_context>

<specifics>
## Specific Ideas

No particular visual/design references — this phase follows the existing PIN-gate + reason + audit-trail pattern already established by `process-refund`/`edit_paid_tab`, applied to a full tab-reopen action instead of an in-place patch.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. `edit_paid_tab` (Phase 22, already shipped) was referenced only as implementation precedent, not pulled into this phase's scope.

</deferred>

---

*Phase: 23-Reopen Closed Ticket*
*Context gathered: 2026-07-20*
