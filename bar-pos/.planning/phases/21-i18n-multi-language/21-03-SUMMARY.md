---
phase: 21-i18n-multi-language
plan: 03
subsystem: i18n
tags: [react-i18next, rbac, settings, fsd]

# Dependency graph
requires: ["21-01", "21-02"]
provides:
  - "LanguageSettingsTab — self-service locale switcher, no ProtectedAction wrapper"
  - "SettingsTabsPanel restructured: role-agnostic Language tab pushed outside both manage_settings/manage_products gates, first in the tab list"
  - "settings namespace populated: 10 UI-SPEC Language-tab keys + 12 existing tab labels + noPermission fallback (both locales)"
  - "eslint.i18n.config.js: 'can' callee + 'key' object-property exclusions (structural RBAC/list-key literals, not UI copy)"
affects: [21-04, 21-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-service settings surfaces must NOT be wrapped in ProtectedAction — D-03 requires every authenticated role incl. bartender to reach them"
    - "A role-agnostic tab entry is pushed OUTSIDE all role-gated if-blocks and FIRST in the array, guaranteeing tabs[] is never empty and giving bartenders a sane default tab (resolves RESEARCH Pitfall 1)"
    - "eslint.i18n.config.js object-properties/callees excludes now cover 'key' (React/data list keys) and 'can(...)' (RBAC action identifiers) — structural literals that are not UI copy, distinct from JSX-attribute excludes already present"

key-files:
  created:
    - src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx
    - src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx
  modified:
    - src/widgets/SettingsTabsPanel/index.tsx
    - src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx
    - src/shared/lib/i18n/locales/es-MX/settings.json
    - src/shared/lib/i18n/locales/en-US/settings.json
    - eslint.i18n.config.js

key-decisions:
  - "Dropped the GeneralSettingsTab-style hydration useEffect (currentStaff -> setLocale, guarded by !dirty) from LanguageSettingsTab — the component only ever renders behind ProtectedRoute, so currentStaff is already populated at mount; a useState initializer is sufficient and avoids a react-hooks/set-state-in-effect eslint-disable comment that the standalone eslint.i18n.config.js doesn't recognize (that config doesn't load eslint-plugin-react-hooks, so the disable directive itself errors as 'rule not found')"
  - "Extended eslint.i18n.config.js with 'object-properties': { exclude: ['key'] } and added 'can' to callees.exclude — SettingsTabsPanel's tab-assembly array uses `key: 'general'` (React/lookup keys) and `can('manage_settings')` (RBAC action identifiers) literals that are structural, not translatable UI copy; without these excludes the plan's own required `npm run lint:i18n -- src/widgets/SettingsTabsPanel/index.tsx` acceptance criterion could not pass"
  - "SettingsTabsPanel.test.tsx now imports the real '@shared/lib/i18n' singleton (not mocked) so its existing tab-label assertions ('General', 'Products', 'Backup', etc.) double as a live es-MX byte-identical-migration check; only the brand-new 'language' tab entry needed a locale-aware assertion ('Idioma', matching D-02's es-MX default) since the phase catalog rule intentionally allows proper Spanish for genuinely new UI elements"

patterns-established:
  - "Non-ProtectedAction settings surfaces are the pattern for any future self-service (not admin-gated) settings tab"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "LanguageSettingsTab renders a Select pre-selected to the current staff's locale, tracks dirty state, and is not wrapped in ProtectedAction"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx — 4/4 pass"
        status: pass
      - kind: other
        ref: "grep -n \"ProtectedAction\" src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx — no matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "On successful save, i18n.changeLanguage(locale) fires + success toast + dirty clears; on failure, error toast fires and the selection is not reverted"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx#on successful mutation / #on failed mutation"
        status: pass
    human_judgment: false
  - id: D3
    description: "SettingsTabsPanel pushes a role-agnostic Language tab entry outside both manage_settings/manage_products gates; it is the default tab for a bartender with neither permission"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx#shows the role-agnostic Language tab as the default tab for a bartender with neither permission (D-03, Pitfall 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing SettingsTabsPanel tab labels + no-permission fallback migrated to the settings namespace with byte-identical es-MX values"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx — existing 2 tests still pass against the real i18n singleton (es-MX default), asserting literal 'General'/'Products'/'Backup'/'Pool Tables'/'Billing' text"
        status: pass
      - kind: other
        ref: "npm run lint:i18n -- src/widgets/SettingsTabsPanel/index.tsx (exit 0) + src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx (exit 0)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-17
status: complete
---

# Phase 21 Plan 03: Self-Service Language Switcher Summary

**Role-agnostic "Language" tab in SettingsTabsPanel (self-service `set_own_locale` write, no ProtectedAction) plus migration of the panel's own tab labels and no-permission fallback into the `settings` i18next namespace**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 complete
- **Files modified:** 4 modified, 2 created (6 total across both commits)

## Accomplishments

- `LanguageSettingsTab.tsx` — clones `GeneralSettingsTab`'s dirty-tracking save form pattern, swapped to a single locale `Select` (`LocaleSchema.options`-driven); calls `useMutationSetOwnLocale()` (the self-service RPC path from 21-02, not the admin path) on Save; fires `i18n.changeLanguage(locale)` only on success (avoids a half-saved state); deliberately **not** wrapped in `ProtectedAction` so every role including bartender can reach it
- `settings.json` (both locales) seeded with the 10 UI-SPEC Language-tab keys (`tabs.language`, `language.heading/fieldLabel/option.esMX/option.enUS/helper/save/saving/saveSuccess/saveError`) — es-MX carries genuine Spanish copy (this is brand-new UI, not a migrated literal, so proper Spanish is safe per the phase's copy rule)
- `SettingsTabsPanel`'s tab-assembly `useMemo` restructured: a third, unconditional tab entry (`language`) is pushed first, outside both the `canManageSettings` and `canManageProducts` gates — guarantees `tabs[]` is never empty for any authenticated role and makes Language the default tab for a bartender (resolves RESEARCH.md Pitfall 1)
- The panel's own pre-existing hardcoded strings (12 tab labels + the "You do not have permission..." fallback) migrated to `t('settings:tabs.*')` / `t('settings:noPermission')`; es-MX catalog values are byte-identical to the pre-migration English literals (zero visual regression)
- `eslint.i18n.config.js` extended with an `object-properties` exclude for `key` and a `callees` exclude for `can` so the tab-assembly array's structural `key: 'general'` / `can('manage_settings')` literals don't trip the i18next lint gate

## Task Commits

1. **Task 1: LanguageSettingsTab (self-service locale switcher)** — `9c9d2f6` (feat)
2. **Task 2: Restructure SettingsTabsPanel — role-agnostic Language tab + migrate labels** — `63b276d` (feat)

## Files Created/Modified

- `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx` — new self-service locale switcher
- `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx` — 4 behavior tests
- `src/widgets/SettingsTabsPanel/index.tsx` — role-agnostic Language tab entry + label/fallback migration
- `src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx` — mocks `LanguageSettingsTab`, imports the real i18n singleton, adds a bartender-default-tab regression test
- `src/shared/lib/i18n/locales/{es-MX,en-US}/settings.json` — 10 Language-tab keys + 12 tab-label keys + `noPermission`
- `eslint.i18n.config.js` — `object-properties`/`callees` excludes for `key`/`can`

## Decisions Made

- Dropped the analog's hydration `useEffect` (currentStaff → setLocale, dirty-guarded) since `LanguageSettingsTab` only ever renders behind `ProtectedRoute` (staff already hydrated at mount); this also sidesteps a `react-hooks/set-state-in-effect` eslint-disable comment that the standalone `eslint.i18n.config.js` can't resolve (it doesn't load `eslint-plugin-react-hooks`, so the directive itself errors as "rule not found") — the same latent issue already exists, unfixed, in the still-unmigrated `GeneralSettingsTab.tsx`/`RappiSettingsTab.tsx`/`TipDistributionSettingsTab.tsx`.
- Extended `eslint.i18n.config.js`'s `no-literal-string` options with `'object-properties': { exclude: ['key'] }` and added `'can'` to `callees.exclude` — required to get the plan's own acceptance criterion (`npm run lint:i18n -- src/widgets/SettingsTabsPanel/index.tsx` exits 0) passing against the tab-assembly array's structural `key:`/`can(...)` literals.
- `SettingsTabsPanel.test.tsx` now imports the real `@shared/lib/i18n` singleton instead of mocking `react-i18next` — turns the pre-existing label assertions into a live es-MX parity check for free, and only the new `language` tab needed a locale-specific assertion (`'Idioma'`, the genuine es-MX translation) since D-02 defaults `i18n.language` to `es-MX`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint.i18n.config.js rejected structural `key:`/`can(...)` literals in the tab-assembly array**
- **Found during:** Task 2 verification (`npm run lint:i18n -- src/widgets/SettingsTabsPanel/index.tsx`)
- **Issue:** `eslint-plugin-i18next`'s `no-literal-string` rule (`mode: 'all'`) flagged every `key: 'general'`-style object-literal property and every `can('manage_settings')` call argument as an untranslated string — these are structural identifiers, not UI copy, but the existing exclude lists (`jsx-attributes`, `callees`) didn't cover object-literal property values or the `can` helper.
- **Fix:** Added `'object-properties': { exclude: ['key'] }` (skips any object literal property literally named `key`) and appended `'can'` to `callees.exclude` in `eslint.i18n.config.js`.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n -- src/widgets/SettingsTabsPanel/index.tsx` exits 0; `npm run lint:i18n -- src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx` still exits 0 (no regression).
- **Committed in:** `63b276d` (Task 2 commit)

**2. [Rule 1 - Bug] Restructuring SettingsTabsPanel broke the existing SettingsTabsPanel.test.tsx**
- **Found during:** Task 2 verification (full unit run)
- **Issue:** The panel now always mounts `LanguageSettingsTab` (all `TabsContent` render eagerly, not lazily) which calls `useMutationSetOwnLocale()` → `useQueryClient()`, throwing "No QueryClient set" outside a provider; separately, migrating labels to `t()` meant the two existing tests' literal-string assertions ('General', 'Products', etc.) needed a real i18n instance to resolve instead of returning raw keys.
- **Fix:** Added a `vi.mock('./tabs/LanguageSettingsTab', ...)` stub (matching the existing per-tab mock pattern in this file) and imported the real `@shared/lib/i18n` singleton so `t()` resolves to actual catalog values; added a third test proving Language is the default tab for a bartender with neither permission.
- **Files modified:** `src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx`
- **Verification:** `npx vitest run src/widgets/SettingsTabsPanel/SettingsTabsPanel.test.tsx` — 3/3 pass; full `npm run test` — 139 files / 1240 tests pass, 15 todo, 2 skipped, zero regressions vs. the 21-02 baseline.
- **Committed in:** `63b276d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking eslint-config fix, 1 bug-fix test-fallout repair). Both necessary to satisfy the plan's own stated acceptance criteria. No scope creep.

## Issues Encountered

None beyond the two auto-fixed items documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Settings-ns keys owned by this plan** (21-11's admin sweep must NOT re-touch these): `settings:tabs.language`, `settings:tabs.general`, `settings:tabs.hardware`, `settings:tabs.rappi`, `settings:tabs.email`, `settings:tabs.backup`, `settings:tabs.tipSplit`, `settings:tabs.products`, `settings:tabs.pool`, `settings:tabs.billing`, `settings:tabs.combos`, `settings:tabs.promotions`, `settings:tabs.ingredients`, `settings:noPermission`, and the full `settings:language.*` subtree (`heading`, `fieldLabel`, `option.esMX`, `option.enUS`, `helper`, `save`, `saving`, `saveSuccess`, `saveError`) — i.e. all of `src/widgets/SettingsTabsPanel/index.tsx` and `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx`.
- The individual tab bodies (`GeneralSettingsTab.tsx`, `HardwareSettingsTab.tsx`, `RappiSettingsTab.tsx`, `EmailReceiptsSettingsTab.tsx`, `BackupSettingsTab.tsx`, `TipDistributionSettingsTab.tsx`, `ProductsSettingsTab.tsx`, `PoolTablesSettingsTab.tsx`, `BillingSettingsTab.tsx`) still contain hardcoded strings (confirmed still failing `lint:i18n` in this session) — untouched by 21-03, in scope for a later sweep plan.
- 21-04 (admin per-staff locale field on the Staff page) can proceed independently — it uses the separate `useMutationUpdateStaffLocale` admin path already shipped in 21-02, no dependency on this plan's UI.
- `eslint.i18n.config.js`'s widened `object-properties`/`callees` excludes are available to every subsequent 21-xx sweep plan touching similar `key:`/`can(...)` patterns.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created files confirmed on disk (`src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.tsx`, `src/widgets/SettingsTabsPanel/tabs/LanguageSettingsTab.test.tsx`, this SUMMARY.md). Both task commits (`9c9d2f6`, `63b276d`) confirmed present in `git log`.
