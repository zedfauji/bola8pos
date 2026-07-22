# Phase 25: Receipt Item Grouping (2-Level) - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Group order-item lists by product category (2 levels: category → item) across every surface that renders them for a human to read: the thermal pre-cheque/receipt text (`receipt-format.ts`), a **new** receipt PDF export (does not exist yet — this phase builds it), and the KDS board (category-labeled sections, still per-item bump cards). All surfaces share one `groupOrderItemsForReceipt` utility function that returns the grouped structure; each surface renders that structure its own way.

`printer.rs` requires **no structural change** — it already just prints `Vec<String>` lines built entirely in TS/`receipt-format.ts`; it has no grouping logic of its own to extend. Confirmed with user this "surface" is covered by leaving it as a dumb line-printer.

</domain>

<decisions>
## Implementation Decisions

### Grouping key & shape
- **D-01:** Two levels = category → item. Group key is the item's product category name (not the full nested category tree from Phase 1, not routing/kitchen-bar).
- **D-02:** If ALL items in an order share one category, collapse — print the flat list with no category header, so today's output is unchanged byte-for-byte for the common single-category order.
- **D-03:** Items with a null/uncategorized product category bucket into an "Other"/uncategorized group with a localized fallback label (via the existing `receipt` i18n namespace) — they do NOT stand alone ungrouped.

### Surfaces in scope
- **D-04:** `receipt-format.ts` (`buildThermalReceiptText` / `buildPreChequeText`) — extend to group items by category before rendering item lines.
- **D-05:** New receipt PDF export — does not exist today (only report PDFs exist in `shared/lib/exporters/pdf.tsx`). Build as a **new standalone print-to-PDF button on the receipt/pre-cheque screens** (e.g. near `ReceiptPreview.tsx`), not folded into the existing reports `ExportButtons` pattern.
- **D-06:** KDS board — add category header labels as section dividers within a ticket/board view. Per-item behavior is UNCHANGED: each item keeps its own card and its own bump button (pending → in_progress → done). This is visual grouping only, not a combined bump action.
- **D-07:** `printer.rs` (Rust) — no code change. It remains a dumb consumer of pre-built line strings; grouping happens entirely on the TS side before lines are handed to it.

### Claude's Discretion
- Exact category-header formatting per surface (thermal 32-col centered/left-aligned label vs. PDF heading style vs. KDS section divider styling) — implementer's call, staying within each surface's existing formatting conventions (see `code_context` below).
- Whether `groupOrderItemsForReceipt` lives in `shared/lib/receipt-format.ts` itself or a new `shared/lib/` module — planner's call.
- Sort order of categories within a receipt (e.g. category creation order vs. first-item-appearance order) — not discussed, use first-item-appearance order unless research surfaces an existing convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

Note: `.planning/comparison/POS-COMPARISON.md` — the original source doc for this phase's requirements (§25) — was checked and **no longer exists** in the repo. This CONTEXT.md is the sole source of locked scope for Phase 25; ROADMAP.md's "Requirements: TBD" note is now resolved by this document.

### Receipt formatting
- `src/shared/lib/receipt-format.ts` — thermal pre-cheque/receipt text builders (`buildPreChequeText`, `buildThermalReceiptText`); byte-width-safe padding/truncation helpers for 32-col ESC/POS output. Grouping must respect these UTF-8 byte-width helpers.
- `src/shared/lib/receipt-format.test.ts` — existing test coverage to extend.

### Printer / Rust
- `src-tauri/src/commands/printer.rs` — `print_receipt(lines: Vec<String>)`; confirmed no change needed (D-07).

### PDF export pattern (for the new receipt PDF, D-05)
- `src/shared/lib/exporters/pdf.tsx` — existing report-PDF builders (`cajaReportToPdfBytes`, etc.) for style/library reference only; the new receipt PDF function should follow this module's conventions but is triggered from a different UI entry point per D-05.

### KDS
- `src/widgets/KdsBoard/index.tsx` — `KdsCard` (per-item) and `ComboKdsCard` (per-combo, already has a Collapsible children pattern worth reusing for category dividers) components to extend with category section headers.

### i18n
- `src/shared/lib/i18n/locales/{es-MX,en-US}/receipt.json` (namespace `receipt`) — add the "Other/uncategorized" fallback label and any new category-header copy here, es-MX byte-identical to current literal where applicable, en-US genuine translation (project convention, see CLAUDE.md i18n section).

**No other external specs** — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `receipt-format.ts`'s `byteWidth` / `truncateToByteWidth` / `padRight` / `lineLeftRight` / `centerLine` / `divider` helpers — grouping must feed through these unchanged for thermal output.
- `KdsBoard`'s existing `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` pattern (already used for combo children) is a plausible reusable pattern for category sections, though D-06 specifies headers-as-dividers rather than collapsible groups — implementer's call whether to reuse this component.
- `shared/lib/exporters/pdf.tsx` — existing PDF generation approach (likely pdf-lib or similar; confirm library at planning time) to mirror for the new receipt PDF function.

### Established Patterns
- Every receipt-facing string goes through the `receipt` i18n namespace via `receiptT(locale)` / `i18n.getFixedT(locale, 'receipt')` — new category-header/uncategorized-label copy must follow this, not hardcoded strings (ESLint `i18next/no-literal-string` gate enforces this in `shared`/`entities`/`features`/`widgets`/`pages`).
- Thermal text is measured in UTF-8 byte width, never `.length` — critical invariant for any new grouping/header lines (WR-02 comment in receipt-format.ts).

### Integration Points
- `receipt-format.ts` consumers: `src/features/print-precheque/usePrintPreCheque.ts`, `src/features/process-payment/ui/ReceiptPreview.tsx`, `src/shared/lib/email-receipt.ts`. The new PDF export button likely lives near `ReceiptPreview.tsx`.
- `KdsOrderItem` type (from `@entities/kds`) — the shared grouping utility's input type should align with (or be a mapping from) `KdsOrderItem`/`ReceiptData['items']`/`PreChequeData['items']` shapes, which currently differ slightly — planner should reconcile a common input shape for `groupOrderItemsForReceipt`.

</code_context>

<specifics>
## Specific Ideas

No specific visual mockups or exact copy were given. Key concrete constraints locked: collapse-when-single-category (D-02), uncategorized bucket (D-03), KDS stays per-item-bump (D-06), PDF is a new standalone button not part of the reports export system (D-05).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope-creep suggestions came up during discussion.

</deferred>

---

*Phase: 25-receipt-item-grouping-2-level*
*Context gathered: 2026-07-21*
