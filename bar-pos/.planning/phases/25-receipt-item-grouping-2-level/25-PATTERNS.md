# Phase 25: Receipt Item Grouping (2-Level) - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/shared/lib/groupOrderItemsForReceipt.ts` (new) | utility | transform | `src/shared/lib/groupOrderItems.ts` (merge logic) + `src/shared/lib/category-tree.ts` (grouping/sort conventions) | role-match (transform utility, same layer) |
| `src/shared/lib/groupOrderItemsForReceipt.test.ts` (new) | test | transform | `src/shared/lib/category-tree.test.ts` (fast-check property pattern, not read in full but referenced by RESEARCH) | role-match |
| `src/shared/lib/receipt-format.ts` (extend) | utility | transform | itself (existing `buildPreChequeText` modifier-line loop to extract into `buildThermalReceiptText`) | exact |
| `src/widgets/KdsBoard/index.tsx` (extend `KdsCard`) | component | request-response (render) | itself (existing `item.modifierNames.join(' / ')` block, lines 61-65) | exact |
| `src/shared/lib/exporters/pdf.tsx` (extend `CajaReportDoc`) | component (PDF render) | transform | itself (existing `topProducts.map(...)` block, lines 117-129) | exact |
| `supabase/functions/process-payment/index.ts` (extend) | service (edge function) | request-response | itself (existing `order_items` select + `items.push` loop, lines 203-254) | exact |
| `supabase/migrations/2026072600000N_caja_report_top_products_category.sql` (new) | migration | batch/CRUD | `supabase/migrations/20260420000004_caja_report_rpc.sql` (top-products subquery) + `supabase/migrations/20260721000003_modifier_popularity_rpc.sql` (DOWN-script convention) | exact |
| `src/shared/lib/edge-function-contracts.ts` (extend `ReceiptDataSchema`) | model (Zod schema) | transform | itself (existing `ReceiptDataSchema.items` object, lines 29-58) | exact |
| Batch modifier-name resolution in the edge function | utility (inline) | CRUD | `src/entities/kds/model/queries.ts` (lines 69-85, `useKdsItems`) | exact |

## Pattern Assignments

### `src/shared/lib/groupOrderItemsForReceipt.ts` (utility, transform)

**Analogs:** `src/shared/lib/groupOrderItems.ts` (merge-by-key + sort pattern) and `src/shared/lib/category-tree.ts` (pure-function style, `TreeNode`-like minimal interface, JSDoc header describing invariants).

**Imports pattern** (mirror `groupOrderItems.ts` lines 1-9 — no external deps, plain TS types only):
```typescript
import type { Tab } from '@shared/lib/domain';
export type OrderItem = Tab['items'][number];
```
For the new generic grouper, do NOT import `Tab` — make it generic over `T extends { categoryId: string | null; categoryName: string | null }` per RESEARCH Pattern 2, so it works for both receipt line items and PDF `topProducts` rows.

**Core transform pattern** (mirror `groupOrderItems.ts` lines 25-54 — `Map`-based merge + final `.sort()`):
```typescript
export function groupOrderItems(items: OrderItem[]): GroupedOrderItem[] {
  const map = new Map<string, GroupedOrderItem>();
  for (const item of items) {
    const key = /* group key */;
    const existing = map.get(key);
    if (existing) { /* merge */ } else { map.set(key, /* new group */); }
  }
  return [...map.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}
```
Apply the same shape for `groupByCategory<T>`: `Map<categoryId ?? '__uncategorized__', CategoryGroup<T>>`, push items into `.items[]` instead of merging, sort groups by `categoryName` (or `sort_order` if threaded in), and always append the uncategorized bucket last (RESEARCH Open Question 2 recommendation).

**Style/JSDoc pattern** (mirror `category-tree.ts` lines 1-10 — top-of-file doc explaining invariants and pointing at the test file):
```typescript
/**
 * Pure functions for grouping order items into category buckets for receipts/PDF.
 * ...
 * Tested by property-based tests in groupOrderItemsForReceipt.test.ts.
 */
```

**Do NOT touch/replace:** `src/shared/lib/groupOrderItems.ts` itself — per D-02, it stays wired only to `PaymentForm`/live cart. Treat it purely as a style reference, not a dependency.

---

### `src/shared/lib/groupOrderItemsForReceipt.test.ts` (test, transform)

