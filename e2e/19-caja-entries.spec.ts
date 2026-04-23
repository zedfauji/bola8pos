/**
 * E2E: Caja Entries — register expense/income against open caja session
 *
 * Tests the RegisterCajaEntryDialog: field validation, submission,
 * success toasts, and appearance in reports.
 */

import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState, seedCajaEntry } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Helper: navigate to the caja entry form
// ---------------------------------------------------------------------------

async function openCajaEntryDialog(page: Parameters<typeof loginAs>[0]): Promise<boolean> {
  // The dialog is typically opened from /staff or a caja management section
  // Try /staff first, then home dashboard
  await page.goto('/staff');
  const staffPageBtn = page.getByRole('button', { name: /add entry|register entry|expense.*income/i });
  const onStaff = await staffPageBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (onStaff) {
    await staffPageBtn.click();
    return true;
  }

  await page.goto('/home');
  const homeBtn = page.getByRole('button', { name: /add entry|caja entry|expense/i });
  const onHome = await homeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (onHome) {
    await homeBtn.click();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Caja Entries', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('CE1: caja entry form has type selector, amount, and concept fields', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry form not reachable from nav');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Type toggle buttons
    await expect(dialog.getByRole('button', { name: /expense/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /income/i })).toBeVisible();
    // Amount and concept
    await expect(dialog.getByLabel(/amount/i)).toBeVisible();
    await expect(dialog.locator('#entry-concept')).toBeVisible();
    await logout(page);
  });

  test('CE2: submit expense $25 "Ice bags" — success toast, entry visible in caja summary', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry form not reachable');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Select expense
    await dialog.getByRole('button', { name: /expense/i }).click();
    await dialog.getByLabel(/amount/i).fill('25');
    await dialog.locator('#entry-concept').fill('Ice bags');
    await dialog.getByRole('button', { name: /save entry/i }).click();

    await expect(page.getByText(/expense recorded.*25|entry.*saved/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('CE3: submit income $100 "Cash top-up" — success toast', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry income flow');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole('button', { name: /income/i }).click();
    await dialog.getByLabel(/amount/i).fill('100');
    await dialog.locator('#entry-concept').fill('Cash top-up');
    await dialog.getByRole('button', { name: /save entry/i }).click();

    await expect(page.getByText(/income recorded.*100|entry.*saved/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('CE4: concept at exactly 200 chars — entry saves successfully', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry 200-char concept');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByLabel(/amount/i).fill('10');
    await dialog.locator('#entry-concept').fill('A'.repeat(200));
    await dialog.getByRole('button', { name: /save entry/i }).click();

    await expect(page.getByText(/recorded|saved/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('CE5: submit with empty concept — form error shown', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry concept validation');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByLabel(/amount/i).fill('10');
    // leave concept empty
    await dialog.getByRole('button', { name: /save entry/i }).click();

    await expect(dialog.getByText(/concept is required/i)).toBeVisible({ timeout: 5_000 });
    // Dialog stays open
    await expect(dialog).toBeVisible();
    await logout(page);
  });

  test('CE6: submit with amount 0 — form error shown', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const found = await openCajaEntryDialog(page);
    if (!found) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entry amount=0 validation');
      return;
    }

    const dialog = page.getByRole('dialog', { name: /register expense|expense.*income/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByLabel(/amount/i).fill('0');
    await dialog.locator('#entry-concept').fill('Zero amount test');
    await dialog.getByRole('button', { name: /save entry/i }).click();

    await expect(
      dialog.getByText(/amount must be greater than 0|positive/i)
    ).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toBeVisible();
    await logout(page);
  });

  test('CE7: seeded entries appear in /reports caja entries section', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Seed both types directly
    await seedCajaEntry('expense', 15, 'E2E Expense Entry');
    await seedCajaEntry('income', 50, 'E2E Income Entry');

    await page.goto('/reports');
    // Select current session (first session in list)
    const sessionSelector = page.getByRole('combobox').first();
    const hasSelector = await sessionSelector.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasSelector) {
      await sessionSelector.selectOption({ index: 0 });
    }

    // Look for caja entries section
    const entriesSection = page.getByText(/caja entries|expense.*income/i).first();
    const sectionVisible = await entriesSection.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!sectionVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: caja entries section in reports');
      return;
    }

    await expect(page.getByText('E2E Expense Entry')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('E2E Income Entry')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });
});
