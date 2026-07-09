---
phase: 19-tip-distribution-config
plan: 01
subsystem: domain
tags: [zod, domain-types, fast-check, tip-distribution, settings]

# Dependency graph
requires: []
provides:
  - "TipDistribution config Zod schema + TipDistributionEntry row Zod schema in domain.ts"
  - "'tip_distribution' SettingsKey literal + registry entry"
  - "computeTipDistribution: pure, property-tested largest-remainder split oracle"
affects: [19-02-db-layer, 19-04-settings-entity-caja-hook, 19-05-settings-tab-report-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Largest-remainder integer-cent split with deficit cascaded floor>bar>kitchen when oversum percentages would otherwise yield a negative bucket"

key-files:
  created:
    - src/shared/lib/tip-distribution-math.ts
    - src/shared/lib/tip-distribution-math.test.ts
  modified:
    - src/shared/lib/domain.ts

key-decisions:
  - "computeTipDistribution is the authoritative reference oracle for Plan 02's PL/pgSQL port — property-tested with fast-check, not just example-based"

requirements-completed: [SC-1, SC-2]

# Metrics
duration: 25min
completed: 2026-07-09
---

# Phase 19 Plan 01: Tip Distribution Math Contract Summary

**Zod schemas for the tip-distribution config and per-caja-close entry row, plus `computeTipDistribution` — a pure, property-tested largest-remainder split function that serves as the authoritative oracle for Plan 02's SQL implementation.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2

## Accomplishments
- Added `TipDistributionSchema` (floor/bar/kitchen percentages) and `TipDistributionEntrySchema` (per-caja-close immutable row: percentages + computed bucket amounts) to `domain.ts`, plus the `'tip_distribution'` `SettingsKey` literal and registry entry
- Implemented `computeTipDistribution` in `tip-distribution-math.ts`: pools total tips, splits via largest-remainder allocation with a deterministic floor>bar>kitchen tiebreak
- Property-tested with fast-check (TDD RED then GREEN) — 7/7 tests pass, including a fast-check-discovered edge case

## Task Commits

1. **Task 1: Zod schemas + SettingsKey registry entry** - `098b12d` (feat)
2. **Task 2 RED: failing property tests** - `0391126` (test)
3. **Task 2 GREEN: computeTipDistribution implementation** - `0018606` (feat)

## Files Created/Modified
- `src/shared/lib/domain.ts` - `TipDistributionSchema`, `TipDistributionEntrySchema`, `'tip_distribution'` SettingsKey + registry entry
- `src/shared/lib/tip-distribution-math.ts` - `computeTipDistribution` pure function
- `src/shared/lib/tip-distribution-math.test.ts` - fast-check property tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Naive largest-remainder allocation could return a negative bucket amount**
- **Found during:** Task 2, fast-check property testing
- **Issue:** `computeTipDistribution`'s naive "remainder to largest bucket" step could return a negative bucket for pathological oversum percentage configs (e.g., floor=bar=kitchen=90%, summing to 270% — schema-legal per D-01's no-sum-validation rule). A negative amount would fail `MoneySchema.nonnegative()` on `TipDistributionEntrySchema` when parsed downstream.
- **Fix:** Cascaded the deficit down from buckets in floor>bar>kitchen priority order, clamped at 0 per bucket.
- **Verification:** fast-check counterexample no longer reproduces; 7/7 tests pass.
- **Flagged for:** Plan 02's author must carry the same fix into the PL/pgSQL RPC implementation.

## Issues Encountered

- **Planning-doc location gap:** This worktree's checkout did not contain `.planning/phases/19-tip-distribution-config/` (bar-pos's `.gitignore` ignores `.planning/` for files not already tracked before that rule was added). Read plan/context files directly from the main checkout instead. Also copied `.env.local` from the main checkout into the worktree so `vitest`/`npm run test` could run (global test setup requires live Supabase reachability even for pure unit tests). Neither file was staged.
- **SUMMARY.md commit originally skipped:** In the worktree, `git add` on this file was refused by git (path is gitignored) and the agent did not force-add per the parallel-execution instructions ("do NOT force-add"). The worktree was cleaned up before the file could be manually recovered from it, so this SUMMARY.md was reconstructed by the orchestrator from the executor's final report text rather than copied byte-for-byte from the worktree.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02 can rely on `TipDistributionSchema`, `TipDistributionEntrySchema`, and the `'tip_distribution'` SettingsKey being defined in `domain.ts`.
- Plan 02's SQL implementation MUST replicate the deficit-cascade fix (floor>bar>kitchen, clamped at 0) documented above to stay consistent with the oracle.

---
*Phase: 19-tip-distribution-config*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/shared/lib/domain.ts
- FOUND: src/shared/lib/tip-distribution-math.ts
- FOUND: src/shared/lib/tip-distribution-math.test.ts
- FOUND commit: 098b12d (Task 1)
- FOUND commit: 0391126 (Task 2 RED)
- FOUND commit: 0018606 (Task 2 GREEN)

**Note:** Reconstructed post-hoc by the orchestrator from the executor agent's final report — the original file was lost when its worktree was force-cleaned before recovery (see Issues Encountered).
