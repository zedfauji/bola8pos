import { WebDriver, By, until } from 'selenium-webdriver';

export class DashboardPage {
  constructor(private driver: WebDriver) {}

  async navigateToTables() {
    try {
      // First try to find and click on the tables link in the sidebar or navigation
      const tablesLink = await this.driver.wait(
        until.elementLocated(
          By.xpath("//a[contains(translate(., 'TABLES', 'tables'), 'tables') or contains(@href,'tables')]")
        ),
        10000,
        'Tables link not found in navigation'
      );
      
      // Scroll the element into view and click
      await this.driver.executeScript('arguments[0].scrollIntoView(true);', tablesLink);
      await this.driver.wait(until.elementIsVisible(tablesLink), 5000, 'Tables link is not visible');
      await tablesLink.click();
      
      // Wait for tables page to load (either by URL change or by waiting for a tables-specific element)
      await this.driver.wait(
        async () => {
          const currentUrl = await this.driver.getCurrentUrl();
          return currentUrl.includes('/tables');
        },
        15000,
        'Did not navigate to tables page after clicking tables link'
      );
      
      // Wait for tables content to load
      await this.driver.wait(
        until.elementLocated(By.css('.tables-container, [data-testid="tables-page"], #tables, [class*="tables"]')),
        10000,
        'Tables content did not load after navigation'
      );
    } catch (error) {
      console.error('Error navigating to tables page:', error);
      throw error;
    }
  }
}
