# Phase 19: Tip Distribution Config - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Let admins configure how collected tips are split across floor/bar/kitchen buckets. Add a singleton `tip_distribution_config` (floor/bar/kitchen percentages), compute and record a `tip_distribution_entries` row per caja-close (immutable snapshot of that config applied to that session's total tips), wire the computation into the close-caja flow, and add a Settings panel for admins to edit the percentages. Reporting shows the computed bucket totals on a separate panel/tab. Per-staff sub-division of each bucket is explicitly out of scope for this phase (see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Percentage validation
- **D-01:** Floor+bar+kitchen percentages do NOT need to hard-sum to 100%. UI shows a warning if the sum ≠ 100% but the admin can still save. No RPC-level rejection on save.

### Rounding / remainder handling
- **D-02:** When splitting a session's total tips by percentage, use largest-remainder allocation: round each bucket down first, then give any leftover cent(s) to whichever bucket has the largest configured percentage. No tip money is lost/unallocated.

### Entry timing & immutability
- **D-03:** `tip_distribution_entries` are computed automatically at close-caja time — the RPC reads the *current* `tip_distribution_config` percentages at that moment and snapshots the computed amounts into the entry row. This mirrors the existing `caja_sessions` immutability pattern: once written, an entry does not change even if the admin edits the config percentages afterward.
- **D-04:** No manual create/edit path for `tip_distribution_entries` — fully automatic, computed only by the close-caja flow. Correcting a mistake requires a DB-level fix, same operational posture as `caja_sessions` today (no in-app correction UI).

### Settings UI placement
- **D-05:** Add a new, dedicated "Tip Distribution" tab to `SettingsTabsPanel` (alongside Billing/Hardware/etc.) rather than folding it into the existing `BillingSettingsTab`. Reason: `BillingSettingsTab` already has unrelated tip fields (customer-facing suggested tip % presets like "10, 15, 18, 20") — a separate tab avoids conflating the two different "tip" concepts.

### Report display
- **D-06:** The computed floor/bar/kitchen distribution for a closed caja session shows on its own separate report panel/tab (not merged into the existing `get_caja_report` cash/card/rappi summary section). This mirrors how the existing per-staff `TipDistributionPanel` is already its own standalone panel.

### Relationship to existing per-staff tip report
- **D-07:** This phase's bucket totals (`tip_distribution_entries`) are logically connected to per-staff tips conceptually (buckets are *meant* to eventually flow to staff), but this phase only computes and stores the 3-bucket totals per caja-close. It does NOT modify, feed into, or alter the existing `TipDistributionPanel` / `useStaffTips` per-staff report — that stays on its current independent data path in this phase. Per-staff sub-division of a bucket's total (by clocked-in role, by hours, etc.) is deferred (see below).

### Claude's Discretion
- Exact table/column naming for `tip_distribution_config` and `tip_distribution_entries` (e.g. `floor_pct` vs `floor_percentage`) — follow closest existing convention.
- Whether `tip_distribution_config` is a true single-row table (enforced via check constraint/trigger) or a `key/value`-style singleton — follow whichever pattern is already established elsewhere in the schema for singleton config rows, if one exists (check `receipt_settings` as a possible analog).
- Exact numeric precision for percentage columns and computed bucket amounts (follow `payments.amount`/`tip_amount` NUMERIC(10,2) convention already in use).
- Whether the close-caja RPC extension lives inside the existing caja-close function or as a new function called from it — researcher/planner should evaluate against the existing caja-close RPC's structure.
- Whether the "largest percentage" tiebreak rule (D-02) needs a deterministic tiebreaker when two buckets have equal largest percentage — pick a stable rule (e.g. floor > bar > kitchen order) if this comes up.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 19: Tip Distribution Config" — goal, 4 success criteria, depends-on Phase 14. Note: original source doc `POS-COMPARISON.md §19` is no longer present in the repo (same gap flagged in Phase 14/16/17/18 CONTEXT.md files) — this CONTEXT.md is the scope source of record.

