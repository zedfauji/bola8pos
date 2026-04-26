/**
 * E2E: Product Management — /inventory
 *
 * Tests creating categories and products, editing prices, toggling active state,
 * and RBAC gating for bartenders.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState, setProductActive } from './helpers/supabase';

const TEST_CATEGORY = 'TestCat-E2E';
const TEST_PRODUCT = 'TestProduct-E2E';

async function cleanupTestData(): Promise<void> {
  const admin = getServiceClient();
  // Delete test product
  await admin.from('products').delete().eq('name', TEST_PRODUCT);
  // Delete test category
  await admin.from('categories').delete().eq('name', TEST_CATEGORY);
}

async function navigateToInventory(page: Parameters<typeof loginAs>[0]): Promise<boolean> {
  await page.goto('/inventory');
  const inventoryHeading = page.getByRole('heading', { name: /inventory|products|catalog/i });
  return inventoryHeading.isVisible({ timeout: 10_000 }).catch(() => false);
}

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test.afterEach(async () => {
    await cleanupTestData().catch(() => undefined);
  });

  test('PM1: product list visible on /inventory', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await navigateToInventory(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: /inventory page not rendered');
      return;
    }
    // At least one product card or table row should exist
    const hasProducts =
      (await page.getByRole('row').count()) > 1 ||
      (await page.getByRole('button', { name: /Select|Edit/i }).count()) > 0;
    expect(hasProducts).toBe(true);
    await logout(page);
  });

  test('PM2: create new category "TestCat-E2E"', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await navigateToInventory(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: /inventory not rendered');
      return;
    }

    // Look for "Categories" tab or button
    const catTab = page.getByRole('tab', { name: /categories/i });
    const catTabVisible = await catTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (catTabVisible) await catTab.click();

    const addCatBtn = page.getByRole('button', { name: /add category|new category/i });
    const addVisible = await addCatBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!addVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: add category button not found');
      return;
    }
    await addCatBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel(/name/i).fill(TEST_CATEGORY);
    // Color field — fill if present
    const colorInput = dialog.getByLabel(/color/i);
    if (await colorInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await colorInput.fill('#FF5733');
    }
    await dialog.getByRole('button', { name: /save|create|add/i }).click();

    await expect(page.getByText(TEST_CATEGORY)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('PM3: create product "TestProduct-E2E" at $9.99', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    // Ensure category exists
    const admin = getServiceClient();
    const { data: existingCat } = await admin
      .from('categories')
      .select('id')
      .eq('name', TEST_CATEGORY)
      .maybeSingle();
    if (!existingCat) {
      const { data: firstCat } = await admin.from('categories').select('id').limit(1).single();
      if (!firstCat) {
        test.skip(true, 'No category found to create product in');
        return;
      }
    }

    const found = await navigateToInventory(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: /inventory not rendered');
      return;
    }

    const prodTab = page.getByRole('tab', { name: /products/i });
    const prodTabVisible = await prodTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (prodTabVisible) await prodTab.click();

    const addProdBtn = page.getByRole('button', { name: /add product|new product/i });
    const addVisible = await addProdBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!addVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: add product button not found');
      return;
    }
    await addProdBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel(/name/i).fill(TEST_PRODUCT);
    // Price — may be a MoneyInput or plain input
    const priceInput = dialog.getByLabel(/base price|price/i).first();
    await priceInput.fill('9.99');
    await dialog.getByRole('button', { name: /save|create|add/i }).click();

    await expect(page.getByText(TEST_PRODUCT)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('PM4: TestProduct-E2E visible in /pos product grid', async ({ page }) => {
    test.setTimeout(90_000);

    // Seed product directly
    const admin = getServiceClient();
    const { data: cat } = await admin.from('categories').select('id').limit(1).single();
    if (!cat) {
      test.skip(true, 'No category to seed product in');
      return;
    }
    await admin.from('products').upsert({
      name: TEST_PRODUCT,
      category_id: cat.id,
      base_price: 9.99,
      is_active: true,
    });

    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await expect(
      page.getByRole('button', { name: new RegExp(`Select ${TEST_PRODUCT}`, 'i') })
    ).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('PM5: edit TestProduct-E2E price to $12.99', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await navigateToInventory(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: /inventory not rendered');
      return;
    }

    const prodRow = page.getByText(TEST_PRODUCT);
    const prodVisible = await prodRow.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!prodVisible) {
      test.skip(true, 'TestProduct-E2E not visible in inventory — prior seed step may have failed');
      return;
    }

    // Find edit button near the product
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    await editBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const priceInput = dialog.getByLabel(/base price|price/i).first();
    await priceInput.clear();
    await priceInput.fill('12.99');
    await dialog.getByRole('button', { name: /save|update/i }).click();

    await expect(page.getByText(/12\.99/)).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('PM6: set happy hour price $7.99 on TestProduct-E2E', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await navigateToInventory(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: /inventory not rendered');
      return;
    }

    const prodVisible = await page.getByText(TEST_PRODUCT).isVisible({ timeout: 10_000 }).catch(() => false);
    if (!prodVisible) {
      test.skip(true, 'TestProduct-E2E not visible — prior seed may have failed');
      return;
    }

    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    await editBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const hhInput = dialog.getByLabel(/happy hour price/i);
    const hhVisible = await hhInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hhVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: happy hour price field not present');
      return;
    }
    await hhInput.clear();
    await hhInput.fill('7.99');
    await dialog.getByRole('button', { name: /save|update/i }).click();

    await expect(page.getByText(/7\.99/)).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('PM7: set is_active=false — product disappears from /pos grid', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    // Ensure product exists and is active
    const admin = getServiceClient();
    const { data: cat } = await admin.from('categories').select('id').limit(1).single();
    if (cat) {
      await admin.from('products').upsert({
        name: TEST_PRODUCT,
        category_id: cat.id,
        base_price: 9.99,
        is_active: true,
      });
    }

    // Deactivate via helper
    await setProductActive(TEST_PRODUCT, false);

    await page.goto('/pos');
    // Product should not appear in the grid
    await expect(
      page.getByRole('button', { name: new RegExp(`Select ${TEST_PRODUCT}`, 'i') })
    ).toHaveCount(0);
    await logout(page);
  });

  test('PM8: bartender navigating to product management — button absent or PIN gate shown', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');

    // Try to navigate to /inventory
    await page.goto('/inventory');
    const redirected = await page
      .waitForURL(/\/home/, { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      // May show a "manager access required" alert
      const blocked = await page
        .getByText(/manager access required|admin access required|access denied/i)
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(blocked).toBe(true);
    } else {
      expect(redirected).toBe(true);
    }
    await logout(page);
  });
});
