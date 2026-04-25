import { expect, test } from './fixtures';

import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { E2E_PREP_INGREDIENT_NAME, openCaja, resetTestState, seedE2ePrepKitchenFixture } from './helpers/supabase';

test.describe('Kitchen prep', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await seedE2ePrepKitchenFixture();
    await openCaja(600);
    await page.goto('/');
  });

  test('manager opens kitchen prep and records a prep batch', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: 'Kitchen Prep' }).click();
    await expect(page).toHaveURL(/\/kitchen-prep/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Kitchen Prep', level: 2 })).toBeVisible();
    await expect(page.getByText(E2E_PREP_INGREDIENT_NAME)).toBeVisible();

    await page.getByRole('button', { name: 'Record new prep batch' }).click();
    await expect(page.getByRole('heading', { name: 'Record prep batch' })).toBeVisible();
    await page.getByRole('combobox', { name: /select ingredient/i }).click();
    await page.getByLabel('Suggestions').getByText(E2E_PREP_INGREDIENT_NAME, { exact: true }).click();
    await page.getByLabel('Quantity produced').fill('1');
    await page.getByRole('button', { name: 'Record batch' }).click();
    await expect(page.getByRole('heading', { name: 'Record prep batch' })).toBeHidden({ timeout: 20_000 });

    await logout(page);
  });

  test('bartender visiting /kitchen-prep is redirected to home', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/kitchen-prep');
    await expect(page).toHaveURL(/\/home/, { timeout: 12_000 });
    await logout(page);
  });
});
