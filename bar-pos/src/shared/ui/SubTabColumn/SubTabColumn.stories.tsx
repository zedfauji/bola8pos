import type { Meta, StoryObj } from '@storybook/react-vite';

import type { OrderItem } from '@shared/lib/domain';

import { SubTabColumn } from './SubTabColumn';

const meta: Meta<typeof SubTabColumn> = {
  title: 'shared/ui/SubTabColumn',
  component: SubTabColumn,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof SubTabColumn>;

// ---------- Mock helpers ----------

const MOCK_ORDER_ID = '00000000-0000-0000-0000-000000000001';

function mockItem(id: string, name: string, priceCents: number): OrderItem {
  const paddedId = `00000000-0000-0000-0000-${id.padStart(12, '0')}`;
  return {
    id: paddedId,
    orderId: MOCK_ORDER_ID,
    productId: paddedId,
    quantity: 1,
    unitPrice: priceCents / 100,
    modifierIds: [],
    modifierPriceDelta: 0,
    notes: null,
    kdsStatus: 'pending',
    modifiers: [],
    product: {
      id: paddedId,
      name,
      categoryId: '00000000-0000-0000-0000-000000000001',
      basePrice: priceCents / 100,
      happyHourPrice: null,
      sku: null,
      isActive: true,
      imageUrl: null,
      stock_threshold: null,
      comboEligible: true,
      isCombo: false,
      modifiers: [],
    },
  };
}

// ---------- Stories ----------

/** Empty column — shows "Tap an item to assign here" hint */
export const Empty: Story = {
  args: {
    label: 'Sub-tab 1',
    items: [],
    total: 0,
    isSelected: false,
    onSelect: () => undefined,
    onRemoveItem: () => undefined,
  },
};

/** Selected column — ring-2 ring-primary/30 highlight */
export const Selected: Story = {
  args: {
    ...Empty.args,
    label: 'Alice',
    isSelected: true,
  },
};

/** Column with 3 items */
export const WithItems: Story = {
  args: {
    ...Empty.args,
    label: 'Bob',
    items: [
      mockItem('1', 'Corona 355ml', 8500),
      mockItem('2', 'Alitas Búfalo', 12000),
      mockItem('3', 'Agua Mineral', 2500),
    ],
    total: 23000,
  },
};

/** Column with exactly 1 item */
export const SingleItem: Story = {
  args: {
    ...Empty.args,
    label: 'Charlie',
    items: [mockItem('1', 'Corona 355ml', 8500)],
    total: 8500,
  },
};
