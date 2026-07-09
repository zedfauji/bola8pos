import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mutateAsyncMock, toastErrorMock, toastSuccessMock, rpcMock, mockSettingsData } = vi.hoisted(
  () => ({
    mutateAsyncMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    rpcMock: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Stable object reference — useEffect([data, ...]) fires on every render if data is recreated
    mockSettingsData: {
      tipDistribution: { floorPct: 34, barPct: 33, kitchenPct: 33 },
    },
  })
);

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('@entities/settings', () => ({
  useSettings: () => ({ data: mockSettingsData }),
  useMutationUpdateSetting: () => ({
    mutateAsync: mutateAsyncMock,
    mutate: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('@shared/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock('@shared/lib/logger-instance', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { TipDistributionSettingsTab } from './TipDistributionSettingsTab';

describe('TipDistributionSettingsTab', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    rpcMock.mockClear();
  });

  it('renders three percentage inputs pre-filled 34/33/33 and a Save button', () => {
    render(<TipDistributionSettingsTab currentRole="admin" />);

    expect(screen.getByLabelText('Floor %').getAttribute('value')).toBe('34');
    expect(screen.getByLabelText('Bar %').getAttribute('value')).toBe('33');
    expect(screen.getByLabelText('Kitchen %').getAttribute('value')).toBe('33');
    expect(screen.getByRole('button', { name: 'Save Tip Split' })).toBeInTheDocument();
  });

  it('editing a value enables Save; clicking Save calls mutateAsync with key=tip_distribution', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(<TipDistributionSettingsTab currentRole="admin" />);

    const floorInput = screen.getByLabelText('Floor %');
    await user.clear(floorInput);
    await user.type(floorInput, '40');
    await user.click(screen.getByRole('button', { name: 'Save Tip Split' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      key: 'tip_distribution',
      value: { floorPct: 40, barPct: 33, kitchenPct: 33 },
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Tip split saved.');
  });

  it('shows a non-blocking warning when percentages sum to 90 while keeping Save enabled (D-01)', async () => {
    const user = userEvent.setup();

    render(<TipDistributionSettingsTab currentRole="admin" />);

    const floorInput = screen.getByLabelText('Floor %');
    await user.clear(floorInput);
    await user.type(floorInput, '24');

    expect(screen.getByText(/Percentages total 90% — not 100%/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tip Split' })).not.toBeDisabled();
  });

  it('keeps local form state and shows an error toast when save fails', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Save failed' },
    });
    const user = userEvent.setup();

    render(<TipDistributionSettingsTab currentRole="admin" />);

    const floorInput = screen.getByLabelText('Floor %');
    await user.clear(floorInput);
    await user.type(floorInput, '40');
    await user.click(screen.getByRole('button', { name: 'Save Tip Split' }));

    expect(toastErrorMock).toHaveBeenCalledWith('Save failed');
    expect(screen.getByLabelText('Floor %').getAttribute('value')).toBe('40');
  });
});
