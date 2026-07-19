import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('pages');
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
        <PageContainer title={t('reports.title')} backTo="/home">
          <Tabs defaultValue="session">
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="session">{t('reports.tabs.session')}</TabsTrigger>
              <TabsTrigger value="products">{t('reports.tabs.products')}</TabsTrigger>
              <TabsTrigger value="hourly">{t('reports.tabs.hourly')}</TabsTrigger>
              <TabsTrigger value="voids">{t('reports.tabs.voids')}</TabsTrigger>
              <TabsTrigger value="categories">{t('reports.tabs.categories')}</TabsTrigger>
              <TabsTrigger value="staff">{t('reports.tabs.staff')}</TabsTrigger>
              <TabsTrigger value="tips">{t('reports.tabs.tips')}</TabsTrigger>
              <TabsTrigger value="tip-split">{t('reports.tabs.tipSplit')}</TabsTrigger>
              <TabsTrigger value="combos">{t('reports.tabs.combos')}</TabsTrigger>
              <TabsTrigger value="variance">{t('reports.tabs.variance')}</TabsTrigger>
              <TabsTrigger value="waitlist">{t('reports.tabs.waitlist')}</TabsTrigger>
              <TabsTrigger value="refunds-reg">{t('reports.tabs.refundsReg')}</TabsTrigger>
              <TabsTrigger value="overrides">{t('reports.tabs.overrides')}</TabsTrigger>
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
