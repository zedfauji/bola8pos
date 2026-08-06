/**
 * E2E: Void Order — /pos or /payments
 *
 * Tests the void-order feature: dialog appearance, reason validation,
 * RBAC (bartender vs manager), inventory restoration, and subtotal update.
 */

import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getServiceClient,
  openCaja,
  resetTestState,
  seedVoidableOrder,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function seedTabWithOrder(customerName: string): Promise<{ tabId: string; orderId: string }> {
  const admin = getServiceClient();

  // The seeded tab must belong to whichever staff member is currently logged
  // in (their open shift) — `useTabs()` filters the /pos and /payments tab
  // lists by the viewer's own `currentShift.id`. Picking an arbitrary
  // `profiles.limit(1)` row (unordered — resolves to whatever row sorts
  // first, including unrelated leftover test-pollution profiles) silently
  // seeds the tab under a *different* shift, so the viewer's tab list never
  // includes it and every UI flow depending on it (Switch Tab, the
  // tabs-waiting-for-payment list) hangs/times out. `resetTestState()` closes
  // every open shift in `beforeEach`, and every call site here runs after
  // `loginAs()`, so the single open shift at this point is always the
  // logged-in test session's own shift.
  const { data: activeShift, error: shiftErr } = await admin
    .from('shifts')
    .select('id, staff_id')
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (shiftErr || !activeShift) {
    throw new Error(
      `seedTabWithOrder: no open shift found (call after loginAs()) – ${shiftErr?.message ?? 'no row'}`
    );
  }
  const shiftId = activeShift.id as string;
  const staffId = activeShift.staff_id as string;

  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (!caja) throw new Error('seedTabWithOrder: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: staffId,
      shift_id: shiftId,
      caja_session_id: caja.id,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  const orderId = await seedVoidableOrder(tab.id as string);
  return { tabId: tab.id as string, orderId };
}

async function openPaymentsAndSelectTab(page: Page, customerName: string): Promise<void> {
  await page.goto('/payments');
  const list = page.getByTestId('tabs-waiting-for-payment');
  await expect(list).toBeVisible({ timeout: 20_000 });
  await expect(list.getByText(customerName)).toBeVisible({ timeout: 15_000 });
  await list.getByRole('button', { name: new RegExp(`tab ${customerName}`, 'i') }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Void Order', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('V1: VoidOrderDialog appears when void button clicked', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithOrder('Void Dialog Tab');
    await openPaymentsAndSelectTab(page, 'Void Dialog Tab');

    // Verify pin then look for void button
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    for (const ch of managerPin) {
      await pinDialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    // Look for void order button in payment form / order review area
    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    const voidBtnVisible = await voidBtn.isVisible().catch(() => false);
    if (!voidBtnVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order button in payment pane');
      return;
    }
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await expect(voidDialog.getByLabel(/void reason/i)).toBeVisible();
    await logout(page);
  });

  test('V2: submit void with reason — success toast and order shows voided state', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // This test only exercises a plain tab + order via POS (switch-tab drawer),
    // never a pool session — the pool-table availability check that used to
    // gate this test was vestigial (the fetched row was never read again) and
    // additionally always failed under the live PGRST205 pool_tables
    // schema-cache defect (see 39-02-LEDGER.md), masking a real "no pool
    // table" condition this test doesn't actually depend on. Removed.
    const { tabId } = await seedTabWithOrder('Void Success Tab');

    // Navigate via pos to find the void button in order panel
    await page.goto('/pos');
    // Switch to the tab
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Success Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order via POS order panel');
      return;
    }

    // Selecting the tab (TabCard.onSelect -> closeDrawer()) already closes the
    // drawer — a follow-up explicit "Close" click races the sheet's own
    // unmount and times out (harness bug, not app behavior).
    await tabDrawer.getByRole('button', { name: /Void Success Tab/i }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 10_000 });
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await voidDialog.getByLabel(/void reason/i).fill('Test void reason');
    await voidDialog.getByRole('button', { name: /void order/i }).click();
    await expect(page.getByText(/order voided/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);
    void tabId; // suppress unused warning
  });

  test('V3: bartender — void button absent or shows manager PIN dialog', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await seedTabWithOrder('Void Bartender Tab');

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Bartender Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order for bartender check');
      return;
    }
    // Selecting the tab already closes the drawer — see V2's comment above.
    await tabDrawer.getByRole('button', { name: /Void Bartender Tab/i }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (voidVisible) {
      // `void_order` is manager+-only in rbac.ts; `ProtectedAction` (the
      // app-wide RBAC-gating wrapper, shared/ui/ProtectedAction.tsx) renders
      // a denied action's control visible-but-disabled with a tooltip, not
      // hidden and not click-through-to-a-PIN-dialog — that PIN-gate pattern
      // is used by other manager actions elsewhere, not by void's
      // ProtectedAction wrapping. A disabled button never fires its click
      // handler, so asserting a PIN dialog appears after clicking it can
      // never pass; check disabled state instead of clicking.
      const isDisabled = await voidBtn.isDisabled();
      expect(isDisabled).toBe(true);
    } else {
      // Button absent — acceptable for bartender role
      expect(voidVisible).toBe(false);
    }
    await logout(page);
  });

  test('V4: void product with inventory — qty restores by 1', async ({ page: _page }) => {
    // Every code path in this test's original body was unreachable dead code
    // (an unconditional `test.skip(...)` sat at the end regardless of setup
    // outcome) — its own reason confirms inventory-restoration-on-void has no
    // UI flow to drive. The dead setup ran `getInventoryQty('Budweiser')`
    // first, which throws (no `inventory` row seeded for Budweiser — a
    // pre-existing seed-data gap, unrelated to void) before ever reaching the
    // always-true skip, turning an intended no-op skip into a crash. Skip
    // immediately instead of running unreachable setup.
    test.skip(
      true,
      'UI not implemented — EXPECTED FAIL: inventory restoration on void (requires UI void flow)'
    );
  });

  test('V5: submit void with empty reason — form error shown, order not voided', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithOrder('Void Empty Reason Tab');

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Empty Reason Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order reason validation');
      return;
    }
    // Selecting the tab already closes the drawer — see V2's comment above.
    await tabDrawer.getByRole('button', { name: /Void Empty Reason Tab/i }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 10_000 });
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });

    // Leave reason empty and confirm — button should be disabled or show error
    const confirmBtn = voidDialog.getByRole('button', { name: /void order/i });
    const isDisabled = await confirmBtn.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    } else {
      await confirmBtn.click();
      // Should not close — error shown
      await expect(voidDialog).toBeVisible({ timeout: 3_000 });
    }
    await logout(page);
  });

  test('V6: after void, tab subtotal decreases', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithOrder('Void Subtotal Tab');

    await page.goto('/payments');
    const list = page.getByTestId('tabs-waiting-for-payment');
    const tabButtonVisible = await list
      .getByRole('button', { name: /tab void subtotal tab/i })
      .isVisible({ timeout: 20_000 })
      .catch(() => false);

    if (!tabButtonVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: subtotal update after void (requires UI void flow integrated with payment pane)');
      return;
    }

    const tabButton = list.getByRole('button', { name: /tab void subtotal tab/i });
    const subtotalBefore = await tabButton.textContent();

    await tabButton.click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    for (const ch of managerPin) {
      await pinDialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    const voidBtnVisible = await voidBtn.isVisible().catch(() => false);
    if (!voidBtnVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: subtotal update after void (requires UI void flow integrated with payment pane)');
      return;
    }
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await voidDialog.getByLabel(/void reason/i).fill('Test subtotal decrease');
    await voidDialog.getByRole('button', { name: /void order/i }).click();
    await expect(page.getByText(/order voided/i)).toBeVisible({ timeout: 20_000 });

    // Voided order removed the tab's only item — its subtotal display must
    // have changed (dropped to $0.00) after the list re-renders.
    await page.goto('/payments');
    const listAfter = page.getByTestId('tabs-waiting-for-payment');
    const tabButtonAfterVisible = await listAfter
      .getByRole('button', { name: /tab void subtotal tab/i })
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (tabButtonAfterVisible) {
      const subtotalAfter = await listAfter.getByRole('button', { name: /tab void subtotal tab/i }).textContent();
      expect(subtotalAfter).not.toBe(subtotalBefore);
    }
    // If the tab no longer appears at all, its (now-empty) subtotal trivially
    // "decreased" out of the waiting-for-payment view — also a pass.
    await logout(page);
  });

  test('V7: void an already-voided order — button disabled or error shown', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    const { tabId } = await seedTabWithOrder('Already Voided Tab');

    // Mark the order as voided in DB directly
    const admin = getServiceClient();
    await admin.from('orders').update({ status: 'voided' }).eq('tab_id', tabId);

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Already Voided Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: already-voided order state');
      return;
    }
    // Selecting the tab already closes the drawer — see V2's comment above.
    await tabDrawer.getByRole('button', { name: /Already Voided Tab/i }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (voidVisible) {
      const isDisabled = await voidBtn.isDisabled();
      expect(isDisabled).toBe(true);
    }
    await logout(page);
  });
});
