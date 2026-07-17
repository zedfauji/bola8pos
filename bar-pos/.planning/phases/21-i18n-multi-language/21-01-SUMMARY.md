---
phase: 21-i18n-multi-language
plan: 01
subsystem: i18n
tags: [react-i18next, i18next, eslint-plugin-i18next, fsd, eslint]

# Dependency graph
requires: []
provides:
  - "i18next singleton initialized in src/shared/lib/i18n/index.ts (shared layer, not app — FSD boundary requirement)"
  - "20 catalog JSON files (10 namespaces x es-MX/en-US), common seeded, 18 empty pending later sweeps"
  - "main.tsx wired to init i18next before first render"
  - "eslint.i18n.config.js + npm run lint:i18n — the per-sweep completeness gate every later 21-xx plan uses"
affects: [21-02, 21-03, 21-04, 21-05, 21-06, 21-07, 21-08, 21-09, 21-10, 21-11, 21-12]

# Tech tracking
tech-stack:
  added: [react-i18next@17.0.10, i18next@26.3.6, eslint-plugin-i18next@6.1.5]
  patterns:
    - "i18next singleton lives in src/shared/lib/i18n (shared, not app) so entities/features/widgets/pages can all import it under FSD boundary rules"
    - "Statically-bundled JSON resources passed to i18next.init({ resources }) — no i18next-http-backend, no i18next-browser-languagedetector (offline Tauri app, locale is staff-driven)"
    - "Catalog namespaces are domain-area flat files (common, featOrders, featMgmt, wPanels, wAdmin, entities, pages, settings, staff, receipt), not per-FSD-layer or per-file"
    - "eslint.i18n.config.js is a standalone flat-config file, deliberately separate from the committed eslint.config.js gate, until 21-12 folds an equivalent block in and deletes this helper"

key-files:
  created:
    - src/shared/lib/i18n/index.ts
    - src/shared/lib/i18n/index.test.ts
    - src/shared/lib/i18n/locales/es-MX/*.json (10 files)
    - src/shared/lib/i18n/locales/en-US/*.json (10 files)
    - eslint.i18n.config.js
  modified:
    - package.json (deps + lint:i18n script)
    - package-lock.json
    - src/main.tsx

key-decisions:
  - "Package legitimacy checkpoint (Task 1) approved by user after verifying react-i18next@17.0.10, i18next@26.3.6, eslint-plugin-i18next@6.1.5 on npmjs.com — all three official/high-download, flagged SUS only by the automated 'too-new latest-patch' heuristic"
  - "npm rewrote all three installs to caret ranges; edited package.json to exact pins and re-ran npm install to sync package-lock.json (same precedent as eslint-plugin-tailwindcss in Phase 35)"
  - "Phase-wide catalog rule: es-MX value MUST equal the exact current on-screen literal byte-for-byte (default locale, Phase 34 visual baseline depends on it); en-US value is the English rendering. Applies to every later plan writing a catalog."
  - "eslint.i18n.config.js needed its own base config object matching **/*.{ts,tsx} extending typescript-eslint's recommended config, otherwise files outside the i18next-scoped globs (e.g. src/shared/lib/**) were reported as 'ignored' (a warning, which --max-warnings 0 then failed on) instead of trivially passing"

patterns-established:
  - "Non-component translation (toasts, PDF docs, Rust payload) uses the imported i18n singleton's .t() method directly, not the useTranslation() hook — documented in RESEARCH.md Pattern 3, seeded here via the singleton export"
  - "declare module 'i18next' t()-key type augmentation deliberately skipped (ponytail note in index.ts) — runtime + lint:i18n enforce correctness instead; revisit once key set stabilizes post-migration"

requirements-completed: [SC-1, SC-3]

coverage:
  - id: D1
    description: "i18next singleton initialized in shared layer; app boots with t('common:actions.save') resolving to 'Save' in both es-MX and en-US"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/i18n/index.test.ts#i18n singleton"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run lint:i18n runs eslint-plugin-i18next's no-literal-string rule (mode:'all') against the 5 UI layers and exits 0 on an already-clean file, non-zero on a hardcoded string"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "npm run lint:i18n -- src/shared/lib/i18n/index.ts (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint --config eslint.i18n.config.js against a throwaway <div>Hardcoded</div> fixture in src/shared/ui/ — 1 error reported (i18next/no-literal-string), fixture deleted before commit"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-07-17
status: complete
---

# Phase 21 Plan 01: i18next Infrastructure Bootstrap Summary

**react-i18next singleton wired in the shared FSD layer with 10 statically-bundled domain-namespace catalogs (es-MX default) and a standalone `eslint-plugin-i18next` gate (`lint:i18n`) for every later migration sweep**

## Performance

