---
phase: 25-receipt-item-grouping-2-level
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/features/print-precheque/usePrintPreCheque.ts
  - src/shared/lib/domain.ts
  - src/shared/lib/edge-function-contracts.ts
  - src/shared/lib/exporters/pdf.test.ts
  - src/shared/lib/exporters/pdf.tsx
  - src/shared/lib/groupOrderItemsForReceipt.test.ts
  - src/shared/lib/groupOrderItemsForReceipt.ts
  - src/shared/lib/i18n/locales/en-US/receipt.json
  - src/shared/lib/i18n/locales/es-MX/receipt.json
  - src/shared/lib/receipt-format.test.ts
  - src/shared/lib/receipt-format.ts
  - src/widgets/KdsBoard/KdsCard.test.tsx
  - src/widgets/KdsBoard/index.tsx
  - supabase/functions/process-payment/index.ts
  - supabase/migrations/20260726000001_caja_report_top_products_category.sql
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the new shared `groupOrderItemsForReceipt.ts` (Category → Item → Modifiers grouping + control-char sanitizer) and its four call sites (thermal receipt, pre-cheque, Caja Report PDF top-products table, KDS card), plus the `process-payment` edge function and the `get_caja_report` migration that feed category data into the pipeline. Unit and property-based test coverage for the grouping utility itself is solid (permutation/conservation, uncategorized-always-last, single-category degeneracy). No SQL injection, hardcoded secrets, or crash-level defects were found. Findings below are edge-case correctness gaps in the new shared utility and one React key-stability bug in a KDS list that reuses the new modifier formatter — none block core functionality, but the grouping invariant the tests assert (`uncategorized bucket is always last`) is not actually guaranteed for one input shape, and the new sanitizer's threat model is applied inconsistently across the same rendering pipeline it was added to protect.

## Warnings

### WR-01: `sanitize()` runs after the "has a category name" truthiness check, breaking the uncategorized-last invariant for control-char-only names

**File:** `src/shared/lib/groupOrderItemsForReceipt.ts:50-58`
**Issue:** `groupByCategory` decides whether a row is "uncategorized" using `!trimmedName`, where `trimmedName = row.categoryName?.trim() ?? ''`. JS `String.prototype.trim()` only strips whitespace/line-terminator characters — it does **not** strip C0/C1 control bytes (e.g. `\x01`, `\x1B`). A `categoryName` consisting solely of such control bytes (e.g. `"\x01\x02"`) therefore survives the `trimmedName` truthiness check as non-empty, so the row is routed into the **named** bucket (`key = catId`). Only afterward is `sanitize(trimmedName)` called to build `group.categoryName` (line 58), which strips those same control bytes down to an **empty string**. The result is a phantom named group with `categoryId` set and `categoryName: ''`, sorted alongside real categories by `localeCompare('', ...)` (empty string sorts first) and rendered as a blank header line in the receipt/PDF — not routed to the uncategorized bucket the module's own contract (and the property test `uncategorized-last invariant`) claims is guaranteed. The property test's arbitrary (`arbCategoryName = fc.string(...).filter(s => s.trim().length > 0)`) never generates control-byte-only strings, so this gap isn't caught by the existing suite.
**Fix:** Sanitize before testing for emptiness, e.g.:
```ts
const sanitizedName = sanitize(row.categoryName ?? '');
const key = catId == null || !sanitizedName ? UNCATEGORIZED_KEY : catId;
// ...
categoryName: key === UNCATEGORIZED_KEY ? null : sanitizedName,
```

### WR-02: Category sort ignores the receipt's selected locale

**File:** `src/shared/lib/groupOrderItemsForReceipt.ts:75`
**Issue:** `named.sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''))` calls `localeCompare` with no locale argument, so category ordering follows the JS runtime's default locale rather than the staff's selected `Locale` (`es-MX` / `en-US`). Every other piece of the same rendering pipeline this phase touches explicitly threads the active locale (`receiptT(locale)`, `date.toLocaleString(locale)`, `pdfT(locale)`), but `groupOrderItemsForReceipt.ts` accepts no `locale` parameter at all, so none of its three callers (`receipt-format.ts`, `pdf.tsx`) can pass one through even if they wanted to. For accented Spanish category names (e.g. "Botanas" vs "Bebidas") this can produce a different — and locale-inconsistent — sort order than the rest of the document.
**Fix:** Accept an optional `locale` parameter and pass it to `localeCompare(b.categoryName ?? '', locale)`, defaulting to `undefined` (current behavior) when omitted; thread `getCurrentLocale()` through from the two callers.

### WR-03: `formatModifierLines` output used as a React `key` — duplicate modifier names collide

