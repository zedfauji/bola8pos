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
  - "Locked open_units + products schema shape (option-a) for plan 27-02 to implement verbatim"
affects: ["27-02-migration-authoring", "27-03..27-08 (every RPC/Zod schema/UI field naming)"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Locked option-a: open_units.product_id references the BOX product (packaged/parent product), not the loose product."
  - "New products columns: parent_product_id uuid NULL REFERENCES products(id) (set on the LOOSE product, pointing at its BOX product), and units_per_package int NULL (set on the BOX product)."
  - "open_units table shape: id, product_id -> products.id [BOX], remaining_count int CHECK (remaining_count >= 0), status text CHECK (status IN ('active','exhausted','void')), opened_by, opened_at, closed_by, closed_at, closed_reason, created_at, updated_at."
  - "D-07's one-active-open-unit-per-product invariant enforced via CREATE UNIQUE INDEX ... ON open_units (product_id) WHERE status = 'active'."
  - "remaining_count counts loose pieces and is documented as distinct from inventory.quantity_on_hand (package-level stock) to prevent future conflation."
  - "Option-a matches 27-RESEARCH.md's Code Examples sketches exactly, so no sketch is invalidated (invalidation only applied if option-b/c had been chosen)."

patterns-established: []

requirements-completed: []

coverage: []

# Metrics
duration: 8min
completed: 2026-07-30
status: complete
---

# Phase 27 Plan 01: Confirm open_units Schema Shape Summary

**Locked the open_units/products schema shape (option-a): open_units.product_id references the BOX product, products.parent_product_id links LOOSE -> BOX, products.units_per_package lives on the BOX, and a partial unique index on (product_id) WHERE status='active' enforces D-07's one-active-unit-per-product invariant.**

## Performance

- **Duration:** 8 min total (5 min to checkpoint halt in prior run + 3 min to finalize)
- **Started:** 2026-07-29T00:00:00Z (approx — see git commit `3b88aa3`)
- **Completed:** 2026-07-30
- **Tasks:** 1/1 completed (Task 1 — the decision checkpoint — resolved)
- **Files modified:** 0 source/migration files (by design — this plan produces no implementation, only a locked decision recorded in this SUMMARY)

## Accomplishments

- Presented the `open_units`/`products` schema-shape decision (D-01/D-07 one-way-door checkpoint) with three options (A/B/C) to the human.
- Human selected **option-a** (the recommended shape, matching 27-RESEARCH.md's A2/A3 assumptions and the `caja_sessions` precedent).
- Locked the exact column list, types, constraints, and linkage direction verbatim below for plan 27-02 to implement without re-deciding.
- Verified no `supabase/migrations/` or `src/` files were created or modified by this plan, satisfying the plan's acceptance criteria.

## Task Commits

1. **Task 1: Confirm the open_units schema shape (D-01/D-07 one-way door)** - `3b88aa3` (docs: halt at checkpoint, awaiting human decision)
2. **Task 1 (resolved): Finalize locked option-a schema shape** - (this commit) (docs: finalize decision)

**Plan metadata:** (this SUMMARY.md commit)

## Files Created/Modified

None — per the plan's `<acceptance_criteria>`, no file under `supabase/migrations/` or `src/` is created or modified by this plan. Only `27-01-SUMMARY.md` is written/finalized.

## Decisions Made

**Locked schema shape (option-a):**

- `open_units.product_id` references the **BOX product** (the packaged/parent product) — not the loose product.
- New `products` columns:
  - `parent_product_id uuid NULL REFERENCES products(id)` — set on the **LOOSE** product, pointing at its BOX product.
  - `units_per_package int NULL` — set on the **BOX** product.
- `open_units` table shape:
  ```
  open_units (
    id,
    product_id            -> products.id [BOX],
    remaining_count int    CHECK (remaining_count >= 0),
    status text            CHECK (status IN ('active', 'exhausted', 'void')),
    opened_by,
    opened_at,
    closed_by,
    closed_at,
    closed_reason,
    created_at,
    updated_at
  )
  ```
- D-07's "one active open unit per product" invariant is enforced via a partial unique index:
  `CREATE UNIQUE INDEX ... ON open_units (product_id) WHERE status = 'active'`.
- `remaining_count` counts loose *pieces* and must be documented as distinct from `inventory.quantity_on_hand` (which tracks package-level stock) so no future plan conflates the two.
- Since option-a matches 27-RESEARCH.md's existing `## Code Examples` sketches exactly, none of those sketches are invalidated (the invalidation clause in the plan's acceptance criteria only applies if option-b or option-c had been selected).

## Deviations from Plan

None - plan executed exactly as written. The checkpoint was resolved with the recommended option (option-a) as presented; no amendments to column names were requested.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Unblocked.** Plan 27-02 (migration authoring) can now author its migration directly from the locked schema shape recorded above — table name, every column name and type, the status value set, both new `products` column names, and the partial unique index — without re-reading the options or re-deciding anything.

## Self-Check: PASSED

- Verified branch `worktree-agent-a1774b3508979b36e` and prior commit `3b88aa3` exist: `git log --oneline` confirms `3b88aa3` present on this branch.
- Verified no `supabase/migrations/` or `src/` files were touched by this plan: `git status --porcelain supabase/migrations src` reports no changes attributable to this plan.

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-30*
