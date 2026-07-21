# Phase 24: Operational Reports Suite + CSV - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add 6 new/migrated reporting RPCs (peak-hours, voids, deletions ×2 variants, modifier popularity, payment methods, charts-data), a generic CSV export action reusable across all 17 report tabs (11 existing + 6 new/migrated), and Recharts-based visuals for the reports where a chart adds value. Depends on Phase 14 (audit_logs / record_audit).

Discovery during discussion: two of the "6 new RPCs" the ROADMAP names (`voids`, `peak-hours`) already exist as reports today — but as unbounded client-side Supabase queries, not RPCs. This phase migrates those two to server-side RPCs rather than building them from scratch, and builds the remaining 4 (deletions ×2, modifier popularity, payment methods, charts-data) as genuinely new.

</domain>

<decisions>
## Implementation Decisions

### Voids RPC (migration, not new build)
- **D-01:** Migrate the existing client-side "Voids" tab query to a server-side RPC. Current client-side date-range filtering does a full-table scan — violates success criterion 4 (no unbounded queries).
- **D-02:** The RPC returns the same `VoidRefundRow` shape (`orderId`, `voidedAt`, `staffName`, `amount`, `reason`) unchanged. `voids-excel` / `voids-pdf` in `useExportReport` and their formatter functions in `@shared/lib/exporters/{excel,pdf}` need zero changes.

### Peak-hours RPC (migration + extension)
- **D-03:** Migrate the existing "Hourly" tab (`HourlyRow`: `hour`/`orderCount`/`revenue`) to a server-side RPC, and extend it with day-of-week + a "busiest hour" indicator so it reads as genuine peak-hours analysis.
- **D-04:** The extension **changes `HourlyRow` itself** (adds fields) — this requires updating `HourlyRowSchema`/type in `domain.ts` AND both existing `hourly-excel`/`hourly-pdf` exporter functions to match the new shape. Not additive-only / UI-summary-only.

