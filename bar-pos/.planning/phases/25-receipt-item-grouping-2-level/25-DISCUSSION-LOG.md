# Phase 25: Receipt Item Grouping (2-Level) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 25-receipt-item-grouping-2-level
**Areas discussed:** What the 2 levels actually are, PDF export scope, KDS card grouping, Which receipt text gets grouped

---

## Todo cross-reference

| Todo | Reason matched | Folded? |
|------|-----------------|---------|
| Fix 2 pre-existing tsc errors blocking tauri build CI job | keyword: existing, tauri, shared | No |
| Relocate misplaced GitHub workflows directory to git root | keyword: pos, one, level | No |

**User's response:** Asked for a separate git repo cleanup (push everything, clean local repo, check for unmerged worktrees) — unrelated to receipt grouping. Not folded into Phase 25; noted as a follow-up outside this phase.

---

## What the 2 levels actually are

| Option | Description | Selected |
|--------|-------------|----------|
| Category → Item | Level 1 = product category (Phase 1 tree), Level 2 = individual line items | |
| Item → Modifiers | Level 1 = merged product+quantity line, Level 2 = modifiers | |
| Both — 3 levels effectively | Category → Item → Modifiers; bigger than ROADMAP's literal "2-level" wording | ✓ |

**User's choice:** Both — 3 levels effectively (Category → Item → Modifiers)
**Notes:** User accepted this exceeds the ROADMAP's literal "2-level" text; flagged in CONTEXT.md D-01 for planner awareness.

---

## PDF export scope

| Option | Description | Selected |
|--------|-------------|----------|
| Caja Report topProducts table | Add category grouping to the existing aggregate Caja Report PDF | ✓ |
| New per-order receipt PDF | Build a new PDF export for a single order (doesn't exist today) | |
| Drop PDF from scope | Treat ROADMAP's PDF mention as stale, ship only the other 3 surfaces | |

**User's choice:** Caja Report topProducts table (Recommended)
**Notes:** Confirmed no per-order receipt PDF exists anywhere in the codebase; email receipts are plain text, not PDF.

---

## KDS card grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Show modifiers on each card | Add modifier list to the existing per-item card, no board layout change | ✓ (first pass) |
| Cluster cards by category on the board | Group cards under category section headers within each status column | |
| Both | Category headers + modifiers on cards | |

**User's choice:** Show modifiers on each card (Recommended)

**Follow-up:** Asked whether formatting should match pre-cheque's `+ modifier` style and whether it applies to both `/kds` and `/kds-bar` (they share one `KdsCard` widget).

| Option | Description | Selected |
|--------|-------------|----------|
| Match pre-cheque format, both boards | Reuse `+ modifier` indented style + notes; both boards get it automatically | ✓ |
| Modifiers only, no notes | Skip order notes, keep card compact | |

**User's choice:** Match pre-cheque format, both boards (Recommended)
**Notes:** Confirmed via grep that `/kds` and `/kds-bar` both render the same shared `KdsBoard`/`KdsCard` component — no separate bar-specific card exists.

---

## Which receipt text gets grouped

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Group buildThermalReceiptText + buildPreChequeText; final receipt also gains modifier display it currently lacks | ✓ |
| Final receipt only | Leave buildPreChequeText's existing flat-with-modifiers layout untouched | |

**User's choice:** Both (Recommended)

---

## Claude's Discretion

- Group-by immediate parent category vs. top-level ancestor for multi-level category trees.
- Category-header line formatting within the 32-column thermal layout constraint.
- Handling of products with no/null category ("Uncategorized" group vs. unheaded tail group).
- Category subtotal row placement/styling in the Caja Report PDF (nice-to-have, not required).

## Deferred Ideas

None within phase scope. The "new per-order PDF" option was considered and explicitly declined (see PDF export scope above), not deferred — it's out of scope, not a future-phase candidate, unless a future phase re-scopes it.

The user's git repo cleanup request (see Todo cross-reference above) is a separate follow-up, not a phase-25 deferred idea.
