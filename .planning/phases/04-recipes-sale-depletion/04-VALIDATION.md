---

## phase: 4
slug: recipes-sale-depletion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure


| Property               | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| **Framework**          | Vitest v4 + React Testing Library v16 + fast-check v4 |
| **Config file**        | `bar-pos/vite.config.ts` (vitest section)             |
| **Quick run command**  | `npm run typecheck && npm run lint`                   |
| **Full suite command** | `npm run test`                                        |
| **E2E command**        | `npx playwright test e2e/20-recipes.spec.ts`          |
| **Estimated runtime**  | ~30s (unit), ~3min (E2E)                              |


---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** `npm run test && npx playwright test e2e/20-recipes.spec.ts` must be green
- **Max feedback latency:** 30 seconds (unit), 3 minutes (E2E)

---

## Per-Task Verification Map


| Task ID | Req    | Wave | Behavior                                                            | Test Type   | Automated Command                                                                     | File Exists | Status    |
| ------- | ------ | ---- | ------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- | ----------- | --------- |
| S3b-01  | S3b-01 | 0    | recipes + recipe_items + audit_log tables created                   | migration   | `npx supabase db push`                                                                | ❌ W0        | ⬜ pending |
| S3b-02  | S3b-02 | 1    | deplete_for_order_item(+1) subtracts correct delta                  | unit        | `npx vitest run src/shared/lib/depletion.test.ts`                                     | ❌ W0        | ⬜ pending |
| S3b-02  | S3b-02 | 1    | deplete_for_order_item(-1) is exact additive inverse                | unit        | `npx vitest run src/shared/lib/depletion.test.ts`                                     | ❌ W0        | ⬜ pending |
| S3b-02  | S3b-02 | 1    | product with no recipe → zero ledger rows                           | unit        | `npx vitest run src/shared/lib/depletion.test.ts`                                     | ❌ W0        | ⬜ pending |
| S3b-03  | S3b-03 | 2    | add-item-to-tab with recipe → stock_movements rows present          | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts`                 | ❌ W0        | ⬜ pending |
| S3b-04  | S3b-04 | 3    | void-order → reversal stock_movements rows with reason='refund'     | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts`                 | ❌ W0        | ⬜ pending |
| S3b-05  | S3b-05 | 1    | RecipeSchema.parse() on valid recipe row → typed object             | unit        | `npm run test`                                                                        | ❌ W0        | ⬜ pending |
| S3b-06  | S3b-06 | 2    | useRecipe(productId) returns RecipeWithItems                        | unit        | `npm run test`                                                                        | ❌ W0        | ⬜ pending |
| S3b-07  | S3b-07 | 4    | Save recipe → recipe + recipe_items rows in DB                      | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts`                 | ❌ W0        | ⬜ pending |
| S3b-08  | S3b-08 | 3    | IngredientAutocomplete renders, selects, clears                     | component   | `npx vitest run src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx` | ❌ W0        | ⬜ pending |
| S3b-10  | S3b-10 | 3    | INVENTORY_NEGATIVE → blocked; manager PIN → succeeds; audit_log row | integration | `npx vitest run src/entities/tab/model/depletion.integration.test.ts`                 | ❌ W0        | ⬜ pending |
| S3b-12  | S3b-12 | 5    | P6: random recipe × random qty → sum(deltas) matches formula        | property    | `npx vitest run src/shared/lib/depletion.test.ts`                                     | ❌ W0        | ⬜ pending |
| S3b-13  | S3b-13 | 5    | Full E2E: create recipe → sell → void → override                    | E2E         | `npx playwright test e2e/20-recipes.spec.ts`                                          | ❌ W5        | ⬜ pending |


*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- `bar-pos/src/shared/lib/depletion.test.ts` — stubs for S3b-02 (computeDepletion pure fn unit tests + P6 property test)
- `bar-pos/src/entities/tab/model/depletion.integration.test.ts` — integration test stubs (S3b-03, S3b-04, S3b-10)
- `bar-pos/src/shared/ui/IngredientAutocomplete/IngredientAutocomplete.test.tsx` — component test stubs (S3b-08)

---

## Manual-Only Verifications


| Behavior                                                          | Requirement      | Why Manual                             | Test Instructions                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depletion latency ≤ 200ms for Michelada order                     | S3b-03 perf risk | No automated benchmark harness         | After S3b-03, place Michelada order and observe Network tab → XHR for `create_order_with_items`. If >200ms consistently, document fallback strategy. |
| `add_combo_to_tab` begins writing audit_log rows after Phase 4    | Risk 3           | Combo path has no unit test in Phase 4 | After migration applied, run `e2e/04-pool-timer.spec.ts` (adds combo). Check audit_log table in Supabase dashboard for combo override rows.          |
| Recipe tab Dialog at max-w-2xl renders correctly on 1280px screen | UI-SPEC          | No responsive snapshot test            | Open product edit Dialog; verify two-column layout at ≥768px viewport.                                                                               |


---

## Validation Sign-Off

- All tasks have `<automated>` verify or Wave 0 dependencies
- Sampling continuity: no 3 consecutive tasks without automated verify
- Wave 0 covers all MISSING references
- No watch-mode flags
- Feedback latency < 30s (unit/component), < 3min (E2E)
- `nyquist_compliant: true` set in frontmatter

**Approval:** pending