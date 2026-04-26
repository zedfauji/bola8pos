import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as QueriesReports from '@entities/tab/model/queries-reports';
import type { RecipeVarianceRow } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';
import { RecipeVarianceReport } from './RecipeVarianceReport';

const mockUseRecipeVarianceReport = vi.fn();

vi.mock('@entities/tab/model/queries-reports', async importOriginal => {
  const actual = await importOriginal<typeof QueriesReports>();
  return { ...actual, useRecipeVarianceReport: () => mockUseRecipeVarianceReport() };
});
vi.mock('@features/export-report', () => ({
  ExportButtons: () => <button>Export</button>,
}));

const dateRange = { from: new Date('2026-01-01'), to: new Date('2026-01-31') };

const ROW_HIGH: RecipeVarianceRow = {
  date: '2026-01-01',
  ingredientId: 'aaa-111',
  ingredientName: 'Cerveza',
  theoreticalUsed: 100,
  physicalDelta: -85,
  variancePct: 15.5,
};

const ROW_LOW: RecipeVarianceRow = {
  date: '2026-01-01',
  ingredientId: 'bbb-222',
  ingredientName: 'Hielo',
  theoreticalUsed: 50,
  physicalDelta: -49,
  variancePct: 2.0,
};

describe('RecipeVarianceReport', () => {
  it('renders EmptyState with "No variance data" when rows is empty', () => {
    mockUseRecipeVarianceReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [] } });
    renderWithProviders(<RecipeVarianceReport dateRange={dateRange} />);
    expect(screen.getByText('No variance data')).toBeInTheDocument();
  });

  it('row with |variancePct| > 10 has amber highlight class', () => {
    mockUseRecipeVarianceReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [ROW_HIGH] } });
    const { container } = renderWithProviders(<RecipeVarianceReport dateRange={dateRange} />);
    const rows = container.querySelectorAll('tbody tr');
    const dataRow = Array.from(rows).find(r => r.textContent?.includes('Cerveza'));
    expect(dataRow?.className).toContain('border-l-amber-400');
  });

  it('row with |variancePct| <= 10 does NOT have amber highlight class', () => {
    mockUseRecipeVarianceReport.mockReturnValue({ isLoading: false, data: { ok: true, data: [ROW_LOW] } });
    const { container } = renderWithProviders(<RecipeVarianceReport dateRange={dateRange} />);
    const rows = container.querySelectorAll('tbody tr');
    const dataRow = Array.from(rows).find(r => r.textContent?.includes('Hielo'));
    expect(dataRow?.className ?? '').not.toContain('border-l-amber-400');
  });

  it('renders LoadingSpinner while isLoading', () => {
    mockUseRecipeVarianceReport.mockReturnValue({ isLoading: true, data: undefined });
    renderWithProviders(<RecipeVarianceReport dateRange={dateRange} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
