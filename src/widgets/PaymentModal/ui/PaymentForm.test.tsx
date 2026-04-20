/**
 * Unit tests for PaymentForm — card charge override feature
 *
 * Covers: MoneyInput for charge amount, default value, onChange, reset button
 * visibility/behavior, canSubmit guard, and processCardPayment call args.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab/model/types';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';

import type { PaymentProcessors } from './PaymentForm';
import { PaymentForm } from './PaymentForm';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@shared/lib/pos-printer', () => ({
  printReceipt: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  openCashDrawer: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

// taxRatePercent=0 keeps assertions simple — no tax arithmetic needed.
vi.mock('@entities/settings', () => {
  const stableSettings = {
    billing: {
      taxRatePercent: 0,
      defaultTipPercentages: [10, 15, 18, 20],
      paymentMethods: { cash: true, bbvaCard: true, rappi: false },
    },
    paymentLabels: { cash: 'Efectivo', card: 'Terminal BBVA', rappi: 'Rappi' },
  };
  return { useSettings: () => ({ data: stableSettings }) };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const staffId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const shiftId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/**
 * Minimal Tab with items totalling $20 (no pool charges, no tax with taxRate=0).
 * runningTotal = $20 + tip (15% of $20 = $3) = $23.
 */
const testTab: Tab = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  customerName: 'Test Customer',
  tableNumber: null,
  staffId,
  shiftId,
  openedAt: new Date('2026-04-17T10:00:00.000Z'),
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  items: [
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddd01',
      orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      productId: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
      quantity: 2,
      unitPrice: 10,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
  ],
  poolCharges: [],
};

function makeReceipt(): ReceiptData {
  return {
    receiptNumber: 'R001',
    tabId: testTab.id,
    customerName: testTab.customerName,
    cashierName: 'Staff',
    barName: 'Test Bar',
    barAddress: '1 Main St',
    items: [],
    subtotal: 20,
    tipAmount: 0,
    total: 20,
    paymentMethod: 'card',
    processedAt: new Date(),
    squareReceiptUrl: null,
    tenderedAmount: null,
    changeAmount: null,
  };
}

function makeProcessors(overrides: Partial<PaymentProcessors> = {}): PaymentProcessors {
  const receipt = makeReceipt();
  return {
    processCashPayment: vi
      .fn()
      .mockResolvedValue(ok({ paymentId: 'p-cash', changeAmount: 0, receiptData: receipt })),
    processCardPayment: vi
      .fn()
      .mockResolvedValue(ok({ paymentId: 'p-card', receiptData: receipt })),
    processRappiPayment: vi
      .fn()
      .mockResolvedValue(ok({ paymentId: 'p-rappi', receiptData: receipt })),
    ...overrides,
  };
}

function renderForm(processors: PaymentProcessors = makeProcessors(), onPaymentSuccess = vi.fn()) {
  renderWithProviders(
    <PaymentForm
      tab={testTab}
      staffId={staffId}
      onPaymentSuccess={onPaymentSuccess}
      processors={processors}
    />
  );
}

/** Switch to card method */
async function selectCardMethod(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('payment-btn-card'));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useStaffStore.setState({
    currentStaff: {
      id: staffId,
      name: 'Test Manager',
      email: 'manager@test.dev',
      role: 'manager',
      pin: '123456',
      isActive: true,
    },
    currentShift: null,
    staffList: [],
    isAuthenticated: true,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentForm — card charge override', () => {
  it('renders MoneyInput for charge amount when method is card', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);
    expect(screen.getByLabelText('Charge amount')).toBeInTheDocument();
  });

  it('MoneyInput defaults to runningTotal when no override is set', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);
    // baseSubtotal=20, taxRate=0, tip=15% of 20=3, runningTotal=23
    const input = screen.getByLabelText('Charge amount');
    expect(input).toHaveValue('23.00');
  });

  it('onChange on MoneyInput sets the override', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);

    const input = screen.getByLabelText('Charge amount');
    await user.clear(input);
    await user.type(input, '50.00');
    // blur to commit the value
    await user.tab();

    expect(input).toHaveValue('50.00');
  });

  it('reset button is hidden when override is null', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);

    expect(screen.queryByTestId('card-override-reset')).not.toBeInTheDocument();
  });

  it('reset button appears when override is set', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);

    const input = screen.getByLabelText('Charge amount');
    await user.clear(input);
    await user.type(input, '99.00');
    await user.tab();

    expect(screen.getByTestId('card-override-reset')).toBeInTheDocument();
  });

  it('reset button clears the override', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);

    const input = screen.getByLabelText('Charge amount');
    await user.clear(input);
    await user.type(input, '99.00');
    await user.tab();

    await user.click(screen.getByTestId('card-override-reset'));

    // reset button should disappear again
    expect(screen.queryByTestId('card-override-reset')).not.toBeInTheDocument();
    // input should return to runningTotal
    expect(input).toHaveValue('23.00');
  });

  it('submit button is disabled when cardChargeOverride is 0', async () => {
    const user = userEvent.setup();
    renderForm();
    await selectCardMethod(user);

    const input = screen.getByLabelText('Charge amount');
    await user.clear(input);
    await user.type(input, '0.00');
    await user.tab();

    expect(screen.getByRole('button', { name: /confirm card payment/i })).toBeDisabled();
  });

  it('processCardPayment called with override amount and tipAmount=0 when override set', async () => {
    const user = userEvent.setup();
    const processors = makeProcessors();
    renderForm(processors);
    await selectCardMethod(user);

    const input = screen.getByLabelText('Charge amount');
    await user.clear(input);
    await user.type(input, '45.00');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /confirm card payment/i }));

    await waitFor(() => {
      expect(processors.processCardPayment).toHaveBeenCalled();
    });
    // override amount=45, tipAmount=0 (because override is set)
    expect(processors.processCardPayment).toHaveBeenCalledWith(testTab.id, 45, 0, undefined);
  });

  it('processCardPayment called with baseSubtotal and tipAmount when no override', async () => {
    const user = userEvent.setup();
    const processors = makeProcessors();
    renderForm(processors);
    await selectCardMethod(user);

    // Do NOT modify the charge amount — leave it as default (runningTotal)
    await user.click(screen.getByRole('button', { name: /confirm card payment/i }));

    await waitFor(() => {
      expect(processors.processCardPayment).toHaveBeenCalled();
    });
    // No override: chargeAmount=baseSubtotal=20, tipAmount=3 (15% of 20, taxRate=0)
    expect(processors.processCardPayment).toHaveBeenCalledWith(testTab.id, 20, 3, undefined);
  });
});
