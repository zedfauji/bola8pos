/**
 * ManagePromotionsTab tests
 *
 * Covers the tab's five list states (20-UI-SPEC.md States Checklist):
 * loading, error, empty, populated (name + target-type badge + Active switch),
 * and create-in-flight (clicking "+ Add promotion" calls the create mutation).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as promotionEntity from '@entities/promotion';
import type { Promotion } from '@shared/lib/domain';
import { renderWithProviders } from '@shared/lib/test-utils';

import { ManagePromotionsTab } from './ManagePromotionsTab';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@entities/promotion', () => ({
  usePromotions: vi.fn(),
  usePromotion: vi.fn(),
  useMutationCreatePromotion: vi.fn(),
  useMutationUpdatePromotion: vi.fn(),
  useMutationDeletePromotion: vi.fn(),
  usePromotionAvailabilityWindows: vi.fn(),
  promotionKeys: {
    all: ['promotions'],
    lists: () => ['promotions', 'list'],
    detail: (id: string) => ['promotions', 'detail', id],
    availability: (id: string) => ['promotions', 'availability', id],
  },
}));

vi.mock('@entities/category', () => ({
  useCategories: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const promoId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockPromotion: Promotion = {
  id: promoId,
  name: 'Happy Hour Beers',
  discountType: 'percentage',
  discountValue: 20,
  targetType: 'item',
  targetProductId: null,
  targetCategoryId: null,
  priority: 0,
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

const mockCreateMutateAsync = vi.fn();

function setupDefaultMocks() {
  vi.mocked(promotionEntity.usePromotions).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof promotionEntity.usePromotions>);

  vi.mocked(promotionEntity.useMutationCreatePromotion).mockReturnValue({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof promotionEntity.useMutationCreatePromotion>);

  vi.mocked(promotionEntity.useMutationUpdatePromotion).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof promotionEntity.useMutationUpdatePromotion>);

  vi.mocked(promotionEntity.useMutationDeletePromotion).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof promotionEntity.useMutationDeletePromotion>);

  vi.mocked(promotionEntity.usePromotion).mockReturnValue({
    data: mockPromotion,
    isLoading: false,
  } as unknown as ReturnType<typeof promotionEntity.usePromotion>);

  vi.mocked(promotionEntity.usePromotionAvailabilityWindows).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof promotionEntity.usePromotionAvailabilityWindows>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

describe('ManagePromotionsTab', () => {
  it('loading: renders "Loading promotions…"', () => {
    vi.mocked(promotionEntity.usePromotions).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof promotionEntity.usePromotions>);

    renderWithProviders(<ManagePromotionsTab />);

    expect(screen.getByText('Loading promotions…')).toBeInTheDocument();
  });

  it('error: renders "Could not load promotions: {message}"', () => {
    vi.mocked(promotionEntity.usePromotions).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('network down'),
    } as unknown as ReturnType<typeof promotionEntity.usePromotions>);

    renderWithProviders(<ManagePromotionsTab />);

    expect(screen.getByText('Could not load promotions: network down')).toBeInTheDocument();
  });

  it('empty: renders "No promotions yet" + "Add promotion" CTA', () => {
    renderWithProviders(<ManagePromotionsTab />);

    expect(screen.getByText('No promotions yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add promotion' })).toBeInTheDocument();
  });

  it('populated: renders a row with name, target-type badge, and Active switch', () => {
    vi.mocked(promotionEntity.usePromotions).mockReturnValue({
      data: [mockPromotion],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof promotionEntity.usePromotions>);

    renderWithProviders(<ManagePromotionsTab />);

    expect(screen.getByText('Happy Hour Beers')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Happy Hour Beers active' })
    ).toBeInTheDocument();
  });

  it('clicking "+ Add promotion" calls the create mutation', async () => {
    const user = userEvent.setup();
    mockCreateMutateAsync.mockResolvedValue(promoId);

    renderWithProviders(<ManagePromotionsTab />);

    await user.click(screen.getByRole('button', { name: '+ Add promotion' }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalled();
    });
  });
});
