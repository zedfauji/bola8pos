/**
 * E2E spec: Phase 23 — Reopen Closed Ticket
 * Plan: 23-01 (Wave-0 scaffold) / activated in Plan 06 (SC-1, SC-3)
 *
 * SC-1: a manager+ PIN-gated dialog reopens a closed/paid tab from the
 * PaymentPane payment-history row (mirrors e2e/47-edit-paid-tab.spec.ts's
 * PIN-gate/manager-vs-bartender shape).
 * SC-3: the reopen action is gated behind a manager+ ManagerPinDialog
 * eligibleStaff check (D-04); the 24h window + 2x cap are proven at the
 * integration layer (Plan 04) — this spec proves the UI click-through.
 *
 * Note on RBAC shape: `ReopenTabButton` (PaymentPane.tsx) renders for every
 * role on any non-voided, non-refund payment row — there is no route/
 * visibility gate on /payments, mirroring the existing Refund/EditTicket
 * button pattern. The manager+ restriction on `reopen_tab` (23-01
 * MANAGER_EXTRA) is enforced entirely by `ManagerPinDialog`'s eligibleStaff
 * check: a bartender's own PIN is rejected, so a bartender can open the
 * dialog but cannot self-approve a reopen.
 *
 * Note on the bartender-negative assertion: while `ManagerPinDialog`
 * (an AlertDialog) is open on top of the Sheet, Radix's a11y layer marks the
 * Sheet's portal `aria-hidden` (it is still visually on screen, but
 * intentionally hidden from the accessibility tree while a modal covers it).
 * `page.getByRole('dialog', ...)` respects that and will not find it in this
 * state, so the "still open" check below uses a plain attribute-selector
 * locator (`[role="dialog"]`), which is unaffected by aria-hidden ancestors,
 * instead of a role-based query.
 *
 * Requires bar-pos/.env.local with E2E_*_PIN/NAME and SUPABASE_SERVICE_ROLE_KEY.
 */
