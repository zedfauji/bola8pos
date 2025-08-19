import { WebDriverHelper } from '../utils/WebDriverHelper';
import { afterAll, beforeAll } from '@jest/globals';

export class BaseTest {
  protected driverHelper: WebDriverHelper;
  protected baseUrl: string = process.env.TEST_BASE_URL || 'http://localhost:5173';

  constructor() {
    this.driverHelper = WebDriverHelper.getInstance();
  }

  public async beforeTest(): Promise<void> {
    // Can be overridden by child classes
  }

  public async afterTest(): Promise<void> {
    // Can be overridden by child classes
  }

  public async beforeAll(): Promise<void> {
    await this.driverHelper.getDriver();
    await this.beforeTest();
  }

  public async afterAll(): Promise<void> {
    await this.afterTest();
    await this.driverHelper.quitDriver();
  }

  protected async takeScreenshot(name: string): Promise<string> {
    return this.driverHelper.takeScreenshot(name);
  }
}

