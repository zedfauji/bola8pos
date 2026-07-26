# Phase 24: Operational Reports Suite + CSV - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 20
**Analogs found:** 18 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/*_peak_hours_and_voids_rpc.sql` (get_peak_hours_report, get_voids_report) | migration (RPC) | CRUD/aggregation, request-response | `supabase/migrations/20260420000004_caja_report_rpc.sql` (`get_caja_report`) | exact |
| `supabase/migrations/*_deletions_reports_rpc.sql` (get_deletions_pre_report, get_deletions_post_report, remove_tab_item RPC, `order_item.remove` audit action) | migration (RPC, audited mutation) | request-response, event-driven (audit) | `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (`edit_paid_tab`) + `20260428000002..20260707000001_deplete_for_order_item*.sql` | exact |
| `supabase/migrations/*_modifier_popularity_rpc.sql` | migration (RPC) | CRUD/aggregation | `get_caja_report` (top-products subquery pattern) | role-match |
| `supabase/migrations/*_payment_methods_rpc.sql` | migration (RPC) | CRUD/aggregation | `get_caja_report` (payment aggregate CASE-WHEN block) | exact |
| `supabase/migrations/*_charts_data_rpc.sql` | migration (RPC) — likely no-op per Open Question 1 | — | `get_caja_report` | n/a — see Open Question 1 |
| `src/shared/lib/audit-actions.ts` (+`order_item.remove`) | config (enum) | — | itself (existing file, additive) | exact |
| `src/shared/lib/domain.ts` (extend `HourlyRowSchema`, add `DeletionsPreRow`/`DeletionsPostRow`/`ModifierPopularityRow`/`PaymentMethodRow`) | model (Zod schema) | transform | `VoidRefundRowSchema` (domain.ts:1163-1171) | exact |
| `src/entities/tab/model/queries-reports.ts` (+6 `use*Report` hooks; migrate `useHourlyBreakdown`/`useVoidRefundReport` bodies to `db.rpc(...)`) | hook (TanStack Query) | request-response | `useVoidRefundReport`/`useHourlyBreakdown` (same file, lines 291-322, 346-373) | exact |
| `src/shared/lib/exporters/csv.ts` (NEW: `rowsToCsv`, `csvToBytes`) | utility | transform | `src/shared/lib/exporters/excel.ts` (`hourlySalesToWorkbook`, `workbookToBytes`) | exact |
| `src/shared/lib/exporters/excel.ts` (extend `hourlySalesToWorkbook`) | utility | transform | itself (existing file, lines 119-133) | exact |
| `src/shared/lib/exporters/pdf.tsx` (extend `hourlySalesToPdfBytes`) | utility | transform | itself (existing file) | exact |
| `src/features/export-report/model/useExportReport.ts` (+`X-csv` branches ×17, +csv `ExportType` literals) | hook / service (switch-based export) | transform, file-I/O | itself (existing file, lines 51-346) | exact |
| `src/features/export-report/ui/ExportButtons.tsx` (+CSV `DropdownMenuItem` ×17 branches) | component | request-response (UI event) | itself (existing file, lines 90-194) | exact |
| `src/features/remove-tab-item/useRemoveTabItem.ts` (replace 3-step client mutation with `db.rpc('remove_tab_item', ...)`) | hook (mutation) | CRUD → single RPC call | `src/features/void-order/model/useVoidOrder.ts` (calls `deplete_for_order_item` via RPC-adjacent pattern) | exact |
| `src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx` (+required reason field) | component (dialog) | request-response | `src/features/void-order/ui/VoidOrderDialog.tsx` (lines 43-47, 113-126) | exact |
| `src/widgets/DeletionsPreSendPanel/` (NEW) | widget | request-response, tabular | `src/widgets/VoidRefundPanel/VoidRefundPanel.tsx` (whole file) | exact |
| `src/widgets/DeletionsPostCloseReport/` (NEW) | widget | request-response, tabular | `src/widgets/VoidRefundPanel/VoidRefundPanel.tsx` | exact |
| `src/widgets/ModifierPopularityReport/` (NEW) | widget | request-response, chart+table | `src/widgets/ComboMixReport/ComboMixReport.tsx` (whole file) | exact |
| `src/widgets/PaymentMethodsReport/` (NEW) | widget | request-response, chart+table | `src/widgets/ComboMixReport/ComboMixReport.tsx` + `CajaReportPanel` (two-grain grouping) | role-match |
| `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx` (extend: day-of-week column, RPC-backed) | widget | request-response | itself (existing file) | exact |
| `src/pages/reports/index.tsx` (+4 `TabsTrigger`/`TabsContent` pairs) | page/route | request-response | itself (existing file, `Tabs`/`TabsTrigger`/`TabsContent` pattern) | exact |

## Pattern Assignments

### RPCs: `get_peak_hours_report`, `get_voids_report`, `get_modifier_popularity_report`, `get_payment_methods_report`

**Analog:** `supabase/migrations/20260420000004_caja_report_rpc.sql` (`get_caja_report`)

**Shape** (lines 7-11, 25-41):
```sql
CREATE OR REPLACE FUNCTION get_caja_report(p_caja_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE ...
BEGIN
  SELECT ... INTO v_caja FROM caja_sessions cs ... WHERE cs.id = p_caja_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', json_build_object('code', 'NOT_FOUND', 'message', '...'));
  END IF;
  ...
```

**Aggregate/CASE-WHEN pattern for payment-methods RPC** (lines 55-62):
```sql
SELECT
  COALESCE(SUM(amount + tip_amount), 0),
  COALESCE(SUM(CASE WHEN method = 'cash'  THEN amount + tip_amount ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN method = 'card'  THEN amount + tip_amount ELSE 0 END), 0)
INTO v_total_revenue, v_cash_sales, v_card_sales
FROM payments
WHERE tab_id = ANY(v_tab_ids) AND is_deleted = FALSE;
```
**IMPORTANT (Anti-Pattern from RESEARCH.md):** also add `AND status IS DISTINCT FROM 'reopened_void'` — the exact filter added in `20260720000005_fix_payment_sums_exclude_reopened_void.sql`. Every new payment-summing query in this phase must copy that exclusion, not just `is_deleted = FALSE`.

**Top-N subquery pattern (reusable for modifier-popularity's ranked query)** (lines 71-80):
```sql
SELECT json_agg(row_to_json(t)) INTO v_top_products
FROM (
  SELECT p.name AS product_name, SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  ...
) t;
```
For `get_peak_hours_report` specifically, use this exact template from RESEARCH.md Pattern 1 (copy verbatim, it's already fully written):
```sql
CREATE OR REPLACE FUNCTION get_peak_hours_report(p_from timestamptz, p_to timestamptz)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT EXTRACT(HOUR FROM o.created_at)::int AS hour,
           EXTRACT(DOW FROM o.created_at)::int AS day_of_week,
           COUNT(DISTINCT o.id) AS order_count,
           COALESCE(SUM(oi.quantity * (oi.unit_price + oi.modifier_price_delta)), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'voided' AND o.is_deleted = FALSE
      AND o.created_at BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ) t;
  RETURN json_build_object('ok', true, 'rows', COALESCE(v_rows, '[]'::json));
END; $$;
GRANT EXECUTE ON FUNCTION get_peak_hours_report(timestamptz, timestamptz) TO authenticated;
```
Anti-pattern warning (RESEARCH.md Pitfall 4): modifier-popularity RPC must aggregate `unnest(modifier_ids)` in an isolated CTE/subquery before joining to `orders`/`payments`, never in one flat join — that double-counts.

---

### RPC: `remove_tab_item` (replaces `useRemoveTabItem`'s 3-step client mutation)

**Analog:** `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` (`edit_paid_tab`) + `deplete_for_order_item` (existing, reused as-is, no new inventory RPC)

**Copy this exact structure (RESEARCH.md Pattern 3, already fully written)** — do NOT add a manager/admin role check (Pitfall 3 — `edit_paid_tab`'s role guard at lines 63-71 must NOT be copied here per D-07/UI-SPEC, removal stays bartender-accessible):
```sql
CREATE OR REPLACE FUNCTION public.remove_tab_item(p_item_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id uuid; v_before jsonb; v_remaining int;
BEGIN
  SELECT to_jsonb(oi.*), oi.order_id INTO v_before, v_order_id FROM order_items oi WHERE oi.id = p_item_id;
  IF v_before IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); END IF;
  -- Restore inventory BEFORE deleting (deplete_for_order_item reads product_id from the row)
  PERFORM deplete_for_order_item(p_item_id, -1, true);
  DELETE FROM order_items WHERE id = p_item_id;
  SELECT COUNT(*) INTO v_remaining FROM order_items WHERE order_id = v_order_id;
  IF v_remaining = 0 THEN UPDATE orders SET status = 'voided' WHERE id = v_order_id; END IF;
  PERFORM record_audit('order_item.remove', 'order_item', p_item_id, v_before,
    jsonb_build_object('reason', p_reason), 'rpc');
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.remove_tab_item(uuid, text) TO authenticated;
```
Before/after audit capture pattern to mirror (edit_paid_tab lines 94-104, 216-230): capture `v_before` via `to_jsonb(t.*)` before mutating, embed `reason` as a synthetic key on the after-state, `PERFORM record_audit(...)` only on the success path (never inside an `EXCEPTION` block, since a raised exception rolls back the audit insert too).

**CI enforcement gotcha (RESEARCH.md Anti-Patterns):** must be `PERFORM record_audit(...)`, not `SELECT record_audit(...)` — `audit-actions.test.ts` greps migrations for the literal `PERFORM record_audit('action'` string.

**`order_item.remove` registration** — add to `src/shared/lib/audit-actions.ts` FIRST (before the migration references it), following the existing enum shape (lines 17-57):
```typescript
export const AuditActionSchema = z.enum([
  // Payments
  'payment.process', ... 
  // Tabs
  'tab.close', 'tab.transfer', 'tab.void', 'tab.split', 'tab.edit_paid', 'tab.reopen',
  // add here, near a natural grouping, e.g. a new "Order items" comment block:
  'order_item.remove',
  ...
]);
```

---

### `useRemoveTabItem.ts` — client hook, replace 3-step sequence with single RPC call

**Current file (to be replaced):** `src/features/remove-tab-item/useRemoveTabItem.ts` (full file read, 107 lines) — currently does `DELETE FROM order_items` directly via `supabaseMutation`, then a remaining-items check, then a conditional void, with a `TODO` (lines 80-83) for inventory restore that `remove_tab_item` now resolves.

**Analog for the new RPC-call shape:** any `db.rpc(...)`-calling mutation hook, e.g. `edit_paid_tab`'s client caller or `useVoidOrder.ts`'s call to `deplete_for_order_item`-backed void RPC. New shape:
```typescript
mutationFn: async (input: RemoveTabItemInput): Promise<Result<void>> => {
  if (!isOnline()) return err(networkOfflineError());
  const { data, error } = await supabase.rpc('remove_tab_item', {
    p_item_id: input.itemId,
    p_reason: input.reason,
  });
  if (error) return err(supabaseError(error.message, undefined, error));
  const parsed = data as { ok: boolean; code?: string; message?: string };
  if (!parsed.ok) return err(/* map parsed.code to AppErrorCode */);
  return ok(undefined);
},
```
Keep the existing `onSuccess` query-invalidation block (lines 96-100) unchanged.

---

### `RemoveTabItemDialog.tsx` — add required reason field

**Analog:** `src/features/void-order/ui/VoidOrderDialog.tsx` (full file, 132 lines)

**State + validation pattern** (VoidOrderDialog.tsx lines 43, 46-47):
```typescript
const [reason, setReason] = useState('');
const trimmedReason = reason.trim();
const canConfirm = Boolean(order) && trimmedReason.length > 0 && Boolean(currentStaff?.id);
```

**Reason input markup** (VoidOrderDialog.tsx lines 113-126):
```tsx
<div className="space-y-1.5">
  <label htmlFor="void-order-reason" className="text-sm font-medium">
    {t('voidOrder.voidReasonLabel')}
  </label>
  <Input
    id="void-order-reason"
    value={reason}
    onChange={event => { setReason(event.target.value); }}
    placeholder={t('voidOrder.requiredReasonPlaceholder')}
    required
  />
