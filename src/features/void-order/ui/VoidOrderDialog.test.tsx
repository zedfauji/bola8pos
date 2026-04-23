import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffStore } from '@entities/staff/model/store';
import type { Order } from '@shared/lib/domain';
import { err, ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';
import { useVoidOrder } from '../model/useVoidOrder';
import { VoidOrderDialog } from './VoidOrderDialog';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../model/useVoidOrder', () => ({
  useVoidOrder: vi.fn(),
}));

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

const mockVoidOrderFn = vi.fn();

const mockStaff = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Test Bartender',
  email: 'bartender@example.com',
  role: 'bartender' as const,
  pin: '123456',
  isActive: true,
};

const mockOrder: Order = {
  id: '11111111-1111-1111-1111-111111111111',
  tabId: '22222222-2222-2222-2222-222222222222',
  staffId: '33333333-3333-3333-3333-333333333333',
  createdAt: new Date('2026-04-17T12:00:00.000Z'),
  status: 'pending',
  notes: null,
  items: [
    {
      id: '44444444-4444-4444-4444-444444444444',
      orderId: '11111111-1111-1111-1111-111111111111',
      productId: '55555555-5555-5555-5555-555555555555',
      quantity: 2,
      unitPrice: 12,
      modifierIds: [],
      modifierPriceDelta: 1,
      notes: null,
      kdsStatus: 'pending',
      modifiers: [],
      product: {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'item1',
        categoryId: '66666666-6666-6666-6666-666666666666',
        basePrice: 12,
        happyHourPrice: null,
        sku: null,
        isActive: true,
        imageUrl: null,
        stock_threshold: null,
        modifiers: [],
      },
    },
    {
      id: '77777777-7777-7777-7777-777777777777',
      orderId: '11111111-1111-1111-1111-111111111111',
      productId: '88888888-8888-8888-8888-888888888888',
      quantity: 1,
      unitPrice: 9,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      kdsStatus: 'pending',
      modifiers: [],
      product: {
        id: '88888888-8888-8888-8888-888888888888',
        name: 'item2',
        categoryId: '66666666-6666-6666-6666-666666666666',
        basePrice: 9,
        happyHourPrice: null,
        sku: null,
        isActive: true,
        imageUrl: null,
        stock_threshold: null,
        modifiers: [],
      },
    },
  ],
};

describe('VoidOrderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVoidOrder).mockReturnValue({
      voidOrder: mockVoidOrderFn,
      isPending: false,
    });
    mockVoidOrderFn.mockResolvedValue(ok(undefined));
    vi.mocked(useStaffStore).mockImplementation(fn =>
      fn({
        currentStaff: mockStaff,
        currentShift: null,
        staffList: [],
        isAuthenticated: true,
        managerGrantedActions: new Set<string>(),
        login: vi.fn(),
        logout: vi.fn(),
        updateShift: vi.fn(),
        setStaffList: vi.fn(),
        grantManagerActions: vi.fn(),
      })
    );
  });

  function renderDialog(
    overrides: Partial<{
      open: boolean;
      tabId: string;
      order: Order | null;
      onOpenChange: (open: boolean) => void;
      onSuccess: () => void;
    }> = {}
  ) {
    const onOpenChange = overrides.onOpenChange ?? vi.fn();
    const dialogProps = {
      open: overrides.open ?? true,
      tabId: overrides.tabId ?? 'tab-test-1',
      order: overrides.order ?? mockOrder,
      onOpenChange,
      ...(overrides.onSuccess !== undefined ? { onSuccess: overrides.onSuccess } : {}),
    };
    renderWithProviders(<VoidOrderDialog {...dialogProps} />);
    return { onOpenChange };
  }

  it('displays order summary, totals, reason field when open with order', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Void order?')).toBeInTheDocument();
    expect(within(dialog).getByText('Void reason')).toBeInTheDocument();
    expect(dialog.querySelector('#void-order-reason')).toBeInTheDocument();

    const orderTimeRow = within(dialog).getByText('Order time').closest('div')?.parentElement;
    expect(orderTimeRow?.textContent).toMatch(/\d/);

    const lineItems = dialog.querySelectorAll('ul li');
    expect(lineItems[0]?.textContent?.replace(/\s+/g, ' ')).toMatch(/2\s*x\s*item1/);
    expect(lineItems[1]?.textContent?.replace(/\s+/g, ' ')).toMatch(/1\s*x\s*item2/);
    expect(within(dialog).getByLabelText('$26.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$9.00 dollars')).toBeInTheDocument();
    expect(within(dialog).getByText('Total voided')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('$35.00 dollars')).toBeInTheDocument();
  });

  it('disables Void order when reason is empty', async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Void order' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/void reason/i), 'Spilled drink');
    expect(confirm).not.toBeDisabled();
  });

  it('disables Void order when order is null', () => {
    renderDialog({ order: null });
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Void order' });
    expect(confirm).toBeDisabled();
  });

  it('disables Void order when there is no currentStaff', () => {
    vi.mocked(useStaffStore).mockImplementation(fn =>
      fn({
        currentStaff: null,
        currentShift: null,
        staffList: [],
        isAuthenticated: false,
        managerGrantedActions: new Set<string>(),
        login: vi.fn(),
        logout: vi.fn(),
        updateShift: vi.fn(),
        setStaffList: vi.fn(),
        grantManagerActions: vi.fn(),
      })
    );
    renderDialog();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Void order' })).toBeDisabled();
  });

  it('voids order on success and shows toast', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const { onOpenChange } = renderDialog({ onSuccess });

    await user.type(screen.getByLabelText(/void reason/i), 'Wrong order');
    await user.click(screen.getByRole('button', { name: 'Void order' }));

    await waitFor(() => {
      expect(mockVoidOrderFn).toHaveBeenCalledWith({
        tabId: 'tab-test-1',
        order: mockOrder,
        reason: 'Wrong order',
        staffId: mockStaff.id,
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Order voided.');
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast and does not run success path when voidOrder fails', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockVoidOrderFn.mockResolvedValue(
      err({ code: 'SUPABASE_ERROR', message: 'DB connection failed' })
    );
    renderDialog({ onSuccess });

    await user.type(screen.getByLabelText(/void reason/i), 'reason');
    await user.click(screen.getByRole('button', { name: 'Void order' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('DB connection failed');
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onOpenChange(false) on Cancel and does not call voidOrder', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockVoidOrderFn).not.toHaveBeenCalled();
  });

  it('shows loading state on confirm when isPending', () => {
    vi.mocked(useVoidOrder).mockReturnValue({
      voidOrder: mockVoidOrderFn,
      isPending: true,
    });
    renderDialog();
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Loading...' });
    expect(confirm).toBeDisabled();
  });
});
