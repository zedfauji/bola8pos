# Roadmap — Bar POS Feature Expansion 2026-Q2

**Milestone:** v2.0 — Feature Expansion (2026-Q2)
**Source PRDs:** `.planning/feature-expansion-2026q2/sprints/`

Eight phases mapped from the 6-sprint S1–S6 plan (S3 split into S3a/S3b/S3c). Phase numbers are GSD-native; the `Source` field preserves the original sprint ID.

## Phases

- [x] **Phase 1: Foundation** — Unified stock ledger, category tree, modifier groups, combo flags (completed 2026-04-23)
- [x] **Phase 2: Combos** — Customer-visible combo support with pool-time bundles (completed 2026-04-24)
- [ ] **Phase 3: Ingredient Foundation** — Ingredient entity + canonical stock movement RPC
- [x] **Phase 4: Recipes & Sale Depletion** — Recipes + atomic ingredient depletion on sale (completed 2026-04-24)
- [x] **Phase 5: Kitchen Prep + Cocktails** — Chef prep batches and Michelada extension
 (completed 2026-07-03)

- [ ] **Phase 6: Split Bill + Refund** — Four split modes + PIN-gated refunds
- [x] **Phase 7: Waitlist + WhatsApp** — FIFO queue + WasenderAPI notifications (completed 2026-04-25)
- [ ] **Phase 8: Polish + Reports + E2E Hardening** — Operator analytics + flake cleanup
- [ ] **Phase 9: Auto-Update Service** — GitHub Releases updater with user confirm dialog (v2.1)
- [ ] **Phase 10: AI Slob Technical Debt Audit** — Audit lint/test/typecheck/E2E findings
- [x] **Phase 11: AI Slob Technical Debt Remediation** — Typed agent queries, lint+test green, CI pipeline, CVE docs (completed 2026-04-27)
- [x] **Phase 12: Full RBAC Management Page** — Dedicated admin-only /rbac page; remove role-editing from StaffDashboard; single source of truth for role management *(Complete 2026-04-27)*
- [x] **Phase 13: Full RBAC From Scratch** — Supabase RLS policies aligned with frontend role hierarchy; DB-level enforcement matching rbac.ts; hardened access control *(Complete 2026-04-28)*

### v2.1 — Cross-Pollination from billar-pos (planned 2026-04-28)

Phases 14-28 derived from `.planning/comparison/POS-COMPARISON.md` v2 cross-pollination list. Each phase has a populated CONTEXT.md ready for `/gsd-plan-phase`.

- [x] **Phase 14: Audit Logs Table** — Central `audit_logs(action, entity, before, after, user_id, terminal_id, ip, source)` + `record_audit` SECURITY DEFINER helper + manager+ `/audit` page w/ JSON-diff viewer (completed 2026-07-05)
- [x] **Phase 15: Tabs Version (Optimistic Concurrency)** — `version` column on tabs/pool_sessions/caja_sessions + `expected_version` RPC param + `STALE_VERSION` error path + offline-queue conflict handling
 (completed 2026-04-28)

- [x] **Phase 16: Kitchen/Bar Split Routing** — `category.routing` enum (KITCHEN|BAR|NONE) + new `/kds-bar` page (bartender+) + `RoutingBadge` widget (completed 2026-07-07)
- [x] **Phase 17: Modifier → Inventory Rules** — `modifier_inventory_rules` join + extend `deplete_for_order_item` RPC + admin UI in `manage-modifier-groups` (completed 2026-07-07)
- [x] **Phase 18: Split Payment (Multi-Method)** — Up to 4 payment methods on close via `payment_group_id` + `split_index`; PaymentPane multi-row UI (completed 2026-07-08)
- [x] **Phase 19: Tip Distribution Config** — Singleton `tip_distribution_config` (floor/bar/kitchen %) + `tip_distribution_entries` + close-caja allocation + Settings panel (completed 2026-07-09)
- [x] **Phase 20: Promotions Engine** — `promotions` + `applied_promotions` tables + `evaluate_promotions` RPC (HH windows, item/category/pool-time targeting, auto-apply) + Settings → Promotions admin (completed 2026-07-10)
- [ ] **Phase 21: i18n Multi-Language** — `react-i18next` + `es-MX`/`en-US` catalogs + `profiles.locale` + ESLint rule banning hard-coded strings
- [ ] **Phase 22: Edit Paid Ticket + History** — `edit_paid_tab` RPC (whitelisted patch + manager PIN + reason) + EditPaidTabDialog + `/edit-history` view *(depends Phases 14, 15)*
- [ ] **Phase 23: Reopen Closed Ticket** — `reopen_tab` RPC + payment status `reopened_void` + caja offsetting entries + 24h/2x cap *(depends Phases 14, 15)*
- [ ] **Phase 24: Operational Reports Suite + CSV** — 6 new RPCs (peak-hours, voids, deletions×2, modifier popularity, payment methods, charts-data) + generic CSV export action + Recharts widgets *(depends Phase 14)*
- [ ] **Phase 25: Receipt Item Grouping (2-Level)** — Extend `receipt-format.ts` + Tauri Rust printer payload + PDF + KDS card all share `groupOrderItemsForReceipt`
- [ ] **Phase 26: Floating Tables (`is_temp`)** — Generalize pool_tables → `resources` w/ FLOATING type + auto-deactivate trigger + waitlist auto-create flow
- [ ] **Phase 27: One-Shot Inventory (Cigarette-Box Pattern)** — `open_units` table + `consume_open_unit` SQL fn + admin Open-Units tab + reportable lifecycle *(depends Phases 14, 17)*
- [ ] **Phase 28: Money Formatter Utility** — Single `shared/lib/format.ts` (formatMoney/parseMoneyInput/formatPercent) backed by `Intl.NumberFormat` + codemod + ESLint rule `no-raw-money-format` *(depends Phase 21)*

**Suggested execution order** (respecting deps; foundations first):

1. **Foundations**: 14 → 15
2. **Schema-touch parallel batch**: 16, 17, 18, 19, 20 (independent of each other, all depend on 14)
3. **Audit-using parallel batch**: 22, 23 (depend on 14, 15)
4. **Reports + UI**: 24 (depends 14), 25, 26
5. **Cross-cutting**: 21 → 28 (28 depends 21)
6. **Niche**: 27 (depends 14, 17)

### v2.2 — UI Standardization (planned 2026-07-10)

App-wide UI consistency pass enforcing existing shadcn/Tailwind conventions across all 17 routes — no new design system, no visual redesign, no UX flow changes. Requirements scoped from `.planning/research/SUMMARY.md`; phases follow a strict risk-tiered rollout (audit → shell/primitives → low-risk sweep → operational sweep → payment-critical sweep → visual baseline → guardrails).

- [x] **Phase 29: UI Drift Audit** — File-mapped inventory of raw buttons/inputs, hardcoded colors, arbitrary-value spacing across all 17 routes (completed 2026-07-10)
- [x] **Phase 30: Shared Shell & Primitive Extension** — Every route on one `PageContainer` shell; dead `AppShell`/`AppNav` removed; `CLAUDE.md` routes table corrected (completed 2026-07-10)
- [x] **Phase 31: Component, Token & Spacing Consistency Sweep** — Non-payment pages use `shared/ui` primitives + Tailwind tokens + spacing scale (completed 2026-07-11)
- [x] **Phase 32: Touch Target & Focus-Visible Sweep** — Operational/realtime pages meet the 44/56/72px touch floor + visible `focus-visible` rings (completed 2026-07-13)
- [ ] **Phase 33: Payment-Critical Page Sweep (Isolated)** — POS/payments/split/refund/tip surfaces standardized, zero behavior change, gated by existing E2E specs
- [x] **Phase 34: Visual Regression Baseline** — Isolated Playwright visual-diff config + post-fix screenshot baselines for all 17 routes (completed 2026-07-14)
- [ ] **Phase 35: Guardrails — Tokens Doc & Drift Lint** — Design tokens reference doc + drift-detection lint rule, added only after conformance

**Execution order** (strict — respects blast-radius tiering from `research/SUMMARY.md`; each phase depends on the previous):

29 → 30 → 31 → 32 → 33 → 34 → 35
---

### Phase 1: Foundation

**Source:** S1-foundation.md
**Goal:** Ship the schema + primitives every downstream sprint depends on — unified stock ledger, hierarchical categories, modifier groups, and combo-eligibility flags. No user-facing behavior change in POS flow.
**Requirements:** S1-01..S1-13 (see CONTEXT.md)
**Depends on:** —
**Plans:** 6/6 plans complete

Plans:

- [x] 02-migrations-PLAN.md — 6 SQL migrations (Wave 1, serial) + atomic inventory_log rename flip + Wave-0 scaffolds (S1-01, S1-02, S1-03, S1-04, S1-05, S1-11) ✓ 2026-04-23
- [x] 03-types-zod-PLAN.md — supabase.types.ts regen + Zod schema extensions in domain.ts (Wave 2, fan-in) (S1-06) ✓ 2026-04-23
- [x] 04-entity-category-PLAN.md — move category hooks to new @entities/category folder + tree-aware queries (Wave 3, parallel) (S1-10) ✓ 2026-04-23
- [x] 05-ui-features-PLAN.md — CategoryTreePicker shared/ui + manage-categories + manage-modifier-groups features + Settings wiring + P1 property test (Wave 3, parallel) (S1-07, S1-08, S1-09, S1-12) ✓ 2026-04-23
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
**Plans:** 9/9 plans complete

