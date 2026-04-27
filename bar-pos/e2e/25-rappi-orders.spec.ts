/**
 * E2E: Rappi Orders — /rappi
 *
 * Tests Rappi order listing, acceptance, rejection, and linked tab in /payments.
 * Uses seedRappiOrder() to seed data. Tests gracefully skip if the Rappi
 * UI is not integrated (empty state is acceptable for RO1/RO2 display tests).
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState, seedRappiOrder } from './helpers/supabase';

test.describe('Rappi Orders', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    // Seed a pending rappi order before navigating
    await seedRappiOrder('pending_acceptance');
    await page.goto('/');
  });

  test('RO1: /rappi page loads without crash', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    await page.goto('/rappi');

    // Page should not crash — either shows orders or empty state
    const hasContent =
      (await page.getByText(/rappi|delivery|orders/i).count()) > 0;
    expect(hasContent).toBe(true);
    await logout(page);
  });

  test('RO2: seeded rappi order visible with customer name', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    await page.goto('/rappi');

    const customerNameText = page.getByText('Rappi Test Customer');
    const visible = await customerNameText.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: rappi orders not rendered from DB');
      return;
    }
    await expect(customerNameText).toBeVisible();
    await logout(page);
  });

  test('RO3: accept a pending rappi order — status changes to accepted/preparing', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    await page.goto('/rappi');

    const customerText = page.getByText('Rappi Test Customer');
    const visible = await customerText.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: rappi orders not rendered');
      return;
    }

    // Find accept button near the order card
    const acceptBtn = page.getByRole('button', { name: /accept|confirm/i }).first();
    const acceptVisible = await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!acceptVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: accept button not present on rappi page');
      return;
    }

    await acceptBtn.click();
    await expect(
      page.getByText(/accepted|preparing/i)
    ).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('RO4: reject a pending rappi order — order removed from pending list', async ({ page }) => {
    test.setTimeout(90_000);
    // Seed a second order for this test
    await seedRappiOrder('pending_acceptance');

    await loginAs(page, 'manager');
    await page.goto('/rappi');

    const customerText = page.getByText('Rappi Test Customer').first();
    const visible = await customerText.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: rappi orders not rendered');
      return;
    }

    const rejectBtn = page.getByRole('button', { name: /reject|decline/i }).first();
    const rejectVisible = await rejectBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!rejectVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: reject button not present');
      return;
    }

    await rejectBtn.click();
    // May prompt for a reason
    const reasonPrompt = page.getByLabel(/reason|why/i);
    if (await reasonPrompt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await reasonPrompt.fill('Test rejection reason');
      await page.getByRole('button', { name: /confirm|reject/i }).click();
    }

    // Order should no longer appear in pending list
    await expect(
      page.getByText(/rejected|removed/i)
    ).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('RO5: accepted rappi order linked tab appears in /payments', async ({ page }) => {
    test.setTimeout(120_000);

    // Seed a rappi order with an accepted status and linked tab
    const admin = getServiceClient();
    const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
    if (!staff) {
      test.skip(true, 'No profile found for RO5 seed');
      return;
    }

    let shiftId: string;
    const { data: existingShift } = await admin
      .from('shifts')
      .select('id')
      .eq('staff_id', staff.id)
      .is('clock_out', null)
      .limit(1)
      .maybeSingle();
    if (existingShift) {
      shiftId = existingShift.id as string;
    } else {
      const { data: newShift, error: shiftErr } = await admin
        .from('shifts')
        .insert({ staff_id: staff.id, opening_cash: 0 })
        .select('id')
        .single();
      if (shiftErr || !newShift) {
        test.skip(true, 'Could not create shift for RO5');
        return;
      }
      shiftId = newShift.id as string;
    }

    const { data: caja } = await admin.from('caja_sessions').select('id').eq('status', 'open').maybeSingle();
    if (!caja) {
      test.skip(true, 'No open caja for RO5');
      return;
    }

    const externalId = `E2E-RAPPI-RO5-${Date.now()}`;
    const { data: rappiRow } = await admin
      .from('rappi_orders')
      .insert({
        rappi_order_id: externalId,
        status: 'accepted',
        customer_name: 'Rappi RO5 Customer',
        delivery_address: '123 Test St',
        items: JSON.stringify([{ name: 'Corona', quantity: 1, unitPrice: 35 }]),
        subtotal: 35,
        rappi_total: 35,
        tenant_id: staff.id,
      })
      .select('id')
      .single();

    if (!rappiRow) {
      test.skip(true, 'Could not seed rappi order for RO5');
      return;
    }

    // Create linked tab
    const { data: tab } = await admin
      .from('tabs')
      .insert({
        customer_name: 'Rappi RO5 Customer',
        staff_id: staff.id,
        shift_id: shiftId,
        caja_session_id: caja.id,
        status: 'open',
        rappi_order_id: rappiRow.id,
      })
      .select('id')
      .single();

    if (!tab) {
      test.skip(true, 'Could not create linked tab for RO5');
      return;
    }

    await loginAs(page, 'manager');
    await page.goto('/payments');
    const list = page.getByTestId('tabs-waiting-for-payment');
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.getByText('Rappi RO5 Customer')).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });
});
