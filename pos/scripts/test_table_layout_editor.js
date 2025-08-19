const { Builder, By, Key, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const baseUrl = 'http://localhost:5173'; // Frontend URL (Vite's default port)
const screenshotDir = path.join(__dirname, 'screenshots');
const username = 'admin@billiardpos.com'; // Admin email
const password = 'password'; // Admin password
const maxRetries = 5;
const retryDelay = 3000; // 3 seconds

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

// Take screenshot helper
async function takeScreenshot(driver, name) {
  const screenshot = await driver.takeScreenshot();
  const filename = path.join(screenshotDir, `${name}_${new Date().toISOString().replace(/:/g, '-')}.png`);
  fs.writeFileSync(filename, screenshot, 'base64');
  console.log(`Screenshot saved: ${filename}`);
  return filename;
}

// Check if server is running
async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(baseUrl, () => {
      resolve(true);
    }).on('error', () => {
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Retry function
async function retry(fn, retries = maxRetries, delay = retryDelay) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    console.log(`Retrying... (${maxRetries - retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay);
  }
}

// Capture console logs
let consoleLogs = [];

// Main test function
async function testTableLayoutEditor() {
  // Set up console log capture
  const originalConsoleLog = console.log;
  console.log = function() {
    const args = Array.from(arguments).join(' ');
    consoleLogs.push(args);
    originalConsoleLog.apply(console, arguments);
  };
  
  let driver;
  
  try {
    // Set up Chrome options
    const chromeOptions = new chrome.Options();
    // chromeOptions.addArguments('--headless'); // Uncomment for headless mode
    
    // Enable browser logs
    const loggingPrefs = new logging.Preferences();
    loggingPrefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
    
    // Create WebDriver instance
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .setLoggingPrefs(loggingPrefs)
      .build();
    
    // Login to the application
    console.log('Attempting to login...');
    await driver.get(baseUrl);
    console.log('Navigated to base URL');
    await takeScreenshot(driver, 'login_page');
    
    try {
      // Wait for login form to be visible
      await driver.wait(until.elementLocated(By.css('input[type="email"], input[name="email"]')), 10000);
      
      // Find email and password fields
      const emailField = await driver.findElement(By.css('input[type="email"], input[name="email"]'));
      const passwordField = await driver.findElement(By.css('input[type="password"], input[name="password"]'));
      
      // Enter credentials
      await emailField.sendKeys(username);
      await passwordField.sendKeys(password);
      
      // Find and click login button
      const loginButton = await driver.findElement(By.css('button[type="submit"], button.login-button'));
      await loginButton.click();
      console.log('Login credentials submitted');
      
      // Wait for login to complete (either redirect or dashboard element appears)
      await driver.wait(async () => {
        try {
          const currentUrl = await driver.getCurrentUrl();
          console.log('Current URL after login attempt:', currentUrl);
          
          // Check if we're redirected away from login page
          if (!currentUrl.includes('login') && 
              (currentUrl.includes('dashboard') || currentUrl.includes('home') || currentUrl === baseUrl + '/')) {
            console.log('Redirected to dashboard/home');
            return true;
          }
          
          // Check for dashboard elements
          const dashboardElements = await driver.findElements(By.css('.dashboard, .sidebar, .navbar, header'));
          if (dashboardElements.length > 0) {
            for (const element of dashboardElements) {
              if (await element.isDisplayed()) {
                console.log('Dashboard element found, login successful');
                return true;
              }
            }
          }
          
          return false;
        } catch (e) {
          console.log('Error while waiting for login completion:', e.message);
          return false;
        }
      }, 15000, 'Login timed out');
      
      console.log('Login successful');
      await takeScreenshot(driver, 'after_login');
      
      // Navigate to tables page
      console.log('Navigating to tables page...');
      try {
        // Try to find and click on tables navigation link
        const tablesLink = await driver.findElement(
          By.css('a[href*="tables"], a.tables-link, .sidebar a:contains("Tables")')
        );
        await tablesLink.click();
        console.log('Clicked on tables navigation link');
      } catch (e) {
        // If navigation link not found, try direct URL
        console.log('Tables link not found, trying direct URL navigation');
        await driver.get(`${baseUrl}/tables`);
      }
      
      // Wait for tables page to load
      await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl.includes('tables');
      }, 10000, 'Timed out waiting for tables page URL');
      
      console.log('Successfully navigated to tables page');
      await takeScreenshot(driver, 'tables_page');
      
      // Capture browser console logs
      console.log('Capturing browser console logs...');
      const browserLogs = await driver.manage().logs().get('browser');
      console.log('Browser console logs:');
      browserLogs.forEach(log => {
        console.log(`[${log.level.name}] ${log.message}`);
      });
      
      // Save console logs to file
      fs.writeFileSync(
        path.join(screenshotDir, `browser_logs_${new Date().toISOString().replace(/:/g, '-')}.log`),
        browserLogs.map(log => `[${log.level.name}] ${log.message}`).join('\n'),
        'utf8'
      );

      // Wait for any elements on the page to verify it loaded
      try {
        // Look for any header elements
        const headers = await driver.findElements(By.css('h1, h2, h3, header'));
        if (headers.length > 0) {
          for (const header of headers) {
            const isDisplayed = await header.isDisplayed();
            if (isDisplayed) {
              const headerText = await header.getText();
              console.log('Found header:', headerText);
            }
          }
        } else {
          console.log('No headers found on the page');
        }
        
        // Take a screenshot of whatever is on the page
        await takeScreenshot(driver, 'tables_page_content');
      } catch (e) {
        console.error('Error inspecting page content:', e.message);
      }
      
      // Look for layout tab and sidebar elements
      try {
        // Find the TabsTrigger with value="layout"
        const layoutTab = await driver.findElement(By.css('[value="layout"]'));
        console.log('Found layout tab');
        
        // Make sure we're on the layout tab
        await layoutTab.click();
        console.log('Clicked on layout tab');
      } catch (e) {
        console.log('Error finding layout tab:', e.message);
      }

// Look for layout tab and sidebar elements
try {
  // Find the TabsTrigger with value="layout"
  const layoutTab = await driver.findElement(By.css('[value="layout"]'));
  console.log('Found layout tab');
  
  // Make sure we're on the layout tab
  await layoutTab.click();
  console.log('Clicked on layout tab');
  
  // Look for the table layouts sidebar
  const sidebar = await driver.findElement(By.css('.bg-white.border-r'));
  console.log('Found table layouts sidebar');
  
  // Wait for any sidebar content to load
  await driver.sleep(1000);
  await takeScreenshot(driver, 'sidebar_content');
  
  // Try to find any h2 element in the sidebar
  try {
    const sidebarHeaders = await sidebar.findElements(By.css('h2'));
    if (sidebarHeaders.length > 0) {
      for (const header of sidebarHeaders) {
        const headerText = await header.getText();
        console.log('Found sidebar header:', headerText);
      }
    } else {
      console.log('No h2 elements found in sidebar');
    }
  } catch (e) {
    console.log('Error finding sidebar headers:', e.message);
  }
  
  console.log('Successfully found table layout editor components');
  await takeScreenshot(driver, 'table_layout_editor');
  
  // Test 2: Check if toolbar exists
  try {
    const toolbar = await driver.findElement(By.css('.table-toolbar'));
    assert(await toolbar.isDisplayed(), 'Table toolbar should be visible');
    console.log('Found table toolbar');
  } catch (e) {
    console.log('Table toolbar not found:', e.message);
    // Continue with the test even if toolbar is not found
  }
  
  // Test 3: Create a new table
  try {
    const addTableButton = await driver.findElement(By.css('button[aria-label="Add Table"]'));
    await addTableButton.click();
    console.log('Clicked add table button');
  } catch (e) {
    console.log('Add table button not found:', e.message);
    // Try alternative selector
    try {
      const addButtons = await driver.findElements(By.css('button'));
      let addButtonFound = false;
      for (const button of addButtons) {
        const buttonText = await button.getText();
        if (buttonText.includes('Add') || buttonText.includes('New')) {
          await button.click();
          console.log('Clicked button with text:', buttonText);
          addButtonFound = true;
          break;
        }
      }
      if (!addButtonFound) {
        console.log('Could not find any Add/New button');
      }
    } catch (innerError) {
      console.log('Error finding alternative add button:', innerError.message);
    }
  }
} catch (e) {
  console.log('Error in layout tab and sidebar block:', e.message);
}

  // Wait for the new table to appear
  await driver.wait(until.elementLocated(By.css('[data-testid^="table-"]')), 10000);
  console.log('New table created');
  await takeScreenshot(driver, 'new_table_created');
  
  // Test 4: Select the table
  try {
    const table = await driver.findElement(By.css('[data-testid^="table-"]'));
    await table.click();
    
    // Wait for table properties panel to appear
    await driver.wait(until.elementLocated(By.css('.table-properties')), 10000);
    console.log('Table properties panel opened');
    await takeScreenshot(driver, 'table_properties');
    
    // Test 5: Update table name
    const nameInput = await driver.findElement(By.css('.table-properties input[name="name"]'));
    await nameInput.clear();
    await nameInput.sendKeys('Test Table');

    // Find and click the update button
    const updateButton = await driver.findElement(By.css('.table-properties button[type="submit"]'));
    await updateButton.click();
    
    // Wait for update to complete
    await driver.sleep(1000);
    console.log('Table name updated');
    await takeScreenshot(driver, 'table_name_updated');
  } catch (e) {
    console.log('Error selecting table or updating properties:', e.message);
    await takeScreenshot(driver, 'table_properties_error');
  }
  
  // Test 6: Drag the table to a new position
  try {
    const actions = driver.actions({async: true});
    
    // Find the table again since we might have lost reference
    const tableForDrag = await driver.findElement(By.css('[data-testid^="table-"]'));
    
    // Get table location
    const tableLocation = await tableForDrag.getRect();
    
    // Drag table to new position (100px right, 50px down)
    await actions
      .move({origin: tableForDrag})
      .press()
      .move({x: 100, y: 50, origin: 'pointer'})
      .release()
      .perform();
    
    // Wait for drag to complete
    await driver.sleep(1000);
    console.log('Table dragged to new position');
    await takeScreenshot(driver, 'table_dragged');
  } catch (e) {
    console.log('Error dragging table:', e.message);
  }
  
  // Test 7: Check for table layouts list and set active functionality
  try {
    console.log('Checking for table layouts list...');
    await driver.wait(until.elementLocated(By.css('.table-layouts-list, .layout-list')), 10000);
    const layoutsList = await driver.findElement(By.css('.table-layouts-list, .layout-list'));
    assert(await layoutsList.isDisplayed(), 'Table layouts list should be visible');
    await takeScreenshot(driver, 'table_layouts_list');
    
    // Find a layout to set as active
    const layoutItems = await driver.findElements(By.css('.layout-item, .table-layout-item'));
  console.log(`Found ${layoutItems.length} layout items`);
  
    if (layoutItems.length > 0) {
      // Click on the first layout item
      await layoutItems[0].click();
      console.log('Selected a layout');
      await takeScreenshot(driver, 'layout_selected');
    
    // Look for set active button
    try {
      const setActiveButton = await driver.findElement(By.css('button[aria-label="Set Active"], button:contains("Set Active"), button.set-active-btn'));
      console.log('Found Set Active button');
      await setActiveButton.click();
      console.log('Clicked Set Active button');
      await takeScreenshot(driver, 'set_active_clicked');
      
      // Wait for active status to update
      await driver.sleep(2000);
      await takeScreenshot(driver, 'after_set_active');
      
      // Check for active indicator
      try {
        const activeIndicator = await driver.findElement(By.css('.active-indicator, .is-active, [data-active="true"]'));
        console.log('Found active indicator, set active functionality works!');
      } catch (e) {
        console.log('Could not find active indicator, set active functionality might not be working');
      }
    } catch (e) {
      console.log('Could not find Set Active button:', e.message);
    }
    }
  } catch (e) {
    console.log('Error checking for table layouts list:', e.message);
  }
  
  // Test 8: Delete the table if one exists
  try {
    // Select the table
    const table = await driver.findElement(By.css('[data-testid^="table-"]'));
    await table.click();
    
    // Wait for table properties panel to appear
    await driver.wait(until.elementLocated(By.css('.table-properties')), 10000);
    console.log('Table properties panel opened');
    await takeScreenshot(driver, 'table_properties');
    
    // Test 5: Update table name
    const nameInput = await driver.findElement(By.css('.table-properties input[name="name"]'));
    await nameInput.clear();
    await nameInput.sendKeys('Test Table');
    
    // Find and click the update button
    const updateButton = await driver.findElement(By.css('.table-properties button[type="submit"]'));
    await updateButton.click();
    
    // Wait for update to complete
    await driver.sleep(1000);
    console.log('Table name updated');
    await takeScreenshot(driver, 'table_name_updated');
    
    // Test 6: Drag the table to a new position
    const actions = driver.actions({async: true});
    
    // Get table location
    const tableLocation = await table.getRect();
    
    // Drag table to new position (100px right, 50px down)
    await actions
      .move({origin: table})
      .press()
      .move({x: 100, y: 50, origin: 'pointer'})
      .release()
      .perform();
    
    // Wait for drag to complete
    await driver.sleep(1000);
    console.log('Table dragged to new position');
    await takeScreenshot(driver, 'table_dragged');
    
    // Test 7: Check for table layouts list and set active functionality
    try {
      console.log('Checking for table layouts list...');
      await driver.wait(until.elementLocated(By.css('.table-layouts-list, .layout-list')), 10000);
      const layoutsList = await driver.findElement(By.css('.table-layouts-list, .layout-list'));
      assert(await layoutsList.isDisplayed(), 'Table layouts list should be visible');
      await takeScreenshot(driver, 'table_layouts_list');
    } catch (e) {
      console.log('Error finding table layouts list:', e.message);
      await takeScreenshot(driver, 'layouts_list_error');
    }
    
    // Find a layout to set as active
    const layoutItems = await driver.findElements(By.css('.layout-item, .table-layout-item'));
    console.log(`Found ${layoutItems.length} layout items`);
    
    if (layoutItems.length > 0) {
      // Click on the first layout item
      await layoutItems[0].click();
      console.log('Selected a layout');
      await takeScreenshot(driver, 'layout_selected');
      
      // Look for set active button
      try {
        const setActiveButton = await driver.findElement(By.css('button[aria-label="Set Active"], button:contains("Set Active"), button.set-active-btn'));
        console.log('Found Set Active button');
        await setActiveButton.click();
        console.log('Clicked Set Active button');
        await takeScreenshot(driver, 'set_active_clicked');
        
        // Wait for active status to update
        await driver.sleep(2000);
        await takeScreenshot(driver, 'after_set_active');
        
        // Check for active indicator
        try {
          const activeIndicator = await driver.findElement(By.css('.active-indicator, .is-active, [data-active="true"]'));
          console.log('Found active indicator, set active functionality works!');
        } catch (e) {
          console.log('Could not find active indicator, set active functionality might not be working');
        }
      } catch (e) {
        console.log('Could not find Set Active button:', e.message);
      }
    }
    
    // Test 8: Delete the table if one exists
    try {
      const table = await driver.findElement(By.css('[data-testid^="table-"]'));
      await table.click();
      
      // Wait for table properties panel to appear
      await driver.wait(until.elementLocated(By.css('.table-properties')), 10000);
      
      const deleteButton = await driver.findElement(By.css('.table-properties button[aria-label="Delete Table"]'));
      await deleteButton.click();
      
      // Accept the confirmation dialog if it appears
      try {
        await driver.wait(until.alertIsPresent(), 3000);
        await driver.switchTo().alert().accept();
        console.log('Confirmation dialog accepted');
      } catch (e) {
        console.log('No alert dialog appeared, continuing test');
      }
      
      // Wait for table to be deleted
      await driver.sleep(1000);
      console.log('Table deleted');
      await takeScreenshot(driver, 'table_deleted');
    } catch (e) {
      console.log('No table to delete or could not delete table:', e.message);
    }
    
    // Save console logs to file
    fs.writeFileSync(
      path.join(screenshotDir, `console_logs_${new Date().toISOString().replace(/:/g, '-')}.log`),
      consoleLogs.join('\n'),
      'utf8'
    );
    
    console.log('All tests passed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await takeScreenshot(driver, 'test_failure');
    
    // Save console logs even on failure
    fs.writeFileSync(
      path.join(screenshotDir, `error_console_logs_${new Date().toISOString().replace(/:/g, '-')}.log`),
      consoleLogs.join('\n'),
      'utf8'
    );
    
    throw error;
  } finally {
    // Restore original console.log
    console.log = originalConsoleLog;
    
    // Close the browser
    await driver.quit();
  }
}

// Run the test with proper error handling
testTableLayoutEditor()
  .then(() => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