Plans:

- [x] 02-01-PLAN.md — DB migrations (combo_slots, combo_slot_options, combo_availability, column extensions, triggers, is_combo_available, view) + AppErrorCode + shadcn Collapsible (Wave 1) (S2-01, S2-02, S2-03, S2-04) ✓ 2026-04-23
- [x] 02-02-PLAN.md — [BLOCKING] supabase db push + combo Zod schemas in domain.ts + pool-billing prepaid extension (Wave 2) (S2-06, S2-12) ✓ 2026-04-23
- [x] 02-03-PLAN.md — entities/combo/ FSD slice (6 hooks) + add_combo_to_tab PL/pgSQL RPC migration (Wave 3) (S2-05, S2-07) ✓ 2026-04-23
- [x] 02-04-PLAN.md — shared/ui components (ComboBadge, ComboUnavailableBadge, ComboSlotCard + stories) + ProductGrid combo routing fork + availability display (Wave 4) (S2-11, S2-14) ✓ 2026-04-23
- [x] 02-05-PLAN.md — add-combo-to-tab feature: useAddComboToTab mutation + ComboBuilderSheet + integration tests + ProductGrid wiring (Wave 5) (S2-08) ✓ 2026-04-23
- [x] 02-06-PLAN.md — manage-combos admin feature + SettingsTabsPanel Combos tab + KDS Collapsible bundle grouping (Wave 5) (S2-09, S2-10, S2-13) ✓ 2026-04-23
- [x] 02-07-PLAN.md — Property tests P2 (pricing) + P3 (availability) + seed-combos.ts (Wave 6) (S2-16, S2-18) ✓ 2026-04-23
- [x] 02-08-PLAN.md — E2E 32-combos.spec.ts + regression gate + human sign-off checkpoint (Wave 7) (S2-17) ✓ 2026-04-24
- [x] 02-09-PLAN.md — Gap closure: NESTED_COMBO_FORBIDDEN integration test (S2-08) ✓ 2026-04-24

**Success Criteria**:

1. Combo schema (`combo_slots`, `combo_slot_options`, `combo_availability`) live with no-nesting trigger
2. `is_combo_available` server-side enforcement in `add_combo_to_tab` RPC
3. `ComboBuilderSheet` opens when `is_combo=true` item is tapped
4. Prepaid pool minutes consumed before billable time
5. Admin builder UI in Settings → Combos

---

### Phase 3: Ingredient Foundation

**Source:** S3a-ingredients.md
**Goal:** Build the ingredient entity and the canonical `record_stock_movement` RPC. No sale-time depletion yet — get the ledger right before anything writes to it.
**Requirements:** S3a-01..S3a-08
**Depends on:** Phase 1
**Plans:** 8 plans

Plans:

- [ ] 03-01-PLAN.md — SQL migrations: ingredients table + idempotency index + record_stock_movement RPC + [BLOCKING] supabase db push (Wave 1) (S3a-01, S3a-02, S3a-03)
- [ ] 03-02-PLAN.md — Zod schemas in domain.ts (Ingredient, UOM, ManualAdjustReason) + uom.ts utility + P5 round-trip property test (Wave 1, parallel) (S3a-04, S3a-05)
- [ ] 03-03-PLAN.md — entities/ingredient/ FSD slice: types.ts, queries.ts, index.ts (Wave 2) (S3a-06)
- [ ] 03-04-PLAN.md — features/adjust-stock-movement/ + features/import-ingredients-csv/ (Wave 2, parallel with 03-03) (S3a-07, S3a-08)
- [ ] 03-05-PLAN.md — features/manage-ingredients/ (IngredientForm + ManageIngredientsTab) + widgets/IngredientsTable/ + widgets/StockMovementsList/ (Wave 3) (S3a-07)
- [ ] 03-06-PLAN.md — SettingsTabsPanel wiring: Ingredients tab after Combos (Wave 4) (S3a-07)
- [ ] 03-07-PLAN.md — E2E 33-ingredients.spec.ts (T1–T7) + P4 ledger invariant + seed-ingredients.ts + human sign-off (Wave 5) (S3a-07, S3a-08)
- [ ] 03-08-PLAN.md — Gap closure: product_id nullable migration + RPC fix + StockMovementSchema nullable + CSV warnings + E2E T4/T5 verification (S3a-03, S3a-07, S3a-08)

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
**Plans:** 6/6 plans complete

Plans:

- [x] 04-01-PLAN.md — DB migrations: recipes + recipe_items + audit_log tables + deplete_for_order_item RPC + [BLOCKING] supabase db push (Wave 1) (S3b-01, S3b-02) ✓ 2026-04-24
- [x] 04-02-PLAN.md — Zod schemas (RecipeSchema family + computeDepletion) + supabase.types.ts extension + 3 Wave 0 test stubs (Wave 2) (S3b-05) ✓ 2026-04-24
- [x] 04-03-PLAN.md — v2 SQL migrations (p_skip_depletion, p_allow_negative, add_combo_to_tab depletion loop) + recipe entity + shadcn command/popover (Wave 3) ✓ 2026-04-24
- [x] 04-04-PLAN.md — void reversal + useOverrideNegativeStock + IngredientAutocomplete + CartPanel INVENTORY_NEGATIVE override (Wave 4) ✓ 2026-04-24
- [x] 04-05-PLAN.md — manage-recipe feature (useManageRecipe + RecipeEditorTab) + Recipe tab in product edit Dialog (max-w-2xl) + seed-recipes.ts (Wave 5) (S3b-07, S3b-09, S3b-14) ✓ 2026-04-24
- [x] 04-06-PLAN.md — Tests: unit (6/6) + property (fast-check) + integration (4/4) + E2E 36-recipes.spec.ts (3/3 pass, 1 skip) (Wave 6) ✓ 2026-04-24

**Success Criteria**:

1. `recipes` + `recipe_items` tables + `deplete_for_order_item` RPC — DONE
2. Negative-stock guard with manager PIN override + audit log — DONE
3. Recipe editor UI on product detail page with ingredient autocomplete — DONE
4. Refund/void ledger reversal contract in place for Phase 6 reuse — DONE
5. E2E `36-recipes.spec.ts` passes (3/3, 1 intentional skip) — DONE

---

### Phase 5: Kitchen Prep + Cocktails

**Source:** S3c-prep-cocktails.md
**Goal:** Enable chef-side batch production: prep writes +N prep-ingredient and consumes raw ingredients; prep ingredients then flow into menu recipes. Ship `/kitchen-prep` UI.
**Requirements:** S3c-01..S3c-09
**Depends on:** Phase 4
**Plans:** 5/5 plans complete

Plans:

- [x] 05-01-PLAN.md — DB migrations: prep_productions table + recipes extension (nullable product_id + prep_ingredient_id + CHECK) + trg_prep_production_insert trigger + [BLOCKING] supabase db push + supabase.types.ts transcription (Wave 1) (S3c-01, S3c-02, S3c-03)
- [x] 05-02-PLAN.md — domain.ts PrepProductionSchema family + RecipeSchema update (nullable productId + prepIngredientId) + result.ts PREP_INGREDIENT_REQUIRED + rbac.ts produce_prep_batch + prep-math.ts pure function + Wave 0 test stubs (Wave 2) (S3c-04, S3c-05)
- [x] 05-03-PLAN.md — entities/prep/ FSD slice (queries, types, PrepOnHandCard, stories, barrel) + features/produce-prep-batch/model/ (useProducePrepBatch + integration tests I1–I5) (Wave 3) (S3c-04, S3c-05, S3c-06)
- [x] 05-04-PLAN.md — ChefHatBadge shared/ui + Storybook + PrepProductionForm Dialog + PrepBatchPreview + KitchenPrepDashboard widget + /kitchen-prep page + KitchenPrepRoute + router + Home tile + IngredientsTable filterPrep prop (Wave 4) (S3c-06, S3c-07, S3c-08, S3c-09)
- [x] 05-05-PLAN.md — seed-prep.ts (Salsa Mexicana + Michelada Mix + raw ingredients + prep recipes) + E2E 21-prep.spec.ts T1–T5 + quality gate + human sign-off (Wave 5) (S3c-01, S3c-02, S3c-03, S3c-06, S3c-07, S3c-08, S3c-09)

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
**Requirements:** S4-01..S4-19
**Depends on:** Phase 4 (deplete_for_order_item stubbed for Phase 6 independence)
**Plans:** 11 plans

Plans:

