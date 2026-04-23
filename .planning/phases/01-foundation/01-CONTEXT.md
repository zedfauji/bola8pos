# Phase 1: Foundation — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/feature-expansion-2026q2/sprints/S1-foundation.md`)

<domain>
## Phase Boundary

Infrastructure-only sprint. Delivers the schema + primitives every downstream sprint (S2–S6) depends on: unified stock ledger, hierarchical categories, modifier groups, and combo-eligibility flags. **No user-facing POS flow change** — the POS and Tab pages must render identically after this phase. Only Settings gains new admin editors.

Explicit out-of-scope:
- Any runtime use of combos (deferred to Phase 2)
- Any runtime use of ingredients/recipes (deferred to Phase 3+)
- Any UI change on POS/Tab pages

</domain>

<decisions>
## Implementation Decisions — Locked by PRD

### S1-01 — Stock movements rename
- Rename table `inventory_log` → `stock_movements`
- Extend reason enum (new values will be used in Phase 3+: `'sale' | 'refund' | 'void' | 'prep_production' | 'prep_consumption'` on top of existing values)
- Add polymorphic columns: `ref_type text`, `ref_id uuid`
- Add nullable `ingredient_id uuid` (FK target lands in Phase 3)
- Reversible migration with DOWN script

### S1-02 — Categories tree
- Add `categories.parent_id uuid` self-reference (nullable, FK to `categories.id`)
- Add CHECK trigger enforcing **depth ≤ 3** on INSERT/UPDATE of `parent_id`
- Trigger must reject cycles

### S1-03 — Modifier groups
- New tables: `modifier_groups`, `modifier_group_items`, `product_modifier_groups`
- Reversible migration with DOWN script
- RLS: bartender read-only; manager+/admin write (enforced in S1-11)

### S1-04 — Products combo flags
- Add `products.combo_eligible boolean NOT NULL DEFAULT true`
- Add `products.is_combo boolean NOT NULL DEFAULT false`

### S1-05 — Payments constraint
- Drop the `payments.tab_id` `isOneToOne` / unique constraint (prepares Phase 6 sub-tabs/refunds)
- Audit for client code that assumes single payment per tab (grep `isOneToOne`, `one-payment`, `single payment`)

### S1-06 — Types + Zod
- Run `npx supabase gen types typescript` once after all 5 migrations land
- Extend Zod schemas in `src/shared/lib/domain.ts` for: Category (with `parent_id`), ModifierGroup, ModifierGroupItem, ProductModifierGroup, StockMovement (renamed), Product (with combo flags)
- Do not hand-write entity types — infer from Zod (`type X = z.infer<typeof XSchema>`)

### S1-07 — CategoryTreePicker
- New `shared/ui/CategoryTreePicker/` component
- Storybook story required (project rule: every new `shared/ui/` component ships a story)

### S1-08 — Category tree admin
- New feature folder `src/features/manage-categories/`
- Mounted as a Settings tab (admin-only — gated by `manage_settings` RBAC)
- Uses `CategoryTreePicker`

### S1-09 — Modifier group editor
- New feature folder `src/features/manage-modifier-groups/`
- Mounted as a Settings tab (admin-only)

### S1-10 — Category entity refactor
- Update `src/entities/category/model/{types,store,queries}.ts` for the tree model
- Tree-aware queries (`descendants()`, `ancestors()`) backed by recursive CTE

### S1-11 — RLS
- New policies for `modifier_groups`, `modifier_group_items`, `product_modifier_groups`, `stock_movements` (post-rename)
- Bartender: read-only on modifier tables
- Manager+: write on modifier tables
- Verify via `loginAs(page, 'bartender')` in E2E

### S1-12 — Property test P1
- `fast-check` property test: random tree construction up to 1000 nodes; assert no cycle and depth ≤ 3 after each insert
- File: `src/shared/lib/category-tree.test.ts`

### S1-13 — E2E 18-categories
- New spec `e2e/18-categories.spec.ts`
- Flow: admin creates root → child → grandchild, attempts great-grandchild (expect UI refusal + backend 4xx), toggles a product's `combo_eligible=false` and confirms DB state

### Migration order — locked
1. `stock_movements` rename
2. `categories.parent_id` + trigger
3. modifier_groups trio
4. products flags
5. payments constraint drop

Each migration is reversible with a `DOWN` script.

