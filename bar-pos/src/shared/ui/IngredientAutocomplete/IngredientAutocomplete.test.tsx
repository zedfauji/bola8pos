import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IngredientAutocomplete } from './IngredientAutocomplete';
import * as ingredientQueries from '@entities/ingredient/model/queries';
import type { Ingredient } from '@shared/lib/domain';

// jsdom does not implement scrollIntoView — cmdk calls it when opening the list
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockIngredients: Ingredient[] = [
  {
    id: 'ing-beer',
    name: 'Beer',
    uom: 'L',
    purchaseUom: null,
    purchaseToBaseFactor: 1,
    costPerBaseUnit: 2.5,
    quantityOnHand: 10,
    reorderPoint: 5,
    isPrep: false,
    isActive: true,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ing-lime',
    name: 'Lime juice',
    uom: 'ml',
    purchaseUom: null,
    purchaseToBaseFactor: 1,
    costPerBaseUnit: 0.5,
    quantityOnHand: 0,
    reorderPoint: null,
    isPrep: false,
    isActive: true,
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock('@entities/ingredient/model/queries', () => ({
  useIngredients: vi.fn(),
}));

function setup(value: string | null = null) {
  const onSelect = vi.fn();
  const onClear = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(ingredientQueries.useIngredients).mockReturnValue({
    data: mockIngredients,
    isLoading: false,
  } as any);
  render(<IngredientAutocomplete value={value} onSelect={onSelect} onClear={onClear} />);
  return { onSelect, onClear };
}

describe('IngredientAutocomplete', () => {
  it('renders trigger button with role=combobox and aria-expanded=false', () => {
    setup();
    const btn = screen.getByRole('combobox');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens popover command list on trigger click', () => {
    setup();
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByPlaceholderText('Search ingredients…')).toBeInTheDocument();
  });

  it('calls onSelect with ingredient when item clicked', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Beer'));
    expect(onSelect).toHaveBeenCalledWith(mockIngredients[0]);
  });

  it('shows text-destructive class for zero-stock ingredient', () => {
    setup();
    fireEvent.click(screen.getByRole('combobox'));
    const stockText = screen.getByText('0 ml');
    expect(stockText).toHaveClass('text-destructive');
  });

  it('shows loading skeleton while isLoading=true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(ingredientQueries.useIngredients).mockReturnValue({
      data: [],
      isLoading: true,
    } as any);
    render(<IngredientAutocomplete value={null} onSelect={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByText('Beer')).not.toBeInTheDocument();
  });
});
