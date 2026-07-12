---
phase: 20-promotions-engine
verified: 2026-07-10T09:50:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full Playwright browser run of e2e/43-promotions.spec.ts (T1 admin CRUD, T2 order-time auto-apply)"
    expected: "Both tests pass end-to-end in a real browser against the live dev server"
    why_human: "Not executed in this verification session (Playwright browser automation not run); spec content was read and confirmed structurally sound and semantically correct for SC-3/SC-4. Plan 20-09's SUMMARY documents this was already explicitly waived by a human on 2026-07-10 ('Proceed on automated gates only') before authorizing the destructive column-drop in Plan 20-10 — recorded as a prior, already-made human decision, not a new open item. Listed here for completeness/traceability only; does not block phase completion given the prior documented sign-off plus this session's own live-DB integration test run (5/5 files, 18/18 tests passing against the production Supabase project) covering the same RPC surface T2 exercises through the UI."
---

# Phase 20: Promotions Engine — Verification Report

**Phase Goal:** Ship a promotions engine — `promotions` + `applied_promotions` tables and an `evaluate_promotions` RPC supporting happy-hour time windows, item/category/pool-time targeting, and auto-apply at order time. Settings → Promotions admin UI to manage them.

**Verified:** 2026-07-10T09:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification did not rely on SUMMARY.md claims. Evidence gathered directly from the codebase and the **live production Supabase project** (`shsrhxleopmovzpzqmex`), specifically:

1. Read all 9 Phase-20 migration files (`20260710000001`–`20260710000008`, `20260711000001`) directly.
2. Ran `npx vitest run src/entities/promotion/model/` against the **live remote DB** — 5/5 files, 18/18 tests pass (schema/RLS, applied-promotions RLS, evaluate-promotions RPC, pool-promotions RPC — including two cases that explicitly pass `p_skip_depletion: true`, the exact scenario the 20260710000008 fix migration targets).
3. Queried the **live DB schema directly** via the Supabase JS client (service-role key) to confirm table existence and column absence — not inferred from SUMMARY claims.
4. Ran `npm run typecheck`, `npm run lint`, `npm run test` (full suite) against the current worktree HEAD.
5. Read the client-side consumer files (`ProductGrid.tsx`, `ModifierSheet.tsx`, `ProductCard.tsx`, `SettingsTabsPanel/index.tsx`, `entities/pool-table/model/queries.ts`) directly rather than trusting SUMMARY bullet points.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `promotions` table supports HH windows + item/category/pool-time targeting rules | ✓ VERIFIED | `supabase/migrations/20260710000001_promotions_schema.sql`: `discount_type CHECK IN ('percentage','fixed_amount','fixed_price')`, `target_type CHECK IN ('item','category','pool_billing','pool_grant')`, `priority`, `is_active` all present. `promotion_availability` table (day-of-week array + start/end time/date) + `is_promotion_available()` STABLE SECURITY DEFINER evaluator (`20260710000002`) confirmed live — direct DB query via service-role client confirms `promotions` and `promotion_availability` tables exist and are queryable on the production project. |
| 2 | `applied_promotions` records which promotion applied to which order/tab | ✓ VERIFIED | `supabase/migrations/20260710000003_applied_promotions_table.sql`: `tab_id`, `order_item_id`, `pool_session_id`, `promotion_id` (ON DELETE SET NULL + `promotion_name_snapshot`), `original_amount`/`discounted_amount`, `pool_minutes_granted`/`consumed_at`. RLS: exactly 1 SELECT policy (manager/admin only), zero INSERT/UPDATE/DELETE policies (append-only by omission). Confirmed live via direct DB query (table exists, selectable). Live integration test `applied-promotions-rls.integration.test.ts` (bartender SELECT denied, manager SELECT allowed, INSERT/UPDATE/DELETE denied for all roles) passes against production. |
| 3 | `evaluate_promotions` RPC auto-applies eligible promotions atomically at order time | ✓ VERIFIED | `evaluate_promotions_for_item(uuid)` (SECURITY DEFINER): sequential-compounding CASE (percentage/fixed_amount/fixed_price) with `GREATEST(0, ROUND(...,2))` clamping, `ORDER BY priority ASC, created_at ASC, id ASC` deterministic tiebreak, combo-parent/combo-child early-exclusion (Pitfall 6), one `applied_promotions` INSERT per applied promotion. **Critically re-verified the `p_skip_depletion` bug fix**: `20260710000008_fix_promotion_skip_depletion_gate.sql` (`create_order_with_items` v4) moves the `PERFORM evaluate_promotions_for_item(...)` call OUT of the `IF NOT p_skip_depletion THEN` block into its own unconditional loop — read directly from the migration file, and confirmed live: `evaluate-promotions-rpc.integration.test.ts` and `pool-promotions-rpc.integration.test.ts` both call the RPC with `p_skip_depletion: true` and PASS against the live DB in this verification session's own test run. Pool-time billing discount (D-05a) + bonus-minute grant (D-05b): `stop_pool_session` RPC (`20260710000006`) confirmed as the sole authoritative writer of `pool_sessions.total_charge`/`billed_minutes` — `src/entities/pool-table/model/queries.ts`'s `useMutationStopSession` calls `supabase.rpc('stop_pool_session', ...)` with no raw `.update()` fallback for the charge write (raw `.update()` remains only for the unrelated `pool_tables.status` transition). |
| 4 | Settings → Promotions admin UI: create/edit/disable promotions | ✓ VERIFIED | `src/widgets/SettingsTabsPanel/index.tsx` registers `{ key: 'promotions', label: 'Promotions', render: () => <ManagePromotionsTab /> }` inside the `canManageProducts` (`manage_products` RBAC) block, alongside Combos/Products/Pool Tables. `ManagePromotionsTab.tsx` (read in full): "+ Add promotion" → opens edit dialog on a fresh draft, `PromotionBuilderForm` (name/discount type+value/target type+picker/priority/active), `PromotionAvailabilityEditor` (day/time windows), inline `Switch` for enable/disable, `ConfirmDialog`-gated delete. All four CRUD verbs (create/edit/disable/delete) are wired to real mutations (`useMutationCreatePromotion`/`useMutationUpdatePromotion`/`useMutationDeletePromotion`), not stubs. |

