// src/entities/promotion/model/types.ts
// Re-export all promotion types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  PromotionAvailability,
} from '@shared/lib/domain';
