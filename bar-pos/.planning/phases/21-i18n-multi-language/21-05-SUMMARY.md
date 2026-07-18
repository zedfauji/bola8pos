---
phase: 21-i18n-multi-language
plan: 05
subsystem: i18n
tags: [react-i18next, i18next, tauri, rust, react-pdf, receipts, pdf-export]

# Dependency graph
requires:
  - phase: 21-i18n-multi-language
    provides: "i18next singleton + getCurrentLocale() accessor (21-01/21-02)"
provides:
  - "receipt-format.ts (buildThermalReceiptText/buildPreChequeText/paymentMethodLabel) locale-aware via i18n.getFixedT(locale, 'receipt')"
  - "pos-printer.ts's receiptDataToPrinterLines(data) replacing receiptDataToPrinterJson -- resolves getCurrentLocale(), returns pre-formatted string[] lines"
  - "printer.rs's print_receipt(lines: Vec<String>) -- Rust holds zero receipt-label strings, only ESC/POS-encodes"
  - "pdf.tsx's 11 report Doc components + ReportHeader locale-aware via i18n.getFixedT(locale, 'receipt'), pdf.* key namespace"
  - "receipt.json catalog layout: receipt.* (thermal), precheque.* (pre-cheque), pdf.* (PDF reports) -- all under the shared 'receipt' i18next namespace"
