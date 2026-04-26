import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  CajaReport,
  CategoryRevenueRow,
  ComboMixRow,
  ComboOverrideRow,
  HourlyRow,
  ProductSalesRow,
  RecipeVarianceRow,
  RefundRegisterRow,
  StaffMetric,
  StaffTips,
  VoidRefundRow,
  WaitlistMetricsRow,
} from '@shared/lib/domain';
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
import { logger } from '@shared/lib/logger-instance';
import { ok, err, exportCancelledError, exportFailedError, type Result } from '@shared/lib/result';

export type ExportType =
  | 'caja-excel'
  | 'caja-pdf'
  | 'products-excel'
  | 'products-pdf'
  | 'hourly-excel'
  | 'hourly-pdf'
  | 'voids-excel'
  | 'voids-pdf'
  | 'categories-excel'
  | 'categories-pdf'
  | 'staff-excel'
  | 'staff-pdf'
  | 'tips-excel'
  | 'tips-pdf'
  | 'combo-mix-excel'
  | 'combo-mix-pdf'
  | 'recipe-variance-excel'
  | 'recipe-variance-pdf'
  | 'waitlist-analytics-excel'
  | 'waitlist-analytics-pdf'
  | 'refunds-register-excel'
  | 'refunds-register-pdf'
  | 'combo-overrides-excel';

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

export function useExportReport() {
  const [isExporting, setIsExporting] = useState(false);

  async function exportReport(
    type: 'caja-excel' | 'caja-pdf',
    data: CajaReport
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'products-excel' | 'products-pdf',
    data: ProductsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'hourly-excel' | 'hourly-pdf',
    data: HourlyRow[]
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'voids-excel' | 'voids-pdf',
    data: VoidsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'categories-excel' | 'categories-pdf',
    data: CategoriesContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'staff-excel' | 'staff-pdf',
    data: StaffContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'tips-excel' | 'tips-pdf',
    data: TipsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'combo-mix-excel' | 'combo-mix-pdf',
    data: ComboMixContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'recipe-variance-excel' | 'recipe-variance-pdf',
    data: RecipeVarianceContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'waitlist-analytics-excel' | 'waitlist-analytics-pdf',
    data: WaitlistMetricsContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'refunds-register-excel' | 'refunds-register-pdf',
    data: RefundRegisterContext
  ): Promise<Result<void>>;
  async function exportReport(
    type: 'combo-overrides-excel',
    data: ComboOverridesContext
  ): Promise<Result<void>>;
  async function exportReport(type: ExportType, data: unknown): Promise<Result<void>> {
    setIsExporting(true);
    try {
      const isExcel = type.endsWith('-excel');
      const ext = isExcel ? 'xlsx' : 'pdf';
      const mimeLabel = isExcel ? 'Excel Workbook' : 'PDF Document';
      const dateStr = new Date().toISOString().split('T')[0] ?? 'report';

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

      toast.success('Report exported successfully.');
      logger.info('export.report.success', { type });
      return ok(undefined);
    } catch (e) {
      logger.error('export.report.failed', { type, raw: e });
      toast.error('Export failed. Please try again.');
      return err(exportFailedError(undefined, e));
    } finally {
      setIsExporting(false);
    }
  }

  return { exportReport, isExporting };
}
