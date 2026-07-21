/**
 * Unit tests for ExportButtons (src/features/export-report/ui/ExportButtons.tsx)
 *
 * Asserts a CSV dropdown item renders for every reportType (D-11/D-12: all 17
 * report tabs expose CSV via one generic serializer + the same dropdown).
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { renderWithProviders } from '@shared/lib/test-utils';
import type { TipSplitRow } from '../model/useExportReport';
import { ExportButtons } from './ExportButtons';

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

const DATE_RANGE = { from: new Date('2026-01-01'), to: new Date('2026-01-31') };

const CAJA_REPORT: CajaReport = {
  cajaSession: {
    id: '00000000-0000-0000-0000-000000000001',
    openedAt: new Date('2026-01-01T08:00:00Z'),
    closedAt: null,
    openedBy: '00000000-0000-0000-0000-000000000002',
    closedBy: null,
    openingCash: 500,
    closingCash: null,
    notes: null,
    status: 'open',
  },
  summary: {
    totalRevenue: 1000,
    cashSales: 600,
    cardSales: 400,
    rappiSales: 0,
    orderCount: 10,
    tabCount: 5,
    totalExpenses: 0,
    totalIncome: 0,
    netBalance: 1000,
  },
  cashReconciliation: {
    openingCash: 500,
    cashSales: 600,
    expectedCash: 1100,
    closingCash: null,
    variance: null,
  },
  topProducts: [],
  staffSummary: [],
  cajaEntries: [],
};

const PRODUCT_ROWS: ProductSalesRow[] = [
  {
    productId: 'p1',
    productName: 'Corona',
    categoryName: 'Beer',
    units: 5,
    revenue: 100,
    pctTotal: 1,
  },
];

const HOURLY_ROWS: HourlyRow[] = [
  { hour: 20, orderCount: 5, revenue: 200, dayOfWeek: 5, isBusiest: true },
];

const VOID_ROWS: VoidRefundRow[] = [
  {
    orderId: '11111111-1111-1111-1111-111111111111',
    voidedAt: new Date('2026-01-05T10:00:00Z'),
    staffName: 'Alex',
    amount: 20,
    reason: 'wrong item',
  },
];

const CATEGORY_ROWS: CategoryRevenueRow[] = [
  {
    categoryId: 'c1',
    categoryName: 'Beer',
    unitsSold: 10,
    orderCount: 5,
    revenue: 200,
    pctTotal: 1,
  },
];

const STAFF_ROWS: StaffMetric[] = [
  {
    staffId: '22222222-2222-2222-2222-222222222222',
    staffName: 'Alex',
    revenue: 100,
    transactionCount: 5,
    avgCheckSize: 20,
    voidCount: 0,
  },
];

const TIPS_ROWS: StaffTips[] = [
  { staffId: '33333333-3333-3333-3333-333333333333', staffName: 'Alex', totalTips: 50 },
];

const COMBO_MIX_ROWS: ComboMixRow[] = [
  {
    date: '2026-01-05',
    comboProductId: '44444444-4444-4444-4444-444444444444',
    comboName: 'Combo A',
    qtySold: 3,
    netRevenue: 90,
    avgPrice: 30,
    overrideCount: 0,
  },
];

const RECIPE_VARIANCE_ROWS: RecipeVarianceRow[] = [
  {
    date: '2026-01-05',
    ingredientId: '55555555-5555-5555-5555-555555555555',
    ingredientName: 'Lime',
    theoreticalUsed: 10,
    physicalDelta: -1,
    variancePct: -10,
  },
];

const WAITLIST_ROWS: WaitlistMetricsRow[] = [
  { date: '2026-01-05', partiesSeated: 4, avgQuotedWait: 10, avgActualWait: 12, noShowRate: 0 },
];

const REFUNDS_REGISTER_ROWS: RefundRegisterRow[] = [
  {
    id: '66666666-6666-6666-6666-666666666666',
    date: new Date('2026-01-05T10:00:00Z'),
    operatorName: 'Alex',
    originalPaymentId: '77777777-7777-7777-7777-777777777777',
    amount: 20,
    reason: 'customer_complaint',
    restockCount: 1,
    items: [],
  },
];

const COMBO_OVERRIDE_ROWS: ComboOverrideRow[] = [
  {
    id: '88888888-8888-8888-8888-888888888888',
    ts: new Date('2026-01-05T10:00:00Z'),
    actorName: 'Alex',
    comboName: 'Combo A',
    reason: null,
  },
];

const TIP_SPLIT_ROWS: TipSplitRow[] = [{ bucket: 'Floor', pct: 34, amount: 34 }];

const DELETIONS_PRE_ROWS: DeletionsPreRow[] = [
  {
    orderId: '99999999-9999-9999-9999-999999999999',
    itemName: 'Beer',
    removedAt: new Date('2026-01-05T10:00:00Z'),
    staffName: 'Alex',
    reason: 'wrong item',
  },
];

const DELETIONS_POST_ROWS: DeletionsPostRow[] = [
  {
    tabId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    editedAt: new Date('2026-01-05T10:00:00Z'),
    staffName: 'Alex',
    reason: 'correction',
    fieldsChanged: ['amount'],
  },
];

const MODIFIER_POPULARITY_ROWS: ModifierPopularityRow[] = [
  {
    modifierId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    modifierName: 'Extra cheese',
    attachCount: 10,
    revenue: 50,
  },
];

const PAYMENT_METHOD_ROWS: PaymentMethodRow[] = [
  {
    cajaSessionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    method: 'cash',
    legCount: 5,
    grossAmount: 100,
    tipAmount: 10,
    isRollup: false,
  },
];

const CASES: { reportType: string; data: unknown; excelPdf: boolean }[] = [
  { reportType: 'caja', data: CAJA_REPORT, excelPdf: true },
  { reportType: 'products', data: { rows: PRODUCT_ROWS, dateRange: DATE_RANGE }, excelPdf: true },
  { reportType: 'hourly', data: HOURLY_ROWS, excelPdf: true },
  { reportType: 'voids', data: { rows: VOID_ROWS, dateRange: DATE_RANGE }, excelPdf: true },
  {
    reportType: 'categories',
    data: { rows: CATEGORY_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  { reportType: 'staff', data: { rows: STAFF_ROWS, dateRange: DATE_RANGE }, excelPdf: true },
  { reportType: 'tips', data: { rows: TIPS_ROWS, dateRange: DATE_RANGE }, excelPdf: true },
  {
    reportType: 'combo-mix',
    data: { rows: COMBO_MIX_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  {
    reportType: 'recipe-variance',
    data: { rows: RECIPE_VARIANCE_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  {
    reportType: 'waitlist-analytics',
    data: { rows: WAITLIST_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  {
    reportType: 'refunds-register',
    data: { rows: REFUNDS_REGISTER_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  {
    reportType: 'combo-overrides',
    data: { rows: COMBO_OVERRIDE_ROWS, dateRange: DATE_RANGE },
    excelPdf: true,
  },
  { reportType: 'tip-split', data: { rows: TIP_SPLIT_ROWS }, excelPdf: false },
  {
    reportType: 'deletions-pre',
    data: { rows: DELETIONS_PRE_ROWS, dateRange: DATE_RANGE },
    excelPdf: false,
  },
  {
    reportType: 'deletions-post',
    data: { rows: DELETIONS_POST_ROWS, dateRange: DATE_RANGE },
    excelPdf: false,
  },
  {
    reportType: 'modifier-popularity',
    data: { rows: MODIFIER_POPULARITY_ROWS, dateRange: DATE_RANGE },
    excelPdf: false,
  },
  {
    reportType: 'payment-methods',
    data: { rows: PAYMENT_METHOD_ROWS, dateRange: DATE_RANGE },
    excelPdf: false,
  },
];

describe('ExportButtons', () => {
  beforeEach(() => {
    vi.mocked(useStaffStore).mockImplementation(selector =>
      selector({
        currentStaff: { role: 'manager' },
      } as never)
    );
  });

  it.each(CASES)(
    'renders a CSV dropdown item for reportType=$reportType',
    async ({ data, excelPdf, ...rest }) => {
      // reportType is a discriminated union — cast through unknown since this
      // table intentionally covers all 17 literal variants generically.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = { reportType: rest.reportType, data } as any;
      renderWithProviders(<ExportButtons {...props} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(await screen.findByRole('menuitem', { name: 'CSV' })).toBeInTheDocument();
      if (excelPdf) {
        expect(screen.getByRole('menuitem', { name: /excel/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument();
      } else {
        expect(screen.queryByRole('menuitem', { name: /excel/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /pdf/i })).not.toBeInTheDocument();
      }
    }
  );
});