### "Deletions" report — two variants
- **D-05:** Variant A = pre-send order-item removal (`remove-tab-item`, before kitchen/bar). Variant B = post-close correction via `edit_paid_tab` (already audited as `tab.edit_paid`). Split is by financial-risk stage, not by reason-presence or actor role.
- **D-06 (blocker found, resolved):** `useRemoveTabItem` currently does a hard `DELETE` on `order_items` with **zero audit trail** — no `record_audit` call, no soft-delete. Variant A cannot be reported on without this fix. Resolution: add a new `order_item.remove` entry to `AuditActionSchema` (`src/shared/lib/audit-actions.ts`) and call `record_audit` from the removal path (client-side call or move server-side into an RPC — planner's call which). The deletions report only covers data from the point this ships forward; **the report UI must note the historical gap** (no pre-existing removal history to backfill).
- **D-07:** Adding `order_item.remove` auditing also adds a **required** reason field to `RemoveTabItemDialog` (currently has none), mirroring `VoidOrderDialog`'s existing reason requirement. The deletions report (variant A) has a reason column as a result.

### New report: Payment methods
- **D-08:** Grain = **both** per-caja-session rows (count of legs, gross amount, tip amount, grouped like `CajaReportPanel`) **and** a day-level total rollup. Ties into Phase 18's `payment_group_id`/`split_index` tagging on `payments`.

### New report: Modifier popularity
- **D-09:** Ranked by **both** attach-count and revenue-attributable columns, default-sorted by attach count (mirrors how `ComboMixReport` already ranks combos by count).
- **D-10:** Capped at **top 20** in the UI table. Full underlying data is still available via the CSV/Excel export (no cap on exported rows).

### Generic CSV export
- **D-11:** Build **one generic rows→CSV serializer** (accepts any array of flat objects + column config: key + header label) → CSV string → same Tauri `save()`/`writeFile()` flow already used by `useExportReport`. Every report widget (all 17: 11 existing + 6 new/migrated) passes its already-fetched rows — no per-report CSV functions, unlike the existing per-report Excel/PDF pattern.
- **D-12:** CSV export is wired onto **all 17 report tabs this phase** (session, products, hourly, voids, categories, staff, tips, tip-split, combos, variance, waitlist, refunds-reg, overrides + the 6 new/migrated ones) — not just the new ones. Matches success criterion 2's "reusable across all new and existing report widgets" literally; avoids an inconsistent toolbar where some tabs have CSV and others don't.

### Recharts widget assignment
- **D-13:** Peak-hours → bar chart by hour (busiest hour highlighted).
- **D-14:** Payment methods → pie/donut, share of total by method.
- **D-15:** Modifier popularity → horizontal bar chart (top 20, count or revenue axis).
- **D-16:** Voids and both deletions variants stay **tabular only** — event-log-style (who/when/why) data doesn't compress well into a chart; matches the existing Voids tab's current table presentation.

### Claude's Discretion
- Whether `order_item.remove` auditing is called directly from the client mutation (`useRemoveTabItem`) or moved into a new server-side RPC (like `edit_paid_tab`'s pattern) — not decided; planner/research should evaluate against the existing inventory-restore TODO already in `useRemoveTabItem.ts` (a dedicated single-item inventory-restore RPC is already a known gap there, so moving removal server-side may solve two problems at once).
- Exact column set / SQL aggregation approach for the payment-methods and modifier-popularity RPCs.
- Whether the CSV column-config objects live per-widget or in a shared registry.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing report architecture (must match/extend, not replace)
- `src/entities/tab/model/queries-reports.ts` — current client-side report queries (voids, hourly, categories, products, staff, tips, etc.) — the two RPC migrations (voids, peak-hours) must produce data shaped to slot into this file's existing consumers.
- `src/features/export-report/model/useExportReport.ts` — existing per-report Excel/PDF export switch; CSV must plug in alongside this, not replace it.
- `src/shared/lib/exporters/excel.ts` and `src/shared/lib/exporters/pdf.tsx` — existing per-report formatter functions; `hourly-excel`/`hourly-pdf` need updating for the extended `HourlyRow` shape (D-04).
- `src/pages/reports/index.tsx` — ReportsPage tab list; new tabs (deletions ×2, modifier popularity, payment methods) get added here following the existing `Tabs`/`TabsTrigger`/`TabsContent` pattern.
- `src/widgets/ComboMixReport/ComboMixReport.tsx` — the only current Recharts consumer; reference for chart-widget conventions.

### Audit trail gap (D-06, D-07)
- `src/shared/lib/audit-actions.ts` — `AuditActionSchema`, single source of truth for audit action names; add `order_item.remove` here first per its own file header instructions, before any `record_audit()` call uses it.
- `src/features/remove-tab-item/useRemoveTabItem.ts` — current hard-delete, no-audit removal path; also carries a pre-existing TODO about a missing single-item inventory-restore RPC (relevant to the Claude's Discretion note above).
- `src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx` — needs the new required reason field (D-07).
- `src/shared/lib/domain.ts` — `VoidRefundRowSchema`/`HourlyRow` type definitions (both must be extended/reused per D-02, D-04).

### Prior phases this depends on / touches
- Phase 14 (`14-audit-logs-table`) — `audit_logs` table + `record_audit` helper (ROADMAP dependency).
- Phase 18 (split payments) — `payments.payment_group_id`/`split_index`, referenced by the payment-methods report (D-08).
- Phase 23 (reopen closed ticket) — `payments.is_deleted`-style soft-delete pattern was considered and explicitly rejected in favor of D-06's audit-action approach for `order_items` (see "Soft-delete instead of hard delete" option, not selected).

No external specs/ADRs — ROADMAP.md's own §24 source doc ("POS-COMPARISON.md §24") is confirmed no longer present; scope is fully captured in this CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useExportReport`'s Tauri `save()`/`writeFile()` flow — the generic CSV serializer (D-11) reuses this exact file-save mechanism, only the byte-generation step changes.
- `CajaReportPanel` / `get_caja_report` RPC — the only existing RPC-backed report; the model for how the 6 new/migrated RPCs should be wired (react-query hook calling `supabase.rpc(...)`).
- Every existing report widget already uses a consistent `{ rows, dateRange: { from, to } }` context shape — new reports should follow the same convention for consistency with `useExportReport`'s existing type overloads.

### Established Patterns
- One `AuditActionSchema` entry + `record_audit()` call per auditable action (Phase 14 convention) — `order_item.remove` must follow this, not a bespoke logging path.
- Manager-PIN-gated dialogs with a required reason textarea (`VoidOrderDialog`) — `RemoveTabItemDialog`'s new reason field should match this UX, though a PIN gate was not discussed/decided (default: no new PIN gate unless planner finds a reason to add one — removal is lower-stakes than void).
- Recharts is an installed-but-mostly-unused dependency (only 1 current consumer) — no new library needed for D-13/14/15.

### Integration Points
- New RPCs (voids, peak-hours, deletions ×2, modifier-popularity, payment-methods, charts-data) all live in `supabase/migrations/`, following the existing RPC + `supabase gen types typescript` regen workflow (see root CLAUDE.md "Missing generated types workaround").
- New/changed report tabs slot into `src/pages/reports/index.tsx`'s existing `Tabs` structure.

</code_context>

<specifics>
## Specific Ideas

- "Busiest hour" should be visually highlighted in the peak-hours report (not just present in the data) — user confirmed this via the peak-hours extension decision (D-03).
- Deletions report's historical gap (no data before `order_item.remove` auditing ships) must be surfaced in the report UI itself, not just noted in docs — so operators aren't confused by a report that looks incomplete for past dates.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope-creep items were raised.

</deferred>

---

*Phase: 24-operational-reports-suite-csv*
*Context gathered: 2026-07-21*
