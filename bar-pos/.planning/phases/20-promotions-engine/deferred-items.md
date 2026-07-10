# Deferred Items — Phase 20 (Promotions Engine)

## Plan 20-06, Task 3

**Pre-existing `npm run typecheck` failures (out of scope, not caused by this task):**

Confirmed by temporarily restoring the pre-Task-3 `src/shared/lib/supabase.types.ts` (via
`git show HEAD:bar-pos/src/shared/lib/supabase.types.ts`) and re-running `npm run typecheck`
— the identical two errors reproduce, proving they predate the Task 3 types regeneration:

1. `src/entities/tab/model/queries.ts(778,11)`: `error TS2322: Type 'number | null' is not
   assignable to type 'number | undefined'.` — `close_tab` RPC call passes
   `p_expected_version: expected ?? null` where the generated `Args` type expects
   `number | undefined`. Unrelated to promotions/`close_tab` was untouched by this plan.
2. `src/shared/lib/agent/rag.ts(60,7)`: `error TS2322: Type 'number[]' is not assignable to
   type 'string'.` — `pos_codebase_index.embedding` is typed `string | null` in
   `supabase.types.ts` (pgvector represented as a string) but `rag.ts` assigns a raw
   `number[]` embedding. Unrelated to promotions; `pos_codebase_index` was untouched by this
   plan.

Both are logged here per the SCOPE BOUNDARY rule (do not fix pre-existing failures outside
the current task's files) and left for a future cleanup plan.
