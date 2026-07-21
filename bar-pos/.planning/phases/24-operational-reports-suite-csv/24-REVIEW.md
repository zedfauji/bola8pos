---
phase: 24-operational-reports-suite-csv
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - e2e/07-reports.spec.ts
  - e2e/16-table-status.spec.ts
  - src/entities/tab/model/deletions-post-report.integration.test.ts
  - src/entities/tab/model/deletions-pre-report.integration.test.ts
  - src/entities/tab/model/modifier-popularity-report.integration.test.ts
  - src/entities/tab/model/payment-methods-report.integration.test.ts
  - src/entities/tab/model/queries-reports.test.ts
  - src/entities/tab/model/queries-reports.ts
  - src/features/export-report/model/useExportReport.ts
  - src/features/export-report/ui/ExportButtons.test.tsx
  - src/features/export-report/ui/ExportButtons.tsx
  - src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx
  - src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx
  - src/features/remove-tab-item/useRemoveTabItem.test.ts
  - src/features/remove-tab-item/useRemoveTabItem.ts
  - src/pages/reports/index.tsx
  - src/shared/lib/__tests__/audit-actions.test.ts
  - src/shared/lib/audit-actions.ts
  - src/shared/lib/domain.test.ts
  - src/shared/lib/domain.ts
  - src/shared/lib/exporters/csv.test.ts
  - src/shared/lib/exporters/csv.ts
  - src/shared/lib/exporters/excel.test.ts
  - src/shared/lib/exporters/excel.ts
  - src/shared/lib/exporters/pdf.tsx
  - src/shared/lib/i18n/locales/en-US/featMgmt.json
  - src/shared/lib/i18n/locales/en-US/featOrders.json
  - src/shared/lib/i18n/locales/en-US/pages.json
  - src/shared/lib/i18n/locales/en-US/receipt.json
  - src/shared/lib/i18n/locales/en-US/wAdmin.json
  - src/shared/lib/i18n/locales/es-MX/featMgmt.json
  - src/shared/lib/i18n/locales/es-MX/featOrders.json
  - src/shared/lib/i18n/locales/es-MX/pages.json
  - src/shared/lib/i18n/locales/es-MX/receipt.json
  - src/shared/lib/i18n/locales/es-MX/wAdmin.json
  - src/shared/lib/reportHelpers.test.ts
  - src/shared/lib/result.ts
  - src/shared/lib/supabase.types.ts
  - src/shared/ui/index.ts
  - src/widgets/DeletionsPostCloseReport/DeletionsPostCloseReport.tsx
  - src/widgets/DeletionsPostCloseReport/index.ts
  - src/widgets/DeletionsPreSendPanel/DeletionsPreSendPanel.tsx
  - src/widgets/DeletionsPreSendPanel/index.ts
  - src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.test.tsx
  - src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx
  - src/widgets/ModifierPopularityReport/ModifierPopularityReport.tsx
  - src/widgets/ModifierPopularityReport/index.ts
  - src/widgets/PaymentMethodsReport/PaymentMethodsReport.tsx
  - src/widgets/PaymentMethodsReport/index.ts
  - src/widgets/TipBucketDistributionPanel/TipBucketDistributionPanel.tsx
  - supabase/migrations/20260721000002_peak_hours_and_voids_rpc.sql
  - supabase/migrations/20260721000003_modifier_popularity_rpc.sql
  - supabase/migrations/20260721000004_payment_methods_rpc.sql
  - supabase/migrations/20260721000005_remove_tab_item_rpc.sql
  - supabase/migrations/20260721000006_deletions_reports_rpc.sql
  - supabase/migrations/20260721000007_fix_peak_hours_timezone.sql
  - supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql
findings:
  critical: 1
  warning: 8
  info: 2
  total: 11
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 57 (listed above; some paths point to pre-existing files touched by this phase)
**Status:** issues_found

## Summary

Reviewed the operational-reports-suite + CSV export phase: 4 new bounded report RPCs (peak-hours,
voids, modifier-popularity, payment-methods, deletions-pre, deletions-post), the `remove_tab_item`
audited RPC + its client feature, the new generic CSV serializer, and the 4 new report widgets
plumbed into `ReportsPage`. The core aggregation logic (pure helpers in `queries-reports.ts`) is
well-tested with property-based tests and reads correctly. The most serious finding is a genuine
CSV/formula-injection vulnerability in the brand-new `rowsToCsv` serializer, which every report
export (including reason/staff-name free-text fields) now flows through unsanitized. Several other
findings concern silent error-swallowing in the new report widgets, an exported-CSV/on-screen-table
column mismatch that drops the row identifier for 3 of the 4 new report types, and a couple of
narrow SQL edge cases in the new RPCs.

