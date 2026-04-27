/**
 * RTL component tests for TipDistributionPanel.
 * Mocks useStaffTips and ExportButtons to isolate rendering behavior.
 *
 * AC verified:
 *   S10-04.1 — DataTable with columns: Staff Member, Total Tips
 *   S10-04.2 — ExportButtons shown when rows > 0
 *   S10-04.3 — LoadingSpinner shown while loading
 *   S10-04.4 — EmptyState shown when no data
 */

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@shared/lib/test-utils';
import { TipDistributionPanel } from './TipDistributionPanel';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockUseStaffTips = vi.fn();

vi.mock('@entities/staff', () => ({
  useStaffTips: () => mockUseStaffTips(),
}));

vi.mock('@features/export-report', () => ({
  ExportButtons: () => <button type="button">Export</button>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const dateRange = { from: new Date('2026-04-01T00:00:00'), to: new Date('2026-04-30T23:59:59') };

const tipRows = [
  { staffId: 'staff-1', staffName: 'Alice', totalTips: 150 },
  { staffId: 'staff-2', staffName: 'Bob', totalTips: 80 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TipDistributionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('S10-04.3 — shows LoadingSpinner while loading', () => {
    mockUseStaffTips.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('S10-04.1 — renders DataTable with expected column headers', () => {
    mockUseStaffTips.mockReturnValue({ data: { ok: true, data: tipRows }, isLoading: false });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByText('Staff Member')).toBeInTheDocument();
    expect(screen.getByText('Total Tips')).toBeInTheDocument();
  });

  it('S10-04.1 — renders staff name rows', () => {
    mockUseStaffTips.mockReturnValue({ data: { ok: true, data: tipRows }, isLoading: false });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('S10-04.2 — shows ExportButtons when rows > 0', () => {
    mockUseStaffTips.mockReturnValue({ data: { ok: true, data: tipRows }, isLoading: false });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('S10-04.4 — shows EmptyState when result has zero rows', () => {
    mockUseStaffTips.mockReturnValue({ data: { ok: true, data: [] }, isLoading: false });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByText('No tip data')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  it('S10-04.4 — shows EmptyState when data is undefined (not yet loaded)', () => {
    mockUseStaffTips.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByText('No tip data')).toBeInTheDocument();
  });

  it('S10-04.4 — shows EmptyState (no export button) when result is an error', () => {
    mockUseStaffTips.mockReturnValue({
      data: { ok: false, error: { code: 'SUPABASE_ERROR', message: 'fail' } },
      isLoading: false,
    });
    renderWithProviders(<TipDistributionPanel dateRange={dateRange} />);

    expect(screen.getByText('No tip data')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });
});
