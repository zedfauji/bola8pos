# Phase 20: Promotions Engine - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a server-side promotions engine: a `promotions` table (percentage-off / fixed-amount-off / fixed-override-price, with item/category/pool-time targeting and HH-style day-of-week + time-window availability), an `applied_promotions` audit table (which promotion applied to which order/tab, immutable), and an `evaluate_promotions` RPC that auto-applies eligible promotions atomically at order time — no cashier confirmation step. Ships a Settings → Promotions admin UI (create/edit/disable) modeled on the existing Combos admin pattern. This phase **supersedes** the existing client-side-only happy-hour price override (`categories.happy_hour_start/end`, `products.happy_hour_price`) — that mechanism is migrated into the new promotions table and retired.

</domain>

<decisions>
## Implementation Decisions

### Relationship to existing happy-hour override
- **D-01:** The new `promotions` table **supersedes** `categories.happy_hour_start/end` and `products.happy_hour_price`. A migration auto-converts every category/product currently configured with HH data into an equivalent "fixed override price" promotion row, so nothing breaks on deploy. The old columns are then dropped/deprecated, and the client-side calculation path (`isHappyHourActive`, `getEffectivePrice` in `src/shared/lib/domain-helpers.ts`, `HappyHourBanner.tsx`) is retired/replaced by the new server-side evaluation + `applied_promotions` audit trail.

### Auto-apply behavior
- **D-02:** Promotions apply **silently, automatically** — no cashier confirmation prompt. This matches the current HH UX (price already shows correctly with no interaction) and the ROADMAP wording "auto-apply." The order/receipt shows the resulting discounted line; no "tap to apply" banner step.

### Stacking & precedence
- **D-03:** Multiple eligible promotions on the same item/order **can stack** (not best-price-wins). Each promotion has an admin-set **priority** number. Apply in priority order, **compounding sequentially** — each subsequent promotion's discount is computed against the already-discounted running price from the prior applied promotion, not the original price.

### Discount shapes
- **D-04:** Support three discount shapes in this phase: **percentage off**, **fixed amount off**, and **fixed override price** (the last one is the direct equivalent of the retired HH price-override behavior, so migrated data maps cleanly to it).

### Pool-time targeting — both meanings in scope
- **D-05:** "Pool-time targeting" covers BOTH:
  (a) a **direct discount on pool table billing** — e.g. "20% off pool time 2–5pm weekdays" — discounting the computed `pool_sessions` charge, using the same day-of-week + time-window availability shape as item/category targeting; AND
  (b) **bundled free/discounted pool minutes granted as a reward** for purchasing a targeted item/category — mirrors Phase 2's combo prepaid-minutes pattern (a purchase-triggered pool-time grant, not a billing-time discount).
  Both promotion behaviors are in scope for this phase; planner should treat them as two distinct evaluation paths sharing the same `promotions` schema (differentiated by a target/effect type field).

