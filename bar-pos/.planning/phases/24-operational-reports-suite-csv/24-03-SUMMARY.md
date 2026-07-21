---
phase: 24-operational-reports-suite-csv
plan: 03
subsystem: database
tags: [postgres, plpgsql, supabase, rpc, security-definer, reporting]

# Dependency graph
requires:
  - phase: 24-operational-reports-suite-csv (plan 01)
    provides: HourlyRowSchema (dayOfWeek/isBusiest), ModifierPopularityRowSchema, PaymentMethodRowSchema, VoidRefundRowSchema (Zod domain types this plan's RPC output shapes match)
provides:
  - get_peak_hours_report(p_from, p_to) — bounded, day-of-week-grouped hourly report RPC
  - get_voids_report(p_from, p_to) — bounded, VoidRefundRow-shaped voids RPC
  - get_modifier_popularity_report(p_from, p_to) — bounded, unnest-safe modifier ranking RPC
  - get_payment_methods_report(p_from, p_to) — bounded, two-grain (session + day-rollup) payment RPC
affects: [24-04 (deletions RPCs — same pattern), 24-05 (db push), 24-06 (use*Report hooks that call these RPCs)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded date-range report RPC: LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = public, json_build_object('ok', true, 'rows', COALESCE(v_rows, '[]'::json)), GRANT EXECUTE TO authenticated"
    - "unnest(array_column) aggregated in an isolated CTE (exploded -> aggregated by GROUP BY) before any join to a lookup table, to avoid flat-join double-counting"
    - "Two-grain single-query UNION ALL (per-session rows + day-level rollup row) instead of two separate RPC calls"

key-files:
  created:
    - supabase/migrations/20260721000002_peak_hours_and_voids_rpc.sql
    - supabase/migrations/20260721000003_modifier_popularity_rpc.sql
    - supabase/migrations/20260721000004_payment_methods_rpc.sql
  modified: []

key-decisions:
  - "get_voids_report bounds on orders.updated_at (matching the existing client-side query's filter column) rather than orders.created_at, to preserve exact voids-report semantics per D-01/D-02 (zero change to which rows appear)"
  - "Modifier revenue-attributable computed as attach_count * modifiers.price_delta (the modifier's own per-attach price contribution) — there is no separate per-modifier revenue ledger, so this is the only available revenue signal"
  - "payment-methods RPC bounds on payments.processed_at (indexed via idx_payments_processed_at) rather than a tabs/orders created_at column, since payments is the aggregation root and processed_at is its own indexed temporal column"
  - "No separate get_charts_data RPC built (resolves RESEARCH.md Open Question 1) — the three chart-bearing report RPCs (peak-hours, modifier-popularity, payment-methods) are consumed directly by their Recharts widgets"

requirements-completed: [SC-1, SC-4]

coverage:
  - id: D1
    description: "get_peak_hours_report bounded on created_at, grouped by hour + day-of-week, excludes voided/soft-deleted orders"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "grep gate: get_peak_hours_report + SECURITY DEFINER + EXTRACT(DOW + BETWEEN p_from AND p_to + GRANT EXECUTE all present in 20260721000002_peak_hours_and_voids_rpc.sql"
        status: pass
    human_judgment: true
    rationale: "SQL correctness (actual grouping/revenue math) cannot be confirmed by a structural grep alone — the RPC is not yet pushed to the database (Plan 05), so no live query execution was possible in this plan."
  - id: D2
    description: "get_voids_report returns the unchanged VoidRefundRow shape (orderId/voidedAt/staffName/amount/reason), server-side and bounded"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "grep gate: get_voids_report + SECURITY DEFINER present; manual review confirms output column aliases match VoidRefundRowSchema exactly"
        status: pass
    human_judgment: true
    rationale: "Requires a live push + integration test (Plan 06) to confirm the Zod parse succeeds against real rows; not executable in this SQL-authoring plan."
  - id: D3
    description: "get_modifier_popularity_report aggregates unnest(modifier_ids) in an isolated CTE before joining to modifiers, avoiding double-counting"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "grep gate: get_modifier_popularity_report + SECURITY DEFINER + unnest(modifier_ids) + GRANT EXECUTE all present in 20260721000003_modifier_popularity_rpc.sql; manual review confirms exploded -> aggregated CTE ordering precedes the modifiers join"
        status: pass
    human_judgment: true
    rationale: "Double-counting is a runtime/data behavior that only a live query against seeded multi-modifier order_items rows can prove; deferred to Plan 06 integration tests post-push."
  - id: D4
    description: "get_payment_methods_report groups payments by method at two grains (per-session + day rollup), excluding is_deleted and reopened_void rows"
    requirement: "SC-1"
    verification:
      - kind: other
        ref: "grep gate: get_payment_methods_report + SECURITY DEFINER + status IS DISTINCT FROM 'reopened_void' + is_deleted + GRANT EXECUTE all present in 20260721000004_payment_methods_rpc.sql"
        status: pass
    human_judgment: true
    rationale: "Confirming the two-grain UNION ALL produces correct rollup totals requires a live database with seeded payments; deferred to Plan 06 integration tests post-push."

duration: 20min
completed: 2026-07-21
status: complete
---

# Phase 24 Plan 03: Peak-Hours, Voids, Modifier-Popularity & Payment-Methods Report RPCs Summary

**Four SECURITY DEFINER report RPCs (peak-hours, voids, modifier-popularity, payment-methods) each bounded on an indexed timestamp column, promoting `get_caja_report`'s pattern as the canonical shape for every date-ranged report and eliminating the last unbounded client-side report queries.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-21
- **Tasks:** 3
- **Files modified:** 3 (all new migration files)

## Accomplishments
- `get_peak_hours_report(p_from, p_to)` — migrates the client-side hourly-breakdown query to a bounded RPC, adding a `dayOfWeek` grouping column (copied verbatim from 24-PATTERNS.md's pre-written template)
- `get_voids_report(p_from, p_to)` — migrates the client-side voids query to a bounded RPC, preserving the exact `VoidRefundRow` output shape so downstream exporters need zero changes
- `get_modifier_popularity_report(p_from, p_to)` — new RPC ranking modifiers by attach-count + revenue, using an isolated `exploded`/`aggregated` CTE pair to safely aggregate `unnest(modifier_ids)` before joining to `modifiers` (avoids the flat-join double-count pitfall)
- `get_payment_methods_report(p_from, p_to)` — new RPC returning both per-caja-session rows and a day-level rollup per method in a single `UNION ALL` query, carrying the mandatory Phase-23 `status IS DISTINCT FROM 'reopened_void'` exclusion
- Confirmed no separate `get_charts_data` RPC is needed (RESEARCH.md Open Question 1) — the three chart-bearing RPCs above are consumed directly by their Recharts widgets

## Task Commits

Each task was committed atomically:

1. **Task 1: peak_hours + voids RPC migration (D-01..D-03)** - `e79d9ae` (feat)
2. **Task 2: modifier_popularity RPC migration (D-09, Pitfall 4)** - `5583f6e` (feat)
3. **Task 3: payment_methods RPC migration (D-08, reopened_void exclusion)** - `f20418a` (feat)

_No TDD tasks in this plan (SQL migration authoring, not testable via Vitest — verification is structural grep gates + deferred live integration tests in Plan 06)._

## Files Created/Modified
- `supabase/migrations/20260721000002_peak_hours_and_voids_rpc.sql` - `get_peak_hours_report` + `get_voids_report`
- `supabase/migrations/20260721000003_modifier_popularity_rpc.sql` - `get_modifier_popularity_report`
- `supabase/migrations/20260721000004_payment_methods_rpc.sql` - `get_payment_methods_report`

## Decisions Made
- **Voids date bound uses `updated_at`, not `created_at`:** the existing client-side query filters on `updated_at` (with `voided_at` as a display fallback), so the RPC bounds on the same column to guarantee byte-identical row selection versus today's behavior (D-01/D-02 require zero shape/behavior drift).
- **Modifier revenue = `attach_count * modifiers.price_delta`:** there is no per-order-item modifier revenue ledger; the modifier's own `price_delta` times its attach count is the only available revenue-attributable signal, matching `ModifierPopularityRowSchema.revenue`.
- **Payment-methods bounds on `payments.processed_at`:** this is the RPC's own aggregation root and the column already carries `idx_payments_processed_at`, making it the natural (and indexed) date-range anchor rather than joining through `tabs`/`orders` for a `created_at`.
- **No `get_charts_data` RPC:** resolves RESEARCH.md's Open Question 1 — a composite endpoint would duplicate data already returned by the three chart-bearing RPCs (YAGNI).

## Deviations from Plan

None - plan executed exactly as written. All three migrations match their `must_haves` verbatim (SECURITY DEFINER, `SET search_path = public`, `GRANT EXECUTE TO authenticated`, `json_build_object('ok', true, 'rows', ...)` return shape).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. These migrations are authored but **not pushed**; the single blocking `npx supabase db push` for all of Phase 24's new migrations is Plan 05's scope.

## Next Phase Readiness
- All 3 new RPCs (plus the 2 from Plan 04's deletions migrations) are ready for the Plan 05 db push.
- Plan 06's `use*Report` hooks can call `get_peak_hours_report`/`get_voids_report`/`get_modifier_popularity_report`/`get_payment_methods_report` via `db.rpc(...)` once pushed; row shapes are pre-verified against this phase's Zod schemas (Plan 01) by direct column-alias comparison.
- No blockers. Live integration testing (does the SQL actually execute correctly against real data) is explicitly deferred to Plan 06, consistent with this plan's `<verification>` section.

---
*Phase: 24-operational-reports-suite-csv*
*Completed: 2026-07-21*

## Self-Check: PASSED
All created files and task commit hashes verified present on disk / in git log.
