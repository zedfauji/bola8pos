import type { Meta, StoryObj } from '@storybook/react-vite';
import { useCartStore } from '@entities/tab/model/cartStore';
import { useTabStore } from '@entities/tab/model/store';
import { mockTab } from '@entities/tab/model/types';
import type { CartItem as CartLine, Modifier, Product } from '@shared/lib/domain';
import { CartPanel } from './CartPanel';

const meta = {
  title: 'Widgets/OrderPanel/CartPanel',
  component: CartPanel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CartPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleProduct: Product = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Margarita',
  categoryId: '123e4567-e89b-12d3-a456-426614174099',
  basePrice: 12,
  happyHourPrice: 9,
  imageUrl: null,
  isActive: true,
  sku: 'COCKTAIL-MARG',
  modifiers: [],
};

const sampleModifier: Modifier = {
  id: '123e4567-e89b-12d3-a456-426614174030',
  name: 'Double Shot',
  priceDelta: 3,
  sortOrder: 1,
};

function makeLine(overrides: Partial<CartLine>): CartLine {
  const product = overrides.product ?? sampleProduct;
  const selectedModifiers = overrides.selectedModifiers ?? [];
  const quantity = overrides.quantity ?? 1;
  const unitPrice = overrides.unitPrice ?? product.basePrice;
  const lineTotal =
    overrides.lineTotal ??
    (unitPrice + selectedModifiers.reduce((s, m) => s + m.priceDelta, 0)) * quantity;

  return {
    tempId: overrides.tempId ?? '123e4567-e89b-12d3-a456-426614174020',
    product,
    quantity,
    selectedModifiers,
    unitPrice,
    notes: overrides.notes ?? '',
    lineTotal,
  };
}

export const Empty: Story = {
  decorators: [
    Story => {
      useCartStore.setState({ items: [] });
      useTabStore.setState({
        activeTabId: mockTab.id,
        selectedTabId: mockTab.id,
        tabs: [mockTab],
      });
      return (
        <div className="h-[560px] w-[400px] overflow-hidden rounded-lg border">
          <Story />
        </div>
      );
    },
  ],
};

export const WithItems: Story = {
  decorators: [
    Story => {
      useCartStore.setState({
        items: [
          makeLine({}),
          makeLine({
            tempId: '123e4567-e89b-12d3-a456-426614174021',
            selectedModifiers: [sampleModifier],
            lineTotal: (12 + 3) * 2,
            quantity: 2,
          }),
        ],
      });
      useTabStore.setState({
        activeTabId: mockTab.id,
        selectedTabId: mockTab.id,
        tabs: [mockTab],
      });
      return (
        <div className="h-[560px] w-[400px] overflow-hidden rounded-lg border">
          <Story />
        </div>
      );
    },
  ],
};
