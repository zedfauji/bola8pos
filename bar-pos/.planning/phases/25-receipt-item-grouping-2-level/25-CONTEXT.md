# Phase 25: Receipt Item Grouping (2-Level) - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Group order-line items into a shared hierarchy — category → item → modifiers — across every surface that renders order items outside the live POS cart: the final thermal receipt, the pre-cheque, the KDS card (both `/kds` and `/kds-bar`, which share one widget), and the Caja Report PDF's top-products table. All four surfaces route through one new `groupOrderItemsForReceipt` utility instead of each re-implementing grouping/flattening logic. No change to the live cart UI itself (`PaymentForm`'s existing `groupOrderItems.ts` merge-by-modifier-set logic is a separate, pre-existing concern and is not being replaced).

</domain>

<decisions>
## Implementation Decisions

### Grouping hierarchy
- **D-01:** The hierarchy is **3 levels, not 2** — Category → Item → Modifiers. User explicitly chose this over the two narrower options (category→item only, or item→modifiers only), acknowledging it exceeds the ROADMAP's literal "2-level" wording. Category = product's category (Phase 1's `parentId` tree — planner/research to decide whether to group by leaf category or top-level ancestor when a product's category has a parent). Item = a merged product+quantity line. Modifiers = that item's selected modifier names, listed under it.
- **D-02:** `groupOrderItemsForReceipt` is a genuinely new shared utility (does not replace or wrap the existing `src/shared/lib/groupOrderItems.ts`, which serves the live cart/payment-form UI and merges by product+modifier-set only — no category level, different call sites). — **Reversibility:** costly — once 4 call sites (receipt-format.ts ×2, KdsCard, pdf.tsx) depend on the new function's output shape, changing that shape means touching all 4 render paths again.

### PDF export scope
- **D-03:** "PDF export" in the ROADMAP goal refers to the existing Caja Report PDF (`src/shared/lib/exporters/pdf.tsx`, `CajaReportDoc`'s `topProducts` table) — add category grouping/subtotals to that table. There is **no per-order receipt PDF anywhere in the codebase today** (email receipts are plain text via `buildThermalReceiptText`, not PDF) — building one would be a new capability outside this phase's scope, not implementing an existing surface. Confirmed with user; a new per-order PDF was explicitly rejected as out of scope.

### KDS card
- **D-04:** KdsCard (in `src/widgets/KdsBoard/index.tsx`, shared by both `/kds` and `/kds-bar` — no separate bar-specific card component exists) gets modifiers shown under the product name, matching `buildPreChequeText`'s existing `  + modifier` indented format, including item notes if present. **No layout change to the board itself** — cards stay one-per-item, not clustered under category section headers. This applies automatically to both boards since they share the one widget.

### Which receipt text gets grouped
- **D-05:** Both `buildThermalReceiptText` (final receipt) and `buildPreChequeText` (pre-cheque) route through `groupOrderItemsForReceipt` and render category groupings. `buildThermalReceiptText` currently shows **no modifiers at all** — this phase adds modifier display to it (bringing it in line with what the pre-cheque already does), in addition to the new category grouping. — **Reversibility:** reversible — text-formatting change, no schema/contract involved.

### Claude's Discretion
- Whether to group by a product's immediate parent category or walk to the top-level ancestor when categories are nested more than one level deep (Phase 1's `parentId` tree supports arbitrary depth) — planner/research to confirm against actual category data shape.
- Exact category-header line formatting for the 32-column thermal layout (e.g., centered, `divider()`-separated, or a plain left-aligned label) — must respect the existing `byteWidth`/UTF-8 column-math constraints already in `receipt-format.ts` (WR-02).
- Whether products with no category (or a null/uncategorized category) get their own "Uncategorized" group or are grouped last without a header — not discussed, planner's call.
- Exact placement/styling of the category subtotal row (if any) in the Caja Report PDF's topProducts table (D-03) — not discussed in depth; a straight re-sort with header rows is the assumed minimum, subtotals are a nice-to-have the planner can size.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap
- `.planning/ROADMAP.md` §"Phase 25: Receipt Item Grouping (2-Level)" — goal and success criteria (no dependencies)
- No REQUIREMENTS.md file exists in `.planning/` for this milestone; ROADMAP notes the original source doc (`POS-COMPARISON.md §25`) is no longer present — scope is fully captured in this CONTEXT.md instead.

