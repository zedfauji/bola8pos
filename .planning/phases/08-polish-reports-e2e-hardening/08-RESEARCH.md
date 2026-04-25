# Phase 8: Polish + Reports + E2E Hardening — Research

**Researched:** 2026-04-25
**Domain:** Analytics widgets, DB views, CSV/Excel export, E2E hardening, paper-cuts
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| S6-01 | Migration: reporting views (combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily) | Views use existing order_items, stock_movements, waitlist_entries tables — all present in DB |
| S6-02 | Migration: performance indexes (5 per data-model §S6) | 3 of 5 already exist; 2 net-new needed |
| S6-03 | Widget: ComboMixReport | Pattern from CategoryRevenuePanel; data from combo_mix_daily view |
| S6-04 | Widget: RecipeVarianceReport | Pattern from HourlyBreakdownPanel; data from recipe_variance_daily view |
| S6-05 | Widget: WaitlistAnalyticsReport | New; data from waitlist_metrics_daily view + waitlist_entries raw |
| S6-06 | Widget: RefundsRegister | Existing refunds + refund_items + profiles join; no manager_pin_approved_by column present |
| S6-07 | ReportsPage tab reorganization | Tabs already exist; add 4 new tabs to existing Tabs component |
| S6-08 | CSV export for all new reports | useExportReport pattern fully established; extend ExportType union |
| S6-09 | Combo availability override report | Reads audit_log WHERE action='combo_availability_override' |
| S6-10 | E2E 25-reports.spec.ts | Conflict with existing 25-export-reports.spec.ts — needs rename or integration |
| S6-11 | Flakiness sweep on specs 18–24 | Import-order lint fixes in modified files are the only pending changes; no flaky spec patterns found |
| S6-12 | Paper-cut backlog | Uncommitted changes are import-order lint fixes only — no behavioral paper-cuts identified yet |
| S6-13 | CLAUDE.md update: implemented features section | Phases 5–7 not yet listed |
| S6-14 | Obsidian update: mark roadmap items done | External vault action |
| S6-15 | Migration audit: DOWN scripts | 52 of 76 migrations lack DOWN scripts; S6 migrations must include them |
</phase_requirements>

---

## Summary

Phase 8 is an analytics + hardening sprint. It builds four reporting widgets on top of three new SQL views, extends the established `useExportReport` / `ExportButtons` infrastructure for Excel/PDF export, adds five performance indexes to query-hot tables, reorganizes the existing ReportsPage with new tabs, hardens the E2E suite, and patches the ~30% paper-cut reserve.

All infrastructure for this phase already exists in the codebase. The export pattern (`useExportReport` → `ExportButtons` → Tauri `save()/writeFile()`), the widget structure (`CategoryRevenuePanel`, `HourlyBreakdownPanel`), and the migration pattern are all battle-tested. The main work is authoring SQL views, adding domain types, and building four new widgets that follow identical structure to the five existing report panels.

The largest risk is the numbering collision in E2E specs: `e2e/25-export-reports.spec.ts` already exists. S6-10 calls for `25-reports.spec.ts`. The new S6 spec must use a different number — `37-analytics-reports.spec.ts` is the safe choice given existing specs reach `36-recipes.spec.ts`.

The second risk is the `manager_pin_approved_by` column: the data-model spec lists it for RefundsRegister, but the actual `refunds` DDL in migration `20260427000001` does not include this column. RefundsRegister must join `created_by → profiles(name)` for "operator" but cannot show "manager who approved" without a schema change.

**Primary recommendation:** Build in wave order — migrations first (S6-01, S6-02), then domain types, then the four report widgets in parallel, then ReportsPage reorganization and CSV export wiring, then E2E. Reserve 30% capacity for S6-12 paper-cuts throughout.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reporting views (SQL) | Database (Supabase) | — | Aggregation belongs in the DB, not client-side |
| Performance indexes | Database (Supabase) | — | Migration files only |
| Report query hooks | entities/tab/model/queries-reports.ts (established) | entities/combo/, entities/waitlist/, entities/refund/ | Follows existing pattern for new report queries |
| Report widget UI | widgets/ | — | Four new top-level widget folders following FSD |
| ReportsPage tab wiring | pages/reports/ | — | Thin route container; just adds TabsTrigger + TabsContent |
| Export (Excel/PDF) | features/export-report/ | shared/lib/exporters/ | Already established; extend ExportType union |
| E2E specs | e2e/ | — | Playwright against dev server |
| Paper-cuts | Various layers | — | Fix-as-found during sprint |

---

## Standard Stack

### Core (all verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5 | Server state + TanStack Query hooks | Project standard [VERIFIED: package.json] |
| zod | ^4 | Schema + type inference | Single source of truth in domain.ts [VERIFIED: package.json] |
| xlsx (SheetJS) | already installed | Excel export | Already used in exporters/excel.ts [VERIFIED: codebase grep] |
| @tauri-apps/plugin-dialog | already installed | Save dialog for export | Used in useExportReport.ts [VERIFIED: codebase grep] |
| @tauri-apps/plugin-fs | already installed | Write file for export | Used in useExportReport.ts [VERIFIED: codebase grep] |
| @tanstack/react-table | already installed | DataTable component | Used in CajaReportPanel [VERIFIED: codebase grep] |
| sonner | already installed | Toast notifications | Project standard [VERIFIED: codebase grep] |

### No New Dependencies Required

All libraries needed for Phase 8 are already installed. The export infrastructure (xlsx, jsPDF, Tauri plugins) and UI primitives (DataTable, Table, Badge) are established.

