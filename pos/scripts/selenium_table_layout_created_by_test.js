// Selenium test for verifying created_by field in table layouts
// Usage:
//   FRONTEND_URL=http://localhost:5173 node pos/scripts/selenium_table_layout_created_by_test.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Builder, By, until, logging, Origin } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Helper function to create output directory
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Create a timestamped output directory
const outDir = ensureDir(path.join(__dirname, '..', 'test-results', `test-${new Date().toISOString().replace(/[:.]/g, '-')}`));
const screenshot = (name) => path.join(outDir, name);

(async function run() {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const LOGIN_URL = new URL('/login', FRONTEND_URL).toString();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@billiardpos.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PIN || 'Admin@123';

  // Configure Chrome options
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

  const options = new chrome.Options()
    .addArguments('--window-size=1280,900')
    .setAcceptInsecureCerts(true);

  let driver;
  try {
    console.log('[TEST] Initializing WebDriver...');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setLoggingPrefs(prefs)
      .build();

    // 1. Login
    console.log(`[TEST] Logging in at: ${LOGIN_URL}`);
    await driver.get(LOGIN_URL);

    try {
      // Take a screenshot of the initial page load
      const initialScreenshot = await driver.takeScreenshot();
      fs.writeFileSync(screenshot('initial_page.png'), initialScreenshot, 'base64');
      console.log('[TEST] Took initial page screenshot');
      
      // Get page source for debugging
      const pageSource = await driver.getPageSource();
      fs.writeFileSync(screenshot('page_source.html'), pageSource, 'utf8');
      console.log('[TEST] Saved page source');
      
      // Try to find any form elements
      const forms = await driver.findElements(By.tagName('form'));
      console.log(`[TEST] Found ${forms.length} forms on the page`);
      
      // List all input elements
      const inputs = await driver.findElements(By.tagName('input'));
      console.log(`[TEST] Found ${inputs.length} input elements`);
      for (let i = 0; i < inputs.length; i++) {
        try {
          const type = await inputs[i].getAttribute('type');
          const name = await inputs[i].getAttribute('name') || 'no-name';
          const id = await inputs[i].getAttribute('id') || 'no-id';
          console.log(`[TEST] Input ${i + 1}: type=${type}, name=${name}, id=${id}`);
        } catch (e) {
          console.error(`[TEST] Error getting input ${i} attributes:`, e.message);
        }
      }
    
    // Try different selectors for email/password
    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[id*="email"]',
      'input[type="text"]',
      'input:first-of-type'
    ];
    
    let emailInput, passwordInput;
    
    for (const selector of emailSelectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        if (elements.length > 0) {
          emailInput = elements[0];
          console.log(`[TEST] Found email input using selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TEST] Selector ${selector} failed:`, e.message);
      }
    }
    
    if (!emailInput) {
      throw new Error('Could not find email input field with any selector');
    }
    
    await emailInput.clear();
    await emailInput.sendKeys(ADMIN_EMAIL);
    
    // Try different selectors for password
    const passwordSelectors = [
      'input[type="password"]',
      'input[name*="password"]',
      'input[id*="password"]',
      'input[type="password"]',
      'input:last-of-type'
    ];
    
    for (const selector of passwordSelectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        if (elements.length > 0) {
          passwordInput = elements[0];
          console.log(`[TEST] Found password input using selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TEST] Password selector ${selector} failed:`, e.message);
      }
    }
    
    if (!passwordInput) {
      throw new Error('Could not find password input field with any selector');
    }
    
    await passwordInput.clear();
    await passwordInput.sendKeys(ADMIN_PASSWORD);
    
    // Find and click the login button
    const buttonSelectors = [
      'button[type="submit"]',
      'button:contains("Sign in")',
      'button:contains("Login")',
      'button:contains("Log in")',
      'button'
    ];
    
    let submitBtn;
    for (const selector of buttonSelectors) {
      try {
        // Try XPath for text matching
        if (selector.includes('contains')) {
          const btnText = selector.match(/"(.*?)"/)[1];
          const elements = await driver.findElements(By.xpath(`//button[contains(., '${btnText}')]`));
          if (elements.length > 0) {
            submitBtn = elements[0];
            console.log(`[TEST] Found submit button with text: ${btnText}`);
            break;
          }
        } else {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            submitBtn = elements[0];
            console.log(`[TEST] Found submit button with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        console.log(`[TEST] Button selector ${selector} failed:`, e.message);
      }
    }
    
    if (!submitBtn) {
      throw new Error('Could not find submit button with any selector');
    }
    
    // Take a screenshot before clicking
    const beforeLoginScreenshot = await driver.takeScreenshot();
    fs.writeFileSync(screenshot('before_login.png'), beforeLoginScreenshot, 'base64');
    
    // Click the button
    await submitBtn.click();
    
    // Wait for navigation with a longer timeout
    console.log('[TEST] Waiting for login to complete...');
    try {
      await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        const url = new URL(currentUrl);
        const isNotLoginPage = !/\/login\/?$/i.test(url.pathname);
        console.log(`[TEST] Current URL: ${currentUrl}, isNotLoginPage: ${isNotLoginPage}`);
        return isNotLoginPage;
      }, 30000); // 30 second timeout
      
      console.log('[TEST] Login successful - redirected from login page');
    } catch (e) {
      console.error('[TEST] Login might have failed - still on login page after timeout');
      // Take a screenshot of the current state
      const errorScreenshot = await driver.takeScreenshot();
      fs.writeFileSync(screenshot('login_error.png'), errorScreenshot, 'base64');
      throw e;
    }
    } catch (e) {
      console.error('[TEST] Login failed:', e && e.message ? e.message : e);
      throw e;
    }

    // 2. Navigate to Tables page
    const TABLES_URL = new URL('/tables', FRONTEND_URL).toString();
    console.log(`[TEST] Navigating to: ${TABLES_URL}`);
    await driver.get(TABLES_URL);
    
    // Wait for tables page to load
    await driver.wait(until.elementLocated(By.css('[data-testid="layout-canvas"]')), 15000);
    console.log('[TEST] Tables page loaded');

    // 3. Open sidebar layouts panel
    console.log('[TEST] Opening layouts sidebar...');
    try {
      const sidebarToggle = await driver.findElement(By.xpath('(//div[contains(@class,\'border-b\')])[1]//button'));
      await sidebarToggle.click();
      await driver.sleep(500);
    } catch (e) {
      console.warn('[TEST] Could not find sidebar toggle, assuming sidebar is already open');
    }

    // 4. Click New Layout button
    console.log('[TEST] Creating new layout...');
    const newLayoutBtn = await driver.wait(
      until.elementLocated(By.xpath("//h2[contains(.,'Table Layouts')]/following::button[contains(.,'New Layout')][1]")), 
      10000
    );
    await newLayoutBtn.click();

    // 5. Fill in layout name and create
    const layoutName = `Test Layout ${Date.now()}`;
    const nameInput = await driver.wait(until.elementLocated(By.css('#layoutName')), 10000);
    await nameInput.clear();
    await nameInput.sendKeys(layoutName);
    
    console.log(`[TEST] Creating layout: ${layoutName}`);
    const createBtn = await driver.findElement(By.xpath("//button[contains(.,'Create')]"));
    await createBtn.click();
    
    // Wait for layout to be created and canvas to be ready
    await driver.wait(until.elementLocated(By.css('[data-testid="layout-canvas"]')), 10000);
    console.log('[TEST] New layout created successfully');

    // 6. Get the current user ID from localStorage
    const userData = await driver.executeScript(() => {
      const userStr = window.localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    });

    if (!userData || !userData.id) {
      throw new Error('Could not get user ID from localStorage');
    }

    console.log(`[TEST] Current user ID: ${userData.id}`);

    // 7. Verify the layout was created with the correct created_by
    const layoutData = await driver.executeAsyncScript((userId, callback) => {
      // This runs in the browser context
      fetch('/api/table-layouts')
        .then(res => res.json())
        .then(data => {
          const layout = data.find(l => l.name === arguments[0]);
          callback({
            success: true,
            layout,
            error: null
          });
        })
        .catch(err => callback({
          success: false,
          layout: null,
          error: err.message
        }));
    }, layoutName);

    if (!layoutData.success) {
      throw new Error(`Failed to fetch layouts: ${layoutData.error}`);
    }

    if (!layoutData.layout) {
      throw new Error(`Layout '${layoutName}' not found after creation`);
    }

    console.log(`[TEST] Layout created with ID: ${layoutData.layout.id}`);
    
    // 8. Verify created_by field
    if (layoutData.layout.created_by !== userData.id) {
      throw new Error(`Expected created_by to be ${userData.id}, got ${layoutData.layout.created_by}`);
    }

    console.log(`[TEST] ✅ Success! Layout created with created_by: ${layoutData.layout.created_by}`);
    
    // Save final screenshot
    fs.writeFileSync(screenshot('test_completed.png'), await driver.takeScreenshot(), 'base64');
    
  } catch (err) {
    console.error('[TEST] Test failed:', err && err.message ? err.message : err);
    
    // Save error screenshot
    try {
      if (driver) {
        fs.writeFileSync(screenshot('test_error.png'), await driver.takeScreenshot(), 'base64');
        
        // Save browser console logs
        try {
          const logs = await driver.manage().logs().get('browser');
          fs.writeFileSync(
            screenshot('browser_console.log'), 
            logs.map(l => `${l.level.name}: ${l.message}`).join('\n'), 
            'utf8'
          );
        } catch (logErr) {
          console.warn('Could not get browser logs:', logErr);
        }
      }
    } catch (screenshotErr) {
      console.error('Failed to save error screenshot:', screenshotErr);
    }
    
    process.exitCode = 1;
  } finally {
    try {
      if (driver) {
        fs.writeFileSync(screenshot('test_final.png'), await driver.takeScreenshot(), 'base64');
        await driver.quit();
      }
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  }
})();
