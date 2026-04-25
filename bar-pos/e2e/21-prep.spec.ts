/**
 * E2E spec: Phase 5 — Kitchen Prep
 *
 * Requires:
 *   1. Dev server running: cd bar-pos && npm run dev
 *   2. Seed data applied: cd bar-pos && npx tsx scripts/seed-prep.ts
 *   3. .env.local with E2E credentials
 *
 * Tests T1–T5 covering the full prep batch flow.
 * T3 is intentionally skipped — covered by integration tests I5 and I6
 * (see produce-prep-batch.integration.test.ts) to avoid E2E seed complexity.
 *
 * T5 note: depends on cumulative DB state from T2+T4 having depleted Tomato stock.
 * Re-run seed-prep.ts between full suite runs to reset stock levels.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Kitchen Prep', () => {
  test.beforeEach(async ({ page }) => {
    // MANDATORY: capture browser console for all tests
    page.on('console', msg => console.log(`[browser] ${msg.type()}: ${msg.text()}`));
    await loginAs(page, 'admin');
  });

  test('T1: seed validation — /kitchen-prep page loads with prep ingredients grid', async ({ page }) => {
    await page.goto('/kitchen-prep');

    // Page title
    await expect(page.getByRole('heading', { name: 'Kitchen Prep' })).toBeVisible();

    // Prep on hand section heading
    await expect(page.getByText('Prep on hand')).toBeVisible();

    // "New batch" button is visible (aria-label="Record new prep batch")
    await expect(page.getByRole('button', { name: /new prep batch/i })).toBeVisible();

    // Seeded prep ingredients appear as cards (scoped to the cards grid, not the history table)
    // (Requires seed-prep.ts to have run first)
    const prepCards = page.getByLabel('Kitchen prep dashboard').locator('section').first();
    await expect(prepCards.getByText('Salsa Mexicana')).toBeVisible({ timeout: 10_000 });
    await expect(prepCards.getByText('Michelada Mix')).toBeVisible({ timeout: 5_000 });
  });

  test('T2: produce 10 Salsa Mexicana batches — batch recorded; stock movements written', async ({ page }) => {
    await page.goto('/kitchen-prep');

    // Open the form
    await page.getByRole('button', { name: /new prep batch/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Record prep batch')).toBeVisible();

    // Search for Salsa Mexicana in autocomplete
    await page.getByRole('combobox', { name: /select ingredient/i }).click();
    await page.getByPlaceholder('Search prep ingredients…').fill('Salsa');
    await page.getByRole('option', { name: /Salsa Mexicana/i }).click();

    // Enter quantity
    await page.getByPlaceholder('e.g. 10').fill('10');

    // PrepBatchPreview should appear (recipe exists)
    await expect(page.getByText('Raw material consumption preview')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Tomato/)).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /record batch/i }).click();

    // Success toast
    await expect(page.getByText(/Batch recorded/i)).toBeVisible({ timeout: 10_000 });

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Salsa Mexicana PrepOnHandCard shows updated qty (10.00)
    // (The card updates via TanStack Query cache invalidation)
    await expect(
      page.getByLabel('Kitchen prep dashboard')
        .locator('section').first()
        .locator('div')
        .filter({ hasText: 'Salsa Mexicana' })
        .filter({ hasText: '10.00' })
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('T3: selling menu item depletes prep ingredient qty', async ({ page }) => {
    // Covered by integration tests I5 and I6 in produce-prep-batch.integration.test.ts.
    // Skipped here to avoid E2E seed complexity (Alitas product + product-recipe seed).
    // I5 verifies deplete_for_order_item with a product_id-owned recipe reduces ingredient qty.
    // I6 is an explicit regression guard after Phase 5 recipes.product_id nullable migration.
    test.skip(true, 'Covered by integration I5 and I6 — skip to avoid E2E seed complexity');
  });

  test('T4: boundary produce — exactly at tomato limit succeeds', async ({ page }) => {
    // After T2, tomato should have 2000 - 1000 = 1000g remaining.
    // Producing 10 more Salsa (needs exactly 1000g tomato) should succeed.
    await page.goto('/kitchen-prep');

    await page.getByRole('button', { name: /new prep batch/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('combobox', { name: /select ingredient/i }).click();
    await page.getByPlaceholder('Search prep ingredients…').fill('Salsa');
    await page.getByRole('option', { name: /Salsa Mexicana/i }).click();
    await page.getByPlaceholder('e.g. 10').fill('10');

    await page.getByRole('button', { name: /record batch/i }).click();
    await expect(page.getByText(/Batch recorded/i)).toBeVisible({ timeout: 10_000 });
  });

  test('T5: blocked produce — insufficient tomato shows error toast', async ({ page }) => {
    // After T2 + T4, tomato = 0g. Producing 1 more Salsa needs 100g → INVENTORY_NEGATIVE.
    // Note: test order dependency — T5 depends on T2 + T4 having depleted tomato.
    // In isolation (fresh DB), set tomato to 50g via admin and attempt 1 Salsa batch (needs 100g).
    // The test here uses the cumulative DB state from T2 + T4.

    await page.goto('/kitchen-prep');

    await page.getByRole('button', { name: /new prep batch/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('combobox', { name: /select ingredient/i }).click();
    await page.getByPlaceholder('Search prep ingredients…').fill('Salsa');
    await page.getByRole('option', { name: /Salsa Mexicana/i }).click();
    await page.getByPlaceholder('e.g. 10').fill('1');

    await page.getByRole('button', { name: /record batch/i }).click();

    // Error toast (INVENTORY_NEGATIVE from trigger)
    await expect(
      page.getByText(/Insufficient|Could not record batch/i)
    ).toBeVisible({ timeout: 10_000 });

    // Dialog stays open (form preserved after error)
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
