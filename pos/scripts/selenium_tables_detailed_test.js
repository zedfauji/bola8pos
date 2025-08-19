// Selenium detailed /tables smoke test
// Usage:
//   FRONTEND_URL=http://localhost:5173 ADMIN_PASSWORD=password node pos/scripts/selenium_tables_detailed_test.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const { Builder, By, until, Key, Button, Origin, Actions, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async function run() {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const LOGIN_URL = new URL('/login', FRONTEND_URL).toString();
  const ADMIN_EMAIL = 'admin@billiardpos.com';
  // Hardcoded as requested to avoid env whitespace/mismatch issues
  const ADMIN_PASSWORD = 'password';
  const API_BASE = process.env.API_BASE || 'https://localhost:3001/api';

  const outDir = __dirname;
  const screenshot = (name) => path.join(outDir, name);

  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

  const options = new chrome.Options()
    .addArguments('--window-size=1440,900')
    .setAcceptInsecureCerts(true);

  let driver;
  try {
    // 0) Ensure an active layout exists via API
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const api = axios.create({ baseURL: API_BASE, httpsAgent, timeout: 15000 });

    async function ensureActiveLayout() {
      try {
        // Authenticate to get token
        const loginRes = await api.post('/auth/login', {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });
        const token = loginRes?.data?.accessToken || loginRes?.data?.token;
        if (!token) throw new Error('No token from login');
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Check active layout
        const active = await api.get('/table-layouts/active');
        if (active.data && active.data.id) {
          return active.data;
        }

        // Create a minimal layout
        const created = await api.post('/table-layouts', {
          name: `Auto Layout ${Date.now()}`,
          description: 'Created by Selenium pre-step',
          width: 1200,
          height: 800,
          gridSize: 10,
          settings: { showGrid: true, snapToGrid: true, showTableNumbers: true, showStatus: true },
        });
        const layout = created.data;
        // Activate it
        const activated = await api.put(`/table-layouts/${layout.id}/activate`);
        // small wait to let backend persist before UI navigations
        await new Promise(r => setTimeout(r, 300));
        return activated.data;
      } catch (e) {
        console.warn('[TABLES] ensureActiveLayout failed:', e?.response?.data || e?.message || e);
        // continue; UI may show empty state which test will handle
        return null;
      }
    }

    await ensureActiveLayout();

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setLoggingPrefs(prefs)
      .build();

    // 1) Login
    console.log(`[TABLES] Opening login: ${LOGIN_URL}`);
    await driver.get(LOGIN_URL);

    // If already logged in, continue
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      if (!/\/login\/?$/.test(new URL(url).pathname)) return true;
      try {
        await driver.findElement(By.css('#email-address'));
        await driver.findElement(By.css('#password'));
        return true;
      } catch { return false; }
    }, 20000);

    const onLogin = /\/login\/?$/.test(new URL(await driver.getCurrentUrl()).pathname);
    if (onLogin) {
      const emailInput = await driver.findElement(By.css('#email-address'));
      const passwordInput = await driver.findElement(By.css('#password'));
      await emailInput.clear();
      await emailInput.sendKeys(ADMIN_EMAIL);
      await passwordInput.clear();
      await passwordInput.sendKeys(ADMIN_PASSWORD);
      await (await driver.findElement(By.css('button[type="submit"]'))).click();
      await driver.wait(async () => !/\/login\/?$/.test(new URL(await driver.getCurrentUrl()).pathname), 15000);
    } else {
      console.log('[TABLES] Already authenticated.');
    }

    // 2) Navigate to /tables
    const TABLES_URL = new URL('/tables', FRONTEND_URL).toString();
    console.log(`[TABLES] Navigating to: ${TABLES_URL}`);
    await driver.get(TABLES_URL);
    // Allow a short warm-up time after server restarts
    await driver.sleep(1500);

    // Wait for editor wrapper or empty state
    await driver.wait(async () => {
      const editor = await driver.findElements(By.css('[data-testid="tables-editor"]'));
      const empty = await driver.findElements(By.xpath("//*[contains(text(),'No active layout found')]"));
      return editor.length > 0 || empty.length > 0;
    }, 25000);

    // If no layout, create and activate one via UI using the sidebar TableLayouts
    const emptyState = await driver.findElements(By.xpath("//*[contains(text(),'No active layout found')]"));
    if (emptyState.length) {
      console.warn('[TABLES] No active layout — creating one via UI (sidebar)...');
      // Open sidebar layouts panel (click the toggle button in sidebar header)
      const sidebarToggle = await driver.findElement(By.xpath('(//div[contains(@class,\'border-b\')])[1]//button'));
      await sidebarToggle.click();
      // Wait for Table Layouts header to appear in sidebar
      await driver.wait(until.elementLocated(By.xpath("//h2[contains(.,'Table Layouts')]")), 10000);
      // Click New Layout button inside TableLayouts header area
      const newLayoutBtn = await driver.findElement(By.xpath("//h2[contains(.,'Table Layouts')]/following::button[contains(.,'New Layout')][1]"));
      await newLayoutBtn.click();
      // Fill name and Create
      const nameInput = await driver.wait(until.elementLocated(By.css('#layoutName')), 10000);
      const layoutName = `Auto Layout ${Date.now()}`;
      await nameInput.clear();
      await nameInput.sendKeys(layoutName);
      const createBtn = await driver.findElement(By.xpath("//button[contains(.,'Create')]"));
      await createBtn.click();
      await driver.sleep(500);
      // Activate via Eye button (Set as active)
      try {
        const activateBtn = await driver.findElement(By.xpath("//button[@title='Set as active']"));
        await activateBtn.click();
        await driver.sleep(400);
      } catch {}
      // Ensure canvas ready
      await driver.wait(until.elementLocated(By.css('[data-testid="layout-canvas"]')), 15000);
    }

    // Ensure canvas present
    const canvas = await driver.wait(until.elementLocated(By.css('[data-testid="layout-canvas"]')), 20000);
    console.log('[TABLES] Canvas located.');

    // Snapshot initial
    fs.writeFileSync(screenshot('tables_loaded.png'), await driver.takeScreenshot(), 'base64');

    // 3) Verify at least one table rendered; if none, try Add Table
    let tables = await driver.findElements(By.css('[data-testid^="table-"]'));
    console.log(`[TABLES] Found tables: ${tables.length}`);
    if (tables.length === 0) {
      console.warn('[TABLES] No tables initially rendered. Attempting to add a table via UI...');
      try {
        const addBtn = await driver.findElement(By.xpath("//button[contains(.,'Add Table')]"));
        await addBtn.click();
        // wait for a table to appear (allow extra time for backend/DB)
        await driver.wait(async () => {
          const els = await driver.findElements(By.css('[data-testid^="table-"]'));
          return els.length > 0;
        }, 25000);
        tables = await driver.findElements(By.css('[data-testid^="table-"]'));
        console.log(`[TABLES] Tables after Add: ${tables.length}`);
      } catch (e) {
        console.error('[TABLES] Failed to add table via UI:', e && e.message ? e.message : e);
        try {
          // Log current URL
          const curUrl = await driver.getCurrentUrl();
          console.log('[TABLES] Current URL:', curUrl);
        } catch {}
        try {
          // Dump localStorage auth tokens to stdout for diagnostics
          const tokens = await driver.executeScript(() => {
            return {
              accessToken: window.localStorage.getItem('accessToken'),
              token: window.localStorage.getItem('token'),
              user: window.localStorage.getItem('user')
            };
          });
          console.log('[TABLES] LocalStorage tokens:', tokens);
        } catch {}
        // dump browser console logs for diagnostics
        try {
          const logs = await driver.manage().logs().get('browser');
          const logPath = screenshot('browser_console_after_add.json');
          fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
          console.log('[TABLES] Saved browser console logs to', logPath);
          // Also print a summarized version to stdout for quick inspection
          const summarized = logs.map(l => `${l.level.name}: ${l.message}`).join('\n');
          console.log('[TABLES] Browser console (summary):\n' + summarized);
        } catch (logErr) {
          console.warn('[TABLES] Could not fetch browser logs:', logErr && logErr.message ? logErr.message : logErr);
        }
        fs.writeFileSync(screenshot('tables_none.png'), await driver.takeScreenshot(), 'base64');
        process.exitCode = 3;
        return;
      }
    }

    // Pick the first table and record its initial position
    const firstTable = tables[0];
    const getLeftTop = async (el) => {
      return await driver.executeScript((elem) => {
        const style = window.getComputedStyle(elem);
        // Inline styles may not be reflected in getComputedStyle left/top when position absolute
        // so read CSS left/top or bounding rect as fallback
        const left = parseFloat((elem.style.left || style.left || '0').replace('px',''));
        const top = parseFloat((elem.style.top || style.top || '0').replace('px',''));
        const rect = elem.getBoundingClientRect();
        return { left, top, rectLeft: rect.left, rectTop: rect.top };
      }, el);
    };

    const before = await getLeftTop(firstTable);
    console.log(`[TABLES] Before drag left=${before.left} top=${before.top}`);

    // 4) Drag the table by +40,+25 px
    const actions = driver.actions({ bridge: true });
    await actions.move({ origin: firstTable }).press().move({ origin: Origin.POINTER, x: 40, y: 25 }).release().perform();

    // Allow UI to process
    await driver.sleep(800);

    const after = await getLeftTop(firstTable);
    console.log(`[TABLES] After drag left=${after.left} top=${after.top}`);

    // Verify movement (tolerate small deltas depending on scaling)
    if (!((after.left > before.left + 20) && (after.top > before.top + 10))) {
      console.error('[TABLES] Drag did not appear to move the table sufficiently.');
      fs.writeFileSync(screenshot('tables_drag_failed.png'), await driver.takeScreenshot(), 'base64');
      process.exitCode = 4;
      return;
    }

    // 5) Click Save Layout
    let saved = false;
    try {
      const saveBtn = await driver.findElement(By.xpath("//button[.//text()[contains(.,'Save Layout')]] | //button[contains(.,'Save Layout')]"));
      await saveBtn.click();
      saved = true;
    } catch (e) {
      console.warn('[TABLES] Save Layout button not found.');
    }

    // 6) Switch tabs: List View then Settings then back to Layout
    const clickTab = async (label) => {
      const trigger = await driver.findElement(By.xpath(`//button[.//text()[contains(.,'${label}')]] | //div[contains(@class,'TabsList')]//button[contains(.,'${label}')]`));
      await trigger.click();
      await driver.sleep(300);
    };

    await clickTab('List View');
    await driver.wait(until.elementLocated(By.xpath("//h2[contains(.,'Tables List')]")), 10000);

    await clickTab('Settings');
    await driver.wait(until.elementLocated(By.xpath("//h2[contains(.,'Table Settings')]")), 10000);

    await clickTab('Layout');
    await driver.wait(until.elementLocated(By.css('[data-testid="layout-canvas"]')), 10000);

    fs.writeFileSync(screenshot('tables_after_actions.png'), await driver.takeScreenshot(), 'base64');

    // Dump browser logs for diagnostics
    try {
      const logs = await driver.manage().logs().get('browser');
      const out = logs.map(l => `${l.level.name}: ${l.message}`).join('\n');
      fs.writeFileSync(path.join(outDir, 'tables_console.log'), out, 'utf8');
    } catch {}

    console.log('[TABLES] Detailed /tables test completed.', { moved: true, saved });
  } catch (err) {
    console.error('[TABLES] Error:', err && err.message ? err.message : err);
    try {
      if (driver) fs.writeFileSync(path.join(outDir, 'tables_error.png'), await driver.takeScreenshot(), 'base64');
    } catch {}
    process.exitCode = 1;
  } finally {
    try {
      if (driver) {
        fs.writeFileSync(path.join(outDir, 'tables_final_close.png'), await driver.takeScreenshot(), 'base64');
      }
    } catch {}
    if (driver) await driver.quit();
  }
})();
