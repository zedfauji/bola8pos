// src/entities/promotion/model/types.ts
// Re-export all promotion types from the single source of truth in domain.ts.
// Never define types here — infer from Zod schemas.
export type {
  Promotion,
  PromotionCreate,
  PromotionUpdate,
  PromotionAvailability,
  PromotionAvailabilityCreate,
  AppliedPromotion,
} from '@shared/lib/domain';
export {
  PromotionSchema,
  PromotionCreateSchema,
  PromotionUpdateSchema,
  PromotionAvailabilitySchema,
  PromotionAvailabilityCreateSchema,
  AppliedPromotionSchema,
} from '@shared/lib/domain';
