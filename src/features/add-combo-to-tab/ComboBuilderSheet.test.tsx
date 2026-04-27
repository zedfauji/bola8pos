/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Integration tests for ComboBuilderSheet
 *
 * Covers:
 * 1. Required slot unfilled → "Add to Order" button disabled
 * 2. Required slot filled → "Add to Order" button enabled
 * 3. Discard → onClose() called, no RPC
 * 4. overrideActive=true → yellow Alert banner with "Manager override" text
 * 5. On successful confirm → RPC called with correct arguments
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as comboEntity from '@entities/combo';
import * as productQueries from '@entities/product/model/queries';
import type { ComboSlot, ComboSlotOption, Product } from '@shared/lib/domain';
import * as supabaseModule from '@shared/lib/supabase';
import { renderWithProviders } from '@shared/lib/test-utils';

import { ComboBuilderSheet } from './ui/ComboBuilderSheet';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@entities/combo', () => ({
  useComboSlots: vi.fn(),
  useComboSlotOptions: vi.fn(),
}));

vi.mock('@entities/product/model/queries', () => ({
  useProducts: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const comboId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const tabId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const slotId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const optionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const childProductId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const mockChildProduct: Product = {
  id: childProductId,
  name: 'Corona Beer',
  categoryId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  basePrice: 50,
  happyHourPrice: null,
  sku: null,
  isActive: true,
  imageUrl: null,
  stock_threshold: null,
  modifiers: [],
  comboEligible: true,
  isCombo: false,
};

const mockCombo: Product = {
  id: comboId,
  name: 'Beer + Pool Combo',
  categoryId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  basePrice: 150,
  happyHourPrice: null,
  sku: null,
  isActive: true,
  imageUrl: null,
  stock_threshold: null,
  modifiers: [],
  comboEligible: false,
  isCombo: true,
  comboPriceOverride: null,
};

const mockSlot: ComboSlot = {
  id: slotId,
  comboProductId: comboId,
  label: 'Choose a beer',
  slotType: 'product',
  minQty: 1,
  maxQty: 1,
  isRequired: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01'),
};

const mockOption: ComboSlotOption = {
  id: optionId,
  comboSlotId: slotId,
  childProductId,
  prepaidMinutes: null,
  sortOrder: 1,
  createdAt: new Date('2026-01-01'),
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupMocks() {
  vi.mocked(comboEntity.useComboSlots).mockReturnValue({
    data: [mockSlot],
    isLoading: false,
  } as unknown as ReturnType<typeof comboEntity.useComboSlots>);

  vi.mocked(comboEntity.useComboSlotOptions).mockReturnValue({
    data: [mockOption],
    isLoading: false,
  } as unknown as ReturnType<typeof comboEntity.useComboSlotOptions>);

  vi.mocked(supabaseModule.supabase.rpc).mockResolvedValue({
    data: 'parent-order-item-id',
    error: null,
  } as unknown as ReturnType<typeof supabaseModule.supabase.rpc>);

  vi.mocked(productQueries.useProducts).mockReturnValue({
    data: [mockCombo, mockChildProduct],
    isLoading: false,
  } as unknown as ReturnType<typeof productQueries.useProducts>);
}

function renderSheet(
  overrides: {
    open?: boolean;
    overrideActive?: boolean;
    combo?: Product | null;
  } = {}
) {
  const onClose = vi.fn();

  const utils = renderWithProviders(
    <ComboBuilderSheet
      combo={overrides.combo !== undefined ? overrides.combo : mockCombo}
      tabId={tabId}
      open={overrides.open ?? true}
      overrideActive={overrides.overrideActive ?? false}
      onClose={onClose}
    />
  );

  return { ...utils, onClose };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ComboBuilderSheet', () => {
  it('Required slot unfilled: "Add to Order" button is disabled', () => {
    renderSheet();
    const addButton = screen.getByRole('button', { name: /add to order/i });
    expect(addButton).toBeDisabled();
  });

  it('Required slot filled: "Add to Order" button is enabled', async () => {
    const user = userEvent.setup();
    renderSheet();

    // Click on the option to select it — it renders as role=option inside listbox
    const optionButtons = screen.getAllByRole('option', { hidden: true });
    await user.click(optionButtons[0]!);

    const addButton = screen.getByRole('button', { name: /add to order/i });
    expect(addButton).not.toBeDisabled();
  });

  it('Discard button: calls onClose(), no RPC invoked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet();

    await user.click(screen.getByRole('button', { name: /discard/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(supabaseModule.supabase.rpc).not.toHaveBeenCalled();
  });

  it('overrideActive=true: renders yellow Alert banner with "Manager override" text', () => {
    renderSheet({ overrideActive: true });
    expect(screen.getByText(/manager override/i)).toBeInTheDocument();
  });

  it('Confirm with filled slot: RPC called with correct arguments', async () => {
    const user = userEvent.setup();
    renderSheet();

    // Select the option
    const optionButtons = screen.getAllByRole('option', { hidden: true });
    await user.click(optionButtons[0]!);

    // Click Add to Order
    const addButton = screen.getByRole('button', { name: /add to order/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(supabaseModule.supabase.rpc).toHaveBeenCalledWith(
        'add_combo_to_tab',
        expect.objectContaining({
          p_combo_product_id: comboId,
          p_tab_id: tabId,
          p_override_availability: false,
        })
      );
    });
  });

  it('NESTED_COMBO_FORBIDDEN error: shows nested combo toast', async () => {
    // Override the default success mock for this test only
    vi.mocked(supabaseModule.supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        message: 'NESTED_COMBO_FORBIDDEN: Product X is a combo; cannot be a child',
        code: '22000',
      },
    } as unknown as ReturnType<typeof supabaseModule.supabase.rpc>);

    const user = userEvent.setup();
    renderSheet();

    // Fill the required slot so the button becomes enabled
    const optionButtons = screen.getAllByRole('option', { hidden: true });
    await user.click(optionButtons[0]!);

    // Confirm
    const addButton = screen.getByRole('button', { name: /add to order/i });
    await user.click(addButton);

    // The onError handler in useAddComboToTab fires toast.error('Nested combos are not allowed.')
    // sonner's toast is mocked, so assert via the mock
    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Nested combos are not allowed.');
    });
  });
});
