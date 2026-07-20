# Phase 23: Reopen Closed Ticket - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 23-Reopen Closed Ticket
**Areas discussed:** Payment status modeling, Reopen cap window, RBAC gate, Post-reopen flow, Split payments, Reopen count tracking

---

## Payment status modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Add `payments.status` column | New enum column (e.g. `'completed'`/`'reopened_void'`), default `'completed'`. Explicit, queryable, matches ROADMAP wording literally. | ✓ |
| Reuse `isRefund`-style boolean flag | Add `payments.is_reopened_void` boolean instead of a status enum — smaller schema change but two independent booleans is messier long-term. | |

**User's choice:** Add `payments.status` column.
**Notes:** `payments` table has no status column today — only `isRefund: boolean`. This is D-01 in CONTEXT.md.

---

## Reopen cap window

| Option | Description | Selected |
|--------|-------------|----------|
| 24h from original close; hard cap 2, ever | Reopen only within 24h of the tab's original close, capped at 2 total, no reset. | |
| 24h from most recent reopen; hard cap 2, ever | Each reopen restarts the 24h clock, still capped at 2 total. | ✓ |

**User's choice:** 24h from most recent reopen; hard cap 2, ever.
**Notes:** Captured as D-02/D-03 in CONTEXT.md.

---

## RBAC gate

| Option | Description | Selected |
|--------|-------------|----------|
| Manager+ (same as edit_paid_tab/refund) | Consistent with existing manager-pin-gate pattern. | ✓ |
| Admin only | Reopening is more severe than editing — restrict to admin. | |

**User's choice:** Manager+ (same as edit_paid_tab/refund).
**Notes:** Captured as D-04 in CONTEXT.md.

---

## Post-reopen flow

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fully normal open tab | Reopened tab behaves like any other open tab; use existing add/remove-item and close/payment features. | ✓ |
| Read-only reopen, edit via edit_paid_tab only | Reopen only flips status for record-keeping; corrections still go through edit_paid_tab's whitelist. | |

**User's choice:** Yes — fully normal open tab.
**Notes:** Captured as D-06 in CONTEXT.md.

---

## Split payments

| Option | Description | Selected |
|--------|-------------|----------|
| All non-refund payment rows for the tab | Every completed payment leg (payment_group_id siblings) flips to reopened_void; refund rows untouched. | |
| Claude's discretion / research decides | Let research confirm against the actual split-payment schema before locking this. | ✓ |

**User's choice:** Claude's discretion / research decides.
**Notes:** Captured as D-05 in CONTEXT.md, with a default assumption noted (all non-refund payment_group_id siblings flip) unless research finds a reason otherwise.

---

## Reopen count tracking

| Option | Description | Selected |
|--------|-------------|----------|
| New `tabs.reopen_count` column | Explicit counter, incremented atomically under the same row lock as the version check. | ✓ |
| Derive from audit_logs count | No schema change — count `tab.reopen` audit_logs rows at cap-check time. | |

**User's choice:** New `tabs.reopen_count` column.
**Notes:** Captured as D-03 in CONTEXT.md.

---

## Claude's Discretion

- Which non-refund payment rows flip to `reopened_void` on a split-payment tab (per Split Payments area above).
- Exact new-column names (`tabs.reopen_count`, `tabs.last_reopened_at` or equivalent).
- Whether `payments.status` gets any values beyond `'completed'`/`'reopened_void'` in this pass (default: keep minimal).
- Whether the offsetting caja entry adds `source_tab_id`/`source_type` columns or continues Phase 22's free-text `concept` encoding (default: continue free-text).

## Deferred Ideas

None — discussion stayed within phase scope.
