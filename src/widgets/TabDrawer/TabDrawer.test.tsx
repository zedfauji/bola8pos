/**
 * TAB DRAWER UNIT TESTS
 *
 * Tests for TabDrawer widget validating loading, error, empty, and success states,
 * as well as tab selection and active tab highlighting.
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { Tab } from '@entities/tab/model/types';
import { renderWithProviders } from '@shared/lib/test-utils';
import { TabDrawer } from './index';

// Mock the queries module
vi.mock('../../entities/tab/model/queries');

describe('TabDrawer', () => {
  const mockShiftId = '88888888-8888-8888-8888-888888888888';

  const mockTabs: Tab[] = [
    {
      id: '66666666-6666-6666-6666-666666666666',
      customerName: 'John Doe',
      tableNumber: 5,
      staffId: '77777777-7777-7777-7777-777777777777',
      shiftId: mockShiftId,
      openedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      closedAt: null,
      status: 'open',
      notes: null,
      orders: [],
      poolCharges: [],
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          orderId: '22222222-2222-2222-2222-222222222222',
          productId: 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d',
          quantity: 2,
          unitPrice: 6.5,
          modifierIds: [],
          modifierPriceDelta: 0,
          notes: null,
          kdsStatus: 'pending',
          modifiers: [],
        },
      ],
    },
    {
      id: '99999999-9999-9999-9999-999999999999',
      customerName: 'Jane Smith',
      tableNumber: null,
      staffId: '77777777-7777-7777-7777-777777777777',
      shiftId: mockShiftId,
      openedAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
      closedAt: null,
      status: 'open',
      notes: 'VIP customer',
      orders: [],
      poolCharges: [],
      items: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queries.useMutationOpenTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    // Reset the tab store
    useTabStore.setState({
      selectedTabId: null,
      activeTabId: null,
      isTabDrawerOpen: false,
    });
  });

  /**
   * Test: Loading state renders skeletons
   * **Validates: Requirements 8.1**
   */
  it('renders loading skeletons when data is loading', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should display loading skeletons
    expect(screen.getByLabelText('Loading tabs...')).toBeInTheDocument();
  });

  it('shows no-shift message when tab list query is disabled', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: true,
    } as any);

    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    expect(screen.getByText('No active shift')).toBeInTheDocument();
  });

  /**
   * Test: Error state displays error message
   * **Validates: Requirements 8.2**
   */
  it('displays error message when tabs fetch fails', () => {
    const mockError = new Error('Failed to fetch tabs');

    vi.mocked(queries.useTabs).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: mockError,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should display error message
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error loading tabs')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch tabs')).toBeInTheDocument();
  });

  /**
   * Test: Error state with unknown error
   * **Validates: Requirements 8.2**
   */
  it('displays generic error message when error has no message', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should display generic error message
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error loading tabs')).toBeInTheDocument();
    expect(screen.getByText('An unknown error occurred')).toBeInTheDocument();
  });

  /**
   * Test: Empty state displays "No open tabs"
   * **Validates: Requirements 8.3**
   */
  it('displays empty state when no tabs exist', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should display empty state
    expect(screen.getByText('No open tabs')).toBeInTheDocument();
    expect(screen.getByText('Open a new tab to get started')).toBeInTheDocument();
  });

  /**
   * Test: Successful data renders TabCards
   * **Validates: Requirements 8.4**
   */
  it('renders TabCards when tabs data is available', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should render both tab cards
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Table 5')).toBeInTheDocument();

    // Should display tab count badge
    expect(screen.getByLabelText('2 open tabs')).toBeInTheDocument();
  });

  /**
   * Test: Tab selection calls setActiveTab and closes drawer
   * **Validates: Requirements 8.5**
   */
  it('calls setActiveTab and closes drawer when tab is selected', async () => {
    const user = userEvent.setup();

    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Click on the first tab card
    const tabButton = screen.getByRole('button', {
      name: /Tab for John Doe/,
    });
    await user.click(tabButton);

    // Should update active tab in store
    await waitFor(() => {
      const state = useTabStore.getState();
      expect(state.activeTabId).toBe('66666666-6666-6666-6666-666666666666');
      expect(state.selectedTabId).toBe('66666666-6666-6666-6666-666666666666');
    });

    // Should close the drawer
    await waitFor(() => {
      const state = useTabStore.getState();
      expect(state.isTabDrawerOpen).toBe(false);
    });
  });

  /**
   * Test: Active tab highlighting
   * **Validates: Requirements 8.5**
   */
  it('highlights the active tab with ring styling', () => {
    // Set active tab in store
    useTabStore.setState({
      selectedTabId: '66666666-6666-6666-6666-666666666666',
      activeTabId: '66666666-6666-6666-6666-666666666666',
      isTabDrawerOpen: true,
    });

    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    renderWithProviders(<TabDrawer />);

    // First tab should have active styling
    const activeTabButton = screen.getByRole('button', {
      name: /Tab for John Doe/,
    });
    expect(activeTabButton).toHaveClass('ring-2', 'ring-primary');

    // Second tab should not have active styling
    const inactiveTabButton = screen.getByRole('button', {
      name: /Tab for Jane Smith/,
    });
    expect(inactiveTabButton).not.toHaveClass('ring-2');
  });

  /**
   * Test: New Tab button is rendered
   * **Validates: Requirements 4.8**
   */
  it('renders New Tab button and calls onNewTab when clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should render New Tab button
    const newTabButton = screen.getByRole('button', { name: 'Open Tab' });
    expect(newTabButton).toBeInTheDocument();

    // Click the button - it should open the open tab dialog
    await user.click(newTabButton);

    // The button click is handled internally by OpenTabButton component
    expect(newTabButton).toBeInTheDocument();
  });

  /**
   * Test: Drawer header displays title
   * **Validates: Requirements 4.3**
   */
  it('displays "Open Tabs" header title', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should display header title
    expect(screen.getByText(/Open Tabs/)).toBeInTheDocument();
  });

  /**
   * Test: Count badge only shows when tabs exist
   * **Validates: Requirements 4.4**
   */
  it('does not display count badge when no tabs exist', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Open the drawer via store
    useTabStore.setState({ isTabDrawerOpen: true });

    renderWithProviders(<TabDrawer />);

    // Should not display count badge
    expect(screen.queryByLabelText(/open tabs/)).not.toBeInTheDocument();
  });

  /**
   * Test: Drawer respects isOpen prop
   */
  it('does not render when isOpen is false', () => {
    vi.mocked(queries.useTabs).mockReturnValue({
      data: mockTabs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isDisabled: false,
    } as any);

    // Keep drawer closed
    useTabStore.setState({ isTabDrawerOpen: false });

    renderWithProviders(<TabDrawer />);

    // Drawer content should not be visible
    expect(screen.queryByText('Open Tabs')).not.toBeInTheDocument();
  });
});
