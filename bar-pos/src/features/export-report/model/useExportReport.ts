import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  CajaReport,
  CategoryRevenueRow,
  ComboMixRow,
  ComboOverrideRow,
  DeletionsPostRow,
  DeletionsPreRow,
  HourlyRow,
  ModifierPopularityRow,
  PaymentMethodRow,
  ProductSalesRow,
  RecipeVarianceRow,
  RefundRegisterRow,
  StaffMetric,
  StaffTips,
  VoidRefundRow,
  WaitlistMetricsRow,
} from '@shared/lib/domain';
import { csvToBytes, rowsToCsv, type CsvColumn } from '@shared/lib/exporters/csv';
import {
  cajaReportToWorkbook,
  comboMixToWorkbook,
  comboOverridesToWorkbook,
  categoryRevenueToWorkbook,
  hourlySalesToWorkbook,
  productSalesToWorkbook,
  recipeVarianceToWorkbook,
  refundsRegisterToWorkbook,
  staffMetricsToWorkbook,
  staffTipsToWorkbook,
  voidRefundToWorkbook,
  waitlistMetricsToWorkbook,
  workbookToBytes,
} from '@shared/lib/exporters/excel';
import {
  cajaReportToPdfBytes,
  comboMixToPdfBytes,
  categoryRevenueToPdfBytes,
  hourlySalesToPdfBytes,
  productSalesToPdfBytes,
  recipeVarianceToPdfBytes,
  refundsRegisterToPdfBytes,
  staffMetricsToPdfBytes,
  staffTipsToPdfBytes,
  voidRefundToPdfBytes,
  waitlistMetricsToPdfBytes,
} from '@shared/lib/exporters/pdf.tsx';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { ok, err, exportCancelledError, exportFailedError, type Result } from '@shared/lib/result';

export type ExportType =
  | 'caja-excel'
  | 'caja-pdf'
  | 'caja-csv'
  | 'products-excel'
  | 'products-pdf'
  | 'products-csv'
  | 'hourly-excel'
  | 'hourly-pdf'
  | 'hourly-csv'
  | 'voids-excel'
  | 'voids-pdf'
  | 'voids-csv'
  | 'categories-excel'
  | 'categories-pdf'
  | 'categories-csv'
  | 'staff-excel'
  | 'staff-pdf'
  | 'staff-csv'
  | 'tips-excel'
  | 'tips-pdf'
  | 'tips-csv'
  | 'combo-mix-excel'
  | 'combo-mix-pdf'
  | 'combo-mix-csv'
  | 'recipe-variance-excel'
  | 'recipe-variance-pdf'
  | 'recipe-variance-csv'
  | 'waitlist-analytics-excel'
  | 'waitlist-analytics-pdf'
  | 'waitlist-analytics-csv'
  | 'refunds-register-excel'
  | 'refunds-register-pdf'
  | 'refunds-register-csv'
  | 'combo-overrides-excel'
  | 'combo-overrides-csv'
  // Net-new report types (Plans 08/09) — CSV-only for now; Excel/PDF stay optional
  // per-report per D-11/D-12, added later if a widget plan wants them.
  | 'tip-split-csv'
  | 'deletions-pre-csv'
  | 'deletions-post-csv'
  | 'modifier-popularity-csv'
  | 'payment-methods-csv';

type ProductsContext = {
  rows: ProductSalesRow[];
  dateRange: { from: Date; to: Date };
};

type VoidsContext = {
  rows: VoidRefundRow[];
  dateRange: { from: Date; to: Date };
};

type CategoriesContext = {
  rows: CategoryRevenueRow[];
  dateRange: { from: Date; to: Date };
};

type StaffContext = {
  rows: StaffMetric[];
  dateRange: { from: Date; to: Date };
};

type TipsContext = {
  rows: StaffTips[];
  dateRange: { from: Date; to: Date };
};

type ComboMixContext = {
  rows: ComboMixRow[];
  dateRange: { from: Date; to: Date };
};

type RecipeVarianceContext = {
  rows: RecipeVarianceRow[];
  dateRange: { from: Date; to: Date };
};

type WaitlistMetricsContext = {
  rows: WaitlistMetricsRow[];
  dateRange: { from: Date; to: Date };
};

type RefundRegisterContext = {
  rows: RefundRegisterRow[];
  dateRange: { from: Date; to: Date };
};

type ComboOverridesContext = {
  rows: ComboOverrideRow[];
  dateRange: { from: Date; to: Date };
};

type DeletionsPreContext = {
  rows: DeletionsPreRow[];
  dateRange: { from: Date; to: Date };
};

