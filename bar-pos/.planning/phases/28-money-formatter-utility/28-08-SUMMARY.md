---
phase: 28-money-formatter-utility
plan: 08
subsystem: lint
tags: [eslint, no-restricted-syntax, formatMoney, i18n, playwright, esquery]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility
    provides: "formatMoney/formatMoneyIn/formatPercent/parseMoneyInput in src/shared/lib/format.ts (Plan 01), plus the full src/ migration from Plans 02-07 and the eslint-disable-next-line no-restricted-syntax exemption convention Plan 03 established"
provides:
  - "eslint-rules/no-raw-money-format.js — rawMoneyFormatSelectors, the D-08 lint gate"
  - "eslint.config.js wired with the money selectors across the whole src/ tree, plus a narrow exemption block for format.ts and test/story/mocks/e2e-spec fixtures"
  - "Repo-wide proof (green npm run lint / typecheck / test) that Plans 02-07's migration left zero unmigrated money sites"
  - "e2e assertions reconciled with the locale-aware rendering, including a new per-locale currency-symbol check in 46-i18n-locale-switch.spec.ts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selector array spread twice into no-restricted-syntax (base block + pages/widgets/features block) because flat config REPLACES, not merges, a rule key per matching file — same mechanism uiDriftSelectors already established"
    - "A later, narrower config object restates only the barrel-export selector for the exempt file set, winning by flat-config file-match precedence rather than an `ignores` key on the base block"

key-files:
  created:
    - eslint-rules/no-raw-money-format.js
  modified:
    - eslint.config.js
    - e2e/23-caja-entries.spec.ts
    - e2e/46-i18n-locale-switch.spec.ts

key-decisions:
  - "Exempt block lists src/shared/lib/format.ts plus test/story/mocks/e2e-spec globs; deliberately excludes receipt-format.ts and exporters/pdf.tsx (both verified during planning to have carried genuine hand-built currency strings, migrated in plan 02)"
  - "npm run lint went green on the very first run after wiring the two selector spreads — no money site needed migration and no new disable comment was added, proving plans 02-07's migration was complete rather than partially disable-commented"
  - "46-i18n-locale-switch.spec.ts had zero money-string assertions before this plan (confirmed by full read) despite the plan's acceptance criteria requiring one; added a minimal, source-verified check (ProductCard's MoneyDisplay on the POS grid) asserting the bare '$' symbol under en-US and the 'MX$' symbol after resetting to es-MX, rather than leaving the acceptance criterion unmet"

requirements-completed: [SC-3, SC-4]

coverage:
  - id: D1
    description: "rawMoneyFormatSelectors exports exactly 3 selectors matching D-08's two detection categories, transcribed verbatim from 28-PATTERNS.md, no meta/create/context.report"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "node -e shape/count/message check (task 1 verify script)"
        status: pass
      - kind: unit
        ref: "node -e esquery.parse() on all 3 selectors (task 1 verify script)"
        status: pass
      - kind: other
        ref: "grep -Ec 'meta|create\\s*\\(|context\\.report' eslint-rules/no-raw-money-format.js == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "rawMoneyFormatSelectors is spread into exactly 2 no-restricted-syntax arrays (base + pages/widgets/features), the repo lints clean under it, and a throwaway probe file with a raw .toFixed(2) money format makes npx eslint exit non-zero"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "npm run lint (exit 0)"
        status: pass
      - kind: other
        ref: "grep -Ec '\\.\\.\\.rawMoneyFormatSelectors' eslint.config.js == 2"
        status: pass
      - kind: other
        ref: "throwaway src/__lint_probe__.ts with a raw ${n.toFixed(2)} template makes npx eslint exit 1"
        status: pass
      - kind: unit
        ref: "npm run typecheck (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run test exits 0 under the locale-aware renderer with no assertion deleted or loosened; e2e specs asserting on money strings are reconciled by reading, and the locale-switch spec asserts a different currency symbol per locale"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npm run test (1391 passed, 15 todo, 0 failed)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json (exit 0)"
        status: pass
      - kind: other
        ref: "14 e2e specs with a money-like literal read in full; 2 needed edits (23-caja-entries.spec.ts fixed 2 broken sign-adjacency assertions, 46-i18n-locale-switch.spec.ts gained the per-locale symbol check)"
        status: pass
      - kind: other
        ref: "e2e assertions not executed in this environment (no desktop display session / Chrome channel per CLAUDE.md) — flagged for a real run at the next release gate"
        status: human_needed
    human_judgment: true
    rationale: "T-28-23 (accepted in the plan's threat model): the e2e suite requires a desktop display session and a separately-installed browser channel this environment does not provide. Every touched spec is listed above and flagged for a real run before the next release."

