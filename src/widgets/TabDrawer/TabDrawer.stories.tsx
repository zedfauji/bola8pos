/**
 * TAB DRAWER STORIES
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTabStore } from '@entities/tab/model/store';
import { mockTab } from '@entities/tab/model/types';
import type { Tab } from '@entities/tab/model/types';
import { TabDrawer } from './index';

// Mock data
const mockTabs: Tab[] = [
  mockTab,
  {
    ...mockTab,
    id: '123e4567-e89b-12d3-a456-426614174001',
    customerName: 'Bob Smith',
    tableNumber: 12,
    openedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  },
  {
    ...mockTab,
    id: '123e4567-e89b-12d3-a456-426614174002',
    customerName: 'Carol White',
    tableNumber: null,
    openedAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
  },
];

// Create a query client for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const meta = {
  title: 'Widgets/TabDrawer',
  component: TabDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof TabDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Empty state - no open tabs
 */
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        {
          info: {
            method: 'GET',
            path: '/rest/v1/tabs',
          },
          resolver: () => ({
            status: 200,
            data: [],
          }),
        },
      ],
    },
  },
  play: async () => {
    // Open the drawer
    useTabStore.getState().openDrawer();
  },
};

/**
 * With tabs - 3 mock tabs, one selected
 */
export const WithTabs: Story = {
  parameters: {
    msw: {
      handlers: [
        {
          info: {
            method: 'GET',
            path: '/rest/v1/tabs',
          },
          resolver: () => ({
            status: 200,
            data: mockTabs,
          }),
        },
      ],
    },
  },
  play: async () => {
    // Open the drawer and select the first tab
    const store = useTabStore.getState();
    store.openDrawer();
    const firstTab = mockTabs[0];
    if (firstTab) {
      store.selectTab(firstTab.id);
    }
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        {
          info: {
            method: 'GET',
            path: '/rest/v1/tabs',
          },
          resolver: () => {
            // Simulate slow network
            return new Promise(() => {
              // Never resolves to show loading state
            });
          },
        },
      ],
    },
  },
  play: async () => {
    // Open the drawer
    useTabStore.getState().openDrawer();
  },
};

/**
 * Error state
 */
export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        {
          info: {
            method: 'GET',
            path: '/rest/v1/tabs',
          },
          resolver: () => ({
            status: 500,
            data: { message: 'Failed to fetch tabs' },
          }),
        },
      ],
    },
  },
  play: async () => {
    // Open the drawer
    useTabStore.getState().openDrawer();
  },
};
