/**
 * E2E spec: Phase 27 (27-08) Task 3 checkpoint automation
 *
 * Plan 27-08's Task 3 was a `checkpoint:human-verify` (gate="blocking") requiring a
 * human to manually walk through 12 numbered steps in the running app — configure a
 * package + loose-piece product, stock it, open a unit, sell through it (including the
 * D-08 duplicate-open message, the SC-2 auto-transition on exhaustion, and the D-05
 * manager-PIN negative-stock override), correct/void as a manager (D-10), confirm the
 * bartender/manager RBAC split (D-11/D-12), confirm no low-count warning (D-06), and
 * confirm the audit trail (SC-4).
 *
 * The human operator explicitly authorized substituting a fully automated Playwright
 * spec — run for real, headed, against the live dev server — for that manual
 * click-through. This file is that substitution. Every one of the 12 steps has a
 * corresponding automated action + assertion below; where a literal manual step
 * doesn't map cleanly onto an automated assertion, the adaptation is called out in a
 * comment at that step (also documented in 27-08-SUMMARY.md).
 *
 * Fixtures: two brand-new catalog products (package + loose piece) are created
 * through the real Settings → Catalog → Products UI (not seeded directly) so D-02/D-03
 * persistence is genuinely exercised. Their id's inventory row has no UI path to
 * create it (no "add to inventory" flow exists anywhere in the app — a product's
 * inventory row is bootstrapped by an admin action outside this feature's scope), so
 * that one row is bootstrapped directly via the service-role client, called out below.
 * Everything else — opening/selling/exhausting/overriding/correcting/voiding units — is
 * driven through the real UI.
 *
 * Cleanup is idempotent and re-runnable: `cleanupOpenUnitFixtures()` runs in both
 * `beforeAll` (in case a prior run failed mid-flight) and `afterAll`.
 */

import { expect, test, type Page } from './fixtures';
import { gotoAuthed, loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

const PACKAGE_PRODUCT_NAME = 'E2E Open-Unit Box';
const LOOSE_PRODUCT_NAME = 'E2E Open-Unit Loose';
const UNITS_PER_PACKAGE = 20;
const PACKAGE_BASE_PRICE = '120.00';
// Deliberately NOT 1/20th of the package price (120/20 = 6.00) — proves D-03: the
// system must never auto-derive/adjust the loose piece's price from the package.
const LOOSE_BASE_PRICE = '7.00';

// open_units and the two new products columns aren't in supabase.types.ts yet
// (same pre-type-regen workaround as the app code — see CLAUDE.md).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getServiceClient();
}

function integrationEnvMissing(): boolean {
  return !process.env['VITE_SUPABASE_URL']?.trim() || !process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();
}

async function cleanupOpenUnitFixtures(): Promise<void> {
  const admin = db();
  const { data: pkg } = await admin
    .from('products')
    .select('id')
    .eq('name', PACKAGE_PRODUCT_NAME)
    .maybeSingle();
  const { data: loose } = await admin
    .from('products')
    .select('id')
    .eq('name', LOOSE_PRODUCT_NAME)
    .maybeSingle();
  const packageId = pkg?.id as string | undefined;
  const looseId = loose?.id as string | undefined;
  const productIds = [packageId, looseId].filter((id): id is string => id != null);

  if (productIds.length > 0) {
    await admin.from('order_items').delete().in('product_id', productIds);
  }
  if (packageId) {
    await admin.from('open_units').delete().eq('product_id', packageId);
    await admin.from('inventory').delete().eq('product_id', packageId);
  }
  // Loose product references the package via parent_product_id (FK, no cascade) —
  // must be deleted before the package.
  if (looseId) {
    await admin.from('products').delete().eq('id', looseId);
  }
  if (packageId) {
    await admin.from('products').delete().eq('id', packageId);
  }
}

/**
 * Switch the currently-logged-in staff member's own locale via the real
 * Settings → Language surface, so this spec's selectors (which target the
 * en-US catalog) resolve correctly regardless of the account's stored
 * default (es-MX). Copied from e2e/46-i18n-locale-switch.spec.ts's
 * `switchOwnLocale` — reused verbatim rather than re-deriving, including its
 * documented render-lag workaround (checks the Select's own `data-state`
 * rather than the heading, which can render stale for a beat after
 * `i18n.changeLanguage()` fires).
 */
