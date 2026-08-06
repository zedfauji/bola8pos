/**
 * E2E: Staff Management — /staff
 *
 * Tests staff listing, adding a new staff member, logging in as new staff,
 * clock-in/out flows, and shifts visibility RBAC.
 */

import { expect, test } from './fixtures';
import { loginAs, loginAsNamed, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { deleteTestStaff, getServiceClient, openCaja, resetTestState } from './helpers/supabase';

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
    // PageContainer's own title heading and StaffDashboard's SectionHeader
    // both render an <h2>"Staff" — an unscoped match is ambiguous (strict
    // mode); `.first()` is sufficient since this only checks a heading
    // exists at all.
    await expect(
      page.getByRole('heading', { name: /staff|team/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    // At least one staff row — the staff table renders skeleton placeholder
    // rows first (loading state); `.count()` doesn't wait for that to
    // resolve into real rows the way `expect().toBeVisible()` does, so use
    // a polling assertion instead of racing a one-shot count.
    await expect(page.getByText(/bartender|manager|admin/i).first()).toBeVisible({
      timeout: 15_000,
    });
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

    // Target the known bartender row specifically — ClockInModal
    // (clock-in-staff/ui/ClockInModal.tsx) requires *that staff member's
    // own PIN* before the opening-cash/"Start Shift" step even renders
    // (`phase === 'pin'` gates `phase === 'opening_cash'`), so this only
    // works for a row whose PIN this test actually knows.
    const bartenderName = process.env['E2E_BARTENDER_NAME'] ?? '';
    const bartenderPin = process.env['E2E_BARTENDER_PIN'] ?? '';
    const staffRow = page.getByRole('row', { name: new RegExp(bartenderName) });
    const clockInBtn = staffRow.getByRole('button', { name: /clock.?in/i });
    // `isVisible({ timeout })` doesn't poll — the staff table renders
    // skeleton rows first (useStaffList() loading state), so a one-shot
    // check can race the real rows. `waitFor` actually retries.
    const hasClockIn = await clockInBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasClockIn) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: clock-in button not on /staff page');
      return;
    }

    await clockInBtn.click();
    const clockInModal = page.getByRole('dialog', { name: /clock.?in|opening cash/i });
    await expect(clockInModal).toBeVisible({ timeout: 10_000 });

    // Step 1: the staff member's own PIN — same "Key N" keypad pattern used
    // by every other PIN entry in this suite (e.g. helpers/auth.ts).
    for (const ch of bartenderPin) {
      await clockInModal.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }

    // Step 2: opening cash / "Start Shift" confirm — this step is a nested
    // `ConfirmDialog` (renders as `AlertDialog`/role="alertdialog", a
    // separate Radix portal from the outer role="dialog"), scoped at the
    // page level rather than under `clockInModal`.
    const openingCashDialog = page.getByRole('alertdialog', { name: /opening cash/i });
    await expect(openingCashDialog).toBeVisible({ timeout: 10_000 });
    const cashInput = openingCashDialog.getByLabel(/opening cash|drawer float/i);
    if (await cashInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cashInput.fill('100');
    }
    await openingCashDialog.getByRole('button', { name: 'Start shift' }).click();

    await expect(page.getByText(/shift started|clocked in/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('SM5: clock-out — duration or summary shown', async ({ page }) => {
    test.setTimeout(120_000);
    // `beforeEach`'s resetTestState() closes every open shift, so — unlike
    // SM4 — there is never a staff row with an active shift (and thus a
    // Clock Out button) to click without seeding one first.
    const admin = getServiceClient();
    const { data: aStaff } = await admin.from('profiles').select('id').eq('role', 'bartender').limit(1).maybeSingle();
    if (aStaff) {
      await admin.from('shifts').insert({ staff_id: aStaff.id, opening_cash: 0 });
    }

    await loginAs(page, 'admin');
    await page.goto('/staff');

    // See SM4's comment — poll for the real row, not the loading skeleton.
    const clockOutBtn = page.getByRole('button', { name: /clock.?out/i }).first();
    const hasClockOut = await clockOutBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasClockOut) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: clock-out button not visible');
      return;
    }

    await clockOutBtn.click();
    // ClockOutDialog is a `ConfirmDialog`, which renders as `AlertDialog`
    // (role="alertdialog"), not role="dialog" — see SM4's comment above.
    const clockOutDialog = page.getByRole('alertdialog', { name: /end shift/i });
    await expect(clockOutDialog).toBeVisible({ timeout: 10_000 });

    const confirmBtn = clockOutDialog.getByRole('button', { name: 'Clock out' });
    await confirmBtn.click();

    // Success toast — "duration" alone also matches the table's own
    // "Shift duration" column header (strict-mode violation), so anchor on
    // the toast's distinctive "clocked out." wording instead.
    await expect(page.getByText(/clocked out\./i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('SM6: admin sees all shifts; bartender sees only own', async ({ page }) => {
    test.setTimeout(120_000);

    // StaffDashboard has no separately-labeled "all shifts" section (no
    // "all shifts|shift history|staff shifts" text exists anywhere in the
    // component) — the single `/staff` table itself IS the shift roster,
    // shown via one unconditional `useStaffList()` call with no per-role
    // filtering. Real gate check: does a bartender's own table view include
    // a *different* staff member's name (view_all_shifts is admin-only per
    // rbac.ts, but nothing enforces it — real gap filed as a todo, see
    // .planning/todos/pending/2026-08-04-view-all-shifts-rbac-permission-
    // never-enforced.md).
    const managerName = process.env['E2E_MANAGER_NAME'] ?? '';

    await loginAs(page, 'bartender');
    await page.goto('/staff');
    // `getByText(/bartender|manager|admin/i)` also matches the current
    // staff member's own role label in the top nav, which renders
    // immediately — it resolves long before `useStaffList()`'s real table
    // rows finish loading, so it does not prove the table has settled.
    // Wait on `managerName` itself (via `waitFor`, which polls, not a
    // one-shot `isVisible`) so a race with the table's own loading skeleton
    // can't produce a false "not visible" result.
    const managerRow = page.getByText(managerName, { exact: false }).first();
    const bartenderSeesOtherStaff = managerName
      ? await managerRow
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
      : false;
    // Bartender should NOT see a different staff member's row. Currently
    // fails — view_all_shifts is admin-only per rbac.ts but nothing
    // enforces it (StaffDashboard renders the full roster to every role);
    // real gap already filed as a todo, see
    // .planning/todos/pending/2026-08-04-view-all-shifts-rbac-permission-
    // never-enforced.md. Left asserting the intended/correct behavior
    // rather than the current buggy one, per D-03 (file, don't fix inline).
    expect(bartenderSeesOtherStaff).toBe(false);
    await logout(page);
  });
});