</div>
```
Apply the same pattern to `RemoveTabItemDialog` using the `featOrders:removeTabItem.reasonLabel`/`reasonPlaceholder`/`reasonRequired` i18n keys already specified in UI-SPEC.md. `ConfirmDialog`'s `confirmDisabled={!canConfirm}` prop (VoidOrderDialog.tsx line 65) gates submission on the reason being non-empty. No PIN gate, no `confirmClassName` destructive-emphasis styling needed (UI-SPEC: "not applicable").

---

### `DeletionsPreSendPanel` / `DeletionsPostCloseReport` (new tabular-only widgets)

**Analog:** `src/widgets/VoidRefundPanel/VoidRefundPanel.tsx` (full file, 79 lines) — closest event-log/reason-column precedent using `DataTable`.

**Full copyable shape:**
```typescript
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportButtons } from '@features/export-report';
import { useDeletionsPreReport } from '@entities/tab/model/queries-reports'; // new hook
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay, Alert, AlertTitle, AlertDescription } from '@shared/ui';

function buildColumns(t): ColumnDef<DeletionsPreRow>[] {
  return [
    { accessorKey: 'removedAt', header: t('...'), cell: info => info.getValue<Date>().toLocaleString(...) },
    { accessorKey: 'itemName', header: t('...') },
    { accessorKey: 'staffName', header: t('...'), cell: info => <span className="font-medium">{info.getValue<string>()}</span> },
    { accessorKey: 'reason', header: t('...'), cell: info => <span className="max-w-xs truncate text-muted-foreground">{info.getValue<string>() || '—'}</span> },
  ];
}

