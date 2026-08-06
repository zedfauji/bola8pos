// src/entities/combo/model/types.ts
// Re-export all combo types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  ComboSlot,
  ComboSlotOption,
  ComboAvailability,
} from '@shared/lib/domain';