**Score:** 4/4 roadmap success criteria verified with direct code + live-DB evidence.

### CONTEXT.md Locked Decisions (D-01 through D-07) Cross-Check

| Decision | Status | Evidence |
|---|---|---|
| D-01 (supersede + retire client HH calc) | ✓ VERIFIED | `resolveProductPrice`/`isHappyHourActive` (both variants) confirmed deleted from `domain-helpers.ts` (zero grep matches in `src/`). `ProductCard.tsx`/`ModifierSheet.tsx` read directly — both use `product.basePrice` with no HH badge/price-resolution logic. `HappyHourBanner.tsx` repurposed into "Active Promotions" banner (cosmetic-only, `isPromotionActive` helper, explicitly documented as non-authoritative). **Caveat:** see Anti-Patterns section below — one leftover dead HH-editing control was found in `CatalogProductsTab.tsx` that Plan 20-10/20-11 did not clean up. |
| D-02 (silent auto-apply, no confirmation) | ✓ VERIFIED | `evaluate_promotions_for_item` runs inside `create_order_with_items` with no client round-trip/confirmation step; `e2e/43-promotions.spec.ts` T2 asserts "Place Order" goes straight through with no intermediate prompt. |
| D-03 (stacking, priority, sequential compounding) | ✓ VERIFIED | `ORDER BY priority ASC, created_at ASC, id ASC` + running-price CASE loop in `evaluate_promotions_for_item`, confirmed in the live migration source. |
| D-04 (3 discount shapes) | ✓ VERIFIED | `discount_type CHECK IN ('percentage','fixed_amount','fixed_price')` at the DB level, matching CASE branches in the RPC. |
| D-05 (pool-time targeting, both meanings) | ✓ VERIFIED | `target_type` includes `pool_billing` (billing-time discount, compounded inside `stop_pool_session`) and `pool_grant` (purchase-triggered minute grant, consumed by `stop_pool_session` before block-rounding) — both loops read directly from their respective migration files. |
| D-06 (admin UI models Combos pattern) | ✓ VERIFIED | `ManagePromotionsTab`/`PromotionBuilderForm`/`PromotionAvailabilityEditor` are structural clones of `ManageCombosTab`/`ComboBuilderForm`/`ComboAvailabilityEditor`, confirmed via direct file read. |
| D-07 (auto-migrate HH data, no manual re-entry) | ✓ VERIFIED (migration itself) | `20260710000007_migrate_happy_hour_data.sql` is additive, idempotent (`NOT EXISTS` guard), confirmed applied live per 20-06-SUMMARY's verification queries (promotion count parity check). Note: 20-09's own parity test found **zero live rows** currently carry migrated HH data (no HH-configured products existed on the target DB at migration time) — this is a database-state fact, not a code defect; the migration logic itself is sound and was structurally exercised via a self-contained fixture in `hh-parity.integration.test.ts` before that file's later (correct, see below) deletion. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260710000001_promotions_schema.sql` | promotions + promotion_availability + RLS | ✓ VERIFIED | Read in full; matches SC-1 exactly. Live on production (confirmed via direct query). |
| `supabase/migrations/20260710000002_is_promotion_available_fn.sql` | day/time evaluator | ✓ VERIFIED | Clone of `is_combo_available()`, `America/Mexico_City` hardcoded per project convention. |
| `supabase/migrations/20260710000003_applied_promotions_table.sql` | append-only audit table | ✓ VERIFIED | RLS confirmed SELECT-manager-only, zero write policies. |
| `supabase/migrations/20260710000004_evaluate_promotions_rpc.sql` | evaluate_promotions_for_item v1 + create_order_with_items v3 | ✓ VERIFIED | Combo exclusion, sequential compounding present. (Superseded in behavior by 000008, schema/function itself still the base definition target of subsequent `CREATE OR REPLACE`s.) |
| `supabase/migrations/20260710000005_evaluate_promotions_pool_grant.sql` | pool_grant loop (v2) | ✓ VERIFIED | Second loop appended, v1 body preserved verbatim. |
| `supabase/migrations/20260710000006_stop_pool_session_rpc.sql` | server-authoritative pool billing RPC | ✓ VERIFIED | Confirmed as sole writer in `useMutationStopSession` (client rewire, Plan 20-08). |
| `supabase/migrations/20260710000007_migrate_happy_hour_data.sql` | D-07 data migration | ✓ VERIFIED | Additive-only, idempotent. |
| `supabase/migrations/20260710000008_fix_promotion_skip_depletion_gate.sql` | decouple promo eval from p_skip_depletion | ✓ VERIFIED (live) | Read in full; unconditional promotion-evaluation loop confirmed. Live-DB test run in this session (`p_skip_depletion: true` cases) passes, proving the fix is deployed and functioning, not just committed to a file. |
| `supabase/migrations/20260711000001_drop_happy_hour_columns.sql` | drop legacy HH columns | ✓ VERIFIED (live) | Direct DB query in this session: `products.happy_hour_price`, `categories.happy_hour_start`, `categories.happy_hour_end` all return "column does not exist" on the live production project. |
| `src/features/manage-promotions/ui/{ManagePromotionsTab,PromotionBuilderForm,PromotionAvailabilityEditor}.tsx` | admin UI | ✓ VERIFIED | Read `ManagePromotionsTab.tsx` in full — real CRUD, no stubs. |
| `src/widgets/SettingsTabsPanel/index.tsx` | tab registration | ✓ VERIFIED | `promotions` key wired inside `canManageProducts` block. |
| `src/entities/pool-table/model/queries.ts` (`useMutationStopSession`) | RPC rewire | ✓ VERIFIED | `stop_pool_session` RPC call confirmed as sole billing-write path. |
| `src/widgets/OrderPanel/ProductGrid.tsx`, `ModifierSheet.tsx`, `ProductCard.tsx` | client sends/display basePrice only | ✓ VERIFIED | All three read directly; zero `resolveProductPrice` usage remains anywhere in `src/`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ManagePromotionsTab` list | `promotions` (via `usePromotions()`) | Live `promotions` table SELECT | Yes — confirmed table has real rows capability (0 currently, expected in this dev/test env — RLS-gated real query, not a hardcoded array) | ✓ FLOWING |
| `create_order_with_items` → `order_items.unit_price` | `v_running_price` | `evaluate_promotions_for_item`'s live compounding loop against `promotions`/`promotion_availability` | Yes — live integration test (`evaluate-promotions-rpc.integration.test.ts`) creates a real promotion row, calls the real RPC, and asserts the real DB-persisted `unit_price` reflects the discount | ✓ FLOWING |
| `stop_pool_session` → `pool_sessions.total_charge` | server-computed | Live `pool_tables.rate_per_hour` + `settings` + `applied_promotions` grant/discount rows | Yes — `pool-promotions-rpc.integration.test.ts` passes against live DB with deterministic billing assertions | ✓ FLOWING |

### Behavioral Spot-Checks (live, run in this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live promotion integration suite (schema/RLS/evaluate-RPC/pool-RPC) | `npx vitest run src/entities/promotion/model/` | 5 files passed, 18 tests passed (against production Supabase) | ✓ PASS |
| `p_skip_depletion:true` still evaluates promotions (the exact bug the 000008 fix migration targets) | Same run — both `evaluate-promotions-rpc.integration.test.ts` and `pool-promotions-rpc.integration.test.ts` explicitly assert with `p_skip_depletion: true` | Both pass | ✓ PASS |
| `products.happy_hour_price` column does not exist live | Direct Supabase client query (service-role) | `column products.happy_hour_price does not exist` | ✓ PASS (confirms drop) |
| `categories.happy_hour_start`/`happy_hour_end` do not exist live | Direct Supabase client query | Both: "column does not exist" | ✓ PASS (confirms drop) |
| `promotions`/`promotion_availability`/`applied_promotions` tables queryable live | Direct Supabase client query | All three return successfully (0 rows currently — clean dev state, not an error) | ✓ PASS |
| `npm run typecheck` | | 2 pre-existing, documented, unrelated errors only (`tab/model/queries.ts:780`, `agent/rag.ts:60`) — matches the baseline every Phase-20 plan has logged since Plan 20-06 | ✓ PASS (no new regressions) |
| `npm run lint` | | Exit 0 (only the pre-existing informational `eslint-plugin-boundaries` legacy-selector notice) | ✓ PASS |
| `npm run test` (full unit suite) | | 1213 passed, 1 pre-existing documented failure (`useCloseTab.test.ts:95`, unrelated to Phase 20, dates to Phase 15) | ✓ PASS (no new regressions) |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes are declared for this phase. The phase's own live-DB integration test suite (run above) serves the equivalent purpose and was executed directly rather than trusted from SUMMARY narration.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/manage-products/ui/CatalogProductsTab.tsx` | 116–130, 290–306 | Dead/misleading UI: an inline-editable "HH price" column (`ProductHappyHourCell`/`ProductHappyHourEditor`) remains live in the Settings → Products admin table. It calls `useMutationUpdateProduct({ ..., happyHourPrice })` on blur and shows a **"Happy hour price updated" success toast** — but `productUpdateToRow()` (`src/entities/product/model/queries.ts:374-388`) explicitly no longer maps `happyHourPrice` to any DB column (confirmed by direct read, comment: "Legacy HH price column no longer written (Phase 20, D-01)"). The edit therefore silently no-ops while telling the admin it succeeded. | ⚠️ Warning | Not a blocker for any of the 4 roadmap Success Criteria (the promotions engine itself is unaffected), but it directly contradicts Plan 20-11-SUMMARY.md's closing claim that Phase 20 is "fully complete... with zero lingering client HH calc code." Neither Plan 20-10 (which cleaned the sibling `CatalogCategoriesTab.tsx`) nor Plan 20-11 (which cleaned `ProductForm.tsx`, `ProductCard.tsx`, `ModifierSheet.tsx`, `TableStatusPanel`) touched this file — it was missed. Recommend a small follow-up: remove the "HH price" column from `CatalogProductsTab.tsx` (mirroring the `CategoryForm.tsx`/`CatalogCategoriesTab.tsx` cleanup already done in Plan 20-10), pointing admins at Settings → Promotions instead, consistent with the rest of the retirement work. |

