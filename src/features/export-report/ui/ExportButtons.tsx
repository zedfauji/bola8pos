import { Download, Loader2 } from 'lucide-react';
import { useStaffStore } from '@entities/staff/model/store';
import type {
  CajaReport,
  CategoryRevenueRow,
  HourlyRow,
  ProductSalesRow,
  StaffMetric,
  StaffTips,
  VoidRefundRow,
} from '@shared/lib/domain';
import { canAccess } from '@shared/lib/rbac';
import { Button } from '@shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { useExportReport } from '../model/useExportReport';

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

type Props =
  | CajaProps
  | ProductsProps
  | HourlyProps
  | VoidsProps
  | CategoriesProps
  | StaffProps
  | TipsProps;

export function ExportButtons(props: Props) {
  const role = useStaffStore(s => s.currentStaff?.role);
  const { exportReport, isExporting } = useExportReport();

  if (!canAccess(role, 'view_reports')) {
    return null;
  }

  function handleExport(format: 'excel' | 'pdf') {
    void (async () => {
      if (props.reportType === 'caja') {
        const type = format === 'excel' ? 'caja-excel' : 'caja-pdf';
        await exportReport(type, props.data);
      } else if (props.reportType === 'products') {
        const type = format === 'excel' ? 'products-excel' : 'products-pdf';
        await exportReport(type, props.data);
      } else if (props.reportType === 'hourly') {
        const type = format === 'excel' ? 'hourly-excel' : 'hourly-pdf';
        await exportReport(type, props.data);
      } else if (props.reportType === 'voids') {
        const type = format === 'excel' ? 'voids-excel' : 'voids-pdf';
        await exportReport(type, props.data);
      } else if (props.reportType === 'staff') {
        const type = format === 'excel' ? 'staff-excel' : 'staff-pdf';
        await exportReport(type, props.data);
      } else if (props.reportType === 'tips') {
        const type = format === 'excel' ? 'tips-excel' : 'tips-pdf';
        await exportReport(type, props.data);
      } else {
        const type = format === 'excel' ? 'categories-excel' : 'categories-pdf';
        await exportReport(type, props.data);
      }
    })();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel inset={undefined}>Download as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          inset={undefined}
          variant={undefined}
          onSelect={() => {
            handleExport('excel');
          }}
        >
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          inset={undefined}
          variant={undefined}
          onSelect={() => {
            handleExport('pdf');
          }}
        >
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
