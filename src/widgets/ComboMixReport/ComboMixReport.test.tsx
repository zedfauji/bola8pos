import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as QueriesReports from '@entities/tab/model/queries-reports';
import type { ComboMixRow } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';
import { ComboMixReport } from './ComboMixReport';

const mockUseComboMixReport = vi.fn();

vi.mock('@entities/tab/model/queries-reports', async importOriginal => {
  const actual = await importOriginal<typeof QueriesReports>();
  return { ...actual, useComboMixReport: () => mockUseComboMixReport() };
});
vi.mock('@features/export-report', () => ({
  ExportButtons: () => <button>Export</button>,
}));
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const dateRange = { from: new Date('2026-01-01'), to: new Date('2026-01-31') };

const ROW_A: ComboMixRow = {
  date: '2026-01-01',
  comboProductId: 'aaa-111',
  comboName: 'Cubeta Regular',
  qtySold: 10,
  netRevenue: 500,
  avgPrice: 50,
  overrideCount: 0,
};

const ROW_B: ComboMixRow = {
  date: '2026-01-01',
  comboProductId: 'bbb-222',
  comboName: 'Cubeta Premium',
  qtySold: 5,
  netRevenue: 300,
  avgPrice: 60,
  overrideCount: 1,
};

describe('ComboMixReport', () => {
  it('renders LoadingSpinner while isLoading', () => {
    mockUseComboMixReport.mockReturnValue({ isLoading: true, data: undefined });
    renderWithProviders(<ComboMixReport dateRange={dateRange} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders EmptyState with "No combo sales" when rows is empty', () => {
    mockUseComboMixReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [] } });
    renderWithProviders(<ComboMixReport dateRange={dateRange} />);
    expect(screen.getByText('No combo sales')).toBeInTheDocument();
  });

  it('renders table with combo names when data is present', () => {
    mockUseComboMixReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [ROW_A, ROW_B] } });
    renderWithProviders(<ComboMixReport dateRange={dateRange} />);
    expect(screen.getByText('Cubeta Regular')).toBeInTheDocument();
    expect(screen.getByText('Cubeta Premium')).toBeInTheDocument();
  });

  it('top-revenue row has emerald highlight class', () => {
    mockUseComboMixReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [ROW_A, ROW_B] } });
    const { container } = renderWithProviders(<ComboMixReport dateRange={dateRange} />);
    // ROW_A has netRevenue=500, ROW_B has 300 — ROW_A is top
    const rows = container.querySelectorAll('tbody tr');
    const topRow = Array.from(rows).find(r => r.textContent?.includes('Cubeta Regular'));
    expect(topRow?.className).toContain('border-l-emerald-500');
  });
});
