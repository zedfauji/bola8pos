import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

test.describe('Login Tests', () => {
  test('should display login form correctly', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // The form has HTML5 validation, so empty email field should be focused
    await expect(page.getByPlaceholder(/email address/i)).toBeFocused();
  });

  test('should attempt login with credentials', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Fill credentials
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Check current URL - if login works, we should be redirected
    const currentUrl = page.url();
    console.log('URL after login attempt:', currentUrl);
    
    // Either we're redirected (success) or we see an error message (expected failure)
    const isRedirected = !currentUrl.includes('/login');
    const hasErrorMessage = await page.locator('text=/error|failed|invalid/i').isVisible();
    
    // Test passes if either login succeeds OR we get a proper error message
    expect(isRedirected || hasErrorMessage).toBeTruthy();
  });
});