No `TBD`/`FIXME`/`XXX` debt markers found in any Phase-20-touched file (migrations, `entities/promotion/`, `features/manage-promotions/`).

### Requirements Coverage

No numbered requirement IDs exist for this phase (`POS-COMPARISON.md §20` source doc absent, confirmed in both CONTEXT.md and RESEARCH.md). The roadmap's 4 Success Criteria function as the requirement set and are covered in full above (all 4 VERIFIED).

### Human Verification Required

One item is listed in frontmatter for traceability, but it does **not** block phase completion:

1. **Full Playwright browser run of `e2e/43-promotions.spec.ts`** — not executed in this verification session (this verifier does not launch a dev server/browser). The spec was read in full and is structurally/semantically sound for both SC-3 (order-time auto-apply, D-02) and SC-4 (admin CRUD). **This was already explicitly addressed by a human during Plan 20-09's execution**: the SUMMARY records "Human Approval (2026-07-10)... The human's explicit decision: 'Proceed on automated gates only'" — a documented, timestamped decision to accept the automated integration/unit/typecheck/lint coverage as sufficient without the full browser run, before authorizing Plan 20-10's column drop. This verification session independently re-ran the equivalent live-DB integration coverage (5/5 files, 18/18 tests, including the exact `p_skip_depletion` scenario the browser test's T2 doesn't even cover) and found it green, corroborating that prior decision was reasonable.