**File:** `src/widgets/KdsBoard/index.tsx:64-69`
**Issue:**
```tsx
{formatModifierLines(item.modifierNames).map(line => (
  <p key={line} className="text-sm whitespace-pre opacity-80">{line}</p>
))}
```
`key={line}` uses the formatted string itself. `item.modifierNames` comes from `order_items.modifier_ids` (a plain `uuid[]` column, resolved 1:1 to names with no dedup) — see the identical pattern in `supabase/functions/process-payment/index.ts:280-283` and `entities/kds/model/queries.ts:92-110`. If the same modifier is attached to an order item twice (nothing in the schema or these mapping sites prevents duplicate UUIDs in `modifier_ids`), `formatModifierLines` legitimately produces two identical lines (`"  + Extra ice"`, `"  + Extra ice"`), giving React two siblings with the same key. React will warn and may reuse/misplace DOM nodes across re-renders (e.g. when the KDS realtime bridge patches this item). `KdsCard.test.tsx` only covers two *distinct* modifier names, so this path is untested.
**Fix:** Key by index instead of content, since these are display-only lines with no independent identity:
```tsx
{formatModifierLines(item.modifierNames).map((line, i) => (
  <p key={`${item.id}-mod-${i}`} className="text-sm whitespace-pre opacity-80">{line}</p>
))}
```

### WR-04: New control-byte sanitizer is applied to category/modifier text but not to the other free-text fields printed by the same functions

**File:** `src/shared/lib/receipt-format.ts` (all `lines.push(...)` sites using `item.name`, `item.notes`, `data.customerName`, `data.cashierName`, `data.tableLabel`, `receipt.barName`/`barAddress`); `src/shared/lib/groupOrderItemsForReceipt.ts:34-38`
**Issue:** `sanitize()`'s own doc comment explains its purpose: *"Strips C0/C1 control characters (e.g. ESC/POS command bytes)"* — the concrete threat is `printer.rs` sending `line.as_bytes()` raw to the physical thermal printer with no encoding/escaping. This phase applied that protection to `categoryName` (via `groupByCategory`) and to modifier names (via `formatModifierLines`), but `buildThermalReceiptText`/`buildPreChequeText` still interpolate `item.name`, `item.notes`, `customerName`, `cashierName`, `tableLabel`, and `barName`/`barAddress` directly into printed lines with zero sanitization. Since product names, order notes, customer names, and bar settings are all staff/admin-editable free text, a stray control byte (accidental or malicious) in any of those fields reaches the printer unfiltered — the exact class of input the new sanitizer exists to neutralize, just not applied uniformly across the same functions it was added to.
**Fix:** Run `sanitize()` (exported, or promoted to a shared helper) over every free-text field before it's placed on a line — at minimum `item.name` and `item.notes` in both builders, and the header fields (`customerName`, `cashierName`, `tableLabel`, `barName`).

## Info

### IN-01: `groupByCategory` doesn't guard an empty-string `categoryId` the same way it guards an empty `categoryName`

**File:** `src/shared/lib/groupOrderItemsForReceipt.ts:50-58`
**Issue:** The uncategorized check is `catId == null || !trimmedName`. If `categoryId` were ever `''` (empty string, not `null`/`undefined`) while `categoryName` is non-blank, `catId == null` is `false` and the row is keyed by the empty string, producing a "named" group with `categoryId: ''` rather than being folded into the uncategorized bucket — inconsistent with how blank/whitespace `categoryName` is explicitly handled. In practice this is currently unreachable: every caller sources `categoryId` from a `UuidSchema`-validated `Category.id` (or explicit `null` for pool charges), so an empty string can't occur today. Still, the function offers no defensive guard for it, unlike the `categoryName` side.
**Fix:** Treat a blank `categoryId` (`catId === ''`) the same as `null` when computing `key`, for symmetry with the `categoryName` handling — low priority given current callers can't produce this input.

### IN-02: Caja Report top-products `revenue` excludes modifier price delta (pre-existing, copied verbatim)

**File:** `supabase/migrations/20260726000001_caja_report_top_products_category.sql:139-158`
**Issue:** The top-products subquery computes `revenue` as `SUM(oi.quantity * oi.unit_price)`, which omits `oi.modifier_price_delta` — unlike `process-payment/index.ts:272` (`lineTotal = (unit_price + modifier_price_delta) * quantity`) and the RPC's own top-level `payments`-based revenue aggregates. This migration's header comment states the body is copied verbatim from the prior `get_caja_report` definition except for two documented, narrowly-scoped changes (category columns + camelCase keys), so this discrepancy predates Phase 25 and is not a regression introduced here — flagging only because it means the Caja Report's per-product revenue figures can under-report items with paid modifiers, and this file is in the review's file list.
**Fix:** Out of scope for this phase per the migration's own stated intent; worth a follow-up ticket if not already tracked (repo history shows a "tax discrepancy" todo captured after Phase 25 Task 4 verification that may already cover this).

---

_Reviewed: 2026-07-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