## Critical Issues

### CR-01: CSV export is vulnerable to formula/CSV injection (no sanitization of leading `=`/`+`/`-`/`@`)

**File:** `src/shared/lib/exporters/csv.ts:7-16`
**Issue:** `rowsToCsv` passes every cell value straight to `XLSX.utils.json_to_sheet` /
`sheet_to_csv` with zero sanitization. Several of the newly-exportable report row types carry
free-text fields that ordinary bartender/manager accounts control directly: `DeletionsPreRow.reason`
and `DeletionsPostRow.reason` (typed into `RemoveTabItemDialog`'s "Reason" input with **no
character restriction**, see WR-06 below), `VoidRefundRow.reason`, `ComboOverrideRow.reason`, etc.
If a value begins with `=`, `+`, `-`, or `@` (e.g. a "reason" of `=cmd|'/c calc'!A0` or
`=HYPERLINK("http://evil","click")`), the generated CSV/XLSX cell is a live formula. When a manager
or admin opens the exported file in Excel/Sheets, that formula can execute (older Excel versions
auto-execute; newer ones show a bypassable warning), enabling data exfiltration or local code
execution on the reviewing machine — a classic CWE-1236 CSV injection. This is new code introduced
by this phase (`git log` shows `csv.ts` was added in this phase's `24-02` commit), so every one of
the 21 CSV export types now routes through the same unguarded path.
**Fix:** Prefix any cell value beginning with `=`, `+`, `-`, `@`, tab, or CR with a leading single
quote (or a neutral character) before handing rows to `XLSX.utils.json_to_sheet`, e.g.:
```typescript
function sanitizeCsvCell(v: unknown): unknown {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) {
    return `'${v}`;
  }
  return v;
}

export function rowsToCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  const mapped = rows.map(row =>
    Object.fromEntries(columns.map(c => [c.header, sanitizeCsvCell(row[c.key])]))
  );
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map(c => c.header) });
  return XLSX.utils.sheet_to_csv(ws);
}
```

## Warnings

### WR-01: `remove_tab_item`'s TAB_NOT_OPEN guard is defeated when the tab lookup returns no row (NULL comparison)

**File:** `supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql:46-52` (same
logic already present in `20260721000005_remove_tab_item_rpc.sql:56-62`)
**Issue:**
```sql
SELECT t.status INTO v_tab_status
FROM tabs t JOIN orders o ON o.id = v_order_id WHERE t.id = o.tab_id;

IF v_tab_status <> 'open' THEN
  RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_OPEN');
END IF;
```
`v_tab_status` is declared but never given a default; if the join finds zero rows (e.g. the
order's `tab_id` doesn't resolve, or referential integrity is ever relaxed), `v_tab_status` stays
`NULL`. In PL/pgSQL, `NULL <> 'open'` evaluates to `NULL`, and `IF NULL THEN ... END IF` takes the
false branch — so the "defense-in-depth" guard the migration's own comment calls out is silently
bypassed exactly in the case it exists to protect against. Not reachable today under the current FK
constraints (order_items.order_id → orders.id → tabs.id are all NOT NULL FKs), but it's a latent
correctness bug in a guard whose whole purpose is defense-in-depth against exactly this kind of
lookup failure.
**Fix:** Add an explicit not-found branch:
```sql
IF v_tab_status IS NULL THEN
  RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
END IF;
IF v_tab_status <> 'open' THEN
  RETURN jsonb_build_object('ok', false, 'code', 'TAB_NOT_OPEN');