type DeletionsPostContext = {
  rows: DeletionsPostRow[];
  dateRange: { from: Date; to: Date };
};

type ModifierPopularityContext = {
  rows: ModifierPopularityRow[];
  dateRange: { from: Date; to: Date };
};

type PaymentMethodsContext = {
  rows: PaymentMethodRow[];
  dateRange: { from: Date; to: Date };
};

// Tip-split has no dateRange — it's a per-caja-session snapshot, selected by
// TipBucketDistributionPanel via a session picker, not a date range.
export type TipSplitRow = { bucket: string; pct: number; amount: number };

type TipSplitContext = {
  rows: TipSplitRow[];
};

// ============================================================================
// CSV column configs — one small const per report type, co-located here
// rather than in a shared registry (D-11: no 2nd consumer of any column set).
// ============================================================================

const CAJA_SUMMARY_CSV_COLUMNS: CsvColumn<{ metric: string; value: number | string }>[] = [
  { key: 'metric', header: 'Metric' },
  { key: 'value', header: 'Value' },
];

type CajaSummaryCsvRow = { metric: string; value: number | string };

function cajaReportToSummaryRows(report: CajaReport): CajaSummaryCsvRow[] {
  // Uppercase local name is a deliberate i18next/no-literal-string escape hatch
  // (the plugin exempts ALL-CAPS variable declarators, same as the module-level
  // *_CSV_COLUMNS consts above) — these are exported-file column labels, not UI copy.
  const ROWS: CajaSummaryCsvRow[] = [
    { metric: 'Total Revenue', value: report.summary.totalRevenue },
    { metric: 'Cash Sales', value: report.summary.cashSales },
    { metric: 'Card Sales', value: report.summary.cardSales },
    { metric: 'Rappi Sales', value: report.summary.rappiSales },
    { metric: 'Order Count', value: report.summary.orderCount },
    { metric: 'Tab Count', value: report.summary.tabCount },
    { metric: 'Total Expenses', value: report.summary.totalExpenses },
    { metric: 'Total Income', value: report.summary.totalIncome },
    { metric: 'Net Balance', value: report.summary.netBalance },
  ];
  return ROWS;
}

const PRODUCTS_CSV_COLUMNS: CsvColumn<ProductSalesRow>[] = [
  { key: 'productName', header: 'Product Name' },
  { key: 'categoryName', header: 'Category' },
  { key: 'units', header: 'Units Sold' },
  { key: 'revenue', header: 'Revenue' },
  { key: 'pctTotal', header: '% of Total' },
];

const HOURLY_CSV_COLUMNS: CsvColumn<HourlyRow>[] = [
  { key: 'hour', header: 'Hour' },
  { key: 'dayOfWeek', header: 'Day of Week' },
  { key: 'orderCount', header: 'Orders' },
  { key: 'revenue', header: 'Revenue' },
  { key: 'isBusiest', header: 'Busiest' },
];

type VoidCsvRow = Omit<VoidRefundRow, 'voidedAt'> & { voidedAt: string };
const VOIDS_CSV_COLUMNS: CsvColumn<VoidCsvRow>[] = [
  { key: 'voidedAt', header: 'Timestamp' },
  { key: 'staffName', header: 'Staff' },
  { key: 'amount', header: 'Amount' },
  { key: 'reason', header: 'Reason' },
];

const CATEGORIES_CSV_COLUMNS: CsvColumn<CategoryRevenueRow>[] = [
  { key: 'categoryName', header: 'Category' },
  { key: 'unitsSold', header: 'Units Sold' },
  { key: 'orderCount', header: 'Orders' },
  { key: 'revenue', header: 'Revenue' },
  { key: 'pctTotal', header: '% of Total' },
];

const STAFF_CSV_COLUMNS: CsvColumn<StaffMetric>[] = [
  { key: 'staffName', header: 'Staff Member' },
  { key: 'revenue', header: 'Revenue' },
  { key: 'transactionCount', header: 'Transactions' },
  { key: 'avgCheckSize', header: 'Avg Check' },
  { key: 'voidCount', header: 'Voids' },
];

const TIPS_CSV_COLUMNS: CsvColumn<StaffTips>[] = [
  { key: 'staffName', header: 'Staff Member' },
  { key: 'totalTips', header: 'Total Tips' },
];

const COMBO_MIX_CSV_COLUMNS: CsvColumn<ComboMixRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'comboName', header: 'Combo' },
  { key: 'qtySold', header: 'Units Sold' },
  { key: 'netRevenue', header: 'Gross Revenue' },
  { key: 'avgPrice', header: 'Avg Price' },
  { key: 'overrideCount', header: 'Overrides' },
];