- [ ] 06-01-PLAN.md — ENUM extension migration (no-transaction) + main schema migration: tabs split columns, refunds/refund_items tables, payments is_refund/refund_id, CHECK fixes (Wave 1) (S4-01, S4-02)
- [ ] 06-02-PLAN.md — Split tab RPCs (split_tab_by_item/evenly/by_person/by_amount) + process_refund RPC + parent auto-close trigger (Wave 1) (S4-03, S4-04, S4-05, S4-06, S4-07, S4-14)
- [ ] 06-03-PLAN.md — [BLOCKING] supabase db push + manual supabase.types.ts transcription (Wave 2) (S4-01, S4-02, S4-03, S4-04, S4-05, S4-06, S4-07, S4-14)
- [ ] 06-04-PLAN.md — domain.ts Zod extensions (TabStatus+split, TabSchema, PaymentSchema, RefundSchema) + result.ts 6 new AppErrorCodes + rbac.ts process_refund + split-math.ts + P8/P9 property tests (Wave 3) (S4-08, S4-15)
- [ ] 06-05-PLAN.md — entities/tab: useSubTabs + useTabList parent_tab_id filter; entities/payment: isRefund; entities/refund: new FSD slice (Wave 3) (S4-09)
- [ ] 06-06-PLAN.md — shared/ui: SubTabColumn + PersonCard + Storybook stories (Wave 3) (S4-12)
- [ ] 06-07-PLAN.md — features/split-tab: useSplitTab + SplitTabSheet (4 modes: evenly/item/person/amount) (Wave 4) (S4-10)
- [ ] 06-08-PLAN.md — features/process-refund: useProcessRefund + RefundSheet + P10 property test (Wave 4) (S4-11, S4-15)
- [ ] 06-09-PLAN.md — PaymentsPage Refunds tab + RefundsList widget + PaymentPane Refund button + OrderPanel Split bill button + sub-checks section (Wave 4) (S4-13)
- [x] 06-10-PLAN.md — Integration tests: split-by-item flow (S4-16) + refund-with-restock flow (S4-17) (Wave 5) (S4-16, S4-17)
- [ ] 06-11-PLAN.md — E2E 34-split-bill.spec.ts + 35-refund.spec.ts + regression gate + human sign-off (Wave 5) (S4-18, S4-19)

**Success Criteria**:

1. `tabs.parent_tab_id` + `refunds/refund_items` schema live
2. RPCs: `split_tab_by_item/evenly/by_person/by_amount`, `process_refund`
3. `SplitTabSheet` 4-mode tabs + `RefundSheet` with manager PIN
4. Parent tab auto-closes when all sub-tabs paid
5. `deplete_for_order_item` stubbed with graceful fallback (Phase 4 not yet built)
6. E2E specs `34-split-bill.spec.ts`, `35-refund.spec.ts` pass

---

### Phase 7: Waitlist + WhatsApp

**Source:** S5-waitlist.md
**Goal:** Walk-in queue with FIFO ordering, party size, and per-party WhatsApp notification on table-available events (fallback to Realtime pane + Tauri notification).
**Requirements:** S5-01..S5-11
**Depends on:** Phase 1
**Plans:** 8 plans (7 executed + 1 gap closure)

Plans:

- [x] 07-01-PLAN.md — DB migrations (waitlist_entries + waitlist_notifications + pg_net trigger) (Wave 1) (S5-01, S5-02, S5-03)
- [x] 07-02-PLAN.md — [BLOCKING] supabase db push + shared utilities (phone.ts, waitlist-math.ts, tauri-notify.ts) + Zod schemas + AppErrorCodes + RBAC (Wave 2) (S5-04, S5-06, S5-07)
- [x] 07-03-PLAN.md — Edge function send-waitlist-notification (Deno + WasenderAPI + rate-limit guard) (Wave 3) (S5-05)
- [x] 07-04-PLAN.md — entities/waitlist/ FSD slice (types, queries, WaitlistEntryCard + Storybook) + WaitlistRealtimeListener (Wave 3) (S5-08)
- [x] 07-05-PLAN.md — Features: add-waitlist-entry, notify-waitlist, seat-waitlist-party, mark-no-show/cancelled (Wave 4) (S5-09, S5-10, S5-11)
- [x] 07-06-PLAN.md — Widgets + WaitlistPage + Route + Router + HomeDashboard tile with live count badge (Wave 5)
- [x] 07-07-PLAN.md — Unit tests (phone, waitlist-math), schema tests, E2E 24-waitlist.spec.ts (Wave 6)
- [x] 07-08-PLAN.md — Gap closure CR-01+CR-02: register /waitlist route in router.tsx, mount WaitlistRealtimeListener, fix pool_tables name→label+number column bug in 3 files (Wave 7) (S5-08, S5-11) ✓ 2026-04-25

**Success Criteria**:

1. `waitlist_entries` + `waitlist_notifications` schema live
2. `send-waitlist-notification` edge function integrates WasenderAPI via supabase secrets set
3. `/waitlist` page + Home tile + Realtime manager pane
4. Auto-notify trigger fires on `status → 'notified'`
5. Seat-to-table flow assigns `table_id` and clears entry
6. E2E `24-waitlist.spec.ts` passes

---

### Phase 8: Polish + Reports + E2E Hardening

**Source:** S6-polish-reports.md
**Goal:** Ship operator analytics for Phases 2–7, fix paper-cuts, harden E2E suite, resolve deferred debt.
**Requirements:** S6-01..S6-15
**Depends on:** Phases 2, 4, 5, 6, 7
**Plans:** 5/6 plans executed

Plans:

- [x] 08-01-PLAN.md — Wave 0 lint fixes + Wave 0 test stubs + Wave 1 DB migrations (3 views + 2 indexes) + S6-15 DOWN scripts + [BLOCKING] supabase db push (S6-01, S6-02, S6-15)
- [x] 08-02-PLAN.md — Wave 2 domain types (5 Zod schemas + supabase.types.ts extension) + Wave 3 query hooks (5 hooks + 365-day guard) (S6-01, S6-03, S6-04, S6-05, S6-06, S6-09)
- [x] 08-03-PLAN.md — Wave 4 report widgets: ComboMixReport + RecipeVarianceReport + WaitlistAnalyticsReport + RefundsRegister + ComboOverrideReport (S6-03, S6-04, S6-05, S6-06, S6-09)
- [x] 08-04-PLAN.md — Wave 5 export infrastructure extension + ReportsPage 5 new tabs wired (S6-07, S6-08)
- [ ] 08-05-PLAN.md — Wave 6+7: seed-reports.ts + 37-analytics-reports.spec.ts + 21-prep T5 fix + CLAUDE.md update + human E2E sign-off (S6-10, S6-11, S6-13, S6-14, S6-15)
- [x] 08-06-PLAN.md — Wave 4 (parallel with 08-03): S6-12 paper-cuts — touch targets + focus traps + toast copy + import-order lint fixes for waitlist flow (S6-12)

**Success Criteria**:

1. Reports: Combo Mix, Recipe Variance, Waitlist Analytics, Refunds Register, Combo Overrides live on `/reports`
2. Performance indexes applied — idx_stock_movements_ingredient_ts + idx_waitlist_entries_status_created_at
3. E2E suite green with zero flakes across specs 01–37
4. Paper-cuts backlog triaged — 8 import-order lint fixes committed
5. `CLAUDE.md` "Implemented Features" list + Obsidian Feature Backlog updated
6. All S6 migrations include DOWN script comment blocks (S6-15)

---

### Phase 9: Auto-Update Service

**Milestone:** v2.1 — Auto-Update Service
**Goal:** Ship Tauri-native in-app update detection and one-click install from GitHub Releases. User sees a dialog (version + changelog) at startup and every 4 hours; clicking Install downloads, applies, and restarts without destructive manual steps.
**Requirements:** UPD-01..UPD-08 (see `.planning/PROJECT.md`)
**Depends on:** Phase 8 complete; GitHub Actions release pipeline already working
**Plans:** 2/5 plans executed

Plans:

- [x] 09-01-PLAN.md — Signing setup: `tauri signer generate` key pair + add pubkey to `tauri.conf.json` + `TAURI_SIGNING_PRIVATE_KEY` secret to GitHub Actions + sign step in existing release workflow (UPD-06)
- [x] 09-02-PLAN.md — Plugin integration: `tauri-plugin-updater` in `Cargo.toml` + `src-tauri/lib.rs` plugin registration + updater endpoint config in `tauri.conf.json` pointing to GitHub Releases JSON (UPD-01, UPD-07)
- [ ] 09-03-PLAN.md — Frontend hook: `useAppUpdater` wrapping `@tauri-apps/plugin-updater` — startup check + 4-hour `setInterval` + state shape `{ updateAvailable, version, body, isDownloading, progress, install, dismiss }` + `UpdaterProvider` context (UPD-01, UPD-02, UPD-05, UPD-07, UPD-08)
- [ ] 09-04-PLAN.md — Update dialog UI: `UpdateAvailableDialog` (version badge + changelog markdown render + Install Now / Remind Later + download progress bar + restart prompt after install complete) + Storybook stories (UPD-03, UPD-04, UPD-05, UPD-08)
- [ ] 09-05-PLAN.md — App wiring + tests: wire `UpdaterProvider` into `app/providers.tsx` + mount `UpdateAvailableDialog` in `AppShell` + unit tests for `useAppUpdater` (mock plugin) + E2E smoke test (UPD-01..UPD-08)

**Success Criteria**:

1. `tauri signer generate` key pair committed (pubkey in `tauri.conf.json`; private key in GitHub Actions secret only)
2. `tauri-plugin-updater` loaded — app starts without panic on Windows
3. `useAppUpdater` returns `updateAvailable: true` when a newer tag exists on GitHub Releases
4. `UpdateAvailableDialog` renders version + parsed changelog; Install triggers download + restart
5. 4-hour periodic check fires without blocking UI thread
6. Graceful no-op when offline or on latest version (no error toast)
7. Unit tests pass with mocked `@tauri-apps/plugin-updater`; E2E smoke passes

