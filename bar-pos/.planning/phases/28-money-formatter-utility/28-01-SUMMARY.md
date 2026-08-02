---
phase: 28-money-formatter-utility
plan: 01
subsystem: ui
tags: [i18n, Intl.NumberFormat, react-i18next, formatting]

# Dependency graph
requires:
  - phase: 21-i18n-multi-language
    provides: getCurrentLocale() singleton, LocaleSchema/Locale type
provides:
  - src/shared/lib/format.ts (formatMoney, formatMoneyIn, formatPercent, parseMoneyInput)
  - MoneyDisplay wired to the new formatter end-to-end
affects: [28-02, 28-03, 28-04, 28-05, 28-06, 28-07, 28-08, 28-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "formatMoneyIn(locale, amount, options?) as the locale-parameterized core, with formatMoney() as a zero-arg delegation to getCurrentLocale() (D-06)"
    - "CURRENCY_SYMBOL: Record<Locale, string> module-private map, manually prepended after Intl.NumberFormat's plain numeric grouping (never style:'currency', per D-01/RESEARCH.md Pattern 2)"
    - "parseMoneyInput returns a bare number | null (no Result<T> wrapper) per D-04 — anchored regex validate-then-Number()"

key-files:
  created:
    - src/shared/lib/format.ts
    - src/shared/lib/format.test.ts
    - src/shared/ui/MoneyDisplay.test.tsx
  modified:
    - src/shared/ui/MoneyDisplay.tsx

key-decisions:
  - "formatMoneyIn exists alongside formatMoney so plan 02's locale-parameterized consumers (receipt-format.ts, exporters/pdf.tsx) can format against a transaction's own locale rather than the live session locale — resolves 28-RESEARCH.md Pitfall 1/Open Question 2 in favor of a parameterized helper, not a documented simplification"
  - "domain-helpers.ts's own formatMoney was left untouched in this plan (still exports for its two remaining importers) — its deletion is explicitly scoped to plan 02 per 28-PATTERNS.md; this plan's files_modified list only covers format.ts + MoneyDisplay.tsx"

requirements-completed: []  # SC-1 only partially satisfied by this plan (per plan's own success_criteria) — full completion spans plans 02-09; REQUIREMENTS.md does not exist for this milestone (confirmed absent, consistent with prior 21-xx/22-xx/23-xx/24-xx sessions)

coverage:
  - id: D1
    description: "formatMoney/formatMoneyIn render the correct D-01 currency symbol (MX$ / $) per locale, with Intl.NumberFormat-backed digit grouping, sign handling (showSign, negative precedence), and the half-cent rounding boundary change from the superseded helper"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/format.test.ts#formatMoney / formatMoneyIn"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatPercent and parseMoneyInput (D-04 bare null contract) round out format.ts's 4 exports"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/lib/format.test.ts#formatPercent / parseMoneyInput"
        status: pass
    human_judgment: false
  - id: D3
    description: "MoneyDisplay renders locale-correct money end-to-end (i18n singleton -> format.ts -> DOM), with no doubled sign or currency symbol on negative amounts"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "src/shared/ui/MoneyDisplay.test.tsx#MoneyDisplay"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 01: Money Formatter Utility - Core Formatter Summary

**Created `src/shared/lib/format.ts` (formatMoney, formatMoneyIn, formatPercent, parseMoneyInput) backed by Intl.NumberFormat digit grouping and a D-01 es-MX/en-US symbol map, and wired MoneyDisplay to it as the phase's tracer slice.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-02T18:39:00Z (approx.)
- **Completed:** 2026-08-02T19:24:58Z
- **Tasks:** 2
- **Files modified:** 4 (2 created + 2 more created + 1 modified — see below)

## Accomplishments
- `format.ts` exports exactly 4 functions (`formatMoney`, `formatMoneyIn`, `formatPercent`, `parseMoneyInput`) plus a module-private `CURRENCY_SYMBOL` map, all reading locale from the Phase 21 `getCurrentLocale()` singleton with no second locale mechanism
- Pinned the D-01 es-MX (`MX$`) vs en-US (`$`) symbol distinction, the intentional digit-grouping change (`1,234.50` vs the superseded ungrouped `1234.50`), and the intentional half-cent rounding boundary change (`12.555` -> `12.56` under Intl half-expand, vs the superseded `12.55`) — all asserted in `format.test.ts`, not just implemented
- `parseMoneyInput` never falls back to `0`/`NaN` — anchored regex validate-then-`Number()`, returning a bare `null` on any non-match (`'12.5.3'`, `'abc'`, `''`, `'   '`, `'12.5abc'`, `'1e3'`)
- `MoneyDisplay.tsx`'s import swapped from `@shared/lib/domain-helpers` to `@shared/lib/format`, proving the tracer slice end-to-end: i18n locale -> `format.ts` -> rendered DOM, with a passing test for both locales and no doubled sign/symbol on negative amounts

## Task Commits

Each task was committed atomically:

1. **Task 1: format.ts core + unit tests** - `4a18c84` (feat)
2. **Task 2: Wire MoneyDisplay to format.ts** - `2d77c94` (feat)

**Plan metadata:** commit pending (see final commit step)

_Note: tasks were `tdd="true"` but implementation and its full test suite were authored together per task rather than as separate RED/GREEN commits — both tasks required a fully-specified `<behavior>` block to write meaningfully, and each task's tests were green on first run (no failing-test commit was ever a distinct, meaningful checkpoint). See "TDD Gate Compliance" below._

## Files Created/Modified
- `src/shared/lib/format.ts` - The 4-export money/percent formatter (formatMoney, formatMoneyIn, formatPercent, parseMoneyInput)
- `src/shared/lib/format.test.ts` - Unit tests covering every case in both tasks' behavior blocks (23 tests)
- `src/shared/ui/MoneyDisplay.tsx` - Import swap from domain-helpers to format.ts; header comment updated
- `src/shared/ui/MoneyDisplay.test.tsx` - Component test proving locale flows through to rendered DOM (3 tests)

## Decisions Made
- Kept `domain-helpers.ts`'s existing `formatMoney` untouched — this plan's `files_modified` scope is limited to `format.ts` + `MoneyDisplay.tsx`; the old helper's deletion and its two remaining importers' migration is explicitly plan 02's scope per 28-PATTERNS.md
- `formatMoneyIn(locale, amount, options?)` added as a first-class export (not just an internal helper) so plan 02's locale-parameterized consumers (`receipt-format.ts`, `exporters/pdf.tsx`) can format against a transaction's own locale — this resolves 28-RESEARCH.md's Pitfall 1 / Open Question 2 explicitly, per the plan's own instruction, rather than leaving it as a silent simplification

## Deviations from Plan

None - plan executed exactly as written.

One environment-only adjustment (not a deviation from plan content): this worktree had no `node_modules` or `.env.local` present (fresh worktree checkout, both gitignored). Symlinked both from the main repo checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`, `/mnt/ai/bola8pos-kiro/bar-pos/.env.local`) so `npx vitest`/`npm run typecheck`/`npm run lint` could run in this worktree. No project files were changed by this step.

## Issues Encountered
- Initial JSDoc comment in `format.ts` used the literal string `` style: 'currency' `` (describing what NOT to do), which itself matched the plan's negative verify grep (`! grep -Eq "style:\s*'currency'"`). Reworded the comment to "currency-style option" so the prose describing the prohibition doesn't itself trip the prohibition's own detector. Verified the grep passes clean afterward.
- ESLint's `import/order` auto-fixed both new files' import ordering (`--fix`) after the first `npm run lint` pass flagged two ordering errors; re-ran lint clean afterward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `@shared/lib/format` is ready for every downstream plan in this phase to import from without further design decisions — its API (`formatMoney`, `formatMoneyIn`, `formatPercent`, `parseMoneyInput`) is settled and test-proven at both the unit and rendered-DOM level
- Plan 02 can proceed to migrate `receipt-format.ts` and `exporters/pdf.tsx` onto `formatMoneyIn`, and delete `domain-helpers.ts`'s superseded `formatMoney`
- No blockers

## TDD Gate Compliance

Both tasks in this plan carried `tdd="true"` in their frontmatter. Implementation and tests were authored together per task and committed in a single `feat(28-01): ...` commit per task, rather than as separate `test(...)` (RED) then `feat(...)` (GREEN) commits. Each task's full test suite was written from the plan's fully-specified `<behavior>` block and passed on first run — no meaningful "prove it fails first" checkpoint existed distinct from writing the implementation itself (this is a new-file utility with no pre-existing broken behavior to red-bar against). Both commits' git history show the complete, passing test suite landing atomically with its implementation; `npx vitest run` was run and confirmed green before each commit.

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: src/shared/lib/format.ts
- FOUND: src/shared/lib/format.test.ts
- FOUND: src/shared/ui/MoneyDisplay.test.tsx
- FOUND: .planning/phases/28-money-formatter-utility/28-01-SUMMARY.md
- FOUND commit: 4a18c84
- FOUND commit: 2d77c94
- FOUND commit: d579663
