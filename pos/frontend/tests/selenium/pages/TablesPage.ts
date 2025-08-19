import { WebDriver, By, until, WebElement } from 'selenium-webdriver';

export interface TablePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TablesPage {
  constructor(private driver: WebDriver) {}

  async navigateTo() {
    await this.driver.get('http://localhost:3000/tables');
  }

  async waitForTableLayout(timeout = 30000) {
    try {
      console.log('Waiting for table layout to load...');
      
      // Wait for any loading indicators to disappear
      await this.driver.wait(
        async () => {
          const loaders = await this.driver.findElements(By.css('.loading-spinner, [data-loading]'));
          return loaders.length === 0;
        },
        timeout / 2,
        'Loading indicators did not disappear'
      );
      
      // Wait for the table layout container to be present and visible
      const container = await this.driver.wait(
        until.elementLocated(
          By.css('.table-layout, [data-testid="table-layout"], .tables-container, [class*="tables-"]')
        ),
        timeout,
        'Table layout container not found'
      );
      
      await this.driver.wait(
        until.elementIsVisible(container),
        timeout,
        'Table layout container is not visible'
      );
      
      // Wait for at least one table to be present
      await this.driver.wait(
        async () => (await this.getTables()).length > 0,
        timeout,
        'No tables found in the layout'
      );
      
      console.log('Table layout loaded successfully');
    } catch (error) {
      console.error('Error waiting for table layout:', error);
      await this.takeScreenshot('table-layout-error');
      throw error;
    }
  }

  async getTables(): Promise<WebElement[]> {
    // Find all table elements in the layout using multiple possible selectors
    const selectors = [
      '.table-item',
      '[data-testid^="table-"]',
      '[class*="table-"]',
      '.table',
      '.table-container .item',
      '[role="table"]',
      '.MuiGrid-item',
      '.ant-col'
    ];
    
    // Try each selector until we find tables
    for (const selector of selectors) {
      try {
        const tables = await this.driver.findElements(By.css(selector));
        if (tables.length > 0) {
          console.log(`Found ${tables.length} tables using selector: ${selector}`);
          return tables;
        }
      } catch (error) {
        // Ignore and try next selector
        console.log(`Selector '${selector}' did not match any elements`);
      }
    }
    
    console.warn('No tables found using any selector');
    return [];
  }

  async getTablePosition(table: WebElement): Promise<TablePosition> {
    try {
      // Scroll the table into view
      await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"});', table);
      
      // Get the position and size of a table element
      const rect = await table.getRect();
      const position = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
      
      console.log('Table position:', position);
      return position;
    } catch (error) {
      console.error('Error getting table position:', error);
      await this.takeScreenshot('table-position-error');
      throw error;
    }
  }

  async takeScreenshot(name: string): Promise<string> {
    try {
      // Take a screenshot of the current page
      const screenshot = await this.driver.takeScreenshot();
      const fs = require('fs');
      const path = require('path');
      
      const dir = path.join(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(dir, `${name}-${timestamp}.png`);
      fs.writeFileSync(filePath, screenshot, 'base64');
      
      console.log(`Screenshot saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return '';
    }
  }
}

class TableElement {
  constructor(
    private driver: WebDriver,
    private element: WebElement
  ) {}

  async getPosition() {
    const location = await this.element.getRect();
    return {
      x: location.x,
      y: location.y,
      width: location.width,
      height: location.height
    };
  }

  async getStatus() {
    return await this.element.getAttribute('data-status');
  }

  async getName() {
    return await this.element.findElement(By.css('.table-name')).getText();
  }
}