import { expect, test } from './fixtures';
import { gotoAuthed, loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helper — adapted from e2e/47-edit-paid-tab.spec.ts's seedPaidTab.
// ---------------------------------------------------------------------------

interface SeededPaidTab {
  tabId: string;
  paymentId: string;
}

async function seedPaidTab(
  db: ReturnType<typeof getServiceClient>,
  unitPrice: number,
): Promise<SeededPaidTab> {
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  let shiftId: string;
  const { data: existingShift } = await db
    .from('shifts')
    .select('id')
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();
  if (existingShift) {
    shiftId = existingShift.id as string;
  } else {
    const { data: newShift } = await db
      .from('shifts')
      .insert({ staff_id: profile.id, opening_cash: 0 })
      .select('id')
      .single();
    shiftId = newShift.id as string;
  }

  const { data: tab } = await db
    .from('tabs')
    .insert({
      customer_name: 'E2E Reopen Tab Test',
      staff_id: profile.id,
      shift_id: shiftId,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();

  const { data: order } = await db
    .from('orders')
    .insert({
      tab_id: tab.id,
      staff_id: profile.id,
      status: 'pending',
    })
    .select('id')
    .single();

  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();

  await db.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    unit_price: unitPrice,
    modifier_price_delta: 0,
  });

  // tabs has bump_version_on_update (STALE_VERSION guard) — a freshly inserted
  // tab starts at version 1, so this update must set version: 2.
  const { error: tabUpdateErr } = await db
    .from('tabs')
    .update({ status: 'paid', closed_at: new Date().toISOString(), version: 2 })
    .eq('id', tab.id);
  if (tabUpdateErr) {
    throw new Error(`seedPaidTab: tabs update to paid failed: ${tabUpdateErr.message}`);
  }

  const { data: payment, error: payErr } = await db
    .from('payments')
    .insert({
      tab_id: tab.id,
      amount: unitPrice,
      tip_amount: 0,
      method: 'cash',
      is_refund: false,
      processed_by: profile.id,
      idempotency_key: `e2e-seed-reopen-${(tab.id as string).slice(0, 8)}`,
    })
    .select('id')
    .single();
  if (payErr) {
    throw new Error(`seedPaidTab: payments insert failed: ${payErr.message}`);
  }
  if (!payment) {
    throw new Error('seedPaidTab: payment row missing after insert');
  }

  return {
    tabId: tab.id as string,
    paymentId: payment.id as string,
  };
}

/**
 * Enter a PIN on the PINKeypad (button-based, aria-label "Key N").
 */
async function enterManagerPin(
  page: import('@playwright/test').Page,
  pin: string,
): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    const btn = page.getByRole('button', { name: label });
    const isVisible = await btn.isVisible().catch(() => false);
    if (isVisible) {
      await btn.click();
    } else {
      await page.keyboard.type(ch);
    }
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

test.describe('Reopen Closed Ticket', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(540);
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    await logout(page).catch(() => undefined);
  });

  // ==========================================================================
  // SC-1: manager reopens a closed/paid tab from /payments
  // ==========================================================================
  test.describe('SC-1: reopen a closed/paid tab from /payments', () => {
    test(
      'manager opens ReopenTabDialog from a closed tab\'s payment row, passes the PIN gate, ' +
        'fills a reason, confirms, and the tab flips back to open (payment shown as voided)',
      async ({ page }) => {
        test.setTimeout(90_000);

        const db = getServiceClient();
        const seeded = await seedPaidTab(db, 15);
        const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';

        await loginAs(page, 'manager');
        await gotoAuthed(page, '/payments');

        const row = page.getByTestId(`payment-row-${seeded.paymentId}`);
        await expect(row).toBeVisible({ timeout: 20_000 });
        await row.getByRole('button', { name: 'Reabrir cuenta' }).click();

        const dialog = page.getByRole('dialog', { name: 'Reabrir cuenta' });
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        await dialog.locator('#reopen-tab-reason').fill('E2E reopen reason');
        await dialog.getByRole('button', { name: 'Solicitar aprobación' }).click();

        const pinDialog = page.getByRole('alertdialog');
        await expect(pinDialog).toBeVisible({ timeout: 8_000 });
        await enterManagerPin(page, managerPin);

        await expect(page.getByText(/cuenta reabierta correctamente/i)).toBeVisible({
          timeout: 15_000,
        });
        await expect(dialog).not.toBeVisible({ timeout: 5_000 });

        const { data: tabRow } = await db
          .from('tabs')
          .select('status, closed_at, reopen_count')
          .eq('id', seeded.tabId)
          .single();
        expect((tabRow as { status: string }).status).toBe('open');
        expect((tabRow as { closed_at: string | null }).closed_at).toBeNull();
        expect((tabRow as { reopen_count: number }).reopen_count).toBe(1);

        const { data: paymentRow } = await db
          .from('payments')
          .select('status')
          .eq('id', seeded.paymentId)
          .single();
        expect((paymentRow as { status: string }).status).toBe('reopened_void');

        // The now-voided payment's Reopen button should no longer show.
        await expect(row.getByRole('button', { name: 'Reabrir cuenta' })).not.toBeVisible({
          timeout: 10_000,
        });
      },
    );

    test('bartender cannot self-approve the reopen-tab PIN gate (manager+ only, D-04)', async ({
      page,
    }) => {
      test.setTimeout(60_000);

      const db = getServiceClient();
      const seeded = await seedPaidTab(db, 15);
      const bartenderPin = process.env['E2E_BARTENDER_PIN'] ?? '';

      await loginAs(page, 'bartender');
      await gotoAuthed(page, '/payments');

      const row = page.getByTestId(`payment-row-${seeded.paymentId}`);
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole('button', { name: 'Reabrir cuenta' }).click();

      // A plain attribute-selector locator, not a role-based one — while the
      // ManagerPinDialog (AlertDialog) is open on top, Radix marks this Sheet's
      // portal aria-hidden (correct a11y behavior), which a role query would
      // exclude even though the Sheet is still visually on screen and mounted.
      const dialog = page.locator('[role="dialog"]', { hasText: 'Reabrir cuenta' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.locator('#reopen-tab-reason').fill('Bartender self-approval attempt');
      await dialog.getByRole('button', { name: 'Solicitar aprobación' }).click();

      const pinDialog = page.getByRole('alertdialog');
      await expect(pinDialog).toBeVisible({ timeout: 8_000 });
      await enterManagerPin(page, bartenderPin);

      // Bartender is not in ManagerPinDialog's eligibleStaff list for
      // reopen_tab (manager+ only) — rejected with an error, dialog stays open.
      await expect(pinDialog.getByText(/incorrect pin/i)).toBeVisible({ timeout: 8_000 });
      await expect(dialog).toBeVisible();

      const { data: tabRow } = await db
        .from('tabs')
        .select('status')
        .eq('id', seeded.tabId)
        .single();
      expect((tabRow as { status: string }).status).toBe('paid');

      const { data: paymentRow } = await db
        .from('payments')
        .select('status')
        .eq('id', seeded.paymentId)
        .single();
      expect((paymentRow as { status: string }).status).toBe('completed');
    });
  });
});
