---
title: Feature Expansion 2026Q2 — Roadmap
status: locked
created: 2026-04-23
owner: Girish
---

# Feature Expansion 2026Q2 — Roadmap

Customer-driven feature expansion for Bola8 POS. Derived from operator feedback on combos, recipe-level inventory, kitchen prep, waitlist, refunds, and split bill. Debated and locked 2026-04-23.

## Scope (10 customer asks → 10 features)

| # | Customer ask | Feature | Sprint |
|---|---|---|---|
| F1 | Cubeta x10 beers + type tracking | Combos w/ parent/child order_items | S2 |
| F2 | Premium vs Regular beer inventory | Hierarchical categories + modifier groups | S1 |
| F3 | Combo with 1hr free pool | Combo slot type `pool_time` | S2 |
| F4 | Combo w/ pool + cubeta discount | Multi-slot combos + price override | S2 |
| F5 | Prepared cocktails inventory (Michelada) | Recipes (BOM) | S3b |
| F6 | Food recipes (Alitas 750g + salsa) | Recipes — same model as F5 | S3b |
| F7 | Chef prep portioning | `is_prep` ingredients + `prep_productions` | S3c |
| F8 | Walk-in waitlist + FIFO notify | `waitlist_entries` + Realtime + WasenderAPI | S5 |
| F9 | Refund process | `refunds` + `refund_items` + ledger reversal | S4 |
| F10 | Split bill (item/person/amount) | Sub-tabs via `parent_tab_id` | S4 |

## Sprints

| Sprint | Goal | Duration | Tokens |
|---|---|---|---|
| [S1](sprints/S1-foundation.md) | Foundation (ledger, modifier groups, categories, flags) | 2 weeks | 60–80k |
| [S2](sprints/S2-combos.md) | Combos + availability rules | 2 weeks | 140–180k |
| [S3a](sprints/S3a-ingredients.md) | Ingredient foundation + unified ledger | 2 weeks | 80–110k |
| [S3b](sprints/S3b-recipes.md) | Recipes + sale depletion (cocktails fall out) | 2 weeks | 110–150k |
| [S3c](sprints/S3c-prep-cocktails.md) | Kitchen prep + cocktail coverage | 2 weeks | 80–110k |
| [S4](sprints/S4-split-refund.md) | Split bill + refund | 2 weeks | 150–200k |
| [S5](sprints/S5-waitlist.md) | Waitlist + WhatsApp notify | 2 weeks | 120–160k |
| [S6](sprints/S6-polish-reports.md) | Reports + polish + E2E hardening | 2 weeks | 70–110k |

**Total: 16 weeks, ~810k–1.1M tokens base, budget 1.4M with deviation buffer.**

## Reference documents

- [01 — Locked Decisions](01-locked-decisions.md)
- [02 — Data Model](02-data-model.md)
- [03 — Testing Strategy](03-testing-strategy.md)
- [04 — Navigation & UI Flows](04-navigation-ui-flows.md)
- [05 — Token Budget Detail](05-token-budget.md)
- [**HOW TO EXECUTE WITH GSD**](HOW-TO-EXECUTE-WITH-GSD.md) — step-by-step playbook for running the 8 sprints end-to-end

## Execution protocol

Each sprint runs under GSD milestone workflow:

1. `/gsd:plan-phase <sprint-id>` — expand sprint doc into executable PLAN.md
2. Plan-check gate — goal-backward verification
3. `/gsd:execute-phase` — wave-based parallel execution, atomic commits
4. `/gsd:verify-work` — UAT against DoD checklist in sprint doc
5. `/gsd:add-tests` if Nyquist gaps found
6. Commit and advance

Do NOT skip phases. S3a → S3b → S3c must be sequential (ledger must be trusted before recipes deplete from it).

## Non-negotiables

- Parent/child `order_items` for combos (no JSONB blobs)
- One append-only `stock_movements` ledger (rename/extend `inventory_log`)
- All availability rules enforced **server-side** (hard refuse, manager override logged)
- No nested combos (enforced by trigger)
- Category tree max depth **3** (enforced by CHECK)
- WhatsApp key stays in Supabase Vault, never in renderer
- No new runtime deps except `libphonenumber-js` (S5); zero-dep category tree UI
- FSD import boundaries enforced; `eslint-plugin-boundaries` is a blocking gate
- Manager PIN gates refunds, voids-after-payment, and day/time availability overrides (S2/S4)
