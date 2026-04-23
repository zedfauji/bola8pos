import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const fastE2e = process.env.FAST_E2E === '1' || process.env.FAST_E2E === 'true';
const slowMo = fastE2e ? 0 : 400;
const testTimeout = fastE2e ? 45_000 : 60_000;
const webServerTimeout = fastE2e ? 75_000 : 120_000;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: testTimeout,
  expect: {
    timeout: fastE2e ? 5_000 : 10_000,
  },
  globalTeardown: path.join(__dirname, 'e2e', 'global-teardown.ts'),
  reporter: [
    ['blob', { outputDir: 'e2e-blob-reports' }],
    ['list'],
    ['json', { outputFile: 'e2e-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    headless: false,
    slowMo,
    actionTimeout: fastE2e ? 10_000 : undefined,
    navigationTimeout: fastE2e ? 15_000 : undefined,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      headless: false,
      slowMo,
    },
  },
  projects: [{ name: 'chromium', use: { channel: 'chrome', headless: false } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: webServerTimeout,
  },
});
