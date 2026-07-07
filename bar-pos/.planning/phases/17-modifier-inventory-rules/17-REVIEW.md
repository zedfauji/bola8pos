---
phase: 17-modifier-inventory-rules
reviewed: 2026-07-07T20:40:36Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - bar-pos/e2e/24-modifier-inventory-rules.spec.ts
  - bar-pos/src/entities/modifier-inventory-rule/index.ts
  - bar-pos/src/entities/modifier-inventory-rule/model/queries.ts
  - bar-pos/src/entities/modifier-inventory-rule/model/types.ts
  - bar-pos/src/entities/tab/model/depletion.integration.test.ts
  - bar-pos/src/features/manage-modifier-inventory-rules/index.ts
  - bar-pos/src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts
  - bar-pos/src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx
  - bar-pos/src/features/manage-products/ui/CatalogModifiersTab.tsx
  - bar-pos/src/shared/lib/depletion.test.ts
  - bar-pos/src/shared/lib/domain-helpers.ts
  - bar-pos/src/shared/lib/domain.test.ts
  - bar-pos/src/shared/lib/domain.ts
  - bar-pos/src/shared/lib/supabase.types.ts
  - bar-pos/supabase/migrations/20260706000002_modifier_inventory_rules_table.sql
  - bar-pos/supabase/migrations/20260706000003_deplete_for_order_item_v3.sql
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-07T20:40:36Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 17 adds modifier→ingredient depletion rules: a new `modifier_inventory_rules` table + RLS,
a `deplete_for_order_item` v3 RPC that adds a modifier-driven depletion loop alongside the
existing recipe loop, a TanStack Query entity/feature pair for managing rules from the Settings
Modifiers tab, and a mirrored pure helper (`computeModifierDepletion`) plus property-based tests.

The recipe-loop regression guard (SC-4) is well covered and the recipe-less product case (D-04)
is tested. However, tracing the new modifier loop against the `stock_movements` idempotency index
surfaced a genuine correctness bug: two different modifiers on the same order item that both map
to the same ingredient will raise an unhandled unique-constraint violation and abort the entire
depletion call (including the already-succeeded recipe loop for that order item). This is a
BLOCKER — it is a realistic real-world combination (e.g. "Extra Lime" + "Heavy Garnish", both
depleting lime), not a contrived edge case, and it is completely uncovered by the new integration
test (which only exercises a single modifier per order item).

Several secondary issues were also found: missing explicit ordering on the rules SELECT (risking
UI/E2E flakiness), a Zod "Create" schema that is defined but never actually invoked on the write
path (so its `multipleOf(0.001)` contract is unenforced), a stale/incorrect `as any` justification
now that `supabase.types.ts` is fully typed for this table, a feature-importing-feature FSD
boundary violation (mirrors an existing precedent elsewhere and is not currently caught by lint),
and a silent-data-loss UX gap where incomplete rows are dropped without warning at save time.

## Critical Issues

### CR-01: Two modifiers mapping to the same ingredient abort the entire depletion RPC

**File:** `bar-pos/supabase/migrations/20260706000003_deplete_for_order_item_v3.sql:151-191`

**Issue:**

The new modifier-driven loop reads all `modifier_inventory_rules` rows for every modifier attached
to the order item:

```sql
FOR v_mod_item IN
  SELECT ingredient_id, delta FROM modifier_inventory_rules WHERE modifier_id = ANY(v_modifier_ids)
LOOP
  ...
  PERFORM record_stock_movement(
    v_mod_item.ingredient_id,
    v_mod_delta,
    v_reason,
    'order_item_modifier',   -- ref_type
    p_order_item_id,         -- ref_id
    NULL
  );
```

