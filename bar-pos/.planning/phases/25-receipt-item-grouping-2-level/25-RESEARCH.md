# Phase 25: Receipt Item Grouping (2-Level) - Research

**Researched:** 2026-07-26
**Domain:** Internal codebase refactor — shared grouping utility across receipt/pre-cheque text builders, KDS card, and Caja Report PDF. No new external libraries.
**Confidence:** HIGH (all findings verified by reading the actual source files and SQL migrations in this repo — no speculative library research needed for a domain this specific to the existing codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Grouping hierarchy**
- **D-01:** The hierarchy is **3 levels, not 2** — Category → Item → Modifiers. User explicitly chose this over the two narrower options (category→item only, or item→modifiers only), acknowledging it exceeds the ROADMAP's literal "2-level" wording. Category = product's category (Phase 1's `parentId` tree — planner/research to decide whether to group by leaf category or top-level ancestor when a product's category has a parent). Item = a merged product+quantity line. Modifiers = that item's selected modifier names, listed under it.
- **D-02:** `groupOrderItemsForReceipt` is a genuinely new shared utility (does not replace or wrap the existing `src/shared/lib/groupOrderItems.ts`, which serves the live cart/payment-form UI and merges by product+modifier-set only — no category level, different call sites). — **Reversibility:** costly — once 4 call sites (receipt-format.ts ×2, KdsCard, pdf.tsx) depend on the new function's output shape, changing that shape means touching all 4 render paths again.

**PDF export scope**
- **D-03:** "PDF export" in the ROADMAP goal refers to the existing Caja Report PDF (`src/shared/lib/exporters/pdf.tsx`, `CajaReportDoc`'s `topProducts` table) — add category grouping/subtotals to that table. There is **no per-order receipt PDF anywhere in the codebase today** (email receipts are plain text via `buildThermalReceiptText`, not PDF) — building one would be a new capability outside this phase's scope, not implementing an existing surface. Confirmed with user; a new per-order PDF was explicitly rejected as out of scope.

**KDS card**
- **D-04:** KdsCard (in `src/widgets/KdsBoard/index.tsx`, shared by both `/kds` and `/kds-bar` — no separate bar-specific card component exists) gets modifiers shown under the product name, matching `buildPreChequeText`'s existing `  + modifier` indented format, including item notes if present. **No layout change to the board itself** — cards stay one-per-item, not clustered under category section headers. This applies automatically to both boards since they share the one widget.

**Which receipt text gets grouped**
- **D-05:** Both `buildThermalReceiptText` (final receipt) and `buildPreChequeText` (pre-cheque) route through `groupOrderItemsForReceipt` and render category groupings. `buildThermalReceiptText` currently shows **no modifiers at all** — this phase adds modifier display to it (bringing it in line with what the pre-cheque already does), in addition to the new category grouping. — **Reversibility:** reversible — text-formatting change, no schema/contract involved.

### Claude's Discretion
- Whether to group by a product's immediate parent category or walk to the top-level ancestor when categories are nested more than one level deep (Phase 1's `parentId` tree supports arbitrary depth) — planner/research to confirm against actual category data shape. **Research recommendation: group by immediate category — see Assumptions Log A1.**
- Exact category-header line formatting for the 32-column thermal layout (e.g., centered, `divider()`-separated, or a plain left-aligned label) — must respect the existing `byteWidth`/UTF-8 column-math constraints already in `receipt-format.ts` (WR-02).
- Whether products with no category (or a null/uncategorized category) get their own "Uncategorized" group or are grouped last without a header — not discussed, planner's call. **Research recommendation: trailing "other" bucket, no header — see Open Question 2.**
- Exact placement/styling of the category subtotal row (if any) in the Caja Report PDF's topProducts table (D-03) — not discussed in depth; a straight re-sort with header rows is the assumed minimum, subtotals are a nice-to-have the planner can size.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. The rejected "new per-order PDF" option (under PDF export scope) was evaluated and explicitly declined by the user, not deferred to a future phase — treat the ROADMAP's "PDF export" wording as satisfied by the Caja Report PDF change (D-03) unless a future phase explicitly scopes a new per-order PDF.

Reviewed but not folded: "Fix 2 pre-existing tsc errors blocking tauri build CI job" and "Relocate misplaced GitHub workflows directory to git root" — repo-hygiene/CI concerns unrelated to receipt formatting, noted for follow-up outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

> No REQUIREMENTS.md exists for this milestone (ROADMAP notes the original source doc, POS-COMPARISON.md §25, is no longer present). Scope is captured entirely in 25-CONTEXT.md's decisions (D-01..D-05) and the ROADMAP's success criteria below, used here as the requirement IDs.

| ID | Description | Research Support |
|----|-------------|-------------------|
| SC-1 | `groupOrderItemsForReceipt` shared utility implements the (3-level, per D-01) grouping | See Architecture Patterns (Pattern 1/2) for the recommended two-function split; Don't Hand-Roll for reusable pieces |
| SC-2 | `receipt-format.ts`, Tauri Rust printer payload, PDF export, and KDS card all consume the shared utility (no duplicated grouping logic) | See System Architecture Diagram; Pitfall 1 (Edge Function data gap is the real blocker for `receipt-format.ts`); confirmed no Rust change needed |
| SC-3 | Existing single-level receipts remain visually correct for orders with no natural grouping | See Validation Architecture — property-test the single-category-degenerates-to-pass-through case |
| SC-4 | Print/PDF/KDS outputs verified consistent against the same order data | See Validation Architecture Sampling Rate; Pitfall 3 (PDF top-10 cap limits what "consistent" can mean for that surface) |

</phase_requirements>

## Summary

This phase is **not primarily a formatting task** — it's a **data-availability task with a formatting task riding on top**. Three of the four target surfaces (pre-cheque, KDS card, and the Caja Report PDF client-side render) already have full product→category and product→modifier data in hand via existing Supabase client queries that embed one level of relations. The fourth and most important surface — the final printed/emailed/previewed receipt (`buildThermalReceiptText`, consumed identically by `pos-printer.ts`, `email-receipt.ts`, and `ReceiptPreview.tsx`) — is built from `ReceiptData`, which is **computed server-side in the `process-payment` Supabase Edge Function** from a SQL query that currently selects only `name, unit_price, modifier_price_delta` per order item. **No category, no modifier IDs, no modifier names reach the client for this surface today.** Extending `buildThermalReceiptText` per D-05 requires an Edge Function code change (Deno) plus a `ReceiptDataSchema` extension — not just a TypeScript formatting change.

Similarly, the Caja Report PDF's `topProducts` table (D-03's target) is populated by a Postgres RPC (`get_caja_report`, in `supabase/migrations/20260420000004_caja_report_rpc.sql`) that aggregates and hard-limits to the **top 10 products by quantity** with no category dimension at all. Adding category grouping there means a new SQL migration to add `category_id`/`category_name` to that inner query — and the planner must accept that grouping only applies to whatever subset of products survived the pre-existing `LIMIT 10`, not a full category rollup (a separate, unrelated existing report, `categoryRevenueToPdfBytes`/`CategoryRevenueRow`, already does true full-category rollups — do not confuse the two, and do not try to make this phase produce that).

