// src/entities/ingredient/model/types.ts
//
// Re-export all ingredient types from the single source of truth in domain.ts.
// Never define types here — always infer from Zod schemas in domain.ts.
export type {
  Ingredient,
  IngredientCreate,
  ManualAdjustReason,
} from '@shared/lib/domain';

export {
  IngredientSchema,
  IngredientCreateSchema,
} from '@shared/lib/domain';
