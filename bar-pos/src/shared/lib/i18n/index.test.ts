import { describe, expect, it } from 'vitest';
import i18n from './index';

describe('i18n singleton', () => {
  it('resolves common:actions.save to Save in es-MX (default language)', () => {
    expect(i18n.language).toBe('es-MX');
    expect(i18n.t('common:actions.save')).toBe('Save');
  });

  it('resolves common:actions.save to Save in en-US after changeLanguage', async () => {
    await i18n.changeLanguage('en-US');
    expect(i18n.t('common:actions.save')).toBe('Save');
    await i18n.changeLanguage('es-MX'); // reset for other tests/consumers
  });

  it('defaults language + fallbackLng to es-MX (D-02)', () => {
    expect(i18n.language).toBe('es-MX');
    // i18next normalizes a string fallbackLng option to an array internally.
    expect(i18n.options.fallbackLng).toEqual(['es-MX']);
  });
});
