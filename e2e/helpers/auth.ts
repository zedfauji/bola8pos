import { expect, type Page } from '@playwright/test';

export type StaffRole = 'bartender' | 'manager' | 'admin';

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env: ${key} (set in bar-pos/.env.local)`);
  }
  return v.trim();
}

function staffForRole(role: StaffRole): { name: string; pin: string } {
  if (role === 'bartender') {
    return { name: envOrThrow('E2E_BARTENDER_NAME'), pin: envOrThrow('E2E_BARTENDER_PIN') };
  }
  if (role === 'manager') {
    return { name: envOrThrow('E2E_MANAGER_NAME'), pin: envOrThrow('E2E_MANAGER_PIN') };
  }
  return { name: envOrThrow('E2E_ADMIN_NAME'), pin: envOrThrow('E2E_ADMIN_PIN') };
}

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    await page.getByRole('button', { name: label }).click();
  }
}

/** PIN login for an explicit staff name/PIN (e.g. second bartender). */
export async function loginAsNamed(page: Page, name: string, pin: string): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /who are you/i })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }).click();

  await expect(page.getByRole('heading', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })).toBeVisible({
    timeout: 15_000,
  });
  await enterPin(page, pin);

  const openingDialog = page.getByRole('alertdialog', { name: /opening cash/i });
  const opened = await openingDialog
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (opened) {
    const drawerInput = page.getByLabel(/drawer float/i);
    await expect(drawerInput).toBeVisible({ timeout: 10_000 });
    await drawerInput.fill('0');
    await page.getByRole('button', { name: 'Start shift' }).click();
  }

  await expect(page).toHaveURL(/\/home(?:\/)?$/, { timeout: 45_000 });
}

/**
 * PIN login: staff grid → PIN keypad (Key 0–9) → optional opening-cash shift start → /home.
 */
export async function loginAs(page: Page, role: StaffRole): Promise<void> {
  const { name, pin } = staffForRole(role);
  await loginAsNamed(page, name, pin);
}

export async function logout(page: Page): Promise<void> {
  // Dismiss any open dialog that might block the Logout button
  const dialog = page.getByRole('alertdialog');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (dialogVisible) {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
  }

  // Logout button only lives on /home — navigate there if not already there
  if (!page.url().includes('/home')) {
    await page.goto('/home');
  }

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
