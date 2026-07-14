---
phase: S1
title: Foundation
discuss_phase: 2026-04-23
mode: assumptions
status: locked_for_execution
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
supplements:
  - .planning/feature-expansion-2026q2/01-locked-decisions.md
  - .planning/feature-expansion-2026q2/02-data-model.md
---

# Phase 1 (S1) — Discuss-phase context

This file is the output of **`/gsd:discuss-phase S1`** in **assumptions mode**: the sprint PRD and locked milestone decisions are treated as authoritative; open items are listed under **Assumptions to confirm** so you can reject or correct any line before execution.

---

## Domain

**Boundary:** Infrastructure-only. Ship schema + primitives for S2–S6: unified **stock movements** ledger, **hierarchical categories**, **modifier groups**, **combo flags**. **No change to POS/Tab customer flows** — only **Settings** gains admin editors.

**Explicitly out:** runtime combos (S2), ingredients/recipes/depletion (S3+), any POS/Tab UI change.

---

## Numbered decisions (D-01 …)

These are **execution contracts**. They subsume ad-hoc bullets from earlier drafts; if the PRD disagrees, **this file + `01-locked-decisions.md` win** for this repo.

| ID | Decision |
|----|------------|
| **D-01** | **Atomic S1-01:** One commit contains the migration renaming `inventory_log` → `stock_movements` **and** every non-generated reference under `bar-pos/src`, `bar-pos/supabase`, `bar-pos/e2e` updated. Grep gate: zero `inventory_log` in those paths after commit. |
| **D-02** | **Reason values** for the ledger align with **D2** in `01-locked-decisions.md` (`sale \| void \| refund \| waste \| delivery \| correction \| physical_count \| prep_production \| prep_consumption \| combo_component`). Existing DB CHECK may list `manual_adjustment` — migration **replaces** the CHECK with the full allowed set consistent with D2 + backward compatibility for existing rows (see `01-RESEARCH.md` §CHECK). |
| **D-03** | **Polymorphic audit columns** on `stock_movements`: `ref_type text`, `ref_id uuid`, nullable `ingredient_id uuid` with **no FK** to `ingredients` until Phase 3. |
| **D-04** | **Categories:** `parent_id uuid NULL REFERENCES categories(id)`, trigger (or equivalent) enforcing **max depth 3** and **no cycles** on `parent_id` INSERT/UPDATE. |
| **D-05** | **Modifier groups:** create `modifier_groups`, `modifier_group_items`, `product_modifier_groups` per `02-data-model.md` §S1. |
| **D-06** | **Products:** `combo_eligible boolean NOT NULL DEFAULT true`, `is_combo boolean NOT NULL DEFAULT false`. |
| **D-07** | **Payments:** drop uniqueness / isOneToOne on `payments.tab_id` so multiple payments per tab are allowed (per D3 roadmap). Grep client for false assumptions. |
| **D-08** | **Types + Zod (S1-06):** run `npx supabase gen types typescript` **once** after **all** schema migrations including **S1-11 RLS file** (sixth migration batch). Extend `src/shared/lib/domain.ts` only; **infer** types from Zod, no parallel hand-written domain interfaces for these shapes. |
| **D-09** | **`CategoryTreePicker`:** new `src/shared/ui/CategoryTreePicker/` + Storybook story (project rule for `shared/ui`). |
| **D-10** | **`manage-categories`:** new `src/features/manage-categories/`, mounted in **Settings**, **admin-only** (`manage_settings` / existing RBAC). |
| **D-11** | **`manage-modifier-groups`:** new `src/features/manage-modifier-groups/`, Settings tab, **admin-only**. |
| **D-12** | **Category entity (S1-10):** introduce `src/entities/category/` (today category logic lives under **product** entity — **create** the folder and move/refactor; tree queries `descendants()` / `ancestors()` via recursive CTE or Supabase RPC as appropriate). |
| **D-13** | **RLS (S1-11):** policies for new tables + **rename/migrate** policies that reference `inventory_log` to `stock_movements`. **Bartender:** no write on modifier group tables; **manager+:** write. Verify with E2E role helpers. |
| **D-14** | **P1 property test (S1-12):** `src/shared/lib/category-tree.test.ts` with `fast-check`, up to 1000 nodes, **acyclic** and **depth ≤ 3** invariants. |
| **D-15** | **E2E spec file:** PRD names `e2e/18-categories.spec.ts`, but **`e2e/18-void-order.spec.ts` already exists**. **Locked file name:** `e2e/31-categories.spec.ts` (see `01-RESEARCH.md` / `01-VALIDATION.md`). Behavior in PRD § E2E unchanged. |
| **D-16** | **Migration order:** (1) stock_movements + code flip → (2) categories tree → (3) modifier_groups trio → (4) product flags → (5) payments constraint → (6) RLS (S1-11). Each file includes **`-- DOWN:`** rollback notes. |
| **D-17** | **Commits:** one **conventional** commit per ticket where possible; never split S1-01 across commits. |

---

## Assumptions to confirm (reply inline or edit this file)

Assumptions mode treats the following as **accepted** unless you strike or edit them:

| ID | Assumption | Default |
|----|------------|---------|
| **A-01** | Staging Supabase exists and `supabase db push` (or org process) will be run before calling S1 “done”. | ✅ |
| **A-02** | Local types are generated with **`--local`** against a DB that has all migrations applied (`db reset` path is valid). | ✅ |
| **A-03** | **D-15** — you accept **`31-categories.spec.ts`** instead of `18-categories.spec.ts` to avoid spec number collision. | ✅ |
| **A-04** | No feature-flagged dual write: **cutover** for `inventory_log` → `stock_movements` is single deploy with atomic commit. | ✅ |
| **A-05** | `TANSTACK-QUERY-HOOKS.md` and other **docs** may lag one commit; **runtime** paths in `src/`, `supabase/`, `e2e/` must be consistent. | ✅ |
| **A-06** | Manual UAT: **`npm run tauri dev`**, Settings → Categories + Modifier Groups, admin PIN per project test docs. | ✅ |

**If any assumption is wrong:** update the table and, if needed, `D-15` or scope in `01-VALIDATION.md`.

---

## Ticket trace (13 + DoD)

All items from `S1-foundation.md` § Tickets are in scope; sizes and file hints follow the PRD table. **S1-11** is a **sixth** migration file (RLS), not part of the PRD’s “5 migrations” bullet count — those five are schema shape; RLS is separate ticket (see `01-RESEARCH.md` migration order).

---

## Deferred (do not implement in S1)

- Runtime combo logic, ingredient FK on `stock_movements.ingredient_id`, recipe depletion, POS/Tab UI changes.

---

## Reference

- Plans: `.planning/phases/01-foundation/02-*-PLAN.md` … `07-regression-gate-PLAN.md`
- Research: `01-RESEARCH.md`
- Validation: `01-VALIDATION.md`

*Context: sprint **S1** · folder `01-foundation`.*
