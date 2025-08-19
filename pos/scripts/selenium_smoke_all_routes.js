// Selenium smoke test to visit all routes after login
// Usage:
//   FRONTEND_URL=http://localhost:5173 node pos/scripts/selenium_smoke_all_routes.js
// Env overrides:
//   E2E_TIMEOUT_SHORT (ms, default 4000)
//   E2E_TIMEOUT_PAGE (ms, default 7000)
//   E2E_DWELL_MS (ms, default 8000)

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

  const T_SHORT = parseInt(process.env.E2E_TIMEOUT_SHORT || '4000', 10);
  const T_PAGE = parseInt(process.env.E2E_TIMEOUT_PAGE || '7000', 10);
  const DWELL = parseInt(process.env.E2E_DWELL_MS || '8000', 10);

  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

  const options = new chrome.Options()
    .addArguments('--window-size=1280,900')
    .setAcceptInsecureCerts(true);

  const routes = [
    { path: '/', name: 'Dashboard' },
    { path: '/tables', name: 'Tables' },
    { path: '/order/1', name: 'OrderPage (table 1)' },
    { path: '/kitchen', name: 'KitchenDisplay' },
    { path: '/payment', name: 'Payment (no table)' },
    { path: '/orders', name: 'Orders Summary' },
    { path: '/settings', name: 'Settings (admin)' },
    { path: '/reports', name: 'Reports' },
    { path: '/members', name: 'Members' },
    { path: '/reservations', name: 'Reservations' },
    { path: '/hardware', name: 'Hardware (admin)' },
    { path: '/inventory', name: 'Inventory' },
    { path: '/admin/audit-log', name: 'Admin Audit Log' },
    { path: '/admin/discounts', name: 'Admin Discounts' },
    { path: '/admin/settings', name: 'Admin Settings' },
    { path: '/bar-sales', name: 'Bar Sales' },
    { path: '/shifts/history', name: 'Shift History' },
  ];

  let driver;
  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setLoggingPrefs(prefs)
      .build();

    // Login flow
    console.log(`[SMOKE] Opening: ${LOGIN_URL}`);
    await driver.get(LOGIN_URL);

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
    }, T_SHORT);

    let leftLogin = !/\/login\/?$/.test(new URL(await driver.getCurrentUrl()).pathname);

    if (!leftLogin) {
      const emailInput = await driver.wait(until.elementLocated(By.css('#email-address')), Math.min(3000, T_SHORT));
      const passwordInput = await driver.wait(until.elementLocated(By.css('#password')), Math.min(3000, T_SHORT));
      await emailInput.clear();
      await emailInput.sendKeys(ADMIN_EMAIL);
      await passwordInput.clear();
      await passwordInput.sendKeys(ADMIN_PASSWORD);
      const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
      await submitBtn.click();
      await driver.wait(async () => {
        const url = new URL(await driver.getCurrentUrl());
        return !/\/login\/?$/.test(url.pathname);
      }, Math.min(8000, T_PAGE));
    } else {
      console.log('[SMOKE] Already authenticated (not on /login), continuing...');
    }

    console.log(`[SMOKE] Authenticated at: ${await driver.getCurrentUrl()}`);

    const storage = await driver.executeScript(() => ({
      token: window.localStorage.getItem('token'),
      user: window.localStorage.getItem('user'),
    }));
    console.log('[SMOKE] localStorage:', storage);

    const outDir = __dirname;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    // Visit all routes
    for (const r of routes) {
      const url = new URL(r.path, FRONTEND_URL).toString();
      console.log(`[SMOKE] Visiting ${r.name}: ${url}`);
      await driver.get(url);

      // Generic page-ready condition: not on /unauthorized or /login, body present, and app container rendered
      try {
        await driver.wait(async () => {
          const cur = new URL(await driver.getCurrentUrl());
          if (/\/unauthorized\/?$/.test(cur.pathname)) return true; // still count as loaded to detect RBAC issues
          if (/\/login\/?$/.test(cur.pathname)) return false; // got logged out unexpectedly
          const bodies = await driver.findElements(By.css('body'));
          const mains = await driver.findElements(By.css('main, #root'));
          return bodies.length > 0 && mains.length > 0;
        }, T_PAGE);
        console.log(`[SMOKE] Loaded: ${r.path}`);
      } catch (e) {
        console.error(`[SMOKE] Timeout loading ${r.path}:`, e && e.message ? e.message : e);
        process.exitCode = 1;
      }

      // Dwell on page for observation and log collection
      await sleep(DWELL);

      // Per-route console logs
      try {
        const logs = await driver.manage().logs().get('browser');
        const logSafe = r.path.replace(/\W+/g, '_') || 'root';
        const logPath = path.join(outDir, `smoke${logSafe}_console.log`);
        const lines = (logs || []).map((l) => `${l.level.name}: ${l.message}`).join('\n');
        fs.writeFileSync(logPath, lines, 'utf8');
        console.log(`[SMOKE] Saved console logs: ${logPath}`);
      } catch {}

      // Save per-route screenshot
      const fileSafe = r.path.replace(/\W+/g, '_') || 'root';
      const shotPath = path.join(outDir, `smoke${fileSafe}.png`);
      try { fs.writeFileSync(shotPath, await driver.takeScreenshot(), 'base64'); } catch {}
    }

    // Dump browser logs at the end
    try {
      const logs = await driver.manage().logs().get('browser');
      if (logs && logs.length) {
        console.log('[SMOKE] Browser console logs:');
        logs.forEach((l) => console.log(`${l.level.name}: ${l.message}`));
      }
    } catch {}

    console.log('[SMOKE] Completed visiting all routes.');
  } catch (err) {
    console.error('[SMOKE] Error:', err && err.message ? err.message : err);
    try {
      if (driver) {
        const failPath = path.join(__dirname, 'smoke_error.png');
        const img = await driver.takeScreenshot();
        fs.writeFileSync(failPath, img, 'base64');
        console.log(`[SMOKE] Error screenshot saved: ${failPath}`);
      }
    } catch {}
    process.exitCode = 1;
  } finally {
    if (driver) await driver.quit();
  }
})();