- **Duration:** ~25 min (continuation from Task 1's approved checkpoint)
- **Tasks:** 2 (Task 1's checkpoint was pre-approved by the human before this continuation)
- **Files modified:** 24 (Task 2) + 3 (Task 3) = 27 total across both commits

## Accomplishments
- Installed `react-i18next@17.0.10`, `i18next@26.3.6`, `eslint-plugin-i18next@6.1.5` at exact pinned versions (human-approved per Task 1's package-legitimacy checkpoint)
- Created `src/shared/lib/i18n/index.ts` — the i18next singleton, initialized with `initReactI18next`, `lng`/`fallbackLng: 'es-MX'` (D-02), `escapeValue: false` (safe because React auto-escapes JSX children, T-21-04), no HTTP backend or browser language detector
- Scaffolded all 20 catalog JSON files (10 namespaces x 2 locales); `common.json` seeded with `actions.save/cancel/saving`, byte-identical across both locales; remaining 18 files are `{}` pending later sweep plans
- Wired `src/main.tsx` to import the singleton as the first local import, before `App`, so init runs synchronously before first render
- Wrote `src/shared/lib/i18n/index.test.ts` (3 passing assertions: es-MX default `t()`, en-US `changeLanguage()` round-trip, D-02 fallbackLng)
- Created standalone `eslint.i18n.config.js` wiring `eslint-plugin-i18next`'s `no-literal-string` rule with `mode: 'all'` (Pitfall 5) scoped to `shared/ui`, `entities`, `features`, `widgets`, `pages`; added `lint:i18n` npm script
- Manually verified the rule fires on a hardcoded JSX text fixture and not on a `t()`-wrapped one (fixture created, tested, deleted — never committed)

## Task Commits

1. **Task 2: Install packages + create i18next singleton in shared layer** - `aa434cb` (feat)
2. **Task 3: i18n init unit test + eslint.i18n.config.js helper + lint:i18n script** - `1128056` (test)

_Task 1 (package legitimacy checkpoint) required no commit — verification-only gate, approved by the user before this continuation began._

## Files Created/Modified
- `src/shared/lib/i18n/index.ts` - i18next singleton init (statically bundled resources, es-MX default/fallback)
- `src/shared/lib/i18n/index.test.ts` - 3 assertions covering SC-1
- `src/shared/lib/i18n/locales/{es-MX,en-US}/{common,featOrders,featMgmt,wPanels,wAdmin,entities,pages,settings,staff,receipt}.json` - 20 catalog files
- `src/main.tsx` - added `import '@shared/lib/i18n';` as first local import
- `eslint.i18n.config.js` - standalone flat-config i18next lint gate (`lint:i18n`)
- `package.json` / `package-lock.json` - 3 new deps at exact pins + `lint:i18n` script

## Decisions Made
- npm rewrote all three package installs to caret ranges on first install; edited `package.json` to the exact pins (`17.0.10`, `26.3.6`, `6.1.5`) and re-ran `npm install` to sync `package-lock.json` — same precedent as the Phase 35 `eslint-plugin-tailwindcss` pin.
- `eslint.i18n.config.js` needed an extra base config object (`files: ['**/*.{ts,tsx}']`, extending `tseslint.configs.recommended`) so files outside the i18next-scoped globs (e.g. `src/shared/lib/**`) are "seen" by ESLint instead of reported as an ignored-file warning (which `--max-warnings 0` then failed on) — without this, the acceptance criterion "`npm run lint:i18n -- src/shared/lib/i18n/index.ts` exits 0" would not hold.
- Test assertion for `i18n.options.fallbackLng` checks `toEqual(['es-MX'])`, not `toBe('es-MX')` — i18next normalizes a string `fallbackLng` option into an array internally at runtime.

## Deviations from Plan

None beyond the two implementation details above (caret-range pin fix was explicitly anticipated by the plan text itself; the eslint base-config addition and the fallbackLng array-normalization are both Rule 1 auto-fixes needed to satisfy the plan's own stated acceptance criteria) - plan executed as written.

### Auto-fixed Issues

**1. [Rule 1 - Bug] eslint.i18n.config.js reported shared/lib files as "ignored" instead of exiting 0**
- **Found during:** Task 3 verification (`npm run lint:i18n -- src/shared/lib/i18n/index.ts`)
- **Issue:** The config only had one config object scoped to `shared/ui`/`entities`/`features`/`widgets`/`pages`; ESLint flat config treats files matched by zero config objects as "ignored" (a warning), which `--max-warnings 0` then failed on — breaking the plan's own acceptance criterion that this exact command must exit 0.
- **Fix:** Added a base config object (`files: ['**/*.{ts,tsx}']`, `extends: [tseslint.configs.recommended]`) so every ts/tsx file is matched by at least one object (providing parser/JSX support) without being subject to the i18next rule unless it also matches the second, narrower object.
- **Files modified:** eslint.i18n.config.js
- **Verification:** `npm run lint:i18n -- src/shared/lib/i18n/index.ts` exits 0; fixture test confirms the rule still fires correctly on scoped files.
- **Committed in:** 1128056 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary correctness fix to satisfy the plan's own acceptance criteria. No scope creep.

## Issues Encountered
None beyond the one auto-fixed issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/shared/lib/i18n` singleton, 20 catalogs, and `lint:i18n` gate are ready for 21-02 (profiles.locale schema/migration) and every subsequent FSD-layer sweep plan.
- Phase-wide catalog rule for downstream plans: **es-MX value = exact current on-screen literal, byte-for-byte** (even if English); **en-US value = the English rendering**. Proper Spanish localization of existing strings is out of scope for this phase.
- `npm run typecheck` clean (only the 2 pre-existing unrelated errors in `src/entities/tab/model/queries.ts` and `src/shared/lib/agent/rag.ts`, documented across many prior phases in STATE.md); `npm run lint` exits 0 (i18n rule not yet in the committed gate — lands in 21-12); full unit suite 137/139 files, 1228/1243 tests pass (2 skipped, 15 todo), zero regressions.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created files confirmed on disk (`src/shared/lib/i18n/index.ts`, `src/shared/lib/i18n/index.test.ts`, `eslint.i18n.config.js`, this SUMMARY.md). Both task commits (`aa434cb`, `1128056`) confirmed present in `git log`.
