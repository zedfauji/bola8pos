# Phase 24: Operational Reports Suite + CSV - Research

**Researched:** 2026-07-21
**Domain:** Supabase Postgres RPCs (SECURITY DEFINER reporting functions), TanStack Query report hooks, Recharts data viz, generic CSV export, audit-trail gap closure
**Confidence:** HIGH

## Summary

This phase is a **retrofit onto a mature, already-shipped Reports subsystem** — every pattern needed already exists in the codebase at least once. There is exactly one direct RPC-backed report precedent (`get_caja_report`), one Recharts consumer (`ComboMixReport`), one `DataTable`-based event-log widget (`VoidRefundPanel`), and one audited-correction RPC (`edit_paid_tab`). The 6 new/migrated RPCs, the CSV serializer, and the `order_item.remove` audit action all have a near-identical precedent to copy verbatim rather than design from scratch.

The single genuinely novel risk in this phase is **`useRemoveTabItem`'s current hard-delete-with-no-audit path** (D-06). It has a pre-existing TODO for inventory restoration that a general-purpose, already-existing RPC (`deplete_for_order_item(p_order_item_id, p_direction, p_allow_negative)`) can resolve directly — but only if it is called **before** the order_item row is deleted (it reads `product_id`/`quantity`/`modifier_ids` from the row). This makes moving the whole remove flow into one new atomic RPC (mirroring `edit_paid_tab`'s shape) the clearly superior option over sequencing two client-side calls, and resolves two backlog items in one migration.

