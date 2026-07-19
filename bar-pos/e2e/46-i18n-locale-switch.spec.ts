/**
 * e2e/46-i18n-locale-switch.spec.ts
 *
 * Phase 21 (i18n-multi-language), Plan 13 — SC-1/SC-4 end-to-end proof.
 * Exercises the real Settings → Language surface (LanguageSettingsTab.tsx,
 * SettingsTabsPanel/index.tsx): switches the acting admin's own locale from
 * the es-MX default to en-US and asserts real strings re-render WITHOUT a
 * page reload (`i18n.changeLanguage` re-renders subscribed components), then
 * resets back to es-MX so the shared admin test profile isn't left polluted
 * for other specs.
 *
 * Strings asserted come directly from the committed catalogs
 * (src/shared/lib/i18n/locales/{es-MX,en-US}/settings.json) — not re-derived
 * from 21-UI-SPEC.md, since the catalogs are the actual runtime source.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('i18n locale switch (SC-1/SC-4)', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(300);
    await page.goto('/');
  });

  test('Settings → Language switches es-MX → en-US live, then resets to es-MX', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'admin');
    await page.goto('/settings');

    // Language is the role-agnostic, always-first tab (SettingsTabsPanel.tsx) —
    // es-MX is the default locale (D-02), so it renders in Spanish first.
    const languageTab = page.getByRole('tab', { name: 'Idioma' });
    await expect(languageTab).toBeVisible({ timeout: 20_000 });
    await languageTab.click();

    await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Idioma de la interfaz')).toBeVisible();

    // Switch the Select to en-US.
    const localeSelect = page.locator('#settings-language');
    await localeSelect.click();
    await page.getByRole('option', { name: 'Inglés (EE. UU.)' }).click();

    const saveButton = page.getByRole('button', { name: 'Guardar idioma' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // (a) success toast appears (either language, depending on the exact
    // microtask ordering between i18n.changeLanguage() and the toast call).
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 15_000 });

    // (b) the whole page re-renders in English WITHOUT a page reload — no
    // page.reload()/page.goto() call between Save and these assertions.
    await expect(page.getByRole('tab', { name: 'Language' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
    await expect(page.getByText('Interface language')).toBeVisible();

    // Reset back to es-MX so the shared admin profile isn't left polluted.
    await localeSelect.click();
    await page.getByRole('option', { name: 'Español (México)' }).click();
    const saveButtonEn = page.getByRole('button', { name: 'Save Language' });
    await expect(saveButtonEn).toBeEnabled();
    await saveButtonEn.click();

    await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Idioma de la interfaz')).toBeVisible();

    await logout(page);
  });
});
