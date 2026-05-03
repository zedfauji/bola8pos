/**
 * Unit tests for StartSessionSheet — auto-create tab feature
 *
 * Covers: default option, no "Unlinked" option, openTab then startSession
 * flow, openTab failure handling, existing tab path, isPending disabled state.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as poolTableQueries from '@entities/pool-table/model/queries';
import * as settingsEntity from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import * as tabQueries from '@entities/tab/model/queries';
import type { Tab } from '@entities/tab/model/types';
import type { PoolTable, Shift } from '@shared/lib/domain';
import * as posPrinter from '@shared/lib/pos-printer';
import { err, ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';

import { StartSessionSheet } from './StartSessionSheet';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@entities/pool-table/model/queries', () => ({
  useMutationStartSession: vi.fn(),
}));

vi.mock('@entities/tab/model/queries', () => ({
  useMutationOpenTab: vi.fn(),
}));

vi.mock('@entities/settings', async importOriginal => {
  const actual = await importOriginal<typeof settingsEntity>();
  return {
    ...actual,
    useSettings: vi.fn(),
  };
});

vi.mock('@shared/lib/pos-printer', async importOriginal => {
  const actual = await importOriginal<typeof posPrinter>();
  return {
    ...actual,
    printRawText: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const staffId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const shiftId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const testTable: PoolTable = {
  id: 'tttttttt-tttt-tttt-tttt-tttttttttttt',
  number: 1,
  label: 'Main',
  ratePerHour: 15,
  status: 'available',
  tableType: 'pool',
  currentSessionId: null,
};

const testTab: Tab = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  customerName: 'Existing Customer',
  tableNumber: null,
  staffId,
  shiftId,
  openedAt: new Date('2026-04-17T10:00:00.000Z'),
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  items: [],
  poolCharges: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMutations({
  openTabResult = ok({
    id: 'new-tab-id',
    customerName: 'Pool Main',
    tableNumber: null,
    staffId,
    shiftId,
    openedAt: new Date(),
    closedAt: null,
    status: 'open' as const,
    notes: null,
    orders: [],
    items: [],
    poolCharges: [],
  }),
  startSessionResult = ok({ id: 'session-id' }),
  openTabIsPending = false,
  startSessionIsPending = false,
}: {
  openTabResult?: ReturnType<typeof ok> | ReturnType<typeof err>;
  startSessionResult?: ReturnType<typeof ok> | ReturnType<typeof err>;
  openTabIsPending?: boolean;
  startSessionIsPending?: boolean;
} = {}) {
  const openTabMutateAsync = vi.fn().mockResolvedValue(openTabResult);
  const startSessionMutateAsync = vi.fn().mockResolvedValue(startSessionResult);

  vi.mocked(tabQueries.useMutationOpenTab).mockReturnValue({
    mutateAsync: openTabMutateAsync,
    isPending: openTabIsPending,
  } as unknown as ReturnType<typeof tabQueries.useMutationOpenTab>);

  vi.mocked(poolTableQueries.useMutationStartSession).mockReturnValue({
    mutateAsync: startSessionMutateAsync,
    isPending: startSessionIsPending,
  } as unknown as ReturnType<typeof poolTableQueries.useMutationStartSession>);

  return { openTabMutateAsync, startSessionMutateAsync };
}

function renderSheet(openTabs: Tab[] = []) {
  return renderWithProviders(
    <StartSessionSheet open={true} onOpenChange={vi.fn()} table={testTable} openTabs={openTabs} />
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function mockSettings(printOnStart: boolean) {
  vi.mocked(settingsEntity.useSettings).mockReturnValue({
    data: {
      general: {
        barName: 'Bola 8',
        address: '',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        receiptFooterText: '',
      },
      billing: {
        taxRatePercent: 16,
        defaultTipPercentages: [10, 15, 18, 20],
        paymentMethods: { cash: true, bbvaCard: true, rappi: true },
        firstHourMode: 'prorated',
      },
      rappi: { storeId: '', lastSyncAt: null },
      emailReceipts: { fromEmail: '' },
      paymentLabels: { cash: 'Efectivo', card: 'Terminal BBVA', rappi: 'Rappi' },
      receipt: {
        paperWidthChars: 32,
        showCashierName: true,
        showCustomerName: true,
        showReceiptNumber: true,
        headerLine2: '',
        footerText: '',
        boldTotals: true,
        printOnStart,
      },
    },
    resultError: undefined,
    isIdleOrLoading: false,
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    isFetching: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isRefetching: false,
    isStale: false,
    isPlaceholderData: false,
    error: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: vi.fn(),
    isRefetchError: false,
    isLoadingError: false,
  } as unknown as ReturnType<typeof settingsEntity.useSettings>);
}

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
      mustChangePin: false,
    },
    currentShift: {
      id: shiftId,
      staffId,
      clockIn: new Date('2026-04-17T08:00:00.000Z'),
      clockOut: null,
      openingCash: 0,
      closingCash: null,
    } satisfies Shift,
    staffList: [],
    isAuthenticated: true,
  });
  mockMutations();
  mockSettings(false);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StartSessionSheet — auto-create tab', () => {
  it('renders "New Tab (auto-create)" as the default option', () => {
    renderSheet();
    // The default selected value should be the NEW_TAB sentinel
    expect(screen.getByRole('combobox', { hidden: true })).toHaveValue('__new_tab__');
    // The option text should be "New Tab (auto-create)"
    const optionTexts = screen
      .getAllByRole('option', { hidden: true })
      .map(o => o.textContent ?? '');
    expect(optionTexts).toContain('New Tab (auto-create)');
  });

  it('does not render an option with text "Unlinked"', () => {
    renderSheet();
    const optionTexts = screen
      .getAllByRole('option', { hidden: true })
      .map(o => o.textContent ?? '');
    expect(optionTexts.some(t => /unlinked/i.test(t))).toBe(false);
  });

  it('NEW_TAB: calls openTab mutation then startSession with the new tab ID', async () => {
    const user = userEvent.setup();
    const newTabId = 'new-tab-id';
    const { openTabMutateAsync, startSessionMutateAsync } = mockMutations({
      openTabResult: ok({
        id: newTabId,
        customerName: 'Pool Main',
        tableNumber: null,
        staffId,
        shiftId,
        openedAt: new Date(),
        closedAt: null,
        status: 'open' as const,
        notes: null,
        orders: [],
        items: [],
        poolCharges: [],
      }),
      startSessionResult: ok({ id: 'session-1' }),
    });

    renderSheet();

    // Default is already __new_tab__, click Start Session
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(openTabMutateAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(startSessionMutateAsync).toHaveBeenCalledWith({
        tableId: testTable.id,
        tabId: newTabId,
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Pool session started.');
  });

  it('NEW_TAB: openTab failure shows error toast and does NOT call startSession', async () => {
    const user = userEvent.setup();
    const { openTabMutateAsync, startSessionMutateAsync } = mockMutations({
      openTabResult: err({ code: 'SUPABASE_ERROR' as const, message: 'DB error' }),
    });

    renderSheet();

    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(openTabMutateAsync).toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith('DB error');
    expect(startSessionMutateAsync).not.toHaveBeenCalled();
  });

  it('existing tab selected: calls startSession directly without calling openTab', async () => {
    const user = userEvent.setup();
    const { openTabMutateAsync, startSessionMutateAsync } = mockMutations();

    renderSheet([testTab]);

    // Select the existing tab
    const select = screen.getByRole('combobox', { hidden: true });
    await user.selectOptions(select, testTab.id);

    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(startSessionMutateAsync).toHaveBeenCalledWith({
        tableId: testTable.id,
        tabId: testTab.id,
      });
    });
    expect(openTabMutateAsync).not.toHaveBeenCalled();
  });

  it('button disabled while openTab.isPending', () => {
    mockMutations({ openTabIsPending: true });
    renderSheet();
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
  });
});

const sessionWithStartedAt = ok({
  id: 'session-id',
  tableId: testTable.id,
  tabId: 'new-tab-id',
  startedAt: new Date('2026-04-21T10:00:00.000Z'),
  stoppedAt: null,
  billedMinutes: null,
  totalCharge: null,
});

describe('StartSessionSheet — print on start', () => {
  it('calls printRawText once after session starts when printOnStart=true', async () => {
    const user = userEvent.setup();
    mockSettings(true);
    mockMutations({ startSessionResult: sessionWithStartedAt });
    vi.mocked(posPrinter.printRawText).mockResolvedValue(ok(undefined));

    renderSheet();
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pool session started.');
    });
    await waitFor(() => {
      expect(vi.mocked(posPrinter.printRawText)).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call printRawText when printOnStart=false', async () => {
    const user = userEvent.setup();
    mockSettings(false);
    mockMutations({ startSessionResult: sessionWithStartedAt });

    renderSheet();
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pool session started.');
    });
    expect(vi.mocked(posPrinter.printRawText)).not.toHaveBeenCalled();
  });

  it('print failure does NOT prevent session success toast', async () => {
    const user = userEvent.setup();
    mockSettings(true);
    mockMutations({ startSessionResult: sessionWithStartedAt });
    vi.mocked(posPrinter.printRawText).mockRejectedValue(new Error('printer offline'));

    renderSheet();
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pool session started.');
    });
    // Error should NOT have been toasted
    expect(toast.error).not.toHaveBeenCalled();
  });
});