### Breaking-change audit — locked
Before touching S1-01, run:
```
grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e
```
Every hit must be updated to `stock_movements` in the **same commit** as the rename migration.

### Claude's Discretion
- Exact migration timestamps (`2026xxxx_*.sql`) — pick sequential UTC dates
- Internal component structure of `CategoryTreePicker` and the two Settings editors (layout, drag/drop vs picker, etc.) — follow existing `shared/ui/` and `features/` patterns
- Query-cache keys for TanStack Query — follow existing `entities/<name>/model/queries.ts` convention
- Zustand store shape for category tree — mirror existing entity stores
- Test fixture data for property/E2E tests

</decisions>

<specifics>
## Specific Ideas

**Tickets — all 13 must ship:**

| ID | Title | Files | Est |
|---|---|---|---|
| S1-01 | DB migration: rename inventory_log → stock_movements + columns | `supabase/migrations/2026xxxx_stock_movements.sql` | S |
| S1-02 | DB migration: categories.parent_id + depth-3 trigger | `supabase/migrations/2026xxxx_categories_tree.sql` | S |
| S1-03 | DB migration: modifier_groups trio + product link | `supabase/migrations/2026xxxx_modifier_groups.sql` | S |
| S1-04 | DB migration: products.combo_eligible, products.is_combo | `supabase/migrations/2026xxxx_product_combo_flags.sql` | XS |
| S1-05 | DB migration: drop payments.tab_id isOneToOne | `supabase/migrations/2026xxxx_payments_constraint.sql` | XS |
| S1-06 | Regenerate types, update Zod schemas | `src/shared/lib/supabase.types.ts`, `src/shared/lib/domain.ts` | M |
| S1-07 | `CategoryTreePicker` shared/ui component | `src/shared/ui/CategoryTreePicker/` + story | M |
| S1-08 | Category tree admin editor in Settings | `src/features/manage-categories/`, Settings tab | M |
| S1-09 | `ModifierGroupEditor` feature | `src/features/manage-modifier-groups/`, Settings tab | M |
| S1-10 | Entity `category` refactor to tree model | `src/entities/category/model/*` | M |
| S1-11 | RLS policies for new tables | `supabase/migrations/2026xxxx_s1_rls.sql` | S |
| S1-12 | Property tests: P1 (tree depth + no cycles) | `src/shared/lib/category-tree.test.ts` | S |
| S1-13 | E2E `18-categories.spec.ts` | `e2e/18-categories.spec.ts` | S |

**Execution notes (PRD):**
- Start with S1-01 (rename) — everything else depends on the new column names
- S1-06 (type regen) is a fan-out point: do it once after all migrations, not per-migration
- S1-07..S1-10 can parallelize after S1-06

**Feature flags:** None. All changes are additive except the rename (handled atomically).

**Risks (PRD):**

| Risk | Mitigation |
|---|---|
| Table rename breaks live queries | Feature-flag if needed; stage on local first; confirm with `grep` + tests |
| Depth-3 trigger performance | Trigger fires only on INSERT/UPDATE of `parent_id`; bounded recursion; expected <100 categories |
| Dropping payments 1:1 constraint exposes hidden assumptions | Grep `isOneToOne`, `one-payment`, `single payment` in client code |

**Definition of Done — from PRD:**
- All 5 migrations run clean against local + staging Supabase
- `npx supabase gen types typescript` output committed
- `domain.ts` Zod schemas updated; `z.infer` only, no manual interfaces
- `npm run typecheck` passes
- `npm run lint` passes (zero warnings)
- `npm run test` passes; P1 property test included
- Existing E2E suite still green (no regression — specs 01–17)
- `18-categories.spec.ts` green
- Settings → Categories + Modifier Groups manually verified in Tauri dev build
- RLS verified: bartender cannot write to `modifier_groups`
- No reference to `inventory_log` remains in codebase
- Atomic commits per ticket with conventional-commit messages

</specifics>

<deferred>
## Deferred Ideas

Explicitly out-of-scope for Phase 1 — do **not** implement:

- Runtime use of combos → Phase 2 (S2)
- Runtime use of ingredients / recipes / depletion → Phase 3+ (S3a/S3b/S3c)
- Any UI change on POS or Tab pages
- FK on `stock_movements.ingredient_id` pointing at the `ingredients` table — the column is nullable in Phase 1; FK lands when Phase 3 creates `ingredients`

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-23 via PRD Express Path*
