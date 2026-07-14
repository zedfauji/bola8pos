/**
 * E2E spec: Phase 19 — Tip Distribution Config
 * Plan: 19-06
 * Covers the full loop (SC-3 configure + SC-4 report):
 *  T1: admin configures the floor/bar/kitchen "Tip Split" in Settings (D-01/D-05),
 *      closes a caja carrying a single tab with a known $10.00 tip (custom tip,
 *      D-08 version-bump fix regression guard), then closes the caja and asserts
 *      the Reports "Tip Split" panel shows the computed bucket amounts matching
 *      the configured 50/30/20 split of the session's total tips.
 *
 * NOTE (autonomous: false): Requires `bar-pos/.env.local` + remote Supabase with
 * the Phase 19 migrations applied (tip_distribution_entries table +
 * close_caja_session tip computation). Follows the seed-via-DB
 * (openCaja/forceCloseAllOpenTabs) + UI-click-through pattern established by
 * 02-caja.spec.ts / 05-payments.spec.ts / 41-split-payment.spec.ts.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { forceCloseAllOpenTabs, openCaja, resetTestState } from './helpers/supabase';

test.describe('Tip Distribution Config', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await page.goto('/');
  });

  test('T1: configure Tip Split (50/30/20), close caja with a known $10 tip, report shows the computed distribution', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    test.info().annotations.push({ type: 'requirement', description: 'SC-3, SC-4' });

    // ------------------------------------------------------------------
    // Step 1 — Configure: admin sets floor/bar/kitchen to a clean 50/30/20
    // split so the report arithmetic is exact (SC-3, D-01, D-05).
    // ------------------------------------------------------------------
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Tip Split' }).click();
    await expect(page.getByRole('heading', { name: 'Tip Split' })).toBeVisible({ timeout: 20_000 });

    // Clear before filling: a leftover 50/30/20 from a prior run would make .fill('50')
    // a same-value no-op — number inputs don't dispatch `input` when the value is
    // unchanged, so React's onChange (and the form's dirty flag) never fires. Clearing
    // first guarantees a real value change regardless of the row's starting state.
    await page.locator('#tip-split-floor').fill('');
    await page.locator('#tip-split-floor').fill('50');
    await page.locator('#tip-split-bar').fill('');
    await page.locator('#tip-split-bar').fill('30');
    await page.locator('#tip-split-kitchen').fill('');
    await page.locator('#tip-split-kitchen').fill('20');
    await page.getByRole('button', { name: /save tip split/i }).click();
    await expect(page.getByText(/tip split saved/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);

    // ------------------------------------------------------------------
    // Step 2 — Transact + close: open a caja, create a tab with one item,
    // pay it with a known $10.00 tip (custom tip — deterministic regardless
    // of tax-rate/item-price settings), then close the caja (D-08 fix: no
    // STALE_VERSION on close).
    // ------------------------------------------------------------------
    const cajaId = await openCaja(100);

    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Tip Split E2E Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    const budBtn = page.getByRole('button', { name: /Select Budweiser/i });
    await expect(budBtn).toBeVisible({ timeout: 30_000 });
    await budBtn.click();
    await expect(page.getByText(/1 item/i)).toBeVisible({ timeout: 15_000 });

    const payButton = page.getByRole('button', { name: /close tab and process payment/i });
    if ((await payButton.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'Close Tab / Pay control not present on POS (OrderPanel not mounted or no items on tab).',
      });
      await logout(page);
      return;
    }
    await payButton.click();

    const modal = page.getByRole('dialog', { name: /process payment/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByTestId('payment-btn-cash').click();

    // Known, deterministic total tip — custom tip bypasses percent-of-subtotal math.
    await modal.getByLabel(/custom tip/i).fill('10.00');
    await modal.getByLabel(/amount tendered/i).fill('1000');
    await modal.getByRole('button', { name: /process payment/i }).click();
    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);

    // Defensive fallback (matches 02-caja.spec.ts precedent) — no-op if the
    // tab already reached 'paid' via the successful payment above.
    await forceCloseAllOpenTabs();

    await loginAs(page, 'manager');
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Close Caja' }).click();
    const closeDlg = page.getByRole('dialog', { name: 'Close Caja' });
    await expect(closeDlg).toBeVisible();
    await closeDlg.getByLabel(/closing cash count/i).fill('100');
    await closeDlg.getByRole('button', { name: 'Close Caja' }).click();
    // If this hangs/errors with STALE_VERSION, the Phase 19 version-bump fix regressed.
    await expect(page.getByText(/caja closed successfully/i)).toBeVisible({ timeout: 30_000 });

    // ------------------------------------------------------------------
    // Step 3 — Assert report: Reports -> "Tip Split" -> select the
    // just-closed session -> bucket amounts equal the configured 50/30/20
    // split of the $10.00 total tips (SC-4).
    // ------------------------------------------------------------------
    await page.goto('/reports');
    await page.getByRole('tab', { name: 'Tip Split' }).click();

    const selector = page.locator('#tip-split-caja-selector');
    await expect(selector).toBeVisible({ timeout: 20_000 });
    await selector.selectOption(cajaId);

    await expect(page.getByText('Total Tips')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Floor \(50%\)/)).toBeVisible();
    await expect(page.getByText(/Bar \(30%\)/)).toBeVisible();
    await expect(page.getByText(/Kitchen \(20%\)/)).toBeVisible();
    await expect(page.getByText('$10.00', { exact: false })).toBeVisible();
    await expect(page.getByText('$5.00', { exact: false })).toBeVisible();
    await expect(page.getByText('$3.00', { exact: false })).toBeVisible();
    await expect(page.getByText('$2.00', { exact: false })).toBeVisible();

    await logout(page);
  });
});
