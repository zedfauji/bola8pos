---
phase: 21-i18n-multi-language
plan: 11
subsystem: i18n
tags: [i18next, react-i18next, eslint-plugin-i18next, entities, pages, fsd]

requires:
  - phase: 21-i18n-multi-language
    provides: "21-01 (i18next singleton + catalog scaffolding), 21-02 (staff.locale + entities/staff pre-migration), 21-03/04/05 (locale UI/DB plumbing) — all merged before this sweep touched entities/staff/model/* again"
provides:
  - "entities.json (118 keys) — every src/entities/**/*.{ts,tsx} literal migrated to i18n.t()/useTranslation('entities')"
  - "pages.json (46 keys) — every src/pages/**/*.tsx route-container literal migrated to useTranslation('pages')"
  - "eslint.i18n.config.js extended with Supabase multi-line-chain callee excludes (neq/gte/lte/not/in/is/single/channel/on), object-property excludes (event/schema/table/count/onConflict), hex-color/sort-arrow word excludes, argsIgnorePattern '^_', and the 'backTo' jsx-attribute exclude"
affects: ["21-12 (turns the i18next/no-literal-string rule on repo-wide — this plan is the last big-bang migration surface before that gate flips)"]

tech-stack:
  added: []
  patterns:
    - "Non-component .ts model/store files import the i18n singleton (`import i18n from '@shared/lib/i18n'`) and call `i18n.t('entities:...')` for genuine user-facing AppError messages"
    - "Module-scope helper functions (not components) that need translated strings accept a `TFunction<'entities'>` as an explicit first parameter (e.g. inventoryRowColumns, WaitlistEntryCard's formatWait/formatTimeAgo) — cannot call useTranslation() themselves"
    - "TanStack Query key-factory objects (`xKeys = { all: [...] }`) and multi-line Supabase query-builder chains get a scoped `/* eslint-disable i18next/no-literal-string */ ... /* eslint-enable */` block with a rationale comment, since the plugin doesn't resolve excluded callee names across a multi-line method chain (recurring quirk first documented in 21-08)"
    - "Computed Tailwind className string variables (ternary-built, not directly in a className= JSX attribute) get the same scoped disable/enable treatment"
    - "unknownError(code) calls pass an internal debug code as `.raw` metadata, NOT the user-visible `.message` (that's a fixed string from result.ts) — these do not need translation, only explicit `err({ code, message: '...' })` object literals with real prose do"