### Admin UI
- **D-06:** Settings → Promotions models the **existing Combos admin pattern**: a list table of existing promotions (`ManageCombosTab.tsx`-equivalent shape) plus a create/edit dialog (`ComboBuilderForm.tsx`-equivalent) with targeting rules and a day/time availability picker reusing the `ComboAvailabilityEditor.tsx` day-of-week UI pattern. Not a simple inline-editable list (rejected — doesn't scale to many promotions).

### Migration of existing HH data
- **D-07:** Auto-migrate: a migration script reads every category/product currently configured with `happy_hour_start/end`/`happy_hour_price` and creates equivalent "fixed override price" promotion rows automatically, before the old columns are dropped. No manual re-entry burden on admins at deploy time.

### Claude's Discretion
- Exact evaluation trigger point — whether `evaluate_promotions` runs at item-add time (matching today's per-cart-item HH price display) or is deferred to order-close time. **Recommendation: item-add time**, to preserve the existing UX where the cart already shows the discounted price live — planner/researcher should confirm this fits cleanly against `add_item_to_tab` / `create_order_with_items` RPC flow without introducing a second read-then-write race.
- Exact `promotions`/`applied_promotions` column naming — follow closest existing convention (`combo_slots`/`combo_availability` naming style).
- Whether "disable" is a boolean `is_active` flag or a status enum (`active`/`disabled`/`expired`) — follow whichever is more consistent with `combo_availability`'s existing shape.
- Tiebreak rule when two promotions share the same priority value — pick a stable deterministic rule (e.g. lower `id`/earlier `created_at` wins) if this comes up; not expected to be common in practice.
- Whether pool-time discount-on-billing (D-05a) hooks into the same billing computation point Phase 2's combo prepaid-minutes uses, or a new hook — researcher should evaluate against the existing pool-billing RPC/function structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 20: Promotions Engine" — goal, 4 success criteria, depends-on Phase 14. Note: original source doc `POS-COMPARISON.md §20` is no longer present in the repo (same gap flagged in Phase 14/16/17/18/19 CONTEXT.md files) — this CONTEXT.md is the scope source of record.

### Existing happy-hour mechanism to supersede (D-01, D-07)
- `src/shared/lib/domain.ts` — `Category.happyHourStart`/`happyHourEnd` (lines ~184-185), `Product.happyHourPrice` (line ~231) — fields being migrated then retired.
- `src/shared/lib/domain-helpers.ts` — `isHappyHourActive()` (~line 266) and `getEffectivePrice()` (~line 41-70) — client-side calc logic to be replaced by server-side `evaluate_promotions`.
- `src/widgets/OrderPanel/HappyHourBanner.tsx` (+ `.test.tsx`) — existing UI banner showing active HH categories with countdown; likely replaced or repurposed to show active promotions generally.
- `src/entities/category/model/queries.ts`, `src/entities/product/model/queries.ts` — current read/write mapping of `happy_hour_start/end`/`happy_hour_price` columns — reference for what the migration must preserve semantically before dropping columns.

### Existing conditional-availability pattern to reuse (D-05, D-06)
- `supabase/migrations/20260425000001_combo_schema.sql`, `20260425000002_combo_columns.sql`, `20260425000003_combo_triggers.sql`, `20260425000004_combo_view.sql` — `combo_availability` day-of-week + time-window schema; the closest existing conditional-eligibility pattern for promotions' own availability windows.
- `supabase/migrations/20260425000005_add_combo_to_tab_rpc.sql`, `20260428000005_add_combo_to_tab_depletion.sql` — `add_combo_to_tab` RPC pattern (atomic server-side evaluation at order time) — closest existing analog for `evaluate_promotions`' atomicity requirements.
- `src/features/manage-combos/ui/ManageCombosTab.tsx` — admin list-table pattern to model the new Promotions admin tab after (D-06).
- `src/features/manage-combos/ui/ComboBuilderForm.tsx` — create/edit dialog pattern with targeting/pricing fields.
- `src/features/manage-combos/ui/ComboAvailabilityEditor.tsx` — day-of-week + time-window picker UI component — directly reusable/adaptable for promotion availability windows.

### Audit trail pattern (D-02, `applied_promotions`)
- `.planning/phases/14-audit-logs-table/14-CONTEXT.md` — establishes `record_audit` SECURITY DEFINER helper pattern; `applied_promotions` itself is a domain-specific audit table (immutable, one row per applied promotion instance) analogous to Phase 19's `tip_distribution_entries` — see that phase's migration for the "immutable per-transaction snapshot" shape.
- `.planning/phases/19-tip-distribution-config/19-CONTEXT.md` (+ its SUMMARY.md files) — most recent prior phase; `tip_distribution_entries` is the closest existing "written-once, atomic, computed-at-transaction-time" table shape to model `applied_promotions` after.

### Pool-time billing integration (D-05a)
- Phase 2 combo prepaid-minutes mechanism (`.planning/phases` combos context, `add_combo_to_tab` RPC) — reference for how a purchase can grant pool-time minutes (D-05b), and for where pool session billing is computed (D-05a discount hook point).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ComboAvailabilityEditor.tsx` — day-of-week + time-window picker, directly adaptable for promotion HH-style availability windows.
- `ManageCombosTab.tsx` / `ComboBuilderForm.tsx` — list + create/edit dialog pattern to clone for the Promotions admin tab.
- `HappyHourBanner.tsx` — existing live-countdown banner component; likely repurposed into a generic "Active Promotions" banner rather than written from scratch.
- `tip_distribution_entries` (Phase 19) — closest existing "immutable per-transaction audit row" table shape for `applied_promotions`.

### Established Patterns
- Conditional eligibility via day-of-week + time-window columns + a evaluator function (`combo_availability` / `is_combo_available`) — apply the same shape to `promotions`.
- Atomic RPC evaluation at order-time (`add_combo_to_tab`) — apply the same shape to `evaluate_promotions`.
- Admin-only write + `record_audit` (Phase 14) — apply to promotion create/edit/disable actions.
- Immutable per-transaction entry table (Phase 19's `tip_distribution_entries`) — apply to `applied_promotions`.

### Integration Points
- `add_combo_to_tab` / `create_order_with_items` / `add_item_to_tab` RPC flow — primary hook point(s) for `evaluate_promotions`, exact trigger point left to Claude's Discretion above.
- Pool session billing computation (wherever Phase 2's prepaid-minutes / pool charge calc lives) — hook point for D-05a direct pool-time discounts.
- `SettingsTabsPanel` — new "Promotions" tab registration point, alongside the existing Combos tab.
- `src/entities/category/model/queries.ts`, `src/entities/product/model/queries.ts` — will lose their `happy_hour_*` read/write mapping once superseded (D-01).

</code_context>

<specifics>
## Specific Ideas

- Discount shapes explicitly requested: percentage off, fixed amount off, fixed override price (matches migrated legacy HH data cleanly to the third shape).
- Stacking uses admin-set priority + sequential compounding, not simultaneous-off-original-price math.
- Pool-time targeting is intentionally double-scoped (billing discount AND purchase-triggered minute grant) per explicit user choice — not scope creep, both are locked in.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Per-staff/per-terminal promotion restrictions, coupon-code-based promotions, and customer-facing promotion browsing were not raised and are not assumed in scope; flag to the user if they come up during planning as they would be scope creep.)

</deferred>

---

*Phase: 20-promotions-engine*
*Context gathered: 2026-07-09*
