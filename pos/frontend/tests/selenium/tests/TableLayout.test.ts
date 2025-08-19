import { WebDriver, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/edge';
import { WebDriverHelper } from '../utils/WebDriverHelper';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TablesPage } from '../pages/TablesPage';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env.test') });

const BASE_URL = 'http://localhost:5173';
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
console.log(`Using API Base URL: ${API_BASE_URL}`);

// Create a single instance of WebDriverHelper
const webDriverHelper = WebDriverHelper.getInstance();

describe('Table Layout Tests', () => {
  let driver: WebDriver;
  let driverHelper: WebDriverHelper;
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let tablesPage: TablesPage;

  beforeAll(async () => {
    try {
      console.log('Initializing WebDriver...');
      driver = await webDriverHelper.getDriver();
      console.log('WebDriver initialized');
      
      // Start console log capture
      await webDriverHelper.startConsoleCapture();
      
      // Initialize page objects
      loginPage = new LoginPage(driver);
      dashboardPage = new DashboardPage(driver);
      tablesPage = new TablesPage(driver);
      
      console.log('Test setup complete');
    } catch (error) {
      console.error('Error during test setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Get and log any browser console errors
      const logs = await webDriverHelper.getConsoleLogs();
      const errors = logs.filter(log => log.level === 'error' || log.level === 'warn');
      if (errors.length > 0) {
        console.log('\nBrowser console errors/warnings:');
        errors.forEach((log, i) => {
          console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        });
      }
      
      // Take a final screenshot
      await webDriverHelper.takeScreenshot('test-complete');
      
      // Quit the driver
      await webDriverHelper.quitDriver();
      console.log('Test teardown complete');
    } catch (error) {
      console.error('Error during test teardown:', error);
    }
  });

  it('should load table layout correctly', async () => {
    try {
      // 1. Login
      console.log('\n--- Starting test: Table Layout ---');
      console.log('Step 1: Logging in...');
      await loginPage.navigateTo();
      await loginPage.login('admin@billiardpos.com', 'password');
      
      // 2. Navigate to tables
      console.log('\nStep 2: Navigating to tables page...');
      await dashboardPage.navigateToTables();
      
      // 3. Wait for table layout
      console.log('\nStep 3: Waiting for table layout to load...');
      await tablesPage.waitForTableLayout();
      
      // 4. Verify tables
      console.log('\nStep 4: Verifying tables...');
      const tables = await tablesPage.getTables();
      expect(tables.length).toBeGreaterThan(0);
      console.log(`✅ Found ${tables.length} tables`);
      
      // 5. Check table positions
      console.log('\nStep 5: Verifying table positions...');
      for (const [index, table] of tables.entries()) {
        const position = await tablesPage.getTablePosition(table);
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeGreaterThanOrEqual(0);
        console.log(`✅ Table ${index + 1}: Position (${position.x}, ${position.y}), Size: ${position.width}x${position.height}`);
      }
      
      // 6. Take screenshot
      console.log('\nStep 6: Taking screenshot...');
      await webDriverHelper.takeScreenshot('table-layout');
      
      console.log('\n✅ Test completed successfully!');
    } catch (error) {
      // Take screenshot on failure
      console.error('\n❌ Test failed:', error);
      try {
        await webDriverHelper.takeScreenshot('test-failure');
      } catch (screenshotError) {
        console.error('Failed to take screenshot on failure:', screenshotError);
      }
      throw error;
    }
  });
});
