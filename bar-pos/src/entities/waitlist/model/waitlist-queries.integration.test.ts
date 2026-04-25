/**
 * Integration tests for entities/waitlist model layer.
 * Wave 0 stub filled in by Plan 07-07.
 * These are schema-level unit tests that do NOT require a live DB.
 */
import { describe, expect, it } from 'vitest';

import { WaitlistEntrySchema } from '@shared/lib/domain';

describe('WaitlistEntrySchema', () => {
  it('parses a valid waitlist entry object', () => {
    const raw = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'García',
      partySize: 3,
      phoneE164: '+525512345678',
      status: 'waiting',
      tableId: null,
      seatedAt: null,
      notifiedAt: null,
      createdAt: new Date('2026-05-01T12:00:00Z'),
    };
    const result = WaitlistEntrySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('García');
      expect(result.data.partySize).toBe(3);
      expect(result.data.phoneE164).toBe('+525512345678');
      expect(result.data.status).toBe('waiting');
    }
  });

  it('accepts null phone (optional)', () => {
    const raw = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Test',
      partySize: 2,
      phoneE164: null,
      status: 'waiting',
      tableId: null,
      seatedAt: null,
      notifiedAt: null,
      createdAt: new Date(),
    };
    const result = WaitlistEntrySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneE164).toBeNull();
    }
  });

  it('rejects invalid status value', () => {
    const raw = {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Test',
      partySize: 2,
      phoneE164: null,
      status: 'invalid_status',
      tableId: null,
      seatedAt: null,
      notifiedAt: null,
      createdAt: new Date(),
    };
    const result = WaitlistEntrySchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it('rejects party size of 0', () => {
    const raw = {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Test',
      partySize: 0,
      phoneE164: null,
      status: 'waiting',
      tableId: null,
      seatedAt: null,
      notifiedAt: null,
      createdAt: new Date(),
    };
    const result = WaitlistEntrySchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it('rejects party size greater than 20', () => {
    const raw = {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Test',
      partySize: 21,
      phoneE164: null,
      status: 'waiting',
      tableId: null,
      seatedAt: null,
      notifiedAt: null,
      createdAt: new Date(),
    };
    const result = WaitlistEntrySchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});