export function DeletionsPreSendPanel({ dateRange }) {
  // same useQuery-result → rows → columns → DataTable wiring as VoidRefundPanel lines 49-78
  // PLUS: standing (non-dismissible) <Alert> banner above the DataTable — new element, no existing
  // precedent in VoidRefundPanel; use shared/ui Alert primitive per UI-SPEC's "AlertTriangle icon,
  // default variant" spec, rendered unconditionally above the table.
}
```
`DeletionsPostCloseReport` is a straight copy of the same shape with no Alert banner (per UI-SPEC: "No historical-gap banner").

---

### `ModifierPopularityReport` / `PaymentMethodsReport` (chart + table widgets)

**Analog:** `src/widgets/ComboMixReport/ComboMixReport.tsx` (full file, 124 lines) — the only Recharts consumer in the codebase.

**Chart color constant to copy verbatim into each new widget file** (lines 18-24, 28-31 — per UI-SPEC "no shared chart-color util, 3 call sites doesn't justify extraction"):
```typescript
const CHART_COLORS = [
  'var(--chart-1)',
  'oklch(0.72 0.19 145)', // --pos-accent green for top series
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
function chartColor(index: number): string {
  // eslint-disable-next-line i18next/no-literal-string -- CSS custom-property value, not UI copy
  return CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--chart-1)';
}
```

**Top-row highlight pattern** (lines 63-65, 100-108):
```typescript
const sorted = [...rows].sort((a, b) => b.netRevenue - a.netRevenue);
const topId = sorted[0]?.comboProductId;
// ...
<TableRow className={row.comboProductId === topId ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5' : undefined}>
```
Apply identically for modifier-popularity (sort by attach-count desc, top row emerald) and payment-methods (leading method slice emerald).

**Chart container + Recharts wiring** (lines 68-87):
```tsx
<div className="rounded-lg border p-4">
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={chartData}>
      <XAxis dataKey="dow" />
      <YAxis />
      <Tooltip />
      <Legend />
      {comboNames.map((name, i) => <Bar key={name} dataKey={name} stackId="a" fill={chartColor(i)} />)}
    </BarChart>
  </ResponsiveContainer>
</div>
```
For `ModifierPopularityReport`, swap `<BarChart>` for a horizontal bar chart (`layout="vertical"`, per UI-SPEC height 280 acceptable). For `PaymentMethodsReport`, swap for `<PieChart>` with `innerRadius` set (true donut per UI-SPEC).

**Export wiring** (lines 69-74):
```tsx
<div className="flex justify-end">
  <ExportButtons reportType="combo-mix" data={{ rows, dateRange }} />
</div>
```
Same shape with new `reportType` literals (`'modifier-popularity'`, `'payment-methods'`).

**Cap-to-20 note (modifier-popularity only, D-10):** slice `sorted.slice(0, 20)` for the on-screen `<Table>` map only — keep the full `rows` array (all rows, uncapped) passed to `ExportButtons`'s `data.rows` for CSV/Excel export, per UI-SPEC's "full data still flows to CSV/Excel export unfiltered."

**Two-grain table (payment-methods only, D-08):** per-caja-session rows grouped like `CajaReportPanel`, plus one day-level rollup row pinned to the table bottom via `border-t-2` (UI-SPEC) — one `<Table>`, not two, one export.

---

### `HourlyBreakdownPanel.tsx` — extend in place (RPC-backed + day-of-week column)

**Analog:** itself (existing widget) + `findPeakHour` pure helper (`src/entities/tab/model/queries-reports.ts:119-124`, kept unchanged post-migration):
```typescript
export function findPeakHour(rows: HourlyRow[]): HourlyRow | null {
  const nonZero = rows.filter(r => r.revenue > 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((best, r) => (r.revenue > best.revenue ? r : best));
}
```
Do not delete `aggregateHourlyRevenue`/`fillMissingHours`/`findPeakHour` — only swap `useHourlyBreakdown`'s query body (lines 291-322) to call `db.rpc('get_peak_hours_report', { p_from, p_to })` instead of the current unbounded `order_items` join query, then re-derive "busiest" client-side with the existing `findPeakHour` helper (RESEARCH.md: "one less thing to keep in sync").

---

### CSV serializer — `src/shared/lib/exporters/csv.ts` (NEW)

**Analog:** `src/shared/lib/exporters/excel.ts` (`hourlySalesToWorkbook`/`workbookToBytes`, lines 119-133) — reuse `xlsx`'s own CSV writer, do not hand-roll escaping.

**Full copyable implementation (RESEARCH.md Pattern 4, already fully written):**
```typescript
import * as XLSX from 'xlsx';

export type CsvColumn<T> = { key: keyof T; header: string };

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const mapped = rows.map(row => Object.fromEntries(columns.map(c => [c.header, row[c.key]])));
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map(c => c.header) });
  return XLSX.utils.sheet_to_csv(ws);
}