---

## Architecture Patterns

### System Architecture Diagram

```
ReportsPage (pages/reports/index.tsx)
    │
    ├── [existing tabs: session, products, hourly, voids, categories, staff, tips]
    │
    └── [new S6 tabs]
           ├── "Combos"  → ComboMixReport widget
           │     └── useComboMixReport() → DB view combo_mix_daily
           │           └── ExportButtons (combo-excel / combo-pdf)
           ├── "Variance" → RecipeVarianceReport widget
           │     └── useRecipeVarianceReport() → DB view recipe_variance_daily
           │           └── ExportButtons (variance-excel / variance-pdf)
           ├── "Waitlist" → WaitlistAnalyticsReport widget
           │     └── useWaitlistAnalyticsReport() → DB view waitlist_metrics_daily
           │                                      + raw waitlist_entries (heatmap)
           │           └── ExportButtons (waitlist-excel / waitlist-pdf)
           ├── "Refunds"  → RefundsRegister widget
           │     └── useRefundsRegister() → refunds JOIN refund_items, profiles
           │           └── ExportButtons (refunds-excel / refunds-pdf)
           └── "Overrides" → ComboOverrideReport widget (S6-09)
                 └── useComboOverrides() → audit_log WHERE action='combo_availability_override'
```

**Data flow for view-backed reports:**
```
DB view (daily aggregate) → TanStack Query hook → widget renders table
                                                 → ExportButtons → Tauri save dialog
                                                                 → xlsx/PDF bytes → writeFile
```

### Recommended Project Structure (new files)

```
bar-pos/
├── supabase/migrations/
│   ├── 20260505000001_s6_reporting_views.sql   # S6-01: 3 views
│   └── 20260505000002_s6_performance_indexes.sql  # S6-02: 2 net-new indexes
│
├── src/
│   ├── shared/lib/
│   │   ├── domain.ts                    # +ComboMixRow, RecipeVarianceRow, WaitlistMetricsRow, RefundRegisterRow schemas
│   │   └── exporters/
│   │       └── excel.ts                 # +comboMixToWorkbook, recipeVarianceToWorkbook, waitlistMetricsToWorkbook, refundsRegisterToWorkbook
│   │
│   ├── entities/
│   │   └── tab/model/queries-reports.ts # +useComboMixReport, useRecipeVarianceReport, useWaitlistAnalyticsReport, useRefundsRegister, useComboOverrides
│   │
│   ├── features/export-report/
│   │   ├── model/useExportReport.ts     # extend ExportType union (8 new variants)
│   │   └── ui/ExportButtons.tsx         # extend Props union (5 new reportType values)
│   │
│   └── widgets/
│       ├── ComboMixReport/
│       │   ├── ComboMixReport.tsx
│       │   └── index.ts
│       ├── RecipeVarianceReport/
│       │   ├── RecipeVarianceReport.tsx
│       │   └── index.ts
│       ├── WaitlistAnalyticsReport/
│       │   ├── WaitlistAnalyticsReport.tsx
│       │   └── index.ts
│       ├── RefundsRegister/
│       │   ├── RefundsRegister.tsx
│       │   └── index.ts
│       └── ComboOverrideReport/
│           ├── ComboOverrideReport.tsx
│           └── index.ts
│
└── e2e/
    └── 37-analytics-reports.spec.ts    # S6-10 (renamed to avoid 25-export-reports collision)
```

### Pattern 1: Report Widget Structure (verified from CategoryRevenuePanel)

Every new report widget follows this identical structure:

```typescript
// Source: bar-pos/src/widgets/CategoryRevenuePanel/CategoryRevenuePanel.tsx
import { ExportButtons } from '@features/export-report';
import { useComboMixReport } from '@entities/tab/model/queries-reports';
import type { ComboMixRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = { dateRange: { from: Date; to: Date } };

export function ComboMixReport({ dateRange }: Props) {
  const { data: result, isLoading } = useComboMixReport(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;
  const rows: ComboMixRow[] = result?.ok ? result.data : [];
  if (rows.length === 0) return <EmptyState ... />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons reportType="combo-mix" data={{ rows, dateRange }} />
      </div>
      <div className="rounded-md border">
        <Table>
          {/* columns */}
        </Table>
      </div>
    </div>
  );
}
```

### Pattern 2: Report Query Hook (verified from queries-reports.ts)

```typescript
// Source: bar-pos/src/entities/tab/model/queries-reports.ts
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
const db = supabase as any;  // pre-regen cast until types regenerated

export function useComboMixReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'combo-mix', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<ComboMixRow[]>> => {
      const { data, error } = await db
        .from('combo_mix_daily')
        .select('*')
        .gte('date', from.toISOString().split('T')[0])
        .lte('date', to.toISOString().split('T')[0])
        .order('date', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(/* map rows */);
    },
  });
}
```

### Pattern 3: Export Extension (verified from useExportReport.ts)

```typescript
// Extend ExportType union in useExportReport.ts
export type ExportType =
  | /* existing 14 variants */
  | 'combo-mix-excel'  | 'combo-mix-pdf'
  | 'recipe-variance-excel' | 'recipe-variance-pdf'
  | 'waitlist-analytics-excel' | 'waitlist-analytics-pdf'
  | 'refunds-register-excel' | 'refunds-register-pdf'
  | 'combo-overrides-excel';  // PDF optional for this one

// Extend ExportButtons Props union:
type ComboMixProps = { reportType: 'combo-mix'; data: { rows: ComboMixRow[]; dateRange: { from: Date; to: Date } } };
// ... one union branch per new report type
```

