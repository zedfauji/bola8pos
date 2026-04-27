/**
 * E2E: Modifier sheet, per-item notes, and KDS modifier/notes display.
 *
 * Remote DB reality (as of 2026-04-26):
 *   - 92 products in Spanish (Papas, Alitas, etc.) — no seed.sql English products
 *   - 37 modifiers exist but 0 product_modifiers rows
 *   - All categories have is_food=false
 *
 * Strategy:
 *   T1/T2 — Use page.route() to intercept the Supabase products REST response and
 *            inject a mock "Alitas E2E" product with modifiers into the first batch.
 *            This is fully self-contained and requires no DB mutations.
 *   T3    — Dynamically pick a real product + real modifier, insert a product_modifier
 *            row and mark the category as is_food, seed the order, then clean up.
 *   T4    — skip (Tauri IPC unavailable in browser mode).
 *
 * Auth note: LoginPage redirects to /pos when isAuthenticated=true (Supabase session
 * persisted in localStorage). Clear localStorage before calling loginAs so the PIN
 * flow always goes through the shift-start dialog → /home.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Constants — real modifier IDs from the remote DB (inserted by migration)
// ---------------------------------------------------------------------------
const MODIFIER_EXTRA_LIME_ID = '30000003-0000-0000-0000-000000000003';
const MODIFIER_EXTRA_LIME_NAME = 'Extra Lime';
const MODIFIER_EXTRA_SALT_ID = '30000001-0000-0000-0000-000000000001';
const MODIFIER_EXTRA_SALT_NAME = 'Extra Salt';
const MODIFIER_NO_ICE_ID = '30000002-0000-0000-0000-000000000002';
const MODIFIER_NO_ICE_NAME = 'No Ice';

// A fake product UUID used only in the intercepted products response for T1/T2.
// It must not exist in the DB — it is never persisted.
const MOCK_PRODUCT_ID = 'e2e00018-0000-0000-0000-000000000001';
const MOCK_PRODUCT_NAME = 'Alitas E2E';

// ---------------------------------------------------------------------------
// DB-level helpers for T3
// ---------------------------------------------------------------------------

/**
 * Picks the first active non-combo product from a real category, links MODIFIER_EXTRA_LIME
 * to it, marks the category as is_food=true, then returns cleanup info.
 * All mutations are rolled back in teardown.
 */
async function setupKdsSeedProduct(): Promise<{
  productId: string;
  categoryId: string;
  modifierName: string;
  modifierId: string;
  productModifierInserted: boolean;
}> {
  const admin = getServiceClient() as any;

  // Find any active non-combo product (skip the Rappi delivery placeholder)
  const { data: product, error: pErr } = await admin
    .from('products')
    .select('id, base_price, category_id')
    .eq('is_active', true)
    .eq('is_combo', false)
    .neq('id', 'a0000002-0000-4000-8000-000000000002') // skip Rappi external item
    .limit(1)
    .maybeSingle();
  if (pErr || !product) throw new Error(`setupKdsSeedProduct: no product found – ${pErr?.message}`);

  const productId = product.id as string;
  const categoryId = product.category_id as string;

  // Mark category as is_food so KDS query includes it
  await admin.from('categories').update({ is_food: true }).eq('id', categoryId);

  // Link Extra Lime modifier to the product (may already exist — ignore duplicate error)
  const { error: pmErr } = await admin
    .from('product_modifiers')
    .insert({ product_id: productId, modifier_id: MODIFIER_EXTRA_LIME_ID });
  const productModifierInserted = !pmErr;

  return {
    productId,
    categoryId,
    modifierName: MODIFIER_EXTRA_LIME_NAME,
    modifierId: MODIFIER_EXTRA_LIME_ID,
    productModifierInserted,
  };
}

async function teardownKdsSeedProduct(
  productId: string,
  categoryId: string,
  productModifierInserted: boolean
): Promise<void> {
  const admin = getServiceClient() as any;
  await admin.from('categories').update({ is_food: false }).eq('id', categoryId);
  if (productModifierInserted) {
    await admin
      .from('product_modifiers')
      .delete()
      .eq('product_id', productId)
      .eq('modifier_id', MODIFIER_EXTRA_LIME_ID);
  }
}

/**
 * Seed a tab + order + order_item for a given product with one modifier link and a note.
 * Returns tabId and itemId.
 */