**Analog:** `src/shared/lib/category-tree.test.ts` — fast-check property-based test convention already established in this repo for pure `shared/lib` transform functions (per RESEARCH's Standard Stack: `fast-check ^4.6.0`). Co-locate as `.test.ts` next to the new file, per CLAUDE.md's testing convention. Key property to assert per SC-3: when all items share one category (or none), grouping degenerates to a single pass-through group with no spurious "uncategorized" split.

---

### `src/shared/lib/receipt-format.ts` (extend, transform)

**Analog:** itself — `buildPreChequeText`'s existing modifier-line loop is the exact pattern to reuse in `buildThermalReceiptText`.

**Imports pattern** (existing, lines 1-4 — no changes needed beyond adding the new grouping import):
```typescript
import type { Locale } from '@shared/lib/domain';
import { formatMoney } from '@shared/lib/domain-helpers';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import i18n from '@shared/lib/i18n';
```
Add: `import { groupByCategory } from '@shared/lib/groupOrderItemsForReceipt';`

**Existing modifier-line pattern to copy into `buildThermalReceiptText`** (lines 128-137, from `buildPreChequeText`):
```typescript
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
`buildThermalReceiptText`'s current item loop (lines 176-180) has no modifier/notes lines at all — replace it with the above shape once `ReceiptData.items` carries `modifierNames`/`categoryId`/`categoryName` (see edge-function-contracts + process-payment sections below).

**Byte-width column-math helpers (mandatory, WR-02) — do not reimplement:**
```typescript
// byteWidth (line 12-14), truncateToByteWidth (17-28), padRight (44-47),
// lineLeftRight (49-57), centerLine (59-64), divider (66-68)
```
Any new category-header line must be built with `centerLine()` or `lineLeftRight()`/`padRight()`, never raw string concatenation.

**i18n pattern** (line 71-73, `receiptT`):
```typescript
function receiptT(locale: Locale) {
  return i18n.getFixedT(locale, 'receipt');
}
```
New category-header / "uncategorized" labels go through `tr('receipt.category...')` in the `receipt` namespace — not lint-gated in `shared/lib` (Pitfall 5) but must follow convention for locale consistency.

---

### `src/widgets/KdsBoard/index.tsx` (extend `KdsCard`, component)

**Analog:** itself — existing modifier-join block is the extraction target, not a rewrite.

**Current pattern to replace with the shared formatter** (lines 61-65):
```typescript
{item.modifierNames.length > 0 && (
  <p data-testid="kds-item-modifiers" className="mt-1 text-sm opacity-80">
    {item.modifierNames.join(' / ')}
  </p>
)}
```
Per D-04, switch to the pre-cheque's indented `  + mod` convention (one line per modifier, not `.join(' / ')`) — likely rendered as multiple `<p>` lines or a `<br/>`-joined string, sourced from the new shared `formatModifierLines(modifierNames)` helper (RESEARCH Pattern 1). **No category clustering** — `KdsCard` stays one-card-per-item; only the modifier-line formatting changes.

**Imports pattern** (existing, lines 1-11 — add one import for the new formatter):
```typescript
import { useTranslation } from 'react-i18next';
import { ComboBadge } from '@shared/ui/ComboBadge';
```
i18n lint gate (`i18next/no-literal-string`) applies here (`widgets` layer, `wPanels` namespace) — any new literal string must go through `t('...')`.

---

### `src/shared/lib/exporters/pdf.tsx` (extend `CajaReportDoc`, component)

**Analog:** itself — existing flat `topProducts.map(...)` render (lines 123-129) is the section to add category header rows into.

**Current flat render pattern:**
```typescript
<Text style={styles.sectionTitle}>{tr('pdf.caja.topProducts')}</Text>
<View style={styles.tableHeader}>
  <Text style={styles.cell}>{tr('pdf.caja.product')}</Text>
  <Text style={styles.cellRight}>{tr('pdf.caja.qty')}</Text>
  <Text style={styles.cellRight}>{tr('pdf.caja.revenue')}</Text>
</View>
{report.topProducts.map((p, i) => (
  <View key={p.productName} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
    <Text style={styles.cell}>{p.productName}</Text>
    <Text style={styles.cellRight}>{String(p.quantity)}</Text>
    <Text style={styles.cellRight}>{fmt(p.revenue)}</Text>
  </View>
))}
```
Extend by first calling `groupByCategory(report.topProducts)` (client-side re-sort of the already `LIMIT 10`-capped rows per Pitfall 3 — NOT a true rollup), then map over the returned groups, rendering a `<Text style={styles.sectionTitle}>` (or a lighter sub-header style) per `categoryName` before each group's existing row-rendering block. Reuse `styles.row`/`styles.rowAlt`/`styles.cell`/`styles.cellRight` — no new style objects needed. `fmt`/`tr` (`pdfT`, same `i18n.getFixedT(locale, 'receipt')` pattern as `receipt-format.ts`) are already imported at file top — no new imports required beyond the grouping utility.

**Do not confuse with:** the separate, pre-existing `CategoryRevenueRow`/`categoryRevenueToPdfBytes` report (~line 300+) which does true full-category rollups — leave it untouched.

---

### `supabase/functions/process-payment/index.ts` (extend, edge function)

**Analog:** itself — existing `order_items` select + `items.push` loop is the exact section to extend (Pitfall 1: this is a data-availability gap, not a formatting-only change).

**Current select (to extend with category + modifier_ids), lines 203-217:**
```typescript
const { data: orderRows, error: ordErr } = await admin
  .from('orders')
  .select(
    `
    id,
    status,
    order_items (
      quantity,
      unit_price,
      modifier_price_delta,
      products ( name )
    )
  `
  )
  .eq('tab_id', body.tabId);
```
Extend the `products (...)` sub-select with `category_id, categories ( name )` and add `modifier_ids` alongside `quantity`/`unit_price` in the `order_items (...)` block.

**Current item-building loop (lines 242-254) — extend the pushed object shape:**
```typescript
for (const order of (orderRows ?? []) as Or[]) {
  if (order.status === 'voided') continue;
  for (const oi of order.order_items ?? []) {
    const name = oi.products?.name ?? 'Item';
    const lineTotal = (Number(oi.unit_price) + Number(oi.modifier_price_delta)) * Number(oi.quantity);
    items.push({
      name,
      quantity: oi.quantity,
      unitPrice: Number(oi.unit_price) + Number(oi.modifier_price_delta),
      lineTotal: Math.round(lineTotal * 100) / 100,
    });
  }
}
```
Add `categoryId`, `categoryName` (from the new sub-select) and `modifierNames` (via the batch-resolution pattern below) to each pushed object.

**Batch modifier-name resolution — copy directly from `src/entities/kds/model/queries.ts` lines 69-85** (same Supabase JS client shape, only `admin` vs client-side `db` differs):
```typescript
const allModifierIds = Array.from(
  new Set(rows.flatMap(row => (row['modifier_ids'] ?? []) as string[]))
);
const modifierNameById = new Map<string, string>();
if (allModifierIds.length > 0) {
  const { data: modifierRows, error: modifierErr } = await admin
    .from('modifiers')
    .select('id, name')
    .in('id', allModifierIds);
  if (!modifierErr) {
    for (const m of (modifierRows ?? []) as { id: string; name: string }[]) {
      modifierNameById.set(m.id, m.name);
    }
  }
}
```
Pool-charge synthetic items (lines 268-277, no `productId`/category) get `categoryId: null` — flows into the new grouper's trailing "uncategorized" bucket automatically (RESEARCH Open Question 2).

---

### `src/shared/lib/edge-function-contracts.ts` (extend `ReceiptDataSchema`, model)

**Analog:** itself, lines 29-58 — extend the `items` array's inner object with new **optional** fields (Open Question 1 recommendation, to avoid a forced update wave across 5 existing call sites: `edge-function-contracts.test.ts`, `pos-printer.test.ts`, `receipt-format.test.ts`, `ReceiptPreview.stories.tsx`, `PaymentModal.stories.tsx`).

**Current schema (lines 36-43):**
```typescript
items: z.array(
  z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: MoneySchema,
    lineTotal: MoneySchema,
  })
),
```
Extend to (per `exactOptionalPropertyTypes` — Pitfall 4 — write `.nullable().optional()` / `.default([])`, never bare `?:` on the resulting TS type when constructing literals):
```typescript
items: z.array(
  z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: MoneySchema,
    lineTotal: MoneySchema,
    categoryId: UuidSchema.nullable().optional(),
    categoryName: z.string().nullable().optional(),
    modifierNames: z.array(z.string()).default([]),
  })
),
```
`UuidSchema`, `MoneySchema` etc. are already imported/defined at top of this file — reuse, don't redefine.

---

### `supabase/migrations/2026072600000N_caja_report_top_products_category.sql` (new, migration)

**Analog 1 — the subquery to extend:** `supabase/migrations/20260420000004_caja_report_rpc.sql` lines 71-88:
```sql
-- Top 10 products by quantity sold
SELECT json_agg(row_to_json(t)) INTO v_top_products
FROM (
  SELECT
    p.name            AS product_name,
    SUM(oi.quantity)  AS quantity,
    SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi
  JOIN orders o    ON o.id = oi.order_id
  JOIN products p  ON p.id = oi.product_id
  WHERE o.tab_id = ANY(v_tab_ids)
    AND o.status <> 'voided'
    AND o.is_deleted = FALSE
    AND oi.is_deleted = FALSE
  GROUP BY p.id, p.name
  ORDER BY quantity DESC
  LIMIT 10
) t;
```
New migration: `CREATE OR REPLACE FUNCTION get_caja_report(...)` (same signature, `p_caja_id UUID` parameterized — never `EXECUTE format(...)` per the Security Domain note), adding `p.category_id` and a `categories c ON c.id = p.category_id` join, selecting `c.name AS category_name` into the same subquery, keeping `LIMIT 10` unchanged per Pitfall 3 (this is a re-sort of the existing top-10, not a true per-category rollup — do not add window functions/`PARTITION BY` unless the plan explicitly scopes that bigger rewrite).

**Analog 2 — DOWN-script convention:** `supabase/migrations/20260721000003_modifier_popularity_rpc.sql`:
```sql
GRANT EXECUTE ON FUNCTION get_modifier_popularity_report(timestamptz, timestamptz) TO authenticated;