---

---

### Phase 10: AI Slob Technical Debt Checklist

**Goal:** Audit and document all technical debt accumulated across phases 1–9.
**Plans:** 1/1 plans executed

Plans:

- [x] 10-01-PLAN.md — AI Slob audit: lint/test/typecheck/E2E findings + CHECKLIST.md (36 open items) ✓ 2026-04-27

---

### Phase 11: AI Slob Technical Debt Remediation

**Goal:** Drive lint to 0 errors, tests to 100% passing, establish CI green baseline.
**Plans:** 4/4 plans executed

Plans:

- [x] 11-01-PLAN.md — supabase.types.ts extension with agent tables + as-any cast removal (prerequisite, executed inline with 11-02) ✓ 2026-04-27
- [x] 11-02-PLAN.md — Lint green + test green baseline: eslint --fix + manual typed-lint fixes + brain.test.ts mock contract fix (1107 tests pass, 0 lint errors) ✓ 2026-04-27
- [x] 11-03-PLAN.md — CI pipeline: .github/workflows/ci.yml created; typecheck/lint/test gate GREEN; audit blocks on xlsx CVE (documented for Plan 04 risk acceptance) ✓ 2026-04-27
- [x] 11-04-PLAN.md — xlsx CVE risk documentation: SECURITY comment in excel.ts + decision record .planning/decisions/xlsx-cve-risk-accept.md (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) ✓ 2026-04-27

---

### Phase 12: Full RBAC Management Page

**Goal:** Create a dedicated `/rbac` route with a full RBAC management page (admin-only via `manage_staff`). Remove role-editing fragments from StaffDashboard. Single source of truth for role management. Follow project navigation patterns (route guard + lazy page + HomeDashboard tile).
**Requirements:** RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05, RBAC-06
**Depends on:** Phase 11
**Plans:** 2/2 plans executed

Plans:

- [x] 12-01-PLAN.md — Core scaffolding: rbac-route.tsx + pages/rbac/index.tsx + widgets/RBACDashboard/ (DataTable + per-row Edit Role) + EditRoleDialog preSelectedStaffId prop + StaffDashboard Administration section removal (Wave 1) (RBAC-01, RBAC-02, RBAC-03, RBAC-04)
- [x] 12-02-PLAN.md — Wiring: router.tsx /rbac route + HomeDashboard ShieldCheck tile + CLAUDE.md routes table update + E2E tests T-RBAC-page + T-RBAC-redirect in 09-rbac.spec.ts (Wave 2) (RBAC-01, RBAC-05, RBAC-06)

**Success Criteria**:

1. `/rbac` route registered, admin-only via `RbacRoute` guard (redirects non-admin to /home)
2. `RBACDashboard` widget shows DataTable of staff with Name, Role badge, and per-row "Edit Role" button
3. Per-row Edit Role opens `EditRoleDialog` pre-seeded with that staff member's ID
4. `StaffDashboard` has zero traces of Administration section or `EditRoleDialog` mount
5. HomeDashboard shows "Roles & Permissions" tile with `ShieldCheck` icon, gated to admin
6. E2E T-RBAC-page + T-RBAC-redirect pass in `09-rbac.spec.ts`
7. typecheck + lint pass (0 errors/warnings)

---

---

### Phase 13: Full RBAC From Scratch

**Goal:** Implement full RBAC enforcement from scratch — Supabase RLS policies aligned with frontend role hierarchy, dynamic permission management, and hardened DB-level access control. The frontend `rbac.ts` role map is the source of truth; RLS must enforce the same rules server-side.
**Requirements:** RBAC13-01, RBAC13-02, RBAC13-03, RBAC13-04, RBAC13-05, RBAC13-06, RBAC13-07, RBAC13-08, RBAC13-09
**Depends on:** Phase 12
**Plans:** 6/6 plans complete

Plans:

- [x] 13-01-PLAN.md — Two SQL migrations: (1) DROP all existing RLS + CREATE role_permissions table + 52-row seed + all new policies; (2) RPC role guards for process_payment_atomic/process_refund/deplete_for_order_item/add_combo_to_tab (Wave 1) (RBAC13-01, RBAC13-02, RBAC13-03, RBAC13-04, RBAC13-05, RBAC13-06) — completed 2026-04-28
- [x] 13-02-PLAN.md — [BLOCKING] supabase db push + manual supabase.types.ts transcription for role_permissions (Wave 2) (RBAC13-01, RBAC13-02) — completed 2026-04-28
- [x] 13-03-PLAN.md — domain.ts RolePermissionSchema + entities/rbac/ FSD slice (types.ts, queries.ts with useRolePermissions Map hook, model/index.ts, index.ts) + 3 unit tests (Wave 3) (RBAC13-02, RBAC13-08) — completed 2026-04-28
- [x] 13-04-PLAN.md — features/toggle-permission/ useMutationTogglePermission (INSERT/DELETE on role_permissions, invalidates rbacKeys) (Wave 4) (RBAC13-07) — completed 2026-04-28
- [x] 13-05-PLAN.md — widgets/RBACDashboard/ PermissionMatrix component (22×4 Switch grid) + RBACDashboard.tsx extended with two-panel layout (Wave 5) (RBAC13-07, RBAC13-08) — completed 2026-04-28
- [x] 13-06-PLAN.md — E2E T-RP-01 through T-RP-06 in 09-rbac.spec.ts + unit test suite green + human sign-off checkpoint (Wave 6) (RBAC13-03, RBAC13-04, RBAC13-05, RBAC13-06, RBAC13-07, RBAC13-08, RBAC13-09) — completed 2026-04-28

**Success Criteria**:

1. role_permissions table created with 52-row seed (bartender=9, manager=17, admin=22, kitchen=4)
2. All existing RLS policies replaced with get_user_role() + EXISTS subquery variants
3. Kitchen role correctly scoped: SELECT on tabs/orders/order_items/ingredients/stock_movements/shifts (own only); INSERT/UPDATE on shifts + prep_productions
4. rappi_orders scoped to bartender+ (replaces broken tenant_id check)
5. process_payment_atomic blocked for kitchen via p_staff_id role check
6. process_refund uses get_user_role() guard (manager+ only, standardized)
7. /rbac page shows Permission Matrix (22×4 grid); admin can toggle rows
8. E2E T-RP-01 through T-RP-03 pass in 09-rbac.spec.ts
9. npm run test passes (no regressions)

---

### Phase 14: Audit Logs Table

**Goal:** Add a first-class `audit_logs` table capturing every domain mutation with before/after JSON snapshots, actor, action label, entity type/id, terminal id, source, and timestamp. Wire it into all sensitive Supabase Edge Functions and SECURITY DEFINER RPCs via a single `record_audit` helper. Surface a manager+ `/audit` page with filters, pagination, and JSON-diff viewer. Replace logger-only forensics path with a durable, append-only compliance source.
**Requirements:** TBD (POS-COMPARISON.md §15)
**Depends on:** Phase 13
**Plans:** 14/14 plans complete

Plans:

- [x] 14-01-PLAN.md — [BLOCKING] Verify live remote state: audit_logs/record_audit + void-order edge fn + must_change_pin (Wave 0) (SC1, SC2)
- [x] 14-02-PLAN.md — record_audit +p_terminal_id/+p_user_id migration + _shared/audit.ts actorId + RPC-coverage test scaffold (Wave 1) (SC1, SC4, SC5)
- [x] 14-03-PLAN.md — Wire transfer_tab (tab.transfer) + record_stock_movement (inventory.manual_adjust) + terminal_id call sites (Wave 2) (SC3)
- [x] 14-04-PLAN.md — New caja_open + produce_prep_batch SECURITY DEFINER RPCs + rewire hooks (Wave 2) (SC3)
- [x] 14-05-PLAN.md — New close_tab RPC (Phase-15 version guard preserved) + rewire useMutationUpdateTabStatus (Wave 2) (SC3)
- [x] 14-06-PLAN.md — Client-side record_audit for permission.toggle + staff.role_change (Wave 2) (SC3)
- [x] 14-07-PLAN.md — Build/recover void-order edge fn + recordAudit(order.void) (Wave 2) (SC4)
- [x] 14-08-PLAN.md — Wire create-staff + settings-restore recordAudit + staff.create enum + edge-coverage test (Wave 2) (SC4, SC5)
- [x] 14-09-PLAN.md — force_pin_change backend: must_change_pin column + force_pin_change + clear_must_change_pin RPCs (Wave 2) (SC3)
- [x] 14-10-PLAN.md — view_audit_log RBAC + AuditRoute guard + HomeDashboard tile fix + seed migration (Wave 2) (SC7)
- [x] 14-11-PLAN.md — widgets/AuditLogTable (filter bar + table + diff Sheet) + PostgREST search-injection fix (Wave 2) (SC6, SC7, SC9)
- [x] 14-12-PLAN.md — force-pin-change frontend: StaffDashboard trigger + PINLoginForm forced-change phase (Wave 3) (SC3)
- [x] 14-13-PLAN.md — pages/audit + /audit route + append-only RLS denial test (Wave 3) (SC2, SC6, SC7)
- [x] 14-14-PLAN.md — [BLOCKING] db push + edge deploy + E2E order.void restore (D-07) + verification gate (Wave 4) (SC1, SC8)

