---
phase: 25-receipt-item-grouping-2-level
fixed_at: 2026-07-28T19:25:37Z
review_path: .planning/phases/25-receipt-item-grouping-2-level/25-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-07-28T19:25:37Z
**Source review:** .planning/phases/25-receipt-item-grouping-2-level/25-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Warning-severity only; the 2 Info findings were out of scope for this fix pass)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `sanitize()` runs after the "has a category name" truthiness check, breaking the uncategorized-last invariant for control-char-only names

**Files modified:** `src/shared/lib/groupOrderItemsForReceipt.ts`
**Commit:** `6962223`
**Applied fix:** `groupByCategory` now computes `sanitizedName = sanitize(row.categoryName ?? '')` first and uses that (post-sanitize) value for the uncategorized-emptiness check and for the stored `categoryName`, instead of testing the pre-sanitize `trimmedName`. A control-byte-only `categoryName` (e.g. `"\x01\x02"`) is now correctly routed to the uncategorized bucket.

### WR-02: Category sort ignores the receipt's selected locale

**Files modified:** `src/shared/lib/groupOrderItemsForReceipt.ts`, `src/shared/lib/receipt-format.ts`, `src/shared/lib/exporters/pdf.tsx`
**Commit:** `ab9fbb1`
**Applied fix:** `groupByCategory` now accepts an optional `locale?: Locale` parameter, passed to `localeCompare(b.categoryName ?? '', locale)` (defaults to `undefined` — prior behavior — when omitted). All three callers already had a `locale: Locale` in scope for other formatting calls (`buildPreChequeText`, `buildThermalReceiptText`, `CajaReportDoc`); each now passes it through to `groupByCategory`.

### WR-03: `formatModifierLines` output used as a React `key` — duplicate modifier names collide

**Files modified:** `src/widgets/KdsBoard/index.tsx`
**Commit:** `39e42a5`
**Applied fix:** Keyed the modifier `<p>` lines by `` `${item.id}-mod-${i}` `` (item id + array index) instead of the formatted line content, eliminating key collisions when the same modifier appears twice on one order item.

### WR-04: New control-byte sanitizer is applied to category/modifier text but not to the other free-text fields printed by the same functions

**Files modified:** `src/shared/lib/groupOrderItemsForReceipt.ts`, `src/shared/lib/receipt-format.ts`
**Commit:** `70d5c02`
**Applied fix:** Exported `sanitize()` from `groupOrderItemsForReceipt.ts` and applied it in both `buildPreChequeText` and `buildThermalReceiptText` to every remaining free-text field placed on a printed line: `item.name`, `item.notes` (pre-cheque only — the thermal receipt builder doesn't render item notes), `customerName`, `cashierName`, `tableLabel` (pre-cheque), and `barName`/`barAddress` (both builders).

## Skipped Issues

None — all 4 in-scope Warning findings were fixed.

---

_Fixed: 2026-07-28T19:25:37Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
