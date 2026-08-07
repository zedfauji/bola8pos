import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStaffStore } from '@entities/staff/model/store';
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
import { canAccess } from '@shared/lib/rbac';
import { POSButton } from '@shared/ui/POSButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { useExportReport, type TipSplitRow } from '../model/useExportReport';

type CajaProps = {
  reportType: 'caja';
  data: CajaReport;
};

type ProductsProps = {
  reportType: 'products';
  data: { rows: ProductSalesRow[]; dateRange: { from: Date; to: Date } };
};

type HourlyProps = {
  reportType: 'hourly';
  data: HourlyRow[];
};

type VoidsProps = {
  reportType: 'voids';
  data: { rows: VoidRefundRow[]; dateRange: { from: Date; to: Date } };
};

type CategoriesProps = {
  reportType: 'categories';
  data: { rows: CategoryRevenueRow[]; dateRange: { from: Date; to: Date } };
};

type StaffProps = {
  reportType: 'staff';
  data: { rows: StaffMetric[]; dateRange: { from: Date; to: Date } };
};

type TipsProps = {
  reportType: 'tips';
  data: { rows: StaffTips[]; dateRange: { from: Date; to: Date } };
};

type ComboMixProps = {
  reportType: 'combo-mix';
  data: { rows: ComboMixRow[]; dateRange: { from: Date; to: Date } };
};

type RecipeVarianceProps = {
  reportType: 'recipe-variance';
  data: { rows: RecipeVarianceRow[]; dateRange: { from: Date; to: Date } };
};

type WaitlistAnalyticsProps = {
  reportType: 'waitlist-analytics';
  data: { rows: WaitlistMetricsRow[]; dateRange: { from: Date; to: Date } };
};

type RefundsRegisterProps = {
  reportType: 'refunds-register';
  data: { rows: RefundRegisterRow[]; dateRange: { from: Date; to: Date } };
};

type ComboOverridesProps = {
  reportType: 'combo-overrides';
  data: { rows: ComboOverrideRow[]; dateRange: { from: Date; to: Date } };
};

type TipSplitProps = {
  reportType: 'tip-split';
  data: { rows: TipSplitRow[] };
};

type DeletionsPreProps = {
  reportType: 'deletions-pre';
  data: { rows: DeletionsPreRow[]; dateRange: { from: Date; to: Date } };
};

type DeletionsPostProps = {
  reportType: 'deletions-post';
  data: { rows: DeletionsPostRow[]; dateRange: { from: Date; to: Date } };
};

type ModifierPopularityProps = {
  reportType: 'modifier-popularity';
  data: { rows: ModifierPopularityRow[]; dateRange: { from: Date; to: Date } };
};

type PaymentMethodsProps = {
  reportType: 'payment-methods';
  data: { rows: PaymentMethodRow[]; dateRange: { from: Date; to: Date } };
};

type Props =
  | CajaProps
  | ProductsProps
  | HourlyProps
  | VoidsProps
  | CategoriesProps
  | StaffProps
  | TipsProps
  | ComboMixProps
  | RecipeVarianceProps
  | WaitlistAnalyticsProps
  | RefundsRegisterProps
  | ComboOverridesProps
  | TipSplitProps
  | DeletionsPreProps
  | DeletionsPostProps
  | ModifierPopularityProps
  | PaymentMethodsProps;

