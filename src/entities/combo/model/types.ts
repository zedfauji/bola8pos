// src/entities/combo/model/types.ts
// Re-export all combo types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
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
} from '@shared/lib/domain';
export {
  ComboSlotSchema,
  ComboSlotOptionSchema,
  ComboAvailabilitySchema,
  SlotSelectionSchema,
} from '@shared/lib/domain';
