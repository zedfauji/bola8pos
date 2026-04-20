import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 60_000,
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
    slowMo: 400,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      headless: false,
      slowMo: 400,
    },
  },
  projects: [{ name: 'chromium', use: { channel: 'chrome', headless: false } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
