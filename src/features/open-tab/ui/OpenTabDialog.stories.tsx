/* eslint-disable no-console -- story actions */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OpenTabDialog } from './OpenTabDialog';

const meta = {
  title: 'Features/OpenTab/OpenTabDialog',
  component: OpenTabDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OpenTabDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {
      console.log('Dialog closed');
    },
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {
      console.log('Dialog closed');
    },
  },
};
