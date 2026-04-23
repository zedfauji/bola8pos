/**
 * Combo entity public API.
 *
 * Import from here: `import { useCombos } from '@entities/combo'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export {
  useCombo,
  useCombos,
  useComboSlots,
  useComboSlotOptions,
  useComboAvailabilityWindows,
  useComboAvailability,
  comboKeys,
} from './model/queries';
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
} from './model/types';