END IF;
```

### WR-02: `remove_tab_item` never checks the parent order's status, only the tab's

**File:** `supabase/migrations/20260721000008_fix_remove_tab_item_deplete_cast.sql:34-52`
**Issue:** The RPC's only guard is `tabs.status = 'open'`. It does not check `orders.status`, so an
item can be removed from an order that is already `'voided'` (re-running the "void if empty"
branch redundantly) or `'served'` (already sent to the kitchen/bar and potentially already
prepared/consumed) as long as the tab itself is still open. There's no test covering removal from a
non-`pending` order, and the E2E/unit suites only ever seed `status: 'pending'` orders.
**Fix:** Add `AND o.status = 'pending'` (or equivalent) to the guard, returning a dedicated error
code (e.g. `ORDER_NOT_PENDING`) otherwise, mirroring the existing `TAB_NOT_OPEN` pattern.

### WR-03: Payment-methods CSV export omits `cajaSessionId`, making per-session rows indistinguishable

**File:** `src/features/export-report/model/useExportReport.ts:327-333`
**Issue:**
```typescript
const PAYMENT_METHODS_CSV_COLUMNS: CsvColumn<PaymentMethodRow>[] = [
  { key: 'method', header: 'Method' },
  { key: 'legCount', header: 'Leg Count' },
  { key: 'grossAmount', header: 'Gross Amount' },
  { key: 'tipAmount', header: 'Tip Amount' },
  { key: 'isRollup', header: 'Day Rollup' },
];
```
`cajaSessionId` is dropped. The RPC (D-08) deliberately returns one row **per caja session per
method**, plus a day-level rollup row — that's the entire point of the two-grain design documented
in `20260721000004_payment_methods_rpc.sql`. The on-screen table (`PaymentMethodsReport.tsx`) shows
a "Session" column so rows stay distinguishable, but the exported CSV for a multi-session date
range will contain several `cash` / `card` rows with different `legCount`/`grossAmount` values and
**no way to tell which caja session each one belongs to** — the export loses the exact information
the report's reconciliation use case depends on.
**Fix:** Add `{ key: 'cajaSessionId', header: 'Caja Session ID' }` to
`PAYMENT_METHODS_CSV_COLUMNS`.

### WR-04: Deletions-pre / deletions-post CSV exports drop the on-screen identifier column

**File:** `src/features/export-report/model/useExportReport.ts:302-319`
**Issue:** `DELETIONS_PRE_CSV_COLUMNS` omits `orderId` (shown on-screen in
`DeletionsPreSendPanel`'s "Order ID" column) and `DELETIONS_POST_CSV_COLUMNS` omits `tabId` (shown
on-screen in `DeletionsPostCloseReport`'s "Tab ID" column). Both reports exist specifically so a
manager can trace a correction/removal back to a specific order/tab; the exported file drops the
one field that makes that traceable.
**Fix:** Add `orderId`/`tabId` columns to the respective CSV column configs, consistent with what
the on-screen `DataTable` already shows.

### WR-05: New report widgets silently render an empty state instead of an error state on query failure

**Files:**
- `src/widgets/DeletionsPreSendPanel/DeletionsPreSendPanel.tsx:59`
- `src/widgets/DeletionsPostCloseReport/DeletionsPostCloseReport.tsx:59`
- `src/widgets/ModifierPopularityReport/ModifierPopularityReport.tsx:41`
- `src/widgets/PaymentMethodsReport/PaymentMethodsReport.tsx:31`
- `src/widgets/HourlyBreakdownPanel/HourlyBreakdownPanel.tsx:64`

**Issue:** Every one of these widgets does the equivalent of:
```typescript
const rows = result?.ok ? result.data : [];
```
with no branch for `result?.ok === false` (RPC error, Zod-parse failure, network error) or
`isError`. A genuine backend failure (e.g. the RPC 500s, or a row fails
`DeletionsPreRowSchema.parse`) renders identically to "no rows in this date range" — the manager
sees "No corrections recorded" / "No modifier data" instead of any indication that the report
actually failed to load. This can mask real problems (e.g. a broken RPC after a bad deploy) as
"nothing happened in this period."
**Fix:** Check `result?.ok === false` (or `isError`) explicitly and render a distinct error state
(reusing the `loadErrorTitle`/`loadErrorDescription` pattern already used in
`auditLogTable`/`editHistoryTable`'s i18n keys) instead of falling through to the empty-rows path.

### WR-06: `remove_tab_item`'s reason has no length bound, unlike every other `reason` field in the domain

**Files:** `src/features/remove-tab-item/ui/RemoveTabItemDialog.tsx:97-105`,
`src/shared/lib/domain.ts:1180-1199` (`DeletionsPreRowSchema.reason`, `DeletionsPostRowSchema.reason`)
**Issue:** The `Input` for the removal reason has no `maxLength`, and both new Zod row schemas type
`reason` as a bare `z.string()`. Every other `reason` field in `domain.ts` is bounded (e.g.
`TabTransferSchema.reason` max 500, `PoolTableTransferSchema.reason` max 500). An unbounded
free-text value here is persisted indefinitely inside `audit_logs.after` (jsonb) and now also flows
into CSV exports (compounding CR-01).
**Fix:** Add `maxLength={500}` to the `Input` and constrain the Zod schemas to
`z.string().max(500)`, consistent with the rest of the domain.

### WR-07: `get_deletions_post_report`'s `fieldsChanged` only diffs keys present in `before`

**File:** `supabase/migrations/20260721000006_deletions_reports_rpc.sql:72-77`
**Issue:**
```sql
SELECT array_agg(key)
FROM jsonb_object_keys(al.before) AS key
WHERE key NOT IN ('updated_at', 'version', 'items')
  AND al.before->key IS DISTINCT FROM al.after->key
