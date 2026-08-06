---
created: 2026-08-04T00:00:00.000Z
title: Saving a product-owned recipe always fails — upsert's ON CONFLICT no longer matches the table's constraint
area: recipes
severity: critical
files:
  - src/entities/recipe/model/queries.ts (useMutationSaveRecipe upsert, lines 109-114)
  - supabase/migrations/20260429000002_recipes_prep_extension.sql (dropped the plain UNIQUE constraint this upsert relies on)
  - e2e/36-recipes.spec.ts (test "can add ingredients to recipe and save" — confirms the break; do not "fix" by relaxing this test)
---

## Problem

Saving a recipe from the product edit dialog's Recipe tab always fails silently (a toast never
appears because the mutation throws before it can). Confirmed live via browser console capture
during 39-07 (E2E triage):

```
useMutationSaveRecipe: upsert failed {
  "error": {
    "code": "42P10",
    "message": "there is no unique or exclusion constraint matching the ON CONFLICT specification"
  }
}
```

`src/entities/recipe/model/queries.ts:109-114` upserts into `recipes` with
`{ onConflict: 'product_id' }`. That relies on a *plain* unique constraint on `product_id`.
`supabase/migrations/20260428000001_recipes_tables.sql:21` originally created exactly that
(`product_id uuid NOT NULL UNIQUE`), but `supabase/migrations/20260429000002_recipes_prep_extension.sql:14-22`
(added to support prep-ingredient-owned recipes) deliberately **dropped** that plain constraint
and replaced it with a **partial** unique index —
`CREATE UNIQUE INDEX recipes_product_id_unique ON recipes (product_id) WHERE product_id IS NOT NULL`
— so that multiple `NULL` `product_id` rows (prep-owned recipes) could coexist. PostgREST's simple
`onConflict: 'product_id'` API can't express the partial index's `WHERE` predicate, so it can no
longer find a matching constraint for `ON CONFLICT (product_id)`, and every upsert is rejected.

This has been broken since `20260429000002` shipped — recipe-saving for product-owned recipes
(the primary, non-prep case) has never worked since that migration landed.

## Solution

Either:
1. Switch the Supabase client call to target the partial index explicitly if the client library
   supports an `ignoreDuplicates`/raw-SQL escape hatch, or
2. Replace the single `.upsert(...)` call with an explicit select-then-insert-or-update (check for
   an existing row by `product_id`, then `.update()` or `.insert()` accordingly) — the reliable,
   supported pattern when a partial unique index can't be targeted by PostgREST's `onConflict`.

After fixing, `e2e/36-recipes.spec.ts`'s "can add ingredients to recipe and save" test should pass
unmodified — its assertions were already correct against the intended save flow.
