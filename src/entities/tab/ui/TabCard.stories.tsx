/**
 * TAB CARD STORIES
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { mockTab, mockTabItem } from '../model/types';
import { TabCard } from './TabCard';

const meta = {
  title: 'Entities/Tab/TabCard (Entity)',
  component: TabCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    isActive: false,
    onSelect: () => {},
  },
} satisfies Meta<typeof TabCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {
  args: {
    tab: {
      ...mockTab,
      openedAt: new Date(Date.now() - 30 * 60 * 1000),
      items: [mockTabItem],
    },
  },
};

export const TwoHours: Story = {
  name: 'TwoHours',
  args: {
    tab: {
      ...mockTab,
      openedAt: new Date(Date.now() - 121 * 60 * 1000),
      items: [mockTabItem],
    },
  },
};

export const FourHoursPlus: Story = {
  name: 'FourHoursPlus',
  args: {
    tab: {
      ...mockTab,
      openedAt: new Date(Date.now() - 241 * 60 * 1000),
      items: [mockTabItem],
    },
  },
};

export const Active: Story = {
  args: {
    isActive: true,
    tab: {
      ...mockTab,
      openedAt: new Date(Date.now() - 45 * 60 * 1000),
      items: [mockTabItem],
    },
  },
};

export const WithMultipleItems: Story = {
  args: {
    tab: {
      ...mockTab,
      openedAt: new Date(Date.now() - 20 * 60 * 1000),
      items: [
        mockTabItem,
        { ...mockTabItem, id: '123e4567-e89b-12d3-a456-426614174012', quantity: 1 },
        { ...mockTabItem, id: '123e4567-e89b-12d3-a456-426614174013', quantity: 3 },
      ],
    },
  },
};

export const NoTableNumber: Story = {
  args: {
    tab: {
      ...mockTab,
      tableNumber: null,
      openedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  },
};

export const EmptyTab: Story = {
  args: {
    tab: {
      ...mockTab,
      items: [],
      subtotal: 0,
      openedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  },
};
