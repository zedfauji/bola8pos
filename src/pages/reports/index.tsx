import { useState } from 'react';
import { CajaReportPanel } from '@widgets/CajaReportPanel';
import { CategoryRevenuePanel } from '@widgets/CategoryRevenuePanel';
import { HourlyBreakdownPanel } from '@widgets/HourlyBreakdownPanel';
import { ProductSalesPanel } from '@widgets/ProductSalesPanel';
import { StaffSalesPanel } from '@widgets/StaffSalesPanel';
import { TipDistributionPanel } from '@widgets/TipDistributionPanel';
import { VoidRefundPanel } from '@widgets/VoidRefundPanel';
import { BackToHomeButton, DateRangePicker } from '@shared/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

function fromDateStr(s: string, endOfDay: boolean): Date {
  const [y, m, day] = s.split('-').map(Number);
  const d = new Date(y ?? 0, (m ?? 1) - 1, day ?? 1);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export default function ReportsPage() {
  const today = toDateStr(new Date());
  const [fromStr, setFromStr] = useState(today);
  const [toStr, setToStr] = useState(today);

  function handleDateChange(f: string, t: string) {
    setFromStr(f);
    setToStr(t);
  }

  const dateRange = {
    from: fromDateStr(fromStr, false),
    to: fromDateStr(toStr, true),
  };

  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <Tabs defaultValue="session">
          <TabsList className="mb-4">
            <TabsTrigger value="session">Session View</TabsTrigger>
            <TabsTrigger value="products">Product Sales</TabsTrigger>
            <TabsTrigger value="hourly">Hourly Breakdown</TabsTrigger>
            <TabsTrigger value="voids">Voids &amp; Refunds</TabsTrigger>
            <TabsTrigger value="categories">Revenue by Category</TabsTrigger>
            <TabsTrigger value="staff">Staff Performance</TabsTrigger>
            <TabsTrigger value="tips">Tip Distribution</TabsTrigger>
          </TabsList>

          <TabsContent value="session">
            <CajaReportPanel />
          </TabsContent>

          <TabsContent value="products">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <ProductSalesPanel dateRange={dateRange} />
            </div>
          </TabsContent>

          <TabsContent value="hourly">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <HourlyBreakdownPanel dateRange={dateRange} />
            </div>
          </TabsContent>

          <TabsContent value="voids">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <VoidRefundPanel dateRange={dateRange} />
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <CategoryRevenuePanel dateRange={dateRange} />
            </div>
          </TabsContent>

          <TabsContent value="staff">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <StaffSalesPanel dateRange={dateRange} />
            </div>
          </TabsContent>

          <TabsContent value="tips">
            <div className="space-y-4">
              <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
              <TipDistributionPanel dateRange={dateRange} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
