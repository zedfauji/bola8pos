---
phase: 17-modifier-inventory-rules
plan: 01
status: complete
---

# 17-01 Summary: Modifier inventory rules — pure schema + math foundations

## What was built

Established the pure, DB-independent foundations for Phase 17 (Wave 0 / test-first):

1. **`ModifierInventoryRuleSchema` + `ModifierInventoryRuleCreateSchema`** (`src/shared/lib/domain.ts`) — a new `// MODIFIER INVENTORY RULES (Phase 17)` section mirroring `RecipeItemSchema`'s shape. Fields: `id`, `modifierId`, `ingredientId` (all `UuidSchema`), `delta: z.number().multipleOf(0.001).refine(v => v !== 0, ...)`. Signed delta enforces D-02 (positive = add usage, negative = remove usage); the `(modifierId, ingredientId, delta)` join-row shape supports D-03 (N ingredients per modifier). Inferred types `ModifierInventoryRule` and `ModifierInventoryRuleCreate` added.
2. **`computeModifierDepletion(rules, orderQty, direction)`** (`src/shared/lib/domain-helpers.ts`) — pure function mirroring `computeDepletion` but with **no `yieldQty` divisor** (D-01: modifier deltas are absolute-per-line, not yield-scaled). Formula: `delta = -direction * orderQty * rule.delta`. Returns `Map<string, number>` keyed by `ingredientId`.
3. Test coverage: `domain.test.ts` gained a `describe('ModifierInventoryRuleSchema', ...)` block (positive/negative delta parse, zero-delta rejection, non-numeric delta rejection, missing/invalid UUID FK rejection, Create-schema id-omission). `depletion.test.ts` gained a `describe('computeModifierDepletion', ...)` block (sale sign, sale/refund additive inverse, linear scaling, empty-array → empty Map, and a fast-check property test asserting `Σ|delta| === orderQty × Σ|rule.delta|` across arbitrary signed rule sets, mirroring the existing P6 property test).

## Verification

- `npx vitest run src/shared/lib/domain.test.ts src/shared/lib/depletion.test.ts` — 68/68 tests passed (57 + 11).
- `npm run typecheck` — no new errors introduced. Two pre-existing errors remain in unrelated files (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`) — neither touched by this plan; confirmed pre-existing via `git status --short` showing only the two files this plan modified.
- `npm run lint` — 0 errors (existing `boundaries` legacy-selector warning is a pre-existing config note, not a lint failure).
- `grep -n "ModifierInventoryRuleSchema\|ModifierInventoryRuleCreateSchema" src/shared/lib/domain.ts` — both exports + two type aliases present.
- `grep -n "export function computeModifierDepletion" src/shared/lib/domain-helpers.ts` — present; function body confirmed to contain no `yield` divisor.

## Commits

1. `feat(17): add ModifierInventoryRuleSchema to domain.ts` — Task 1 (schema + types + tests).
2. `feat(17): add computeModifierDepletion pure helper` — Task 2 (helper + property tests).

## Notes for downstream plans

- `ModifierInventoryRule` and `ModifierInventoryRuleCreate` types, and `computeModifierDepletion`, are now importable from `@shared/lib/domain` / `@shared/lib/domain-helpers` respectively — ready for 17-02 (migration/RLS), 17-03 (generated types), 17-04 (entity), and 17-05 (feature/UI) to build on.
- This worktree had no `node_modules` installed; a Windows directory junction to the main repo's `bar-pos/node_modules` and a copy of `.env.local` (both gitignored, untracked) were used locally to run tests — no impact on committed state.
