# Phase 20: Promotions Engine - Research

**Researched:** 2026-07-09
**Domain:** Server-side pricing/discount engine (PostgreSQL PL/pgSQL RPC + Supabase RLS) + React/TanStack admin UI, superseding a client-side-only happy-hour mechanism
**Confidence:** MEDIUM-HIGH (architecture and schema patterns are HIGH confidence — directly derived from live code; the pool-billing hook point and combo/promotions interaction are MEDIUM — see Open Questions and Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The new `promotions` table **supersedes** `categories.happy_hour_start/end` and `products.happy_hour_price`. A migration auto-converts every category/product currently configured with HH data into an equivalent "fixed override price" promotion row, so nothing breaks on deploy. The old columns are then dropped/deprecated, and the client-side calculation path (`isHappyHourActive`, `getEffectivePrice` in `src/shared/lib/domain-helpers.ts`, `HappyHourBanner.tsx`) is retired/replaced by the new server-side evaluation + `applied_promotions` audit trail.
- **D-02:** Promotions apply **silently, automatically** — no cashier confirmation prompt. This matches the current HH UX (price already shows correctly with no interaction) and the ROADMAP wording "auto-apply." The order/receipt shows the resulting discounted line; no "tap to apply" banner step.
- **D-03:** Multiple eligible promotions on the same item/order **can stack** (not best-price-wins). Each promotion has an admin-set **priority** number. Apply in priority order, **compounding sequentially** — each subsequent promotion's discount is computed against the already-discounted running price from the prior applied promotion, not the original price.
- **D-04:** Support three discount shapes in this phase: **percentage off**, **fixed amount off**, and **fixed override price** (the last one is the direct equivalent of the retired HH price-override behavior, so migrated data maps cleanly to it).
- **D-05:** "Pool-time targeting" covers BOTH: (a) a **direct discount on pool table billing** — e.g. "20% off pool time 2–5pm weekdays" — discounting the computed `pool_sessions` charge, using the same day-of-week + time-window availability shape as item/category targeting; AND (b) **bundled free/discounted pool minutes granted as a reward** for purchasing a targeted item/category — mirrors Phase 2's combo prepaid-minutes pattern (a purchase-triggered pool-time grant, not a billing-time discount). Both promotion behaviors are in scope for this phase; planner should treat them as two distinct evaluation paths sharing the same `promotions` schema (differentiated by a target/effect type field).
- **D-06:** Settings → Promotions models the **existing Combos admin pattern**: a list table of existing promotions (`ManageCombosTab.tsx`-equivalent shape) plus a create/edit dialog (`ComboBuilderForm.tsx`-equivalent) with targeting rules and a day/time availability picker reusing the `ComboAvailabilityEditor.tsx` day-of-week UI pattern. Not a simple inline-editable list (rejected — doesn't scale to many promotions).
- **D-07:** Auto-migrate: a migration script reads every category/product currently configured with `happy_hour_start/end`/`happy_hour_price` and creates equivalent "fixed override price" promotion rows automatically, before the old columns are dropped. No manual re-entry burden on admins at deploy time.

### Claude's Discretion

- Exact evaluation trigger point — whether `evaluate_promotions` runs at item-add time (matching today's per-cart-item HH price display) or is deferred to order-close time. Recommendation: item-add time — see Pattern 3 / Open Question 1 in this document.
- Exact `promotions`/`applied_promotions` column naming — follow closest existing convention (`combo_slots`/`combo_availability` naming style) — see Standard Stack / Code Examples.
- Whether "disable" is a boolean `is_active` flag or a status enum — follow whichever is more consistent with `combo_availability`'s existing shape. This research recommends boolean `is_active` (see Recommended Project Structure / schema notes) — matches `products.is_active`/`staff.isActive` project-wide convention; `combo_availability` itself has no disable flag at all.
- Tiebreak rule when two promotions share the same priority value — recommendation: `ORDER BY priority ASC, created_at ASC, id ASC` (lower priority number = applied first) — see Code Examples.
- Whether pool-time discount-on-billing (D-05a) hooks into the same billing computation point Phase 2's combo prepaid-minutes uses, or a new hook — see Pitfall 2/3 and Open Question 2: this research found the combo prepaid-minutes mechanism is NOT fully wired into the live stop-session path today, and recommends a new `stop_pool_session` RPC.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Per-staff/per-terminal promotion restrictions, coupon-code-based promotions, and customer-facing promotion browsing were not raised and are not assumed in scope; flag to the user if they come up during planning as they would be scope creep.)

</user_constraints>

<phase_requirements>
## Phase Requirements

No numbered requirement IDs exist for this phase (POS-COMPARISON.md §20 source doc is no longer present, per ROADMAP.md and 20-CONTEXT.md). The phase's Success Criteria in ROADMAP.md function as its requirement set:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `promotions` table supports HH windows + item/category/pool-time targeting rules | Standard Stack, Architecture Patterns (Pattern 1), Code Examples — schema modeled on `combo_slots`/`combo_availability` |
| SC-2 | `applied_promotions` records which promotion applied to which order/tab | Architecture Patterns (Pattern 2), modeled on `tip_distribution_entries` |
| SC-3 | `evaluate_promotions` RPC auto-applies eligible promotions atomically at order time | Architecture Patterns (Pattern 3), Open Question 1, Code Examples (compounding math), Pitfall 1 |
| SC-4 | Settings → Promotions admin UI: create/edit/disable promotions | Recommended Project Structure, Don't Hand-Roll (admin UI clone), Code Examples (RLS) |

</phase_requirements>

## Summary

This phase replaces a **client-side-only** happy-hour pricing mechanism with a **server-authoritative** promotions engine. The most important finding of this research is that the current codebase does **not** validate pricing server-side at all: `ProductGrid`/`ProductCard` call `resolveProductPrice()` (client-side, `src/shared/lib/domain-helpers.ts`) to compute the happy-hour-discounted price, and that number is sent as `unit_price` straight into the `create_order_with_items` RPC (`supabase/migrations/20260428000003_create_order_with_items_v2.sql`), which trusts it verbatim. Similarly, pool session billing (`total_charge`, `billed_minutes`) is computed **client-side** in `src/shared/lib/pool-billing.ts` (`computePoolSessionBilling`) and written via a **raw client `.update()`** on `pool_sessions` (`src/entities/pool-table/model/queries.ts`, `useMutationStopSession`) — there is no RPC wrapping that write today. Phase 20 must introduce the *first* server-side price authority in this codebase, which is a bigger architectural shift than "add a table and an RPC" — it also means removing client trust for HH-priced items and pool billing.

The good news: this codebase has two extremely close precedents to clone almost verbatim. (1) `combo_availability` + `is_combo_available()` (`supabase/migrations/20260425000001_combo_schema.sql`, `...003_combo_triggers.sql`) is the exact day-of-week + time-window shape D-05's HH-style availability needs — reuse the schema and the STABLE SECURITY DEFINER evaluator function pattern directly. (2) `tip_distribution_entries` + the promotion-computation block bundled into `close_caja_session` (`supabase/migrations/20260709000002_close_caja_session_tip_distribution.sql`) is the exact "immutable per-transaction audit row, computed inside an existing SECURITY DEFINER RPC, written via `record_audit`" shape `applied_promotions` should follow.

A second important finding: the RLS pattern has evolved. Combo tables were created in April with an old `auth.jwt() ->> 'role' IN (...)` policy style; Phase 13's July RLS rewrite (`20260510000001_rls_rewrite_phase13.sql`) replaced this project-wide with a `role_permissions` EXISTS-based pattern (`EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = 'manage_products')`) with **separate** SELECT/INSERT/UPDATE/DELETE policies (not a combined `FOR ALL`). New `promotions`/`promotion_availability`/`applied_promotions` RLS **must** use this current pattern, not the deprecated combo-era style.

**Primary recommendation:** Model `promotions` + `promotion_availability` directly on `combo_slots`/`combo_availability` (schema, naming, RLS pattern, `is_promotion_available()` evaluator). Model `applied_promotions` on `tip_distribution_entries` (immutable, append-only, SECURITY DEFINER-only writer). Hook `evaluate_promotions` into `create_order_with_items` at item-add time (server-side, inside the existing per-item loop, right next to the `deplete_for_order_item` PERFORM call) rather than order-close time — this preserves the current "cart shows final price live" UX and matches the existing atomicity pattern, but requires the client to **stop** sending a pre-discounted `unit_price` for HH-eligible items and instead send `product.basePrice` unmodified, letting the RPC be the sole source of truth for the charged price.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Promotion rule definition (CRUD) | API / Backend (Postgres tables + RLS) | Frontend Server — n/a (SPA) | `promotions`/`promotion_availability` are the source of truth; admin UI is a thin client over them |
| Promotion eligibility evaluation (item/category, time window) | API / Backend (PL/pgSQL `evaluate_promotions`) | — | Must be server-side per D-02 (silent, authoritative, no client trust) — this is the core architectural change of this phase |
| Order-item pricing (writing final `unit_price`) | API / Backend (inside `create_order_with_items` RPC, same transaction) | Browser/Client (optimistic UI estimate only) | Client may *display* an estimate but the RPC's write is authoritative; client estimate must never be trusted for billing |
| Pool-time billing discount (D-05a) | API / Backend — **currently missing an RPC boundary** (see Pitfall/Open Question 2) | Browser/Client (today does the write directly) | Existing `useMutationStopSession` writes `total_charge` via a raw client `.update()` — this phase should either introduce a new `stop_pool_session` RPC or accept a client-orchestrated two-step write; flagged as an open question, not silently assumed |
| Pool-time bonus-minute grant (D-05b) | API / Backend (`evaluate_promotions`, same insert as item/category) | Browser/Client (start-pool-timer reads the grant) | Mirrors combo `prepaid_minutes`, but that mechanism is **not fully wired today** (see Pitfall 2) — do not assume it "just works" |
| `applied_promotions` audit trail | API / Backend (SECURITY DEFINER RPC, append-only) | — | Matches `tip_distribution_entries`/`audit_logs` pattern — RLS blocks all client INSERT |
| Admin UI (create/edit/disable) | Browser/Client (React feature, `features/manage-promotions/`) | API / Backend (RLS write gate) | Matches `features/manage-combos/` — thin CRUD form + day/time picker, no business logic in the client beyond form validation |
| Active-promotion display badge (optional UX) | Browser/Client (read-only, mirrors `HappyHourBanner`/`isHappyHourActive`) | — | Cosmetic only; must never be the value that determines the charged price |

## Package Legitimacy Audit

No external packages are introduced by this phase. All work uses libraries already in `package.json` (Zod v4, TanStack Query v5, React 19, shadcn/ui, Vitest, fast-check, Playwright) plus native PL/pgSQL. Section intentionally has no rows — `slopcheck`/registry verification is not applicable.

## Standard Stack

### Core

No new libraries. This phase is 100% additive schema + PL/pgSQL + existing-stack React/TanStack code, following the exact patterns already in the repo:

| Component | Source pattern | Purpose |
|-----------|----------------|---------|
| Zod v4 (existing, `^4.3.6`) | `src/shared/lib/domain.ts` `ComboSlotSchema`/`ComboAvailabilitySchema` | `PromotionSchema`/`PromotionAvailabilitySchema`/`AppliedPromotionSchema` |
| TanStack Query v5 (existing, `^5.99.0`) | `src/entities/combo/model/queries.ts` | `entities/promotion/model/queries.ts` hooks |
| PL/pgSQL SECURITY DEFINER RPC | `is_combo_available()`, `add_combo_to_tab()`, `close_caja_session()` | `is_promotion_available()`, `evaluate_promotions()` |
| fast-check v4 (existing, `^4.6.0`) | `src/features/add-combo-to-tab/pricing.test.ts` (P2 pricing property tests) | New property test for sequential-compounding discount math |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PL/pgSQL evaluation inside `create_order_with_items` | A Supabase Edge Function calling out after insert | Rejected — introduces a second network round-trip and a read-then-write race (client would need to re-fetch to learn the discounted price); every atomic, order-time RPC in this codebase (`add_combo_to_tab`, `deplete_for_order_item`, `close_caja_session`) is PL/pgSQL-in-transaction, not an edge function. Consistency with existing pattern strongly favors PL/pgSQL. |
| Reusing `combo_availability` table directly (add a `promotion_id` nullable FK) | New dedicated `promotion_availability` table | A shared table would need a polymorphic `owner_type`/`owner_id`, which no existing table in this codebase uses (every availability-style table is single-purpose). A dedicated `promotion_availability` table matches the established one-table-per-owner convention and keeps `ComboAvailabilityEditor`-derived UI code simpler to adapt. |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                     │
│                                                                        │
│  ProductGrid/ProductCard ──(read-only, cosmetic)──► "Promo Active"    │
│     │  badge via isPromotionActive() (mirrors isHappyHourActive)      │
│     │  displays product.basePrice (NOT a discounted price anymore)    │
│     ▼                                                                 │
│  CartPanel / add-item-to-tab feature                                  │
│     │  sends { product_id, quantity, unit_price: product.basePrice,  │
│     │           modifier_ids, modifier_price_delta }                  │
│     ▼                                                                 │
└─────┼──────────────────────────────────────────────────────────────-┘
      │  RPC call: create_order_with_items(...)
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Postgres (SECURITY INVOKER/DEFINER RPC, one transaction)            │
│                                                                        │
│  1. INSERT orders row                                                │
│  2. INSERT order_items rows (unit_price = client base price, as-is)  │
│  3. FOR each inserted order_item:                                    │
│       PERFORM deplete_for_order_item(id)        ◄── existing (Ph.4)  │
│       PERFORM evaluate_promotions_for_item(id)  ◄── NEW (Ph.20)      │
│         │                                                             │
│         │  a. find product_id + category_id + base unit_price        │
│         │  b. SELECT active promotions matching item/category,       │
│         │     filtered by is_promotion_available(id, now())          │
│         │  c. ORDER BY priority ASC, created_at ASC, id ASC           │
│         │  d. loop: apply percent/fixed_amount/fixed_price to a      │
│         │     running price variable (sequential compounding, D-03)   │
│         │  e. UPDATE order_items SET unit_price = running_price      │
│         │  f. INSERT applied_promotions (one row per promo applied)  │
│         │     — pool_grant effect type additionally records          │
│         │       pool_minutes_granted, unconsumed until session start │
│  4. RETURN order + items (now carrying final, discounted unit_price) │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Pool-time billing discount (D-05a) — SEPARATE PATH, see Pitfall 2   │
│                                                                        │
│  useMutationStopSession (client) ──► computePoolSessionBilling()     │
│     (client, pure fn)                       │                        │
│     needs a NEW hook to consult promotions before writing             │
│     total_charge — no RPC boundary exists today for this write path   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Settings → Promotions (admin UI)                                    │
│                                                                        │
│  ManagePromotionsTab (list, clone ManageCombosTab)                    │
│     └─ PromotionBuilderForm (create/edit dialog, clone                │
│         ComboBuilderForm) — name, discount type/value, target type,   │
│         target product/category, priority, is_active toggle           │
│     └─ PromotionAvailabilityEditor (clone ComboAvailabilityEditor     │
│         verbatim — day/time windows)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/migrations/
├── 20260710000001_promotions_schema.sql          # promotions + promotion_availability + RLS
├── 20260710000002_applied_promotions_table.sql   # applied_promotions + RLS (append-only)
├── 20260710000003_is_promotion_available_fn.sql  # evaluator function (mirrors is_combo_available)
├── 20260710000004_evaluate_promotions_rpc.sql    # evaluate_promotions_for_item + wiring into create_order_with_items v3
├── 20260710000005_migrate_happy_hour_data.sql    # D-07: data migration only, does NOT drop old columns yet
└── 20260710000006_drop_happy_hour_columns.sql    # separate follow-up migration, run only after verification (see Pitfall 4)

src/shared/lib/
├── domain.ts                     # + PromotionSchema, PromotionAvailabilitySchema, AppliedPromotionSchema, PromotionDiscountTypeSchema, PromotionTargetTypeSchema
└── domain-helpers.ts             # + isPromotionActive() (client display only) — retire isHappyHourActive()/resolveProductPrice() call sites (D-01)

src/entities/promotion/
├── model/
│   ├── types.ts
│   ├── queries.ts                # usePromotions, usePromotionAvailabilityWindows, useMutationCreatePromotion, etc. (mirror entities/combo)
│   └── index.ts
└── index.ts

src/features/manage-promotions/
└── ui/
    ├── ManagePromotionsTab.tsx        # clone ManageCombosTab.tsx
    ├── PromotionBuilderForm.tsx       # clone ComboBuilderForm.tsx
    └── PromotionAvailabilityEditor.tsx  # clone ComboAvailabilityEditor.tsx (swap comboId→promotionId, table name)

src/widgets/OrderPanel/
└── HappyHourBanner.tsx            # repurpose into generic "Active Promotions" banner, or retire (D-01)

src/widgets/SettingsTabsPanel/
└── index.tsx                      # + Promotions tab entry
```

### Pattern 1: Day-of-week + time-window availability (clone verbatim)
**What:** A one-to-many `*_availability` table (days_of_week integer[], start_time/end_time nullable time, start_date/end_date nullable date) evaluated by a `STABLE SECURITY DEFINER` function that returns `true` when zero rows exist for the owner ("no windows = always available").
**When to use:** Any time-gated eligibility check — this is the exact shape needed for D-04/D-05's HH-style windows.
**Example:**
```sql
-- Source: supabase/migrations/20260425000003_combo_triggers.sql (is_combo_available)
CREATE OR REPLACE FUNCTION is_promotion_available(p_promotion_id uuid, p_ts timestamptz)
RETURNS boolean AS $$
DECLARE
  v_day_of_week integer;
  v_time time;
  v_date date;
  v_row_count integer;
  v_match_count integer;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM promotion_availability WHERE promotion_id = p_promotion_id;
  IF v_row_count = 0 THEN
    RETURN true;  -- no windows = always available
  END IF;

  v_day_of_week := EXTRACT(ISODOW FROM p_ts AT TIME ZONE 'America/Mexico_City')::integer;
  v_time := (p_ts AT TIME ZONE 'America/Mexico_City')::time;
  v_date := (p_ts AT TIME ZONE 'America/Mexico_City')::date;

  SELECT COUNT(*) INTO v_match_count
  FROM promotion_availability
  WHERE promotion_id = p_promotion_id
    AND v_day_of_week = ANY(days_of_week)
    AND (start_time IS NULL OR v_time >= start_time)
    AND (end_time IS NULL OR v_time <= end_time)
    AND (start_date IS NULL OR v_date >= start_date)
    AND (end_date IS NULL OR v_date <= end_date);

  RETURN v_match_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### Pattern 2: Immutable per-transaction audit table, written by the domain RPC itself
**What:** An append-only table with SELECT-only RLS (manager+) and zero client write policies; the sole writer is the SECURITY DEFINER RPC that performs the underlying business action, in the same transaction.
**When to use:** `applied_promotions` — exactly what `tip_distribution_entries` does for tip splits.
**Example:**
```sql
-- Source: supabase/migrations/20260709000001_tip_distribution_entries_table.sql
ALTER TABLE applied_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY applied_promotions_select_manager
  ON applied_promotions FOR SELECT TO authenticated
  USING (get_user_role() IN ('manager', 'admin'));

-- INSERT/UPDATE/DELETE: nobody. No policies = no access.
-- The SECURITY DEFINER evaluate_promotions_for_item() function is the sole writer.
```

### Pattern 3: RPC-internal PERFORM loop over freshly-inserted rows (the item-add hook point)
**What:** After a bulk `INSERT ... SELECT` of `order_items`, loop over the newly-inserted ids and `PERFORM` a per-row side-effecting function — this is exactly how ingredient depletion is already wired into `create_order_with_items` v2.
**Example:**
```sql
-- Source: supabase/migrations/20260428000003_create_order_with_items_v2.sql
IF NOT p_skip_depletion THEN
  FOR v_inserted_item IN
    SELECT id FROM order_items WHERE order_id = v_order.id
  LOOP
    PERFORM deplete_for_order_item(v_inserted_item.id, 1::smallint);
    -- NEW: PERFORM evaluate_promotions_for_item(v_inserted_item.id);
  END LOOP;
END IF;
```
**Why this is the recommended hook point (answers Open Question 1):** `create_order_with_items` already runs the depletion side-effect in-transaction per item; adding `evaluate_promotions_for_item` right alongside it costs nothing architecturally and guarantees atomicity (a promotion-evaluation bug can't leave an order half-priced). The alternative — evaluating at order-close/payment time — would require re-deriving which promotions were "supposed to" apply at the time the item was ordered (price could drift if the admin edits a promotion between order and close), and doesn't match the current "cart shows final price live" UX that D-02's discretion note explicitly asks to preserve.

### Anti-Patterns to Avoid
- **Trusting client-supplied `unit_price` for HH/promo pricing:** The current codebase already does this (client computes `resolveProductPrice()` and sends it as `unit_price`), but D-01 explicitly retires that mechanism — the RPC must treat client `unit_price` as the *undiscounted* base price input, not the final charged price, once promotions supersede it.
- **A combined `FOR ALL` RLS policy:** Phase 13's rewrite explicitly split combo policies into per-verb policies "per Risk 3 — no combined ALL policy." Follow the same separation for `promotions`/`promotion_availability`/`applied_promotions`.
- **Dropping `happy_hour_start/end`/`happy_hour_price` columns in the same migration as the data-copy (D-07):** do the data migration and the column drop in two separate migrations so there is a verification window (mirrors this project's repeated pattern of BLOCKING db-push + verification-gate plans before proceeding).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Day-of-week + time-window matching | A new date/time comparison utility | Copy `is_combo_available()`'s exact ISODOW + `AT TIME ZONE 'America/Mexico_City'` logic | Already handles midnight-adjacent edge cases the same way `isHappyHourActive()` does client-side (see `domain-helpers.ts`); a second, subtly different implementation would create a second source of truth for "is it happy hour" |
| Largest-remainder / sequential percentage math | New rounding helper | Reuse `Math.round(x * 100) / 100` (2-decimal money rounding) already used throughout `domain-helpers.ts` (`calculateDiscountAmount`, `calculateTipAmount`) — apply the same rounding at each compounding step, not only at the end | Prevents floating-point drift accumulating across a multi-promotion stack; also keeps behavior consistent with the existing (unrelated) manual-discount feature in `PaymentForm.tsx` which already does exactly this rounding |
| Admin day/time picker UI | A new calendar/time-range component | `ComboAvailabilityEditor.tsx` — copy nearly verbatim | It's already built, tested, and uses the exact `days_of_week`/`start_time`/`end_time` shape this phase needs |

**Key insight:** Every piece of infrastructure this phase needs (time-window matching, admin list+dialog CRUD, immutable audit table, RPC-internal side-effect loop, role-based RLS) already exists in this codebase in near-identical form. The engineering risk in this phase is not "building something new" — it's correctly wiring pricing authority from client to server without breaking the existing cart/receipt/pool-billing UX, and correctly scoping what's *not* touched (combos, manual per-payment discounts).

## Common Pitfalls

### Pitfall 1: Client-trusted pricing is the current reality, not a hypothetical
**What goes wrong:** A plan that treats `evaluate_promotions` as "just another RPC to add" without addressing that `ProductGrid`/`ProductCard`/`CartPanel` currently compute and submit the discounted price client-side will result in **double-discounting** (client applies HH price, then server also applies an equivalent promotion) or **silent server override with no client awareness** (server writes a different price than what the cart displayed, confusing the cashier).
**Why it happens:** The HH mechanism predates any server-side pricing validation; nothing in the current architecture stops a client from sending an arbitrary `unit_price`.
**How to avoid:** The plan must include a task that changes `ProductGrid`/`ProductCard`/cart-building code to stop calling `resolveProductPrice()` for the purpose of the value sent to `create_order_with_items`, sending `product.basePrice` instead, while `evaluate_promotions_for_item` becomes the sole writer of the final `unit_price`. The client may still show a cosmetic "Promo Active" badge (read-only, mirrors `isHappyHourActive()`) but must not let that badge's price computation leak into the RPC payload.
**Warning signs:** Any plan task that only adds tables/RPC without touching `ProductGrid.tsx`/`ProductCard.tsx`/the cart-building code path is incomplete.

### Pitfall 2: Combo prepaid-minutes "hook" that D-05b is asked to mirror is not actually wired end-to-end today
**What goes wrong:** CONTEXT.md's Discretion note for D-05a/b says to evaluate "against the existing pool-billing RPC/function structure" and treat combo prepaid-minutes as the working reference. In the actual code, `computePoolSessionBilling()` accepts a `prepaidMinutes` parameter and it is property-tested in isolation (`src/features/add-combo-to-tab/pricing.test.ts`), but `useMutationStopSession` in `src/entities/pool-table/model/queries.ts` calls `computePoolSessionBilling({ startedAt, endTime: stoppedAt, ratePerHour, firstHourMode })` **without ever passing `prepaidMinutes`**. There is no visible code path today that reads `pool_sessions`-linked combo prepaid minutes and feeds them into the live stop-session billing calculation.
**Why it happens:** The combo prepaid-minutes feature may have been completed at the pure-function/test level but the live wiring into `useMutationStopSession` appears to be an incomplete/orphaned integration (or is wired somewhere not found by this research — flagged, not asserted as fact).
**How to avoid:** Do not assume D-05a/b can "reuse the same hook" as a working, wired mechanism. The planner should either (a) explicitly re-verify this gap with a targeted grep/read during planning before committing to a design, or (b) treat D-05a/b's billing-time and grant-time integration as new wiring work in `useMutationStopSession`/`start-pool-timer`, not a "connect to an existing hook" task.
**Warning signs:** A plan that estimates D-05a as "small — just call the existing prepaid-minutes deduction" without first confirming the deduction is live in the stop-session path.

### Pitfall 3: Pool session billing write has no RPC boundary — introducing a promotion discount here changes the write model
**What goes wrong:** `useMutationStopSession` performs a **raw client `.update()`** on `pool_sessions` (with an optimistic-concurrency `.eq('version', expected)` check) — there is no SECURITY DEFINER RPC wrapping this write today, unlike every other atomic order-time operation in this codebase (`add_combo_to_tab`, `create_order_with_items`, `close_caja_session`). If D-05a's discount is computed client-side too and written in the same `.update()` call, there is no way to also atomically insert the `applied_promotions` audit row (a second client call could fail independently, leaving billing discounted but unaudited, or vice versa).
**Why it happens:** Pool billing was likely simple enough at the time it was built (Phase 1/2) that a raw client write was acceptable; this phase is the first to need atomicity here.
**How to avoid:** Recommend introducing a new `stop_pool_session(p_session_id uuid, p_expected_version int)` SECURITY DEFINER RPC that performs the `computePoolSessionBilling`-equivalent math server-side (or accepts pre-computed values purely for the parts that don't touch promotions, then applies the promotion discount and audit insert atomically), mirroring how Phase 14 introduced `close_tab` to wrap what was previously a raw client status update. This is a bigger task than D-05a's phrasing implies — flag explicit sizing to the planner.
**Warning signs:** A plan for D-05a that keeps the existing raw `.update()` call and just adds a second, separate client-side insert into `applied_promotions` — this reintroduces the exact non-atomic write problem this codebase has been actively fixing since Phase 14/15.

### Pitfall 4: Dropping HH columns before the new engine is proven live
**What goes wrong:** D-07 requires the migration to auto-convert HH data into promotion rows "before the old columns are dropped." If the conversion migration and the `DROP COLUMN` are combined into one migration/one deploy, any bug in `evaluate_promotions` (e.g., a category with `happy_hour_start` but no matching product `happy_hour_price`, or vice versa) becomes unrecoverable without a fresh migration — there's no fallback to the old client-side calculation once the columns are gone and `resolveProductPrice()`/`isHappyHourActive()`/`HappyHourBanner.tsx` call sites have been rewired.
**Why it happens:** Combining "migrate data" and "drop the old mechanism" feels like one atomic unit of work, but this project's own migration history (e.g., Phase 15's separate schema/RPC/hook/test plans, always gated by BLOCKING checkpoints) shows the value of splitting risky schema changes from a verification gate.
**How to avoid:** Split into (a) a migration that inserts `promotions`/`promotion_availability` rows from existing HH data — additive only, old columns untouched — and (b) a later migration (separate wave, after a verification checkpoint confirming `evaluate_promotions` reproduces identical prices for all migrated HH rows) that drops the columns and removes client-side HH code.
**Warning signs:** A single migration file or single plan wave that both inserts promotion rows and drops `happy_hour_*` columns.

### Pitfall 5: Confusing the new `promotions` engine with the existing unrelated per-payment discount feature
**What goes wrong:** `domain.ts` already has `DiscountScope`/`DiscountType` + `getDiscountBase()`/`calculateDiscountAmount()`, used exclusively by `PaymentForm.tsx` for a **manual, cashier-entered, checkout-time** discount (not auto-applied, not silent, not targeted by item/category). A plan that reuses these type names for the new promotions engine will create a naming collision and conflate two genuinely different features (D-02 requires promotions to be silent/auto-applied at order time; the existing discount is an explicit manual action at payment time).
**Why it happens:** The names ("discount type", "discount scope") are generically appealing and already exist in `domain.ts`.
**How to avoid:** Use distinct type names — e.g. `PromotionDiscountTypeSchema` (`'percentage' | 'fixed_amount' | 'fixed_price'`) and `PromotionTargetTypeSchema` (`'item' | 'category' | 'pool_billing' | 'pool_grant'`) — never reuse or extend the existing `DiscountType`/`DiscountScope` enums for this feature.
**Warning signs:** Any plan task that imports or extends `DiscountScope`/`DiscountType` from `domain.ts` for promotions work.

### Pitfall 6: Combo interaction is unscoped — don't silently expand scope
**What goes wrong:** Combo child `order_items` are inserted with `unit_price = 0` (the parent holds the combo total) and `combo_slot_id IS NOT NULL`; combo parent items have `is_combo = true`. Neither CONTEXT.md nor the roadmap says whether promotions should ever apply to combo products or their components. If `evaluate_promotions_for_item` runs indiscriminately over every inserted `order_item` including combo children, it will burn cycles evaluating $0 lines and could produce confusing `applied_promotions` rows ("20% off $0 = $0 discount") with no real effect but audit noise.
**Why it happens:** `create_order_with_items`'s existing depletion loop already iterates over combo child items (via `add_combo_to_tab`'s separate depletion loop) without a combo-exclusion filter, so a naive "just add the same PERFORM call" copy-paste will do the same for promotions.
**How to avoid:** Explicitly exclude `is_combo = true` parent items and `combo_slot_id IS NOT NULL` child items from `evaluate_promotions_for_item` in this phase, and flag combo+promotion interaction as an explicit out-of-scope note for the user (per CONTEXT.md's Deferred Ideas guidance: surface scope-adjacent questions rather than silently deciding).
**Warning signs:** A migration that calls `evaluate_promotions_for_item` from inside `add_combo_to_tab`'s depletion loop without a design decision recorded first.

## Code Examples

### `record_audit` call signature (for wiring `promotion.create`/`update`/`disable` actions into future admin mutations, and `promotion.apply` inside `evaluate_promotions_for_item`)
```sql
-- Source: supabase/migrations/20260511000001_audit_logs_table.sql
PERFORM record_audit(
  p_action      => 'promotion.apply',      -- must be added to AuditActionSchema in src/shared/lib/audit-actions.ts first
  p_entity_type => 'applied_promotion',
  p_entity_id   => v_promotion_id,
  p_before      => NULL,
  p_after       => jsonb_build_object(
                      'orderItemId', v_order_item_id,
                      'originalAmount', v_original_amount,
                      'discountedAmount', v_running_price
                    ),
  p_source      => 'rpc'
);
```

### Current RLS pattern to follow (NOT the deprecated combo-era `auth.jwt()` style)
```sql
-- Source: supabase/migrations/20260510000001_rls_rewrite_phase13.sql (lines 803-817)
CREATE POLICY "promotions_select_authenticated" ON promotions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "promotions_insert_manager_admin" ON promotions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = 'manage_products'));

CREATE POLICY "promotions_update_manager_admin" ON promotions
  FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = 'manage_products'))
  WITH CHECK (EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = 'manage_products'));

CREATE POLICY "promotions_delete_manager_admin" ON promotions
  FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = 'manage_products'));
```
(Reuses the existing `manage_products` RBAC action — same gate as Combos/Products/Pool Tables settings tabs — rather than introducing a new `manage_promotions` action, to avoid a `role_permissions` seed-row change. Flagged as a recommendation, not a lock — see Open Questions.)

### Sequential compounding discount math (pseudocode for `evaluate_promotions_for_item`)
```sql
-- v_running_price starts at the item's base unit_price (client-submitted, undiscounted)
FOR v_promo IN
  SELECT * FROM promotions p
  WHERE p.is_active
    AND (p.target_type = 'item' AND p.target_product_id = v_product_id
         OR p.target_type = 'category' AND p.target_category_id = v_category_id)
    AND is_promotion_available(p.id, now())
  ORDER BY p.priority ASC, p.created_at ASC, p.id ASC   -- deterministic tiebreak (Open Question 4)
LOOP
  v_original := v_running_price;
  CASE v_promo.discount_type
    WHEN 'percentage'   THEN v_running_price := GREATEST(0, ROUND(v_running_price * (1 - v_promo.discount_value / 100), 2));
    WHEN 'fixed_amount'  THEN v_running_price := GREATEST(0, ROUND(v_running_price - v_promo.discount_value, 2));
    WHEN 'fixed_price'   THEN v_running_price := v_promo.discount_value;  -- resets running price outright
  END CASE;

  INSERT INTO applied_promotions (promotion_id, promotion_name_snapshot, tab_id, order_item_id,
    discount_type, discount_value, original_amount, discounted_amount)
  VALUES (v_promo.id, v_promo.name, v_tab_id, p_order_item_id,
    v_promo.discount_type, v_promo.discount_value, v_original, v_running_price);
END LOOP;

UPDATE order_items SET unit_price = v_running_price WHERE id = p_order_item_id;
```
Note the `fixed_price` case does not compound against the prior running price — it resets. Document this explicitly in the admin UI (e.g., a warning when a `fixed_price` promotion doesn't have the lowest priority number) since it's a non-obvious interaction of D-03 (compounding) and D-04 (three discount shapes).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RLS via `auth.jwt() ->> 'role' IN ('manager','admin')` inline checks | RLS via `EXISTS(SELECT 1 FROM role_permissions WHERE role = get_user_role() AND action = '...')`, separate per-verb policies | Phase 13, `20260510000001_rls_rewrite_phase13.sql` (dated ~2026-04-28 in commit history, applied 2026-07 per STATE.md) | All *new* tables (including this phase's `promotions`/`promotion_availability`/`applied_promotions`) must use the `role_permissions` pattern; the combo-era inline pattern is legacy and was fully replaced project-wide |
| Client raw `.update()` for tab status changes | `close_tab` SECURITY DEFINER RPC (audits `tab.close`, preserves version-guard contract) | Phase 14, `20260511000002_rpc_audit_wiring.sql` era | Precedent for this phase's Pitfall 3 recommendation: wrap the still-raw `pool_sessions` stop-write in a proper RPC the same way `close_tab` replaced a raw tabs update |
| Client-computed happy-hour pricing trusted verbatim by the order RPC | *(this phase introduces the first change)* | N/A — this phase is the change | No prior "current approach" exists; this is a net-new server-authority requirement, not a refactor of an existing server mechanism |

**Deprecated/outdated:**
- `categories.happy_hour_start`/`happy_hour_end`, `products.happy_hour_price` — superseded by `promotions`/`promotion_availability` per D-01; do not extend these columns further.
- `isHappyHourActive()`/`resolveProductPrice()` in `src/shared/lib/domain-helpers.ts` — retired once the promotions engine ships (client may keep a read-only cosmetic equivalent, but must not compute the charged price).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommend reusing the existing `manage_products` RBAC action for promotions admin writes rather than adding a new `manage_promotions` action | Code Examples, Architectural Responsibility Map | If wrong, the planner needs an extra task to extend `StaffAction` in `rbac.ts` + seed `role_permissions` with new rows for bartender/manager/admin/kitchen — a schema seed change this research did not verify is in-scope |
| A2 | `is_promotion_available()` should hardcode `'America/Mexico_City'` timezone, matching `is_combo_available()` exactly | Pattern 1 | If the deployment timezone assumption is wrong or configurable elsewhere, hardcoding would silently misfire evaluation windows — but this matches 100% of existing time-window code in the repo, so risk is low |
| A3 | `fixed_price` discount type resets the running price rather than being treated as a discount relative to the running price | Code Examples | If the intended semantics differ (e.g., "fixed_price" should only apply when no prior promotion touched the item), stacking order matters more than assumed and needs explicit product/business confirmation |
| A4 | Combo parent (`is_combo=true`) and combo child (`combo_slot_id IS NOT NULL`) order_items should be excluded from `evaluate_promotions_for_item` in this phase | Pitfall 6 | If combo+promotion interaction is actually expected in-scope, this exclusion under-delivers; if out-of-scope as assumed, including them would produce confusing $0-discount audit rows |
| A5 | The combo prepaid-minutes deduction is not actually wired into the live `useMutationStopSession` path (only property-tested in isolation) | Pitfall 2 | This was determined by grepping the current file; if a wiring path exists elsewhere not surfaced by this research's search terms, D-05a/b's sizing estimate would be smaller than stated |

**If this table is empty:** N/A — assumptions listed above need confirmation during discuss-phase/planning, particularly A1 (RBAC action) and A4 (combo exclusion), which affect schema/RLS decisions made early.

## Open Questions (RESOLVED)

1. **Should `promotions` admin writes gate on `manage_products` (reusing the Combos precedent) or a new `manage_promotions` action?**
   - What we know: Combos/Products/Pool Tables/Billing all gate on `manage_products` in `SettingsTabsPanel.tsx`; `role_permissions` is a fixed seed table (bartender=9, manager=17, admin=22, kitchen=4 rows per STATE.md) that would need new seed rows for a new action.
   - What's unclear: Whether product owners consider "promotions" a distinct enough capability to warrant separate RBAC (e.g., a manager who can edit products but shouldn't create discounts).
   - Recommendation: Default to `manage_products` (Assumption A1) unless the user specifies otherwise during planning — lower implementation risk, matches Combos precedent exactly.
   - **RESOLVED:** 20-01 Task 1 and 20-04 Task 2 adopted `manage_products` gating, per the recommendation.

2. **Does the pool-time billing discount (D-05a) require a new `stop_pool_session` RPC, or can it stay a two-step client-orchestrated write?**
   - What we know: No RPC wraps the current `pool_sessions` stop-write; introducing atomic discount+audit-row writing without an RPC is not safely possible (Pitfall 3).
   - What's unclear: Whether the user considers introducing a new RPC in-scope for this phase, given it touches a currently-client-owned write path that Phase 15 already added optimistic-concurrency handling to.
   - Recommendation: Introduce `stop_pool_session(p_session_id, p_expected_version)` SECURITY DEFINER RPC, following the `close_tab` precedent (Phase 14) of wrapping a previously-raw client write. Flag as a larger task than D-05a's phrasing implies.
   - **RESOLVED:** 20-05 Task 2 introduces the `stop_pool_session` RPC per the recommendation.

3. **Is the combo prepaid-minutes deduction actually live anywhere in the current stop-session flow?**
   - What we know: `computePoolSessionBilling()` supports `prepaidMinutes`; the only caller found (`useMutationStopSession`) does not pass it.
   - What's unclear: Whether a different, unfound code path wires this (this research's search was not exhaustive of every file).
   - Recommendation: Planner/executor should re-verify with a targeted search before assuming D-05b can "reuse the existing hook" — treat as new wiring work unless proven otherwise.
   - **RESOLVED:** 20-05 treats D-05b's prepaid-minutes/pool-grant path as new wiring work, per the recommendation — no existing live hook was assumed.

4. **Should `applied_promotions.promotion_id` be `ON DELETE SET NULL` (with a `promotion_name_snapshot` for durability) or `ON DELETE RESTRICT` (never allow deleting a promotion with history)?**
   - What we know: `is_active` (not deletion) is the intended "disable" mechanism (Open Discretion in CONTEXT.md), so deletion should be rare; `tip_distribution_entries` doesn't need this decision (no equivalent "delete the config" flow exists for it).
   - What's unclear: Whether the admin UI will expose a hard-delete action at all for promotions (combos do support delete per `ManageCombosTab.tsx`'s delete button).
   - Recommendation: `ON DELETE SET NULL` + snapshot columns (`promotion_name_snapshot`, `discount_type`, `discount_value` already captured per applied row) preserves audit fidelity even if a promotion is later hard-deleted — matches the "audit rows must survive" spirit of `record_audit`'s design.
   - **RESOLVED:** 20-03 Task 1 adopted `ON DELETE SET NULL` + snapshot columns, per the recommendation.

## Environment Availability

Skipped — this phase has no new external dependencies (no new npm packages, no new CLI tools, no new services). All work uses the existing local Supabase/Postgres + Node/npm toolchain already verified working in prior phases (14–19).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (`^4.1.4`) + React Testing Library; fast-check v4 (`^4.6.0`) for property tests; Playwright v1.59 for E2E |
| Config file | `vitest.config.ts` / `playwright.config.ts` |
| Quick run command | `npx vitest run src/shared/lib/domain-helpers.test.ts` (or the specific new test file) |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (E2E, manual gate per CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 (promotions schema supports HH windows + item/category/pool-time targeting) | Schema constraints (CHECK on discount_type/target_type), `is_promotion_available()` day/time matching | unit + integration | `npx vitest run src/shared/lib/domain.test.ts` (Zod schema tests) + a new live-Supabase integration test mirroring `20260709000002` scaffold style | ❌ Wave 0 |
| SC-2 (`applied_promotions` records which promotion applied to which order/tab) | RPC writes correct audit rows, immutable/append-only RLS | integration | New `applied-promotions-rls.test.ts` (mirrors `audit_logs` RLS denial tests from Phase 14) | ❌ Wave 0 |
| SC-3 (`evaluate_promotions` RPC auto-applies eligible promotions atomically at order time) | Sequential-compounding math, priority ordering, tiebreak determinism, availability-window gating | unit (pure fn if extracted) + property test + live integration | New fast-check property test (next available ID: **P11**, following P2/P8/P9/P10 naming) for compounding order-independence-within-priority-groups; live RPC integration test calling `create_order_with_items` and asserting final `unit_price` | ❌ Wave 0 |
| SC-4 (Settings → Promotions admin UI: create/edit/disable) | Form validation, RLS-gated CRUD, list rendering | unit (RTL) | New `ManagePromotionsTab.test.tsx`/`PromotionBuilderForm.test.tsx` mirroring existing Combos admin test coverage (if any — verify during Wave 0) | ❌ Wave 0 |
| (D-07 migration correctness) | Every existing HH category/product converts to an equivalent `fixed_price` promotion producing an identical price | integration | A one-off verification script/test comparing `resolveProductPrice()` output against `evaluate_promotions` output for all pre-migration HH rows, run once against a snapshot of pre-migration data | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the file(s) touched
- **Per wave merge:** `npm run test` (full unit suite) + `npm run typecheck` + `npm run lint`
- **Phase gate:** Full suite green + live Supabase integration tests green + `npm run test:e2e` spec (new `43-promotions.spec.ts`, following the `42-tip-distribution.spec.ts` numbering convention) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/entities/promotion/model/queries.test.ts` — new entity hook stubs
- [ ] `supabase/migrations/*_promotions_schema.sql` integration test scaffold — mirrors the pattern in `20260709000002_close_caja_session_tip_distribution.sql`'s companion test file
- [ ] Property test file for sequential-compounding math (`P11`) — no existing framework install needed, fast-check already present
- [ ] `e2e/43-promotions.spec.ts` — new spec file, next available number after `42-tip-distribution.spec.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged — existing Supabase Auth / PIN login |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | `role_permissions` EXISTS-based RLS (per-verb policies) gating `promotions`/`promotion_availability` writes to `manage_products`-permitted roles; `applied_promotions` SELECT-only for manager+, zero client write policies |
| V5 Input Validation | yes | Zod schemas (`PromotionSchema`, discount value bounds, target-type CHECK constraints) validate all admin-form input before it reaches the DB; PL/pgSQL CHECK constraints as defense-in-depth |
| V6 Cryptography | no | No new secrets/crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client submits a manipulated `unit_price` to `create_order_with_items` expecting the server to trust it (this is literally the current behavior for HH pricing) | Tampering | This phase's core mitigation: `evaluate_promotions_for_item` becomes the authoritative writer of `order_items.unit_price` for any promotion-eligible item, ignoring whatever pre-discounted value the client sent |
| A disabled (`is_active=false`) or expired-window promotion continuing to apply due to a stale client-side "Promo Active" badge misleading the cashier into expecting a discount that the server doesn't grant | Tampering / (minor) Repudiation | Server is sole source of truth for the charged price; client badge is cosmetic-only and must be clearly documented as such in code comments, avoiding any assumption that client and server evaluation will always agree instantaneously (clock skew, cache staleness) |
| Race between two terminals adding the same item concurrently while an admin disables a promotion mid-transaction | Tampering (data integrity) | Existing Phase 15 optimistic-concurrency pattern (`p_expected_version`) already covers `create_order_with_items`; promotion evaluation runs inside that same guarded transaction, so no new race is introduced beyond what Phase 15 already handles |
| A promotion admin form submitting a negative `discount_value` or a `percentage` type with `discount_value > 100`, producing a negative charged price | Tampering / Denial of correct billing | CHECK constraint `discount_value >= 0` at the DB level (defense-in-depth beyond Zod `.nonnegative()`), plus `GREATEST(0, ...)` clamping in the compounding loop (mirrors the existing `Math.max(0, ...)` pattern in `computePoolSessionBilling`'s prepaid-minutes deduction, T-2-02-01) |

## Sources

### Primary (HIGH confidence — read directly from the live repository)
- `supabase/migrations/20260425000001_combo_schema.sql`, `...002_combo_columns.sql`, `...003_combo_triggers.sql`, `...004_combo_view.sql` — combo schema + `is_combo_available()` pattern
- `supabase/migrations/20260425000005_add_combo_to_tab_rpc.sql`, `20260428000005_add_combo_to_tab_depletion.sql` — SECURITY DEFINER RPC atomicity + audit-guard pattern
- `supabase/migrations/20260428000003_create_order_with_items_v2.sql` — the exact item-add hook point recommended for `evaluate_promotions`
- `supabase/migrations/20260709000001_tip_distribution_entries_table.sql`, `20260709000002_close_caja_session_tip_distribution.sql` — immutable audit table + in-RPC computation pattern (direct model for `applied_promotions`)
- `supabase/migrations/20260511000001_audit_logs_table.sql` — `record_audit()` signature
- `supabase/migrations/20260510000001_rls_rewrite_phase13.sql` — current (not deprecated) RLS pattern
- `src/shared/lib/domain-helpers.ts`, `src/shared/lib/domain.ts` — `isHappyHourActive`/`resolveProductPrice`, existing `DiscountScope`/`DiscountType` (unrelated feature), `ComboSlotSchema`/`ComboAvailabilitySchema` naming convention
- `src/shared/lib/pool-billing.ts`, `src/entities/pool-table/model/queries.ts` (`useMutationStopSession`) — pool billing computation + write path, confirming `prepaidMinutes` is unwired in the live stop-session call
- `src/entities/tab/model/queries.ts` (`useMutationAddOrder`) — confirms client-computed `unitPrice` flows verbatim into `create_order_with_items`
- `src/widgets/OrderPanel/ProductGrid.tsx`, `src/entities/product/ui/ProductCard.tsx` — confirms `resolveProductPrice()` call sites that must be rewired
- `src/features/manage-combos/ui/ManageCombosTab.tsx`, `ComboBuilderForm.tsx`, `ComboAvailabilityEditor.tsx` — admin UI clone source
- `src/widgets/SettingsTabsPanel/index.tsx` — tab registration point + confirms Combos gates on `manage_products`, not `manage_settings`
- `src/shared/lib/audit-actions.ts`, `src/shared/lib/result.ts` (`AppErrorCode`) — naming conventions for new audit actions / error codes
- `.planning/ROADMAP.md`, `.planning/phases/20-promotions-engine/20-CONTEXT.md` — phase scope and locked decisions
- `.planning/STATE.md` — project history, RBAC seed counts, Phase 13/14/15 sequencing context

### Secondary (MEDIUM confidence)
- None used beyond primary sources — all findings in this research were directly verified by reading the live repository; no WebSearch/Context7 lookups were needed since this phase introduces no new external libraries.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; 100% reuse of existing, verified-in-repo patterns
- Architecture: MEDIUM-HIGH — the item-add hook point and audit-table pattern are HIGH confidence (directly cloned from working code); the pool-billing hook point (D-05a) is MEDIUM confidence because it requires new architecture (no existing RPC boundary) and the combo prepaid-minutes reference mechanism (D-05b) was found to be incompletely wired, which was not knowable without this research
- Pitfalls: HIGH — all six pitfalls are derived from actually reading the current client-trusted-pricing code paths, not speculation

**Research date:** 2026-07-09
**Valid until:** 2026-08-08 (30 days — stable domain, no fast-moving external dependencies; re-verify Pitfall 2's "prepaid minutes not wired" finding if any pool-billing code changes land before planning begins)