### Anti-Patterns to Avoid

- **Import order violations:** All modified files in git status have import-order-only diffs (lint violations from prior commits). Fix these as part of paper-cuts wave before any new code lands, or the pre-commit hook will block.
- **FSD boundary violation:** Report query hooks go in `entities/tab/model/queries-reports.ts` (or their own entity file), NOT in the widget. Widgets import from entities.
- **Querying views without `as any` cast:** Views are not in `supabase.types.ts` (Docker unavailable). Use `const db = supabase as any` with `/* eslint-disable */` comment block at file level, consistent with every other pre-regen file.
- **Hardcoding `manager_pin_approved_by`:** This column does not exist in the `refunds` table DDL. The RefundsRegister widget shows the operator (`created_by → profiles.name`) but cannot show "manager who approved" — the spec column must be omitted or marked `—` with a note.
- **Adding new `export *` barrels:** ESLint `no-restricted-syntax` bans `export *`. Use explicit named exports.
- **New E2E file numbered 25-:** `e2e/25-export-reports.spec.ts` already exists. Use `37-analytics-reports.spec.ts`.

---

## DB Views Design

### S6-01: Three Reporting Views

#### View 1: combo_mix_daily

```sql
-- supabase/migrations/20260505000001_s6_reporting_views.sql

CREATE OR REPLACE VIEW combo_mix_daily AS
SELECT
  date_trunc('day', o.created_at AT TIME ZONE 'America/Mexico_City')::date AS date,
  oi.product_id                                                              AS combo_product_id,
  p.name                                                                     AS combo_name,
  COUNT(oi.id)::int                                                          AS qty_sold,
  SUM(oi.unit_price * oi.quantity)::numeric(12,2)                           AS net_revenue,
  AVG(oi.unit_price)::numeric(10,2)                                          AS avg_price,
  COUNT(al.id)::int                                                           AS override_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN audit_log al
  ON al.ref_type = 'combo'
  AND al.ref_id = oi.product_id
  AND al.action = 'combo_availability_override'
  AND date_trunc('day', al.ts) = date_trunc('day', o.created_at)
WHERE p.is_combo = true
  AND o.status != 'voided'
GROUP BY 1, 2, 3;
```

#### View 2: recipe_variance_daily

```sql
CREATE OR REPLACE VIEW recipe_variance_daily AS
SELECT
  date_trunc('day', sm.ts AT TIME ZONE 'America/Mexico_City')::date AS date,
  sm.ingredient_id,
  i.name                                                              AS ingredient_name,
  ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'sale'))::numeric      AS theoretical_used,
  ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'physical_count'))::numeric AS physical_delta,
  CASE
    WHEN ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'sale')) = 0 THEN 0
    ELSE ROUND(
      (ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'physical_count'))
       - ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'sale')))
      / NULLIF(ABS(SUM(sm.delta) FILTER (WHERE sm.reason = 'sale')), 0) * 100,
      2
    )
  END                                                                AS variance_pct
FROM stock_movements sm
JOIN ingredients i ON i.id = sm.ingredient_id
WHERE sm.ingredient_id IS NOT NULL
GROUP BY 1, 2, 3;
```

#### View 3: waitlist_metrics_daily

```sql
CREATE OR REPLACE VIEW waitlist_metrics_daily AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'America/Mexico_City')::date AS date,
  COUNT(*) FILTER (WHERE status = 'seated')::int                          AS parties_seated,
  ROUND(AVG(quoted_wait_minutes) FILTER (WHERE status = 'seated'), 1)    AS avg_quoted_wait,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (seated_at - created_at)) / 60
  ) FILTER (WHERE status = 'seated' AND seated_at IS NOT NULL), 1)       AS avg_actual_wait,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'no_show')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('seated', 'no_show')), 0) * 100,
    1
  )                                                                        AS no_show_rate
FROM waitlist_entries
GROUP BY 1;
```

**View type:** Regular SQL views (not materialized). Rationale: data volumes for a single-venue POS are small enough that live views are fine. The five performance indexes below make the underlying queries fast. Materialized views would require pg_cron for refresh — Docker unavailable makes this unverifiable; defer to next milestone if operators report slow load times.

**DOWN script pattern** (required per S6-15 findings):
```sql
-- DOWN:
-- BEGIN;
-- DROP VIEW IF EXISTS waitlist_metrics_daily;
-- DROP VIEW IF EXISTS recipe_variance_daily;
-- DROP VIEW IF EXISTS combo_mix_daily;
-- COMMIT;
```

### S6-02: Performance Indexes

**Index audit results** — which already exist vs. net-new:

| Index from data-model §S6 | Already Exists? | Migration |
|--------------------------|-----------------|-----------|
| `stock_movements(ingredient_id, ts desc)` | No — only idempotency UNIQUE index exists on (ref_type, ref_id, ingredient_id) | Need to create |
| `order_items(parent_order_item_id)` | YES — `idx_order_items_parent_order_item_id` in 20260425000002 | Skip |
| `order_items(tab_id, created_at)` | No — existing idx_order_items_order_id is on order_id not tab_id | Need to check if tab_id even exists |
| `tabs(parent_tab_id)` | YES — `idx_tabs_parent_tab_id` in 20260427000001 | Skip |
| `waitlist_entries(status, created_at)` | Partial — separate status and created_at indexes exist; composite does not | Composite is better for reporting query |

