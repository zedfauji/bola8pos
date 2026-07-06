# Phase 16: Kitchen/Bar Split Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 16-kitchen-bar-split-routing
**Areas discussed:** isFood vs routing relationship, KDS-bar RBAC, RoutingBadge placement, backfill default, KdsBoard widget reuse

---

## isFood vs routing relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Replace isFood with routing | Drop isFood column, migrate data, /kds filters routing=KITCHEN | ✓ |
| Keep isFood, add routing alongside | Two independent fields, risk of disagreement | |
| Let Claude decide during planning | Defer to researcher/planner | |

**User's choice:** Replace isFood with routing.
**Notes:** Single source of truth avoids two fields disagreeing.

---

## KDS-bar RBAC

| Option | Description | Selected |
|--------|-------------|----------|
| New action view_kds_bar for bartender+manager+admin | Keep view_kds (kitchen+admin) untouched | ✓ |
| Reuse view_kds, extend to bartender+manager | Single permission gates both boards | |
| Let Claude decide during planning | Defer exact RBAC naming to planner | |

**User's choice:** New action view_kds_bar.
**Notes:** Existing view_kds is kitchen+admin only; bartenders shouldn't gain access to the food KDS as a side effect.

---

## RoutingBadge placement

| Option | Description | Selected |
|--------|-------------|----------|
| Category editor + KDS cards | Badge in CategoryTreeEditor and on KdsCard | ✓ |
| Category editor only | Badge only in admin config, not on runtime cards | |
| Let Claude decide during planning | Defer placement to planner | |

**User's choice:** Category editor + KDS cards.

---

## Backfill default

| Option | Description | Selected |
|--------|-------------|----------|
| BAR | Non-food categories default to BAR | ✓ |
| NONE for all non-food | Conservative — nothing routes to bar KDS until admin flips it | |
| Let Claude decide during planning | Defer to researcher inspecting seed data | |

**User's choice:** BAR.
**Notes:** Bar-first business — most non-food categories are drinks. NONE assigned manually per-category post-migration.

---

## kds-bar widget reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse KdsBoard with a routing filter prop | Parameterize existing generic board | ✓ |
| Separate BarKdsBoard widget | Independent copy, more duplication | |
| Let Claude decide during planning | Defer reuse-vs-duplicate call to planner | |

**User's choice:** Reuse KdsBoard with a routing filter prop.

---

## Claude's Discretion

- RoutingBadge visual treatment (color/icon) — follow ComboBadge pattern for consistency.
- NONE-routed items — simple exclusion from both KDS queries, no special handling.
- Migration wave/task ordering (column add → backfill → call-site updates → drop isFood) vs single combined migration.

## Deferred Ideas

None — discussion stayed within phase scope.
