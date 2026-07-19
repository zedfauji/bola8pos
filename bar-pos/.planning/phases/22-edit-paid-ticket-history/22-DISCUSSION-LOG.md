# Phase 22: Edit Paid Ticket + History - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 22-Edit Paid Ticket + History
**Areas discussed:** Whitelist scope, Caja impact, Edit eligibility, History view

---

## Whitelist scope

| Option | Description | Selected |
|--------|-------------|----------|
| Item qty/price only | Adjust quantity or unit price on existing order_items — no adding/removing items, no discount/notes fields. | ✓ |
| Add/remove items too | Full item-list edit: add new items, remove existing ones, plus qty/price. | ✓ |
| Notes/discount only | Non-financial-total fields only. | ✓ |
| Claude picks the safest default | Recommendation requested, with tradeoff explanation. | ✓ |

**User's choice:** All four options selected simultaneously — since the first three are mutually exclusive scope levels, this was read as "give the broadest whitelist (all three combined) and use judgment on exact columns," not a literal request to somehow implement four contradictory scopes.
**Notes:** Captured in CONTEXT.md D-01 as a broad whitelist (item qty/price + add/remove + notes/discount), with the exact column list left to research/planner.

---

## Caja impact

| Option | Description | Selected |
|--------|-------------|----------|
| Offsetting caja entry | Editing can change totals; a caja adjustment entry records the delta, mirroring Phase 23's reopen/offset pattern. | ✓ |
| Whitelist avoids totals entirely | Only non-total-affecting fields editable, sidesteps caja reconciliation. | |
| Not sure — Claude should research and propose | | |

**User's choice:** Offsetting caja entry.
**Notes:** No existing "offsetting entry" code precedent — closest is `caja_entries` table (manual caja entries). Captured in CONTEXT.md D-02, flagged for research since Phase 23 will need the same concept.

---

## Edit eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| Any paid tab, any time | No time or caja-session-state restriction. | ✓ |
| Same-day / same caja-session only | Locked once caja closes. | |
| Time-capped like Phase 23 | Mirror Phase 23's 24h window. | |

**User's choice:** Any paid tab, any time.
**Notes:** Implies the offsetting entry (from the Caja impact answer) must be able to land in the *current* open caja session even when editing a tab from an already-closed session — flagged as a research question in CONTEXT.md D-03.

---

## History view

| Option | Description | Selected |
|--------|-------------|----------|
| Before/after diff table | Per-edit row: field, old value, new value, who, when, reason. | ✓ |
| Plain audit-log style list | Reuses existing AuditLogTable pattern. | |
| New tab inside existing /audit page | Filtered view/tab within existing /audit page. | |

**User's choice:** Before/after diff table.
**Notes:** Existing `AuditLogTable` doesn't natively support structured diffs — research must evaluate schema options (new dedicated table vs. structured JSON in `audit_logs`). Captured in CONTEXT.md D-04.

---

## Claude's Discretion

- Exact whitelisted column list for `edit_paid_tab`.
- Whether `/edit-history` is a standalone route or reuses `AuditLogTable`'s shell.
- Whether the caja-offsetting mechanism is a new RPC/table or extends `caja_entries`.
- RBAC gate (manager+) — not re-discussed, already pinned by ROADMAP wording ("Allow managers to...").

## Deferred Ideas

None — discussion stayed within phase scope. Phase 23 (Reopen Closed Ticket) was referenced only as shared-mechanism context for the caja-offsetting question, not pulled into this phase's scope.
