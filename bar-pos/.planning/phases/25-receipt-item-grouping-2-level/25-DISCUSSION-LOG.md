# Phase 25: Receipt Item Grouping (2-Level) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 25-receipt-item-grouping-2-level
**Areas discussed:** Surfaces in scope, Grouping key, KDS scope, KDS bump UX, PDF trigger, Single-group case, Uncategorized items

---

## Surfaces in scope

Roadmap goal named 4 surfaces: `receipt-format.ts`, Tauri Rust printer payload, PDF export, KDS card. Codebase scout found: no receipt PDF exporter exists yet (only report PDFs), `printer.rs` has no grouping logic of its own (just prints pre-built `Vec<String>` lines), KDS shows one card per order-item.

| Option | Description | Selected |
|--------|-------------|----------|
| receipt-format.ts (thermal print text) | Real today, prints via printer.rs | ✓ |
| New receipt PDF export | Doesn't exist yet — building from scratch | ✓ |
| KDS card grouping | Changing per-item KDS cards to a grouped ticket view | ✓ |
| Rust payload itself | printer.rs takes lines already built by TS — no grouping logic of its own | ✓ (confirmed: no code change needed, D-07) |

**User's choice:** All 4 selected — full original scope confirmed, with the caveat that "Rust payload" scope is satisfied by leaving it unchanged (TS does all grouping).

---

## Grouping key

| Option | Description | Selected |
|--------|-------------|----------|
| Category → item | Group by product category name | ✓ |
| Category → subcategory → item | Full category tree depth | |
| Routing (kitchen/bar) → category → item | Prep-station-first grouping | |

**User's choice:** Category → item.

---

## KDS scope

| Option | Description | Selected |
|--------|-------------|----------|
| Same category grouping as receipts | One `groupOrderItemsForReceipt` used identically everywhere | ✓ |
| KDS keeps its own per-item cards, no grouping change | Descope KDS from this phase | |

**User's choice:** Same category grouping as receipts.

---

## KDS bump UX

| Option | Description | Selected |
|--------|-------------|----------|
| Category header + still-separate bump cards under it | Visual grouping only, no change to bump logic | ✓ |
| One grouped card per category, bump-all button | Combines items into one card with one bump action | |

**User's choice:** Category header + still-separate bump cards under it.

---

## PDF trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse ExportButtons pattern from reports | Same pdf.tsx module, new function, consistent with report PDFs | |
| New standalone print-to-PDF button on receipt/pre-cheque screens | Separate UI entry point outside the reports export system | ✓ |

**User's choice:** New standalone print-to-PDF button on receipt/pre-cheque screens (e.g. near ReceiptPreview.tsx).

---

## Single-group case

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse — no header if only one category | Matches today's output byte-for-byte for the common case | ✓ |
| Always show category header, even if just one | Changes existing output for every order | |

**User's choice:** Collapse — no header if only one category.

---

## Uncategorized items

| Option | Description | Selected |
|--------|-------------|----------|
| Bucket into an "Other"/uncategorized group | Localized fallback label via receipt i18n namespace | ✓ |
| Treat as their own single-item groups, no shared header | Each stands alone | |

**User's choice:** Bucket into an "Other"/uncategorized group.

---

## Claude's Discretion

- Exact category-header formatting per surface (thermal 32-col style vs. PDF heading style vs. KDS section divider styling).
- Whether `groupOrderItemsForReceipt` lives in `receipt-format.ts` or a new module.
- Category sort order within a receipt (defaulting to first-item-appearance order absent other guidance).

## Deferred Ideas

None — discussion stayed within phase scope.
