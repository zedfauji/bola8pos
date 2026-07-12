/**
 * PROMOTION ENTITY MODEL - BARREL EXPORT
 */

// Types & Schemas
export {
  PromotionSchema,
  PromotionCreateSchema,
  PromotionUpdateSchema,
  PromotionAvailabilitySchema,
  PromotionAvailabilityCreateSchema,
  AppliedPromotionSchema,
} from './types';
export type {
  Promotion,
  PromotionCreate,
  PromotionUpdate,
  PromotionAvailability,
  PromotionAvailabilityCreate,
  AppliedPromotion,
} from './types';

// Query keys (for external invalidation if needed)
export { promotionKeys } from './queries';

// Data Fetching / Mutations
export {
  usePromotions,
  usePromotion,
  useMutationCreatePromotion,
  useMutationUpdatePromotion,
  useMutationDeletePromotion,
  usePromotionAvailabilityWindows,
  usePromotionActive,
  useActivePromotions,
} from './queries';
export type { ActivePromotionEntry } from './queries';
