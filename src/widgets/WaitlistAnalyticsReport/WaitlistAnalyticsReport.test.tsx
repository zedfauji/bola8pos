import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as QueriesReports from '@entities/tab/model/queries-reports';
import type { WaitlistMetricsRow } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';
import { WaitlistAnalyticsReport } from './WaitlistAnalyticsReport';

const mockUseWaitlistAnalyticsReport = vi.fn();

vi.mock('@entities/tab/model/queries-reports', async importOriginal => {
  const actual = await importOriginal<typeof QueriesReports>();
  return {
    ...actual,
    useWaitlistAnalyticsReport: () => mockUseWaitlistAnalyticsReport(),
  };
});
vi.mock('@features/export-report', () => ({
  ExportButtons: () => <button>Export</button>,
}));

const dateRange = { from: new Date('2026-01-01'), to: new Date('2026-01-31') };

const SAMPLE_ROW: WaitlistMetricsRow = {
  date: '2026-01-01',
  partiesSeated: 12,
  avgQuotedWait: 15.5,
  avgActualWait: 18.2,
  noShowRate: 5.0,
};

const ROW_NULL_QUOTED: WaitlistMetricsRow = {
  date: '2026-01-02',
  partiesSeated: 8,
  avgQuotedWait: null,
  avgActualWait: 20.0,
  noShowRate: null,
};

describe('WaitlistAnalyticsReport', () => {
  it('renders Skeleton cards while isLoading', () => {
    mockUseWaitlistAnalyticsReport.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = renderWithProviders(<WaitlistAnalyticsReport dateRange={dateRange} />);
    // Skeleton renders divs with animate-pulse class (from shared/ui/skeleton.tsx)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders EmptyState with "No waitlist activity" when rows is empty', () => {
    mockUseWaitlistAnalyticsReport.mockReturnValue({
      isLoading: false,
      data: { ok: true, data: [] },
    });
    renderWithProviders(<WaitlistAnalyticsReport dateRange={dateRange} />);
    expect(screen.getByText('No waitlist activity')).toBeInTheDocument();
  });

  it('renders "Parties Seated" metric card label with data', () => {
    mockUseWaitlistAnalyticsReport.mockReturnValue({
      isLoading: false,
      data: { ok: true, data: [SAMPLE_ROW] },
    });
    renderWithProviders(<WaitlistAnalyticsReport dateRange={dateRange} />);
    expect(screen.getByText('Parties Seated')).toBeInTheDocument();
    expect(screen.getByText('No-Show Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Quoted Wait')).toBeInTheDocument();
    expect(screen.getByText('Avg Actual Wait')).toBeInTheDocument();
  });

  it('renders "—" for avgQuotedWait when null', () => {
    mockUseWaitlistAnalyticsReport.mockReturnValue({
      isLoading: false,
      data: { ok: true, data: [ROW_NULL_QUOTED] },
    });
    renderWithProviders(<WaitlistAnalyticsReport dateRange={dateRange} />);
    // Avg Quoted Wait card should show "—"
    const cards = screen.getAllByText('—');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders "Queue Length by Hour" heatmap section', () => {
    mockUseWaitlistAnalyticsReport.mockReturnValue({
      isLoading: false,
      data: { ok: true, data: [SAMPLE_ROW] },
    });
    renderWithProviders(<WaitlistAnalyticsReport dateRange={dateRange} />);
    expect(screen.getByText('Queue Length by Hour')).toBeInTheDocument();
  });
});