const RECIPE_VARIANCE_CSV_COLUMNS: CsvColumn<RecipeVarianceRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'ingredientName', header: 'Ingredient' },
  { key: 'theoreticalUsed', header: 'Theoretical Used' },
  { key: 'physicalDelta', header: 'Physical Delta' },
  { key: 'variancePct', header: 'Variance %' },
];

const WAITLIST_ANALYTICS_CSV_COLUMNS: CsvColumn<WaitlistMetricsRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'partiesSeated', header: 'Parties Seated' },
  { key: 'avgQuotedWait', header: 'Avg Quoted Wait (min)' },
  { key: 'avgActualWait', header: 'Avg Actual Wait (min)' },
  { key: 'noShowRate', header: 'No-Show Rate (%)' },
];

type RefundRegisterCsvRow = Omit<RefundRegisterRow, 'date'> & { date: string };
const REFUNDS_REGISTER_CSV_COLUMNS: CsvColumn<RefundRegisterCsvRow>[] = [
  { key: 'date', header: 'Date' },
  { key: 'operatorName', header: 'Operator' },
  { key: 'originalPaymentId', header: 'Payment ID' },
  { key: 'amount', header: 'Amount' },
  { key: 'reason', header: 'Reason' },
  { key: 'restockCount', header: 'Restock Count' },
];

type ComboOverrideCsvRow = Omit<ComboOverrideRow, 'ts'> & { ts: string };
const COMBO_OVERRIDES_CSV_COLUMNS: CsvColumn<ComboOverrideCsvRow>[] = [
  { key: 'ts', header: 'Timestamp' },
  { key: 'actorName', header: 'Actor' },
  { key: 'comboName', header: 'Combo' },
  { key: 'reason', header: 'Reason' },
];

const TIP_SPLIT_CSV_COLUMNS: CsvColumn<TipSplitRow>[] = [
  { key: 'bucket', header: 'Bucket' },
  { key: 'pct', header: 'Percent' },
  { key: 'amount', header: 'Amount' },
];

type DeletionsPreCsvRow = Omit<DeletionsPreRow, 'removedAt'> & { removedAt: string };
const DELETIONS_PRE_CSV_COLUMNS: CsvColumn<DeletionsPreCsvRow>[] = [
  { key: 'removedAt', header: 'Removed At' },
  { key: 'itemName', header: 'Item' },
  { key: 'staffName', header: 'Staff' },
  { key: 'reason', header: 'Reason' },
];

type DeletionsPostCsvRow = Omit<DeletionsPostRow, 'editedAt' | 'fieldsChanged'> & {
  editedAt: string;
  fieldsChanged: string;
};
const DELETIONS_POST_CSV_COLUMNS: CsvColumn<DeletionsPostCsvRow>[] = [
  { key: 'editedAt', header: 'Edited At' },
  { key: 'staffName', header: 'Staff' },
  { key: 'fieldsChanged', header: 'Fields Changed' },
  { key: 'reason', header: 'Reason' },
];

const MODIFIER_POPULARITY_CSV_COLUMNS: CsvColumn<ModifierPopularityRow>[] = [
  { key: 'modifierName', header: 'Modifier' },
  { key: 'attachCount', header: 'Attach Count' },
  { key: 'revenue', header: 'Revenue' },
];

const PAYMENT_METHODS_CSV_COLUMNS: CsvColumn<PaymentMethodRow>[] = [
  { key: 'method', header: 'Method' },
  { key: 'legCount', header: 'Leg Count' },
  { key: 'grossAmount', header: 'Gross Amount' },
  { key: 'tipAmount', header: 'Tip Amount' },
  { key: 'isRollup', header: 'Day Rollup' },
];

