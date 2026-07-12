/**
 * E2E spec: Phase 20 — Promotions Engine
 * Plan: 20-09
 *
 * Covers SC-4 (Settings -> Promotions admin surface) and SC-3/D-02
 * (server-side auto-apply at order time, no cashier confirmation step):
 *  T1: admin creates a percentage item-target promotion via Settings ->
 *      Promotions ("+ Add promotion"), fills name/discount/target/priority,
 *      toggles Active, saves ("Promotion saved"), sees the row with its
 *      target-type badge + Active switch checked; edits by disabling via the
 *      inline Active switch; deletes via the "Delete Promotion" confirm.
 *  T2: with a separate, already-ACTIVE percentage item-target promotion on
 *      Budweiser (seeded directly — T1 already exercises the create-via-UI
 *      path), a bartender adds Budweiser to a tab and places the order — the
 *      resulting ticket line/total reflects the server-applied discount
 *      immediately, with no intermediate "apply promotion?" confirmation
 *      step (D-02: silent, automatic).
 *
 * NOTE (autonomous: false): Requires bar-pos/.env.local + remote Supabase with
 * all Phase 20 migrations applied (promotions/promotion_availability/
 * applied_promotions + evaluate_promotions_for_item live in
 * create_order_with_items, per 20-06-SUMMARY.md). Follows the
 * loginAs + DB-seed/cleanup pattern established by
 * 42-tip-distribution.spec.ts / 04-pool-timer.spec.ts / 16-table-status.spec.ts.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { forceCloseAllOpenTabs, getServiceClient, resetTestState } from './helpers/supabase';

test.describe('Promotions', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await page.goto('/');
  });

  test('T1: admin creates, edits (disables), and deletes a promotion via Settings -> Promotions', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    test.info().annotations.push({ type: 'requirement', description: 'SC-4' });

    const promoName = `E2E Promo ${String(Date.now())}`;

    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Promotions' }).click();
    await expect(page.getByRole('button', { name: '+ Add promotion' })).toBeVisible({
      timeout: 20_000,
    });

    // Create — opens the edit dialog immediately on a fresh (inactive) draft.
    await page.getByRole('button', { name: '+ Add promotion' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Promotion' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByLabel('Promotion name').fill(promoName);
    // Discount type defaults to "Percentage off" and target type defaults to
    // "Item" — both already correct for this test, no Select interaction needed.
    await dialog.getByLabel('Discount value').fill('15');
    await dialog.getByLabel('Product').selectOption({ label: 'Budweiser' });
    await dialog.getByLabel('Priority').fill('5');
    // New drafts default to inactive (is_active: false) — turn Active on.
    await dialog.getByRole('switch', { name: 'Active' }).click();
    await dialog.getByRole('button', { name: 'Save promotion' }).click();
    await expect(page.getByText('Promotion saved')).toBeVisible({ timeout: 15_000 });

    // Close the dialog and verify the row in the list.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    const row = page.getByRole('listitem').filter({ hasText: promoName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Item')).toBeVisible();
    await expect(row.getByText('15% off')).toBeVisible();
    const activeSwitch = row.getByRole('switch', { name: `${promoName} active` });
    await expect(activeSwitch).toBeChecked();

    // Edit — disable via the inline Active switch (no dialog needed for this action).
    await activeSwitch.click();
    await expect(activeSwitch).not.toBeChecked();

    // Delete — via the "Delete Promotion" confirm dialog.
    await row.getByRole('button', { name: `Delete ${promoName}` }).click();
    const confirmDlg = page.getByRole('alertdialog').filter({ hasText: promoName });
    await expect(confirmDlg).toBeVisible({ timeout: 10_000 });
    await confirmDlg.getByRole('button', { name: 'Delete Promotion' }).click();
    await expect(page.getByText('Promotion deleted')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('listitem').filter({ hasText: promoName })).toHaveCount(0);

    await logout(page);
  });

  test('T2: an active item-target promotion auto-applies at order time with no confirmation step (D-02)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    test.info().annotations.push({ type: 'requirement', description: 'SC-3, D-02' });

    const admin = getServiceClient();
    const customerName = `Promo Order E2E ${String(Date.now())}`;

    // Seed a live, active 20%-off item-target promotion on Budweiser directly
    // — T1 above already exercises the create-via-UI path; this test's focus
    // is the order-time auto-apply behavior, not a second UI creation.
    const { data: bud, error: budErr } = await admin
      .from('products')
      .select('id, base_price')
      .eq('name', 'Budweiser')
      .single();
    if (budErr || !bud) throw new Error(`T2 setup: Budweiser lookup failed - ${budErr?.message}`);
    const basePrice = Number((bud as { base_price: number }).base_price);
    const discountedPrice = Math.round(basePrice * 0.8 * 100) / 100;

    const { data: promo, error: promoErr } = await admin
      .from('promotions')
      .insert({
        name: '__e2e_order_flow_promo__',
        discount_type: 'percentage',
        discount_value: 20,
        target_type: 'item',
        target_product_id: (bud as { id: string }).id,
        priority: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (promoErr || !promo) throw new Error(`T2 setup: promotion insert failed - ${promoErr?.message}`);
    const promotionId = (promo as { id: string }).id;

    try {
      await loginAs(page, 'bartender');
      await page.goto('/pos');
      await page.getByRole('button', { name: /new tab/i }).click();
      await page.getByLabel(/customer name/i).fill(customerName);
      await page.getByRole('button', { name: 'Open Tab' }).click();
      await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

      const budBtn = page.getByRole('button', { name: /Select Budweiser/i });
      await expect(budBtn).toBeVisible({ timeout: 30_000 });
      await budBtn.click();
      await expect(page.getByText(/1 item/i)).toBeVisible({ timeout: 15_000 });

      // Place Order — no intermediate "apply promotion?" prompt exists or is
      // expected (D-02: silent, automatic). The click goes straight to the
      // create_order_with_items RPC, which is the sole authority for the
      // final charged price (evaluate_promotions_for_item).
      await page.getByRole('button', { name: 'Place Order' }).click();
      await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 20_000 });

      // The order-history line now reflects the server-applied discount —
      // 20% off Budweiser's base price — not the undiscounted base price the
      // client submitted.
      await expect(page.getByText(`$${discountedPrice.toFixed(2)}`, { exact: false })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(`$${basePrice.toFixed(2)}`, { exact: false })).toHaveCount(0);

      await logout(page);
    } finally {
      // Cleanup: remove the seeded promotion + tab regardless of test outcome.
      await admin.from('applied_promotions').delete().eq('promotion_id', promotionId);
      await admin.from('promotions').delete().eq('id', promotionId);
      await forceCloseAllOpenTabs();
    }
  });
});
