/**
 * OPEN TAB BUTTON STORIES
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@entities/staff/model/AuthContext';
import { OpenTabButton } from './OpenTabButton';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const meta = {
  title: 'Features/OpenTab/OpenTabButton',
  component: OpenTabButton,
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Story />
        </AuthProvider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OpenTabButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - button ready to open a tab
 */
export const Default: Story = {};

/**
 * Loading state - button shows "Opening..." text
 * Note: This is simulated via the component's internal state
 */
export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Button shows loading state while creating the tab in Supabase',
      },
    },
  },
};
