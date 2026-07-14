# Phase 19: Tip Distribution Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 19-tip-distribution-config
**Areas discussed:** Percentage validation, Rounding/remainder, Entry timing & immutability, Settings UI placement, Staff-tip relationship

---

## Percentage validation

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-block, must = 100% | Save disabled / RPC rejects unless sum exactly 100 | |
| Warn but allow | UI warns if sum ≠ 100% but admin can still save | ✓ |
| No validation | Any 3 numbers allowed | |

**User's choice:** Warn but allow
**Notes:** None.

---

## Rounding/remainder

| Option | Description | Selected |
|--------|-------------|----------|
| Largest bucket absorbs remainder | Round down each bucket, leftover cents to bucket with largest % | ✓ |
| Floor bucket always absorbs | Fixed rule: floor always gets remainder | |
| House/unallocated bucket | Remainder goes to untracked 4th bucket | |

**User's choice:** Largest bucket absorbs remainder
**Notes:** None.

---

## Entry timing & immutability

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot at close time | Close-caja reads current config, writes immutable entries | ✓ |
| Live recompute on view | Entries store raw totals, % applied at view time | |

**User's choice:** Snapshot at close time
**Notes:** Follow-up question asked whether entries can be manually corrected post-close.

| Option | Description | Selected |
|--------|-------------|----------|
| No — fully automatic, immutable | Only close-caja writes entries, no manual edit UI | ✓ |
| Admin can correct after close | Admin-only edit path with audit_log entry | |

**User's choice:** No — fully automatic, immutable

---

## Settings UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| New Settings tab | Dedicated "Tip Distribution" tab in SettingsTabsPanel | ✓ |
| Section inside BillingSettingsTab | Add section to existing tab (already has unrelated tip fields) | |

**User's choice:** New Settings tab
**Notes:** Follow-up question asked where the computed distribution shows on reports.

| Option | Description | Selected |
|--------|-------------|----------|
| New section on existing caja report | Add to get_caja_report / Reports page caja-close view | |
| Separate panel/tab | Own report panel, similar to existing TipDistributionPanel | ✓ |

**User's choice:** Separate panel/tab

---

## Staff-tip relationship (explored as an additional gray area)

| Option | Description | Selected |
|--------|-------------|----------|
| Fully independent | Bucket totals unrelated to existing per-staff TipDistributionPanel/useStaffTips | |
| Feeds into staff report | Bucket totals further divided among staff clocked into that role | ✓ (then narrowed) |

**User's choice:** Feeds into staff report (conceptually) — narrowed by follow-up.

**Follow-up:** How should a bucket's total be divided among staff working that role?

| Option | Description | Selected |
|--------|-------------|----------|
| Equal split among clocked-in staff | Bucket total ÷ number of staff with that role | |
| Weighted by hours worked | Proportional to clocked hours | |
| Out of scope for this phase | Only compute/store 3-bucket totals; per-staff split deferred | ✓ |

**User's choice:** Out of scope for this phase
**Notes:** Per-staff sub-division moved to Deferred Ideas in CONTEXT.md. `TipDistributionPanel`/`useStaffTips` stays independent for now.

---

## Claude's Discretion

- Exact table/column naming (`tip_distribution_config`, `tip_distribution_entries`)
- Singleton enforcement pattern (single-row table vs key/value) — check `receipt_settings` as analog
- Numeric precision for percentage/amount columns (follow `payments.tip_amount NUMERIC(10,2)` convention)
- Whether close-caja RPC extension is inline or a new function
- Deterministic tiebreak rule if two buckets tie for largest percentage

## Deferred Ideas

- Per-staff sub-division of bucket totals (equal split vs hours-weighted) — future phase.
- Payment-method scope for tip pooling (e.g. whether rappi tips should be excluded) — raised as a candidate area, not explored; flagged in CONTEXT.md for research/planning to confirm if it becomes material.
