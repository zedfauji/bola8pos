import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@shared/lib/logger-instance', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { supabase } from '@shared/lib/supabase';

import { promotionKeys, usePromotions } from './queries';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestQueryClientProvider';
  return Wrapper;
};

function mockFrom(result: { data: unknown; error: unknown }): void {
  const orderMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn().mockReturnValue({ order: orderMock });
  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    select: selectMock,
  } as unknown as ReturnType<typeof supabase.from>);
}

describe('promotionKeys', () => {
  it('lists() is scoped under the all/list namespace', () => {
    expect(promotionKeys.all).toEqual(['promotions']);
    expect(promotionKeys.lists()).toEqual(['promotions', 'list']);
  });

  it('detail(id) and availability(id) are distinctly scoped from lists()', () => {
    expect(promotionKeys.detail('promo-1')).toEqual(['promotions', 'detail', 'promo-1']);
    expect(promotionKeys.availability('promo-1')).toEqual(['promotions', 'availability', 'promo-1']);
  });
});

describe('usePromotions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a snake_case row to a parsed Promotion', async () => {
    const mockRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Happy Hour Beer',
      discount_type: 'percentage',
      discount_value: 20,
      target_type: 'category',
      target_product_id: null,
      target_category_id: '223e4567-e89b-12d3-a456-426614174001',
      priority: 1,
      is_active: true,
      created_at: '2026-07-09T00:00:00.000Z',
    };
    mockFrom({ data: [mockRow], error: null });

    const { result } = renderHook(() => usePromotions(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const promotions = result.current.data;
    expect(promotions).toHaveLength(1);
    expect(promotions?.[0]?.name).toBe('Happy Hour Beer');
    expect(promotions?.[0]?.discountType).toBe('percentage');
    expect(promotions?.[0]?.targetCategoryId).toBe('223e4567-e89b-12d3-a456-426614174001');
    expect(promotions?.[0]?.isActive).toBe(true);
  });
});