COMMIT;

-- =============================================================================
-- DOWN:
-- Function is new. Rollback = drop it:
--   DROP FUNCTION IF EXISTS get_modifier_popularity_report(timestamptz, timestamptz);
-- =============================================================================
```
For this migration (a modification, not a new function), the DOWN comment should instead say: "Rollback = re-apply migration `20260420000004_caja_report_rpc.sql`'s `get_caja_report` body verbatim (restores the non-category-aware top-products subquery)."

**No `supabase.types.ts` regeneration needed** (Pitfall 2) — `category_id`, `categories.name`, `order_items.modifier_ids` are already-existing columns already present in generated types; this migration only changes a `plpgsql` function body/return JSON shape.

## Shared Patterns

### UTF-8 byte-safe column math (thermal receipt formatting)
**Source:** `src/shared/lib/receipt-format.ts` lines 6-68 (`byteWidth`, `truncateToByteWidth`, `truncateFromEndToByteWidth`, `padRight`, `lineLeftRight`, `centerLine`, `divider`)
**Apply to:** Any new category-header or modifier line added to `buildThermalReceiptText`/`buildPreChequeText`. Never use `.length` or raw string concat for 32-column layout (WR-02).

### Locale-scoped translator outside React
**Source:** `receipt-format.ts` lines 71-73 (`receiptT`) and `pdf.tsx`'s equivalent `pdfT` — both call `i18n.getFixedT(locale, 'receipt')`.
**Apply to:** All new category-header / "uncategorized" label strings in `receipt-format.ts` and `pdf.tsx`.

### Batch UUID→name resolution for `modifier_ids uuid[]` (no junction table)
**Source:** `src/entities/kds/model/queries.ts` lines 69-85
**Apply to:** `supabase/functions/process-payment/index.ts`'s new modifier-name resolution (Deno/edge-function port, same Supabase JS client API — only client variable name differs: `admin` vs `db`).

### `exactOptionalPropertyTypes` — optional field construction
**Source:** CLAUDE.md TypeScript Gotchas section (project convention, not a single file)
**Apply to:** Any new object literal constructing `ReceiptData.items[]` entries with the new optional fields — write `categoryName: string | undefined`, never `categoryName?: string`, when building the literal in `process-payment/index.ts` or any test fixture.

### Parameterized `plpgsql`, no dynamic SQL
**Source:** `supabase/migrations/20260420000004_caja_report_rpc.sql` (`p_caja_id UUID` typed arg throughout)
**Apply to:** The new/modified `get_caja_report` migration — keep `WHERE ... = ANY(v_tab_ids)` style, never `EXECUTE format(...)` with any user-controlled string.

## No Analog Found

None — every file in scope has at least one exact or role-matching existing analog in this codebase (this phase is an explicit incremental extension of 4 existing, well-established render/query surfaces plus one new small utility that follows two existing sibling utilities' conventions).

## Metadata

**Analog search scope:** `src/shared/lib/`, `src/widgets/KdsBoard/`, `src/entities/kds/model/`, `src/shared/lib/exporters/`, `supabase/functions/process-payment/`, `supabase/migrations/`
**Files scanned:** 9 read directly (groupOrderItems.ts, category-tree.ts, receipt-format.ts, KdsBoard/index.tsx, pdf.tsx, entities/kds/model/queries.ts, edge-function-contracts.ts, process-payment/index.ts, 20260420000004_caja_report_rpc.sql) + 1 grepped for DOWN-script convention (20260721000003_modifier_popularity_rpc.sql)
**Pattern extraction date:** 2026-07-26
