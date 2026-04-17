import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingSettingsTab } from './BillingSettingsTab';

const mutateAsyncMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('@entities/settings', () => ({
  useSettings: () => ({
    data: {
      billing: {
        taxRatePercent: 16,
        defaultTipPercentages: [10, 15, 18, 20],
        paymentMethods: { cash: true, bbvaCard: true, rappi: true },
      },
    },
  }),
  useMutationUpdateSetting: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe('BillingSettingsTab', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('keeps local form state when save fails', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Save failed' },
    });
    const user = userEvent.setup();

    render(<BillingSettingsTab currentRole="manager" />);

    const taxInput = screen.getByLabelText('Tax rate (IVA %)');
    await user.clear(taxInput);
    await user.type(taxInput, '20');
    await user.click(screen.getByRole('button', { name: 'Save Billing' }));

    expect(toastErrorMock).toHaveBeenCalledWith('Save failed');
    expect(screen.getByLabelText('Tax rate (IVA %)').getAttribute('value')).toBe('20');
  });
});
