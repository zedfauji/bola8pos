import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrepOnHandCard } from './PrepOnHandCard';

const meta: Meta<typeof PrepOnHandCard> = {
  title: 'Entities/Prep/PrepOnHandCard',
  component: PrepOnHandCard,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof PrepOnHandCard>;

export const Healthy: Story = {
  args: { name: 'Salsa Mexicana', uom: 'kg', qtyOnHand: 5.0, reorderPoint: 2.0 },
};

export const Low: Story = {
  args: { name: 'Michelada Mix', uom: 'L', qtyOnHand: 1.5, reorderPoint: 2.0 },
};

export const OutOfStock: Story = {
  args: { name: 'Guacamole', uom: 'kg', qtyOnHand: 0, reorderPoint: 1.0 },
};

export const NoReorderPoint: Story = {
  args: { name: 'Pico de Gallo', uom: 'portion', qtyOnHand: 12, reorderPoint: null },
};
