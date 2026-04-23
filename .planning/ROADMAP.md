# Roadmap — Bar POS Feature Expansion 2026-Q2

**Milestone:** v2.0 — Feature Expansion (2026-Q2)
**Source PRDs:** `.planning/feature-expansion-2026q2/sprints/`

Eight phases mapped from the 6-sprint S1–S6 plan (S3 split into S3a/S3b/S3c). Phase numbers are GSD-native; the `Source` field preserves the original sprint ID.

## Phases

- [ ] **Phase 1: Foundation** — Unified stock ledger, category tree, modifier groups, combo flags
- [ ] **Phase 2: Combos** — Customer-visible combo support with pool-time bundles
- [ ] **Phase 3: Ingredient Foundation** — Ingredient entity + canonical stock movement RPC
- [ ] **Phase 4: Recipes & Sale Depletion** — Recipes + atomic ingredient depletion on sale
- [ ] **Phase 5: Kitchen Prep + Cocktails** — Chef prep batches and Michelada extension
- [ ] **Phase 6: Split Bill + Refund** — Four split modes + PIN-gated refunds
- [ ] **Phase 7: Waitlist + WhatsApp** — FIFO queue + WasenderAPI notifications
- [ ] **Phase 8: Polish + Reports + E2E Hardening** — Operator analytics + flake cleanup

---

### Phase 1: Foundation

**Source:** S1-foundation.md
**Goal:** Ship the schema + primitives every downstream sprint depends on — unified stock ledger, hierarchical categories, modifier groups, and combo-eligibility flags. No user-facing behavior change in POS flow.
**Requirements:** S1-01..S1-13 (see CONTEXT.md)
**Depends on:** —
**Plans:** 6 plans

Plans:
- [x] 02-migrations-PLAN.md — 6 SQL migrations (Wave 1, serial) + atomic inventory_log rename flip + Wave-0 scaffolds (S1-01, S1-02, S1-03, S1-04, S1-05, S1-11) ✓ 2026-04-23
- [x] 03-types-zod-PLAN.md — supabase.types.ts regen + Zod schema extensions in domain.ts (Wave 2, fan-in) (S1-06) ✓ 2026-04-23
- [ ] 04-entity-category-PLAN.md — move category hooks to new @entities/category folder + tree-aware queries (Wave 3, parallel) (S1-10)
- [ ] 05-ui-features-PLAN.md — CategoryTreePicker shared/ui + manage-categories + manage-modifier-groups features + Settings wiring + P1 property test (Wave 3, parallel) (S1-07, S1-08, S1-09, S1-12)
- [ ] 06-e2e-categories-PLAN.md — e2e/31-categories.spec.ts full flow (Wave 4) (S1-13)
- [ ] 07-regression-gate-PLAN.md — full suite + staging DB apply + Tauri smoke (Wave 5, manual gates)

**Success Criteria**:
1. `inventory_log` renamed to `stock_movements` with polymorphic `ref_type/ref_id` and nullable `ingredient_id`
2. `categories.parent_id` with depth-3 CHECK trigger enforced
3. Modifier groups tables (`modifier_groups`, `modifier_group_items`, `product_modifier_groups`) live with admin UI in Settings
4. `products.combo_eligible` and `products.is_combo` flags added
5. `payments.tab_id` isOneToOne constraint dropped
6. `supabase.types.ts` regenerated and `domain.ts` Zod schemas extended
7. No regression in existing POS flow — all 17 e2e specs still pass

---

### Phase 2: Combos

**Source:** S2-combos.md
**Goal:** Ship customer-visible combo support: Cubeta x10 with beer selection, combos with 1-hour free pool, multi-slot bundle pricing, day-of-week availability.
**Requirements:** S2-01..S2-11
**Depends on:** Phase 1
**Plans:** 0 plans

**Success Criteria**:
1. Combo schema (`combo_slots`, `combo_slot_options`, `combo_availability`) live with no-nesting trigger
2. `is_combo_available` server-side enforcement in `add_order_item` RPC
3. `ComboBuilderSheet` opens when `is_combo=true` item is tapped
4. Prepaid pool minutes consumed before billable time
5. Admin builder UI in Settings → Combos

---

### Phase 3: Ingredient Foundation

**Source:** S3a-ingredients.md
**Goal:** Build the ingredient entity and the canonical `record_stock_movement` RPC. No sale-time depletion yet — get the ledger right before anything writes to it.
**Requirements:** S3a-01..S3a-08
**Depends on:** Phase 1
**Plans:** 0 plans

