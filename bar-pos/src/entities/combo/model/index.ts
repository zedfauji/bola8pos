/**
 * COMBO ENTITY MODEL - BARREL EXPORT
 */

// Types & Schemas
export {
  ComboSlotSchema,
  ComboSlotOptionSchema,
  ComboAvailabilitySchema,
  SlotSelectionSchema,
} from './types';
export type {
  ComboSlot,
  ComboSlotCreate,
  ComboSlotUpdate,
  ComboSlotOption,
  ComboSlotOptionCreate,
  ComboAvailability,
  ComboAvailabilityCreate,
  SlotSelection,
  AddComboToTabInput,
} from './types';

// Query keys (for external invalidation if needed)
export { comboKeys } from './queries';

// Data Fetching
export {
  useCombo,
  useCombos,
  useComboSlots,
  useComboSlotOptions,
  useComboAvailabilityWindows,
  useComboAvailability,
} from './queries';
