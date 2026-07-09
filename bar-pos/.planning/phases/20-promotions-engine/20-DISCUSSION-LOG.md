# Phase 20: Promotions Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 20-promotions-engine
**Areas discussed:** HH overlap, Auto-apply UX, Stacking, Discount shape, Stack rule, Pool-time, Admin UI, Migration

---

## HH overlap (relationship to existing happy-hour price override)

| Option | Description | Selected |
|--------|-------------|----------|
| Supersede it | New promotions table replaces categories.happy_hour_* / products.happy_hour_price entirely. Migrate existing HH configs into promotions rows; remove old fields/client calc. | ✓ |
| Coexist separately | Old HH fields keep working untouched. New promotions engine is purely additive. | |
| Wrap it server-side | Keep old HH fields as data source, but evaluate_promotions also reads them for audit. | |

**User's choice:** Supersede it (D-01)

---

## Auto-apply UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent auto-apply | evaluate_promotions applies eligible promos with no cashier interaction. | ✓ |
| Cashier confirms first | Eligible promos surface as a banner/prompt; cashier must tap to apply. | |

**User's choice:** Silent auto-apply (D-02)

---

## Stacking

| Option | Description | Selected |
|--------|-------------|----------|
| No stacking — best price wins | Only the single best-price promotion applies per item. | |
| Allow stacking | Multiple eligible promotions can combine on the same item/order. | ✓ |

**User's choice:** Allow stacking (D-03)

---

## Discount shape (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Percentage off | e.g. 20% off item/category during HH window. | ✓ |
| Fixed amount off | e.g. $2 off a specific item. | ✓ |
| Fixed override price | Item price becomes a flat $X, matches existing HH pattern. | ✓ |

**User's choice:** All three (D-04)

---

## Stack rule (precedence, follow-up to Stacking)

| Option | Description | Selected |
|--------|-------------|----------|
| Apply in priority order | Admin-set priority number; apply highest-priority first, compounding sequentially. | ✓ |
| Apply all simultaneously off original price | Each stacked discount computed off original price, summed, not compounded. | |

**User's choice:** Apply in priority order, compounding (D-03 detail)

---

## Pool-time (meaning of "pool-time targeting")

| Option | Description | Selected |
|--------|-------------|----------|
| Discount on pool table billing | Promotion discounts computed pool_sessions charge directly. | ✓ (both) |
| Free/discounted pool time bundled with item purchase | Promotion grants pool minutes as reward for buying targeted item/category (combo-style). | ✓ (both) |

**User's choice:** Both — explicitly confirmed as double-scoped, not a single either/or choice (D-05)

---

## Admin UI

| Option | Description | Selected |
|--------|-------------|----------|
| Combos admin pattern | List table + create/edit dialog with targeting rules + day/time availability picker. | ✓ |
| Simple dedicated tab, no dialog | Inline editable list, no separate dialog. | |

**User's choice:** Combos admin pattern (D-06)

---

## Migration (existing HH data on supersede)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-migrate existing data | Migration script converts existing HH configs into equivalent promotions automatically. | ✓ |
| Drop old fields, no auto-migration | Admins must manually re-create HH promos after ship. | |

**User's choice:** Auto-migrate existing data (D-07)

---

## Claude's Discretion

- Exact evaluation trigger point (item-add time vs order-close time) — recommended item-add time.
- Exact `promotions`/`applied_promotions` column naming conventions.
- Boolean `is_active` flag vs status enum for disable.
- Tiebreak rule for equal-priority promotions.
- Whether pool-time billing discount (D-05a) hooks into the same computation point as Phase 2's prepaid-minutes.

## Deferred Ideas

None raised — discussion stayed within phase scope. Noted explicitly out-of-assumption: per-staff/per-terminal promotion restrictions, coupon-code-based promotions, customer-facing promotion browsing (none of these were requested; flag if they surface during planning as scope creep).
