---
plan_id: 05
phase: 1
wave: 3
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [S1-07, S1-08, S1-09, S1-12]
depends_on: [03-types-zod-PLAN.md]
soft_depends_on: [04-entity-category-PLAN.md]
status: ready
---

# Plan 05 — Shared picker + Settings editors + P1 property tests

## Goal (backward from phase)

**Admin** can maintain a **3-deep category tree** and **modifier groups** in **Settings** only (PRD: no POS/tab UI change). **P1 (fast-check)** proves tree rules at the pure-function layer. Reuses **Zod** + **category entity** as wired in Plans 03–04.

---

## Task S1-07 — `CategoryTreePicker` (`shared/ui`)

| Output | `bar-pos/src/shared/ui/CategoryTreePicker/` + Storybook story + Vitest/RTL test |
|--------|----------------|
| **Behavior** | Renders tree from flat list + `parent_id`; keyboard/mouse per existing design system; optional controlled selection |
| **Verify** | `npx vitest run src/shared/ui/CategoryTreePicker` + `npm run storybook` smoke (or CI story test if present) |

**Commit:** `feat(ui): add CategoryTreePicker [S1-07]`

---

## Task S1-08 — Category tree editor in Settings

| Output | `bar-pos/src/features/manage-categories/` (or extend existing settings tab structure) + wire into **Settings** (same area as `ProductsSettingsTab` / catalog — follow `01-RESEARCH.md` settings layout) |
|--------|----------------|
| **Behavior** | Admin creates root / child / grandchild; **refuses** 4th level in UI; persists via entity/API |
| **Verify** | `npm run typecheck && npm run lint` + E2E slice in `e2e/31-categories.spec.ts` when Plan 06 lands; interim manual: Tauri/ browser |

**Commit:** `feat(settings): category tree admin editor [S1-08]`

---

## Task S1-09 — `ModifierGroupEditor` feature

| Output | `bar-pos/src/features/manage-modifier-groups/` + Settings tab entry |
|--------|----------------|
| **Behavior** | CRUD groups, attach modifiers, attach groups to products (via `product_modifier_groups`); **admin-only** |
| **Verify** | `npm run typecheck && npm run lint` + E2E in Plan 06 for tab visibility and happy path |

**Commit:** `feat(settings): modifier group editor [S1-09]`

---

## Task S1-12 — Property test P1 (`category-tree`)

| Output | `bar-pos/src/shared/lib/category-tree.ts` (pure functions) + `category-tree.test.ts` |
|--------|----------------|
| **Behavior** | `fast-check` builds random parent edges up to 1000 nodes; after each op assert **no cycle**, **depth ≤ 3** (or rejects invalid insert) — mirrors DB trigger contract |
| **Verify** | `npx vitest run src/shared/lib/category-tree.test.ts` |

**Commit:** `test(category): add p1 property tests for tree depth and acyclicity [S1-12]`

---

## Suggested order within this plan

1. S1-07 (leaf component, few deps)
2. S1-10 from Plan 04 should land before or with S1-08 if `CategoryTreePicker` needs real data hooks
3. S1-12 can proceed once `category-tree` pure module exists (may precede S1-08)
4. S1-09 parallel to S1-08 after entity/types ready

---

## Plan-check: trace to PRD

| PRD ticket | Covered |
|------------|---------|
| S1-07, S1-08, S1-09, S1-12 | Yes — four tasks, four commits |

**Unlocks:** Plan 06 (full E2E flow).