`modifier_inventory_rules` only has a `UNIQUE (modifier_id, ingredient_id)` constraint — nothing
prevents two *different* modifiers from both targeting the same `ingredient_id`. If an order item
has `modifier_ids = [modA, modB]` and both `modA` and `modB` have a rule for ingredient `X`, the
query above returns two rows with the same `ingredient_id`. Both rows attempt
`record_stock_movement(..., 'order_item_modifier', p_order_item_id, X)`. The second call collides
with the partial unique index `idx_stock_movements_idempotency (ref_type, ref_id, ingredient_id)`
(`20260426000002_stock_movements_idempotency_index.sql`) for `reason IN ('sale','refund',...)`,
raising a Postgres `23505 unique_violation`.

The loop's exception handler only special-cases `INVENTORY_NEGATIVE`:

```sql
EXCEPTION WHEN OTHERS THEN
  IF p_allow_negative AND SQLERRM LIKE '%INVENTORY_NEGATIVE%' THEN
    ...
  ELSE
    RAISE;  -- <-- unique_violation always lands here, regardless of p_allow_negative
  END IF;
END;
```

A `unique_violation`'s `SQLERRM` never contains `INVENTORY_NEGATIVE`, so it always falls to
`RAISE`, re-raising the raw constraint error out of the function. Because
`deplete_for_order_item` has no outer exception handler, this aborts and rolls back the *entire*
RPC call — including the recipe loop's stock movements that had already succeeded earlier in the
same invocation. Callers (`void-order`, `override-negative-stock`, checkout/payment depletion)
receive a raw `duplicate key value violates unique constraint "idx_stock_movements_idempotency"`
error instead of a graceful outcome, and no inventory is depleted for that line at all — for a
combination of modifiers that is entirely plausible in real bar/restaurant usage.

The new integration test suite (`depletion.integration.test.ts`, tests I5/I6) only ever attaches a
single modifier per order item, so this path is completely untested.

**Fix:** Aggregate rule deltas per ingredient before looping, so at most one
`record_stock_movement` call is made per `(order_item, ingredient)` pair even when several
modifiers target the same ingredient:

```sql
FOR v_mod_item IN
  SELECT ingredient_id, SUM(delta) AS delta
    FROM modifier_inventory_rules
   WHERE modifier_id = ANY(v_modifier_ids)
   GROUP BY ingredient_id
LOOP
  ...
```

Add a regression test with two modifiers on one order item that both target the same ingredient,
asserting a single summed `stock_movements` row (or two independent ingredients to prove no
collision), to close the coverage gap that let this ship.

## Warnings

### WR-01: Rules SELECT has no explicit ordering — non-deterministic row order

**File:** `bar-pos/src/entities/modifier-inventory-rule/model/queries.ts:53-63` (also the
re-select at `:118-128`)

**Issue:** Both the `useModifierInventoryRules` query and the mutation's post-write re-select run
`db.from('modifier_inventory_rules').select('*').eq('modifier_id', modifierId)` with no
`.order(...)`. PostgREST/Postgres does not guarantee row order without an explicit `ORDER BY`.
The new e2e spec (`e2e/24-modifier-inventory-rules.spec.ts:68-71`) asserts a specific row order on
reopen (`deltaInputs.nth(0)` == `'2'`, `nth(1)` == `'-1'`), and the dialog itself renders rows in
whatever order the query returns them in. Today this likely "works" because small tables tend to
be returned in physical/insertion order, but that is not a guarantee — a different query plan
(e.g. after the table grows or gets vacuumed/reindexed) can silently reorder rows shown to the
user and make the e2e test flaky.

**Fix:**

```ts
const { data, error } = await db
  .from('modifier_inventory_rules')
  .select('*')
  .eq('modifier_id', modifierId)
  .order('id');
```

Apply the same `.order('id')` to the re-select step in `useMutationSaveModifierInventoryRules`.

### WR-02: Incomplete rows are silently dropped with a false "success" toast

**File:** `bar-pos/src/features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx:114-126`

**Issue:**

```ts
const rules: ModifierInventoryRuleCreate[] = state.rows
  .filter(r => {
    const parsed = parseFloat(r.delta);
    return r.ingredientId.length > 0 && !Number.isNaN(parsed) && parsed !== 0;
  })
  .map(r => ({ modifierId, ingredientId: r.ingredientId, delta: parseFloat(r.delta) }));
const result = await saveRules({ modifierId, rules });
```

