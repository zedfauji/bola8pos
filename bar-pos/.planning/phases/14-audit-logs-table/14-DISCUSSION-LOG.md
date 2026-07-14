# Phase 14: Audit Logs Table - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 14-audit-logs-table
**Areas discussed:** Initial scoping, RPC wiring scope, /audit page UX, Existing partial code, Truncation + edge function coverage

---

## Initial Scoping

Before gray-area discussion, codebase scout found substantial pre-existing but untracked work: `audit_logs` table, `record_audit` RPC, 4/11 target RPCs wired, `json-diff.ts`/`JsonDiffViewer`, `entities/audit-log/`, `audit-actions.ts`, E2E spec — none reflected in ROADMAP.md (unchecked) or a phase dir. STATE.md log even has a "Phase 14 PLAN.md complete" entry from 2026-04-28, but no plan files exist on disk.

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as completion phase | Discuss only what's left, skip vision questions already answered by existing code | |
| Full re-discuss | Discuss phase from scratch, ignore partial-build signals | ✓ |
| Pause — investigate first | Stop and investigate why untracked before deciding | |

**User's choice:** Full re-discuss.
**Notes:** Claude still surfaced the existing code as annotations during each area's questions rather than ignoring it outright, since it's directly relevant to concrete options (e.g. Sheet pattern reuse, RPC list already partially done).

---

## RPC Wiring Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All remaining 8 | void_order, close_tab, transfer_tab, produce_prep_batch, update_role_permission, force_pin_change, manual_stock_movement, caja_open | ✓ |
| Priority subset only | Only RPCs blocking Phase 22/23 | |
| You decide | Claude picks based on downstream deps | |

**User's choice:** All remaining 8.

| Option (caja.open) | Description | Selected |
|--------|-------------|----------|
| Add caja_open RPC | New SECURITY DEFINER RPC wrapping the INSERT | ✓ |
| Client-side audit call | Direct INSERT + separate frontend record_audit call | |
| Defer caja.open entirely | Leave unaudited | |

**User's choice:** Add caja_open RPC.

---

## /audit Page UX

| Option (Diff viewer placement) | Description | Selected |
|--------|-------------|----------|
| Sheet (slide-in) | Matches SplitTabSheet/RefundSheet pattern | ✓ |
| Modal dialog | Centered overlay | |
| Inline expand | Row expands in-place | |

**User's choice:** Sheet (slide-in).

| Option (Pagination) | Description | Selected |
|--------|-------------|----------|
| Infinite scroll (locked) | Per roadmap success criteria #6 | ✓ |
| Reconsider — traditional pages | Numbered pagination | |

**User's choice:** Infinite scroll (locked).

| Option (Filters) | Description | Selected |
|--------|-------------|----------|
| Use roadmap's 5 filters as-is | action, entity_type, actor, date range, free text | ✓ |
| Add terminal_id / source filter | Extra filter for tracing terminal/edge-fn origin | |

**User's choice:** Use roadmap's 5 filters as-is.

**Notes:** No response to the "more questions / next area" check after 60s — Claude proceeded to the next area per tool guidance.

---

## Existing Partial Code — Reuse or Rebuild

No response after 60s (user away from keyboard). Claude proceeded with the recommended options.

| Option (Reuse) | Description | Selected (assumed) |
|--------|-------------|----------|
| Reuse as-is | Extend existing files, no rewrite | |
| Audit first, then reuse | Verify files still match current schema/RLS before building on them | ✓ (assumed — no explicit confirmation) |

| Option (E2E spec) | Description | Selected (assumed) |
|--------|-------------|----------|
| Update existing spec | Restore order.void test, add new-RPC coverage | ✓ (assumed — no explicit confirmation) |
| Rewrite from scratch | Start clean | |

**Notes:** Flagged in CONTEXT.md for a quick confirm during planning.

---

## Truncation + Edge Function Coverage

No response after 60s (user away from keyboard). Claude proceeded with the recommended options.

| Option (Truncation display) | Description | Selected (assumed) |
|--------|-------------|----------|
| Banner + partial diff | Warning banner + partial before/after JSON | ✓ (assumed — no explicit confirmation) |
| You decide | Claude picks during planning | |

| Option (Edge fn coverage) | Description | Selected (assumed) |
|--------|-------------|----------|
| Audit all sensitive edge functions | Grep + wire recordAudit into all uncovered sensitive functions | ✓ (assumed — no explicit confirmation) |
| You decide | Researcher/planner determines list | |

**Notes:** Flagged in CONTEXT.md for a quick confirm during planning.

---

## Claude's Discretion

- Terminal_id/source filter addition to /audit (default: no, unless discovery shows strong need)
- Exact wiring order/waves for the 8 remaining RPCs
- Truncation banner component styling

## Deferred Ideas

None — discussion stayed within phase scope.
