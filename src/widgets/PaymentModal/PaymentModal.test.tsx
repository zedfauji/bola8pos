import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab/model/types';
import type { OrderItem, Product } from '@shared/lib/domain';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { printReceipt, openCashDrawer } from '@shared/lib/pos-printer';
import { err, ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';
import { PaymentModal, type PaymentProcessors } from './index';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@shared/lib/pos-printer', () => ({
  printReceipt: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  openCashDrawer: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  testPrint: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

const categoryId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function miniProduct(partial: { id: string; name: string; basePrice: number }): Product {
  return {
    id: partial.id,
    name: partial.name,
    categoryId,
    basePrice: partial.basePrice,
    happyHourPrice: null,
    sku: null,
    isActive: true,
    imageUrl: null,
    modifiers: [],
  };
}

function orderItem(partial: {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  modifierPriceDelta?: number;
  product: Product;
}): OrderItem {
  return {
    id: partial.id,
    orderId: partial.orderId,
    productId: partial.productId,
    quantity: partial.quantity,
    unitPrice: partial.unitPrice,
    modifierIds: [],
    modifierPriceDelta: partial.modifierPriceDelta ?? 0,
    notes: null,
    modifiers: [],
    product: partial.product,
  };
}

const staffId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
const shiftId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
const openedAt = new Date('2026-04-17T10:00:00.000Z');

const tabNoPool: Tab = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
  customerName: 'Sarah J.',
  tableNumber: 1,
  staffId,
  shiftId,
  openedAt,
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  items: [
    orderItem({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddd01',
      orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      productId: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
      quantity: 2,
      unitPrice: 6.5,
      product: miniProduct({
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
        name: 'Beer',
        basePrice: 6.5,
      }),
    }),
    orderItem({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddd02',
      orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      productId: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
      quantity: 1,
      unitPrice: 9,
      product: miniProduct({
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
        name: 'Whiskey',
        basePrice: 9,
      }),
    }),
  ],
  poolCharges: [],
};

const tabWithPool: Tab = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
  customerName: 'Mike R.',
  tableNumber: 2,
  staffId,
  shiftId,
  openedAt,
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  items: [
    orderItem({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddd03',
      orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef',
      productId: 'ffffffff-ffff-ffff-ffff-fffffffffff3',
      quantity: 1,
      unitPrice: 8,
      product: miniProduct({
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff3',
        name: 'Rum',
        basePrice: 8,
      }),
    }),
  ],
  poolCharges: [
    {
      sessionId: '99999999-9999-9999-9999-999999999999',
      tableNumber: 3,
      tableLabel: 'Pool',
      billedMinutes: 90,
      ratePerHour: 10,
      totalCharge: 15,
    },
  ],
};

const tabRappi: Tab = {
  ...tabNoPool,
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
  rappiOrderId: 'RAPPI-999',
};

function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  const base: ReceiptData = {
    receiptNumber: 'RECEIPT1',
    tabId: tabNoPool.id,
    customerName: 'Sarah J.',
    cashierName: 'Staff',
    barName: 'Test Bar',
    barAddress: '1 Main St',
    items: [
      { name: 'Beer', quantity: 2, unitPrice: 6.5, lineTotal: 13 },
      { name: 'Whiskey', quantity: 1, unitPrice: 9, lineTotal: 9 },
    ],
    subtotal: 22,
    tipAmount: 3.3,
    total: 25.3,
    paymentMethod: 'cash',
    processedAt: new Date('2026-04-17T12:00:00.000Z'),
    squareReceiptUrl: null,
    tenderedAmount: 40,
    changeAmount: 14.7,
  };
  return { ...base, ...overrides };
}

function defaultProcessorMocks(receipt: ReceiptData): PaymentProcessors {
  return {
    processCashPayment: vi
      .fn()
      .mockResolvedValue(
        ok({ paymentId: 'pay-1', changeAmount: receipt.changeAmount ?? 0, receiptData: receipt })
      ),
    processCardPayment: vi.fn().mockResolvedValue(ok({ paymentId: 'pay-2', receiptData: receipt })),
    processRappiPayment: vi
      .fn()
      .mockResolvedValue(ok({ paymentId: 'pay-3', receiptData: receipt })),
  };
}

