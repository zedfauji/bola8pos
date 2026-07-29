# Phase 27: One-Shot Inventory (Cigarette-Box Pattern) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 27-one-shot-inventory-cigarette-box-pattern
**Areas discussed:** Product & sellable-unit model, Exhaustion/no-restock behavior, Concurrent open units, Admin Open-Units tab placement & controls

---

## Product & sellable-unit model

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct catalog item | A separate product row (e.g. "Marlboro - Suelto") linked to the parent box product | ✓ |
| Special quantity on the box product | Same product, fractional/unit quantity entered at checkout | |

**User's choice:** Distinct catalog item
**Notes:** Recommended option — matches existing product/order_items modeling with no cart-quantity semantics changes.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed per product | Admin sets a fixed units-per-package number once on the product | ✓ |
| Entered when opening | Staff types the starting count each time a box is opened | |

**User's choice:** Fixed per product

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit per-stick price | Admin sets its own base_price for the loose-stick product | ✓ |
| Always box price ÷ units | Loose stick price computed automatically | |

**User's choice:** Explicit per-stick price

| Option | Description | Selected |
|--------|-------------|----------|
| Generic | Any product can be flagged as "sells via open units" | ✓ |
| Cigarette-specific only | Build narrowly for this one use case now | |

**User's choice:** Generic

---

## Exhaustion / no-restock behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Block, manager override allowed | Same pattern as existing INVENTORY_NEGATIVE flow | ✓ |
| Block with no override | Hard stop, no override | |

**User's choice:** Block, manager override allowed

| Option | Description | Selected |
|--------|-------------|----------|
| Only react at exhaustion | No new low-stock UI this phase | ✓ |
| Warn as it gets low | Add a visible low-remaining-count indicator | |

**User's choice:** Only react at exhaustion

---

## Concurrent open units

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly one at a time | Simplest mental model, matches ROADMAP wording | ✓ |
| Multiple concurrent allowed | Track different batches/expiries separately | |

**User's choice:** Strictly one at a time

| Option | Description | Selected |
|--------|-------------|----------|
| Block with a clear message | Prevents accidental double-opens | ✓ |
| Auto-close the old one and open new | Silently discards remaining count | |

**User's choice:** Block with a clear message

---

## Admin Open-Units tab placement & controls

| Option | Description | Selected |
|--------|-------------|----------|
| New tab in existing /inventory page | Keeps stock-related admin surfaces in one place | ✓ |
| New standalone page/route | More visible/discoverable, adds a new nav entry | |

**User's choice:** New tab in existing /inventory page

| Option | Description | Selected |
|--------|-------------|----------|
| View + open only | Matches ROADMAP success criteria exactly | |
| Also allow manual count correction/void | Adds an edit/void action for damaged sticks, miscounts | ✓ |

**User's choice:** Also allow manual count correction/void

| Option | Description | Selected |
|--------|-------------|----------|
| Manager+ | Matches existing adjust_inventory RBAC action | |
| Any staff (bartender+) | Lower friction for a high-frequency action | ✓ |

**User's choice:** Any staff (bartender+) — for *opening* a new unit specifically.

**Follow-up:** Since count correction/void was also brought in scope, asked whether that action should carry the same any-staff access or require manager+ given its shrinkage-vector risk.

| Option | Description | Selected |
|--------|-------------|----------|
| Manager+ for void/correction | Gate write-off/shrinkage-risk action like other inventory-adjusting actions | ✓ |
| Any staff for both | Consistent, low-friction | |

**User's choice:** Manager+ for void/correction

**Notes:** Final split — opening a new unit is any staff (bartender+); correcting/voiding remaining count requires manager+ (same tier as `adjust_inventory`).

---

## Claude's Discretion

- Whether `open_units` integrates with the `stock_movements` ledger or tracks state independently
- Exact `open_units` column naming
- New `audit-actions.ts` enum entries for the open-unit lifecycle
- How the loose-piece product links to its parent (new FK on `products` vs. via `open_units`)
- Exact UI layout of the new Open-Units tab

## Deferred Ideas

- Proactive low-remaining-count warnings (explicitly deferred, not this phase)
- Multiple concurrent open units per product for batch/expiry tracking (explicitly rejected for this phase)
- 3 low-relevance pending todos surfaced by `todo.match-phase` (misplaced `.github/workflows/`, inert git hooks, print-popup Playwright hang) — reviewed, none matched this phase's domain, none folded
