---
plan_id: 02
phase: 1
wave: 1
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [S1-01, S1-02, S1-03, S1-04, S1-05, S1-11]
status: ready
---

# Plan 02 — SQL migrations (serial Wave 1)

## Goal (backward from phase)

Downstream sprints need a **single append-only `stock_movements` ledger**, **tree-shaped categories with depth-3 and no cycles**, **modifier-group link tables**, **combo flags on products**, **multi-payment-per-tab**, and **RLS on new tables** — all enforced in Postgres before the app types layer ships.

This plan delivers **S1-01, S1-02, S1-03, S1-04, S1-05, S1-11** as **six atomic migration commits** in the order below. Do not reorder.

---

## Hard rules

1. **S1-01** must land in **one commit** with every non-generated `inventory_log` reference flipped (see `01-RESEARCH.md` §Brownfield). Partial renames are forbidden.
2. **Do not** run `npx supabase gen types` until **Plan 03** after **all** of S1-01..S1-05 and S1-11 migrations are merged (fan-in point).
3. Each migration file includes a **`-- DOWN:`** comment block (project convention per PRD).
4. Triggers on `categories` and policy names on new tables: follow `02-data-model.md` §S1 and existing `inventory_log` RLS patterns in `20260414000009_rls_policies.sql`.

---

## Task S1-01 — `stock_movements` rename + enum + polymorphic columns

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_stock_movements.sql` |
| **Code** | `queries.ts`, `usePhysicalCount.ts` + test, e2e helpers, `27-inventory-intelligence.spec.ts` comments, any trigger files that `INSERT` into the table, CHECK constraint rename per RESEARCH |
| **Verify** | `cd bar-pos && npx supabase db reset` (or `db push` local) **then** `npm run typecheck` may still fail until Plan 03 — that is expected if types not regen yet; **min bar:** DB applies clean + `npx vitest run src/entities/inventory` + physical-count tests if table name mocked |

**Grep gate (same commit as migration):** from repo root, zero hits:

```bash
grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e
```

(PowerShell: `rg "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e` should return nothing.)

**Conventional commit:** `feat(db): rename inventory_log to stock_movements [S1-01]`

---

## Task S1-02 — `categories.parent_id` + depth-3 + no-cycle trigger

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_categories_tree.sql` |
| **Verify** | `npx supabase db reset` succeeds; optional `psql` one-liner: insert 3-level chain ok, 4th level rejected |

**Conventional commit:** `feat(db): hierarchical categories with depth-3 check [S1-02]`

---

## Task S1-03 — `modifier_groups` trio

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_modifier_groups.sql` |
| **Verify** | `npx supabase db reset` succeeds |

**Conventional commit:** `feat(db): add modifier group tables [S1-03]`

---

## Task S1-04 — `products.combo_eligible` + `products.is_combo`

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_product_combo_flags.sql` |
| **Verify** | `npx supabase db reset` succeeds |

**Conventional commit:** `feat(db): add product combo flags [S1-04]`

---

## Task S1-05 — drop `payments.tab_id` isOneToOne

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_payments_constraint.sql` |
| **Verify** | `npx supabase db reset` succeeds; `rg isOneToOne bar-pos/src` only generated metadata post–type regen (Plan 03) |

**Conventional commit:** `feat(db): allow multiple payments per tab [S1-05]`

---

## Task S1-11 — RLS for new tables

| Field | Value |
|-------|--------|
| **Output** | `bar-pos/supabase/migrations/<timestamp>_s1_rls.sql` (or split if preferred; one migration is fine) |
| **Policy intent** | Admin/manager: read/write where appropriate; **bartender: no write** on `modifier_groups` and related; align with `02-data-model.md` |
| **Verify** | `npx supabase db reset` succeeds; RLS cases covered in E2E Plan 06 (`-g` bartender / admin) |

**Conventional commit:** `feat(db): rls for s1 category and modifier group tables [S1-11]`

---

## Wave exit criteria

- [ ] All six tasks committed with **one ticket per commit**.
- [ ] `npx supabase db reset` (or local equivalent) **green** on latest `main` + this branch.
- [ ] Grep gate for S1-01 **green** in CI / locally.
- [ ] **Proceed to Plan 03** — no application feature work that depends on new columns until types + Zod are updated.

---

## Plan-check: trace to PRD

| PRD ticket | Covered |
|------------|---------|
| S1-01..05, S1-11 | Yes — 1:1 tasks above |

**Unlocks:** Plan 03 (types/Zod), then Plans 04–07.