export function ExportButtons(props: Props) {
  const { t } = useTranslation('featMgmt');
  const role = useStaffStore(s => s.currentStaff?.role);
  const { exportReport, isExporting } = useExportReport();

  if (!canAccess(role, 'view_reports')) {
    return null;
  }

  /* eslint-disable i18next/no-literal-string -- ExportType literal-union branches
     (e.g. 'caja-excel'), not UI copy */
  function handleExport(format: 'excel' | 'pdf' | 'csv') {
    void (async () => {
      if (props.reportType === 'caja') {
        const type = format === 'excel' ? 'caja-excel' : format === 'pdf' ? 'caja-pdf' : 'caja-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'products') {
        const type =
          format === 'excel'
            ? 'products-excel'
            : format === 'pdf'
              ? 'products-pdf'
              : 'products-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'hourly') {
        const type =
          format === 'excel' ? 'hourly-excel' : format === 'pdf' ? 'hourly-pdf' : 'hourly-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'voids') {
        const type =
          format === 'excel' ? 'voids-excel' : format === 'pdf' ? 'voids-pdf' : 'voids-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'staff') {
        const type =
          format === 'excel' ? 'staff-excel' : format === 'pdf' ? 'staff-pdf' : 'staff-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'tips') {
        const type = format === 'excel' ? 'tips-excel' : format === 'pdf' ? 'tips-pdf' : 'tips-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'combo-mix') {
        const type =
          format === 'excel'
            ? 'combo-mix-excel'
            : format === 'pdf'
              ? 'combo-mix-pdf'
              : 'combo-mix-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'recipe-variance') {
        const type =
          format === 'excel'
            ? 'recipe-variance-excel'
            : format === 'pdf'
              ? 'recipe-variance-pdf'
              : 'recipe-variance-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'waitlist-analytics') {
        const type =
          format === 'excel'
            ? 'waitlist-analytics-excel'
            : format === 'pdf'
              ? 'waitlist-analytics-pdf'
              : 'waitlist-analytics-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'refunds-register') {
        const type =
          format === 'excel'
            ? 'refunds-register-excel'
            : format === 'pdf'
              ? 'refunds-register-pdf'
              : 'refunds-register-csv';
        await exportReport(type, props.data);
      } else if (props.reportType === 'combo-overrides') {
        // PDF not supported for overrides — Excel only; CSV still applies (D-11/D-12)
        await exportReport(
          format === 'csv' ? 'combo-overrides-csv' : 'combo-overrides-excel',
          props.data
        );
      } else if (props.reportType === 'tip-split') {
        await exportReport('tip-split-csv', props.data);
      } else if (props.reportType === 'deletions-pre') {
        await exportReport('deletions-pre-csv', props.data);
      } else if (props.reportType === 'deletions-post') {
        await exportReport('deletions-post-csv', props.data);
      } else if (props.reportType === 'modifier-popularity') {
        await exportReport('modifier-popularity-csv', props.data);
      } else if (props.reportType === 'payment-methods') {
        await exportReport('payment-methods-csv', props.data);
      } else {
        const type =
          format === 'excel'
            ? 'categories-excel'
            : format === 'pdf'
              ? 'categories-pdf'
              : 'categories-csv';
        await exportReport(type, props.data);
      }
    })();
  }
  /* eslint-enable i18next/no-literal-string */

  // The 5 net-new report types are CSV-only for now (no Excel/PDF ExportType
  // literal exists for them yet, D-11/D-12) — showing Excel/PDF buttons that
  // silently produce a CSV would be a misleading toolbar.
  /* eslint-disable i18next/no-literal-string -- reportType literal comparisons, not UI copy */
  const isCsvOnly =
    props.reportType === 'tip-split' ||
    props.reportType === 'deletions-pre' ||
    props.reportType === 'deletions-post' ||
    props.reportType === 'modifier-popularity' ||
    props.reportType === 'payment-methods';
  /* eslint-enable i18next/no-literal-string */

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <POSButton variant="outline" touchSize="default" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {t('exportReport.exportButton')}
        </POSButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel inset={undefined}>{t('exportReport.downloadAs')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isCsvOnly && (
          <>
            <DropdownMenuItem
              inset={undefined}
              variant={undefined}
              onSelect={() => {
                handleExport('excel');
              }}
            >
              {t('exportReport.excelOption')}
            </DropdownMenuItem>
            <DropdownMenuItem
              inset={undefined}
              variant={undefined}
              onSelect={() => {
                handleExport('pdf');
              }}
            >
              {t('exportReport.pdfOption')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          inset={undefined}
          variant={undefined}
          onSelect={() => {
            handleExport('csv');
          }}
        >
          {t('exportReport.csvOption')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
