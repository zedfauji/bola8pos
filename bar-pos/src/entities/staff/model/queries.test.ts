import { describe, it, expect } from 'vitest';

import { StaffSchema } from '@shared/lib/domain';
import type { Tables } from '@shared/lib/supabase.types';

import { mapStaffRow } from './queries';

function makeProfileRow(overrides: Partial<Tables<'profiles'>> = {}): Tables<'profiles'> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alex Martinez',
    email: 'alex@barpos.dev',
    role: 'bartender',
    pin: '123456',
    is_active: true,
    must_change_pin: false,
    locale: 'es-MX',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('StaffSchema.locale', () => {
  it('defaults to es-MX when the row omits locale', () => {
    const parsed = StaffSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alex Martinez',
      email: 'alex@barpos.dev',
      role: 'bartender',
      pin: '123456',
      isActive: true,
      mustChangePin: false,
    });

    expect(parsed.locale).toBe('es-MX');
  });

  it('parses en-US locale unchanged', () => {
    const parsed = StaffSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alex Martinez',
      email: 'alex@barpos.dev',
      role: 'bartender',
      pin: '123456',
      isActive: true,
      mustChangePin: false,
      locale: 'en-US',
    });

    expect(parsed.locale).toBe('en-US');
  });

  it('rejects an unsupported locale', () => {
    expect(() =>
      StaffSchema.parse({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Alex Martinez',
        email: 'alex@barpos.dev',
        role: 'bartender',
        pin: '123456',
        isActive: true,
        mustChangePin: false,
        locale: 'fr-FR',
      })
    ).toThrow();
  });
});

describe('mapStaffRow locale', () => {
  it('carries row.locale through into the mapped Staff object', () => {
    const result = mapStaffRow(makeProfileRow({ locale: 'en-US' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.locale).toBe('en-US');
  });
});
