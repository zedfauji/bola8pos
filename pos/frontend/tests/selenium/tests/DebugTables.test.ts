import { test, expect } from '@playwright/test';
import { WebDriverHelper } from '../utils/WebDriverHelper';

test.describe('Debug Tables Page', () => {
  let helper: WebDriverHelper;

  test.beforeAll(async () => {
    helper = await WebDriverHelper.getInstance();
    await helper.driver.manage().window().setRect({ width: 1280, height: 800 });
  });

  test.afterAll(async () => {
    await helper.quit();
  });

  test('should capture console logs from tables page', async () => {
    // Navigate to tables page
    await helper.driver.get('http://localhost:5173/tables');
    
    // Wait for page to load
    await helper.waitForElement('div[data-testid="tables-editor"]', 10000).catch(() => {
      console.log('Tables editor not found, checking for login page...');
    });

    // If redirected to login, log in first
    if ((await helper.driver.getCurrentUrl()).includes('/login')) {
      await helper.login('admin@billiardpos.com', 'password');
      await helper.driver.get('http://localhost:5173/tables');
      await helper.waitForElement('div[data-testid="tables-editor"]', 10000);
    }

    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get browser console logs
    const logs = await helper.driver.manage().logs().get('browser');
    console.log('Browser console logs:');
    logs.forEach(log => {
      console.log(`[${log.level.name}] ${log.message}`);
    });

    // Take a screenshot
    const screenshot = await helper.driver.takeScreenshot();
    require('fs').writeFileSync('tables-page.png', screenshot, 'base64');
    console.log('Screenshot saved as tables-page.png');

    // Check if there's an active layout
    const activeLayout = await helper.driver.executeScript(`
      return fetch('/api/table-layouts/active', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.json())
      .catch(err => ({
        error: 'Failed to fetch active layout',
        details: err.message
      }));
    `);
    console.log('Active layout:', JSON.stringify(activeLayout, null, 2));

    // Check if there are any layouts
    const allLayouts = await helper.driver.executeScript(`
      return fetch('/api/table-layouts', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.json())
      .catch(err => ({
        error: 'Failed to fetch layouts',
        details: err.message
      }));
    `);
    console.log('All layouts:', JSON.stringify(allLayouts, null, 2));
  });
});
