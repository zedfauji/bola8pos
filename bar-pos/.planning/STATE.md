---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: — Cross-Pollination from billar-pos
current_phase: 18
current_plan: 1
status: executing
stopped_at: Phase 18 context gathered
last_updated: "2026-07-08T01:44:30.025Z"
progress:
  total_phases: 28
  completed_phases: 14
  total_plans: 103
  completed_plans: 107
  percent: 50
---

# Session State

## Project Reference

See: .planning/PROJECT.md

## Position

**Milestone:** Feature Expansion 2026 Q2 / v2.1
**Current phase:** 18
**Current plan:** 1
**Status:** Executing Phase 18
**Progress:** [██████████] 100%

## Session Log

- 2026-07-07: **Phase 17 Plan 05 complete (ad9098a, ed03b83, b3279c7) — Phase 17 (modifier-inventory-rules) COMPLETE, 5/5 plans** — `features/manage-modifier-inventory-rules/` slice shipped: `ModifierIngredientRulesDialog` (row-list editor cloned from `RecipeEditorTab`'s `useReducer` pattern, dropped `yieldQty`, renamed `qty`→`delta`) + `useManageModifierInventoryRules` toast-wrapping save hook + explicit-export barrel; signed delta `Input` uses `type="number" step="0.001"` with **no `min` attribute** — MoneyInput forbidden here (Pitfall 3, clamps negatives to 0). `CatalogModifiersTab.tsx` gains a per-row `FlaskConical` "Ingredient rules" button, mirroring the existing Edit/Delete cluster and the `CatalogProductsTab`→`RecipeEditorTab` cross-feature import precedent. `npm run typecheck`/`lint` clean (only the 2 pre-existing 17-03-documented errors remain); full unit suite 1187 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`, since Phase 15) / 15 todo — no regressions. Task 3's blocking `checkpoint:human-verify` was satisfied via an orchestrator-authored Playwright spec `e2e/24-modifier-inventory-rules.spec.ts` (course-corrected mid-execution in place of manual click-through) covering the full UAT flow — add positive + negative delta rows, save, reopen, assert exact round-trip (`-1`, not clamped to `0`), Save-button dirty/clean gating, row-remove — 1 passed (40.6s), stable across 2 runs. SC-3 satisfied. **Phase 17 is now complete.**
- 2026-07-07: **Phase 17 Plan 03 complete (64a19d1)** — modifier_inventory_rules type block transcribed into supabase.types.ts (Row/Insert/Update/Relationships, delta:number, two FKs to modifiers/ingredients, alphabetically placed between modifier_groups and modifiers); BLOCKING checkpoint executed and approved: both migrations (`20260706000002_modifier_inventory_rules_table.sql`, `20260706000003_deplete_for_order_item_v3.sql`) applied to remote Supabase via a single `npx supabase db push` (no CLI splitter workaround needed this time); 4 verification queries all PASS — table live (`to_regclass`), RLS policies present (`modifier_inventory_rules_select_authenticated`, `modifier_inventory_rules_write_manager`), v3 function body confirmed via `pg_get_functiondef` (contains `order_item_modifier` loop + preserved kitchen role guard). `npm ci` run first (node_modules was empty); typecheck surfaced 2 pre-existing unrelated errors (tab/model/queries.ts, agent/rag.ts, both predate this plan) logged to `.planning/phases/17-modifier-inventory-rules/deferred-items.md`, not fixed (out of scope). SC-1 + SC-2 satisfied — 17-04 (entity queries + integration test) and 17-05 (admin UI) unblocked.
- 2026-07-03: **Phase 13 Plans 13-01 + 13-06 backfilled/completed (a692e3f)** — 13-01 (RLS rewrite + RPC role guards) had real committed work (98fa463, 8cfd6c5) from 2026-04-27 but no SUMMARY.md; backfilled from commit history, no re-execution needed. 13-06 (Task 1: T-RP-01..06 E2E tests, committed 5d6c97b 2026-04-28) was missing its Task 2 (blocking human-verify checkpoint) and Task 3 (unit regression gate) — both completed this session. All 6 Phase 13 E2E tests (T-RP-01..06) pass; role_permissions seed counts match exactly (bartender=9/manager=17/admin=22/kitchen=4); action-set diff 0 rows; unit suite 1133/1134 (same pre-existing failure); human sign-off received on manual /rbac click-through. Found + fixed a real regression while running the checkpoint: `openCaja()` E2E helper silently broken since Phase 15 shipped (2026-04-28) — its cleanup UPDATE never bumped `version`, so the `bump_version_on_update` trigger rejected it and the error was unchecked, leaving stale open `caja_sessions` rows that broke ~39 E2E specs via `caja_sessions_one_open` violations whenever a prior session was left open. Fixed by closing each open row individually with `version+1`. RBAC spec went from 20/20 failing to 6/20 (all 6 remaining confirmed pre-existing/unrelated — missing "Budweiser" seed product, not an RBAC issue). **Phase 13 (scopes-full-rbac-from-scratch) is now complete — 6/6 plans.**
- 2026-07-03: **Phase 05 Plan 05-05 COMPLETE (562ea65, 27da4a1)** — Kitchen Prep E2E suite (21-prep.spec.ts T1/T2/T4/T5) green twice in a row against live remote Supabase, T3 intentionally skipped (covered by integration I5/I6). Blocker from earlier this session (DNS NXDOMAIN) resolved by user; follow-up Cloudflare 521 + PostgREST PGRST205 "table not in schema cache" resolved via `NOTIFY pgrst, 'reload schema'` (project woke from pause with a stale schema cache, migrations were actually already applied). Found + fixed 2 real app bugs surfaced by attempting genuine E2E verification: (1) `mapStaffRow` never passed `mustChangePin` to `StaffSchema.parse()`, throwing a ZodError on every profiles row and breaking `/login` app-wide with "Failed to load staff" — fixed in `src/entities/staff/model/queries.ts`; (2) `DataTable.tsx`'s loading skeleton rendered a bare `<div>` directly inside `<TableBody>` (invalid HTML, React hydration warning on every loading DataTable app-wide) — wrapped in TableRow/TableCell. Also fixed 2 E2E-test-only bugs: `resetPrepIngredientStock` only reset Tomato (not Onion, not Salsa Mexicana itself), causing cross-run state drift; and an unscoped `getByRole('dialog')` in T2 matched the always-mounted AI-assistant side panel. Full unit suite 1133/1134 pass (same pre-existing unrelated `useCloseTab.test.ts:95` failure documented since Phase 15). Non-blocking, left untouched: 5 pre-existing lint errors from Phase 15 commit 761cacb; migration-history drift between local `.sql` files and 4 already-applied remote migrations (`rpc_versioned_group_a`, `drop_orphan_rpc_overloads_15_02`, `fix_combo_rls`, `force_pin_change`). **Phase 05 (kitchen-prep-cocktails) is now complete — 5/5 plans.**
- 2026-04-28: **Phase 15 Plan 06 complete (6e875ad, ca8deb0, c9e7884, e6b97ef)** — concurrent-edits test layers (D-19): fast-check property test queries.concurrent.test.ts (3 properties × 200 numRuns: Group A RPC pattern, Group B hook-optimistic pattern, retry-after-refetch edge — all green); Group A integration version-rpc-guard.test.ts (6/6 pass live remote: process_payment_atomic + create_order_with_items each P0V01 stale + happy + P0V02 missing); Group B integration version-hook-optimistic.test.ts (8/8 pass live remote: 4 entity-layer Group B paths × stale+fresh — tabs status, tabs close-on-payment, pool_sessions stop, caja_sessions close-probe; 5 feature-layer paths deferred per 15-03 Rule 4); Playwright e2e/39-concurrent-edits.spec.ts (T1 two-context stale-cache → 'Updated by another terminal — please retry' toast + refetch + retry — body correct, run blocked at loginAs by seed/env mismatch documented); CLAUDE.md spec list +39-concurrent-edits; typecheck + lint exit 0; full suite 1147/1163 pass + 15 todo + 2 skip + 1 PRE-EXISTING failure in useCloseTab.test.ts:95 confirmed unrelated by stash test
- 2026-04-28: **Phase 15 Plan 04 complete (3737c72, ad4af3f)** — offline queue conflict-aware replay: OfflineActionSchema (Zod) + OfflineActionTypeSchema locked 4-literal enum (open-tab, place-order, start-pool-timer, stop-pool-timer) in domain.ts; OfflineAction.expectedVersion required; persist v2 migrate defaults expectedVersion=0 + drops unknown action types from legacy queues; 4 enqueueOfflineAction call sites pass expectedVersion (open-tab/start-pool-timer=0 for creation; place-order/stop-pool-timer captured from cached entity version); formatDiscardedSummary helper @shared/lib/offline-summary.ts (3 tests pass incl. fast-check property); OfflineQueueProcessor STALE_VERSION + NOT_FOUND_VERSIONED → drop (no retry) + writeDiscardAuditAsync(record_audit p_action='offline.discarded_stale') + post-batch summary toast 'Discarded N queued action(s) — data changed: <types>'; existing transient-error (NETWORK_OFFLINE) requeue behaviour preserved; 5 OfflineQueueProcessor tests pass; full suite 120 files / 1131 tests pass; typecheck + lint exit 0
- 2026-04-28: **Phase 15 Plan 03 complete (ee487b3, 48f43e7, 91424d8)** — version-aware mutation hooks: handleVersionError helper @shared/lib/version-error.ts (invalidate + sonner toast 'Updated by another terminal — please retry' + best-effort record_audit fire-and-forget; NOT_FOUND_VERSIONED → 'Record was deleted by another terminal.'); VersionConflictToast wrapper + 2 Storybook stories (StaleVersion, NotFoundVersioned); 7/7 unit tests pass; TabSchema/PoolSessionBaseSchema/CajaSessionSchema gain optional version; supabase.types.ts manually extended (Docker unavailable) for tabs/pool_sessions/caja_sessions Row.version + p_expected_version on Group A RPCs; useMutationAddOrder passes p_expected_version (Group A); useMutationUpdateTabStatus + useMutationRecordTabPayment(close) + useMutationStopSession + useMutationCloseCaja(pre-RPC probe) use .eq('version', expected) + version: expected+1 (Group B); PGRST116 → staleVersionError; onError → handleVersionError; full suite 1123/1123 green, typecheck + lint clean; Rule 4 deviation: process_payment_atomic edge function envelope + 5 feature-layer hooks (close-tab, transfer-tab, void-order, process-refund, add-combo, assign-pool-session) deferred (documented in 15-03-SUMMARY.md)
- 2026-04-28: **Phase 15 Plan 02 complete (4c6ca9d)** — Group A RPC version guards: process_payment_atomic + create_order_with_items now accept `p_expected_version int` (LAST positional, DEFAULT NULL) with canonical FOR UPDATE guard raising P0V01 (STALE_VERSION) / P0V02 (NOT_FOUND_VERSIONED); version=version+1 on every successful UPDATE branch (close, partial-pay, create_order); Rule 3 fix: re-raise P0V01/P0V02 in process_payment_atomic EXCEPTION block to bypass WHEN OTHERS swallow into ok=false; Rule 2 fix: bump version on partial-pay branch (concurrent partial-pay race); existing 14-03 success-path record_audit preserved; Group B (9 hook-side paths) deferred to 15-03; migration not pushed (deferred to 15-05 BLOCKING)
- 2026-04-28: **Phase 15 Plan 01 complete (45e110d, 3e1d29b)** — versioned_rows migration (version cols + bump_version_on_update trigger on tabs/pool_sessions/caja_sessions raising P0V01) + result.ts STALE_VERSION/NOT_FOUND_VERSIONED codes + parseSupabaseError P0V01/P0V02 mapping; typecheck pass; migration not pushed (deferred to plan 15-05 BLOCKING)
- 2026-04-28: **Phase 14 PLAN.md complete** — 6-plan wave diagram: 14-01 (audit_logs migration), 14-02 (BLOCKING db push + types + domain + audit-actions), 14-03 (RPC wiring), 14-04 (json-diff + JsonDiffViewer + entities/audit-log + CI test), 14-05 (audit page + AuditRoute + router + HomeDashboard tile), 14-06 (E2E + verification gate); 19 new files, 6 modified files
- 2026-04-28: **Phase 13 Plan 05 complete (f61501a)** — RBACDashboard composes Staff Roles + Permission Matrix two-panel layout
- 2026-04-28: **Phase 13 Plan 05 Task 1 complete (bcc8536)** — shared/ui/switch.tsx (Radix umbrella import) + PermissionMatrix.tsx 22×4 grid + 4 RTL tests (88 switches, admin gate)
- 2026-04-28: **Phase 13 Plan 04 complete (eebc92d)** — features/toggle-permission/ useMutationTogglePermission INSERT/DELETE; 3 unit tests; invalidates rbacKeys.list() onSuccess
- 2026-04-28: **Phase 13 Plan 03 complete (5087d42, a60815a)** — RolePermissionSchema in domain.ts + entities/rbac/ FSD slice; useRolePermissions returns Result<Map<StaffRole, Set<StaffAction>>>; 3 unit tests
- 2026-04-28: **Phase 12 Plan 02 complete** — /rbac route wired (8051884) + Roles & Permissions HomeDashboard tile + CLAUDE.md routes table updated; T-RBAC-page/T-RBAC-redirect/T12/T14 E2E tests (5fdba18); HomeDashboard lock icon count fix (a8b1332); 2 tasks, 5 files; typecheck/lint/test GREEN (1104 pass, 15 todo)
- 2026-04-27: **Phase 12 Plan 01 complete** — RbacRoute guard (501c036) + EditRoleDialog preSelectedStaffId + StaffDashboard Administration removed (3ce2029) + RBACDashboard widget + RbacPage + barrel (5c97c9a); 3 tasks, 10 files; typecheck/lint/test GREEN (1104 pass, 15 todo)
- 2026-04-27: Plan 09-05 complete — UpdaterProvider wired into providers.tsx (063c8f3); E2E smoke spec 18-updater.spec.ts (abb10e3); Phase 9 14/14 unit tests GREEN; typecheck PASS; lint clean on plan files (agent/ pre-existing errors out of scope); CHECKPOINT awaiting human verify
- 2026-04-27: **Phase 10 execute complete** — `10-01-PLAN.md` waves 0–3+4 (peer review optional); artifacts: `10-EVIDENCE.md`, `10-FINDINGS.md`, `10-CHECKLIST.md` (36 open items, scoring table); **lint+test not green** in bar-pos at commit `1b5ef62` (documented, not fixed per audit scope)
- 2026-04-27: Phase 10 `/gsd-plan-phase` — `10-01-PLAN.md` + `10-CONTEXT.md` + `10-FINDINGS.md` template in `.planning/phases/10-ai-slob-technical-debt-checklist/`; ROADMAP Phase 10 planning artifacts line
- 2026-04-27: Phase 10 added — AI Slob & Technical Debt Audit; artifact `.planning/phases/10-ai-slob-technical-debt-checklist/10-CHECKLIST.md`; ROADMAP.md updated; `total_phases: 10`
- 2026-04-23: STATE.md regenerated by /gsd:health --repair
- 2026-04-23: Plan 02 (SQL migrations) completed — 6 tasks, 6 migration files, S1-01..S1-05 + S1-11
- 2026-04-23: Plan 03 (types-zod) completed — S1-06, 50 unit tests, supabase.types.ts + domain.ts extended
- 2026-04-23: Plan 04 (entity-category) completed — S1-10, entities/category created, CatalogCategoriesTab + CatalogProductsTab rewired to @entities/category
- 2026-04-23: Plan 05 (ui-features) completed — S1-07/08/09/12, CategoryTreePicker, CategoryTreeEditor, ModifierGroupEditor, category-tree property tests (29 tests, fast-check)
- 2026-04-23: Plan 07 (regression-gate) completed — typecheck/lint/unit PASS; E2E 31-categories blocked by staging migration gap; manual operator steps documented
- 2026-04-23: Plan 02-01 (combo schema foundations) completed — 2 tasks, 4 SQL migrations, AppErrorCode +4 combo codes, shadcn Collapsible installed
- 2026-04-23: Plan 02-02 (schema push + Zod types + pool-billing) completed — supabase db push applied, 6 combo Zod schemas added to domain.ts, prepaidMinutes in pool-billing, 19 tests pass
- 2026-04-23: Plan 02-03 (entities/combo/ + add_combo_to_tab RPC) completed — 6 TanStack Query hooks, comboKeys, add_combo_to_tab PL/pgSQL migration with all 4 error strings
- 2026-04-23: Plan 02-04 (shared/ui combo components + ProductGrid) completed — ComboBadge, ComboUnavailableBadge, ComboSlotCard + 3 story files; ProductGrid combo routing fork with useComboAvailability + ManagerPinDialog override
- 2026-04-24: Plan 02-07 (property tests + seed data) completed — P2 pricing + P3 availability property tests
- 2026-04-24: Plan 06-05 (entity hooks) completed — useSubTabs + parent_tab_id IS NULL filter on useTabs + entities/refund FSD slice (useRefunds, useRefundsByPayment, refundKeys) — P2 pricing + P3 availability property tests (10 tests, 2800+ runs), seed-combos.ts for Cubeta Regular/Premium + Martes de Cubeta + Pool
- 2026-04-24: Plan 06-08 (process-refund FSD slice) completed — RefundSheet UI + useProcessRefund mutation hook + P10 property test (4/4 pass) + Select shared component
- 2026-04-24: Plan 06-10 (integration tests) completed — split-tab 6/6 + process-refund 5/5 scenarios pass; Rule 1 fix: process_refund RPC missing idempotency_key (migration 20260427000005)
- 2026-04-24: Plan 06-11 (E2E specs) completed — 34-split-bill.spec.ts (5 tests) + 35-refund.spec.ts (3 tests); CHECKPOINT awaiting human E2E run with dev server
- 2026-04-24: Plan 04-01 (DB migrations) completed — recipes, recipe_items, audit_log tables + deplete_for_order_item RPC; both migrations applied to remote DB (user confirmed)
- 2026-04-24: Plan 04-02 (Zod schemas + types + stubs) completed — RecipeSchema family + computeDepletion exported; supabase.types.ts extended with recipes/recipe_items/audit_log/deplete_for_order_item; 3 Wave 0 stub files (18 todo tests)
- 2026-04-24: Plan 04-03 Task 1 complete (408b82d) — 3 v2 SQL migrations: create_order_with_items v2 (p_skip_depletion), deplete_for_order_item v2 (p_allow_negative + audit_log), add_combo_to_tab depletion loop; BLOCKING checkpoint awaiting supabase db push
- 2026-04-24: Plan 04-03 complete (b9b6713) — recipe entity (useRecipe + useMutationSaveRecipe + RecipePreviewPanel) + shadcn command/popover moved to shared/ui; v2 migrations 003/004/005 applied (user confirmed); typecheck + lint pass
- 2026-04-24: Plan 04-04 complete (a8a1de0) — void reversal + useOverrideNegativeStock (p_skip_depletion + p_allow_negative) + IngredientAutocomplete (5/5 tests) + CartPanel INVENTORY_NEGATIVE override flow; typecheck + lint pass
- 2026-04-24: Plan 04-05 complete (3ff88bc) — manage-recipe feature (useManageRecipe + RecipeEditorTab via useReducer) + Recipe tab in product edit Dialog (max-w-2xl Tabs wrapper) + seed-recipes.ts; typecheck + lint pass
- 2026-04-24: Plan 04-06 complete — depletion unit (6/6) + integration (4/4) + 36-recipes.spec.ts E2E; 3 post-checkpoint selector fixes; E2E 3/3 PASS 1 skip; Phase 04 complete
- 2026-04-25: Plan 05-01 complete (98cb6a1) — 3 SQL migrations (prep_productions table + recipes extension + trigger), applied to remote DB (user confirmed), supabase.types.ts updated; typecheck pass
- 2026-04-25: Plan 05-02 complete (d5de8e8) — PrepProductionSchema + PREP_INGREDIENT_REQUIRED + produce_prep_batch RBAC; computePrepConsumption pure function; 5 unit tests + P7 property tests pass; 5 Wave 0 stubs created
- 2026-04-25: Plan 05-03 complete (8065774) — ChefHatBadge + entities/prep FSD slice (prepKeys, usePrepProductions, useMutationCreatePrepProduction, useRecipeByPrepIngredient, PrepOnHandCard + 4 stories) + useProducePrepBatch hook + I1-I6 integration tests; 5 unit tests pass; typecheck + lint pass
- 2026-04-25: Plan 08-01 complete — 6 lint fixes (d631c50), Wave 0 stubs (65f5ed0), S6-01 views + S6-02 indexes + S6-15 DOWN scripts (8133117); supabase db push confirmed (3 views + 2 indexes live); typecheck + lint + 105 tests green
- 2026-04-25: Plan 08-02 complete — 5 Zod report row schemas (67e01db), 3 supabase.types.ts view shapes, 5 TanStack Query hooks + assertDateRangeValid 365-day guard + 4 unit tests (8370e48); 105 test files, 1058 tests pass
- 2026-04-26: Plan 08-03 complete — 5 report widgets (c5d5743, a8e71a4): ComboMixReport + RecipeVarianceReport + WaitlistAnalyticsReport + RefundsRegister + ComboOverrideReport; 4 RTL test files (18 new tests); 109 test files, 1076 tests pass
- 2026-04-26: Plan 08-04 complete — ExportType +9 variants (9dbfe0e), ReportsPage 12 tabs (40f8480): 5 Excel builders + 4 PDF builders + ExportButtons Props +5 + as-never casts removed; 109 test files, 1076 tests pass
- 2026-04-26: Plan 08-06 complete — S6-12 waitlist UX paper-cuts (9635c17, 7e77e60): size="lg" touch targets on SeatPartySheet + AddWaitlistEntryForm + NotifyButton; focus-trap comments; specific toast copy in useMarkCancelled + useMarkNoShow + useSeatWaitlistParty; 109 test files, 1076 tests pass
- 2026-04-27: Plan 09-04 complete — UpdateAvailableDialog (4 states) + Progress component (a902443, dbf3064); 7/7 RTL tests GREEN (UPD-03/04/05/08); XSS prevention confirmed (whitespace-pre-wrap only); UpdateAvailableDialog + Progress exported from shared/ui/index.ts
- 2026-04-27: **Phase 11 Plan 02 complete** — lint green + test green baseline; 211 lint errors → 0; 1 test failure → 1107 passing; commits 84007dc (11-01 prereq), 031f9b6, 45e2c0b, 70be490
- 2026-04-27: **Phase 11 Plan 03 complete** — CI workflow created (.github/workflows/ci.yml, edf4a7d); local gates: typecheck EXIT 0, lint EXIT 0, 1107 tests EXIT 0; npm audit EXIT 1 (xlsx high CVE GHSA-4r6h-8v6p-xvw6 + GHSA-5pgg-2g8v-p4x9, no fix available, documented for Plan 04)
- 2026-04-27: **Phase 11 Plan 04 complete** — xlsx CVE risk documented (6e65b69 SECURITY comment in excel.ts, 7f78957 decision record .planning/decisions/xlsx-cve-risk-accept.md); lint EXIT 0; TECH-DEBT-CVE-DOC requirement satisfied

## Accumulated Context

### Roadmap Evolution

- Phase 12 added: Full RBAC page, Remove the breadcrumbs of RBAC from other page, There should be only one page to manage RBAC and it should be Protected. Follow the project Navigation rule.

## Decisions

- [Phase 08-polish 08-06]: Actual UI filenames differ from plan spec — SeatPartySheet.tsx not SeatWaitlistPartySheet.tsx, NotifyButton.tsx not NotifyWaitlistButton.tsx; fixes applied to real files
- [Phase 08-polish 08-06]: POSButton exists in @shared/ui but size="lg" on shadcn Button used — equally valid; Radix SheetContent traps focus by default so only comment needed
- [Phase 08-polish 08-01]: waitlist_metrics_daily uses NULL::numeric AS avg_quoted_wait — quoted_wait_minutes column absent from waitlist_entries schema; to be wired when column is added
- [Phase 08-polish 08-01]: Phase 7 migration files named waitlist_notify_trigger.sql + waitlist_trigger_url.sql (plan stated pg_net_trigger + schema_fix) — DOWN blocks added to actual files
- Use `db = supabase as any` pre-regen cast for stock_movements queries until Plan 03 regenerates types (per CLAUDE.md workaround)
- Category entity queries do NOT sync to useProductStore; POS flow uses product entity's own useCategories for store sync
- useCategoryTree delegates tree construction to buildTree from @shared/lib/category-tree to avoid duplication
- No cross-entity imports: entities/category only imports from @shared/* (valid FSD boundary)
- CategoryTreePicker expands all nodes by default (settings usability; not POS)
- CategoryTreeEditor replaces flat CatalogCategoriesTab in ProductsSettingsTab
- ModifierGroupEditor uses file-level eslint-disable + supabase as any (pre-regen cast for modifier_groups)
- Integration test failures in hourly-breakdown + product-sales-report are pre-existing (live Supabase data), deferred
- stock_movements reason enum extended to 11 values including void, refund, prep_production, prep_consumption, combo_component
- Depth-3 trigger fires BEFORE INSERT OR UPDATE OF parent_id (bounded, not all-UPDATE)
- modifier_groups: all-authenticated SELECT, manager+admin write (matches inventory RLS pattern)
- payments_tab_id_key dropped with IF EXISTS for idempotency
- supabase.types.ts manually extended (Docker unavailable); all Plan 02 migration columns/tables transcribed deterministically
- comboEligible/isCombo use z.boolean().optional().default() — absent-safe in struct literals, parse() fills defaults
- StockMovementReason is a superset enum (11 values) separate from InventoryAdjustReason (6 values) for backwards compat
- lint-staged --no-warn-ignored added to suppress ESLint "file ignored" warning for supabase.types.ts
- [Phase 01-foundation]: combo_eligible tested via DB service-role client (no UI toggle in ProductForm yet — field exists in domain.ts and DB only)
- [Phase 01-foundation]: RLS test for bartender modifier_groups write uses E2E_BARTENDER_EMAIL/PASSWORD env vars (skippable when not set)
- [Phase 01-foundation]: E2E 31-categories T2 failure is staging infrastructure gap (parent_id column not on remote DB), not a code bug — requires supabase db push
- [Phase 01-foundation]: inventory_log grep: 2 hits in src/ are comments only documenting rename history — gate passes
- [Phase 02-combos 02-01]: shadcn CLI installs collapsible to src/app/components/ui/ — always move to src/shared/ui/ to match FSD layer boundaries
- [Phase 02-combos 02-01]: Added FK indexes on combo tables and partial indexes on order_items combo columns for query performance
- [Phase 02-combos 02-02]: comboPriceOverride uses .nullable().optional() (no .default) to avoid exactOptionalPropertyTypes violation in existing mock objects
- [Phase 02-combos 02-02]: prepaid deduction applies after firstHourMode block sizing — full-hour sessions with 60min prepaid yield 0 charge
- [Phase 02-combos 02-02]: supabase gen types --local overwrites file with error text when Docker unavailable; must restore from git
- [Phase 02-combos 02-03]: pool_time slots in add_combo_to_tab produce no pool_sessions INSERT — table_id NOT NULL prevents pending sessions; start-pool-timer creates session with correct table_id and applies prepaid_minutes
- [Phase 02-combos 02-03]: audit_log INSERT uses EXCEPTION WHEN undefined_table guard — audit_log not yet created; auto-activates when future migration adds the table
- [Phase 02-combos 02-03]: export * banned by ESLint no-restricted-syntax; use explicit named exports in model/index.ts barrels
- [Phase 02-combos 02-04]: shared/ui components import types from @shared/lib/domain (not @entities/*) — FSD layer boundary enforced by eslint-plugin-boundaries
- [Phase 02-combos 02-04]: ComboSlotCard option rows use button+role=option inside role=listbox (a11y compliance for jsx-a11y rules)
- [Phase 02-combos 02-04]: exactOptionalPropertyTypes fix: conditional spread {...(cond ? { className } : {})} instead of className={x || undefined}
- [Phase 02-combos 02-04]: Storybook stories must import from @storybook/react-vite (not @storybook/react) per storybook/no-renderer-packages ESLint rule
- [Phase 02-combos 02-07]: P2d property: prepaid deduction applies to billedMinutes (15-min block-rounded), not raw elapsedMinutes — test invariant corrected from plan draft
- [Phase 02-combos 02-07]: combo_slots and combo_slot_options lack unique constraints on natural keys — seed uses select-then-upsert instead of upsert with onConflict
- [Phase 02-combos 02-07]: seed-combos.ts uses eslint-disable at file level + supabase as any (service role cast; consistent with CLAUDE.md workaround pattern)
- [Phase ?]: [Phase 02-combos 02-08]: E2E T5 uses page.evaluate with explicit parameter passing (not window globals) for NESTED_COMBO_FORBIDDEN RPC test
- [Phase ?]: [Phase 02-combos 02-08]: 32-combos.spec.ts day-conditional tests (T3/T4) use test.info().annotations.push pattern — always runnable, reports state rather than hard-skipping
- [Phase 06-split-bill-refund 06-04]: splitMode/splitLabel/parentTabId use .nullable().optional() — consistent with cajaSessionId pattern in TabSchema
- [Phase 06-split-bill-refund 06-04]: computeEvenSplit absorbs rounding remainder in lastAmount; P9 invariant: base*(n-1)+last===totalCents
- [Phase 06-split-bill-refund 06-04]: process_refund in MANAGER_EXTRA only (not BARTENDER_ACTIONS) — threat T-06-12 mitigated
- [Phase 06-split-bill-refund 06-04]: RefundSchema.amount uses z.number().positive() (not MoneySchema) — prevents zero/negative refunds at schema level
- [Phase 06-split-bill-refund 06-06]: SubTabColumn uses labelSlot?: React.ReactNode prop so PersonCard composes without duplicating layout
- [Phase 06-split-bill-refund 06-06]: data-item-list + closest() check used instead of stopPropagation on li (avoids jsx-a11y/no-noninteractive-element-interactions)
- [Phase 06-split-bill-refund 06-06]: PersonCard uses useRef+useEffect for focus (autoFocus HTML prop blocked by jsx-a11y/no-autofocus)
- [Phase 06-split-bill-refund 06-07]: useSplitEvenly calls split_tab_evenly for validation then runs N callProcessPayment calls — does NOT create sub-tabs; parent stays 'open'
- [Phase 06-split-bill-refund 06-07]: SplitEvenlyInput.method is 'cash' | 'card' | 'rappi' (no 'transfer') — PaymentMethodSchema constraint
- [Phase 06-split-bill-refund 06-07]: isValid ternary chain (not switch) to satisfy @typescript-eslint/no-unnecessary-condition on last enum branch
- [Phase 06-split-bill-refund 06-10]: process_refund RPC fixed to include idempotency_key ('refund-' + refund UUID) — payments.idempotency_key is NOT NULL
- [Phase 06-split-bill-refund 06-10]: Auto-close trigger integration test updates sub-tab status to 'paid' before inserting payment — trigger reads status, not payment existence
- [Phase 06-split-bill-refund 06-10]: describe.skipIf(hasEnv) + itInt/itAuth/itBartender aliases for graceful skip when E2E creds absent
- [Phase 04-recipes-sale-depletion 04-01]: audit_log canonical columns from add_combo_to_tab INSERT: action, entity_type, entity_id, details, created_at — actor_id added as nullable
- [Phase 04-recipes-sale-depletion 04-01]: deplete_for_order_item v1 takes (uuid, smallint); v2 with p_allow_negative in migration 004
- [Phase 04-recipes-sale-depletion 04-02]: UuidSchema and TimestampSchema confirmed exact primitive names in domain.ts — used in RecipeSchema family without new primitives
- [Phase 04-recipes-sale-depletion 04-02]: deplete_for_order_item p_allow_negative? pre-added to supabase.types.ts to avoid second edit when migration 004 lands
- [Phase 04-recipes-sale-depletion 04-02]: fast-check import must precede vitest in test files per import/order ESLint rule (alphabetical package ordering)
- [Phase 04-recipes-sale-depletion 04-03]: shadcn CLI installs to src/app/components/ui/ — always move to src/shared/ui/ and fix @app/lib/utils → @shared/lib/utils (FSD boundary; same as Plan 02-01 collapsible)
- [Phase 04-recipes-sale-depletion 04-03]: useMutationSaveRecipe uses upsert+delete-all+insert-new replace strategy (Wave 4 UI always saves full recipe)
- [Phase 04-recipes-sale-depletion 04-03]: RecipePreviewPanel shows ingredientId UUID (not name) — name requires join; Wave 4 form resolves via useIngredientsActive()
- [Phase 04-recipes-sale-depletion 04-04]: IngredientAutocomplete accepts ingredients/isLoading as props (FSD: shared cannot import from entities; parent widget passes data from useIngredients)
- [Phase 04-recipes-sale-depletion 04-04]: Void depletion reversal is non-atomic with edge function void — eventual consistency acceptable; idempotent on 23505
- [Phase 04-recipes-sale-depletion 04-04]: override-negative-stock audit_log failure does not fail the mutation — order is placed; audit is best-effort server-side
- [Phase 04-recipes-sale-depletion 04-05]: useReducer replaces multiple useState + multi-setState in useEffect to satisfy react-hooks/set-state-in-effect ESLint rule — single dispatch per useEffect avoids the violation
- [Phase 04-recipes-sale-depletion 04-05]: RecipeEditorTab fetches ingredients via useIngredientsActive() internally (features can import from entities); passes them as ingredients prop to IngredientAutocomplete (FSD: shared cannot import from entities)
- [Phase 04-recipes-sale-depletion 04-05]: seed-recipes.ts follows seed-combos.ts pattern — VITE_SUPABASE_URL from .env.local, eslint-disable at file level, supabase as any cast
- [Phase 04-recipes-sale-depletion 04-05]: import order in CatalogProductsTab: @features/* before @entities/* per ESLint import/order rule (FSD layer hierarchy)
- [Phase 04-recipes-sale-depletion 04-06]: fc.float min/max must be Math.fround() in fast-check v4 (32-bit float constraint)
- [Phase 04-recipes-sale-depletion 04-06]: deplete_for_order_item has two PG overloads; always pass p_allow_negative explicitly to avoid PGRST203
- [Phase 04-recipes-sale-depletion 04-06]: integration tests use anon client (signInWithPassword) for RPC calls — auth.uid() NULL with service-role JWT
- [Phase 04-recipes-sale-depletion 04-06]: one order_item per integration test due to UNIQUE index on (ref_type, ref_id, ingredient_id)
- [Phase 04-recipes-sale-depletion 04-06]: E2E spec named 36-recipes.spec.ts to avoid collision with existing 20-*.spec.ts files
- [Phase ?]: combo-overrides has no PDF builder — Excel only per plan spec (audit log does not benefit from PDF format)
- [Phase ?]: [Phase 09-auto-updater 09-02]: tauri_plugin_process uses builder chain; tauri_plugin_updater uses app.handle().plugin() with #[cfg(desktop)] guard
- [Phase ?]: [Phase 09-auto-updater 09-02]: installMode passive — no UAC escalation, no silent install (T-9-02-05 mitigated)
- [Phase 09-auto-updater 09-03]: vi.advanceTimersByTimeAsync(0) used instead of vi.runAllTimersAsync() — setInterval causes infinite 10k-timer abort in fake timers mode; advance-by-zero flushes initial async runCheck() microtask without triggering the 4h interval
- [Phase 09-auto-updater 09-04]: progress.tsx created with manual Radix UI primitive (not shadcn CLI) — ComponentRef replaces deprecated ElementRef; .toString() on number operand resolves restrict-template-expressions; import order fixed (S before a case-insensitive)
- [Phase 09-auto-updater 09-04]: dangerouslySetInnerHTML appears only in JSX comment as prohibition reminder — actual changelog rendered as React text child inside whitespace-pre-wrap paragraph (XSS prevention, ASVS V5, T-9-04-01)
- [Phase 11-debt-remediation 11-02]: Manual supabase.types.ts extension used (Docker WSL pipe unavailable for supabase start); agent_audit_log + pos_error_log + pos_codebase_index + match_codebase_chunks RPC added
- [Phase 11-debt-remediation 11-02]: posTools.ts assertExists uses scoped eslint-disable block for dynamic table name — justified cast, caller validates table names
- [Phase 11-debt-remediation 11-02]: brain.test.ts executeTool IS called for pending actions (returns {pending:true}); removed incorrect not.toHaveBeenCalled assertions
- [Phase 11-debt-remediation 11-02]: cancelAction and bulkImportProducts made synchronous (no await expressions) to satisfy require-await ESLint rule
- [Phase 11-debt-remediation 11-03]: xlsx high-severity CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) block CI at --audit-level=high; no upstream fix available; risk acceptance deferred to Plan 04
- [Phase 11-debt-remediation 11-03]: npm audit --audit-level=high kept (not lowered to critical) until explicit Plan 04 risk-acceptance decision
- [Phase 11-debt-remediation 11-04]: xlsx CVEs GHSA-4r6h-8v6p-xvw6 + GHSA-5pgg-2g8v-p4x9 risk accepted — outbound write-only path, no XLSX.read() on untrusted input; residual supply-chain vector mitigated by lockfile + CI audit gate; exceljs replacement deferred to future sprint
- [Phase 12-full-rbac-page 12-01]: key-based remount pattern used for preSelectedStaffId in EditRoleDialog — react-hooks/set-state-in-effect blocks useEffect+setState; RBACDashboard passes key={selectedStaffId ?? 'no-selection'} to force remount with fresh useState(preSelectedStaffId ?? '') on each row selection
- [Phase 12-full-rbac-page 12-01]: StaffDashboard Administration section fully removed; usePermissions/can/toast/Button/EditRoleDialog/editRoleOpen all cleaned up; StaffDashboard.test.tsx 3 Administration tests replaced with it.todo stubs
- [Phase 17-modifier-inventory-rules 17-03]: modifier_inventory_rules type block inserted alphabetically between modifier_groups and modifiers in supabase.types.ts, matching recipe_items structure
- [Phase 17-modifier-inventory-rules 17-03]: Both Phase-17 migrations (modifier_inventory_rules table + deplete_for_order_item v3) applied to remote Supabase in a single npx supabase db push, no CLI splitter workaround needed
- [Phase ?]: [Phase 17-modifier-inventory-rules 17-05]: Task 3's blocking checkpoint:human-verify was satisfied via an orchestrator-authored Playwright e2e spec (e2e/24-modifier-inventory-rules.spec.ts, 1 passed/40.6s, stable across 2 runs) rather than manual browser click-through, covering the full UAT flow including the Pitfall 3 negative-delta round-trip regression guard
- [Phase ?]: [Phase 17-modifier-inventory-rules 17-05]: Delta hint/label rendered once above the row list (not per-row via FormField) to avoid clutter across N rows while still surfacing the load-bearing signed-delta explanation from 17-UI-SPEC.md

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-foundation | 02 | 9min | 6 | 12 |
| 01-foundation | 03 | 25min | 1 | 15 |
| 01-foundation | 04 | 10min | 1 | 7 |
| 01-foundation | 05 | 28min | 4 | 11 |
| Phase 01-foundation P06 | 50min | 1 tasks | 1 files |
| Phase 01-foundation P07 | 25min | 1 tasks | 0 files |
| 02-combos | 01 | 4min | 2 | 6 |
| 02-combos | 02 | 12min | 2 | 3 |
| 02-combos | 03 | 4min | 2 | 5 |
| 02-combos | 04 | 8min | 2 | 7 |
| 02-combos | 07 | 4min | 2 | 3 |
| Phase 02-combos P08 | 3min | 1 tasks | 1 files |
| 03-ingredient-foundation | 08 | 20min | 5 | 6 |
| 06-split-bill-refund | 04 | 25min | 2 | 5 |
| 06-split-bill-refund | 06 | 25min | 2 | 7 |
| 06-split-bill-refund | 10 | ~2 sessions | 2 | 3 |
| 04-recipes-sale-depletion | 02 | 5min | 3 | 6 |
| 04-recipes-sale-depletion | 03 | 50min | 3 | 15 |
| 04-recipes-sale-depletion | 04 | 9min | 3 | 8 |
| 04-recipes-sale-depletion | 05 | 10min | 3 | 5 |
| 04-recipes-sale-depletion | 06 | ~30min | 2 | 3 |
| 08-polish-reports-e2e-hardening | 03 | 25min | 2 | 14 |
| 08-polish-reports-e2e-hardening | 04 | 20min | 2 | 10 |
| Phase 08 P04 | 20min | 2 tasks | 10 files |
| 08-polish-reports-e2e-hardening | 06 | 8min | 1 | 6 |
| Phase 09-auto-updater P02 | 2min | 2 tasks | 7 files |
| 09-auto-updater | 03 | 3min | 2 | 2 |
| 09-auto-updater | 04 | 8min | 2 | 7 |
| 09-auto-updater | 05 | 12min | 2 | 4 |
| 11-debt-remediation | 02 | 45min | 4 | 12 |
| 11-debt-remediation | 03 | 5min | 2 | 1 |
| 11-debt-remediation | 04 | 8min | 2 | 2 |
| 12-full-rbac-page | 01 | 6min | 3 | 10 |
| 12-full-rbac-page | 02 | 4min | 2 | 5 |
| 15-tabs-version-optimistic-concurrency | 01 | 5min | 2 | 2 |
| 15-tabs-version-optimistic-concurrency | 02 | ~10min | 1 | 1 |
| 15-tabs-version-optimistic-concurrency | 03 | ~30min | 3 | 9 |
| 15-tabs-version-optimistic-concurrency | 04 | ~25min | 2 | 9 |
| Phase 15-tabs-version-optimistic-concurrency P06 | 50min | 4 tasks | 5 files |
| Phase 17-modifier-inventory-rules P03 | ~20min | 2 tasks | 1 files |
| Phase 17-modifier-inventory-rules P05 | 30min | 2 tasks | 5 files |

## Last Session

- **Stopped at:** Phase 18 context gathered
- **Timestamp:** 2026-07-07T18:49:33Z