## Gaps Summary

No gap prevents any of the 4 roadmap Success Criteria from being genuinely, verifiably true in the live codebase and live production database. Every SUMMARY.md claim checked against direct evidence (migration file contents, live-DB queries, live-DB integration test execution, and direct reads of client consumer files) held up — with one exception:

- **Plan 20-11-SUMMARY.md's claim "zero lingering client HH calc code"** is not fully accurate: `CatalogProductsTab.tsx` still contains a dead, misleading "HH price" inline-edit control (see Anti-Patterns above). This is a real, verifiable gap between what a SUMMARY claimed and what the code shows — but it is scoped to a single non-core admin-table column with a silent no-op behavior, not a functional break in the promotions engine, and does not affect any of the 4 official Success Criteria. Recommend a small follow-up cleanup plan (not a re-open of Phase 20's core deliverables).

## Verdict

**PASS.** All 4 Roadmap Success Criteria for Phase 20 are verified with direct, live evidence (not SUMMARY narration):

1. `promotions` table (3 discount types, 4 target types incl. `pool_billing`/`pool_grant`, priority, `is_active`) — live and RLS-correct.
2. `applied_promotions` — live, append-only, correctly attributed to `order_item_id`/`tab_id`/`pool_session_id`.
3. `evaluate_promotions_for_item` RPC — live, atomic, auto-applies at order time, and the `p_skip_depletion` bug (found during Plan 20-09's own UAT gate) is confirmed **fixed and live** via direct re-execution of the exact regression scenario in this verification session.
4. Settings → Promotions admin UI — live, full create/edit/disable/delete, RBAC-gated on `manage_products`.

Phase 20 **can be marked Complete.** The one discovered gap (dead HH-price admin cell in `CatalogProductsTab.tsx`) is a minor, non-blocking cleanup item — recommended as a fast follow-up, not a condition for closing this phase.

---

*Verified: 2026-07-10T09:50:00Z*
*Verifier: Claude (gsd-verifier)*
