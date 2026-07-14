---
plan_id: 04
phase: 1
wave: 3
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [S1-10]
depends_on: [03-types-zod-PLAN.md]
status: ready
---

# Plan 04 — `entities/category` tree model (FSD)

## Goal (backward from phase)

Category is no longer an informal slice of `entities/product`: **settings and catalog UIs** will query **parent/child relationships** and **tree operations**. This plan introduces `bar-pos/src/entities/category/` (model, queries, public API) and **rewires imports** from `CatalogCategoriesTab` and any other call sites to the new module — **FSD boundaries respected** (see `01-RESEARCH.md`).

---

## Task S1-10 — Entity refactor

| Step | Action |
|------|--------|
| 1 | Create `src/entities/category/model/` — types from Zod/domain, TanStack query hooks for list/tree, mutations for create/update `parent_id` (admin-only) |
| 2 | Move or re-export shared selectors/helpers used by `manage-products` |
| 3 | Update `CatalogCategoriesTab.tsx` (and any grep hits for `categories` in features) to import from `@/entities/category` (match project alias) |
| 4 | Ensure **no POS/tab routes** import this entity for new behavior (PRD: POS flow unchanged) |

| Verify | Command |
|--------|-----------|
| Architecture | `npm run typecheck && npm run lint` |
| Grep | No stray deep imports bypassing public API in `src/features` |

**Conventional commit:** `refactor(entities): extract category to tree-capable entity [S1-10]`

---

## Plan-check: trace to PRD

| PRD ticket | Covered |
|------------|---------|
| S1-10 | Yes |

**Unlocks:** Plan 05 can bind `CategoryTreePicker` to real entity hooks.

**Parallelization:** Can run in parallel with Plan 05 **after** Plan 03 if coordination on file ownership is clear; safest order is **04 then 05** to avoid rebase pain on `CatalogCategoriesTab`.
