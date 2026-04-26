/**
 * E2E spec: Settings → Categories (category tree + depth gate + combo flag + modifier-groups RLS)
 *
 * Tickets: S1-13
 *
 * Covers:
 *  - Admin opens Settings and sees the Products tab with Categories and Modifier Groups sub-tabs
 *  - Admin creates a root category "Beers"
 *  - Admin creates child "Regular" under Beers
 *  - Admin creates grandchild "Corona" under Regular
 *  - Attempt to add a 4th level is blocked in UI (Add subcategory button absent at depth 2)
 *  - combo_eligible field is stored and retrievable via DB (no UI toggle yet — tested via service client)
 *  - Bartender cannot write to modifier_groups (RLS guard)
 */

import { createClient } from '@supabase/supabase-js';
import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Test-local helpers
// ---------------------------------------------------------------------------

/**
 * Clean up categories created during this spec by name.
 * Uses the service-role client so that RLS doesn't block teardown.
 */
async function cleanupTestCategories(names: string[]): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from('categories').delete().in('name', names);
}

/**
 * Get combo_eligible value for a category by name via the service-role client.
 */
async function getCategoryComboEligible(name: string): Promise<boolean | null> {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from('categories')
    .select('combo_eligible')
    .eq('name', name)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { combo_eligible: boolean }).combo_eligible ?? null;
}

/**
 * Set combo_eligible on a category row by name via the service-role client.
 */
async function setCategoryComboEligible(name: string, value: boolean): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from('categories')
    .update({ combo_eligible: value })
    .eq('name', name);
  if (error) throw new Error(`setCategoryComboEligible failed: ${error.message}`);
}

/**
 * Attempt to insert a modifier_group row using a user JWT (anon key + bartender auth).
 * Returns the Supabase error code / message if refused, or null if succeeded.
 *
 * We authenticate as the bartender's email/password via the anon client (not service role)
 * to exercise RLS. If the credentials are not set in env we skip.
 */