export function csvToBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}
```

---

### `useExportReport.ts` — add CSV branches (all 17 report types)

**Analog:** itself (existing file, 346 lines, full file read).

**`ExportType` union extension** (lines 51-74) — append a `-csv` sibling to every existing `-excel`/`-pdf` pair:
```typescript
export type ExportType =
  | 'caja-excel' | 'caja-pdf' | 'caja-csv'
  | 'products-excel' | 'products-pdf' | 'products-csv'
  | 'hourly-excel' | 'hourly-pdf' | 'hourly-csv'
  | 'voids-excel' | 'voids-pdf' | 'voids-csv'
  // ...one -csv literal per existing pair, plus new: deletions-pre-csv, deletions-post-csv,
  // modifier-popularity-csv, payment-methods-csv (these 4 have no -excel/-pdf pair requirement
  // unless the widget also wants Excel/PDF — CSV-only is acceptable per D-11/D-12, "reusable
  // across all 17", CSV is the mandatory one, Excel/PDF stay optional per-report as today)
```

**Switch-branch pattern to copy for each `-csv` case** (mirrors lines 213-217 for `hourly-excel`):
```typescript
case 'hourly-csv': {
  bytes = csvToBytes(rowsToCsv(data as HourlyRow[], HOURLY_CSV_COLUMNS));
  break;
}
```
Same `save()`/`writeFile()` tail (lines 322-335) — only the `ext`/`mimeLabel` derivation (lines 182-188) needs a 3rd branch: `ext = type.endsWith('-csv') ? 'csv' : isExcel ? 'xlsx' : 'pdf'`, `mimeLabel` gets a new `i18n.t('featMgmt:exportReport.csvFileLabel')` case (new key, sibling to `excelWorkbookLabel`/`pdfDocumentLabel`, per UI-SPEC).

Per D-11 ("Claude's Discretion: whether CSV column-config objects live per-widget or in a shared registry") — no existing precedent forces either; the ladder favors co-locating each report's `CsvColumn<T>[]` array as a small const next to its `-csv` switch case in this same file, matching how column labels are already inline per-report rather than in a separate registry file. Skip building a registry unless a 2nd consumer of the same column set appears.

---

### `ExportButtons.tsx` — add CSV dropdown item (all 17 branches)

**Analog:** itself (existing file, lines 104-194, full file read).

**Dropdown item to add (3rd item, after PDF)** — mirrors the existing PDF `DropdownMenuItem` (lines 182-190):
```tsx
<DropdownMenuItem
  inset={undefined}
  variant={undefined}
  onSelect={() => { handleExport('csv'); }}