```
This only iterates over `before`'s top-level keys. If `edit_paid_tab` ever adds a field that didn't
exist on the tab row before the edit (present only in `after`, e.g. a newly-set `discount_amount`
on a tab that previously had none), that field change is silently excluded from `fieldsChanged` —
the report would show an empty/incomplete "Fields Changed" cell for an edit that did in fact change
something.
**Fix:** Union the key sets from both `before` and `after` before diffing, e.g.
`jsonb_object_keys(al.before) UNION jsonb_object_keys(al.after)`.

### WR-08: New report RPCs are `GRANT EXECUTE ... TO authenticated` with no in-function role check

**Files:** all 6 new RPCs — `get_peak_hours_report`/`get_voids_report`
(`20260721000002_peak_hours_and_voids_rpc.sql`), `get_modifier_popularity_report`
(`20260721000003_modifier_popularity_rpc.sql`), `get_payment_methods_report`
(`20260721000004_payment_methods_rpc.sql`), `get_deletions_pre_report`/`get_deletions_post_report`
(`20260721000006_deletions_reports_rpc.sql`)
**Issue:** All are `SECURITY DEFINER` and granted to the blanket `authenticated` role with no
role/permission check inside the function body. Client-side, access to the Reports page/tabs and
the `ExportButtons` component is gated by `canAccess(role, 'view_reports')`, but that's a UI-layer
check only — any authenticated bartender-level session can call these RPCs directly (e.g. via the
PostgREST endpoint or browser console) and read full revenue/payment/correction/audit data the UI
otherwise reserves for managers/admins. This mirrors the pre-existing `get_caja_report` convention
(explicitly copied per the migration's own header comment), so it's a known accepted pattern in this
codebase rather than a new regression — but this phase doubles the number of financially-sensitive
RPCs exposed this way, worth a deliberate look rather than further silent propagation.
**Fix:** Either add an explicit role check inside each function (e.g. via a `profiles.role` lookup
against `auth.uid()`) or, if the acceptance is intentional, document it once centrally (e.g. next to
the `xlsx-cve-risk-accept.md` decision doc) instead of repeating the risk implicitly per-migration.

## Info

### IN-01: Dead i18n key `removeTabItem.reasonRequired`

**File:** `src/shared/lib/i18n/locales/en-US/featOrders.json:92`, `src/shared/lib/i18n/locales/es-MX/featOrders.json:92`
**Issue:** Both locale files define `removeTabItem.reasonRequired` ("Reason is required" /
"El motivo es obligatorio"), but `RemoveTabItemDialog.tsx` never renders it — it disables the
Confirm button instead of showing a validation message, so the key is unused.
**Fix:** Either wire the key into the dialog (e.g. as helper text under the Input when
`reason.trim().length === 0` and the field has been touched) or remove the unused key from both
locale files.

### IN-02: jsonb→uuid casts in new report RPCs have no failure isolation

**File:** `supabase/migrations/20260721000006_deletions_reports_rpc.sql:40,47`
**Issue:** `(al.before->>'order_id')::uuid` and `(al.before->>'product_id')::uuid` will raise a
runtime cast exception (aborting the entire `get_deletions_pre_report` call for the whole date
range, not just the offending row) if any `audit_logs` row's `before` payload ever contains a
non-UUID string in that key. Under the current write path (`remove_tab_item`'s `to_jsonb(oi.*)`)
this can't happen today, but there's no per-row isolation if the audit payload shape ever drifts.
**Fix:** Low priority given the current single writer; if this table gains other writers, consider
wrapping the cast in a `CASE WHEN ... ~ uuid_regex THEN ...::uuid ELSE NULL END` guard.

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
