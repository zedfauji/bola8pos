import { describe, expect, it } from 'vitest';
import { ResourceTypeSchema, ResourceSchema } from './domain';

describe('ResourceTypeSchema', () => {
  it('accepts valid types', () => {
    expect(ResourceTypeSchema.parse('pool')).toBe('pool');
    expect(ResourceTypeSchema.parse('carom')).toBe('carom');
    expect(ResourceTypeSchema.parse('consumption')).toBe('consumption');
  });

  it('rejects invalid type', () => {
    expect(() => ResourceTypeSchema.parse('billiards')).toThrow();
  });
});

describe('ResourceSchema tableType field', () => {
  const baseTable = {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    label: 'T-01',
    ratePerHour: 60,
    status: 'available',
    currentSessionId: null,
  };

  it('defaults tableType to pool when not provided', () => {
    const result = ResourceSchema.parse(baseTable);
    expect(result.tableType).toBe('pool');
  });

  it('accepts carom type', () => {
    const result = ResourceSchema.parse({ ...baseTable, tableType: 'carom' });
    expect(result.tableType).toBe('carom');
  });

  it('accepts consumption type', () => {
    const result = ResourceSchema.parse({ ...baseTable, tableType: 'consumption' });
    expect(result.tableType).toBe('consumption');
  });
});
