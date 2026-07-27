import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { KdsOrderItem } from '@entities/kds';
import { KdsCard } from './index';

function buildKdsItem(overrides?: Partial<KdsOrderItem>): KdsOrderItem {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    orderId: '00000000-0000-0000-0000-000000000002',
    productId: '00000000-0000-0000-0000-000000000003',
    productName: 'Nachos',
    categoryId: '00000000-0000-0000-0000-000000000004',
    routing: 'KITCHEN',
    quantity: 1,
    notes: null,
    kdsStatus: 'pending',
    createdAt: new Date('2026-07-26T12:00:00Z'),
    tabCustomerName: null,
    tableNumber: null,
    modifierNames: [],
    parentOrderItemId: null,
    comboSlotId: null,
    ...overrides,
  };
}

describe('KdsCard modifiers', () => {
  it('renders one distinct line per modifier via the shared formatter', () => {
    const item = buildKdsItem({ modifierNames: ['Extra cheese', 'No ice'] });
    render(<KdsCard item={item} onBump={vi.fn()} isBumping={false} />);

    const wrapper = screen.getByTestId('kds-item-modifiers');
    const lines = wrapper.querySelectorAll('p');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('Extra cheese');
    expect(lines[1]).toHaveTextContent('No ice');
  });

  it('does not join modifier names with a slash separator', () => {
    const item = buildKdsItem({ modifierNames: ['Extra cheese', 'No ice'] });
    render(<KdsCard item={item} onBump={vi.fn()} isBumping={false} />);

    const wrapper = screen.getByTestId('kds-item-modifiers');
    expect(wrapper.textContent).not.toContain(' / ');
  });

  it('renders no modifier block when there are no modifiers', () => {
    const item = buildKdsItem({ modifierNames: [] });
    render(<KdsCard item={item} onBump={vi.fn()} isBumping={false} />);

    expect(screen.queryByTestId('kds-item-modifiers')).not.toBeInTheDocument();
  });

  it('still renders the notes paragraph unchanged', () => {
    const item = buildKdsItem({ notes: 'No onions please' });
    render(<KdsCard item={item} onBump={vi.fn()} isBumping={false} />);

    expect(screen.getByText(/No onions please/)).toBeInTheDocument();
  });
});
