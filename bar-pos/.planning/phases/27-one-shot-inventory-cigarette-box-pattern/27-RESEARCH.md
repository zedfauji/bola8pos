# Phase 27: One-Shot Inventory (Cigarette-Box Pattern) - Research

**Researched:** 2026-07-29
**Domain:** Postgres/Supabase atomic RPC design, row-locking concurrency, RLS/RBAC, audit-log wiring — no new frontend framework or npm package surface
**Confidence:** HIGH (all findings sourced by reading the actual repo migrations/code this phase must extend — no external library research was needed; this is a same-codebase-convention phase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A loose piece (e.g. "Marlboro - Suelto") is a **distinct catalog product**, linked to its parent package product, shown in the product grid like any other product — not a special quantity/unit typed against the box product itself. — Reversibility: costly — rationale: switching to a fractional-quantity-on-one-product model later would require reworking cart/order_items quantity semantics across receipts, KDS, and reports; the linked-product model reuses existing product/order_items plumbing unchanged.
- **D-02:** "Units per box" (e.g. 20 sticks) is a **fixed value configured once on the parent product** (new field, e.g. `products.units_per_package`), not entered by staff each time a box is opened.
- **D-03:** The loose-piece product has its **own explicit `base_price`**, set by admin like any other product — never auto-derived from `box_price / units_per_package`. Reflects real per-piece markup.
- **D-04:** The feature is **generic**, not cigarette-specific — any product can be flagged as "sells via open units." Matches the ROADMAP's generic `open_units` table name; the cigarette box is the first (not only) use case.
- **D-05:** When an open unit reaches 0 and the parent product also has 0 unopened boxes in stock, selling the loose-piece product is **blocked with the same override mechanism as existing negative-stock handling** (`INVENTORY_NEGATIVE`-style error, manager PIN override to proceed, audit-logged `stock_override`) — one consistent override mechanism app-wide, not a second one specific to open units.
- **D-06:** **No proactive low-remaining-count warning** in this phase (e.g. no "2 sticks left" indicator). The system only reacts once a unit is fully exhausted and a new one must be opened. Existing box-level `low_stock_threshold` already covers package-level low stock; open-unit-level warnings are an explicit future enhancement, not this phase's scope.
- **D-07:** **Strictly one active open unit per product at a time.** A box cannot be opened while another open unit of the same product is still active (has remaining count > 0). — Reversibility: costly — rationale: allowing multiple concurrent open units later would require reworking `consume_open_unit`'s targeting logic and any DB uniqueness constraint enforcing "one active row per product."
- **D-08:** Manually trying to open a new unit while one is still active is **blocked with a clear message** ("An open unit already exists for this product ({N} remaining) — sell through it first"), not auto-closed/discarded.
- **D-09:** Open-Units management lives as a **new tab inside the existing `/inventory` page** (alongside `InventoryPagePanel`'s current content), not a new standalone route.
- **D-10:** Beyond viewing open units and manually opening a new one, staff can also **manually correct the remaining count or void/close an open unit early** — this is in scope for this phase, not deferred.
- **D-11:** **Any staff (bartender+) can open a new unit** — does not require the `adjust_inventory` (manager+) gate used for other inventory-adjusting actions.
- **D-12:** **Manual count correction or void of an open unit requires manager+** (same RBAC tier as `adjust_inventory`).

### Claude's Discretion

- Whether `open_units` rows integrate with the existing `stock_movements` ledger, or track state independently — follow whichever keeps `consume_open_unit` atomic and consistent with `record_stock_movement`'s existing row-locking pattern, without forcing an artificial fit if the shapes don't match.
- Exact `open_units` column names/shape — follow closest existing convention (`inventory.quantity_on_hand`, `recipe_items.qty`).
- New `audit-actions.ts` enum entries for the open-unit lifecycle (open/deplete/exhaust/void/correct) — add new entries following the existing enum + `record_audit` pattern (Phase 14), do not overload the generic `inventory.manual_adjust` action.
- Whether the loose-piece product is linked to its parent via a new FK column on `products` (e.g. `parent_product_id`) or via the `open_units` table itself — follow whichever keeps `consume_open_unit` and the product-grid query simplest.
- Exact UI layout of the new Open-Units tab — follow the nearest existing admin-tab pattern (Settings tabs, `InventoryPagePanel`'s existing batch-adjustment dialog).

### Deferred Ideas (OUT OF SCOPE)

- Proactive low-remaining-count warnings/indicators on open units (D-06) — explicitly deferred.
- Multiple concurrent open units per product for batch/expiry tracking (D-07) — explicitly rejected for this phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

No formal `REQUIREMENTS.md`/requirement-ID source exists for this milestone (confirmed absent — same gap already flagged in Phases 14/16/17/27 CONTEXT.md docs; `POS-COMPARISON.md` referenced by ROADMAP.md does not exist in the repo). The phase's 4 ROADMAP success criteria are treated as the requirement set and are referenced below as SC-1..SC-4:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `open_units` table tracks opened-unit state (remaining count, parent product, opened-by/when) | Schema design in `## Code Examples` — mirrors `inventory`/`recipe_items` column-naming convention, adds `status`/`opened_by`/`opened_at`/`closed_*` lifecycle columns |
| SC-2 | `consume_open_unit` SQL function atomically decrements remaining count, auto-transitions to a new unit when exhausted | `## Architecture Patterns` Pattern 1 + `## Code Examples` — row-locking convention extracted from `record_stock_movement`/`deplete_for_order_item`, auto-transition loop design |
| SC-3 | Admin Open-Units tab shows currently open units and lets staff manually open a new one | `## Architecture Patterns` — Settings-tabs `Tabs` primitive precedent, RBAC split (D-11 bartender-open vs D-12 manager-correct/void) |
| SC-4 | Lifecycle (opened → depleting → exhausted) reportable via `audit_logs` (Phase 14) | `## Architecture Patterns` Pattern 3 + Pitfall 1 — `record_audit()` wiring pattern, and the legacy-vs-new audit table trap |

</phase_requirements>

## Summary

This phase adds zero new frameworks or npm packages — it is a pure extension of conventions already established in this codebase across Phases 3 (recipes/stock_movements), 4 (INVENTORY_NEGATIVE override), 14 (audit_logs), 15 (versioned rows/row-locking), and 17 (modifier_inventory_rules). The correct approach is almost entirely "find the closest existing pattern and copy it," not invent something new — this file exists to point at the exact files that hold those patterns and flag the two places where a naive copy would be wrong.

The single highest-leverage finding: **`deplete_for_order_item` is already the one server-side chokepoint every order-item mutation (place order, void, refund-restock, negative-stock override) routes through** — it is `PERFORM`ed from inside `create_order_with_items` and called directly by `useVoidOrder`/`useOverrideNegativeStock` for the paths that skip the main RPC. Rather than teaching order-entry a second RPC call site (`consume_open_unit`) that every one of those four callers would need to learn about, `consume_open_unit` should be invoked **from inside `deplete_for_order_item`** as a new branch (`IF` the order item's product has `parent_product_id IS NOT NULL`), after the existing recipe-loop and modifier-loop. This gets voiding/refunding/overriding an open-unit sale for free, with zero new client wiring — it is the DRY design the existing codebase already points to. This is a *design recommendation*, not a locked decision — flag it for the planner/discuss-phase to confirm since CONTEXT.md does not explicitly settle it.

The second highest-leverage finding: there are **two parallel audit tables in this codebase** — the legacy singular `audit_log` (raw `INSERT`, no `record_audit()` wrapper, still used today by `deplete_for_order_item`'s `stock_override` INSERT and by `useOverrideNegativeStock`'s client-side override-decision INSERT) and the new plural `audit_logs` + `record_audit()` SECURITY DEFINER RPC (Phase 14, the one `audit-actions.ts`'s `AuditActionSchema` enum and CI test actually govern). D-05 says to reuse the *override mechanism*, not the audit table it happens to write to today — this phase's `stock_override`-equivalent bypass and its `open_unit.*` lifecycle events should all go through `record_audit()`/`audit_logs` (Phase 14's actual system, which SC-4 explicitly names), not copy the legacy raw-`INSERT`-into-`audit_log` code path verbatim. See Pitfall 1.

Third: `record_stock_movement`'s atomicity model is `SELECT ... FOR UPDATE` on the target row before mutating it, inside a `SECURITY DEFINER` function — no advisory locks, no optimistic version columns for this class of table (`versioned_rows`/optimistic concurrency is a *different* pattern used only for `tabs`/`pool_sessions`/`caja_sessions`, not for stock tables). `consume_open_unit` should lock the `open_units` row (and, when auto-opening a new unit, the `inventory` row for the box product) with `FOR UPDATE` exactly the same way, inside its own `SECURITY DEFINER` function.

**Primary recommendation:** Add `open_units` as a sibling table to `inventory` (not a replacement), lock its active row with `FOR UPDATE` inside a new `consume_open_unit` SECURITY DEFINER function invoked from inside `deplete_for_order_item`; enforce D-07's "one active unit" invariant with a Postgres partial unique index (`WHERE status = 'active'`), the exact pattern already used for `caja_sessions_one_open`; wire lifecycle events through `record_audit()`/`audit_logs` (Phase 14), not the legacy `audit_log` table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `open_units` row locking / atomic decrement / auto-transition | Database / Storage (Postgres RPC) | — | Concurrency correctness under simultaneous terminal sales can only be guaranteed by a DB-level row lock (`FOR UPDATE`), not client-side logic; matches `record_stock_movement` precedent |
| "One active open unit per product" invariant (D-07) | Database / Storage (partial unique index) | API / Backend (friendly error translation) | A unique index is race-proof by construction; app-level pre-check-then-insert is not (TOCTOU) |
| Loose-piece product catalog entry + linkage (D-01–D-04) | Database / Storage (`products` schema) | Frontend / Client (product grid, no special-casing) | New nullable columns on an existing table; frontend renders it like any product, no new component |
| Order-entry consumption trigger | API / Backend (`deplete_for_order_item` extension) | — | Existing single chokepoint for order/void/refund/override — extend it, don't add a parallel call site |
| Exhaustion / no-restock override (D-05) | API / Backend (RPC guard + bypass) | Frontend / Client (`ManagerPinDialog` reuse) | Mirrors the existing `INVENTORY_NEGATIVE` → PIN override → audit flow end-to-end |
| Admin Open-Units tab (view / open / correct / void) | Frontend / Client (`InventoryPagePanel` new tab) | API / Backend (3 new RPCs: open/correct/void) | New UI surface (D-09); each action is its own SECURITY DEFINER RPC with its own RBAC guard (D-11 vs D-12) |
| Lifecycle audit logging (SC-4) | API / Backend (`record_audit()` calls inside each RPC) | — | Phase 14's `record_audit()` is SECURITY DEFINER and non-fatal-on-failure by design — call it, don't reinvent |

## Standard Stack

No new libraries. This phase is 100% additive Postgres migrations + React/TS following existing FSD conventions (`@shared/ui/tabs`, `@shared/ui/DataTable`, `@shared/ui/dialog`, TanStack Query, Zustand, Zod). Confirmed already in `package.json`: `react ^19.1.0`, `zod ^4.3.6`, `@tanstack/react-query ^5.99.0`, `typescript ~5.8.3` — all `[VERIFIED: package.json]`, no version bump needed.

## Package Legitimacy Audit

**N/A — this phase installs no new npm packages.** Every dependency (`@shared/ui/tabs`, `DataTable`, `ManagerPinDialog`, TanStack Query, Zod) already exists in `package.json` and is used elsewhere in the codebase (see file citations throughout this document). The Package Legitimacy Gate is not triggered.

## Architecture Patterns

### System Architecture Diagram

```
Order entry (CartPanel / addOrderMutation)
        │
        ▼
create_order_with_items (RPC, SECURITY DEFINER)
        │  INSERT order_items row
        │  PERFORM deplete_for_order_item(item_id, +1, p_allow_negative)  ◄── existing chokepoint
        │           │
        │           ├─ recipe loop        (ingredients, FOR UPDATE via record_stock_movement)
        │           ├─ modifier loop       (ingredients, FOR UPDATE via record_stock_movement)
        │           └─ NEW: open-unit branch (products.parent_product_id IS NOT NULL)
        │                    │
        │                    ▼
        │           consume_open_unit(product_id, qty, order_item_id, direction, p_allow_negative)
        │                    │  SELECT ... FOR UPDATE open_units WHERE product_id=parent AND status='active'
        │                    │
        │                    ├─ found, remaining_count >= qty → decrement, maybe mark 'exhausted'
        │                    ├─ found, remaining_count <  qty → decrement to 0, mark 'exhausted',
        │                    │                                   loop: auto-open next unit, continue consuming
        │                    ├─ not found → auto-open (FOR UPDATE inventory row for box product,
        │                    │                          decrement box qty by 1, INSERT open_units status='active')
        │                    │              → if box qty is 0 too: RAISE INVENTORY_NEGATIVE
        │                    │                (unless p_allow_negative → bypass, audit stock_override)
        │                    └─ PERFORM record_audit('open_unit.open'|'deplete'|'exhaust', ...)  (Phase 14)
        │
        ▼
Client: on INVENTORY_NEGATIVE → ManagerPinDialog (requiredAction) → override RPC call with p_allow_negative=true

Admin Open-Units tab (new, inside InventoryPagePanel, D-09)
        │
        ├─ view: SELECT open_units JOIN products (all authenticated, RLS read policy)
        ├─ open new unit (D-11, bartender+): open_open_unit RPC (SECURITY DEFINER, role guard bartender+)
        │        → blocked by the SAME partial unique index if one is already active (D-08 friendly error)
        └─ correct/void (D-12, manager+): correct_open_unit / void_open_unit RPC
                 (SECURITY DEFINER, role guard manager+, ManagerPinDialog gate client-side)
                 → PERFORM record_audit('open_unit.correct'|'open_unit.void', ...)
```

### Recommended Project Structure

```
supabase/migrations/
├── <ts>_open_units_table.sql            # table + partial unique index + RLS
├── <ts>_products_open_unit_columns.sql  # units_per_package, parent_product_id
├── <ts>_consume_open_unit_rpc.sql       # atomic decrement/auto-transition
├── <ts>_open_unit_lifecycle_rpcs.sql    # open_open_unit, correct_open_unit, void_open_unit
└── <ts>_deplete_for_order_item_v5_open_units.sql  # branch into consume_open_unit

src/
├── entities/open-unit/
│   ├── model/
│   │   ├── types.ts       # OpenUnitSchema (Zod) — mirror InventorySchema shape
│   │   ├── queries.ts      # useOpenUnits, useMutationOpenUnit, useMutationCorrectOpenUnit, useMutationVoidOpenUnit
│   │   └── store.ts         # only if Realtime subscription is needed (optional — confirm with planner)
│   └── ui/                  # row/card components for the admin tab
├── features/open-open-unit/       # bartender+ action — mutation hook + trigger button
├── features/correct-open-unit/    # manager+ action — ManagerPinDialog-gated dialog
├── features/void-open-unit/       # manager+ action — ManagerPinDialog-gated dialog
└── widgets/InventoryPagePanel.tsx # add <Tabs> wrapper, new "Open Units" TabsContent (D-09)
```

This mirrors the nearest existing entity (`entities/inventory/model/`) and nearest existing admin-dialog feature (`features/manage-modifier-inventory-rules/ui/ModifierIngredientRulesDialog.tsx`) named in CONTEXT.md's canonical refs.

### Pattern 1: Row-locking atomic decrement (from `record_stock_movement`)

**What:** Every mutating stock RPC in this codebase locks the target row with `SELECT ... FOR UPDATE` before computing the new value, inside a `SECURITY DEFINER` function with `SET search_path = public`. This is the *only* concurrency-safety mechanism used for stock tables in this codebase — there is no advisory-lock or optimistic-version pattern for this class of table (that pattern — `bump_version_on_update()` trigger, `supabase/migrations/20260512000001_versioned_rows.sql` — exists only for `tabs`/`pool_sessions`/`caja_sessions`, session-lifecycle tables with a different conflict shape, not stock counters. Do not import it here.)

**When to use:** `consume_open_unit` locking the active `open_units` row, and locking the box product's `inventory` row when auto-opening a fresh unit.

**Example (from `supabase/migrations/20260426000003_record_stock_movement_rpc.sql`):**
```sql
-- Source: supabase/migrations/20260426000003_record_stock_movement_rpc.sql
SELECT quantity_on_hand INTO v_current
FROM   ingredients
WHERE  id = p_ingredient_id
FOR UPDATE;

IF NOT FOUND THEN
  RAISE EXCEPTION 'INGREDIENT_NOT_FOUND: ingredient % does not exist', p_ingredient_id;
END IF;

v_new := v_current + p_delta;

IF v_new < 0 AND p_reason NOT IN ('correction', 'physical_count') THEN
  RAISE EXCEPTION 'INVENTORY_NEGATIVE: result would be % for ingredient %', v_new, p_ingredient_id;
END IF;
```

**Important gotcha:** `record_stock_movement` operates on the `ingredients` table (recipe raw materials), not `products`/`inventory`. The box-level product stock table (`inventory`, 1:1 with `products`) is a *third*, separate stock surface, and its only mutation path today (`useMutationAdjustInventory` in `src/entities/inventory/model/queries.ts`) does a plain `SELECT` then `.update()` with **no `FOR UPDATE` lock at all** — a pre-existing race condition in this codebase, out of scope to fix, but **do not copy that pattern** for the new `open_units`/box-decrement-on-auto-open logic. Use `FOR UPDATE` there too, inside the new SECURITY DEFINER function.

### Pattern 2: "At most one active row" via partial unique index (D-07)

**What:** The codebase already has this exact invariant for `caja_sessions` ("at most one open caja"), enforced with a Postgres partial unique index — not a trigger, not an app-level check-then-insert (which is race-prone: two terminals can both pass a `SELECT` check before either `INSERT`s).

**When to use:** D-07's "strictly one active open unit per product at a time."

**Example (from `supabase/migrations/20260420000002_caja_sessions.sql`):**
```sql
-- Source: supabase/migrations/20260420000002_caja_sessions.sql
CREATE UNIQUE INDEX IF NOT EXISTS caja_sessions_one_open
  ON caja_sessions (status)
  WHERE status = 'open';
```

For `open_units`, index on `product_id` (not a global single-row invariant like caja — this needs "at most one active per *product*"):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS open_units_one_active_per_product
  ON open_units (product_id)
  WHERE status = 'active';
```

The manual "open new unit" RPC (D-11) attempts an `INSERT` and catches `unique_violation` (SQLSTATE `23505`) to produce D-08's friendly "already exists" message — this is also the concurrency-safe way to handle two bartenders racing to open the same product simultaneously (the loser gets the friendly error instead of silently creating a second active row). This is the same idempotency-via-unique-index-plus-catch pattern already used for `stock_movements`' `(ref_type, ref_id, ingredient_id)` idempotency index (`supabase/migrations/20260426000002_stock_movements_idempotency_index.sql`).

### Pattern 3: `record_audit()` wiring (Phase 14, for SC-4)

**What:** Every sensitive RPC calls `record_audit(action, entity_type, entity_id, before, after, source)` once, on the success path, right before `RETURN`. It is `SECURITY DEFINER`, catches its own exceptions internally (`EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN NULL;`), so a `PERFORM record_audit(...)` call can never abort the caller's transaction.

**When to use:** Add 5 new `AuditActionSchema` entries in `src/shared/lib/audit-actions.ts` — e.g. `open_unit.open`, `open_unit.deplete`, `open_unit.exhaust`, `open_unit.void`, `open_unit.correct` (namespacing convention: `<entity>.<verb>`, matches existing `inventory.deplete`/`inventory.manual_adjust`/`inventory.physical_count`). A CI test (`src/shared/lib/__tests__/audit-actions.test.ts`) greps every migration file and asserts every `record_audit()` call uses an action present in this enum — **add the enum entries in the same migration wave as the RPCs that call them, or CI fails.**

**Example (from `supabase/migrations/20260511000002_rpc_audit_wiring.sql`):**
```sql
-- Source: supabase/migrations/20260511000002_rpc_audit_wiring.sql (close_caja_session)
SELECT to_jsonb(c) INTO v_after_row FROM caja_sessions c WHERE c.id = p_caja_id;
PERFORM record_audit(
  'caja.close',
  'caja_session',
  p_caja_id,
  v_before_row,
  v_after_row,
  'rpc'
);
```

### Pattern 4: RBAC role guard inside SECURITY DEFINER functions

**What:** Role checks live inside the function body via `get_user_role()` (a DB helper, `supabase/migrations/20260414000009_rls_policies.sql`), not solely in RLS — this is the "defense-in-depth" convention this codebase repeats everywhere.

**Example (bartender+ guard, from `deplete_for_order_item`):**
```sql
IF get_user_role() IS NULL OR get_user_role() = 'kitchen' THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: bartender or higher required to call deplete_for_order_item';
END IF;
```

**Example (manager+ guard, from `process_refund`):**
```sql
IF get_user_role() NOT IN ('manager', 'admin') THEN
  RAISE EXCEPTION 'AUTH_FORBIDDEN: manager or admin role required';
END IF;
```

Use the bartender+ form for `open_open_unit` (D-11) and the manager+ form for `correct_open_unit`/`void_open_unit` (D-12). `consume_open_unit` itself needs no independent guard when called from inside `deplete_for_order_item` — it inherits that function's existing bartender+ guard.

### Anti-Patterns to Avoid

- **Writing to the legacy `audit_log` (singular) table for new lifecycle events:** it still exists and is still written to by `deplete_for_order_item`'s `stock_override` insert and `useOverrideNegativeStock`'s client-side insert, but it predates Phase 14 and is explicitly "kept for backward compat; will be removed in Phase 22" (per a comment in `process_refund`). SC-4 names `audit_logs` (Phase 14) specifically — use `record_audit()`, not a raw `INSERT INTO audit_log`.
- **Checking `inventory.quantity_on_hand` for the box product without `FOR UPDATE`:** the existing `useMutationAdjustInventory` client-side read-then-write is a known race window; don't replicate it server-side in the new auto-open branch.
- **App-level "is there already an active unit?" `SELECT` before `INSERT`:** race-prone (TOCTOU). Let the partial unique index be the source of truth; catch `23505` for the friendly D-08 message.
- **A second client-side RPC call site for `consume_open_unit`:** every existing order-item mutation path (place order, void, refund-restock, negative-stock override) already funnels through `deplete_for_order_item`. Branching inside it, rather than teaching 3+ client call sites about a new RPC, avoids missed call sites (a real historical bug class in this codebase — see the CR-01 fix in `20260707000001_deplete_for_order_item_v4...sql` where a *different* omission inside this same function broke an entire code path).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic row decrement under concurrency | A custom locking scheme (mutex table, advisory lock) | `SELECT ... FOR UPDATE` inside `SECURITY DEFINER` | Exact pattern already proven at scale in this codebase (`record_stock_movement`); advisory locks and version columns are used for other conflict shapes, not this one |
| "One active row" invariant | App-level pre-check + insert, or a `BEFORE INSERT` trigger that queries the table | Partial unique index (`WHERE status = 'active'`) | Race-proof by construction; zero extra code; `caja_sessions_one_open` is the exact same shape already in this schema |
| Audit trail for a new lifecycle | A new logging table or ad-hoc `console.log`/toast-only tracking | `record_audit()` (Phase 14) | Already SECURITY DEFINER, non-fatal-on-failure, has an enforced enum + CI test — adding a 6th action label costs one line |
| Manager PIN gate on a sensitive action | A new PIN-entry component | `ManagerPinDialog` (`src/features/manager-pin-gate`) with a `requiredAction: StaffAction` prop | Already handles staff lookup, PIN verification, and `canAccess()` filtering; just needs a `requiredAction` matching `adjust_inventory` (or a new dedicated `StaffAction` if the planner wants a distinct denial-message tooltip) |
| Admin tab UI shell | A new tabs component | `@shared/ui/tabs` (`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, Radix-based shadcn primitive) | Already used identically in `SettingsCatalogPanel.tsx`, `SettingsTabsPanel/index.tsx`, `ProductsSettingsTab.tsx` — `InventoryPagePanel.tsx` currently has no tabs and needs exactly this wrapper added (per CONTEXT.md's canonical-refs note) |

**Key insight:** Every piece of infrastructure this phase needs — atomic locking, uniqueness invariants, audit logging, PIN gating, tabbed admin UI — already exists in this codebase in a directly-transferable shape. The work is composition, not invention.

## Common Pitfalls

### Pitfall 1: Two audit tables, only one is "the" Phase 14 system
**What goes wrong:** Copying the existing `INVENTORY_NEGATIVE`-override code verbatim (as D-05 instructs you to reuse "the same mechanism") pulls in a raw `INSERT INTO audit_log (...)` call — the *legacy* singular table, not `record_audit()`/`audit_logs`.
**Why it happens:** The negative-stock override flow was built in Phase 4, before Phase 14 introduced `audit_logs`/`record_audit()`; it was never migrated. `deplete_for_order_item`'s `stock_override` branch and `useOverrideNegativeStock`'s client-side override-decision insert both still target `audit_log` (singular) today.
**How to avoid:** For this phase's `stock_override`-equivalent (open-unit exhaustion bypass) and all `open_unit.*` lifecycle events, call `record_audit()` against `audit_logs`. SC-4 explicitly names `audit_logs` (Phase 14) as the reportable system.
**Warning signs:** A migration `INSERT`s directly into a table named `audit_log` (singular) instead of `PERFORM record_audit(...)`.

### Pitfall 2: `inventory` table vs `ingredients` table vs `open_units` — three different stock surfaces
**What goes wrong:** Assuming `record_stock_movement` (which locks `ingredients`) can be reused unmodified for box-level product stock (`inventory` table) or the new `open_units` table.
**Why it happens:** All three are "stock counters" conceptually, but they are three separate tables with three separate mutation code paths in this codebase (recipe ingredients via `record_stock_movement`; box-level product stock via `useMutationAdjustInventory`'s unlocked client update; open units will be a fourth, new one).
**How to avoid:** `consume_open_unit` needs its own `FOR UPDATE` locking logic against `open_units` (and against `inventory` only when auto-opening consumes a box) — it cannot just `PERFORM record_stock_movement(...)` and expect it to touch the right table.
**Warning signs:** A new function calls `record_stock_movement()` expecting it to affect `open_units` or `inventory` rows — it will silently no-op or error (`INGREDIENT_NOT_FOUND`) because it only ever looks at `ingredients`.

### Pitfall 3: Mid-sale exhaustion crossing a unit boundary
**What goes wrong:** A naive `remaining_count := remaining_count - p_qty` with a `< 0` guard treats "sell 3 loose sticks when only 1 remains" as a hard block (or a plain negative-count override), when the correct behavior per SC-2 ("auto-transitions to a new unit when exhausted") is: consume the last 1 from the old unit, mark it exhausted, auto-open a fresh unit (if a box is available), and consume the remaining 2 from the new unit — all inside the same atomic call.
**Why it happens:** `order_items.quantity` can be > 1 for a single line (a bartender selling 3 loose sticks in one tap), so a single `consume_open_unit` call must potentially span two (or more, if `units_per_package` is small) `open_units` rows.
**How to avoid:** Loop inside `consume_open_unit`: consume `LEAST(remaining_to_consume, current_unit.remaining_count)` from the locked active unit each iteration; if the current unit hits 0, mark it `exhausted` and attempt to auto-open the next one (repeating the box-inventory check/lock) before continuing the loop. Only raise `INVENTORY_NEGATIVE` (or bypass under `p_allow_negative`) when a fresh unit cannot be opened and there is still unconsumed quantity.
**Warning signs:** A test that sells `quantity > remaining_count` produces a negative `remaining_count` on a single row instead of transitioning to a fresh unit; or a box that had stock available never gets auto-decremented on exhaustion.

### Pitfall 4: `ManagerPinDialog`'s `requiredAction` prop needs an intentional choice
**What goes wrong:** The existing `INVENTORY_NEGATIVE` override flow in `CartPanel.tsx` passes `requiredAction="void_order"` to `ManagerPinDialog` — not `adjust_inventory`, which would seem like the more semantically correct choice and is what D-12 says to use for open-unit correct/void. This is a pre-existing quirk/inconsistency in the codebase, not a convention to necessarily copy verbatim.
**Why it happens:** `ManagerPinDialog` takes any `StaffAction` and just filters `canAccess(role, requiredAction)` — any manager+-gated action works mechanically, so the choice was likely made loosely rather than deliberately.
**How to avoid:** For D-12 (correct/void open unit), use `requiredAction="adjust_inventory"` deliberately — it is manager+, matches D-12's stated intent ("same RBAC tier as `adjust_inventory`"), and gives an accurate denial tooltip. For D-05's exhaustion-override-in-order-entry case, either reuse `void_order` (matching the existing `CartPanel` precedent exactly, for consistency of that specific flow) or `adjust_inventory` (more semantically accurate) — flag this as an explicit open question for the planner/discuss-phase rather than silently picking one.
**Warning signs:** A denial tooltip that says "Manager access required" for an action that's actually gated on an unrelated `StaffAction` string.

### Pitfall 5: Forgetting the CI audit-actions enum gate
**What goes wrong:** A migration calls `PERFORM record_audit('open_unit.open', ...)` but `open_unit.open` was never added to `AuditActionSchema` in `src/shared/lib/audit-actions.ts` — CI fails (`src/shared/lib/__tests__/audit-actions.test.ts` greps migrations for `record_audit()` calls and asserts the action string is in the enum).
**How to avoid:** Add all 5 new action strings to `audit-actions.ts` in the same plan/wave as the RPC migrations that reference them.

## Code Examples

### `open_units` table + partial unique index + RLS (new)
```sql
-- Sketch — follows the closest existing conventions (inventory.quantity_on_hand naming,
-- caja_sessions_one_open partial-index pattern, modifier_inventory_rules RLS shape)
CREATE TABLE open_units (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES products(id),  -- the BOX (parent) product
  remaining_count int NOT NULL CHECK (remaining_count >= 0),
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'exhausted', 'void')),
  opened_by      uuid REFERENCES profiles(id),
  opened_at      timestamptz NOT NULL DEFAULT now(),
  closed_by      uuid REFERENCES profiles(id),
  closed_at      timestamptz,
  closed_reason  text,  -- e.g. 'exhausted' | 'voided' | 'corrected_to_zero'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX open_units_one_active_per_product
  ON open_units (product_id) WHERE status = 'active';

ALTER TABLE open_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_units_select_authenticated"
  ON open_units FOR SELECT TO authenticated USING (true);

-- Direct client writes restricted to manager/admin (defense-in-depth); bartender-initiated
-- opens still succeed because open_open_unit is SECURITY DEFINER and bypasses RLS —
-- exact same shape as stock_movements_insert_manager_admin + record_stock_movement.
CREATE POLICY "open_units_write_manager_admin"
  ON open_units FOR ALL TO authenticated
  USING (get_user_role() IN ('manager', 'admin'))
  WITH CHECK (get_user_role() IN ('manager', 'admin'));
```

### `products` new columns (new)
```sql
ALTER TABLE products
  ADD COLUMN units_per_package  int,             -- set on the BOX product (D-02)
  ADD COLUMN parent_product_id  uuid REFERENCES products(id);  -- set on the LOOSE product (D-01)

-- A product is "openable" when units_per_package IS NOT NULL.
-- A product "sells via open unit" when parent_product_id IS NOT NULL.
```

### `consume_open_unit` — atomic decrement with auto-transition (sketch)
```sql
-- Sketch for planner review — follows record_stock_movement's FOR UPDATE convention
-- and deplete_for_order_item's p_direction/p_allow_negative calling convention.
CREATE OR REPLACE FUNCTION consume_open_unit(
  p_product_id      uuid,     -- LOOSE product id (has parent_product_id set)
  p_qty             int,
  p_order_item_id   uuid,
  p_direction       smallint, -- +1 sale, -1 refund/void
  p_allow_negative  boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_id     uuid;
  v_remaining_qty int := p_qty;
  v_unit          record;
  v_take          int;
BEGIN
  SELECT parent_product_id INTO v_parent_id FROM products WHERE id = p_product_id;
  IF v_parent_id IS NULL THEN RETURN; END IF;  -- not an open-unit product; no-op

  IF p_direction = -1 THEN
    -- Refund/void: credit back to whichever unit is active for this product
    -- (or create a fresh one if none is active — simplest: never resurrect an
    -- exhausted unit, always credit the current active row, capped by units_per_package).
    -- Full logic left to implementation; sketch omitted for brevity.
    RETURN;
  END IF;

  WHILE v_remaining_qty > 0 LOOP
    SELECT * INTO v_unit FROM open_units
      WHERE product_id = v_parent_id AND status = 'active'
      FOR UPDATE;

    IF NOT FOUND THEN
      -- Auto-open: lock + decrement the box's inventory row
      PERFORM 1 FROM inventory WHERE product_id = v_parent_id FOR UPDATE;
      -- ... check quantity_on_hand > 0, decrement by 1, INSERT open_units(status='active') ...
      -- ... if quantity_on_hand = 0: RAISE 'INVENTORY_NEGATIVE: ...' unless p_allow_negative
      CONTINUE;  -- re-select the newly opened row
    END IF;

    v_take := LEAST(v_remaining_qty, v_unit.remaining_count);
    UPDATE open_units
      SET remaining_count = remaining_count - v_take,
          status = CASE WHEN remaining_count - v_take = 0 THEN 'exhausted' ELSE status END,
          closed_at = CASE WHEN remaining_count - v_take = 0 THEN now() ELSE closed_at END,
          closed_reason = CASE WHEN remaining_count - v_take = 0 THEN 'exhausted' ELSE closed_reason END,
          updated_at = now()
      WHERE id = v_unit.id;

    v_remaining_qty := v_remaining_qty - v_take;

    IF v_remaining_qty = 0 THEN
      PERFORM record_audit('open_unit.deplete', 'open_unit', v_unit.id, NULL,
        jsonb_build_object('order_item_id', p_order_item_id, 'qty', v_take), 'rpc');
    END IF;
  END LOOP;
END;
$$;
```

### `deplete_for_order_item` extension point (sketch)
```sql
-- Add after the existing modifier loop in deplete_for_order_item (v5):
IF EXISTS (SELECT 1 FROM products WHERE id = v_product_id AND parent_product_id IS NOT NULL) THEN
  PERFORM consume_open_unit(v_product_id, v_qty, p_order_item_id, p_direction, p_allow_negative);
END IF;
```

## State of the Art

Not applicable — no external library/framework version drift to track. All patterns are same-codebase precedent, dated within the last ~3 months of this repo's own history (Phase 14: audit_logs, 2026-05-11; Phase 15: versioned rows, 2026-05-12; Phase 17: modifier_inventory_rules, 2026-07-06).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `consume_open_unit` should be invoked from *inside* `deplete_for_order_item` (new branch) rather than as a separate client-called RPC | Summary, Anti-Patterns | If the planner instead wires a second client call site, void/refund/override paths will each need their own new call — a real risk of a missed call site (this codebase has hit that exact bug class before, see CR-01 in `20260707000001_...v4...sql`) |
| A2 | `open_units.product_id` references the BOX (parent) product, not the loose-piece product | Code Examples | If reversed, the partial unique index and the order-entry lookup (`products.parent_product_id`) would both need re-deriving; would break D-07's "one active unit per product" framing which is naturally per-box-product |
| A3 | Column names `remaining_count`, `status` (`active`/`exhausted`/`void`), `opened_by`/`opened_at`/`closed_by`/`closed_at`/`closed_reason` | Code Examples | Cosmetic only — CONTEXT.md explicitly delegates exact naming to Claude's discretion; low risk, easy to rename before first migration lands |
| A4 | Mid-sale exhaustion (selling qty > remaining_count in one line) should auto-transition within the same atomic call (loop across units), not just lazily on the *next* sale | Pitfall 3, Code Examples | If the planner instead chooses lazy-only transition (never split a single line item across two open units), the design simplifies significantly (no `WHILE` loop) — worth confirming with the user/planner since CONTEXT.md doesn't explicitly address multi-quantity loose-piece lines |
| A5 | `ManagerPinDialog`'s `requiredAction` for D-05's exhaustion override in order-entry should be decided deliberately (`void_order` to match existing `CartPanel` precedent vs `adjust_inventory` to match D-12's stated RBAC tier) | Pitfall 4 | Low risk either way (both are manager+-gated), but affects the denial tooltip copy shown to bartenders |

## Open Questions

1. **Should `consume_open_unit` be called from inside `deplete_for_order_item`, or as a sibling RPC order-entry calls directly?**
   - What we know: The existing chokepoint pattern strongly favors nesting it (see A1); CONTEXT.md's code_context section phrases it as "the single new integration point order-entry needs to call... mirroring how `deplete_for_order_item` is invoked today," which is ambiguous between "order-entry calls it like it calls `deplete_for_order_item`" (sibling) and "it gets invoked the same way `deplete_for_order_item` gets invoked" (nested).
   - What's unclear: Whether the phrasing in CONTEXT.md was meant to lock a sibling-RPC design.
   - Recommendation: Default to the nested design (A1) for DRY-ness and to avoid the missed-call-site risk; the planner should surface this as an explicit task-level decision point, not silently proceed either way.

2. **Multi-quantity loose-piece order lines (Pitfall 3 / A4) — confirm scope.**
   - What we know: `order_items.quantity` supports >1 today for every other product; nothing in D-01–D-12 explicitly excludes it for loose-piece products.
   - What's unclear: Whether the phase's acceptance testing expects a single `quantity: 3` loose-stick line to correctly split across two open units, or whether that's an edge case the team is fine leaving as "block and let staff add 3 separate quantity-1 lines" (much simpler implementation).
   - Recommendation: Ask in discuss-phase/planning if not already settled; the loop-based design (Code Examples) handles it correctly if needed, and degrades gracefully to a single iteration if not.

3. **Refund/void credit-back semantics for `consume_open_unit(p_direction = -1)`.**
   - What we know: `deplete_for_order_item` already supports `p_direction = -1` for ingredient refunds (adds back to `ingredients.quantity_on_hand`). Open units need an equivalent, but crediting back to a possibly-already-exhausted-and-replaced unit is semantically fuzzier than crediting an ingredient's flat quantity.
   - What's unclear: Whether a refund should credit back to whichever unit is currently active (even if it's a different physical box than the one the original sale drew from), or track back exactly.
   - Recommendation: Given D-06 (no low-count precision UI) and the low stakes of "which physical unit" for a fungible loose-piece product, recommend crediting the currently-active unit (capped at `units_per_package`, discard remainder) — flag as a task-level decision for the planner, not a blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (unit + integration projects) + Playwright v1.59 (E2E) |
| Config file | `vitest.config.ts` (projects: `unit`, `storybook`); integration tests use the `test:integration` script glob `src/**/*.integration.test.ts` |
| Quick run command | `npx vitest run --project unit --reporter=dot src/entities/open-unit` (once files exist) |
| Full suite command | `npm run test` (unit) + `npm run test:integration` (RPC/RLS integration, requires `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) |

Integration-test precedent for RPC concurrency scenarios: `src/entities/tab/model/depletion.integration.test.ts` — uses a service-role client (`db`, bypasses RLS for setup/teardown) plus an authenticated client (`anonClient`, needed because `deplete_for_order_item`/`consume_open_unit` call `auth.uid()` internally). `describe.skipIf(skip)` when env vars are absent — the same skeleton should be reused for `consume-open-unit-rpc.integration.test.ts`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | `open_units` row created with correct product/remaining/opened-by/opened-at on manual open | integration | `npx vitest run --reporter=dot "src/**/open-unit*.integration.test.ts"` | ❌ Wave 0 |
| SC-1 | Partial unique index rejects a second concurrent `INSERT` for an already-active product (D-07/D-08) | integration | same file — two concurrent `open_open_unit` calls, assert one gets `23505`/friendly error | ❌ Wave 0 |
| SC-2 | Two simultaneous sales racing to decrement the last remaining piece — exactly one succeeds normally, no double-decrement below zero, no lost update | integration | same file — two parallel `consume_open_unit` calls via two Supabase clients against a `remaining_count = 1` row | ❌ Wave 0 |
| SC-2 | Exhaustion mid-transaction auto-opens a fresh unit (box stock available) and lifecycle events are recorded in order | integration | same file | ❌ Wave 0 |
| SC-2 | Exhaustion with zero box stock raises `INVENTORY_NEGATIVE`-equivalent, and `p_allow_negative=true` bypasses it (mirrors `depletion.integration.test.ts`'s `I3` test) | integration | same file | ❌ Wave 0 |
| SC-3 | Admin Open-Units tab renders currently open units; bartender role can trigger "open new unit"; manager-only actions are hidden/disabled for bartender | component/unit (RTL) | `npx vitest run --project unit src/widgets/InventoryPagePanel.test.tsx` (or new open-units-tab test file) | ❌ Wave 0 |
| SC-4 | `record_audit()` is called with the correct new `open_unit.*` action strings for open/deplete/exhaust/void/correct | integration | same RPC integration file — query `audit_logs` after each RPC call, assert `action` column | ❌ Wave 0 |
| SC-4 | `audit-actions.test.ts` CI gate passes with the 5 new enum entries | unit | `npx vitest run --project unit src/shared/lib/__tests__/audit-actions.test.ts` | ✅ (existing file, extend enum) |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit --reporter=dot` (fast subset touching the changed files)
- **Per wave merge:** `npm run test` + `npm run test:integration` (requires local/remote Supabase env vars — flag as environment dependency in the plan if a live Supabase instance isn't reachable in the execution environment)
- **Phase gate:** Full suite green (`npm run test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`) before `/gsd-verify-work`; `npm run test:e2e` is manual/pre-release per CLAUDE.md, not phase-gating

### Wave 0 Gaps
- [ ] `src/entities/open-unit/model/*.integration.test.ts` (or similarly-named RPC test file) — covers SC-1, SC-2, SC-4's concurrency/atomicity/auto-transition/audit assertions; no existing file covers `open_units`/`consume_open_unit` (new tables/RPCs)
- [ ] Admin Open-Units tab component test — covers SC-3's RBAC-gated UI behavior (D-11 vs D-12); no existing file
- [ ] Extend `src/shared/lib/__tests__/audit-actions.test.ts`'s covered-actions expectations if it enumerates specific actions (verify at plan time — it may just grep migrations generically, in which case no test-file edit is needed, only the enum edit)
- Framework install: none — Vitest/Playwright/RTL already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unaffected — reuses existing Supabase Auth/PIN session, no new auth surface |
| V3 Session Management | no | Unaffected |
| V4 Access Control | yes | RPC-internal `get_user_role()` guards (Pattern 4) + RLS policies on `open_units`, matching D-11 (bartender+ open) vs D-12 (manager+ correct/void) — defense-in-depth, not RLS-only, per this codebase's established convention |
| V5 Input Validation | yes | Zod schema (`OpenUnitSchema`) at the client boundary for all `open_units` reads/writes; RPC-side `CHECK (remaining_count >= 0)` and `CHECK (status IN (...))` constraints as the DB-level backstop |
| V6 Cryptography | no | Unaffected — no new secrets/crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Race condition: two terminals decrement the last remaining piece simultaneously | Tampering (data integrity) | `SELECT ... FOR UPDATE` row lock inside `SECURITY DEFINER` (Pattern 1) — Postgres serializes the two transactions |
| Race condition: two terminals open a new unit for the same product simultaneously (bypassing D-07) | Tampering (data integrity) | Partial unique index (`WHERE status = 'active'`), not app-level pre-check (Pattern 2) |
| Privilege escalation: a bartender directly calls the manager-gated `correct_open_unit`/`void_open_unit` RPC, bypassing the UI's `ManagerPinDialog` | Elevation of Privilege | RPC-internal `get_user_role() NOT IN ('manager','admin')` guard (Pattern 4) — the UI PIN dialog is UX only, the RPC guard is the actual control, matching `process_refund`'s existing precedent |
| Audit-log tampering / repudiation of who opened/voided/corrected a unit | Repudiation | `record_audit()` writes `actor_id := auth.uid()` server-side (cannot be spoofed by the client) into an append-only table (no `UPDATE`/`DELETE` RLS policies exist on `audit_logs`) |
| Silent stock-shrinkage via unaudited manual corrections | Repudiation / Tampering | D-12 requires manager+ + `record_audit('open_unit.correct', ...)` capturing before/after `remaining_count`; never allow a correction path that skips the audit call |

## Sources

### Primary (HIGH confidence — read directly from this repo)
- `supabase/migrations/20260426000003_record_stock_movement_rpc.sql` — row-locking / atomic-write convention
- `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` — depletion chokepoint, override bypass, legacy `audit_log` insert
- `supabase/migrations/20260511000001_audit_logs_table.sql` — `audit_logs` table + `record_audit()` SECURITY DEFINER function
- `supabase/migrations/20260511000002_rpc_audit_wiring.sql` — 4 worked examples of `record_audit()` call sites
- `supabase/migrations/20260420000002_caja_sessions.sql` — partial unique index "one active row" pattern
- `supabase/migrations/20260512000001_versioned_rows.sql` — confirms optimistic-version pattern is scoped to session tables, not stock tables
- `supabase/migrations/20260706000002_modifier_inventory_rules_table.sql` — RLS shape for a new join/state table
- `supabase/migrations/20260424000001_stock_movements.sql` — RLS write-restriction + SECURITY DEFINER bypass precedent
- `supabase/migrations/20260428000003_create_order_with_items_v2.sql` — confirms `deplete_for_order_item` is `PERFORM`ed from inside order creation
- `src/widgets/OrderPanel/CartPanel.tsx`, `src/features/override-negative-stock/model/useOverrideNegativeStock.ts` — end-to-end `INVENTORY_NEGATIVE` → PIN → override wiring
- `src/shared/lib/audit-actions.ts`, `src/shared/lib/rbac.ts`, `src/shared/lib/result.ts` — enum/RBAC/error-code single sources of truth
- `src/entities/inventory/model/queries.ts` — nearest entity-model structure to mirror; also source of the unlocked-update anti-pattern (Pitfall/Pattern 1)
- `src/widgets/SettingsCatalogPanel.tsx`, `src/widgets/SettingsTabsPanel/index.tsx` — `Tabs` primitive precedent for D-09
- `src/entities/tab/model/depletion.integration.test.ts` — integration-test skeleton for RPC concurrency scenarios
- `.planning/phases/27-one-shot-inventory-cigarette-box-pattern/27-CONTEXT.md` — locked decisions and canonical refs (this document's primary constraint source)

### Secondary / Tertiary
None — no external web research was needed for this phase; every finding was verified by reading the actual codebase it must extend.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions confirmed in `package.json`
- Architecture: HIGH — every pattern cited is read directly from a migration file already in this repo, not inferred from training data
- Pitfalls: HIGH — all 5 are concrete, file-cited discrepancies/traps found by reading the actual code, not generic domain knowledge
- The `consume_open_unit` internal design (loop-based auto-transition, nested-vs-sibling RPC call) is a **synthesis/recommendation**, not a verified fact — flagged via the Assumptions Log (A1, A4) and Open Questions for explicit planner/user confirmation

**Research date:** 2026-07-29
**Valid until:** No external expiry — tied to this repo's own migration history; re-verify only if Phases 14/15/17's patterns are refactored before this phase is planned/executed
