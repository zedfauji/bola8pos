import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

test.describe('Login Debug', () => {
  test('debug login process', async ({ page }) => {
    // Listen to console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    
    // Listen to network requests
    page.on('request', request => {
      if (request.url().includes('login')) {
        console.log('LOGIN REQUEST:', request.method(), request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('login')) {
        console.log('LOGIN RESPONSE:', response.status(), response.url());
      }
    });
    
    // Go to login page
    await page.goto(`${APP_URL}/login`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    console.log('Page loaded, filling form...');
    
    // Fill login form
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    
    console.log('Form filled, clicking submit...');
    
    // Submit form and wait for network activity
    await Promise.all([
      page.waitForResponse(response => response.url().includes('login')),
      page.getByRole('button', { name: /sign in/i }).click()
    ]);
    
    console.log('Login request completed');
    
    // Wait a bit for any redirects
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('Final URL:', currentUrl);
    
    // Check for any error messages
    const errorElements = await page.locator('[class*="error"], [class*="red"], text=/error|invalid|failed/i').all();
    for (const element of errorElements) {
      if (await element.isVisible()) {
        const text = await element.textContent();
        console.log('Error message found:', text);
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'login-debug.png', fullPage: true });
  });
});
