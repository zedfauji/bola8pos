import { Builder, WebDriver, until, By, WebElement } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as edge from 'selenium-webdriver/edge';

export class WebDriverHelper {
  private static instance: WebDriverHelper;
  private driver: WebDriver | null = null;

  private constructor() {}

  public static getInstance(): WebDriverHelper {
    if (!WebDriverHelper.instance) {
      WebDriverHelper.instance = new WebDriverHelper();
    }
    return WebDriverHelper.instance;
  }

  public async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      const options = new chrome.Options();

      // Headless mode: default to false so user can see browser unless explicitly enabled
      const headless = (process.env.SELENIUM_HEADLESS ?? 'false').toLowerCase() === 'true';
      // Diagnostics
       
      console.log(`[WebDriverHelper] Starting Chrome WebDriver. Headless=${headless}`);
      if (headless) {
        options.addArguments('--headless=new');
        options.addArguments('--disable-gpu');
      }

      // Window size
      options.addArguments('--window-size=1920,1080');

      // Disable extensions and other settings for stability
      options.addArguments('--disable-extensions');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      // Accept self-signed certs on https://localhost:3001
      options.addArguments('--ignore-certificate-errors');
      options.addArguments('--allow-insecure-localhost');

      // Prefer Selenium Manager (auto driver) by default; allow overriding to chromedriver package via env
      let builder = new Builder().forBrowser('chrome').setChromeOptions(options);
      const useChromedriverPkg = (process.env.USE_CHROMEDRIVER_PACKAGE || 'false').toLowerCase() === 'true';
      if (useChromedriverPkg) {
        try {
          // Dynamically resolve chromedriver path from the installed package
           
          const chromedriver = require('chromedriver');
          const driverPath: string = chromedriver.path || process.env.CHROMEDRIVER_PATH;
           
          console.log(`[WebDriverHelper] Using chromedriver package. Path=${driverPath || 'undefined'} (CHROMEDRIVER_PATH=${process.env.CHROMEDRIVER_PATH || ''})`);
          if (driverPath) {
            const service = new chrome.ServiceBuilder(driverPath).build();
            // @ts-ignore setChromeService exists in selenium-webdriver/chrome
            builder = builder.setChromeService(service);
          }
        } catch (e) {
           
          console.warn('[WebDriverHelper] chromedriver package not found, falling back to Selenium Manager');
        }
      } else {
         
        console.log('[WebDriverHelper] Using Selenium Manager to resolve driver');
      }
      // Build with timeout to avoid indefinite hang
      const buildWithTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
        let t: NodeJS.Timeout;
        const timeoutP = new Promise<never>((_, rej) => {
          t = setTimeout(() => rej(new Error(`WebDriver build timed out after ${ms}ms. Ensure Chrome and a matching chromedriver are installed.`)), ms);
        });
        try {
          // Race build against timeout
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return await Promise.race([p, timeoutP]);
        } finally {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          clearTimeout(t);
        }
      };

      const requestedBrowser = (process.env.USE_BROWSER || 'chrome').toLowerCase();
       
      console.log(`[WebDriverHelper] Requested browser: ${requestedBrowser}`);

      const buildEdge = async () => {
        const edgeOptions = new edge.Options();
        if (headless) {
          edgeOptions.addArguments('--headless=new');
          edgeOptions.addArguments('--disable-gpu');
        }
        edgeOptions.addArguments('--window-size=1920,1080');
        edgeOptions.addArguments('--disable-extensions');
        edgeOptions.addArguments('--no-sandbox');
        edgeOptions.addArguments('--disable-dev-shm-usage');
        // Accept self-signed certs on https://localhost:3001
        edgeOptions.addArguments('--ignore-certificate-errors');
        edgeOptions.addArguments('--allow-insecure-localhost');
        const edgeBuilder = new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(edgeOptions);
        return buildWithTimeout(edgeBuilder.build(), 60000);
      };

      if (requestedBrowser === 'edge') {
         
        console.log('[WebDriverHelper] Building WebDriver (Edge)...');
        this.driver = await buildEdge();
      } else {
         
        console.log('[WebDriverHelper] Building WebDriver (Chrome preferred)...');
        try {
          this.driver = await buildWithTimeout(builder.build(), 60000);
        } catch (chromeErr) {
           
          console.warn(`[WebDriverHelper] Chrome build failed: ${chromeErr instanceof Error ? chromeErr.message : chromeErr}. Trying Edge...`);
          this.driver = await buildEdge();
        }
      }
       
      console.log('[WebDriverHelper] WebDriver started. Setting timeouts.');
      // Set conservative timeouts to avoid long hangs
      await this.driver.manage().setTimeouts({
        implicit: 0,
        pageLoad: 15000,
        script: 15000,
      });
    }
    return this.driver;
  }

  public async quitDriver(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }

  public async waitForElement(selector: string, timeout: number = 10000): Promise<WebElement> {
    const driver = await this.getDriver();
    return driver.wait(until.elementLocated(By.css(selector)), timeout);
  }

  public async waitForVisible(selector: string, timeout: number = 10000): Promise<WebElement> {
    const driver = await this.getDriver();
    const el = await driver.wait(until.elementLocated(By.css(selector)), timeout);
    await driver.wait(until.elementIsVisible(el), timeout);
    return el;
  }

  public async waitForClickable(selector: string, timeout: number = 10000): Promise<WebElement> {
    const el = await this.waitForVisible(selector, timeout);
    // elementIsEnabled is the closest to clickable in selenium-webdriver
    const driver = await this.getDriver();
    await driver.wait(until.elementIsEnabled(el), timeout);
    return el;
  }

  public async waitForElementAndClick(selector: string, timeout: number = 10000): Promise<void> {
    const element = await this.waitForClickable(selector, timeout);
    await element.click();
  }

  public async waitForElementAndType(selector: string, text: string, timeout: number = 10000): Promise<void> {
    const element = await this.waitForVisible(selector, timeout);
    await element.clear();
    await element.sendKeys(text);
  }

  public async getElementText(selector: string, timeout: number = 10000): Promise<string> {
    const element = await this.waitForVisible(selector, timeout);
    return element.getText();
  }

  public async isElementDisplayed(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      const element = await this.waitForElement(selector, timeout);
      return await element.isDisplayed();
    } catch (e) {
      return false;
    }
  }

  public async waitForDocumentReady(timeout: number = 10000): Promise<void> {
    const driver = await this.getDriver();
    const end = Date.now() + timeout;
    // Poll for document.readyState === 'complete'
    while (Date.now() < end) {
      const ready = await driver.executeScript('return document.readyState');
      if (ready === 'complete') return;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Document not ready within timeout');
  }

  public async navigateTo(url: string, timeout: number = 15000): Promise<void> {
    const driver = await this.getDriver();
    await driver.get(url);
    await this.waitForDocumentReady(Math.min(timeout, 15000));
  }

  public async takeScreenshot(name: string): Promise<string> {
    const driver = await this.getDriver();
    const screenshot = await driver.takeScreenshot();
    const fs = require('fs');
    const path = require('path');
    
    const dir = path.join(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
    fs.writeFileSync(filePath, screenshot, 'base64');
    return filePath;
  }

  // Start capturing console logs inside the browser using a simple shim.
  public async startConsoleCapture(): Promise<void> {
    const driver = await this.getDriver();
    try {
      await driver.executeScript(`
        (function(){
          try {
            if (window.__e2eLogsInitialized) return;
            window.__e2eLogsInitialized = true;
            window.__e2eLogs = [];
            ['log','warn','error'].forEach(function(level){
              var orig = console[level];
              console[level] = function(){
                try {
                  var args = Array.prototype.slice.call(arguments).map(function(a){
                    try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); }
                  }).join(' ');
                  window.__e2eLogs.push({ level: level, message: args });
                } catch (e) {}
                return orig.apply(console, arguments);
              };
            });
          } catch (e) {}
        })();
      `);
    } catch {}
  }

  // Retrieve captured console logs
  public async getConsoleLogs(): Promise<Array<{ level: string; message: string }>> {
    const driver = await this.getDriver();
    try {
      const logs = await driver.executeScript('return (window.__e2eLogs || [])');
      return (logs as any[]) as Array<{ level: string; message: string }>;
    } catch {
      return [];
    }
  }
}
