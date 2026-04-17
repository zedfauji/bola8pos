import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@entities/tab/model/types';
import type { OrderItem, Product } from '@shared/lib/domain';
import { err, ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';
import { PaymentModal, type PaymentModalProps } from './index';

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

function renderModal(
  tab: Tab,
  overrides: Partial<{
    open: boolean;
    onPayment: PaymentModalProps['onPayment'];
    onClose: () => void;
  }> = {}
) {
  const onPayment = (overrides.onPayment ??
    vi.fn().mockResolvedValue(ok(undefined))) as PaymentModalProps['onPayment'];
  const onClose = overrides.onClose ?? vi.fn();
  renderWithProviders(
    <PaymentModal open={overrides.open ?? true} tab={tab} onPayment={onPayment} onClose={onClose} />
  );
  return { onPayment, onClose };
}

describe('PaymentModal', () => {
  it('shows customer, item lines, subtotals, and running total without pool section', () => {
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
    expect(within(dialog).getByText('Running total')).toBeInTheDocument();
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

  it('calls onPayment with cash and 15% tip, closes on success, and shows processing state', async () => {
    const user = userEvent.setup();
    let resolvePayment: (value: ReturnType<typeof ok<void>>) => void = () => {};
    const paymentPromise = new Promise<ReturnType<typeof ok<void>>>(resolve => {
      resolvePayment = resolve;
    });
    const onPayment = vi.fn().mockReturnValue(paymentPromise);
    const onClose = vi.fn();
    renderModal(tabNoPool, { onPayment, onClose });

    await user.click(screen.getByRole('button', { name: 'Process Payment' }));
    expect(onPayment).toHaveBeenCalledWith('cash', 3.3);

    await waitFor(() => {
      expect(screen.getByText('Processing Payment...')).toBeInTheDocument();
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Processing Payment/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolvePayment(ok(undefined));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows payment error alert and does not call onClose on failure', async () => {
    const user = userEvent.setup();
    const onPayment = vi
      .fn()
      .mockResolvedValue(err({ code: 'PAYMENT_DECLINED', message: 'Card declined' }));
    const onClose = vi.fn();
    renderModal(tabNoPool, { onPayment, onClose });

    await user.click(screen.getByRole('button', { name: 'Process Payment' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Card declined');
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
});
