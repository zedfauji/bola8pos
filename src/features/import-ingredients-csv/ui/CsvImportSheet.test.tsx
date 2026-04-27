import { describe, expect, it } from 'vitest';
import { IngredientCreateSchema } from '@entities/ingredient';
import { parseCsvText } from './CsvImportSheet';

// ---------------------------------------------------------------------------
// parseCsvText — pure function tests
// ---------------------------------------------------------------------------

describe('parseCsvText', () => {
  const HEADER =
    'name,base_uom,purchase_uom,purchase_to_base_factor,cost_per_base_unit,reorder_point,category,is_prep';
  const DATA_ROW = 'Tomato,g,kg,1000,0.012,2000,produce,false';

  it('parses a valid 2-row CSV (header + data) into a 2-element string[][]', () => {
    const result = parseCsvText(`${HEADER}\n${DATA_ROW}`);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      'name',
      'base_uom',
      'purchase_uom',
      'purchase_to_base_factor',
      'cost_per_base_unit',
      'reorder_point',
      'category',
      'is_prep',
    ]);
    expect(result[1]?.[0]).toBe('Tomato');
  });

  it('handles Windows CRLF line endings identically to LF', () => {
    const lfResult = parseCsvText(`${HEADER}\n${DATA_ROW}`);
    const crlfResult = parseCsvText(`${HEADER}\r\n${DATA_ROW}`);
    expect(crlfResult).toEqual(lfResult);
  });

  it('filters out blank trailing lines', () => {
    const result = parseCsvText(`${HEADER}\n${DATA_ROW}\n\n`);
    expect(result).toHaveLength(2); // no phantom empty row
  });

  it('trims whitespace from each cell', () => {
    const result = parseCsvText('name , base_uom \n Tomato , g ');
    expect(result[0]?.[0]).toBe('name');
    expect(result[1]?.[0]).toBe('Tomato');
    expect(result[1]?.[1]).toBe('g');
  });
});

// ---------------------------------------------------------------------------
// IngredientCreateSchema.safeParse — per-row validation tests
// ---------------------------------------------------------------------------

describe('IngredientCreateSchema per-row validation', () => {
  const validRow = {
    name: 'Tomato',
    uom: 'g',
    purchaseUom: 'kg',
    purchaseToBaseFactor: 1000,
    costPerBaseUnit: 0.012,
    reorderPoint: 2000,
    category: 'produce',
    isPrep: false,
    isActive: true,
  };

  it('accepts a valid row', () => {
    const result = IngredientCreateSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('rejects a row with empty name', () => {
    const result = IngredientCreateSchema.safeParse({ ...validRow, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a row with an invalid uom value (oz is not in the allowed list)', () => {
    const result = IngredientCreateSchema.safeParse({ ...validRow, uom: 'oz' });
    expect(result.success).toBe(false);
  });

  it('accepts a row with extra fields stripped (Zod strips unknown keys by default)', () => {
    const result = IngredientCreateSchema.safeParse({
      ...validRow,
      extraColumn: 'ignored',
      anotherExtra: 999,
    });
    expect(result.success).toBe(true);
  });
});
