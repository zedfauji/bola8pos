import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ComboSlot, ComboSlotOption, SlotSelection } from '@shared/lib/domain';

import { ComboSlotCard } from './ComboSlotCard';

const meta: Meta<typeof ComboSlotCard> = {
  title: 'shared/ui/ComboSlotCard',
  component: ComboSlotCard,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ComboSlotCard>;

// ---------- Mock data ----------

const MOCK_SLOT_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_CREATED_AT = new Date('2026-01-01T00:00:00Z');

const MOCK_SLOT: ComboSlot = {
  id: MOCK_SLOT_ID,
  comboProductId: '00000000-0000-0000-0000-000000000001',
  label: 'Choose your drink',
  slotType: 'product',
  minQty: 1,
  maxQty: 1,
  isRequired: true,
  sortOrder: 0,
  createdAt: MOCK_CREATED_AT,
};

const MOCK_OPTIONS: ComboSlotOption[] = [
  {
    id: 'opt-1',
    comboSlotId: MOCK_SLOT_ID,
    childProductId: 'prod-1',
    prepaidMinutes: null,
    sortOrder: 0,
    createdAt: MOCK_CREATED_AT,
  },
  {
    id: 'opt-2',
    comboSlotId: MOCK_SLOT_ID,
    childProductId: 'prod-2',
    prepaidMinutes: null,
    sortOrder: 1,
    createdAt: MOCK_CREATED_AT,
  },
  {
    id: 'opt-3',
    comboSlotId: MOCK_SLOT_ID,
    childProductId: 'prod-3',
    prepaidMinutes: null,
    sortOrder: 2,
    createdAt: MOCK_CREATED_AT,
  },
];

const MOCK_PRODUCT_MAP: Record<string, { name: string; basePrice: number }> = {
  'prod-1': { name: 'Modelo Especial', basePrice: 0 },
  'prod-2': { name: 'Corona Extra', basePrice: 0 },
  'prod-3': { name: 'Michelada', basePrice: 2.5 },
};

const EMPTY_SELECTION: SlotSelection = {
  slotId: MOCK_SLOT_ID,
  childProductId: null,
  qty: 0,
};

const FILLED_SELECTION: SlotSelection = {
  slotId: MOCK_SLOT_ID,
  childProductId: 'prod-1',
  qty: 1,
};

const POOL_TIME_SLOT: ComboSlot = {
  id: '22222222-2222-2222-2222-222222222222',
  comboProductId: '00000000-0000-0000-0000-000000000001',
  label: 'Pool time',
  slotType: 'pool_time',
  minQty: 1,
  maxQty: 1,
  isRequired: true,
  sortOrder: 2,
  createdAt: MOCK_CREATED_AT,
};

const RANGE_SLOT: ComboSlot = {
  ...MOCK_SLOT,
  id: '33333333-3333-3333-3333-333333333333',
  label: 'Choose snack quantity',
  minQty: 1,
  maxQty: 3,
};

const RANGE_OPTIONS: ComboSlotOption[] = [
  {
    id: 'opt-r1',
    comboSlotId: RANGE_SLOT.id,
    childProductId: 'prod-snack',
    prepaidMinutes: null,
    sortOrder: 0,
    createdAt: MOCK_CREATED_AT,
  },
];

const RANGE_PRODUCT_MAP: Record<string, { name: string; basePrice: number }> = {
  'prod-snack': { name: 'Nachos', basePrice: 3.5 },
};

const RANGE_SELECTION: SlotSelection = {
  slotId: RANGE_SLOT.id,
  childProductId: 'prod-snack',
  qty: 2,
};

// ---------- Stories ----------

/** Required slot with no selection — shows validation red border */
export const Default: Story = {
  args: {
    slot: MOCK_SLOT,
    options: MOCK_OPTIONS,
    productMap: MOCK_PRODUCT_MAP,
    value: EMPTY_SELECTION,
    onChange: () => undefined,
  },
};

/** Required slot with an option selected */
export const Filled: Story = {
  args: {
    slot: MOCK_SLOT,
    options: MOCK_OPTIONS,
    productMap: MOCK_PRODUCT_MAP,
    value: FILLED_SELECTION,
    onChange: () => undefined,
  },
};

/** Slot with min != max quantity — shows QuantityControl after selection */
export const QuantityRange: Story = {
  args: {
    slot: RANGE_SLOT,
    options: RANGE_OPTIONS,
    productMap: RANGE_PRODUCT_MAP,
    value: RANGE_SELECTION,
    onChange: () => undefined,
  },
};

/** Pool time slot — non-interactive info card */
export const PoolTimeSlot: Story = {
  args: {
    slot: POOL_TIME_SLOT,
    options: [],
    productMap: {},
    value: { slotId: POOL_TIME_SLOT.id, childProductId: null, qty: 0 },
    onChange: () => undefined,
  },
};

/** Required slot unfilled — explicit validation error state */
export const ValidationError: Story = {
  args: {
    slot: { ...MOCK_SLOT, isRequired: true },
    options: MOCK_OPTIONS,
    productMap: MOCK_PRODUCT_MAP,
    value: EMPTY_SELECTION,
    onChange: () => undefined,
  },
  name: 'ValidationError (Required + Unfilled)',
};
