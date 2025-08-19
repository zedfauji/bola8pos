import { BaseTest } from '../base/BaseTest';
import { WebDriverHelper } from '../utils/WebDriverHelper';

// Import Jest types
import { describe, beforeAll, afterAll, afterEach, test, expect } from '@jest/globals';

// Extend the Jest expect types
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeTruthy(): R;
      toContain(text: string): R;
    }
  }
}

class LoginTest extends BaseTest {
  // Make driverHelper public for test file access
  public driverHelper = WebDriverHelper.getInstance();
  
  async testSuccessfulLogin() {
    try {
      // Navigate to login page
      await this.driverHelper.navigateTo(`${this.getBaseUrl()}/login`);
      
      // Wait for and fill in the login form
      // Use known default admin credentials
      await this.driverHelper.waitForElementAndType('input[name="email"]', 'admin@billiardpos.com');
      await this.driverHelper.waitForElementAndType('input[name="password"]', 'password');
      
      // Click login button
      await this.driverHelper.waitForElementAndClick('button[type="submit"]');
      
      // Verify successful login by waiting for URL to contain /dashboard
      const driver = await this.driverHelper.getDriver();
      const { until } = await import('selenium-webdriver');
      await driver.wait(until.urlContains('/dashboard'), 10000);
      
      // Take a screenshot for debugging
      await this.takeScreenshot('after-login');
    } catch (error) {
      await this.takeScreenshot('login-test-error');
      throw error;
    }
  }
  
  async testInvalidLogin() {
    try {
      await this.driverHelper.navigateTo(`${this.getBaseUrl()}/login`);
      
      // Fill in with invalid credentials
      await this.driverHelper.waitForElementAndType('input[name="email"]', 'wronguser');
      await this.driverHelper.waitForElementAndType('input[name="password"]', 'wrongpass');
      await this.driverHelper.waitForElementAndClick('button[type="submit"]');
      
      // Verify error message is displayed (rendered in a red alert paragraph)
      const errorText = await this.driverHelper.getElementText('.text-red-700');
      expect(errorText).toBeTruthy();
      
      await this.takeScreenshot('failed-login');
    } catch (error) {
      await this.takeScreenshot('invalid-login-test-error');
      throw error;
    }
  }

  // Helper method to access protected baseUrl
  public getBaseUrl(): string {
    // @ts-ignore - Accessing protected member
    return this.baseUrl;
  }
}

// Export test functions for Jest
describe('Login Tests', () => {
  const loginTest = new LoginTest();
  
  beforeAll(async () => {
    await loginTest.beforeAll();
  });
  
  afterAll(async () => {
    await loginTest.afterAll();
  });
  
  afterEach(async () => {
    try {
      // Faster cleanup: clear cookies and storage instead of navigating
      const driver = await loginTest.driverHelper.getDriver();
      await driver.manage().deleteAllCookies();
      try {
        await driver.executeScript('window.localStorage && localStorage.clear(); window.sessionStorage && sessionStorage.clear();');
      } catch {}
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  });

  test('should login successfully with valid credentials', async () => {
    await loginTest.testSuccessfulLogin();
  }, 60000); // 60 second timeout
  
  test('should show error with invalid credentials', async () => {
    await loginTest.testInvalidLogin();
  }, 60000); // 60 second timeout
});