key-files:
  created: []
  modified:
    - src/entities/**/*.ts (29 model files)
    - src/entities/**/*.tsx (14 ui components)
    - src/pages/**/*.tsx (17 route containers)
    - src/shared/lib/i18n/locales/{es-MX,en-US}/entities.json
    - src/shared/lib/i18n/locales/{es-MX,en-US}/pages.json
    - eslint.i18n.config.js
    - src/widgets/InventoryPagePanel.tsx (call-site plumbing for inventoryRowColumns' new `t` param)

key-decisions:
  - "es-MX catalog values are byte-identical to the pre-migration literal in every key (source strings were already English throughout this codebase) — en-US values are the same text, matching the established 21-06..21-10 pattern"
  - "Pluralized UI text (tabCard.itemCount, waitlistEntryCard.partySize) uses i18next's _one/_other key-suffix convention rather than manual ternaries"
  - "inventoryRowColumns became a (t, staffId) factory instead of (staffId) — the caller (InventoryPagePanel widget) passes its existing wAdmin-namespace `t`, using i18next's explicit 'entities:key' cross-namespace prefix rather than adding a second useTranslation() call"

patterns-established:
  - "Scoped eslint-disable/enable block for TanStack Query key-factory objects and multi-line Supabase chains, annotated with the '21-08 quirk' rationale — reusable by any future entities/model sweep"

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "entities layer (44 files, ~500 raw violations) fully migrated to entities ns; npm run lint:i18n -- src/entities exits 0"
    requirement: SC-4
    verification:
      - kind: other
        ref: "npm run lint:i18n -- src/entities"
        status: pass
      - kind: unit
        ref: "npm run test (140 files / 1248 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pages layer (17 route containers, incl. the Reports page's 13 tab labels) fully migrated to pages ns; npm run lint:i18n -- src/pages exits 0"
    requirement: SC-4
    verification:
      - kind: other
        ref: "npm run lint:i18n -- src/pages"
        status: pass
      - kind: unit
        ref: "npm run test (140 files / 1248 tests)"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-07-19
status: complete
---

# Phase 21 Plan 11: Entities + Pages Layer Sweep to entities/pages Namespaces Summary

**Big-bang string sweep of the last two FSD layers (entities, pages) into their own i18next catalogs — all five layers (shared/ui, features, widgets, entities, pages) are now string-clean under `lint:i18n`, unblocking 21-12's repo-wide gate flip.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-07-19
- **Tasks:** 2/2
- **Files modified:** 69 source files + 4 catalog JSON files + `eslint.i18n.config.js`

## Accomplishments

- Swept 44 `src/entities/**/*.{ts,tsx}` files (~500 raw `i18next/no-literal-string` violations at baseline) down to zero: entity model `.ts` hooks (queries/store) use the `i18n.t('entities:...')` singleton for genuine user-facing AppError/toast messages; entity `ui/*.tsx` card/row components use `useTranslation('entities')`.
- Swept all 17 `src/pages/**/*.tsx` route containers to zero violations: `PageContainer` title/backLabel, the Reports page's 13 tab labels, POS page toasts/aria-labels, and the shared `LogoImage` alt text (home + login) now resolve through `useTranslation('pages')`.
- Seeded `entities.json` (118 keys) and `pages.json` (46 keys) in both locales — byte-identical es-MX/en-US since every pre-migration literal in this codebase was already English text.
- Extended `eslint.i18n.config.js` with the missing Supabase query-builder callee excludes (`neq`/`gte`/`lte`/`not`/`in`/`is`/`single`/`channel`/`on`), object-property excludes for Realtime filter config (`event`/`schema`/`table`) and query options (`count`/`onConflict`), a `backTo` jsx-attribute exclude (PageContainer's route path, same category as `to`), hex-color and sort-arrow word excludes, and `argsIgnorePattern: '^_'` for `no-unused-vars` (mirroring the committed `eslint.config.js`) — this is the first plan in the phase to sweep `entities/model/*.ts`, where all of these patterns recur dozens of times.

## Task Commits

1. **Task 1: Sweep entities layer → entities ns** - `47d5c15` (feat)
2. **Task 2: Sweep pages layer → pages ns** - `8adeb94` (feat)

## Files Created/Modified

- `src/shared/lib/i18n/locales/{es-MX,en-US}/entities.json` — 118 keys across `common`, `caja`, `prep`, `promotion`, `rappiOrder`, `recipe`, `reports`, `staff`, `tab`, `waitlist`, `cartItem`, `categoryTabs`, `inventoryRow`, `lowStockBadge`, `poolChargeItem`, `poolTableCard`, `poolTableIllustration`, `prepOnHandCard`, `productCard`, `recipePreviewPanel`, `tabCard`, `tabDetail`, `waitlistEntryCard`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/pages.json` — 46 keys across `common`, `audit`, `inventory`, `kdsBar`, `kds`, `kitchenPrep`, `payments`, `poolTableStatus`, `poolTables`, `pos`, `rappi`, `rbac`, `reports`, `settings`, `staff`, `waitlist`
- `eslint.i18n.config.js` — callee/object-property/word/jsx-attribute excludes + `argsIgnorePattern`
- 29 `src/entities/*/model/*.ts` files — i18n singleton import + scoped disable blocks + translated toast/error messages
- 14 `src/entities/*/ui/*.tsx` files — `useTranslation('entities')` + translated JSX text/aria-labels/placeholders
- 17 `src/pages/**/*.tsx` files — `useTranslation('pages')` + translated titles/labels/toasts
- `src/widgets/InventoryPagePanel.tsx` — passes its own `t` into `inventoryRowColumns(t, staffId)`

## Decisions Made

- es-MX = exact pre-migration literal, byte-for-byte, in every one of the 164 new catalog keys (no genuine Spanish source strings existed in these two layers, unlike 21-09's PaymentForm/21-10's BillingSettingsTab precedent)
- `unknownError(code)` calls (result.ts) pass their string arg as internal `.raw` debug metadata, not the user-visible `.message` — left untranslated/disabled; only explicit `err({ code, message: 'prose' })` object literals needed real translation
- Scoped `eslint-disable`/`eslint-enable` blocks (not single-line `eslint-disable-next-line`) for TanStack Query key-factory objects and multi-line Supabase chains, since the plugin's callee-exclude matching breaks across multi-line method chains — single-line disables silently failed to cover the violation on a later line within the same block (caught and fixed via a second `lint:i18n` pass)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate `$` in PoolTableIllustration's rate-per-hour label**
- **Found during:** Task 1, translating the `${formatMoney(ratePerHour)}/hr` JSX text
- **Issue:** The literal JSX text was `$` + `{formatMoney(ratePerHour)}` + `/hr` — but `formatMoney()` already prefixes its own `$`, so the rendered label showed `$$45.00/hr`
- **Fix:** Migrated to `{t('poolTableIllustration.ratePerHour', { amount: formatMoney(ratePerHour) })}` with catalog value `"{{amount}}/hr"` (no literal `$`), removing the duplicate
- **Files modified:** `src/entities/pool-table/ui/PoolTableIllustration.tsx`, `entities.json` (both locales)
- **Commit:** `47d5c15`

**2. [Rule 3 - Blocking] Extended `eslint.i18n.config.js`'s general (non-test) block with `argsIgnorePattern: '^_'` for `no-unused-vars`**
- **Found during:** Task 1, `src/entities/tab/model/store.ts`'s `migrate: (persisted, _persistedVersion) => {...}` zustand-persist callback
- **Issue:** The standalone i18n gate's `tseslint.configs.recommended` base enables `@typescript-eslint/no-unused-vars` with no ignore pattern outside the test-file override block, so this pre-existing underscore-prefixed intentionally-unused param failed `lint:i18n -- src/entities` even though the committed `npm run lint` gate (which does have the pattern globally) already permits it
- **Fix:** Added the rule override to the gate's base config block (not just the test-file override)
- **Files modified:** `eslint.i18n.config.js`
- **Commit:** `47d5c15`

**3. [Rule 1 - Bug] Fixed `noUncheckedIndexedAccess` typecheck failure in PoolTableCard**
- **Found during:** Task 1, `npm run typecheck` after translating `statusMessage[table.status]`
- **Issue:** `STATUS_MESSAGE_KEY[table.status] ? t(STATUS_MESSAGE_KEY[table.status]) : ''` — TS doesn't narrow a repeated indexed-access expression between the ternary condition and consequent, so the second access was still typed `string | undefined`
- **Fix:** Hoisted the lookup into a local `const key = STATUS_MESSAGE_KEY[table.status]` inside an IIFE before branching
- **Files modified:** `src/entities/pool-table/ui/PoolTableCard.tsx`
- **Commit:** `47d5c15`

None of the above required user input — all were auto-fixed per Rules 1/2/3 and are documented here per the deviation-tracking contract.

## Known Stubs

None — no stub patterns (hardcoded empty values flowing to UI, placeholder text, unwired data sources) were introduced by this plan.

## Threat Flags

None — this plan only migrates existing literal strings into `i18next.t()` calls resolved from the existing `entities`/`pages` catalogs (already covered by T-21-04 in prior plans' threat models: React-escaped output, no HTML sink, source-only migration). No new network endpoints, auth paths, file access, or schema changes were introduced.

## Issues Encountered

- **Pre-existing test flakiness (not a regression):** `src/entities/staff/model/queries.clock.test.ts > useMutationClockOut` failed once during a full-suite run (live-Supabase integration test hitting shared `shifts`/`profiles` table state), then passed on immediate retry both in isolation and as part of a second full-suite run (140 files / 1248 tests green). Confirmed via `git stash` that the same test also passes in isolation against the pre-plan baseline commit — this is cross-test live-DB state interference, the same category as several pre-v2.2 "live Supabase data" flakiness items already documented in `.planning/STATE.md`'s Deferred Items, not a regression introduced by this plan.
- **Pre-existing typecheck errors (out of scope, confirmed via `git show HEAD:...`):** `src/entities/tab/model/queries.ts(788,11)` (`p_expected_version: expected ?? null` type mismatch) and `src/shared/lib/agent/rag.ts(60,7)` — both predate this plan's changes (untouched lines) and are logged here per the Scope Boundary rule rather than fixed.

## Next Steps

- 21-12 folds the `i18next/no-literal-string` rule into the committed `eslint.config.js` and deletes the standalone `eslint.i18n.config.js` gate now that all five FSD layers are string-clean.
- The two pre-existing typecheck errors noted above remain open — out of scope for this i18n phase, tracked for whichever future phase owns `tab/model/queries.ts`'s versioned-RPC typing or `agent/rag.ts`.

## Self-Check

- [x] `src/shared/lib/i18n/locales/es-MX/entities.json` exists — FOUND
- [x] `src/shared/lib/i18n/locales/en-US/entities.json` exists — FOUND
- [x] `src/shared/lib/i18n/locales/es-MX/pages.json` exists — FOUND
- [x] `src/shared/lib/i18n/locales/en-US/pages.json` exists — FOUND
- [x] Commit `47d5c15` exists — FOUND
- [x] Commit `8adeb94` exists — FOUND