duration: 55min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 08: Money Formatter Lint Rule Summary

**Landed the `no-raw-money-format` ESLint rule wired across all of `src/`, and it went green on the first run — proving plans 02-07's migration was complete, not partially disable-commented — then reconciled the two e2e assertions the rule's success actually broke and added the locale-switch spec's missing per-locale currency-symbol check.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-02T13:48:00Z (approx.)
- **Completed:** 2026-08-02T14:43:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `eslint-rules/no-raw-money-format.js` exports `rawMoneyFormatSelectors`, a 3-entry selector array copied verbatim from `28-PATTERNS.md` — fixed-point `.toFixed(2)` calls, a currency-suffixed template element followed by an interpolation, and a currency-suffixed JSX text node adjacent to an interpolated fixed-point expression. No `meta`/`create`/`context.report` — a selector array, not a rule plugin, mirroring `no-ui-drift.js`'s shape exactly.
- `eslint.config.js` imports the selectors and spreads them into both `no-restricted-syntax` arrays that govern `src/` (the base block covering every `.ts`/`.tsx` file, and the pages/widgets/features block, which flat config would otherwise silently strip them from since it REPLACES rather than merges the rule key). A new, later, narrower config object restates only the barrel-export selector for `src/shared/lib/format.ts` plus test/story/mocks/e2e-spec globs — `receipt-format.ts` and `exporters/pdf.tsx` are deliberately not exempt.
- `npm run lint` exited 0 across `src/` on the very first run after wiring — no money site was left unmigrated by plans 02-07, and no new disable comment was needed. A throwaway probe file with a raw `` `$${n.toFixed(2)}` `` template made `npx eslint` exit non-zero, proving the gate fires on real production paths.
- `npm run test` was already green (1391 passed, 15 todo, 0 failed) — every unit assertion plans 02-07 touched had already been pinned to the new rendering.
- Audited all 14 e2e specs containing a money-like literal by full read (per CLAUDE.md, the suite needs a desktop display session and a separately-installed Chrome channel this environment lacks, so nothing was executed). 12 of the 14 needed no change — their assertions are substring/regex matches whose shorter `$` form survives inside the longer `MX$` prefix, or they assert only the numeric portion. `23-caja-entries.spec.ts` had two genuinely broken assertions (`'-$500.00'`/`'-$50.00'`) — the sign renders before the symbol, so `-MX$500.00` no longer contains `-$500.00` as a substring; both fixed to the new expected string. `46-i18n-locale-switch.spec.ts` had zero money-string assertions despite this plan's acceptance criteria requiring the locale-switch spec to assert a different currency symbol per locale — added two minimal, source-verified checks against the POS grid's `MoneyDisplay` price (`$`-prefixed under en-US, `MX$`-prefixed after resetting to es-MX).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the no-raw-money-format selector module** - `31c63b2` (feat)
2. **Task 2: Wire the selectors into eslint.config.js and take lint to zero** - `20cd3a9` (feat)
3. **Task 3: Take the unit and end-to-end suites green under the new rendering** - `810a48a` (test)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — orchestrator applies shared-file updates after merge)

## Files Created/Modified

- `eslint-rules/no-raw-money-format.js` - New selector module exporting `rawMoneyFormatSelectors` (3 selectors, verbatim from `28-PATTERNS.md`)
- `eslint.config.js` - Import + two `...rawMoneyFormatSelectors` spreads (base block, pages/widgets/features block) + one new narrow exemption block for `format.ts` and test/story/mocks/e2e-spec globs
- `e2e/23-caja-entries.spec.ts` - Fixed two sign-adjacency assertions (`'-$500.00'` → `'-MX$500.00'`, `'-$50.00'` → `'-MX$50.00'`)
- `e2e/46-i18n-locale-switch.spec.ts` - Added a per-locale POS-grid currency-symbol assertion under both en-US and (post-reset) es-MX

