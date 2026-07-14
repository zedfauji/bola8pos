---
title: Testing Strategy
status: locked
---

# Testing Strategy

Mirrors existing project conventions. Every sprint's DoD includes: typecheck + lint + unit + existing E2E must pass. New E2E specs are required for user-visible features; specs listed per sprint.

## Pyramid

| Layer | Tool | Responsibility |
|---|---|---|
| Domain/pure logic | Vitest + fast-check | Pricing, depletion math, availability rules, rounding invariants |
| Entity queries | Vitest + RTL | Zustand stores, TanStack Query optimistic updates, realtime handlers |
| Feature integration | Vitest + RTL | Feature UI flows with mocked Supabase |
| E2E | Playwright | Full-flow specs against dev server with seeded test data |
| Storybook | v10 | Every new `shared/ui/` primitive |

## Required property tests (fast-check)

These are gates that block sprint completion.

| ID | Where | Property |
|---|---|---|
| P1 | S1 | Category tree: no cycles, `depth(node) ≤ 3` for all nodes across random tree inserts |
| P2 | S2 | Combo pricing: `sum(child_prices) ≥ combo_price_override` (discount never inverts) |
| P3 | S2 | Availability: `isComboAvailable(combo, ts)` evaluated over 7×24 fixtures matches expected (day-of-week + time-window correctness) |
| P4 | S3a | Ledger invariant: `sum(stock_movements.delta WHERE ingredient_id=X) = ingredients.quantity_on_hand` for random sequences of movements |
| P5 | S3a | UOM conversion: `convertBase(qty, from, to) ∘ convertBase(result, to, from) = qty` (round-trip identity within epsilon) |
| P6 | S3b | Depletion: for random recipe + order qty, sum of movements = `order_qty × recipe_item_qty / yield_qty` for each ingredient |
| P7 | S3c | Prep double-count guard: producing N portions writes +N prep row AND consumes raw ingredients; never two positive rows |
| P8 | S4 | Split-bill conservation: sum of all sub-tab totals + tip + discount = parent tab total (within ±1 cent) |
| P9 | S4 | Split evenly rounding: N-way split of amount X sums exactly to X (no lost/extra cents) |
| P10 | S4 | Refund: refunded amount ≤ original payment; restock=true produces positive ledger delta matching original negative |

## Unit test coverage targets

- Entity queries: 100% of mutation hooks (optimistic update + rollback on error)
- Feature UI: all happy paths + 1 error path per feature
- Shared utilities: 100% branches for money math, UOM, availability

## Integration test scenarios

Per sprint (detailed in each sprint doc). Examples:
- S2: Add Cubeta → 10 child order_items created, parent displays aggregated, KDS receives bundle ticket
- S4: Create sub-tab → move items → pay sub-tab A → parent still shows unpaid B items
- S5: Add waitlist entry with phone → edge function called → mocked WasenderAPI returns 200 → notification logged

## E2E specs (new)

Each follows existing patterns in `bar-pos/e2e/` (see `01-ci.spec.ts` for auth boilerplate, `loginAs(page, 'admin')`).

| Spec | Sprint | Flows |
|---|---|---|
| `18-categories.spec.ts` | S1 | Create hierarchical category, enforce depth 3, mark product combo_eligible=false |
| `19-combos.spec.ts` | S2 | Create combo, add options, attempt nested combo (expect fail), add to tab, verify 10 child order_items, day-of-week override with manager PIN |
| `20-recipes.spec.ts` | S3b | Create recipe, sell item, verify ledger delta across all ingredients, negative-stock guard |
| `21-prep.spec.ts` | S3c | Create prep batch, verify prep ingredient +, raw ingredients −; sell menu item that consumes prep |
| `22-split-bill.spec.ts` | S4 | Three flows: by-item, evenly, by-person; verify conservation of money, pay each sub-tab, parent auto-closes |
| `23-refund.spec.ts` | S4 | Full refund, partial refund, restock toggle, manager PIN, verify ledger reversal |
| `24-waitlist.spec.ts` | S5 | Add walk-in, notify (mocked WasenderAPI), seat at table, verify realtime update to manager |
| `25-reports.spec.ts` | S6 | Combo mix report, recipe variance report, export CSV |

## Testing anti-patterns to reject

- ❌ Mocking the entire Supabase client in integration tests — use the real test project via `.env.local`
- ❌ Snapshot tests for dynamic UI (pricing, timestamps) — use explicit assertions
- ❌ E2E specs that depend on ordering of other specs — each must be independent and seed its own data
- ❌ Skipping property tests because "unit tests cover it" — the properties above catch bugs the unit tests won't
- ❌ `test.skip` or `it.skip` in committed code

## CI gate

```bash
cd bar-pos
npm run typecheck      # blocking
npm run lint           # blocking (max-warnings: 0)
npm run test           # blocking
npm run test:e2e       # blocking for release, opt-in per sprint PR
```

Pre-commit hook must stay enabled; no `--no-verify` under any circumstance.
