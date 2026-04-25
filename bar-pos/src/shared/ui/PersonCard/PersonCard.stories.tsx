import type { Meta, StoryObj } from '@storybook/react-vite';

import type { OrderItem } from '@shared/lib/domain';

import { PersonCard } from './PersonCard';

const meta: Meta<typeof PersonCard> = {
  title: 'shared/ui/PersonCard',
  component: PersonCard,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof PersonCard>;

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

/** Default auto-generated name, no items */
export const DefaultName: Story = {
  args: {
    name: 'Person 1',
    items: [],
    total: 0,
    isSelected: false,
    onSelect: () => undefined,
    onRemoveItem: () => undefined,
    onNameChange: () => undefined,
  },
};

/** Custom user-edited name */
export const CustomName: Story = {
  args: { ...DefaultName.args, name: 'Alice García' },
};

/** Selected (ring highlight) */
export const Selected: Story = {
  args: { ...DefaultName.args, name: 'Bob', isSelected: true },
};

/** With items assigned */
export const WithItems: Story = {
  args: {
    ...DefaultName.args,
    name: 'Charlie',
    items: [mockItem('1', 'Corona 355ml', 8500), mockItem('2', 'Nachos', 8500)],
    total: 17000,
  },
};
