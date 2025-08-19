import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:5173';
const API_BASE = 'https://localhost:3001';

test.describe('Login Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Accept self-signed certificate
    await page.goto(APP_URL);
  });

  test('should display login form', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Try to submit without filling fields
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show validation error message
    await expect(page.getByText(/please enter both email and password/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Fill with invalid credentials
    await page.getByPlaceholder(/email address/i).fill('invalid@test.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/failed to log in/i)).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    
    // Fill with valid admin credentials
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    
    // Submit login form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard or main app
    await expect(page).toHaveURL(`${APP_URL}/dashboard`, { timeout: 15000 });
    
    // Should see authenticated content (dashboard, navigation, etc.)
    await expect(page.getByText(/dashboard/i).or(page.getByText(/welcome/i)).or(page.getByRole('navigation'))).toBeVisible({ timeout: 10000 });
  });

  test('should maintain session after login', async ({ page }) => {
    // Login first
    await page.goto(`${APP_URL}/login`);
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for successful login
    await expect(page).toHaveURL(new RegExp(`${APP_URL}(?!/login)`), { timeout: 15000 });
    
    // Refresh the page
    await page.reload();
    
    // Should still be logged in (not redirected to login)
    await expect(page).not.toHaveURL(`${APP_URL}/login`);
  });

  test('should be able to logout', async ({ page }) => {
    // Login first
    await page.goto(`${APP_URL}/login`);
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for successful login
    await expect(page).toHaveURL(new RegExp(`${APP_URL}(?!/login)`), { timeout: 15000 });
    
    // Find and click logout button/link
    const logoutButton = page.getByRole('button', { name: /logout/i })
      .or(page.getByRole('link', { name: /logout/i }))
      .or(page.getByText(/logout/i))
      .or(page.getByText(/sign out/i));
    
    await logoutButton.click();
    
    // Should redirect to login page
    await expect(page).toHaveURL(`${APP_URL}/login`, { timeout: 10000 });
  });

  test('should handle API authentication correctly', async ({ page }) => {
    // Login first
    await page.goto(`${APP_URL}/login`);
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for successful login
    await expect(page).toHaveURL(new RegExp(`${APP_URL}(?!/login)`), { timeout: 15000 });
    
    // Check that localStorage has access token
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
    
    // Navigate to a page that requires API calls (like tables or dashboard)
    const tablesLink = page.getByRole('link', { name: /table/i })
      .or(page.getByText(/table/i))
      .or(page.getByRole('navigation').getByText(/table/i));
    
    if (await tablesLink.isVisible()) {
      await tablesLink.click();
      // Should not get redirected back to login due to API errors
      await expect(page).not.toHaveURL(`${APP_URL}/login`);
    }
  });

  test('should handle refresh token correctly', async ({ page }) => {
    // Login first
    await page.goto(`${APP_URL}/login`);
    await page.getByPlaceholder(/email address/i).fill('admin@billiardpos.com');
    await page.getByPlaceholder(/password/i).fill('Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for successful login
    await expect(page).toHaveURL(new RegExp(`${APP_URL}(?!/login)`), { timeout: 15000 });
    
    // Clear access token to simulate expiration
    await page.evaluate(() => localStorage.removeItem('accessToken'));
    
    // Make an API call that should trigger refresh
    await page.reload();
    
    // Should still be authenticated (refresh token should work)
    await expect(page).not.toHaveURL(`${APP_URL}/login`, { timeout: 10000 });
  });
});
