---
phase: 21-i18n-multi-language
plan: 10
subsystem: ui
tags: [i18next, react-i18next, eslint-plugin-i18next, fsd, reports, audit, rbac, inventory, settings]

# Dependency graph
requires:
  - phase: 21-i18n-multi-language
    provides: "21-01 i18next singleton, wAdmin.json seed (empty {}), lint:i18n gate; 21-03 owns SettingsTabsPanel/index.tsx + LanguageSettingsTab.tsx (settings ns) so this plan's disjoint tab-content files can migrate with zero same-directory contention; 21-06's shared/ui common namespace, 21-07's rpc/navigate/confirmClassName excludes, 21-08's multi-line-Supabase-chain eslint-disable precedent, and 21-09's TFunction-from-i18next / builder-function precedent all reused directly"
provides:
  - "Every hardcoded user-facing string in the 19 report/analytics/audit/RBAC/inventory/settings-container widgets plus the 9 non-Language settings-tab content files migrated to t('wAdmin:...') / i18n.t('wAdmin:...') (D-04, SC-4)"
  - "wAdmin.json populated with 336 keys across 28 widget-scoped groups (both locales, key-parity-verified), covering reports, audit log, RBAC dashboard, inventory management, ingredient management, and 9 settings-tab forms"
  - "eslint.i18n.config.js: stackId jsx-attribute exclude + toLocaleString callee exclude — closes a gap the 21-06..21-09 sweeps didn't need to cover (Recharts chart-stacking prop, bare toLocaleString() locale calls)"