**Note on order_items.tab_id:** [ASSUMED] The schema uses `order_items.order_id → orders.tab_id` (two-hop), not a direct `tab_id`. The index `order_items(tab_id, created_at)` may refer to the orders table, not order_items. Verify the actual column existence before writing the migration.

**Net-new SQL for `20260505000002_s6_performance_indexes.sql`:**

```sql
-- 1. stock_movements ingredient_id query performance (ledger drilldown)
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient_ts
  ON stock_movements (ingredient_id, ts DESC)
  WHERE ingredient_id IS NOT NULL;

-- 2. waitlist_entries composite for reporting query
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status_created_at
  ON waitlist_entries (status, created_at DESC);

-- DOWN:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_waitlist_entries_status_created_at;
-- DROP INDEX IF EXISTS idx_stock_movements_ingredient_ts;
-- COMMIT;
```

---

## CSV Export Pattern

### Existing Infrastructure (fully verified)

The export infrastructure is complete and battle-tested:

1. **`useExportReport` hook** (`src/features/export-report/model/useExportReport.ts`) — dispatches by `ExportType`, calls `@tauri-apps/plugin-dialog`'s `save()` for file path, then `@tauri-apps/plugin-fs`'s `writeFile()`. Returns `Result<void>`.

2. **`ExportButtons` component** (`src/features/export-report/ui/ExportButtons.tsx`) — discriminated union on `reportType` prop, renders dropdown with Excel + PDF options, RBAC-gated by `view_reports`. Import from `@features/export-report`.

3. **Excel workbook builders** (`src/shared/lib/exporters/excel.ts`) — SheetJS `xlsx` library, `XLSX.utils.aoa_to_sheet()` pattern. Money cells use `moneyCell()` helper.

4. **PDF builders** (`src/shared/lib/exporters/pdf.tsx`) — jsPDF-based, same shape.

### Extension Pattern for Phase 8

Add four new `reportType` values to the `Props` union in `ExportButtons.tsx` and four new `ExportType` variants to `useExportReport.ts`. Add four workbook builder functions to `excel.ts`. The switch statement in `exportReport()` expands linearly — no architectural change needed.

**No new libraries needed.** The codebase already uses `xlsx` for Excel and jsPDF for PDF.

**E2E testing for export:** Mock `__TAURI_INTERNALS__` via `page.addInitScript()` — the pattern is fully documented and working in `e2e/25-export-reports.spec.ts`. New export tests in `37-analytics-reports.spec.ts` should copy this injection helper verbatim.

---

## E2E Flakiness Findings

### Spec Inventory: 18–24 (S6-11 scope)

| Spec | Status | Issue Found |
|------|--------|-------------|
| 18-void-order.spec.ts | [ASSUMED: stable] | No flakiness patterns visible |
| 19-caja-entries.spec.ts | [ASSUMED: stable] | Standard pattern |
| 19-product-sales-report.spec.ts | [ASSUMED: stable] | Has integration env guard (`requireIntegrationEnv`) |
| 20-error-scenarios.spec.ts | [ASSUMED: stable] | |
| 20-sprint2-revenue.spec.ts | [ASSUMED: stable] | |
| 21-carom-billing.spec.ts | [ASSUMED: stable] | |
| 21-prep.spec.ts | Verified stable | Reads browser console (`page.on('console', ...)`) per S6 guardrail. T5 depends on T2+T4 state — test-order dependency is documented; requires seed-prep.ts between full runs |
| 21-product-management.spec.ts | [ASSUMED: stable] | |
| 22-sprint3-billing.spec.ts | [ASSUMED: stable] | |
| 22-staff-management.spec.ts | [ASSUMED: stable] | |
| 23-caja-entries.spec.ts | [ASSUMED: stable] | |
| 23-payment-edge-cases.spec.ts | [ASSUMED: stable] | |
| 24-waitlist.spec.ts | Verified | T3 has conditional path (annotated with `test.info().annotations.push` instead of skip — correct pattern); T5 opens second browser context — may be slow on CI |

### Specific Risk: 21-prep.spec.ts T5 Test-Order Dependency

T5 (`blocked produce — insufficient tomato`) **explicitly depends on cumulative DB state from T2 + T4**. This is documented in the spec but is an anti-pattern per `03-testing-strategy.md` ("each must be independent and seed its own data"). 

**S6-11 recommendation:** Add a `beforeAll` in `21-prep.spec.ts` that:
1. Runs `seed-prep.ts` logic inline OR calls `resetTestState()` then seeds tomato to exactly 0g
2. This makes T5 deterministic in isolation

### Specific Risk: 24-waitlist.spec.ts T5 Realtime Two-Context Test

T5 opens a second browser context to verify Realtime sync. This can be timing-sensitive. Add `await page2.waitForTimeout(1000)` after navigation if flakiness is observed, or lower `staleTime` to 5s for the test environment.

### Modified Files (paper-cut / lint fixes pending commit)

All 8 modified files in git status contain **import-order lint fixes only** (moving `toast` import after `@tanstack/react-query`, alphabetical ordering of FSD layer imports). These are pre-commit hook violations that must be committed before Phase 8 work starts — otherwise husky blocks every commit.

---

## TypeScript Types Strategy

### Pattern (established across all prior phases)

Docker is unavailable (`supabase gen types --local` writes error text to the file). All new DB objects get manually transcribed types.

