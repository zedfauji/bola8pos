import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStaffStore } from '@entities/staff/model/store';
import { useTabs } from '@entities/tab/model/queries';
import type { Tab } from '@entities/tab/model/types';
import { renderWithProviders } from '@shared/lib/test-utils';

import { PaymentPane } from './PaymentPane';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@entities/tab/model/queries', () => ({
  useTabs: vi.fn(),
  tabKeys: {
    all: ['tabs'] as const,
    lists: () => ['tabs', 'list'] as const,
    list: () => ['tabs', 'list', {}] as const,
    details: () => ['tabs', 'detail'] as const,
    detail: (id: string) => ['tabs', 'detail', id] as const,
  },
}));

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

vi.mock('@entities/payment', () => ({
  usePayments: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useOrderItemsByPayment: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));

vi.mock('@entities/refund', () => ({
  useRefundsByPayment: vi.fn().mockReturnValue({ data: [] }),
}));

// ManagerPinDialog: expose a simplified version that calls onSuccess immediately
// when the test fires a click on the "Verify PIN" sentinel button, without
// requiring a real keypad interaction.
const mockOnSuccess = vi.fn();
vi.mock('@features/manager-pin-gate', () => ({
  ManagerPinDialog: ({
    open,
    onSuccess,
    onOpenChange,
  }: {
    open: boolean;
    onSuccess: () => void;
    onOpenChange: (v: boolean) => void;
  }) => {
    // stash latest onSuccess so tests can invoke it
    mockOnSuccess.mockImplementation(onSuccess);
    if (!open) return null;
    return (
      <div role="alertdialog" aria-label="Manager Access Required">
        <button
          type="button"
          onClick={() => {
            onSuccess();
          }}
        >
          Simulate PIN success
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </button>
      </div>
    );
  },
}));

// PaymentForm: a lightweight stub so PaymentPane logic can be tested without
// the full payment form tree (which requires settings, processors, etc.)
const mockOnPaymentSuccess = vi.fn();
const mockOnClose = vi.fn();
vi.mock('@widgets/PaymentModal', () => ({
  PaymentForm: ({
    tab,
    onPaymentSuccess,
    onClose,
  }: {
    tab: Tab;
    staffId: string;
    onPaymentSuccess: () => void;
    onClose: () => void;
  }) => {
    mockOnPaymentSuccess.mockImplementation(onPaymentSuccess);
    mockOnClose.mockImplementation(onClose);
    return <div data-testid="payment-form">PaymentForm for {tab.customerName}</div>;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StoreState = Parameters<Parameters<typeof useStaffStore>[0]>[0];
const mockStoreState =
  (partial: Partial<StoreState>) =>
  (fn: (s: StoreState) => unknown): unknown =>
    fn(partial as StoreState);

const mockStaff = {
  id: 'staff-001',
  name: 'Test Manager',
  email: 'manager@example.com',
  role: 'manager' as const,
  pin: '789012',
  isActive: true,
};

function makeTab(overrides: Partial<Tab> & { id: string; customerName: string }): Tab {
  return {
    id: overrides.id,
    customerName: overrides.customerName,
    tableNumber: overrides.tableNumber ?? null,
    staffId: 'staff-001',
    shiftId: 'shift-001',
    openedAt: new Date(Date.now() - 30 * 60 * 1000),
    closedAt: null,
    status: 'open',
    notes: null,
    orders: [],
    items: overrides.items ?? [],
    poolCharges: overrides.poolCharges ?? [],
    subtotal: overrides.subtotal ?? 0,
    hasActivePoolSession: overrides.hasActivePoolSession ?? false,
    activePoolTableNumber: overrides.activePoolTableNumber ?? null,
    rappiOrderId: overrides.rappiOrderId ?? null,
  };
}

function mockTabsLoaded(tabs: Tab[]) {
  vi.mocked(useTabs).mockReturnValue({
    data: tabs,
    isIdleOrLoading: false,
    resultError: undefined,
  } as ReturnType<typeof useTabs>);
}

function mockTabsLoading() {
  vi.mocked(useTabs).mockReturnValue({
    data: undefined,
    isIdleOrLoading: true,
    resultError: undefined,
  } as ReturnType<typeof useTabs>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStaffStore).mockImplementation(mockStoreState({ currentStaff: mockStaff }));
    mockTabsLoaded([]);
  });

  // ── 1. Initial state ──────────────────────────────────────────────────────
  it('renders left panel header and right empty-state when no tab is selected', () => {
    const tabA = makeTab({ id: 'tab-1', customerName: 'Alice' });
    mockTabsLoaded([tabA]);
    renderWithProviders(<PaymentPane />);

    expect(screen.getByText(/tabs awaiting payment/i)).toBeInTheDocument();
    // No tab selected → shows payment history empty state
    expect(screen.getByText(/no payment records found/i)).toBeInTheDocument();
    // No payment form visible yet
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  // ── 2. Tab selection ──────────────────────────────────────────────────────
  it('clicking a TabPaymentCard selects the tab and shows PIN-verification prompt', async () => {
    const user = userEvent.setup();
    const tabA = makeTab({ id: 'tab-1', customerName: 'Bob' });
    mockTabsLoaded([tabA]);
    renderWithProviders(<PaymentPane />);

    await user.click(screen.getByRole('button', { name: /tab Bob/i }));

    // Right panel header should show customer name
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeInTheDocument();
    // PIN verification button appears
    expect(
      screen.getByRole('button', { name: /verify pin to process payment/i })
    ).toBeInTheDocument();
    // Still no PaymentForm
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  // ── 3. Active pool session — "Timer Running" badge ────────────────────────
  it('tab with hasActivePoolSession shows "Timer Running" badge in the card', () => {
    const timerTab = makeTab({
      id: 'tab-timer',
      customerName: 'Carol',
      hasActivePoolSession: true,
      activePoolTableNumber: 3,
    });
    mockTabsLoaded([timerTab]);
    renderWithProviders(<PaymentPane />);

    // The card in the left panel should show the badge
    const card = screen.getByRole('button', { name: /tab Carol/i });
    expect(within(card).getByText(/timer running/i)).toBeInTheDocument();
  });

  // ── 4. Active pool session — right panel blocks payment ───────────────────
  it('selecting a tab with hasActivePoolSession shows pool-timer warning instead of PIN button', async () => {
    const user = userEvent.setup();
    const timerTab = makeTab({
      id: 'tab-timer',
      customerName: 'Dave',
      hasActivePoolSession: true,
      activePoolTableNumber: 2,
    });
    mockTabsLoaded([timerTab]);
    renderWithProviders(<PaymentPane />);

    await user.click(screen.getByRole('button', { name: /tab Dave/i }));

    expect(screen.getByText(/timer still running/i)).toBeInTheDocument();
    expect(screen.getByText(/stop the pool timer before processing payment/i)).toBeInTheDocument();
    // PIN button must NOT appear
    expect(
      screen.queryByRole('button', { name: /verify pin to process payment/i })
    ).not.toBeInTheDocument();
    // PaymentForm must NOT appear
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  // ── 5. PIN gate flow — dialog opens then success shows PaymentForm ─────────
  it('clicking Verify PIN opens ManagerPinDialog; on PIN success PaymentForm renders', async () => {
    const user = userEvent.setup();
    const tabA = makeTab({ id: 'tab-1', customerName: 'Eve' });
    mockTabsLoaded([tabA]);
    renderWithProviders(<PaymentPane />);

    await user.click(screen.getByRole('button', { name: /tab Eve/i }));
    await user.click(screen.getByRole('button', { name: /verify pin to process payment/i }));

    // ManagerPinDialog stub should be visible
    await waitFor(() => {
      expect(
        screen.getByRole('alertdialog', { name: /manager access required/i })
      ).toBeInTheDocument();
    });

    // Simulate PIN success
    await user.click(screen.getByRole('button', { name: /simulate pin success/i }));

    // PaymentForm should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    });
    expect(screen.getByText(/paymentform for Eve/i)).toBeInTheDocument();
  });

  // ── 6. Payment success resets selection ───────────────────────────────────
  it('after onPaymentSuccess fires, right panel returns to empty state', async () => {
    const user = userEvent.setup();
    const tabA = makeTab({ id: 'tab-1', customerName: 'Frank' });
    mockTabsLoaded([tabA]);
    renderWithProviders(<PaymentPane />);

    // Select tab → PIN success → PaymentForm visible
    await user.click(screen.getByRole('button', { name: /tab Frank/i }));
    await user.click(screen.getByRole('button', { name: /verify pin to process payment/i }));
    await user.click(screen.getByRole('button', { name: /simulate pin success/i }));
    await waitFor(() => {
      expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    });

    // Fire payment success (invalidates query) then close (clears selection)
    mockOnPaymentSuccess();
    mockOnClose();

    await waitFor(() => {
      // After clearing selection, shows payment history empty state
      expect(
        screen.getByText(/no payment records found/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  // ── 7. Back button clears selection ───────────────────────────────────────
  it('clicking Back to tab list button clears the selected tab', async () => {
    const user = userEvent.setup();
    const tabA = makeTab({ id: 'tab-1', customerName: 'Grace' });
    mockTabsLoaded([tabA]);
    renderWithProviders(<PaymentPane />);

    await user.click(screen.getByRole('button', { name: /tab Grace/i }));
    // Right panel header is showing
    expect(screen.getByRole('heading', { name: 'Grace' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to tab list/i }));

    await waitFor(() => {
      // After clearing selection, shows payment history empty state
      expect(
        screen.getByText(/no payment records found/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Grace' })).not.toBeInTheDocument();
  });

  // ── 8. Selecting a different tab resets pin verified state ────────────────
  it('switching from one tab to another resets pinVerified and shows PIN prompt again', async () => {
    const user = userEvent.setup();
    const tabA = makeTab({ id: 'tab-1', customerName: 'Hannah' });
    const tabB = makeTab({ id: 'tab-2', customerName: 'Ivan' });
    mockTabsLoaded([tabA, tabB]);
    renderWithProviders(<PaymentPane />);

    // Select first tab and verify PIN
    await user.click(screen.getByRole('button', { name: /tab Hannah/i }));
    await user.click(screen.getByRole('button', { name: /verify pin to process payment/i }));
    await user.click(screen.getByRole('button', { name: /simulate pin success/i }));
    await waitFor(() => {
      expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    });

    // Select second tab — PIN state should reset
    await user.click(screen.getByRole('button', { name: /tab Ivan/i }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /verify pin to process payment/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  // ── 9. Loading skeleton ───────────────────────────────────────────────────
  it('shows skeleton while tabs are loading', () => {
    mockTabsLoading();
    renderWithProviders(<PaymentPane />);

    // When loading, no tab cards are rendered (skeleton is shown instead)
    // The empty-state text should also be absent
    expect(screen.queryByText(/no tabs waiting for payment/i)).not.toBeInTheDocument();
  });

  // ── 10. Empty state ───────────────────────────────────────────────────────
  it('shows "No tabs waiting for payment" when there are no open tabs', () => {
    mockTabsLoaded([]);
    renderWithProviders(<PaymentPane />);

    expect(screen.getByText(/no tabs waiting for payment/i)).toBeInTheDocument();
  });

  // ── 11. Pool table badge on card ──────────────────────────────────────────
  it('tab with activePoolTableNumber shows Pool badge in the card', () => {
    const poolTab = makeTab({
      id: 'tab-pool',
      customerName: 'Jake',
      activePoolTableNumber: 5,
      hasActivePoolSession: false,
    });
    mockTabsLoaded([poolTab]);
    renderWithProviders(<PaymentPane />);

    const card = screen.getByRole('button', { name: /tab Jake/i });
    expect(within(card).getByText(/pool #5/i)).toBeInTheDocument();
  });
});
