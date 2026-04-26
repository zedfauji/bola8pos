import { expect, test } from './fixtures';

import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Sprint 13 — Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(600);
    await page.goto('/');
  });

  test('POS order panel collapse persists across reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pos');

    const panel = page.getByTestId('pos-order-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const toggle = page.getByTestId('pos-order-panel-toggle');
    await toggle.click();
    await expect(panel).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('pos-order-panel')).toHaveCount(0);
    await expect(page.getByTestId('pos-order-panel-toggle')).toBeVisible();

    // Re-open and verify persistence the other way
    await page.getByTestId('pos-order-panel-toggle').click();
    await expect(page.getByTestId('pos-order-panel')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('pos-order-panel')).toBeVisible();

    await logout(page);
  });

  test('Pool tables filter bar collapses and persists', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/pool-tables');

    const filters = page.getByTestId('pool-filters');
    await expect(filters).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('pool-filters-toggle').click();
    await expect(filters).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('pool-filters')).toHaveCount(0);

    await logout(page);
  });
});