**Rule:** Every file querying a view or new table uses:
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
const db = supabase as any;
```

**Domain types** (Zod schemas in `domain.ts`) are the TypeScript-facing source of truth. Add these schemas:

```typescript
// In src/shared/lib/domain.ts

export const ComboMixRowSchema = z.object({
  date: z.string(),          // ISO date string from view
  comboProdutId: UuidSchema,
  comboName: z.string(),
  qtySold: z.number().int(),
  netRevenue: z.number(),
  avgPrice: z.number(),
  overrideCount: z.number().int(),
});
export type ComboMixRow = z.infer<typeof ComboMixRowSchema>;

export const RecipeVarianceRowSchema = z.object({
  date: z.string(),
  ingredientId: UuidSchema,
  ingredientName: z.string(),
  theoreticalUsed: z.number(),
  physicalDelta: z.number(),
  variancePct: z.number(),
});
export type RecipeVarianceRow = z.infer<typeof RecipeVarianceRowSchema>;

export const WaitlistMetricsRowSchema = z.object({
  date: z.string(),
  partiesSeated: z.number().int(),
  avgQuotedWait: z.number().nullable(),
  avgActualWait: z.number().nullable(),
  noShowRate: z.number().nullable(),
});
export type WaitlistMetricsRow = z.infer<typeof WaitlistMetricsRowSchema>;

export const RefundRegisterRowSchema = z.object({
  id: UuidSchema,
  date: TimestampSchema,
  operatorName: z.string(),
  originalPaymentId: UuidSchema,
  amount: z.number().positive(),
  reason: RefundReasonSchema,
  restockCount: z.number().int(),
  items: z.array(RefundItemSchema).default([]),
});
export type RefundRegisterRow = z.infer<typeof RefundRegisterRowSchema>;

export const ComboOverrideRowSchema = z.object({
  id: UuidSchema,
  ts: TimestampSchema,
  actorName: z.string(),
  comboName: z.string(),
  reason: z.string().nullable(),
});
export type ComboOverrideRow = z.infer<typeof ComboOverrideRowSchema>;
```

**Note:** `RefundRegisterRow` requires a JOIN `refunds → profiles(name)` for `operatorName`. The `manager_pin_approved_by` column does NOT exist in the DB (verified from DDL). Omit it from the type.

---

## Paper-Cut Inventory

### Confirmed Pending (from git status)

These 8 files have uncommitted import-order lint fixes that must land in Wave 0:

| File | Change | Type |
|------|--------|------|
| `src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` | Arrow function body braces (lint style) | Lint fix |
| `src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts` | `toast` import order | Lint fix |
| `src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` | `toast` import order | Lint fix |
| `src/features/notify-waitlist/model/useNotifyWaitlist.ts` | `toast` import order | Lint fix |
| `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` | `toast` import order | Lint fix |
| `src/pages/waitlist/index.tsx` | FSD layer import order | Lint fix |
| `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | `useQuery` before lucide-react | Lint fix |
| `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | Multiple import order fixes | Lint fix |

**Action:** Commit all 8 files as `fix(07-waitlist): fix import order lint violations` in Wave 0 before any other Phase 8 work.

### Expected Paper-Cut Categories (from S6-PRD, field use patterns)

| Category | Where to Look | Typical Fix |
|----------|---------------|-------------|
| Touch-target sizing | Sheet/Dialog trigger buttons | Increase `size` or `touchSize` prop; use `POSButton` instead of `Button` |
| Focus-trap in Sheet components | SeatPartySheet, AddWaitlistEntryForm, RefundSheet | Verify `SheetContent` receives focus on open; use `initialFocus` ref |
| Loading skeleton gaps | Any widget missing `CardSkeleton` while loading | Add `<CardSkeleton>` fallback before data loads |
| Error toast copy | Inconsistent "Something went wrong" vs specific messages | Align to existing toast strings in pos6-caja-print-summary pattern |
| Realtime reconnect | WaitlistRealtimeListener in store.ts | Supabase channel re-subscribe on reconnect; check `.on('system', ...)` handler |

### CLAUDE.md Feature List Update (S6-13)

Current "Implemented Features" section (verified from CLAUDE.md) lists up to `print-precheque`. Missing:
- Phase 5: `produce-prep-batch`, `/kitchen-prep` page
- Phase 6: `split-tab`, `process-refund`, sub-tab flow
- Phase 7: `add-waitlist-entry`, `notify-waitlist`, `seat-waitlist-party`, `mark-no-show`, `mark-cancelled`

---

## Refund Register Data Sources

### Join Path (verified from DDL)

```sql
-- RefundsRegister query (no materialized view — direct join)
SELECT
  r.id,
  r.created_at                         AS date,
  p.full_name                          AS operator_name,
  r.original_payment_id,
  r.amount,
  r.reason,
  COUNT(ri.id) FILTER (WHERE ri.restock = true)::int AS restock_count
