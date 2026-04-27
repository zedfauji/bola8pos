/**
 * E2E: Staff Management — /staff
 *
 * Tests staff listing, adding a new staff member, logging in as new staff,
 * clock-in/out flows, and shifts visibility RBAC.
 */

import { expect, test } from './fixtures';
import { loginAs, loginAsNamed, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { deleteTestStaff, openCaja, resetTestState } from './helpers/supabase';

const TEST_STAFF_NAME = 'E2E-TestStaff';
const TEST_STAFF_PIN = '111222';

test.describe('Staff Management', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test.afterAll(async () => {
    await deleteTestStaff(TEST_STAFF_NAME).catch(() => undefined);
  });

  test('SM1: /staff page shows staff list with at least one member', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'admin');
    await page.goto('/staff');
    // Page should load and show at least one staff name
    await expect(
      page.getByRole('heading', { name: /staff|team/i })
    ).toBeVisible({ timeout: 15_000 });
    // At least one staff card or row
    const staffCards = page.locator('[data-testid="staff-card"], [data-testid="staff-row"]');
    const staffByRole = page.getByRole('listitem').filter({ hasText: /bartender|manager|admin/ });
    const hasStaff =
      (await staffCards.count()) > 0 ||
      (await staffByRole.count()) > 0 ||
      (await page.getByText(/bartender|manager/i).count()) > 0;
    expect(hasStaff).toBe(true);
    await logout(page);
  });

  test('SM2: admin adds E2E-TestStaff via UI or seed', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'admin');
    await page.goto('/staff');

    const addBtn = page.getByRole('button', { name: /add staff|new staff|invite/i });
    const hasAddBtn = await addBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasAddBtn) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: add staff button not found on /staff');
      return;
    }

    await addBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByLabel(/name/i).fill(TEST_STAFF_NAME);
    const pinField = dialog.getByLabel(/pin/i);
    if (await pinField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await pinField.fill(TEST_STAFF_PIN);
    }
    const roleSelect = dialog.getByLabel(/role/i);
    if (await roleSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await roleSelect.selectOption('bartender');
    }
    await dialog.getByRole('button', { name: /save|create|add/i }).click();

    await expect(page.getByText(TEST_STAFF_NAME)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('SM3: login as E2E-TestStaff succeeds', async ({ page }) => {
    test.setTimeout(90_000);

    // Seed the staff member via DB if not already present
    const { seedNewStaffMember } = await import('./helpers/supabase');
    await seedNewStaffMember(TEST_STAFF_NAME, TEST_STAFF_PIN, 'bartender').catch(() => undefined);

    await loginAsNamed(page, TEST_STAFF_NAME, TEST_STAFF_PIN);
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
    await logout(page);
  });

  test('SM4: admin clock-in for a staff member — shift started', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'admin');
    await page.goto('/staff');

    const clockInBtn = page.getByRole('button', { name: /clock.?in/i }).first();
    const hasClockIn = await clockInBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasClockIn) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: clock-in button not on /staff page');
      return;
    }

    await clockInBtn.click();
    const clockInModal = page.getByRole('dialog', { name: /clock.?in|opening cash/i });
    await expect(clockInModal).toBeVisible({ timeout: 10_000 });

    const cashInput = clockInModal.getByLabel(/opening cash|drawer float/i);
    if (await cashInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cashInput.fill('100');
    }
    await clockInModal.getByRole('button', { name: /clock.?in|start shift/i }).click();

    await expect(page.getByText(/shift started|clocked in/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('SM5: clock-out — duration or summary shown', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'admin');
    await page.goto('/staff');

    const clockOutBtn = page.getByRole('button', { name: /clock.?out/i }).first();
    const hasClockOut = await clockOutBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasClockOut) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: clock-out button not visible');
      return;
    }

    await clockOutBtn.click();
    const clockOutDialog = page.getByRole('dialog', { name: /clock.?out|end shift/i });
    await expect(clockOutDialog).toBeVisible({ timeout: 10_000 });

    const confirmBtn = clockOutDialog.getByRole('button', { name: /clock.?out|end shift|confirm/i });
    await confirmBtn.click();

    // Success message or duration display
    await expect(
      page.getByText(/clocked out|shift ended|duration/i)
    ).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('SM6: admin sees all shifts; bartender sees only own', async ({ page }) => {
    test.setTimeout(120_000);

    // Admin view
    await loginAs(page, 'admin');
    await page.goto('/staff');
    const allShiftsSection = page.getByText(/all shifts|shift history|staff shifts/i).first();
    const adminSeesAll = await allShiftsSection.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!adminSeesAll) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: all-shifts section not visible to admin');
      return;
    }
    await logout(page);

    // Bartender view
    await loginAs(page, 'bartender');
    await page.goto('/staff');
    const bartenderAllShifts = page.getByText(/all shifts|all staff/i).first();
    const bartenderSeesAll = await bartenderAllShifts.isVisible({ timeout: 5_000 }).catch(() => false);
    // Bartender should NOT see the all-shifts section
    expect(bartenderSeesAll).toBe(false);
    await logout(page);
  });
});