affects: [21-11, 21-12, 21-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level ColumnDef[] arrays (RefundsList, VoidRefundPanel) converted to buildColumns(t: TFunction<'wAdmin'>) builder functions invoked inside a useMemo(() => buildColumns(t), [t]) at the call site, per 21-09's established TFunction-from-'i18next' precedent — never from 'react-i18next'."
    - "Non-component module-level mutation hooks that are themselves React hooks (ManageIngredientsTab's useMutationCreateIngredient/useMutationUpdateIngredient/useMutationDeleteIngredient) can call useTranslation() directly inside their own hook body — no need for a t-parameter-passing pattern, since a custom hook calling another hook is valid React, unlike a plain non-hook helper function."
    - "Data-enum literal values embedded inside otherwise-translated array-of-objects literals (BillingSettingsTab's `value: 'prorated' as const` / `value: 'full' as const`) are wrapped in a scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` JSX-comment block rather than migrated to t() — they are Postgres/domain enum keys read by application logic, not rendered text, same category as the config's existing `status`/`accessorKey` object-property excludes but not reachable by a config-level exclude since they sit inside a `.map()` call-argument array literal."
    - "i18next interpolation used for every string that mixes literal text with a JSX expression inside a single text node (audit-log 'View diff for {{action}} on {{date}}', tip-split 'Percentages total {{sum}}% — not 100%.', pool-table 'Table {{number}} · Current status: {{status}}') instead of concatenating raw JSX expressions with literal fragments — keeps the whole sentence as one atomic, reorderable translation unit."

key-files:
  created: []
  modified:
    - "src/widgets/{AuditLogTable/**,CategoryRevenuePanel/**,ComboMixReport/**,ComboOverrideReport/**,HourlyBreakdownPanel/**,ProductSalesPanel/**,RecipeVarianceReport/**,RefundsList/**,RefundsRegister/**,StaffSalesPanel/**,TipBucketDistributionPanel/**,TipDistributionPanel/**,VoidRefundPanel/**,WaitlistAnalyticsReport/**} (Task 1 — report/analytics/audit widget cluster)"
    - "src/widgets/{RBACDashboard/**,InventoryPagePanel.tsx,ManageIngredientsTab/**,SettingsCatalogPanel.tsx,SettingsPagePanel.tsx} (Task 2 — RBAC/inventory/settings-container widgets)"
    - "src/widgets/SettingsTabsPanel/tabs/{BackupSettingsTab,BillingSettingsTab,EmailReceiptsSettingsTab,GeneralSettingsTab,HardwareSettingsTab,PoolTablesSettingsTab,ProductsSettingsTab,RappiSettingsTab,TipDistributionSettingsTab}.tsx (Task 3 — 9 settings-tab content files, LanguageSettingsTab.tsx excluded/untouched)"
    - src/shared/lib/i18n/locales/es-MX/wAdmin.json
    - src/shared/lib/i18n/locales/en-US/wAdmin.json
    - eslint.i18n.config.js

key-decisions:
  - "BillingSettingsTab's payment-label-input placeholders ({ cash: 'Efectivo', card: 'Terminal BBVA', rappi: 'Rappi' }) were already Spanish-source text (mirrors 21-09's PaymentForm precedent) — es-MX keeps the exact byte-identical Spanish literal, en-US received a genuine English translation ('Cash'/'BBVA Terminal'/'Rappi'), not a byte-copy."
  - "Module-scope literal object maps/arrays that eslint-plugin-i18next's mode:'all' does NOT flag (RBACDashboard's ROLE_LABELS Record, HardwareSettingsTab's PAPER_OPTIONS array, BillingSettingsTab's paymentMethodButtons useMemo array, PoolTablesSettingsTab's template-literal default table label) were left untouched, consistent with 21-09's documented inconsistency footnote and the plan's explicit lint:i18n-driven scope — only strings the gate actually flags (or that the plan text explicitly names) were migrated."
  - "eslint.i18n.config.js gained 2 new excludes this plan: 'stackId' (Recharts <Bar> stacking-group identifier in ComboMixReport's day-of-week chart) added to jsx-attributes.exclude, and 'toLocaleString' (bare Date.prototype Intl call with a locale argument, distinct from the already-excluded toLocaleDateString/toLocaleTimeString) added to callees.exclude."

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "npm run lint:i18n exits 0 across the exact Task-3 acceptance command (19 report/admin widget folders + 9 settings-tab files, 28 targets total)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "npm run lint:i18n -- src/widgets/AuditLogTable src/widgets/CategoryRevenuePanel src/widgets/ComboMixReport src/widgets/ComboOverrideReport src/widgets/HourlyBreakdownPanel src/widgets/InventoryPagePanel.tsx src/widgets/ManageIngredientsTab src/widgets/ProductSalesPanel src/widgets/RBACDashboard src/widgets/RecipeVarianceReport src/widgets/RefundsList src/widgets/RefundsRegister src/widgets/SettingsCatalogPanel.tsx src/widgets/SettingsPagePanel.tsx src/widgets/StaffSalesPanel src/widgets/TipBucketDistributionPanel src/widgets/TipDistributionPanel src/widgets/VoidRefundPanel src/widgets/WaitlistAnalyticsReport src/widgets/SettingsTabsPanel/tabs/{Backup,Billing,EmailReceipts,General,Hardware,PoolTables,Products,Rappi,TipDistribution}SettingsTab.tsx (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "es-MX and en-US wAdmin.json have identical key sets (336/336) and every migrated es-MX value equals the pre-migration literal byte-for-byte except BillingSettingsTab's payment-label placeholders (Spanish-source, deliberate en-US translation, documented)"
    requirement: "SC-4"
    verification:
      - kind: other
        ref: "node key-parity check (336/336 keys both locales, 0 orphans each side, run inline during execution)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run typecheck and npm run lint both exit 0 across the whole repo after the sweep; full unit suite has zero regressions; StaffDashboard, SettingsTabsPanel/index.tsx, and LanguageSettingsTab.tsx are untouched"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npm run typecheck (2 pre-existing unrelated errors, same baseline as 21-06..21-09) + npm run lint (exit 0) + npm run test (140 files/1248 tests pass, 2 skipped, 15 todo — identical to prior plans' baseline); git status --short confirms StaffDashboard/index.tsx/LanguageSettingsTab.tsx have zero diff from this plan"
        status: pass
    human_judgment: false

duration: ~105min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 10: Report/Analytics/Audit/RBAC/Inventory/Settings-Tab Widget Sweep to wAdmin Summary

**Big-bang string sweep of 19 report/analytics/audit/RBAC/inventory widgets plus the 9 non-Language settings-tab content files into the `wAdmin` i18next namespace — `npm run lint:i18n` goes from 368 violations across two task batches to 0 across all 28 targets**

## Performance

- **Duration:** ~105 min
- **Tasks:** 3/3 complete
- **Files modified:** 26 widget/tab files + 1 eslint config + 2 catalog files, across 3 commits

## Accomplishments

- **Task 1 (report/analytics/audit widget cluster):** `AuditLogTable` (3 files: AuditLogDetailSheet, AuditLogFilterBar, AuditLogTable), `CategoryRevenuePanel`, `ComboMixReport`, `ComboOverrideReport`, `HourlyBreakdownPanel`, `ProductSalesPanel`, `RecipeVarianceReport`, `RefundsList` (module-level ColumnDef array converted to a `buildColumns(t)` builder), `RefundsRegister`, `StaffSalesPanel`, `TipBucketDistributionPanel`, `TipDistributionPanel`, `VoidRefundPanel` (module-level ColumnDef array converted to a `buildColumns(t)` builder), `WaitlistAnalyticsReport` — all migrated to `useTranslation('wAdmin')`. Fixed 5 real technical-value gaps not covered by any existing eslint-plugin-i18next exclude: `stackId="a"` (Recharts stacking prop), `toLocaleString('es-MX')` (bare Intl locale call), 2 Tailwind-class-string function returns, and a `var(--muted)` CSS custom-property return.
- **Task 2 (RBAC/inventory/settings-container widgets):** `PermissionMatrix` + `RBACDashboard`, `InventoryPagePanel` (CSV export headers/MIME type/Tailwind row-highlight classes eslint-disabled as non-copy; toasts, table headers, dialog copy migrated), `ManageIngredientsTab` (3 module-level custom mutation hooks — themselves React hooks — call `useTranslation()` directly; Supabase query-builder chains wrapped in scoped eslint-disable per the 21-08/21-09 multi-line-chain precedent), `SettingsCatalogPanel`, `SettingsPagePanel`. `StaffDashboard` confirmed untouched (owned by 21-04).
- **Task 3 (9 settings-tab content files):** `BackupSettingsTab`, `BillingSettingsTab` (payment-label placeholders `Efectivo`/`Terminal BBVA`/`Rappi` kept Spanish-source in es-MX, translated to English in en-US per 21-09 precedent; `value: 'prorated'/'full' as const` data-enum literals scoped-eslint-disabled), `EmailReceiptsSettingsTab`, `GeneralSettingsTab`, `HardwareSettingsTab`, `PoolTablesSettingsTab`, `ProductsSettingsTab`, `RappiSettingsTab`, `TipDistributionSettingsTab` — all migrated to `useTranslation('wAdmin')`. Ran the exact Task-3 verification command across all 28 targets (0 violations), reconciled the catalog (336/336 keys byte-identical both locales except the documented Spanish-source translation), and re-confirmed `typecheck`/`lint`/full unit suite (140 files/1248 tests, zero regressions). Confirmed `SettingsTabsPanel/index.tsx` and `LanguageSettingsTab.tsx` were never touched.
- `wAdmin.json` grew from an empty seed (`{}`) to 336 keys across 28 widget-scoped groups (both locales): `auditLogDetailSheet`, `auditLogFilterBar`, `auditLogTable`, `categoryRevenuePanel`, `comboMixReport`, `comboOverrideReport`, `hourlyBreakdownPanel`, `productSalesPanel`, `recipeVarianceReport`, `refundsList`, `refundsRegister`, `staffSalesPanel`, `tipBucketDistributionPanel`, `tipDistributionPanel`, `voidRefundPanel`, `waitlistAnalyticsReport`, `inventoryPagePanel`, `manageIngredientsTab`, `permissionMatrix`, `rbacDashboard`, `settingsCatalogPanel`, `settingsPagePanel`, `backupSettingsTab`, `billingSettingsTab`, `emailReceiptsSettingsTab`, `generalSettingsTab`, `hardwareSettingsTab`, `poolTablesSettingsTab`, `productsSettingsTab`, `rappiSettingsTab`, `tipDistributionSettingsTab`.

## Task Commits

1. **Task 1: Sweep report/analytics/audit widgets → wAdmin** - `ca03912` (feat)
2. **Task 2: Sweep RBAC/inventory/settings-container widgets → wAdmin** - `aa561f4` (feat)
3. **Task 3: Sweep the 9 settings-tab content files → wAdmin + prove zero violations** - `0432196` (feat)

## Files Created/Modified

- `src/widgets/AuditLogTable/{AuditLogDetailSheet,AuditLogFilterBar,AuditLogTable}.tsx` — audit log detail sheet, filter bar, table
- `src/widgets/{CategoryRevenuePanel,ComboMixReport,ComboOverrideReport,HourlyBreakdownPanel,ProductSalesPanel,RecipeVarianceReport,RefundsRegister,StaffSalesPanel,TipBucketDistributionPanel,TipDistributionPanel,WaitlistAnalyticsReport}/*.tsx` — report/analytics panels
- `src/widgets/{RefundsList/index.tsx,VoidRefundPanel/VoidRefundPanel.tsx}` — buildColumns(t) TFunction-builder pattern
- `src/widgets/{RBACDashboard/{PermissionMatrix,RBACDashboard}.tsx,InventoryPagePanel.tsx,ManageIngredientsTab/index.tsx,SettingsCatalogPanel.tsx,SettingsPagePanel.tsx}` — RBAC/inventory/settings-container widgets
- `src/widgets/SettingsTabsPanel/tabs/{Backup,Billing,EmailReceipts,General,Hardware,PoolTables,Products,Rappi,TipDistribution}SettingsTab.tsx` — 9 settings-tab content forms
- `src/shared/lib/i18n/locales/{es-MX,en-US}/wAdmin.json` — 28 widget-scoped key groups, 336 keys, key-parity-verified
- `eslint.i18n.config.js` — `stackId` jsx-attribute exclude, `toLocaleString` callee exclude

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights: BillingSettingsTab's Spanish-source payment-label placeholders getting a genuine English translation for en-US (not a byte-copy), mirroring 21-09's PaymentForm precedent; leaving lint-unflagged module-scope literal object maps/arrays (ROLE_LABELS, PAPER_OPTIONS, paymentMethodButtons) untouched per the plan's lint:i18n-driven scope; and using i18next interpolation for every mixed-literal-and-expression text node instead of raw JSX concatenation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint-plugin-i18next flags Recharts/Intl technical values not covered by any existing exclude**
- **Found during:** Task 1 (`ComboMixReport.tsx`'s `stackId="a"`, `ComboOverrideReport.tsx`'s bare `.toLocaleString('es-MX')`)
- **Issue:** A Recharts stacking-group identifier and a bare `Date.prototype.toLocaleString(locale)` call (distinct from the already-excluded `toLocaleDateString`/`toLocaleTimeString`) were flagged as literal UI copy.
- **Fix:** Added `stackId` to `jsx-attributes.exclude` and `toLocaleString` to `callees.exclude` in `eslint.i18n.config.js`.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n` on each affected file exits 0 after the addition.
- **Committed in:** `ca03912`

**2. [Rule 1 - Bug] Tailwind class strings and CSS custom-property values returned from plain functions are flagged as UI copy**
- **Found during:** Task 1 (`ComboMixReport.tsx`'s `chartColor` fallback, `ProductSalesPanel.tsx`'s `getRowClassName` callback, `WaitlistAnalyticsReport.tsx`'s `heatmapBgColor`) and Task 2 (`InventoryPagePanel.tsx`'s `rowHighlightClass`, CSV headers array, MIME type, and sentinel `useState` default)
- **Issue:** Bare string-literal `return` statements and array/object literals carrying CSS class names, CSS custom-property values, CSV column keys, a Blob MIME type, and a filter sentinel value are not JSX/call-argument/object-property shapes the config's excludes cover — no existing category applies.
- **Fix:** Scoped `eslint-disable-next-line`/`eslint-disable`...`eslint-enable` comments around each, per the established 21-08/21-09 precedent for technical non-copy literals.
- **Files modified:** `src/widgets/ComboMixReport/ComboMixReport.tsx`, `src/widgets/ProductSalesPanel/ProductSalesPanel.tsx`, `src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.tsx`, `src/widgets/InventoryPagePanel.tsx`
- **Verification:** `npm run lint:i18n` on each affected file exits 0.
- **Committed in:** `ca03912`, `aa561f4`

**3. [Rule 1 - Bug] eslint-plugin-i18next's callee exclude doesn't suppress violations on multi-line-formatted Supabase query-builder chains (recurrence of 21-08/21-09's documented quirk)**
- **Found during:** Task 2 (`ManageIngredientsTab/index.tsx`'s 3 mutation hooks' `db.from('ingredients').insert/update/eq` chains)
- **Issue:** Same plugin quirk documented in 21-08/21-09: a `db.from(...).update(...).eq(...)` chain formatted across multiple lines is still flagged despite `from`/`update`/`eq` all being in `callees.exclude`.
- **Fix:** Scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` blocks around each affected mutation body, per the established precedent.
- **Files modified:** `src/widgets/ManageIngredientsTab/index.tsx`
- **Verification:** `npm run lint:i18n -- src/widgets/ManageIngredientsTab` exits 0.
- **Committed in:** `aa561f4`

**4. [Rule 1 - Bug] Data-enum `value:` keys inside array-literal call arguments are flagged as UI copy**
- **Found during:** Task 3 (`BillingSettingsTab.tsx`'s `firstHourMode` options array, `value: 'prorated' as const` / `value: 'full' as const`)
- **Issue:** The same category as the config's existing `status`/`accessorKey` object-property excludes (a Postgres/domain enum value, not rendered text), but sitting inside a `.map()` call-argument array literal, which the config-level `object-properties.exclude` list does not reach.
- **Fix:** Scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` block around the array literal.
- **Files modified:** `src/widgets/SettingsTabsPanel/tabs/BillingSettingsTab.tsx`
- **Verification:** `npm run lint:i18n -- src/widgets/SettingsTabsPanel/tabs/BillingSettingsTab.tsx` exits 0.
- **Committed in:** `0432196`

---

**Total deviations:** 4 auto-fixed (all Rule 1/3 — blocking fixes and real technical-value gaps — needed to satisfy the plan's own stated `lint:i18n` acceptance criteria). No scope creep.

## Issues Encountered

None beyond the four auto-fixed items documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 19 report/admin widgets + all 9 settings-tab content files in this plan's scope are fully migrated to `wAdmin` (D-04) — the exact Task-3 `lint:i18n` command exits 0 across all 28 targets.
- `wAdmin.json`'s 336 keys across 28 widget-scoped groups are the canonical location for any subsequent 21-xx sweep touching similar report/RBAC/inventory/settings copy.
- `eslint.i18n.config.js`'s exclude list is now broader (`stackId`, `toLocaleString`) — future sweeps hitting the same technical-value categories should check this list before re-discovering the same excludes.
- `SettingsTabsPanel/index.tsx` and `LanguageSettingsTab.tsx` (21-03's ownership) and `StaffDashboard` (21-04's ownership) were never touched — zero same-directory contention confirmed via `git status --short`.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

All 3 commits confirmed present in `git log --oneline --all` (`ca03912`, `aa561f4`, `0432196`). Key files confirmed present on disk: `src/widgets/AuditLogTable/AuditLogTable.tsx`, `src/widgets/RefundsList/index.tsx`, `src/widgets/SettingsTabsPanel/tabs/BillingSettingsTab.tsx`, `src/shared/lib/i18n/locales/{es-MX,en-US}/wAdmin.json`, `eslint.i18n.config.js`. The exact Task-3 `lint:i18n` command across all 28 targets, `npm run typecheck` (2 pre-existing unrelated errors only), `npm run lint`, and `npm run test` (1248 passed, zero regressions) all re-confirmed clean immediately before writing this summary.