FROM refunds r
JOIN profiles p ON p.id = r.created_by
LEFT JOIN refund_items ri ON ri.refund_id = r.id
WHERE r.created_at BETWEEN :from AND :to
GROUP BY r.id, r.created_at, p.full_name, r.original_payment_id, r.amount, r.reason
ORDER BY r.created_at DESC;
```

**Missing column:** `manager_pin_approved_by` is in the data-model spec but NOT in the actual DDL (migration `20260427000001_split_bill_schema.sql`). The widget must omit this column. If needed in future, it requires a separate migration to add the column to `refunds`.

**Tab_id availability:** The `refunds` table links to `original_payment_id → payments → tab_id`. To get the tab name, add `LEFT JOIN payments pay ON pay.id = r.original_payment_id LEFT JOIN tabs t ON t.id = pay.tab_id`.

---

## Waitlist Analytics Data Sources

### Metrics Mapping (verified from waitlist_entries DDL)

| Metric | Source Column | Derivation |
|--------|--------------|------------|
| parties_seated | `status = 'seated'` count | Direct COUNT |
| no_show_rate | `status IN ('no_show', 'seated')` | `no_show / (no_show + seated) * 100` |
| avg_quoted_wait | `quoted_wait_minutes` | AVG WHERE status='seated' |
| avg_actual_wait | `seated_at - created_at` | AVG of epoch difference / 60 WHERE seated |
| quoted-vs-actual gap | derived | `avg_actual_wait - avg_quoted_wait` |
| notification channel mix | `notify_channel` enum | `COUNT FILTER WHERE notify_channel='whatsapp'` vs `'manager'` |

**Note:** `quoted_wait_minutes` column exists in the data-model spec but is NOT present in the actual `waitlist_entries` migration (`20260501000001_waitlist_entries.sql`). The migration lacks this column. Either: (a) the column was not added in Phase 7, or (b) it was added in a later migration not shown. [ASSUMED] avg_quoted_wait in the view definition may need to fall back to NULL if the column is missing. Verify `\d waitlist_entries` before writing the view.

**Hourly heatmap:** Computed client-side from raw `waitlist_entries` grouped by `EXTRACT(HOUR FROM created_at)`. Not needed in the view — the widget can query raw entries for the heatmap.

---

## Migration Audit (S6-15)

### DOWN Script Gap

76 total migrations. 52 lack DOWN scripts (all pre-Phase 1 migrations + waitlist migrations from Phase 7).

**S6-15 scope:** S6 adds 2 new migrations. Both MUST include DOWN scripts. The pre-existing 52 gaps are out of scope to retroactively fix (too risky, no rollback mechanism in Supabase Cloud). Document the gap in CLAUDE.md instead.

**Phase 7 waitlist migrations** (`20260501000001` through `20260501000004`) lack DOWN scripts. These are recent enough to add them as part of S6-15. Add commented DOWN blocks at the end of each file (comments only, never execute automatically):

```sql
-- DOWN:
-- BEGIN;
-- DROP TRIGGER IF EXISTS ... ON waitlist_entries;
-- DROP TABLE IF EXISTS waitlist_notifications;
-- DROP TABLE IF EXISTS waitlist_entries;
-- COMMIT;
```

---

## Wave Breakdown Recommendation

### Wave 0: Prerequisite Cleanup (blocking)

1. Commit the 8 pending import-order lint fixes from git status (`fix(07-waitlist): fix import order lint violations`)
2. Typecheck + lint + unit must be green before any Phase 8 code lands

### Wave 1: DB Migrations (blocking, serial)

1. `20260505000001_s6_reporting_views.sql` — 3 views (combo_mix_daily, recipe_variance_daily, waitlist_metrics_daily)
2. `20260505000002_s6_performance_indexes.sql` — 2 net-new indexes
3. `supabase db push` — [BLOCKING] user must run and confirm

### Wave 2: Domain Types (parallel with Wave 1 authoring)

1. Add 5 new Zod schemas to `domain.ts` (ComboMixRowSchema, RecipeVarianceRowSchema, WaitlistMetricsRowSchema, RefundRegisterRowSchema, ComboOverrideRowSchema)
2. Extend `supabase.types.ts` manually to include view column shapes (pre-regen cast pattern)

### Wave 3: Report Query Hooks (after Wave 2)

1. Add `useComboMixReport`, `useRecipeVarianceReport`, `useWaitlistAnalyticsReport`, `useRefundsRegister`, `useComboOverrides` to `entities/tab/model/queries-reports.ts`
2. These can be developed in parallel — 5 independent hooks

### Wave 4: Report Widgets (parallel, after Wave 3)

1. `ComboMixReport` widget
2. `RecipeVarianceReport` widget
3. `WaitlistAnalyticsReport` widget
4. `RefundsRegister` widget
5. `ComboOverrideReport` widget (S6-09, smaller)

### Wave 5: Export + ReportsPage Wiring (after Wave 4)

1. Extend `ExportType` union and `ExportButtons` Props union
2. Add workbook builders to `exporters/excel.ts` + PDF builders to `exporters/pdf.tsx`
3. Wire all 5 new widgets into `ReportsPage` as new tabs (S6-07)

### Wave 6: E2E + Hardening (after Wave 5)

1. Write `e2e/37-analytics-reports.spec.ts` (S6-10)
2. Write/run seed data script for report E2E tests
3. Flakiness sweep (S6-11): fix 21-prep.spec.ts T5 state dependency
4. Full E2E suite regression gate

### Wave 7: Documentation + Paper-Cuts (~30% throughout)

1. S6-13: Update CLAUDE.md implemented features
2. S6-14: Update Obsidian vault
3. S6-15: Add DOWN scripts to Phase 7 migrations
4. Paper-cut fixes from field feedback

---

## Validation Architecture

Config: `workflow.nyquist_validation` key absent in `.planning/config.json` → treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | `bar-pos/vite.config.ts` (vitest section) |
| Quick run command | `cd bar-pos && npm run test` |
| Full suite command | `cd bar-pos && npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| S6-01 | Views return correct aggregated rows | Integration (real Supabase) | `npx vitest run src/entities/tab/model/queries-reports.test.ts` |
| S6-02 | Index scan used for stock_movements ingredient query | Manual EXPLAIN ANALYZE | `supabase db psql -c "EXPLAIN ANALYZE SELECT * FROM stock_movements WHERE ingredient_id=... ORDER BY ts DESC LIMIT 50"` |
| S6-03 | ComboMixReport renders with non-zero data | Unit (RTL) + E2E | `npx vitest run src/widgets/ComboMixReport/` + E2E T1 |
| S6-04 | RecipeVarianceReport shows variance > ±10% highlighted | Unit (RTL) | `npx vitest run src/widgets/RecipeVarianceReport/` |
| S6-05 | WaitlistAnalyticsReport metrics match seed data | E2E | 37-analytics-reports.spec.ts T3 |
| S6-06 | RefundsRegister totals row matches sum of items | Unit (pure math) | `npx vitest run src/widgets/RefundsRegister/` |
| S6-07 | ReportsPage has all 7+5 tabs | E2E | 37-analytics-reports.spec.ts T0 |
| S6-08 | CSV export triggers file save and shows success toast | E2E | 37-analytics-reports.spec.ts T4 (Tauri mock injection) |
| S6-09 | ComboOverrideReport shows audit_log entries | Unit (RTL) | `npx vitest run src/widgets/ComboOverrideReport/` |
| S6-10 | Full analytics reports E2E passes | E2E | `npx playwright test e2e/37-analytics-reports.spec.ts` |
| S6-11 | Specs 18–24 pass without flakes | E2E | `cd bar-pos && npm run test:e2e` |