async function switchOwnLocale(page: Page, target: 'en-US' | 'es-MX'): Promise<void> {
  await page.goto('/settings');
  const languageTab = page.getByRole('tab', { name: /^(Idioma|Language)$/ });
  await expect(languageTab).toBeVisible({ timeout: 20_000 });
  await languageTab.click();

  const localeSelect = page.locator('#settings-language');
  await expect(localeSelect).toBeVisible({ timeout: 15_000 });
  await localeSelect.click();

  const optionLocator =
    target === 'es-MX'
      ? page.getByRole('option', { name: 'Español (México)' })
      : page.getByRole('option', { name: /^(Inglés \(EE\. UU\.\)|English \(US\))$/ });
  await expect(optionLocator).toBeVisible({ timeout: 10_000 });

  const alreadySelected = (await optionLocator.getAttribute('data-state')) === 'checked';
  if (alreadySelected) {
    await page.keyboard.press('Escape');
    return;
  }

  await optionLocator.click();

  const saveButton = page.getByRole('button', { name: /^(Guardar idioma|Save Language)$/ });
  await expect(saveButton).toBeEnabled({ timeout: 20_000 });
  await saveButton.click();
  await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 15_000 });

  const expectedHeading = target === 'es-MX' ? 'Idioma' : 'Language';
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({
    timeout: 15_000,
  });
}

/** Enter a PIN on an in-app ManagerPinDialog (PINKeypad, aria-label "Key N"). */
async function enterManagerPin(page: Page, pin: string): Promise<void> {
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

/** The Open Units table row for a given product name (activeOnly query — at most one row per product, D-07). */
function openUnitsRow(page: Page, productName: string) {
  return page.getByRole('table').locator('tr', { hasText: productName });
}

/**
 * Clicks Place Order and waits for the cart to actually clear — the
 * definitive success signal (CartPanel calls `clearCart()` only on success,
 * both the plain and the manager-override path). A toast-text assertion
 * alone is not reliable here: sonner toasts persist for several seconds, so
 * back-to-back sales can have an earlier toast still on screen when the next
 * `expect(...).toBeVisible()` runs, letting it match stale text instead of
 * confirming this specific order actually completed.
 */
async function placeOrderAndWaitForClear(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 20_000 });
}

async function getInventoryQtyByProductId(productId: string): Promise<number> {
  const admin = db();
  const { data, error } = await admin
    .from('inventory')
    .select('quantity_on_hand')
    .eq('product_id', productId)
    .single();
  if (error || data == null) throw new Error(`getInventoryQtyByProductId failed: ${error?.message ?? 'no row'}`);
  return Number(data.quantity_on_hand);
}

async function getActiveOpenUnit(
  productId: string
): Promise<{ id: string; remaining_count: number } | null> {
  const admin = db();
  const { data } = await admin
    .from('open_units')
    .select('id, remaining_count')
    .eq('product_id', productId)
    .eq('status', 'active')
    .maybeSingle();
  return (data as { id: string; remaining_count: number } | null) ?? null;
}

