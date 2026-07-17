# Deferred Items — Phase 35

Out-of-scope discoveries found during execution, not fixed per the executor's scope boundary rule (only auto-fix issues directly caused by the current task's changes).

## Pre-existing `npm run typecheck` failures (unrelated to Plan 35-02)

Found while verifying Plan 35-02 Task 2 (installing `eslint-plugin-tailwindcss@3.18.3`). Confirmed unrelated: neither file was touched by this plan, and the `package-lock.json` diff for this task only adds `eslint-plugin-tailwindcss` and its own transitive deps (no `typescript`/`@types/*` version changes).

- `src/entities/tab/model/queries.ts:780` — `Type 'number | null' is not assignable to type 'number | undefined'.` File last modified at commit `a435f7f` (pre-Phase-35).
- `src/shared/lib/agent/rag.ts:60` — `Type 'number[]' is not assignable to type 'string'.` File last modified at commit `45e2c0b` (pre-Phase-35).

Not fixed here. `npm run lint` still exits 0 (ESLint and `tsc --noEmit` are separate gates in this repo).

## Undetected `shadow-xs` sibling in `IngredientForm.tsx` (Plan 35-03)

`src/features/manage-ingredients/ui/IngredientForm.tsx` has the identical dead-CSS `shadow-xs` bug (Tailwind v3 has no `shadow-xs` utility — it's a v4-only rename, so the class silently generates no CSS) as the 2 sites fixed in this plan (`AdjustStockMovementDialog.tsx`, `InventoryPagePanel.tsx`). It was NOT caught by `tailwindcss/no-custom-classname` because the class lives in a bare `const SELECT_CLASS = '...'` string constant, not a JSX `className` attribute or a configured `callees` function call — invisible to the plugin's static scan. `src/shared/ui/switch.tsx` also has the same dead class but is out of the rule's `files` scope entirely (D-12 exemption). Not fixed here — undetected by the new lint gate, so fixing it is outside this task's actual (tool-verified) scope; logged for a future cleanup pass.
