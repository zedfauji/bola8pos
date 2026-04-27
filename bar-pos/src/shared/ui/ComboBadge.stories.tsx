import type { Meta, StoryObj } from '@storybook/react-vite';

import { ComboBadge } from './ComboBadge';

const meta: Meta<typeof ComboBadge> = {
  title: 'shared/ui/ComboBadge',
  component: ComboBadge,
};
export default meta;

type Story = StoryObj<typeof ComboBadge>;

export const Default: Story = {};
