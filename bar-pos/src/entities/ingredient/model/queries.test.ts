/**
 * Unit tests for ingredient query hooks:
 *   - useIngredients() — list all active ingredients
 *   - useIngredient(id) — single ingredient lookup with enabled guard
 *
 * Tests verify:
 *   - success path: DB row is mapped to Ingredient passing IngredientSchema.safeParse
 *   - error path: supabase error causes hook isError = true
 *   - disabled path: useIngredient(null) is idle (enabled guard)
 */

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@shared/lib/supabase';
import { createTestQueryClient } from '@shared/lib/test-utils';
import { useIngredient, useIngredients } from './queries';
import { IngredientSchema } from './types';

// ---------------------------------------------------------------------------
// Supabase mock handle (globally mocked in test-setup.ts)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedFrom = vi.mocked(supabase).from;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Mock DB row factory
// ---------------------------------------------------------------------------

function makeMockIngredientRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Test Ingredient',
    uom: 'g',
    purchase_uom: 'kg',
    purchase_to_base_factor: '1000',
    cost_per_base_unit: '0.012',
    quantity_on_hand: '500',
    reorder_point: '200',
    is_prep: false,
    is_active: true,
    category: 'produce',
    created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// useIngredients
// ---------------------------------------------------------------------------

describe('useIngredients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped ingredients when query succeeds', async () => {
    mockedFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [makeMockIngredientRow()], error: null }),
    }));

    const qc = createTestQueryClient();
    const { result } = renderHook(() => useIngredients(), { wrapper: makeWrapper(qc) });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toHaveLength(1);
    const parsed = IngredientSchema.safeParse(result.current.data?.[0]);
    expect(parsed.success).toBe(true);
  });

  it('enters error state when supabase returns an error', async () => {
    mockedFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }));

    const qc = createTestQueryClient();
    const { result } = renderHook(() => useIngredients(), { wrapper: makeWrapper(qc) });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
  });
});

// ---------------------------------------------------------------------------
// useIngredient
// ---------------------------------------------------------------------------

describe('useIngredient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled (idle) when id is null', () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useIngredient(null), { wrapper: makeWrapper(qc) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('returns a mapped Ingredient when id is provided and row exists', async () => {
    mockedFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: makeMockIngredientRow(), error: null }),
    }));

    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => useIngredient('aaaaaaaa-0000-0000-0000-000000000001'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    const parsed = IngredientSchema.safeParse(result.current.data);
    expect(parsed.success).toBe(true);
  });
});
