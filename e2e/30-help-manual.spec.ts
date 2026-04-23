import { expect, test } from '@playwright/test';

import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Sprint 13 — F1 Help Manual', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(600);
    await page.goto('/');
  });

  test('F1 opens route-specific help on POS', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pos');

    // Focus body so F1 is not captured by an input
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('F1');

    const sheet = page.getByTestId('help-sheet');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('help-sheet-title')).toContainText(/POS/i);

    // F1 again closes the sheet
    await page.keyboard.press('F1');
    await expect(sheet).toHaveCount(0);

    await logout(page);
  });

  test('F1 on pool tables shows pool-tables content', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pool-tables');
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('F1');
    await expect(page.getByTestId('help-sheet-title')).toContainText(/Pool tables/i);

    await logout(page);
  });
});