function renderModal(
  tab: Tab,
  overrides: Partial<{
    open: boolean;
    processors: PaymentProcessors;
    onClose: () => void;
    onPaymentSuccess: () => void;
    staffId: string;
  }> = {}
) {
  const onClose = overrides.onClose ?? vi.fn();
  const receipt = makeReceipt({ tabId: tab.id, customerName: tab.customerName });
  const processors = overrides.processors ?? defaultProcessorMocks(receipt);
  const sid = overrides.staffId ?? staffId;
  renderWithProviders(
    <PaymentModal
      open={overrides.open ?? true}
      tab={tab}
      staffId={sid}
      onClose={onClose}
      {...(overrides.onPaymentSuccess != null
        ? { onPaymentSuccess: overrides.onPaymentSuccess }
        : {})}
      processors={processors}
    />
  );
  return { onClose, processors };
}

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStaffStore.setState({
      currentStaff: {
        id: staffId,
        name: 'Cashier',
        email: 'cashier@test.dev',
        role: 'manager',
        pin: '123456',
        isActive: true,
      },
      currentShift: null,
      staffList: [],
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    useStaffStore.getState().logout();
  });

  it('shows customer, item lines, subtotals, and total without pool section', () => {
    renderModal(tabNoPool);
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('heading', { name: 'Sarah J.' })).toBeInTheDocument();
    expect(within(dialog).getByText(/\d\s*item\(s\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Beer/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Whiskey/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$13.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$9.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByText('Items subtotal')).toBeInTheDocument();
    const itemsSubtotalRow = within(dialog)
      .getByText('Items subtotal')
      .closest('div') as HTMLElement;
    expect(within(itemsSubtotalRow).getByLabelText('$22.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByText('Total')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$25.30 dollars')).toBeInTheDocument();
    expect(within(dialog).queryByText('Pool charges')).not.toBeInTheDocument();
  });

  it('renders pool charges when tab has pool charges', () => {
    renderModal(tabWithPool);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Pool charges')).toBeInTheDocument();
    expect(within(dialog).getByText('Table 3 · 90 min')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$15.00 dollars')).toBeInTheDocument();
  });

  it('applies preset tip percentages and custom tip on tabNoPool', async () => {
    const user = userEvent.setup();
    renderModal(tabNoPool);
    const dialog = screen.getByRole('dialog');

    const pct15 = within(dialog).getByRole('button', { name: '15%' });
    const pct10 = within(dialog).getByRole('button', { name: '10%' });
    const pct18 = within(dialog).getByRole('button', { name: '18%' });
    const pct20 = within(dialog).getByRole('button', { name: '20%' });

    expect(pct15.className).toContain('bg-primary');
    expect(pct10.className).toContain('border-border');
    expect(within(dialog).getByLabelText('$3.30 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$25.30 dollars')).toBeInTheDocument();

    await user.click(pct10);
    expect(within(dialog).getByLabelText('$2.20 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$24.20 dollars')).toBeInTheDocument();

    await user.click(pct18);
    expect(within(dialog).getByLabelText('$3.96 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$25.96 dollars')).toBeInTheDocument();

    await user.click(pct20);
    expect(within(dialog).getByLabelText('$4.40 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$26.40 dollars')).toBeInTheDocument();

    await user.click(pct15);
    expect(within(dialog).getByLabelText('$3.30 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$25.30 dollars')).toBeInTheDocument();

    const customInput = within(dialog).getByLabelText('Custom tip');
    await user.clear(customInput);
    await user.type(customInput, '5.00');
    expect(within(dialog).getByLabelText('$5.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$27.00 dollars')).toBeInTheDocument();

    await user.click(pct10);
    expect(within(dialog).getByLabelText('$24.20 dollars')).toBeInTheDocument();
  });

  it('toggles payment method between cash and card', async () => {
    const user = userEvent.setup();
    renderModal(tabNoPool);
    const dialog = screen.getByRole('dialog');

    const cash = within(dialog).getByRole('button', { name: 'Cash' });
    const card = within(dialog).getByRole('button', { name: 'Card' });
    expect(cash.className).toContain('bg-primary');
    expect(card.className).toContain('border-border');

    await user.click(card);
    expect(card.className).toContain('bg-primary');
    expect(cash.className).toContain('border-border');

    await user.click(cash);
    expect(cash.className).toContain('bg-primary');
    expect(card.className).toContain('border-border');
  });

  it('shows Rappi method when tab has rappiOrderId', () => {
    renderModal(tabRappi);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Rappi' })).toBeInTheDocument();
  });

  it('disables process payment until tendered covers total, then shows receipt', async () => {
    const user = userEvent.setup();
    const onPaymentSuccess = vi.fn();
    const receipt = makeReceipt();
    const processors: PaymentProcessors = {
      processCashPayment: vi
        .fn()
        .mockResolvedValue(ok({ paymentId: 'p1', changeAmount: 4.7, receiptData: receipt })),
      processCardPayment: vi.fn(),
      processRappiPayment: vi.fn(),
    };
    renderModal(tabNoPool, { processors, onPaymentSuccess });

    const payBtn = screen.getByRole('button', { name: 'Process payment' });
    expect(payBtn).toBeDisabled();

    const tendered = screen.getByLabelText('Amount tendered');
    await user.clear(tendered);
    await user.type(tendered, '30.00');

    expect(payBtn).not.toBeDisabled();
    await user.click(payBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Receipt' })).toBeInTheDocument();
    });
    expect(onPaymentSuccess).toHaveBeenCalled();
    expect(processors.processCashPayment).toHaveBeenCalledWith(tabNoPool.id, 22, 3.3, 30);
    expect(openCashDrawer).toHaveBeenCalled();
    expect(printReceipt).toHaveBeenCalledWith(receipt);
    expect(vi.mocked(openCashDrawer).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(printReceipt).mock.invocationCallOrder[0]!
    );

    await user.click(screen.getByRole('button', { name: 'Done' }));
  });

  it('prints without opening drawer after card payment', async () => {
    const user = userEvent.setup();
    const receipt = makeReceipt();
    const processors: PaymentProcessors = {
      processCashPayment: vi.fn(),
      processCardPayment: vi.fn().mockResolvedValue(ok({ paymentId: 'p2', receiptData: receipt })),
      processRappiPayment: vi.fn(),
    };
    renderModal(tabNoPool, { processors });

    await user.click(screen.getByRole('button', { name: 'Card' }));
    await user.click(screen.getByRole('button', { name: 'Confirm card payment' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Receipt' })).toBeInTheDocument();
    });
    expect(printReceipt).toHaveBeenCalledWith(receipt);
    expect(openCashDrawer).not.toHaveBeenCalled();
  });

  it('shows payment error alert and stays open on failure', async () => {
    const user = userEvent.setup();
    const processors: PaymentProcessors = {
      processCashPayment: vi
        .fn()
        .mockResolvedValue(err({ code: 'VALIDATION_ERROR', message: 'Insufficient tender' })),
      processCardPayment: vi.fn(),
      processRappiPayment: vi.fn(),
    };
    const onClose = vi.fn();
    renderModal(tabNoPool, { processors, onClose });

    const tendered = screen.getByLabelText('Amount tendered');
    await user.clear(tendered);
    await user.type(tendered, '50.00');

    await user.click(screen.getByRole('button', { name: 'Process payment' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Insufficient tender');
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(tabNoPool, { onClose });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables close_tab for bartender and shows manager tooltip', async () => {
    const user = userEvent.setup();
    useStaffStore.setState({
      currentStaff: {
        id: staffId,
        name: 'B',
        email: 'b@b.dev',
        role: 'bartender',
        pin: '123456',
        isActive: true,
      },
      currentShift: null,
      staffList: [],
      isAuthenticated: true,
    });
    renderModal(tabNoPool);

    const payBtn = screen.getByRole('button', { name: 'Process payment' });
    expect(payBtn).toBeDisabled();
    await user.hover(payBtn);
    const tips = await screen.findAllByText('Manager access required');
    expect(tips.length).toBeGreaterThanOrEqual(1);
  });

  it('shows change due for cash tendered above total', async () => {
    const user = userEvent.setup();
    renderModal(tabNoPool);
    const dialog = screen.getByRole('dialog');

    const tendered = within(dialog).getByLabelText('Amount tendered');
    await user.clear(tendered);
    await user.type(tendered, '40.00');

    expect(within(dialog).getByText('Change due')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$14.70 dollars')).toBeInTheDocument();
  });

  it('completes Rappi payment without cash drawer', async () => {
    const user = userEvent.setup();
    const receipt = makeReceipt({
      tabId: tabRappi.id,
      paymentMethod: 'rappi',
      tipAmount: 0,
      total: 22,
    });
    const processors: PaymentProcessors = {
      processCashPayment: vi.fn(),
      processCardPayment: vi.fn(),
      processRappiPayment: vi
        .fn()
        .mockResolvedValue(ok({ paymentId: 'pay-r', receiptData: receipt })),
    };
    renderModal(tabRappi, { processors });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Rappi' })).toHaveClass(/bg-primary/);

    await user.click(screen.getByRole('button', { name: 'Confirm & close tab' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Receipt' })).toBeInTheDocument();
    });
    expect(processors.processRappiPayment).toHaveBeenCalledWith(tabRappi.id, 22, 'RAPPI-999');
    expect(openCashDrawer).not.toHaveBeenCalled();
    expect(printReceipt).toHaveBeenCalled();
  });

  it('passes BBVA terminal reference to card processor', async () => {
    const user = userEvent.setup();
    const receipt = makeReceipt({ paymentMethod: 'card' });
    const processors: PaymentProcessors = {
      processCashPayment: vi.fn(),
      processCardPayment: vi.fn().mockResolvedValue(ok({ paymentId: 'p2', receiptData: receipt })),
      processRappiPayment: vi.fn(),
    };
    renderModal(tabNoPool, { processors });

    await user.click(screen.getByRole('button', { name: 'Card' }));
    await user.type(screen.getByLabelText(/Reference/i), 'AUTH-777');
    await user.click(screen.getByRole('button', { name: 'Confirm card payment' }));

    await waitFor(() => {
      expect(processors.processCardPayment).toHaveBeenCalled();
    });
    expect(processors.processCardPayment).toHaveBeenCalledWith(tabNoPool.id, 22, 3.3, 'AUTH-777');
  });

  it('keeps primary disabled when staffId empty', () => {
    renderModal(tabNoPool, { staffId: '' });
    expect(screen.getByRole('button', { name: 'Process payment' })).toBeDisabled();
  });

  it('toasts hardware error when cash drawer fails after cash payment', async () => {
    const user = userEvent.setup();
    const receipt = makeReceipt();
    const processors: PaymentProcessors = {
      processCashPayment: vi
        .fn()
        .mockResolvedValue(ok({ paymentId: 'p1', changeAmount: 4.7, receiptData: receipt })),
      processCardPayment: vi.fn(),
      processRappiPayment: vi.fn(),
    };
    vi.mocked(openCashDrawer).mockResolvedValue(
      err({ code: 'TAURI_ERROR', message: 'Drawer failed' })
    );

    renderModal(tabNoPool, { processors });

    const tendered = screen.getByLabelText('Amount tendered');
    await user.clear(tendered);
    await user.type(tendered, '30.00');
    await user.click(screen.getByRole('button', { name: 'Process payment' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Drawer failed');
    });
  });
});
