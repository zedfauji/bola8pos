# Phase 24: Operational Reports Suite + CSV - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 24-Operational Reports Suite + CSV
**Areas discussed:** Voids & peak-hours RPC scope, "Deletions" report definition (×2 variants), New reports: payment methods & modifier popularity, CSV export shape + which reports get charts

---

## Voids & peak-hours RPC scope

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to RPC | Move existing client-side voids query into a server RPC | ✓ |
| Leave as-is, skip | Treat voids as already satisfied, skip it | |

**User's choice:** Migrate to RPC.

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate + extend as RPC | Move to RPC, add busiest-hour/day-of-week | ✓ |
| Migrate only, same shape | Move to RPC, no new fields | |
| Leave as-is, skip | Treat as already satisfied | |

**User's choice:** Migrate + extend as RPC.

| Option | Description | Selected |
|--------|-------------|----------|
| Same shape | VoidRefundRow unchanged, zero exporter changes | ✓ |
| Shape changes | Requires schema + exporter updates | |

**User's choice:** Same shape.

| Option | Description | Selected |
|--------|-------------|----------|
| UI-only summary | HourlyRow unchanged, summary derived in UI | |
| Extend HourlyRow | Add fields to HourlyRow itself, update schema + exporters | ✓ |

**User's choice:** Extend HourlyRow.

**Notes:** Both voids and peak-hours already exist as client-side queries; ROADMAP called for "new" RPCs for both. Resolved as migration, not net-new build.

---

## "Deletions" report definition (×2 variants)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-send vs. post-close | Item removal before kitchen vs. edit_paid correction after close | ✓ |
| With-reason vs. without-reason | Split by whether a reason was captured | |
| By actor role | Bartender-initiated vs. manager/admin-initiated | |

**User's choice:** Pre-send vs. post-close.

**Blocker found during discussion:** `useRemoveTabItem` hard-deletes `order_items` with zero audit trail.

| Option | Description | Selected |
|--------|-------------|----------|
| Add order_item.remove audit action | New AuditActionSchema entry + record_audit call | ✓ |
| Soft-delete instead of hard delete | Add deleted_at/is_deleted column, more invasive | |
| Drop pre-send variant, only report post-close | Redefine scope to avoid the gap | |

**User's choice:** Add order_item.remove audit action.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, require reason | Add reason textarea to RemoveTabItemDialog | ✓ |
| No, log without reason | Keep dialog unchanged | |

**User's choice:** Yes, require reason.

**Notes:** This was a genuine implementation blocker surfaced by scouting the codebase, not a preference question — the report as scoped literally cannot be built for historical data without this fix.

---

## New reports: payment methods & modifier popularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-day totals by method | One row per method per day | |
| Per-caja-session breakdown | Grouped by caja session | |
| Both — session rows, day totals | Session-level rows + day rollup | ✓ |

**User's choice:** Both — session rows, day totals.

| Option | Description | Selected |
|--------|-------------|----------|
| Attach count | Rank by selection count | |
| Revenue attributable | Rank by $ contribution | |
| Both columns, sort by count | Show both, default sort by count | ✓ |

**User's choice:** Both columns, sort by count.

| Option | Description | Selected |
|--------|-------------|----------|
| Top 20 | Capped in-UI, full data via export | ✓ |
| Full list | No cap in UI | |

**User's choice:** Top 20.

**Notes:** Payment methods ties into Phase 18's payment_group_id/split_index. Modifier popularity mirrors ComboMixReport's existing count-based ranking.

---

## CSV export shape + which reports get charts

| Option | Description | Selected |
|--------|-------------|----------|
| Generic rows→CSV serializer | One function, column config, reused everywhere | ✓ |
| Per-report CSV functions | Mirror existing Excel/PDF per-report pattern | |

**User's choice:** Generic rows→CSV serializer.

| Option | Description | Selected |
|--------|-------------|----------|
| Peak-hours — bar chart by hour | | ✓ |
| Payment methods — pie/donut | | ✓ |
| Modifier popularity — horizontal bar | | ✓ |
| Voids / deletions — stay tabular | | ✓ |

**User's choice:** All four (multiSelect) — peak-hours bar, payment-methods donut, modifier-popularity horizontal bar, voids/deletions stay tabular.

| Option | Description | Selected |
|--------|-------------|----------|
| All tabs, this phase | CSV wired onto all 17 report tabs | ✓ |
| New/migrated reports only | CSV only on the 6 new/migrated reports | |

**User's choice:** All tabs, this phase.

**Notes:** Recharts is installed (`^3.8.1`) but only used in ComboMixReport today — no new dependency needed.

---

## Claude's Discretion

- Whether `order_item.remove` auditing is called client-side or moved into a new server-side RPC (may also resolve the pre-existing inventory-restore TODO in `useRemoveTabItem.ts`).
- Exact SQL aggregation/column set for payment-methods and modifier-popularity RPCs.
- Whether CSV column-config objects live per-widget or in a shared registry.
- Whether a manager PIN gate is added to `RemoveTabItemDialog` alongside the new reason field (not discussed; default is no new gate).

## Deferred Ideas

None — discussion stayed within phase scope, no scope-creep items raised.