**Success Criteria**:
1. `ingredients` table + `record_stock_movement` RPC atomic (ledger + quantity)
2. Idempotency index on `(ref_type, ref_id, ingredient_id)` for depletion reasons
3. UOM conversion utility covered by P5 round-trip property test
4. Ingredient admin UI: list, create, edit, CSV import, per-ingredient ledger view
5. Manual adjustment flow (waste/correction/count) writes audit-worthy movements

---

### Phase 4: Recipes & Sale Depletion

**Source:** S3b-recipes.md
**Goal:** Wire the stock ledger into the order flow. Selling a recipe-backed item depletes all ingredients atomically. Cocktails work for free as products-with-recipes.
**Requirements:** S3b-01..S3b-09
**Depends on:** Phase 3
**Plans:** 0 plans

**Success Criteria**:
1. `recipes` + `recipe_items` tables + `deplete_for_order_item` RPC
2. Negative-stock guard with manager PIN override + audit log
3. Recipe editor UI on product detail page with ingredient autocomplete
4. Refund/void ledger reversal contract in place for Phase 6 reuse
5. E2E `20-recipes.spec.ts` passes

---

### Phase 5: Kitchen Prep + Cocktails

**Source:** S3c-prep-cocktails.md
**Goal:** Enable chef-side batch production: prep writes +N prep-ingredient and consumes raw ingredients; prep ingredients then flow into menu recipes. Ship `/kitchen-prep` UI.
**Requirements:** S3c-01..S3c-09
**Depends on:** Phase 4
**Plans:** 0 plans

**Success Criteria**:
1. `prep_productions` table + trigger writes movements atomically
2. `is_prep=true` enforced for prep batches by CHECK trigger
3. `/kitchen-prep` page with raw-impact preview
4. Prep ingredient filter + chef-hat badge in ingredient UI
5. Michelada mix prep flows into Michelada recipe — E2E `21-prep.spec.ts` passes

---

### Phase 6: Split Bill + Refund

**Source:** S4-split-refund.md
**Goal:** Ship split bill (4 modes) and post-payment refund with PIN gate and optional per-line inventory reversal, sharing the sub-tab pattern.
**Requirements:** S4-01..S4-11
**Depends on:** Phase 4
**Plans:** 0 plans

**Success Criteria**:
1. `tabs.parent_tab_id` + `refunds/refund_items` schema live
2. RPCs: `split_tab_by_item/evenly/by_person/by_amount`, `process_refund`
3. `SplitTabSheet` 4-mode tabs + `RefundSheet` with manager PIN
4. Parent tab auto-closes when all sub-tabs paid
5. Ledger reversal reuses `deplete_for_order_item(id, -1)` from Phase 4
6. E2E specs `22-split-bill.spec.ts`, `23-refund.spec.ts` pass

---

### Phase 7: Waitlist + WhatsApp

**Source:** S5-waitlist.md
**Goal:** Walk-in queue with FIFO ordering, party size, and per-party WhatsApp notification on table-available events (fallback to Realtime pane + Tauri notification).
**Requirements:** S5-01..S5-11
**Depends on:** Phase 1
**Plans:** 0 plans

**Success Criteria**:
1. `waitlist_entries` + `waitlist_notifications` schema live
2. `send-waitlist-notification` edge function integrates WasenderAPI via Vault secret
3. `/waitlist` page + Home tile + Realtime manager pane
4. Auto-notify trigger fires on `status → 'notified'`
5. Seat-to-table flow assigns `table_id` and clears entry
6. E2E `24-waitlist.spec.ts` passes

---

### Phase 8: Polish + Reports + E2E Hardening

**Source:** S6-polish-reports.md
**Goal:** Ship operator analytics for Phases 2–7, fix paper-cuts, harden E2E suite, resolve deferred debt.
**Requirements:** S6-01..S6-10
**Depends on:** Phases 2, 4, 5, 6, 7
**Plans:** 0 plans

**Success Criteria**:
1. Reports: Combo Mix, Recipe Variance, Waitlist Analytics, Refunds Register live on `/reports`
2. Performance indexes applied per data-model § S6
3. E2E suite green with zero flakes across specs 01–24
4. Paper-cuts backlog triaged — ~30% of sprint reserved for field feedback
5. `CLAUDE.md` "Implemented Features" list + Obsidian Feature Backlog updated

---

*Roadmap derived: 2026-04-23 from `.planning/feature-expansion-2026q2/sprints/` PRDs.*