Rows with no ingredient selected, or with a delta of `0`/non-numeric, are silently filtered out
before saving — with no toast, inline error, or confirmation. If a manager adds a row, types a
delta, but forgets to pick an ingredient (or leaves delta at the default `'0'`), clicking "Save
rules" discards that row without telling them, yet still shows "Ingredient rules saved" and closes
the dialog as if everything they entered was persisted. This is a silent-data-loss UX bug: the
user has no way to know their edit did not take effect.

**Fix:** Validate before filtering; if any row is "started" (has an ingredient OR a non-default
delta) but incomplete, block the save with an explicit error instead of silently dropping it:

```ts
const incomplete = state.rows.some(
  r => (r.ingredientId.length > 0) !== (parseFloat(r.delta) !== 0 && !Number.isNaN(parseFloat(r.delta)))
);
if (incomplete) {
  toast.error('Complete or remove incomplete ingredient rows before saving');
  return;
}
```

### WR-03: `ModifierInventoryRuleCreateSchema` is never invoked on the write path

**File:** `bar-pos/src/entities/modifier-inventory-rule/model/queries.ts:83-140`

**Issue:** `domain.ts` defines `ModifierInventoryRuleCreateSchema` with a
`delta: z.number().multipleOf(0.001).refine(v => v !== 0, ...)` contract, and it is exported all
the way through the entity's public API — but it is never actually `.parse()`d or `.safeParse()`d
anywhere in the write path. `useMutationSaveModifierInventoryRules` inserts `input.rules` directly:

```ts
const rows = input.rules.map(rule => ({
  modifier_id: input.modifierId,
  ingredient_id: rule.ingredientId,
  delta: rule.delta,
}));
const { error: insertError } = await db.from('modifier_inventory_rules').insert(rows);
```

The DB itself only enforces `CHECK (delta <> 0)` (see
`20260706000002_modifier_inventory_rules_table.sql:25`) — there is no `multipleOf(0.001)`
enforcement anywhere at runtime. Since the delta input is a free-text `type="number"` field
without a matching client-side parse/validate step (`ModifierIngredientRulesDialog.tsx:167`), a
value like `0.123456789` can be typed and saved straight to the database, silently violating the
schema's own documented precision contract. This contradicts CLAUDE.md's "Zod for all external
data validation (API responses, user input)" guidance.

**Fix:**

```ts
const parsedRules = input.rules.map(r => ModifierInventoryRuleCreateSchema.parse(r));
const rows = parsedRules.map(rule => ({ modifier_id: input.modifierId, ingredient_id: rule.ingredientId, delta: rule.delta }));
```

(wrap in try/catch and return `err({ code: 'VALIDATION_ERROR', ... })` on failure, consistent with
the `Result<T>` pattern used elsewhere).

### WR-04: `as any` cast justification is stale — `supabase.types.ts` is already typed for this table

**File:** `bar-pos/src/entities/modifier-inventory-rule/model/queries.ts:1-18`

**Issue:** The file-level comment reads:

```ts
// Pre-regen cast — remove once supabase.types.ts generics are regenerated for this table
const db = supabase as any;
```

