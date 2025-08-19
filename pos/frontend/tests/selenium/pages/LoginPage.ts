import { WebDriver, By, until, WebElement } from 'selenium-webdriver';

export class LoginPage {
  constructor(private driver: WebDriver) {}

  async navigateTo() {
    console.log('Navigating to login page...');
    await this.driver.get('http://localhost:5173/login');
    
    // Wait for the document to be interactive
    await this.driver.wait(
      async () => {
        const readyState = await this.driver.executeScript('return document.readyState');
        return readyState === 'complete';
      },
      10000,
      'Page did not load completely'
    );
    
    console.log('Page loaded, looking for login form...');
    
    // Try to find the login form with multiple selectors
    const formSelectors = [
      'form',
      'form[class*="login"]',
      'form[class*="auth"]',
      'form[class*="signin"]',
      'form[data-testid*="login"]',
      'form[data-testid*="auth"]',
      'form[data-test*="login"]',
      'form[data-test*="auth"]',
      'div[class*="login"] form',
      'div[class*="auth"] form',
      'div[data-testid*="login"] form',
      'div[data-test*="login"] form'
    ];
    
    let loginForm;
    for (const selector of formSelectors) {
      try {
        console.log(`Trying form selector: ${selector}`);
        loginForm = await this.driver.wait(
          until.elementLocated(By.css(selector)),
          2000
        );
        if (loginForm) {
          console.log(`Found form with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Ignore and try next selector
      }
    }
    
    if (!loginForm) {
      console.error('Could not find login form with any selector');
      await this.takeScreenshot('login-form-not-found');
      throw new Error('Login form not found');
    }
    
    // Wait for email input with multiple possible selectors
    const emailSelectors = [
      'input[type="email"]',
      'input[id*="email"]',
      'input[name*="email"]',
      'input[placeholder*="email" i]',
      'input[data-test*="email"]',
      'input[data-testid*="email"]'
    ];
    
    for (const selector of emailSelectors) {
      try {
        await this.driver.wait(
          until.elementLocated(By.css(selector)),
          2000
        );
        console.log(`Found email input with selector: ${selector}`);
        return; // Success!
      } catch (e) {
        // Ignore and try next selector
      }
    }
    
    // If we get here, no email input was found
    await this.takeScreenshot('email-input-not-found');
    throw new Error('Could not find email input with any selector');
  }
  
  private async takeScreenshot(name: string): Promise<void> {
    try {
      const screenshot = await this.driver.takeScreenshot();
      const fs = require('fs');
      const path = require('path');
      
      const dir = path.join(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filePath = path.join(dir, `${name}-${Date.now()}.png`);
      fs.writeFileSync(filePath, screenshot, 'base64');
      console.log(`Screenshot saved to: ${filePath}`);
    } catch (e) {
      console.error('Failed to take screenshot:', e);
    }
  }

  async login(email: string, password: string) {
    console.log('Attempting to log in...');
    
    // Find email input with multiple possible selectors
    const emailSelectors = [
      'input[type="email"]',
      'input[id*="email"]',
      'input[name*="email"]',
      'input[placeholder*="email" i]',
      'input[data-test*="email"]',
      'input[data-testid*="email"]'
    ];
    
    // Find password input with multiple possible selectors
    const passwordSelectors = [
      'input[type="password"]',
      'input[id*="password"]',
      'input[name*="password"]',
      'input[placeholder*="password" i]',
      'input[data-test*="password"]',
      'input[data-testid*="password"]'
    ];
    
    // Find submit button with multiple possible selectors
    const buttonSelectors = [
      'button[type="submit"]',
      'button[type="button"]',
      'button[class*="login"]',
      'button[class*="submit"]',
      'button[data-test*="login"]',
      'button[data-testid*="login"]',
      'button:contains("Login")',
      'button:contains("Sign In")',
      'button:contains("Log In")'
    ];
    
    // Find and fill email
    const emailInput = await this.findElementWithSelectors(emailSelectors, 'email input');
    await emailInput.clear();
    await emailInput.sendKeys(email);
    console.log('Entered email');
    
    // Find and fill password
    const passwordInput = await this.findElementWithSelectors(passwordSelectors, 'password input');
    await passwordInput.clear();
    await passwordInput.sendKeys(password);
    console.log('Entered password');
    
    // Find and click login button
    const loginButton = await this.findElementWithSelectors(buttonSelectors, 'login button');
    await loginButton.click();
    console.log('Clicked login button');

    // Wait for navigation to complete (either dashboard or tables)
    console.log('Waiting for navigation after login...');
    try {
      await this.driver.wait(
        async () => {
          const currentUrl = await this.driver.getCurrentUrl();
          return currentUrl.includes('/dashboard') || currentUrl.includes('/tables');
        },
        15000,
        'Did not navigate to dashboard or tables after login'
      );
      console.log('Successfully navigated after login');
    } catch (error) {
      console.error('Error during login navigation:', error);
      await this.takeScreenshot('login-navigation-error');
      throw error;
    }
  }
  
  private async findElementWithSelectors(selectors: string[], elementName: string): Promise<WebElement> {
    for (const selector of selectors) {
      try {
        const element = await this.driver.wait(
          until.elementLocated(By.css(selector)),
          2000
        );
        if (element) {
          console.log(`Found ${elementName} with selector: ${selector}`);
          await this.driver.wait(until.elementIsVisible(element), 2000);
          return element;
        }
      } catch (e) {
        // Ignore and try next selector
      }
    }
    
    const error = new Error(`Could not find ${elementName} with any selector`);
    console.error(error.message);
    await this.takeScreenshot(`element-not-found-${elementName.replace(/\s+/g, '-')}`);
    throw error;
  }
}
