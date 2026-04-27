import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { generateMockCategory, generateMockProduct, MOCK_IDS } from '@shared/lib/mocks';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('renders happy hour badge when time is within category happy hour window', () => {
    const category = generateMockCategory({
      id: MOCK_IDS.categoryBeer,
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    const product = generateMockProduct({
      categoryId: category.id,
      category,
      happyHourPrice: 5.5,
      isActive: true,
    });
    const now = new Date('2024-06-15T17:30:00');

    render(<ProductCard product={product} category={category} now={now} onSelect={vi.fn()} />);

    expect(screen.getByText('HAPPY HOUR')).toBeInTheDocument();
  });

  it('does not render happy hour badge when time is outside the window', () => {
    const category = generateMockCategory({
      id: MOCK_IDS.categoryBeer,
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    const product = generateMockProduct({
      categoryId: category.id,
      category,
      happyHourPrice: 5.5,
      isActive: true,
    });
    const now = new Date('2024-06-15T20:00:00');

    render(<ProductCard product={product} category={category} now={now} onSelect={vi.fn()} />);

    expect(screen.queryByText('HAPPY HOUR')).not.toBeInTheDocument();
  });

  it('calls onSelect when tapped', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const category = generateMockCategory({ id: MOCK_IDS.categoryBeer });
    const product = generateMockProduct({
      categoryId: category.id,
      category,
      isActive: true,
    });

    render(<ProductCard product={product} category={category} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /Select Heineken/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(product);
  });
});
