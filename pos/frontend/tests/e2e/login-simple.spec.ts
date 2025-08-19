import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

test.describe('Login Basic Test', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Go to login page
    await page.goto(`${APP_URL}/login`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    // Check if we're still on login page (indicates error) or redirected
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);
    
    // If still on login page, check for error message
    if (currentUrl.includes('/login')) {
      const errorElement = await page.locator('text=/error|invalid|failed/i').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('Login error message:', errorText);
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'login-error.png' });
    } else {
      console.log('Login successful - redirected to:', currentUrl);
    }
    
    // The test passes if we get redirected away from login
    await expect(page).not.toHaveURL(`${APP_URL}/login`);
  });
});