**Success Criteria:**

1. `audit_logs` table + `record_audit` SECURITY DEFINER helper migrated to remote Supabase
2. Append-only RLS: INSERT via record_audit only; SELECT manager+; no UPDATE/DELETE
3. All sensitive RPCs (process_payment, process_refund, void_order, close_tab, transfer_tab, caja_open/close, produce_prep_batch, update_role_permission, force_pin_change, manual_stock_movement, etc.) call `record_audit` post-mutation
4. Sensitive Edge Functions call recordAudit via `_shared/audit.ts`
5. Action-label enum in `shared/lib/audit-actions.ts` (Zod literal union); CI grep test asserts every record_audit call uses an enumerated action
6. `/audit` page (manager+) with filters (action, entity_type, actor, date range, free text) + infinite scroll (page size 50) + JSON-diff viewer (custom `shared/lib/json-diff.ts`)
7. `entities/audit-log/` FSD slice + `widgets/AuditLogTable/` + `pages/audit/index.tsx` + `AuditRoute` guard
8. E2E `38-audit-logs.spec.ts` covers payment/refund/void → entry visible; bartender RBAC redirect from /audit
9. `AUDIT_WRITE_FAILED` added to AppError union; payload >64KB truncated with `_truncated: true`

### Phase 15: Tabs Version (Optimistic Concurrency)

**Goal:** Add `version int` column to `tabs`, `pool_sessions`, `caja_sessions`. Every mutation RPC accepts `p_expected_version` and bumps version on success; mismatch raises `STALE_VERSION` (SQLSTATE `P0V01`). Frontend mutation hooks read cached version, surface 'Updated by another terminal — please retry' toast on conflict, invalidate the entity query, and write `conflict.stale_version` to audit_logs. Offline queue replay drops stale actions with summary toast + audit row.
**Requirements:** TBD (POS-COMPARISON.md §15) — phase scope locked in 15-CONTEXT.md (D-01..D-19)
**Depends on:** Phase 14
**Plans:** 6/6 plans complete

Plans:

- [x] 15-01-PLAN.md — Migration (version columns + bump_version_on_update trigger on 3 tables) + result.ts STALE_VERSION/NOT_FOUND_VERSIONED + SQLSTATE P0V01/P0V02 mapping (Wave 1) (D-01, D-02, D-06, D-13, D-18) ✓ 2026-04-28
- [x] 15-02-PLAN.md — Group A RPC version guards (process_payment_atomic + create_order_with_items): p_expected_version int LAST + FOR UPDATE guard raising P0V01/P0V02 + version=version+1 on every successful UPDATE branch; Group B (9 hook-side paths) deferred to 15-03 per D-04/D-05/D-14 revised (Wave 2) ✓ 2026-04-28
- [x] 15-03-PLAN.md — TanStack Query mutation hooks: handleVersionError helper @shared/lib + VersionConflictToast Storybook + version-aware useMutationAddOrder (Group A p_expected_version) + Group B `.eq('version', expected)` on tabs/pool_sessions/caja_sessions for useMutationUpdateTabStatus, useMutationRecordTabPayment(close), useMutationStopSession, useMutationCloseCaja(pre-RPC probe); 1123/1123 tests green; feature-layer hooks (close-tab, transfer-tab, void-order, refund, combo, assign-pool) + process_payment edge envelope deferred to follow-up (Rule 4) (Wave 3) (D-07, D-08, D-09, D-15, D-17) ✓ 2026-04-28
- [x] 15-04-PLAN.md — OfflineAction.expectedVersion + OfflineQueueProcessor STALE_VERSION/NOT_FOUND_VERSIONED drop + summary toast + offline.discarded_stale audit; OfflineActionSchema (Zod) + locked 4-literal enum in domain.ts; persist v2 migrate (legacy queues default expectedVersion=0, drop unknown types); 4 enqueue call sites updated; 8 new tests (3 offline-summary + 5 OfflineQueueProcessor); 1131/1131 tests pass (Wave 4) (D-11, D-12, D-16) ✓ 2026-04-28
- [x] 15-05-PLAN.md — [BLOCKING] supabase db push (Wave 5)
- [x] 15-06-PLAN.md — Tests: fast-check property test + per-RPC integration test (11 RPCs) + Playwright 39-concurrent-edits.spec.ts + verification gate (Wave 6) (D-19)

**Success Criteria:**

1. `version` column on tabs/pool_sessions/caja_sessions; `bump_version_on_update` trigger enforces +1 delta
2. Custom SQLSTATE `P0V01`=STALE_VERSION + `P0V02`=NOT_FOUND_VERSIONED reserved (D-18)
3. All 11 mutation RPCs accept `p_expected_version` and bump version on success
4. Frontend hooks read cached version; STALE_VERSION → invalidate + toast + record_audit
5. Offline queue drops stale actions with summary toast + audit row
6. fast-check property + per-RPC integration + Playwright 39-concurrent-edits.spec.ts all green

---

### Phase 16: Kitchen/Bar Split Routing

**Goal:** Add a `category.routing` enum (`KITCHEN | BAR | NONE`) so order items route to the correct prep station. Ship a new `/kds-bar` page (bartender+) mirroring the existing kitchen KDS, and a `RoutingBadge` widget so staff can see at a glance where an item is prepped.
**Requirements:** TBD (POS-COMPARISON.md §16 — source doc no longer present; scope locked in 16-CONTEXT.md)
**Depends on:** Phase 14
**Plans:** 7/7 plans complete

Plans:

- [x] 16-01-PLAN.md — Schema + type contract: CategoryRouting enum, CategorySchema.routing, migration file, supabase.types.ts
- [x] 16-02-PLAN.md — [BLOCKING] supabase db push (apply routing migration to live DB) + confirm types
- [x] 16-03-PLAN.md — RBAC view_kds_bar action + RoutingBadge shared/ui primitive + story
- [x] 16-04-PLAN.md — Data-layer sweep: category queries + ModifierSheet fallback + pre-cheque filter → routing
- [x] 16-05-PLAN.md — KDS routing end-to-end: useKdsItems(routing), KdsBoard prop + RoutingBadge cards, /kds-bar route + page
- [x] 16-06-PLAN.md — Category routing selector + tree badge + persistence + HomeDashboard /kds-bar tile
- [x] 16-07-PLAN.md — E2E 40-kds-bar spec + seed helper migration + regression gate (typecheck/lint/unit) + CLAUDE.md docs

**Success Criteria:**

1. `category.routing` enum column added (`KITCHEN | BAR | NONE`), migrated with a sane default for existing categories
2. `/kds-bar` page renders bar-routed order items, gated to bartender+ (mirrors `/kitchen-prep` page pattern)
3. `RoutingBadge` widget displays routing on product/category UI
4. Existing kitchen KDS flow unaffected by the new routing field

---

### Phase 17: Modifier → Inventory Rules

**Goal:** Let modifiers (e.g. "extra cheese", "no ice") drive inventory depletion. Add a `modifier_inventory_rules` join table, extend the `deplete_for_order_item` RPC to account for selected modifiers, and add an admin UI inside `manage-modifier-groups` to configure the rules.
**Requirements:** TBD (POS-COMPARISON.md §17 — source doc no longer present; scope locked in 17-CONTEXT.md)
**Depends on:** Phase 14
**Plans:** 5/5 plans complete

Plans:

- [x] 17-01-PLAN.md — Zod schema (ModifierInventoryRuleSchema) + computeModifierDepletion helper + Wave-0 tests (Wave 1)
- [x] 17-02-PLAN.md — DB migrations: modifier_inventory_rules table + RLS + deplete_for_order_item v3 modifier loop (Wave 1)
- [x] 17-03-PLAN.md — [BLOCKING] supabase db push + supabase.types.ts extension (Wave 2)
- [x] 17-04-PLAN.md — entities/modifier-inventory-rule slice + depletion integration cases I5/I6 (Wave 3)
- [x] 17-05-PLAN.md — features/manage-modifier-inventory-rules dialog + CatalogModifiersTab wiring + UAT (Wave 4)

**Success Criteria:**

1. `modifier_inventory_rules` table maps modifier options to ingredient deltas
2. `deplete_for_order_item` RPC applies modifier-driven deltas atomically alongside base recipe depletion
3. Admin UI inside `manage-modifier-groups` lets managers configure per-modifier inventory rules
4. Existing recipe-only depletion (no modifiers selected) behavior unchanged

---

### Phase 18: Split Payment (Multi-Method)

**Goal:** Allow closing a single tab with up to 4 different payment methods in one checkout (e.g. half cash, half card). Add `payment_group_id` + `split_index` to `payments`, and extend `PaymentPane` with a multi-row UI.
**Requirements:** SC-1, SC-2, SC-3, SC-4 (ROADMAP §Phase 18 success criteria; scope locked in 18-CONTEXT.md, source doc POS-COMPARISON.md §18 no longer present)
**Depends on:** Phase 14
**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 18-01-PLAN.md — Domain/contract layer: SplitPaymentLegSchema + ProcessSplitPayment schemas + callProcessSplitPayment + processSplitPayment wrapper + unit tests (Wave 1) (SC-2)
- [x] 18-02-PLAN.md — Migration: payments +payment_group_id/split_index columns + process_split_payment_atomic atomic multi-leg RPC + live integration test scaffold (Wave 1) (SC-1, SC-2)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-03-PLAN.md — [BLOCKING] supabase db push + supabase.types.ts extension (Wave 2) (SC-1)
- [x] 18-05-PLAN.md — PaymentForm split-mode: toggle + 2-4 row list + live remaining balance + per-leg receipt queue + drawer-once + RTL tests (Wave 2) (SC-3, SC-4)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-04-PLAN.md — process-split-payment edge function (mirror process-payment) + deploy + integration green gate (Wave 3) (SC-2)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18-06-PLAN.md — E2E 41-split-payment.spec.ts + regression gate + CLAUDE.md docs + human UAT sign-off (Wave 4) (SC-2, SC-3, SC-4)

