/**
 * OPEN TAB BUTTON STORIES
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useStaffStore } from '@entities/staff/model/store';
import { mockStaff } from '@entities/staff/model/types';
import type { Shift } from '@shared/lib/domain';
import { OpenTabButton } from './OpenTabButton';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const storyShift: Shift = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  staffId: mockStaff[0]!.id,
  clockIn: new Date(),
  clockOut: null,
  openingCash: 100,
  closingCash: null,
};

function SeedStaffSession({ children }: { children: ReactNode }) {
  useEffect(() => {
    useStaffStore.getState().login(mockStaff[0]!, storyShift);
    return () => {
      useStaffStore.getState().logout();
    };
  }, []);

  return <>{children}</>;
}

const meta = {
  title: 'Features/OpenTab/OpenTabButton',
  component: OpenTabButton,
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <SeedStaffSession>
          <Story />
        </SeedStaffSession>
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
