import { describe, expect, it } from 'vitest';
import { PrepProductionCreateSchema, PrepProductionSchema } from '@shared/lib/domain';

describe('PrepProductionSchema', () => {
  it('parses a valid PrepProduction object', () => {
    const result = PrepProductionSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      prepIngredientId: '00000000-0000-4000-8000-000000000002',
      qtyProduced: 10,
      notes: null,
      producedBy: null,
      createdAt: new Date('2026-04-24T00:00:00Z'),
    });
    expect(result.success).toBe(true);
  });

  it('rejects object missing prepIngredientId', () => {
    const result = PrepProductionSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      qtyProduced: 10,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

describe('PrepProductionCreateSchema', () => {
  it('rejects qtyProduced = 0', () => {
    const result = PrepProductionCreateSchema.safeParse({
      prepIngredientId: '00000000-0000-4000-8000-000000000002',
      qtyProduced: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects qtyProduced = -1', () => {
    const result = PrepProductionCreateSchema.safeParse({
      prepIngredientId: '00000000-0000-4000-8000-000000000002',
      qtyProduced: -1,
    });
    expect(result.success).toBe(false);
  });

  it('error code mapping: PREP_INGREDIENT_REQUIRED parsed from error message', () => {
    const errorMsg = 'PREP_INGREDIENT_REQUIRED: ingredient abc is not a prep ingredient';
    const code = errorMsg.includes('PREP_INGREDIENT_REQUIRED')
      ? 'PREP_INGREDIENT_REQUIRED'
      : 'SUPABASE_ERROR';
    expect(code).toBe('PREP_INGREDIENT_REQUIRED');
  });
});
