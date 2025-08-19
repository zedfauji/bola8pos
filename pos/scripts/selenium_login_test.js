// Selenium E2E login flow test for Billiard POS
// Usage:
//   FRONTEND_URL=http://localhost:5173 node pos/scripts/selenium_login_test.js
// Notes:
// - Accepts insecure certs to work with https://localhost:3001 backend
// - Expects login page at `${FRONTEND_URL}/login` with #email-address and #password inputs

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Builder, By, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async function run() {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const LOGIN_URL = new URL('/login', FRONTEND_URL).toString();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@billiardpos.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PIN || 'Admin@123';

  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

  const options = new chrome.Options()
    .addArguments('--window-size=1280,900')
    .setAcceptInsecureCerts(true);

  let driver;
  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setLoggingPrefs(prefs)
      .build();

    console.log(`[E2E] Opening: ${LOGIN_URL}`);
    await driver.get(LOGIN_URL);

    // Wait until either we've navigated away from /login OR login inputs are present
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      if (!/\/login\/?$/.test(new URL(url).pathname)) return true;
      try {
        await driver.findElement(By.css('#email-address'));
        await driver.findElement(By.css('#password'));
        return true;
      } catch {
        return false;
      }
    }, 8000);

    let leftLogin = !/\/login\/?$/.test(new URL(await driver.getCurrentUrl()).pathname);

    if (!leftLogin) {
      const emailInput = await driver.wait(until.elementLocated(By.css('#email-address')), 5000);
      const passwordInput = await driver.wait(until.elementLocated(By.css('#password')), 5000);

      await emailInput.clear();
      await emailInput.sendKeys(ADMIN_EMAIL);
      await passwordInput.clear();
      await passwordInput.sendKeys(ADMIN_PASSWORD);

      const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
      await submitBtn.click();

      await driver.wait(async () => {
        const url = new URL(await driver.getCurrentUrl());
        return !/\/login\/?$/.test(url.pathname);
      }, 10000);
    } else {
      console.log('[E2E] Already authenticated (not on /login), continuing...');
    }

    const finalUrl = await driver.getCurrentUrl();
    console.log(`[E2E] Redirected to: ${finalUrl}`);

    const storage = await driver.executeScript(() => ({
      token: window.localStorage.getItem('token'),
      user: window.localStorage.getItem('user'),
    }));
    console.log('[E2E] localStorage:', storage);

    // Navigate to /tables and verify page loads
    const TABLES_URL = new URL('/tables', FRONTEND_URL).toString();
    console.log(`[E2E] Navigating to: ${TABLES_URL}`);
    await driver.get(TABLES_URL);

    // Wait for either the header text or any Tabs UI element to appear
    try {
      await driver.wait(async () => {
        const h1s = await driver.findElements(By.css('h1'));
        for (const h of h1s) {
          const text = (await h.getText()).trim().toLowerCase();
          if (text.includes('table management')) return true;
        }
        const tabsList = await driver.findElements(By.css('[class*="TabsList"], [data-testid="tabs-list"], div.inline-flex'));
        return tabsList.length > 0;
      }, 8000);
      console.log('[E2E] /tables page loaded.');
    } catch (e) {
      console.error('[E2E] Failed to load /tables:', e && e.message ? e.message : e);
      // Try to save immediate screenshot for diagnostics
      const failTablesPath = path.join(__dirname, 'selenium_tables_error.png');
      try { fs.writeFileSync(failTablesPath, await driver.takeScreenshot(), 'base64'); } catch {}
      process.exitCode = 1;
    }

    try {
      const logs = await driver.manage().logs().get('browser');
      if (logs && logs.length) {
        console.log('[E2E] Browser console logs:');
        logs.forEach((l) => console.log(`${l.level.name}: ${l.message}`));
      } else {
        console.log('[E2E] No browser console logs');
      }
    } catch {}

    const outDir = __dirname;
    const screenshotPath = path.join(outDir, 'selenium_login_result.png');
    const image = await driver.takeScreenshot();
    fs.writeFileSync(screenshotPath, image, 'base64');
    console.log(`[E2E] Screenshot saved: ${screenshotPath}`);

    console.log('[E2E] Login flow completed successfully.');
  } catch (err) {
    console.error('[E2E] Error during Selenium test:', err && err.message ? err.message : err);
    try {
      if (driver) {
        const failPath = path.join(__dirname, 'selenium_login_error.png');
        const img = await driver.takeScreenshot();
        fs.writeFileSync(failPath, img, 'base64');
        console.log(`[E2E] Error screenshot saved: ${failPath}`);
      }
    } catch {}
    process.exitCode = 1;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
})();