But `supabase.types.ts` (part of this same phase's changeset — see lines 627-662) already contains
a fully-typed `modifier_inventory_rules` entry with correct `Row`/`Insert`/`Update` shapes, and
`shared/lib/supabase.ts` creates the client as `createClient<Database>(...)`. The justification for
the cast is therefore already false for this specific file: the generated types exist, so
`supabase.from('modifier_inventory_rules')` would resolve to a properly typed query builder
without the cast. Keeping `as any` here forfeits compile-time safety for every DB call in this new
module and violates CLAUDE.md's "No `any` without a justification comment" — the comment present is
inaccurate, not just missing.

(Note: `entities/recipe/model/queries.ts` has an identical, similarly-stale comment predating this
phase — that one is out of scope here, but this file had the chance to be typed correctly from day
one and wasn't.)

**Fix:** Drop the cast and the file-level eslint-disable; use `supabase.from('modifier_inventory_rules')` directly and let the generated `Database` types flow through.

### WR-05: `manage-products` feature imports directly from `manage-modifier-inventory-rules` feature (FSD boundary violation)

**File:** `bar-pos/src/features/manage-products/ui/CatalogModifiersTab.tsx:4`

**Issue:** CLAUDE.md's documented FSD import direction is
`app → pages → widgets → features → entities → shared`, i.e. a feature may only import from
`entities`/`shared`, not from another feature — cross-feature composition is supposed to happen at
the `widgets` layer. This file does:

```ts
import { ModifierIngredientRulesDialog } from '@features/manage-modifier-inventory-rules';
```

directly inside `features/manage-products/ui/CatalogModifiersTab.tsx`. Verified that the
`eslint-plugin-boundaries` config's `boundaries/dependencies` rule (`eslint.config.js:93-124`)
declares `from: ['features'], allow: ['entities', 'shared']` — features→features is not in the
allow-list — yet running `npx eslint` directly on this file exits `0` with no error, so this will
not currently fail `npm run lint`. This mirrors a pre-existing identical pattern
(`CatalogProductsTab.tsx` → `@features/manage-recipe`), so it is not a novel deviation invented by
this phase, but it does further entrench a documented-but-unenforced architecture rule.

**Fix:** Move the `<ModifierIngredientRulesDialog>` composition up to the widget layer (e.g.
`widgets/SettingsCatalogPanel.tsx` or `widgets/SettingsTabsPanel/tabs/ProductsSettingsTab.tsx`),
passing the selected-modifier state down via props, so `CatalogModifiersTab` only needs to expose a
callback (`onManageRules?: (modifier: Modifier) => void`). Separately, consider fixing the
`eslint-plugin-boundaries` config (it warns about "legacy selector syntax" — migrating to
object-based selectors per the v6 migration guide may restore proper enforcement) so this class of
violation is actually caught in CI going forward.

## Info

### IN-01: `computeModifierDepletion` mirrors the same ingredient-collision bug as CR-01 (currently dead in production)

**File:** `bar-pos/src/shared/lib/domain-helpers.ts:412-423`

**Issue:**

```ts
export function computeModifierDepletion(
  rules: ModifierInventoryRule[],
  orderQty: number,
  direction: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const rule of rules) {
    const delta = -direction * orderQty * rule.delta;
    deltas.set(rule.ingredientId, delta);
  }
  return deltas;
}
```

If two rules resolve to the same `ingredientId`, `Map.set` silently overwrites instead of summing
— the same root-cause shape as CR-01 in the SQL RPC. This function is currently only exercised by
`depletion.test.ts` (never called from production code), so it has no runtime impact today, but
any future caller (e.g. an "inventory impact preview" before checkout) would inherit the bug
unless fixed here too.

**Fix:** `deltas.set(rule.ingredientId, (deltas.get(rule.ingredientId) ?? 0) + delta);`

### IN-02: Raw Postgres error text surfaced directly to end users

**File:** `bar-pos/src/features/manage-modifier-inventory-rules/model/useManageModifierInventoryRules.ts:23`

**Issue:** `toast.error(result.error.message)` surfaces the raw Supabase/Postgres error string. For
example, if a manager adds two rows both selecting the same ingredient for one modifier (no client
guard against this), the `UNIQUE (modifier_id, ingredient_id)` constraint on
`modifier_inventory_rules` will produce a message like `duplicate key value violates unique
constraint "modifier_inventory_rules_modifier_id_ingredient_id_key"` shown verbatim to the user.
This mirrors an existing pattern elsewhere (`useManageRecipe.ts`) so it's not novel to this phase,
but worth polishing.

**Fix:** Map known Postgres error codes (e.g. `23505`) to a friendlier message such as "This
ingredient already has a rule for this modifier," either in the mutation hook or a shared error
formatter.

---

_Reviewed: 2026-07-07T20:40:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
