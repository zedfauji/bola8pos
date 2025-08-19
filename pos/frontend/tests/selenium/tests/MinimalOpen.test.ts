import { describe, test, expect } from '@jest/globals';
import { WebDriverHelper } from '../utils/WebDriverHelper';

// Minimal test: build driver and quit quickly to validate Chrome/Driver setup

describe('Minimal Selenium Open', () => {
  test('can start and quit WebDriver', async () => {
    const helper = WebDriverHelper.getInstance();
    const driver = await helper.getDriver();
    expect(driver).toBeTruthy();
    await helper.quitDriver();
  }, 120000);
});
