import { describe, it } from 'vitest';

// Wave 0 stub — full test cases added in Plan 07-07
// Import statement kept here so vitest discovers the file from Wave 2 onwards

describe('toE164', () => {
  it.todo('passes through a valid E.164 MX number unchanged');
  it.todo('converts a bare MX number with spaces to E.164');
  it.todo('converts a bare MX number without spaces to E.164');
  it.todo('converts a US number with country code to E.164');
  it.todo('returns null for a non-phone string');
  it.todo('returns null for empty string');
  it.todo('returns null for whitespace-only string');
  it.todo('returns null for a partial number too short to be valid');
});

describe('isE164', () => {
  it.todo('returns true for a valid E.164 MX number');
  it.todo('returns false for a bare number without country code');
  it.todo('returns false for empty string');
});
