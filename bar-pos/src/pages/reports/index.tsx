import { useState } from 'react';
import { CajaReportPanel } from '@widgets/CajaReportPanel';
import { CategoryRevenuePanel } from '@widgets/CategoryRevenuePanel';
import { ComboMixReport } from '@widgets/ComboMixReport';
import { ComboOverrideReport } from '@widgets/ComboOverrideReport';
import { HourlyBreakdownPanel } from '@widgets/HourlyBreakdownPanel';
import { ProductSalesPanel } from '@widgets/ProductSalesPanel';
import { RecipeVarianceReport } from '@widgets/RecipeVarianceReport';
import { RefundsRegister } from '@widgets/RefundsRegister';
import { StaffSalesPanel } from '@widgets/StaffSalesPanel';
import { TipBucketDistributionPanel } from '@widgets/TipBucketDistributionPanel';
import { TipDistributionPanel } from '@widgets/TipDistributionPanel';
import { VoidRefundPanel } from '@widgets/VoidRefundPanel';
import { WaitlistAnalyticsReport } from '@widgets/WaitlistAnalyticsReport';
import { DateRangePicker, PageContainer } from '@shared/ui';
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
      <main className="flex-1 overflow-auto">
        <PageContainer title="Reports" backTo="/home">
          <Tabs defaultValue="session">
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="session">Session View</TabsTrigger>
              <TabsTrigger value="products">Product Sales</TabsTrigger>
              <TabsTrigger value="hourly">Hourly Breakdown</TabsTrigger>
              <TabsTrigger value="voids">Voids &amp; Refunds</TabsTrigger>
              <TabsTrigger value="categories">Revenue by Category</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
              <TabsTrigger value="tips">Tip Distribution</TabsTrigger>
              <TabsTrigger value="tip-split">Tip Split</TabsTrigger>
              <TabsTrigger value="combos">Combo Mix</TabsTrigger>
              <TabsTrigger value="variance">Recipe Variance</TabsTrigger>
              <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
              <TabsTrigger value="refunds-reg">Refunds Register</TabsTrigger>
              <TabsTrigger value="overrides">Overrides</TabsTrigger>
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

            <TabsContent value="tip-split">
              <TipBucketDistributionPanel />
            </TabsContent>

            <TabsContent value="combos">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <ComboMixReport dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="variance">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <RecipeVarianceReport dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="waitlist">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <WaitlistAnalyticsReport dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="refunds-reg">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <RefundsRegister dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="overrides">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <ComboOverrideReport dateRange={dateRange} />
              </div>
            </TabsContent>
          </Tabs>
        </PageContainer>
      </main>
    </div>
  );
}