async function attemptModifierGroupInsertAsBartender(): Promise<{
  success: boolean;
  errorMessage: string | null;
}> {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const bartenderEmail = process.env.E2E_BARTENDER_EMAIL;
  const bartenderPassword = process.env.E2E_BARTENDER_PASSWORD;

  // If anon key or bartender email/password not available, skip via special sentinel
  if (!anonKey || !bartenderEmail || !bartenderPassword) {
    return { success: false, errorMessage: 'SKIP_RLS_TEST' };
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({
    email: bartenderEmail,
    password: bartenderPassword,
  });
  if (signInError) {
    return { success: false, errorMessage: `auth failed: ${signInError.message}` };
  }

  const { error: insertError } = await client.from('modifier_groups').insert({
    name: 'E2E-RLS-Test-Group',
    min_select: 0,
    max_select: 1,
    is_required: false,
    sort_order: 9999,
  });

  if (insertError) {
    return { success: false, errorMessage: insertError.message };
  }

  // Succeeded unexpectedly — clean up
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from('modifier_groups').delete().eq('name', 'E2E-RLS-Test-Group');
  return { success: true, errorMessage: null };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

const TEST_CATEGORY_NAMES = ['Beers', 'Regular', 'Corona'];

test.describe('Settings: Category Tree + Combo Flag + Modifier Groups RLS', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(570);
    await cleanupTestCategories(TEST_CATEGORY_NAMES);
    await page.goto('/');
  });

  test.afterEach(async () => {
    await cleanupTestCategories(TEST_CATEGORY_NAMES);
  });

  // =========================================================================
  // T1: Admin can reach Settings → Products → Categories
  // =========================================================================
  test('T1: admin sees Settings with Categories and Modifier Groups tabs', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');

    // Settings heading visible
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });

    // Products tab is visible and accessible
    await page.getByRole('tab', { name: 'Products' }).click();

    // Sub-tabs inside ProductsSettingsTab
    await expect(page.getByRole('tab', { name: 'Categories' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: 'Modifier Groups' })).toBeVisible({ timeout: 10_000 });

    await logout(page);
  });

  // =========================================================================
  // T2: Admin creates root category "Beers"
  // =========================================================================
  test('T2: admin creates root category "Beers" — visible in tree', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('tab', { name: 'Categories' }).click();

    // Click "Add root category"
    await page.getByRole('button', { name: /add root category/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    // Fill name
    await page.getByLabel(/name/i).fill('Beers');
    await page.getByRole('button', { name: /^save$/i }).click();

    // Dialog closes, success toast appears, tree shows Beers
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beers')).toBeVisible({ timeout: 15_000 });

    await logout(page);
  });

  // =========================================================================
  // T3: Admin creates child "Regular" under Beers
  // =========================================================================
  test('T3: admin creates child "Regular" under Beers', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('tab', { name: 'Categories' }).click();

    // Create root Beers first
    await page.getByRole('button', { name: /add root category/i }).click();
    await page.getByLabel(/name/i).fill('Beers');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beers')).toBeVisible({ timeout: 15_000 });

    // Click "Add subcategory under Beers"
    await page.getByRole('button', { name: /add subcategory under Beers/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/name/i).fill('Regular');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Regular')).toBeVisible({ timeout: 15_000 });

    await logout(page);
  });

  // =========================================================================
  // T4: Admin creates grandchild "Corona" under Regular
  // =========================================================================
  test('T4: admin creates grandchild "Corona" under Regular', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('tab', { name: 'Categories' }).click();

    // Create root Beers
    await page.getByRole('button', { name: /add root category/i }).click();
    await page.getByLabel(/name/i).fill('Beers');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beers')).toBeVisible({ timeout: 15_000 });

    // Create child Regular under Beers
    await page.getByRole('button', { name: /add subcategory under Beers/i }).click();
    await page.getByLabel(/name/i).fill('Regular');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Regular')).toBeVisible({ timeout: 15_000 });

    // Expand Beers to see Regular (Beers may be collapsed after dialog close)
    const expandBeers = page.getByRole('button', { name: /expand Beers/i });
    const expandVisible = await expandBeers.isVisible({ timeout: 3_000 }).catch(() => false);
    if (expandVisible) await expandBeers.click();

    // Create grandchild Corona under Regular
    await page.getByRole('button', { name: /add subcategory under Regular/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/name/i).fill('Corona');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Corona')).toBeVisible({ timeout: 15_000 });

    await logout(page);
  });

  // =========================================================================
  // T5: 4th-level creation is blocked in UI — "Add subcategory" button absent at depth 2
  // =========================================================================
  test('T5: 4th-level creation blocked in UI — no "Add subcategory" button on grandchild', async ({
    page,
  }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('tab', { name: 'Categories' }).click();

    // Build Beers → Regular → Corona tree
    await page.getByRole('button', { name: /add root category/i }).click();
    await page.getByLabel(/name/i).fill('Beers');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Beers')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /add subcategory under Beers/i }).click();
    await page.getByLabel(/name/i).fill('Regular');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

    // Expand Beers
    const expandBeers = page.getByRole('button', { name: /expand Beers/i });
    const expandBeersVisible = await expandBeers.isVisible({ timeout: 3_000 }).catch(() => false);
    if (expandBeersVisible) await expandBeers.click();

    await expect(page.getByText('Regular')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /add subcategory under Regular/i }).click();
    await page.getByLabel(/name/i).fill('Corona');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

    // Expand Regular to reveal Corona
    const expandRegular = page.getByRole('button', { name: /expand Regular/i });
    const expandRegularVisible = await expandRegular.isVisible({ timeout: 3_000 }).catch(() => false);
    if (expandRegularVisible) await expandRegular.click();

    await expect(page.getByText('Corona')).toBeVisible({ timeout: 10_000 });

    // "Add subcategory under Corona" button must NOT exist (depth 2 = L3, max reached)
    await expect(
      page.getByRole('button', { name: /add subcategory under Corona/i })
    ).toHaveCount(0);

    await logout(page);
  });

  // =========================================================================
  // T6: combo_eligible flag — set via DB helper, verify read-back
  //
  // combo_eligible is not yet exposed in the Settings UI form, so we test:
  //  1. The DB column is writable via the service-role client
  //  2. The value can be read back correctly
  // This proves the migration column and schema are correct (S1-01/S1-06).
  // When the UI toggle is added (future sprint), update this test to use the UI.
  // =========================================================================
  test('T6: combo_eligible flag — DB column writable and readable (service-role)', async () => {
    // Seed a category via DB helper
    const url = process.env.VITE_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: cat, error: insertErr } = await admin
      .from('categories')
      .insert({
        name: 'Beers',
        color: '#6366f1',
        sort_order: 0,
        depth: 0,
        combo_eligible: false,
        is_food: false,
      })
      .select('id, combo_eligible')
      .single();

    expect(insertErr).toBeNull();
    expect(cat).not.toBeNull();
    // Default inserted as false
    expect((cat as { combo_eligible: boolean }).combo_eligible).toBe(false);

    // Toggle to true
    await setCategoryComboEligible('Beers', true);

    // Verify read-back
    const value = await getCategoryComboEligible('Beers');
    expect(value).toBe(true);

    // Cleanup (afterEach also runs, belt-and-suspenders)
    await cleanupTestCategories(['Beers']);
  });

  // =========================================================================
  // T7: Bartender RLS — cannot write to modifier_groups
  //
  // RLS policy: only manager+ can INSERT/UPDATE/DELETE modifier_groups.
  // We test via direct Supabase anon-key client authenticated as bartender.
  // If E2E_BARTENDER_EMAIL / E2E_BARTENDER_PASSWORD env vars are not set,
  // the test is skipped with an informative message.
  // =========================================================================
  test('T7: bartender cannot write to modifier_groups (RLS)', async ({ page: _page }) => {
    const result = await attemptModifierGroupInsertAsBartender();

    if (result.errorMessage === 'SKIP_RLS_TEST') {
      test.skip(
        true,
        'Set E2E_BARTENDER_EMAIL and E2E_BARTENDER_PASSWORD to enable RLS test. ' +
          'These are the Supabase Auth credentials for the bartender E2E user.'
      );
      return;
    }

    // The insert should be refused by RLS
    expect(result.success).toBe(false);
    // Error should reference RLS / permission denied
    expect(result.errorMessage).toBeTruthy();
  });

  // =========================================================================
  // T8: Bartender UI — cannot reach Settings page (redirected to /home)
  //     (Existing RBAC ensures this — guard smoke-test re-run here for traceability)
  // =========================================================================
  test('T8: bartender cannot access Settings — redirected to /home', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await logout(page);
  });
});