For the category-hierarchy depth question (Claude's Discretion in CONTEXT.md — immediate parent vs. walk to top-level ancestor): **every one of the 3 existing client-side queries that embed a product's category (`tab.items[].product.category` used by pre-cheque/KDS, `entities/product` catalog queries, `entities/kds` queries) selects only one relational hop and, in the tab-items case (`src/entities/tab/model/queries.ts` line ~266), does not even select the `parent_id` column.** Walking to a top-level ancestor would require either adding `parent_id` to that select (cheap) plus threading the full flat category list into every one of the 4 render call sites and the Edge Function (not cheap), or a second query at each call site. Given products in this domain (`categories` table) are documented as max depth 3 but bar/restaurant menus in practice are shallow (Drinks, Food, Beer, Cocktails — rarely nested), **grouping by the item's immediate category is the recommended default** — it needs zero additional data plumbing beyond what's already fetched (plus the one Edge Function change below), and it satisfies D-01's literal "Category → Item → Modifiers" wording. Ancestor-walking can be added later behind the same function signature if a real 3-deep menu structure emerges.

**Primary recommendation:** Group by each item's *immediate* category only (no ancestor walk). Split the "one shared utility" into two composable pieces — a category-grouping/sorting function (used by `receipt-format.ts` and the PDF) and a reusable modifier-line formatter (used by `receipt-format.ts` AND `KdsCard`, since KDS explicitly does NOT cluster by category per D-04). Extend the `process-payment` Edge Function's SQL select (copy the existing batch-modifier-name-resolution pattern already used in `src/entities/kds/model/queries.ts`) and add a new Postgres migration extending `get_caja_report`'s top-products subquery with `category_id`/`category_name`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category/item/modifier grouping computation (`groupOrderItemsForReceipt`) | Client (Tauri renderer, `shared/lib`) | — | Pure TS function, no I/O; same tier as existing `groupOrderItems.ts` |
| Modifier-name resolution for the final printed/emailed receipt | API/Backend (Supabase Edge Function `process-payment`) | Database (Postgres `order_items.modifier_ids` uuid[], `modifiers` table) | `ReceiptData` is computed server-side; client never re-fetches order detail for the printed receipt |
| Category-name resolution for the final printed/emailed receipt | API/Backend (Edge Function join to `products.category_id` → `categories.name`) | Database | Same as above — must be added to the Edge Function's existing `order_items` select |
| Category-name resolution for pre-cheque, KDS card, PDF preview | Client (already-loaded TanStack Query cache: `tab.items[].product.category`, `entities/kds` query) | — | Already embedded one relational hop deep — no new fetch needed |
| Top-products category grouping (Caja Report PDF) | API/Backend (Postgres RPC `get_caja_report`) | Client (`pdf.tsx` render/sort) | Aggregation + `LIMIT 10` happens in SQL; client only renders what SQL returns |
| ESC/POS byte encoding of the final formatted lines | Native (Tauri Rust `printer.rs`) | — | Confirmed dumb encoder, zero label strings, **no Rust change needed** for this phase |
| KDS card modifier line rendering | Client (`widgets/KdsBoard`) | — | React component, i18n-lint-gated (`wPanels` namespace) |

## Standard Stack

No new libraries. This phase extends existing first-party code only:

| Library | Version (verified in `package.json`) | Role in this phase |
|---------|---------|---------|
| `@react-pdf/renderer` | `^4.5.1` [VERIFIED: package.json] | Renders `CajaReportDoc`'s `topProducts` table — add category header rows here, no new API surface needed (plain `<View>`/`<Text>`) |
| `zod` | `^4.3.6` [VERIFIED: package.json] | `ReceiptDataSchema` (`edge-function-contracts.ts`), `CajaReportTopProductSchema`/`KdsOrderItemSchema` (`domain.ts`/`entities/kds/model/types.ts`) all need new optional fields |
| `react-i18next` | `17.0.10` [VERIFIED: package.json] | New category-header / modifier-line label strings go through the existing `receipt` (for `receipt-format.ts`/`pdf.tsx`) and `wPanels` (for `KdsCard`) i18n namespaces |
| `fast-check` | `^4.6.0` [VERIFIED: package.json] | Existing property-test pattern for `groupOrderItems.ts`/`category-tree.ts` — follow it for the new grouping function's test |
| `vitest` | `^4.1.4` [VERIFIED: package.json] | Unit test runner — co-locate `groupOrderItemsForReceipt.test.ts` |

No package installs. **Package Legitimacy Audit: N/A — this phase introduces zero new dependencies.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle-safe category-ancestor walking (if the planner later chooses ancestor-walk over immediate-category) | A new tree-walking loop | `src/shared/lib/category-tree.ts`'s existing `isAncestor()`/`getNodeDepth()` cycle-safe pattern — extend with a one-line `getRootAncestorId()` that mirrors `isAncestor`'s `while (current != null)` loop | This file already has property-tested (`category-tree.test.ts`, fast-check) cycle detection for the exact parentId-chain-walking problem; a second hand-rolled walker risks missing the cycle guard |
| Batch-resolving modifier UUIDs → names | A per-order-item modifier lookup query | The exact batch pattern already in `src/entities/kds/model/queries.ts` (lines ~69-85): collect all `modifier_ids` into a `Set`, one `IN (...)` query, build a `Map<id,name>` | Copy-paste this pattern into the `process-payment` Edge Function — it is the established convention in this codebase for `order_items.modifier_ids uuid[]` (no junction table) |
| Product+modifier-set merging for the live cart | A second merge-by-product function | `src/shared/lib/groupOrderItems.ts` (D-02 explicitly: do not touch, do not replace) | Different call site (`PaymentForm`), different merge key (product+modifierSet, no category), pre-existing and out of scope |
| Re-implementing 32-column byte-safe padding/truncation for any new category-header line | New padding math | `receipt-format.ts`'s existing `byteWidth`/`truncateToByteWidth`/`padRight`/`centerLine`/`divider` helpers | WR-02 constraint (UTF-8 byte math, not `.length`) is already solved and tested here; a second implementation risks accented-character misalignment on real hardware |

**Key insight:** every piece of "hard" logic this phase touches (byte-safe padding, category-tree cycle safety, modifier batch-resolution) already has a correct, tested implementation somewhere in this repo. The actual new code is: one grouping/sorting function, one Edge Function SQL+select change, one SQL migration, and a handful of render-site edits.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │  Postgres (Supabase)                     │
                     │  order_items.modifier_ids uuid[]          │
                     │  products.category_id → categories.name  │
                     └───────────────┬───────────────────────────┘
                                     │
        ┌────────────────────────────┼─────────────────────────────┐
        │                            │                              │
        ▼                            ▼                              ▼
┌───────────────┐          ┌──────────────────┐           ┌──────────────────────┐
│ process-payment │        │ get_caja_report   │           │ Client TanStack Query │
│ Edge Function   │        │ RPC (Postgres fn) │           │ (tab.items[].product  │
│ (Deno) — NEEDS  │        │ — NEEDS migration  │           │  .category / .modifiers,│
│ select+batch-   │        │ to add category_id│           │  entities/kds query)   │
│ resolve change  │        │ /name to top-10    │           │ — ALREADY has category│
│                 │        │ subquery           │           │  + modifiers embedded │
└───────┬─────────┘        └─────────┬──────────┘           └───────────┬───────────┘
        │ ReceiptData.items          │ CajaReport.topProducts            │ Tab / KdsOrderItem
        │ (+ categoryId/Name,        │ (+ categoryId/Name)                │
        │  modifierNames — NEW)      │                                    │
        ▼                            ▼                                    ▼
┌────────────────────┐     ┌──────────────────┐            ┌───────────────────────────┐
│ buildThermalReceipt-│     │ pdf.tsx           │            │ buildPreChequeText        │
│ Text() — add        │     │ CajaReportDoc's   │            │ (already flat-fetched)    │
│ category grouping + │     │ topProducts table │            │  +  KdsCard (widgets)     │
│ modifier lines       │     │ — add category    │            │  — modifier line format   │
│ (D-05)               │     │ header rows        │            │    only, NO clustering    │
└──────────┬───────────┘     └──────────────────┘            │    (D-04)                 │
           │ text lines                                       └───────────────────────────┘
           ▼
┌────────────────────┐
│ pos-printer.ts       │──▶ Tauri `print_receipt` invoke ──▶ printer.rs (dumb ESC/POS encoder, UNCHANGED)
│ email-receipt.ts     │──▶ Resend edge function (plain text)
│ ReceiptPreview.tsx    │──▶ <pre> on-screen preview
└────────────────────┘
        ▲
        └── all three consume the SAME buildThermalReceiptText() output — one fix, three surfaces
```

### Recommended Project Structure
```
src/shared/lib/
├── groupOrderItems.ts              # EXISTING — untouched (D-02)
├── groupOrderItemsForReceipt.ts    # NEW — category grouping + sort (used by receipt-format.ts, pdf.tsx)
├── groupOrderItemsForReceipt.test.ts # NEW — vitest + fast-check, mirrors category-tree.test.ts pattern
├── format-modifier-lines.ts        # NEW (or a named export inside the file above) — "  + mod" line formatter
│                                    # shared by receipt-format.ts AND KdsBoard/index.tsx
├── receipt-format.ts                # EXTEND — both text builders consume the new grouping + modifier formatter
└── category-tree.ts                 # EXISTING — only touched if ancestor-walk is chosen over immediate-category

supabase/
├── functions/process-payment/index.ts   # EXTEND — select category_id/name + modifier_ids, batch-resolve names
└── migrations/2026072600000N_caja_report_top_products_category.sql  # NEW — add category_id/name to get_caja_report

src/widgets/KdsBoard/index.tsx      # EXTEND — KdsCard modifier rendering only (no category clustering)
src/shared/lib/exporters/pdf.tsx     # EXTEND — CajaReportDoc topProducts render, group by category
```

### Pattern 1: Two-function split instead of one monolithic "groupOrderItemsForReceipt"
**What:** Expose (a) a category-grouping/sorting function operating on arrays of `{ categoryId, categoryName, ... }`-shaped rows, and (b) a standalone modifier-line formatter `formatModifierLines(modifierNames: string[]): string[]` that returns `["  + Extra cheese", "  + No ice"]`.
**When to use:** (a) is consumed by `receipt-format.ts` (both builders) and `pdf.tsx`. (b) is consumed by `receipt-format.ts` AND `KdsCard` — KDS explicitly must NOT cluster by category (D-04: "cards stay one-per-item, not clustered under category section headers"), so it cannot consume the category-grouping half of a monolithic function without either ignoring its output or being forced into a shape it doesn't need.
**Why this reconciles with D-02's "one shared utility, no duplicated grouping logic":** the modifier-line formatting logic (turning a `string[]` of modifier names into `"  + X"` lines) is the actual duplicated logic across 3 of the 4 surfaces today (`buildPreChequeText` already inlines it at line ~131-133 of `receipt-format.ts`; `KdsCard` does its own `.join(' / ')` at line ~63). Extracting *that* shared piece — not forcing category-clustering onto KDS — is what avoids duplication without violating D-04.
**Example (existing inline pattern to extract, from `receipt-format.ts`):**
```typescript
// Source: src/shared/lib/receipt-format.ts (existing buildPreChequeText, lines ~128-136)
for (const item of data.items) {
  const left = `${String(item.quantity)}× ${item.name}`;
  lines.push(lineLeftRight(left, formatMoney(item.lineTotal)));
  for (const mod of item.modifierNames) {
    lines.push(`  + ${mod}`);
  }
  if (item.notes) {
    lines.push(`  ${tr('precheque.note')}: ${item.notes}`);
  }
}
```

### Pattern 2: Category grouping shape for `groupOrderItemsForReceipt`
**What:** Input is a flat array of items each carrying `categoryId: string | null`, `categoryName: string | null` (already resolved by the caller — the function does NOT reach into a category tree or fetch anything). Output is an array of `{ categoryId: string | null; categoryName: string; items: T[] }` groups, sorted by `categories.sort_order` if available, else by `categoryName`, with a null/missing category collected into a trailing "uncategorized" bucket (e.g. for pool-charge synthetic line items, which have no `categoryId` at all).
**When to use:** `receipt-format.ts`'s `buildThermalReceiptText`/`buildPreChequeText`, and `pdf.tsx`'s `topProducts` render.
**Why generic over `T`:** the PDF's `topProducts` rows (`{ productName, quantity, revenue }`) and the receipt's line items (`{ name, quantity, lineTotal, modifierNames, notes }`) are different shapes — neither has modifiers in the PDF case. A generic `groupByCategory<T extends { categoryId, categoryName }>(items: T[]): CategoryGroup<T>[]` handles both without forcing modifier fields onto rows that don't have them.

### Anti-Patterns to Avoid
- **Forcing category-clustering into `KdsCard`:** D-04 explicitly forbids this. Only wire the modifier-line formatter into KDS, not the category grouper.
- **Ancestor-walking the category tree by default:** none of the 3 client queries that embed category data select `parent_id`, and the Edge Function has zero category data today. Immediate-category is the lower-risk default (see Assumptions Log A1).
- **Treating the Caja Report PDF's `topProducts` category grouping as a true per-category rollup:** it is a re-sort of an already `LIMIT 10`-capped, quantity-sorted list. A category could show 1 product in the PDF even though it sold far more units outside the top 10. Don't conflate this with the existing, separate `categoryRevenueToPdfBytes`/`CategoryRevenueRow` report, which already does true full rollups.
- **Building a new per-order PDF receipt:** D-03 explicitly rejected this as out of scope. "PDF export" in this phase means the Caja Report PDF's `topProducts` table only.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this is additive (new fields, new grouping function, no renamed identifiers, no data migration of existing records). Skipping per the greenfield-omit rule.

## Common Pitfalls

### Pitfall 1: Assuming `buildThermalReceiptText` can be fixed with pure TypeScript
**What goes wrong:** A planner reads D-05 ("add modifier display + category grouping to `buildThermalReceiptText`") and scopes it as a text-formatting change only.
**Why it happens:** `receipt-format.ts` is pure TS with no visible I/O — it's easy to miss that its *input* (`ReceiptData`) is server-computed and currently lacks the needed fields.
**How to avoid:** Any plan touching `buildThermalReceiptText`'s category/modifier display MUST include a task to extend `supabase/functions/process-payment/index.ts`'s SQL select (add `products.category_id`, join `categories(name)`, add `order_items.modifier_ids`, batch-resolve via the `entities/kds` pattern) and extend `ReceiptDataSchema.items` in `edge-function-contracts.ts` with new **optional** fields (`categoryId`, `categoryName`, `modifierNames`) to avoid breaking the 5 existing call sites that construct `ReceiptData` literals (`edge-function-contracts.test.ts`, `pos-printer.test.ts`, `receipt-format.test.ts`, `ReceiptPreview.stories.tsx`, `PaymentModal.stories.tsx`).
**Warning signs:** A plan that lists only `receipt-format.ts` as a file to touch for D-05, with no Edge Function / Deno file in scope.

### Pitfall 2: Editing `supabase.types.ts` unnecessarily
**What goes wrong:** Assuming a new migration always requires `npx supabase gen types typescript` before the code compiles.
**Why it happens:** CLAUDE.md's "Missing generated types workaround" section trains for this reflex.
**How to avoid:** `category_id`, `categories.parent_id`, `categories.name`, and `order_items.modifier_ids` are **all already columns that exist in the DB and are already present in `supabase.types.ts`** (verified: `parent_id` appears in the generated types at line ~346). No table/column additions are needed — only new *selects* of existing columns, and a new Postgres *function* body (`get_caja_report`) whose return type is already `JSON`/untyped. No type regeneration is required for this phase.
**Warning signs:** A plan task that says "regenerate supabase.types.ts" — verify first whether it's actually needed before adding it.

### Pitfall 3: `get_caja_report`'s top-products query is `LIMIT 10`
**What goes wrong:** Grouping the PDF's `topProducts` by category, a naive implementation groups then shows "look, full category breakdowns!" when it's actually just 10 rows total, re-sorted.
**Why it happens:** The `LIMIT 10 ... ORDER BY quantity DESC` in `supabase/migrations/20260420000004_caja_report_rpc.sql` (lines 71-88) happens BEFORE any category grouping could occur.
**How to avoid:** Either (a) accept the existing 10-row cap and add category headers/subtotals only within those 10 rows (matches D-03's "straight re-sort with header rows is the assumed minimum" discretion note), or (b) if a truer per-category top-N is wanted, that's a bigger SQL rewrite (window functions partitioned by category) that should be called out explicitly as an option, not silently assumed.
**Warning signs:** UAT expecting "all products in a category" to appear under a PDF category header when only the global top 10 by quantity are ever fetched.

### Pitfall 4: `exactOptionalPropertyTypes` when adding new optional fields
**What goes wrong:** Writing `categoryName?: string` on new mutation/receipt-building input types.
**Why it happens:** Habit; but this repo's `tsconfig` has `exactOptionalPropertyTypes: true`.
**How to avoid:** Per CLAUDE.md's documented gotcha, write `categoryName: string | undefined` for any new field on object literals built by app code (the Deno Edge Function is a separate tsconfig/runtime and not subject to this, but the client-side Zod-inferred types and any mapping code are).
**Warning signs:** TS errors like "Type 'string | undefined' is not assignable to type 'string' with exactOptionalPropertyTypes" on the new fields.

### Pitfall 5: i18n lint gate applies to `KdsBoard` but not to `receipt-format.ts`/`pdf.tsx`
**What goes wrong:** Assuming `i18next/no-literal-string` will catch a hardcoded category-header label anywhere.
**Why it happens:** CLAUDE.md documents the lint gate as scoped to `shared/ui`, `entities`, `features`, `widgets`, `pages` — NOT `shared/lib`.
**How to avoid:** `receipt-format.ts` and `pdf.tsx` live in `shared/lib` and are **not lint-gated** for literal strings, but both already consistently route every label through `receiptT()`/`pdfT()` (`i18n.getFixedT(locale, 'receipt')`). Follow that existing convention for new category-header / "uncategorized" labels even though lint won't enforce it — for consistency and because the receipt is genuinely multi-locale (es-MX/en-US). `KdsBoard/index.tsx` IS lint-gated (`widgets` layer, `wPanels` namespace) — any new literal string there will fail `npm run lint` (max-warnings 0).

## Code Examples

### Existing modifier-line formatting to extract (pre-cheque, already correct)
```typescript
// Source: src/shared/lib/receipt-format.ts, buildPreChequeText (existing)
for (const mod of item.modifierNames) {
  lines.push(`  + ${mod}`);
}
```

### Existing batch modifier-name resolution to copy into the Edge Function
```typescript
// Source: src/entities/kds/model/queries.ts (existing, lines ~69-85)
const allModifierIds = Array.from(
  new Set(rows.flatMap(row => (row['modifier_ids'] ?? []) as string[]))
);
const modifierNameById = new Map<string, string>();
if (allModifierIds.length > 0) {
  const { data: modifierRows, error: modifierErr } = await db
    .from('modifiers')
    .select('id, name')
    .in('id', allModifierIds);
  // ... populate modifierNameById
}
```
Note: the Edge Function (`supabase/functions/process-payment/index.ts`) uses the Supabase JS client too (`admin.from(...)`), so this exact pattern ports directly — only the `admin` client name and Deno import differ.

### Existing DOWN-script migration convention to follow
```sql
-- Source: supabase/migrations/20260721000003_modifier_popularity_rpc.sql (existing convention)
GRANT EXECUTE ON FUNCTION get_modifier_popularity_report(timestamptz, timestamptz) TO authenticated;

COMMIT;

-- =============================================================================
-- DOWN:
-- Function is new. Rollback = drop it:
--   DROP FUNCTION IF EXISTS get_modifier_popularity_report(timestamptz, timestamptz);
-- =============================================================================
```
New migration for this phase should follow the same `CREATE OR REPLACE FUNCTION get_caja_report(...)` pattern (it already exists — this is a modification, so the DOWN comment should point back to the prior version's SQL body or note "revert = re-apply migration 20260420000004 without the category columns").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `buildThermalReceiptText` shows product name + price only, zero modifiers | Add modifier lines matching the pre-cheque's `  + mod` convention | This phase (D-05) | First time the final receipt/email shows what modifiers were ordered — bring it to parity with the pre-cheque |
| `topProducts` flat list, no category dimension | Category-grouped subset of the same top-10 rows | This phase (D-03) | Cosmetic grouping only — does not change what's included, just how the existing 10 rows are presented |

**Deprecated/outdated:** None — this phase adds capability, doesn't replace anything deprecated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Grouping should use the item's *immediate* category, not walk to a top-level ancestor | Summary, Architecture Patterns (Anti-Patterns) | If the actual menu data is deeply nested (3 levels) and the business wants top-level grouping (e.g. "Drinks" not "Craft Cocktails"), this recommendation under-delivers and would need a follow-up to add `parent_id` to the tab-items category select plus thread the full category list into 4 call sites + the Edge Function. Low risk given CONTEXT.md's own discretion note frames this as "planner/research to confirm against actual category data shape" and this research found no evidence of deep nesting in current queries. |
| A2 | A generic `groupByCategory<T>` function (input already carrying resolved `categoryId`/`categoryName`) is preferable to a single monolithic function that also resolves modifier names | Architecture Patterns Pattern 1/2 | If the planner instead builds one large function that both groups AND resolves modifiers/category from raw IDs, `KdsCard`'s no-clustering requirement (D-04) becomes awkward to satisfy without over-fetching or ignoring half the function's output. Medium confidence — based on directly reading D-04's constraint against the CONTEXT.md's own "shares one new function" framing for 4 call sites, which appear to be in tension. |
| A3 | The Caja Report PDF's category grouping only needs to re-sort/header the existing `LIMIT 10` top-products rows, not rewrite the aggregation to be truly per-category | Common Pitfalls #3 | If stakeholders actually want "top N products PER category" (a materially bigger SQL change with window functions), this assumption undersells the scope. CONTEXT.md's own D-03 discretion note ("straight re-sort... is the assumed minimum") supports this reading, but it was not discussed in depth with the user. |

## Open Questions

1. **Should the Edge Function's new `categoryId`/`categoryName`/`modifierNames` fields be required or optional on `ReceiptDataSchema`?**
   - What we know: 5 existing call sites construct `ReceiptData` literals without these fields today (tests + stories).
   - What's unclear: Whether the planner wants a hard migration touching all 5, or a soft optional-field rollout.
   - Recommendation: Make them optional/defaulted (`categoryId: UuidSchema.nullable().optional()`, `categoryName: z.string().nullable().optional()`, `modifierNames: z.array(z.string()).default([])`) to avoid a forced 5-file test/story update wave that has nothing to do with this phase's actual goal. `buildThermalReceiptText` should treat missing category as "uncategorized."

2. **Pool-charge line items (synthetic, non-product rows) — what category do they group under?**
   - What we know: Pool charges are pushed into `items[]` (both in the Edge Function and in `usePrintPreCheque.ts`) with no `productId`/category at all.
   - What's unclear: Whether they get their own "Pool" pseudo-category header or fall into the "uncategorized"/"other" trailing bucket.
   - Recommendation: Trailing "other"/uncategorized bucket, consistent with how any category-less row should be handled per CONTEXT.md's Claude's Discretion note — avoids inventing a fake category id.

## Environment Availability

> Skipped — this phase's only "external dependency" is the already-running Supabase project (used by every phase in this codebase) and the existing Supabase CLI migration workflow; no new tool/service dependency is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.4 (unit), Playwright v1.59 (e2e) |
| Config file | `vitest.config.ts` (project: `unit`); `playwright.config.ts` |
| Quick run command | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (manual, pre-release) |

### Phase Requirement → Test Map
> No REQUIREMENTS.md exists for this milestone; requirement IDs below are derived from CONTEXT.md's success criteria (see `<phase_requirements>` below for the canonical mapping used by the planner).

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|--------------------|--------------|
| SC-1 | `groupOrderItemsForReceipt`/`groupByCategory` groups items into category buckets, sorted, with an "uncategorized" trailing bucket | unit | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ Wave 0 |
| SC-2 | `receipt-format.ts`, KDS card, PDF export all consume shared modifier/grouping helpers (no duplicated logic) | unit + manual code read | `npx vitest run src/shared/lib/receipt-format.test.ts` | ✅ exists, extend |
| SC-2b | Edge Function returns `categoryId`/`categoryName`/`modifierNames` per receipt item | integration (manual — Deno edge function, not unit-testable from Vitest without a Supabase local stack) | manual verification against local Supabase / `supabase functions serve` | ❌ Wave 0 — no existing Deno test harness for this function in-repo |
| SC-3 | Single-level receipts (all items same/no category) still render correctly | unit (property-based, fast-check: category grouping degenerates to a single-group pass-through when all items share one category) | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ Wave 0 |
| SC-4 | Print/PDF/KDS outputs consistent for the same order data | unit (shared fixture across `receipt-format.test.ts`, a new `pdf` test, and KDS component test) — full cross-surface consistency is best verified manually/UAT | `npm run test` | Partial — component-level KDS tests may not exist; check `src/widgets/KdsBoard/*.test.tsx` |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run test` (full unit suite) + `npm run typecheck` + `npm run lint`
- **Phase gate:** Full unit suite green, plus a manual verification pass against a real Supabase Edge Function invocation (no automated integration harness exists for `process-payment` today) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/shared/lib/groupOrderItemsForReceipt.test.ts` — new file, covers SC-1/SC-3, follow `category-tree.test.ts`'s fast-check property pattern
- [ ] Manual verification path for the `process-payment` Edge Function change (SC-2b) — no existing Deno/integration test harness for this function; confirm via local Supabase invocation or a UAT step, not a new automated test (out of proportion for this phase's size)
- [ ] Check whether `src/widgets/KdsBoard/index.test.tsx` (or similar) exists before assuming KDS modifier-format changes are covered — confirm during planning, not assumed here

## Security Domain

> `security_enforcement` absent from `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Phase touches no auth surface — `process-payment` already requires a Bearer JWT, unchanged |
| V3 Session Management | No | Not touched |
| V4 Access Control | No | Edge Function change only adds columns to an existing authenticated, already-scoped-by-`tabId` query; no new access path introduced |
| V5 Input Validation | Yes (unchanged posture) | New `ReceiptDataSchema` fields validated via existing Zod (`edge-function-contracts.ts`); Postgres migration uses parameterized `plpgsql` function args (`p_caja_id UUID`), not string concatenation — keep this pattern |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via a naive category-name/label interpolated into raw SQL | Tampering | The existing `get_caja_report` function already uses parameterized `plpgsql` (`p_caja_id UUID` typed arg, no dynamic SQL string building) — the new category-grouping addition must follow the same `SELECT ... FROM ... WHERE ... = ANY(v_tab_ids)` pattern, never `EXECUTE format(...)` with user input |
| CSV/receipt-text formula injection (Phase 24's `sanitizeCsvCell` precedent) | Tampering | Not applicable here — this phase produces plain-text ESC/POS output and a `@react-pdf/renderer` PDF, neither of which is opened by spreadsheet software; no formula-injection vector exists for this output format |
| Over-fetching PII via the new category/modifier joins | Information Disclosure | The Edge Function already runs as `SECURITY DEFINER`/service-role scoped strictly to `tabId`-owned `order_items`; adding `products.category_id`/`categories.name` and `modifiers.name` joins introduces no new PII — these are menu/catalog fields, not customer data |

## Sources

### Primary (HIGH confidence — read directly from repo)
- `src/shared/lib/receipt-format.ts` — both text builders, byte-width column math
- `src/shared/lib/groupOrderItems.ts` — existing, separate grouping utility (D-02 boundary)
- `src/shared/lib/edge-function-contracts.ts` — `ReceiptDataSchema` (lines 29-60)
- `supabase/functions/process-payment/index.ts` — server-side ReceiptData construction (lines 190-313)
- `src/shared/lib/pos-printer.ts`, `src/shared/lib/email-receipt.ts`, `src/features/process-payment/ui/ReceiptPreview.tsx` — confirmed all 3 consume the same `buildThermalReceiptText` output
- `src/entities/tab/model/queries.ts` (lines 258-280) — confirmed `category:categories(id, name, color, sort_order, created_at)` select excludes `parent_id`
- `src/entities/kds/model/queries.ts` (lines 27-119) — KDS query shape, batch modifier-name-resolution pattern to copy
- `src/entities/kds/model/types.ts` — `KdsOrderItemSchema` already has `categoryId`, lacks `categoryName`
- `src/widgets/KdsBoard/index.tsx` (lines 31-88) — `KdsCard`, current `.join(' / ')` modifier rendering
- `src/shared/lib/exporters/pdf.tsx` — `CajaReportDoc`'s `topProducts` table (lines 62-146), separate pre-existing `CategoryRevenueRow` report (lines ~300+)
- `supabase/migrations/20260420000004_caja_report_rpc.sql` (lines 1-100) — `get_caja_report` RPC, confirmed `LIMIT 10` top-products subquery with no category dimension
- `supabase/migrations/20260721000003_modifier_popularity_rpc.sql` — DOWN-script migration convention to follow
- `src/shared/lib/domain.ts` — `CategorySchema` (parentId, max depth 3 comment), `ProductSchema` (categoryId non-nullable), `OrderItemSchema` (modifierIds/modifiers), `CajaReportTopProductSchema`
- `src/shared/lib/category-tree.ts` + `category-tree.test.ts` — existing cycle-safe ancestor-walking pattern, fast-check test convention
- `src/shared/lib/supabase.types.ts` — confirmed `parent_id` already present in generated types (no regeneration needed)
- `package.json` — confirmed no new dependency need (`@react-pdf/renderer ^4.5.1`, `zod ^4.3.6`, `react-i18next 17.0.10`, `fast-check ^4.6.0`, `vitest ^4.1.4`)
- `.planning/phases/25-receipt-item-grouping-2-level/25-CONTEXT.md` — locked decisions D-01..D-05, discretion areas
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement` absent (treated enabled)

### Secondary (MEDIUM confidence)
- None — no external web research was needed; every finding above was verified by direct file reads in this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all versions read from `package.json`
- Architecture: HIGH — every data-flow claim verified by reading the actual query/select/migration code, not inferred
- Pitfalls: HIGH — the Edge Function data gap and the `LIMIT 10` constraint were discovered by reading the actual SQL, not assumed

**Research date:** 2026-07-26
**Valid until:** No expiry driver — this is internal-codebase research, not third-party library research; valid until the underlying files change (re-research if `process-payment/index.ts`, `get_caja_report`, or `receipt-format.ts` are touched by an intervening phase before this one executes).
