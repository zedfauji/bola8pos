/**
 * E2E spec: Phase 15 — Tabs Version (Optimistic Concurrency)
 * Plan: 15-09
 *
 * Simulates a second POS terminal winning the version race on `tabs` while
 * the first terminal's close-tab request is already in flight, then asserts
 * the resulting STALE_VERSION conflict is surfaced end-to-end (toast + the
 * tab staying open) instead of a silent last-write-wins.
 *
 * useCloseTab (src/features/close-tab/index.ts) reads `tabs.version` fresh
 * immediately before its own guarded UPDATE, so bumping the version BEFORE
 * driving the UI would just be picked up as the new baseline — no conflict.
 * To create a real race deterministically, this spec lets the read happen
 * normally, then holds the resulting UPDATE's PATCH request via
 * page.route(), bumps the DB out from under it via the service-role client
 * (bumpTabVersion), and releases the PATCH unmodified — its
 * `WHERE version = <V>` then matches zero rows against the DB's real V+1.
 *
 * Requires bar-pos/.env.local with E2E_*_PIN/NAME and SUPABASE_SERVICE_ROLE_KEY.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  bumpTabVersion,
  getOpenTabIdByCustomerName,
  openCaja,
  resetTestState,
} from './helpers/supabase';

test.describe('Concurrent Edits (Optimistic Concurrency)', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(540);
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    await logout(page).catch(() => undefined);
  });

  test('close-tab against a stale version shows the conflict toast', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, 'admin');

    const customerName = `Concurrent Edit ${String(Date.now())}`;
    // Prefer in-app SPA navigation over a full page reload — a reload re-triggers
    // caja/realtime fetches that are unreliable under test load (same reasoning as
    // helpers/auth.ts's logout()). loginAs() can land on either /home or /pos.
    if (!page.url().includes('/pos')) {
      await page.getByRole('button', { name: 'POS Register' }).click();
      await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
    }
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill(customerName);
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    const tabId = await getOpenTabIdByCustomerName(customerName);
    expect(tabId).not.toBeNull();
    if (tabId === null) throw new Error('unreachable — assertion above guarantees a non-null id');

    // Real UI close-tab path: drawer -> this tab's card -> Details -> Close Tab
    // (mounted by 15-09 Task 1.5's TabCard/TabDrawer wiring of useCloseTab).
    await page.getByRole('button', { name: 'Switch Tab' }).click();
    await page.getByRole('button', { name: `View details for ${customerName}` }).click();
    const detailSheet = page.getByRole('dialog', { name: 'Tab Details' });
    await expect(detailSheet).toBeVisible({ timeout: 10_000 });

    // Let useCloseTab's own version read happen normally, then hold its
    // guarded UPDATE (PATCH .../tabs?id=eq.<id>&version=eq.<V>...) and bump
    // the DB out from under it before releasing the request unmodified.
    await page.route('**/rest/v1/tabs*', async route => {
      const req = route.request();
      if (
        req.method() === 'PATCH' &&
        req.url().includes(`id=eq.${tabId}`) &&
        req.url().includes('version=eq.')
      ) {
        await bumpTabVersion(tabId);
      }
      await route.continue();
    });

    await detailSheet.getByRole('button', { name: 'Close Tab' }).click();

    await expect(page.getByText('Updated by another terminal — please retry')).toBeVisible({
      timeout: 15_000,
    });

    const stillOpenTabId = await getOpenTabIdByCustomerName(customerName);
    expect(stillOpenTabId).not.toBeNull();
  });
});
