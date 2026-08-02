---
phase: 28-money-formatter-utility
plan: 04
subsystem: ui
tags: [i18n, formatMoney, react-i18next, currency-formatting]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility (plan 01)
    provides: "src/shared/lib/format.ts — formatMoney/formatMoneyIn/formatPercent/parseMoneyInput, D-01/D-04/D-06"
provides:
  - "CajaDashboard.tsx (screen amounts, printed cash-count lines, entry row signs) rendering through formatMoney"
  - "PaymentForm.tsx (discount-applied, split-row charges, over-by, reset-to-computed labels) rendering through formatMoney"
  - "New paymentForm.splitRowCharges i18n key (es-MX + en-US)"
affects: [28-05, 28-06, 28-07, 28-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catalog placeholders for money strings carry no literal currency character — the caller passes formatMoney() output, catalog only supplies surrounding text/padding/sign"
    - "Sign display for signed money amounts uses formatMoney's showSign option (D-06), never a hand-built '+'/'-' character"

key-files:
  created: []
  modified:
    - src/widgets/CajaDashboard/CajaDashboard.tsx
    - src/widgets/CajaDashboard/CajaDashboard.test.tsx
    - src/widgets/PaymentModal/ui/PaymentForm.tsx
    - src/shared/lib/i18n/locales/es-MX/wPanels.json
    - src/shared/lib/i18n/locales/en-US/wPanels.json

key-decisions:
  - "discountApplied catalog value left byte-identical in both locales — its leading '-' is a sign, not a currency character, and formatMoney(discountAmount) (always positive input) supplies the symbol without duplicating the sign"
  - "New paymentForm.splitRowCharges key uses the same value in both locale catalogs, following this namespace's existing untranslated-content convention (only the string source moved, not its content)"
  - "Caja entry row negates the amount for expense entries and always passes showSign: true — formatMoney's own isNegative check takes priority over showSign, so the minus renders correctly without a second hand-built sign character"

patterns-established: []

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "CajaDashboard on-screen amounts (5-card summary via existing MoneyDisplay, opening-cash figure, entry-row signed amounts, expense/income totals) render through the shared formatMoney formatter with no hand-built currency prefix or sign"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/CajaDashboard/CajaDashboard.test.tsx — all 14 tests"
        status: pass
      - kind: other
        ref: "grep -Eq \"from '@shared/lib/format'\" src/widgets/CajaDashboard/CajaDashboard.tsx && grep -Eq 'showSign' src/widgets/CajaDashboard/CajaDashboard.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "CajaDashboard's printed cash-count lines (Cash/Card/Rappi/Net Total/Open Tabs) render through formatMoney, with the five wPanels.print* catalog keys stripped of their literal $ prefix in both locales and column padding preserved byte-for-byte"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/CajaDashboard/CajaDashboard.test.tsx — 'calls printRawText with cash, card, rappi, net, and pending values on Print Summary click' (now asserts MX$-prefixed substrings)"
        status: pass
      - kind: other
        ref: "node -e key-set-diff-check on both wPanels.json files"
        status: pass
    human_judgment: true
    rationale: "The printed cash-count slip is a physical artifact (T-28-10, disposition: accept) — column alignment on the actual thermal printer is verified by plan 08's human-verify checkpoint, not by this plan's unit tests."
  - id: D3
    description: "PaymentForm split-mode labels (discount-applied, split-row charges, over-by, reset-to-computed) render through formatMoney; the split-row charges label — previously a bare untranslated English template literal — now routes through a new paymentForm.splitRowCharges i18n key, satisfying the committed i18next/no-literal-string lint gate"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/widgets/PaymentModal/ui/PaymentForm.test.tsx — all 42 tests (incl. 'fixed $5 discount shows correct discount-applied-label')"
        status: pass
      - kind: other
        ref: "npm run lint -- src/widgets/PaymentModal/ui/PaymentForm.tsx (exit 0, includes i18next/no-literal-string)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 04: Migrate CajaDashboard + PaymentForm to shared formatMoney Summary

**Moved money rendering in the two highest-traffic operational panels (caja dashboard, payment form) off hand-built currency strings and onto the shared `formatMoney` formatter, closing 7 catalog `$`-prefixed placeholders and adding one new translated key for a previously-untranslated split-row label.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-02T13:33:39-06:00
- **Completed:** 2026-08-02T13:42:19-06:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `CajaDashboard.tsx`: printed cash-count lines, opening-cash figure, expense/income totals, and the caja entry-row signed amount all render through `formatMoney`; entry-row sign now comes from `showSign` (D-06) instead of a hand-built `+`/`-` character
- `PaymentForm.tsx`: discount-applied, over-by, and reset-to-computed labels now format through `formatMoney`; the split-row charges label — the last untranslated English money string in this widget — became a new `paymentForm.splitRowCharges` i18n key
- Both `wPanels.json` catalogs (es-MX, en-US) had the literal `$` stripped from 7 placeholder positions (`printCash`, `printCard`, `printRappi`, `printNetTotal`, `printOpenTabs`, `overBy`, `resetToComputed`) and gained the new `splitRowCharges` key, staying key-for-key identical between locales
- Zero payment-processing or split-leg construction logic touched

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate CajaDashboard money rendering and its printed cash-count lines** - `ea240be` (feat)
2. **Task 2: Migrate PaymentForm split-mode money labels** - `5d54f14` (feat)

**Plan metadata:** committed with this SUMMARY (worktree mode — orchestrator applies shared-file updates after merge)

## Files Created/Modified
- `src/widgets/CajaDashboard/CajaDashboard.tsx` - imports `formatMoney`; printed cash-count lines, opening-cash figure, entry-row sign (via `showSign`), and expense/income totals all route through it
- `src/widgets/CajaDashboard/CajaDashboard.test.tsx` - print-summary assertion updated from loose `$X.XX` substrings to the actual `MX$X.XX` symbol-prefixed form
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` - imports `formatMoney`; discount-applied, split-row charges (now via new `t()` key), over-by, and reset-to-computed labels all route through it
- `src/shared/lib/i18n/locales/es-MX/wPanels.json` - 7 keys de-dollared (`printCash`, `printCard`, `printRappi`, `printNetTotal`, `printOpenTabs`, `overBy`, `resetToComputed`); new `splitRowCharges` key added; `discountApplied` untouched
- `src/shared/lib/i18n/locales/en-US/wPanels.json` - same 7-key de-dollar + new key, kept key-for-key identical to es-MX

## Decisions Made
- `discountApplied`'s leading `-` is a sign character, not a currency character — left byte-identical in both catalogs per the plan's explicit instruction; the caller now passes `formatMoney(discountAmount)` (always a positive amount) so the catalog's `-` supplies the sign and the formatter supplies the symbol, with no duplication
- New `paymentForm.splitRowCharges` key uses the same value in both locale files, matching this namespace's existing convention of untranslated (English-sourced) content pending future full-Spanish-translation work
- Caja entry row always passes `{ showSign: true }` regardless of entry type; `formatMoney`'s own negative-amount check takes priority over `showSign` internally, so negating the amount for expenses is sufficient — no risk of a double sign

## Deviations from Plan

None — plan executed exactly as written. All five `must_haves.truths`, both `key_links` import assertions, and the single `prohibitions` constraint (no doubled currency symbol) were satisfied on the first pass.

## Issues Encountered
- The worktree had no `node_modules` and no `.env.local` (both gitignored, not carried by `git worktree add`). Symlinked `node_modules` from the sibling main checkout (verified identical `package-lock.json` via md5sum first) and copied `.env.local` from the same checkout to run `vitest`/`typecheck`/`lint` locally. Neither is a tracked or committed change — both remain gitignored in this worktree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `wPanels.json` in both locales is now fully owned and closed out by this plan for phase 28 (per the plan's catalog-ownership note) — plans 05/06/07 must not touch it
- Plan 08's human-verify checkpoint should visually confirm the printed cash-count slip's column alignment on real hardware (T-28-10, accepted low-severity risk deferred there by design)
- No blockers for downstream plans in this phase

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: src/widgets/CajaDashboard/CajaDashboard.tsx
- FOUND: src/widgets/PaymentModal/ui/PaymentForm.tsx
- FOUND: .planning/phases/28-money-formatter-utility/28-04-SUMMARY.md
- FOUND commit: ea240be
- FOUND commit: 5d54f14
