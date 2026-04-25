---
phase: 5
slug: kitchen-prep-cocktails
created: 2026-04-24
---

# Phase 5 — Validation Strategy: Kitchen Prep + Cocktails

Derived from RESEARCH.md §8 Phase Requirements → Test Map.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | bar-pos/vitest.config.ts |
| Quick run | `cd bar-pos && npx vitest run src/features/produce-prep-batch` |
| Full suite | `cd bar-pos && npm run test` |
| E2E | `cd bar-pos && npx playwright test e2e/21-prep.spec.ts` |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Automated Command |
|--------|----------|-----------|------|-------------------|
| S3c-01 | prep_productions table exists with correct shape | integration I1 | `src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` | `npx vitest run src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` |
| S3c-02 | Trigger writes +prep and −raw movements atomically | integration I2 | same | same |
| S3c-03 | Trigger rejects non-prep ingredient | integration I3 | same | same |
| S3c-04 | PrepProductionSchema validates correctly | unit | `src/entities/prep/model/queries.test.ts` | `npx vitest run src/entities/prep/model/queries.test.ts` |
| S3c-05 | entities/prep/ slice exports correct API | unit | `src/entities/prep/model/queries.test.ts` | `npx vitest run src/entities/prep` |
| S3c-06 | PrepProductionForm submits and reflects result | E2E T2 | `e2e/21-prep.spec.ts` | `npx playwright test e2e/21-prep.spec.ts` |
| S3c-07 | /kitchen-prep route loads with prep grid | E2E T1 | `e2e/21-prep.spec.ts` | `npx playwright test e2e/21-prep.spec.ts` |
| S3c-08 | Home tile navigates to /kitchen-prep | E2E T1 | `e2e/21-prep.spec.ts` | `npx playwright test e2e/21-prep.spec.ts` |
| S3c-09 | ChefHatBadge renders correctly | unit + Storybook | `src/shared/ui/ChefHatBadge.stories.tsx` | `npm run storybook` |
| S3c-12 | P7 no double-count invariant | property | `src/features/produce-prep-batch/model/prep-ledger.test.ts` | `npx vitest run src/features/produce-prep-batch/model/prep-ledger.test.ts` |
| S3c-13 | Sell item using prep → prep qty drops | integration I5 | `src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` | same |
| S3c-14 | Full E2E flow T1–T5 | E2E | `e2e/21-prep.spec.ts` | `npx playwright test e2e/21-prep.spec.ts` |

---

## Integration Test Cases (I1–I5)

| ID | Description | Setup | Assertion |
|----|-------------|-------|-----------|
| I1 | Prep with no recipe | Create is_prep=true ingredient; insert prep_production | prep ingredient qty +N; stock_movements has exactly 1 row for this prep_productions.id; raw ingredients unchanged |
| I2 | Prep with recipe | Create is_prep=true ingredient + recipe with 2 raw items; insert prep_production qty=10 | prep +10, raw1 -expected, raw2 -expected; stock_movements has 3 rows for this prep_productions.id |
| I3 | Non-prep ingredient rejected | Create is_prep=false ingredient; insert prep_production | trigger raises PREP_INGREDIENT_REQUIRED; no stock movements written; row count = 0 |
| I4 | Negative raw stock guard | Create prep ingredient + recipe; set raw ingredient qty_on_hand=0; insert prep_production | INVENTORY_NEGATIVE raised; no partial movements committed; transaction rolled back |
| I5 | Sell menu item using prep | Create prep ingredient + recipe + product + product recipe; sell order_item | deplete_for_order_item finds recipe via product_id; prep ingredient qty decreases |

---

## Wave 0 Stub Files

The following test files must exist as stubs (with `test.todo()` entries) before their implementing waves run:

- [ ] `src/entities/prep/model/queries.test.ts` — S3c-04, S3c-05 unit stubs
- [ ] `src/features/produce-prep-batch/model/prep-ledger.test.ts` — P7 property test stub
- [ ] `src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts` — I1–I5 stubs
- [ ] `bar-pos/e2e/21-prep.spec.ts` — T1–T5 E2E spec stub (5 test.todo entries)

---

## Quality Gate Commands (Wave 5)

```bash
cd bar-pos
npm run typecheck          # must pass
npm run lint               # must pass (max-warnings: 0)
npm run test               # unit + property tests must pass
npx vitest run src/features/produce-prep-batch/model/produce-prep-batch.integration.test.ts  # I1–I5
npx playwright test e2e/21-prep.spec.ts  # T1–T5
```
