import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { PoolTableCard } from './PoolTableCard';

const baseTable: PoolTable = {
  id: 'table-1',
  number: 3,
  label: 'Table 3',
  ratePerHour: 12,
  status: 'available',
  currentSessionId: null,
};

const occupiedSession: PoolSession = {
  id: 'sess-1',
  tableId: 'table-1',
  tabId: null,
  startedAt: new Date(Date.now() - 8 * 60 * 1000),
  stoppedAt: null,
  billedMinutes: null,
  totalCharge: null,
};

const meta = {
  title: 'Entities/PoolTable/PoolTableCard',
  component: PoolTableCard,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PoolTableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: {
    table: baseTable,
    session: null,
  },
};

export const OccupiedNoTab: Story = {
  args: {
    table: {
      ...baseTable,
      status: 'occupied',
      currentSessionId: occupiedSession.id,
    },
    session: occupiedSession,
    onStopSession: () => {},
  },
};

export const OccupiedWithTab: Story = {
  args: {
    table: {
      ...baseTable,
      status: 'occupied',
      currentSessionId: occupiedSession.id,
    },
    session: { ...occupiedSession, tabId: 'tab-1' },
    linkedCustomerName: 'Jordan',
    onStopSession: () => {},
  },
};

export const Maintenance: Story = {
  args: {
    table: {
      ...baseTable,
      status: 'maintenance',
    },
    session: null,
  },
};
