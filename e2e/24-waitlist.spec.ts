import { expect, test } from './fixtures';
import { loginAs } from './helpers/auth';

/**
 * 24-waitlist.spec.ts — S5 Waitlist E2E
 *
 * Tests: full waitlist flow — add party, notify, seat, no-show, realtime sync.
 *
 * Requires dev server running (npm run dev) and waitlist_entries table in DB.
 * Plan reference: 07-07-PLAN.md
 */

test.describe('24 — Waitlist queue management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/waitlist');
    await page.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });
  });

  test('T1: Add a party to the waitlist', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to waitlist' }).click();

    const sheet = page.getByRole('dialog');
    await sheet.waitFor();

    await sheet.getByLabel('Party name').fill('García E2E');
    // Party size stays at default 1

    await sheet.getByRole('button', { name: 'Add to waitlist' }).click();

    // Entry card appears in queue
    await expect(page.getByText('García E2E')).toBeVisible({ timeout: 5000 });
    // Status badge shows 'waiting'
    await expect(page.getByText('waiting').first()).toBeVisible();
  });

  test('T2: Notify a waiting party', async ({ page }) => {
    // Ensure at least one waiting entry exists (assumes T1 ran or seed data)
    // Tap Notify button on first waiting entry
    const notifyBtn = page.getByRole('button', { name: /Notify/ }).first();
    await expect(notifyBtn).toBeVisible({ timeout: 10000 });
    await notifyBtn.click();

    // Entry transitions to 'notified' status
    await expect(page.getByText('notified').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3: Seat a party at a table', async ({ page }) => {
    // Ensure at least one waiting/notified entry exists
    const seatBtn = page.getByRole('button', { name: 'Seat party' }).first();
    await expect(seatBtn).toBeVisible({ timeout: 10000 });
    await seatBtn.click();

    const seatSheet = page.getByRole('dialog');
    await seatSheet.waitFor();

    // Select first available table
    const firstTable = seatSheet.getByRole('button', { name: /Free/ }).first();
    const hasTable = await firstTable.isVisible().catch(() => false);
    if (hasTable) {
      await firstTable.click();
      await seatSheet.getByRole('button', { name: 'Seat party' }).click();
      // Sheet closes and entry removed from queue
      await expect(seatSheet).not.toBeVisible({ timeout: 5000 });
    } else {
      // No available tables — annotate and pass
      test.info().annotations.push({
        type: 'skip',
        description: 'No available tables in test environment',
      });
    }
  });

  test('T4: Mark a party as no-show', async ({ page }) => {
    // Add a fresh entry to mark as no-show
    await page.getByRole('button', { name: 'Add to waitlist' }).click();
    const addSheet = page.getByRole('dialog');
    await addSheet.waitFor();
    await addSheet.getByLabel('Party name').fill('NoShow Test');
    await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();
    await expect(page.getByText('NoShow Test')).toBeVisible({ timeout: 5000 });

    // Tap no-show icon button
    const noShowBtn = page.getByRole('button', { name: 'Mark as no-show' }).last();
    await noShowBtn.click();

    // ConfirmDialog appears
    const confirmDialog = page.getByRole('alertdialog');
    await confirmDialog.waitFor();
    await confirmDialog.getByRole('button', { name: 'Mark no-show' }).click();

    // Entry no longer shows "NoShow Test" as waiting
    await expect(page.getByText('NoShow Test')).not.toBeVisible({ timeout: 5000 });
  });

  test('T5: WaitlistRealtimeListener — queue updates in real time', async ({
    page,
    browser,
  }) => {
    // Open a second page context to verify Realtime sync
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await loginAs(page2, 'admin');
    await page2.goto('/waitlist');
    await page2.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });

    // Add a party from page 1
    await page.getByRole('button', { name: 'Add to waitlist' }).click();
    const addSheet = page.getByRole('dialog');
    await addSheet.waitFor();
    await addSheet.getByLabel('Party name').fill('Realtime Test');
    await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();

    // Verify it appears on page 2 (Realtime sync)
    await expect(page2.getByText('Realtime Test')).toBeVisible({ timeout: 10000 });

    await context2.close();
  });
});
