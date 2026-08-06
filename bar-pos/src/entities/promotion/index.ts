/**
 * Promotion entity public API.
 *
 * Import from here: `import { usePromotions } from '@entities/promotion'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export { usePromotions, usePromotion, useMutationCreatePromotion, useMutationUpdatePromotion, useMutationDeletePromotion, usePromotionAvailabilityWindows, useActivePromotions, promotionKeys } from './model/queries';
export type { PromotionAvailability } from './model/types';
export type { ActivePromotionEntry } from './model/queries';
