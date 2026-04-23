/**
 * UNIT TESTS: TabDetail Component
 *
 * Tests for the TabDetail component including:
 * - Header display (customer name, table number, time open)
 * - Order items display
 * - Running total calculation
 * - Tip suggestions display
 * - Action buttons rendering
 * - Transfer button visibility based on user role
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStaffStore } from '@entities/staff/model/store';
import type { Staff } from '@entities/staff/model/types';
import { useTab } from '@entities/tab/model/queries';
import type { Tab } from '@entities/tab/model/types';
import { TabDetail } from './TabDetail';

// Mock the queries module
vi.mock('../model/queries', () => ({
  useTab: vi.fn(),
  useVoidOrder: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    isPending: false,
  })),
}));

// Mock the staff store
vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

// Create a test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('TabDetail', () => {
  const mockOnAddItems = vi.fn();
  const mockOnCloseTab = vi.fn();
  const mockOnTransferTab = vi.fn();

  const mockTab: Tab = {
    id: '11111111-1111-1111-1111-111111111111',
    customerName: 'John Doe',
    tableNumber: 5,
    staffId: '22222222-2222-2222-2222-222222222222',
    shiftId: '33333333-3333-3333-3333-333333333333',
    openedAt: new Date('2025-01-15T18:00:00Z'),
    closedAt: null,
    status: 'open',
    notes: null,
    orders: [],
    poolCharges: [],
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        quantity: 2,
        unitPrice: 10.0,
        modifierIds: [],
        modifierPriceDelta: 0,
        notes: null,
        kdsStatus: 'pending',
        modifiers: [],
      },
      {
        id: 'item-2',
        orderId: 'order-1',
        productId: 'product-2',
        quantity: 1,
        unitPrice: 15.0,
        modifierIds: ['modifier-1'],
        modifierPriceDelta: 3.0,
        notes: 'Extra salt',
        kdsStatus: 'pending',
        modifiers: [],
      },
    ],
  };

  const mockBartender: Staff = {
    id: 'staff-1',
    name: 'Alex Martinez',
    email: 'alex@bar.com',
    role: 'bartender',
    pin: '123456',
    isActive: true,
  };

  const mockManager: Staff = {
    id: 'staff-2',
    name: 'Jamie Chen',
    email: 'jamie@bar.com',
    role: 'manager',
    pin: '654321',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Display', () => {
    it('should display customer name and table number', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Table 5')).toBeInTheDocument();
      });
    });

    it('should not display table number when null', async () => {
      const tabWithoutTable = { ...mockTab, tableNumber: null };

      vi.mocked(useTab).mockReturnValue({
        data: tabWithoutTable,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText(/Table/)).not.toBeInTheDocument();
      });
    });

    it('should display time open', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Time open should be displayed (format will vary based on current time)
        const timeElements = screen.getAllByText(/\d+[hm]/);
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Order Items Display', () => {
    it('should display all order items correctly', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check quantities are displayed
        expect(screen.getByText(/2×/)).toBeInTheDocument();
        expect(screen.getByText(/1×/)).toBeInTheDocument();

        // Check modifiers are indicated
        expect(screen.getByText('1 modifier(s)')).toBeInTheDocument();

        // Check notes are displayed
        expect(screen.getByText('Extra salt')).toBeInTheDocument();
      });
    });

    it('should display empty state when no items', async () => {
      const emptyTab = { ...mockTab, items: [] };

      vi.mocked(useTab).mockReturnValue({
        data: emptyTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No items yet')).toBeInTheDocument();
        expect(screen.getByText('Add items to this tab to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Running Total Calculation', () => {
    it('should calculate and display running total correctly', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
      const tabAtRuntime = {
        ...mockTab,
        openedAt: new Date('2026-04-16T21:00:00Z'),
      };
      vi.mocked(useTab).mockReturnValue({
        data: tabAtRuntime,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      try {
        render(
          <TestWrapper>
            <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText('Subtotal (drinks + pool)')).toBeInTheDocument();
          expect(screen.getAllByLabelText('$38.00 dollars').length).toBeGreaterThanOrEqual(1);
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Tip Suggestions Display', () => {
    it('should display all tip percentage suggestions', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('10%')).toBeInTheDocument();
        expect(screen.getByText('15%')).toBeInTheDocument();
        expect(screen.getByText('18%')).toBeInTheDocument();
        expect(screen.getByText('20%')).toBeInTheDocument();
      });
    });

    it('should display custom tip input field', async () => {
      const user = userEvent.setup();
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /Custom/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/Custom tip/i)).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should render Add Items and Close Tab buttons', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Items' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close Tab' })).toBeInTheDocument();
      });
    });
  });

  describe('Transfer Button Visibility', () => {
    it('should NOT display transfer button for bartenders', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail
            tabId={mockTab.id}
            onAddItems={mockOnAddItems}
            onCloseTab={mockOnCloseTab}
            onTransferTab={mockOnTransferTab}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Transfer Tab' })).not.toBeInTheDocument();
      });
    });

    it('should display transfer button for managers', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockManager);

      render(
        <TestWrapper>
          <TabDetail
            tabId={mockTab.id}
            onAddItems={mockOnAddItems}
            onCloseTab={mockOnCloseTab}
            onTransferTab={mockOnTransferTab}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Transfer Tab' })).toBeInTheDocument();
      });
    });

    it('should display transfer button for admins', async () => {
      const mockAdmin: Staff = {
        id: 'staff-3',
        name: 'Taylor Brooks',
        email: 'taylor@bar.com',
        role: 'admin',
        pin: '901234',
        isActive: true,
      };

      vi.mocked(useTab).mockReturnValue({
        data: mockTab,
        isLoading: false,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockAdmin);

      render(
        <TestWrapper>
          <TabDetail
            tabId={mockTab.id}
            onAddItems={mockOnAddItems}
            onCloseTab={mockOnCloseTab}
            onTransferTab={mockOnTransferTab}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Transfer Tab' })).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading state', () => {
      vi.mocked(useTab).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Loading tabs...')).toBeInTheDocument();
    });

    it('should display error state', async () => {
      vi.mocked(useTab).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load tab'),
      } as never);

      vi.mocked(useStaffStore).mockReturnValue(mockBartender);

      render(
        <TestWrapper>
          <TabDetail tabId={mockTab.id} onAddItems={mockOnAddItems} onCloseTab={mockOnCloseTab} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading tab')).toBeInTheDocument();
        expect(screen.getByText('Failed to load tab')).toBeInTheDocument();
      });
    });
  });
});
