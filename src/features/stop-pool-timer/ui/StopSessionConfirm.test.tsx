/**
 * Unit tests for StopSessionConfirm
 *
 * Covers: prorated/full billing preview, underMinNote, paid-tab disable guard,
 * per-table rate rendering, and mutateAsync call shape.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as poolTableQueries from '@entities/pool-table/model/queries';
import * as settingsEntity from '@entities/settings';
import * as usePermissionsModule from '@entities/staff/model/usePermissions';
import type * as tabStoreModule from '@entities/tab/model/store';
import type { PoolSession, PoolTable, Tab } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';

import { StopSessionConfirm } from './StopSessionConfirm';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

let mockFirstHourMode: 'full' | 'prorated' = 'prorated';
const mockStopMutate = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@entities/pool-table/model/queries', () => ({
  useMutationStopSession: vi.fn(),
}));

vi.mock('@entities/settings', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@entities/staff/model/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('@entities/tab/model/store', async importOriginal => {
  const actual = await importOriginal<typeof tabStoreModule>();
  return {
    ...actual,
    useTabStore: vi.fn((selector: (s: ReturnType<typeof actual.useTabStore.getState>) => unknown) =>
      selector({
        tabs: [],
        selectTab: vi.fn(),
        openDrawer: vi.fn(),
        offlineQueue: [],
        isDrawerOpen: false,
        selectedTabId: null,
        closeDrawer: vi.fn(),
        addToOfflineQueue: vi.fn(),
        clearOfflineQueue: vi.fn(),
      } as unknown as ReturnType<typeof actual.useTabStore.getState>)
    ),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const tableId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const tabId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makeTable(overrides: Partial<PoolTable> = {}): PoolTable {
  return {
    id: tableId,
    number: 1,
    label: 'Table 1',
    ratePerHour: 60,
    status: 'occupied',
    tableType: 'pool',
    currentSessionId: sessionId,
    currentSession: undefined,
    ...overrides,
  };
}

function makeSession(startedAt: Date, overrides: Partial<PoolSession> = {}): PoolSession {
  return {
    id: sessionId,
    tableId,
    tabId: null,
    startedAt,
    stoppedAt: null,
    billedMinutes: null,
    totalCharge: null,
    previousTableId: null,
    previousTableNumber: null,
    ...overrides,
  };
}

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: tabId,
    customerName: 'Test Customer',
    tableNumber: null,
    staffId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    shiftId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    openedAt: new Date('2026-04-17T10:00:00.000Z'),
    closedAt: null,
    status: 'open',
    notes: null,
    orders: [],
    items: [],
    poolCharges: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function mockSettings() {
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
        firstHourMode: mockFirstHourMode,
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
        printOnStart: false,
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

function renderConfirm(table: PoolTable | null, session: PoolSession | null, openTabs: Tab[] = []) {
  return renderWithProviders(
    <StopSessionConfirm
      open={true}
      onOpenChange={vi.fn()}
      table={table}
      session={session}
      openTabs={openTabs}
    />
  );
}

const FROZEN_NOW = new Date('2026-04-17T12:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
  mockFirstHourMode = 'prorated';

  vi.mocked(poolTableQueries.useMutationStopSession).mockReturnValue({
    mutateAsync: mockStopMutate,
    isPending: false,
  } as unknown as ReturnType<typeof poolTableQueries.useMutationStopSession>);

  vi.mocked(usePermissionsModule.usePermissions).mockReturnValue({
    can: () => true,
    role: 'manager',
  } as unknown as ReturnType<typeof usePermissionsModule.usePermissions>);

  mockSettings();
});

afterEach(() => {
  mockFirstHourMode = 'prorated';
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StopSessionConfirm', () => {
  it('prorated mode: preview shows $45 for 31-min session at $60/hr', () => {
    // prorated: ceil(31/15)*15 = 45 billedMinutes → 45/60*60 = $45.00
    const startedAt = new Date(FROZEN_NOW.getTime() - 31 * 60 * 1000);
    renderConfirm(makeTable(), makeSession(startedAt));

    // MoneyDisplay renders an aria-label="$X.XX dollars"
    expect(screen.getByRole('generic', { name: /\$45\.00 dollars/i })).toBeInTheDocument();
  });

  it('full mode: preview shows $60 for 30-min session at $60/hr', () => {
    mockFirstHourMode = 'full';
    mockSettings();
    // full mode: 30 min < 60 → billedMinutes=60 → 60/60*60 = $60.00
    const startedAt = new Date(FROZEN_NOW.getTime() - 30 * 60 * 1000);
    renderConfirm(makeTable(), makeSession(startedAt));

    expect(screen.getByRole('generic', { name: /\$60\.00 dollars/i })).toBeInTheDocument();
  });

  it('shows underMinNote for session under 15 minutes', () => {
    const startedAt = new Date(FROZEN_NOW.getTime() - 5 * 60 * 1000);
    renderConfirm(makeTable(), makeSession(startedAt));

    expect(screen.getByText(/sessions under 15 minutes/i)).toBeInTheDocument();
  });

  it('Stop & finalize is disabled when linked tab is paid', () => {
    const paidTab = makeTab({ id: tabId, status: 'paid' });
    const session = makeSession(new Date(FROZEN_NOW.getTime() - 20 * 60 * 1000), { tabId });

    renderConfirm(makeTable(), session, [paidTab]);

    expect(screen.getByRole('button', { name: /stop & finalize/i })).toBeDisabled();
  });

  it('per-table rate: pool $60/hr shows $30 for exactly 30-min prorated session', () => {
    // ceil(30/15)*15 = 30 billedMinutes → 30/60 * 60 = $30.00
    const startedAt = new Date(FROZEN_NOW.getTime() - 30 * 60 * 1000);
    renderConfirm(makeTable({ ratePerHour: 60 }), makeSession(startedAt));
    expect(screen.getByRole('generic', { name: /\$30\.00 dollars/i })).toBeInTheDocument();
  });

  it('per-table rate: carom $80/hr shows $40 for exactly 30-min prorated session', () => {
    // 30 billedMinutes → 30/60 * 80 = $40.00
    const startedAt = new Date(FROZEN_NOW.getTime() - 30 * 60 * 1000);
    renderConfirm(makeTable({ ratePerHour: 80 }), makeSession(startedAt));
    expect(screen.getByRole('generic', { name: /\$40\.00 dollars/i })).toBeInTheDocument();
  });

  it('confirm calls mutateAsync with table.ratePerHour', async () => {
    // Temporarily use real timers for the async interaction test so waitFor works
    vi.useRealTimers();
    const user = userEvent.setup();
    const startedAt = new Date(Date.now() - 20 * 60 * 1000);
    mockStopMutate.mockResolvedValueOnce({ ok: true, value: undefined });

    renderConfirm(makeTable(), makeSession(startedAt));

    const confirmBtn = screen.getByRole('button', { name: /stop & finalize/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockStopMutate).toHaveBeenCalledWith({
        sessionId,
        tableId,
        ratePerHour: 60,
      });
    });
  });
});