**Success Criteria:**

1. `payments.payment_group_id` + `payments.split_index` columns added
2. Payment RPC accepts up to 4 method/amount rows per close, sum must equal tab total
3. `PaymentPane` UI supports adding/removing payment rows, live remaining-balance display
4. Single-method close (existing flow) continues to work unchanged

---

### Phase 19: Tip Distribution Config

**Goal:** Configure how tips are split across floor/bar/kitchen staff. Add a singleton `tip_distribution_config` (percentages) + `tip_distribution_entries` (per-caja-close allocation rows), wired into close-caja, with a Settings panel for admins.
**Requirements:** TBD (POS-COMPARISON.md §19 — source doc no longer present; scope locked in 19-CONTEXT.md)
**Depends on:** Phase 14
**Plans:** 6/6 plans complete
Plans:

**Wave 1**

- [x] 19-01-PLAN.md — Contract: SettingsKey 'tip_distribution' literal + TipDistribution Zod schemas + computeTipDistribution pure largest-remainder split (property-tested) (Wave 1) (SC-1, SC-2)
- [x] 19-02-PLAN.md — Migrations: tip_distribution_entries append-only table + close_caja_session extension (tip computation + bundled version-bump fix) + 'tip_distribution.compute' audit action + live integration scaffold (Wave 1) (SC-2, SC-4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md — [BLOCKING] supabase db push + supabase.types.ts extension + live integration green gate (Wave 2) (SC-2, SC-4)
- [x] 19-04-PLAN.md — Entity layer: settings tipDistribution snapshot/write union + caja useTipDistributionEntry read hook (Wave 2) (SC-1, SC-4)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-05-PLAN.md — UI: 'Tip Split' admin Settings tab (warn-but-allow, D-01/D-05) + TipBucketDistributionPanel Reports tab (D-06), per-staff report untouched (D-07) (Wave 3) (SC-1, SC-3, SC-4)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-06-PLAN.md — E2E 42-tip-distribution.spec.ts + regression gate + CLAUDE.md docs + human UAT sign-off (Wave 4) (SC-3, SC-4)

**Success Criteria:**

1. `tip_distribution_config` singleton row (floor/bar/kitchen %) with admin-only write
2. `tip_distribution_entries` recorded per caja-close, allocations sum to total tips collected
3. Settings panel lets admin adjust the 3-way split percentages
4. Close-caja report reflects the computed distribution

---

### Phase 20: Promotions Engine

**Goal:** Ship a promotions engine — `promotions` + `applied_promotions` tables and an `evaluate_promotions` RPC supporting happy-hour time windows, item/category/pool-time targeting, and auto-apply at order time. Settings → Promotions admin UI to manage them.
**Requirements:** TBD (POS-COMPARISON.md §20 — source doc no longer present; scope locked in 20-CONTEXT.md)
**Depends on:** Phase 14
**Plans:** 11/11 plans complete

Plans:

- [x] 20-01-PLAN.md — promotions + promotion_availability schema + is_promotion_available (SC-1)
- [x] 20-02-PLAN.md — promotion Zod schemas + promotion.apply audit action + entities/promotion slice
- [x] 20-03-PLAN.md — applied_promotions + evaluate_promotions_for_item + create_order_with_items v3 (SC-2/SC-3)
- [x] 20-04-PLAN.md — Settings → Promotions admin UI (SC-4)
- [x] 20-05-PLAN.md — pool-time promotions: pool_grant branch + stop_pool_session RPC (D-05)
- [x] 20-06-PLAN.md — HH→promotions data migration (D-07) + BLOCKING schema push + types
- [x] 20-07-PLAN.md — client pricing rewire (send basePrice) + Active Promotions banner
- [x] 20-08-PLAN.md — pool client rewire (useMutationStopSession → stop_pool_session)
- [x] 20-09-PLAN.md — D-07 parity gate + e2e/43-promotions + BLOCKING UAT
- [x] 20-10-PLAN.md — drop happy_hour columns + retire HH admin editing
- [x] 20-11-PLAN.md — retire client HH calc path (resolveProductPrice/isHappyHourActive)

**Success Criteria:**

1. `promotions` table supports HH windows + item/category/pool-time targeting rules
2. `applied_promotions` records which promotion applied to which order/tab
3. `evaluate_promotions` RPC auto-applies eligible promotions atomically at order time
4. Settings → Promotions admin UI: create/edit/disable promotions

---

### Phase 21: i18n Multi-Language

**Goal:** Add multi-language support via `react-i18next`, with `es-MX`/`en-US` catalogs, a `profiles.locale` preference, and an ESLint rule banning hard-coded UI strings going forward.
**Requirements:** TBD (POS-COMPARISON.md §21 — source doc no longer present; scope locked in 21-CONTEXT.md)
**Depends on:** —
**Plans:** Not yet planned

**Success Criteria:**

1. `react-i18next` wired with `es-MX` and `en-US` catalogs
2. `profiles.locale` column drives per-user language preference
3. Custom ESLint rule flags new hard-coded (non-translated) UI strings
4. Existing UI strings migrated to catalogs without visual regression

---

### Phase 22: Edit Paid Ticket + History

**Goal:** Allow managers to edit an already-paid ticket via a whitelisted-field `edit_paid_tab` RPC (manager PIN + mandatory reason), with an `EditPaidTabDialog` and a `/edit-history` view to audit changes.
**Requirements:** TBD (POS-COMPARISON.md §22 — source doc no longer present; scope locked in 22-CONTEXT.md)
**Depends on:** Phase 14, Phase 15
**Plans:** Not yet planned

**Success Criteria:**

1. `edit_paid_tab` RPC restricts edits to a whitelisted field set, requires manager PIN + reason, uses `p_expected_version` per Phase 15 pattern
2. Every edit writes an `audit_logs` row (Phase 14) with before/after diff
3. `EditPaidTabDialog` UI: manager PIN gate → field edit → reason → confirm
4. `/edit-history` view lists edits with diff viewer (reuses Phase 14 `JsonDiffViewer`)

---

### Phase 23: Reopen Closed Ticket

**Goal:** Let managers reopen a closed ticket via a `reopen_tab` RPC, introducing a `reopened_void` payment status, offsetting caja entries, and a cap (24h window, max 2 reopens per tab).
**Requirements:** TBD (POS-COMPARISON.md §23 — source doc no longer present; scope locked in 23-CONTEXT.md)
**Depends on:** Phase 14, Phase 15
**Plans:** Not yet planned

**Success Criteria:**

1. `reopen_tab` RPC flips a closed tab back to open, marks original payment(s) `reopened_void`, uses `p_expected_version`
2. Caja gets an offsetting entry so totals stay reconciled after reopen
3. Reopen blocked outside a 24h window or after 2 prior reopens on the same tab
4. Every reopen writes an `audit_logs` row (Phase 14)

---

### Phase 24: Operational Reports Suite + CSV

**Goal:** Add 6 new reporting RPCs (peak-hours, voids, deletions ×2, modifier popularity, payment methods, charts-data), a generic CSV export action, and Recharts-based report widgets.
**Requirements:** TBD (POS-COMPARISON.md §24 — source doc no longer present; scope locked in 24-CONTEXT.md)
**Depends on:** Phase 14
**Plans:** Not yet planned

**Success Criteria:**

1. 6 new report RPCs shipped: peak-hours, voids, deletions (×2 variants), modifier popularity, payment methods, charts-data
2. Generic CSV export action reusable across all new (and existing) report widgets
3. Recharts widgets render each new report on the Reports page
4. Reports page performance acceptable for a full day's data (no unbounded queries)

---

### Phase 25: Receipt Item Grouping (2-Level)

**Goal:** Group receipt line items 2 levels deep (e.g. category → item) across every surface that prints or displays them — extend `receipt-format.ts`, the Tauri Rust printer payload, PDF export, and the KDS card — all sharing one `groupOrderItemsForReceipt` function.
**Requirements:** TBD (POS-COMPARISON.md §25 — source doc no longer present; scope locked in 25-CONTEXT.md)
**Depends on:** —
**Plans:** Not yet planned

**Success Criteria:**

1. `groupOrderItemsForReceipt` shared utility implements 2-level grouping
2. `receipt-format.ts`, Tauri Rust printer payload, PDF export, and KDS card all consume the shared utility (no duplicated grouping logic)
3. Existing single-level receipts remain visually correct for orders with no natural grouping
4. Print/PDF/KDS outputs verified consistent against the same order data

---

### Phase 26: Floating Tables (`is_temp`)

**Goal:** Generalize `pool_tables` into a broader `resources` concept with a `FLOATING` type for temporary/ad-hoc tables (`is_temp`), an auto-deactivate trigger when no longer needed, and an auto-create flow from the waitlist.
**Requirements:** TBD (POS-COMPARISON.md §26 — source doc no longer present; scope locked in 26-CONTEXT.md)
**Depends on:** —
**Plans:** Not yet planned

**Success Criteria:**

1. `resources` generalization supports `FLOATING` type with `is_temp` flag, without breaking existing `pool_tables` consumers
2. Auto-deactivate trigger retires floating tables once no longer in use
3. Waitlist seating flow can auto-create a floating table when no fixed table is free
4. Existing pool-table timer/billing flows unaffected

---

### Phase 27: One-Shot Inventory (Cigarette-Box Pattern)

**Goal:** Support "open one unit, sell individually" inventory (e.g. cigarette box opened → loose sticks) via an `open_units` table, a `consume_open_unit` SQL function, an admin Open-Units tab, and reportable lifecycle tracking.
**Requirements:** TBD (POS-COMPARISON.md §27 — source doc no longer present; scope locked in 27-CONTEXT.md)
**Depends on:** Phase 14, Phase 17
**Plans:** Not yet planned

**Success Criteria:**

1. `open_units` table tracks opened-unit state (remaining count, parent product, opened-by/when)
2. `consume_open_unit` SQL function atomically decrements remaining count, auto-transitions to a new unit when exhausted
3. Admin Open-Units tab shows currently open units and lets staff manually open a new one
4. Lifecycle (opened → depleting → exhausted) reportable via `audit_logs` (Phase 14)

---

### Phase 28: Money Formatter Utility

**Goal:** Consolidate money formatting into one `shared/lib/format.ts` (`formatMoney` / `parseMoneyInput` / `formatPercent`) backed by `Intl.NumberFormat`, respecting the Phase 21 locale, with a codemod to migrate existing call sites and an ESLint rule (`no-raw-money-format`) to prevent regressions.
**Requirements:** TBD (POS-COMPARISON.md §28 — source doc no longer present; scope locked in 28-CONTEXT.md)
**Depends on:** Phase 21
**Plans:** Not yet planned

**Success Criteria:**

1. `shared/lib/format.ts` exports `formatMoney`, `parseMoneyInput`, `formatPercent`, all `Intl.NumberFormat`-backed and locale-aware (Phase 21)
2. Codemod migrates existing ad-hoc money-formatting call sites to the shared utility
3. Custom ESLint rule `no-raw-money-format` blocks new ad-hoc formatting
4. No visible formatting regressions across POS, reports, and receipts

---

### Phase 29: UI Drift Audit

**Goal:** Produce a complete, file-mapped inventory of every design-system violation (raw `<button>`/`<input>` elements, hardcoded hex/rgb colors, arbitrary-value Tailwind spacing classes) across all 17 routes in `pages/`, `widgets/`, `features/`, so every subsequent fix phase has a concrete backlog to work from. Read-only — no application code is modified in this phase.
**Requirements:** AUDIT-01, AUDIT-02
**Depends on:** — (first phase of v2.2, independent of v2.1 phases 20-28)
**Plans:** 1/1 plans complete

Plans:

- [x] 29-01-PLAN.md — audit-ui-drift.ts scanner (filtered fs walk + 4 violation regex scans + router/CLAUDE.md route cross-check) + committed DRIFT-AUDIT.md backlog (Wave 1) (AUDIT-01, AUDIT-02)

**Success Criteria:**

1. A drift-audit script scans `pages/`, `widgets/`, `features/` and reports every raw `<button>`/`<input>` element, hardcoded hex/rgb color value, and arbitrary-value Tailwind class (e.g. `p-[13px]`), each attributed to a specific file
2. Audit output is a checklist/backlog usable to scope Phases 30-33 without further investigation
3. The audit's route count (17) is cross-checked against `CLAUDE.md`'s routes table, confirming the staleness that `SHELL-03` fixes in Phase 30
4. No application code under `src/` is modified — the audit is read-only tooling only (e.g. lives in `scripts/`)

---

### Phase 30: Shared Shell & Primitive Extension

**Goal:** Every one of the 17 routes uses a single canonical layout shell instead of ad-hoc per-page wrappers; dead navigation code is deleted rather than resurrected; `CLAUDE.md` matches the router's actual routes. This is the lowest-blast-radius change in the milestone (isolated layout-wrapper swap, not a deep component change) so it lands before the risk-tiered page sweeps and everything downstream builds on it.
**Requirements:** SHELL-01, SHELL-02, SHELL-03
**Depends on:** Phase 29
**Plans:** 5/5 plans complete
**UI hint**: yes

Plans:

- [x] 30-01-PLAN.md — Extend PageContainer/SectionHeader with backTo/backLabel + Wave-0 PageContainer.test.tsx (Wave 1) (SHELL-01)
- [x] 30-02-PLAN.md — Pattern B: swap BackToHomeButton -> backTo on the 7 existing-PageContainer pages (kds, kds-bar, kitchen-prep, pool-tables, rappi, rbac, waitlist) (Wave 2) (SHELL-01)
- [x] 30-03-PLAN.md — Pattern A: first-time PageContainer adoption for audit, settings, staff, inventory, reports (Wave 2) (SHELL-01)
- [x] 30-04-PLAN.md — Pattern C+D: full-bleed className override for pos/payments + corrected backTo=/pool-tables for pool-table-status (Wave 2) (SHELL-01)
- [x] 30-05-PLAN.md — Delete BackToHomeButton/AppShell/AppNav + barrel exports + CLAUDE.md routes-table fix (17 rows) + phase gate (Wave 3) (SHELL-01, SHELL-02, SHELL-03)

**Success Criteria:**

1. `PageContainer` is extended with `backTo`/`backLabel` props and wraps all 17 routes; zero ad-hoc per-page layout wrappers remain
2. `AppShell` and `AppNav` (zero real consumers) are deleted from the codebase, not resurrected
3. `CLAUDE.md`'s routes table lists all 17 actually-registered routes, matching `router.tsx`
4. Full-repo `npm run typecheck` and `npm run lint` pass after the shell swap, landed as an isolated commit

---

### Phase 31: Component, Token & Spacing Consistency Sweep

**Goal:** Non-payment pages (login, home, settings, staff, rbac, audit, waitlist, rappi, reports, pool-tables, inventory, kitchen-prep, kds, kds-bar) use the correct `shared/ui` primitives instead of raw markup, and existing Tailwind color/spacing tokens instead of hardcoded values — proving the fix pattern on lower-risk surfaces before it's applied to payment-critical pages in Phase 33.
**Requirements:** TOKEN-01, TOKEN-02, COMPONENT-01, COMPONENT-02, COMPONENT-03
**Depends on:** Phase 30
**Plans:** 7/7 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 31-01-PLAN.md — Wave 1: agent-chat FAB/chips/mic-send + 3 text-link buttons -> Button (COMPONENT-01, D-03)
- [x] 31-02-PLAN.md — Wave 1: card-tile selectors + HomeDashboard/PoolTableGrid load-bearing chrome + AuditLogTable sr-only + ProductSalesPanel pills -> Button (COMPONENT-01)
- [x] 31-03-PLAN.md — Wave 1: SplitTabSheet 3 buttons (D-02) + ComboAvailabilityEditor day-chip + time-inputs FormField + CategoryTreeEditor chevron/color/hex (COMPONENT-01/02, TOKEN-01)
- [x] 31-04-PLAN.md — Wave 1: TableStatusPanel row-remove + duplicate back-button deletion (COMPONENT-03/D-09) + CategoryForm/ModifierSheet hex exemption comments (COMPONENT-01/02/03, TOKEN-01)
- [x] 31-05-PLAN.md — Wave 1: ModifierGroupEditor + HardwareSettingsTab checkbox swaps -> Checkbox (COMPONENT-02, D-04)
- [x] 31-06-PLAN.md — Wave 1: AuditLogFilterBar date inputs FormField + atomic e2e/38 selector fix + InventoryPagePanel signed-number FormField (COMPONENT-02, D-05/D-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-07-PLAN.md — Wave 2: regression gate + TOKEN-02 zero-violation verification + phase-wide conformance greps

**Success Criteria:**

1. Raw `<button>` elements outside `shared/ui` are replaced with `POSButton` (or the correct shared primitive)
2. Raw `<input>` elements outside `shared/ui` are replaced with the correct shared form primitive (`FormField`, `MoneyInput`, etc.), except documented signed-delta opt-outs
3. Duplicate one-off components shadowing an existing `shared/ui` primitive (e.g. the `pool-table-status` hand-rolled back button) are removed
4. No hardcoded hex/rgb color values remain in swept files — all use existing Tailwind CSS-variable tokens (`--background`, `--primary`, `--pos-accent`, `--pos-danger`, etc.)
5. No arbitrary-value spacing classes (e.g. `p-[13px]`) remain in swept files — all use the existing Tailwind spacing scale

---

### Phase 32: Touch Target & Focus-Visible Sweep

**Goal:** Every interactive element on operational and realtime pages (pool-tables, pool-table-status, inventory, kitchen-prep, kds, kds-bar) meets the app's touch-target floor and shows a visible, keyboard-navigable focus state — sizing/contrast-only changes, no control reordering that would break muscle memory.
**Requirements:** TOUCH-01, TOUCH-02, TOUCH-03, FOCUS-01, FOCUS-02, FOCUS-03
**Depends on:** Phase 31
**Plans:** 3/3 plans complete
**UI hint**: yes

Plans:

- [x] 32-01-PLAN.md — Shared primitives: focusEmphasis CVA variant + ConfirmDialog confirmClassName passthrough + 44px SearchInput clear button + unit scaffolds (Wave 1) (FOCUS-01, FOCUS-02, TOUCH-01, TOUCH-02)
- [x] 32-02-PLAN.md — Touch-target rollout: raw/icon/native Button conversions across pool-tables/kds/inventory + 8px grid-gap audit (Wave 1) (TOUCH-01, TOUCH-02, TOUCH-03)
- [x] 32-03-PLAN.md — Destructive 72px/emphasized-ring wiring (Stop-session + Stop-and-Move confirms) + e2e/44-focus-tab-order.spec.ts + CLAUDE.md docs (Wave 2) (TOUCH-02, FOCUS-02, FOCUS-03)

**Success Criteria:**

1. All interactive elements meet a 44px minimum touch target (app floor, above WCAG's 24px legal minimum)
2. Frequent-action controls (add item, confirm) use the 56px `POSButton` size; critical/rare high-stakes actions (process payment, void order, close tab) use the 72px size
3. Adjacent touch targets in grids (product grid, quantity steppers) maintain adequate spacing to avoid mis-taps
4. Every interactive element has a visible `focus-visible` state using the `--ring` token; primary action buttons use a higher-contrast/thicker ring than the shadcn default
5. Tab order across forms and keypad/search inputs (`PINKeypad`, `SearchInput`) is verified sane for keyboard/barcode-scanner input

---

### Phase 33: Payment-Critical Page Sweep (Isolated)

**Goal:** Standardize POS, payments, split-payment, refund, and tip-distribution surfaces to the shell/token/component/touch/focus conventions established in Phases 30-32 — markup/class-level swaps only, zero prop/handler/validation behavior change, one page/widget per PR, verified against the existing E2E suite.
**Requirements:** COMPONENT-04
**Depends on:** Phase 32
**Plans:** 8 plans (2 waves)
**UI hint**: yes

Plans:

- [ ] 33-01-PLAN.md — pos/index.tsx panel toggle raw button -> POSButton ghost/44px (Wave 1) (COMPONENT-04)
- [ ] 33-02-PLAN.md — CartPanel Clear Cart raw button -> POSButton ghost/44px (Wave 1) (COMPONENT-04)
- [ ] 33-03-PLAN.md — PaymentForm: Process-Payment + Remove-payment-N focusEmphasis=high, Reset-to-computed -> POSButton (Wave 1) (COMPONENT-04)
- [ ] 33-04-PLAN.md — TabPaymentCard root button -> POSButton large (visual-parity overrides) (Wave 1) (COMPONENT-04)
- [ ] 33-05-PLAN.md — RefundSheet footer Button -> POSButton (Request approval xl/high, Close refund large) (Wave 1) (COMPONENT-04)
- [ ] 33-06-PLAN.md — SplitTabSheet: Confirm Split + Remove check xl/high, Add check/Add person -> POSButton large (Wave 1) (COMPONENT-04)
- [ ] 33-07-PLAN.md — VoidOrderDialog confirmClassName 72px/high-ring (Wave 1) (COMPONENT-04)
- [ ] 33-08-PLAN.md — Phase gate: static+unit regression + 5 required E2E gate specs + CLAUDE.md (Wave 2) (COMPONENT-04)

**Success Criteria:**

1. POS, payments, `PaymentModal`, `PaymentPane`, `TabDrawer`, and refund/tip-distribution surfaces are visually standardized (shell/token/component/touch/focus) with zero prop/handler/validation changes
2. Each payment-critical surface lands as its own isolated commit/PR, never combined with a shared-primitive change
3. `05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, and `09-rbac` E2E specs pass unchanged after every payment-surface commit

---

### Phase 33.1: E2E Test/RBAC Drift Fixes (INSERTED)

**Goal:** Fix pre-existing test/seed drift surfaced by Phase 33 verification — none of the following files are in Phase 33's scope:

- Toast-stacking timing bug in `src/app/App.tsx`'s Toaster causing `e2e/06-transfer.spec.ts` T4/T5 to fail
- Aria-label collision in `src/widgets/OrderPanel/ActiveTabSelector.tsx`/`OrderPanel.tsx` causing `e2e/09-rbac.spec.ts` T7 to fail
- `PermissionMatrix.tsx` switch-count/action-set drift (seed vs. test expectations) causing `e2e/09-rbac.spec.ts` T-RP-01/T-RP-02 to fail

Closes Phase 33's outstanding Success Criterion 3 gap (see `.planning/phases/33-payment-critical-page-sweep-isolated/33-VERIFICATION.md`).
**Requirements**: TBD (closes COMPONENT-04's E2E-gate clause — annotated in REQUIREMENTS.md per D-08, no new ID)
**Depends on:** Phase 33
**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 33.1-01-PLAN.md — Land the 3 drift fixes: 06-transfer T4 exact-toast text (D-01/D-02), ActiveTabSelector static aria-label + OrderPanel.tsx deletion (D-04/D-05/D-06), 09-rbac 88→96 count + exact locator (D-07)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 33.1-02-PLAN.md — Phase gate (06-transfer x2 isolation + 5-spec SC3 gate + full unit suite, D-03) and COMPONENT-04 traceability annotation (D-08)

### Phase 34: Visual Regression Baseline

**Goal:** Stand up a Playwright visual-regression suite, isolated from the functional E2E config, and capture screenshot baselines for all 17 routes only now that the audit/shell/token/component/touch/focus fixes (Phases 29-33) are complete — a pre-fix baseline would have frozen the current inconsistencies.
**Requirements:** VISUAL-01, VISUAL-02, VISUAL-03
**Depends on:** Phase 33
**Plans:** 2/2 plans complete

Plans:

- [x] 34-01-PLAN.md — Wave 0 harness: isolated `playwright.visual.config.ts` + functional-config `testIgnore` + `test:e2e:visual` script + `.gitignore` snapshot entry + 2 mask test-hooks (`live-time-display`, `kds-board`) (VISUAL-01, VISUAL-03)
- [x] 34-02-PLAN.md — Wave 1: `e2e/visual/45-visual-baseline.spec.ts` (17 admin routes + bartender/manager subsets, masked, denied-route URL asserts) + seed baseline + two-run zero-diff gate + human eyeball (VISUAL-02, VISUAL-03)

**Success Criteria:**

1. A second Playwright config exists (headless, bundled Chromium, no `slowMo`), isolated from the existing functional `e2e/` config
2. Screenshot baselines are captured for all 17 routes, only after Phases 30-33's fixes are complete
3. Dynamic/live regions (timers, realtime KDS boards, toasts) are masked or excluded from diffing
4. Two consecutive local runs of the visual suite produce zero unintended diffs

---

### Phase 35: Guardrails — Tokens Doc & Drift Lint

**Goal:** Document the existing design tokens and add drift-detection lint, both deferred to last because a strict rule only makes sense once the codebase already conforms — adding it earlier would fail against every pre-existing violation Phase 29 catalogued.
**Requirements:** DOCS-01, LINT-01
**Depends on:** Phase 34
**Plans:** 3 plans (3 waves)

Plans:
- [ ] 35-01-PLAN.md — DESIGN-TOKENS.md + generate-design-tokens.ts generator + docs:tokens npm script (DOCS-01) (Wave 1)
- [ ] 35-02-PLAN.md — Fix undocumented raw promotion button (D-16) + install eslint-plugin-tailwindcss@3.18.3 behind legitimacy checkpoint (LINT-01) (Wave 2)
- [ ] 35-03-PLAN.md — eslint-rules/no-ui-drift.js (5 selectors) + wire scoped rules into eslint.config.js + convert 4 Phase-31 exception sites + D-14 clean-lint gate (LINT-01) (Wave 3)

**Success Criteria:**

1. A design tokens reference doc documents the existing color/spacing/typography tokens already defined in `tailwind.config.ts` and `index.css` — no new tokens invented
2. A drift-detection lint rule (via `eslint-plugin-tailwindcss` and/or `no-restricted-syntax`) is added to the ESLint config
3. `npm run lint` passes with zero warnings against the now-conformant codebase

---

*Roadmap derived: 2026-04-23 from `.planning/feature-expansion-2026q2/sprints/` PRDs.*
*Phase 9 added: 2026-04-26 — v2.1 Auto-Update Service milestone.*
*Phase 10 added: 2026-04-27 — AI Slob Technical Debt Audit.*
*Phase 11 added: 2026-04-27 — AI Slob Technical Debt Remediation.*
*Phase 12 added: 2026-04-27 — Full RBAC Management Page.*
*Phase 13 added: 2026-04-27 — Full RBAC From Scratch.*
*Phase 15 planned: 2026-04-28 — 6 plans in 6 waves.*
*Phase 13 planned: 2026-04-27 — 6 plans in 6 waves.*

*Phase 29-35 added: 2026-07-10 — v2.2 UI Standardization milestone (risk-tiered rollout: audit -> shell/primitives -> low-risk sweep -> operational sweep -> payment-critical sweep -> visual baseline -> guardrails).*
