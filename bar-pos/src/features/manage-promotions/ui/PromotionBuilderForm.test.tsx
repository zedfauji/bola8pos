/**
 * PromotionBuilderForm tests
 *
 * Covers the conditional-field behavior from 20-UI-SPEC.md States Checklist:
 * discount-value swap-and-clear on discount-type change, the fixed-price
 * stacking hint's conditional visibility, and the target-picker swap between
 * the native product select and CategoryTreePicker.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as categoryEntity from '@entities/category';
import * as promotionEntity from '@entities/promotion';
import type { Category, Promotion } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';

import { PromotionBuilderForm } from './PromotionBuilderForm';

// ---------------------------------------------------------------------------
// jsdom polyfills — Radix Select uses pointer-capture APIs not implemented
// by jsdom; safe no-ops keep trigger/open/select interactions deterministic.
// ---------------------------------------------------------------------------

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@entities/promotion', () => ({
  usePromotion: vi.fn(),
  useMutationUpdatePromotion: vi.fn(),
}));

vi.mock('@entities/category', () => ({
  useCategories: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const promoId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const basePromotion: Promotion = {
  id: promoId,
  name: 'Happy Hour Beers',
  discountType: 'percentage',
  discountValue: 15,
  targetType: 'item',
  targetProductId: null,
  targetCategoryId: null,
  priority: 0,
  isActive: false,
  createdAt: new Date('2026-01-01'),
};

const mockCategories: Category[] = [
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Beers',
    color: '#ff0000',
    sortOrder: 0,
    happyHourStart: null,
    happyHourEnd: null,
    routing: 'NONE',
    parentId: null,
    createdAt: new Date('2026-01-01'),
  },
];

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupMocks(promotion: Promotion = basePromotion) {
  vi.mocked(promotionEntity.usePromotion).mockReturnValue({
    data: promotion,
    isLoading: false,
  } as unknown as ReturnType<typeof promotionEntity.usePromotion>);

  vi.mocked(promotionEntity.useMutationUpdatePromotion).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof promotionEntity.useMutationUpdatePromotion>);

  vi.mocked(categoryEntity.useCategories).mockReturnValue({
    data: mockCategories,
    isLoading: false,
  } as unknown as ReturnType<typeof categoryEntity.useCategories>);
}

function renderForm(promotion: Promotion = basePromotion) {
  setupMocks(promotion);
  const onSaved = vi.fn();
  return {
    ...renderWithProviders(<PromotionBuilderForm promotionId={promotion.id} onSaved={onSaved} />),
    onSaved,
  };
}

async function selectOption(user: ReturnType<typeof userEvent.setup>, triggerLabel: string, optionName: string) {
  await user.click(screen.getByLabelText(triggerLabel));
  const option = await screen.findByRole('option', { name: optionName });
  await user.click(option);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PromotionBuilderForm', () => {
  it('switching discount type from percentage to fixed_amount swaps the input and clears the stale value', async () => {
    const user = userEvent.setup();
    renderForm();

    // Percentage input shows the loaded value initially
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();

    await selectOption(user, 'Discount type', 'Fixed amount off');

    await waitFor(() => {
      // Stale percentage value must not carry over — MoneyInput starts at $0.00
      expect(screen.queryByDisplayValue('15')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('0.00')).toBeInTheDocument();
    });
  });

  it('fixed-price stacking hint appears only for fixed_price', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByText(/does not stack with promotions/i)).not.toBeInTheDocument();

    await selectOption(user, 'Discount type', 'Fixed override price');

    await waitFor(() => {
      expect(screen.getByText(/does not stack with promotions/i)).toBeInTheDocument();
    });

    await selectOption(user, 'Discount type', 'Percentage off');

    await waitFor(() => {
      expect(screen.queryByText(/does not stack with promotions/i)).not.toBeInTheDocument();
    });
  });

  it('switching target type to category shows CategoryTreePicker and to item shows the native product select', async () => {
    const user = userEvent.setup();
    renderForm();

    // Starts as 'item' target — native product select visible
    expect(screen.getByLabelText('Product')).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();

    await selectOption(user, 'Applies to', 'Category');

    await waitFor(() => {
      expect(screen.queryByLabelText('Product')).not.toBeInTheDocument();
      expect(screen.getByRole('tree')).toBeInTheDocument();
      expect(screen.getByText('Beers')).toBeInTheDocument();
    });

    await selectOption(user, 'Applies to', 'Item');

    await waitFor(() => {
      expect(screen.getByLabelText('Product')).toBeInTheDocument();
      expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    });
  });
});