test.describe('Phase 27 (27-08 Task 3): open-a-box-and-sell-through-it, fully automated', () => {
  test.beforeAll(async () => {
    if (integrationEnvMissing()) return;
    await cleanupOpenUnitFixtures();
  });

  test.afterAll(async () => {
    if (integrationEnvMissing()) return;
    await cleanupOpenUnitFixtures();
    // Don't leave the shared admin/bartender test profiles polluted at
    // en-US for other specs (matches e2e/46-i18n-locale-switch.spec.ts's
    // own cleanup rationale). resetTestState() in other specs' own
    // beforeEach would also catch this, but do it explicitly for tidiness.
    await db()
      .from('profiles')
      .update({ locale: 'es-MX' })
      .in('name', [process.env['E2E_ADMIN_NAME'] ?? '', process.env['E2E_BARTENDER_NAME'] ?? '']);
  });

  test('configure, stock, open, sell, exhaust, override, correct/void, RBAC tiers, D-06, audit', async ({
    page,
  }) => {
    requireIntegrationEnv();
    test.setTimeout(600_000);
    test.info().annotations.push({
      type: 'requirement',
      description: 'SC-1, SC-2, SC-3, SC-4, D-02, D-03, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12',
    });

    await resetTestState();
    await openCaja(590);

    const adminPin = process.env['E2E_ADMIN_PIN'] ?? '0000';
    let packageProductId = '';
    let looseProductId = '';
    let adminProfileId = '';

    // -------------------------------------------------------------------
    // Setup: admin login (switched to en-US — resetTestState() defaults
    // every profile to es-MX and this spec's selectors target the en-US
    // catalog) + one open tab used for every sale in this flow
    // -------------------------------------------------------------------
    await test.step('Setup: login as admin, switch to English, open a tab', async () => {
      await loginAs(page, 'admin');
      await switchOwnLocale(page, 'en-US');
      await page.goto('/pos');
      await page.getByRole('button', { name: /new tab/i }).click();
      await page.getByLabel(/customer name/i).fill('E2E Open Units Tab');
      await page.getByRole('button', { name: 'Open Tab' }).click();
      await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    });

    // -------------------------------------------------------------------
    // Step 1: configure package product — units-per-package 20, save,
    // reopen, confirm persisted.
    // -------------------------------------------------------------------
    await test.step('Step 1: configure package product (units-per-package = 20)', async () => {
      await page.goto('/settings');
      await page.getByRole('tab', { name: 'Products' }).click();
      await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Add product' }).click();

      const createDialog = page.getByRole('dialog', { name: 'New product' });
      await expect(createDialog).toBeVisible({ timeout: 10_000 });
      await createDialog.getByLabel('Name').fill(PACKAGE_PRODUCT_NAME);
      await createDialog.getByLabel('Money amount').fill(PACKAGE_BASE_PRICE);
      await createDialog.getByLabel('Units per package').fill(String(UNITS_PER_PACKAGE));
      const createBtn = createDialog.getByRole('button', { name: 'Create product' });
      await createBtn.scrollIntoViewIfNeeded();
      await createBtn.click();
      await expect(page.getByText('Product created')).toBeVisible({ timeout: 15_000 });

      // Reopen and confirm 20 persisted.
      const search = page.getByPlaceholder(/search products/i);
      await search.fill(PACKAGE_PRODUCT_NAME);
      const row = page.getByRole('row', { name: new RegExp(PACKAGE_PRODUCT_NAME) });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByRole('button', { name: 'Edit' }).click();
      const editDialog = page.getByRole('dialog', { name: 'Edit product' });
      await expect(editDialog).toBeVisible({ timeout: 10_000 });
      await expect(editDialog.getByLabel('Units per package')).toHaveValue(String(UNITS_PER_PACKAGE));
      await editDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
      await search.fill('');
    });

    // -------------------------------------------------------------------
    // Step 2: configure the loose piece — linked to the package, price
    // deliberately NOT 1/20th of the package price (D-03), save, reopen,
    // confirm both link and price persisted unchanged.
    // -------------------------------------------------------------------
    await test.step('Step 2: configure the loose piece (linked, price deliberately not 1/20th — D-03)', async () => {
      await page.getByRole('button', { name: 'Add product' }).click();
      const createDialog = page.getByRole('dialog', { name: 'New product' });
      await expect(createDialog).toBeVisible({ timeout: 10_000 });
      await createDialog.getByLabel('Name').fill(LOOSE_PRODUCT_NAME);
      await createDialog.getByLabel('Money amount').fill(LOOSE_BASE_PRICE);
      await createDialog.getByLabel('Linked package product').selectOption({ label: PACKAGE_PRODUCT_NAME });
      const createBtn = createDialog.getByRole('button', { name: 'Create product' });
      await createBtn.scrollIntoViewIfNeeded();
      await createBtn.click();
      await expect(page.getByText('Product created')).toBeVisible({ timeout: 15_000 });

      const search = page.getByPlaceholder(/search products/i);
      await search.fill(LOOSE_PRODUCT_NAME);
      const row = page.getByRole('row', { name: new RegExp(LOOSE_PRODUCT_NAME) });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByRole('button', { name: 'Edit' }).click();
      const editDialog = page.getByRole('dialog', { name: 'Edit product' });
      await expect(editDialog).toBeVisible({ timeout: 10_000 });
      // D-03: price is exactly what was entered, never auto-derived from the package.
      await expect(editDialog.getByLabel('Money amount')).toHaveValue(LOOSE_BASE_PRICE);
      const linkedSelect = editDialog.getByLabel('Linked package product');
      await expect(linkedSelect).not.toHaveValue('');
      await expect(linkedSelect.locator('option:checked')).toHaveText(PACKAGE_PRODUCT_NAME);
      await editDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
      await search.fill('');
    });

    // -------------------------------------------------------------------
    // Fixture bootstrap (not one of the 12 checklist steps): resolve the
    // two products' ids and create the package's inventory row. There is
    // no "add product to inventory tracking" UI flow anywhere in this app
    // (pre-existing gap, unrelated to this phase) — an admin bootstrapping
    // a brand-new product's stock row is assumed prior state the checklist
    // doesn't cover, so it is created directly here.
    // -------------------------------------------------------------------
    await test.step('Bootstrap: resolve product ids, create the package inventory row', async () => {
      const admin = db();
      const { data: pkg } = await admin
        .from('products')
        .select('id')
        .eq('name', PACKAGE_PRODUCT_NAME)
        .single();
      packageProductId = pkg.id as string;
      const { data: loose } = await admin
        .from('products')
        .select('id')
        .eq('name', LOOSE_PRODUCT_NAME)
        .single();
      looseProductId = loose.id as string;
      expect(looseProductId).toBeTruthy();

      const adminName = process.env['E2E_ADMIN_NAME'] ?? '';
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('name', adminName)
        .maybeSingle();
      adminProfileId = (adminProfile?.id as string | undefined) ?? '';

      await admin.from('inventory').upsert(
        { product_id: packageProductId, quantity_on_hand: 0, low_stock_threshold: 5, unit: 'unit' },
        { onConflict: 'product_id' }
      );
    });

    // -------------------------------------------------------------------
    // Step 3: stock the package via the Stock tab's Adjust dialog (0 -> 2).
    // -------------------------------------------------------------------
    await test.step('Step 3: stock the package via /inventory Stock tab Adjust (to quantity 2)', async () => {
      await gotoAuthed(page, '/inventory');
      await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('tab', { name: 'Stock' }).click();
      await page.getByRole('button', { name: 'Adjust' }).click();

      const dialog = page.getByRole('dialog', { name: 'Batch adjustment' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.getByLabel('Product').selectOption({ label: PACKAGE_PRODUCT_NAME });
      await dialog.getByLabel('Quantity delta').fill('2');
      await dialog.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText('Stock updated')).toBeVisible({ timeout: 15_000 });

      expect(await getInventoryQtyByProductId(packageProductId)).toBe(2);
    });

    // -------------------------------------------------------------------
    // Step 4: open a unit manually via the Open Units tab; confirm D-09
    // (tab lives inside /inventory) and that the Stock tab is intact.
    // -------------------------------------------------------------------
    await test.step('Step 4: open a unit manually (D-09); Stock tab remains intact', async () => {
      await page.getByRole('tab', { name: 'Open Units' }).click();
      await expect(page.getByRole('heading', { name: 'Open Units' })).toBeVisible({ timeout: 10_000 });

      await page.getByLabel('Open a new unit').selectOption({ label: PACKAGE_PRODUCT_NAME });
      await page.getByRole('button', { name: 'Open new unit' }).click();
      await expect(page.getByText(/new unit opened/i)).toBeVisible({ timeout: 15_000 });

      const row = openUnitsRow(page, PACKAGE_PRODUCT_NAME);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row).toContainText('20');
      // Adapted: the checklist says "confirm your name" — the widget renders the raw
      // opener id (opened_by), not a resolved staff display name (Task 1's own
      // component test asserts the same raw-id rendering). Assert the id instead.
      if (adminProfileId) {
        await expect(row).toContainText(adminProfileId);
      }

      expect(await getInventoryQtyByProductId(packageProductId)).toBe(1);

      // D-09 / Task 2 regression: the Stock tab's pre-existing content is untouched.
      await page.getByRole('tab', { name: 'Stock' }).click();
      await expect(page.getByRole('heading', { name: 'On-hand levels' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Change log' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Adjust' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
      await page.getByRole('tab', { name: 'Open Units' }).click();
    });

    // -------------------------------------------------------------------
    // Step 5 (D-08): opening a second unit for the same product surfaces
    // the live remaining count, not a generic error.
    // -------------------------------------------------------------------
    await test.step('Step 5 (D-08): duplicate open attempt names the live remaining count', async () => {
      await page.getByLabel('Open a new unit').selectOption({ label: PACKAGE_PRODUCT_NAME });
      await page.getByRole('button', { name: 'Open new unit' }).click();
      await expect(page.getByText(/20 remaining/i)).toBeVisible({ timeout: 10_000 });
    });

    // -------------------------------------------------------------------
    // Step 6: sell loose pieces via POS, including a quantity-3 line.
    // -------------------------------------------------------------------
    await test.step('Step 6: sell loose pieces via /pos, including a quantity-3 line', async () => {
      await gotoAuthed(page, '/pos');
      const productBtn = page.getByRole('button', { name: new RegExp(`Select ${LOOSE_PRODUCT_NAME}`, 'i') });
      await expect(productBtn).toBeVisible({ timeout: 20_000 });

      // Sale A: qty 1 -> remaining 20 -> 19
      await productBtn.click();
      await placeOrderAndWaitForClear(page);
      let unit = await getActiveOpenUnit(packageProductId);
      expect(unit?.remaining_count).toBe(19);

      // Sale B: qty 3 -> remaining 19 -> 16
      for (let i = 0; i < 3; i++) {
        await productBtn.click();
      }
      await placeOrderAndWaitForClear(page);
      unit = await getActiveOpenUnit(packageProductId);
      expect(unit?.remaining_count).toBe(16);

      // Visual confirmation of the quantity-3 drop, through the real UI.
      await gotoAuthed(page, '/inventory');
      await page.getByRole('tab', { name: 'Open Units' }).click();
      await expect(openUnitsRow(page, PACKAGE_PRODUCT_NAME)).toContainText('16');
    });

    // -------------------------------------------------------------------
    // Step 7: sell through exhaustion — confirm auto-transition (SC-2).
    // -------------------------------------------------------------------
    await test.step('Step 7 (SC-2): sell through exhaustion; fresh unit auto-opens', async () => {
      await gotoAuthed(page, '/pos');
      const productBtn = page.getByRole('button', { name: new RegExp(`Select ${LOOSE_PRODUCT_NAME}`, 'i') });
      await expect(productBtn).toBeVisible({ timeout: 20_000 });

      // Sale C: qty 16 -> remaining 16 -> 0 exactly (unit 1 exhausts; package stays at 1
      // — package inventory is only touched when a NEW unit is opened).
      for (let i = 0; i < 16; i++) {
        await productBtn.click();
      }
      await placeOrderAndWaitForClear(page);
      expect(await getActiveOpenUnit(packageProductId)).toBeNull();
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(1);

      // Sale D: qty 1 -> no active unit found -> auto-opens a fresh unit (remaining
      // starts at 20, package 1 -> 0) and immediately consumes this sale's 1 piece
      // within the same call. Adapted: the checklist's "20 remaining" describes the
      // instant-of-open state (also what audit_logs.open_unit.open's `after` payload
      // captures) — the row visible after this same sale reflects 20 minus the qty
      // that triggered the auto-open, i.e. 19, which is what's asserted below.
      await productBtn.click();
      await placeOrderAndWaitForClear(page);
      const unit = await getActiveOpenUnit(packageProductId);
      expect(unit?.remaining_count).toBe(19);
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(0);

      await gotoAuthed(page, '/inventory');
      await page.getByRole('tab', { name: 'Open Units' }).click();
      await expect(openUnitsRow(page, PACKAGE_PRODUCT_NAME)).toContainText('19');
      await page.getByRole('tab', { name: 'Stock' }).click();
      await expect(page.getByRole('cell', { name: PACKAGE_PRODUCT_NAME })).toBeVisible({ timeout: 10_000 });
    });

    // -------------------------------------------------------------------
    // Step 8 (D-05): exhaust the second unit, then hit the zero-package
    // block and approve the manager-PIN override.
    // -------------------------------------------------------------------
    await test.step('Step 8 (D-05): exhaust second unit; zero-stock block + manager-PIN override', async () => {
      await gotoAuthed(page, '/pos');
      const productBtn = page.getByRole('button', { name: new RegExp(`Select ${LOOSE_PRODUCT_NAME}`, 'i') });
      await expect(productBtn).toBeVisible({ timeout: 20_000 });

      // Sale E: qty 19 -> remaining 19 -> 0 exactly (unit 2 exhausts; package stays 0).
      for (let i = 0; i < 19; i++) {
        await productBtn.click();
      }
      await placeOrderAndWaitForClear(page);
      expect(await getActiveOpenUnit(packageProductId)).toBeNull();
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(0);

      // Sale F: qty 1, zero packages left -> blocked, same override mechanism as
      // existing negative-stock handling (D-05).
      const qtyBeforeOverride = await getInventoryQtyByProductId(packageProductId);
      await productBtn.click();
      await page.getByRole('button', { name: 'Place Order' }).click();
      await expect(page.getByText(/out of stock/i)).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /allow override/i }).click();
      const pinDialog = page.getByRole('alertdialog');
      await expect(pinDialog).toBeVisible({ timeout: 8_000 });
      await expect(pinDialog.getByText(/manager access required/i)).toBeVisible();
      await enterManagerPin(page, adminPin);
      await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 20_000 });

      const unit = await getActiveOpenUnit(packageProductId);
      expect(unit?.remaining_count).toBe(19);
      // D-05: the override still opens a fresh unit (the sale completes)
      // even with zero packages in stock. inventory.quantity_on_hand carries
      // a hard non-negative CHECK constraint predating this phase
      // (20260414000007), so the override-bypass floors the decrement at 0
      // rather than actually going negative (fix: migration
      // 20260730000001_consume_open_unit_fix_negative_inventory_floor.sql,
      // found by 27-03's own R3 hardening scenario) — asserted here via the
      // same GREATEST(...,0) floor, not a hardcoded absolute.
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(
        Math.max(qtyBeforeOverride - 1, 0)
      );

      await gotoAuthed(page, '/inventory');
      await page.getByRole('tab', { name: 'Open Units' }).click();
      await expect(openUnitsRow(page, PACKAGE_PRODUCT_NAME)).toContainText('19');
    });

    // -------------------------------------------------------------------
    // Step 9 (D-10): correct the currently-open unit, then void it —
    // package stock must not increase on void.
    // -------------------------------------------------------------------
    await test.step('Step 9 (D-10): correct then void the open unit; package stock unaffected by void', async () => {
      const row = openUnitsRow(page, PACKAGE_PRODUCT_NAME);
      await expect(row).toBeVisible({ timeout: 10_000 });

      // Captured as a baseline for the post-void delta check below, not
      // asserted against a hardcoded absolute — the exact value here matters
      // less than "voiding doesn't move it" (D-10), which the delta check
      // after void proves directly.
      const qtyBeforeVoid = await getInventoryQtyByProductId(packageProductId);

      await row.getByRole('button', { name: 'Correct count' }).click();
      const correctDialog = page.getByRole('dialog', { name: /correct count/i });
      await expect(correctDialog).toBeVisible({ timeout: 10_000 });
      await correctDialog.getByLabel('Remaining count').fill('5');
      await correctDialog.getByLabel('Reason').fill('E2E recount — physical check');
      await correctDialog.getByRole('button', { name: 'Correct count' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 8_000 });
      await enterManagerPin(page, adminPin);
      await expect(page.getByText(/count corrected/i)).toBeVisible({ timeout: 15_000 });
      await expect(row).toContainText('5');

      await row.getByRole('button', { name: 'Void' }).click();
      const voidDialog = page.getByRole('dialog', { name: /void unit/i });
      await expect(voidDialog).toBeVisible({ timeout: 10_000 });
      await voidDialog.getByLabel('Reason').fill('E2E box damaged — writing off');
      await voidDialog.getByRole('button', { name: 'Void unit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 8_000 });
      await enterManagerPin(page, adminPin);
      await expect(page.getByText(/unit voided/i)).toBeVisible({ timeout: 15_000 });

      await expect(openUnitsRow(page, PACKAGE_PRODUCT_NAME)).toHaveCount(0);
      // D-10: voiding never credits inventory back.
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(qtyBeforeVoid);
    });

    // -------------------------------------------------------------------
    // Bridge (not a checklist step): restock so the bartender-tier check
    // below has a package available to open.
    // -------------------------------------------------------------------
    await test.step('Bridge: admin restocks the package before the bartender-tier check', async () => {
      const qtyBeforeRestock = await getInventoryQtyByProductId(packageProductId);
      await page.getByRole('tab', { name: 'Stock' }).click();
      await page.getByRole('button', { name: 'Adjust' }).click();
      const dialog = page.getByRole('dialog', { name: 'Batch adjustment' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.getByLabel('Product').selectOption({ label: PACKAGE_PRODUCT_NAME });
      await dialog.getByLabel('Quantity delta').fill('2');
      await dialog.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText('Stock updated')).toBeVisible({ timeout: 15_000 });
      expect(await getInventoryQtyByProductId(packageProductId)).toBe(qtyBeforeRestock + 2);
      expect(await getInventoryQtyByProductId(packageProductId)).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------------
    // Step 10 (D-11/D-12): bartender can open a unit; correct/void unavailable.
    // -------------------------------------------------------------------
    await test.step('Step 10 (D-11/D-12): bartender tier — can open, cannot correct/void', async () => {
      await logout(page);
      await loginAs(page, 'bartender');
      await switchOwnLocale(page, 'en-US');
      await gotoAuthed(page, '/inventory');
      await page.getByRole('tab', { name: 'Open Units' }).click();

      const qtyBeforeOpen = await getInventoryQtyByProductId(packageProductId);
      await page.getByLabel('Open a new unit').selectOption({ label: PACKAGE_PRODUCT_NAME });
      await page.getByRole('button', { name: 'Open new unit' }).click();
      await expect(page.getByText(/new unit opened/i)).toBeVisible({ timeout: 15_000 });

      const row = openUnitsRow(page, PACKAGE_PRODUCT_NAME);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row).toContainText('20');

      await expect(row.getByRole('button', { name: 'Correct count' })).toBeDisabled();
      await expect(row.getByRole('button', { name: 'Void' })).toBeDisabled();

      expect(await getInventoryQtyByProductId(packageProductId)).toBe(qtyBeforeOpen - 1);
      await logout(page);
    });

    // -------------------------------------------------------------------
    // Step 11 (D-06): correct the unit to a low remaining count and
    // confirm no warning styling renders.
    // -------------------------------------------------------------------
    await test.step('Step 11 (D-06): low remaining count carries no warning styling', async () => {
      await loginAs(page, 'admin');
      await switchOwnLocale(page, 'en-US');
      await gotoAuthed(page, '/inventory');
      await page.getByRole('tab', { name: 'Open Units' }).click();

      const row = openUnitsRow(page, PACKAGE_PRODUCT_NAME);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByRole('button', { name: 'Correct count' }).click();
      const correctDialog = page.getByRole('dialog', { name: /correct count/i });
      await expect(correctDialog).toBeVisible({ timeout: 10_000 });
      await correctDialog.getByLabel('Remaining count').fill('2');
      await correctDialog.getByLabel('Reason').fill('E2E low-count D-06 check');
      await correctDialog.getByRole('button', { name: 'Correct count' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 8_000 });
      await enterManagerPin(page, adminPin);
      await expect(page.getByText(/count corrected/i)).toBeVisible({ timeout: 15_000 });

      await expect(row).toContainText('2');
      const rowClass = (await row.getAttribute('class')) ?? '';
      expect(rowClass).not.toMatch(/amber/);
      expect(rowClass).not.toMatch(/destructive/);
      await expect(row.getByText(/low|warning/i)).toHaveCount(0);
    });

    // -------------------------------------------------------------------
    // Step 12 (SC-4): audit trail shows the full open-unit lifecycle plus
    // the step-8 override.
    // -------------------------------------------------------------------
    await test.step('Step 12 (SC-4): audit trail — open/deplete/exhaust/correct/void/override', async () => {
      await gotoAuthed(page, '/audit');
      await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });

      const actions = [
        'open_unit.open',
        'open_unit.deplete',
        'open_unit.exhaust',
        'open_unit.correct',
        'open_unit.void',
        'open_unit.override',
      ];
      for (const action of actions) {
        const actionTrigger = page.locator('#audit-filter-action');
        await actionTrigger.click();
        const option = page.getByRole('option', { name: action });
        await expect(option).toBeVisible({ timeout: 5_000 });
        await option.click();
        await page.getByRole('button', { name: /apply filters/i }).click();
        await expect(page.getByRole('cell', { name: action }).first()).toBeVisible({ timeout: 10_000 });
      }

      await logout(page);
    });
  });
});
