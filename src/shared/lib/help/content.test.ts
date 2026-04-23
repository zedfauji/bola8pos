import { describe, expect, it } from 'vitest';
import { getHelpForRoute } from './content';

describe('getHelpForRoute', () => {
  it('returns exact-match entry for a known route', () => {
    const entry = getHelpForRoute('/pos');
    expect(entry.title).toMatch(/POS/i);
    expect(entry.body).toContain('#');
  });

  it('falls back to the top-level prefix for sub-routes', () => {
    const entry = getHelpForRoute('/pool-tables/abc-123');
    expect(entry.title).toMatch(/Pool tables/i);
  });

  it('returns a generic fallback for unknown routes', () => {
    const entry = getHelpForRoute('/totally-unknown');
    expect(entry.title).toBe('Help');
  });
});