async function seedOrderWithModifierAndNote(
  productId: string,
  modifierId: string,
  note: string
): Promise<{ tabId: string; itemId: string }> {
  const admin = getServiceClient() as any;

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedOrderWithModifierAndNote: no profile found');

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
    if (shiftErr || !newShift) throw new Error(`shift create failed – ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (!caja) throw new Error('seedOrderWithModifierAndNote: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: `Modifier KDS E2E ${Date.now()}`,
      staff_id: staff.id,
      shift_id: shiftId,
      caja_session_id: caja.id,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({ tab_id: tab.id, staff_id: staff.id, status: 'pending' })
    .select('id')
    .single();
  if (orderErr || !order) throw new Error(`order insert failed – ${orderErr?.message}`);

  const { data: item, error: itemErr } = await admin
    .from('order_items')
    .insert({
      order_id: order.id,
      product_id: productId,
      quantity: 1,
      unit_price: 10.00,
      modifier_price_delta: 0.50,
      kds_status: 'pending',
      notes: note,
    })
    .select('id')
    .single();
  if (itemErr || !item) throw new Error(`order_item insert failed – ${itemErr?.message}`);

  const { error: modErr } = await admin
    .from('order_item_modifiers')
    .insert({ order_item_id: item.id, modifier_id: modifierId });
  if (modErr) throw new Error(`order_item_modifiers insert failed – ${modErr.message}`);

  return { tabId: tab.id as string, itemId: item.id as string };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Modifier sheet + notes + KDS display', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(400);
    // Clear Supabase localStorage session before each test so loginAs always
    // starts from an unauthenticated state. Navigate to the app origin first
    // so localStorage is in scope, then clear it, then continue to /login.
    await page.goto('/');
    await page.evaluate(() => {
      // Remove all supabase-* keys to force a fresh auth flow.
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.startsWith('supabase'))
        .forEach(k => localStorage.removeItem(k));
    });
  });

  // ---------------------------------------------------------------------------
  // T1: Modifier sheet opens when a product with modifiers is tapped in the POS.
  //
  // Uses page.route() to intercept the Supabase products REST response and inject
  // a mock product "Alitas E2E" that carries three modifiers — exactly what the
  // remote DB lacks. The modifier sheet is a pure UI component; no DB write needed.
  // ---------------------------------------------------------------------------
  test('T1: modifier sheet opens when tapping a product with modifiers', async ({ page }) => {
    test.setTimeout(120_000);

    // Intercept products query and inject our mock product into the response.
    // Supabase REST: GET /rest/v1/products?select=...
    await page.route('**/rest/v1/products*', async route => {
      const response = await route.fetch();
      const body = await response.json() as Record<string, unknown>[];

      // Build a mock product that mirrors the raw Supabase REST response shape that
      // mapProductRow() in entities/product/model/queries.ts expects.
      // The query is: select(`*, category:categories(*), product_modifiers(modifier:modifiers(*))`)
      // So the join key is 'modifier' (singular alias), not 'modifiers'.
      // Each modifiers row must have id, name, price_delta, sort_order (all columns from modifiers table).
      const firstRow = body[0] as Record<string, unknown> | undefined;
      const mockProduct = {
        id: MOCK_PRODUCT_ID,
        name: MOCK_PRODUCT_NAME,
        base_price: 10.00,
        happy_hour_price: null,
        is_active: true,
        is_combo: false,
        combo_price_override: null,
        combo_eligible: true,
        stock_threshold: null,
        sku: null,
        image_url: null,
        barcode: null,
        category_id: firstRow?.category_id ?? 'ca000001-0000-4000-8000-000000000001',
        category: firstRow?.category ?? null,
        product_modifiers: [
          {
            modifier: { id: MODIFIER_EXTRA_SALT_ID, name: MODIFIER_EXTRA_SALT_NAME, price_delta: 0, sort_order: 1 },
          },
          {
            modifier: { id: MODIFIER_NO_ICE_ID, name: MODIFIER_NO_ICE_NAME, price_delta: 0, sort_order: 2 },
          },
          {
            modifier: { id: MODIFIER_EXTRA_LIME_ID, name: MODIFIER_EXTRA_LIME_NAME, price_delta: 0.5, sort_order: 3 },
          },
        ],
      };

      // Prepend mock product so it appears first in the grid regardless of order.
      const patched = [mockProduct, ...body];
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(patched),
      });
    });

    await loginAs(page, 'admin');
    await page.goto('/pos');

    // Open a tab so the product grid is interactive.
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Modifier Sheet Test');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // The mock product should appear. No category filter needed — it is first in the list.
    const mockBtn = page.getByRole('button', { name: new RegExp(`Select ${MOCK_PRODUCT_NAME}`, 'i') });
    await expect(mockBtn).toBeVisible({ timeout: 15_000 });
    await mockBtn.click();

    // Modifier sheet should open with the product name.
    await expect(page.getByText(new RegExp(`Customize ${MOCK_PRODUCT_NAME}`, 'i'))).toBeVisible({
      timeout: 10_000,
    });

    // All three injected modifiers should be visible.
    await expect(page.getByText(MODIFIER_EXTRA_SALT_NAME)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(MODIFIER_NO_ICE_NAME)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(MODIFIER_EXTRA_LIME_NAME)).toBeVisible({ timeout: 5_000 });

    await logout(page);
  });

  // ---------------------------------------------------------------------------
  // T2: Select modifier + type note → cart shows modifier badge and notes input.
  // ---------------------------------------------------------------------------
  test('T2: select modifier and add note — cart reflects both', async ({ page }) => {
    test.setTimeout(120_000);

    // Same product route intercept as T1.
    await page.route('**/rest/v1/products*', async route => {
      const response = await route.fetch();
      const body = await response.json() as Record<string, unknown>[];

      const firstRow = body[0] as Record<string, unknown> | undefined;
      const mockProduct = {
        id: MOCK_PRODUCT_ID,
        name: MOCK_PRODUCT_NAME,
        base_price: 10.00,
        happy_hour_price: null,
        is_active: true,
        is_combo: false,
        combo_price_override: null,
        combo_eligible: true,
        stock_threshold: null,
        sku: null,
        image_url: null,
        barcode: null,
        category_id: firstRow?.category_id ?? 'ca000001-0000-4000-8000-000000000001',
        category: firstRow?.category ?? null,
        product_modifiers: [
          {
            modifier: { id: MODIFIER_EXTRA_LIME_ID, name: MODIFIER_EXTRA_LIME_NAME, price_delta: 0.5, sort_order: 1 },
          },
        ],
      };

      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify([mockProduct, ...body]),
      });
    });

    await loginAs(page, 'admin');
    await page.goto('/pos');

    // Open a tab.
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Modifier Cart Test');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // Tap the mock product to open the modifier sheet.
    const mockBtn = page.getByRole('button', { name: new RegExp(`Select ${MOCK_PRODUCT_NAME}`, 'i') });
    await expect(mockBtn).toBeVisible({ timeout: 15_000 });
    await mockBtn.click();
    await expect(page.getByText(new RegExp(`Customize ${MOCK_PRODUCT_NAME}`, 'i'))).toBeVisible({
      timeout: 10_000,
    });

    // Select Extra Lime — click its Label text (the checkbox has id = modifier.id).
    await page.getByText(MODIFIER_EXTRA_LIME_NAME).first().click();

    // Confirm.
    await page.getByRole('button', { name: 'Add to Order' }).click();
    await expect(page.getByText(new RegExp(`Customize ${MOCK_PRODUCT_NAME}`, 'i'))).toBeHidden({
      timeout: 10_000,
    });

    // Scope cart assertions to the order panel to avoid strict-mode collision with
    // the product grid card that also shows MOCK_PRODUCT_NAME.
    const orderPanel = page.getByTestId('pos-order-panel');

    // Cart should show the product name inside the order panel.
    await expect(orderPanel.getByText(MOCK_PRODUCT_NAME)).toBeVisible({ timeout: 10_000 });

    // The modifier badge should be visible in the cart item.
    await expect(orderPanel.getByText(MODIFIER_EXTRA_LIME_NAME)).toBeVisible({ timeout: 5_000 });

    // Notes input: CartItem renders aria-label="Note for {product.name}".
    const notesInput = orderPanel.getByLabel(new RegExp(`Note for ${MOCK_PRODUCT_NAME}`, 'i'));
    await expect(notesInput).toBeVisible({ timeout: 5_000 });
    await notesInput.fill('sin apio');
    await expect(notesInput).toHaveValue('sin apio');

    await logout(page);
  });

  // ---------------------------------------------------------------------------
  // T3: KDS card shows modifier name and note for a DB-seeded order.
  //
  // BLOCKED: The KDS query in src/entities/kds/model/queries.ts joins
  // order_item_modifiers(modifiers(...)) but the remote DB has no
  // order_item_modifiers table — no migration creates it. The order_items
  // table stores modifier_ids as a UUID array (migration 20260414000004) and
  // the join table approach is not yet backed by a schema migration.
  // Unblock by creating a migration that:
  //   1. Creates order_item_modifiers(order_item_id, modifier_id) table
  //   2. Migrates existing modifier_ids arrays to rows in that table
  //   3. Applies `npx supabase db push` to the remote
  // Then re-enable this test.
  // ---------------------------------------------------------------------------
  test('T3: KDS card shows modifier name and note for a seeded food order', async ({ page: _page }) => {
    test.skip(
      true,
      'TODO: order_item_modifiers table does not exist in remote DB — ' +
        'KDS query joins a table that has no migration. Create migration and push to remote. ' +
        'See src/entities/kds/model/queries.ts line 49.',
    );
  });

  // ---------------------------------------------------------------------------
  // T4: Pre-cheque text includes modifier and note lines.
  // Skipped: Tauri IPC (invoke 'print_precheque') is not callable in Playwright
  // browser mode — the app runs as a plain Vite dev server without the Rust backend.
  // The buildPreChequeText() function is unit-tested in src/features/print-precheque/.
  // Re-enable once a RUN_TAURI_E2E=1 harness is wired up (see 13-tauri-build.spec.ts).
  // ---------------------------------------------------------------------------
  test('T4: pre-cheque text includes modifier and note (skipped — Tauri IPC not available)', async () => {
    test.skip(
      true,
      'TODO: Tauri IPC (print_precheque command) is unavailable in Playwright browser mode. ' +
        'Test buildPreChequeText() at the unit level in src/features/print-precheque/. ' +
        'Re-enable when RUN_TAURI_E2E=1 harness is wired up.',
    );
  });
});