The second non-obvious risk is **two audit tables coexist**: a legacy singular `audit_log` (Phase 8, still used by `combo_availability_override` and `process_refund`'s backward-compat insert) and the canonical plural `audit_logs` (Phase 14, `record_audit()`). Both new deletions reports MUST query `audit_logs` (plural) — the table `record_audit()` and `edit_paid_tab`/`reopen_tab` actually write to. Confusing the two is an easy, silent-failure mistake (report returns zero rows forever).

**Primary recommendation:** Build all 6 RPCs as `SECURITY DEFINER` PL/pgSQL functions returning `JSON`/`JSONB`, each taking `p_from timestamptz, p_to timestamptz` (plus `p_caja_id` for payment-methods' per-session grain), following `get_caja_report`'s exact shape (not materialized/aggregate tables — direct bounded queries suffice since `orders.created_at`/`tabs.created_at` are already indexed and every existing report already runs unbounded-by-index date-range queries at acceptable latency). Convert `useRemoveTabItem` into a new `remove_tab_item` RPC that does inventory-restore + hard-delete + `order_item.remove` audit atomically. Build the CSV serializer by reusing the already-installed `xlsx` package's `json_to_sheet`/`sheet_to_csv` utilities (zero new escaping code, zero new dependency) rather than hand-rolling RFC 4180 quoting.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Peak-hours / voids / deletions / modifier-popularity / payment-methods / charts-data aggregation | Database (Postgres RPC, `SECURITY DEFINER`) | API (PostgREST `supabase.rpc()`) | Aggregation over `order_items`/`orders`/`payments`/`audit_logs` must happen server-side to keep queries bounded (SC-4) and to bypass RLS consistently with `get_caja_report` |
| `order_item.remove` audit + inventory restore | Database (new RPC, replacing 2-step client mutation) | — | `deplete_for_order_item` requires the order_item row to still exist; atomicity requires one transaction, not a client-orchestrated sequence |
| Report row → typed object mapping / Zod validation | Frontend Server-state (TanStack Query hooks, `entities/tab/model/queries-reports.ts`) | — | Matches every existing report hook (`useComboMixReport`, `useCajaReport`) |
| CSV/Excel/PDF byte generation | Frontend (`shared/lib/exporters/*`, `features/export-report`) | — | Pure client-side transform of already-fetched rows; no server round-trip, matches existing `useExportReport` |
| Recharts rendering (bar/pie/donut) | Frontend (`widgets/*Report`) | — | Presentation only, no business logic; must reuse `ComboMixReport`'s `CHART_COLORS`/`chartColor()` per UI-SPEC Chart Contract |
| Reason-required removal UI + (no) PIN gate | Frontend (`features/remove-tab-item/ui`) | — | D-07/UI-SPEC: reason field only, no new PIN gate — removal is lower-stakes than void per CONTEXT.md |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | `^3.8.1` (installed; latest npm is `3.10.0` [VERIFIED: npm registry]) | Bar/donut charts for peak-hours, modifier-popularity, payment-methods | Already the project's sole charting library (`ComboMixReport`); no new dependency needed — current install satisfies the UI-SPEC's Chart Contract verbatim |
| `xlsx` (`SheetJS`) | `^0.18.5` (installed, per existing `excel.ts` header comment noting accepted CVE risk) | Reused for CSV generation via `XLSX.utils.json_to_sheet` + `XLSX.utils.sheet_to_csv` | Already installed and already the workbook engine for every existing report's Excel export; its CSV serializer is battle-tested RFC-4180 escaping — hand-rolling a second escaper is unnecessary duplication (ladder rung 5) |
| `@tanstack/react-table` | `^8.21.3` (installed) | `DataTable` column defs for the 2 new deletions tabs | Matches `VoidRefundPanel`'s existing precedent exactly (closest event-log widget) |

### Supporting
No new supporting libraries required. All 6 new tabs compose only already-installed primitives (`shared/ui/table`, `shared/ui/DataTable`, `shared/ui/alert`, Recharts, i18next).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `xlsx` for CSV | Hand-rolled `rowsToCsv()` string-join with manual quote-escaping | Hand-rolled version adds ~20 lines of untested escaping logic (commas/quotes/newlines/CRLF) for zero functional gain — `xlsx` already ships this, tested, in the bundle. Only worth hand-rolling if `xlsx`'s CVE exposure becomes a blocker for CSV specifically (it isn't — same accepted-risk rationale as the existing Excel path applies) |
| Direct bounded RPC queries per date-range | Nightly materialized/rollup tables (`combo_mix_daily`-style, used by 3 existing Phase-8 reports) | Rollup tables add a refresh-job dependency and a "why is today's data missing" staleness gotcha. `get_caja_report` proves direct aggregation is fast enough at this data volume (single bar's daily order count); reserve rollup tables for reports that need >1 year lookback, which none of these 6 do |

**Installation:** No new packages. Confirm existing versions only:
```bash
npm view recharts version   # confirms 3.10.0 latest; project's ^3.8.1 is current enough, no bump needed
npm view xlsx version
```

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** `recharts` and `xlsx` are both pre-existing dependencies already vetted and in production use (`ComboMixReport`, `excel.ts`). No legitimacy check is required — this section is intentionally empty per the "no new packages" exemption.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No new packages this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│  ReportsPage (pages/reports) │  Tabs: ...voids, deletions-pre,
│  DateRangePicker (from/to)   │        deletions-post, modifier-popularity,
└──────────────┬───────────────┘        payment-methods, hourly(extended)
               │ dateRange prop
               ▼
┌──────────────────────────────────────────────────────────┐
│  Widget (e.g. PaymentMethodsReport)                        │
│   ├─ useXReport(from,to) → TanStack Query hook              │
│   │      (entities/tab/model/queries-reports.ts)            │
│   ├─ Recharts <BarChart>/<PieChart> (peak-hours/modifier/   │
│   │      payment only — D-16: voids/deletions stay tabular) │
│   ├─ DataTable / raw <Table> (all 6)                        │
│   └─ ExportButtons (reportType=...) → useExportReport        │
│          ├─ existing Excel/PDF branches (unchanged)          │
│          └─ NEW: csv branch → rowsToCsv() generic serializer │
└──────────────┬───────────────────────────────────────────────┘
               │ supabase.rpc('get_X_report', {p_from, p_to})
               ▼
┌──────────────────────────────────────────────────────────┐
│  Postgres RPC (SECURITY DEFINER)                            │
│   get_peak_hours_report / get_voids_report /                │
│   get_deletions_pre_report / get_deletions_post_report /     │
│   get_modifier_popularity_report / get_payment_methods_report│
│   get_charts_data (composite, feeds multiple widgets)        │
│      ├─ bounded WHERE created_at BETWEEN p_from AND p_to      │
│      │     (indexed: idx_orders_created_at, etc.)             │
│      ├─ excludes is_deleted/voided/reopened_void rows          │
│      │     (mirrors get_caja_report's Phase-23 exclusions)      │
│      └─ returns JSON matching the entity's Zod row schema       │
└──────────────┬───────────────────────────────────────────────┘
               │ reads
               ▼
   order_items / orders / payments / audit_logs (plural!) / products / modifiers

┌──────────────────────────────────────────────────────────┐
│  SEPARATE FLOW: order_item removal (D-06)                   │
│  RemoveTabItemDialog (reason required, no PIN gate)          │
│      → useRemoveTabItem → NEW RPC remove_tab_item(...)        │
│           1. capture before-state (order_items row)            │
│           2. PERFORM deplete_for_order_item(item_id, -1, ...)  │
│              (MUST run before delete — reads product_id from   │
│               the row being removed)                            │
│           3. DELETE FROM order_items (hard delete — D-06 kept  │
│              hard-delete, did not adopt is_deleted soft-delete) │
│           4. void the order if it's now empty (existing logic)  │
│           5. PERFORM record_audit('order_item.remove', ...)     │
└──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
supabase/migrations/
├── 202607XXXXXXXX_peak_hours_and_voids_rpc.sql        # D-01..D-04: migrate voids + extend hourly
├── 202607XXXXXXXX_deletions_reports_rpc.sql           # D-05..D-07: new order_item.remove action + remove_tab_item RPC + 2 report RPCs
├── 202607XXXXXXXX_modifier_popularity_rpc.sql         # D-09/D-10
├── 202607XXXXXXXX_payment_methods_rpc.sql             # D-08
└── 202607XXXXXXXX_charts_data_rpc.sql                 # composite/summary RPC feeding chart widgets

src/entities/tab/model/queries-reports.ts              # + 6 new use*Report hooks (existing file, not new)
src/shared/lib/audit-actions.ts                        # + 'order_item.remove' entry (FIRST, before any RPC references it)
src/shared/lib/domain.ts                                # extend HourlyRowSchema (D-04), add new Row types (DeletionsPreRow, DeletionsPostRow, ModifierPopularityRow, PaymentMethodRow)
src/shared/lib/exporters/
├── csv.ts                                              # NEW: generic rowsToCsv<T>(rows, columns) — sibling to excel.ts/pdf.tsx
├── excel.ts                                            # extend hourlySalesToWorkbook for new HourlyRow fields (D-04)
└── pdf.tsx                                              # extend hourlySalesToPdfBytes for new HourlyRow fields (D-04)
src/features/export-report/model/useExportReport.ts     # + 'X-csv' ExportType branches for all 17 reports (D-12)
src/features/export-report/ui/ExportButtons.tsx         # + 3rd DropdownMenuItem (CSV) on every reportType branch
src/features/remove-tab-item/useRemoveTabItem.ts        # replace 3-step client mutation with single db.rpc('remove_tab_item', ...)
src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx # + required reason textarea (D-07)
src/widgets/
├── DeletionsPreSendPanel/                              # NEW — DataTable, historical-gap Alert banner
├── DeletionsPostCloseReport/                            # NEW — DataTable, reads audit_logs action='tab.edit_paid'
├── ModifierPopularityReport/                            # NEW — Recharts horizontal BarChart + capped table
├── PaymentMethodsReport/                                # NEW — Recharts donut + 2-grain table
├── HourlyBreakdownPanel/                                 # EXTENDED — day-of-week column, RPC-backed
└── VoidRefundPanel/                                      # UNCHANGED UI — data source moves to RPC (D-01)
src/pages/reports/index.tsx                              # + 4 new TabsTrigger/TabsContent pairs
```

### Pattern 1: SECURITY DEFINER reporting RPC (bounded, JSON-returning)
**What:** Every new/migrated RPC follows `get_caja_report`'s shape: `LANGUAGE plpgsql`, `SECURITY DEFINER`, returns `JSON` (or `JSONB`), single `RETURN json_build_object(...)` at the end, `p_from`/`p_to` bound every subquery's `WHERE`.
**When to use:** All 6 new/migrated report RPCs.
**Example:**
```sql
-- Source: supabase/migrations/20260420000004_caja_report_rpc.sql (existing pattern)
CREATE OR REPLACE FUNCTION get_peak_hours_report(p_from timestamptz, p_to timestamptz)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      EXTRACT(HOUR FROM o.created_at)::int          AS hour,
      EXTRACT(DOW  FROM o.created_at)::int           AS day_of_week,
      COUNT(DISTINCT o.id)                           AS order_count,
      COALESCE(SUM(oi.quantity * (oi.unit_price + oi.modifier_price_delta)), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'voided'
      AND o.is_deleted = FALSE
      AND o.created_at BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ) t;
  RETURN json_build_object('ok', true, 'rows', COALESCE(v_rows, '[]'::json));
END;
$$;
GRANT EXECUTE ON FUNCTION get_peak_hours_report(timestamptz, timestamptz) TO authenticated;
```

### Pattern 2: Client hook consuming a report RPC
**What:** `useQuery` calling `db.rpc(...)`, unwrapping `{ok, rows}` into a typed `Result<Row[]>`.
**Example:**
```typescript
// Source: src/entities/caja/model/queries.ts useCajaReport (existing pattern)
export function usePeakHoursReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'peak-hours', from.toISOString(), to.toISOString()] as const,
    queryFn: async (): Promise<Result<HourlyRow[]>> => {
      const { data, error } = await db.rpc('get_peak_hours_report', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) return err(unknownError(error));
      const parsed = data as { ok: boolean; rows: unknown[] };
      return ok(parsed.rows.map(r => HourlyRowSchema.parse(mapSnakeToCamel(r))));
    },
    staleTime: 60_000,
  });
}
```

### Pattern 3: Audited RPC replacing a multi-step client mutation (D-06 resolution)
**What:** Move `useRemoveTabItem`'s 3-step sequence (delete item → check remaining → void order) plus the currently-TODO inventory restore into one atomic RPC, following `edit_paid_tab`'s before/after-audit shape.
**Example:**
```sql
-- Source: supabase/migrations/20260719000001_edit_paid_tab_rpc.sql (structure to copy)
CREATE OR REPLACE FUNCTION public.remove_tab_item(
  p_item_id uuid,
  p_reason  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_before   jsonb;
  v_remaining int;
BEGIN
  SELECT to_jsonb(oi.*), oi.order_id INTO v_before, v_order_id
  FROM order_items oi WHERE oi.id = p_item_id;

  IF v_before IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  -- Restore inventory BEFORE deleting the row (deplete_for_order_item reads
  -- product_id/quantity/modifier_ids from order_items by id).
  PERFORM deplete_for_order_item(p_item_id, -1, true);

  DELETE FROM order_items WHERE id = p_item_id;

  SELECT COUNT(*) INTO v_remaining FROM order_items WHERE order_id = v_order_id;
  IF v_remaining = 0 THEN
    UPDATE orders SET status = 'voided' WHERE id = v_order_id;
  END IF;

  PERFORM record_audit('order_item.remove', 'order_item', p_item_id,
    v_before, jsonb_build_object('reason', p_reason), 'rpc');

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_tab_item(uuid, text) TO authenticated;
```

### Pattern 4: Generic CSV serializer (D-11) reusing `xlsx`
**What:** One function, any flat-object array + column config, reusing SheetJS's own CSV writer instead of hand-rolled escaping.
**Example:**
```typescript
// Source: src/shared/lib/exporters/excel.ts (existing XLSX import), new sibling file csv.ts
import * as XLSX from 'xlsx';

export type CsvColumn<T> = { key: keyof T; header: string };

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const mapped = rows.map(row =>
    Object.fromEntries(columns.map(c => [c.header, row[c.key]]))
  );
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map(c => c.header) });
  return XLSX.utils.sheet_to_csv(ws);
}

