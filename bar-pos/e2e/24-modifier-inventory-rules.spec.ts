import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient } from './helpers/supabase';

const MODIFIER_NAME = 'Extra Lime';
const INGREDIENT_SEARCH = 'Lime';

async function clearRulesForModifier(): Promise<void> {
  const admin = getServiceClient();
  const { data: modifier } = await admin
    .from('modifiers')
    .select('id')
    .eq('name', MODIFIER_NAME)
    .single();
  if (modifier) {
    await admin.from('modifier_inventory_rules').delete().eq('modifier_id', modifier.id);
  }
}

test.describe('Phase 17 — Modifier ingredient rules (admin UI)', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await clearRulesForModifier();
    await page.goto('/');
  });

  test('manager adds signed-delta ingredient rules, saves, and reopens with round-trip intact', async ({
    page,
  }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Products' }).click();
    await page.getByRole('tab', { name: 'Modifiers' }).click();

    const row = page.locator('li').filter({ hasText: MODIFIER_NAME });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Ingredient rules' }).click();

    const dialog = page.getByRole('dialog', { name: `Ingredient rules — ${MODIFIER_NAME}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('No ingredient rules yet')).toBeVisible();

    // Row 1: positive delta
    await dialog.getByRole('button', { name: '+ Add ingredient' }).click();
    await dialog.getByRole('combobox', { name: 'Select ingredient' }).first().click();
    await page.getByPlaceholder('Search ingredients…').fill(INGREDIENT_SEARCH);
    await page.getByRole('option', { name: new RegExp(INGREDIENT_SEARCH, 'i') }).first().click();
    await dialog.getByLabel('Delta').first().fill('2');

    // Row 2: negative delta (Pitfall 3 regression guard — must NOT clamp to 0)
    // Row 1's combobox relabels to "Selected: Lime" once chosen, so only row 2's
    // combobox still matches "Select ingredient" — .first() is correct here.
    await dialog.getByRole('button', { name: '+ Add ingredient' }).click();
    await dialog.getByRole('combobox', { name: 'Select ingredient' }).first().click();
    await page.getByPlaceholder('Search ingredients…').fill('Salsa');
    await page.getByRole('option', { name: /Salsa Mexicana/i }).click();
    await dialog.getByLabel('Delta').nth(1).fill('-1');

    await dialog.getByRole('button', { name: 'Save rules' }).click();
    await expect(page.getByText('Ingredient rules saved')).toBeVisible({ timeout: 10_000 });
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Reopen — confirm both rows persisted, negative value round-tripped (not 0).
    // Rows are located by which ingredient they hold, not by index — the DB row
    // order returned by the entity query is not guaranteed to match insertion
    // order (both rows can share a created_at timestamp within one batch insert),
    // so asserting on position would be flaky.
    await row.getByRole('button', { name: 'Ingredient rules' }).click();
    const reopened = page.getByRole('dialog', { name: `Ingredient rules — ${MODIFIER_NAME}` });
    await expect(reopened).toBeVisible();
    const deltaInputs = reopened.getByLabel('Delta');
    await expect(deltaInputs).toHaveCount(2, { timeout: 10_000 });

    // Combobox[i] and Delta[i] are always siblings within the same row (repeated
    // block), so positional pairing across the two lists is safe even though the
    // row order itself (relative to insertion) is not guaranteed.
    const comboboxes = reopened.getByRole('combobox');
    const rowCount = await deltaInputs.count();
    const byIngredient: Record<string, string> = {};
    for (let i = 0; i < rowCount; i++) {
      const ariaLabel = await comboboxes.nth(i).getAttribute('aria-label');
      const value = await deltaInputs.nth(i).inputValue();
      byIngredient[ariaLabel ?? ''] = value;
    }
    expect(byIngredient['Selected: Lime']).toBe('2');
    expect(byIngredient['Selected: Salsa Mexicana']).toBe('-1');

    // Save button gating: unmodified reopened state is clean → disabled
    await expect(reopened.getByRole('button', { name: 'Save rules' })).toBeDisabled();

    // Row remove
    await reopened.getByRole('button', { name: 'Remove ingredient rule row' }).first().click();
    await expect(reopened.getByLabel('Delta')).toHaveCount(1);
    await expect(reopened.getByRole('button', { name: 'Save rules' })).toBeEnabled();

    await reopened.getByRole('button', { name: 'Cancel' }).click();
    await expect(reopened).not.toBeVisible({ timeout: 5_000 });

    await logout(page);
  });
});
