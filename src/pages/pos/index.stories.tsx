import type { Meta, StoryObj } from '@storybook/react-vite';
import POSPage from './index';

const meta = {
  title: 'Pages/POS',
  component: POSPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof POSPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveTab: Story = {
  decorators: [
    Story => {
      // Set up initial state with an active tab
      return <Story />;
    },
  ],
};
