import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { WebDriver } from 'selenium-webdriver';
import { WebDriverHelper } from '../utils/WebDriverHelper';
import { BaseTest } from '../base/BaseTest';

class SmokeTest extends BaseTest {
  public driverHelper = WebDriverHelper.getInstance();
  public getBaseUrl(): string {
    // @ts-ignore protected in BaseTest
    return this.baseUrl;
  }
}

describe('Selenium Smoke', () => {
  const smoke = new SmokeTest();

  beforeAll(async () => {
    await smoke.beforeAll();
  }, 90000);

  afterAll(async () => {
    await smoke.afterAll();
  }, 20000);

  test('opens the browser', async () => {
    const driver: WebDriver = await smoke.driverHelper.getDriver();
    expect(driver).toBeTruthy();
  }, 10000);

  test('loads login page', async () => {
    const baseUrl = smoke.getBaseUrl();
    const driver = await smoke.driverHelper.getDriver();
    await smoke.driverHelper.startConsoleCapture();
    // Cleanup session to avoid auto-redirect if already authenticated
    await driver.manage().deleteAllCookies();
    try {
      await driver.executeScript('window.localStorage && localStorage.clear(); window.sessionStorage && sessionStorage.clear();');
    } catch {}
    await smoke.driverHelper.navigateTo(`${baseUrl}/login`);
    const { By, until } = await import('selenium-webdriver');
    try {
      await driver.wait(until.urlContains('/login'), 10000);
      await driver.wait(until.elementLocated(By.css('#email-address')), 20000);
      await driver.wait(until.elementLocated(By.xpath("//h2[contains(., 'Sign in to your account')]")), 20000);
      expect(true).toBeTruthy();
    } catch (e) {
      const url = await driver.getCurrentUrl();
      const title = await driver.getTitle();
       
      console.error(`[Smoke] Failed to load login. URL=${url} Title=${title}. Error=${e instanceof Error ? e.message : e}`);
      try {
        const logs = await smoke.driverHelper.getConsoleLogs();
         
        console.error('[Smoke] Browser console logs (login page):');
        logs.forEach(l => console.error(`[${l.level}] ${l.message}`));
      } catch {}
      await smoke.driverHelper.takeScreenshot('smoke-load-login-failed');
      throw e;
    }
  }, 30000);

  test('can login with valid credentials', async () => {
    const baseUrl = smoke.getBaseUrl();
    const driver = await smoke.driverHelper.getDriver();
    await smoke.driverHelper.startConsoleCapture();
    // Ensure clean state
    await driver.manage().deleteAllCookies();
    try {
      await driver.executeScript('window.localStorage && localStorage.clear(); window.sessionStorage && sessionStorage.clear();');
    } catch {}
    await smoke.driverHelper.navigateTo(`${baseUrl}/login`);
    await smoke.driverHelper.waitForElementAndType('#email-address', 'admin@billiardpos.com');
    await smoke.driverHelper.waitForElementAndType('#password', 'password');
    await smoke.driverHelper.waitForElementAndClick('button[type="submit"]');
    // Give the app a brief moment to navigate/render
    await (await smoke.driverHelper.getDriver()).sleep(300);

    const { By, until } = await import('selenium-webdriver');
    try {
      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        if (url.includes('/dashboard')) return true;
        const els = await driver.findElements(By.xpath("//h1[contains(., 'Dashboard')]"));
        return els.length > 0;
      }, 30000);
      expect(true).toBeTruthy();
    } catch (e) {
      // Best-effort diagnostics; guard against session being gone
      try {
        const url = await driver.getCurrentUrl();
        const title = await driver.getTitle();
         
        console.error(`[Smoke] Failed to navigate to dashboard after login. URL=${url} Title=${title}. Error=${e instanceof Error ? e.message : e}`);
      } catch {}
      try {
        const logs = await smoke.driverHelper.getConsoleLogs();
         
        console.error('[Smoke] Browser console logs (after login submit):');
        logs.forEach(l => console.error(`[${l.level}] ${l.message}`));
      } catch {}
      try { await smoke.driverHelper.takeScreenshot('smoke-login-failed'); } catch {}
      throw e;
    }
  }, 30000);
});