export function useExportReport() {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport(
    type: 'caja-excel' | 'caja-pdf' | 'caja-csv',
    data: CajaReport
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'products-excel' | 'products-pdf' | 'products-csv',
    data: ProductsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'hourly-excel' | 'hourly-pdf' | 'hourly-csv',
    data: HourlyRow[]
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'voids-excel' | 'voids-pdf' | 'voids-csv',
    data: VoidsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'categories-excel' | 'categories-pdf' | 'categories-csv',
    data: CategoriesContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'staff-excel' | 'staff-pdf' | 'staff-csv',
    data: StaffContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'tips-excel' | 'tips-pdf' | 'tips-csv',
    data: TipsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'combo-mix-excel' | 'combo-mix-pdf' | 'combo-mix-csv',
    data: ComboMixContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'recipe-variance-excel' | 'recipe-variance-pdf' | 'recipe-variance-csv',
    data: RecipeVarianceContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'waitlist-analytics-excel' | 'waitlist-analytics-pdf' | 'waitlist-analytics-csv',
    data: WaitlistMetricsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'refunds-register-excel' | 'refunds-register-pdf' | 'refunds-register-csv',
    data: RefundRegisterContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'combo-overrides-excel' | 'combo-overrides-csv',
    data: ComboOverridesContext
  ): Promise<Result<void>>;
  async function exportReport(type: 'tip-split-csv', data: TipSplitContext): Promise<Result<void>>;
  async function exportReport(
    type: 'deletions-pre-csv',
    data: DeletionsPreContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'deletions-post-csv',
    data: DeletionsPostContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'modifier-popularity-csv',
    data: ModifierPopularityContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'payment-methods-csv',
    data: PaymentMethodsContext
  ): Promise<Result<void>>;
  async function exportReport(type: ExportType, data: unknown): Promise<Result<void>> {
    setIsExporting(true);
    try {
      /* eslint-disable i18next/no-literal-string -- technical values: ExportType
         suffix check, file extension, ISO-date split delimiter/fallback — not UI copy */
      const isExcel = type.endsWith('-excel');
      const isCsv = type.endsWith('-csv');
      const ext = isCsv ? 'csv' : isExcel ? 'xlsx' : 'pdf';
      const dateStr = new Date().toISOString().split('T')[0] ?? 'report';
      /* eslint-enable i18next/no-literal-string */
      const mimeLabel = isCsv
        ? i18n.t('featMgmt:exportReport.csvFileLabel')
        : isExcel
          ? i18n.t('featMgmt:exportReport.excelWorkbookLabel')
          : i18n.t('featMgmt:exportReport.pdfDocumentLabel');

      let bytes: Uint8Array;

      switch (type) {
        case 'caja-excel': {
          const wb = cajaReportToWorkbook(data as CajaReport);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'caja-pdf': {
          bytes = await cajaReportToPdfBytes(data as CajaReport);
          break;
        }
        case 'products-excel': {
          const ctx = data as ProductsContext;
          const wb = productSalesToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'products-pdf': {
          const ctx = data as ProductsContext;
          bytes = await productSalesToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'hourly-excel': {
          const wb = hourlySalesToWorkbook(data as HourlyRow[]);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'hourly-pdf': {
          bytes = await hourlySalesToPdfBytes(data as HourlyRow[]);
          break;
        }
        case 'voids-excel': {
          const ctx = data as VoidsContext;
          const wb = voidRefundToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'voids-pdf': {
          const ctx = data as VoidsContext;
          bytes = await voidRefundToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'categories-excel': {
          const ctx = data as CategoriesContext;
          const wb = categoryRevenueToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'categories-pdf': {
          const ctx = data as CategoriesContext;
          bytes = await categoryRevenueToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'staff-excel': {
          const ctx = data as StaffContext;
          const wb = staffMetricsToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'staff-pdf': {
          const ctx = data as StaffContext;
          bytes = await staffMetricsToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'tips-excel': {
          const ctx = data as TipsContext;
          const wb = staffTipsToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'tips-pdf': {
          const ctx = data as TipsContext;
          bytes = await staffTipsToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'combo-mix-excel': {
          const ctx = data as ComboMixContext;
          const wb = comboMixToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'combo-mix-pdf': {
          const ctx = data as ComboMixContext;
          bytes = await comboMixToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'recipe-variance-excel': {
          const ctx = data as RecipeVarianceContext;
          const wb = recipeVarianceToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'recipe-variance-pdf': {
          const ctx = data as RecipeVarianceContext;
          bytes = await recipeVarianceToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'waitlist-analytics-excel': {
          const ctx = data as WaitlistMetricsContext;
          const wb = waitlistMetricsToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'waitlist-analytics-pdf': {
          const ctx = data as WaitlistMetricsContext;
          bytes = await waitlistMetricsToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'refunds-register-excel': {
          const ctx = data as RefundRegisterContext;
          const wb = refundsRegisterToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'refunds-register-pdf': {
          const ctx = data as RefundRegisterContext;
          bytes = await refundsRegisterToPdfBytes(ctx.rows, ctx.dateRange);
          break;
        }
        case 'combo-overrides-excel': {
          const ctx = data as ComboOverridesContext;
          const wb = comboOverridesToWorkbook(ctx.rows, ctx.dateRange);
          bytes = workbookToBytes(wb);
          break;
        }
        case 'caja-csv': {
          const rows = cajaReportToSummaryRows(data as CajaReport);
          bytes = csvToBytes(rowsToCsv(rows, CAJA_SUMMARY_CSV_COLUMNS));
          break;
        }
        case 'products-csv': {
          const ctx = data as ProductsContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, PRODUCTS_CSV_COLUMNS));
          break;
        }
        case 'hourly-csv': {
          bytes = csvToBytes(rowsToCsv(data as HourlyRow[], HOURLY_CSV_COLUMNS));
          break;
        }
        case 'voids-csv': {
          const ctx = data as VoidsContext;
          const rows = ctx.rows.map(r => ({ ...r, voidedAt: r.voidedAt.toLocaleString() }));
          bytes = csvToBytes(rowsToCsv(rows, VOIDS_CSV_COLUMNS));
          break;
        }
        case 'categories-csv': {
          const ctx = data as CategoriesContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, CATEGORIES_CSV_COLUMNS));
          break;
        }
        case 'staff-csv': {
          const ctx = data as StaffContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, STAFF_CSV_COLUMNS));
          break;
        }
        case 'tips-csv': {
          const ctx = data as TipsContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, TIPS_CSV_COLUMNS));
          break;
        }
        case 'combo-mix-csv': {
          const ctx = data as ComboMixContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, COMBO_MIX_CSV_COLUMNS));
          break;
        }
        case 'recipe-variance-csv': {
          const ctx = data as RecipeVarianceContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, RECIPE_VARIANCE_CSV_COLUMNS));
          break;
        }
        case 'waitlist-analytics-csv': {
          const ctx = data as WaitlistMetricsContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, WAITLIST_ANALYTICS_CSV_COLUMNS));
          break;
        }
        case 'refunds-register-csv': {
          const ctx = data as RefundRegisterContext;
          const rows = ctx.rows.map(r => ({ ...r, date: r.date.toLocaleDateString() }));
          bytes = csvToBytes(rowsToCsv(rows, REFUNDS_REGISTER_CSV_COLUMNS));
          break;
        }
        case 'combo-overrides-csv': {
          const ctx = data as ComboOverridesContext;
          const rows = ctx.rows.map(r => ({ ...r, ts: r.ts.toLocaleString() }));
          bytes = csvToBytes(rowsToCsv(rows, COMBO_OVERRIDES_CSV_COLUMNS));
          break;
        }
        case 'tip-split-csv': {
          const ctx = data as TipSplitContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, TIP_SPLIT_CSV_COLUMNS));
          break;
        }
        case 'deletions-pre-csv': {
          const ctx = data as DeletionsPreContext;
          const rows = ctx.rows.map(r => ({ ...r, removedAt: r.removedAt.toLocaleString() }));
          bytes = csvToBytes(rowsToCsv(rows, DELETIONS_PRE_CSV_COLUMNS));
          break;
        }
        case 'deletions-post-csv': {
          const ctx = data as DeletionsPostContext;
          // eslint-disable-next-line i18next/no-literal-string -- CSV cell list separator, not UI copy
          const fieldsSeparator = '; ';
          const rows = ctx.rows.map(r => ({
            ...r,
            editedAt: r.editedAt.toLocaleString(),
            fieldsChanged: r.fieldsChanged.join(fieldsSeparator),
          }));
          bytes = csvToBytes(rowsToCsv(rows, DELETIONS_POST_CSV_COLUMNS));
          break;
        }
        case 'modifier-popularity-csv': {
          const ctx = data as ModifierPopularityContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, MODIFIER_POPULARITY_CSV_COLUMNS));
          break;
        }
        case 'payment-methods-csv': {
          const ctx = data as PaymentMethodsContext;
          bytes = csvToBytes(rowsToCsv(ctx.rows, PAYMENT_METHODS_CSV_COLUMNS));
          break;
        }
        default: {
          const never: never = type;
          throw new Error(`Unknown export type: ${String(never)}`);
        }
      }

      const filePath = await save({
        defaultPath: `report-${dateStr}.${ext}`,
        filters: [{ name: mimeLabel, extensions: [ext] }],
      });

      if (filePath === null) {
        return err(exportCancelledError());
      }

      await writeFile(filePath, bytes);

      toast.success(i18n.t('featMgmt:exportReport.successToast'));
      logger.info('export.report.success', { type });
      return ok(undefined);
    } catch (e) {
      logger.error('export.report.failed', { type, raw: e });
      toast.error(i18n.t('featMgmt:exportReport.errorToast'));
      return err(exportFailedError(undefined, e));
    } finally {
      setIsExporting(false);
    }
  }

  return { exportReport, isExporting };
}
