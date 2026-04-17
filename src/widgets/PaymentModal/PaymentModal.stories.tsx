import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { Tab } from '@entities/tab/model/types';
import { logger } from '@shared/lib/logger';
import { scenarios } from '@shared/lib/mocks';
import { ok } from '@shared/lib/result';
import { PaymentModal } from './index';

const closingTabs = scenarios.closingTime.tabs;
const baseTab: Tab = closingTabs[0] ?? scenarios.busyBar.tabs[0]!;

const tabWithPoolCharges: Tab = {
  ...(closingTabs[1] ?? baseTab),
  poolCharges: [
    {
      sessionId: 'd0000000-0000-4000-8000-000000000012',
      tableNumber: 2,
      tableLabel: 'Table 2 — Nine-ball',
      billedMinutes: 42,
      ratePerHour: 11,
      totalCharge: 12.5,
    },
    {
      sessionId: 'd0000000-0000-4000-8000-000000000013',
      tableNumber: 4,
      tableLabel: 'Table 4 — Tournament',
      billedMinutes: 33,
      ratePerHour: 10,
      totalCharge: 8.25,
    },
  ],
};

async function mockOnPayment(method: 'cash' | 'card', tipAmount: number) {
  logger.info('storybook.payment.mock', { method, tipAmount });
  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
  return ok(undefined);
}

const meta = {
  title: 'Widgets/PaymentModal',
  component: PaymentModal,
  tags: ['autodocs'],
} satisfies Meta<typeof PaymentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CashPayment: Story = {
  args: {
    open: true,
    tab: baseTab,
    onClose: () => {},
    onPayment: mockOnPayment,
  },
};

export const CardPayment: Story = {
  args: {
    open: true,
    tab: baseTab,
    onClose: () => {},
    onPayment: mockOnPayment,
  },
  play: async () => {
    // Dialog content is portaled to document.body, not the story canvas.
    const root = within(document.body);
    const cardButton = await root.findByRole('button', { name: 'Card' });
    await userEvent.setup().click(cardButton);
  },
};

export const LargeTabWithPoolCharges: Story = {
  args: {
    open: true,
    tab: tabWithPoolCharges,
    onClose: () => {},
    onPayment: mockOnPayment,
  },
};
