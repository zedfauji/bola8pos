import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CajaReportPanel } from '@widgets/CajaReportPanel';
import { CategoryRevenuePanel } from '@widgets/CategoryRevenuePanel';
import { ComboMixReport } from '@widgets/ComboMixReport';
import { ComboOverrideReport } from '@widgets/ComboOverrideReport';
import { DeletionsPostCloseReport } from '@widgets/DeletionsPostCloseReport';
import { DeletionsPreSendPanel } from '@widgets/DeletionsPreSendPanel';
import { HourlyBreakdownPanel } from '@widgets/HourlyBreakdownPanel';
import { ModifierPopularityReport } from '@widgets/ModifierPopularityReport';
import { PaymentMethodsReport } from '@widgets/PaymentMethodsReport';
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
            <TabsList className="mb-4 h-auto w-full flex-col items-stretch gap-3 bg-transparent p-0">
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('reports.groups.sales')}
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  <TabsTrigger value="session" className="flex-none">
                    {t('reports.tabs.session')}
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex-none">
                    {t('reports.tabs.products')}
                  </TabsTrigger>
                  <TabsTrigger value="hourly" className="flex-none">
                    {t('reports.tabs.hourly')}
                  </TabsTrigger>
                  <TabsTrigger value="categories" className="flex-none">
                    {t('reports.tabs.categories')}
                  </TabsTrigger>
                  <TabsTrigger value="payment-methods" className="flex-none">
                    {t('reports.tabs.paymentMethods')}
                  </TabsTrigger>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('reports.groups.menu')}
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  <TabsTrigger value="modifier-popularity" className="flex-none">
                    {t('reports.tabs.modifierPopularity')}
                  </TabsTrigger>
                  <TabsTrigger value="combos" className="flex-none">
                    {t('reports.tabs.combos')}
                  </TabsTrigger>
                  <TabsTrigger value="variance" className="flex-none">
                    {t('reports.tabs.variance')}
                  </TabsTrigger>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('reports.groups.staffTips')}
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  <TabsTrigger value="staff" className="flex-none">
                    {t('reports.tabs.staff')}
                  </TabsTrigger>
                  <TabsTrigger value="tips" className="flex-none">
                    {t('reports.tabs.tips')}
                  </TabsTrigger>
                  <TabsTrigger value="tip-split" className="flex-none">
                    {t('reports.tabs.tipSplit')}
                  </TabsTrigger>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('reports.groups.operations')}
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                  <TabsTrigger value="voids" className="flex-none">
                    {t('reports.tabs.voids')}
                  </TabsTrigger>
                  <TabsTrigger value="deletions-pre" className="flex-none">
                    {t('reports.tabs.deletionsPre')}
                  </TabsTrigger>
                  <TabsTrigger value="deletions-post" className="flex-none">
                    {t('reports.tabs.deletionsPost')}
                  </TabsTrigger>
                  <TabsTrigger value="refunds-reg" className="flex-none">
                    {t('reports.tabs.refundsReg')}
                  </TabsTrigger>
                  <TabsTrigger value="overrides" className="flex-none">
                    {t('reports.tabs.overrides')}
                  </TabsTrigger>
                  <TabsTrigger value="waitlist" className="flex-none">
                    {t('reports.tabs.waitlist')}
                  </TabsTrigger>
                </div>
              </div>
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

            <TabsContent value="deletions-pre">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <DeletionsPreSendPanel dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="deletions-post">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <DeletionsPostCloseReport dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="modifier-popularity">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <ModifierPopularityReport dateRange={dateRange} />
              </div>
            </TabsContent>

            <TabsContent value="payment-methods">
              <div className="space-y-4">
                <DateRangePicker fromStr={fromStr} toStr={toStr} onChange={handleDateChange} />
                <PaymentMethodsReport dateRange={dateRange} />
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