### Existing caja/payments schema to integrate with
- `supabase/migrations/20260420000002_caja_sessions.sql` — `caja_sessions` table this phase's entries hang off of (per-session, closed = immutable).
- `supabase/migrations/20260420000004_caja_report_rpc.sql` (and its later fix `20260420000009_fix_caja_report_rpc_notes.sql`) — `get_caja_report(p_caja_id UUID)` RPC; shows the existing pattern for aggregating `payments` by method into a report JSON. The close-caja flow this phase hooks into should be located near/alongside this RPC.
- `supabase/migrations/20260421000003_caja_entries.sql`, `20260421000004_caja_report_entries.sql` — existing "per-caja entries" table naming convention; `tip_distribution_entries` should follow the same shape/conventions (FK to `caja_sessions`, immutable once written).
- `supabase/migrations/20260414000006_payments.sql` — `payments.tip_amount NUMERIC(10,2)` — the source of truth for tip amounts to be pooled/split; confirms `tip_amount >= 0` constraint already exists.
- `supabase/migrations/20260512000001_versioned_rows.sql` — optimistic concurrency (`version` + `p_expected_version`) pattern from Phase 15; confirm whether `caja_sessions`' close path already participates in this and whether the new tip-distribution write needs to as well.
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` — `record_audit` post-mutation pattern (Phase 14) — apply for admin edits to `tip_distribution_config` (admin-only write per ROADMAP success criteria).

### Existing Settings UI to extend
- `src/widgets/SettingsTabsPanel/tabs/` — directory of existing tab components (`BillingSettingsTab.tsx`, `HardwareSettingsTab.tsx`, `GeneralSettingsTab.tsx`, etc.) — add a new `TipDistributionSettingsTab.tsx` here following the same file/registration pattern.
- `src/widgets/SettingsTabsPanel/tabs/BillingSettingsTab.tsx` — contains the UNRELATED customer-facing `defaultTipPercentages` (CSV input, "10, 15, 18, 20") — do not confuse with or reuse this for the floor/bar/kitchen split; it's a different feature discussed and explicitly kept separate (D-05).

### Existing tip reporting (adjacent, not modified this phase)
- `src/widgets/TipDistributionPanel/TipDistributionPanel.tsx` + `.test.tsx` + `index.ts` — existing standalone per-staff tip report widget (`useStaffTips` from `@entities/staff`), rendered as a `DataTable` with staff name + total tips columns, `ExportButtons` toolbar. Not modified by this phase (D-07) but is the closest existing "tip report panel" pattern to model the new bucket-distribution report panel after (D-06).
- `src/entities/staff/model/queries.ts` — `useStaffTips` query implementation — reference for how tip aggregation queries are currently structured.

### Related prior-phase context
- `.planning/phases/18-split-payment-multi-method/18-CONTEXT.md` — most recent prior phase; confirms `payments` schema conventions (payment_group_id/split_index) that may affect how tip_amount is summed per caja session (sum across all payment legs, not per-tab).
- `.planning/phases/14-audit-logs-table/14-CONTEXT.md` — establishes the `record_audit` pattern referenced above for admin-only config writes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TipDistributionPanel` (`src/widgets/TipDistributionPanel/`) — closest existing UI pattern for a standalone tip report panel (DataTable + ExportButtons + EmptyState); model the new bucket-distribution report after this shape (D-06).
- `SettingsTabsPanel/tabs/*` — existing tab component pattern (form state, save handler, admin-gated) to clone for the new Tip Distribution settings tab.
- `get_caja_report` RPC pattern — shows how to aggregate `payments` by criteria into a JSON report; the tip-bucket computation should follow the same aggregation style.

### Established Patterns
- Singleton config rows: check `receipt_settings` table for the existing per-terminal/singleton config pattern before designing `tip_distribution_config`'s uniqueness enforcement.
- Admin-only write + audit: RPCs that mutate config gated by role, followed by a `record_audit` insert (Phase 14 pattern) — apply to `tip_distribution_config` updates.
- Per-session immutable entries: `caja_sessions`/`caja_entries` establish the "write once at close, never edit after" pattern this phase's `tip_distribution_entries` follows (D-03, D-04).

### Integration Points
- Close-caja RPC/flow (near `get_caja_report` / wherever `caja_sessions.status` transitions to closed) — primary hook point to compute and insert the `tip_distribution_entries` row.
- `SettingsTabsPanel` — new tab registration point for admin config UI.
- Reports page (`src/pages/reports/`) — likely location for the new separate distribution report panel, alongside where `TipDistributionPanel` is currently rendered.

</code_context>

<specifics>
## Specific Ideas

- Terminology: "floor", "bar", "kitchen" are the three fixed buckets (from ROADMAP.md) — not user-configurable bucket names in this phase, just their percentages.
- Existing "10, 15, 18, 20" customer-tip-suggestion UI in `BillingSettingsTab` is a real, separate feature — explicitly confirmed unrelated during discussion (D-05, D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Per-staff sub-division of bucket totals** — dividing each bucket's total (e.g. floor's share) among the individual staff clocked into that role during the session (equal split vs hours-weighted) was raised during discussion but explicitly deferred. User confirmed this phase only computes and stores the 3-bucket totals; per-staff distribution is a future phase. `TipDistributionPanel`/`useStaffTips` keeps functioning on its current independent data path in the meantime (D-07).
- **Payment-method scope for pooling** (whether rappi tips should be excluded from the 3-way split since delivery tips may already go directly to a driver) was raised as a candidate discussion area but not explored — flagging for research/planning to confirm with the user if it turns out to matter, or default to pooling all payment methods' `tip_amount` uniformly since ROADMAP.md doesn't call out an exclusion.

</deferred>

---

*Phase: 19-tip-distribution-config*
*Context gathered: 2026-07-08*
