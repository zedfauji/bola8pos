import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  CajaReport,
  CategoryRevenueRow,
  HourlyRow,
  ProductSalesRow,
  StaffMetric,
  StaffTips,
  VoidRefundRow,
} from '@shared/lib/domain';
import {
  cajaReportToWorkbook,
  productSalesToWorkbook,
  hourlySalesToWorkbook,
  voidRefundToWorkbook,
  categoryRevenueToWorkbook,
  staffMetricsToWorkbook,
  staffTipsToWorkbook,
  workbookToBytes,
} from '@shared/lib/exporters/excel';
import {
  cajaReportToPdfBytes,
  productSalesToPdfBytes,
  hourlySalesToPdfBytes,
  voidRefundToPdfBytes,
  categoryRevenueToPdfBytes,
  staffMetricsToPdfBytes,
  staffTipsToPdfBytes,
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
  | 'tips-pdf';

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
