---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 01
subsystem: database
tags: [supabase, postgres, schema-decision, open-units]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-CONTEXT.md D-01/D-07 locked decisions, 27-RESEARCH.md A2/A3 assumptions"
provides:
  - "Pending: confirmed open_units + products schema shape (human decision not yet made)"
affects: ["27-02-migration-authoring", "27-03..27-08 (every RPC/Zod schema/UI field naming)"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "None yet — this plan is a checkpoint:decision gate that halted awaiting human selection of option-a/b/c for the open_units schema shape (D-01/D-07 physical implementation)."

patterns-established: []

requirements-completed: []

coverage: []

# Metrics
duration: 5min
completed: 2026-07-29
status: checkpoint
---

# Phase 27 Plan 01: Confirm open_units Schema Shape Summary

**Execution halted at the plan's single `checkpoint:decision` task — awaiting human selection of the `open_units`/`products` schema shape before any migration is authored (one-way door on Supabase Cloud, no rollback).**

## Performance

- **Duration:** 5 min (up to checkpoint)
- **Started:** 2026-07-29T00:00:00Z (approx — see git commit timestamp)
- **Tasks:** 0/1 completed (Task 1 is the checkpoint itself; no tasks executed after it)
- **Files modified:** 0 (no `supabase/migrations/` or `src/` changes — by design, per plan's acceptance criteria)

## Accomplishments

- Read and cross-referenced 27-CONTEXT.md (D-01, D-02, D-07, Claude's Discretion), 27-RESEARCH.md (Assumptions Log A2/A3, Code Examples), 27-PATTERNS.md (`caja_sessions` analog), the referenced migration (`supabase/migrations/20260420000002_caja_sessions.sql`), and `src/shared/lib/domain.ts` (`InventorySchema`, lines 679-699) to prepare the decision context.
- Verified no source or migration files were touched, satisfying the plan's acceptance criteria that this plan produces no implementation artifacts.
- Reached the plan's sole task (`checkpoint:decision`, `gate="blocking"`) and halted per plan instructions — this decision has a one-way-door reversibility rating once pushed to Supabase Cloud, so it is not eligible for auto-selection even though `workflow._auto_chain_active` and `workflow.auto_advance` are both `false` in `.planning/config.json` (auto mode is not active in this run regardless).

## Task Commits

No task commits — the plan's only task is a `checkpoint:decision` that halts execution before any file changes are made. This SUMMARY.md itself is the only artifact committed for this plan invocation.

**Plan metadata:** (this SUMMARY.md commit)

## Files Created/Modified

None — per the plan's `<acceptance_criteria>`, no file under `supabase/migrations/` or `src/` may be created or modified by this task.

## Decisions Made

None yet. The decision is **pending human input** — see "Checkpoint Details" below for the three options presented.

## Deviations from Plan

None - plan executed exactly as written up to the checkpoint.

## Issues Encountered

None. This is the expected, planned outcome for a non-autonomous decision plan (`autonomous: false`) — the plan exists solely to gate the human before an irreversible schema push, per the plan's own `<objective>`.

## Checkpoint Details (for resume)

**Decision:** The exact, final shape of the `open_units` table and the two new `products` columns — specifically: (a) which product `open_units.product_id` references, (b) where the loose-piece-to-package link lives, (c) the remaining-count column name, (d) the `status` value vocabulary.

**Options:**
- **option-a (recommended):** `open_units.product_id` references the BOX product; link lives on `products.parent_product_id`. Shape: `open_units(id, product_id -> products.id [BOX], remaining_count int CHECK >= 0, status text CHECK IN ('active','exhausted','void'), opened_by, opened_at, closed_by, closed_at, closed_reason, created_at, updated_at)`; `products.units_per_package int NULL` (set on BOX); `products.parent_product_id uuid NULL REFERENCES products(id)` (set on LOOSE).
- **option-b:** `open_units.product_id` references the LOOSE product instead. Rejected by 27-RESEARCH.md — breaks D-07's per-product invariant framing.
- **option-c:** No `products.parent_product_id`; loose-product link lives on `open_units` (e.g. `open_units.loose_product_id`). Rejected by 27-RESEARCH.md — forces a second lookup for "is this product a loose piece" on the order-entry hot path.

**Resume signal:** Select `option-a`, `option-b`, or `option-c` (with any column-name amendments stated explicitly). If B or C is selected, the resuming agent must additionally record which of 27-RESEARCH.md's `## Code Examples` sketches are now invalid so plan 27-02 does not copy them verbatim.

## User Setup Required

None - no external service configuration required. This is a decision checkpoint, not a service integration.

## Next Phase Readiness

**Blocked.** Plan 27-02 (migration authoring) cannot proceed until this decision is resolved — the resolution must be transcribed verbatim (literal column list, not prose paraphrase) into a re-run of this plan's SUMMARY.md before 27-02 starts.

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-29 (checkpoint halt, not final completion)*