>
  {t('exportReport.csvOption')}
</DropdownMenuItem>
```
`handleExport`'s signature widens from `(format: 'excel' | 'pdf')` to `(format: 'excel' | 'pdf' | 'csv')` (line 115); every `if (props.reportType === '...')` branch (lines 117-153) gains a 3rd ternary arm, e.g.:
```typescript
const type = format === 'excel' ? 'caja-excel' : format === 'pdf' ? 'caja-pdf' : 'caja-csv';
```
Per UI-SPEC: `combo-overrides` branch currently PDF-disabled (line 148-149, Excel-only) still gets CSV — "PDF-unsupported ≠ CSV-unsupported."

---

## Shared Patterns

### Bounded date-range RPC (`p_from`/`p_to` timestamptz, SECURITY DEFINER, JSON return)
**Source:** `supabase/migrations/20260420000004_caja_report_rpc.sql`
**Apply to:** All 4-5 new/migrated report RPCs (peak-hours, voids, deletions ×2, modifier-popularity, payment-methods)
```sql
CREATE OR REPLACE FUNCTION get_X_report(p_from timestamptz, p_to timestamptz)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_rows FROM (...) t;
  RETURN json_build_object('ok', true, 'rows', COALESCE(v_rows, '[]'::json));
END; $$;
GRANT EXECUTE ON FUNCTION get_X_report(timestamptz, timestamptz) TO authenticated;
```

### Audit action registration + `PERFORM record_audit(...)`
**Source:** `src/shared/lib/audit-actions.ts` + `edit_paid_tab` migration lines 227-230
**Apply to:** `remove_tab_item` RPC (order_item.remove), any deletions-report RPC reading `audit_logs`
- Register the string literal in `AuditActionSchema` BEFORE any migration references it.
- Always `PERFORM record_audit(...)`, never `SELECT record_audit(...)` (CI grep enforcement).
- Only query the plural `audit_logs` table (Phase 14), never the legacy singular `audit_log` (Phase 8) — `ComboOverrideReport`'s existing `.from('audit_log')` query is a nearby wrong-table trap, not a pattern to copy.

### Payment exclusion filter (reopened-void + soft-delete)
**Source:** `supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql`
**Apply to:** `payment-methods` RPC, any new query touching `payments`
```sql
WHERE ... AND is_deleted = FALSE AND status IS DISTINCT FROM 'reopened_void'
```

### CSV export wiring (3rd dropdown item, same save/writeFile flow)
**Source:** `src/features/export-report/model/useExportReport.ts` (Excel/PDF branches) + `src/features/export-report/ui/ExportButtons.tsx`
**Apply to:** All 17 report tabs — every `ExportType`/`reportType` branch gets a `-csv` sibling using `rowsToCsv`/`csvToBytes` from the new `csv.ts`, same `save()`/`writeFile()` tail, same success/error toast copy.

### Recharts container + top-row/slice accent color
**Source:** `src/widgets/ComboMixReport/ComboMixReport.tsx` lines 18-31, 63-65, 68-87, 100-108
**Apply to:** `HourlyBreakdownPanel` (extended), `ModifierPopularityReport`, `PaymentMethodsReport`
- `CHART_COLORS` array + `chartColor()` helper copied verbatim into each widget file (no shared util — YAGNI at 3 consumers).
- `<div className="rounded-lg border p-4">` chart container, `ResponsiveContainer height={300}` (280 acceptable for the modifier horizontal bar chart, never >400).
- Exactly one accent-colored (`emerald-500`) element per chart/table: the "top" bar/slice/row. Every other series uses the grayscale ramp.

### Reason-required dialog (no PIN gate)
**Source:** `src/features/void-order/ui/VoidOrderDialog.tsx` lines 43-47, 113-126
**Apply to:** `RemoveTabItemDialog`
- Trimmed-reason state + `canConfirm` boolean gating `ConfirmDialog`'s `confirmDisabled`.
- Labeled `<Input required>` block with placeholder copy.
- No PIN gate, no destructive `confirmClassName` — this dialog stays at today's access level (D-07/UI-SPEC).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/*_charts_data_rpc.sql` | migration (RPC) | — | RESEARCH.md Open Question 1: likely satisfied entirely by the 3 chart-bearing report RPCs (peak-hours, modifier-popularity, payment-methods) rather than a distinct 7th RPC — planner should confirm scope before writing any SQL here; if confirmed as "no separate endpoint," this file should not exist at all (YAGNI) |
| Standing (non-dismissible) `Alert` banner in `DeletionsPreSendPanel` | component | — | No existing report widget in this codebase renders an unconditional standing banner above a `DataTable` — every existing `Alert` usage elsewhere in the app is dismissible/conditional. Use `shared/ui` `Alert`/`AlertTitle`/`AlertDescription` primitives directly (already installed, no new component); no widget-level precedent to copy beyond the primitive itself. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/entities/tab/model/`, `src/features/export-report/`, `src/features/remove-tab-item/`, `src/features/void-order/`, `src/widgets/ComboMixReport/`, `src/widgets/VoidRefundPanel/`, `src/widgets/HourlyBreakdownPanel/`, `src/shared/lib/exporters/`, `src/shared/lib/audit-actions.ts`, `src/shared/lib/domain.ts`, `src/pages/reports/index.tsx`
**Files scanned:** ~20 read directly, migration directory globbed
**Pattern extraction date:** 2026-07-21
