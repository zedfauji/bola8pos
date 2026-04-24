---
plan_id: 03
phase: 1
wave: 2
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [S1-06]
depends_on: [02-migrations-PLAN.md]
status: ready
---

# Plan 03 — Regenerate types + Zod (`domain.ts`)

## Goal (backward from phase)

All TypeScript and runtime validation must **reflect the real schema** after migrations: `supabase.types.ts` generated from local DB, and **Zod** schemas in `bar-pos/src/shared/lib/domain.ts` extended so feature code uses **inferred types only** (per PRD — no parallel hand-written domain interfaces for these shapes).

This plan is the **single fan-in** for type regen (PRD execution notes).

---

## Preconditions

- Plans **02** complete: all migrations applied; DB matches sprint schema.
- Local Supabase running or `db reset` just succeeded so `gen types --local` is accurate.

---

## Task S1-06 — Types + Zod

| Step | Action |
|------|--------|
| 1 | `cd bar-pos && npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` (or project’s exact pinned command) |
| 2 | Extend **Zod** in `domain.ts` for: `Category` (+ optional `parent_id`), `ModifierGroup`, `ModifierGroupItem`, `ProductModifierGroup` link row, `StockMovement` (or equivalent row shape for `stock_movements`), `Product` with `combo_eligible` / `is_combo` |
| 3 | Add/extend **`domain.test.ts`** — valid + invalid parse cases for every new/extended schema (PRD unit requirements) |
| 4 | Fix any compile breaks in `entities/inventory`, physical-count, etc. using new `Tables<'stock_movements'>` |

| Verify | Command |
|--------|-----------|
| Types + compile | `cd bar-pos && npm run typecheck` |
| Lint | `npm run lint` (zero warnings per PRD DoD) |
| Unit | `npx vitest run src/shared/lib/domain.test.ts` |

**Conventional commit:** `feat(types): regen supabase types and extend domain zod [S1-06]`

---

## Plan-check: trace to PRD

| PRD ticket | Covered |
|------------|---------|
| S1-06 | Yes — single task |

**Unlocks:** Plan 04 (entity category), Plan 05 (UI + P1), Plan 06 (E2E).
