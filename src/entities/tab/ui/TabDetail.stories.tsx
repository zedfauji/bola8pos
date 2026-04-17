/**
 * STORYBOOK STORIES: TabDetail Component
 *
 * Stories demonstrating different states and configurations of TabDetail:
 * - SingleOrder: One order with 3 items
 * - MultipleOrders: 5 orders over time
 * - LargeTab: 20+ items with high total
 * - ManagerView: Transfer button visible
 * - BartenderView: No transfer button
 */

/* eslint-disable no-console -- story actions */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useStaffStore } from '@entities/staff/model/store';
import type { Staff } from '@entities/staff/model/types';
import { useTab } from '@entities/tab/model/queries';
import type { Order, Tab } from '@entities/tab/model/types';
import { TabDetail } from './TabDetail';

vi.mock('@entities/tab/model/queries', () => ({
  useTab: vi.fn(),
  useVoidOrder: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    isPending: false,
  })),
}));

vi.mock('@entities/staff/model/store', () => ({
  useStaffStore: vi.fn(),
}));

// Create a query client for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

const meta = {
  title: 'Entities/Tab/TabDetail',
  component: TabDetail,
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <div className="max-w-2xl mx-auto p-6">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TabDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
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

const singleOrderTab: Tab = {
  id: 'tab-1',
  customerName: 'John Doe',
  tableNumber: 5,
  staffId: 'staff-1',
  shiftId: 'shift-1',
  openedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
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
      unitPrice: 6.5,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
    {
      id: 'item-2',
      orderId: 'order-1',
      productId: 'product-2',
      quantity: 1,
      unitPrice: 12.0,
      modifierIds: ['modifier-1'],
      modifierPriceDelta: 3.0,
      notes: 'Extra salt',
      modifiers: [],
    },
    {
      id: 'item-3',
      orderId: 'order-1',
      productId: 'product-3',
      quantity: 3,
      unitPrice: 8.0,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
  ],
};

const multipleOrdersTab: Tab = {
  id: 'tab-2',
  customerName: 'Jane Smith',
  tableNumber: 12,
  staffId: 'staff-1',
  shiftId: 'shift-1',
  openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  poolCharges: [],
  items: [
    // First order
    {
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      quantity: 2,
      unitPrice: 6.5,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
    {
      id: 'item-2',
      orderId: 'order-1',
      productId: 'product-2',
      quantity: 1,
      unitPrice: 12.0,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
    // Second order
    {
      id: 'item-3',
      orderId: 'order-2',
      productId: 'product-3',
      quantity: 3,
      unitPrice: 8.0,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
    // Third order
    {
      id: 'item-4',
      orderId: 'order-3',
      productId: 'product-1',
      quantity: 1,
      unitPrice: 6.5,
      modifierIds: ['modifier-1'],
      modifierPriceDelta: 2.0,
      notes: 'No ice',
      modifiers: [],
    },
    // Fourth order
    {
      id: 'item-5',
      orderId: 'order-4',
      productId: 'product-4',
      quantity: 2,
      unitPrice: 15.0,
      modifierIds: [],
      modifierPriceDelta: 0,
      notes: null,
      modifiers: [],
    },
    // Fifth order
    {
      id: 'item-6',
      orderId: 'order-5',
      productId: 'product-2',
      quantity: 1,
      unitPrice: 12.0,
      modifierIds: ['modifier-2'],
      modifierPriceDelta: 3.5,
      notes: 'Extra lime',
      modifiers: [],
    },
  ],
};

const largeTab: Tab = {
  id: 'tab-3',
  customerName: 'Corporate Event - Table 20',
  tableNumber: 20,
  staffId: 'staff-1',
  shiftId: 'shift-1',
  openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
  closedAt: null,
  status: 'open',
  notes: 'VIP customer',
  orders: [],
  poolCharges: [],
  items: Array.from({ length: 25 }, (_, i) => ({
    id: `item-${i + 1}`,
    orderId: `order-${Math.floor(i / 5) + 1}`,
    productId: `product-${(i % 5) + 1}`,
    quantity: Math.floor(Math.random() * 3) + 1,
    unitPrice: 8.0 + Math.random() * 12.0,
    modifierIds: i % 3 === 0 ? ['modifier-1'] : [],
    modifierPriceDelta: i % 3 === 0 ? 2.5 : 0,
    notes: i % 7 === 0 ? 'Special request' : null,
    modifiers: [],
  })),
};

const emptyTab: Tab = {
  id: 'tab-4',
  customerName: 'Bob Johnson',
  tableNumber: null,
  staffId: 'staff-1',
  shiftId: 'shift-1',
  openedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  closedAt: null,
  status: 'open',
  notes: null,
  orders: [],
  poolCharges: [],
  items: [],
};

/**
 * SingleOrder Story
 * Shows a tab with one order containing 3 items
 */
export const SingleOrder: Story = {
  args: {
    tabId: 'tab-1',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    // Mock useTab hook
    vi.mocked(useTab).mockReturnValue({
      data: singleOrderTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    // Mock staff store
    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * MultipleOrders Story
 * Shows a tab with 5 orders over time
 */
export const MultipleOrders: Story = {
  args: {
    tabId: 'tab-2',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: multipleOrdersTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * LargeTab Story
 * Shows a tab with 20+ items and high total
 */
export const LargeTab: Story = {
  args: {
    tabId: 'tab-3',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: largeTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * ManagerView Story
 * Shows tab detail with transfer button visible (manager role)
 */
export const ManagerView: Story = {
  args: {
    tabId: 'tab-1',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
    onTransferTab: () => {
      console.log('Transfer tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: singleOrderTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockManager);
  },
};

/**
 * BartenderView Story
 * Shows tab detail without transfer button (bartender role)
 */
export const BartenderView: Story = {
  args: {
    tabId: 'tab-1',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
    onTransferTab: () => {
      console.log('Transfer tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: singleOrderTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * EmptyTab Story
 * Shows a tab with no items yet
 */
export const EmptyTab: Story = {
  args: {
    tabId: 'tab-4',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: emptyTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * Loading Story
 * Shows the loading state
 */
export const Loading: Story = {
  args: {
    tabId: 'tab-1',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

/**
 * Error Story
 * Shows the error state
 */
export const Error: Story = {
  args: {
    tabId: 'tab-1',
    onAddItems: () => {
      console.log('Add items clicked');
    },
    onCloseTab: () => {
      console.log('Close tab clicked');
    },
  },
  beforeEach: () => {
    const errorObj = { message: 'Failed to load tab details', name: 'Error' };
    vi.mocked(useTab).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: errorObj as never,
    } as never);

    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

const sampleProduct = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'House Lager',
  categoryId: '123e4567-e89b-12d3-a456-426614174004',
  basePrice: 6.5,
  happyHourPrice: null,
  sku: null,
  isActive: true,
  imageUrl: null,
  modifiers: [],
};

const withOrdersOrders: Order[] = [
  {
    id: 'order-a',
    tabId: 'tab-orders',
    staffId: 'staff-1',
    createdAt: new Date('2026-04-16T19:00:00'),
    status: 'pending',
    notes: null,
    items: [
      {
        id: 'item-a1',
        orderId: 'order-a',
        productId: sampleProduct.id,
        quantity: 2,
        unitPrice: 6.5,
        modifierIds: [],
        modifierPriceDelta: 0,
        notes: null,
        modifiers: [],
        product: sampleProduct,
      },
    ],
  },
  {
    id: 'order-b',
    tabId: 'tab-orders',
    staffId: 'staff-1',
    createdAt: new Date('2026-04-16T20:30:00'),
    status: 'pending',
    notes: null,
    items: [
      {
        id: 'item-b1',
        orderId: 'order-b',
        productId: sampleProduct.id,
        quantity: 1,
        unitPrice: 12,
        modifierIds: [],
        modifierPriceDelta: 0,
        notes: 'With lime',
        modifiers: [],
        product: {
          ...sampleProduct,
          id: '123e4567-e89b-12d3-a456-426614174005',
          name: 'Margarita',
        },
      },
    ],
  },
];

const withOrdersTabData: Tab = {
  id: 'tab-orders',
  customerName: 'Riley Park',
  tableNumber: 7,
  staffId: 'staff-1',
  shiftId: 'shift-1',
  openedAt: new Date(Date.now() - 40 * 60 * 1000),
  closedAt: null,
  status: 'open',
  notes: null,
  poolCharges: [],
  orders: withOrdersOrders,
  items: withOrdersOrders.flatMap(o => o.items),
};

const withPoolChargeTab: Tab = {
  ...singleOrderTab,
  id: 'tab-pool',
  poolCharges: [
    {
      sessionId: '123e4567-e89b-12d3-a456-426614174099',
      tableNumber: 3,
      tableLabel: 'Diamond',
      billedMinutes: 90,
      ratePerHour: 10,
      totalCharge: 15,
    },
  ],
};

export const WithOrders: Story = {
  args: {
    tabId: 'tab-orders',
    onAddItems: () => {
      console.log('Add items');
    },
    onCloseTab: () => {
      console.log('Close tab');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: withOrdersTabData,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};

export const WithPoolCharge: Story = {
  args: {
    tabId: 'tab-pool',
    onAddItems: () => {
      console.log('Add items');
    },
    onCloseTab: () => {
      console.log('Close tab');
    },
  },
  beforeEach: () => {
    vi.mocked(useTab).mockReturnValue({
      data: withPoolChargeTab,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useStaffStore).mockReturnValue(mockBartender);
  },
};
