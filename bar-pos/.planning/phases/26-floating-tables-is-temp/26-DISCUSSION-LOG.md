# Phase 26: Floating Tables (`is_temp`) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 26-floating-tables-is-temp
**Areas discussed:** Schema generalization scope, Numbering for floating tables, Auto-deactivate trigger, Waitlist auto-create flow

---

## Schema generalization scope

| Option | Description | Selected |
|--------|-------------|----------|
| Additive extension (Recommended) | Keep `pool_tables` table/entity name; add `is_temp` column + extend `table_type` CHECK with `'floating'`. Matches project's established convention, low blast radius. | |
| Full rename to `resources` | Rename table, entity folder, RLS, realtime, ~18 call sites. Bigger diff but matches ROADMAP's literal wording and a broader future resources concept. | ✓ |

**User's choice:** Full rename to `resources`.
**Notes:** Follow-up clarified rename *depth* — see next entry.

---

## Rename depth (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Schema/entity only (Recommended) | DB table, entity folder, internal code renamed. Routes/nav/page titles stay "Pool Tables"/`/pool-tables`. | ✓ |
| Full rename, user-facing too | Routes become `/resources`, nav/copy/i18n updated, e2e selectors updated. | |

**User's choice:** Schema/entity only.
**Notes:** Billiard tables remain the dominant, most-visible use case — no need to rebrand the product surface for an internal schema generalization.

---

## Numbering for floating tables

| Option | Description | Selected |
|--------|-------------|----------|
| Next sequential number (Recommended) | Reuse existing "Add Table" convention (max+1). Requires bumping the Zod `.max(30)` cap. | |
| Reserved high-range block | Numbers from a reserved range (e.g. 900+) so floating tables are visually distinct by number alone. | (initially selected, then reversed) |

**User's choice (final, after clarification):** Just give it the next number — same as the existing "Add Table" flow. No reserved range.
**Notes:** User initially picked the reserved high-range option but then pushed back — "do not hardcode this. i do not understand what the ehll is this. 900 is too much." A plain-language follow-up clarified the actual trade-off (next number vs. a deliberately different range purely to be visually distinct), and the user chose the simpler option, explicitly rejecting the arbitrary 900 starting point as over-engineering. Visual distinction (if any) is now a separate badge/UI concern, not a numbering concern — left to Claude's discretion.

---

## Auto-deactivate trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On session/tab close (Recommended) | DB trigger fires immediately when the floating table's session/tab closes; soft-deletes the row (existing soft-delete pattern). | ✓ |
| Idle-timeout based | Table stays available for a grace period before a scheduled/trigger-based check deactivates it. | |

**User's choice:** On session/tab close.
**Notes:** Simpler event-driven trigger over a time-based/cron approach. Soft-delete (not hard-delete) chosen to respect `pool_sessions.table_id ... ON DELETE RESTRICT` and preserve historical report data.

---

## Waitlist auto-create flow

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit staff action + inherit standard rate (Recommended) | Distinct "Seat at a new temporary table" button in the existing empty state; new table gets the same default rate as manual "Add Table". | ✓ |
| Silent auto-create, no separate button | Table created and assigned automatically the moment staff attempt to seat with none available. | |

**User's choice:** Explicit staff action + inherit standard rate.
**Notes:** No silent background table creation — staff must explicitly opt in via a visible action.

---

## Claude's Discretion

- Visual marker (e.g. "Temp"/"Floating" badge) to distinguish a floating table from a real one at a glance — keyed off the `is_temp` flag; exact styling left to planning.
- New upper bound (or removal) for `PoolTableSchema.number`'s current `.max(30)` cap now that floating tables push past a small fixed venue count.
- Sequencing of the entity/schema rename (one wave vs. schema-first/call-sites-after) — a planning concern.

## Deferred Ideas

None — discussion stayed within phase scope. 4 loose keyword-match todos (tsc CI errors, misplaced GitHub workflows dir, print-popup Playwright hang, Caja Report PDF export outside Tauri) were reviewed via `cross_reference_todos` but scored too low (≤0.4) and are unrelated to floating tables — not presented to the user, noted here for completeness.
