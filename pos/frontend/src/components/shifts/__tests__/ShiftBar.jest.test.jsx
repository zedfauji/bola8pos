import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ShiftBar from '../ShiftBar.jsx';

jest.mock('../../../services/api', () => {
  const mock = {
    getActiveShift: jest.fn(async () => ({ id: 's1', expected: 200, counted: null, over_short: null, movements: [] })),
    openShift: jest.fn(async () => ({})),
    addShiftMovement: jest.fn(async () => ({})),
    closeShift: jest.fn(async () => ({})),
    getShiftSummary: jest.fn(async () => ({
      shift: { id: 's1', opened_at: '2025-08-12 12:00:00', closed_at: null, start_cash: 200 },
      expected_cash: 200,
      over_short: 0,
      cash_sales: 0,
      drops_total: 0,
      payouts_total: 0,
      adjustments_total: 0,
    })),
  };
  return { __esModule: true, default: mock, api: mock };
});

const mockIsPinRequired = jest.fn(() => false);
const mockVerifyPin = jest.fn(async () => ({ ok: true }));

jest.mock('../../../contexts/SettingsContext', () => {
  const actual = jest.requireActual('../../../contexts/SettingsContext');
  return {
    ...actual,
    useSettings: () => ({
      isPinRequired: mockIsPinRequired,
      verifyPin: mockVerifyPin,
      access: { approvalThresholds: { cashPayoutAmount: 50 } },
    }),
  };
});

beforeEach(() => {
  mockIsPinRequired.mockReset().mockReturnValue(false);
  mockVerifyPin.mockReset().mockResolvedValue({ ok: true });
  // Ensure getActiveShift resolves to an active shift for all tests
  const api = require('../../../services/api').default;
  api.getActiveShift.mockResolvedValue({ id: 's1', expected: 200, counted: null, over_short: null, movements: [] });
  // Clear prior calls to avoid cross-test pollution
  api.openShift.mockClear();
  api.addShiftMovement.mockClear();
  api.closeShift.mockClear();
  api.getShiftSummary.mockClear();
});

async function setup() {
  render(<ShiftBar />);
  return {
    user: {
      click: async (el) => fireEvent.click(el),
      type: async (el, text) => fireEvent.input(el, { target: { value: text } }),
      clear: async (el) => fireEvent.input(el, { target: { value: '' } }),
    },
    api: (await import('../../../services/api')).default,
  };
}

describe('ShiftBar payout PIN behavior (Jest env)', () => {
  it('below threshold skips PIN when not globally required', async () => {
    const { user } = await setup();
    // Ensure a shift is open; if not, open one via modal
    if (screen.queryByText(/Shift:/) == null) {
      await user.click(screen.getByRole('button', { name: /Open Shift/i }));
      const start = screen.getByTestId('open-start-cash');
      await user.clear(start);
      await user.type(start, '200');
      await user.click(screen.getByRole('button', { name: /^Open$/i }));
      await waitFor(() => expect(screen.getByText(/Shift:/)).toBeInTheDocument());
    }

    await user.click(screen.getByRole('button', { name: /Payout/i }));

    const amount = screen.getByTestId('movement-amount');
    await user.clear(amount);
    await user.type(amount, '20');
    const reason = screen.getByTestId('movement-reason');
    await user.type(reason, 'petty cash');

    await user.click(screen.getByRole('button', { name: /Add/i }));

    expect(mockVerifyPin).not.toHaveBeenCalled();
    const api = (await import('../../../services/api')).default;
    expect(api.addShiftMovement).toHaveBeenCalled();
  });

  it('at/above threshold requires PIN with success', async () => {
    mockVerifyPin.mockResolvedValueOnce({ ok: true });
    const { user } = await setup();
    if (screen.queryByText(/Shift:/) == null) {
      await user.click(screen.getByRole('button', { name: /Open Shift/i }));
      const start = screen.getByTestId('open-start-cash');
      await user.clear(start);
      await user.type(start, '200');
      await user.click(screen.getByRole('button', { name: /^Open$/i }));
      await waitFor(() => expect(screen.getByText(/Shift:/)).toBeInTheDocument());
    }

    await user.click(screen.getByRole('button', { name: /Payout/i }));
    const amount = screen.getByTestId('movement-amount');
    await user.clear(amount);
    await user.type(amount, '60');
    const reason = screen.getByTestId('movement-reason');
    await user.type(reason, 'supplier');

    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('1234');
    await user.click(screen.getByRole('button', { name: /Add/i }));

    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('1234'));
    const api = (await import('../../../services/api')).default;
    await waitFor(() => expect(api.addShiftMovement).toHaveBeenCalled());
    promptSpy.mockRestore();
  });

  it('at/above threshold with invalid PIN blocks', async () => {
    mockVerifyPin.mockResolvedValueOnce({ ok: false });
    const { user } = await setup();
    if (screen.queryByText(/Shift:/) == null) {
      await user.click(screen.getByRole('button', { name: /Open Shift/i }));
      const start = screen.getByTestId('open-start-cash');
      await user.clear(start);
      await user.type(start, '200');
      await user.click(screen.getByRole('button', { name: /^Open$/i }));
      await waitFor(() => expect(screen.getByText(/Shift:/)).toBeInTheDocument());
    }

    await user.click(screen.getByRole('button', { name: /Payout/i }));
    const amount = screen.getByTestId('movement-amount');
    await user.clear(amount);
    await user.type(amount, '60');
    const reason = screen.getByTestId('movement-reason');
    await user.type(reason, 'supplier');

    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('9999');
    await user.click(screen.getByRole('button', { name: /Add/i }));

    const api = (await import('../../../services/api')).default;
    await waitFor(() => expect(api.addShiftMovement).not.toHaveBeenCalled());
    expect(screen.getByText(/Invalid PIN/i)).toBeInTheDocument();
    promptSpy.mockRestore();
  });
});