affects: [21-06, 21-07, 21-08, 21-09, 21-10, 21-11, 21-12, 21-13, 28-money-formatter-utility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-component translation via i18n.getFixedT(locale, namespace) for a fixed-locale translator resolved once per call, used in receipt-format.ts and pdf.tsx (both render outside the I18nextProvider tree -- RESEARCH Pattern 3)"
    - "TS builds fully-translated output; Rust/native side only encodes bytes -- print_receipt now takes lines: Vec<String>, eliminating the prior 'keep both in sync' duplication between printer.rs and receipt-format.ts (RESEARCH Pitfall 2)"
    - "Locale resolved once per PDF export call (getCurrentLocale()) and threaded down as a `locale` prop to the Doc component -- no signature change for ReportsPage callers"
    - "toLocaleString()/toLocaleDateString() calls in receipt/PDF paths pass the resolved locale explicitly (RESEARCH Pitfall 3) so dates match the label language"

key-files:
  created: []
  modified:
    - src/shared/lib/receipt-format.ts
    - src/shared/lib/receipt-format.test.ts
    - src/shared/lib/pos-printer.ts
    - src/shared/lib/pos-printer.test.ts
    - src/shared/lib/email-receipt.ts
    - src/shared/lib/email-receipt.test.ts
    - src/features/print-precheque/usePrintPreCheque.ts
    - src/features/process-payment/ui/ReceiptPreview.tsx
    - src-tauri/src/commands/printer.rs
    - src/shared/lib/exporters/pdf.tsx
    - src/shared/lib/i18n/locales/es-MX/receipt.json
    - src/shared/lib/i18n/locales/en-US/receipt.json
    - eslint.i18n.config.js

key-decisions:
  - "receipt.json key layout: 'receipt' top-level group for thermal-receipt labels (date/cashier/customer/subtotal/tip/total/payment/tendered/change/ref/method.{cash,card,rappi}), 'precheque' group for pre-cheque labels (title/subtitle/date/cashier/customer/table/happyHour/subtotal/pending/pool/note), 'pdf' group for all 11 PDF report builders (one sub-object per report type: caja/productSales/hourlySales/voidRefund/categoryRevenue/staffMetrics/staffTips/comboMix/recipeVariance/waitlistMetrics/refundsRegister), all inside the single 'receipt' i18next namespace"
  - "print_receipt Tauri command signature changed from print_receipt(receiptJson: String) to print_receipt(lines: Vec<String>) -- any future Tauri invoke() caller must pass { lines: string[] }, not { receiptJson: string }"
  - "es-MX catalog values are byte-identical to the pre-migration literals (thermal labels were already English, pre-cheque labels were already Spanish, PDF labels were already English) -- zero visual/output regression for the default locale (SC-4)"
  - "en-US catalog only translates the precheque.* group (Fecha->Date, Cajero->Cashier, CUENTA PREVIA->PENDING ACCOUNT, etc.) since thermal-receipt and PDF labels were already English in both locales"
  - "Deleted ReceiptPrintDto/ReceiptItemDto, build_receipt_lines, format_money, payment_method_label, and the now-dead pad_right/line_left_right/center_line/divider helpers from printer.rs -- all were exclusively used by build_receipt_lines, which no longer exists now that TS builds the fully-translated lines"
  - "test_print's 2 literal diagnostic strings ('Bar POS', 'TEST PRINT') left untouched in Rust -- it's a hardware smoke-test command, not a customer-facing receipt, explicitly out of D-06 scope per the plan"
  - "pdf.tsx's exported xToPdfBytes() function signatures are unchanged -- locale is resolved internally via getCurrentLocale(), not passed by ReportsPage callers, so no caller-side changes were needed"
  - "eslint.i18n.config.js's base config object now registers (not enables) the react-refresh plugin and sets linterOptions.reportUnusedDisableDirectives: 'off' -- pdf.tsx's pre-existing file-level eslint-disable comment references rules this standalone gate doesn't load, which was failing the scoped lint:i18n acceptance check with 'rule not found'/'unused directive' even though the file has zero real i18next violations; this is a gate infrastructure fix, not a content change"
  - "Rule 3 (blocking) fallout: buildThermalReceiptText/buildPreChequeText's signature change (adding a required locale param) broke 3 downstream call sites not listed in the plan's files_modified (email-receipt.ts, ReceiptPreview.tsx, usePrintPreCheque.ts) plus 2 existing test files (pos-printer.test.ts, email-receipt.test.ts) -- all updated to resolve getCurrentLocale() at the call site"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "buildThermalReceiptText/buildPreChequeText/paymentMethodLabel select labels via i18n.getFixedT(locale, 'receipt'); es-MX output is byte-identical to the pre-migration literals; en-US pre-cheque renders English labels (PRE-CHEQUE/Date/Cashier) while es-MX keeps the current Spanish labels (CUENTA PREVIA/Fecha/Cajero)"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/shared/lib/receipt-format.test.ts#buildThermalReceiptText es-MX/en-US, #buildPreChequeText en-US/es-MX locale tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "receiptDataToPrinterLines(data) replaces receiptDataToPrinterJson, resolving getCurrentLocale() and returning pre-formatted string[] lines; printReceipt invokes print_receipt with { lines }"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/pos-printer.test.ts#receiptDataToPrinterLines, #printReceipt invokes print_receipt in Tauri and returns ok"
        status: pass
    human_judgment: false
  - id: D3
    description: "print_receipt Tauri command accepts lines: Vec<String> and only ESC/POS-encodes them; ReceiptPrintDto/build_receipt_lines/payment_method_label removed; cargo check passes"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "cd src-tauri && cargo check (exit 0); grep -n 'ReceiptPrintDto|build_receipt_lines|payment_method_label' src-tauri/src/commands/printer.rs (no matches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PDF report builders (pdf.tsx) select labels via i18n.getFixedT(locale, 'receipt'), not hardcoded English strings; no useTranslation() in the file; existing pdf tests pass; scoped i18n lint clean"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/shared/lib/exporters/pdf.test.ts (4/4 pass, unchanged)"
        status: pass
      - kind: other
        ref: "grep -n useTranslation src/shared/lib/exporters/pdf.tsx (no matches); npm run lint:i18n -- src/shared/lib/exporters/pdf.tsx (exit 0)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 05: Locale-Aware Receipts, Pre-Cheques & PDF Reports Summary

**Moved all receipt/pre-cheque/PDF label selection into TypeScript via `i18n.getFixedT()`, eliminating the Rust/TS hardcoded-string duplication in `printer.rs` -- `print_receipt` now accepts pre-formatted `lines: Vec<String>` and only ESC/POS-encodes them**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 complete
- **Files modified:** 13

## Accomplishments

- `buildThermalReceiptText`, `buildPreChequeText`, and `paymentMethodLabel` in `receipt-format.ts` all take an explicit `locale: Locale` parameter and resolve labels via a fixed translator (`i18n.getFixedT(locale, 'receipt')`)
- `receipt.json` (es-MX/en-US) seeded with three key groups: `receipt.*` (thermal receipt), `precheque.*` (pre-cheque), `pdf.*` (all 11 PDF report builders) -- es-MX values are byte-identical to the pre-migration literals; en-US translates only the pre-cheque group (thermal + PDF labels were already English)
- `pos-printer.ts`'s `receiptDataToPrinterJson` replaced with `receiptDataToPrinterLines(data): string[]`, which resolves `getCurrentLocale()`, builds the translated text via `buildThermalReceiptText`, and splits it into lines for Rust
- `printer.rs`'s `print_receipt` signature changed from `receipt_json: String` to `lines: Vec<String>` -- `ReceiptPrintDto`, `ReceiptItemDto`, `build_receipt_lines`, `format_money`, `payment_method_label`, and the now-dead text-layout helpers (`pad_right`, `line_left_right`, `center_line`, `divider`) were all deleted; `lines_to_esc_pos` (the ESC/POS byte encoder) is unchanged
- `pdf.tsx`'s `ReportHeader` and all 11 report `Doc` components (Caja, ProductSales, HourlySales, VoidRefund, CategoryRevenue, StaffMetrics, StaffTips, ComboMix, RecipeVariance, WaitlistMetrics, RefundsRegister) resolve locale-scoped labels via `i18n.getFixedT(locale, 'receipt')` instead of hardcoded English strings; locale is resolved once per export call (`getCurrentLocale()`) inside each `xToPdfBytes()` function, so no caller-facing signature changed
- Date formatting (`toLocaleString`/`toLocaleDateString`) throughout both files now passes the resolved locale explicitly
- Fixed 5 downstream files broken by the `buildThermalReceiptText`/`buildPreChequeText` signature change: `email-receipt.ts`, `ReceiptPreview.tsx`, `usePrintPreCheque.ts` (all now resolve `getCurrentLocale()`), plus `pos-printer.test.ts` and `email-receipt.test.ts`
- Fixed a pre-existing `eslint.i18n.config.js` gap that was failing the scoped `lint:i18n` gate on `pdf.tsx` for unrelated reasons (missing plugin registration for a pre-existing eslint-disable comment), unblocking Task 3's acceptance criterion

## Task Commits

1. **Task 1: receipt-format.ts + pos-printer.ts locale-aware line building** - `0d332a7` (feat)
2. **Task 2: printer.rs -- print_receipt accepts pre-formatted lines (label-free Rust)** - `879322f` (feat)
3. **Task 3: pdf.tsx report builders locale-aware** - `32ea646` (feat)

## Files Created/Modified

- `src/shared/lib/receipt-format.ts` - locale-aware `buildThermalReceiptText`/`buildPreChequeText`/`paymentMethodLabel`
- `src/shared/lib/receipt-format.test.ts` - existing tests updated with `locale` arg + 4 new locale-awareness tests
- `src/shared/lib/pos-printer.ts` - `receiptDataToPrinterLines` replaces `receiptDataToPrinterJson`; `printReceipt` invokes `{ lines }`
- `src/shared/lib/pos-printer.test.ts` - updated for the renamed function + new invoke payload shape
- `src/shared/lib/email-receipt.ts` / `.test.ts` - resolves `getCurrentLocale()` for the email receipt plain-text build
- `src/features/print-precheque/usePrintPreCheque.ts` - resolves `getCurrentLocale()` for `buildPreChequeText`
- `src/features/process-payment/ui/ReceiptPreview.tsx` - resolves `getCurrentLocale()` for the receipt preview text
- `src-tauri/src/commands/printer.rs` - `print_receipt(lines: Vec<String>)`, DTO/label helpers deleted
- `src/shared/lib/exporters/pdf.tsx` - all 11 Doc components + `ReportHeader` locale-aware
- `src/shared/lib/i18n/locales/{es-MX,en-US}/receipt.json` - `receipt.*`/`precheque.*`/`pdf.*` key groups seeded
- `eslint.i18n.config.js` - registered `react-refresh` plugin (inactive) + `reportUnusedDisableDirectives: 'off'` in the base config object

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:
- `receipt.json` key layout is `receipt.*` / `precheque.*` / `pdf.*`, all inside one shared `receipt` i18next namespace (reused by both receipt-format.ts and pdf.tsx rather than splitting into a separate `reports` namespace, per the plan's explicit "keeps 21-05 the single owner" rationale).
- `print_receipt`'s Tauri command signature is now `print_receipt(lines: Vec<String>)` -- **any future Tauri `invoke()` caller must pass `{ lines: string[] }`**, not `{ receiptJson: string }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 5 downstream files broke once `buildThermalReceiptText`/`buildPreChequeText` required a `locale` param**
- **Found during:** Task 1, while implementing the signature change
- **Issue:** The plan's `files_modified` list only named `receipt-format.ts`, `pos-printer.ts`, `receipt-format.test.ts`. Grepping actual call sites of `buildThermalReceiptText`/`buildPreChequeText`/`receiptDataToPrinterJson` found 3 additional production call sites (`email-receipt.ts`, `ReceiptPreview.tsx`, `usePrintPreCheque.ts`) and 2 existing test files (`pos-printer.test.ts`, `email-receipt.test.ts`) that would fail to compile/assert correctly once the signature changed.
- **Fix:** Updated all 5 files -- production call sites now resolve `getCurrentLocale()` at the call site; test assertions updated for the new function name (`receiptDataToPrinterLines`), new `invoke()` payload shape (`{ lines }`), and the extra `locale` argument in the `buildThermalReceiptText` spy assertion.
- **Files modified:** `src/shared/lib/email-receipt.ts`, `src/shared/lib/email-receipt.test.ts`, `src/features/print-precheque/usePrintPreCheque.ts`, `src/features/process-payment/ui/ReceiptPreview.tsx`, `src/shared/lib/pos-printer.test.ts`
- **Verification:** `npm run typecheck` returns to only the 2 pre-existing unrelated errors; full unit suite 140 files / 1248 tests pass, 15 todo, 2 skipped -- zero regressions.
- **Committed in:** `0d332a7` (Task 1 commit)

**2. [Rule 3 - Blocking] `eslint.i18n.config.js` failed `lint:i18n` on `pdf.tsx` for unrelated reasons**
- **Found during:** Task 3 verification (`npm run lint:i18n -- src/shared/lib/exporters/pdf.tsx`)
- **Issue:** `pdf.tsx`'s pre-existing file-level `eslint-disable` comment (`@typescript-eslint/no-unsafe-argument, react-refresh/only-export-components`) references two rules that the standalone `eslint.i18n.config.js` gate never registers. ESLint hard-errors with "Definition for rule ... was not found" for the unregistered `react-refresh` rule and flags the other as an "unused directive" warning -- both fail `--max-warnings 0` even though the file has zero real `i18next/no-literal-string` violations. This would have failed identically for this file (or any file sharing the same disable comment) regardless of my Task 3 content changes.
- **Fix:** Registered (not enabled) the `react-refresh` plugin in `eslint.i18n.config.js`'s base config object and set `linterOptions.reportUnusedDisableDirectives: 'off'` there, so disable comments scoped to the wider committed `eslint.config.js`'s rule set resolve as known-but-inactive instead of erroring.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n -- src/shared/lib/exporters/pdf.tsx` now exits 0; re-ran the full scoped gate (`src/shared/ui src/entities src/features src/widgets src/pages`) afterward to confirm the `i18next/no-literal-string` rule still fires correctly elsewhere (2693 pre-existing violations from not-yet-migrated widgets, unchanged in kind -- expected, those are later waves' scope).
- **Committed in:** `32ea646` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues preventing the plan's own stated acceptance criteria). No scope creep -- both were necessary consequences of the planned signature/content changes, not new features.

## Issues Encountered

None beyond the two auto-fixed items documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Receipts, pre-cheques, and PDF reports are fully locale-aware (D-06 satisfied); es-MX output is byte-identical to pre-migration (SC-4).
- `print_receipt`'s new `lines: Vec<String>` signature is stable -- no other Rust code references the removed DTO/helpers.
- `receipt.json`'s `receipt.*`/`precheque.*`/`pdf.*` key layout is the canonical namespace for any future receipt/PDF label additions.
- Phase 28 (Money Formatter Utility) can continue to rely on `getCurrentLocale()` unchanged -- this plan did not touch `formatMoney`/`fmt()` money formatting anywhere (explicitly out of scope, per plan).
- `eslint.i18n.config.js`'s plugin-registration fix benefits any later 21-xx plan that touches a file carrying the same `react-refresh`/`no-unsafe-argument` disable-comment pattern.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

All modified files confirmed on disk (`src/shared/lib/receipt-format.ts`, `src/shared/lib/pos-printer.ts`, `src-tauri/src/commands/printer.rs`, `src/shared/lib/exporters/pdf.tsx`, `eslint.i18n.config.js`, this SUMMARY.md). All 3 task commits (`0d332a7`, `879322f`, `32ea646`) confirmed present in `git log`.
