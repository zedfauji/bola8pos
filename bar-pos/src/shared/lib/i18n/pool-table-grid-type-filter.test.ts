/**
 * Regression test for /impeccable critique P1 finding: PoolTableGrid's type
 * filter labels ('All'/'Pool'/'Carom'/'Consumption') were raw JSX literals
 * bypassing i18n. Confirms the replacement translation keys resolve to real
 * catalog strings (not the raw key) in both locales.
 */

import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@shared/lib/i18n/index';

const KEYS = [
  'wPanels:poolTableGrid.typeFilter.all',
  'wPanels:poolTableGrid.typeFilter.pool',
  'wPanels:poolTableGrid.typeFilter.carom',
  'wPanels:poolTableGrid.typeFilter.consumption',
  'wPanels:poolTableGrid.typeFilter.floating',
];

describe('PoolTableGrid type-filter translation keys', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es-MX'); // reset for other tests/consumers
  });

  it.each(['es-MX', 'en-US'])('every key resolves to a real string under %s', async locale => {
    await i18n.changeLanguage(locale);
    for (const key of KEYS) {
      const value = i18n.t(key);
      expect(value).not.toBe(key); // missing-key fallback returns the key itself
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