## Decisions Made

- Positioned the new exemption config object immediately after the pages/widgets/features block, before the test-file relaxation block — the plan only required it be "after the pages/widgets/features block and before the storybook config at the end of the array," and since no other block in between touches `no-restricted-syntax`, exact position within that range doesn't affect precedence.
- Did not widen the exempt file set and did not add any new `eslint-disable-next-line` comment to reach a green lint run — none was needed. This is itself evidence for SC-2: plans 02-07 left zero unmigrated money sites under `src/`.
- Chose to add the missing currency-symbol assertion to `46-i18n-locale-switch.spec.ts` (Rule 2 — auto-add missing critical functionality: the plan's own acceptance criteria named this exact behavior as required, and it was absent) rather than leave the acceptance criterion unmet or silently note the gap. The new assertions reuse the spec's own existing POS-navigation pattern and are reasoned directly from `ProductCard.tsx`'s real `<MoneyDisplay amount={displayPrice} size="lg" />` render, not guessed. Not executed in this environment — flagged below for a real run at the next release gate, same as every other e2e edit in this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add missing critical functionality] 46-i18n-locale-switch.spec.ts had no money-string assertion to update**

- **Found during:** Task 3 e2e audit
- **Issue:** The plan's acceptance criteria state "The locale-switch end-to-end spec asserts a different currency symbol per locale," but a full read of `e2e/46-i18n-locale-switch.spec.ts` (265 lines, all three tests) found zero assertions on any money/currency string — the spec only checks translated UI strings, raw-i18n-key leakage, and per-staff locale persistence.
- **Fix:** Added two assertions to the existing "no raw i18n keys leak... per-staff locale change" test, at the two points it already visits the POS page: one confirming a bare `$`-prefixed product price while the session is en-US, one confirming an `MX$`-prefixed price after the reset back to es-MX. Both reason directly from `src/entities/product/ui/ProductCard.tsx`'s real `<MoneyDisplay>` usage.
- **Files modified:** `e2e/46-i18n-locale-switch.spec.ts`
- **Verification:** Read-only (cannot execute e2e in this environment); flagged for a real run at the next release gate.
- **Committed in:** `810a48a`

---

**Total deviations:** 1 (Rule 2, e2e test-coverage gap closed). No production code deviations — Tasks 1 and 2 executed exactly as written and required zero fixes to reach a green `npm run lint`.

## Issues Encountered

- This worktree had no `node_modules` or `.env.local` (both gitignored, fresh worktree checkout) — symlinked both from the main checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`, `/mnt/ai/bola8pos-kiro/bar-pos/.env.local`), same pattern every sibling plan in this phase used. No project files changed by this step.
- `npm run lint` only targets `eslint src --max-warnings 0` per `package.json` — it does not lint `e2e/`. Confirmed via `npx eslint e2e/23-caja-entries.spec.ts` directly that a pre-existing, unrelated `@typescript-eslint/consistent-type-imports` error exists at line 10 (an `import()` type annotation predating this plan's diff, confirmed via `git diff`) — out of scope per the executor's scope-boundary rule, not touched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SC-3 is fully satisfied: `no-raw-money-format` is committed, wired across all of `src/` in two `no-restricted-syntax` blocks, and demonstrably blocks a new ad-hoc format (probe file proof).
- SC-2 is proven complete, not just asserted: the repo lints clean under the gate with disable comments only at the sites plans 03/05/07/31 already classified as non-money.
- SC-4's automated half is done: unit suite green (1391/1391 passing), e2e assertions reconciled by reading, nothing loosened or deleted.
- Every e2e spec touched by this plan (`23-caja-entries.spec.ts`, `46-i18n-locale-switch.spec.ts`) needs a real Playwright run on a machine with a desktop display session and Google Chrome installed before the next release — this environment cannot provide either (T-28-23, accepted risk).
- This is the last plan in phase 28's wave 3 and the last plan overall — no downstream phase-28 plan depends on this one.

## TDD Gate Compliance

No task in this plan carried `tdd="true"`; not applicable.

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: eslint-rules/no-raw-money-format.js
- FOUND: .planning/phases/28-money-formatter-utility/28-08-SUMMARY.md
- FOUND commit: 31c63b2
- FOUND commit: 20cd3a9
- FOUND commit: 810a48a
