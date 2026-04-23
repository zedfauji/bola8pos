import type { Meta, StoryObj } from '@storybook/react-vite';

import { ComboUnavailableBadge } from './ComboUnavailableBadge';

const meta: Meta<typeof ComboUnavailableBadge> = {
  title: 'shared/ui/ComboUnavailableBadge',
  component: ComboUnavailableBadge,
};
export default meta;

type Story = StoryObj<typeof ComboUnavailableBadge>;

export const DaysOnly: Story = {
  args: { availabilityHint: 'Available Mon–Fri' },
};

export const DaysWithTime: Story = {
  args: { availabilityHint: 'Available Mon 18:00–22:00' },
};

export const AllDay: Story = {
  args: { availabilityHint: 'Not available' },
};