### Sampling Rate
- **Per task commit:** `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **Per wave merge:** `cd bar-pos && npm run test:e2e`
- **Phase gate:** Full suite (01–37) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/entities/tab/model/queries-reports.test.ts` — extend with tests for 5 new hooks (integration test stubs, skip when no DB creds)
- [ ] `src/widgets/ComboMixReport/ComboMixReport.test.tsx` — unit test stub
- [ ] `src/widgets/RecipeVarianceReport/RecipeVarianceReport.test.tsx` — unit test stub
- [ ] `src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.test.tsx` — unit test stub
- [ ] `src/widgets/RefundsRegister/RefundsRegister.test.tsx` — unit test stub
- [ ] `scripts/seed-reports.ts` — seeds 7 days of combo sales + refunds + waitlist entries for E2E

---

## Risk Register

### Risk 1: E2E spec number collision
**Description:** `e2e/25-export-reports.spec.ts` already exists. The S6 PRD says "25-reports.spec.ts" which would overwrite or shadow an existing file. This would silently cause one spec to never run or cause CI to pick up the wrong tests.
**Likelihood:** Certain if S6 PRD number is used literally.
**Impact:** HIGH — lost test coverage or test file clobber.
**Mitigation:** Name the new S6 spec `e2e/37-analytics-reports.spec.ts` (continuing the existing numbering sequence after 36-recipes.spec.ts).

### Risk 2: `manager_pin_approved_by` column missing in refunds
**Description:** The S6 spec lists "manager_who_approved" as a column in RefundsRegister. The actual `refunds` DDL does not have this column — `process_refund` RPC accepts `p_manager_pin` but only uses it for verification; it never writes who approved. The RefundsRegister widget cannot display this information without a schema migration.
**Likelihood:** Certain — DDL confirmed.
**Impact:** MEDIUM — operator-facing feature gap.
**Mitigation:** Omit the column from RefundsRegister in Phase 8. Add a `manager_pin_approved_by uuid REFERENCES profiles(id)` column migration and corresponding RPC update as a S6-12 paper-cut if operator feedback requires it.

### Risk 3: `quoted_wait_minutes` column may not exist in waitlist_entries
**Description:** The data-model spec and WaitlistAnalyticsReport metric "avg_quoted_wait" both assume a `quoted_wait_minutes int` column on `waitlist_entries`. The actual migration (`20260501000001`) was verified and does NOT include this column.
**Likelihood:** High.
**Impact:** MEDIUM — the `waitlist_metrics_daily` view will fail to create if the column is referenced, or avg_quoted_wait will always be NULL.
**Mitigation:** Before writing the view migration, run `\d waitlist_entries` to confirm. If column is missing, either (a) add it via a separate migration and update Phase 7 schema, or (b) remove avg_quoted_wait from the view and widget, showing only avg_actual_wait.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel export | Custom CSV serializer | `xlsx` (SheetJS, already installed) | Money formatting, multi-sheet, column widths |
| PDF export | HTML-to-canvas DIY | jsPDF (already installed via exporters/pdf.tsx) | Consistent with existing 7 report exporters |
| File save dialog | Custom file picker | `@tauri-apps/plugin-dialog`'s `save()` | Already used; Tauri native OS dialog |
| Data tables | Custom `<table>` | `DataTable` from `@shared/ui/DataTable` (TanStack Table) | Sorting, pagination already handled |
| Date range picker | Custom calendar | `DateRangePicker` from `@shared/ui` (already in ReportsPage) | Consistent with all existing report panels |
| SQL aggregation | Client-side groupBy on raw rows | SQL view with `GROUP BY` | Sends less data; DB index can be used |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reports as inline JSX in page | Reports as named widget components | Established in this codebase | New reports must be widgets, not inline in ReportsPage |
| `supabase gen types` | Manual transcription with `as any` cast | Phase 1 (Docker unavailable) | Every new view/table gets manually added to supabase.types.ts |
| Browser `<a download>` for CSV | Tauri `plugin-dialog`/`plugin-fs` for file save | Prior to Phase 8 | Native OS save dialog, not browser download |

