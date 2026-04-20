import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(530);
    await page.goto('/');
  });

  test('Reports page loads', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: /daily caja report/i })).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('Session picker shows closed sessions', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const options = await sel.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(1);
    await logout(page);
  });

  test('Report sections visible after selecting session', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);

    await expect(page.getByText('Total Revenue', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Cash Reconciliation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top 10 Products' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff Performance' })).toBeVisible();
    await logout(page);
  });

  test('Revenue breakdown shows cash, card, rappi', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);
    await expect(page.getByText('Cash Sales', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Card Sales', { exact: false })).toBeVisible();
    await expect(page.getByText('Rappi Sales', { exact: false })).toBeVisible();
    await logout(page);
  });

  test('Cash reconciliation variance displayed', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);
    await expect(page.getByText('Variance', { exact: false })).toBeVisible({ timeout: 30_000 });
    await logout(page);
  });
});