### Existing grouping/receipt code (must extend, not duplicate)
- `src/shared/lib/receipt-format.ts` — `buildThermalReceiptText` and `buildPreChequeText`, both need `groupOrderItemsForReceipt` wired in (D-05). Contains the UTF-8 byte-width column math (`byteWidth`, `truncateToByteWidth`, `LINE = 32`) that any new category-header line must respect (WR-02 comment at top of file).
- `src/shared/lib/pos-printer.ts` — `receiptDataToPrinterLines()` calls `buildThermalReceiptText` then splits on `\n` for Rust; no Rust-side change needed (see below).
- `src-tauri/src/commands/printer.rs` — confirmed dumb ESC/POS byte encoder only; holds zero receipt-label strings per its own file header comment. The ROADMAP's "Tauri Rust printer payload" phrasing does NOT require a Rust change — ecoding logic is untouched, only the TS-built lines array changes.
- `src/shared/lib/groupOrderItems.ts` — the EXISTING but DIFFERENT grouping utility (merges by product+modifier-set for the live cart/`PaymentForm`). Do not confuse with the new `groupOrderItemsForReceipt` (D-02); do not modify this file as part of this phase.
- `src/widgets/KdsBoard/index.tsx` — `KdsCard` component, shared by both `/kds` and `/kds-bar` pages (confirmed via grep — no separate bar-specific card exists). Modifier display change (D-04) lands here.
- `src/shared/lib/exporters/pdf.tsx` — `CajaReportDoc`'s `topProducts` table (D-03's target). Uses `@react-pdf/renderer`, locale-aware via `i18n.getFixedT(locale, 'receipt')`.
- `src/shared/lib/email-receipt.ts` — confirms email receipts are plain text (`buildThermalReceiptText` output), not PDF — supports D-03's finding that no per-order PDF exists.

### Category data model
- `src/shared/lib/domain.ts` — `CategorySchema` (line ~184), `parentId: UuidSchema.nullable().optional()` — the hierarchical category tree from Phase 1 that D-01's "Category" level reads from.

No other external specs/ADRs — scope is fully captured in this CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatMoney` (`@shared/lib/domain-helpers`) — already used throughout `receipt-format.ts` for money formatting; new category subtotal lines (if any) should reuse it.
- `i18n.getFixedT(locale, 'receipt')` pattern — already used in both `receipt-format.ts` (`receiptT`) and `pdf.tsx` (`pdfT`) for locale-scoped translation outside React component trees; any new category-header label strings go through the `receipt` i18n namespace, following Phase 21's i18n convention (`i18next/no-literal-string` lint gate applies).
- `Collapsible`/`CollapsibleContent` (`@shared/ui/collapsible`) — already used in `KdsBoard`/`KdsCard` for existing expand/collapse UI; may be relevant if modifier display (D-04) needs a toggle, though the default expectation is always-visible (matching pre-cheque, which has no collapse).

### Established Patterns
- `receipt-format.ts` builds fully pre-formatted text/lines; `src-tauri/src/commands/printer.rs` only ESC/POS-encodes what it's given — all formatting logic belongs in TypeScript, never in Rust (explicit convention documented in printer.rs's own file header).
- 32-column (58mm) fixed-width layout with UTF-8-byte-safe truncation (`byteWidth`) is mandatory for any new line added to `buildThermalReceiptText`/`buildPreChequeText`.

### Integration Points
- `src/shared/lib/receipt-format.ts` — both text builders (D-05)
- `src/widgets/KdsBoard/index.tsx` — `KdsCard` (D-04)
- `src/shared/lib/exporters/pdf.tsx` — `CajaReportDoc` (D-03)
- New shared utility location: planner's call, but `src/shared/lib/groupOrderItemsForReceipt.ts` (sibling to the existing `groupOrderItems.ts`) is the natural fit given FSD conventions (zero business logic beyond grouping, lives in `shared/lib`).

</code_context>

<specifics>
## Specific Ideas

- KDS card modifier formatting should visually match the pre-cheque's existing `  + modifier` indented style — user confirmed reusing that exact convention rather than inventing a new one.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The rejected "new per-order PDF" option (under PDF export scope) was evaluated and explicitly declined by the user, not deferred to a future phase — treat the ROADMAP's "PDF export" wording as satisfied by the Caja Report PDF change (D-03) unless a future phase explicitly scopes a new per-order PDF.

### Reviewed Todos (not folded)
- "Fix 2 pre-existing tsc errors blocking tauri build CI job" and "Relocate misplaced GitHub workflows directory to git root" — surfaced as loose keyword matches during `cross_reference_todos`, but both are repo-hygiene/CI concerns unrelated to receipt formatting. User asked for git repo cleanup (uncommitted worktrees, ensure everything is pushed) as a separate, general request — noted for follow-up outside this phase's planning, not folded into Phase 25 scope.

</deferred>

---

*Phase: 25-receipt-item-grouping-2-level*
*Context gathered: 2026-07-26*