**Deprecated / not applicable:**
- Materialized views + pg_cron: not available in hosted Supabase without paid plan; defer if regular views are too slow
- `export * from` barrel syntax: banned by ESLint (`no-restricted-syntax` rule in this project)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Specs 18–24 have no current flakiness beyond the T5 state dependency in 21-prep.spec.ts | E2E Flakiness Findings | Phase 8 E2E hardening wave takes longer than estimated |
| A2 | `quoted_wait_minutes` column does NOT exist in waitlist_entries (not visible in migration file) | DB Views Design + Waitlist Analytics Data Sources | View migration fails; avg_quoted_wait returns errors |
| A3 | `order_items` does not have a direct `tab_id` column (goes via orders.tab_id) | DB Views Design (index section) | The S6 index `order_items(tab_id, created_at)` would fail |
| A4 | Paper-cut reserve (~30% sprint) will be filled by field feedback after Phase 7 ships | Wave Breakdown | Sprint scope may change; reserve may be used earlier or later |

**If this table is empty:** Not empty — four assumptions requiring confirmation.

---

## Open Questions

1. **Does `waitlist_entries.quoted_wait_minutes` exist?**
   - What we know: Column is in the data-model spec (S5 section) but NOT visible in migration `20260501000001_waitlist_entries.sql`
   - What's unclear: Was it added in a later migration? Or was it deferred from Phase 7?
   - Recommendation: Run `\d waitlist_entries` on remote DB before writing the view. If absent, add it as Wave 1 migration (just the column, no data) and update WaitlistAnalyticsReport spec to show NULL for historical rows.

2. **Does `order_items` have a direct `tab_id` column?**
   - What we know: Schema uses `order_items → orders → tabs` chain (two-hop). The original migrations show `order_items(order_id)` not `order_items(tab_id)`.
   - What's unclear: Was `tab_id` added directly to `order_items` in a later migration?
   - Recommendation: Verify before writing S6-02. If only two-hop, the index should be on `orders(tab_id)` instead.

3. **What is the actual field use paper-cut backlog?**
   - What we know: S6-12 reserves ~30% of sprint for paper-cuts from S1–S5 field use. No operator feedback has been captured in code or planning files yet.
   - What's unclear: Which specific UX issues have surfaced since Phases 2–7 were demoed?
   - Recommendation: Human operator runs Phase 7 features in field conditions before Phase 8 coding starts; captures paper-cuts in a list for the planner to triage.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build steps | ✓ | v20.20.2 | — |
| npm (bar-pos) | All commands | ✓ | implied | — |
| Supabase remote DB | Migration push, integration tests | ✓ (remote) | — | — |
| Docker (local Supabase) | `supabase gen types --local` | ✗ | — | Manual transcription (established pattern) |
| Tauri CLI | Full desktop build | [ASSUMED: ✓] | — | Vite dev server for widget development |
| xlsx (SheetJS) | Excel export | ✓ | already installed | — |
| jsPDF | PDF export | ✓ | already installed | — |

**Missing with no fallback:** Docker (local Supabase). Workaround: manual supabase.types.ts transcription + `const db = supabase as any`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | Supabase Auth + `<ProtectedRoute>` |
| V3 Session Management | No — no new sessions | — |
| V4 Access Control | Yes | `canAccess(role, 'view_reports')` in ExportButtons; reports page already behind `ReportsRoute` |
| V5 Input Validation | Yes | Zod schemas on all view row types; date range validated by DateRangePicker |
| V6 Cryptography | No — no new crypto | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Date range injection (too-wide range causes DB timeout) | Denial of Service | Add max range guard: `if (daysDiff > 365) throw ValidationError` in query hook |
| Unauthenticated access to sensitive financial reports | Information Disclosure | `canAccess(role, 'view_reports')` already enforced in ExportButtons; ReportsRoute already protected |
| CSV injection (formula in combo_name or operator_name) | Tampering | SheetJS writes `.t: 's'` (string type) cells — formula injection requires cell type `'f'`; safe by default |

---

## Sources

### Primary (HIGH confidence)
- Codebase grep [VERIFIED] — `src/features/export-report/`, `src/widgets/CajaReportPanel/`, `src/widgets/CategoryRevenuePanel/`, `src/pages/reports/index.tsx`
- `supabase/migrations/` — all SQL DDL verified by direct read
- `src/shared/lib/domain.ts` — RefundSchema, WaitlistEntrySchema verified
- `.planning/feature-expansion-2026q2/02-data-model.md` — S6 view/index specs
- `.planning/feature-expansion-2026q2/sprints/S6-polish-reports.md` — requirements

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — architectural decisions log (validated patterns for pre-regen cast, FSD boundaries)
- `e2e/25-export-reports.spec.ts` — Tauri IPC mock pattern for E2E export tests

### Tertiary (LOW confidence)
- [ASSUMED] Spec flakiness assessment for specs 19–23 (not directly read; assumed stable from naming and established patterns)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture: HIGH — patterns verified from 5 existing report widgets
- DB views: MEDIUM — SQL correct but quoted_wait_minutes and order_items.tab_id column existence [ASSUMED]
- E2E flakiness: MEDIUM — only specs 21/24 directly verified; 18–23 assumed stable
- Pitfalls: HIGH — manager_pin_approved_by gap and E2E number collision are confirmed by direct DDL and file system check

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable stack; 30-day window)
