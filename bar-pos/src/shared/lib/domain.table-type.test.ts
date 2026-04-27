import { describe, expect, it } from 'vitest';
import { PoolTableTypeSchema, PoolTableSchema } from './domain';

describe('PoolTableTypeSchema', () => {
  it('accepts valid types', () => {
    expect(PoolTableTypeSchema.parse('pool')).toBe('pool');
    expect(PoolTableTypeSchema.parse('carom')).toBe('carom');
    expect(PoolTableTypeSchema.parse('consumption')).toBe('consumption');
  });

  it('rejects invalid type', () => {
    expect(() => PoolTableTypeSchema.parse('billiards')).toThrow();
  });
});

describe('PoolTableSchema tableType field', () => {
  const baseTable = {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    label: 'T-01',
    ratePerHour: 60,
    status: 'available',
    currentSessionId: null,
  };

  it('defaults tableType to pool when not provided', () => {
    const result = PoolTableSchema.parse(baseTable);
    expect(result.tableType).toBe('pool');
  });

  it('accepts carom type', () => {
    const result = PoolTableSchema.parse({ ...baseTable, tableType: 'carom' });
    expect(result.tableType).toBe('carom');
  });

  it('accepts consumption type', () => {
    const result = PoolTableSchema.parse({ ...baseTable, tableType: 'consumption' });
    expect(result.tableType).toBe('consumption');
  });
});