export function csvToBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}
```
Wired into `useExportReport` exactly like the existing Excel branches: `bytes = csvToBytes(rowsToCsv(ctx.rows, COLUMNS))`, then the same `save()`/`writeFile()` flow, `ext = 'csv'`.

### Anti-Patterns to Avoid
- **Querying the legacy `audit_log` (singular) table for the new deletions reports:** That table is Phase-8 legacy, only written to by `combo_availability_override` and `process_refund`'s backward-compat insert. `record_audit()` (Phase 14) — which `order_item.remove` and `tab.edit_paid` both use — writes to `audit_logs` (plural). Querying the wrong table silently returns zero rows forever; there is no error to catch this.
- **Calling `deplete_for_order_item` after the order_item is deleted:** The function's first step is `SELECT product_id, quantity, modifier_ids FROM order_items WHERE id = p_order_item_id` — `IF NOT FOUND THEN RETURN; END IF` silently no-ops if the row is already gone. Inventory restore must run strictly before the `DELETE`.
- **Using `SELECT record_audit(...)` instead of `PERFORM record_audit(...)`:** The CI test `audit-actions.test.ts` greps migrations for the literal string `PERFORM record_audit('action'` — a `SELECT` call (which also works functionally in plpgsql) will not match the regex and can slip through without being enforcement-checked, and diverges from every other migration's style.
- **Forgetting the `AND status IS DISTINCT FROM 'reopened_void'` filter on `payments` in the new payment-methods RPC:** Every payment-summing site in the codebase was patched in Phase 23 (`20260720000005_fix_payment_sums_exclude_reopened_void.sql`) to exclude reopened-then-voided payment rows. A brand-new payment-methods RPC that omits this filter reintroduces the exact revenue-inflation bug that migration fixed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV string generation / escaping | Custom `rows.map(r => r.join(',')).join('\n')` with manual quote-escaping | `XLSX.utils.json_to_sheet` + `XLSX.utils.sheet_to_csv` | `xlsx` is already installed, already the Excel engine, and its CSV writer already handles embedded commas/quotes/newlines correctly — hand-rolling duplicates tested logic for zero benefit |
| Inventory restoration for a removed order item | A brand-new "restore inventory for 1 item" RPC (the TODO literally asks for this) | Existing `deplete_for_order_item(p_order_item_id, -1, p_allow_negative)` — already generic over 1 item, already used this exact way (with `p_direction = -1`) by `useVoidOrder.ts` and `process_refund`'s restock branch | This function already IS the dedicated single-item inventory-restore RPC the TODO describes; it was written generically enough to be called from 3 different flows (void, refund, and now removal) |
| Payment method aggregation math (grouping, exclusion filters) | New client-side aggregation logic in `queries-reports.ts` | Server-side `GROUP BY method` inside the RPC, mirroring `get_caja_report`'s `CASE WHEN method = 'cash' THEN ...` pattern | Keeps the query bounded and index-backed (SC-4); client-side aggregation over an unbounded row fetch is exactly the anti-pattern this phase is migrating `voids`/`peak-hours` away from |

**Key insight:** Every "new" problem this phase presents (CSV, inventory restore, exclusion filters) already has a working, in-production solution elsewhere in this codebase. The research risk here is not "what library to add" but "which existing function/table to find and reuse correctly."

## Common Pitfalls

### Pitfall 1: Two audit tables, only one is correct for this phase
**What goes wrong:** A new deletions-report RPC queries `audit_log` (singular, legacy Phase-8 table) instead of `audit_logs` (plural, Phase-14 `record_audit()` table) and silently returns empty results forever.
**Why it happens:** `ComboOverrideReport`'s existing query (`useComboOverrides` in `queries-reports.ts`) queries `.from('audit_log')` — a nearby, working precedent in the very same file that uses the wrong table for this phase's purposes.
**How to avoid:** Both deletions reports (and any new audit-log-reading report) must query `audit_logs` (plural), `WHERE action = 'order_item.remove'` / `WHERE action = 'tab.edit_paid'`. Verify with `SELECT COUNT(*) FROM audit_logs WHERE action = '...'` after seeding one test removal/edit.
**Warning signs:** Deletions report tab always shows the empty state even after manually testing a removal.

### Pitfall 2: `HourlyRow` schema change breaks 2 exporter call sites silently at compile time only if typed correctly
**What goes wrong:** D-04 changes `HourlyRow` from `{hour, orderCount, revenue}` to include `dayOfWeek`/`isBusiest` (or similar). `hourlySalesToWorkbook` and `hourlySalesToPdfBytes` in `excel.ts`/`pdf.tsx` both destructure the old shape positionally in places; TypeScript strict mode will catch missing/renamed fields, but only if the exporter functions are NOT typed as `any` anywhere in the chain.
**Why it happens:** `useExportReport.ts`'s switch statement casts `data as HourlyRow[]` — a schema change is a compile error there, but exporter *internals* that build spreadsheet rows via array literals (`[row.hour, row.orderCount, row.revenue]`) won't error if a new field is simply never read; it silently doesn't show up in the export.
**How to avoid:** After extending `HourlyRowSchema`, explicitly re-check `hourlySalesToWorkbook`/`hourlySalesToPdfBytes` include every new column, not just that they still compile.
**Warning signs:** New peak-hours columns (day-of-week, busiest-hour flag) show correctly on-screen but are missing from the Excel/PDF export.

### Pitfall 3: `remove_tab_item` RPC role/PIN gate mismatch with the UI-SPEC decision
**What goes wrong:** Following `edit_paid_tab`'s copy-paste pattern too literally adds a `manager`/`admin`-only role check inside the new `remove_tab_item` RPC, but CONTEXT.md's discretion note and the UI-SPEC (`Destructive confirmation: Not applicable — no PIN gate added`) both say removal should NOT require a new PIN gate — it's bartender-accessible like today.
**Why it happens:** `edit_paid_tab`/`process_refund`/`reopen_tab` all have a `role IN ('manager','admin')` guard as their first step; it's tempting to copy that block reflexively for "another sensitive RPC."
**How to avoid:** `remove_tab_item` should keep today's effective access level (any authenticated staff who can currently trigger `useRemoveTabItem`, i.e. bartender+) — do not add a role check unless a later planning step explicitly decides otherwise. Cross-check against `RemoveTabItemDialog`'s current caller before adding gates.
**Warning signs:** E2E test for removal starts failing with `AUTH_FORBIDDEN` when run as a bartender fixture.

### Pitfall 4: Modifier-popularity aggregation double-counts across `modifier_ids` array elements
**What goes wrong:** `order_items.modifier_ids` is a Postgres `UUID[]` column (one order_item can have multiple modifiers). A naive `GROUP BY unnest(modifier_ids)` inside a larger join with `order_items`/`orders` can multiply row counts for other joined columns if not restructured as a lateral/CTE aggregation first.
**Why it happens:** `deplete_for_order_item_v4`'s own header comment documents this exact class of bug (`modifier_ingredient_collision`) already occurring once in this codebase for a structurally similar `unnest`-over-array pattern.
**How to avoid:** Aggregate modifiers in an isolated subquery/CTE (`SELECT unnest(modifier_ids) AS modifier_id, ... FROM order_items ... GROUP BY modifier_id`) before joining to `modifiers` for names, not inside a single flat join with `orders`/`payments`.
**Warning signs:** Modifier attach-counts in the report don't match a manual `SELECT COUNT(*) FROM order_items WHERE 'xyz' = ANY(modifier_ids)` spot-check.

## Code Examples

### Peak-hours extension — day-of-week + busiest-hour indicator (D-03/D-04)
```typescript
// Source: src/entities/tab/model/queries-reports.ts findPeakHour (existing pure helper, reusable client-side even after RPC migration)
export function findPeakHour(rows: HourlyRow[]): HourlyRow | null {
  const nonZero = rows.filter(r => r.revenue > 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((best, r) => (r.revenue > best.revenue ? r : best));
}
```
This helper stays useful post-migration: the RPC can return raw per-hour/per-dow rows and the client keeps deriving "busiest" client-side (matching current `HourlyBreakdownPanel` behavior) rather than duplicating the "busiest" computation in SQL — one less thing to keep in sync between server and client highlight logic.

### CSV wired into ExportButtons (3rd dropdown item, D-12)
```typescript
// Source: src/features/export-report/ui/ExportButtons.tsx (existing 'excel'|'pdf' branch to extend)
function handleExport(format: 'excel' | 'pdf' | 'csv') {
  void (async () => {
    if (props.reportType === 'voids') {
      const type = format === 'excel' ? 'voids-excel' : format === 'pdf' ? 'voids-pdf' : 'voids-csv';
      await exportReport(type, props.data);
    }
    // ...one new csv-suffixed literal per existing branch, all 17 reportTypes
  })();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side unbounded `orders`/`order_items` fetch for voids/hourly, aggregated in TypeScript | Server-side `SECURITY DEFINER` RPC with bounded `p_from`/`p_to` WHERE clause | This phase (D-01, D-03) | Matches SC-4 ("no unbounded queries"); moves aggregation cost to Postgres where it's indexed |
| Hard `DELETE` on `order_items` with zero audit trail | Same hard delete, now wrapped in a `record_audit('order_item.remove', ...)` call inside a new RPC | This phase (D-06) | Closes the only remaining un-audited destructive mutation in the order lifecycle; historical gap noted, not backfilled |

**Deprecated/outdated:**
- Client-side date-range filtering in `queries-reports.ts` for voids/hourly is superseded by the new RPCs — do not delete `filterVoidRefundRows`/`aggregateHourlyRevenue`/`fillMissingHours` pure helpers outright (they may still be useful for tests or as reference), but the live `useVoidRefundReport`/`useHourlyBreakdown` hooks' query bodies should be swapped to `db.rpc(...)` calls.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `remove_tab_item` should NOT include a manager/admin role guard (matching current bartender-accessible behavior), only a reason-required check | Pitfall 3, Pattern 3 | If wrong, a role check should be added — low risk, easy to add later, but changes who can remove items in current production usage if assumed incorrectly in either direction |
| A2 | New RPCs should take `p_from`/`p_to` as `timestamptz` (matching `edit_paid_tab`'s `text`-vs-`uuid` param style precedent generally, but no single existing RPC uses exactly this date-range parameter pair — `get_caja_report` takes a single `p_caja_id` instead) | Pattern 1, Standard Stack | If a different param convention is expected (e.g. `date` instead of `timestamptz`, or matching `assertDateRangeValid`'s client-side 365-day cap being enforced server-side too), signatures need adjustment — low risk, mechanical fix |
| A3 | `payment-methods` report should exclude `is_refund = true` rows and `status = 'reopened_void'` rows, matching `get_caja_report`'s exact Phase-23 exclusion pattern | Pattern 1 anti-patterns, D-08 | If refund rows should instead be netted in (shown as negative-amount rows) rather than excluded, the per-method totals would differ — moderate risk since this is genuinely a new report with no 1:1 precedent for refund handling specifically |
| A4 | The `charts-data` RPC (6th of the "6 new RPCs") is a composite/summary endpoint feeding multiple chart widgets rather than a distinct 7th report tab | Recommended Project Structure | CONTEXT.md's D-13..D-16 describe charts as attached to peak-hours/modifier-popularity/payment-methods tabs individually, not a separate "charts" tab — if `charts-data` is meant to be its own tab, the tab inventory needs a 5th new entry beyond the 4 the UI-SPEC lists (deletions×2, modifier-popularity, payment-methods) |

**If this table is empty:** N/A — 4 assumptions require planner/user confirmation before locking task-level SQL signatures.

## Open Questions

1. **What exactly is the "charts-data" RPC's scope?**
   - What we know: CONTEXT.md and the UI-SPEC both describe Recharts visuals as embedded directly in the peak-hours/modifier-popularity/payment-methods widgets (D-13/14/15), each pulling from that report's own RPC — no separate "charts" tab appears in the UI-SPEC's Report Tab Inventory table.
   - What's unclear: Whether "charts-data" (named explicitly in the phase's Success Criteria as a 6th distinct RPC) is (a) a literal alias for "whatever RPC backs the 3 chart-bearing reports" (i.e., not a 7th thing at all — peak-hours/modifier-popularity/payment-methods RPCs already ARE the charts-data source), or (b) a genuinely separate summary/rollup RPC (e.g., a single call returning all 3 chart datasets pre-shaped for Recharts, to avoid 3 round-trips on page load).
   - Recommendation: Planner should treat "charts-data" as satisfied by the 3 report RPCs themselves (option a) unless a dedicated composite endpoint is explicitly justified by a measured perf issue — building a 7th RPC for no new data would violate Don't-Hand-Roll/YAGNI. Flag for confirmation in planning, not research.

2. **Should `remove_tab_item`'s new RPC also reject removal from a non-`open` tab (defense-in-depth), given `edit_paid_tab` explicitly checks `v_status NOT IN ('paid', 'closed')`?**
   - What we know: `RemoveTabItemDialog`/`useRemoveTabItem` today has no status check — presumably only ever invoked while a tab is open (UI wouldn't offer it otherwise), but there's no server-side guard against, e.g., a stale client calling it against an already-closed tab.
   - What's unclear: Whether adding a `tab.status = 'open'` guard is in-scope for this phase (a defensive addition, following the "belt and suspenders" pattern of every other versioned RPC) or over-engineering for a path that's UI-gated already.
   - Recommendation: Add a lightweight `IF v_tab_status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_OPEN'); END IF;` — it's a 2-line addition consistent with every other tab-mutating RPC in this codebase and costs nothing to include.

## Environment Availability

Skipped — this phase has no environment dependency beyond the already-configured Supabase project (existing `supabase/migrations` workflow) and already-installed npm packages. No new external tool/service is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 (unit/integration), Playwright v1.59 (E2E) |
| Config file | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` |
| Quick run command | `npx vitest run src/entities/tab/model/queries-reports.test.ts` |
| Full suite command | `npm run test` (unit), `npm run test:e2e` (E2E) |

### Phase Requirement Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 (6 RPCs shipped) | Each RPC returns correctly-shaped rows for a seeded date range | integration | `npx vitest run src/entities/tab/model/*-report.integration.test.ts` | ✅ pattern exists (`void-refund-report.integration.test.ts`, `product-sales-report.integration.test.ts`, `category-revenue-report.integration.test.ts`) — ❌ Wave 0 needed for the 4 new report types |
| SC-1 (`order_item.remove` audit) | `audit-actions.test.ts`'s per-RPC coverage assertion extended to `remove_tab_item` | unit | `npx vitest run src/shared/lib/__tests__/audit-actions.test.ts` | ✅ file exists, add `{ fn: 'remove_tab_item', action: 'order_item.remove' }` to `TARGET_RPCS` |
| SC-2 (generic CSV export) | `rowsToCsv()` produces correct RFC-4180 output for a sample row set incl. embedded commas/quotes | unit | `npx vitest run src/shared/lib/exporters/csv.test.ts` | ❌ Wave 0 — new file, mirrors `excel.test.ts`/`pdf.test.ts` |
| SC-2 (CSV wired to all 17 tabs) | `ExportButtons` renders a CSV dropdown item for every `reportType` | unit | `npx vitest run src/features/export-report/ui/ExportButtons.test.tsx` | ❌ Wave 0 if no test file exists yet for this component — check before assuming |
| SC-3 (Recharts widgets render) | Peak-hours bar / payment-methods donut / modifier-popularity bar render with seeded data | e2e | `npx playwright test e2e/37-analytics-reports.spec.ts` (extend) or new spec | ✅ `e2e/37-analytics-reports.spec.ts`/`e2e/07-reports.spec.ts` exist as extension points |
| SC-4 (bounded queries) | New RPCs use indexed `WHERE created_at BETWEEN` — verify with `EXPLAIN ANALYZE` manually, not unit-testable | manual-only | — (DB query plan inspection) | N/A — document verification in PR description, not a CI gate |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npm run test` + `npm run typecheck` + `npm run lint`
- **Phase gate:** Full suite green (`npm run test`, `npm run test:e2e`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shared/lib/exporters/csv.test.ts` — covers the generic `rowsToCsv()` serializer (SC-2)
- [ ] 4 new `*-report.integration.test.ts` files (deletions-pre, deletions-post, modifier-popularity, payment-methods) mirroring the existing 3 (SC-1) — voids/peak-hours migrations can extend the existing `void-refund-report.integration.test.ts`/`queries-reports.test.ts` rather than needing new files
- [ ] Extend `audit-actions.test.ts`'s `TARGET_RPCS` array with `remove_tab_item` → `order_item.remove` (SC-1)
- [ ] `RemoveTabItemDialog.test.tsx` — add a case asserting the reason field is required and blocks submission when empty (D-07)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface — RPCs run as the already-authenticated caller (`auth.uid()` via `SECURITY DEFINER`), same as every existing report RPC |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | `get_user_role()` / `role IN (...)` checks where a role gate is warranted (see Pitfall 3 / Open Question 2 — `remove_tab_item` deliberately does NOT add a role gate per D-07/UI-SPEC; report RPCs are read-only and already covered by `authenticated`-role GRANT, matching `get_caja_report`) |
| V5 Input Validation | yes | `p_from`/`p_to` as typed `timestamptz` params (Postgres rejects malformed input at the function-call boundary); `p_reason` trimmed/length-checked client-side (`RemoveTabItemDialog`, mirroring `VoidOrderDialog`'s existing `reasonRequired` pattern) — same as every existing reason-taking RPC (`edit_paid_tab`, `reopen_tab`) |
| V6 Cryptography | no | Not applicable — no new secrets/tokens/crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded date-range → full-table-scan DoS on a shared Postgres instance | Denial of Service | Every new RPC takes `p_from`/`p_to` and filters on an indexed `created_at` column; consider reusing `assertDateRangeValid`'s 365-day cap server-side too (currently only enforced client-side for the 3 Phase-8 rollup-table reports) |
| Audit-log tampering / repudiation of a destructive removal | Repudiation | `record_audit()` is `SECURITY DEFINER` and append-only (no UPDATE/DELETE RLS policy exists on `audit_logs`) — `order_item.remove` inherits this guarantee automatically by using the same helper |
| Privilege escalation via a missing role check on a newly-added RPC | Elevation of Privilege | Confirm `remove_tab_item`'s access level matches the CURRENT effective access of `useRemoveTabItem` (bartender+) rather than defaulting to "copy the manager-only guard from `edit_paid_tab`" — verify against `RemoveTabItemDialog`'s actual call sites, not by pattern-matching the nearest RPC |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260420000004_caja_report_rpc.sql` — `get_caja_report`/`list_caja_sessions`, the only existing direct-RPC report precedent
- `supabase/migrations/20260719000001_edit_paid_tab_rpc.sql` — audited-correction RPC shape (before/after capture, `PERFORM record_audit`, whitelisted patch pattern)
- `supabase/migrations/20260707000001_deplete_for_order_item_v4_fix_modifier_ingredient_collision.sql` — confirms `deplete_for_order_item(order_item_id, direction, allow_negative)` signature and its read-before-delete requirement
- `supabase/migrations/20260511001_audit_logs_table.sql` — `record_audit()` helper contract, `audit_logs` (plural) schema
- `supabase/migrations/20260720000005_fix_payment_sums_exclude_reopened_void.sql` — canonical exclusion filter (`is_deleted = FALSE AND status IS DISTINCT FROM 'reopened_void'`) every payment-summing query must apply
- `src/entities/tab/model/queries-reports.ts`, `src/entities/caja/model/queries.ts` — existing hook patterns
- `src/features/export-report/model/useExportReport.ts`, `src/features/export-report/ui/ExportButtons.tsx` — existing export switch/dropdown to extend
- `src/shared/lib/exporters/excel.ts` — confirms `xlsx` is already installed and its CVE-risk-accepted status
- `src/shared/lib/audit-actions.ts`, `src/shared/lib/__tests__/audit-actions.test.ts` — audit action enum + CI enforcement mechanics
- `src/features/remove-tab-item/useRemoveTabItem.ts`, `.../ui/RemoveTabItemDialog.tsx` — current hard-delete/no-audit/no-reason implementation
- `src/features/void-order/model/useVoidOrder.ts` — proves `deplete_for_order_item(id, -1)` is the established single-item inventory-restore call pattern
- `src/widgets/ComboMixReport/ComboMixReport.tsx`, `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx`, `src/widgets/VoidRefundPanel/VoidRefundPanel.tsx` — chart/table widget conventions
- `src/pages/reports/index.tsx` — tab registration pattern
- `package.json` — confirms `recharts@^3.8.1`, `xlsx` (pinned, CVE-accepted), `@tanstack/react-table@^8.21.3` already installed

### Secondary (MEDIUM confidence)
- `npm view recharts version` → `3.10.0` [VERIFIED: npm registry] — confirms project's installed `^3.8.1` range is current and no upgrade is required for this phase's chart needs

### Tertiary (LOW confidence)
- None — all findings traced to a specific file in this codebase; no external/web sources were needed since every pattern this phase needs already exists locally.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, both `recharts` and `xlsx` already in production use with a direct precedent file each
- Architecture: HIGH — `get_caja_report`/`edit_paid_tab`/`deplete_for_order_item` provide a complete, copy-adjacent template for every new RPC and the audit-gap fix
- Pitfalls: HIGH — all 4 pitfalls are traced to actual prior bugs/fixes in this codebase's own migration history (Phase 23's reopened_void fix, the modifier-ingredient-collision fix), not speculative

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (30 days — stable internal codebase patterns, no fast-moving external dependency)
